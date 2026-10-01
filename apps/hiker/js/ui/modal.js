// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// One shared <dialog> that shows a card enlarged. Esc, the close button or a click outside closes it.

import { el } from './dom.js';
import { icon } from './icons.js';

let dialog;
let onClose;

/**
 * returnFocus: called after closing, to put focus back when the element that opened the modal was re-rendered.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
export function openModal(content, label, returnFocus) {
  if (!dialog) {
    dialog = el('dialog', { class: 'modal' });
    // Clicks on the backdrop land on the dialog itself; clicks on the card land on its children.
    dialog.addEventListener('click', e => e.target === dialog && dialog.close());
    dialog.addEventListener('close', () => onClose?.());
    document.body.append(dialog);
  }
  onClose = returnFocus;
  dialog.setAttribute('aria-label', label);
  dialog.replaceChildren(
    el('button', { type: 'button', class: 'modal-close', 'aria-label': 'Close', title: 'Close', onclick: () => dialog.close() }, icon('close')),
    content);
  dialog.showModal();
}

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export function closeModal() {
  dialog?.close();
}
