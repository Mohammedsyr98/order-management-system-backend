# Repository Instructions

This is an Express + TypeScript backend for an order management system.

## Development Style

- Prefer small, focused changes that match the existing codebase style.
- Prefer TDD for feature work and bug fixes when practical.
- Use Vitest and Supertest for API behavior tests.
- Test public behavior through routes or public service interfaces.
- Avoid tests that depend on private implementation details.
- Keep Express route handlers thin.
- Put business rules in services or modules with small public interfaces.
- Do not add broad abstractions unless they clearly simplify the current work.

## Skill Workflow

- Use `grill-me` when a feature or design needs clarification before implementation.
- Use `to-prd` when an agreed feature should become a product/spec issue.
- Use `to-issues` when a PRD or plan should be split into vertical implementation slices.
- Use `triage` when classifying, refining, or preparing issues for work.
- Use `tdd` when implementing issues or fixes test-first.

## GitHub Safety Rules

- Never push to GitHub unless the user explicitly says to push.
- Never create, edit, close, label, or comment on GitHub issues without explicit user approval.
- Never create, update, merge, or close pull requests without explicit user approval.
- Local commits are allowed only after showing a summary of changes and receiving approval.
- Before any remote write action, summarize exactly what will be sent to GitHub.
- Approval must be specific to the action being taken.

## Git Hygiene

- Do not revert user changes unless the user explicitly requests it.
- Before committing, show the changed files and summarize the behavior changed.
- Prefer feature branches for non-trivial work.
- Run relevant tests or explain why they were not run.
