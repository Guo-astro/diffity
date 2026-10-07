# Write a reading guide

A reviewer is about to read the diff `{{ref}}` in Diffity. In file order they jump between files trying to work out what it is for. Write a guide that tells the change as a short story: an overview, then chapters, each one idea, in the order that makes the change easiest to follow. Save it with the `set_guide` tool, whose fields say what each part needs.

**Diffity tools only.** Read the diff and read/write review comments exclusively through the `diffity` MCP server tools in this session (named `mcp__diffity__<tool>`, e.g. `mcp__diffity__get_diff`, `mcp__diffity__set_guide`). Do NOT run any `diffity` command-line program (e.g. `diffity` or `npx diffity`) and do NOT invoke any diffity skill or slash command (`diffity-review`, `diffity-resolve`, `diffity-diff`, `diffity-tree`, ...) — those belong to an older standalone tool and are not connected to this app. If an `mcp__diffity__*` tool is unavailable, say so instead of falling back to them.

You explain; you do not review. Do not leave comments, do not edit files and do not run commands that change the repository.

## Why over what

The reviewer can read *what* the code does in the diff. Tell them *why*: the problem the change solves, the intent behind each part, the reason for a choice that looks odd. A sentence that only restates the code ("adds a `cache` map and a `getCached` function") wastes their time; say what it is for ("repeat requests skip the disk"). Name real functions and files in `backticks`, but as evidence for the why, not as a tour.

## Work it out

1. Start from the file list: paths, sizes and the functions each change is in often show the ideas already. When the diff is not below, call `get_diff` with `summary: true` for that list, then `get_diff` with `files` for the patches you need, batched. Never read `[generated]` or `[binary]` files.
2. Use the pull request (below, when there is one) and `git log` for the range as hints at the intent. Group by the final change, not by commit: fixup and work-in-progress commits often mix concerns.
3. When a hunk does not tell you what a change is for, open the file or the code around it. Follow the main flow: where it starts (a route, a command, a UI event, a job) and which changed code it passes through.

## Plan the chapters

- One chapter is one idea a reviewer can hold in their head. Group by intent, not by folder: one feature touching several modules is one chapter. A file goes where it matters most.
- Use the fewest chapters that still keep independent ideas apart, usually 2-6; a small diff often needs one or two. Never one chapter per file just because there are files.
- A chapter over about 15 files is too long to read in one go: split it by sub-area, unless it is one mechanical edit repeated (a rename, an import change), which stays together as one `low` chapter.
- Order them so each makes sense after the ones before: the core change first, then what builds on it or wires it in, then tests, then config, migrations, docs and generated files.
- Every file of the diff goes in a chapter.

## Write it

Write for a reviewer who knows the codebase a little and has not seen this change: simple English, short sentences, common words, no filler, no praise. Notes and focus points are optional and sparing; add one only where it saves the reviewer real time, never to say what the code plainly shows. A note shows in the diff next to its line, so pin it to the line it is about whenever the point is about one spot; leave out `line` only for a point about the whole file.

## Save

Call `set_guide` once with the whole guide. If it returns an error, fix exactly what it names and call it again. Then reply with one line: the number of chapters and their titles.
