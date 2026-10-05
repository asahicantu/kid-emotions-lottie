/*
 * The child's own recordings, kept in the browser's local database (IndexedDB).
 * One recording per language and feeling, keyed "<lang>/<feeling>", e.g. "es/happy".
 * Every call returns a promise and never rejects: if IndexedDB is unavailable
 * (some private windows), recordings simply are not kept after a reload.
 */
var Voices = (function () {
  'use strict';

  var DB = 'feelings-friends', STORE = 'voices';
  var opening = null;

  function open() {
    if (!opening) {
      opening = new Promise(function (resolve) {
        try {
          var req = indexedDB.open(DB, 1);
          req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
          req.onsuccess = function () { resolve(req.result); };
          req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    }
    return opening;
  }

  function run(mode, fn) {
    return open().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE, mode);
          var req = fn(tx.objectStore(STORE));
          tx.oncomplete = function () { resolve(req ? req.result : null); };
          tx.onerror = tx.onabort = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    });
  }

  // Load every recording at once (a few dozen short clips): Map of key -> Blob.
  function all() {
    return open().then(function (db) {
      var out = new Map();
      if (!db) return out;
      return new Promise(function (resolve) {
        try {
          var req = db.transaction(STORE).objectStore(STORE).openCursor();
          req.onsuccess = function () {
            var c = req.result;
            if (!c) { resolve(out); return; }
            if (c.value && c.value.blob) out.set(c.key, c.value.blob);
            c.continue();
          };
          req.onerror = function () { resolve(out); };
        } catch (e) { resolve(out); }
      });
    });
  }

  function put(key, blob) {
    return run('readwrite', function (s) { return s.put({ blob: blob, saved: Date.now() }, key); });
  }

  function remove(key) {
    return run('readwrite', function (s) { return s.delete(key); });
  }

  return { all: all, put: put, remove: remove };
})();
