# Kid Emotions Lottie

A cartoon kid (girl or boy) who shows 20 emotions, built as a **code-driven face rig** that exports **Lottie JSON**. The face does the acting: eyelids, brows, pupils, mouth shape, teeth, tongue and skin tint are all animated. The body follows the head.

`happy` `sad` `angry` `scared` `surprised` `disgusted` `calm` `excited` `tired` `proud` `embarrassed` `confused` `jealous` `grateful` `lonely` `hopeful` `nervous` `bored` `curious` `loving`

Nothing needs installing beyond Node.js. The rig is one plain JavaScript file. The same file drives:

- the **Lottie builder** (`tools/build-lottie.mjs`), which writes the `.json` files in `dist/`
- the **browser preview** (`preview/`), which shows the live rig next to the exported Lottie
- the **design canvas** (`design/canvas/`), the Claude Design artboards this project started from

---

## Quick start

Requirements: **Node.js 18 or newer**. There is no `npm install` step; the repo has no dependencies.

```bash
npm run build
```

This writes every Lottie file into `dist/`, for both kids.

```bash
npm run validate
```

This checks every file in `dist/`: markers, keyframe order, and matching vertex counts.

```bash
npm run preview
```

This starts a local server. Open **http://localhost:5173/preview/** to compare the rig and the Lottie side by side.

`dist/` is committed, so the JSON files can be used before anything is built.

---

## What is in `dist/`

| File | What it is | Size |
|---|---|---|
| `kid-emotions-girl.json`, `kid-emotions-boy.json` | All 20 emotions in one timeline, one **marker** per emotion | ~2.7 MB each |
| `emotions/<kid>/<emotion>.json` | One small looping file per emotion (40 files) | ~30–100 KB each |
| `markers.json` | Table of segment names, start and end frames, and durations | tiny |
| `contact-sheet-<kid>.svg` | Every emotion at its "poster" frame (`npm run sheet`) | — |

**Which one should I use?** Use the per-emotion files when an app shows one feeling at a time: they are small and just loop. Use the combined file when you want a single asset and will switch between feelings by marker.

Every file is 400 × 400 px at 30 fps and uses shape layers only (no images, text, effects or expressions). That means it plays in lottie-web, lottie-ios, lottie-android, lottie-react-native and dotLottie players.

### Markers (combined files)

Segments sit end to end with a 1-frame gap. Each loop's last frame equals its first, so playing `[start, end]` on repeat is seamless.

| Marker | Frames | Loop | Marker | Frames | Loop |
|---|---|---|---|---|---|
| happy | 0–60 | 2.0 s | proud | 653–743 | 3.0 s |
| sad | 61–151 | 3.0 s | embarrassed | 744–834 | 3.0 s |
| angry | 152–212 | 2.0 s | confused | 835–925 | 3.0 s |
| scared | 213–261 | 1.6 s | jealous | 926–1016 | 3.0 s |
| surprised | 262–338 | 2.5 s | grateful | 1017–1107 | 3.0 s |
| disgusted | 339–399 | 2.0 s | lonely | 1108–1228 | 4.0 s |
| calm | 400–490 | 3.0 s | hopeful | 1229–1319 | 3.0 s |
| excited | 491–531 | 1.3 s | nervous | 1320–1380 | 2.0 s |
| tired | 532–652 | 4.0 s | bored | 1381–1501 | 4.0 s |
| | | | curious | 1502–1592 | 3.0 s |
| | | | loving | 1593–1683 | 3.0 s |

The authoritative table is `dist/markers.json`, regenerated on every build.

---

## Using the Lottie files in an app

### Web (lottie-web)

See `examples/web/index.html` for a runnable version. Serve the repo with `npm run preview` and open `/examples/web/`.

```js
const player = lottie.loadAnimation({
  container: document.getElementById('kid'),
  renderer: 'svg', loop: true, autoplay: false,
  path: 'kid-emotions-girl.json',
});
player.addEventListener('DOMLoaded', () => {
  const m = player.animationData.markers.find((x) => x.cm === 'happy');
  player.playSegments([m.tm, m.tm + m.dr], true);
});
```

