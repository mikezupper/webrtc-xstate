import {
  type Command,
  command,
  define,
  defineDriver,
  each,
  html,
  type IntentInput,
  prop,
  type TemplateResult,
} from "@gyral/core";
import { mediaBinding } from "../shared/runtime.js";
import { footer, navigation, ROOM_PATTERN } from "../shared/shell.js";
import { type CallAction, type CallView, callGuide, initialCallView } from "./controller.js";
export interface CallModel {
  readonly room: string;
  readonly audio: boolean;
  readonly video: boolean;
  readonly message: string;
  readonly view: CallView;
}
export type CallMsg =
  | { readonly _tag: "Changed"; readonly view: CallView }
  | { readonly _tag: "Room"; readonly value: string }
  | { readonly _tag: "Message"; readonly value: string }
  | { readonly _tag: "Audio"; readonly checked: boolean }
  | { readonly _tag: "Video"; readonly checked: boolean }
  | { readonly _tag: "Action"; readonly action: CallAction }
  | { readonly _tag: "Failed"; readonly error: string };
export const callEvents = defineDriver<void, CallView>("example-events");
export const callActions = defineDriver<CallAction, void, string>("example-action");
export const act = (action: CallAction): Command<CallMsg> =>
  command(callActions, action, { onFailure: (error) => ({ _tag: "Failed", error }) });
export const roomInput = ({
  value,
}: IntentInput): Extract<CallMsg, { _tag: "Room" }> | undefined =>
  value === undefined ? undefined : { _tag: "Room", value };
const row = (message: { readonly id: number; readonly text: string }): TemplateResult =>
  html`<li><bdi>${message.text}</bdi></li>`;
