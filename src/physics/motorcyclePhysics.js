// big thanks to my self-hosted llm Qwen-7B for this shiittt ahhhhh
// cooordinate full physics simulatuons
import { createPhysicsConfig } from "./config.js";
import {
  compute_longitudinal_forces,
  compute_gyroscopic_effects,
  compute_lateral_tire_dynamics,
} from "./forces.js";
import { update_steering_state } from "./steering.js";
import {
  update_lean_dynamics,
  compute_minimum_speed_for_lean,
  check_momentum_sufficiency,
} from "./leanDynamics.js";

// create initial physics state object
export function create_initial_physics_state(config) {
  if (!config) throw new Error("config cannot be null in state create");

  return {
    x: 0.0,
    y: 0.0,
    z: 0.0,
    heading: 0.0,
    isFallen: false,
    isFalling: false,
    fallReason: null,
    hasEnoughMomentum: true,
    minSpeedForLean: 0.0,
    fallProgress: 0.0,
    speed: 0.0,
    longitudinalAcceleration: 0.0,
    lateralAcceleration: 0.0,
    yawRate: 0.0,
    wheelRotationAngle: 0.0,
    distanceTraveled: 0.0,
    steeringAngle: 0.0,
    steeringRate: 0.0,
    neutralSteeringAngle: 0.0,
    activeSteeringDelta: 0.0,
    steeringSensitivity: config.defaultSensitivity,
    leanAngle: 0.0,
    leanRate: 0.0,
    leanAcceleration: 0.0,
    steadyStateLeanRef: 0.0,
    throttle: 0.0,
    brakeLevel: 0.0,
    rearBrakeActive: false,
    steerInput: 0.0,
    driveForce: 0.0,
    dragForce: 0.0,
    rollingResistance: 0.0,
    engineBrakingForce: 0.0,
    rearBrakeForce: 0.0,
    netLongitudinalForce: 0.0,
    lateralTireForce: 0.0,
    wheelAngularVelocity: 0.0,
    wheelAngularMomentum: 0.0,
    outtrackRollMoment: 0.0,
    gyroRollMoment: 0.0,
    totalRollMoment: 0.0,
    lowSpeedWeight: 1.0,
    highSpeedWeight: 0.0,
    gear: 1,
    engineRpm: config.idleRpm,
    simulationTime: 0.0,
    stepCount: 0,
    lastSubSteps: 0,
  };
}

export const createInitialPhysicsState = create_initial_physics_state;

// main bike physics engine class
export class MotorcyclePhysics {
  constructor(custom_cfg = {}) {
    this.config = createPhysicsConfig(custom_cfg);
    this.state = create_initial_physics_state(this.config);

    this.inputs = {
      steerLeft: false,
      steerRight: false,
      sensitivityDown: false,
      sensitivityUp: false,
      throttleUp: false,
      throttleDown: false,
      rearBrake: false,
      directSteerOverride: null,
    };

    this.accumulator = 0.0;

    this._longitudinalScratch = {
      driveForce: 0,
      dragForce: 0,
      rollingResistance: 0,
      engineBrakingForce: 0,
      rearBrakeForce: 0,
      netLongitudinalForce: 0,
      longitudinalAcceleration: 0,
    };

    this._gyroScratch = {
      wheelAngularVelocity: 0,
      wheelAngularMomentum: 0,
      gyroRollMoment: 0,
    };

    this._lateralScratch = {
      lowSpeedWeight: 1,
      highSpeedWeight: 0,
      effectiveSteer: 0,
      kinematicYawRate: 0,
      kinematicLateralAccel: 0,
      camberLateralAccel: 0,
      targetYawRate: 0,
      targetLateralAccel: 0,
      lateralTireForce: 0,
      steadyStateLeanRef: 0,
    };
  }

  // reset bike to upright zero state
  reset() {
    const saved_sens = this.state.steeringSensitivity;
    this.state = create_initial_physics_state(this.config);
    this.state.steeringSensitivity = saved_sens;
    this.accumulator = 0.0;
  }

  // set continuous inputs
  setInputs(new_inputs) {
    if (!new_inputs || typeof new_inputs !== "object")
      throw new Error("invalid inputs object");
    Object.assign(this.inputs, new_inputs);
  }

  // release all key holds
  releaseAllHeldInputs() {
    [
      "steerLeft",
      "steerRight",
      "sensitivityDown",
      "sensitivityUp",
      "throttleUp",
      "throttleDown",
      "rearBrake",
    ].forEach((k) => {
      this.inputs[k] = false;
    });
    this.inputs.directSteerOverride = null;
  }

  // this one set throttle directly
  setThrottle(frac) {
    if (!Number.isFinite(frac)) return;
    this.state.throttle = Math.max(0.0, Math.min(1.0, frac));
  }