### React (lottie-react)

```jsx
import Lottie from 'lottie-react';
import happy from './emotions/girl/happy.json';

<Lottie animationData={happy} loop />;
```

### iOS (lottie-ios)

```swift
// Simplest: one file per emotion (dist/emotions/girl/happy.json added to the bundle)
let view = LottieAnimationView(name: "happy")
view.loopMode = .loop
view.play()

// Combined file: loop from one marker to the start of the next one in the table
let all = LottieAnimationView(name: "kid-emotions-girl")
all.play(fromMarker: "happy", toMarker: "sad", loopMode: .loop)
```

### Android (lottie-android)

```kotlin
animationView.setAnimation(R.raw.kid_emotions_girl)
animationView.setMinAndMaxFrame("happy")   // plays the "happy" marker's range
animationView.repeatCount = LottieDrawable.INFINITE
animationView.playAnimation()
```

**Switching emotions:** inside a Lottie player, jumping to another marker is a hard cut. The live rig and preview blend over 9 frames, but that blend is not baked into the files. For a softer switch, either wait until the current loop ends before changing marker, or crossfade two players.

---

## Build options

```bash
node tools/build-lottie.mjs [options]
```

| Option | Default | Meaning |
|---|---|---|
| `--kid girl\|boy\|both` | `both` | Which character variant to build |
| `--emotions a,b,c` | all | Subset **and order** of segments in the combined file |
| `--step N` | `1` | Sample every N frames. `2` gives smaller files with slightly less smooth motion |
| `--tolerance T` | `0.25` | Max drift in px when dropping keyframes that linear interpolation already covers. Raise it for smaller files |
| `--skin`, `--hair`, `--iris`, `--shirt` `"#hex"` | built-in palette | Bake a different colour scheme |
| `--out DIR` | `dist` | Output folder |
| `--no-split` | off | Skip the one-file-per-emotion output |
| `--pretty` | off | Indented JSON, easier to diff |

Examples:

```bash
node tools/build-lottie.mjs --kid boy --emotions happy,sad,angry --out dist/custom
```

```bash
node tools/build-lottie.mjs --skin "#8D5A3B" --hair "#2E1F18" --out dist/custom
```

`npm run build:fast` does a quick build (`--step 2 --no-split`) while you iterate.

---

## Repository layout

```
src/rig/rig.js            THE source of truth: emotions, pose channels, face geometry, SVG output
src/lottie/build.js       Bakes rig frames into Lottie JSON (keyframes, markers, simplification)
tools/build-lottie.mjs    CLI for the builder (writes dist/)
tools/validate.mjs        Structural checks for the JSON files
tools/contact-sheet.mjs   Renders every emotion into one SVG per kid
tools/serve.mjs           Zero-dependency static server for the preview
tools/sync-canvas.mjs     Copies the rig into the design canvas files (and back)
tools/lib/rig.mjs         Loads rig.js into Node; small CLI helpers
preview/index.html        Rig vs. Lottie comparison page (open any .json with "Open .json")
examples/web/index.html   Minimal embed using markers
design/canvas/project/    Claude Design artboards (.dc.html) and canvas.json
dist/                     Built output (committed)
```

---

## How the rig works

```
emotion + frame ──► pose()  ──► ~55 numeric channels   (mouth width, lid height, brow tilt, gaze…)
                                   │
                                   ▼
                    scene() ──► named groups + bezier paths (head, eyeL, mouth, fxTear…)
                                   │
                 ┌─────────────────┼──────────────────┐
                 ▼                 ▼                  ▼
            toSVG()           flatten()          build.js
        (preview, sheet)   (design canvas)   (Lottie keyframes)
```

