import { bindRuntime } from "../shared/runtime.js";
import { Preflight } from "./component.js";
import { MediaController } from "./controller.js";
import "../style.css";

const app = new Preflight();
app.drivers = bindRuntime(app, new MediaController());
document.getElementById("app")?.replaceChildren(app);
