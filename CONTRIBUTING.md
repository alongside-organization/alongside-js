# Before merging

1. Review the complete diff, exported API, affected callers and backend contract. Remove unrelated changes.
2. Run `pnpm format`, then require `pnpm format:check` to pass. Run applicable [README checks](README.md#layout-and-verification) and failure cases. Record commands, results and anything untested; required configured CI gates must pass.
3. For changed delivery/session behaviour, check cleanup, bounded memory, retries, storage failure and browser/server compatibility. Check package contents and exports when packaging changes.
4. Check affected operational concerns: public keys, sensitive properties, configuration, compatibility and release rollback. Mark non-applicable concerns explicitly.
5. Update setup instructions, agent guidance, API examples, contract representations and fixtures where affected.
6. Use available independent review for consequential changes; apply Ponytail review guidance and resolve blocking findings.
7. Commit small logical changes with short, imperative messages. Push, merge or publish only within the authorized scope.
