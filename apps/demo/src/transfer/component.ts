import { command, define, defineDriver, html, prop } from "@gyral/core";
import { icons } from "../shared/icons.js";
import { fileDrop } from "../shared/runtime.js";
import {
  EXAMPLE_ROOM_PATTERN,
  footer,
  formatBytes,
  help,
  hero,
  navigation,
  weave,
} from "../shared/shell.js";
import { initialTransferView, type TransferAction, type TransferView } from "./controller.js";
export interface TransferModel {
  readonly room: string;
  readonly view: TransferView;
}
export type TransferMsg =
  | { readonly _tag: "Changed"; readonly view: TransferView }
  | { readonly _tag: "Room"; readonly value: string }
  | { readonly _tag: "Action"; readonly action: TransferAction }
  | { readonly _tag: "Failed"; readonly error: string };
export type TransferMood =
  | "idle"
  | "lobby"
  | "ready"
  | "offered"
  | "sending"
  | "complete"
  | "failed";
/** The page's mood, as `main[data-phase]`: it picks the hue and the thread's motion. */
export function transferMood(view: TransferView): TransferMood {
  if (view.phase === "failed") return "failed";
  if (!view.ready) return view.relay === "offline" ? "idle" : "lobby";
  if (view.phase === "offered") return "offered";
  if (view.phase === "sending" || view.phase === "receiving") return "sending";
  if (view.phase === "complete") return "complete";
  return "ready";
}
const transferSteps = ["Join room", "Offer", "Accept", "Transfer"];
const transferStep: Record<TransferMood, number> = {
  idle: 0,
  lobby: 0,
  ready: 1,
  offered: 2,
  sending: 3,
  complete: 4,
  failed: 3,
};
const moodLabel: Record<TransferMood, string> = {
  idle: "Not connected",
  lobby: "Waiting for your peer to join",
  ready: "Data channel open between you and your peer",
  offered: "A file offer is waiting for an answer",
  sending: "Bytes are flowing between you and your peer",
  complete: "Transfer complete",
  failed: "Connection failed",
};
const extension = (name: string) =>
  name.includes(".") ? (name.split(".").pop() ?? "").slice(0, 4) : "file";
