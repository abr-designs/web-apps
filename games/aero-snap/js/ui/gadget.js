// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// The pocket gadget: a Y2K handheld that flips up with the request list, film counter and scrapbook button.

import { REQUESTS } from '../requests.js';
import { stars } from './polaroid.js';

export function createGadget(root, { onScrapbook }) {
  root.innerHTML = `
    <div class="gadget__body" role="dialog" aria-label="Photo gadget">
      <div class="gadget__screen">
        <div class="gadget__head"><span class="gadget__title">Requests</span><span class="gadget__count"></span></div>
        <ol class="gadget__list"></ol>
        <div class="gadget__film"></div>
        <div class="gadget__warn" hidden>Photos won't be kept after you close this tab</div>
      </div>
      <div class="gadget__buttons">
        <button type="button" class="gadget__btn gadget__btn--list" aria-label="Requests"><span>list</span></button>
        <button type="button" class="gadget__btn gadget__btn--book" aria-label="Open scrapbook"><span>scrapbook</span></button>
      </div>
      <div class="gadget__speaker" aria-hidden="true"></div>
    </div>`;
  const list = root.querySelector('.gadget__list');
  const count = root.querySelector('.gadget__count');
  const film = root.querySelector('.gadget__film');
  const warn = root.querySelector('.gadget__warn');
  root.querySelector('.gadget__btn--book').addEventListener('click', () => onScrapbook());
  root.querySelector('.gadget__btn--list').addEventListener('click', () => list.scrollTo({ top: 0, behavior: 'smooth' }));

  let open = false;
  const gadget = {
    open() { open = true; root.classList.add('is-open'); },
    close() { open = false; root.classList.remove('is-open'); },
    toggle() { (open ? gadget.close : gadget.open)(); },
    isOpen: () => open,
    render(progress, filmLeft, persistent) {
      let done = 0;
      list.innerHTML = REQUESTS.map((r) => {
        const slot = r.id === 'favorite' ? (progress.coverPhotoId ? { stars: 3 } : null) : progress.requests[r.id];
        if (slot) done++;
        return `<li class="${slot ? 'is-done' : ''}">
          <span class="gadget__mark" aria-hidden="true">${slot ? '✓' : '○'}</span>
          <span class="gadget__text">${r.text}</span>
          ${slot ? `<span class="gadget__stars" aria-label="${slot.stars} of 3 stars">${stars(slot.stars)}</span>` : ''}
        </li>`;
      }).join('');
      count.textContent = `${done}/${REQUESTS.length}`;
      film.textContent = `Film ${filmLeft} / 24`;
      warn.hidden = persistent;
    },
  };
  return gadget;
}