1. **`pose(id, frame)`** starts from `BASE` (the rest pose) and applies the emotion's `fn(frame)`, which returns only the channels it changes. Blinks are added from the emotion's `blink` list.
2. **`scene(pose, {kid, skin, hair…})`** turns channels into a fixed tree of groups (with position, anchor, scale, rotation and opacity) and paths. The tree has **the same structure for every emotion and frame**, which is what lets the builder turn it into keyframes. Unused effects just sit at opacity 0, and the builder drops groups that are never visible.
3. **The Lottie builder** samples every frame of every segment. It records each group transform, path and fill colour, drops keyframes that a straight line between neighbours already reproduces (`--tolerance`), and writes one shape layer for the head and one for the body.

Why these choices:

- **Lids and mouths are bezier paths with a fixed vertex count.** Lottie can only morph between paths that have the same number of vertices. Lids are always 5 vertices and every mouth pose is 2. Masks are avoided because they are slow on mobile.
- **Every oscillation completes whole cycles per loop** (`osc(f, L, n)` means n full cycles in L frames). That makes every segment loop without a pop.
- **Tints are fill-colour animation** of every skin surface (face, ears, lids, neck), not overlays. Red for angry, pale blue for scared and nervous, green for disgusted and jealous.

---

## Editing emotions

All emotion data lives in `EMOTIONS` inside `src/rig/rig.js`. Each entry looks like this:

```js
{ id: 'proud', label: 'Proud', L: 90, blink: [70], poster: 28, ring: '#E9C46A', bg: '#FBF1D6',
  beats: { brows: '…', eyes: '…', mouth: '…', extras: '…' },
  fn: function (f) {                                  // f = frame inside the loop, 0..L
    var g = kf([[0, 0], [18, 0], [24, 1], [34, 1], [42, 0], [90, 0]], f);   // keyframe track
    return { mW: 34, mC: 8, mSkew: 3, lidT: 0.38, browAsym: 3,
             hy: -6 + osc(f, 90, 1) * 1.2, glint: g };
  } }
```

| Field | Meaning |
|---|---|
| `L` | Loop length in frames (30 fps) |
| `blink` | Frames where a 6-frame blink starts. Use `[]` when the eyes are already doing something (closed, hearts, squinting) |
| `poster` | Best still frame, used by the contact sheet |
| `ring`, `bg` | Accent and background colours used by the preview and canvas |
| `beats` | One-line notes shown on the expression sheet |
| `fn(f)` | Returns the channels that differ from `BASE` at frame `f` |

Helpers available inside `fn`:

- `kf([[frame, value], …], f)`: an eased keyframe track. The first and last values should match so the segment loops.
- `osc(f, L, n, phase)`: a sine wave with **n whole cycles per loop**.
- `phase(f, period, offset)`: a 0→1 ramp, handy for repeating effects.

### Pose channels

| Group | Channel | Range / meaning |
|---|---|---|
| Mouth | `mW` | width in px (14 small "o" … 46 big grin) |
| | `mC` | corner lift (+ smile, − frown) |
| | `mTop`, `mBot` | upper and lower lip curve; the gap between them is how open the mouth is |
| | `mSkew` | + raises the right corner, − raises the left |
| | `mX` | shifts the mouth sideways |
| | `teeth` | height of the upper teeth band (30 = fully gritted) |
| | `tongue` | tongue size; `grit` shows the clench line between the teeth (0–1) |
| Eyes | `lidT` | upper lid, 0 open … 1 shut; `lidDiff` shuts the right eye extra |
| | `tilt` | lid angle in degrees (+ inner corner down = angry, − outer down = sad) |
| | `lidB`, `lowBulge` | lower lid rise (0–0.56) and how curved its edge is (happy crescents) |
| | `closedCurve` | closed-eye line: 1 = sleepy "U", −1 = smiling "∩" |
| | `px`, `py`, `pupil`, `shine` | gaze offset in px, pupil scale, highlight scale |
| | `heartEyes` | 0–1 swaps the irises for pulsing hearts |
| Brows | `browY` | raise (− is up) |
| | `browIn` | inner ends (+ down = angry, − up = worried) |
| | `browArch` | arch height |
| | `browAsym` | extra raise on the right brow |
| Skin | `blush`, `blushLines` | cheek blush and hatching |
| | `flush`, `pale`, `ill` | red, blue and green skin tint (0–1) |
| | `scrunch` | nose wrinkle |
| Head/body | `hx`, `hy`, `hr` | head offset in px and rotation in degrees (pivot at the chin) |
| | `sx`, `sy` | squash and stretch |
| | `bodyY` | body offset (slump or shrug) |
| Effects (0–1) | `sparkle` `tear` `vein` `steam` `bang` `lines` `sweat` `shiver` `zzz` `bubble` `stink` `glint` `question` `hearts` `cloud` `sigh` `scribble` | opacity of each effect; each effect's motion is timed automatically from the loop |

