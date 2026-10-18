/**
 * @fileoverview Unit and integration tests for the 3D Motorcycle Physics Simulator.
 * Covers core physics calculations, counter-steering emergence, low- vs high-speed regimes,
 * control state persistence, anti-stuck focus-loss reset, and numerical stability.
 * Executes with Node's built-in test runner (`node --test tests/physics.test.js`).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { MotorcyclePhysics } from '../src/physics/motorcyclePhysics.js';
import { DEFAULT_PHYSICS_CONFIG } from '../src/physics/config.js';
import {
  computeMinimumSpeedForLean,
  checkMomentumSufficiency
} from '../src/physics/leanDynamics.js';

/**
 * Helper to advance simulation by a specified duration in seconds using fixed steps.
 * @param {MotorcyclePhysics} sim
 * @param {number} seconds
 */
function runForSeconds(sim, seconds) {
  const dt = sim.config.fixedTimestep;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    sim.step(dt);
  }
}

test('1. Initial state uses SI units and rests at equilibrium', () => {
  const sim = new MotorcyclePhysics();
  assert.equal(sim.state.speed, 0);
  assert.equal(sim.state.longitudinalAcceleration, 0);
  assert.equal(sim.state.steeringAngle, 0);
  assert.equal(sim.state.leanAngle, 0);
  assert.equal(sim.state.yawRate, 0);
  assert.equal(sim.state.throttle, 0);
  assert.equal(sim.state.rearBrakeActive, false);
  assert.equal(sim.state.steeringSensitivity, DEFAULT_PHYSICS_CONFIG.defaultSensitivity);

  // Remain completely stationary when no controls are active
  runForSeconds(sim, 2.0);
  assert.equal(sim.state.speed, 0);
  assert.equal(sim.state.leanAngle, 0);
  assert.equal(sim.state.heading, 0);
});

test('2. Throttle control is persistent between 0% and 100%', () => {
  const sim = new MotorcyclePhysics();

  // Hold Left Shift (throttleUp) for 0.8 s
  sim.setInputs({ throttleUp: true });
  runForSeconds(sim, 0.8);
  const partialThrottle = sim.state.throttle;
  assert.ok(partialThrottle > 0.3 && partialThrottle < 0.6, `Expected partial throttle, got ${partialThrottle}`);

  // Release Left Shift -> throttle must persist at its current level (not snap to 0)
  sim.setInputs({ throttleUp: false });
  runForSeconds(sim, 0.5);
  assert.equal(sim.state.throttle, partialThrottle);

  // Hold Left Shift until saturated at 100% (1.0)
  sim.setInputs({ throttleUp: true });
  runForSeconds(sim, 2.5);
  assert.equal(sim.state.throttle, 1.0);

  // Hold Left Ctrl (throttleDown) to reduce throttle
  sim.setInputs({ throttleUp: false, throttleDown: true });
  runForSeconds(sim, 0.5);
  assert.ok(sim.state.throttle < 1.0 && sim.state.throttle > 0.5);

  // Clamp at 0%
  runForSeconds(sim, 3.0);
  assert.equal(sim.state.throttle, 0.0);
});

test('3. Longitudinal motion follows Newtons second law with drag and rolling resistance', () => {
  const sim = new MotorcyclePhysics();
  sim.setThrottle(0.75);

  // Single step acceleration check: a = F_net / m
  sim.step();
  const expectedAccel = sim.state.netLongitudinalForce / sim.config.mass;
  assert.ok(Math.abs(sim.state.longitudinalAcceleration - expectedAccel) < 1e-9);
  assert.ok(sim.state.speed > 0 && sim.state.speed < 0.5, 'Speed must not jump instantaneously');

  // Accelerate over 4 seconds: speed increases while aerodynamic drag grows quadratically with speed
  const initialSpeed = sim.state.speed;
  runForSeconds(sim, 4.0);
  assert.ok(sim.state.speed > initialSpeed + 15.0, 'Motorcycle should accelerate progressively');
  assert.ok(sim.state.dragForce > 50.0, 'Aerodynamic drag should increase significantly with speed');
  assert.ok(sim.state.rollingResistance > 20.0, 'Rolling resistance should oppose motion');
});

