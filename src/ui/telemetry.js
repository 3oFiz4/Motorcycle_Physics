// Tleemetry Panel
export class TelemetryUI {
  constructor(physics) {
    if (!physics) throw new Error("physics cannot be null in telemetry");

    this.physics = physics;
    this.isExpanded = true;
    this.updateIntervalMs = 50;
    this.lastUpdateTimestamp = 0;
    this.smoothedFps = 60.0;

    // cache dom element
    const el_ids = [
      ["panelBody", "telemetry-panel-body"],
      ["toggleBtn", "btn-toggle-telemetry"],
      ["regimeBadge", "tel-regime-badge"],
      ["speed", "tel-speed"],
      ["longAccel", "tel-long-accel"],
      ["latAccel", "tel-lat-accel"],
      ["steerAngle", "tel-steer-angle"],
      ["leanAngle", "tel-lean-angle"],
      ["steadyLeanRef", "tel-steady-lean-ref"],
      ["yawRate", "tel-yaw-rate"],
      ["gyroMoment", "tel-gyro-moment"],
      ["outtrackMoment", "tel-outtrack-moment"],
      ["forcesLong", "tel-forces-long"],
      ["throttle", "tel-throttle"],
      ["rearBrake", "tel-rear-brake"],
      ["momentumState", "tel-momentum-state"],
      ["minSpeed", "tel-min-speed"],
      ["pose", "tel-pose"],
      ["timing", "tel-timing"],
    ];

    this.els = el_ids.reduce((acc, [k, id]) => {
      acc[k] = document.getElementById(id);
      return acc;
    }, {});

    this._bind_events();
  }

  // bind collapse button
  _bind_events() {
    this.els.toggleBtn?.addEventListener("click", () => {
      this.isExpanded = !this.isExpanded;
      this.els.panelBody?.classList.toggle("is-collapsed", !this.isExpanded);
      if (this.els.toggleBtn) {
        this.els.toggleBtn.textContent = this.isExpanded
          ? "Collapse"
          : "Expand";
        this.els.toggleBtn.setAttribute(
          "aria-expanded",
          String(this.isExpanded),
        );
        this.els.toggleBtn.blur();
      }
    });
  }

  // legacy caller
  _bindEvents() {
    this._bind_events();
  }

  // update readouts
  update(now_ms, frame_delta_sec) {
    if (frame_delta_sec > 0.0005 && frame_delta_sec < 0.5) {
      const fps = 1.0 / frame_delta_sec;
      this.smoothedFps = this.smoothedFps * 0.9 + fps * 0.1;
    }

    if (
      !this.isExpanded ||
      now_ms - this.lastUpdateTimestamp < this.updateIntervalMs
    )
      return;
    this.lastUpdateTimestamp = now_ms;

    const snap = this.physics.getTelemetrySnapshot();

    if (this.els.regimeBadge) {
      this.els.regimeBadge.textContent = snap.regime;
      this.els.regimeBadge.style.background = snap.isFallen
        ? "rgba(239, 68, 68, 0.4)"
        : "";
      this.els.regimeBadge.style.borderColor = snap.isFallen
        ? "rgba(239, 68, 68, 0.9)"
        : "";
      this.els.regimeBadge.style.color = snap.isFallen ? "#ffffff" : "";
    }

    const fmt_sign = (num, dec = 2, unit = "") =>
      `${num >= 0 ? "+" : ""}${num.toFixed(dec)}${unit}`;

    if (this.els.speed)
      this.els.speed.textContent = `${snap.speedKmh.toFixed(1)} km/h (${snap.speedMs.toFixed(2)} m/s)`;
    if (this.els.longAccel)
      this.els.longAccel.textContent = fmt_sign(
        snap.longitudinalAcceleration,
        2,
        " m/s²",
      );
    if (this.els.latAccel)
      this.els.latAccel.textContent = fmt_sign(
        snap.lateralAcceleration,
        2,
        " m/s²",
      );
    if (this.els.steerAngle)
      this.els.steerAngle.textContent = `${fmt_sign(snap.steeringAngleDeg, 2, "°")} (${snap.steeringAngleRad.toFixed(3)} rad)`;
    if (this.els.leanAngle)
      this.els.leanAngle.textContent = `${fmt_sign(snap.leanAngleDeg, 2, "°")} (${snap.leanAngleRad.toFixed(3)} rad)`;
    if (this.els.steadyLeanRef)
      this.els.steadyLeanRef.textContent = `${fmt_sign(snap.steadyStateLeanRefDeg, 2, "°")}`;
    if (this.els.yawRate)
      this.els.yawRate.textContent = `${fmt_sign(snap.yawRateDeg, 2, " °/s")} (${snap.yawRateRad.toFixed(3)} rad/s)`;
    if (this.els.outtrackMoment)
      this.els.outtrackMoment.textContent = fmt_sign(
        snap.outtrackRollMoment,
        1,
        " N·m",
      );
    if (this.els.gyroMoment)
      this.els.gyroMoment.textContent = `${fmt_sign(snap.gyroRollMoment, 1, " N·m")} (H=${snap.wheelAngularMomentum.toFixed(1)})`;
    if (this.els.forcesLong)
      this.els.forcesLong.textContent = `F_drv:${Math.round(snap.driveForce)}N | F_drg:${Math.round(snap.dragForce)}N`;
    if (this.els.throttle)
      this.els.throttle.textContent = `${snap.throttlePercent.toFixed(1)}%`;
    if (this.els.rearBrake)
      this.els.rearBrake.textContent = snap.rearBrakeActive
        ? `ACTIVE (${Math.round(snap.rearBrakeForce)} N)`
        : "OFF (0 N)";

    // we set momentum text?
    if (this.els.momentumState) {
      if (snap.isFallen) {
        this.els.momentumState.textContent = "FALLEN (INSUFFICIENT)";
        this.els.momentumState.style.color = "#ef4444";
      } else if (!snap.hasEnoughMomentum) {
        this.els.momentumState.textContent = "DEFICIT (FALLING)"; // this is a typo in the code
        this.els.momentumState.style.color = "#f59e0b";
      } else {
        this.els.momentumState.textContent = "SUFFICIENT (STABLE)";
        this.els.momentumState.style.color = "#10b981";
      }
    }

    if (this.els.minSpeed)
      this.els.minSpeed.textContent = `${snap.minSpeedForLeanKmh.toFixed(1)} km/h (${snap.minSpeedForLeanMs.toFixed(2)} m/s)`;
    if (this.els.pose)
      this.els.pose.textContent = `X:${snap.x.toFixed(1)}m Z:${snap.z.toFixed(1)}m ψ:${snap.headingDeg.toFixed(1)}°`;
    if (this.els.timing)
      this.els.timing.textContent = `${Math.round(this.smoothedFps)} FPS · dt=${snap.fixedTimestepMs.toFixed(2)} ms (120 Hz)`;
  }
}
