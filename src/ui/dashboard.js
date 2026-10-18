export class DashboardUI {
  constructor(physics, controls, callbacks = {}) {
    if (!physics || !controls)
      throw new Error("physics and controls cannot be null");

    this.physics = physics;
    this.controls = controls;
    this.callbacks = callbacks;

    const el_map = [
      ["speedValue", "speedo-speed-value"],
      ["speedMsValue", "speedo-ms-value"],
      ["throttleText", "speedo-throttle-value"],
      ["throttleBar", "speedo-throttle-bar"],
      ["brakeBadge", "speedo-brake-badge"],
      ["gearValue", "speedo-gear-value"],
      ["rpmValue", "speedo-rpm-value"],
      ["leanHorizonLine", "speedo-horizon-line"],
      ["leanReadout", "speedo-lean-readout"],
      ["btnSteerLeft", "ctrl-btn-a"],
      ["btnSteerRight", "ctrl-btn-d"],
      ["steerAngleValue", "ctrl-steer-angle-value"],
      ["steerBarMarker", "ctrl-steer-bar-marker"],
      ["leanBarMarker", "ctrl-lean-bar-marker"],
      ["leanAngleValue", "ctrl-lean-angle-value"],
      ["keySensDown", "ctrl-key-left-arrow"],
      ["keySensUp", "ctrl-key-right-arrow"],
      ["sensitivityValue", "ctrl-sensitivity-value"],
      ["sensitivitySlider", "ctrl-sensitivity-slider"],
      ["keyThrottleUp", "ctrl-key-shift"],
      ["keyThrottleDown", "ctrl-key-ctrl"],
      ["ctrlThrottleValue", "ctrl-throttle-value"],
      ["ctrlThrottleSlider", "ctrl-throttle-slider"],
      ["btnRearBrake", "ctrl-btn-brake"],
      ["ctrlBrakeStateText", "ctrl-brake-state-text"],
      ["paramBrakeSlider", "param-brake-force"],
      ["paramBrakeValue", "param-brake-force-val"],
      ["paramMassSlider", "param-mass"],
      ["paramMassValue", "param-mass-val"],
      ["btnResetBike", "btn-reset-bike"],
      ["btnToggleCamera", "btn-toggle-camera"],
      ["btnToggleControlsPanel", "btn-toggle-controls"],
      ["controlsPanelBody", "controls-panel-body"],
      ["fallOverlay", "fall-overlay"],
      ["fallDesc", "fall-desc"],
      ["btnFallReset", "btn-fall-reset"],
    ];

    this.els = el_map.reduce((acc, [k, id]) => {
      acc[k] = document.getElementById(id);
      return acc;
    }, {});

    this._cache = {};
    this._bind_interactive_controls();
  }

  // inputs and sliders
  _bind_interactive_controls() {
    const bind_hold = (el, name) => {
      if (!el) return;
      ["pointerdown", "pointerup", "pointerleave", "pointercancel"].forEach(
        (ev) => {
          el.addEventListener(ev, (e) => {
            e.preventDefault();
            this.controls.setPointerHold(name, ev === "pointerdown");
          });
        },
      );
    };

    bind_hold(this.els.btnSteerLeft, "steerLeft");
    bind_hold(this.els.btnSteerRight, "steerRight");
    bind_hold(this.els.btnRearBrake, "rearBrake");

    this.els.sensitivitySlider?.addEventListener("input", (e) => {
      this.physics.setSteeringSensitivity(parseFloat(e.target.value));
    });
    this.els.sensitivitySlider?.addEventListener("change", (e) =>
      e.target.blur(),
    );

    this.els.ctrlThrottleSlider?.addEventListener("input", (e) => {
      this.physics.setThrottle(parseFloat(e.target.value) / 100.0);
    });
    this.els.ctrlThrottleSlider?.addEventListener("change", (e) =>
      e.target.blur(),
    );

    this.els.paramBrakeSlider?.addEventListener("input", (e) => {
      const f = parseFloat(e.target.value);
      this.physics.updateConfig({ maxRearBrakeForce: f });
      if (this.els.paramBrakeValue)
        this.els.paramBrakeValue.textContent = `${Math.round(f)} N`;
    });
    this.els.paramBrakeSlider?.addEventListener("change", (e) =>
      e.target.blur(),
    );

    this.els.paramMassSlider?.addEventListener("input", (e) => {
      const m = parseFloat(e.target.value);
      this.physics.updateConfig({ mass: m });
      if (this.els.paramMassValue)
        this.els.paramMassValue.textContent = `${Math.round(m)} kg`;
    });
    this.els.paramMassSlider?.addEventListener("change", (e) =>
      e.target.blur(),
    );

    const reset_fn = () => {
      this.callbacks.onReset?.();
    };
    this.els.btnResetBike?.addEventListener("click", () => {
      reset_fn();
      this.els.btnResetBike.blur();
    });
    this.els.btnFallReset?.addEventListener("click", () => {
      reset_fn();
      this.els.btnFallReset.blur();
    });

    this.els.btnToggleCamera?.addEventListener("click", () => {
      if (this.callbacks.onToggleCamera) {
        const mode = this.callbacks.onToggleCamera();
        this.els.btnToggleCamera.textContent =
          mode === "first-person"
            ? "View: 1st-Person Rider (C)"
            : "View: Debug Chase (C)";
      }
      this.els.btnToggleCamera.blur();
    });

    this.els.btnToggleControlsPanel?.addEventListener("click", () => {
      const col = this.els.controlsPanelBody?.classList.toggle("is-collapsed");
      this.els.btnToggleControlsPanel.textContent = col ? "Expand" : "Minimize";
      this.els.btnToggleControlsPanel.blur();
    });
  }

  // legacy caller
  _bindInteractiveControls() {
    this._bind_interactive_controls();
  }

  _set_text(k, el, txt) {
    if (!el || this._cache[k] === txt) return;
    this._cache[k] = txt;
    el.textContent = txt;
  }

  _set_active(k, el, act) {
    if (!el || this._cache[k] === act) return;
    this._cache[k] = act;
    el.classList.toggle("is-active", act);
  }

  // sync the state to html
  update() {
    const s = this.physics.state;
    const inp = this.physics.inputs;
    const cfg = this.physics.config;

    const spd_kmh = s.speed * 3.6;
    const thr_pct = s.throttle * 100.0;
    const steer_deg = (s.steeringAngle * 180.0) / Math.PI;
    const lean_deg = (s.leanAngle * 180.0) / Math.PI;

    this._set_text("speedVal", this.els.speedValue, spd_kmh.toFixed(1));
    this._set_text(
      "speedMs",
      this.els.speedMsValue,
      `${s.speed.toFixed(1)} m/s`,
    );
    this._set_text(
      "speedoThr",
      this.els.throttleText,
      `${Math.round(thr_pct)}%`,
    );

    if (this.els.throttleBar) {
      const w_str = `${thr_pct.toFixed(1)}%`;
      if (this._cache.thrBarWidth !== w_str) {
        this._cache.thrBarWidth = w_str;
        this.els.throttleBar.style.width = w_str;
      }
    }

    this._set_active(
      "speedoBrakeActive",
      this.els.brakeBadge,
      s.rearBrakeActive || s.isFallen,
    );
    this.els.brakeBadge?.classList.toggle("is-fallen", Boolean(s.isFallen));

    const badge_txt = s.isFallen
      ? "STATUS: FALLEN"
      : s.rearBrakeActive
        ? "REAR BRAKE: ON"
        : "REAR BRAKE: OFF";
    this._set_text("speedoBrakeText", this.els.brakeBadge, badge_txt);
    this._set_text("gearVal", this.els.gearValue, String(s.gear));
    this._set_text("rpmVal", this.els.rpmValue, `${s.engineRpm}`);

    const lean_txt = s.isFallen
      ? "FALLEN"
      : `${lean_deg >= 0 ? "+" : ""}${lean_deg.toFixed(1)}°`;
    this._set_text("leanReadout", this.els.leanReadout, lean_txt);

    if (this.els.leanHorizonLine) {
      const rot = `translate(-50%, -50%) rotate(${(-lean_deg).toFixed(1)}deg)`;
      if (this._cache.horizonRot !== rot) {
        this._cache.horizonRot = rot;
        this.els.leanHorizonLine.style.transform = rot;
      }
    }

    this._set_active("btnA", this.els.btnSteerLeft, inp.steerLeft);
    this._set_active("btnD", this.els.btnSteerRight, inp.steerRight);

    const steer_dir =
      Math.abs(steer_deg) < 0.15 ? "CENTER" : steer_deg < 0 ? "LEFT" : "RIGHT";
    this._set_text(
      "steerAngleVal",
      this.els.steerAngleValue,
      `${steer_deg >= 0 ? "+" : ""}${steer_deg.toFixed(1)}° (${s.steeringAngle.toFixed(3)} rad) · ${steer_dir}`,
    );

    if (this.els.steerBarMarker) {
      const norm_steer = Math.max(
        -1,
        Math.min(1, s.steeringAngle / cfg.maxSteeringAngle),
      );
      const pos = `${(50 + norm_steer * 46).toFixed(1)}%`;
      if (this._cache.steerMarkerPos !== pos) {
        this._cache.steerMarkerPos = pos;
        this.els.steerBarMarker.style.left = pos;
      }
    }

    const lean_dir =
      Math.abs(lean_deg) < 0.2 ? "UPRIGHT" : lean_deg < 0 ? "LEFT" : "RIGHT";
    this._set_text(
      "leanAngleVal",
      this.els.leanAngleValue,
      `${lean_deg >= 0 ? "+" : ""}${lean_deg.toFixed(1)}° (${lean_dir})`,
    );

    if (this.els.leanBarMarker) {
      const norm_lean = Math.max(
        -1,
        Math.min(1, s.leanAngle / cfg.maxLeanAngle),
      );
      const pos = `${(50 + norm_lean * 46).toFixed(1)}%`;
      if (this._cache.leanMarkerPos !== pos) {
        this._cache.leanMarkerPos = pos;
        this.els.leanBarMarker.style.left = pos;
      }
    }

    this._set_active("sensDown", this.els.keySensDown, inp.sensitivityDown);
    this._set_active("sensUp", this.els.keySensUp, inp.sensitivityUp);
    this._set_text(
      "sensVal",
      this.els.sensitivityValue,
      `${s.steeringSensitivity.toFixed(2)}x`,
    );

    if (
      this.els.sensitivitySlider &&
      document.activeElement !== this.els.sensitivitySlider
    ) {
      const v_str = s.steeringSensitivity.toFixed(2);
      if (this._cache.sensSlider !== v_str) {
        this._cache.sensSlider = v_str;
        this.els.sensitivitySlider.value = v_str;
      }
    }

    this._set_active("thrUp", this.els.keyThrottleUp, inp.throttleUp);
    this._set_active("thrDown", this.els.keyThrottleDown, inp.throttleDown);
    this._set_text(
      "ctrlThrVal",
      this.els.ctrlThrottleValue,
      `${thr_pct.toFixed(0)}%`,
    );

    if (
      this.els.ctrlThrottleSlider &&
      document.activeElement !== this.els.ctrlThrottleSlider
    ) {
      const v_str = thr_pct.toFixed(1);
      if (this._cache.thrSlider !== v_str) {
        this._cache.thrSlider = v_str;
        this.els.ctrlThrottleSlider.value = v_str;
      }
    }

    this._set_active("ctrlBrake", this.els.btnRearBrake, s.rearBrakeActive);
    this._set_text(
      "ctrlBrakeText",
      this.els.ctrlBrakeStateText,
      s.rearBrakeActive
        ? `ACTIVE (${Math.round(s.rearBrakeForce)} N)`
        : "RELEASED (0 N)",
    );

    // check overlay visibility?
    if (this.els.fallOverlay) {
      if (s.isFallen) {
        this.els.fallOverlay.classList.remove("is-hidden");
        if (this.els.fallDesc) {
          const l_deg = ((Math.abs(s.leanAngle) * 180.0) / Math.PI).toFixed(1);
          const r_spd = (s.minSpeedForLean * 3.6).toFixed(1);
          const c_spd = (s.speed * 3.6).toFixed(1);
          this.els.fallDesc.textContent =
            s.fallReason === "over_lean"
              ? `Lean angle (${l_deg}°) exceeded maximum safe ground clearance limit (~53°). Chassis scraped tarmac resulting in a fall.`
              : `At lean angle ${l_deg}°, forward speed was ${c_spd} km/h, which is below the minimum required speed (${r_spd} km/h) to maintain roll balance under gravity.`;
        }
      } else {
        this.els.fallOverlay.classList.add("is-hidden");
      }
    }

    this.els.btnResetBike?.classList.toggle(
      "btn-reset-pulse",
      Boolean(s.isFallen),
    );
  }
}