export const Workbench = define<CallModel, CallMsg, { readonly initialRoom: string }>()(
  "peerweave-workbench",
  {
    shadow: false,
    props: { initialRoom: prop.string({ default: "hello" }) },
    init: (props) => ({
      room: props.initialRoom,
      audio: true,
      video: true,
      message: "",
      view: initialCallView,
    }),
    subscriptions: () => [
      command(callEvents, undefined, { onSuccess: (view): CallMsg => ({ _tag: "Changed", view }) }),
    ],
    intent: {
      Room: roomInput,
      Message: ({ value }) => ({ _tag: "Message", value: value ?? "" }),
      Audio: ({ target }) => ({
        _tag: "Audio",
        checked: target instanceof HTMLInputElement && target.checked,
      }),
      Video: ({ target }) => ({
        _tag: "Video",
        checked: target instanceof HTMLInputElement && target.checked,
      }),
      Join: (_input, ctx) =>
        /^[A-Za-z0-9_-]{1,64}$/.test(ctx.state.room)
          ? { _tag: "Action", action: { _tag: "Join", room: ctx.state.room } }
          : {
              _tag: "Failed",
              error: "Room names use 1–64 letters, numbers, hyphens or underscores.",
            },
      Start: (_input, ctx) => ({
        _tag: "Action",
        action: { _tag: "Start", audio: ctx.state.audio, video: ctx.state.video },
      }),
      Send: (_input, ctx) => ({
        _tag: "Action",
        action: { _tag: "Send", text: ctx.state.message.slice(0, 1024) },
      }),
      Leave: () => ({ _tag: "Action", action: { _tag: "Leave" } }),
      Hangup: () => ({ _tag: "Action", action: { _tag: "Hangup" } }),
      Mute: () => ({ _tag: "Action", action: { _tag: "Mute" } }),
      Camera: () => ({ _tag: "Action", action: { _tag: "Camera" } }),
      Share: () => ({ _tag: "Action", action: { _tag: "Share" } }),
      StopShare: () => ({ _tag: "Action", action: { _tag: "StopShare" } }),
      Stats: () => ({ _tag: "Action", action: { _tag: "Stats" } }),
    },
    update: {
      Changed: (state, message) => ({ ...state, view: message.view }),
      Room: (state, message) => ({ ...state, room: message.value }),
      Message: (state, message) => ({ ...state, message: message.value }),
      Audio: (state, message) => ({ ...state, audio: message.checked }),
      Video: (state, message) => ({ ...state, video: message.checked }),
      Failed: (state, message) => ({ ...state, view: { ...state.view, feedback: message.error } }),
      Action: (state, message) => [
        {
          ...state,
          ...(message.action._tag === "Send" ? { message: "" } : {}),
          view: { ...state.view, feedback: "" },
        },
        [act(message.action)],
      ],
    },
    view: (state, i) => {
      const view = state.view;
      const joined = ["connecting", "waiting", "ready"].includes(view.relay);
      const running = ["connecting", "active", "recovering"].includes(view.phase);
      const canHangup = running || ["starting", "waiting"].includes(view.phase);
      return html`${navigation("workbench")}<main id="main">
      <hgroup class="hero"><p class="eyebrow">THE CALL WORKBENCH</p><h1>A direct connection. A simple API.</h1><p>Two browser tabs, one room. Explore managed media and native data channels.</p></hgroup>
      <section class="instructions panel" aria-labelledby="instructions-title"><h2 id="instructions-title">How to connect</h2><ol><li>Open this page in two tabs. Enter the same room name and click <strong>Join room</strong> in each tab.</li><li>Click <strong>Start call in both tabs</strong>. Allow camera and microphone access, or turn both off for chat only.</li><li>Your preview appears while you wait. Once both are ready, the peer's media appears and <strong>Send</strong> becomes available.</li></ol><p>After a failed connection or hangup, leave and rejoin in both tabs for a fresh session.</p></section>
      <section class="panel" aria-labelledby="connection-title"><h2 id="connection-title">Connect to your peer</h2>
        <form id="join-form" data-intent=${i.Join}><label for="room">Room</label><input id="room" name="room" value=${state.room} data-intent=${i.Room} pattern=${ROOM_PATTERN} maxlength="64" required aria-describedby="room-help"/><button id="join" type="submit" ?disabled=${joined}>Join room</button></form>
        <p id="room-help" class="hint">Use the same room in both tabs. Letters, numbers, hyphens and underscores; up to 64 characters.</p><p class="status-line">Relay: <output id="relay-status">${view.relay}</output> · Call: <output id="call-status">${view.phase}</output></p><p id="next-step" role="status">${callGuide(view)}</p>
      </section>
      <section aria-labelledby="preview-title"><h2 id="preview-title">Live previews</h2><p id="live-media-note" class="hint">Live video has no automatic captions. Use text chat below for written communication.</p><div class="videos">
        <figure><video id="local" width="640" height="400" muted autoplay playsinline aria-describedby="live-media-note" ${mediaBinding("local", view.revision)}></video><figcaption>You</figcaption></figure>
        <figure><video id="remote" width="640" height="400" autoplay playsinline aria-describedby="live-media-note" ${mediaBinding("remote", view.revision)}></video><figcaption>Your peer</figcaption></figure>
      </div></section>
      <section class="panel" aria-labelledby="controls-title"><h2 id="controls-title">Call controls</h2><fieldset><legend>Before starting</legend><label><input id="audio" type="checkbox" ?checked=${state.audio} ?disabled=${view.requested} data-intent=${i.Audio}/> Microphone</label><label><input id="video" type="checkbox" ?checked=${state.video} ?disabled=${view.requested} data-intent=${i.Video}/> Camera</label></fieldset>
        <div class="controls"><button id="start" type="button" data-intent=${i.Start} ?disabled=${!view.paired || view.requested || view.phase !== "idle"}>Start call</button><button id="hangup" type="button" data-intent=${i.Hangup} ?disabled=${!canHangup}>Hang up</button><button type="button" data-intent=${i.Mute} ?disabled=${!running}>${view.microphone ? "Mute microphone" : "Unmute microphone"}</button><button type="button" data-intent=${i.Camera} ?disabled=${!running}>${view.camera ? "Pause camera" : "Resume camera"}</button><button type="button" data-intent=${i.Share} ?disabled=${!running || view.screen}>Share screen</button><button type="button" data-intent=${i.StopShare} ?disabled=${!view.screen}>Stop sharing</button><button type="button" data-intent=${i.Stats} ?disabled=${!running}>Connection stats</button><button id="leave" type="button" data-intent=${i.Leave} ?disabled=${!joined}>Leave room</button></div>
      </section><p id="feedback" role="alert">${view.feedback}</p>
      <section class="chat panel" aria-labelledby="chat-title"><h2 id="chat-title">Data channel</h2><ol id="messages" aria-live="polite">${each(view.messages, (message) => message.id, row)}</ol><form id="chat-form" data-intent=${i.Send}><label for="message">Message</label><input id="message" value=${state.message} maxlength="1024" data-intent=${i.Message} placeholder="Say hello"/><button id="send" type="submit" ?disabled=${!view.chatReady}>Send</button></form></section>
      <details class="panel"><summary>Connection report</summary><pre id="report"><samp>${view.report || "Use Connection stats during a call."}</samp></pre></details>
    </main>${footer()}`;
    },
  },
);
