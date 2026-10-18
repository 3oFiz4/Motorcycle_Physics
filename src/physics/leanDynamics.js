// calculate the lean angle if the bike bout to fall
export function compute_minimum_speed_for_lean(lean_angle, config) {
  if (!config) throw new Error("config cannot be null in speed calc");

  const abs_phi = Math.abs(lean_angle);
  const up_thresh = config.uprightBalanceThreshold ?? 0.07;

  // upright bike need zero speed
  if (abs_phi <= up_thresh) return 0.0;

  const cos_caster = Math.cos(config.casterAngle);
  const max_eff = config.maxSteeringAngle * cos_caster;
  const max_curv = Math.tan(max_eff) / config.wheelbase;
  const bal_curv = Math.max(
    0.1,
    max_curv * (config.balanceCurvatureEfficiency ?? 0.85),
  );

  const safe_phi = Math.min(
    abs_phi,
    config.maxSafeLeanAngle ?? config.maxLeanAngle,
  );
  const tan_phi = Math.tan(safe_phi);
  const min_spd_sq = (config.gravity * tan_phi) / bal_curv;

  return Math.sqrt(Math.max(0.0, min_spd_sq));
}

//we  check if forward momentum enough
export function check_momentum_sufficiency(lean_angle, speed, config) {
  if (!config) throw new Error("config cannot be null in momentum check");

  const abs_phi = Math.abs(lean_angle);
  const up_thresh = config.uprightBalanceThreshold ?? 0.07;
  if (abs_phi <= up_thresh) return true;

  const max_safe = config.maxSafeLeanAngle ?? config.maxLeanAngle;
  if (abs_phi > max_safe) return false;

  const min_spd = compute_minimum_speed_for_lean(lean_angle, config);
  return speed >= min_spd;
}

