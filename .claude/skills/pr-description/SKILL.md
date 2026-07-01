---
name: pr-description
description: Generates a clean, structured pull request title and description from the current branch's diff and commit history, and opens the PR via gh CLI. Use once pre-pr-review is clean.
allowed-tools: Bash, Read, Grep, Glob
---

# PR Description: $ARGUMENTS

Generate a pull request title and body from the current branch's changes, then open it with the GitHub CLI. Base branch: `$ARGUMENTS` if given, otherwise detect the repo's default branch.

## Step 1: Gather context

- `git log <base>..HEAD --oneline` for the commit history on this branch
- `git diff <base>...HEAD --stat` for the file-level summary
- Full diff for anything non-obvious from commit messages alone

## Step 2: Confirm pre-PR review has run

If `pre-pr-review` hasn't been run in this session for the current diff, run it first and stop here if it surfaces unresolved critical/high issues — don't draft a PR description for code that hasn't been cleared.

## Step 3: Draft the PR

Title: short, imperative, matches the primary conventional-commit type of the branch (e.g. `feat(waypoint): add multi-agent weather card orchestration`).

Body structure:

```markdown
## Summary
<2-4 sentences: what changed and why, not a restated file list>

## Changes
- <bullet per logical change, grouped by concern, not by file>

## Testing
<how this was verified — manual steps taken, or note if none were run>

## Review notes
<anything a reviewer should pay special attention to, called out from the pre-pr-review report — e.g. "consistency-reviewer flagged X, addressed by Y">
```

Do not pad the summary with restated diff content. Do not claim testing was done if it wasn't — ask the user what testing (if any) they did, rather than assuming.

## Step 4: Open the PR

Ask the user to confirm the title and body, then run:

```
gh pr create --title "<title>" --body "<body>" --base <base-branch>
```

If `gh` isn't authenticated or installed, output the title/body as markdown instead and let the user paste it manually.
