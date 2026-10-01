// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// Modal weather: large day buttons; the chosen day's hourly forecast loads below them.

import { el } from './dom.js';
import { icon, sky } from './icons.js';
import { renderWeather, weekday } from './card.js';
import { getHourly } from '../weatherClient.js';
import { weatherScore, bandFor } from '../weatherScore.js';

// Hiking hours shown in the hourly strip.
const FIRST_HOUR = 6;
const LAST_HOUR = 21;

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export function renderWeatherDetail(hike, forecast, dayIndex) {
  if (!forecast) return renderWeather(hike, forecast, dayIndex);

  const hourly = el('div', { class: 'hourly', 'aria-live': 'polite' });
  let current;

  const select = async i => {
    current = i;
    buttons.forEach((b, j) => {
      b.setAttribute('aria-pressed', String(i === j));
      b.classList.toggle('selected', i === j);
    });
    hourly.replaceChildren(el('p', { class: 'hourly-note' }, 'Loading hourly forecast...'));
    try {
      const hours = await getHourly(hike, forecast[i].date);
      if (current === i) hourly.replaceChildren(renderHours(hours, i === 0));
    } catch {
      if (current === i) hourly.replaceChildren(el('p', { class: 'hourly-note' }, 'Hourly forecast is unavailable'));
    }
  };

  const buttons = forecast.map((day, i) => {
    const [name, label] = sky(day.code);
    const good = bandFor(weatherScore(day)) === 'good';
    const summary = `${label}, high ${Math.round(day.highC)}°, low ${Math.round(day.lowC)}°, ${day.popPct}% rain${good ? ', good hiking weather' : ''}`;
    return el('button', {
      type: 'button', class: good ? 'good' : undefined, title: summary, onclick: () => select(i),
      'aria-label': `${i === 0 ? 'Today' : weekday(day.date, 'long')}: ${summary}`,
    },
    el('span', { class: 'dow' }, i === 0 ? 'Today' : weekday(day.date)),
    icon(name),
    el('span', { class: 'temp' }, `${Math.round(day.highC)}°`),
    el('span', { class: 'low' }, `${Math.round(day.lowC)}°`),
    el('span', { class: 'pop' }, `${day.popPct}%`));
  });
  select(dayIndex);

  return el('div', { class: 'weather-detail' },
    el('div', { class: 'forecast big', role: 'group', 'aria-label': 'Forecast days' }, buttons),
    hourly);
}

/** Today starts at the current hour; other days at FIRST_HOUR. @created Claude (claude-opus-5-5) - 2026-09-28 */
function renderHours(hours, isToday) {
  const from = isToday ? Math.max(FIRST_HOUR, new Date().getHours()) : FIRST_HOUR;
  const shown = hours.filter(h => h.hour >= from && h.hour <= LAST_HOUR);
  if (!shown.length) return el('p', { class: 'hourly-note' }, 'No more hiking hours today');
  return el('ol', { class: 'hours', 'aria-label': 'Hourly forecast' }, shown.map(h => {
    const [name, label] = sky(h.code);
    const time = new Date(2000, 0, 1, h.hour).toLocaleTimeString(undefined, { hour: 'numeric' });
    const summary = `${time}: ${label}, ${Math.round(h.tempC)}°, ${h.popPct}% rain`;
    return el('li', { title: summary },
      el('span', { class: 'sr-only' }, summary),
      el('span', { class: 'hour', 'aria-hidden': 'true' }, time),
      icon(name),
      el('span', { class: 'temp', 'aria-hidden': 'true' }, `${Math.round(h.tempC)}°`),
      el('span', { class: 'pop', 'aria-hidden': 'true' }, `${h.popPct}%`));
  }));
}
