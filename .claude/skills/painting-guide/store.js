// Created by Claude (claude-opus-5-5)
// Date: 2026-10-25
//
// Image store and prefs for single-file pages and claude.ai Artifacts. Not tied to painting guides:
// inline it in any page that keeps user images.
//
//   const imgs = createImageStore({ dbName, collection: "photos", maxSide: 2000, onChange })
//   await imgs.get(key)        -> Blob or null. The shared copy wins, then this browser's copy.
//   await imgs.put(key, blob)  -> downscales (WebP, or JPEG where the browser can't encode WebP), saves it in this browser, and shares it when
//                                 this viewer can edit the artifact. Resolves {shared}; shared is false when only the local copy was saved
//                                 by an editor. Throws when nothing was saved.
//   await imgs.del(key)
//   imgs.locked(key)           -> true when a shared image exists and this viewer can't change it. Hide edit controls then.
//   imgs.canShare()            -> true for artifact editors (assets and db both granted).
//   await imgs.unsharedKeys()  -> keys saved in this browser that aren't shared yet (empty for non-editors).
//   await imgs.shareAll(fn)    -> uploads those keys, calling fn(n, total) before each; resolves the failure count.
//   onChange()                 -> called once sharing comes online and whenever the shared set changes. Re-render images there.
//
// Artifact capabilities to declare: {assets: {}, db: {rules: [{path: "<collection>", read: "view", write: "admin"}]}}
// Signed-out visitors get no db, so they see only images saved in their own browser.
//
// Moving off Artifacts: replace the claude.use block, remotePut and remoteDel with another back end
// (for example image files committed beside the page, looked up by key). Callers of get, put and del stay as they are.
//
//   const prefs = createPrefs(prefix)  -> prefs.get(name, fallback), prefs.set(name, value). localStorage as JSON, never throws.

/** @created Claude (claude-opus-5-5) - 2026-10-25 */
function createPrefs(prefix) {
  return {
    get(k, d) { try { const v = localStorage.getItem(prefix + "-" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(prefix + "-" + k, JSON.stringify(v)); } catch {} }
  };
}

/** @created Claude (claude-opus-5-5) - 2026-10-25 */
function createImageStore({ dbName, collection = "photos", maxSide = 2000, onChange = () => {} }) {
  let idb = null;
  const open = () => idb || (idb = new Promise((res, rej) => {
    try {
      const r = indexedDB.open(dbName, 1);
      r.onupgradeneeded = () => r.result.createObjectStore("photos");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  }).catch(e => { idb = null; throw e; }));
  const local = async (mode, key, val) => {
    const d = await open();
    return new Promise((res, rej) => {
      const tx = d.transaction("photos", mode === "get" || mode === "keys" ? "readonly" : "readwrite");
      const os = tx.objectStore("photos");
      const r = mode === "keys" ? os.getAllKeys() : mode === "get" ? os.get(key) : mode === "put" ? os.put(val, key) : os.delete(key);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  };

  // Shared copies: key -> asset id, mirrored live from the db collection. Fetched blobs are cached by asset id (ids never change).
  const shared = {};
  const cache = new Map();
  let assets = null, db = null, busy = false;
  const canShare = () => !!(assets && db);

  async function remotePut(key, blob) {
    const old = shared[key];
    const up = await assets.upload(blob, blob.type ? undefined : { type: "image/webp" });
    try { await db.doc(collection + "/" + key).set({ id: up.id, at: Date.now() }); }
    catch (e) { try { await assets.delete(up.id); } catch {} throw e; }
    shared[key] = up.id;
    cache.set(up.id, blob);
    if (old) { cache.delete(old); try { await assets.delete(old); } catch {} }
  }
  async function remoteDel(key) {
    const old = shared[key];
    await db.doc(collection + "/" + key).delete();
    delete shared[key];
    if (old) { cache.delete(old); try { await assets.delete(old); } catch {} }
  }

  // Downscale to maxSide and re-encode as WebP, or JPEG where the browser can't encode WebP. Keeps the original when it
  // can't be decoded, or when it already fits and re-encoding wouldn't make it smaller (a fitting WebP is never re-encoded).
  async function shrink(blob) {
    try {
      const bmp = await createImageBitmap(blob);
      const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
      if (k === 1 && blob.type === "image/webp") { bmp.close(); return blob; }
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * k);
      c.height = Math.round(bmp.height * k);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close();
      const enc = type => new Promise(res => c.toBlob(res, type, 0.85));
      let out = await enc("image/webp");
      if (!out || out.type !== "image/webp") out = await enc("image/jpeg");
      return out && (k < 1 || out.size < blob.size) ? out : blob;
    } catch { return blob; }
  }

  async function get(key) {
    const id = shared[key];
    if (id) {
      if (cache.has(id)) return cache.get(id);
      try { const r = await fetch("/_blob/" + id); if (r.ok) { const b = await r.blob(); cache.set(id, b); return b; } } catch {}
    }
    try { return (await local("get", key)) || null; } catch { return null; }
  }
  async function put(key, blob) {
    const img = await shrink(blob);
    let saved = false, isShared = false;
    try { await local("put", key, img); saved = true; } catch {}
    if (canShare()) {
      try { await remotePut(key, img); saved = isShared = true; } catch (e) { if (!saved) throw e; }
    }
    if (!saved) throw new Error("Image not saved");
    return { shared: isShared };
  }
  async function del(key) {
    try { await local("del", key); } catch {}
    if (canShare() && shared[key]) await remoteDel(key);
  }
  async function unsharedKeys() {
    if (!canShare()) return [];
    try { return (await local("keys")).filter(k => !shared[k]); } catch { return []; }
  }
  async function shareAll(progress = () => {}) {
    const keys = await unsharedKeys();
    let failed = 0;
    busy = true;
    try {
      for (let n = 0; n < keys.length; n++) {
        progress(n + 1, keys.length);
        try { await remotePut(keys[n], await shrink(await local("get", keys[n]))); } catch { failed++; }
      }
    } finally { busy = false; }
    onChange();
    return failed;
  }

  // Light up sharing once the viewer grants db (and assets, for editors). Any failure leaves the page local-only.
  (async () => {
    if (!window.claude || !claude.use) return;
    try {
      const [d, a] = await Promise.all([claude.use("db"), claude.use("assets")]);
      if (!d) return;
      db = d;
      assets = a;
      let sig = "";
      d.collection(collection).onSnapshot(snap => {
        for (const k in shared) delete shared[k];
        snap.docs.forEach(doc => { const v = doc.data(); if (v && v.id) shared[doc.id] = v.id; });
        const next = JSON.stringify(shared);
        if (next !== sig && !busy) { sig = next; onChange(); }
      }, () => {});
      onChange();
    } catch (e) { console.warn("Image sharing unavailable:", e); }
  })();

  return { get, put, del, locked: key => !!shared[key] && !canShare(), canShare, unsharedKeys, shareAll };
}
