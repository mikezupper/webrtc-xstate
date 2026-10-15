import { createDemoSession, type DemoState } from "./session.js";
import "./style.css";

function element<T extends HTMLElement>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Missing demo element: ${selector}`);
  return node;
}
const room = element<HTMLInputElement>("#room");
const join = element<HTMLButtonElement>("#join");
const start = element<HTMLButtonElement>("#start");
const mute = element<HTMLButtonElement>("#mute");
const leave = element<HTMLButtonElement>("#leave");
const local = element<HTMLVideoElement>("#local");
const remote = element<HTMLVideoElement>("#remote");
const status = element("#status");
const feedback = element("#feedback");
const mutedNote = element("#muted-note");
const main = element("main");
const form = element<HTMLFormElement>("#join-form");

function attach(video: HTMLVideoElement, stream: MediaStream | null) {
  if (video.srcObject === stream) return;
  video.srcObject = stream;
  video.dataset.live = String(stream !== null);
  if (stream) void video.play().catch(() => {});
}
function render(state: DemoState) {
  room.disabled = state.joined;
  join.disabled = state.joined;
  start.disabled = !state.paired || state.requested || state.phase !== "idle";
  mute.disabled = !["active", "recovering"].includes(state.phase);
  mute.setAttribute("aria-pressed", String(!mute.disabled && state.muted));
  leave.disabled = !state.joined;
  mutedNote.hidden = mute.disabled || !state.muted;
  main.dataset.phase = state.phase;
  status.textContent = !state.joined
    ? "Not joined."
    : !state.paired
      ? "Waiting for a peer to join this room."
      : state.phase === "idle"
        ? "Ready. Start the call in both tabs."
        : {
            starting: "Allow camera and microphone access.",
            waiting: "Waiting for your peer to start and allow media.",
            connecting: "Connecting…",
            active: "Connected.",
            recovering: "Connection interrupted. Reconnecting…",
            ending: "Ending the call…",
            ended: "Call ended. Leave and rejoin to call again.",
            failed: "Call failed. Leave and rejoin to try again.",
          }[state.phase];
  feedback.textContent = state.error;
  feedback.hidden = !state.error;
  attach(local, state.local);
  attach(remote, state.remote);
}

room.value = new URL(location.href).searchParams.get("room") ?? "hello";
const url = new URL("/signaling", location.href);
url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
const session = createDemoSession(url.href, render);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  session.join(room.value);
  const address = new URL(location.href);
  address.searchParams.set("room", room.value);
  history.replaceState(null, "", address);
});
start.addEventListener("click", () => {
  void session.start();
});
mute.addEventListener("click", () => session.mute());
leave.addEventListener("click", () => session.leave());
// Release resources on navigation, including bfcache; a restored page can join a fresh session.
window.addEventListener("pagehide", () => session.leave());
