/*
 * Kid emotion rig: pose channels -> scene graph -> SVG markup or Lottie keyframes.
 * One file, classic script, no dependencies. Defines the global `KidRig`.
 * Source of truth: src/rig/rig.js (tools/sync-canvas.mjs copies it into the design canvas).
 */
var KidRig = (function () {
  'use strict';

  var FPS = 30;
  var TAU = Math.PI * 2;
  var LINE = '#2B1A14';

  // ---------------------------------------------------------------- timing
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  // Keyframe track: [[frame, value], ...], eased in and out between keys.
  function kf(keys, f) {
    if (f <= keys[0][0]) return keys[0][1];
    for (var i = 1; i < keys.length; i++) {
      if (f <= keys[i][0]) {
        var a = keys[i - 1], b = keys[i];
        return a[1] + (b[1] - a[1]) * ease((f - a[0]) / ((b[0] - a[0]) || 1));
      }
    }
    return keys[keys.length - 1][1];
  }

  // n whole sine cycles per loop of L frames, so every segment loops seamlessly.
  function osc(f, L, n, ph) { return Math.sin(TAU * n * f / L + (ph || 0)); }
  function phase(f, period, offset) { var q = (f + (offset || 0)) / period; return q - Math.floor(q); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function r2(n) { return Math.round(n * 100) / 100; }

  // ---------------------------------------------------------------- color
  function rgb(h) {
    h = String(h || '#000000').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16) || 0; });
  }
  function mix(a, b, t) {
    var A = rgb(a), B2 = rgb(b);
    return '#' + A.map(function (v, i) { return Math.round(v + (B2[i] - v) * t).toString(16).padStart(2, '0'); }).join('');
  }

  // ---------------------------------------------------------------- pose channels
  // Rest pose. Each emotion overrides channels per frame; everything else stays here.
  var BASE = {
    // mouth: width, corner lift, upper/lower lip, skew (+ raises right corner), x offset
    mW: 36, mC: 3, mTop: 1, mBot: 4, mSkew: 0, mX: 0, teeth: 0, tongue: 0, grit: 0,
    // eyes: upper lid 0 open..1 shut, extra shut on right eye, lid tilt (+ = inner corner down),
    // lower lid rise, lower lid curve, closed-eye curve (1 = sleep U, -1 = smile arch), blink
    lidT: 0.08, lidDiff: 0, tilt: 0, lidB: 0.04, lowBulge: 2, closedCurve: 1, blink: 0,
    // brows: raise (- = up), inner ends (+ = down), arch, extra raise of right brow
    browY: 0, browIn: 0, browArch: 4, browAsym: 0,
    // gaze and pupils
    px: 0, py: 0, pupil: 1, shine: 1, heartEyes: 0,
    // skin overlays
    blush: 0.35, blushLines: 0, flush: 0, pale: 0, ill: 0, scrunch: 0,
    // head and body
    hx: 0, hy: 0, hr: 0, sx: 1, sy: 1, bodyY: 0,
    // effects (0..1 opacity)
    sparkle: 0, tear: 0, vein: 0, steam: 0, bang: 0, lines: 0, sweat: 0, shiver: 0, zzz: 0, bubble: 0,
    stink: 0, glint: 0, question: 0, hearts: 0, cloud: 0, sigh: 0, scribble: 0
  };

  // ---------------------------------------------------------------- emotions
  // L = loop length in frames. blink = frames where a 6-frame blink starts. poster = best still frame.
  var EMOTIONS = [
    { id: 'happy', label: 'Happy', L: 60, blink: [], poster: 15, ring: '#FFD36E', bg: '#FFF1CC',
      beats: { brows: 'Lift and arch high', eyes: 'Lower lids push up into crescents', mouth: 'Open grin, teeth and tongue', extras: 'Two bounces, sparkles, full blush' },
      fn: function (f) {
        var b = kf([[0, 0], [15, 1], [30, 0], [45, 1], [60, 0]], f);
        return { mW: 46, mC: 12, mTop: 1, mBot: 17 + 8 * b, teeth: 7, tongue: 8, lidT: 0.04, lidB: 0.3 + 0.26 * b, lowBulge: 10,
          browY: -6 - 3 * b, browIn: -2, browArch: 7, pupil: 1.1, blush: 0.95,
          hy: -10 * b, hr: kf([[0, -4], [30, 4], [60, -4]], f), sx: 1 - 0.01 * b, sy: 1 + 0.02 * b, bodyY: -6 * b, sparkle: 1 };
      } },
    { id: 'sad', label: 'Sad', L: 90, blink: [60], poster: 30, ring: '#A9CBEA', bg: '#E3EEF8',
      beats: { brows: 'Inner ends pinch upward', eyes: 'Outer lids droop, gaze drops, wet shine', mouth: 'Small frown, corners quiver', extras: 'Tears from both eyes, shoulders slump' },
      fn: function (f) {
        return { mW: 28, mC: -7 + osc(f, 90, 12) * 0.9, mTop: -1, mBot: 2.5, lidT: 0.34, tilt: -14, lidB: 0.12,
          browY: -3, browIn: -12, browArch: 1, py: 5, px: -1, shine: 1.5, blush: 0.55,
          hy: 8, hr: -4 + osc(f, 90, 1) * 1.5, bodyY: 10, tear: 1 };
      } },
    { id: 'angry', label: 'Angry', L: 60, blink: [52], poster: 18, ring: '#F59A84', bg: '#FCE1D9',
      beats: { brows: 'Inner ends slam down', eyes: 'Lids tilt inward, pupils shrink', mouth: 'Gritted teeth, widens on each huff', extras: 'Red flush, vein pop, steam, tremble' },
      fn: function (f) {
        var h = kf([[0, 0], [18, 1], [36, 0.25], [60, 0]], f);
        return { mW: 34 + 4 * h, mC: -6, mTop: -3, mBot: 8 + 3 * h, teeth: 30, grit: 1, lidT: 0.3, tilt: 16, lidB: 0.16,
          browY: 6, browIn: 12, browArch: -2, pupil: 0.78, flush: 0.45 + 0.45 * h, blush: 0.15,
          hx: osc(f, 60, 24) * 1.6 * (0.4 + h), hy: 2 - 2 * h, sx: 1 + 0.025 * h, sy: 1 - 0.015 * h, bodyY: -2 * h, vein: 1, steam: 1 };
      } },
    { id: 'scared', label: 'Scared', L: 48, blink: [], poster: 10, ring: '#C3B5E8', bg: '#ECE7F8',
      beats: { brows: 'Raised and pinched together', eyes: 'Wide open, pupils dart side to side', mouth: 'Clenched teeth, corners pulled down', extras: 'Shiver, pale tint, sweat drop' },
      fn: function (f) {
        var d = kf([[0, -5], [8, -5], [12, 5], [24, 5], [28, -5], [48, -5]], f);
        return { mW: 30, mC: -5, mTop: -3, mBot: 9, teeth: 30, grit: 0.8, lidT: 0, lidB: 0.04, browY: -9, browIn: -13, browArch: 3,
          pupil: 0.55, px: d, py: -1, blush: 0, pale: 1, hx: osc(f, 48, 24) * 1.5, hy: 4, bodyY: -7, sweat: 1, shiver: 1 };
      } },
    { id: 'surprised', label: 'Surprised', L: 76, blink: [56], poster: 8, ring: '#FFBE7A', bg: '#FFEBD3',
      beats: { brows: 'Shoot up past the fringe', eyes: 'Wide open, pinpoint pupils', mouth: 'Round “O”', extras: 'Hop with squash and stretch, “!” pop' },
      fn: function (f) {
        var j = kf([[0, 0], [5, 1], [12, 0], [16, -0.35], [22, 0], [76, 0]], f);
        return { mW: 18, mC: 0, mTop: -12, mBot: 14 + osc(f, 76, 2), lidT: 0, lidB: 0, browY: -15, browIn: -3, browArch: 8, pupil: 0.62, blush: 0.3,
          hy: -22 * Math.max(j, 0) + 10 * Math.max(-j, 0), sy: 1 + 0.07 * j, sx: 1 - 0.05 * j,
          bodyY: -8 * Math.max(j, 0) + 4 * Math.max(-j, 0), bang: 1, lines: 1 };
      } },
    { id: 'disgusted', label: 'Disgusted', L: 60, blink: [], poster: 8, ring: '#B9D38A', bg: '#EDF4DE',
      beats: { brows: 'Pulled down, one side lower', eyes: 'Squint, one eye more than the other', mouth: 'Upper lip sneers up on one side', extras: 'Nose scrunch, green tint, stink lines' },
      fn: function (f) {
        var s = kf([[0, 0], [6, 1], [14, 0.6], [60, 0]], f);
        return { mW: 30, mC: -4, mSkew: 5, mTop: -5, mBot: 3, teeth: 4, lidT: 0.28, lidDiff: 0.28, tilt: 6, lidB: 0.28, lowBulge: 4,
          browY: 4, browIn: 8, browAsym: -3, scrunch: 1, ill: 0.55 + 0.2 * s, px: 5, py: 1, blush: 0.1,
          hr: -7 - 3 * s, hx: -4 - 3 * s, hy: osc(f, 60, 10) * s, stink: 1 };
      } },
    { id: 'calm', label: 'Calm', L: 90, blink: [45], poster: 0, ring: '#EADCC4', bg: '#F5EEE2',
      beats: { brows: 'Resting, soft arch', eyes: 'Relaxed, glance left and right', mouth: 'Gentle closed smile', extras: 'Slow breathing sway' },
      fn: function (f) {
        return { hy: osc(f, 90, 1) * 1.5, hr: osc(f, 90, 1), px: kf([[0, 0], [28, 0], [34, -5], [56, -5], [62, 4], [82, 4], [90, 0]], f) };
      } },
    { id: 'excited', label: 'Excited', L: 40, blink: [], poster: 10, ring: '#FF9FC0', bg: '#FFE3EE',
      beats: { brows: 'Jump high on every bounce', eyes: 'Huge pupils, extra sparkle', mouth: 'Wide open grin, tongue showing', extras: 'Fast double bounce, sparkles, burst lines' },
      fn: function (f) {
        var b = kf([[0, 0], [10, 1], [20, 0], [30, 1], [40, 0]], f);
        return { mW: 44, mC: 10, mTop: -2, mBot: 22 + 4 * b, teeth: 6, tongue: 7, lidT: 0, lidB: 0.1, browY: -12 - 2 * b, browIn: -2, browArch: 8,
          pupil: 1.25, shine: 1.6, blush: 0.9, hy: -16 * b, sy: 1 + 0.05 * b, sx: 1 - 0.03 * b, hr: osc(f, 40, 1) * 5, bodyY: -10 * b,
          sparkle: 1, lines: 1 };
      } },
    { id: 'tired', label: 'Tired', L: 120, blink: [], poster: 70, ring: '#B4D6C3', bg: '#E4F1E9',
      beats: { brows: 'Relaxed, drift down on the yawn', eyes: 'Lids sink, snap open on the nod', mouth: 'Slack, then one big yawn', extras: 'Head nod, Zzz, snot bubble' },
      fn: function (f) {
        var n = kf([[0, 0], [60, 0.9], [74, 1], [80, 0], [120, 0]], f);
        var y = kf([[0, 0], [86, 0], [94, 1], [110, 1], [118, 0], [120, 0]], f);
        return { mW: 14 + 10 * y, mC: 0, mTop: -3 - 9 * y, mBot: 4 + 18 * y, tongue: 5 * y,
          lidT: Math.min(1, 0.6 + 0.4 * n + 0.4 * y), lidB: 0.1, browY: 3 - 5 * y, browIn: -3 - 4 * y, browArch: 3,
          pupil: 0.9, py: 3, blush: 0.5, hy: 12 * n - 4 * y, hr: 7 * n - 2 * y, sy: 1 + 0.03 * y, bodyY: 5 * n - 3 * y, zzz: 1, bubble: n };
      } },
    { id: 'proud', label: 'Proud', L: 90, blink: [70], poster: 28, ring: '#E9C46A', bg: '#FBF1D6',
      beats: { brows: 'Raised, one a little higher', eyes: 'Half-lidded and content', mouth: 'Closed smirk, one corner up', extras: 'Chin up, chest out, glint' },
      fn: function (f) {
        var g = kf([[0, 0], [18, 0], [24, 1], [34, 1], [42, 0], [90, 0]], f);
        return { mW: 34, mC: 8, mSkew: 3, mTop: 2, mBot: 5, lidT: 0.38, lidB: 0.22, lowBulge: 6, browY: -6, browArch: 6, browAsym: 3,
          py: -2, blush: 0.5, hy: -6 + osc(f, 90, 1) * 1.2, hr: osc(f, 90, 1) * 1.5, sy: 1.01, bodyY: -4, glint: g };
      } },
    { id: 'embarrassed', label: 'Embarrassed', L: 90, blink: [30, 70], poster: 20, ring: '#F7A8B8', bg: '#FDE4EA',
      beats: { brows: 'Worried tilt', eyes: 'Look away and down', mouth: 'Wobbly small smile', extras: 'Deep blush with lines, sweat, shrink' },
      fn: function (f) {
        return { mW: 22, mC: 2 + osc(f, 90, 6) * 1.5, mSkew: 2, mTop: 1, mBot: 5, lidT: 0.25, tilt: -8, lidB: 0.22, lowBulge: 4,
          browY: -2, browIn: -8, browArch: 2, px: -6, py: 5, blush: 1, blushLines: 1, flush: 0.2,
          hr: -6 + osc(f, 90, 1) * 2, hy: 5, bodyY: 5, sweat: 0.8 };
      } },
    { id: 'confused', label: 'Confused', L: 90, blink: [55], poster: 30, ring: '#C9C3F0', bg: '#EEECFB',
      beats: { brows: 'One up, one down', eyes: 'Glance up and aside, one eye narrower', mouth: 'Twisted to one side', extras: 'Head tilt, bobbing “?”' },
      fn: function (f) {
        return { mW: 20, mC: -2, mSkew: -4, mX: 6, mTop: -1, mBot: 3, lidT: 0.12, lidDiff: 0.15, lidB: 0.05,
          browY: 2, browAsym: 12, browArch: 4, px: 4 + osc(f, 90, 1), py: -5, hr: -9 + osc(f, 90, 1) * 2, hy: 2, question: 1 };
      } },
    { id: 'jealous', label: 'Jealous', L: 90, blink: [80], poster: 20, ring: '#9FD1A7', bg: '#E2F2E4',
      beats: { brows: 'Low and tight', eyes: 'Side-eye under heavy lids', mouth: 'Pout pushed to one side', extras: 'Green tint, grumble scribble' },
      fn: function (f) {
        return { mW: 18, mC: -3, mSkew: -3, mX: -5, mTop: -2, mBot: 3, lidT: 0.45, tilt: 6, lidB: 0.2, lowBulge: 3,
          browY: 3, browIn: 6, browAsym: -3, px: kf([[0, -7], [40, -7], [46, -4], [70, -4], [76, -7], [90, -7]], f), py: 1,
          ill: 0.35, hr: 5 + osc(f, 90, 1), hx: 3, blush: 0.1, scribble: 1 };
      } },
    { id: 'grateful', label: 'Grateful', L: 90, blink: [], poster: 40, ring: '#F2C5A0', bg: '#FCEDE0',
      beats: { brows: 'Soft and raised', eyes: 'Closed, smiling arcs', mouth: 'Warm closed smile', extras: 'Slow bow, blush, floating hearts' },
      fn: function (f) {
        var n = kf([[0, 0], [25, 1], [60, 1], [85, 0], [90, 0]], f);
        return { mW: 30, mC: 8, mTop: 1, mBot: 6, lidT: 1, closedCurve: -1, lidB: 0.1, browY: -2 + 2 * n, browIn: -6, browArch: 5,
          blush: 0.85, hy: 9 * n, hr: osc(f, 90, 1) * 1.5, sy: 1 - 0.01 * n, bodyY: 3 * n, hearts: 0.8 };
      } },
    { id: 'lonely', label: 'Lonely', L: 120, blink: [60], poster: 30, ring: '#AEB8CC', bg: '#E7EAF0',
      beats: { brows: 'Inner ends lift', eyes: 'Heavy lids, gaze down, wet shine', mouth: 'Flat, corners down', extras: 'Slump, pale tint, rain cloud' },
      fn: function (f) {
        return { mW: 20, mC: -4, mTop: 0, mBot: 2, lidT: 0.42, tilt: -10, lidB: 0.12, browY: -1, browIn: -9, browArch: 2,
          px: 3, py: 6, shine: 1.3, blush: 0.2, pale: 0.3, hr: -6 + osc(f, 120, 1) * 1.5, hy: 7, bodyY: 10, cloud: 1 };
      } },
    { id: 'hopeful', label: 'Hopeful', L: 90, blink: [45], poster: 20, ring: '#9ED8E0', bg: '#E2F4F6',
      beats: { brows: 'Lifted, inner ends up', eyes: 'Look up, big shiny pupils', mouth: 'Small open smile', extras: 'Head tilts up, twinkling star' },
      fn: function (f) {
        return { mW: 24, mC: 5, mTop: -2, mBot: 7, lidT: 0, lidB: 0.1, browY: -8, browIn: -7, browArch: 5, px: 2, py: -7,
          pupil: 1.2, shine: 1.6, blush: 0.5, hr: 4 + osc(f, 90, 1), hy: -4 + osc(f, 90, 1) * 2, glint: 0.6 + 0.4 * Math.abs(osc(f, 90, 2)) };
      } },
    { id: 'nervous', label: 'Nervous', L: 60, blink: [10, 35], poster: 15, ring: '#D8C99B', bg: '#F4EFDF',
      beats: { brows: 'Worried and raised', eyes: 'Small pupils, quick blinks, darting', mouth: 'Wavy clench', extras: 'Jitter, pale tint, sweat drop' },
      fn: function (f) {
        return { mW: 30, mC: -2 + osc(f, 60, 6) * 2, mTop: -2, mBot: 5, teeth: 20, grit: 0.5, lidT: 0.05, lidB: 0.08,
          browY: -5, browIn: -10, browArch: 3, pupil: 0.7, px: kf([[0, -3], [20, -3], [24, 3], [44, 3], [48, -3], [60, -3]], f),
          hx: osc(f, 60, 12) * 0.8, hy: 2, bodyY: -3, blush: 0.2, pale: 0.35, sweat: 1 };
      } },
    { id: 'bored', label: 'Bored', L: 120, blink: [40], poster: 95, ring: '#C7C0B6', bg: '#EEEBE7',
      beats: { brows: 'Flat and low', eyes: 'Half-closed, gaze drifts up', mouth: 'Pushed to one side, then a sigh', extras: 'Head leans heavy, sigh puff' },
      fn: function (f) {
        var s = kf([[0, 0], [78, 0], [86, 1], [100, 1], [110, 0], [120, 0]], f);
        return { mW: 26 - 8 * s, mC: -1, mSkew: 2 * (1 - s), mX: 6 * (1 - s), mTop: -3 * s, mBot: 1.5 + 5 * s, lidT: 0.5 + 0.1 * s, lidB: 0.15,
          browY: 4 - 2 * s, browIn: 2, browArch: 1, px: 5, py: -4, hr: 8 + osc(f, 120, 1) * 2, hy: 6, bodyY: 4, blush: 0.1, sigh: s };
      } },
    { id: 'curious', label: 'Curious', L: 90, blink: [60], poster: 40, ring: '#8FD0C0', bg: '#DFF3EE',
      beats: { brows: 'One brow lifts', eyes: 'Wide, big pupils, look aside', mouth: 'Small “o”', extras: 'Head tilts and leans in, twinkle' },
      fn: function (f) {
        var t = kf([[0, 0], [20, 1], [70, 1], [90, 0]], f);
        return { mW: 14, mC: 0, mTop: -6, mBot: 7, lidT: 0, lidB: 0.05, browY: -5, browAsym: 7 * t, browArch: 6, px: 5 * t, py: -2,
          pupil: 1.2, shine: 1.3, hr: -10 * t, hx: 4 * t, sx: 1 + 0.03 * t, sy: 1 + 0.03 * t, blush: 0.35, glint: 0.5 * t };
      } },
    { id: 'loving', label: 'Loving', L: 90, blink: [], poster: 22, ring: '#F48FA8', bg: '#FDE1E8',
      beats: { brows: 'Soft and raised', eyes: 'Heart eyes that pulse', mouth: 'Big warm smile', extras: 'Sway, full blush, floating hearts' },
      fn: function (f) {
        return { mW: 34, mC: 10, mTop: 1, mBot: 10, lidT: 0, lidB: 0.15, lowBulge: 4, browY: -6, browIn: -5, browArch: 6,
          heartEyes: 1, blush: 1, hr: osc(f, 90, 1) * 6, hy: -3 * Math.abs(osc(f, 90, 1)), hearts: 1 };
      } }
  ];

  var ALIASES = { neutral: 'calm', sleepy: 'tired' };
  var BY_ID = {};
  EMOTIONS.forEach(function (e) { BY_ID[e.id] = e; });
  function byId(id) { return BY_ID[ALIASES[id] || id] || null; }

  // Segments laid end to end with a 1-frame gap, so each loop's last frame repeats its first.
  function timeline(list) {
    var t = 0;
    return (list || EMOTIONS).map(function (e) {
      var s = { id: e.id, label: e.label, L: e.L, start: t, end: t + e.L };
      t += e.L + 1;
      return s;
    });
  }

  function pose(id, frame) {
    var e = byId(id) || BY_ID.calm;
    var lf = ((frame % e.L) + e.L) % e.L;
    var p = Object.assign({}, BASE, e.fn(lf));
    var blink = 0;
    (e.blink || []).forEach(function (s) { blink = Math.max(blink, kf([[s, 0], [s + 2, 1], [s + 3, 1], [s + 6, 0]], lf)); });
    p.blink = blink;
    p._id = e.id; p._lf = lf; p._L = e.L;
    return p;
  }

  function blend(a, b, k) {
    var out = Object.assign({}, b);
    for (var key in BASE) out[key] = a[key] + (b[key] - a[key]) * k;
    return out;
  }

  // Live playback with a 9-frame ease-out blend whenever the emotion changes.
  function Animator() { this.g = 0; this.seg = 0; this.id = null; this.from = null; this.t0 = 0; this.last = null; }
  Animator.prototype.set = function (id, smooth) {
    var e = byId(id) || BY_ID.calm;
    if (e.id === this.id) return;
    this.from = (smooth !== false && this.last) ? this.last : null;
    this.t0 = this.g; this.seg = this.g; this.id = e.id;
  };
  Animator.prototype.advance = function (frames) { this.g += frames; };
  Animator.prototype.pose = function () {
    var p = pose(this.id || 'calm', this.g - this.seg);
    if (this.from) {
      var w = clamp01((this.g - this.t0) / 9);
      p = blend(this.from, p, 1 - Math.pow(1 - w, 3));
      if (w >= 1) this.from = null;
    }
    this.last = p;
    return p;
  };

  // ---------------------------------------------------------------- bezier paths
  // {c: closed, v: vertices, i: in-handles, o: out-handles}, handles absolute. Same shape as Lottie, which stores them relative.
  function B(x, y) { return { c: false, v: [[x, y]], i: [[x, y]], o: [[x, y]] }; }
  function cub(b, x1, y1, x2, y2, x, y) {
    b.o[b.o.length - 1] = [x1, y1];
    b.v.push([x, y]); b.i.push([x2, y2]); b.o.push([x, y]);
    return b;
  }
  function lin(b, x, y) { b.v.push([x, y]); b.i.push([x, y]); b.o.push([x, y]); return b; }
  function quad(b, qx, qy, x, y) {
    var l = b.v[b.v.length - 1];
    return cub(b, l[0] + 2 / 3 * (qx - l[0]), l[1] + 2 / 3 * (qy - l[1]), x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), x, y);
  }
  function close(b, x1, y1, x2, y2) {
    b.c = true;
    if (x1 !== undefined) { b.o[b.o.length - 1] = [x1, y1]; b.i[0] = [x2, y2]; }
    return b;
  }
  function quadPath(x0, y0, qx, qy, x1, y1) { return quad(B(x0, y0), qx, qy, x1, y1); }
  function ell(cx, cy, rx, ry) {
    var k = 0.5523, b = B(cx, cy - ry);
    cub(b, cx + k * rx, cy - ry, cx + rx, cy - k * ry, cx + rx, cy);
    cub(b, cx + rx, cy + k * ry, cx + k * rx, cy + ry, cx, cy + ry);
    cub(b, cx - k * rx, cy + ry, cx - rx, cy + k * ry, cx - rx, cy);
    return close(b, cx - rx, cy - k * ry, cx - k * rx, cy - ry);
  }

  // Tiny parser for absolute M L C Q Z path data; returns one bezier per subpath.
  var SP_CACHE = {};
  function sp(d) {
    if (SP_CACHE[d]) return SP_CACHE[d];
    var t = d.match(/[MLCQZ]|-?\d*\.?\d+/gi), i = 0, cmd = 'M', out = [], b = null;
    function n() { return parseFloat(t[i++]); }
    while (i < t.length) {
      if (/^[MLCQZ]$/i.test(t[i])) {
        cmd = t[i++].toUpperCase();
        if (cmd === 'Z') {
          var last = b.v.length - 1;
          if (last > 0 && b.v[last][0] === b.v[0][0] && b.v[last][1] === b.v[0][1]) {
            b.i[0] = b.i[last]; b.v.pop(); b.i.pop(); b.o.pop();
          }
          b.c = true;
          continue;
        }
      }
      if (cmd === 'M') { b = B(n(), n()); out.push(b); cmd = 'L'; }
      else if (cmd === 'L') lin(b, n(), n());
      else if (cmd === 'C') cub(b, n(), n(), n(), n(), n(), n());
      else if (cmd === 'Q') quad(b, n(), n(), n(), n());
      else i++;
    }
    SP_CACHE[d] = out;
    return out;
  }

  // Eyelid: the part of the 24x29 eye ellipse beyond a tilted, curved edge. Always 5 vertices so it morphs.
  function lidShape(e, deg, bulge, upper) {
    var rx = 24, ry = 29, a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    var A = c * c / (rx * rx) + s * s / (ry * ry), Bq = 2 * e * s / (ry * ry), Cq = e * e / (ry * ry) - 1;
    var disc = Bq * Bq - 4 * A * Cq;
    var P1, P2, S0, E0, th0, th1;
    function ep(t) { return [rx * Math.cos(t), ry * Math.sin(t)]; }
    function ed(t) { return [-rx * Math.sin(t), ry * Math.cos(t)]; }
    if (disc > 0) {
      var q = Math.sqrt(disc), t1 = (-Bq - q) / (2 * A), t2 = (-Bq + q) / (2 * A);
      P1 = [t1 * c, e + t1 * s]; P2 = [t2 * c, e + t2 * s];
      S0 = upper ? P1 : P2; E0 = upper ? P2 : P1;
      th0 = Math.atan2(S0[1] / ry, S0[0] / rx); th1 = Math.atan2(E0[1] / ry, E0[0] / rx);
      while (th1 < th0) th1 += TAU;
      while (th1 - th0 > TAU) th1 -= TAU;
    } else {
      var covered = upper ? e > 0 : e < 0;
      th0 = (upper === covered) ? Math.PI / 2 : -Math.PI / 2;
      th1 = covered ? th0 + TAU : th0;
      P1 = P2 = S0 = E0 = ep(th0);
    }
    var b = B(S0[0], S0[1]), dt = (th1 - th0) / 4, h = 4 / 3 * Math.tan(dt / 4);
    for (var k = 0; k < 4; k++) {
      var ta = th0 + k * dt, tb = ta + dt, pa = ep(ta), pb = k === 3 ? E0 : ep(tb), da = ed(ta), db = ed(tb);
      cub(b, pa[0] + h * da[0], pa[1] + h * da[1], pb[0] - h * db[0], pb[1] - h * db[1], pb[0], pb[1]);
    }
    var half = Math.hypot(E0[0] - S0[0], E0[1] - S0[1]) / 2;
    var bb = Math.min(bulge, half * 0.6) * (upper ? 1 : -1);
    var Q = [(P1[0] + P2[0]) / 2 - s * bb, (P1[1] + P2[1]) / 2 + c * bb];
    close(b, E0[0] + 2 / 3 * (Q[0] - E0[0]), E0[1] + 2 / 3 * (Q[1] - E0[1]), S0[0] + 2 / 3 * (Q[0] - S0[0]), S0[1] + 2 / 3 * (Q[1] - S0[1]));
    return { fill: b, line: quadPath(P1[0], P1[1], Q[0], Q[1], P2[0], P2[1]) };
  }

  // ---------------------------------------------------------------- shapes (head space: origin = head centre)
  var SH = {
    hairBackGirl: 'M -126,-6 C -132,-114 132,-114 126,-6 L 128,64 C 120,88 96,90 90,64 L 84,20 L -84,20 L -90,64 C -96,90 -120,88 -128,64 Z',
    hairBackBoy: 'M -122,2 C -128,-114 128,-114 122,2 Z',
    pigtail: 'M 0,-6 C -30,-12 -50,20 -42,54 C -36,80 -14,88 -8,72 C -18,54 -10,26 4,10 Z',
    bow: 'M 0,0 L -16,-11 L -16,11 Z M 0,0 L 16,-11 L 16,11 Z',
    bangs: 'M -118,-8 C -124,-98 -64,-126 0,-126 C 64,-126 124,-98 118,-8 C 104,-36 86,-50 64,-48 C 52,-66 30,-70 14,-56 C 0,-72 -28,-72 -42,-52 C -62,-60 -98,-46 -118,-8 Z',
    cap: 'M -118,-10 C -126,-98 -60,-128 4,-126 C 70,-124 124,-94 118,-10 C 108,-40 96,-50 80,-52 L 70,-68 L 52,-50 C 30,-62 10,-66 -10,-56 L -26,-74 L -40,-52 C -70,-56 -100,-42 -118,-10 Z',
    cowlick: 'M -8,4 C -14,-24 10,-40 26,-30 C 10,-30 4,-18 6,4 Z',
    earsIn: 'M -116,9 Q -127,19 -115,29 M 116,9 Q 127,19 115,29',
    neck: 'M 182,276 L 218,276 L 218,336 L 182,336 Z',
    shirt: 'M 104,408 C 104,352 142,322 200,322 C 258,322 296,352 296,408 Z',
    collar: 'M 172,324 Q 200,350 228,324',
    wrinkle: 'M -9,24 Q 0,19 9,24 M -7,31 Q 0,27 7,31',
    blushLines: 'M -84,44 L -88,54 M -74,44 L -78,54 M -64,44 L -68,54 M 64,44 L 60,54 M 74,44 L 70,54 M 84,44 L 80,54',
    lash: 'M -20,-16 L -30,-24 M -23,-6 L -34,-10',
    heart: 'M 0,11 C -6,6 -13,2 -13,-5 C -13,-12 -3,-14 0,-7 C 3,-14 13,-12 13,-5 C 13,2 6,6 0,11 Z',
    star: 'M 0,-14 C 2,-3 3,-2 14,0 C 3,2 2,3 0,14 C -2,3 -3,2 -14,0 C -3,-2 -2,-3 0,-14 Z',
    drop: 'M 0,-10 C 5,-2 8,3 8,7 C 8,11.42 4.42,15 0,15 C -4.42,15 -8,11.42 -8,7 C -8,3 -5,-2 0,-10 Z',
    vein: 'M -13,-4 Q -4,-4 -4,-13 M 4,-13 Q 4,-4 13,-4 M 13,4 Q 4,4 4,13 M -4,13 Q -4,4 -13,4',
    puff: 'M -14,4 C -22,4 -22,-8 -12,-9 C -12,-20 4,-22 8,-12 C 18,-14 22,0 12,4 Z',
    bangBar: 'M -5,-30 L 5,-30 L 3,2 L -3,2 Z',
    lines: 'M -118,-116 L -134,-138 M -96,-128 L -102,-152 M -138,-96 L -158,-108',
    shiver: 'M 128,-6 L 140,-12 M 130,8 L 144,8 M -128,-6 L -140,-12 M -130,8 L -144,8',
    z: 'M -9,-10 L 9,-10 L -9,10 L 9,10',
    stink: 'M 0,0 C 6,-6 -6,-12 0,-18 C 6,-24 -6,-30 0,-36',
    question: 'M -10,-10 C -10,-22 10,-22 10,-10 C 10,-2 0,-1 0,8',
    cloud: 'M -26,10 C -38,10 -36,-8 -22,-6 C -20,-20 0,-24 6,-12 C 14,-22 32,-16 28,-2 C 40,0 38,12 26,10 Z',
    rain: 'M 0,0 L -3,8',
    scribble: 'M -22,0 C -18,-14 -8,-14 -10,0 C -12,12 0,12 2,0 C 4,-14 14,-14 12,0 C 10,12 22,12 24,0'
  };

  // ---------------------------------------------------------------- scene graph
  // group: {type, name, tr: {p, a, s (%), r (deg), o (0..100)}, children}; path: {type, name, paths, fill, stroke, sw}
  function G(name, tr, children) {
    tr = tr || {};
    return { type: 'group', name: name, children: children,
      tr: { p: tr.p || [0, 0], a: tr.a || [0, 0], s: tr.s || [100, 100], r: tr.r || 0, o: tr.o === undefined ? 100 : tr.o } };
  }
  function P(name, paths, style) {
    return { type: 'path', name: name, paths: paths, fill: style.fill || null, stroke: style.stroke || null, sw: style.sw || 0 };
  }
  function F(c) { return { fill: c }; }
  function St(c, w) { return { stroke: c, sw: w }; }
  function O(v) { return r2(clamp01(v) * 100); }
  function sc(v) { return [v * 100, v * 100]; }

  // Flush (angry), pale (scared) and ill (disgusted) tint every skin surface, lids included.
  function tintSkin(skin, p) {
    var c = skin;
    if (p.flush > 0) c = mix(c, '#FF5A48', clamp01(p.flush) * 0.3);
    if (p.pale > 0) c = mix(c, '#A9C3EE', clamp01(p.pale) * 0.35);
    if (p.ill > 0) c = mix(c, '#A6CF62', clamp01(p.ill) * 0.35);
    return c;
  }

  function colors(opt, girl) {
    var skin = opt.skin || '#F7C9A3';
    var hair = opt.hair || (girl ? '#5A3321' : '#2E1F18');
    var shirt = opt.shirt || (girl ? '#F2836B' : '#3F8F9A');
    return { skin: skin, shade: mix(skin, '#7A3B2A', 0.25), hair: hair, hairDark: mix(hair, '#000000', 0.35),
      iris: opt.iris || '#6B4226', shirt: shirt, shirtDark: mix(shirt, '#000000', 0.22) };
  }

  function eye(side, p, col, girl, lf, L) {
    var R = side === 'R', mx = R ? -1 : 1;
    var lidT = Math.max(R ? clamp01(p.lidT + p.lidDiff) : p.lidT, p.blink);
    var up = lidShape(-29 + lidT * 62, p.tilt, 3, true);
    var low = lidShape(29 - p.lidB * 58, 0, p.lowBulge, false);
    var closed = clamp01((lidT - 0.8) / 0.2);
    var ix = R ? -p.px : p.px;
    var cc = p.closedCurve, y0 = 8 - 2 * cc, qy = y0 + 13 * cc;
    var pulse = 1.1 * (1 + 0.12 * (0.5 + 0.5 * osc(lf, L, 6)));
    return G('eye' + side, { p: [R ? 46 : -46, 14], s: [mx * 100, 100] }, [
      P('sclera' + side, [ell(0, 0, 24, 29)], F('#FFFFFF')),
      G('look' + side, { p: [ix, p.py], o: O(1 - p.heartEyes) }, [
        P('iris' + side, [ell(0, 0, 17, 17)], F(col.iris)),
        G('pupil' + side, { s: sc(p.pupil) }, [P('pupilDot' + side, [ell(0, 0, 9, 9)], F('#1C1210'))]),
        G('shine' + side, { s: [mx * p.shine * 100, p.shine * 100] }, [P('highlight' + side, [ell(6, -8, 5.5, 5.5), ell(-5, 7, 2.6, 2.6)], F('#FFFFFF'))])
      ]),
      G('heart' + side, { p: [ix, p.py], s: sc(pulse), o: O(p.heartEyes) }, [P('heartShape' + side, sp(SH.heart), { fill: '#E8475F', stroke: '#A8243C', sw: 1.5 })]),
      P('lowLid' + side, [low.fill], F(col.skinNow)),
      G('lowLineG' + side, { o: O((p.lidB - 0.06) / 0.1) }, [P('lowLine' + side, [low.line], St(LINE, 2.5))]),
      P('upLid' + side, [up.fill], F(col.skinNow)),
      P('upLine' + side, [up.line], St(LINE, 4.5)),
      G('outlineG' + side, { o: O(1 - closed) }, [P('outline' + side, [ell(0, 0, 24, 29)], St(LINE, 3))]),
      G('lashG' + side, { o: girl ? O(1 - closed) : 0 }, [P('lash' + side, sp(SH.lash), St(LINE, 3))]),
      G('closedG' + side, { o: O(closed) }, [P('closed' + side, [quadPath(-22, y0, 0, qy, 22, y0)], St(LINE, 4))])
    ]);
  }

  // Build the full scene for one pose. opt: {kid: 'girl'|'boy', skin, hair, iris, shirt}.
  function scene(p, opt) {
    opt = opt || {};
    var girl = opt.kid !== 'boy';
    var col = colors(opt, girl);
    col.skinNow = tintSkin(col.skin, p);
    var lf = p._lf || 0, L = p._L || 90;

    // mouth: one 2-vertex closed path; teeth, tongue and grit reuse its corners so every pose morphs
    var w = p.mW, top = p.mTop, bot = Math.max(p.mBot, p.mTop + 0.5);
    var cl = -p.mC + p.mSkew, cr = -p.mC - p.mSkew;
    function lip(y1, y2) { return close(cub(B(-w / 2, cl), -w / 4, y1, w / 4, y1, w / 2, cr), w / 4, y2, -w / 4, y2); }
    var th = Math.min(p.teeth, bot - top);
    var tt = Math.max(top + th, bot - Math.min(p.tongue, bot - top) * 1.6);
    var tongue = close(cub(B(w / 2, cr), w / 4, bot, -w / 4, bot, -w / 2, cl), -w / 4, tt, w / 4, tt);
    var gm = (top + bot) / 2;

    function brow(side, raise) {
      var by = -44 + p.browY - raise, yi = by + p.browIn, yo = by - p.browIn * 0.3, cy = (yi + yo) / 2 - p.browArch;
      return quadPath(20 * side, yi, 45 * side, cy, 70 * side, yo);
    }

    var sway = -p.hr * 1.3 + osc(lf, L, 2) * 3 - p.hy * 0.4;
    var breath = osc(lf, L, 1) * 0.012;
    var scr = p.scrunch;
    var star = sp(SH.star), drop = sp(SH.drop), puff = sp(SH.puff), heart = sp(SH.heart);
    var sighQ = clamp01((lf - 0.7 * L) / (0.3 * L));

    var body = G('body', { p: [200, 404 + p.bodyY * 0.7 + p.hy * 0.2], a: [200, 404], r: p.hr * 0.25, s: [100, 100 * (1 + breath)] }, [
      P('neck', sp(SH.neck), F(mix(col.skinNow, '#7A3B2A', 0.25))),
      P('shirt', sp(SH.shirt), F(col.shirt)),
      P('collar', sp(SH.collar), St(col.shirtDark, 5))
    ]);

    var head = G('head', { p: [200 + p.hx, 300 + p.hy], a: [0, 100], r: p.hr, s: [p.sx * 100, p.sy * 100] }, [
      G('girlBack', { o: girl ? 100 : 0 }, [
        P('hairBackGirl', sp(SH.hairBackGirl), F(col.hair)),
        G('pigL', { p: [-114, -46], r: sway }, [
          P('pigtailL', sp(SH.pigtail), F(col.hair)),
          P('bowL', sp(SH.bow).concat([ell(0, 0, 5.5, 5.5)]), { fill: '#F25C78', stroke: '#B83553', sw: 2 })
        ]),
        G('pigR', { p: [114, -46], r: sway, s: [-100, 100] }, [
          P('pigtailR', sp(SH.pigtail), F(col.hair)),
          P('bowR', sp(SH.bow).concat([ell(0, 0, 5.5, 5.5)]), { fill: '#F25C78', stroke: '#B83553', sw: 2 })
        ])
      ]),
      G('boyBack', { o: girl ? 0 : 100 }, [P('hairBackBoy', sp(SH.hairBackBoy), F(col.hair))]),
      P('ears', [ell(-113, 18, 20, 20), ell(113, 18, 20, 20)], F(col.skinNow)),
      P('earsIn', sp(SH.earsIn), St(col.shade, 4)),
      P('face', [ell(0, 0, 116, 106)], F(col.skinNow)),
      G('cheeksG', { o: O(p.blush * 0.8) }, [P('cheeks', [ell(-74, 52, 18, 11), ell(74, 52, 18, 11)], F('#FF7A8A'))]),
      G('blushLinesG', { o: O(p.blushLines) }, [P('blushLinesShape', sp(SH.blushLines), St('#E0526A', 2.5))]),
      P('nose', [quadPath(-6, 41 - 3 * scr, 0, 48 - 5 * scr, 6, 41 - 3 * scr)], St(col.shade, 4)),
      G('wrinkleG', { o: O(scr) }, [P('wrinkle', sp(SH.wrinkle), St(col.shade, 3))]),
      G('mouth', { p: [p.mX, 72] }, [
        P('cavity', [lip(top, bot)], F('#8A2E3B')),
        G('tongueG', { o: O(p.tongue / 3) }, [P('tongue', [tongue], F('#EE7F87'))]),
        G('teethG', { o: O(th / 2.5) }, [P('teeth', [lip(top, top + th)], F('#FFFFFF'))]),
        G('gritG', { o: O(p.grit) }, [P('grit', [cub(B(-w / 2, cl), -w / 4, gm, w / 4, gm, w / 2, cr)], St(LINE, 2))]),
        P('lips', [lip(top, bot)], St(LINE, 3.5))
      ]),
      eye('L', p, col, girl, lf, L),
      eye('R', p, col, girl, lf, L),
      G('girlFront', { o: girl ? 100 : 0 }, [P('bangs', sp(SH.bangs), F(col.hair))]),
      G('boyFront', { o: girl ? 0 : 100 }, [
        P('cap', sp(SH.cap), F(col.hair)),
        G('cowlickG', { p: [6, -118], r: -p.hr * 1.6 + p.hy * 1.2 + osc(lf, L, 2) * 2 }, [P('cowlickShape', sp(SH.cowlick), F(col.hair))])
      ]),
      P('browL', [brow(-1, 0)], St(col.hairDark, 8)),
      P('browR', [brow(1, p.browAsym)], St(col.hairDark, 8)),

      G('fxSparkle', { o: O(p.sparkle) }, [[-150, -70, 0], [150, -92, 2.1], [146, 54, 4.2]].map(function (s, i) {
        return G('spark' + i, { p: [s[0], s[1]], r: 360 * lf / L, s: sc(0.55 + 0.45 * Math.abs(osc(lf, L, 2, s[2]))) },
          [P('sparkShape' + i, star, { fill: '#FFC23D', stroke: '#E0931A', sw: 1.5 })]);
      })),
      G('fxTear', { o: O(p.tear) }, [0, 1].map(function (i) {
        var q = phase(lf, L / 2, i * L / 4);
        return G('tear' + i, { p: [i ? 66 : -66, 38 + q * 72], s: sc(0.6 + 0.5 * Math.min(1, q * 4)), o: O(Math.min(1, q * 10) * (1 - q * q * q)) },
          [P('tearShape' + i, drop, { fill: '#7CC4F2', stroke: '#3F8DC0', sw: 1.5 })]);
      })),
      G('fxVein', { o: O(p.vein) }, [G('veinG', { p: [74, -84], s: sc(1 + 0.18 * Math.abs(osc(lf, L, 4))) }, [P('veinShape', sp(SH.vein), St('#E0322A', 4.5))])]),
      G('fxSteam', { o: O(p.steam) }, [0, 1].map(function (i) {
        var q = phase(lf, L / 2, i * L / 4), side = i ? 1 : -1;
        return G('puff' + i, { p: [side * (100 + q * 14), -92 - q * 44], s: sc(0.5 + q * 0.8), o: O(Math.sin(q * Math.PI)) },
          [P('puffShape' + i, puff, { fill: '#FFFFFF', stroke: '#B9ADA3', sw: 2.5 })]);
      })),
      G('fxBang', { o: O(p.bang) }, [G('bangMark', { p: [136, -104], r: 14, s: sc(Math.max(0.01, kf([[0, 0], [6, 1.25], [10, 1], [L, 1]], lf))) },
        [P('bangShape', sp(SH.bangBar).concat([ell(0, 13, 5.5, 5.5)]), F('#E2553A'))])]),
      G('fxLines', { o: O(p.lines) }, [G('linesG', { s: sc(1 + 0.06 * osc(lf, L, 4)) }, [P('linesShape', sp(SH.lines), St('#E2553A', 5))])]),
      G('fxSweat', { o: O(p.sweat) }, [(function () {
        var q = phase(lf, L);
        return G('sweatDrop', { p: [106, -44 + q * 26], s: sc(1.1 * (1 - 0.4 * Math.pow(q, 4))), o: O(Math.min(1, q * 10) * (1 - Math.pow(q, 6))) },
          [P('sweatShape', drop, { fill: '#9BD3F5', stroke: '#3F8DC0', sw: 2 })]);
      })()]),
      G('fxShiver', { o: O(p.shiver * (0.5 + 0.5 * Math.abs(osc(lf, L, 12)))) }, [P('shiverShape', sp(SH.shiver), St('#6E7FB8', 3.5))]),
      G('fxZzz', { o: O(p.zzz) }, [0, 1, 2].map(function (i) {
        var q = phase(lf, L, i * L / 3);
        return G('z' + i, { p: [84 + q * 56, -92 - q * 64], s: sc(0.6 + 0.7 * q), o: O(Math.sin(q * Math.PI)) }, [P('zShape' + i, sp(SH.z), St('#56679A', 4.5))]);
      })),
      G('fxBubble', { o: O(p.bubble * 4) }, [G('bubbleG', { p: [16, 46], s: sc((2 + 16 * p.bubble) / 10) },
        [P('bubbleShape', [ell(0, 0, 10, 10)], { fill: '#D6F0FF', stroke: '#7FBFE6', sw: 2 })])]),
      G('fxStink', { o: O(p.stink) }, [0, 1, 2].map(function (i) {
        var q = phase(lf, L, i * L / 3);
        return G('stink' + i, { p: [138 + i * 13, 34 - q * 50], o: O(Math.sin(q * Math.PI)) }, [P('stinkShape' + i, sp(SH.stink), St('#7FA046', 3.5))]);
      })),
      G('fxGlint', { o: O(p.glint) }, [G('glintStar', { p: [118, -104], r: 90 * lf / L, s: sc(Math.max(0.01, p.glint)) },
        [P('glintShape', star, { fill: '#FFE27A', stroke: '#E0A21A', sw: 1.5 })])]),
      G('fxQuestion', { o: O(p.question) }, [G('questionMark', { p: [128, -104 + 4 * osc(lf, L, 2)], r: 10 + 6 * osc(lf, L, 1) }, [
        P('questionHook', sp(SH.question), St('#6A5ACD', 6)),
        P('questionDot', [ell(0, 18, 4, 4)], F('#6A5ACD'))
      ])]),
      G('fxHearts', { o: O(p.hearts) }, [-128, 128, -100].map(function (x, i) {
        var q = phase(lf, L, i * L / 3);
        return G('heartFloat' + i, { p: [x + 6 * osc(lf, L, 2, i), -30 - q * 90], s: sc(0.7 + 0.5 * q), o: O(Math.sin(q * Math.PI)) },
          [P('heartFloatShape' + i, heart, F('#F0506E'))]);
      })),
      G('fxCloud', { o: O(p.cloud) }, [G('cloudG', { p: [-8, -170 + 3 * osc(lf, L, 2)] }, [0, 1, 2].map(function (i) {
        var q = phase(lf, L / 4, i * L / 12);
        return G('rain' + i, { p: [-14 + i * 14, 12 + q * 30], o: O(1 - q) }, [P('rainShape' + i, sp(SH.rain), St('#7CA6D8', 3))]);
      }).concat([P('cloudShape', sp(SH.cloud), { fill: '#C9CFDB', stroke: '#8B94A8', sw: 2.5 })]))]),
      G('fxSigh', { o: O(p.sigh) }, [G('sighPuff', { p: [46 + 34 * sighQ, 80 - 18 * sighQ], s: sc(0.45 + 0.55 * sighQ) },
        [P('sighShape', puff, { fill: '#FFFFFF', stroke: '#B9ADA3', sw: 2.5 })])]),
      G('fxScribble', { o: O(p.scribble) }, [G('scribbleG', { p: [-110, -116], r: 8 * osc(lf, L, 3), s: sc(0.9 + 0.1 * Math.abs(osc(lf, L, 6))) },
        [P('scribbleShape', sp(SH.scribble), St('#4A4A5A', 3.5))])])
    ]);

    return [body, head];
  }

  // ---------------------------------------------------------------- SVG output
  function pt(v) { return r2(v[0]) + ',' + r2(v[1]); }
  function pathD(paths) {
    return paths.map(function (b) {
      var s = 'M ' + pt(b.v[0]);
      for (var j = 1; j < b.v.length; j++) s += ' C ' + pt(b.o[j - 1]) + ' ' + pt(b.i[j]) + ' ' + pt(b.v[j]);
      if (b.c) s += ' C ' + pt(b.o[b.v.length - 1]) + ' ' + pt(b.i[0]) + ' ' + pt(b.v[0]) + ' Z';
      return s;
    }).join(' ');
  }
  function transform(tr) {
    return 'translate(' + r2(tr.p[0]) + ' ' + r2(tr.p[1]) + ') rotate(' + r2(tr.r) + ') scale(' + r2(tr.s[0] / 100) + ' ' + r2(tr.s[1] / 100) +
      ') translate(' + r2(-tr.a[0]) + ' ' + r2(-tr.a[1]) + ')';
  }
  // name -> {t, o} for groups and {d, fill, stroke, sw} for paths (used by the design canvas markup).
  function flatten(nodes, out) {
    out = out || {};
    nodes.forEach(function (n) {
      if (n.type === 'group') { out[n.name] = { t: transform(n.tr), o: r2(n.tr.o / 100) }; flatten(n.children, out); }
      else out[n.name] = { d: pathD(n.paths), fill: n.fill || 'none', stroke: n.stroke || 'none', sw: n.sw || 0 };
    });
    return out;
  }
  function toSVG(nodes, opt) {
    opt = opt || {};
    function node(n) {
      if (n.type === 'group') {
        if (n.tr.o <= 0) return '';
        return '<g transform="' + transform(n.tr) + '"' + (n.tr.o < 100 ? ' opacity="' + r2(n.tr.o / 100) + '"' : '') + '>' + n.children.map(node).join('') + '</g>';
      }
      return '<path d="' + pathD(n.paths) + '" fill="' + (n.fill || 'none') + '"' +
        (n.stroke ? ' stroke="' + n.stroke + '" stroke-width="' + n.sw + '" stroke-linecap="round" stroke-linejoin="round"' : '') + '/>';
    }
    var inner = nodes.map(node).join('');
    if (opt.inner) return inner;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="' + (opt.size || 400) + '" height="' + (opt.size || 400) + '">' + inner + '</svg>';
  }

  return {
    FPS: FPS, BASE: BASE, EMOTIONS: EMOTIONS, byId: byId, timeline: timeline,
    pose: pose, blend: blend, Animator: Animator, scene: scene,
    flatten: flatten, toSVG: toSVG, pathD: pathD, transform: transform,
    util: { kf: kf, osc: osc, phase: phase, ease: ease, mix: mix, sp: sp, ell: ell, lidShape: lidShape }
  };
})();
