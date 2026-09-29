// Bakes the rig into Lottie (Bodymovin 5.7 schema) JSON.
//
// The rig builds the same scene tree for every frame, so each group transform and
// each path can be sampled frame by frame and written as a keyframed property.
// Keyframes that linear interpolation can reproduce within `tolerance` are dropped.

const LINEAR = { i: { x: 1, y: 1 }, o: { x: 0, y: 0 } };

function round(n, d = 100) { return Math.round(n * d) / d; }

function color(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => round(parseInt(h.substr(i, 2), 16) / 255, 10000)).concat(1);
}

// Lottie stores bezier handles relative to their vertex.
function lottieBez(b) {
  return {
    c: b.c,
    v: b.v.map((p) => [round(p[0]), round(p[1])]),
    i: b.i.map((h, j) => [round(h[0] - b.v[j][0]), round(h[1] - b.v[j][1])]),
    o: b.o.map((h, j) => [round(h[0] - b.v[j][0]), round(h[1] - b.v[j][1])]),
  };
}

function numbers(v) {
  if (typeof v === 'number') return [v];
  if (Array.isArray(v)) return v;
  return [].concat(...v.v, ...v.i, ...v.o);
}

function push(series, key, t, v) {
  if (!series.has(key)) series.set(key, []);
  series.get(key).push({ t, v, n: numbers(v) });
}

function collect(nodes, t, series) {
  for (const n of nodes) {
    if (n.type === 'group') {
      const tr = n.tr;
      push(series, `${n.name}.p`, t, [round(tr.p[0]), round(tr.p[1])]);
      push(series, `${n.name}.a`, t, [round(tr.a[0]), round(tr.a[1])]);
      push(series, `${n.name}.s`, t, [round(tr.s[0]), round(tr.s[1])]);
      push(series, `${n.name}.r`, t, round(tr.r));
      push(series, `${n.name}.o`, t, round(tr.o, 10));
      collect(n.children, t, series);
    } else {
      n.paths.forEach((b, k) => push(series, `${n.name}.sh${k}`, t, lottieBez(b)));
      if (n.fill) push(series, `${n.name}.fc`, t, color(n.fill));
    }
  }
}

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// Drop keys that the straight line between their kept neighbours reproduces within tol.
// The look-back window is capped so long holds stay linear-time.
function simplify(keys, tol, window = 32) {
  if (keys.length <= 2) return keys;
  const out = [keys[0]];
  let a = 0;
  for (let i = 1; i < keys.length - 1; i++) {
    const A = keys[a], Bk = keys[i + 1];
    let ok = i - a < window;
    for (let j = a + 1; ok && j <= i; j++) {
      const u = (keys[j].t - A.t) / (Bk.t - A.t);
      const n = keys[j].n;
      for (let d = 0; d < n.length; d++) {
        if (Math.abs(A.n[d] + (Bk.n[d] - A.n[d]) * u - n[d]) > tol) { ok = false; break; }
      }
    }
    if (!ok) { out.push(keys[i]); a = i; }
  }
  out.push(keys[keys.length - 1]);
  return out;
}