test('4. Rear brake (Spacebar) decelerates via physics and never drives speed negative', () => {
  const sim = new MotorcyclePhysics();
  sim.setThrottle(0.8);
  runForSeconds(sim, 3.0);
  sim.setThrottle(0.0);

  const speedBeforeBraking = sim.state.speed;
  assert.ok(speedBeforeBraking > 15.0);

  // Engage rear brake
  sim.setInputs({ rearBrake: true });
  runForSeconds(sim, 0.5);
  assert.equal(sim.state.rearBrakeActive, true);
  assert.ok(sim.state.rearBrakeForce > 1000.0, 'Rear brake force should be active');
  assert.ok(sim.state.longitudinalAcceleration < -5.0, 'Rear brake should produce strong deceleration');
  assert.ok(sim.state.speed < speedBeforeBraking, 'Speed must decrease under braking');
  assert.ok(sim.state.speed > 0, 'Braking must not be an instantaneous speed reset');

  // Continue braking past rest -> speed must clamp cleanly to 0.0 (never negative)
  runForSeconds(sim, 6.0);
  assert.equal(sim.state.speed, 0.0);
  assert.equal(sim.state.longitudinalAcceleration, 0.0);
});

test('5. Steering input (A/D) controls handlebar angle without directly rotating stationary motorcycle', () => {
  const sim = new MotorcyclePhysics();
  assert.equal(sim.state.speed, 0.0);

  // Press A (steerLeft) while stationary
  sim.setInputs({ steerLeft: true });
  runForSeconds(sim, 0.5);

  assert.ok(sim.state.steeringAngle < -0.15, 'A key must steer handlebars left (negative delta)');
  assert.equal(sim.state.heading, 0.0, 'Stationary handlebar movement must not rotate motorcycle heading');
  assert.equal(sim.state.yawRate, 0.0, 'Stationary yaw rate must be zero');

  // Press D (steerRight) while stationary
  sim.setInputs({ steerLeft: false, steerRight: true });
  runForSeconds(sim, 0.8);

  assert.ok(sim.state.steeringAngle > 0.15, 'D key must steer handlebars right (positive delta)');
  assert.equal(sim.state.heading, 0.0);
});

test('6. High-speed counter-steering: brief opposite steer initiates lean and turn in intended direction', () => {
  const sim = new MotorcyclePhysics();
  // Bring motorcycle up to riding speed (~20 m/s = 72 km/h)
  sim.state.speed = 20.0;
  sim.setThrottle(0.28); // Maintain cruising speed

  // Apply brief LEFT steering input ('A', delta < 0) for 0.35 s to initiate a RIGHT turn
  sim.setInputs({ steerLeft: true });
  runForSeconds(sim, 0.35);

  // Verify handlebar turned left (delta < 0), while out-tracking and gyroscopic moments rolled bike RIGHT (phi > 0)
  assert.ok(sim.state.steeringAngle < -0.02, `Expected left steering angle (< 0), got ${sim.state.steeringAngle}`);
  assert.ok(sim.state.outtrackRollMoment > 0, 'Left steer at riding speed must generate rightward (+phi) out-tracking roll moment');
  assert.ok(sim.state.gyroRollMoment > 0, 'Left steer at riding speed must generate rightward (+phi) gyroscopic precession moment');
  assert.ok(sim.state.leanAngle > 0.05, `Expected rightward lean (phi > 0), got ${sim.state.leanAngle}`);
  assert.ok(sim.state.yawRate > 0.02, `Expected rightward yaw rate (r > 0) from rightward lean, got ${sim.state.yawRate}`);

  // Release steering input and observe sustained right-hand turn development
  const headingAfterImpulse = sim.state.heading;
  sim.setInputs({ steerLeft: false });
  runForSeconds(sim, 1.0);

  assert.ok(sim.state.leanAngle > 0.03, 'Lean angle should remain banked right during turn trajectory');
  assert.ok(sim.state.heading > headingAfterImpulse + 0.06, 'Motorcycle heading should continue turning right');
  assert.ok(sim.state.x > 0.4, 'Motorcycle trajectory should curve to the right (+X)');

  // Verify consistency with steady-turn relation tan(phi) ~= a_y / g
  const tanPhi = Math.tan(sim.state.leanAngle);
  const ayOverG = sim.state.lateralAcceleration / sim.config.gravity;
  assert.ok(Math.abs(tanPhi - ayOverG) < 0.05, `Expected tan(phi)=${tanPhi.toFixed(4)} close to a_y/g=${ayOverG.toFixed(4)}`);
});

