import { Machine, interpret } from "https://cdn.skypack.dev/xstate";
console.log("machien ", Machine);

// Stateless machine definition
// machine.transition(...) is a pure function used by the interpreter.
const toggleMachine = Machine({
  id: "toggle",
  initial: "inactive",
  states: {
    inactive: { on: { TOGGLE: "active" } },
    active: { on: { TOGGLE: "inactive" } },
  },
});

// Machine instance with internal state
const toggleService = interpret(toggleMachine)
  .onTransition((state) => console.log(state.value))
  .start();
// => 'inactive'

toggleService.send("TOGGLE");
// => 'active'

toggleService.send("TOGGLE");
// => 'inactive'
