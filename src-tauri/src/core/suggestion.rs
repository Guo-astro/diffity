//! Applies a review comment's suggested change (a ```suggestion block) to a file in the working tree.

use std::path::Path;

use serde::Serialize;

use crate::core::error::{AppError, Result};
use crate::core::tree::resolve_in_repo;

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppliedSuggestion {
    /// The lines the replacement now occupies; `end_line` is `start_line - 1` when it removed the lines.
    pub start_line: u32,
    pub end_line: u32,
}

fn split_lines(text: &str) -> Vec<String> {
    let text = text.replace("\r\n", "\n");
    let text = text.strip_suffix('\n').unwrap_or(&text);
    if text.is_empty() {
        return Vec::new();
    }
    text.split('\n').map(str::to_string).collect()
}

/// Replaces lines `start_line..=end_line` (1-based) of `path` with `replacement`, only while they still read
/// `expected`. `end_line == start_line - 1` with an empty `expected` inserts before `start_line` (used by undo).
/// Keeps the file's line endings and trailing newline. Fails with `stale` when the lines changed.
pub fn apply(repo: &Path, path: &str, start_line: u32, end_line: u32, expected: &str, replacement: &str) -> Result<AppliedSuggestion> {
    let full = resolve_in_repo(repo, path)?;
    let bytes = std::fs::read(&full)?;
    let content = String::from_utf8(bytes).map_err(|_| AppError::invalid(format!("{path} is not a text file")))?;
    let eol = if content.contains("\r\n") { "\r\n" } else { "\n" };
    let trailing_newline = content.ends_with('\n');
    let mut lines = split_lines(&content);

    if start_line == 0 || end_line + 1 < start_line || end_line as usize > lines.len() {
        return Err(AppError::new("stale", format!("{path} no longer has lines {start_line}–{end_line}")));
    }
    let range = (start_line as usize - 1)..(end_line as usize);
    if lines[range.clone()] != split_lines(expected)[..] {
        return Err(AppError::new("stale", format!("Lines {start_line}–{end_line} of {path} changed since the suggestion was made")));
    }
    let new_lines = split_lines(replacement);
    let count = new_lines.len() as u32;
    lines.splice(range, new_lines);

    let mut out = lines.join(eol);
    if trailing_newline && !lines.is_empty() {
        out.push_str(eol);
    }
    std::fs::write(&full, out)?;
    Ok(AppliedSuggestion { start_line, end_line: start_line + count - 1 })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup(content: &str) -> (tempfile::TempDir, std::path::PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        std::fs::write(root.join("a.txt"), content).unwrap();
        (dir, root)
    }

    fn read(root: &Path) -> String {
        std::fs::read_to_string(root.join("a.txt")).unwrap()
    }

    #[test]
    fn replaces_lines_that_still_match() {
        let (_dir, root) = setup("one\ntwo\nthree\nfour\n");
        let applied = apply(&root, "a.txt", 2, 3, "two\nthree", "TWO\nTHREE\nextra\n").unwrap();
        assert_eq!(applied, AppliedSuggestion { start_line: 2, end_line: 4 });
        assert_eq!(read(&root), "one\nTWO\nTHREE\nextra\nfour\n");
    }

    #[test]
    fn refuses_changed_lines() {
        let (_dir, root) = setup("one\ntwo\n");
        let err = apply(&root, "a.txt", 2, 2, "TWO", "2").unwrap_err();
        assert_eq!(err.code, "stale");
        let err = apply(&root, "a.txt", 2, 5, "two", "2").unwrap_err();
        assert_eq!(err.code, "stale");
        assert_eq!(read(&root), "one\ntwo\n");
    }

    #[test]
    fn keeps_crlf_and_missing_trailing_newline() {
        let (_dir, root) = setup("a\r\nb\r\nc");
        apply(&root, "a.txt", 3, 3, "c", "C\nD").unwrap();
        assert_eq!(read(&root), "a\r\nb\r\nC\r\nD");
    }

    #[test]
    fn empty_suggestion_deletes_and_undo_restores() {
        let (_dir, root) = setup("one\ntwo\nthree\n");
        let applied = apply(&root, "a.txt", 2, 2, "two", "").unwrap();
        assert_eq!(applied, AppliedSuggestion { start_line: 2, end_line: 1 });
        assert_eq!(read(&root), "one\nthree\n");
        apply(&root, "a.txt", applied.start_line, applied.end_line, "", "two").unwrap();
        assert_eq!(read(&root), "one\ntwo\nthree\n");
    }

    #[test]
    fn rejects_paths_outside_the_repo() {
        let (_dir, root) = setup("x\n");
        assert_eq!(apply(&root, "../a.txt", 1, 1, "x", "y").unwrap_err().code, "invalid");
    }
}
