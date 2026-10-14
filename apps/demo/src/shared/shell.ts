import { html } from "@gyral/core";
export const ROOM_PATTERN = "[A-Za-z0-9_\\-]{1,64}";
export const EXAMPLE_ROOM_PATTERN = "[A-Za-z0-9_\\-]{1,48}";
export const navigation = (current: string) => html`
  <a class="skip-link" href="#main">Skip to main content</a>
  <header class="site-header"><a class="brand" href="/" translate="no">Peerweave <small>Examples</small></a>
    <nav aria-label="Examples"><ul>
      <li><a href="/" aria-current=${current === "workbench" ? "page" : undefined}>Call workbench</a></li>
      <li><a href="/media/" aria-current=${current === "media" ? "page" : undefined}>Media preflight</a></li>
      <li><a href="/transfer/" aria-current=${current === "transfer" ? "page" : undefined}>File transfer</a></li>
      <li><a href="/support/" aria-current=${current === "support" ? "page" : undefined}>Support call</a></li>
    </ul></nav>
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