test('7. Low-speed vs high-speed turning regime difference', () => {
  // Low-speed test at 1.8 m/s (~6.5 km/h)
  const lowSim = new MotorcyclePhysics();
  lowSim.state.speed = 1.8;
  lowSim.setInputs({ steerLeft: true });
  runForSeconds(lowSim, 0.6);

  // At very low speed, steering left ('A', delta < 0) produces a direct kinematic LEFT turn (yawRate < 0)
  assert.ok(lowSim.state.steeringAngle < 0, 'Handlebar steered left');
  assert.ok(lowSim.state.yawRate < -0.05, `At low speed, left steer should turn left (yawRate < 0), got ${lowSim.state.yawRate}`);

  // High-speed test at 18.0 m/s (~65 km/h)
  const highSim = new MotorcyclePhysics();
  highSim.state.speed = 18.0;
  highSim.setInputs({ steerLeft: true });
  runForSeconds(highSim, 0.6);

  // At riding speed, steering left ('A', delta < 0) counter-steers, leaning right (phi > 0) and turning right (yawRate > 0)
  assert.ok(highSim.state.steeringAngle < 0, 'Handlebar steered left');
  assert.ok(highSim.state.leanAngle > 0.08, 'At high speed, left steer leans motorcycle right');
  assert.ok(highSim.state.yawRate > 0.05, `At high speed, left steer counter-steers into right turn (yawRate > 0), got ${highSim.state.yawRate}`);
});

test('8. Steering sensitivity scales steering response without directly altering yaw at rest', () => {
  const lowSensSim = new MotorcyclePhysics();
  lowSensSim.setSteeringSensitivity(0.4);
  lowSensSim.state.speed = 15.0;

  const highSensSim = new MotorcyclePhysics();
  highSensSim.setSteeringSensitivity(2.0);
  highSensSim.state.speed = 15.0;

  lowSensSim.setInputs({ steerRight: true });
  highSensSim.setInputs({ steerRight: true });

  runForSeconds(lowSensSim, 0.25);
  runForSeconds(highSensSim, 0.25);

  assert.ok(
    highSensSim.state.steeringAngle > lowSensSim.state.steeringAngle * 1.4,
    'Higher steering sensitivity must produce larger/faster steering bar deflection'
  );
  assert.ok(
    Math.abs(highSensSim.state.leanAngle) > Math.abs(lowSensSim.state.leanAngle),
    'Higher steering sensitivity must induce stronger lean response via steering physics'
  );
});

test('9. Numerical stability under rapid control reversals and frame-rate drops', () => {
  const sim = new MotorcyclePhysics();
  sim.setThrottle(1.0);
  runForSeconds(sim, 3.0);

  // Simulate rapid alternating A/D inputs and brake pulses
  for (let i = 0; i < 40; i++) {
    sim.setInputs({
      steerLeft: i % 2 === 0,
      steerRight: i % 2 === 1,
      rearBrake: i % 5 === 0
    });
    // Simulate a severe frame drop (e.g., 250 ms pause) handled by update()
    sim.update(0.25);

    assert.ok(Number.isFinite(sim.state.speed));
    assert.ok(Number.isFinite(sim.state.leanAngle));
    assert.ok(Number.isFinite(sim.state.steeringAngle));
    assert.ok(Number.isFinite(sim.state.yawRate));
    assert.ok(Math.abs(sim.state.leanAngle) <= sim.config.maxLeanAngle + 1e-6);
    assert.ok(Math.abs(sim.state.steeringAngle) <= sim.config.maxSteeringAngle + 1e-6);
  }
});

test('10. Focus-loss / releaseAllHeldInputs clears held controls while preserving persistent throttle and sensitivity', () => {
  const sim = new MotorcyclePhysics();
  sim.setThrottle(0.65);
  sim.setSteeringSensitivity(1.45);
  sim.setInputs({
    steerLeft: true,
    throttleUp: true,
    rearBrake: true,
    sensitivityUp: true
  });

  sim.releaseAllHeldInputs();

  assert.equal(sim.inputs.steerLeft, false);
  assert.equal(sim.inputs.throttleUp, false);
  assert.equal(sim.inputs.rearBrake, false);
  assert.equal(sim.inputs.sensitivityUp, false);
  assert.equal(sim.state.throttle, 0.65, 'Persistent throttle must be preserved on focus loss');
  assert.equal(sim.state.steeringSensitivity, 1.45, 'Steering sensitivity must be preserved on focus loss');
});