export const transferActions = defineDriver<TransferAction, void, string>("example-action");
const transferEvents = defineDriver<void, TransferView>("example-events");
export const Transfer = define<TransferModel, TransferMsg, { readonly initialRoom: string }>()(
  "peerweave-transfer",
  {
    shadow: false,
    props: { initialRoom: prop.string({ default: "hello" }) },
    init: (props) => ({ room: props.initialRoom, view: initialTransferView }),
    subscriptions: () => [
      command(transferEvents, undefined, {
        onSuccess: (view): TransferMsg => ({ _tag: "Changed", view }),
      }),
    ],
    intent: {
      Room: ({ value }) => ({ _tag: "Room", value: value ?? "" }),
      Join: (_input, ctx) =>
        /^[A-Za-z0-9_-]{1,48}$/.test(ctx.state.room)
          ? { _tag: "Action", action: { _tag: "Join", room: ctx.state.room } }
          : { _tag: "Failed", error: "Use 1–48 letters, numbers, underscores or hyphens." },
      Select: ({ target }) => {
        const file = target instanceof HTMLInputElement ? target.files?.[0] : undefined;
        return file ? { _tag: "Action", action: { _tag: "Select", file } } : undefined;
      },
      Offer: () => ({ _tag: "Action", action: { _tag: "Offer" } }),
      Accept: () => ({ _tag: "Action", action: { _tag: "Accept" } }),
      Reject: () => ({ _tag: "Action", action: { _tag: "Reject" } }),
      Cancel: () => ({ _tag: "Action", action: { _tag: "Cancel" } }),
      Leave: () => ({ _tag: "Action", action: { _tag: "Leave" } }),
    },
    update: {
      Changed: (s, m) => ({ ...s, view: m.view }),
      Room: (s, m) => ({ ...s, room: m.value }),
      Failed: (s, m) => ({ ...s, view: { ...s.view, feedback: m.error } }),
      Action: (s, m) => [
        s,
        [
          command(transferActions, m.action, {
            onFailure: (error): TransferMsg => ({ _tag: "Failed", error }),
          }),
        ],
      ],
    },
    view: (s, i) => {
      const view = s.view;
      const joined = ["connecting", "waiting", "ready"].includes(view.relay);
      const busy = ["offered", "sending", "receiving"].includes(view.phase);
      const incoming = view.direction === "incoming" && view.phase === "offered";
      const mood = transferMood(view);
      const percent = view.total ? Math.floor((view.bytes / view.total) * 100) : 0;
      const moving = view.direction === "incoming" ? view.incoming : view.file;
      return html`${navigation("transfer")}<main id="main" data-phase=${mood} data-direction=${view.direction}>
      <header class="hero-row">${hero("Peer · native binary data", "Send a file directly.", "Offer, accept, transfer. Native data channels carry the bytes between your browsers.")}${weave({ you: view.relay !== "offline", peer: view.ready, step: transferStep[mood], steps: transferSteps, label: moodLabel[mood] })}</header>
      <section class="panel session" aria-labelledby="file-connect-title"><h2 id="file-connect-title">Connect the browsers</h2>
        <form class="join" data-intent=${i.Join}><label for="room">Room</label><input id="room" value=${s.room} data-intent=${i.Room} pattern=${EXAMPLE_ROOM_PATTERN} maxlength="48" required autocomplete="off" spellcheck="false" ?readonly=${joined}/><button type="submit" class="primary" ?disabled=${joined}>Join room</button><button type="button" data-intent=${i.Leave} ?disabled=${!joined}>Leave room</button></form>
        <p class="chips"><span class="chip">Relay <output>${view.relay}</output></span><span class="chip">Connection <output id="connection-status">${view.connection}</output></span><span class="chip">Channel <output>${view.ready ? "open" : "waiting"}</output></span></p>
        <p class="hint">Both tabs must join this file-transfer example. After a failed connection, leave and rejoin in both.</p>
      </section>
      <div class="transfer-grid">
        <section class="panel" aria-labelledby="send-title"><h2 id="send-title">Send a file</h2>
          <label class="drop" for="file" ${fileDrop()}>${icons.upload}<strong>File to send</strong><span>Choose a file or drop it here · up to 32 MiB</span><input id="file" class="visually-hidden" type="file" data-intent=${i.Select} data-intent-on="change" ?disabled=${busy}/></label>
          ${view.file ? html`<p class="file-card"><span class="ext" aria-hidden="true">${extension(view.file.name)}</span><span><bdi>${view.file.name}</bdi><small>${formatBytes(view.file.size)}</small></span></p>` : html`<p class="file-card" data-empty><span class="ext" aria-hidden="true">—</span><span><bdi>No file chosen</bdi><small>Choose a file up to 32 MiB.</small></span></p>`}
          <button type="button" class="primary" data-intent=${i.Offer} ?disabled=${!view.ready || !view.file || busy}>Offer file</button>
        </section>
        <section class="panel" aria-labelledby="receive-title"><h2 id="receive-title">Receive a file</h2>
          <p class="file-card offer-card" ?data-empty=${!view.incoming} ?data-ringing=${incoming}><span class="ext" aria-hidden="true">${view.incoming ? extension(view.incoming.name) : "—"}</span><span><bdi id="incoming-name">${view.incoming?.name ?? "No incoming offer yet."}</bdi><small>${view.incoming ? formatBytes(view.incoming.size) : "Your peer's offers appear here."}</small></span></p>
          <menu class="actions"><li><button type="button" class="primary" data-intent=${i.Accept} ?disabled=${!incoming}>Accept file</button></li><li><button type="button" data-intent=${i.Reject} ?disabled=${!incoming}>Decline file</button></li><li><button type="button" data-intent=${i.Cancel} ?disabled=${!busy}>Cancel transfer</button></li></menu>
          <p class="hint">Your peer must accept before any file bytes are sent. Files are buffered in the receiving browser.</p>
        </section>
        <section class="panel" aria-labelledby="progress-title"><h2 id="progress-title">Transfer progress</h2>
          <p class="ring" style=${`--pct: ${percent}`} aria-hidden="true"></p>
          <p class="ring-file"><bdi>${moving?.name ?? ""}</bdi></p>
          <p class="chips"><span class="chip">Status <output id="transfer-status">${view.phase}</output></span></p>
          <p class="progress-meta"><label for="transfer-progress">${formatBytes(view.bytes)} of ${formatBytes(view.total)}</label><progress id="transfer-progress" max=${Math.max(1, view.total)} value=${view.bytes}></progress></p>
          <p id="feedback" class="feedback" role="status">${view.feedback}</p>
          ${view.download ? html`<a class="button primary" href=${view.download.href} download=${view.download.name}>${icons.download}<span>Download <bdi>${view.download.name}</bdi></span></a>` : ""}
        </section>
      </div>
      ${help("Try a transfer", html`<ol><li>Open this example in two tabs and join the same room. The data channel opens automatically.</li><li>Choose a file, then press <strong>Offer file</strong>. Your peer must accept before any file bytes are sent.</li><li>Follow progress, cancel if needed, and download the completed file in the receiving tab.</li></ol><p>Uses <code>@peerweave/peer</code> with a native <code>RTCDataChannel</code>. Files are limited to 32 MiB and buffered in the receiving browser. The signaling relay receives session setup only.</p>`)}
    </main>${footer()}`;
    },
  },
);
