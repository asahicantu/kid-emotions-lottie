#!/usr/bin/env node
// Structural checks for every Lottie file under dist/ (or the paths given).
//   node tools/validate.mjs [file-or-folder ...]
// Checks: header fields, markers against the rig timeline, keyframe times strictly
// increasing and inside [ip, op], and constant vertex counts inside every animated path
// (Lottie can only morph paths with matching vertex counts).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { ROOT, loadRig, kb } from './lib/rig.mjs';

const rig = loadRig();
const targets = process.argv.slice(2).length ? process.argv.slice(2).map((p) => resolve(p)) : [join(ROOT, 'dist')];

function files(p) {
  if (!existsSync(p)) return [];
  if (statSync(p).isDirectory()) return readdirSync(p).flatMap((f) => files(join(p, f)));
  return p.endsWith('.json') && !p.endsWith('markers.json') ? [p] : [];
}

let failed = 0, checked = 0;
for (const file of targets.flatMap(files)) {
  const errors = [];
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const err = (m) => { if (errors.length < 20) errors.push(m); };

  for (const k of ['v', 'fr', 'ip', 'op', 'w', 'h', 'layers']) if (json[k] === undefined) err(`missing "${k}"`);
  if (json.fr !== rig.FPS) err(`fr is ${json.fr}, expected ${rig.FPS}`);

  const segs = rig.timeline((json.markers || []).map((m) => rig.byId(m.cm)).filter(Boolean));
  (json.markers || []).forEach((m, i) => {
    if (!rig.byId(m.cm)) err(`marker "${m.cm}" is not a rig emotion`);
    else if (segs[i].start !== m.tm || segs[i].L !== m.dr) err(`marker "${m.cm}" at ${m.tm}+${m.dr}, expected ${segs[i].start}+${segs[i].L}`);
  });

  function checkProp(prop, where, isShape) {
    if (!prop || prop.a !== 1) return;
    let prev = -Infinity, verts = null;
    for (const k of prop.k) {
      if (!(k.t > prev)) err(`${where}: keyframe time ${k.t} not increasing`);
      if (k.t < json.ip || k.t > json.op) err(`${where}: keyframe at ${k.t} outside ${json.ip}..${json.op}`);
      prev = k.t;
      if (isShape) {
        const n = k.s[0].v.length;
        if (verts === null) verts = n; else if (n !== verts) err(`${where}: vertex count changes ${verts} -> ${n}`);
      }
    }
  }
  function walk(items, path) {
    for (const it of items || []) {
      const where = `${path}/${it.nm}`;
      if (it.ty === 'gr') walk(it.it, where);
      else if (it.ty === 'sh') checkProp(it.ks, where, true);
      else if (it.ty === 'tr') ['p', 'a', 's', 'r', 'o'].forEach((k) => checkProp(it[k], `${where}.${k}`));
    }
  }
  for (const layer of json.layers || []) {
    ['p', 'a', 's', 'r', 'o'].forEach((k) => checkProp(layer.ks[k], `${layer.nm}.ks.${k}`));
    walk(layer.shapes, layer.nm);
  }

  checked++;
  const size = kb(statSync(file).size);
  if (errors.length) {
    failed++;
    console.log(`FAIL ${relative(ROOT, file)} (${size})`);
    errors.forEach((e) => console.log(`     ${e}`));
  } else {
    console.log(`ok   ${relative(ROOT, file)} (${size}, ${(json.markers || []).length} markers, ${json.op} frames)`);
  }
}

if (!checked) { console.log('no Lottie files found; run `npm run build` first'); process.exit(1); }
console.log(`\n${checked - failed}/${checked} files valid`);
process.exit(failed ? 1 : 0);
