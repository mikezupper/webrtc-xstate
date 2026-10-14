import { type DriverOverrides, defineDriver, defineHook, subscription } from "@gyral/core";

export interface ExampleRuntime<S, A> {
  subscribe(listener: (state: S) => void): () => void;
  act(action: A): void | Promise<void>;
  getStream(slot: "local" | "remote"): MediaStream | null;
  dispose(): void;
}
export class Observable<S> {
  protected listeners = new Set<(state: S) => void>();
  constructor(protected snapshot: S) {}
  subscribe(listener: (state: S) => void) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }
  protected publish(state: S) {
    this.snapshot = state;
    for (const listener of this.listeners) listener(state);
  }
}
type VideoOwner = Pick<ExampleRuntime<unknown, never>, "getStream">;
const owners = new WeakMap<Element, VideoOwner>();
export function bindRuntime<S, A>(
  host: HTMLElement,
  runtime: ExampleRuntime<S, A>,
): DriverOverrides {
  owners.set(host, runtime);
  const events = subscription<S>("example-events", (emit) => {
    const detach = runtime.subscribe(emit);
    const leave = () => runtime.dispose();
    window.addEventListener("pagehide", leave);
    return () => {
      detach();
      window.removeEventListener("pagehide", leave);
      owners.delete(host);
      runtime.dispose();
    };
  });
  const actions = defineDriver<A, void, string>({
    name: "example-action",
    run: (action) => runtime.act(action),
    toError: errorText,
  });
  return { "example-events": events, "example-action": actions };
}
function streamFor(element: Element, slot: "local" | "remote"): MediaStream | null {
  let ancestor: Element | null = element;
  while (ancestor && !owners.has(ancestor)) ancestor = ancestor.parentElement;
  return ancestor ? (owners.get(ancestor)?.getStream(slot) ?? null) : null;
}
export const mediaBinding = defineHook<[slot: "local" | "remote", revision: number]>({
  client(element, [slot]) {
    if (!(element instanceof HTMLVideoElement)) return;
    const stream = streamFor(element, slot);
    if (element.srcObject === stream) return;
    element.srcObject = stream;
    if (stream) void element.play().catch(() => {});
  },
  dispose(element) {
    if (element instanceof HTMLVideoElement) element.srcObject = null;
  },
});
interface LevelMeter {
  readonly key: string;
  readonly context: AudioContext;
  frame: number;
}
const meters = new WeakMap<Element, LevelMeter>();
function stopLevel(element: Element) {
  const meter = meters.get(element);
  if (!meter) return;
  meters.delete(element);
  cancelAnimationFrame(meter.frame);
  void meter.context.close().catch(() => {});
  if (element instanceof HTMLElement) element.style.removeProperty("--level");
  for (const gauge of element.querySelectorAll<HTMLMeterElement>("meter[data-level]"))
    gauge.value = 0;
  if (element instanceof HTMLMeterElement) element.value = 0;
}
/**
 * Publishes a stream's loudness (0–1) as `--level` on the element, and as the value of the
 * element or its `meter[data-level]` descendants. Reads samples through a Web Audio analyser it
 * owns; never stops the tracks.
 */
export const audioLevel = defineHook<[slot: "local" | "remote", revision: number]>({
  client(element, [slot]) {
    const stream = streamFor(element, slot);
    const tracks = stream?.getAudioTracks() ?? [];
    const key = tracks.map((track) => track.id).join();
    if (meters.get(element)?.key === key) return;
    stopLevel(element);
    if (!stream || !tracks.length || typeof AudioContext !== "function") return;
    let context: AudioContext | undefined;
    try {
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const meter: LevelMeter = { key, context, frame: 0 };
      let level = 0;
      const tick = () => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += sample * sample;
        level = Math.max(Math.min(1, Math.sqrt(sum / samples.length) * 3), level * 0.86);
        if (element instanceof HTMLElement) element.style.setProperty("--level", level.toFixed(3));
        if (element instanceof HTMLMeterElement) element.value = level;
        else
          for (const gauge of element.querySelectorAll<HTMLMeterElement>("meter[data-level]"))
            gauge.value = level;
        meter.frame = requestAnimationFrame(tick);
      };
      meter.frame = requestAnimationFrame(tick);
      meters.set(element, meter);
      void context.resume().catch(() => {});
    } catch {
      void context?.close().catch(() => {});
    }
  },
  dispose: stopLevel,
});
const drops = new WeakMap<Element, AbortController>();
/** Lets a `<label>` that wraps a file input accept dropped files, as if they were chosen. */
export const fileDrop = defineHook<[]>({
  client(element) {
    if (!(element instanceof HTMLElement) || drops.has(element)) return;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const field = () => {
      const input = element.querySelector("input[type=file]");
      return input instanceof HTMLInputElement && !input.disabled ? input : null;
    };
    const over = (event: DragEvent) => {
      if (!field() || !event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      element.setAttribute("data-drag", "");
    };
    element.addEventListener("dragenter", over, options);
    element.addEventListener("dragover", over, options);
    element.addEventListener(
      "dragleave",
      (event) => {
        if (!(event.relatedTarget instanceof Node && element.contains(event.relatedTarget)))
          element.removeAttribute("data-drag");
      },
      options,
    );
    element.addEventListener(
      "drop",
      (event) => {
        element.removeAttribute("data-drag");
        const input = field();
        const files = event.dataTransfer?.files;
        if (!input || !files?.length) return;
        event.preventDefault();
        input.files = files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      },
      options,
    );
    drops.set(element, controller);
  },
  dispose(element) {
    drops.get(element)?.abort();
    drops.delete(element);
    element.removeAttribute("data-drag");
  },
});
export function errorText(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return `${error.message}${error.cause instanceof Error ? `: ${error.cause.message}` : ""}`;
}