  // this one set steering sens
  setSteeringSensitivity(sens) {
    if (!Number.isFinite(sens)) return;
    this.state.steeringSensitivity = Math.max(
      this.config.minSensitivity,
      Math.min(this.config.maxSensitivity, sens),
    );
  }

  // and this one update config parameters
  updateConfig(overrides) {
    if (!overrides) throw new Error("overrides cannot be null");
    Object.assign(this.config, overrides);
    this.setSteeringSensitivity(this.state.steeringSensitivity);
  }

  // this one then advance fixed step simulation
  update(elapsed_sec) {
    if (!Number.isFinite(elapsed_sec) || elapsed_sec <= 0) {
      this.state.lastSubSteps = 0;
      return 0;
    }

    const clamped_delta = Math.min(elapsed_sec, this.config.maxFrameDelta);
    this.accumulator += clamped_delta;

    const dt = this.config.fixedTimestep;
    let sub_steps = 0;

    while (this.accumulator >= dt && sub_steps < this.config.maxSubSteps) {
      this.step(dt);
      this.accumulator -= dt;
      sub_steps++;
    }

    if (this.accumulator >= dt) this.accumulator %= dt;

    this.state.lastSubSteps = sub_steps;
    return sub_steps;
  }

  // single step integration
  step(dt = this.config.fixedTimestep) {
    if (!Number.isFinite(dt) || dt <= 0) return;

    const s = this.state;
    const cfg = this.config;
    const inp = this.inputs;

    // check momentum before step
    if (!s.isFallen) {
      const min_spd = compute_minimum_speed_for_lean(s.leanAngle, cfg);
      const has_mom = check_momentum_sufficiency(s.leanAngle, s.speed, cfg);
      s.minSpeedForLean = min_spd;
      s.hasEnoughMomentum = has_mom;
      if (!has_mom) {
        s.isFallen = true;
        s.isFalling = true;
        s.fallReason =
          Math.abs(s.leanAngle) > (cfg.maxSafeLeanAngle ?? cfg.maxLeanAngle)
            ? "over_lean"
            : "insufficient_momentum";
      }
    }

    // if bike fallen slide until stop
    if (s.isFallen) {
      s.throttle = 0.0;
      s.driveForce = 0.0;
      s.engineBrakingForce = 0.0;
      s.rearBrakeForce = 0.0;
      s.steerInput = 0.0;
      s.hasEnoughMomentum = false;

      if (s.speed > 0.0) {
        const slide_decel = -cfg.fallGroundFriction * cfg.gravity;
        const prev_spd = s.speed;
        let next_spd = prev_spd + slide_decel * dt;
        if (next_spd <= 0.0) {
          next_spd = 0.0;
          s.longitudinalAcceleration = prev_spd > 0.0 ? -prev_spd / dt : 0.0;
        } else {
          s.longitudinalAcceleration = slide_decel;
        }
        s.speed = next_spd;
        const step_dist = s.speed * dt;
        s.x += Math.sin(s.heading) * step_dist;
        s.z -= Math.cos(s.heading) * step_dist;
        s.distanceTraveled += step_dist;
      } else {
        s.speed = 0.0;
        s.longitudinalAcceleration = 0.0;
      }

      s.yawRate = 0.0;
      s.lateralAcceleration = 0.0;
      s.steeringRate = 0.0;

      update_lean_dynamics(s, this._lateralScratch, 0.0, dt, cfg);
      this._update_drivetrain_telemetry();
      s.simulationTime += dt;
      s.stepCount += 1;
      return;
    }

    // ths one right here handle inputs
    if (inp.throttleUp && !inp.throttleDown) {
      s.throttle = Math.min(1.0, s.throttle + cfg.throttleAdjustRate * dt);
    } else if (inp.throttleDown && !inp.throttleUp) {
      s.throttle = Math.max(0.0, s.throttle - cfg.throttleAdjustRate * dt);
    }

    if (inp.sensitivityUp && !inp.sensitivityDown) {
      s.steeringSensitivity = Math.min(
        cfg.maxSensitivity,
        s.steeringSensitivity + cfg.sensitivityStep * dt,
      );
    } else if (inp.sensitivityDown && !inp.sensitivityUp) {
      s.steeringSensitivity = Math.max(
        cfg.minSensitivity,
        s.steeringSensitivity - cfg.sensitivityStep * dt,
      );
    }

    s.rearBrakeActive = Boolean(inp.rearBrake);
    const tgt_brake = s.rearBrakeActive ? 1.0 : 0.0;
    const brake_alpha = 1.0 - Math.exp(-cfg.brakeResponseRate * dt);
    s.brakeLevel += (tgt_brake - s.brakeLevel) * brake_alpha;
    if (s.brakeLevel < 1e-4 && !s.rearBrakeActive) s.brakeLevel = 0.0;

    let steer_cmd = 0.0;
    if (
      inp.directSteerOverride !== null &&
      Number.isFinite(inp.directSteerOverride)
    ) {
      steer_cmd = Math.max(-1.0, Math.min(1.0, inp.directSteerOverride));
    } else {
      if (inp.steerLeft) steer_cmd -= 1.0;
      if (inp.steerRight) steer_cmd += 1.0;
    }
    s.steerInput = steer_cmd;

    // longitudinal dynamics
    const long_forces = compute_longitudinal_forces(
      s,
      cfg,
      this._longitudinalScratch,
    );
    s.driveForce = long_forces.driveForce;
    s.dragForce = long_forces.dragForce;
    s.rollingResistance = long_forces.rollingResistance;
    s.engineBrakingForce = long_forces.engineBrakingForce;
    s.rearBrakeForce = long_forces.rearBrakeForce;
    s.netLongitudinalForce = long_forces.netLongitudinalForce;

    const prev_spd = s.speed;
    let next_spd = prev_spd + long_forces.longitudinalAcceleration * dt;
    if (next_spd <= 0.0) {
      next_spd = 0.0;
      s.longitudinalAcceleration = prev_spd > 0.0 ? -prev_spd / dt : 0.0;
    } else {
      s.longitudinalAcceleration = long_forces.longitudinalAcceleration;
    }
    s.speed = next_spd;

    // steering dynamics
    const act_steer = update_steering_state(s, steer_cmd, dt, cfg);

    // wheel gyro effect
    const gyro = compute_gyroscopic_effects(
      s,
      cfg,
      act_steer,
      this._gyroScratch,
    );
    s.wheelAngularVelocity = gyro.wheelAngularVelocity;
    s.wheelAngularMomentum = gyro.wheelAngularMomentum;

    // lateral tire forces
    const lat_pre = compute_lateral_tire_dynamics(s, cfg, this._lateralScratch);
    lat_pre.gyroRollMoment = gyro.gyroRollMoment;

    // lean update
    update_lean_dynamics(s, lat_pre, steer_cmd, dt, cfg);

    // is the fall occurred inside step?
    if (s.isFallen) {
      s.throttle = 0.0;
      s.driveForce = 0.0;
      s.yawRate = 0.0;
      s.lateralAcceleration = 0.0;
      s.lateralTireForce = 0.0;
      this._update_drivetrain_telemetry();
      s.simulationTime += dt;
      s.stepCount += 1;
      return;
    }

    //  post lean lateral response
    const lat_post = compute_lateral_tire_dynamics(
      s,
      cfg,
      this._lateralScratch,
    );
    const tire_alpha = 1.0 - Math.exp(-cfg.tireCorneringStiffness * dt);

    s.yawRate += (lat_post.targetYawRate - s.yawRate) * tire_alpha;
    s.lateralAcceleration +=
      (lat_post.targetLateralAccel - s.lateralAcceleration) * tire_alpha;

    if (s.speed < 0.001) {
      s.yawRate = 0.0;
      s.lateralAcceleration = 0.0;
    }

    s.lateralTireForce = cfg.mass * s.lateralAcceleration;
    s.lowSpeedWeight = lat_post.lowSpeedWeight;
    s.highSpeedWeight = lat_post.highSpeedWeight;
    s.steadyStateLeanRef = Math.atan2(s.lateralAcceleration, cfg.gravity);

    s.heading += s.yawRate * dt;
    if (s.heading > Math.PI || s.heading <= -Math.PI) {
      s.heading = Math.atan2(Math.sin(s.heading), Math.cos(s.heading));
    }

    const step_dist = s.speed * dt;
    s.x += Math.sin(s.heading) * step_dist;
    s.z -= Math.cos(s.heading) * step_dist;
    s.distanceTraveled += step_dist;
    s.wheelRotationAngle =
      (s.wheelRotationAngle + gyro.wheelAngularVelocity * dt) % (2.0 * Math.PI);

    this._update_drivetrain_telemetry();
    s.simulationTime += dt;
    s.stepCount += 1;
  }

