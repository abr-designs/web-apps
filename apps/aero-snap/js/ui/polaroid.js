// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// The instant-photo card that slides out of the gadget after each snap.

const SHOW_MS = 4000;

const root = document.getElementById('polaroid');
let hideTimer = 0;
let finish = null;

export function stars(n) {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

function close() {
  clearTimeout(hideTimer);
  root.classList.remove('is-open');
  const done = finish;
  finish = null;
  done?.();
}

root.addEventListener('click', (e) => {
  if (e.target.closest('button')) return;
  close();
});

/**
 * @param {{ url: string, matches: { requestId: string, stars: number, text: string }[], onDone?: () => void }} opts
 */
export function showPolaroid({ url, matches, onDone }) {
  if (finish) close();
  finish = onDone ?? null;
  const list = matches.length
    ? matches.map((m) => `<li><span class="polaroid__stars" aria-label="${m.stars} of 3 stars">${stars(m.stars)}</span> ${m.text}</li>`).join('')
    : '<li class="polaroid__none">No requests matched, saved to your camera roll</li>';
  root.innerHTML = `
    <figure class="polaroid__card">
      <img class="polaroid__photo" src="${url}" alt="Your photo">
      <figcaption><ul class="polaroid__list">${list}</ul></figcaption>
    </figure>`;
  // Restart the slide-in animation on consecutive photos.
  void root.offsetWidth;
  root.classList.add('is-open');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(close, SHOW_MS);
}
