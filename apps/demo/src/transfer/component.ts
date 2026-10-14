import { command, define, defineDriver, html, prop } from "@gyral/core";
import { EXAMPLE_ROOM_PATTERN, footer, formatBytes, navigation } from "../shared/shell.js";
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
      const joined = ["connecting", "waiting", "ready"].includes(s.view.relay);
      const busy = ["offered", "sending", "receiving"].includes(s.view.phase);
      const incoming = s.view.direction === "incoming" && s.view.phase === "offered";
      return html`${navigation("transfer")}<main id="main"><hgroup class="hero"><p class="eyebrow">PEER / NATIVE BINARY DATA</p><h1>Send a file directly.</h1><p>Offer, accept, transfer. Native data channels carry the bytes between your browsers.</p></hgroup>
      <section class="panel" aria-labelledby="file-instructions"><h2 id="file-instructions">Try a transfer</h2><ol><li>Open this example in two tabs and join the same room. The data channel opens automatically.</li><li>Choose a file, then press <strong>Offer file</strong>. Your peer must accept before any file bytes are sent.</li><li>Follow progress, cancel if needed, and download the completed file in the receiving tab.</li></ol><p class="hint">Uses <code>@peerweave/peer</code> with a native <code>RTCDataChannel</code>. Files are limited to 32 MiB and buffered in the receiving browser. The signaling relay receives session setup only.</p></section>
      <section class="panel" aria-labelledby="file-connect-title"><h2 id="file-connect-title">Connect the browsers</h2><form data-intent=${i.Join}><label for="room">Room</label><input id="room" value=${s.room} data-intent=${i.Room} pattern=${EXAMPLE_ROOM_PATTERN} maxlength="48" required/><button id="join" type="submit" ?disabled=${joined}>Join room</button><button type="button" data-intent=${i.Leave} ?disabled=${!joined}>Leave room</button></form><p class="status-line">Relay: <output>${s.view.relay}</output> · Connection: <output id="connection-status">${s.view.connection}</output> · Channel: <output>${s.view.ready ? "open" : "waiting"}</output></p><p class="hint">Both tabs must join this file-transfer example. After a failed connection, leave and rejoin in both.</p></section>
      <section class="panel" aria-labelledby="send-title"><h2 id="send-title">Send a file</h2><label for="file">File to send</label><input id="file" type="file" data-intent=${i.Select} data-intent-on="change" ?disabled=${busy}/><p class="hint">${s.view.file ? `${s.view.file.name} · ${formatBytes(s.view.file.size)}` : "Choose a file up to 32 MiB."}</p><button type="button" class="primary" data-intent=${i.Offer} ?disabled=${!s.view.ready || !s.view.file || busy}>Offer file</button></section>
      <section class="panel" aria-labelledby="receive-title"><h2 id="receive-title">Receive a file</h2><p id="incoming-name"><bdi>${s.view.incoming?.name ?? "No incoming offer yet."}</bdi></p><div class="controls"><button type="button" data-intent=${i.Accept} ?disabled=${!incoming}>Accept file</button><button type="button" data-intent=${i.Reject} ?disabled=${!incoming}>Decline file</button><button type="button" data-intent=${i.Cancel} ?disabled=${!busy}>Cancel transfer</button></div></section>
      <section class="panel" aria-labelledby="progress-title"><h2 id="progress-title">Transfer progress</h2><p class="status-line">Status: <output id="transfer-status">${s.view.phase}</output></p><label for="transfer-progress">${formatBytes(s.view.bytes)} of ${formatBytes(s.view.total)}</label><progress id="transfer-progress" max=${Math.max(1, s.view.total)} value=${s.view.bytes}></progress><p id="feedback" role="status">${s.view.feedback}</p>${s.view.download ? html`<a class="download" href=${s.view.download.href} download=${s.view.download.name}>Download <bdi>${s.view.download.name}</bdi></a>` : ""}</section>
    </main>${footer()}`;
    },
  },
);
