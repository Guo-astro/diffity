use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use ignore::gitignore::{Gitignore, GitignoreBuilder};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};

use crate::core::error::{AppError, Result};

pub const DEBOUNCE: Duration = Duration::from_millis(250);

pub type ChangeCallback = Arc<dyn Fn(&str) + Send + Sync>;

fn build_ignore(root: &Path) -> Gitignore {
    let mut builder = GitignoreBuilder::new(root);
    let _ = builder.add(root.join(".gitignore"));
    let _ = builder.add(root.join(".git").join("info").join("exclude"));
    builder.build().unwrap_or_else(|_| Gitignore::empty())
}

/// Whether a changed path should trigger `repo-changed`: `.git` internals are ignored except
/// HEAD, index, packed-refs and refs/**; gitignored paths are ignored.
pub fn is_relevant(root: &Path, matcher: &Gitignore, path: &Path) -> bool {
    let Ok(rel) = path.strip_prefix(root) else {
        return false;
    };
    let mut comps = rel.components();
    let Some(first) = comps.next() else {
        return false;
    };
    if first.as_os_str() == ".git" {
        let rest: PathBuf = comps.collect();
        let rest = rest.to_string_lossy();
        return rest == "HEAD" || rest == "index" || rest == "packed-refs" || rest.starts_with("refs");
    }
    let is_dir = path.is_dir();
    !matcher.matched_path_or_any_parents(rel, is_dir).is_ignore()
}

#[derive(Default)]
struct Pending {
    since: Option<Instant>,
    stopped: bool,
}

/// Collapses relevant events into one `repo-changed` call per `DEBOUNCE` window.
#[derive(Default)]
struct Signal {
    pending: Mutex<Pending>,
    cv: Condvar,
}

impl Signal {
    fn is_pending(&self) -> bool {
        self.pending.lock().map(|p| p.since.is_some()).unwrap_or(false)
    }

    fn mark(&self) {
        let Ok(mut p) = self.pending.lock() else {
            return;
        };
        p.since.get_or_insert_with(Instant::now);
        self.cv.notify_one();
    }

    fn stop(&self) {
        if let Ok(mut p) = self.pending.lock() {
            p.stopped = true;
        }
        self.cv.notify_one();
    }

    /// Blocks until a window closes; `false` once stopped.
    fn wait(&self) -> bool {
        let Ok(mut p) = self.pending.lock() else {
            return false;
        };
        loop {
            if p.stopped {
                return false;
            }
            let Some(since) = p.since else {
                p = match self.cv.wait(p) {
                    Ok(p) => p,
                    Err(_) => return false,
                };
                continue;
            };
            let now = Instant::now();
            let deadline = since + DEBOUNCE;
            if now >= deadline {
                p.since = None;
                return true;
            }
            p = match self.cv.wait_timeout(p, deadline - now) {
                Ok((p, _)) => p,
                Err(_) => return false,
            };
        }
    }
}

struct Entry {
    watcher: RecommendedWatcher,
    signal: Arc<Signal>,
}

impl Entry {
    fn stop(self) {
        self.signal.stop();
        drop(self.watcher);
    }
}

#[derive(Default)]
struct Watchers {
    entries: HashMap<String, Entry>,
    /// `watch` calls minus `unwatch` calls per path. The commands run on the blocking pool in any
    /// order, so an `unwatch` can land before the `watch` it pairs with; the count may dip below zero.
    counts: HashMap<String, i64>,
}

/// Registry of per-repo file watchers, reference-counted per path.
#[derive(Default)]
pub struct WatcherRegistry {
    watchers: Mutex<Watchers>,
}

