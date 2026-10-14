import { each, html, type IntentNames, subscription, type TemplateResult } from "@gyral/core";
import { icons } from "../shared/icons.js";
import { audioLevel, mediaBinding } from "../shared/runtime.js";
import { formatBytes } from "../shared/shell.js";
import type { CallView, ChatMessage } from "./controller.js";
// View parts shared by the call workbench and the support call. All are pure functions of state.

export type CallMood =
  | "idle"
  | "lobby"
  | "ready"
  | "ringing"
  | "starting"
  | "connecting"
  | "active"
  | "recovering"
  | "failed"
  | "ended";
/** The phase the page is in, as `main[data-phase]`: it picks the page's hue and motion. */
export function callMood(view: CallView): CallMood {
  if (["failed", "ended", "recovering", "active", "connecting"].includes(view.phase))
    return view.phase as CallMood;
  if (view.phase === "starting" || view.phase === "waiting") return "starting";
  if (view.paired) return "ready";
  if (view.relay === "waiting" || view.relay === "connecting") return "lobby";
  return "idle";
}
export const isRunning = (view: CallView) =>
  ["connecting", "active", "recovering"].includes(view.phase);
export const isInCall = (view: CallView) =>
  isRunning(view) || ["starting", "waiting"].includes(view.phase);

/** What the stage says over the peer's video, and the connection's accessible description. */
export const moodCopy: Record<CallMood, { readonly overlay: string; readonly label: string }> = {
  idle: { overlay: "Join a room to begin", label: "Not connected" },
  lobby: { overlay: "Waiting for a second participant", label: "Waiting for your peer to join" },
  ready: { overlay: "Your peer is here", label: "You and your peer are both here" },
  ringing: { overlay: "Ringing…", label: "Invitation pending" },
  starting: { overlay: "Waiting for camera and microphone…", label: "Preparing media" },
  connecting: { overlay: "Connecting media and the data channel…", label: "Connecting" },
  active: { overlay: "", label: "Live connection between you and your peer" },
  recovering: { overlay: "Reconnecting…", label: "Reconnecting" },
  failed: { overlay: "Connection lost", label: "Connection failed" },
  ended: { overlay: "Call ended", label: "Call ended" },
};

/** The part of the call model these views read. */
export interface CallUi {
  readonly audio: boolean;
  readonly video: boolean;
  readonly message: string;
  readonly reportOpen: boolean;
  readonly view: CallView;
}
type DockIntents = IntentNames<
  "Start" | "Hangup" | "Mute" | "Camera" | "Share" | "StopShare" | "OpenReport"
>;

/** The video stage: the peer full-bleed, you picture-in-picture, the controls docked below. */
export function stage(
  model: CallUi,
  mood: CallMood,
  i: DockIntents,
  options: { readonly start: boolean },
): TemplateResult {
  const view = model.view;
  const running = isRunning(view);
  const inCall = isInCall(view);
  const preparing = view.phase === "starting" || view.phase === "waiting";
  const camera = preparing ? model.video : view.camera;
  const remote =
    mood === "active"
      ? "live"
      : mood === "recovering"
        ? "recovering"
        : mood === "failed"
          ? "lost"
          : "waiting";
  const local = !inCall ? "none" : view.screen ? "screen" : camera ? "live" : "off";
  const muted = inCall && !preparing && !view.microphone;
  return html`<section class="stage" data-remote=${remote} data-local=${local} aria-labelledby="stage-title">
    <h2 id="stage-title" class="visually-hidden">Live media</h2>
    <p id="live-media-note" class="visually-hidden">Live video has no automatic captions. Use the chat for written communication.</p>
    <figure class="remote" ${audioLevel("remote", view.revision)}>
      <video id="remote" width="640" height="400" autoplay playsinline aria-describedby="live-media-note" ${mediaBinding("remote", view.revision)}></video>
      <p class="overlay" aria-hidden="true"><span class="pulse"></span><span>${moodCopy[mood].overlay}</span></p>
      <figcaption><span class="dot" aria-hidden="true"></span>Your peer</figcaption>
    </figure>
    <figure class="local">
      <video id="local" width="640" height="400" muted autoplay playsinline aria-describedby="live-media-note" ${mediaBinding("local", view.revision)}></video>
      <span class="cam-off" aria-hidden="true"><span class="avatar">Y</span></span>
      <figcaption>You${muted ? html` ${icons.micOff}<span class="visually-hidden">, microphone muted</span>` : ""}</figcaption>
    </figure>
    <menu class="dock" aria-label="Call controls">
      ${options.start ? html`<li><button type="button" class="primary" data-intent=${i.Start} ?disabled=${!view.paired || view.requested || view.phase !== "idle"}>${icons.phone}<span class="label">Start call</span></button></li>` : ""}
      <li><button type="button" class="toggle" aria-pressed=${String(running && view.microphone)} data-intent=${i.Mute} ?disabled=${!running}>${running && !view.microphone ? icons.micOff : icons.mic}<span class="label">Microphone</span></button></li>
      <li><button type="button" class="toggle" aria-pressed=${String(running && view.camera)} data-intent=${i.Camera} ?disabled=${!running}>${running && !view.camera ? icons.cameraOff : icons.camera}<span class="label">Camera</span></button></li>
      <li><button type="button" class="share" aria-pressed=${String(view.screen)} data-intent=${view.screen ? i.StopShare : i.Share} ?disabled=${!running}>${icons.screen}<span class="label">Share screen</span></button></li>
      <li><button type="button" aria-label="Connection stats" data-intent=${i.OpenReport} ?disabled=${!running}>${icons.stats}<span class="label" aria-hidden="true">Stats</span></button></li>
      <li><button type="button" class="danger" data-intent=${i.Hangup} ?disabled=${!inCall}>${icons.hangup}<span class="label">Hang up</span></button></li>
    </menu>
  </section>`;
}

