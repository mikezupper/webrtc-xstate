import { command, define, defineDriver, each, html, type TemplateResult } from "@gyral/core";
import { mediaBinding } from "../shared/runtime.js";
import { footer, navigation } from "../shared/shell.js";
import {
  type DeviceChoice,
  initialMediaView,
  type MediaAction,
  type MediaView,
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
const deviceRow = (device: DeviceChoice): TemplateResult =>
  html`<option value=${device.id}>${device.label}</option>`;
const trackRow = (track: string): TemplateResult => html`<li>${track}</li>`;
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
  view: (s, i) => html`${navigation("media")}<main id="main">
    <hgroup class="hero"><p class="eyebrow">MEDIA / NO CONNECTION REQUIRED</p><h1>Check your camera and microphone.</h1><p>Select your devices, try a local preview, and release them when you are done.</p></hgroup>
    <section class="panel" aria-labelledby="media-instructions"><h2 id="media-instructions">Before joining a call</h2><ol><li>Choose which devices to enable and press <strong>Start preview</strong>.</li><li>Allow access. Device names become available after permission is granted.</li><li>Select another device and press <strong>Update preview</strong>. Stop the preview to release all tracks.</li></ol><p class="hint">This example uses <code>@peerweave/media</code> independently. It creates no WebRTC connection and sends no media.</p></section>
    <section class="panel" aria-labelledby="devices-title"><h2 id="devices-title">Your devices</h2><fieldset><legend>Capture inputs</legend><label><input type="checkbox" name="audio" ?checked=${s.audio} ?disabled=${s.view.phase === "preparing"} data-intent=${i.Prefs}/> Microphone</label><label><input type="checkbox" name="video" ?checked=${s.video} ?disabled=${s.view.phase === "preparing"} data-intent=${i.Prefs}/> Camera</label></fieldset>
      <div class="columns"><label for="camera-device">Camera device <select id="camera-device" name="camera" value=${s.camera} data-intent=${i.Device}><option value="">Browser default</option>${each(
        s.view.devices.filter((device) => device.kind === "videoinput"),
        (device) => device.id,
        deviceRow,
      )}</select></label>
      <label for="microphone-device">Microphone device <select id="microphone-device" name="microphone" value=${s.microphone} data-intent=${i.Device}><option value="">Browser default</option>${each(
        s.view.devices.filter((device) => device.kind === "audioinput"),
        (device) => device.id,
        deviceRow,
      )}</select></label></div>
      <div class="controls"><button class="primary" type="button" data-intent=${i.Preview} ?disabled=${s.view.phase === "preparing"}>${s.view.phase === "ready" ? "Update preview" : "Start preview"}</button><button type="button" data-intent=${i.Stop} ?disabled=${s.view.phase === "idle" || s.view.phase === "failed"}>${s.view.phase === "preparing" ? "Cancel preview" : "Stop preview"}</button><button type="button" data-intent=${i.Devices}>List devices</button></div>
      <p class="status-line">Preview: <output id="preview-status">${s.view.phase}</output></p><p id="feedback" role="status">${s.view.feedback}</p>
    </section>
    <section aria-labelledby="local-preview-title"><h2 id="local-preview-title">Local preview</h2><figure><video id="local" width="640" height="400" muted autoplay playsinline ${mediaBinding("local", s.view.revision)}></video><figcaption>Your camera preview is muted to prevent feedback. Microphone-only previews have no picture.</figcaption></figure><ul>${each(s.view.tracks, (track) => track, trackRow)}</ul></section>
  </main>${footer()}`,
});
