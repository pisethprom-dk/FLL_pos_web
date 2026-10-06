<!-- v1.0.2 -->
# Put the frontend on GitHub (FLL_pos_web)

The remote `origin` → `https://github.com/pisethprom-dk/FLL_pos_web.git` is
added (owner's command). GitHub answers with no branches: the repository
exists and is empty. Locally there is one commit (the scaffold) and 178
uncommitted files — everything from step 3 to step 5b.

## Plan

- [x] Add the remote, as given
- [x] Leave `mock-up/` out: add `/mock-up/` to `.gitignore`. It is a
      byte-identical copy of the mockup already in `FLL_pos_api`, which is
      where `CLAUDE.md` points
- [x] Run the tests and the build, so what goes up is known to work
- [x] Commit 1 — "Regenerate the API client from the backend schema":
      `src/app/api/` only. It builds on its own (the scaffold does not use it)
- [x] Commit 2 — "Build the back office through step 5b": everything else
      (core, shared, features, styles, config, `CLAUDE.md`), with the steps
      listed in the message
- [ ] Push `main` and set it to track `origin/main` (`git push -u origin main`)
- [ ] Check GitHub's `main` is the commit just pushed (`git ls-remote origin`)
- [ ] Write the review below

Why two commits and not one per step: `app.routes.ts`, `screens.ts`, the
shell spec and the stylesheet each hold every step's changes together, so a
per-step split would mean staging hunk by hunk, and the commits in between
would not build.

Not in this task: the backend's uncommitted changes and its unpushed
`daily-numbering` branch — a separate task once this one is done.

## Review

(to be written when the work is done)
