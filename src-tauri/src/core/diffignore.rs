//! Files hidden from diffs: `.diffityignore` at the repo root plus a per-repo list kept in the git dir
//! (`.git/info/diffityignore`, like `.git/info/exclude`). Both use gitignore syntax; the local list wins on conflicts.

use std::path::{Path, PathBuf};

use ignore::gitignore::{Gitignore, GitignoreBuilder};
use sha2::{Digest, Sha256};

use crate::core::error::Result;
use crate::core::git;

pub const IGNORE_FILE: &str = ".diffityignore";
const LOCAL_FILE: &str = "info/diffityignore";

pub struct DiffIgnore {
    matcher: Option<Gitignore>,
    rules_hash: String,
}

impl DiffIgnore {
    pub fn none() -> DiffIgnore {
        DiffIgnore {
            matcher: None,
            rules_hash: String::new(),
        }
    }

    /// Builds a matcher from gitignore-syntax sources, in increasing precedence. Invalid lines are skipped.
    pub fn from_sources(root: &Path, sources: &[(PathBuf, String)]) -> DiffIgnore {
        let mut builder = GitignoreBuilder::new(root);
        let mut hasher = Sha256::new();
        let mut rules = 0;
        for (from, text) in sources {
            for line in text.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() || trimmed.starts_with('#') {
                    continue;
                }
                if builder.add_line(Some(from.clone()), line).is_err() {
                    continue;
                }
                hasher.update(line.as_bytes());
                hasher.update([0u8]);
                rules += 1;
            }
        }
        if rules == 0 {
            return DiffIgnore::none();
        }
        let Ok(matcher) = builder.build() else {
            return DiffIgnore::none();
        };
        DiffIgnore {
            matcher: Some(matcher),
            rules_hash: format!("{:x}", hasher.finalize()),
        }
    }

    /// The repo's `.diffityignore` and local list. Missing files mean no rules.
    pub fn load(repo: &Path) -> Result<DiffIgnore> {
        let mut sources = Vec::new();
        let shared = repo.join(IGNORE_FILE);
        if let Ok(text) = std::fs::read_to_string(&shared) {
            sources.push((shared, text));
        }
        if let Some(local) = local_rules_path(repo)? {
            if let Ok(text) = std::fs::read_to_string(&local) {
                sources.push((local, text));
            }
        }
        Ok(DiffIgnore::from_sources(repo, &sources))
    }

    pub fn is_empty(&self) -> bool {
        self.matcher.is_none()
    }

    /// Changes whenever the rules do, so diff fingerprints notice edited ignore lists.
    pub fn rules_hash(&self) -> &str {
        &self.rules_hash
    }

    /// Whether a repo-relative path is hidden, directly or through a parent directory. A file's own negation
    /// (`!dist/keep.js`) re-includes it even under an ignored directory.
    pub fn is_ignored(&self, path: &str, is_dir: bool) -> bool {
        let Some(matcher) = &self.matcher else {
            return false;
        };
        if path.is_empty() {
            return false;
        }
        matcher.matched_path_or_any_parents(path, is_dir).is_ignore()
    }

    /// The pathspec that hides `path`: its topmost ignored directory when no negation could re-include files
    /// below it (keeps the git command line short for generated folders), else the path itself.
    pub fn exclusion_for(&self, path: &str) -> String {
        let Some(matcher) = &self.matcher else {
            return path.to_string();
        };
        if matcher.num_whitelists() > 0 {
            return path.to_string();
        }
        let mut end = 0;
        while let Some(pos) = path[end..].find('/') {
            let dir = &path[..end + pos];
            if matcher.matched(dir, true).is_ignore() {
                return dir.to_string();
            }
            end += pos + 1;
        }
        path.to_string()
    }
}

/// Where the per-repo list lives (`<git dir>/info/diffityignore`), or `None` outside a git repo.
pub fn local_rules_path(repo: &Path) -> Result<Option<PathBuf>> {
    let dot_git = repo.join(".git");
    if dot_git.is_dir() {
        return Ok(Some(dot_git.join(LOCAL_FILE)));
    }
    let Some(out) = git::run_opt(repo, &["rev-parse", "--git-path", LOCAL_FILE])? else {
        return Ok(None);
    };
    let rel = String::from_utf8_lossy(&out).trim().to_string();
    if rel.is_empty() {
        return Ok(None);
    }
    Ok(Some(repo.join(rel)))
}

pub fn read_local_rules(repo: &Path) -> Result<String> {
    let Some(path) = local_rules_path(repo)? else {
        return Ok(String::new());
    };
    match std::fs::read_to_string(path) {
        Ok(text) => Ok(text),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(e.into()),
    }
}

pub fn write_local_rules(repo: &Path, text: &str) -> Result<()> {
    git::require_repo(repo)?;
    let Some(path) = local_rules_path(repo)? else {
        return Ok(());
    };
    if text.trim().is_empty() {
        match std::fs::remove_file(&path) {
            Ok(()) => return Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(e) => return Err(e.into()),
        }
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut body = text.to_string();
    if !body.ends_with('\n') {
        body.push('\n');
    }
    std::fs::write(path, body)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rules(text: &str) -> DiffIgnore {
        let root = Path::new("/repo");
        DiffIgnore::from_sources(root, &[(root.join(IGNORE_FILE), text.to_string())])
    }

    #[test]
    fn empty_and_comment_only_rules_ignore_nothing() {
        assert!(rules("").is_empty());
        assert!(rules("# just a comment\n\n").is_empty());
        assert!(!rules("# x").is_ignored("x", false));
    }

    #[test]
    fn globs_dirs_and_anchors() {
        let r = rules("# generated\n*.min.js\ndist/\n/schema.gen.ts\n");
        assert!(r.is_ignored("app.min.js", false));
        assert!(r.is_ignored("web/vendor/app.min.js", false));
        assert!(r.is_ignored("dist/bundle.js", false));
        assert!(r.is_ignored("packages/ui/dist/index.js", false));
        assert!(r.is_ignored("dist", true));
        assert!(!r.is_ignored("dist", false));
        assert!(r.is_ignored("schema.gen.ts", false));
        assert!(!r.is_ignored("src/schema.gen.ts", false));
        assert!(!r.is_ignored("src/app.js", false));
    }

    #[test]
    fn negation_re_includes() {
        let r = rules("generated/**\n!generated/keep.ts\n");
        assert!(r.is_ignored("generated/a.ts", false));
        assert!(!r.is_ignored("generated/keep.ts", false));
    }

    #[test]
    fn later_sources_override_earlier_ones() {
        let root = Path::new("/repo");
        let r = DiffIgnore::from_sources(
            root,
            &[
                (root.join(IGNORE_FILE), "*.lock\n".to_string()),
                (root.join(".git/info/diffityignore"), "!Cargo.lock\n".to_string()),
            ],
        );
        assert!(r.is_ignored("yarn.lock", false));
        assert!(!r.is_ignored("Cargo.lock", false));
    }

    #[test]
    fn exclusions_collapse_to_the_ignored_folder() {
        let r = rules("dist/\n*.snap\n");
        assert_eq!(r.exclusion_for("dist/a/b.js"), "dist");
        assert_eq!(r.exclusion_for("pkg/dist/b.js"), "pkg/dist");
        assert_eq!(r.exclusion_for("tests/__snapshots__/a.snap"), "tests/__snapshots__/a.snap");
        let with_negation = rules("dist/*\n!dist/keep.js\n");
        assert_eq!(with_negation.exclusion_for("dist/a.js"), "dist/a.js");
    }
}