### Adding a new emotion

1. Add an entry to `EMOTIONS` in `src/rig/rig.js`. Copy the closest existing one and change its channels.
2. Run `npm run preview`, open the page and pick it. The live rig reloads when you refresh.
3. Run `npm run build`, then `npm run validate`, then `npm run sheet`.
4. Run `npm run sync:canvas` to update the design canvas files (see below).

Adding a **new effect or shape** means adding a channel to `BASE`, a group in `scene()`, and the matching markup in `design/canvas/project/Kid.dc.html` (one `<g>`/`<path>` per scene node, looked up by name). The Lottie builder and the SVG output need no changes: they walk whatever tree `scene()` returns. Keep the tree the same for every frame, and keep every path's vertex count constant.

### Changing colours or the character's look

- The default palette is in `colors()` and `tintSkin()` in `rig.js`. Static shapes (hair, bangs, shirt, pigtails…) are path strings in the `SH` table, in head space: origin at the head centre, face ellipse 116 × 106.
- For a different palette in the exported files without touching code, use the build flags `--skin/--hair/--iris/--shirt`.
- Layer and group names in the JSON (`face`, `eyeL`, `mouth`, `bangs`…) are stable, so apps can also recolour at runtime with lottie-ios/android dynamic properties. For example, the keypath `Head.face.Fill` sets the skin colour.

---

## The design canvas

`design/canvas/project/` holds the Claude Design artboards:

- `Main.dc.html` is the interactive player
- `Kid.dc.html` is the rig component
- `Expressions.dc.html` is the sheet of 20 cards
- `Spec.dc.html` is the build spec

`Kid.dc.html` embeds a copy of `rig.js` between `// <kid-rig>` and `// </kid-rig>`. The other artboards carry an emotion data block between `/* <emotion-data> */` markers.

```bash
npm run sync:canvas
```

This pushes `src/rig/rig.js` into `Kid.dc.html` and regenerates the data blocks.

```bash
npm run sync:pull
```

This pulls the rig back out of `Kid.dc.html` if it was edited on the canvas.

```bash
node tools/sync-canvas.mjs --check
```

This only reports whether anything is out of date (exit code 1 if it is).

To update the hosted canvas after syncing, ask Claude to republish `design/canvas/project/` to the canvas.

---

## Troubleshooting

- **The preview's Lottie panel says it could not load the file.** Run `npm run build` first. Also check that you opened the page through `npm run preview`: `file://` URLs block `fetch`.
- **`validate` reports "vertex count changes".** A path in `scene()` builds a different number of vertices on different frames. Use the fixed-count helpers (`lidShape`, `ell`, `quadPath`, `sp` with the same path string).
- **A loop pops at the seam.** Some motion in `fn` is not periodic. Use `osc(f, L, n)` with whole `n`, and make `kf` tracks start and end on the same value.
- **Files are too big.** Build with `--tolerance 0.5` or `--step 2`, ship the per-emotion files, or run the JSON through `lottie-minify` / convert it to `.lottie` (dotLottie) for zip compression.
