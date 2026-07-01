---
name: commit-hygiene
description: Cleans up staged changes into well-formed conventional commits before pushing. Use before committing a batch of work.
allowed-tools: Bash, Read, Grep, Glob
---

# Commit Hygiene

Review the currently staged (or unstaged, if nothing is staged) changes and prepare them as clean, well-scoped commits.

## Step 1: Inventory the changes

Run `git status` and `git diff` (or `git diff --staged` if things are already staged) to see everything in flight.

## Step 2: Check for hygiene issues before committing anything

Flag and fix, don't just report:

- Debug artifacts: stray `console.log`, `debugger`, commented-out code blocks, TODO markers without context.
- Unintended files: build output, `.env` files, `node_modules`, editor config, OS files (`.DS_Store`) — these should be in `.gitignore`, not staged. If `.gitignore` is missing entries for these, update it.
- Whitespace-only or formatting-only diffs mixed into functional changes — these should be their own commit if they touch unrelated lines.
- Overly large, unrelated changes bundled together — if the diff spans clearly unrelated concerns (e.g. a bug fix + a new feature), split into separate commits.

## Step 3: Group into logical commits

If multiple concerns are mixed in the working tree, use `git add -p` (or stage specific files) to split them into separate, atomic commits rather than one large commit.

## Step 4: Write commit messages

Use Conventional Commits format:

```
<type>(<scope>): <short summary, imperative mood, no period>

<optional body: why, not what — the diff already shows what>
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`, `perf`. Scope should match the module/directory touched (e.g. `feat(map): add OSRM route caching`).

Keep the summary line under 72 characters. Only add a body if the "why" isn't obvious from the diff alone — don't pad commits with restated diffs.

## Step 5: Confirm before pushing

Show the final commit(s) with `git log --oneline -n <count>` and ask the user to confirm before running `git push`. Never force-push without explicit confirmation.
