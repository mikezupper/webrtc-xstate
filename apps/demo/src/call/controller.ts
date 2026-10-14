import type { CallState } from "@peerweave/call";
import {
  createSignalingChannel,
  type SignalingChannel,
  type SignalingState,
} from "@peerweave/signaling-websocket";
import { createRoomCall, type RoomCall } from "../room-call.js";
import { errorText, Observable } from "../shared/runtime.js";
export interface CallView {
  readonly invitation?: "idle" | "incoming" | "outgoing" | "accepted" | "declined" | "cancelled";
  readonly relay: SignalingState["phase"] | "offline";
  readonly phase: CallState["phase"] | "waiting";
  readonly paired: boolean;
  readonly requested: boolean;
  readonly peerReady: boolean;
  readonly microphone: boolean;
  readonly camera: boolean;
  readonly screen: boolean;
  readonly chatReady: boolean;
  readonly messages: readonly { readonly id: number; readonly text: string }[];
  readonly feedback: string;
  readonly report: string;
  readonly revision: number;
}
export const initialCallView: CallView = {
  relay: "offline",
  phase: "idle",
  paired: false,
  requested: false,
  peerReady: false,
  microphone: false,
  camera: false,
  screen: false,
  chatReady: false,
  messages: [],
  feedback: "",
  report: "",
  revision: 0,
};
export type CallAction =
  | { readonly _tag: "Join"; readonly room: string }
  | { readonly _tag: "Start"; readonly audio: boolean; readonly video: boolean }
  | { readonly _tag: "Send"; readonly text: string }
  | { readonly _tag: "Leave" | "Hangup" | "Mute" | "Camera" | "Share" | "StopShare" | "Stats" };