  // check momentum helper
  hasEnoughMomentum(
    lean_angle = this.state.leanAngle,
    speed = this.state.speed,
  ) {
    return check_momentum_sufficiency(lean_angle, speed, this.config);
  }

  // min speed helper
  getMinimumSpeedForLean(lean_angle = this.state.leanAngle) {
    return compute_minimum_speed_for_lean(lean_angle, this.config);
  }

  get isFallen() {
    return this.state.isFallen;
  }

  // set partial state safely
  setState(partial_state) {
    if (!partial_state || typeof partial_state !== "object")
      throw new Error("state must be object");
    Object.assign(this.state, partial_state);
    this.state.minSpeedForLean = compute_minimum_speed_for_lean(
      this.state.leanAngle,
      this.config,
    );
    this.state.hasEnoughMomentum = check_momentum_sufficiency(
      this.state.leanAngle,
      this.state.speed,
      this.config,
    );
    if (!this.state.hasEnoughMomentum) {
      this.state.isFallen = true;
      this.state.isFalling = true;
      this.state.fallReason =
        Math.abs(this.state.leanAngle) >
        (this.config.maxSafeLeanAngle ?? this.config.maxLeanAngle)
          ? "over_lean"
          : "insufficient_momentum";
    }
  }

  fall(reason = "insufficient_momentum") {
    this.state.isFallen = true;
    this.state.isFalling = true;
    this.state.fallReason = reason;
    this.state.hasEnoughMomentum = false;
  }

