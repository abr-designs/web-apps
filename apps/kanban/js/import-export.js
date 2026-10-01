// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28

// Project bundles: one <project-name>.kanban.json file holding the project, its tasks and its media as data URLs.
window.Kanban = window.Kanban || {};

(function (K) {
  'use strict';

  const { download, slugify } = K.util;
  const S = K.storage;

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function exportProject() {
    const data = await S.loadProject();
    const media = {};
    for (const name of await S.listMedia()) {
      const blob = await S.readMedia('media/' + name);
      if (blob) media['media/' + name] = await blobToDataUrl(blob);
    }
    const bundle = { format: 'kanban-bundle', version: 1, project: data.project, tasks: data.tasks, media };
    download(slugify(data.project.name) + '.kanban.json', JSON.stringify(bundle, null, 2) + '\n');
  }

  // Imports a bundle File into the connected folder, which must not hold a project yet.
  async function importBundle(file) {
    let bundle;
    try { bundle = JSON.parse(await file.text()); } catch (err) { throw new Error('Not valid JSON: ' + err.message); }
    if (!bundle || bundle.format !== 'kanban-bundle' || !bundle.project) throw new Error('Not a kanban bundle (expected "format": "kanban-bundle").');

    // Validate and decode everything first so a bad entry cannot leave a half-written project.
    const project = S.normalizeProject(bundle.project);
    const pad = (n) => 'T-' + String(n).padStart(4, '0');
    const raws = (Array.isArray(bundle.tasks) ? bundle.tasks : []).filter((t) => t && typeof t === 'object' && !Array.isArray(t));
    let max = Math.max(0, ...raws.map((t) => Number((/^T-(\d+)$/.exec(t.id) || [0, 0])[1])));
    const used = new Set();
    const tasks = raws.map((raw) => {
      const m = /^T-(\d+)$/.exec(raw.id);
      let id = m ? pad(Number(m[1])) : '';
      if (!id || used.has(id)) id = pad(++max);
      used.add(id);
      return S.normalizeTask(raw, id);
    });
    const media = [];
    for (const [path, dataUrl] of Object.entries(bundle.media || {})) {
      try {
        S.mediaPath(path); // throws on paths outside media/
        if (!/^data:/.test(dataUrl)) throw new Error('not a data URL');
        media.push({ path, blob: await (await fetch(dataUrl)).blob() });
      } catch (err) {
        console.warn('Skipping media ' + path, err);
      }
    }

    await S.createProject(project.name, project);
    for (const task of tasks) await S.saveTask(task);
    for (const m of media) {
      try { await S.writeFile(S.mediaPath(m.path), m.blob); } catch (err) { console.warn('Skipping media ' + m.path, err); }
    }
  }

  K.importExport = { exportProject, importBundle };
})(window.Kanban);
