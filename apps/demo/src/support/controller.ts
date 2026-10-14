import type { SignalingState } from "@peerweave/signaling-websocket";
import { type CallAction, CallController, type CallView, callGuide } from "../call/controller.js";
export type InviteAction =
  | { readonly _tag: "Invite"; readonly audio: boolean; readonly video: boolean }
  | { readonly _tag: "AcceptInvite"; readonly audio: boolean; readonly video: boolean }
  | { readonly _tag: "DeclineInvite" }
  | { readonly _tag: "CancelInvite" };
type InviteKind = "support-invite" | "support-accept" | "support-decline" | "support-cancel";
export interface InvitationSignal {
  readonly version: 1;
  readonly sessionId: string;
  readonly kind: InviteKind;
  readonly id: string;
}
export function parseInvitation(input: unknown, sessionId: string): InvitationSignal | null {
  if (
    !input ||
    typeof input !== "object" ||
    !("kind" in input) ||
    typeof input.kind !== "string" ||
    !input.kind.startsWith("support-")
  )
    return null;
  if (
    !("version" in input) ||
    input.version !== 1 ||
    !("sessionId" in input) ||
    input.sessionId !== sessionId ||
    !("id" in input) ||
    typeof input.id !== "string" ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(input.id) ||
    !["support-invite", "support-accept", "support-decline", "support-cancel"].includes(input.kind)
  )
    throw new Error("Invalid or stale invitation.");
  return { version: 1, sessionId, kind: input.kind as InviteKind, id: input.id };
}
export function supportGuide(view: CallView): string {
  if (!view.paired)
    return view.relay === "waiting"
      ? "Waiting for your peer. Open this support example in another tab and join the same room."
      : "Join the same room in two tabs. One participant sends an invitation; the other accepts.";
  if (view.phase === "ended" || view.phase === "failed")
    return "This session ended. Both participants should leave and rejoin to make another call.";
  if (view.invitation === "outgoing")
    return "Your invitation is ringing. Waiting for your peer to accept; no devices are captured yet.";
  if (view.invitation === "incoming")
    return "Incoming call. Choose your media preferences, then accept or decline. No devices are captured before acceptance.";
  if (view.phase === "waiting")
    return "Your preview is ready. Waiting for your peer to finish any camera/microphone permission prompts.";
  if (view.invitation === "declined")
    return "The invitation was declined. You can send another invitation when your peer is ready.";
  if (view.invitation === "cancelled") return "The invitation was cancelled. You can invite again.";
  if (view.phase === "idle")
    return "Both participants joined. Press Invite peer in one tab, then Accept call in the other.";
  return callGuide(view);
}
export class SupportController extends CallController {
  private invitationId: string | undefined;
  private preferences = { audio: true, video: true };
  constructor(rtcConfiguration?: RTCConfiguration) {
    super("support-", rtcConfiguration);
  }
  protected override closeCall() {
    super.closeCall();
    this.invitationId = undefined;
    this.change({ invitation: "idle" });
  }
  protected override setupCall(session: NonNullable<SignalingState["session"]>) {
    super.setupCall(session);
    this.change({ invitation: "idle" });
  }
  private sendInvite(kind: InviteKind, id: string) {
    const session = this.signaling?.getState().session;
    if (!session || !this.signaling) throw new Error("Join the room with your peer first.");
    this.signaling.send({ version: 1, sessionId: session.sessionId, kind, id });
  }
  protected override async receive(signal: unknown) {
    const session = this.signaling?.getState().session;
    if (!session) return;
    const invitation = parseInvitation(signal, session.sessionId);
    if (!invitation) {
      const hangup =
        signal && typeof signal === "object" && "kind" in signal && signal.kind === "hangup";
      if (this.snapshot.invitation === "accepted" || hangup) await super.receive(signal);
      return;
    }
    if (invitation.kind === "support-invite") {
      if (this.snapshot.phase !== "idle" || this.snapshot.invitation === "accepted") {
        this.sendInvite("support-decline", invitation.id);
        return;
      }
      // On simultaneous invitations, the impolite endpoint's invitation wins deterministically.
      if (this.snapshot.invitation === "outgoing" && !session.polite) return;
      this.invitationId = invitation.id;
      this.change({ invitation: "incoming", feedback: "" });
      return;
    }
    if (invitation.id !== this.invitationId) return;
    if (invitation.kind === "support-accept") {
      if (this.snapshot.invitation === "cancelled") {
        this.sendInvite("support-cancel", invitation.id);
        return;
      }
      if (this.snapshot.invitation !== "outgoing") return;
      this.change({ invitation: "accepted" });
      await this.start(this.preferences.audio, this.preferences.video);
      return;
    }
    if (invitation.kind === "support-decline" && this.snapshot.invitation === "outgoing") {
      this.change({ invitation: "declined" });
      return;
    }
    if (invitation.kind === "support-cancel") {
      const started = this.snapshot.invitation === "accepted";
      this.change({ invitation: "cancelled" });
      if (started) await this.roomCall?.call.hangUp();
    }
  }
  override async act(action: CallAction | InviteAction) {
    if (this.disposed) return;
    switch (action._tag) {
      case "Invite":
        if (
          !this.snapshot.paired ||
          this.snapshot.phase !== "idle" ||
          ["incoming", "outgoing", "accepted"].includes(this.snapshot.invitation ?? "idle")
        )
          return;
        this.preferences = { audio: action.audio, video: action.video };
        this.invitationId = crypto.randomUUID();
        this.sendInvite("support-invite", this.invitationId);
        this.change({ invitation: "outgoing", feedback: "" });
        return;
      case "AcceptInvite":
        if (this.snapshot.invitation !== "incoming" || !this.invitationId) return;
        this.sendInvite("support-accept", this.invitationId);
        this.change({ invitation: "accepted" });
        await this.start(action.audio, action.video);
        return;
      case "DeclineInvite":
        if (this.snapshot.invitation === "incoming" && this.invitationId) {
          this.sendInvite("support-decline", this.invitationId);
          this.change({ invitation: "declined" });
        }
        return;
      case "CancelInvite":
        if (this.snapshot.invitation === "outgoing" && this.invitationId) {
          this.sendInvite("support-cancel", this.invitationId);
          this.change({ invitation: "cancelled" });
        }
        return;
      case "Start":
        if (this.snapshot.invitation !== "accepted")
          throw new Error("Accept the invitation before starting media.");
        await super.act(action);
        return;
      default:
        await super.act(action);
    }
  }
}
