/*
 * Feelings Friends: tap a feeling, the kid acts it out (Lottie), a voice says
 * its name, then a cartoon sound plays. The voice is the child's own recording
 * when there is one, otherwise the browser's text to speech.
 * Routes: #/ (all feelings), #/<id> (one feeling).
 */
(function () {
  'use strict';

  var LOTTIE_PATH = '../dist/emotions/{kid}/{id}.json';
  var MAX_RECORDING_MS = 6000;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var list = KidRig.EMOTIONS.filter(function (e) { return EMOJI[e.id]; }).map(function (e) {
    return { id: e.id, ring: e.ring, bg: e.bg, poster: e.poster, emoji: EMOJI[e.id] };
  });
  var byId = {};
  list.forEach(function (f) { byId[f.id] = f; });
  var langByCode = {};
  LANGS.forEach(function (l) { langByCode[l.code] = l; });

  var $ = function (id) { return document.getElementById(id); };
  var home = $('home'), stage = $('stage'), kidEl = $('kid');

  // ---------------------------------------------------------------- settings
  function load(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* private mode */ } }

  var settings = {
    kid: load('ff.kid', 'girl'),
    sound: load('ff.sound', 'on') === 'on',
    lang: langByCode[load('ff.lang', '')] ? load('ff.lang', '') : guessLang()
  };

  function guessLang() {
    var prefs = navigator.languages || [navigator.language || 'en'];
    for (var i = 0; i < prefs.length; i++) {
      var hit = LANGS.find(function (l) { return l.voice.test(prefs[i]); });
      if (hit) return hit.code;
    }
    return 'en';
  }

  // ---------------------------------------------------------------- words
  function ui(key, x) { return (UI[settings.lang][key] || UI.en[key]).replace('{x}', x || ''); }

  // The words for one feeling in the current language and for the current kid.
  function words(id) {
    var w = FEELINGS[settings.lang][id], end = settings.kid === 'girl' ? 'a' : 'o';
    var g = function (s) { return s.replace(/@/g, end); };
    return { label: g(w.label), say: g(w.say), text: w.text, tryIt: w.tryIt };
  }

  function translatePage() {
    document.documentElement.lang = settings.lang;
    document.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = ui(el.dataset.t); });
    document.querySelectorAll('[data-t-html]').forEach(function (el) { el.innerHTML = ui(el.dataset.tHtml); });
    document.querySelectorAll('[data-t-label]').forEach(function (el) { el.setAttribute('aria-label', ui(el.dataset.tLabel)); });
    $('lang-short').textContent = langByCode[settings.lang].short;
    $('lang-cycle').setAttribute('aria-label', ui('language') + ': ' + langByCode[settings.lang].name);
  }

  function syncControls() {
    document.querySelectorAll('.kid-switch button').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.kid === settings.kid));
    });
    document.querySelectorAll('.lang-switch button').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.lang === settings.lang));
    });
    document.querySelectorAll('.sound-toggle').forEach(function (b) {
      b.setAttribute('aria-pressed', String(settings.sound));
      b.setAttribute('aria-label', settings.sound ? ui('soundOn') : ui('soundOff'));
      b.firstElementChild.textContent = settings.sound ? '🔊' : '🔇';
    });
  }

  // ---------------------------------------------------------------- voice
  var synth = window.speechSynthesis || null;
  var voices = {};          // lang code -> SpeechSynthesisVoice (or null when the device has none)
  var voicesLoaded = false;

  function pickVoices() {
    var all = synth.getVoices();
    voicesLoaded = all.length > 0;
    LANGS.forEach(function (l) {
      var mine = all.filter(function (v) { return l.voice.test(v.lang); });
      var friendly = /aria|jenny|ana|samantha|karen|google|zira|libby|sonia|natural|neural|paulina|monica|elvira|dalia|nora|pernille|iselin|finn/i;
      voices[l.code] = mine.find(function (v) { return friendly.test(v.name); }) || mine.find(function (v) { return v.localService; }) || mine[0] || null;
    });
    syncNote();
  }
  if (synth) { pickVoices(); synth.addEventListener('voiceschanged', pickVoices); }

  // True when text to speech can speak the current language on this device.
  function canSpeak() {
    if (!synth) return false;
    return !voicesLoaded || !!voices[settings.lang];  // voices not listed yet: let the browser try
  }

  var playToken = 0;
  var clip = null;          // <audio> playing a recording

  function stopAudio() {
    playToken++;
    if (synth) synth.cancel();
    if (clip) { clip.pause(); clip = null; }
    Sounds.stop();
  }

  // Run done once, after onend or a time limit (some browsers never fire onend).
  function once(done, ms) {
    var fired = false, timer = setTimeout(fire, ms);
    function fire() { if (fired) return; fired = true; clearTimeout(timer); if (done) done(); }
    return fire;
  }

  function speak(text, done) {
    var finish = once(done, 900 + text.length * 110);
    if (!canSpeak()) { finish(); return; }
    var u = new SpeechSynthesisUtterance(text);
    var v = voices[settings.lang];
    if (v) u.voice = v;
    u.lang = v ? v.lang : langByCode[settings.lang].tts;
    u.pitch = 1.35;
    u.rate = 0.88;
    u.onend = finish;
    u.onerror = finish;
    synth.speak(u);
  }

  function playClip(blob, done) {
    var url = URL.createObjectURL(blob);
    var finish = once(function () { URL.revokeObjectURL(url); if (done) done(); }, MAX_RECORDING_MS + 1500);
    clip = new Audio(url);
    clip.onended = finish;
    clip.onerror = finish;
    clip.play().catch(finish);
  }

  // Name first (own recording or text to speech), then the silly sound.
  function announce(id) {
    stopAudio();
    if (!settings.sound) return;
    Sounds.unlock();
    var token = playToken;
    var after = function () { if (token === playToken && settings.sound) Sounds.play(id); };
    var mine = myVoices.get(voiceKey(id));
    if (mine) playClip(mine, after);
    else speak(words(id).say, after);
  }

  function readAloud(id) {
    stopAudio();
    if (!settings.sound) return;
    var w = words(id);
    speak(w.label + '. ' + w.text + ' ' + ui('tryIt') + ' ' + w.tryIt);
  }

  // ---------------------------------------------------------------- own recordings
  var myVoices = new Map();  // "<lang>/<id>" -> Blob, mirrors the local database
  var rec = null;            // the recording in progress

  function voiceKey(id) { return settings.lang + '/' + id; }

  function showNote(text) {
    var n = $('note');
    n.textContent = text || '';
    n.hidden = !text;
  }
  function syncNote() {
    if (!myVoices || stage.hidden || rec) return;
    showNote(synth && voicesLoaded && !voices[settings.lang] && !myVoices.has(voiceKey(currentId)) ? ui('noVoice') : '');
  }

  function syncRecUI() {
    var recording = !!rec;
    $('rec').setAttribute('aria-pressed', String(recording));
    $('rec-text').textContent = recording ? ui('stop') : ui('record');
    $('rec-delete').hidden = recording || !currentId || !myVoices.has(voiceKey(currentId));
    stickers.querySelectorAll('.sticker').forEach(function (b) {
      var has = myVoices.has(voiceKey(b.dataset.id));
      var mark = b.querySelector('.mine');
      if (has && !mark) {
        mark = document.createElement('span');
        mark.className = 'mine';
        b.appendChild(mark);
      } else if (!has && mark) mark.remove();
      if (mark) mark.innerHTML = '<span aria-hidden="true">🎙️</span><span class="sr-only">' + ui('hasVoice') + '</span>';
    });
    syncNote();
  }

  function startRecording() {
    stopAudio();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { showNote(ui('noMic')); return; }
    var key = voiceKey(currentId), id = currentId;
    rec = { pending: true };
    syncRecUI();
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function (stream) {
      if (!rec || !rec.pending) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      var chunks = [];
      var mr = new MediaRecorder(stream);
      mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        var blob = new Blob(chunks, { type: mr.mimeType || (chunks[0] && chunks[0].type) || 'audio/webm' });
        if (blob.size < 800) return;  // a tap with no sound
        myVoices.set(key, blob);
        Voices.put(key, blob);
        syncRecUI();
        if (id === currentId && settings.sound) playClip(blob);
      };
      mr.start();
      rec = { mr: mr, timer: setTimeout(stopRecording, MAX_RECORDING_MS) };
      showNote('');
      syncRecUI();
    }).catch(function () {
      rec = null;
      syncRecUI();
      showNote(ui('micBlocked'));
    });
  }

  function stopRecording() {
    if (!rec) return;
    var r = rec;
    rec = null;
    if (r.timer) clearTimeout(r.timer);
    if (r.mr && r.mr.state !== 'inactive') r.mr.stop();
    syncRecUI();
  }

  function deleteRecording() {
    var key = voiceKey(currentId);
    if (!window.confirm(ui('confirmRemove', words(currentId).label))) return;
    stopAudio();
    myVoices.delete(key);
    Voices.remove(key);
    syncRecUI();
    $('rec').focus();
  }

  $('rec').addEventListener('click', function () {
    if (rec) stopRecording(); else startRecording();
  });
  $('rec-delete').addEventListener('click', deleteRecording);

  // ---------------------------------------------------------------- stickers
  var stickers = $('stickers');
  function renderStickers() {
    stickers.innerHTML = '';
    list.forEach(function (f) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sticker';
      b.dataset.id = f.id;
      b.style.setProperty('--tile-bg', f.bg);
      b.style.setProperty('--tile-ring', f.ring);
      var emoji = document.createElement('span');
      emoji.className = 'emoji';
      emoji.setAttribute('aria-hidden', 'true');
      emoji.textContent = f.emoji;
      var label = document.createElement('span');
      label.className = 'label';
      label.textContent = words(f.id).label;
      b.append(emoji, label);
      li.appendChild(b);
      stickers.appendChild(li);
    });
    syncRecUI();
  }

  stickers.addEventListener('click', function (e) {
    var b = e.target.closest('.sticker');
    if (!b) return;
    var r = b.getBoundingClientRect();
    open(b.dataset.id, { x: r.left + r.width / 2, y: r.top + r.height / 2, push: true, sound: true });
  });

  $('surprise').addEventListener('click', function (e) {
    var pool = list.filter(function (f) { return f.id !== currentId; });
    var f = pool[Math.floor(Math.random() * pool.length)];
    var r = e.currentTarget.getBoundingClientRect();
    open(f.id, { x: r.left + r.width / 2, y: r.top + r.height / 2, push: true, sound: true });
  });

  // ---------------------------------------------------------------- stage
  var player = null;
  var currentId = null;
  var openerId = null;

  function loadKid(f) {
    if (player) { player.destroy(); player = null; }
    $('kid-error').hidden = true;
    if (!window.lottie) { $('kid-error').hidden = false; return; }
    var still = reduceMotion.matches;
    player = lottie.loadAnimation({
      container: kidEl,
      renderer: 'svg',
      loop: true,
      autoplay: !still,
      path: LOTTIE_PATH.replace('{kid}', settings.kid).replace('{id}', f.id),
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet' }
    });
    player.addEventListener('data_failed', function () { $('kid-error').hidden = false; });
    if (still) player.addEventListener('DOMLoaded', function () { player.goToAndStop(f.poster, true); });
  }

  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  // Put a feeling's words on the stage (also used when the language changes).
  function fillWords(f, animate) {
    var w = words(f.id);
    var name = $('feel-name');
    name.setAttribute('aria-label', w.label);
    name.innerHTML = '';
    Array.from(w.label).forEach(function (ch, i) {
      var s = document.createElement('span');
      s.className = 'ch';
      s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--i', i);
      s.textContent = ch === ' ' ? ' ' : ch;
      name.appendChild(s);
    });
    $('feel-text').textContent = w.text;
    $('feel-try').textContent = w.tryIt;
    kidEl.setAttribute('aria-label', ui('kidFeeling', w.label.toLowerCase()));
    $('announce').textContent = w.label;
    if (animate) restart(name, 'hop');
  }

  function fill(f) {
    stage.style.setProperty('--bg', f.bg);
    stage.style.setProperty('--ring', f.ring);
    document.querySelector('meta[name="theme-color"]').content = f.bg;
    $('badge').textContent = f.emoji;
    fillWords(f, true);
    restart(kidEl, 'pop');
    restart($('badge'), 'pop');
    loadKid(f);
    syncRecUI();
  }

  function wipe(el, x, y, reverse) {
    if (reduceMotion.matches || !el.animate) return null;
    var r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    var frames = [{ clipPath: 'circle(0px at ' + x + 'px ' + y + 'px)' }, { clipPath: 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)' }];
    if (reverse) frames.reverse();
    return el.animate(frames, { duration: reverse ? 380 : 560, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  function open(id, opt) {
    var f = byId[id];
    if (!f) { close({ push: false }); return; }
    opt = opt || {};
    stopRecording();
    if (opt.push) history.pushState({ id: id }, '', '#/' + id);
    else if (opt.replace) history.replaceState({ id: id }, '', '#/' + id);

    var wasOpen = !stage.hidden;
    currentId = id;
    if (!wasOpen) openerId = id;
    showNote('');
    if (!wasOpen) {
      stage.hidden = false;
      home.inert = true;
      document.body.classList.add('stage-open');
      wipe(stage, opt.x != null ? opt.x : innerWidth / 2, opt.y != null ? opt.y : innerHeight / 2);
      $('back').focus({ preventScroll: true });
    }
    fill(f);
    if (opt.sound) announce(id);
  }

  function close(opt) {
    opt = opt || {};
    stopRecording();
    stopAudio();
    if (opt.push) history.pushState(null, '', location.pathname + location.search);
    if (stage.hidden) return;
    var tile = stickers.querySelector('[data-id="' + (openerId || currentId) + '"]');
    var r = tile ? tile.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    home.inert = false;
    document.body.classList.remove('stage-open');
    document.querySelector('meta[name="theme-color"]').content = '#CFE6FB';
    var done = function () {
      stage.hidden = true;
      if (player) { player.destroy(); player = null; }
      currentId = null;
    };
    var anim = wipe(stage, r.left + r.width / 2, r.top + r.height / 2, true);
    if (anim) anim.onfinish = done; else done();
    if (tile) tile.focus({ preventScroll: true });
  }

  function step(dir) {
    var i = list.findIndex(function (f) { return f.id === currentId; });
    var next = list[(i + dir + list.length) % list.length];
    openerId = next.id;
    open(next.id, { replace: true, sound: true });
  }

  $('back').addEventListener('click', function () {
    if (history.state && history.state.id) history.back();
    else close({ push: true });
  });
  $('prev').addEventListener('click', function () { step(-1); });
  $('next').addEventListener('click', function () { step(1); });
  $('again').addEventListener('click', function () {
    stopRecording();
    restart($('feel-name'), 'hop');
    announce(currentId);
  });
  $('read').addEventListener('click', function () { stopRecording(); readAloud(currentId); });

  // ---------------------------------------------------------------- controls
  function setLang(code, speakIt) {
    if (!langByCode[code]) return;
    stopRecording();
    settings.lang = code;
    save('ff.lang', code);
    translatePage();
    syncControls();
    renderStickers();
    if (currentId && !stage.hidden) {
      showNote('');
      fillWords(byId[currentId], true);
      syncRecUI();
      if (speakIt) announce(currentId);
    }
  }

  var langSwitch = $('lang-switch');
  LANGS.forEach(function (l) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('lang', l.code);
    b.dataset.lang = l.code;
    b.textContent = l.code === 'nb' ? 'Norsk' : l.name;
    b.title = l.name;
    b.addEventListener('click', function () { setLang(l.code, false); });
    langSwitch.appendChild(b);
  });

  $('lang-cycle').addEventListener('click', function () {
    var i = LANGS.findIndex(function (l) { return l.code === settings.lang; });
    setLang(LANGS[(i + 1) % LANGS.length].code, true);
  });

  document.querySelectorAll('.kid-switch button').forEach(function (b) {
    b.addEventListener('click', function () {
      settings.kid = b.dataset.kid;
      save('ff.kid', settings.kid);
      syncControls();
      renderStickers();  // Spanish names change with the kid (Enojado / Enojada)
    });
  });
  document.querySelectorAll('.sound-toggle').forEach(function (b) {
    b.addEventListener('click', function () {
      settings.sound = !settings.sound;
      save('ff.sound', settings.sound ? 'on' : 'off');
      if (!settings.sound) stopAudio();
      syncControls();
    });
  });

  document.addEventListener('keydown', function (e) {
    if (stage.hidden || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape') { e.preventDefault(); $('back').click(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });

  // ---------------------------------------------------------------- routing
  function idFromHash() { return decodeURIComponent(location.hash.replace(/^#\/?/, '')); }
  function route() {
    var id = idFromHash();
    if (byId[id]) open(id, { sound: false });
    else close();
  }
  window.addEventListener('popstate', route);

  translatePage();
  syncControls();
  renderStickers();
  route();
  Voices.all().then(function (saved) {
    saved.forEach(function (blob, key) { myVoices.set(key, blob); });
    syncRecUI();
  });
})();
