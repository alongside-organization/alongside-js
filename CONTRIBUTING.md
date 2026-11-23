# Before merging

1. Review the complete diff, exported API, affected callers and backend contract. Remove unrelated changes.
2. Run `pnpm format`, then require `pnpm format:check` to pass. Run applicable [README checks](README.md#development) and failure cases. Record commands, results and anything untested; required configured CI gates must pass.
3. For changed delivery/session behaviour, check cleanup, bounded memory, retries, storage failure and browser/server compatibility. Check package contents and exports when packaging changes.
4. Check affected operational concerns: public keys, sensitive properties, configuration, compatibility and release rollback. Mark non-applicable concerns explicitly.
5. Update setup instructions, agent guidance, API examples, contract representations and fixtures where affected.
6. Use available independent review for consequential changes; apply Ponytail review guidance and resolve blocking findings.
7. Add a changeset (`pnpm changeset`) for any change users of the package should know about.
8. Commit small logical changes with short, imperative messages. Push, merge or publish only within the authorized scope.

# Releasing

Releases use [Changesets](https://github.com/changesets/changesets) and publish `@runalongside/js` to npm from GitHub Actions ([ci.yml](.github/workflows/ci.yml)).

1. With a change, run `pnpm changeset`: pick `patch` (fix), `minor` (new feature) or `major` (breaking change; while the version is 0.x, use `minor`) and write one line for users. Commit the generated `.changeset/*.md` file.
2. After checks pass on `main`, the workflow opens or updates a **Version Packages** pull request that bumps `package.json` and writes `CHANGELOG.md`.
3. Merging that pull request publishes to npm, tags `v<version>` and creates a GitHub release.

Publishing uses npm trusted publishing (OIDC): npm trusts `alongside-organization/alongside-js`, workflow `ci.yml`, GitHub environment `npm` (restricted to `main`), so no npm token is stored. New versions are approved on npmjs.com if the trusted publisher only allows staged publishing. The repository must allow GitHub Actions to create pull requests (Settings → Actions → General). Because the repository is public, CI releases carry an npm provenance attestation.
