// compuet the forces for the bike
export function compute_longitudinal_forces(state, config, out) {
  if (!state || !config || !out)
    throw new Error("state config out cannot be null"); // null? err then

  const v = state.speed;
  const throttle = state.throttle;
  const brake_lvl = state.brakeLevel;
  // ---- DRIVE FORVE ENGINE ---
  const eff_spd = Math.max(v, 8.0);
  const pwr_force = config.maxEnginePower / eff_spd;
  const max_drv = Math.min(config.maxEngineForce, pwr_force);
  const drv_force = throttle * max_drv;
  // ---- AERO DRAG RESISTANCE ---
  const drag_force =
    0.5 * config.airDensity * config.dragArea * v * Math.abs(v);
  // ---- TIRE ROLL RESISTANCE ---
  const norm_force = config.mass * config.gravity;
  const max_roll = config.rollingResistanceCoeff * norm_force;
  const roll_force = v > 0.0 || drv_force > 0.0 ? max_roll : 0.0;
  // ---- ENGINE BRAKING DRAG ---
  const cut_pct = Math.max(0.0, 1.0 - throttle * 2.5);
  const eng_brake =
    v > 0.0
      ? cut_pct * (config.engineBrakingCoeff + config.engineBrakingLinear * v)
      : 0.0;
  // ---- REAR BRAKE FORCE ---
  const rear_brake =
    v > 0.0 || drv_force > 0.0 ? brake_lvl * config.maxRearBrakeForce : 0.0;
  // ---- SUM ALL DRAG ---
  const res_force = [drag_force, roll_force, eng_brake, rear_brake].reduce(
    (acc, f) => acc + f,
    0.0,
  );
  let net_force = drv_force - res_force;
  // ---- BIKE DONT ROLL BACK WHEN STOPPED ---
  if (v <= 0.0 && net_force < 0.0) net_force = 0.0;
  const long_acc = net_force / config.mass;
  out.driveForce = drv_force;
  out.dragForce = drag_force;
  out.rollingResistance =
    v > 0.0 ? roll_force : Math.min(drv_force, roll_force);
  out.engineBrakingForce = eng_brake;
  out.rearBrakeForce =
    v > 0.0
      ? rear_brake
      : Math.min(Math.max(0.0, drv_force - out.rollingResistance), rear_brake);
  out.netLongitudinalForce = net_force;
  out.longitudinalAcceleration = long_acc;
  return out;
}

// wheel gyro precession moments
export function compute_gyroscopic_effects(state, config, active_steer, out) {
  if (!state || !config || !out) throw new Error("null argument in gyro calc"); // likewise, null? err

  const v = state.speed;
  const w_rad = config.wheelRadius > 0.0 ? config.wheelRadius : 0.31;
  const w_omega = v / w_rad;
  const h_wheel = config.wheelPolarInertia * w_omega;
  const h_tot = 2.0 * h_wheel;

  const cos_caster = Math.cos(config.casterAngle);
  const steer_rate = state.steeringRate;

  // precession roll moment
  const prec_rate = -h_wheel * cos_caster * steer_rate;
  const prec_ang =
    -h_wheel * cos_caster * (v / config.wheelbase) * active_steer * 0.85;
  const gyro_mom = config.gyroRollGain * (prec_rate + prec_ang);

  out.wheelAngularVelocity = w_omega;
  out.wheelAngularMomentum = h_tot;
  out.gyroRollMoment = gyro_mom;

  return out;
}

// the lateral tire forces and turning yaw
export function compute_lateral_tire_dynamics(state, config, out) {
  if (!state || !config || !out)
    throw new Error("null arg in lateral tire calc");

  const v = state.speed;
  const phi = state.leanAngle;
  const delta = state.steeringAngle;
  const cos_caster = Math.cos(config.casterAngle);
  const eff_steer = delta * cos_caster;
  // --- SMOOTH REGIME BLEND ---
  const spd_ratio = v / config.transitionSpeed;
  const spd_ratio_sq = spd_ratio * spd_ratio;
  const lo_wt = Math.exp(-spd_ratio_sq * 1.35);
  const hi_wt = 1.0 - lo_wt;
  // --- LOW SPEED TURN YAW RATE ---
  const kin_curv = Math.tan(eff_steer) / config.wheelbase;
  const kin_yaw = v * kin_curv;
  const kin_lat = v * kin_yaw;
  // --- HIGH SPEED CAMBER TURN YAW RATE ---
  const clamp_phi = Math.max(
    -config.maxLeanAngle,
    Math.min(config.maxLeanAngle, phi),
  );
  const cam_lat = config.gravity * Math.tan(clamp_phi);
  const cam_yaw = v > 0.25 ? cam_lat / Math.max(v, 1.2) : 0.0;
  let tgt_yaw = 0.0;
  let tgt_lat = 0.0;

  // we then blend target yaw and lat accel with shortcuts
  if (v > 0.01) {
    tgt_yaw = lo_wt * kin_yaw + hi_wt * cam_yaw;
    tgt_lat = lo_wt * kin_lat + hi_wt * cam_lat;
  }

  const lat_force = config.mass * tgt_lat;
  const steady_phi = Math.atan2(state.lateralAcceleration, config.gravity);

  out.lowSpeedWeight = lo_wt;
  out.highSpeedWeight = hi_wt;
  out.effectiveSteer = eff_steer;
  out.kinematicYawRate = kin_yaw;
  out.kinematicLateralAccel = kin_lat;
  out.camberLateralAccel = cam_lat;
  out.targetYawRate = tgt_yaw;
  out.targetLateralAccel = tgt_lat;
  out.lateralTireForce = lat_force;
  out.steadyStateLeanRef = steady_phi;

  return out;
}

// callers
export const computeLongitudinalForces = compute_longitudinal_forces;
export const computeGyroscopicEffects = compute_gyroscopic_effects;
export const computeLateralTireDynamics = compute_lateral_tire_dynamics;
