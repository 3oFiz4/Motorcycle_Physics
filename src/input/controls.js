// controls stuff
const GAME_CONTROL_CODES = new Set([
  "KeyA",
  "KeyD",
  "ArrowLeft",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "Space",
]);

export class ControlsManager {
  constructor(physics, callbacks = {}) {
    // err if physics null
    if (!physics) throw new Error("physics cannot be null in controls");

    this.physics = physics;
    this.callbacks = callbacks;
    this.keyState = {
      steerLeft: false,
      steerRight: false,
      sensitivityDown: false,
      sensitivityUp: false,
      throttleUp: false,
      throttleDown: false,
      rearBrake: false,
    };
    this.pointerState = {
      steerLeft: false,
      steerRight: false,
      rearBrake: false,
    };
    this._onKeyDown = this._handle_key_down.bind(this);
    this._onKeyUp = this._handle_key_up.bind(this);
    this._onReleaseAll = this.releaseAllInputs.bind(this);
    this._onVisibilityChange = () => {
      if (document.hidden) this.releaseAllInputs();
    };
    this._attach_listeners();
  }

  // attach window listeners
  _attach_listeners() {
    window.addEventListener("keydown", this._onKeyDown, { passive: false });
    window.addEventListener("keyup", this._onKeyUp, { passive: false });
    window.addEventListener("blur", this._onReleaseAll);
    window.addEventListener("contextmenu", this._onReleaseAll);
    document.addEventListener("visibilitychange", this._onVisibilityChange);
  }

  //then remove all listeners
  dispose() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("blur", this._onReleaseAll);
    window.removeEventListener("contextmenu", this._onReleaseAll);
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
  }

  // handle when keydown is pressed
  _handle_key_down(e) {
    const code = e.code;
    if (GAME_CONTROL_CODES.has(code)) {
      e.preventDefault();
      if (
        document.activeElement?.tagName === "INPUT" &&
        ["Space", "ArrowLeft", "ArrowRight"].includes(code)
      ) {
        document.activeElement.blur();
      }
    }

    const key_map = {
      KeyA: "steerLeft",
      KeyD: "steerRight",
      ArrowLeft: "sensitivityDown",
      ArrowRight: "sensitivityUp",
      ShiftLeft: "throttleUp",
      ShiftRight: "throttleUp",
      ControlLeft: "throttleDown",
      ControlRight: "throttleDown",
      Space: "rearBrake",
    };

    if (key_map[code]) {
      this.keyState[key_map[code]] = true;
    } else if (code === "KeyR" && !e.repeat) {
      this.callbacks.onReset?.();
    } else if (code === "KeyC" && !e.repeat) {
      this.callbacks.onToggleCamera?.();
    } else {
      return;
    }

    this._sync_physics_inputs();
  }

  // handle if keyup is pressed instead
  _handle_key_up(e) {
    const code = e.code;
    if (GAME_CONTROL_CODES.has(code)) e.preventDefault();

    const key_map = {
      KeyA: "steerLeft",
      KeyD: "steerRight",
      ArrowLeft: "sensitivityDown",
      ArrowRight: "sensitivityUp",
      ShiftLeft: "throttleUp",
      ShiftRight: "throttleUp",
      ControlLeft: "throttleDown",
      ControlRight: "throttleDown",
      Space: "rearBrake",
    };

    if (key_map[code]) {
      this.keyState[key_map[code]] = false;
    } else {
      return;
    }

    this._sync_physics_inputs();
  }

  // set pointer pressed state
  setPointerHold(ctrl_name, is_pressed) {
    if (ctrl_name in this.pointerState) {
      this.pointerState[ctrl_name] = Boolean(is_pressed);
      this._sync_physics_inputs();
    }
  }

  //clear all hold keys
  releaseAllInputs() {
    //this reset all in linq style chain
    Object.keys(this.keyState).forEach((k) => {
      this.keyState[k] = false;
    });
    Object.keys(this.pointerState).forEach((k) => {
      this.pointerState[k] = false;
    });
    this.physics.releaseAllHeldInputs();
  }

  //then sync inputs to physics engine
  _sync_physics_inputs() {
    // combine key and pointer?
    this.physics.setInputs({
      steerLeft: this.keyState.steerLeft || this.pointerState.steerLeft,
      steerRight: this.keyState.steerRight || this.pointerState.steerRight,
      sensitivityDown: this.keyState.sensitivityDown,
      sensitivityUp: this.keyState.sensitivityUp,
      throttleUp: this.keyState.throttleUp,
      throttleDown: this.keyState.throttleDown,
      rearBrake: this.keyState.rearBrake || this.pointerState.rearBrake,
    });
  }

  // An alias for legacy private caller
  _syncPhysicsInputs() {
    this._sync_physics_inputs();
  }
}
