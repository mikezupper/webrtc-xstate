import { command, define, defineDriver, each, html, type TemplateResult } from "@gyral/core";
import { icons } from "../shared/icons.js";
import { audioLevel, mediaBinding } from "../shared/runtime.js";
import { footer, help, hero, navigation } from "../shared/shell.js";
import {
  type DeviceChoice,
  initialMediaView,
  type MediaAction,
  type MediaView,
  type TrackInfo,
} from "./controller.js";
export interface MediaModel {
  readonly audio: boolean;
  readonly video: boolean;
  readonly camera: string;
  readonly microphone: string;
  readonly view: MediaView;
}
export type MediaMsg =
  | { readonly _tag: "Changed"; readonly view: MediaView }
  | { readonly _tag: "Prefs"; readonly field: "audio" | "video"; readonly checked: boolean }
  | { readonly _tag: "Device"; readonly field: "camera" | "microphone"; readonly id: string }
  | { readonly _tag: "Action"; readonly action: MediaAction }
  | { readonly _tag: "Failed"; readonly error: string };
export const mediaActions = defineDriver<MediaAction, void, string>("example-action");
const mediaEvents = defineDriver<void, MediaView>("example-events");
/** The page's mood, as `main[data-phase]`: it picks the hue and the preview ring's motion. */
export const mediaMood = (view: MediaView) => (view.phase === "ready" ? "live" : view.phase);
const deviceRow = (device: DeviceChoice, selected: boolean): TemplateResult =>
  html`<option value=${device.id} ?selected=${selected}>${device.label}</option>`;
const trackRow = (track: TrackInfo): TemplateResult =>
  html`<li><b>${track.kind}</b> <bdi>${track.label}</bdi>${track.detail ? html` <small>${track.detail}</small>` : ""}</li>`;
const emptyPreview = {
  idle: "Your camera is off",
  preparing: "Waiting for permission…",
  ready: "",
  failed: "Preview unavailable",
} as const;
export const Preflight = define<MediaModel, MediaMsg>()("peerweave-preflight", {
  shadow: false,
  init: () => ({ audio: true, video: true, camera: "", microphone: "", view: initialMediaView }),
  subscriptions: () => [
    command(mediaEvents, undefined, { onSuccess: (view): MediaMsg => ({ _tag: "Changed", view }) }),
  ],
  intent: {
    Prefs: ({ target }) =>
      target instanceof HTMLInputElement && (target.name === "audio" || target.name === "video")
        ? { _tag: "Prefs", field: target.name, checked: target.checked }
        : undefined,
    Device: ({ target, value }) =>
      target instanceof HTMLSelectElement &&
      (target.name === "camera" || target.name === "microphone")
        ? { _tag: "Device", field: target.name, id: value ?? "" }
        : undefined,
    Preview: (_input, ctx) => ({
      _tag: "Action",
      action: {
        _tag: "Preview",
        audio: ctx.state.audio,
        video: ctx.state.video,
        camera: ctx.state.camera,
        microphone: ctx.state.microphone,
      },
    }),
    Stop: () => ({ _tag: "Action", action: { _tag: "Stop" } }),
    Devices: () => ({ _tag: "Action", action: { _tag: "Devices" } }),
  },
  update: {
    Changed: (s, m) => ({ ...s, view: m.view }),
    Prefs: (s, m) => ({ ...s, [m.field]: m.checked }),
    Device: (s, m) => ({ ...s, [m.field]: m.id }),
    Failed: (s, m) => ({ ...s, view: { ...s.view, feedback: m.error } }),
    Action: (s, m) => [
      s,
      [
        command(mediaActions, m.action, {
          onFailure: (error): MediaMsg => ({ _tag: "Failed", error }),
        }),
      ],
    ],
  },
  view: (s, i) => {
    const phase = s.view.phase;
    const video = s.view.tracks.some((track) => track.kind === "video");
    const preview = phase !== "ready" ? "none" : video ? "video" : "audio";
    const devices = (kind: DeviceChoice["kind"], selected: string) =>
      each(
        s.view.devices.filter((device) => device.kind === kind),
        (device) => device.id,
        deviceRow,
        (device) => device.id === selected,
      );
    return html`${navigation("media")}<main id="main" data-phase=${mediaMood(s.view)}>
    <header class="hero-row">${hero("Media · no connection required", "Check your camera and microphone.", "Select your devices, try a local preview, and release them when you are done.")}</header>
    <div class="media-grid" ${audioLevel("local", s.view.revision)}>
      <section class="mirror-section" aria-labelledby="local-preview-title"><h2 id="local-preview-title" class="visually-hidden">Local preview</h2>
        <figure class="mirror" data-view=${preview}><div class="mirror-frame"><video id="local" width="640" height="400" muted autoplay playsinline ${mediaBinding("local", s.view.revision)}></video><span class="audio-orb" aria-hidden="true"></span><p class="mirror-empty" aria-hidden="true">${phase === "failed" ? icons.close : icons.cameraOff}<span>${emptyPreview[phase]}</span></p></div><figcaption>Your camera preview is muted to prevent feedback. Microphone-only previews have no picture.</figcaption></figure>
      </section>
      <section class="panel" aria-labelledby="devices-title"><h2 id="devices-title">Your devices</h2>
        <fieldset class="switches"><legend>Capture</legend><label class="switch"><input type="checkbox" name="audio" ?checked=${s.audio} ?disabled=${phase === "preparing"} data-intent=${i.Prefs}/> Microphone</label><label class="switch"><input type="checkbox" name="video" ?checked=${s.video} ?disabled=${phase === "preparing"} data-intent=${i.Prefs}/> Camera</label></fieldset>
        <p class="device"><label for="camera-device">Camera device</label><select id="camera-device" name="camera" data-intent=${i.Device}><option value="" ?selected=${s.camera === ""}>Browser default</option>${devices("videoinput", s.camera)}</select></p>
        <p class="device"><label for="microphone-device">Microphone device</label><select id="microphone-device" name="microphone" data-intent=${i.Device}><option value="" ?selected=${s.microphone === ""}>Browser default</option>${devices("audioinput", s.microphone)}</select></p>
        <p class="level"><label for="level">Microphone level</label><meter id="level" data-level min="0" max="1" low="0.75" high="0.9" optimum="0.4" value="0"></meter></p>
        <menu class="actions"><li><button class="primary" type="button" data-intent=${i.Preview} ?disabled=${phase === "preparing"}>${phase === "ready" ? "Update preview" : "Start preview"}</button></li><li><button type="button" data-intent=${i.Stop} ?disabled=${phase === "idle" || phase === "failed"}>${phase === "preparing" ? "Cancel preview" : "Stop preview"}</button></li><li><button type="button" data-intent=${i.Devices}>List devices</button></li></menu>
        <p class="chips"><span class="chip">Preview <output id="preview-status">${phase}</output></span><span class="chip">Tracks held <output>${s.view.tracks.length}</output></span></p>
        <ul class="tracks" aria-label="Captured tracks">${each(s.view.tracks, (track) => `${track.kind}:${track.label}`, trackRow)}</ul>
        <p id="feedback" class="feedback" role="status">${s.view.feedback}</p>
        <p class="hint">This example uses <code>@peerweave/media</code> independently. It creates no WebRTC connection and sends no media.</p>
      </section>
    </div>
    ${help("Before joining a call", html`<ol><li>Choose which devices to enable and press <strong>Start preview</strong>.</li><li>Allow access. Device names become available after permission is granted.</li><li>Select another device and press <strong>Update preview</strong>. Stop the preview to release all tracks.</li></ol>`)}
  </main>${footer()}`;
  },
});
