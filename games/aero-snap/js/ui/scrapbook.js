// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// The scrapbook: a cover, five pages of request slots and an ending page, with stickers, captions and the camera roll.

import { REQUESTS } from '../requests.js';
import { isComplete } from '../progress.js';
import { STICKERS, stickerSvg } from './stickers.js';
import { stars } from './polaroid.js';

const SLOT_PAGES = 5;
const ROTATE_STEP = 15;
const text = new Map(REQUESTS.map((r) => [r.id, r.text]));
const ids = REQUESTS.map((r) => r.id);

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * @param {HTMLElement} root
 * @param {{ store: Promise<object>, getProgress: () => object, getScrapbook: () => object,
 *           onChange: (scrapbook: object) => void, onCover: (photoId: string) => void }} deps
 */
export function createScrapbook(root, { store, getProgress, getScrapbook, onChange, onCover }) {
  root.innerHTML = `
    <div class="book" role="dialog" aria-label="Scrapbook" tabindex="-1">
      <button type="button" class="book__close" aria-label="Close scrapbook">✕</button>
      <div class="book__spread">
        <button type="button" class="book__turn book__turn--prev" aria-label="Previous page">‹</button>
        <div class="book__page">
          <div class="book__content"></div>
          <div class="book__stickers"></div>
          <div class="book__folio"></div>
        </div>
        <button type="button" class="book__turn book__turn--next" aria-label="Next page">›</button>
        <div class="book__tray" role="group" aria-label="Stickers, drag onto the page">
          ${STICKERS.map((s) => `<button type="button" class="book__src" data-type="${s.type}" aria-label="${s.type} sticker">${s.svg}</button>`).join('')}
        </div>
      </div>
      <div class="book__roll">
        <span class="book__roll-label">Camera roll</span>
        <div class="book__strip"></div>
        <button type="button" class="book__set-cover" hidden>Set as cover</button>
      </div>
    </div>`;

  const pageEl = root.querySelector('.book__page');
  const content = root.querySelector('.book__content');
  const stickerLayer = root.querySelector('.book__stickers');
  const folio = root.querySelector('.book__folio');
  const tray = root.querySelector('.book__tray');
  const strip = root.querySelector('.book__strip');
  const setCover = root.querySelector('.book__set-cover');
  const prev = root.querySelector('.book__turn--prev');
  const next = root.querySelector('.book__turn--next');

  const urls = new Map();
  let open = false;
  let page = 0;
  let selected = null;
  let drag = null;

  async function urlFor(id) {
    if (!urls.has(id)) {
      urls.set(id, (await store).getPhoto(id).then((rec) => (rec ? URL.createObjectURL(rec.blob) : '')));
    }
    return urls.get(id);
  }

  function hydrate(scope) {
    scope.querySelectorAll('img[data-photo]').forEach((img) => {
      urlFor(img.dataset.photo).then((u) => {
        if (u) img.src = u;
        else img.closest('.slot, .book__thumb, .cover')?.classList.add('is-missing');
      });
    });
  }

  const pageCount = () => SLOT_PAGES + 1 + (isComplete(getProgress()) ? 1 : 0);

  function slotHtml(id) {
    const progress = getProgress();
    if (id === 'favorite') {
      return `<div class="slot slot--note"><p>${text.get(id)} lives on the cover.</p>
        <button type="button" class="book__link" data-goto="0">Go to the cover</button></div>`;
    }
    const s = progress.requests[id];
    if (!s) return `<div class="slot slot--empty"><span>${text.get(id)}</span></div>`;
    const caption = escapeHtml(getScrapbook().captions[id] ?? '');
    return `<figure class="slot">
      <img class="slot__photo" data-photo="${s.photoId}" alt="${text.get(id)}">
      <figcaption>
        <span class="slot__title">${text.get(id)}</span>
        <span class="slot__stars" aria-label="${s.stars} of 3 stars">${stars(s.stars)}</span>
        <input class="slot__caption" data-caption="${id}" maxlength="60" placeholder="Add a caption" value="${caption}" aria-label="Caption for ${text.get(id)}">
      </figcaption>
    </figure>`;
  }

  function pageHtml() {
    const progress = getProgress();
    if (page === 0) {
      const cover = progress.coverPhotoId
        ? `<img class="cover__photo" data-photo="${progress.coverPhotoId}" alt="Your favorite shot">`
        : '<div class="cover__empty">Pick a favorite shot from your camera roll, then choose Set as cover</div>';
      return `<div class="cover"><h1 class="cover__title">My island scrapbook</h1>${cover}</div>`;
    }
    if (page === SLOT_PAGES + 1) {
      const photos = [...new Set(Object.values(progress.requests).map((r) => r.photoId))];
      return `<div class="ending"><h2>Every request complete</h2>
        <p>Thanks for photographing the island. Keep exploring and swap in your best shots any time.</p>
        <div class="ending__grid">${photos.map((p) => `<img data-photo="${p}" alt="">`).join('')}</div></div>`;
    }
    const pair = ids.slice((page - 1) * 2, page * 2);
    return `<div class="slots">${pair.map(slotHtml).join('')}</div>`;
  }

  function renderStickers() {
    const { stickers } = getScrapbook();
    stickerLayer.innerHTML = stickers.map((s, i) => (s.page !== page ? '' : `
      <div class="book__sticker" data-index="${i}" style="left:${s.x * 100}%;top:${s.y * 100}%;transform:translate(-50%,-50%) rotate(${s.rot}deg) scale(${s.scale})">${stickerSvg.get(s.type) ?? ''}</div>`)).join('');
  }

  function renderPage() {
    content.innerHTML = pageHtml();
    hydrate(content);
    renderStickers();
    const n = pageCount();
    folio.textContent = page === 0 ? 'Cover' : page > SLOT_PAGES ? 'The end' : `Page ${page} of ${SLOT_PAGES}`;
    prev.style.visibility = page > 0 ? 'visible' : 'hidden';
    next.style.visibility = page < n - 1 ? 'visible' : 'hidden';
  }

  function renderRoll() {
    const { roll } = getProgress();
    strip.innerHTML = roll.length
      ? [...roll].reverse().map((id) => `<button type="button" class="book__thumb" data-photo="${id}" aria-pressed="${id === selected}"><img data-photo="${id}" alt="Photo from your camera roll"></button>`).join('')
      : '<span class="book__roll-empty">Photos you take show up here</span>';
    hydrate(strip);
    setCover.hidden = !selected;
  }

  function turn(delta) {
    page = Math.min(Math.max(page + delta, 0), pageCount() - 1);
    renderPage();
  }

  prev.addEventListener('click', () => turn(-1));
  next.addEventListener('click', () => turn(1));
  root.querySelector('.book__close').addEventListener('click', () => api.close());
  content.addEventListener('click', (e) => {
    const go = e.target.closest('[data-goto]');
    if (go) {
      page = Number(go.dataset.goto);
      renderPage();
    }
  });
  content.addEventListener('input', (e) => {
    const id = e.target.dataset?.caption;
    if (!id) return;
    const scrap = getScrapbook();
    onChange({ ...scrap, captions: { ...scrap.captions, [id]: e.target.value.slice(0, 60) } });
  });
  strip.addEventListener('click', (e) => {
    const thumb = e.target.closest('.book__thumb');
    if (!thumb) return;
    selected = selected === thumb.dataset.photo ? null : thumb.dataset.photo;
    renderRoll();
  });
  setCover.addEventListener('click', () => {
    if (!selected) return;
    onCover(selected);
    selected = null;
    page = 0;
    renderRoll();
    renderPage();
  });
  root.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') turn(-1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') turn(1);
  });

  // Sticker drag and drop. New stickers come from the tray; placed ones move, rotate with the wheel,
  // and are removed by dropping them back on the tray.
  function overRect(el, e) {
    const r = el.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }

  function placeGhost(e) {
    drag.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%) rotate(${drag.rot}deg) scale(${drag.scale})`;
  }

  root.addEventListener('pointerdown', (e) => {
    const src = e.target.closest('.book__src');
    const placed = e.target.closest('.book__sticker');
    if (!src && !placed) return;
    e.preventDefault();
    const scrap = getScrapbook();
    const existing = placed ? scrap.stickers[Number(placed.dataset.index)] : null;
    const type = src ? src.dataset.type : existing.type;
    const ghost = document.createElement('div');
    ghost.className = 'book__ghost';
    ghost.innerHTML = stickerSvg.get(type);
    root.appendChild(ghost);
    drag = { type, ghost, index: placed ? Number(placed.dataset.index) : -1, rot: existing?.rot ?? 0, scale: existing?.scale ?? 1 };
    if (placed) placed.style.visibility = 'hidden';
    placeGhost(e);
  });
  window.addEventListener('pointermove', (e) => {
    if (drag) placeGhost(e);
  });
  root.addEventListener('wheel', (e) => {
    if (!drag) return;
    e.preventDefault();
    drag.rot = (drag.rot + Math.sign(e.deltaY) * ROTATE_STEP) % 360;
    placeGhost(e);
  }, { passive: false });
  window.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const { type, ghost, index, rot, scale } = drag;
    drag = null;
    ghost.remove();
    const scrap = getScrapbook();
    const stickers = [...scrap.stickers];
    if (index >= 0 && overRect(tray, e)) {
      stickers.splice(index, 1);
    } else if (overRect(pageEl, e)) {
      const r = pageEl.getBoundingClientRect();
      const sticker = { page, type, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, rot, scale };
      if (index >= 0) stickers[index] = sticker;
      else stickers.push(sticker);
    }
    onChange({ ...scrap, stickers });
    renderStickers();
  });

  const api = {
    open() {
      open = true;
      root.classList.add('is-open');
      page = Math.min(page, pageCount() - 1);
      renderPage();
      renderRoll();
      root.querySelector('.book').focus?.();
    },
    close() {
      open = false;
      root.classList.remove('is-open');
      selected = null;
      content.innerHTML = '';
      strip.innerHTML = '';
      for (const p of urls.values()) p.then((u) => u && URL.revokeObjectURL(u));
      urls.clear();
      api.onClose?.();
    },
    isOpen: () => open,
    onClose: null,
  };
  return api;
}
