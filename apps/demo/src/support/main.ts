import { bindRuntime } from "../shared/runtime.js";
import { Support } from "./component.js";
import { SupportController } from "./controller.js";
import "../style.css";

const app = new Support();
app.initialRoom = new URL(location.href).searchParams.get("room") ?? "hello";
app.drivers = bindRuntime(app, new SupportController());
document.getElementById("app")?.replaceChildren(app);
