import { command, define, defineDriver, each, html, type TemplateResult } from "@gyral/core";
import { type CallModel, type CallMsg, Workbench } from "../call/component.js";
import { mediaBinding } from "../shared/runtime.js";
import { EXAMPLE_ROOM_PATTERN, footer, navigation } from "../shared/shell.js";
import { type InviteAction, supportGuide } from "./controller.js";
export type SupportMsg =
  | CallMsg
  | { readonly _tag: "SupportAction"; readonly action: InviteAction };
export const supportActions = defineDriver<InviteAction, void, string>("example-action");
const row = (message: { readonly id: number; readonly text: string }): TemplateResult =>
  html`<li><bdi>${message.text}</bdi></li>`;
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
      const running = ["connecting", "active", "recovering"].includes(view.phase);
      const canInvite =
        view.paired &&
        view.phase === "idle" &&
        ["idle", "declined", "cancelled"].includes(view.invitation ?? "idle");
      return html`${navigation("support")}<main id="main"><hgroup class="hero"><p class="eyebrow">CALL / AN EXPLICIT INVITATION</p><h1>A support call, on your terms.</h1><p>Invite a peer, let them choose, and connect when both sides are ready.</p></hgroup>
      <section class="instructions panel" aria-labelledby="support-instructions"><h2 id="support-instructions">Try a support session</h2><ol><li>Open this example in two tabs and join the same room.</li><li>Choose media preferences. Press <strong>Invite peer</strong> in one tab; press <strong>Accept call</strong> in the other.</li><li>Allow camera/microphone access. Both previews must be ready before the connection starts.</li><li>Use chat or Share screen during the call. Hang up and leave/rejoin for another session.</li></ol><p class="hint">This reference demonstrates application invitations around <code>@peerweave/call</code>. The local relay does not authenticate participants.</p></section>
      <section class="panel" aria-labelledby="support-connect"><h2 id="support-connect">Room and invitation</h2><form data-intent=${i.Join}><label for="room">Room</label><input id="room" value=${s.room} data-intent=${i.Room} pattern=${EXAMPLE_ROOM_PATTERN} maxlength="48" required/><button id="join" type="submit" ?disabled=${joined}>Join room</button><button type="button" data-intent=${i.Leave} ?disabled=${!joined}>Leave room</button></form>
      <fieldset><legend>Media preferences</legend><label><input id="audio" type="checkbox" ?checked=${s.audio} ?disabled=${view.invitation === "outgoing" || view.invitation === "accepted"} data-intent=${i.Audio}/> Microphone</label><label><input id="video" type="checkbox" ?checked=${s.video} ?disabled=${view.invitation === "outgoing" || view.invitation === "accepted"} data-intent=${i.Video}/> Camera</label></fieldset><div class="controls"><button type="button" class="primary" data-intent=${i.Invite} ?disabled=${!canInvite}>Invite peer</button><button type="button" data-intent=${i.AcceptInvite} ?disabled=${view.invitation !== "incoming"}>Accept call</button><button type="button" data-intent=${i.DeclineInvite} ?disabled=${view.invitation !== "incoming"}>Decline call</button><button type="button" data-intent=${i.CancelInvite} ?disabled=${view.invitation !== "outgoing"}>Cancel invitation</button></div>
      <p class="status-line">Invitation: <output id="invitation-status">${view.invitation ?? "idle"}</output> · Call: <output id="call-status">${view.phase}</output></p><p id="next-step" role="status">${supportGuide(view)}</p></section>
      <section aria-labelledby="support-video"><h2 id="support-video">Live media</h2><p id="live-media-note" class="hint">Live calls have no automatic captions. Use the text chat below for written communication.</p><div class="videos"><figure><video id="local" width="640" height="400" muted autoplay playsinline aria-describedby="live-media-note" ${mediaBinding("local", view.revision)}></video><figcaption>You</figcaption></figure><figure><video id="remote" width="640" height="400" autoplay playsinline aria-describedby="live-media-note" ${mediaBinding("remote", view.revision)}></video><figcaption>Your peer</figcaption></figure></div></section>
      <section class="panel" aria-labelledby="support-controls"><h2 id="support-controls">During the call</h2><div class="controls"><button type="button" data-intent=${i.Hangup} ?disabled=${!running && view.phase !== "starting" && view.phase !== "waiting"}>Hang up</button><button type="button" data-intent=${i.Mute} ?disabled=${!running}>${view.microphone ? "Mute microphone" : "Unmute microphone"}</button><button type="button" data-intent=${i.Camera} ?disabled=${!running}>${view.camera ? "Pause camera" : "Resume camera"}</button><button type="button" data-intent=${i.Share} ?disabled=${!running || view.screen}>Share screen</button><button type="button" data-intent=${i.StopShare} ?disabled=${!view.screen}>Stop sharing</button><button type="button" data-intent=${i.Stats} ?disabled=${!running}>Connection stats</button></div></section>
      <p id="feedback" role="alert">${view.feedback}</p><section class="panel" aria-labelledby="support-chat"><h2 id="support-chat">Session chat</h2><ol id="messages" aria-live="polite">${each(view.messages, (message) => message.id, row)}</ol><form data-intent=${i.Send}><label for="message">Message</label><input id="message" value=${s.message} data-intent=${i.Message} maxlength="1024"/><button type="submit" ?disabled=${!view.chatReady}>Send</button></form></section><details class="panel"><summary>Connection report</summary><pre id="report"><samp>${view.report || "Use Connection stats during the call."}</samp></pre></details>
    </main>${footer()}`;
    },
  },
);
