// Steering input calculations
export function compute_neutral_steering_angle(lean_angle, speed, config) {
  if (!config) throw new Error("config cannot be null");
  if (speed < config.transitionSpeed * 0.7) return 0.0;
  const cos_caster = Math.cos(config.casterAngle);
  const clamp_phi = Math.max(
    -config.maxLeanAngle,
    Math.min(config.maxLeanAngle, lean_angle),
  );
  const denom = speed * speed + 18.0;
  const raw_tan =
    (config.wheelbase * config.gravity * Math.tan(clamp_phi)) /
    (denom * cos_caster);
  const neutral_delta = Math.atan(raw_tan) * (0.55 + config.trailAlignGain);
  const max_neutral = config.maxSteeringAngle * 0.45;
  return Math.max(-max_neutral, Math.min(max_neutral, neutral_delta));
}

// this fn update steering angle state
export function update_steering_state(state, steer_input, dt, config) {
  if (!state || !config) throw new Error("state and config cannot be null");

  const v = state.speed;
  const sens = state.steeringSensitivity;

  //clamp sensitivity
  const clamp_sens = [config.minSensitivity, sens, config.maxSensitivity].sort(
    (a, b) => a - b,
  )[1];
  state.steeringSensitivity = clamp_sens;

  // speed factor calculation shortcut
  const spd_fact = 1.0 / (1.0 + Math.pow(v / config.steeringSpeedScale, 1.35));
  const auth_scale = Math.max(0.22, spd_fact);

  // the max commanded angle
  const max_cmd = Math.min(
    config.maxSteeringAngle,
    config.maxSteeringAngle * auth_scale * (0.55 + 0.45 * clamp_sens),
  );

  // the neutral steer angle
  const neutral_angle = compute_neutral_steering_angle(
    state.leanAngle,
    v,
    config,
  );
  state.neutralSteeringAngle = neutral_angle;

  const has_input = Math.abs(steer_input) > 0.001;
  const tgt_angle = has_input ? steer_input * max_cmd : neutral_angle;
  const resp_rate = has_input
    ? config.steeringResponseRate * (0.65 + 0.35 * clamp_sens)
    : config.steeringReturnRate;

  // clamp the steering angle
  const clamped_tgt = Math.max(
    -config.maxSteeringAngle,
    Math.min(config.maxSteeringAngle, tgt_angle),
  );

  // an exponential first order actuator step,
  const prev_delta = state.steeringAngle;
  const alpha = 1.0 - Math.exp(-resp_rate * dt);
  const next_delta = prev_delta + (clamped_tgt - prev_delta) * alpha;

  state.steeringRate = (next_delta - prev_delta) / dt;
  state.steeringAngle = Math.max(
    -config.maxSteeringAngle,
    Math.min(config.maxSteeringAngle, next_delta),
  );

  const active_delta = state.steeringAngle - neutral_angle;
  state.activeSteeringDelta = active_delta;

  return active_delta;
}

// legacy caller
export const computeNeutralSteeringAngle = compute_neutral_steering_angle;
export const updateSteeringState = update_steering_state;
