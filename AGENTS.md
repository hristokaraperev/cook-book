## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The repo uses the default five-label triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo with root `CONTEXT.md` and root `docs/adr/`. See `docs/agents/domain.md`.

### General workflow

- When creating new issues, *ALWAYS* use the templates in the `.github` folder.
- When starting to work on a new issue *ALWAYS* create a new branch: <fix|feature|or something else>/<short description of the issue> on a new git worktree. *ALWAYS* create worktree folder in `/tmp`. *ALWAYS* clean up branch and worktree after creating pull request.
- Commit at small, incremental steps, when enough work has been completed to be considered a separate unit of work. Use the commit template from `.gitmessage`. Keep it brief. *NEVER* add co-authored messages or extended commit descriptions. Be straight-to-the-point when writing commit meesages.
- When user has been satisfied that there are no more work to be done, open a pull request. Each pull request *MUST* follow the repository's template provide description of how to test the changes manually.
