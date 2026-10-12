# Working efficiently

- Keep follow-up actions direct and minimize unnecessary tool calls.
- Reuse completed checks; rerun them only when changes or unresolved concerns justify it.
- Report blockers immediately, with the concrete cause and next action.
- Use short waits for network operations so failures do not leave the user waiting without an update.
- When asked to push, commit the authorized changes and push directly to the intended branch; avoid unrelated investigation.
- This repository's only remote branch is `main` on `origin` (`https://github.com/Zectus/learning-tree.git`). Always push authorized changes to that branch, even when the local workspace branch has a different name (use `git push origin HEAD:main`). Do not create another remote branch or ask for destination confirmation when the user has requested a push. If remote changes prevent a normal push, reconcile them without force-pushing.
