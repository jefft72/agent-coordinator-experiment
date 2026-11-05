# Jeffrey Tseng, portfolio

A static site built with React, TypeScript, and Vite.
The opening is one WebGL scene rendered with react-three-fiber: an abstract sculpture of thin metal plates twisted along a spine that rises to a lit crest and folds back into depth, lit by a graded dome and three authored light shapes.
Every fact, link, and project detail lives in semantic HTML and remains available without WebGL, without JavaScript animation, and on a keyboard.

## Local development

```sh
npm install
npm run dev          # Vite dev server
npm run build        # typecheck and production build into dist/
npm run preview      # serve dist/ on http://localhost:4173
```

The deployment base is read from `VITE_BASE` at build time, so the same source serves from `/` and from a project page:

```sh
VITE_BASE=/agent-coordinator-experiment/ npm run build
npm run build:subpath   # same thing into dist-subpath/
npm run preview:subpath # serve it on http://localhost:4174/agent-coordinator-experiment/
```

## Checks

```sh
npm run lint          # eslint and tsc
npm test              # vitest unit tests: content hygiene, blade field math
npm run test:browser  # builds both outputs, then Playwright in Google Chrome (channel "chrome")
npm run check         # lint, unit tests, then browser tests: the same sequence CI runs
npm run screenshots   # review captures into .context/screens/ (untracked)
```

Playwright runs isolated headless Chrome from the installed Google Chrome channel.
If Google Chrome is not installed, `npx playwright install --with-deps chrome` installs the stable channel system-wide.
WebGL tests are serialized on two workers because simultaneous contexts saturate the GPU.

## Deployment

`.github/workflows/pages.yml` runs on every pull request, on every push to `main`, and on manual dispatch.
Its `check` job installs dependencies with `npm ci`, runs `npm run lint` and `npm test`, installs Google Chrome for Playwright, runs `npm run test:browser`, and uploads `dist-subpath/` as the Pages artifact.
Pull requests stop there; they never deploy.
On a push to `main`, or a manual run, the `deploy` job waits for `check` to pass and then publishes that artifact to GitHub Pages through the `github-pages` environment, so the site serves under `/agent-coordinator-experiment/`.
Deployments are serialized: a queued deploy waits for the one in progress rather than cancelling it.
The repository needs one setting before the first deploy: under Settings, Pages, set the source to GitHub Actions.
Every action in the workflow is pinned to a release commit SHA with the version in a trailing comment, so bump the SHA and the comment together.

## Real controls

- The intro has a visible Skip intro control from its first frame.
- The intro only waits for the two critical fonts and the first drawable scene frame, with a bounded deadline of 2.5 seconds, after which the static composition is shown and WebGL finishes loading behind it.
- Returning visits in the same session, direct section links such as `/#hackathons`, and `prefers-reduced-motion` bypass the intro.
- Native document scrolling drives the fold from the opening into Work. There is no scroll hijacking and no pinned section.
- Pointer movement over the opening causes a local, travelling change in blade alignment that settles when the pointer leaves. Touch devices get the same reveal and scroll transition without the pointer response.
- Each project row ends in a blade rule: a line of edge-on plates drawn from the same modulation the sculpture uses. Hovering, focusing, or selecting the row turns the plates in that project's own pattern and they settle when the row is left. This works on touch, on the keyboard, without WebGL, and as a still pattern under reduced motion.
- Each project row has a Details control that opens a native dialog. Escape, the Close control, or the backdrop closes it, and focus returns to the control that opened it.
- Section links stop below the fixed header.

Query parameters used by the test suite: `?intro=skip`, `?intro=play`, `?webgl=off`, `?scene=stall`, `?scene=fail`, `?scene=chunk-fail`.

## Artwork

`src/scene/bladeField.ts` is pure math shared by the WebGL scene, the SVG fallback, and the unit tests: the spine, plate heights, the twist expressed relative to each plate's face-on pose, the loader's collapsed pose, the scroll fold, and the camera.
`src/scene/environment.ts` builds the reflection environment from a graded dome and three light shapes whose positions are exported from the field, so the fallback shades its faces from the same lights.
`src/scene/modulation.ts` holds the six per-project patterns used by both the sculpture and the inline blade rules.

## Fonts

Archivo by Omnibus-Type, served locally from `public/fonts/archivo/` under the SIL Open Font License 1.1.
The license text is in `public/fonts/archivo/OFL.txt`.
Source: https://github.com/Omnibus-Type/Archivo

## Content

`src/content/site.ts` is the single source of truth for every sentence on the site.
Unit tests reject phone numbers, graduation dates, em dashes, unverified links, and award wording that drifts from the verified track titles.