test('11. Runtime configuration updates (adjustable braking strength & mass) directly affect simulation physics', () => {
  const standardBrakeSim = new MotorcyclePhysics({ maxRearBrakeForce: 1200 });
  const strongBrakeSim = new MotorcyclePhysics({ maxRearBrakeForce: 2600 });

  standardBrakeSim.state.speed = 25.0;
  strongBrakeSim.state.speed = 25.0;

  standardBrakeSim.setInputs({ rearBrake: true });
  strongBrakeSim.setInputs({ rearBrake: true });

  runForSeconds(standardBrakeSim, 1.0);
  runForSeconds(strongBrakeSim, 1.0);

  assert.ok(
    strongBrakeSim.state.speed < standardBrakeSim.state.speed - 4.0,
    'Increasing maxRearBrakeForce must produce stronger deceleration and lower speed'
  );
});

test('12. Telemetry snapshot reflects live physics state in SI and display units', () => {
  const sim = new MotorcyclePhysics();
  sim.setThrottle(0.5);
  runForSeconds(sim, 2.0);

  const snap = sim.getTelemetrySnapshot();
  assert.ok(Math.abs(snap.speedKmh - sim.state.speed * 3.6) < 1e-9);
  assert.ok(Math.abs(snap.throttlePercent - 50.0) < 1e-6);
  assert.equal(snap.regime, 'COUNTER-STEER (DYNAMIC)');
  assert.equal(snap.isFallen, false);
  assert.equal(snap.hasEnoughMomentum, true);
});

test('13. Momentum balance calculation: required speed scales with lean angle and upright bike needs 0 speed', () => {
  const cfg = DEFAULT_PHYSICS_CONFIG;

  // Upright bike (|phi| <= 0.07 rad) can balance at rest (feet down / natural upright stability)
  assert.equal(computeMinimumSpeedForLean(0.0, cfg), 0.0);
  assert.equal(computeMinimumSpeedForLean(0.05, cfg), 0.0);
  assert.equal(checkMomentumSufficiency(0.0, 0.0, cfg), true);
  assert.equal(checkMomentumSufficiency(0.05, 0.0, cfg), true);

  // Leaned bike requires progressive forward momentum
  const speed5Deg = computeMinimumSpeedForLean((5 * Math.PI) / 180, cfg);
  const speed15Deg = computeMinimumSpeedForLean((15 * Math.PI) / 180, cfg);
  const speed30Deg = computeMinimumSpeedForLean((30 * Math.PI) / 180, cfg);
  const speed45Deg = computeMinimumSpeedForLean((45 * Math.PI) / 180, cfg);

  assert.ok(speed5Deg > 1.0, `Expected > 1 m/s for 5 deg lean, got ${speed5Deg}`);
  assert.ok(speed15Deg > speed5Deg, 'Required speed must increase monotonically with lean angle');
  assert.ok(speed30Deg > speed15Deg, 'Required speed must increase monotonically with lean angle');
  assert.ok(speed45Deg > speed30Deg, 'Required speed must increase monotonically with lean angle');

  // Insufficient speed must report false
  assert.equal(checkMomentumSufficiency((25 * Math.PI) / 180, 1.0, cfg), false);
  // Sufficient speed must report true
  assert.equal(checkMomentumSufficiency((25 * Math.PI) / 180, 15.0, cfg), true);
  // Beyond maximum safe lean angle (~53 deg), chassis strikes ground, so always false
  assert.equal(checkMomentumSufficiency(1.0, 25.0, cfg), false);
});

test('14. Motorcycle falls when given angle and zero speed (no momentum)', () => {
  const sim = new MotorcyclePhysics();
  // Given a lean angle of ~20 deg (0.35 rad) with zero forward speed
  sim.setState({ leanAngle: 0.35, speed: 0.0 });

  assert.equal(sim.state.hasEnoughMomentum, false, 'Stationary tilted bike must not have enough momentum');
  assert.equal(sim.isFallen, true, 'isFallen must be true when given angle with no momentum');

  // Advance simulation: gravity overturns the bike onto its side on the ground
  runForSeconds(sim, 0.8);

  assert.equal(sim.state.isFallen, true);
  assert.ok(
    Math.abs(sim.state.leanAngle) >= sim.config.fallenAngle - 0.02,
    `Bike should be flat on the ground (~${sim.config.fallenAngle} rad), got ${sim.state.leanAngle}`
  );
  assert.equal(sim.state.speed, 0.0, 'Speed must remain zero');
  assert.equal(sim.state.throttle, 0.0, 'Throttle must be disabled when fallen');
});

