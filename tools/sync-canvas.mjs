#!/usr/bin/env node
// Keeps the design canvas (design/canvas/project/*.dc.html) in step with the rig.
//
//   node tools/sync-canvas.mjs          push: copy src/rig/rig.js into Kid.dc.html and
//                                       regenerate the emotion data blocks in the other artboards
//   node tools/sync-canvas.mjs --pull   pull: copy the rig block out of Kid.dc.html into src/rig/rig.js
//   add --check to only report whether anything is out of date (exit 1 if so)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, RIG_FILE, loadRig, parseArgs } from './lib/rig.mjs';

const args = parseArgs(process.argv.slice(2));
const CANVAS = join(ROOT, 'design', 'canvas', 'project');
const KID = join(CANVAS, 'Kid.dc.html');
const RIG_OPEN = '// <kid-rig>\n';
const RIG_CLOSE = '// </kid-rig>';
const DATA_RE = /\/\* <emotion-data fields="([^"]+)"> \*\/\n[\s\S]*?\/\* <\/emotion-data> \*\//g;

function between(text, open, close, file) {
  const a = text.indexOf(open), b = text.indexOf(close);
  if (a < 0 || b < a) throw new Error(`${file}: markers ${open.trim()} … ${close} not found`);
  return [a + open.length, b];
}

function emotionData(rig, fields) {
  const segs = rig.timeline();
  return rig.EMOTIONS.map((e, i) => {
    const s = segs[i];
    const all = { id: e.id, label: e.label, ring: e.ring, bg: e.bg, L: e.L,
      frames: `${s.start}–${s.end}`, loop: `${(e.L / rig.FPS).toFixed(1)} s`, beats: e.beats };
    const row = {};
    fields.forEach((f) => { row[f] = all[f]; });
    return JSON.stringify(row);
  });
}

let changed = 0;
function write(file, next) {
  const prev = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (prev === next) return;
  changed++;
  if (args.check) { console.log(`out of date: ${file}`); return; }
  writeFileSync(file, next);
  console.log(`wrote ${file}`);
}

if (args.pull) {
  const html = readFileSync(KID, 'utf8');
  const [a, b] = between(html, RIG_OPEN, RIG_CLOSE, KID);
  write(RIG_FILE, html.slice(a, b));
} else {
  const rigSrc = readFileSync(RIG_FILE, 'utf8');
  const html = readFileSync(KID, 'utf8');
  const [a, b] = between(html, RIG_OPEN, RIG_CLOSE, KID);
  write(KID, html.slice(0, a) + rigSrc + html.slice(b));

  const rig = loadRig();
  for (const name of readdirSync(CANVAS).filter((f) => f.endsWith('.dc.html'))) {
    const file = join(CANVAS, name);
    const text = readFileSync(file, 'utf8');
    const next = text.replace(DATA_RE, (_, fieldList) => {
      const rows = emotionData(rig, fieldList.split(','));
      return `/* <emotion-data fields="${fieldList}"> */\nconst EMOS = [\n${rows.join(',\n')}\n];\n/* </emotion-data> */`;
    });
    write(file, next);
  }
}

if (!changed) console.log('canvas and rig already in sync');
if (args.check && changed) process.exit(1);