export function callGuide(view: CallView): string {
  if (!view.paired)
    return view.relay === "waiting"
      ? "Waiting for a second participant. Open this page in another tab, enter the same room name and click Join room."
      : view.relay === "connecting"
        ? "Joining the room…"
        : "Join the same room in both tabs to begin.";
  if (view.phase === "waiting")
    return "You are ready. Waiting for the other participant to press Start call and finish any camera/microphone permission prompts.";
  if (view.phase === "idle")
    return view.peerReady
      ? "Your peer is ready. Press Start call here and allow camera/microphone access, or turn both off for chat only."
      : "Both participants joined. Press Start call in each tab; each participant must allow camera/microphone access or turn both off for chat only.";
  if (view.phase === "starting")
    return "Allow camera/microphone access in this tab. Your preview will appear while you wait for your peer.";
  if (view.phase === "connecting")
    return "Both participants are ready. Connecting media and the data channel…";
  if (view.phase === "active")
    return "Connected. Use the controls for media and Send below for chat.";
  if (view.phase === "recovering")
    return "The connection was interrupted. Attempting to reconnect…";
  return "This session ended. Both participants should leave and rejoin the same room to try again.";
}
export class CallController extends Observable<CallView> {
  protected signaling: SignalingChannel | undefined;
  protected roomCall: RoomCall | undefined;
  protected local: MediaStream | null = null;
  protected remote: MediaStream | null = null;
  protected disposed = false;
  private chat: RTCDataChannel | undefined;
  private nextMessage = 0;
  constructor(
    private readonly roomPrefix = "",
    private readonly rtcConfiguration?: RTCConfiguration,
  ) {
    super(initialCallView);
  }
  protected change(patch: Partial<CallView>) {
    if (!this.disposed)
      this.publish({ ...this.snapshot, ...patch, revision: this.snapshot.revision + 1 });
  }
  protected report(error: unknown) {
    this.change({ feedback: errorText(error) });
  }
  getStream(slot: "local" | "remote") {
    return slot === "local" ? this.local : this.remote;
  }
  private clearMedia() {
    this.local = null;
    this.remote = null;
    this.chat?.close();
    this.chat = undefined;
    this.change({ chatReady: false });
  }
  protected closeCall() {
    this.roomCall?.dispose();
    this.roomCall = undefined;
    this.clearMedia();
  }
  protected receive(signal: unknown) {
    return this.roomCall?.receiveSignal(signal);
  }
  protected setupCall(session: NonNullable<SignalingState["session"]>) {
    const channel = this.signaling;
    if (!channel) return;
    const current = createRoomCall({
      ...session,
      ...(this.rtcConfiguration ? { rtcConfiguration: this.rtcConfiguration } : {}),
      sendSignal: (signal) => channel.send(signal),
      onChange: () => update(current.call.getState()),
      onLocalStream: (stream) => {
        if (this.roomCall === current) {
          this.local = stream;
          this.change({});
        }
      },
    });
    const update = (state: CallState) => {
      if (this.roomCall !== current) return;
      if (state.phase === "ended" || state.phase === "failed") this.clearMedia();
      this.change({
        phase: current.waiting ? "waiting" : state.phase,
        paired: true,
        requested: current.requested,
        peerReady: current.peerReady,
        microphone: state.microphoneEnabled,
        camera: state.cameraEnabled,
        screen: state.screenSharing,
        ...(state.phase === "ended"
          ? { feedback: "Call ended. Leave and rejoin the room to start another session." }
          : {}),
      });
    };
    this.roomCall = current;
    current.call.on("error", (error) => this.report(error));
    current.call.on("track", (event) => {
      this.remote ??= new MediaStream();
      for (const old of this.remote.getTracks())
        if (old.kind === event.track.kind && old !== event.track) this.remote.removeTrack(old);
      if (!this.remote.getTracks().includes(event.track)) this.remote.addTrack(event.track);
      this.change({});
    });
    current.call.on("datachannel", (event) => this.attachChat(event.channel));
    current.call.subscribe(update);
  }
  private attachChat(channel: RTCDataChannel) {
    this.chat = channel;
    channel.onopen = () => this.change({ chatReady: true });
    channel.onclose = () => this.change({ chatReady: false });
    channel.onerror = () => this.report("The data channel closed unexpectedly.");
    channel.onmessage = (event) => {
      if (typeof event.data === "string") this.message(`Peer: ${event.data.slice(0, 1024)}`);
    };
    if (channel.readyState === "open") this.change({ chatReady: true });
  }
  private message(text: string) {
    this.change({
      messages: [...this.snapshot.messages, { id: this.nextMessage++, text }].slice(-100),
    });
  }
  protected join(room: string) {
    this.closeCall();
    this.signaling?.dispose();
    const url = new URL("/signaling", location.href);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    this.signaling = createSignalingChannel({ url: url.href, room: this.roomPrefix + room });
    this.signaling.onError((error) => this.report(error));
    this.signaling.onMessage((signal) => {
      void Promise.resolve(this.receive(signal)).catch((error) => this.report(error));
    });
    this.signaling.subscribe((state) => {
      this.change({ relay: state.phase });
      if (state.phase === "ready" && state.session) {
        this.closeCall();
        this.setupCall(state.session);
      } else {
        this.closeCall();
        this.change({ paired: false, requested: false });
      }
    });
    const address = new URL(location.href);
    address.searchParams.set("room", room);
    history.replaceState(null, "", address);
  }
  protected async start(audio: boolean, video: boolean) {
    const current = this.roomCall;
    if (!current) return;
    await current.start(audio || video ? { audio, video } : false);
    if (
      this.roomCall !== current ||
      !["connecting", "active", "recovering"].includes(current.call.getState().phase)
    )
      return;
    this.local = current.call.getLocalStream();
    if (this.signaling?.getState().session?.polite === false)
      this.attachChat(current.call.createDataChannel("chat"));
    this.change({});
  }
  async act(action: CallAction) {
    if (this.disposed) return;
    this.change({ feedback: "" });
    switch (action._tag) {
      case "Join":
        this.join(action.room);
        return;
      case "Start":
        await this.start(action.audio, action.video);
        return;
      case "Leave":
        this.closeCall();
        this.signaling?.dispose();
        this.signaling = undefined;
        this.change({
          relay: "offline",
          paired: false,
          requested: false,
          feedback: "",
        });
        return;
      case "Hangup":
        await this.roomCall?.call.hangUp();
        return;
      case "Mute":
        this.roomCall?.call.setMicrophoneEnabled(!this.snapshot.microphone);
        return;
      case "Camera":
        this.roomCall?.call.setCameraEnabled(!this.snapshot.camera);
        return;
      case "Share":
        await this.roomCall?.call.shareScreen();
        return;
      case "StopShare":
        await this.roomCall?.call.stopSharingScreen();
        return;
      case "Send":
        if (this.chat?.readyState !== "open") throw new Error("The data channel is not ready.");
        if (this.chat.bufferedAmount > 65536)
          throw new Error("Please wait for queued messages to send.");
        this.chat.send(action.text);
        this.message(`You: ${action.text}`);
        return;
      case "Stats": {
        const report = await this.roomCall?.call.getStats();
        const summaries: unknown[] = [];
        report?.forEach((item) => {
          if (["inbound-rtp", "outbound-rtp", "candidate-pair"].includes(item.type))
            summaries.push({
              type: item.type,
              kind: item.kind,
              state: item.state,
              bytesSent: item.bytesSent,
              bytesReceived: item.bytesReceived,
              packetsLost: item.packetsLost,
            });
        });
        this.change({ report: JSON.stringify(summaries, null, 2) });
        return;
      }
    }
  }
  dispose() {
    if (this.disposed) return;
    this.closeCall();
    this.signaling?.dispose();
    this.disposed = true;
    this.listeners.clear();
  }
}
