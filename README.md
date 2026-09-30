<img src="./.github/logo.png" width="80" />

# diffity

[![Latest release](https://img.shields.io/github/v/release/nilbuild/diffity)](https://github.com/nilbuild/diffity/releases/latest)
[![Platform: macOS](https://img.shields.io/badge/platform-macOS-lightgrey)](https://github.com/nilbuild/diffity/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Diffity is a Mac app for reviewing code changes, yours or your agent's, GitHub-style, with Claude Code in the loop.

<img src="./.github/screenshots/hero.png" alt="Diffity showing uncommitted changes with a comment thread answered by Claude" />

[![Download for macOS](https://img.shields.io/badge/Download_for_macOS-000000?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/nilbuild/diffity/releases/latest)

macOS 13.3 or later, Apple Silicon and Intel. The AI features need [Claude Code](https://docs.claude.com/en/docs/claude-code) (logged in) and Node.js.

| What can you do? | Description |
|---|---|
| [Comment on your diff](#comment-on-your-diff) | Leave comments on lines, files or the whole diff, then send them to Claude to fix |
| [Ask @claude](#ask-claude) | Mention @claude in any thread and Claude replies right there |
| [Get a Claude review](#get-a-claude-review) | Claude reads the diff and leaves comments on the lines it cares about |
| [Review any commit or range](#review-any-commit-or-range) | Uncommitted changes, a commit, a range or a whole branch |
| [Review pull requests](#review-pull-requests) | Check out a GitHub PR, review it locally, post the review back |
| [Jump anywhere](#jump-anywhere) | ⌘P for files, ⌘K for commits, comments, PRs and every action |
| [Switch projects](#switch-projects) | Keep your repos in a rail and switch with ⌘1–9 |

### Comment on your diff

> Drag across line numbers or click the `+` in the gutter, write a comment, then hit **Send to Claude** to have it fix them.

<img src="./.github/screenshots/comment.gif" alt="Selecting lines in a diff and leaving a comment" />

### Ask @claude

> Type `@claude` in any comment or reply and Claude answers in the same thread.

<img src="./.github/screenshots/claude-reply.gif" alt="Mentioning @claude in a comment and Claude replying in the thread" />

### Get a Claude review

> Click **Ask Claude to review**, optionally add what to focus on, and its comments land on the diff as it works.

<img src="./.github/screenshots/claude-review.gif" alt="Asking Claude to review and its comments appearing on the diff" />

### Review any commit or range

> Open the picker next to the project name to switch between uncommitted changes, a commit, a range or a branch.

<img src="./.github/screenshots/refs.gif" alt="Searching commits in the ref picker and opening one" />

### Review pull requests

> Pick a PR from the branch switcher to check it out, comment as you read, then **Submit review** to post it to GitHub.

<img src="./.github/screenshots/pull-request.gif" alt="Checking out a pull request from the branch switcher and opening the review panel" />

### Jump anywhere

> Press `⌘P` to open any file, or `⌘K` to search commits, comments, PRs and every action.

<img src="./.github/screenshots/palette.gif" alt="Opening a file with ⌘P and switching to dark theme with ⌘K" />

### Switch projects

> Open a repo with `⌘O`; it stays in the left rail, so `⌘1`–`⌘9` takes you back to it.

<img src="./.github/screenshots/projects.gif" alt="Switching between projects in the rail" />

## License

[MIT](./LICENSE) © [Kamran Ahmed](https://x.com/kamrify)
