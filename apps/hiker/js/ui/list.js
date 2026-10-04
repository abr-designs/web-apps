// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// Renders ranked hikes: good matches first, then everything else by Score, PAGE_SIZE cards at a time.

import { el } from './dom.js';
import { renderCard, dayLabel } from './card.js';
import { openModal } from './modal.js';
import { renderWeatherDetail } from './weatherDetail.js';
import { goodFirst } from '../recommender.js';
import { PAGE_SIZE } from '../config.js';

// Cards shown so far. Kept across re-renders (weather, drive times) until the view changes.
let shown = PAGE_SIZE;
let lastView;

/**
 * bands: output of rank(). ctx = {forecasts, dayIndex, driveHours, images, day, onRemove, query}; day is the selected date,
 * onRemove(hike) deletes a hike added in the app, query is the name search. view: a key for the day and filters; a new one starts at the top page again.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
export function renderList(root, bands, ctx = {}) {
  const { forecasts = new Map(), dayIndex = 0, driveHours = new Map(), images = {}, day, onRemove, query = '', view } = ctx;
  if (view !== lastView) {
    lastView = view;
    shown = PAGE_SIZE;
  }
  if (!bands.length) {
    root.replaceChildren(el('p', { class: 'muted' }, query.trim() ? `No hike name contains "${query.trim()}".` : 'No hikes match these filters.'));
    return;
  }
  const card = ({ hike, band }) => {
    const props = {
      hike, band, dayIndex,
      forecast: forecasts.get(hike.id),
      driveHrs: driveHours.get(hike.id),
      image: validImage(images[hike.id]),
    };
    return renderCard({ ...props, onOpen: () => openModal(renderCard({
      ...props, expanded: true, weather: renderWeatherDetail(hike, props.forecast, dayIndex),
      onRemove: hike.custom && onRemove && (() => onRemove(hike)),
    }), hike.name, () => root.querySelector(`[data-hike="${CSS.escape(hike.id)}"] .card-open`)?.focus()) });
  };
  const { good, rest } = goodFirst(bands, driveHours);
  const total = good.length + rest.length;

  // Good matches come first, so the page limit only cuts into More hikes once every good match is shown.
  // The heading counts stay the full totals.
  const section = (title, items, visible) => items.length > 0 && visible.length > 0 && el('section', { class: 'group' },
    title && el('h2', {}, title, el('span', { class: 'count' }, String(items.length))),
    el('div', { class: 'cards' }, visible.map(card)));

  const when = day && (dayIndex < 2 ? dayLabel(day, dayIndex).toLowerCase() : `on ${dayLabel(day, dayIndex)}`);

  const left = total - shown;
  const showMore = () => {
    const first = shown;
    shown += PAGE_SIZE;
    renderList(root, bands, ctx);
    // Keyboard users continue from the first new card.
    root.querySelectorAll('.card-open')[first]?.focus();
  };

  root.replaceChildren(...[
    section(good.length ? 'Good matches' : '', good, good.slice(0, shown)),
    section(good.length ? 'More hikes' : when ? `No good weather ${when}` : '', rest, rest.slice(0, Math.max(0, shown - good.length))),
    left > 0 && el('div', { class: 'more' },
      el('button', { type: 'button', class: 'chip', onclick: showMore },
        `Show ${Math.min(PAGE_SIZE, left)} more`, el('span', { class: 'more-left' }, `${left} left`))),
  ].filter(Boolean));
}

/** A hand-edited images.json entry is only used when it has a string url. @created Claude (claude-opus-5-5) - 2026-09-28 */
function validImage(entry) {
  return entry && typeof entry.url === 'string' ? entry : undefined;
}
