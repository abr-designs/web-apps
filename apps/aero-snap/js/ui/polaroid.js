// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// The instant-photo card that slides out of the gadget after each snap.

const SHOW_MS = 4000;
const PROMPT_MS = 7000;

const root = document.getElementById('polaroid');
let hideTimer = 0;
let currentUrl = null;
let onChoice = null;

export function stars(n) {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

function close() {
  clearTimeout(hideTimer);
  root.classList.remove('is-open');
}

function restartTimer(ms) {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(close, ms);
}

/** Keyboard path while the pointer is locked: applies one choice to every row with a keep prompt. */
export function chooseAll(choice) {
  if (!root.classList.contains('is-open')) return;
  root.querySelectorAll(`button[data-choice="${choice}"]`).forEach((b) => b.click());
}

root.addEventListener('click', (e) => {
  const button = e.target.closest('button[data-choice]');
  if (!button) {
    close();
    return;
  }
  const row = button.closest('[data-request]');
  row.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
  onChoice?.(row.dataset.request, button.dataset.choice);
  restartTimer(SHOW_MS);
});

function keepPrompt(m) {
  if (!m.existing) return '';
  const pressed = (c) => String(m.choice === c);
  return `<span class="polaroid__keep" role="group" aria-label="Which photo goes in the scrapbook">
    <button type="button" data-choice="new" aria-pressed="${pressed('new')}">Keep new</button>
    <button type="button" data-choice="old" aria-pressed="${pressed('old')}">Keep old ${stars(m.existing.stars)}</button>
  </span>`;
}

/**
 * @param {{ url: string,
 *   matches: { requestId: string, stars: number, text: string, existing?: { stars: number }, choice?: 'new'|'old' }[],
 *   onChoice?: (requestId: string, choice: 'new'|'old') => void }} opts
 */
export function showPolaroid({ url, matches, onChoice: choiceHandler }) {
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = url;
  onChoice = choiceHandler ?? null;
  const list = matches.length
    ? matches.map((m) => `<li data-request="${m.requestId}">
        <span class="polaroid__stars" aria-label="${m.stars} of 3 stars">${stars(m.stars)}</span> ${m.text}${keepPrompt(m)}
      </li>`).join('')
    : '<li class="polaroid__none">No requests matched, saved to your camera roll</li>';
  root.innerHTML = `
    <figure class="polaroid__card">
      <img class="polaroid__photo" src="${url}" alt="Your photo">
      <figcaption><ul class="polaroid__list">${list}</ul>${matches.some((m) => m.existing) ? '<p class="polaroid__hint">N keeps new, O keeps old</p>' : ''}</figcaption>
    </figure>`;
  // Restart the slide-in animation on consecutive photos.
  root.classList.remove('is-open');
  void root.offsetWidth;
  root.classList.add('is-open');
  restartTimer(matches.some((m) => m.existing) ? PROMPT_MS : SHOW_MS);
}