export function buildLottie(rig, opts = {}) {
  const kid = opts.kid === 'boy' ? 'boy' : 'girl';
  const step = Math.max(1, Number(opts.step) || 1);
  const tol = opts.tolerance === undefined ? 0.25 : Number(opts.tolerance);
  const ids = opts.emotions && opts.emotions.length ? opts.emotions : rig.EMOTIONS.map((e) => e.id);
  const list = ids.map((id) => {
    const e = rig.byId(id);
    if (!e) throw new Error(`Unknown emotion "${id}". Known: ${rig.EMOTIONS.map((x) => x.id).join(', ')}`);
    return e;
  });
  const segs = rig.timeline(list);
  const sceneOpts = { kid, skin: opts.skin, hair: opts.hair, iris: opts.iris, shirt: opts.shirt };

  // 1. Sample every segment, including its closing frame (= its first pose) so loops are seamless.
  const series = new Map();
  let template = null;
  for (const s of segs) {
    const frames = [];
    for (let f = 0; f < s.L; f += step) frames.push(f);
    frames.push(s.L);
    for (const f of frames) {
      const nodes = rig.scene(rig.pose(s.id, f), sceneOpts);
      if (!template) template = nodes;
      collect(nodes, s.start + f, series);
    }
  }

  const stats = { keyframes: 0, animated: 0, static: 0 };

  function prop(key, kind, pad3) {
    const keys = series.get(key);
    const fmt = (v) => {
      if (kind === 'shape') return v;
      if (kind === 'num') return v;
      return pad3 ? [v[0], v[1], pad3 === 'scale' ? 100 : 0] : v;
    };
    if (keys.every((k) => same(k.n, keys[0].n))) {
      stats.static++;
      return { a: 0, k: fmt(keys[0].v) };
    }
    // colours live in 0..1, so they get their own (much finer) tolerance
    const kept = simplify(keys, kind === 'color' ? 0.004 : tol);
    stats.animated++;
    stats.keyframes += kept.length;
    const dims = kind === 'num' ? 1 : kind === 'color' ? 4 : pad3 ? 3 : 2;
    const ease = kind === 'shape' ? LINEAR
      : { i: { x: Array(dims).fill(1), y: Array(dims).fill(1) }, o: { x: Array(dims).fill(0), y: Array(dims).fill(0) } };
    return {
      a: 1,
      k: kept.map((k, j) => {
        const s = kind === 'shape' ? [k.v] : kind === 'num' ? [k.v] : fmt(k.v);
        return j < kept.length - 1 ? { t: k.t, s, i: ease.i, o: ease.o } : { t: k.t, s };
      }),
    };
  }

  const hidden = (n) => series.get(`${n.name}.o`).every((k) => k.v <= 0);

  function transformItem(n) {
    return {
      ty: 'tr', nm: 'Transform',
      p: prop(`${n.name}.p`, 'vec'), a: prop(`${n.name}.a`, 'vec'), s: prop(`${n.name}.s`, 'vec'),
      r: prop(`${n.name}.r`, 'num'), o: prop(`${n.name}.o`, 'num'),
      sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 },
    };
  }
  const identity = {
    ty: 'tr', nm: 'Transform', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] },
    r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 },
  };

  // Scene children are painter-ordered (first = bottom); Lottie lists topmost first.
  function item(n) {
    if (n.type === 'group') {
      if (hidden(n)) return null;
      const it = n.children.slice().reverse().map(item).filter(Boolean);
      it.push(transformItem(n));
      return { ty: 'gr', nm: n.name, np: it.length - 1, cix: 2, it };
    }
    const it = n.paths.map((_, k) => ({
      ty: 'sh', nm: n.paths.length > 1 ? `${n.name} ${k + 1}` : n.name, ind: k, ks: prop(`${n.name}.sh${k}`, 'shape'),
    }));
    if (n.stroke) it.push({ ty: 'st', nm: 'Stroke', c: { a: 0, k: color(n.stroke) }, o: { a: 0, k: 100 }, w: { a: 0, k: n.sw }, lc: 2, lj: 2, ml: 4 });
    if (n.fill) it.push({ ty: 'fl', nm: 'Fill', c: prop(`${n.name}.fc`, 'color'), o: { a: 0, k: 100 }, r: 1 });
    it.push(identity);
    return { ty: 'gr', nm: n.name, np: it.length - 1, cix: 2, it };
  }

  const last = segs[segs.length - 1];
  const op = last.start + last.L;
  const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const layers = template.slice().reverse().map((n, idx) => ({
    ddd: 0, ind: idx + 1, ty: 4, nm: title(n.name), sr: 1,
    ks: {
      o: prop(`${n.name}.o`, 'num'), r: prop(`${n.name}.r`, 'num'),
      p: prop(`${n.name}.p`, 'vec', 'pos'), a: prop(`${n.name}.a`, 'vec', 'pos'), s: prop(`${n.name}.s`, 'vec', 'scale'),
    },
    ao: 0, shapes: n.children.slice().reverse().map(item).filter(Boolean),
    ip: 0, op, st: 0, bm: 0,
  }));

  const name = opts.name || (list.length === 1 ? `Kid ${kid} – ${list[0].label}` : `Kid ${kid} – emotions`);
  return {
    json: {
      v: '5.7.4', fr: rig.FPS, ip: 0, op, w: 400, h: 400, nm: name, ddd: 0, assets: [],
      layers,
      markers: segs.map((s) => ({ tm: s.start, cm: s.id, dr: s.L })),
      meta: { g: 'kid-emotions-lottie', k: 'kid, emotions, face', d: 'Generated from src/rig/rig.js by tools/build-lottie.mjs' },
    },
    segments: segs,
    stats,
  };
}
