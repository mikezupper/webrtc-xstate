import { initial, inputsFor, step } from "@gyral/testing";
import { expect, it } from "vitest";
import { callActions, Workbench } from "../src/call/component.js";
import { initialCallView } from "../src/call/controller.js";
import { mediaActions, Preflight } from "../src/media/component.js";
import { Support, supportActions } from "../src/support/component.js";
import { Transfer, transferActions } from "../src/transfer/component.js";

it("keeps all initial UI models JSON-compatible without native handles", () => {
  const models = [
    initial(Workbench.spec, { initialRoom: "room" }).state,
    initial(Preflight.spec).state,
    initial(Transfer.spec, { initialRoom: "room" }).state,
    initial(Support.spec, { initialRoom: "room" }).state,
  ];
  for (const model of models) expect(JSON.parse(JSON.stringify(model))).toEqual(model);
});
it("emits a call command with explicit media choices and clears the sent text", () => {
  const state = {
    ...initial(Workbench.spec, { initialRoom: "room" }).state,
    audio: false,
    message: "hello",
  };
  const result = step(Workbench.spec, state, {
    _tag: "Action",
    action: { _tag: "Start", audio: false, video: true },
  });
  expect(inputsFor(result.commands, callActions)).toEqual([
    { _tag: "Start", audio: false, video: true },
  ]);
  const sent = step(Workbench.spec, state, {
    _tag: "Action",
    action: { _tag: "Send", text: "hello" },
  });
  expect(sent.state.message).toBe("");
  expect(inputsFor(sent.commands, callActions)).toEqual([{ _tag: "Send", text: "hello" }]);
});
it("updates device preferences independently of capture, then emits a preview command", () => {
  const state = initial(Preflight.spec).state;
  const selected = step(Preflight.spec, state, { _tag: "Device", field: "camera", id: "camera-2" });
  expect(selected.state.camera).toBe("camera-2");
  expect(selected.commands).toEqual([]);
  const preview = step(Preflight.spec, selected.state, {
    _tag: "Action",
    action: { _tag: "Preview", audio: false, video: true, camera: "camera-2", microphone: "" },
  });
  expect(inputsFor(preview.commands, mediaActions)).toEqual([
    { _tag: "Preview", audio: false, video: true, camera: "camera-2", microphone: "" },
  ]);
});
it("requests recipient acceptance through a transfer driver, without creating a connection in a reducer", () => {
  const state = initial(Transfer.spec, { initialRoom: "room" }).state;
  const accepted = step(Transfer.spec, state, { _tag: "Action", action: { _tag: "Accept" } });
  expect(inputsFor(accepted.commands, transferActions)).toEqual([{ _tag: "Accept" }]);
  expect(accepted.state.view.connection).toBe("new");
});
it("uses support invitation commands and keeps runtime snapshots as the source of connection state", () => {
  const state = initial(Support.spec, { initialRoom: "room" }).state;
  const invited = step(Support.spec, state, {
    _tag: "SupportAction",
    action: { _tag: "Invite", audio: true, video: false },
  });
  expect(inputsFor(invited.commands, supportActions)).toEqual([
    { _tag: "Invite", audio: true, video: false },
  ]);
  const changed = step(Support.spec, state, {
    _tag: "Changed",
    view: { ...initialCallView, phase: "active", invitation: "accepted" },
  });
  expect(changed.state.view.phase).toBe("active");
});
