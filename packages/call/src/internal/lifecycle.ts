import { createActor, createMachine } from "xstate";

const machine = createMachine({
  types: {} as {
    events: { type: "START" | "READY" | "CONNECTED" | "RECOVER" | "FAIL" | "END" | "DONE" };
  },
  initial: "idle",
  on: { END: { target: ".ending" }, FAIL: { target: ".failed" } },
  states: {
    idle: { on: { START: "starting" } },
    starting: { on: { READY: "connecting" } },
    connecting: { on: { CONNECTED: "active", RECOVER: "recovering" } },
    active: { on: { RECOVER: "recovering" } },
    recovering: { on: { CONNECTED: "active" } },
    ending: { on: { DONE: "ended" } },
    ended: { type: "final" },
    failed: { type: "final" },
  },
});
export const createLifecycle = () => createActor(machine);
