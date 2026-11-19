# SDK agent guidance

- Read [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md).
- Before starting, search Linear for a matching issue and use its `gitBranchName`; if none matches or Linear is unavailable, say so and continue.
- Use pnpm and Node 24+. Run the README checks, including `pnpm format:check`.
- Keep `src/index.ts` as the public entry point. Put lifecycle in `client.ts`, wire types in `events.ts`, page sampling in `pages.ts`, session logic in `session.ts` and delivery in `delivery/`.
- Keep the core independent of frameworks, travel data and website UI. Add adapters only for real integration needs.
- Imports must be safe during server rendering. Access browser APIs during initialization and clean up timers/listeners.
- Keep event identity stable across retries. Bound queues and retries; delivery failure must leave the website usable.
- Collect only agreed properties. Never automatically collect form text, secrets or unrestricted page contents.
- Keep wire types and contract examples aligned with the backend. Public API changes require caller and compatibility checks.
- Keep tests in `tests/`, mirroring `src/`. Test behaviour and credible failure cases with controlled clocks/network responses; verify browser semantics in a browser.
- Use Ponytail; do not reload rules already injected. Load `ponytail-review` when needed without requiring user activation.
- Use independent review for consequential changes and resolve blocking findings.
- Keep documentation brief and accurate; update setup, examples and contracts when behaviour changes.
- Commit small logical changes with short imperative messages.
- Follow CONTRIBUTING.md before merging. Publishing packages and deployment require authorization.
