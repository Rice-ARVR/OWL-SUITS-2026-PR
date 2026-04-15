Here's the updated guide:

---

# Contributing Guide

## Table of Contents

1. [Project Board](#project-board)
2. [Issues](#issues)
3. [Branches](#branches)
4. [Commits](#commits)
5. [Pull Requests](#pull-requests)
6. [Code Review](#code-review)
7. [Merging](#merging)

---

## Project Board

All work is tracked in our **GitHub Project board**. Before writing any code, find your task on the board.

- Move your card **Todo → In Progress** when you start
- Move it to **In Review** when you open a PR
- It moves to **Done** automatically when the PR is merged

---

## Issues

Always open an issue before starting any work. Use the appropriate issue template and follow the type labels below:

| Type       | When to use                              |
| ---------- | ---------------------------------------- |
| `feat`     | New feature or enhancement               |
| `fix`      | Bug or broken behavior                   |
| `refactor` | Code restructure with no behavior change |
| `chore`    | Maintenance, dependencies, config        |
| `docs`     | Documentation only                       |
| `test`     | Adding or updating tests                 |

Issue titles are pre-filled with the type prefix — complete the description after it:

```
feat: add user authentication
fix: resolve login redirect bug
```

---

## Branches

**Format:** `type/issuenum-description-netid`

```
feat/67-user-authentication-ch185
fix/67-login-redirect-ch185
refactor/67-api-cleanup-ch185
```

Always branch off of an up-to-date `main`. Never work directly on `main`.

```bash
git checkout main
git pull
git checkout -b feat/67-user-authentication-ch185
```

### Updating Your Branch from Main

```bash
git checkout your-branch-name
git fetch origin
git rebase origin/main
# resolve any conflicts in VS Code if they occur
git rebase --continue  # skip if no conflicts
git push origin your-branch-name --force
```

---

## Commits

Use the same type prefix as your issue and branch. Keep descriptions short and in present tense.

**Format:** `type: short description`

```
feat: add user authentication endpoint
fix: handle null response from API client
docs: update contributing guide
chore: update dependencies
```

Since we squash merge, individual commit messages won't appear on `main` — only the PR title will. Keep commits clean enough to follow during review, but don't stress about perfection.

---

## Pull Requests

**Format:** `type: short description`

```
feat: add user authentication
fix: resolve login redirect bug
```

### Opening a PR

1. Push your branch: `git push -u origin your-branch-name`
2. Rebase off of latest `main` before opening _(see Updating Your Branch from Main)_
3. Open a PR against `main` on GitHub
4. Fill out the PR template fully
5. Link the issue using `Closes #<issue-number>` — this auto-closes the issue on merge
6. Move your card to **In Review** on the project board
7. Request review from an admin

---

## Code Review

- **Address every comment** before requesting a re-review
- **Don't resolve threads yourself** — let the reviewer resolve them once satisfied
- **Request changes** will be left if fixes are needed — push new commits to the same branch and the PR updates automatically

---

## Merging

- **main → branch:** rebase _(see Updating Your Branch from Main)_
- **branch → main:** squash & merge, via PR only
- An admin must review and approve before merging
- Direct pushes to `main` are not allowed

Since we squash merge, your PR title becomes the single commit on `main` — make sure it's clean and follows the naming convention.

---
