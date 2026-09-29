#!/usr/bin/env node
// Renders every emotion at its poster frame into one SVG per kid, for quick review
// without a browser build step: dist/contact-sheet-girl.svg, dist/contact-sheet-boy.svg.
//   node tools/contact-sheet.mjs [--frame N] [--cols 5]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, loadRig, parseArgs } from './lib/rig.mjs';

const args = parseArgs(process.argv.slice(2));
const rig = loadRig();
const cols = Number(args.cols) || 5;
const cell = 220, label = 34;
const rows = Math.ceil(rig.EMOTIONS.length / cols);
const W = cols * cell, H = rows * (cell + label);
mkdirSync(join(ROOT, 'dist'), { recursive: true });

for (const kid of ['girl', 'boy']) {
  const cells = rig.EMOTIONS.map((e, i) => {
    const x = (i % cols) * cell, y = Math.floor(i / cols) * (cell + label);
    const frame = args.frame !== undefined ? Number(args.frame) : e.poster;
    const art = rig.toSVG(rig.scene(rig.pose(e.id, frame), { kid }), { inner: true });
    return `<g transform="translate(${x} ${y})"><rect width="${cell}" height="${cell + label}" fill="${e.bg}"/>` +
      `<g transform="translate(10 6) scale(0.5)">${art}</g>` +
      `<text x="${cell / 2}" y="${cell + 20}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" font-weight="700" fill="#2A2320">${e.label}</text></g>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${cells.join('')}</svg>`;
  const file = join(ROOT, 'dist', `contact-sheet-${kid}.svg`);
  writeFileSync(file, svg);
  console.log(`wrote ${relative(ROOT, file)}`);
}
