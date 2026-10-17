// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Y2K sticker set for the scrapbook, drawn as inline SVG in the Aero palette.

const svg = (body) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const shine = '<ellipse cx="22" cy="18" rx="9" ry="5" fill="#fff" opacity=".75" transform="rotate(-30 22 18)"/>';

export const STICKERS = [
  { type: 'bubble', svg: svg(`<circle cx="32" cy="32" r="26" fill="#BFF3FF" stroke="#00B8D9" stroke-width="3"/>${shine}`) },
  { type: 'star', svg: svg('<path d="M32 4l8 18 20 2-15 13 5 20-18-11-18 11 5-20L4 24l20-2z" fill="#FFD86B" stroke="#F2A91D" stroke-width="3" stroke-linejoin="round"/><ellipse cx="26" cy="22" rx="5" ry="3" fill="#fff" opacity=".8"/>') },
  { type: 'sparkle', svg: svg('<path d="M32 2c3 18 12 27 30 30-18 3-27 12-30 30-3-18-12-27-30-30 18-3 27-12 30-30z" fill="#fff" stroke="#00B8D9" stroke-width="2.5"/>') },
  { type: 'globe', svg: svg(`<circle cx="32" cy="32" r="26" fill="#1E6FE8"/><path d="M14 22c8 2 10 10 18 8s6-12 16-10M10 38c10-4 16 6 24 2s12-2 20 2" stroke="#7ED957" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="32" cy="32" r="26" fill="none" stroke="#0B2A4A" stroke-width="2.5"/>${shine}`) },
  { type: 'chrome-heart', svg: svg('<defs><linearGradient id="ch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#A9BCCF"/><stop offset="1" stop-color="#F4F8FB"/></linearGradient></defs><path d="M32 56S6 40 6 22a13 13 0 0126-6 13 13 0 0126 6c0 18-26 34-26 34z" fill="url(#ch)" stroke="#6E8297" stroke-width="2.5"/><ellipse cx="20" cy="20" rx="6" ry="3.5" fill="#fff" transform="rotate(-30 20 20)"/>') },
  { type: 'swoosh', svg: svg('<path d="M4 44c16-4 30-22 56-30-14 12-26 32-52 36z" fill="#7ED957" stroke="#3E9A2A" stroke-width="2"/><path d="M10 52c18-2 34-14 50-22" stroke="#00B8D9" stroke-width="4" fill="none" stroke-linecap="round"/>') },
  { type: 'fish', svg: svg(`<circle cx="32" cy="32" r="27" fill="#BFF3FF" stroke="#00B8D9" stroke-width="2.5"/><ellipse cx="30" cy="34" rx="13" ry="9" fill="#FF9A5C"/><path d="M42 34l10-7v14z" fill="#FFC46B"/><circle cx="24" cy="32" r="2.5" fill="#0B2A4A"/>${shine}`) },
  { type: 'cloud', svg: svg('<path d="M16 46a10 10 0 010-20 14 14 0 0126-4 11 11 0 016 24z" fill="#fff" stroke="#8FD3FF" stroke-width="3"/>') },
  { type: 'rocket', svg: svg('<path d="M32 4c10 8 14 22 10 38H22C18 26 22 12 32 4z" fill="#F4F8FB" stroke="#6E8297" stroke-width="2.5"/><path d="M32 4c5 4 8 9 9 14H23c1-5 4-10 9-14z" fill="#E6463F"/><path d="M22 34l-10 14 12-4zM42 34l10 14-12-4z" fill="#E6463F"/><circle cx="32" cy="28" r="4.5" fill="#BFF3FF" stroke="#6E8297" stroke-width="2"/><path d="M27 44l5 14 5-14z" fill="#FFD86B"/>') },
  { type: 'flower', svg: svg('<g fill="#FF8FC7" stroke="#D4537E" stroke-width="2"><circle cx="32" cy="15" r="10"/><circle cx="49" cy="28" r="10"/><circle cx="42" cy="48" r="10"/><circle cx="22" cy="48" r="10"/><circle cx="15" cy="28" r="10"/></g><circle cx="32" cy="32" r="8" fill="#FFD86B"/>') },
  { type: 'butterfly', svg: svg('<path d="M32 30C22 8 4 10 8 26s20 8 24 6zM32 30c10-22 28-20 24-4s-20 8-24 6zM32 34c-8 4-20 6-18 16s14 2 18-12zM32 34c8 4 20 6 18 16s-14 2-18-12z" fill="#00B8D9" stroke="#0B2A4A" stroke-width="2"/><rect x="30" y="20" width="4" height="26" rx="2" fill="#0B2A4A"/>') },
  { type: 'cd', svg: svg('<defs><linearGradient id="cd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8FC7"/><stop offset=".35" stop-color="#BFF3FF"/><stop offset=".65" stop-color="#C6F26B"/><stop offset="1" stop-color="#C9B6F2"/></linearGradient></defs><circle cx="32" cy="32" r="27" fill="url(#cd)" stroke="#A9BCCF" stroke-width="2"/><circle cx="32" cy="32" r="8" fill="#fff" stroke="#A9BCCF" stroke-width="2"/>') },
];

export const stickerSvg = new Map(STICKERS.map((s) => [s.type, s.svg]));
