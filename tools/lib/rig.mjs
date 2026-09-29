// Loads the classic-script rig (src/rig/rig.js) into Node without a bundler.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RIG_FILE = join(ROOT, 'src', 'rig', 'rig.js');

export function loadRig(file = RIG_FILE) {
  const context = vm.createContext({ console });
  vm.runInContext(readFileSync(file, 'utf8'), context, { filename: file });
  if (!context.KidRig) throw new Error(`${file} did not define KidRig`);
  return context.KidRig;
}

// Minimal --flag value / --flag parser.
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

export function kb(bytes) { return (bytes / 1024).toFixed(1) + ' KB'; }
