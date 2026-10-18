# Changelog (`CHANGELOG.md`)

All notable changes to the **3D Motorcycle Physics Simulator** are documented in this file.

## [1.1.0] — 2026-10-19

### Added
- **Lean-Angle Momentum & Fall Mechanics (`src/physics/`)**:
  - Implemented `computeMinimumSpeedForLean` in `leanDynamics.js`, calculating theoretical speed required to balance lean angle $\phi$ against gravitational overturning moment ($v_{\text{min}} = \sqrt{g \tan|\phi| / \kappa_{\text{eff}}}$).
  - Implemented `checkMomentumSufficiency` in `leanDynamics.js`, verifying whether current speed supports lean angle without falling.
  - Implemented fall dynamics in `leanDynamics.js` and `motorcyclePhysics.js`: when speed is insufficient for the lean angle or bank exceeds safe chassis clearance ($\sim 53^\circ$), gravity overturns the motorcycle onto its side ($\approx 82^\circ$, lying flat on the ground).
  - Implemented persistent `isFallen` state: throttle and steering are disengaged, road sliding friction brings any remaining velocity to $0$, and the bike remains fallen indefinitely until the user explicitly resets.
  - Added full recovery reset via `R` key, UI "Reset Bike (R)" button, or the on-screen fall overlay banner.
- **HUD & Telemetry Indicators (`src/ui/`, `index.html`, `styles/`)**:
  - Added on-screen Fall Notification Overlay banner with detailed breakdown of why momentum was lost and a one-click Reset button.
  - Added visual "STATUS: FALLEN" pulsing indicator to the speedometer brake badge and attitude horizon.
  - Added live `Momentum & Stability` and `Min Speed for Lean` readouts to the collapsible telemetry panel.
- **Automated Tests (`tests/physics.test.js`)**:
  - Added tests 13–18 covering momentum calculation, stationary tilt falls, insufficient speed falls, stable riding without falls, braking deceleration falls, and clean recovery resets.

## [1.0.0] — 2026-10-19

### Added
- **Core SI Physics Engine (`src/physics/`)**:
  - Implemented `config.js` with centralized SI parameters (`mass = 215 kg`, `wheelbase = 1.42 m`, `cgHeight = 0.62 m`, `casterAngle = 24°`, `trail = 0.095 m`, `wheelRadius = 0.31 m`, `wheelPolarInertia = 0.68 kg·m²`).
  - Implemented `forces.js` modeling engine tractive force with power limit roll-off, quadratic aerodynamic drag, Coulomb rolling resistance, engine compression braking, rear-wheel friction braking, lateral tire camber/kinematic forces, and wheel gyroscopic precession moments.
  - Implemented `steering.js` separating handlebar steering angle ($\delta$) from motorcycle heading ($\psi$) and roll angle ($\phi$), with speed-scaled deflection authority, adjustable steering sensitivity ($0.25\text{x–}2.50\text{x}$), and mechanical trail self-alignment ($\delta_{\text{neutral}}$).
  - Implemented `leanDynamics.js` solving the transient roll differential equation driven by high-speed centrifugal out-tracking torque, front-wheel gyroscopic precession, low-speed kinematic balance, and weave/capsize self-righting damping.
  - Implemented `motorcyclePhysics.js` with a deterministic $120\text{ Hz}$ ($\Delta t = 8.33\text{ ms}$) fixed-timestep accumulator, frame-drop clamping, and zero-allocation scratch buffers.
- **3D Scene, Primitive Motorcycle & First-Person Camera (`src/`)**:
  - Implemented `scene.js` with a light-gray ground plane (`#d6dbe3`) and subtle darker-gray grid lines (`#6f7885` / `#9aa3b0`) snapped in $10\text{ m}$ world-aligned increments for infinite riding range.
  - Implemented `motorcycle.js` constructing the motorcycle from primitive 3D geometries: a black cuboid main body ($2.0\text{ m} \times 1.1\text{ m} \times 0.35\text{ m}$), front/rear wheel cylinders, and a visible rotating straight steering bar ($0.78\text{ m}$ wide) with left/right grip markers.
  - Implemented `camera.js` providing a first-person rider perspective ($y = 1.56\text{ m}$) aligned with motorcycle heading, coupled smoothly to motorcycle lean, and framing the steering bar in view, plus an optional debug chase view (`C` key).
  - Implemented `src/vendor/three.module.js` and `scripts/server.js` for seamless Three.js ES module execution both online/via npm and in air-gapped offline environments.
- **Controls, Speedometer & Telemetry (`src/input/`, `src/ui/`, `styles/`)**:
  - Implemented `controls.js` mapping `A`, `D`, `Left/Right Arrow`, `Left Shift`, `Left Ctrl`, and `Spacebar` with `preventDefault()` scroll protection and automatic held-input release on window blur or tab switch.
  - Implemented `dashboard.js` for the bottom-right speedometer ($\text{km/h}$, $\text{m/s}$, artificial horizon dial, persistent throttle bar, rear-brake badge, gear, and RPM) and interactive left control panel.
  - Implemented `telemetry.js` for the collapsible $20\text{ Hz}$ physics telemetry panel exposing speed, longitudinal/lateral acceleration, steering angle, lean angle, steady-state reference lean $\arctan(a_y/g)$, yaw rate, out-tracking/gyroscopic moments, forces, and FPS.
- **Automated Tests & Documentation (`tests/`, `reports/`, `feature/`)**:
  - Added 12 automated unit and integration tests in `tests/physics.test.js`.
  - Added `README.md`, `feature/FEATURES.md`, `reports/PHYSICS_MODEL.md`, `reports/TEST_REPORT.md`, and `reports/PERFORMANCE_REPORT.md`.

### Fixed
- Fixed asymptotic low-speed creep under rear braking by replacing $\tanh(v / v_{\text{eps}})$ friction scaling near $v = 0$ with exact Coulomb static stop clamping in `src/physics/forces.js`.
- Fixed IEEE-754 `-0.0` signed zero on `longitudinalAcceleration` when stationary in `src/physics/motorcyclePhysics.js`.
- Fixed wide-angle near-plane grid projection overflow and horizon alignment under high bank angles by adding Liang-Barsky 2D viewport clipping and mathematical eye-plane horizon projection in `src/vendor/three.module.js`.
- Embedded an inline SVG data-URI favicon in `index.html` to eliminate `/favicon.ico` 404 console errors.

### Breaking Changes
- Initial `1.0.0` release; no breaking changes.
