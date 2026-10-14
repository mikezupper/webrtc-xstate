import { html, type TemplateResult } from "@gyral/core";
export const ROOM_PATTERN = "[A-Za-z0-9_\\-]{1,64}";
export const EXAMPLE_ROOM_PATTERN = "[A-Za-z0-9_\\-]{1,48}";
const pages = [
  ["workbench", "/", "Call workbench"],
  ["media", "/media/", "Media preflight"],
  ["transfer", "/transfer/", "File transfer"],
  ["support", "/support/", "Support call"],
] as const;
export type Page = (typeof pages)[number][0];
export const navigation = (current: Page) => html`
  <a class="skip-link" href="#main">Skip to main content</a>
  <header class="masthead">
    <a class="brand" href="/" translate="no"><svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M3 22 C 10 4, 22 28, 29 10"/><path d="M3 10 C 10 28, 22 4, 29 22"/></svg>Peerweave <small>Examples</small></a>
    <nav aria-label="Examples"><ul>${pages.map(
      ([page, href, label]) =>
        html`<li><a href=${href} aria-current=${page === current ? "page" : undefined}>${label}</a></li>`,
    )}</ul></nav>
  </header>`;
export const footer = () =>
  html`<footer class="site-footer"><p>Built with the public Peerweave APIs. The call and transfer examples use a local two-participant signaling relay. Configure authenticated signaling and your own STUN/TURN service for deployment across networks.</p></footer>`;
export function formatBytes(value: number): string {
  return value < 1024
    ? `${value} B`
    : value < 1048576
      ? `${(value / 1024).toFixed(1)} KiB`
      : `${(value / 1048576).toFixed(1)} MiB`;
}

/** The hero of every example: a muted eyebrow, a display headline and a short lede. */
export const hero = (eyebrow: string, title: string, lede: string) =>
  html`<hgroup class="hero"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${lede}</p></hgroup>`;

export interface Weave {
  /** Whether each participant is present, drawn as a filled or hollow node. */
  readonly you: boolean;
  readonly peer: boolean;
  /** The index of the current step; steps before it are done. Past the end, all are done. */
  readonly step: number;
  readonly steps: readonly string[];
  /** The connection's accessible description. */
  readonly label: string;
}
const thread = "M8 40 C 120 -4, 280 84, 392 40";
/** The connection drawn as a thread between two people, with the session's steps below it. */
export const weave = (w: Weave): TemplateResult =>
  html`<figure class="weave">
    <span class="node" data-present=${String(w.you)}><span class="avatar" aria-hidden="true">Y</span>You</span>
    <svg viewBox="0 0 400 80" role="img" aria-label=${w.label}><path class="thread thread-base" pathLength="100" d=${thread}/><path class="thread thread-live" pathLength="100" d=${thread}/><path class="thread thread-packets" pathLength="100" d=${thread}/></svg>
    <span class="node" data-present=${String(w.peer)}><span class="avatar" aria-hidden="true">P</span>Peer</span>
    <figcaption><ol class="steps">${w.steps.map(
      (label, index) =>
        html`<li ?data-done=${index < w.step} aria-current=${index === w.step ? "step" : undefined}>${label}</li>`,
    )}</ol></figcaption>
  </figure>`;

/** A collapsed set of instructions. */
export const help = (title: string, body: TemplateResult) =>
  html`<details class="panel help"><summary>${title}</summary>${body}</details>`;
