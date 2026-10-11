/*
 * Feelings Friends dashboard: every feeling at once, each one animating with
 * its name underneath. Tapping a tile opens that feeling in the main app.
 * Shares the kid and language settings with app.js (localStorage).
 */
(function () {
  'use strict';

  var LOTTIE_PATH = '../dist/emotions/{kid}/{id}.json';
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function load(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* private mode */ } }

  var kid = load('ff.kid', 'girl');
  var prefs = navigator.languages || [navigator.language || 'en'];
  var guess = prefs.map(function (p) { return LANGS.find(function (l) { return l.voice.test(p); }); }).find(Boolean);
  var lang = UI[load('ff.lang', '')] ? load('ff.lang', '') : (guess ? guess.code : 'en');
  var ui = function (key) { return UI[lang][key] || UI.en[key]; };
  var label = function (id) { return FEELINGS[lang][id].label.replace(/@/g, kid === 'girl' ? 'a' : 'o'); };

  document.documentElement.lang = lang;
  document.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = ui(el.dataset.t); });
  document.querySelectorAll('[data-t-label]').forEach(function (el) { el.setAttribute('aria-label', ui(el.dataset.tLabel)); });

  var grid = document.getElementById('grid');
  var players = [];

  // ponytail: 20 SVG players run at once; pause off-screen ones with IntersectionObserver if low-end tablets stutter
  function render() {
    players.forEach(function (p) { p.destroy(); });
    players = [];
    grid.innerHTML = '';
    KidRig.EMOTIONS.filter(function (e) { return FEELINGS[lang][e.id]; }).forEach(function (e) {
      var li = document.createElement('li');
      li.innerHTML = '<a class="dash-tile" href="./#/' + e.id + '"><span class="dash-kid"></span><span class="label"></span></a>';
      var a = li.firstChild;
      a.style.setProperty('--tile-bg', e.bg);
      a.style.setProperty('--tile-ring', e.ring);
      a.lastChild.textContent = label(e.id);
      grid.appendChild(li);
      if (!window.lottie) return;
      var p = lottie.loadAnimation({
        container: a.firstChild, renderer: 'svg', loop: true, autoplay: !still,
        path: LOTTIE_PATH.replace('{kid}', kid).replace('{id}', e.id)
      });
      if (still) p.addEventListener('DOMLoaded', function () { p.goToAndStop(e.poster, true); });
      players.push(p);
    });
    document.querySelectorAll('.kid-switch button').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.kid === kid));
    });
  }

  document.querySelectorAll('.kid-switch button').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.kid === kid) return;
      kid = b.dataset.kid;
      save('ff.kid', kid);
      render();
    });
  });

  render();
})();
