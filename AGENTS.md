# SDK agent guidance

Keep this document brief and actionable. Replace stale guidance and link to detail.

- Read [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md).
- Before starting work, search Linear for a relevant issue. If one matches, use its `gitBranchName` for the work branch so Linear can track it; preserve existing work when switching branches. If none matches or Linear is unavailable, say so and continue.
- Use pnpm and Node 24+. Run the README's tests, type checking, build and formatting checks.
- Keep `src/index.ts` as the public entry point. Put lifecycle in `client.ts`, wire types in `events.ts`, page sampling in `pages.ts`, session logic in `session.ts` and delivery in `delivery/`.
- Keep the core independent of frameworks, travel data and website UI. Add adapters only for real integration needs.
- Imports must be safe during server rendering. Access browser APIs during initialization and clean up timers/listeners.
- Keep event identity stable across retries. Bound queues and retries; delivery failure must leave the website usable.
- Collect only agreed properties. Never automatically collect form text, secrets or unrestricted page contents.
- Keep wire types and contract examples aligned with the backend. Public API changes require caller and compatibility checks.
- Keep tests in `tests/`, mirroring `src/`. Test behaviour and credible failure cases with controlled clocks/network responses; verify browser semantics in a browser.
- Run `pnpm format` after edits and `pnpm format:check` before committing. Use the README's behaviour checks once implemented; empty tests do not establish behaviour.
- Use Ponytail; do not reload rules already injected. Load `ponytail-review` when needed without requiring user activation.
- Use an available independent review sub-agent for consequential changes or requested independent review. Supply requirements, a stable diff and verification evidence; resolve blocking findings. If unavailable, review locally and report the limitation.
- Keep documentation brief and accurate; update setup, examples and contracts when behaviour changes.
- Commit completed, verified work as you go in small logical commits with short, imperative messages. Keep unrelated edits separate; do not leave all commits until the end.
- Add short comments where lifecycle, session or delivery decisions are hard to follow. Explain their purpose or reason without narrating obvious code.
- Follow CONTRIBUTING.md before merging. Publishing packages and deployment require authorization.
