import { createPeer, type Peer } from "@peerweave/peer";
import {
  createSignalingChannel,
  type SignalingChannel,
  type SignalingState,
} from "@peerweave/signaling-websocket";
import { errorText, Observable } from "../shared/runtime.js";
import { CHUNK_BYTES, drain, type FileControl, type FileOffer, parseControl } from "./protocol.js";
export interface TransferView {
  readonly relay: SignalingState["phase"] | "offline";
  readonly connection: RTCPeerConnectionState;
  readonly phase:
    | "idle"
    | "offered"
    | "sending"
    | "receiving"
    | "complete"
    | "cancelled"
    | "declined"
    | "failed";
  readonly direction: "none" | "incoming" | "outgoing";
  readonly file: { readonly name: string; readonly size: number } | null;
  readonly incoming: FileOffer | null;
  readonly bytes: number;
  readonly total: number;
  readonly ready: boolean;
  readonly download: { readonly name: string; readonly href: string } | null;
  readonly feedback: string;
  readonly revision: number;
}
export const initialTransferView: TransferView = {
  relay: "offline",
  connection: "new",
  phase: "idle",
  direction: "none",
  file: null,
  incoming: null,
  bytes: 0,
  total: 0,
  ready: false,
  download: null,
  feedback: "",
  revision: 0,
};
export type TransferAction =
  | { readonly _tag: "Join"; readonly room: string }
  | { readonly _tag: "Select"; readonly file: File }
  | { readonly _tag: "Offer" | "Accept" | "Reject" | "Cancel" | "Leave" };
