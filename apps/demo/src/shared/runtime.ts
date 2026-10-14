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
export const mediaBinding = defineHook<[slot: "local" | "remote", revision: number]>({
  client(element, [slot]) {
    if (!(element instanceof HTMLVideoElement)) return;
    let ancestor: Element | null = element;
    while (ancestor && !owners.has(ancestor)) ancestor = ancestor.parentElement;
    const stream = ancestor ? (owners.get(ancestor)?.getStream(slot) ?? null) : null;
    if (element.srcObject === stream) return;
    element.srcObject = stream;
    if (stream) void element.play().catch(() => {});
  },
  dispose(element) {
    if (element instanceof HTMLVideoElement) element.srcObject = null;
  },
});
export function errorText(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return `${error.message}${error.cause instanceof Error ? `: ${error.cause.message}` : ""}`;
}