impl WatcherRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn is_watching(&self, repo_path: &str) -> bool {
        self.watchers
            .lock()
            .map(|w| w.entries.contains_key(repo_path))
            .unwrap_or(false)
    }

    pub fn watch(&self, repo_path: &str, on_change: ChangeCallback) -> Result<()> {
        let mut watchers = self
            .watchers
            .lock()
            .map_err(|_| AppError::internal("watcher registry poisoned"))?;
        let count = watchers.counts.entry(repo_path.to_string()).or_insert(0);
        *count += 1;
        if *count <= 0 || watchers.entries.contains_key(repo_path) {
            return Ok(());
        }
        let root = PathBuf::from(repo_path);
        if !root.is_dir() {
            release(&mut watchers, repo_path);
            return Err(AppError::not_found(format!("{repo_path} is not a directory")));
        }
        let root = root.canonicalize().unwrap_or(root);
        match start(&root, repo_path, on_change) {
            Ok(entry) => {
                watchers.entries.insert(repo_path.to_string(), entry);
                Ok(())
            }
            Err(e) => {
                release(&mut watchers, repo_path);
                Err(e)
            }
        }
    }

    pub fn unwatch(&self, repo_path: &str) -> Result<()> {
        let mut watchers = self
            .watchers
            .lock()
            .map_err(|_| AppError::internal("watcher registry poisoned"))?;
        let count = watchers.counts.entry(repo_path.to_string()).or_insert(0);
        *count -= 1;
        if *count > 0 {
            return Ok(());
        }
        if *count == 0 {
            watchers.counts.remove(repo_path);
        }
        let entry = watchers.entries.remove(repo_path);
        drop(watchers);
        if let Some(entry) = entry {
            entry.stop();
        }
        Ok(())
    }
}

/// Starts a raw watcher that drops irrelevant events in its callback, so ignored paths such as
/// `node_modules` cost one gitignore match each and nothing is cached or queued per path.
fn start(root: &Path, repo_path: &str, on_change: ChangeCallback) -> Result<Entry> {
    let signal = Arc::new(Signal::default());
    let matcher = Mutex::new(build_ignore(root));
    let ignore_files = [root.join(".gitignore"), root.join(".git").join("info").join("exclude")];
    let handler_root = root.to_path_buf();
    let handler_signal = signal.clone();
    let handler = move |res: notify::Result<Event>| {
        let Ok(event) = res else {
            return;
        };
        if matches!(event.kind, EventKind::Access(_)) {
            return;
        }
        let Ok(mut m) = matcher.lock() else {
            return;
        };
        if event.paths.iter().any(|p| ignore_files.contains(p)) {
            *m = build_ignore(&handler_root);
        }
        if event.need_rescan() {
            drop(m);
            handler_signal.mark();
            return;
        }
        if handler_signal.is_pending() {
            return;
        }
        let relevant = event.paths.iter().any(|p| {
            if p.starts_with(&handler_root) {
                return is_relevant(&handler_root, &m, p);
            }
            is_relevant(&handler_root, &m, &normalize(p))
        });
        drop(m);
        if relevant {
            handler_signal.mark();
        }
    };
    let mut watcher = notify::recommended_watcher(handler)
        .map_err(|e| AppError::io(format!("failed to create watcher: {e}")))?;
    watcher
        .watch(root, RecursiveMode::Recursive)
        .map_err(|e| AppError::io(format!("failed to watch {repo_path}: {e}")))?;
    let key = repo_path.to_string();
    let thread_signal = signal.clone();
    thread::Builder::new()
        .name("diffity-watch".into())
        .spawn(move || {
            while thread_signal.wait() {
                on_change(&key);
            }
        })
        .map_err(|e| AppError::io(format!("failed to start watcher thread: {e}")))?;
    Ok(Entry { watcher, signal })
}

/// Undoes the count of a `watch` that failed.
fn release(watchers: &mut Watchers, repo_path: &str) {
    if let Some(count) = watchers.counts.get_mut(repo_path) {
        *count -= 1;
        if *count == 0 {
            watchers.counts.remove(repo_path);
        }
    }
}

fn normalize(p: &Path) -> PathBuf {
    p.canonicalize().unwrap_or_else(|_| p.to_path_buf())
}
