# Development instructions

The user requires every agent to make meaningful incremental commits throughout implementation.
Read `/Users/jeffreytseng/.codex/skills/commit-messages/SKILL.md` before committing.
Run `npm run lint`, `npm test`, and `npm run build` before committing a working increment.
Inspect the staged diff and commit only the intended change.
Use conventional `type(scope): imperative summary` subjects and a concise explanatory body for substantial changes.
Never add co-author or generated-by trailers.
Never stage `.context/`, screenshots, browser reports, scratch files, planning documents, `node_modules/`, or `dist/`.
Never modify generated files manually or edit CHANGELOG files.
Use plain hyphens instead of em dashes.
Put each full sentence on its own physical line when writing long Markdown documents.

Claude Code owns implementation, testing, and QA; Astra owns architecture and review.
Claude may delegate to as many Claude agents as needed, with explicit file ownership.
All agents must follow this commit policy.
When agents share this worktree, coordinate staging and serialize commits through the developer lead.
Commit only changes in the portfolio directory, preserving other worktree changes.
Do not rename the worktree branch.
The supervisor handles publication to the separate public portfolio repository after review.