// this fn update roll and lean dynamics over dt (delta time when time goes infinity)
export function update_lean_dynamics(state, forces, steer_input, dt, config) {
  if (!state || !forces || !config)
    throw new Error("invalid null argument in lean dynamics");

  const v = state.speed;
  const phi = state.leanAngle;
  const phi_dot = state.leanRate;
  const cos_caster = Math.cos(config.casterAngle);
  const fallen_limit = config.fallenAngle ?? 1.432;

  // bike already fallen stay on ground
  if (state.isFallen) {
    const fallen_sign = Math.sign(phi) || 1;
    const tgt_angle = fallen_sign * fallen_limit;
    let next_angle = phi;

    if (Math.abs(next_angle) < fallen_limit) {
      const alpha = 1.0 - Math.exp(-18.0 * dt);
      next_angle += (tgt_angle - next_angle) * alpha;
      if (Math.abs(next_angle) >= fallen_limit - 1e-3) next_angle = tgt_angle;
    } else {
      next_angle = tgt_angle;
    }

    state.leanAngle = next_angle;
    state.leanRate = 0.0;
    state.leanAcceleration = 0.0;
    state.outtrackRollMoment = 0.0;
    state.gyroRollMoment = 0.0;
    state.totalRollMoment = 0.0;
    state.hasEnoughMomentum = false;
    state.minSpeedForLean = compute_minimum_speed_for_lean(
      fallen_limit,
      config,
    );
    state.fallProgress = Math.min(1.0, Math.abs(next_angle) / fallen_limit);
    return;
  }

  //this check momentum sufficiency with shortcuts
  const min_spd = compute_minimum_speed_for_lean(phi, config);
  const enough_mom = check_momentum_sufficiency(phi, v, config);

  state.minSpeedForLean = min_spd;
  state.hasEnoughMomentum = enough_mom;

  //this if no momentum bike fall down?
  if (!enough_mom) {
    const abs_phi = Math.abs(phi);
    state.isFallen = true;
    state.isFalling = true;
    state.fallReason =
      abs_phi > (config.maxSafeLeanAngle ?? config.maxLeanAngle)
        ? "over_lean"
        : "insufficient_momentum";

    const fall_sign =
      Math.sign(phi) || (steer_input > 0 ? 1 : steer_input < 0 ? -1 : 1);
    const tgt_angle = fall_sign * fallen_limit;

    const eff_lean = Math.max(0.12, abs_phi);
    const ovt_torque =
      fall_sign *
      config.mass *
      config.gravity *
      config.cgHeight *
      Math.sin(eff_lean) *
      (config.fallTorqueGain ?? 1.8);
    const damp_mom = -(config.rollDampingBase * 0.35) * phi_dot;
    const tot_mom = ovt_torque + damp_mom;
    const lean_acc = tot_mom / config.rollInertia;

    let next_rate = phi_dot + lean_acc * dt;
    let next_angle = phi + next_rate * dt;

    if (
      Math.abs(next_angle) >= fallen_limit ||
      (fall_sign > 0 && next_angle >= fallen_limit) ||
      (fall_sign < 0 && next_angle <= -fallen_limit)
    ) {
      next_angle = tgt_angle;
      next_rate = 0.0;
      state.fallProgress = 1.0;
    } else {
      state.fallProgress = Math.min(1.0, Math.abs(next_angle) / fallen_limit);
    }

    state.outtrackRollMoment = 0.0;
    state.gyroRollMoment = 0.0;
    state.totalRollMoment = tot_mom;
    state.leanAcceleration = lean_acc;
    state.leanRate = next_rate;
    state.leanAngle = next_angle;
    return;
  }

  state.isFalling = false;
  state.fallReason = null;
  state.fallProgress = 0.0;

  const lo_wt = forces.lowSpeedWeight;
  const hi_wt = forces.highSpeedWeight;
  const act_delta = state.activeSteeringDelta;
  const delta_dot = state.steeringRate;

  //this out tracking roll moment
  const eff_spd_sq = ((v * v) / (1.0 + (v * v) / (14.5 * 14.5))) * 0.48;
  const out_curv =
    (eff_spd_sq / config.wheelbase) * Math.tan(act_delta * cos_caster);
  const out_rate =
    (config.cgRearDistance / config.wheelbase) *
    Math.min(v, 18.0) *
    delta_dot *
    cos_caster *
    0.25;
  const out_track =
    -config.outtrackGain *
    config.mass *
    config.cgHeight *
    hi_wt *
    (out_curv + out_rate);

  //this gyroscopic precession torque
  const gyro_mom = forces.gyroRollMoment * hi_wt * 0.65;

  //this low speed inward lean moment
  const lo_tgt_lean = Math.atan2(
    config.lowSpeedLeanCoupling * forces.kinematicLateralAccel,
    config.gravity,
  );
  const lo_bal_mom = lo_wt * config.rollStiffnessBase * (lo_tgt_lean - phi);

  //this high speed righting stiffness
  const has_act_steer = Math.abs(steer_input) > 0.01;
  const hi_stiff = has_act_steer ? 380.0 : config.highSpeedWeaveReturn;

  const lean_ratio = Math.abs(phi) / config.maxLeanAngle;
  const bound_stiff =
    lean_ratio > 0.72 ? 850.0 * Math.pow((lean_ratio - 0.72) / 0.28, 2) : 0.0;
  const spd_zero_stiff = (1.0 - hi_wt) * config.rollStiffnessBase * 0.45;
  const rest_mom = -(hi_wt * hi_stiff + spd_zero_stiff + bound_stiff) * phi;

  //this roll damping
  const damp_coeff =
    config.rollDampingBase + config.rollDampingSpeedGain * Math.min(v, 35.0);
  const damp_mom = -damp_coeff * phi_dot;

  //this sum moments in linq style array
  const tot_mom = [out_track, gyro_mom, lo_bal_mom, rest_mom, damp_mom].reduce(
    (acc, m) => acc + m,
    0.0,
  );
  const lean_acc = tot_mom / config.rollInertia;

  let next_rate = phi_dot + lean_acc * dt;
  let next_angle = phi + next_rate * dt;

  //this clamp bank limit
  if (next_angle > config.maxLeanAngle) {
    next_angle = config.maxLeanAngle;
    if (next_rate > 0) next_rate = 0.0;
  } else if (next_angle < -config.maxLeanAngle) {
    next_angle = -config.maxLeanAngle;
    if (next_rate < 0) next_rate = 0.0;
  }

  //this settle small twitching at rest
  if (
    v < 0.01 &&
    Math.abs(steer_input) < 0.001 &&
    Math.abs(next_angle) < 1e-4 &&
    Math.abs(next_rate) < 1e-4
  ) {
    next_angle = 0.0;
    next_rate = 0.0;
  }

  state.outtrackRollMoment = out_track;
  state.gyroRollMoment = gyro_mom;
  state.totalRollMoment = tot_mom;
  state.leanAcceleration = lean_acc;
  state.leanRate = next_rate;
  state.leanAngle = next_angle;
}

//this aliases for callers
export const computeMinimumSpeedForLean = compute_minimum_speed_for_lean;
export const checkMomentumSufficiency = check_momentum_sufficiency;
export const updateLeanDynamics = update_lean_dynamics;
