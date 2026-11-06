# Jeffrey Tseng, portfolio

A static site built with React, TypeScript, and Vite.
The page is one native document of five chapters: the opening with Jeffrey Tseng, then Hackathons, Experience, Ventures, and About with Contact.
The opening is one WebGL scene rendered with react-three-fiber: an abstract sculpture of thin metal plates twisted along a spine that rises to a lit crest and folds back into depth, lit by a graded dome and three authored light shapes.
On desktop the opening pins with CSS sticky while the Hackathons chapter rises over it; the identity plane recedes ahead of the rising surface, the sculpture folds away in between, and the scene stops rendering once covered.
Below the opening, native scrolling drives one choreography: project titles and media arrive into their reading positions, each later chapter takes over with its title and first story on separate planes, and the OpenCraft media holds while the light Experience surface advances over it.
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
npm test              # vitest unit tests: content model and hygiene, blade field math
npm run test:browser  # builds both outputs, then Playwright in Google Chrome (channel "chrome")
npm run check         # lint, unit tests, then browser tests: the same sequence CI runs
npm run screenshots   # review captures into .context/screens/ (untracked)
```

Playwright runs isolated headless Chrome from the installed Google Chrome channel.
If Google Chrome is not installed, `npx playwright install --with-deps chrome` installs the stable channel system-wide.
WebGL tests are serialized on two workers because simultaneous contexts saturate the GPU.

## Dependency overrides

`package.json` overrides `minimatch` to a patched 11.x release under `@typescript-eslint/typescript-estree` only.
The parser declares `minimatch ^10.2.2`, which https://github.com/advisories/GHSA-g3hv-75wg-m249 affects, so a fresh `npm ci` reports seven moderate development-only findings while `npm audit --omit=dev` reports none.
The parser's only use is the named `minimatch(filePath, pattern, { dot: true })` call behind `allowDefaultProject`, which 11.x keeps, and ESLint's separate `minimatch` 3.x is not touched.
Remove the override once `@typescript-eslint/typescript-estree` declares `minimatch` 11.0.1 or newer, then run `npm install` and `npm audit` to confirm the tree stays clean.

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
- Native document scrolling drives everything: the opening handoff, the arrivals, and the chapter takeovers are functions of the scroll position, so they play forward on the way down and in reverse on the way back up. There is no scroll hijacking, no scroll snapping, and no dead scroll interval; the only pinned elements are the opening during its short handoff and the OpenCraft media during the Hackathons-to-Experience cover on desktop.
- `src/lib/reveal.ts` writes `--reveal` on every `[data-reveal]` element as its top edge travels into the reading zone, and `--takeover` on every `[data-takeover]` chapter (with `--covered` on the chapter beneath) as its surface rises. The stylesheets read those variables with the settled value as fallback, so content is in place before the tracker runs, and only media planes recede: prose, awards, controls, and links stay fully opaque while they can be read.
- Pointer movement over the opening causes a local, travelling change in blade alignment that settles when the pointer leaves. Touch devices get the same reveal and scroll transition without the pointer response.
- Each hackathon spread has three labelled contribution controls, a tablist with arrow-key, Home, and End support, that reveal one part of the work in a reserved area and highlight the matching steps of a named flow or schematic. The award, ownership sentence, figures, and proof links stay outside the controls.
- The UPlate gallery shows one real screenshot at a time with previous and next controls that wrap, a counter, and the caption of the current screenshot; all three images stay in the document.
- The header takes the colour of the chapter under it and marks the current chapter with aria-current; the five destinations are real anchors that land on the chapter heading, cold or warm, under both deployment bases.
- Reduced motion keeps every chapter and control, unpins the opening, removes every arrival, takeover, and hold, and switches states immediately; the tracker follows a live change of the preference in both directions without a reload.
- Section links stop below the fixed header.

Query parameters used by the test suite: `?intro=skip`, `?intro=play`, `?webgl=off`, `?scene=stall`, `?scene=fail`, `?scene=chunk-fail`.

## Artwork

`src/scene/bladeField.ts` is pure math shared by the WebGL scene, the SVG fallback, and the unit tests: the spine, plate heights, the twist expressed relative to each plate's face-on pose, the loader's collapsed pose, the scroll fold, and the camera.
`src/scene/environment.ts` builds the reflection environment from a graded dome and three light shapes whose positions are exported from the field, so the fallback shades its faces from the same lights.

## Fonts

Archivo by Omnibus-Type, served locally from `public/fonts/archivo/` under the SIL Open Font License 1.1.
The license text is in `public/fonts/archivo/OFL.txt`.
Source: https://github.com/Omnibus-Type/Archivo

## Content

`src/content/site.ts` is the single source of truth for every sentence on the site.
Unit tests reject phone numbers, graduation dates, em dashes, unverified links, and award wording that drifts from the verified track titles.
