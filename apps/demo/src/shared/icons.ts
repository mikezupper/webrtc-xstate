import { html } from "@gyral/core";
// Decorative stroke icons. Every control that shows one also carries a text name.
export const icons = {
  mic: html`<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`,
  micOff: html`<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16"/></svg>`,
  camera: html`<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10.5l5-3v9l-5-3z"/></svg>`,
  cameraOff: html`<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10.5l5-3v9l-5-3zM3 3l18 18"/></svg>`,
  screen: html`<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M9 10l3-3 3 3M12 7v6"/></svg>`,
  stats: html`<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20v-6M11 20V8M17 20V4M3 20h18"/></svg>`,
  phone: html`<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>`,
  hangup: html`<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 14.5c5-5 13-5 18 0l-2 3-4-1v-2.5a9 9 0 0 0-6 0V16.5l-4 1z"/></svg>`,
  send: html`<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-3-7zM11 13l9-9"/></svg>`,
  upload: html`<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>`,
  download: html`<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v12M7 11l5 5 5-5M4 20h16"/></svg>`,
  check: html`<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>`,
  close: html`<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  wave: html`<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 11v2"/></svg>`,
} as const;
