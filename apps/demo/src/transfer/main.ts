import { bindRuntime } from "../shared/runtime.js";
import { Transfer } from "./component.js";
import { TransferController } from "./controller.js";
import "../style.css";

const app = new Transfer();
app.initialRoom = new URL(location.href).searchParams.get("room") ?? "hello";
app.drivers = bindRuntime(app, new TransferController());
document.getElementById("app")?.replaceChildren(app);
