#!/usr/bin/env node
// Builds Lottie JSON from the rig.
//
//   node tools/build-lottie.mjs                         everything: both kids, combined + one file per emotion
//   node tools/build-lottie.mjs --kid boy --emotions happy,sad
//   node tools/build-lottie.mjs --skin "#C98B62" --hair "#2E1F18" --out dist/custom
//
// Options
//   --kid girl|boy|both   character variant (default both)
//   --emotions a,b,c      subset and order of segments (default: all, registry order)
//   --step N              sample every N frames (default 1; 2 halves the file size, slightly less smooth)
//   --tolerance T         max drift in px when dropping redundant keyframes (default 0.25)
//   --skin/--hair/--iris/--shirt "#hex"   bake different colours
//   --out DIR             output folder (default dist)
//   --no-split            skip the one-file-per-emotion output
//   --pretty              indent the JSON (bigger, easier to diff)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { buildLottie } from '../src/lottie/build.js';
import { ROOT, loadRig, parseArgs, kb } from './lib/rig.mjs';

const args = parseArgs(process.argv.slice(2));
const rig = loadRig();
const out = resolve(ROOT, typeof args.out === 'string' ? args.out : 'dist');
const kids = args.kid === 'girl' || args.kid === 'boy' ? [args.kid] : ['girl', 'boy'];
const emotions = typeof args.emotions === 'string' ? args.emotions.split(',').map((s) => s.trim()).filter(Boolean) : null;
const base = { step: args.step, tolerance: args.tolerance, skin: args.skin, hair: args.hair, iris: args.iris, shirt: args.shirt };

function save(file, json) {
  mkdirSync(join(file, '..'), { recursive: true });
  const text = args.pretty ? JSON.stringify(json, null, 2) : JSON.stringify(json);
  writeFileSync(file, text);
  return text.length;
}

const t0 = Date.now();
let markers = null;
for (const kid of kids) {
  const all = buildLottie(rig, { ...base, kid, emotions });
  const file = join(out, `kid-emotions-${kid}.json`);
  const size = save(file, all.json);
  markers = all.segments;
  console.log(`${relative(ROOT, file)}  ${kb(size)}  ${all.json.markers.length} markers, ${all.json.op} frames, ` +
    `${all.stats.animated} animated props, ${all.stats.keyframes} keyframes`);

  if (!args['no-split']) {
    const ids = emotions || rig.EMOTIONS.map((e) => e.id);
    let total = 0;
    for (const id of ids) {
      const one = buildLottie(rig, { ...base, kid, emotions: [id] });
      total += save(join(out, 'emotions', kid, `${rig.byId(id).id}.json`), one.json);
    }
    console.log(`${relative(ROOT, join(out, 'emotions', kid))}/  ${ids.length} files, ${kb(total)} total`);
  }
}

const markerFile = join(out, 'markers.json');
save(markerFile, markers.map((s) => ({ name: s.id, label: s.label, start: s.start, end: s.end, frames: s.L, seconds: +(s.L / rig.FPS).toFixed(2) })));
console.log(`${relative(ROOT, markerFile)}  segment table`);
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
