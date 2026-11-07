# Jeffrey Tseng, portfolio

A static site built with React, TypeScript, and Vite.
The page is one native document of five chapters: the opening with Jeffrey Tseng, then Hackathons, Experience, Ventures, and About with Contact.
The opening fills the first viewport: the name and three identity lines, and one WebGL scene rendered with react-three-fiber.
The scene is a JT buckle in polished silver: a heavy italic J and T fused into an elongated oval rim as one continuous piece of metal, with thorns growing from the letters and the rim, drawn as one compound outline, extruded with a small bevel, and domed on its front face, lit by one painted sky with a soft studio disc, a dim glow, and a narrow cool strip.
On desktop the opening pins with CSS sticky while the Hackathons chapter rises over it; the identity plane recedes ahead of the rising surface, the letters turn modestly and travel up and right in between, and the scene stops rendering once covered.
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
npm test              # vitest unit tests: content model and hygiene, buckle outline, solid, framing, and poses
npm run test:browser  # builds both outputs, then Playwright in Google Chrome (channel "chrome")
npm run check         # lint, unit tests, then browser tests: the same sequence CI runs
npm run screenshots   # review captures into .context/screens/ (untracked)
```

Playwright runs isolated headless Chrome from the installed Google Chrome channel.
If Google Chrome is not installed, `npx playwright install --with-deps chrome` installs the stable channel system-wide.
WebGL tests are serialized on two workers because simultaneous contexts saturate the GPU.

## Dependency overrides

`package.json` overrides `minimatch` to a patched 11.x release under `@typescript-eslint/typescript-estree` only.
The parser declares `minimatch ^10.2.2`, which https://github.com/advisories/GHSA-g3hv-75wg-m249 affects; without the override that release would be installed as a development-only dependency, and with it in place `npm audit` reports no findings.
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
- Native document scrolling drives everything: the opening handoff, the arrivals, and the chapter takeovers are functions of the scroll position, so they play forward on the way down and in reverse on the way back up.
  There is no scroll hijacking, no scroll snapping, and no dead scroll interval; the only pinned elements are the opening during its short handoff and the OpenCraft media during the Hackathons-to-Experience cover on desktop.
- `src/lib/reveal.ts` writes `--reveal` on every `[data-reveal]` element as its top edge travels into the reading zone, and `--takeover` on every `[data-takeover]` chapter (with `--covered` on the chapter beneath) as its surface rises.
  The stylesheets read those variables with the settled value as fallback, so content is in place before the tracker runs, and only media planes recede: prose, awards, controls, and links stay fully opaque while they can be read.
- Pointer movement over the opening turns the buckle by a few degrees, which sweeps the reflections across the letters and rim, and settles when the pointer leaves; the object never follows the cursor across the page.
  Touch devices get the same reveal and scroll transition without the pointer response.
- The scene renders on demand: one frame per scroll, pointer, or preference change, plus frames while a value is still easing, and none once everything has settled, the opening is covered, or the document is hidden.
  There is no idle animation loop.
- Each hackathon spread has three labelled contribution controls, a tablist with arrow-key, Home, and End support, that reveal one part of the work in a reserved area and highlight the matching steps of a named flow or schematic.
  The award, ownership sentence, figures, and proof links stay outside the controls.
- The UPlate gallery shows one real screenshot at a time with previous and next controls that wrap, a counter, and the caption of the current screenshot; all three images stay in the document.
- The header takes the colour of the chapter under it and marks the current chapter with aria-current; the five destinations are real anchors that land on the chapter heading, cold or warm, under both deployment bases.
  Its field and type switch together the moment the zone changes, with no colour transition, so the links never pass through an unreadable intermediate palette; only their dimming and underline ease.
- Reduced motion keeps every chapter and control, unpins the opening, shows the complete buckle at rest, removes every arrival, takeover, and hold, and switches states immediately; the tracker follows a live change of the preference in both directions without a reload.
- The opening is at least one full viewport, measured as `100lvh` with a floor for short screens, so no part of the Hackathons chapter shows at rest; when phone browser chrome collapses, the newly visible band is the opening's own margin.
- Section links stop below the fixed header.

Query parameters used by the test suite: `?intro=skip`, `?intro=play`, `?webgl=off`, `?scene=stall`, `?scene=fail`, `?scene=chunk-fail`.

## Artwork

`src/scene/monogram.ts` is pure math shared by the WebGL scene, the SVG poster, and the unit tests: the emblem as one compound outline (the outer oval with its two thorns, and a single negative-space contour that follows the rim's inner edge and detours around the letters where they grow out of it), the forward slant, the four letter thorns and their rooting fillets, the coves where the letters join the rim (circular fillets solved to meet the sampled ellipse exactly), the rest pose per layout, the scroll turn and travel, the loader's entrance pose, the pointer tilt, and the camera projection.
The drawn outline is the flat cap and the silhouette is the cap grown by the bevel, so every thorn ends in a tiny finite arc that keeps the bevel well-formed, and the unit tests check that both contours are simple, that the negative space lies inside the oval, that every concave corner clears the bevel, where the letters attach, and that the J and T still read by sampling the metal along probe lines.
`src/scene/monogramMesh.ts` builds the solid with three's standard beveled ExtrudeGeometry of that compound shape, then replaces the front cap with a shallow dome: a Delaunay triangulation (Delaunator, with robust orientation predicates) of the outline resampled to short segments plus a regular interior grid kept clear of the outline, with the triangles outside the cap removed, lifted by a Poisson field solved on a grid to a measured tolerance, shaped by a smoothstep so it leaves every edge with zero slope, and sampled bicubically so heights and normals are smooth across grid cells; normals come from that field's gradient, and the outline vertices stay on the flat plane so the bevel meets them without a crack, while the back cap stays flat and the walls and bevel take the profile's analytic normals.
A Delaunay triangulation is not guaranteed to contain every outline segment, so the unit tests verify the actual cap: every resampled boundary segment is a single-incidence edge or a collinear chain of them, every interior edge has two opposite incidences, no edge crosses the outline, the covered area equals the sampled polygon's, and the cap is one connected piece.
The build runs once at scene creation and records its sizes, convergence, and time, which the unit tests bound.
`src/scene/Letters.tsx` poses the one mesh every frame from the shared motion state and requests frames only while something is still moving.
`src/scene/MonogramSvg.tsx` draws the same compound path through the same camera as a dark back silhouette, a bevel band painted as a round-joined stroke, and the flat cap on top, with the rim's opening left transparent, which is the WebGL-off, failure, and loading picture.
`src/scene/environment.ts` paints the reflection environment per fragment on one sphere, so the caps and bevels reflect broad gradients with no visible light cards: the caps mirror a dim glow behind the camera and sit just outside one soft studio disc, which the domed bodies roll into, and a single narrow cool strip lands as a crisp line on the edges that face left.

## Fonts

Archivo by Omnibus-Type, served locally from `public/fonts/archivo/` under the SIL Open Font License 1.1.
The license text is in `public/fonts/archivo/OFL.txt`.
Source: https://github.com/Omnibus-Type/Archivo

## Content

`src/content/site.ts` is the single source of truth for every sentence on the site.
Unit tests reject phone numbers, graduation dates, em dashes, unverified links, and award wording that drifts from the verified track titles.
