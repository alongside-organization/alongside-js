# SDK agent guidance

Keep this document brief and actionable. Replace stale guidance and link to detail.

- Read [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md).
- This is an empty TypeScript scaffold with formatting tooling. Use pnpm; tests, type checking and builds are not configured.
- Keep `src/index.ts` as the public entry point. Put lifecycle in `client.ts`, wire types in `events.ts`, session logic in `session.ts` and delivery in `delivery/`.
- Keep the core independent of frameworks, travel data and website UI. Add adapters only for real integration needs.
- Imports must be safe during server rendering. Access browser APIs during initialization and clean up timers/listeners.
- Keep event identity stable across retries. Bound queues and retries; delivery failure must leave the website usable.
- Collect only agreed properties. Never automatically collect form text, secrets or unrestricted page contents.
- Keep wire types and contract examples aligned with the backend. Public API changes require caller and compatibility checks.
- Keep tests in `tests/`, mirroring `src/`. Test behaviour and credible failure cases with controlled clocks/network responses; verify browser semantics in a browser.
- Run `pnpm format` after edits and `pnpm format:check` before committing. Use the README's behaviour checks once implemented; empty tests do not establish behaviour.
- Use Ponytail; do not reload rules already injected. Load `ponytail-review` when needed without requiring user activation.
- Use available `sol-reviewer` sub-agents for consequential changes or requested independent review. Supply requirements, a stable diff and verification evidence; resolve blocking findings. If unavailable, review locally and report the limitation.
- Keep documentation brief and accurate; update setup, examples and contracts when behaviour changes.
- Commit in small logical blocks with short, imperative messages. Keep unrelated edits separate.
- Follow CONTRIBUTING.md before merging. Publishing packages and deployment require authorization.
