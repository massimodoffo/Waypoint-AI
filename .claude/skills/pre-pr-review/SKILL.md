---
name: pre-pr-review
description: Runs bug-hunter, security-reviewer, and consistency-reviewer in parallel against the current diff, then cross-references their findings before a pull request is opened. Use before pushing any branch intended for a PR.
allowed-tools: Task, Bash, Read, Grep, Glob
---

# Pre-PR Review: $ARGUMENTS

Run a full three-angle review of the pending changes before this branch goes into a pull request. Target: `$ARGUMENTS` (a branch name, commit range, or "staged" — default to comparing the current branch against `main` if nothing is specified).

## Step 1: Establish the diff

Run `git diff main...HEAD` (or the appropriate base branch — check with `git remote show origin` or the default branch if `main` doesn't exist) to get the full set of changes under review. If the diff is empty, stop and tell the user there's nothing to review.

Also run `npm run lint` and `npm run test` if those scripts exist in `package.json`. Treat any lint errors or failing tests as must-fix, same tier as critical/high subagent findings.

## Step 2: Launch all three review subagents in parallel

Use the Task tool to launch these three subagents **in a single message, in parallel** — not sequentially:

1. `bug-hunter` — review the diff for correctness/logic issues
2. `security-reviewer` — review the diff for security issues
3. `consistency-reviewer` — review the diff for style/architecture issues

Give each subagent the same diff/file list as context so they're reviewing identical content.

## Step 3: Cross-reference findings

Once all three return, do NOT just concatenate their output. Actively cross-reference:

- **Overlapping findings**: if two or more agents flagged the same file/region for different reasons, merge those into one entry and mark it `[CONFIRMED — multiple reviewers]` — these are the highest-confidence issues.
- **Contradictions**: if one agent's suggested fix would reintroduce a problem another agent flagged (e.g. consistency-reviewer suggests reusing a function that security-reviewer flagged as unsafe), surface this explicitly rather than presenting both fixes as independently safe.
- **Coverage gaps**: scan the file list against all three reports — if a changed file got zero mentions from any reviewer, do a quick pass yourself to confirm it's actually clean rather than assuming silence means safety.

## Step 4: Produce the final report

Output a single consolidated report in this structure:

```
## Pre-PR Review Summary
Files reviewed: <count>
Critical/High issues: <count>
Confirmed by multiple reviewers: <count>

## Must-fix before PR
<critical and high severity issues, confirmed ones first, each with file:line, issue, fix>

## Worth fixing
<medium severity issues>

## Optional / nice-to-have
<low severity issues>

## Reviewer disagreement
<any contradictions found in step 3, or "None">
```

## Step 5: Ask before proceeding

After presenting the report, ask the user whether to:
- fix the must-fix issues now, then re-run this review, or
- proceed to open the PR as-is (only if there are no critical/high issues)

Do not open the PR yourself in this step — that's handled by `/pr-description` once the code is clean.