  // for this one, it update gear and rpm in linq search style
  _update_drivetrain_telemetry() {
    const s = this.state;
    const cfg = this.config;
    const v = s.speed;
    const thresholds = cfg.gearSpeedThresholds;

    // find matching gear
    const gear_idx = thresholds
      .map((t, i) => ({ t, i }))
      .filter((item) => v >= item.t)
      .pop();
    const gear = gear_idx ? gear_idx.i + 1 : 1;
    s.gear = gear;

    const gear_min = thresholds[gear - 1] * 0.72;
    const gear_max = (thresholds[gear] || 64.0) * 1.12;
    const spd_span = Math.max(8.0, gear_max - gear_min);
    const norm_spd = Math.max(0.0, Math.min(1.0, (v - gear_min) / spd_span));

    const base_rpm = cfg.idleRpm + norm_spd * (cfg.redlineRpm - cfg.idleRpm);
    const flare = v < 0.5 ? s.throttle * 1800.0 : s.throttle * 350.0;
    s.engineRpm = Math.min(cfg.redlineRpm, Math.round(base_rpm + flare));
  }

  // an alias for legacy private caller
  _updateDrivetrainTelemetry() {
    this._update_drivetrain_telemetry();
  }

  // get telemetry snapshot
  getTelemetrySnapshot() {
    const s = this.state;
    const rad_to_deg = 180.0 / Math.PI;

    return {
      speedMs: s.speed,
      speedKmh: s.speed * 3.6,
      longitudinalAcceleration: s.longitudinalAcceleration,
      lateralAcceleration: s.lateralAcceleration,
      steeringAngleRad: s.steeringAngle,
      steeringAngleDeg: s.steeringAngle * rad_to_deg,
      neutralSteeringAngleDeg: s.neutralSteeringAngle * rad_to_deg,
      steeringRateRad: s.steeringRate,
      steeringSensitivity: s.steeringSensitivity,
      leanAngleRad: s.leanAngle,
      leanAngleDeg: s.leanAngle * rad_to_deg,
      leanRateDeg: s.leanRate * rad_to_deg,
      steadyStateLeanRefDeg: s.steadyStateLeanRef * rad_to_deg,
      yawRateRad: s.yawRate,
      yawRateDeg: s.yawRate * rad_to_deg,
      headingDeg: s.heading * rad_to_deg,
      throttlePercent: s.throttle * 100.0,
      rearBrakeActive: s.rearBrakeActive,
      brakeLevelPercent: s.brakeLevel * 100.0,
      driveForce: s.driveForce,
      dragForce: s.dragForce,
      rollingResistance: s.rollingResistance,
      rearBrakeForce: s.rearBrakeForce,
      lateralTireForce: s.lateralTireForce,
      wheelAngularMomentum: s.wheelAngularMomentum,
      outtrackRollMoment: s.outtrackRollMoment,
      gyroRollMoment: s.gyroRollMoment,
      totalRollMoment: s.totalRollMoment,
      highSpeedWeight: s.highSpeedWeight,
      isFallen: s.isFallen,
      isFalling: s.isFalling,
      fallReason: s.fallReason,
      hasEnoughMomentum: s.hasEnoughMomentum,
      minSpeedForLeanMs: s.minSpeedForLean,
      minSpeedForLeanKmh: s.minSpeedForLean * 3.6,
      fallProgress: s.fallProgress,
      regime: s.isFallen
        ? "FALLEN (CRASHED)"
        : s.speed < 0.25
          ? "STATIONARY"
          : s.highSpeedWeight >= 0.5
            ? "COUNTER-STEER (DYNAMIC)"
            : "DIRECT STEER (KINEMATIC)",
      gear: s.gear,
      engineRpm: s.engineRpm,
      x: s.x,
      z: s.z,
      distanceTraveled: s.distanceTraveled,
      fixedTimestepMs: this.config.fixedTimestep * 1000.0,
      stepCount: s.stepCount,
    };
  }
}