test('15. Motorcycle falls when forward speed is insufficient for the lean angle', () => {
  const sim = new MotorcyclePhysics();
  // At 40 deg lean (~0.7 rad), minimum required speed is ~5 m/s (~18 km/h).
  // Provide only 1.5 m/s (~5.4 km/h) -> insufficient momentum!
  sim.setState({ leanAngle: 0.7, speed: 1.5 });

  assert.equal(sim.hasEnoughMomentum(), false);
  assert.equal(sim.isFallen, true);

  runForSeconds(sim, 1.0);

  assert.equal(sim.state.isFallen, true);
  assert.equal(sim.state.speed, 0.0, 'Sliding friction must bring bike to a stop');
  assert.ok(Math.abs(sim.state.leanAngle) >= sim.config.fallenAngle - 0.02);
});

test('16. Motorcycle with sufficient momentum for its lean angle does NOT fall', () => {
  const sim = new MotorcyclePhysics();
  // Cruising at 18.0 m/s (~65 km/h) with a 25 deg lean (~0.436 rad)
  sim.setState({ leanAngle: 0.436, speed: 18.0 });

  assert.equal(sim.hasEnoughMomentum(), true, '18 m/s has plenty of momentum for 25 deg lean');
  assert.equal(sim.isFallen, false, 'Must not be fallen');

  // Step physics forward: bike stays upright and turns dynamically
  runForSeconds(sim, 0.8);

  assert.equal(sim.state.isFallen, false, 'Should remain riding stably without falling');
  assert.ok(sim.state.speed > 10.0, 'Speed should remain active');
});

test('17. Decelerating to a stop while leaned causes bike to fall and remain fallen until reset', () => {
  const sim = new MotorcyclePhysics();
  // Start riding at 18 m/s with moderate throttle
  sim.state.speed = 18.0;
  sim.setThrottle(0.3);

  // Counter-steer to bank right
  sim.setInputs({ steerLeft: true });
  runForSeconds(sim, 0.4);
  sim.setInputs({ steerLeft: false });
  runForSeconds(sim, 0.5);

  const bankedAngle = sim.state.leanAngle;
  assert.ok(bankedAngle > 0.15, `Bike should be banked, got ${bankedAngle}`);
  assert.equal(sim.state.isFallen, false, 'Bike has momentum so it does not fall yet');

  // Now apply rear brake hard while still leaned over
  sim.setInputs({ rearBrake: true });
  sim.setThrottle(0.0);

  // Run until speed drops below required momentum threshold
  runForSeconds(sim, 3.5);

  assert.equal(sim.state.isFallen, true, 'Bike must fall once momentum drops below balance requirement');
  assert.equal(sim.state.speed, 0.0, 'Bike must come to complete stop on ground');

  // Verify the bike remains fallen indefinitely across further steps
  runForSeconds(sim, 2.0);
  assert.equal(sim.state.isFallen, true, 'Bike must remain fallen until user reset');
  assert.equal(sim.state.speed, 0.0);
  assert.ok(Math.abs(sim.state.leanAngle) >= sim.config.fallenAngle - 0.02);

  // Inputs should not resurrect the bike while fallen
  sim.setInputs({ throttleUp: true, steerRight: true });
  runForSeconds(sim, 1.0);
  assert.equal(sim.state.isFallen, true);
  assert.equal(sim.state.speed, 0.0);
});

test('18. User reset restores the fallen motorcycle to upright stationary state', () => {
  const sim = new MotorcyclePhysics();
  // Force bike to fall due to no momentum
  sim.setState({ leanAngle: 0.5, speed: 0.0 });
  runForSeconds(sim, 0.5);
  assert.equal(sim.state.isFallen, true);

  // User triggers reset (pressing R / clicking Reset Bike)
  sim.reset();

  assert.equal(sim.state.isFallen, false, 'Reset must clear fallen state');
  assert.equal(sim.state.leanAngle, 0.0, 'Reset must return bike to upright 0 lean');
  assert.equal(sim.state.speed, 0.0, 'Reset must return speed to 0');
  assert.equal(sim.state.hasEnoughMomentum, true, 'Upright stationary bike has sufficient momentum');

  // Verify bike can now accelerate and ride normally
  sim.setThrottle(0.5);
  runForSeconds(sim, 1.0);
  assert.ok(sim.state.speed > 2.0, 'Bike should accelerate normally after reset');
  assert.equal(sim.state.isFallen, false);
});