interface Outgoing {
  readonly id: string;
  readonly file: File;
  readonly abort: AbortController;
  sending: boolean;
  finished: boolean;
}
interface Incoming {
  readonly offer: FileOffer;
  accepted: boolean;
  bytes: number;
  chunks: ArrayBuffer[];
}
export class TransferController extends Observable<TransferView> {
  private signaling: SignalingChannel | undefined;
  private peer: Peer | undefined;
  private channel: RTCDataChannel | undefined;
  private selected: File | undefined;
  private outgoing: Outgoing | undefined;
  private incoming: Incoming | undefined;
  private downloadURL: string | undefined;
  private disposed = false;
  constructor(private readonly rtcConfiguration?: RTCConfiguration) {
    super(initialTransferView);
  }
  private change(patch: Partial<TransferView>) {
    if (!this.disposed)
      this.publish({ ...this.snapshot, ...patch, revision: this.snapshot.revision + 1 });
  }
  getStream() {
    return null;
  }
  private control(value: FileControl) {
    if (this.channel?.readyState !== "open")
      throw new Error("Connect both tabs before transferring a file.");
    this.channel.send(JSON.stringify(value));
  }
  private cancel(phase: "cancelled" | "declined" = "cancelled", notify = true) {
    const id = this.outgoing?.id ?? this.incoming?.offer.id;
    this.outgoing?.abort.abort();
    this.outgoing = undefined;
    this.incoming = undefined;
    if (id && notify && this.channel?.readyState === "open")
      this.control({ kind: phase === "declined" ? "reject" : "cancel", id });
    if (id)
      this.change({
        phase,
        feedback:
          phase === "declined"
            ? "The file offer was declined."
            : "Transfer cancelled. No partial download is retained.",
      });
  }
  private revokeDownload() {
    if (this.downloadURL) URL.revokeObjectURL(this.downloadURL);
    this.downloadURL = undefined;
    this.change({ download: null });
  }
  private closePeer() {
    this.cancel("cancelled", false);
    const channel = this.channel;
    this.channel = undefined;
    if (channel) {
      channel.onopen = null;
      channel.onclose = null;
      channel.onerror = null;
      channel.onmessage = null;
      channel.close();
    }
    this.peer?.close();
    this.peer = undefined;
    this.change({ ready: false });
  }
  private fail(error: unknown) {
    this.closePeer();
    this.change({ phase: "failed", connection: "failed", feedback: errorText(error) });
  }
  private attach(channel: RTCDataChannel) {
    this.channel = channel;
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = 64 * 1024;
    const opened = () => {
      if (this.channel === channel) this.change({ ready: true });
    };
    channel.onopen = opened;
    channel.onclose = () => {
      if (this.channel === channel) {
        this.cancel("cancelled", false);
        this.change({ ready: false });
      }
    };
    channel.onerror = () => {
      if (this.channel === channel)
        this.fail(new Error("The file channel failed. Leave and rejoin both tabs."));
    };
    channel.onmessage = (event) => {
      if (this.channel !== channel) return;
      try {
        if (typeof event.data === "string") this.receive(parseControl(event.data));
        else if (event.data instanceof ArrayBuffer) this.chunk(event.data);
        else throw new Error("Unsupported transfer frame.");
      } catch (error) {
        this.fail(error);
      }
    };
    if (channel.readyState === "open") opened();
  }
  private receive(message: FileControl) {
    if (message.kind === "offer") {
      if (this.outgoing || this.incoming) {
        this.control({ kind: "reject", id: message.id });
        return;
      }
      this.incoming = { offer: message, accepted: false, bytes: 0, chunks: [] };
      this.change({
        incoming: message,
        phase: "offered",
        direction: "incoming",
        bytes: 0,
        total: message.size,
        feedback: "Your peer offered a file. Accept to receive it, or decline.",
      });
      return;
    }
    if (message.kind === "accept" && this.outgoing?.id === message.id && !this.outgoing.sending) {
      const outgoing = this.outgoing;
      outgoing.sending = true;
      void this.transmit(outgoing).catch((error) => {
        if (this.outgoing === outgoing && !outgoing.abort.signal.aborted) {
          this.cancel();
          this.change({ phase: "failed", feedback: errorText(error) });
        }
      });
      return;
    }
    if (
      (message.kind === "reject" || message.kind === "cancel") &&
      (this.outgoing?.id === message.id || this.incoming?.offer.id === message.id)
    ) {
      this.cancel(message.kind === "reject" ? "declined" : "cancelled", false);
      return;
    }
    if (message.kind === "finish" && this.incoming?.offer.id === message.id) {
      const incoming = this.incoming;
      if (!incoming.accepted || incoming.bytes !== incoming.offer.size)
        throw new Error("Incomplete file; no download was created.");
      this.revokeDownload();
      this.downloadURL = URL.createObjectURL(
        new Blob(incoming.chunks, { type: "application/octet-stream" }),
      );
      this.incoming = undefined;
      this.change({
        phase: "complete",
        bytes: incoming.offer.size,
        download: { name: incoming.offer.name, href: this.downloadURL },
        feedback: "File received. Download it below. Nothing was uploaded to the signaling server.",
      });
      this.control({ kind: "received", id: message.id });
      return;
    }
    if (message.kind === "received" && this.outgoing?.id === message.id) {
      if (!this.outgoing.finished)
        throw new Error("Unexpected receipt before the transfer finished.");
      const file = this.outgoing.file;
      this.outgoing = undefined;
      this.change({
        phase: "complete",
        bytes: file.size,
        feedback: "Your peer received the complete file.",
      });
    }
  }
  private chunk(data: ArrayBuffer) {
    const incoming = this.incoming;
    if (
      !incoming?.accepted ||
      data.byteLength !== Math.min(CHUNK_BYTES, incoming.offer.size - incoming.bytes) ||
      data.byteLength === 0
    )
      throw new Error("Unexpected or oversized file chunk.");
    incoming.chunks.push(data);
    incoming.bytes += data.byteLength;
    this.change({ bytes: incoming.bytes });
  }
  private async transmit(outgoing: Outgoing) {
    const channel = this.channel;
    if (!channel) return;
    this.change({
      phase: "sending",
      feedback: "Sending bounded chunks; waiting when the native channel queue is full.",
    });
    for (let offset = 0; offset < outgoing.file.size; offset += CHUNK_BYTES) {
      await drain(channel, outgoing.abort.signal);
      const chunk = await outgoing.file.slice(offset, offset + CHUNK_BYTES).arrayBuffer();
      if (outgoing.abort.signal.aborted || this.outgoing !== outgoing) return;
      channel.send(chunk);
      this.change({ bytes: offset + chunk.byteLength });
    }
    if (this.outgoing === outgoing && !outgoing.abort.signal.aborted) {
      outgoing.finished = true;
      this.control({ kind: "finish", id: outgoing.id });
    }
  }
  private join(room: string) {
    this.closePeer();
    this.signaling?.dispose();
    this.revokeDownload();
    const url = new URL("/signaling", location.href);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    this.signaling = createSignalingChannel({ url: url.href, room: `files-${room}` });
    this.signaling.onError((error) => this.fail(error));
    this.signaling.onMessage((signal) => {
      void this.peer?.receiveSignal(signal).catch((error) => this.fail(error));
    });
    this.signaling.subscribe((state) => {
      this.change({ relay: state.phase });
      this.closePeer();
      if (state.phase !== "ready" || !state.session) {
        this.change({ connection: "new" });
        return;
      }
      const transport = this.signaling;
      if (!transport) return;
      const peer = createPeer({
        ...state.session,
        ...(this.rtcConfiguration ? { rtcConfiguration: this.rtcConfiguration } : {}),
        sendSignal: (signal) => transport.send(signal),
      });
      this.peer = peer;
      peer.on("error", (error) => this.fail(error));
      peer.on("datachannel", (event) => {
        if (this.peer === peer) this.attach(event.channel);
      });
      peer.subscribe((native) => {
        if (this.peer === peer) this.change({ connection: native.connectionState });
      });
      this.change({
        phase: "idle",
        feedback: "Paired. Waiting for the native data channel to open.",
      });
      if (!state.session.polite) this.attach(peer.createDataChannel("peerweave-file-v1"));
    });
  }
  act(action: TransferAction) {
    if (this.disposed) return;
    switch (action._tag) {
      case "Join":
        this.join(action.room);
        return;
      case "Select":
        if (this.outgoing || this.incoming)
          throw new Error("Finish or cancel the current transfer before choosing a file.");
        parseControl(
          JSON.stringify({
            kind: "offer",
            id: "check",
            name: action.file.name,
            size: action.file.size,
          }),
        );
        this.selected = action.file;
        this.change({
          file: { name: action.file.name, size: action.file.size },
          feedback: "File selected. Offer it when your peer is connected.",
        });
        return;
      case "Offer":
        if (!this.selected || this.outgoing || this.incoming)
          throw new Error("Select a file and finish any current transfer first.");
        this.outgoing = {
          id: crypto.randomUUID(),
          file: this.selected,
          abort: new AbortController(),
          sending: false,
          finished: false,
        };
        try {
          this.control({
            kind: "offer",
            id: this.outgoing.id,
            name: this.selected.name,
            size: this.selected.size,
          });
        } catch (error) {
          this.outgoing = undefined;
          throw error;
        }
        this.change({
          phase: "offered",
          direction: "outgoing",
          bytes: 0,
          total: this.selected.size,
          incoming: null,
          feedback: "Waiting for your peer to accept the file.",
        });
        return;
      case "Accept":
        if (!this.incoming || this.incoming.accepted) return;
        this.revokeDownload();
        this.incoming.accepted = true;
        this.change({ phase: "receiving", feedback: "Receiving file chunks…" });
        this.control({ kind: "accept", id: this.incoming.offer.id });
        return;
      case "Reject":
        this.cancel("declined");
        return;
      case "Cancel":
        this.cancel();
        return;
      case "Leave":
        this.closePeer();
        this.signaling?.dispose();
        this.signaling = undefined;
        this.revokeDownload();
        this.change({ relay: "offline", connection: "closed" });
        return;
    }
  }
  dispose() {
    if (this.disposed) return;
    this.closePeer();
    this.signaling?.dispose();
    this.revokeDownload();
    this.selected = undefined;
    this.disposed = true;
    this.listeners.clear();
  }
}
