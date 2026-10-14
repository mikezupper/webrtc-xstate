import {
  type Command,
  command,
  define,
  defineDriver,
  html,
  type IntentInput,
  prop,
} from "@gyral/core";
import { footer, help, hero, navigation, ROOM_PATTERN, weave } from "../shared/shell.js";
import { type CallAction, type CallView, callGuide, initialCallView } from "./controller.js";
import {
  type CallMood,
  callMood,
  chat,
  moodCopy,
  reportClock,
  reportDialog,
  stage,
} from "./parts.js";
export interface CallModel {
  readonly room: string;
  readonly audio: boolean;
  readonly video: boolean;
  readonly message: string;
  readonly reportOpen: boolean;
  readonly view: CallView;
}
export type CallMsg =
  | { readonly _tag: "Changed"; readonly view: CallView }
  | { readonly _tag: "Room"; readonly value: string }
  | { readonly _tag: "Message"; readonly value: string }
  | { readonly _tag: "Audio"; readonly checked: boolean }
  | { readonly _tag: "Video"; readonly checked: boolean }
  | { readonly _tag: "Action"; readonly action: CallAction }
  | { readonly _tag: "Report"; readonly open: boolean }
  | { readonly _tag: "Refresh" }
  | { readonly _tag: "Failed"; readonly error: string };
export const callEvents = defineDriver<void, CallView>("example-events");
export const callActions = defineDriver<CallAction, void, string>("example-action");
export const act = (action: CallAction): Command<CallMsg> =>
  command(callActions, action, { onFailure: (error) => ({ _tag: "Failed", error }) });
export const roomInput = ({
  value,
}: IntentInput): Extract<CallMsg, { _tag: "Room" }> | undefined =>
  value === undefined ? undefined : { _tag: "Room", value };
const callSteps = ["Join room", "Get ready", "Connect", "Live"];
const callStep: Record<CallMood, number> = {
  idle: 0,
  lobby: 0,
  ready: 1,
  ringing: 1,
  starting: 1,
  connecting: 2,
  active: 3,
  recovering: 3,
  failed: 3,
  ended: -1,
};
/** Stats refresh while the report is open during a running call. */
export const callSubscriptions = (state: CallModel) => [
  command(callEvents, undefined, { onSuccess: (view): CallMsg => ({ _tag: "Changed", view }) }),
  ...(state.reportOpen && ["connecting", "active", "recovering"].includes(state.view.phase)
    ? [command(reportClock, 2000, { onSuccess: (): CallMsg => ({ _tag: "Refresh" }) })]
    : []),
];
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
      reportOpen: false,
      view: initialCallView,
    }),
    subscriptions: callSubscriptions,
    // Screen sharing morphs your tile between camera and screen sizes.
    viewTransition: (prev, next) => prev.view.screen !== next.view.screen,
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
      OpenReport: () => ({ _tag: "Report", open: true }),
      CloseReport: () => ({ _tag: "Report", open: false }),
    },
    update: {
      Changed: (state, message) => ({ ...state, view: message.view }),
      Room: (state, message) => ({ ...state, room: message.value }),
      Message: (state, message) => ({ ...state, message: message.value }),
      Audio: (state, message) => ({ ...state, audio: message.checked }),
      Video: (state, message) => ({ ...state, video: message.checked }),
      Failed: (state, message) => ({ ...state, view: { ...state.view, feedback: message.error } }),
      Report: (state, message) =>
        message.open
          ? [{ ...state, reportOpen: true }, [act({ _tag: "Stats" })]]
          : { ...state, reportOpen: false },
      Refresh: (state) => [state, [act({ _tag: "Stats" })]],
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
      const mood = callMood(view);
      return html`${navigation("workbench")}<main id="main" data-phase=${mood}>
      <header class="hero-row">${hero("The call workbench", "A direct connection. A simple API.", "Two browser tabs, one room. Explore managed media and native data channels.")}${weave({ you: view.relay !== "offline", peer: view.paired, step: callStep[mood], steps: callSteps, label: moodCopy[mood].label })}</header>
      <section class="panel session" aria-labelledby="connection-title"><h2 id="connection-title">Connect to your peer</h2>
        <form class="join" data-intent=${i.Join}><label for="room">Room</label><input id="room" name="room" value=${state.room} data-intent=${i.Room} pattern=${ROOM_PATTERN} maxlength="64" required autocomplete="off" spellcheck="false" ?readonly=${joined} aria-describedby="room-help"/><button type="submit" class="primary" ?disabled=${joined}>Join room</button><button type="button" data-intent=${i.Leave} ?disabled=${!joined}>Leave room</button></form>
        <fieldset class="switches"><legend>Start with</legend><label class="switch"><input id="audio" type="checkbox" ?checked=${state.audio} ?disabled=${view.requested} data-intent=${i.Audio}/> Microphone</label><label class="switch"><input id="video" type="checkbox" ?checked=${state.video} ?disabled=${view.requested} data-intent=${i.Video}/> Camera</label></fieldset>
        <p id="room-help" class="hint">Use the same room in both tabs. Letters, numbers, hyphens and underscores; up to 64 characters.</p>
        <p class="chips"><span class="chip">Relay <output id="relay-status">${view.relay}</output></span><span class="chip">Call <output id="call-status">${view.phase}</output></span></p>
        <p id="next-step" class="next-step" role="status">${callGuide(view)}</p><p id="feedback" class="feedback" role="alert">${view.feedback}</p>
      </section>
      <div class="call-grid">${stage(state, mood, i, { start: true })}${chat(state, "Data channel", i)}</div>
      ${help("How to connect", html`<ol><li>Open this page in two tabs. Enter the same room name and click <strong>Join room</strong> in each tab.</li><li>Click <strong>Start call</strong> in both tabs. Allow camera and microphone access, or turn both off for chat only.</li><li>Your preview appears while you wait. Once both are ready, the peer's media appears and <strong>Send</strong> becomes available.</li></ol><p>After a failed connection or hangup, leave and rejoin in both tabs for a fresh session.</p>`)}
      ${reportDialog(state, i)}
    </main>${footer()}`;
    },
  },
);
