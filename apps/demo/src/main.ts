import { Workbench } from "./call/component.js";
import { CallController } from "./call/controller.js";
import { bindRuntime } from "./shared/runtime.js";
import "./style.css";

const app = new Workbench();
app.initialRoom = new URL(location.href).searchParams.get("room") ?? "hello";
app.drivers = bindRuntime(app, new CallController());
document.getElementById("app")?.replaceChildren(app);
