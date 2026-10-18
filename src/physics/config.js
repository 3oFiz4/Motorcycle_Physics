// holld the default config for the physics stuff, this is just a default
export const DEFAULT_PHYSICS_CONFIG = Object.freeze({
  fixedTimestep: 1 / 120,
  maxSubSteps: 8,
  maxFrameDelta: 0.1,
  gravity: 9.81,
  airDensity: 1.225,
  bodyLength: 2.0,
  bodyHeight: 1.1,
  bodyWidth: 0.35,
  wheelbase: 1.42,
  cgHeight: 0.62,
  cgRearDistance: 0.68,
  casterAngle: 0.418879,
  trail: 0.095,
  handlebarWidth: 0.78,
  mass: 215.0,
  rollInertia: 92.0,
  yawInertia: 48.0,
  wheelRadius: 0.31,
  wheelPolarInertia: 0.68,
  maxEngineForce: 3450.0,
  maxEnginePower: 72000.0,
  engineBrakingCoeff: 75.0,
  engineBrakingLinear: 2.2,
  dragArea: 0.58,
  rollingResistanceCoeff: 0.015,
  maxRearBrakeForce: 1750.0,
  brakeResponseRate: 14.0,
  maxSteeringAngle: 0.488692,
  minSensitivity: 0.25,
  maxSensitivity: 2.5,
  defaultSensitivity: 1.0,
  sensitivityStep: 0.55,
  steeringResponseRate: 9.5,
  steeringReturnRate: 11.0,
  steeringSpeedScale: 13.5,
  trailAlignGain: 0.065,
  throttleAdjustRate: 0.55,
  maxLeanAngle: 0.925025,
  rollDampingBase: 265.0,
  rollDampingSpeedGain: 8.5,
  rollStiffnessBase: 340.0,
  highSpeedWeaveReturn: 95.0,
  outtrackGain: 1.0,
  gyroRollGain: 1.0,
  uprightBalanceThreshold: 0.07,
  maxSafeLeanAngle: 0.925025,
  fallenAngle: 1.432,
  fallTorqueGain: 1.8,
  fallGroundFriction: 0.85,
  balanceCurvatureEfficiency: 0.85,
  transitionSpeed: 3.6,
  lowSpeedLeanCoupling: 0.85,
  tireCorneringStiffness: 14.0,
  idleRpm: 1250,
  redlineRpm: 10500,
  gearSpeedThresholds: [0, 11.5, 20.0, 29.0, 39.0, 49.5],
});

// create physics config with override
export function create_physics_config(overrides = {}) {
  // not object then err
  if (typeof overrides !== "object" || overrides === null)
    throw new Error("overrides must be object");
  // merge configs
  return Object.assign({}, DEFAULT_PHYSICS_CONFIG, overrides);
}

// legacy caller
export const createPhysicsConfig = create_physics_config;
