# Code Review Output Rules (GitHub UX)

When proposing code changes, ALWAYS use GitHub Suggested Changes so the PR author can apply them with GitHub's "Commit suggestion" / "Add suggestion to batch" buttons.

Rules:
- Put every concrete code change inside a GitHub suggestion block: ```suggestion
- Prefer inline PR review comments attached to the exact lines being changed.
- One suggestion block per independent change.
- If a change spans multiple non-adjacent areas, split into multiple suggestion blocks.
- Do not include “example code” outside suggestion blocks.
- Keep suggestion blocks minimal: only the exact replacement text.
