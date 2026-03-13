# GitHub Guide

## GitHub Projects

All work is tracked in our **GitHub Project board**. Before writing any code, find your task on the board. Each card corresponds to a GitHub Issue — the issue number is what you'll use to name your branch.

Check the board to:
- See what's assigned to you
- Move your card from **Todo → In Progress** when you start
- Move it to **In Review** when you open a PR
- It moves to **Done** automatically when the PR is merged

---

## Branches

### Checking Out a Branch

Every branch must be tied to a GitHub Issue. The branch name format is:

```
{issue-number}-{short-kebab-case-description}
```

Examples from this repo:

```
10-update-and-organize-all-documentation-guides-readmes
6-set-up-mongo-database
9-pr-control-functionality
```

To create and switch to your branch:

```bash
git checkout main
git pull
git checkout -b 12-add-navigation-router
```

Always branch off of an up-to-date `main`. Never work directly on `main`.

---

## Commits

We follow the **Conventional Commits** standard. Every commit message must start with a type prefix:

```
<type>: <short description>
```

Common types:

| Type | When to use |
|------|-------------|
| `feat` | Adding a new feature |
| `fix` | Fixing a bug |
| `chore` | Maintenance, dependencies, config changes |
| `docs` | Documentation only changes |
| `refactor` | Code change that isn't a fix or feature |
| `style` | Formatting, missing semicolons, etc. |

Examples:

```bash
git commit -m "feat: add rover location endpoint"
git commit -m "fix: handle None return from TSS client"
git commit -m "docs: update backend architecture guide"
git commit -m "chore: add pymongo to dependencies"
```

Keep the description short and in the present tense. Don't capitalize the first word after the colon.

---

## Pull Requests

### Naming

PR titles follow the same Conventional Commits format as commit messages:

```
<type>: <short description>
```

Examples:
```
feat: add navigation router and service
fix: correct EVA telemetry field names
chore: set up MongoDB connection
```

### Opening a PR

1. Push your branch: `git push -u origin your-branch-name`
2. Open a PR against `main` on GitHub
3. Link the issue in the PR body using `Closes #<issue-number>` — this auto-closes the issue when merged
4. Move your card to **In Review** on the project board
5. Request a review from a lead

### PR Body

At minimum include:
- What the PR does
- `Closes #<issue-number>`

---

## Code Review

When your PR is up for review, one of the leads will either:

- **Leave comments** — address every comment before requesting a re-review. Don't resolve threads yourself; let the reviewer resolve them once they're satisfied.
- **Request changes** — fix the issues and push new commits to the same branch. The PR updates automatically.

When you are reviewing someone else's PR:
- Leave clear, specific comments explaining what to change and why
- Approve only when you're satisfied with the code

### Merging

We use **squash and merge**. This means all commits on your branch get combined into a single commit on `main`, keeping the history clean. Because of this:

- Don't worry about having messy or WIP commits on your branch while working
- Make sure your **PR title** is clean — it becomes the final commit message on `main`