const clock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const messageRow = (message: ChatMessage): TemplateResult =>
  html`<li data-from=${message.from}><p><bdi>${message.text}</bdi></p><small>${message.from === "you" ? "You" : "Peer"} · <time datetime=${new Date(message.at).toISOString()}>${clock.format(message.at)}</time></small></li>`;

/** Chat over the call's data channel, as bubbles: yours on the inline end. */
export const chat = (model: CallUi, title: string, i: IntentNames<"Message" | "Send">) =>
  html`<section class="chat" aria-labelledby="chat-title">
    <header class="chat-head"><h2 id="chat-title">${title}</h2><p class="chip">Channel <output>${model.view.chatReady ? "open" : "closed"}</output></p></header>
    <ol id="messages" class="messages" aria-live="polite">${each(model.view.messages, (message) => message.id, messageRow)}</ol>
    <form class="composer" data-intent=${i.Send}><label for="message" class="visually-hidden">Message</label><input id="message" value=${model.message} maxlength="1024" autocomplete="off" placeholder="Say hello" data-intent=${i.Message}/><button type="submit" class="primary icon-button" ?disabled=${!model.view.chatReady}>${icons.send}<span class="visually-hidden">Send</span></button></form>
  </section>`;

const gauge = (
  id: string,
  term: string,
  value: number | null,
  unit: string,
  range: { readonly max: number; readonly low: number; readonly high: number },
) =>
  html`<div><dt id=${id}>${term}</dt><dd><output>${value === null ? "—" : `${value}${unit}`}</output>${value === null ? "" : html`<meter aria-labelledby=${id} min="0" max=${range.max} low=${range.low} high=${range.high} optimum="0" value=${Math.min(value, range.max)}></meter>`}</dd></div>`;
const rate = (kbps: number | null) =>
  kbps === null ? "" : kbps >= 1000 ? ` · ${(kbps / 1000).toFixed(1)} Mbps` : ` · ${kbps} kbps`;

/** The connection report as a modal dialog. It closes on Escape, its button or a backdrop click. */
export function reportDialog(model: CallUi, i: IntentNames<"CloseReport">): TemplateResult {
  const stats = model.view.stats;
  return html`<dialog class="report" closedby="any" aria-labelledby="report-title" ?modal=${model.reportOpen} data-intent-close=${i.CloseReport}>
    <header class="dialog-head"><hgroup><h2 id="report-title">Connection report</h2><p class="hint">Sampled from the native <code>RTCPeerConnection</code> every two seconds while this is open.</p></hgroup><button type="button" class="icon-button" data-intent=${i.CloseReport}>${icons.close}<span class="visually-hidden">Close report</span></button></header>
    ${
      stats
        ? html`<dl class="stats">
          ${gauge("stat-rtt", "Round-trip time", stats.roundTripMs, " ms", { max: 300, low: 90, high: 180 })}
          ${gauge("stat-loss", "Packet loss", stats.packetLossPercent, "%", { max: 5, low: 1, high: 2.5 })}
          ${gauge("stat-jitter", "Jitter", stats.jitterMs, " ms", { max: 60, low: 15, high: 30 })}
          <div><dt>Route</dt><dd><output>${stats.route ?? "—"}</output><small>Local → remote candidate · transport</small></dd></div>
          <div><dt>Outgoing</dt><dd><output>${formatBytes(stats.bytesSent)}</output><small>${stats.outgoingVideo ?? "No video"}${rate(stats.sentKbps)}</small></dd></div>
          <div><dt>Incoming</dt><dd><output>${formatBytes(stats.bytesReceived)}</output><small>${stats.incomingVideo ?? "No video"}${rate(stats.receivedKbps)}</small></dd></div>
        </dl>`
        : html`<p class="hint">Waiting for the first sample…</p>`
    }
    <details class="raw"><summary>Raw statistics</summary><pre id="report"><samp>${model.view.report || "No sample yet."}</samp></pre></details>
  </dialog>`;
}

/** Ticks while the report is open, so the dialog's figures stay current. */
export const reportClock = subscription<number, number>("report-clock", (emit, { input }) => {
  const timer = setInterval(() => emit(Date.now()), input);
  return () => clearInterval(timer);
});
