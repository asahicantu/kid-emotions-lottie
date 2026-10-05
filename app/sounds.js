/*
 * Cartoon sound effects, synthesised with the Web Audio API (no audio files).
 * Sounds.play('happy') plays the effect for one feeling. Call Sounds.unlock()
 * from a tap first: browsers only start audio after a user gesture.
 */
var Sounds = (function () {
  'use strict';

  var ctx = null, master = null, noiseBuf = null;

  function unlock() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      var comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function stopAll() {
    if (!ctx) return;
    master.disconnect();
    master = ctx.createGain();
    master.gain.value = 0.55;
    var comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
  }

  // One oscillator with a pitch glide, optional vibrato and lowpass sweep.
  function tone(o) {
    var t0 = ctx.currentTime + 0.03 + (o.t || 0);
    var dur = o.dur || 0.3, vol = o.vol || 0.25, atk = o.attack || 0.012;
    var rel = o.release || Math.min(0.12, dur * 0.4);
    var osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.to) {
      if (o.linear) osc.frequency.linearRampToValueAtTime(o.to, t0 + dur);
      else osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    }
    if (o.vib) {
      var lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = o.vibRate || 6;
      depth.gain.value = o.vib;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + atk);
    g.gain.setValueAtTime(vol, t0 + Math.max(atk, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    var node = osc;
    if (o.lp) {
      var bq = ctx.createBiquadFilter();
      bq.type = 'lowpass';
      bq.frequency.setValueAtTime(o.lp, t0);
      if (o.lpTo) bq.frequency.exponentialRampToValueAtTime(o.lpTo, t0 + dur);
      bq.Q.value = o.q || 1;
      osc.connect(bq);
      node = bq;
    }
    node.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // Filtered white noise: breaths, sighs, rasps, clicks.
  function noise(o) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var t0 = ctx.currentTime + 0.03 + (o.t || 0);
    var dur = o.dur || 0.3, vol = o.vol || 0.2;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var bq = ctx.createBiquadFilter();
    bq.type = o.kind || 'bandpass';
    bq.frequency.setValueAtTime(o.f || 1000, t0);
    if (o.to) bq.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    bq.Q.value = o.q || 1;
    var g = ctx.createGain();
    var atk = o.attack || 0.01;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bq);
    bq.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  function thump(t, vol) { tone({ t: t, dur: 0.16, f: 110, to: 45, vol: vol || 0.5, type: 'sine' }); }

  var NOTE = { C5: 523, D5: 587, E5: 659, G5: 784, A5: 880, B5: 988, C6: 1047, D6: 1175, E6: 1319, G6: 1568 };

  var RECIPES = {
    // "hee-hee-hee" giggle
    happy: function () {
      for (var i = 0; i < 5; i++) tone({ t: i * 0.11, dur: 0.09, type: 'triangle', f: 900 - i * 40, to: 1350 - i * 60, vol: 0.28 });
      tone({ t: 0.6, dur: 0.25, f: 1600, to: 2400, vol: 0.12 });
    },
    // sad trombone: wah, wah, wah, waaah
    sad: function () {
      [392, 370, 349].forEach(function (f, i) { tone({ t: i * 0.38, dur: 0.34, type: 'sawtooth', f: f, to: f * 0.97, lp: 900, vol: 0.22 }); });
      tone({ t: 1.14, dur: 1.1, type: 'sawtooth', f: 330, to: 300, lp: 900, lpTo: 500, vib: 9, vibRate: 5, vol: 0.24 });
    },
    // growl, then two stomps
    angry: function () {
      tone({ dur: 0.8, type: 'sawtooth', f: 95, to: 70, vib: 25, vibRate: 32, lp: 700, vol: 0.4 });
      noise({ dur: 0.8, f: 300, q: 2, vol: 0.18 });
      thump(0.9, 0.6);
      thump(1.15, 0.6);
    },
    // trembly "eeeek" and chattering teeth
    scared: function () {
      tone({ dur: 0.7, f: 1150, to: 1650, vib: 90, vibRate: 15, vol: 0.2 });
      for (var i = 0; i < 7; i++) noise({ t: 0.8 + i * 0.07, dur: 0.035, f: 3200, q: 4, vol: 0.35 });
    },
    // slide whistle up, then a boing
    surprised: function () {
      tone({ dur: 0.45, f: 400, to: 1900, linear: true, vib: 18, vibRate: 9, vol: 0.22 });
      tone({ t: 0.5, dur: 0.6, type: 'triangle', f: 180, to: 260, vib: 70, vibRate: 16, vol: 0.35 });
    },
    // raspberry "blehh" and a little "ew"
    disgusted: function () {
      tone({ dur: 0.75, type: 'sawtooth', f: 115, to: 95, vib: 45, vibRate: 38, lp: 1400, vol: 0.32 });
      noise({ dur: 0.7, f: 450, q: 1.5, vol: 0.12 });
      tone({ t: 0.85, dur: 0.35, f: 750, to: 480, vol: 0.18 });
    },
    // soft wind chimes over a breeze
    calm: function () {
      noise({ dur: 1.8, f: 400, to: 1200, q: 0.8, vol: 0.06, attack: 0.6 });
      [NOTE.C6, NOTE.E6, NOTE.G6, NOTE.E6].forEach(function (f, i) { tone({ t: 0.15 + i * 0.3, dur: 1.2, f: f, vol: 0.12, release: 1 }); });
    },
    // boing-boing-boing up, then "woo-hoo!"
    excited: function () {
      for (var i = 0; i < 6; i++) { var f = 380 * Math.pow(1.2, i); tone({ t: i * 0.08, dur: 0.1, type: 'triangle', f: f, to: f * 2, vol: 0.22 }); }
      tone({ t: 0.55, dur: 0.25, f: 600, to: 1300, vol: 0.2 });
      tone({ t: 0.82, dur: 0.35, f: 1300, to: 800, vol: 0.2 });
    },
    // a long yawn and one snore
    tired: function () {
      tone({ dur: 1.3, type: 'sawtooth', f: 520, to: 170, lp: 2200, lpTo: 350, vib: 4, vibRate: 4, vol: 0.22, attack: 0.15, release: 0.4 });
      noise({ t: 1.45, dur: 0.6, kind: 'lowpass', f: 380, q: 3, vol: 0.25, attack: 0.25 });
    },
    // ta-da fanfare
    proud: function () {
      [[NOTE.C5, 0, 0.13], [NOTE.E5, 0.14, 0.13], [NOTE.G5, 0.28, 0.13]].forEach(function (n) {
        tone({ t: n[1], dur: n[2], type: 'square', f: n[0], lp: 2400, vol: 0.12 });
      });
      tone({ t: 0.44, dur: 0.9, type: 'square', f: NOTE.C6, lp: 2400, vib: 10, vibRate: 6, vol: 0.13, release: 0.4 });
    },
    // "eep!" squeak and a shy "oops"
    embarrassed: function () {
      tone({ dur: 0.12, f: 1500, to: 2300, vol: 0.2 });
      tone({ t: 0.25, dur: 0.3, type: 'triangle', f: 820, to: 520, vol: 0.2 });
      tone({ t: 0.6, dur: 0.3, type: 'triangle', f: 700, to: 430, vol: 0.14 });
    },
    // "huh?" wobble, ending on a question
    confused: function () {
      tone({ dur: 0.28, type: 'triangle', f: 300, to: 480, vol: 0.25 });
      tone({ t: 0.3, dur: 0.6, f: 480, vib: 60, vibRate: 5, vol: 0.2 });
      tone({ t: 0.95, dur: 0.3, f: 420, to: 950, vol: 0.2 });
    },
    // "hmph!" grumble
    jealous: function () {
      tone({ dur: 0.25, type: 'sawtooth', f: 330, to: 300, lp: 1000, vol: 0.22 });
      tone({ t: 0.3, dur: 0.5, type: 'sawtooth', f: 260, to: 210, lp: 900, vib: 12, vibRate: 18, vol: 0.24 });
      noise({ t: 0.3, dur: 0.35, f: 900, q: 1, vol: 0.08 });
    },
    // harp glissando up
    grateful: function () {
      [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.C6, NOTE.D6, NOTE.E6].forEach(function (f, i) {
        tone({ t: i * 0.065, dur: 0.9, type: 'triangle', f: f, vol: 0.13, release: 0.7 });
      });
    },
    // a slow falling whistle that echoes
    lonely: function () {
      [0, 0.45, 0.9].forEach(function (t, i) {
        tone({ t: t, dur: 0.9, f: 900, to: 600, vib: 5, vibRate: 4, vol: 0.18 / (i + 1), release: 0.4 });
      });
    },
    // rising twinkle with sparkles on top
    hopeful: function () {
      [NOTE.G5, NOTE.A5, NOTE.B5, NOTE.D6].forEach(function (f, i) { tone({ t: i * 0.13, dur: 0.25, f: f, vol: 0.16 }); });
      tone({ t: 0.52, dur: 0.8, f: NOTE.G6, vib: 12, vibRate: 7, vol: 0.14, release: 0.5 });
      for (var i = 0; i < 4; i++) tone({ t: 0.6 + i * 0.09, dur: 0.06, f: 2600 + i * 300, vol: 0.06 });
    },
    // gulp, a wobble and a fast heartbeat
    nervous: function () {
      tone({ dur: 0.12, f: 320, to: 150, vol: 0.3 });
      tone({ t: 0.14, dur: 0.12, f: 520, to: 260, vol: 0.25 });
      tone({ t: 0.35, dur: 0.7, type: 'triangle', f: 440, vib: 30, vibRate: 13, vol: 0.12 });
      [1.1, 1.25, 1.5, 1.65].forEach(function (t) { thump(t, 0.45); });
    },
    // flat "meh" and a long sigh
    bored: function () {
      tone({ dur: 0.9, type: 'sawtooth', f: 150, to: 140, lp: 520, vol: 0.28, release: 0.3 });
      noise({ t: 0.95, dur: 0.9, f: 1300, to: 450, q: 1.2, vol: 0.14, attack: 0.15 });
    },
    // "hmm?" then two little boops
    curious: function () {
      tone({ dur: 0.45, type: 'triangle', f: 220, vib: 4, vibRate: 5, vol: 0.28 });
      tone({ t: 0.48, dur: 0.22, f: 300, to: 620, vol: 0.2 });
      tone({ t: 0.85, dur: 0.1, f: 900, vol: 0.14 });
      tone({ t: 1.0, dur: 0.1, f: 1200, vol: 0.14 });
    },
    // heartbeat, "awww", and bubbly pops
    loving: function () {
      thump(0, 0.5); thump(0.16, 0.4); thump(0.6, 0.5); thump(0.76, 0.4);
      tone({ t: 1.0, dur: 0.85, f: 720, to: 520, vib: 6, vibRate: 5, vol: 0.18, release: 0.4 });
      for (var i = 0; i < 3; i++) tone({ t: 1.15 + i * 0.16, dur: 0.08, f: 900, to: 1700, vol: 0.1 });
    }
  };

  function play(id) {
    if (!unlock() || !RECIPES[id]) return;
    stopAll();
    RECIPES[id]();
  }

  return { unlock: unlock, play: play, stop: stopAll, has: function (id) { return !!RECIPES[id]; } };
})();
