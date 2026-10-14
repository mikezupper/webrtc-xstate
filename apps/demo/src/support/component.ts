import { command, define, defineDriver, html } from "@gyral/core";
import { type CallModel, type CallMsg, Workbench } from "../call/component.js";
import type { CallView } from "../call/controller.js";
import { type CallMood, callMood, chat, moodCopy, reportDialog, stage } from "../call/parts.js";
import { EXAMPLE_ROOM_PATTERN, footer, help, hero, navigation, weave } from "../shared/shell.js";
import { type InviteAction, supportGuide } from "./controller.js";
export type SupportMsg =
  | CallMsg
  | { readonly _tag: "SupportAction"; readonly action: InviteAction };
export const supportActions = defineDriver<InviteAction, void, string>("example-action");
/** Like a call's mood, but ringing while an invitation waits for an answer. */
export function supportMood(view: CallView): CallMood {
  const mood = callMood(view);
  return mood === "ready" && (view.invitation === "incoming" || view.invitation === "outgoing")
    ? "ringing"
    : mood;
}
const supportSteps = ["Join room", "Invite", "Accept", "Live"];
const supportStep: Record<CallMood, number> = {
  idle: 0,
  lobby: 0,
  ready: 1,
  ringing: 2,
  starting: 3,
  connecting: 3,
  active: 3,
  recovering: 3,
  failed: 3,
  ended: -1,
};
const sharedIntents = Workbench.spec.intent;
if (!sharedIntents) throw new Error("The shared workbench intents are required.");
export const Support = define<CallModel, SupportMsg, { readonly initialRoom: string }>()(
  "peerweave-support",
  {
    ...Workbench.spec,
    intent: {
      ...sharedIntents,
      Join: (_input, ctx) =>
        /^[A-Za-z0-9_-]{1,48}$/.test(ctx.state.room)
          ? { _tag: "Action", action: { _tag: "Join", room: ctx.state.room } }
          : { _tag: "Failed", error: "Use 1–48 letters, numbers, underscores or hyphens." },
      Invite: (_input, ctx) => ({
        _tag: "SupportAction",
        action: { _tag: "Invite", audio: ctx.state.audio, video: ctx.state.video },
      }),
      AcceptInvite: (_input, ctx) => ({
        _tag: "SupportAction",
        action: { _tag: "AcceptInvite", audio: ctx.state.audio, video: ctx.state.video },
      }),
      DeclineInvite: () => ({ _tag: "SupportAction", action: { _tag: "DeclineInvite" } }),
      CancelInvite: () => ({ _tag: "SupportAction", action: { _tag: "CancelInvite" } }),
    },
    update: {
      ...Workbench.spec.update,
      SupportAction: (s, m) => [
        s,
        [
          command(supportActions, m.action, {
            onFailure: (error): SupportMsg => ({ _tag: "Failed", error }),
          }),
        ],
      ],
    },
    view: (s, i) => {
      const view = s.view;
      const joined = ["connecting", "waiting", "ready"].includes(view.relay);
      const mood = supportMood(view);
      const canInvite =
        view.paired &&
        view.phase === "idle" &&
        ["idle", "declined", "cancelled"].includes(view.invitation ?? "idle");
      const locked = view.invitation === "outgoing" || view.invitation === "accepted";
      return html`${navigation("support")}<main id="main" data-phase=${mood} data-invitation=${view.invitation ?? "idle"}>
      <header class="hero-row">${hero("Call · an explicit invitation", "A support call, on your terms.", "Invite a peer, let them choose, and connect when both sides are ready.")}${weave({ you: view.relay !== "offline", peer: view.paired, step: supportStep[mood], steps: supportSteps, label: view.invitation === "incoming" ? "Your peer is calling you" : moodCopy[mood].label })}</header>
      <section class="panel session" aria-labelledby="support-connect"><h2 id="support-connect">Room and invitation</h2>
        <form class="join" data-intent=${i.Join}><label for="room">Room</label><input id="room" value=${s.room} data-intent=${i.Room} pattern=${EXAMPLE_ROOM_PATTERN} maxlength="48" required autocomplete="off" spellcheck="false" ?readonly=${joined}/><button type="submit" class="primary" ?disabled=${joined}>Join room</button><button type="button" data-intent=${i.Leave} ?disabled=${!joined}>Leave room</button></form>
        <fieldset class="switches"><legend>Media</legend><label class="switch"><input id="audio" type="checkbox" ?checked=${s.audio} ?disabled=${locked} data-intent=${i.Audio}/> Microphone</label><label class="switch"><input id="video" type="checkbox" ?checked=${s.video} ?disabled=${locked} data-intent=${i.Video}/> Camera</label></fieldset>
        <menu class="actions invitation"><li><button type="button" class="primary" data-intent=${i.Invite} ?disabled=${!canInvite}>Invite peer</button></li><li><button type="button" class="primary answer" data-intent=${i.AcceptInvite} ?disabled=${view.invitation !== "incoming"}>Accept call</button></li><li><button type="button" data-intent=${i.DeclineInvite} ?disabled=${view.invitation !== "incoming"}>Decline call</button></li><li><button type="button" data-intent=${i.CancelInvite} ?disabled=${view.invitation !== "outgoing"}>Cancel invitation</button></li></menu>
        <p class="chips"><span class="chip">Invitation <output id="invitation-status">${view.invitation ?? "idle"}</output></span><span class="chip">Call <output id="call-status">${view.phase}</output></span></p>
        <p id="next-step" class="next-step" role="status">${supportGuide(view)}</p><p id="feedback" class="feedback" role="alert">${view.feedback}</p>
      </section>
      <div class="call-grid">${stage(s, mood, i, { start: false })}${chat(s, "Session chat", i)}</div>
      ${help("Try a support session", html`<ol><li>Open this example in two tabs and join the same room.</li><li>Choose media preferences. Press <strong>Invite peer</strong> in one tab; press <strong>Accept call</strong> in the other.</li><li>Allow camera/microphone access. Both previews must be ready before the connection starts.</li><li>Use chat or Share screen during the call. Hang up and leave/rejoin for another session.</li></ol><p>This reference demonstrates application invitations around <code>@peerweave/call</code>. The local relay does not authenticate participants.</p>`)}
      ${reportDialog(s, i)}
    </main>${footer()}`;
    },
  },
);
