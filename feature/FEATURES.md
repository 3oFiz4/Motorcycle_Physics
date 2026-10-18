# Feature Report (`FEATURES.md`)

## 1. Implemented Features

### 1.1 Coherent SI Motorcycle Physics Engine (`src/physics/`)
- **Fixed-Timestep Numerical Integration (`motorcyclePhysics.js`)**: Runs at a deterministic $120\text{ Hz}$ ($\Delta t = 8.333\text{ ms}$) decoupled from `requestAnimationFrame()` using an accumulator loop capped at $8$ catch-up substeps per frame and a $0.1\text{ s}$ maximum frame-delta clamp to survive tab switches and frame drops without instability.
- **Longitudinal Dynamics (`forces.js`)**: Implements Newton's second law ($a_x = F_{\text{net}} / m$) combining throttle-controlled engine tractive force (with power roll-off $P_{\text{max}} = 72\text{ kW}$), quadratic aerodynamic drag ($\frac{1}{2}\rho C_d A v|v|$), Coulomb rolling resistance ($C_{rr} m g$), closed-throttle engine compression braking, and adjustable rear-wheel friction braking.
- **Steering & Counter-Steering Emergence (`steering.js`, `leanDynamics.js`)**:
  - Strictly separates handlebar steering angle ($\delta$) from motorcycle heading ($\psi$) and roll/lean angle ($\phi$).
  - Pressing `A` or `D` deflects the steering bar via a speed-scaled actuator model and never directly rotates the motorcycle's yaw when stationary.
  - At riding speeds ($v > 3.6\text{ m/s}$), deflecting the handlebars left ($\delta < 0$) causes the front contact patch to out-track leftward beneath the elevated center of mass and induces a gyroscopic precession moment, rolling the motorcycle **rightward** ($\phi > 0$) and developing a **right-hand turn** ($r > 0$).
  - When steering input is released during a turn, mechanical trail self-alignment brings the front wheel toward the neutral kinematic equilibrium angle ($\delta_{\text{neutral}}$) while gentle weave/capsize self-righting gradually restores upright posture.
- **Speed-Dependent Regime Transition (`forces.js`, `leanDynamics.js`)**: Smoothly blends low-speed direct kinematic turning ($v \ll 3.6\text{ m/s}$, where steering left turns left) with high-speed dynamic counter-steering and camber-thrust turning ($a_y = g\tan\phi$).
- **Wheel Gyroscopic Effects (`forces.js`)**: Computes front and rear wheel angular velocity ($\omega_w = v / R_w$) and spin angular momentum ($H = 2 I_{wy} \omega_w$), applying the front-wheel gyroscopic precession roll moment $M_{\text{gyro}} = -I_{wy}\frac{v}{R_w}\cos\epsilon(\dot{\delta} + k\frac{v}{L}\delta_{\text{active}})$ about the roll axis.
- **Lean-Angle Momentum Balance & Fall Mechanics (`leanDynamics.js`, `motorcyclePhysics.js`)**:
  - Implements theoretical roll equilibrium: to sustain a lean angle $\phi$, forward velocity must produce sufficient lateral centripetal acceleration ($a_y \ge g \tan|\phi|$) and gyroscopic torque to oppose gravity's overturning moment ($M_{\text{grav}} = m g h \sin|\phi|$).
  - Dynamically calculates minimum required speed $v_{\text{min}} = \sqrt{\frac{g \tan|\phi|}{\kappa_{\text{eff}}}}$ for any lean angle $\phi$. Within the upright tolerance ($|\phi| \le 0.07\text{ rad} \approx 4.0^\circ$), stationary/slow riders naturally balance ($v_{\text{min}} = 0$).
  - If the motorcycle is leaned over and lacks sufficient speed/momentum (e.g. slowing to a stop while banked, or given an angle without speed), or exceeds safe clearance limits ($\sim 53^\circ$), gravity overturns the motorcycle onto its side ($\approx 82^\circ$, lying flat on the ground).
  - Enters a persistent `isFallen` state: throttle and steering are disengaged, road sliding friction decelerates any remaining velocity to $0$, and the bike remains fallen indefinitely until the user explicitly resets (via `R` key or the UI Reset button).
- **Rear-Wheel Braking (`forces.js`, `motorcyclePhysics.js`)**: Activated by `Spacebar` (or the UI button), smoothly engages rear-wheel braking force up to `maxRearBrakeForce` ($1750\text{ N}$ default, adjustable live in UI) and clamps velocity cleanly at $0.0\text{ m/s}$ without unintended reverse motion.

### 1.2 Minimal 3D Environment & Primitive Motorcycle (`src/scene.js`, `src/motorcycle.js`, `src/camera.js`)
- **Infinite World-Aligned Ground & Grid (`scene.js`)**: Large light-gray ground plane (`#d6dbe3`) with subtle darker-gray major/minor grid lines (`#6f7885` / `#9aa3b0`). The ground and grid snap in $10\text{ m}$ world-aligned increments around the motorcycle's $(X, Z)$ position so grid lines stay fixed in world coordinates while providing an endless test surface.
- **Primitive 3D Motorcycle (`motorcycle.js`)**: Built from reusable Three.js primitives featuring a black cuboid main body ($2.0\text{ m} \times 1.1\text{ m} \times 0.35\text{ m}$), centerline reference strip, rotating front/rear wheel cylinders, and a front steering column with a straight $0.78\text{ m}$ handlebar and high-contrast grip end-caps visible in the rider's view.
- **First-Person Rider Camera (`camera.js`)**: Positioned at plausible rider eye level ($y = 1.56\text{ m}$ above ground), aligned with forward heading, pitched slightly downward ($-15.5^\circ$) to keep both the horizon and the straight steering bar in view, and coupled smoothly ($62\%$) to motorcycle roll angle $\phi$. Includes an optional debug chase camera (`C` key or UI button).

### 1.3 Interactive Controls, Speedometer & Telemetry (`src/input/controls.js`, `src/ui/`)
- **Full Keyboard & Direct UI Control (`controls.js`, `dashboard.js`)**: Bidirectional synchronization between keyboard controls (`A`, `D`, `Left/Right Arrow`, `Left Shift`, `Left Ctrl`, `Spacebar`) and interactive UI buttons/sliders.
- **Anti-Stuck Focus Protection (`controls.js`)**: Automatically releases held keys on `window.blur`, `document.visibilitychange`, and `contextmenu` while preserving persistent throttle and steering sensitivity.
- **Bottom-Right Speedometer (`dashboard.js`)**: Displays live simulated speed in $\text{km/h}$ and $\text{m/s}$, artificial horizon bank dial, persistent throttle bar and percentage, rear-brake status badge, gear ($1\text{–}6$), and engine RPM.
- **Collapsible Telemetry Panel (`telemetry.js`)**: Throttled to $20\text{ Hz}$ ($50\text{ ms}$ interval) to avoid per-substep DOM overhead; exposes speed, longitudinal/lateral acceleration, handlebar angle ($\text{deg}/\text{rad}$), lean angle ($\text{deg}/\text{rad}$), steady-state reference lean $\arctan(a_y/g)$, yaw rate, out-tracking and gyroscopic roll moments, longitudinal forces, world pose, fixed timestep, and FPS.

---

## 2. Partially Implemented Features

- **Drivetrain & Transmission Model (`motorcyclePhysics.js`)**: Engine drive force uses a continuous speed-dependent power envelope ($F_{\text{max}} = 3450\text{ N}$, $P_{\text{max}} = 72\text{ kW}$) while gear ($1\text{–}6$) and engine RPM are derived continuously from rear-wheel speed and throttle for speedometer observability rather than modeling discrete clutch engagement or manual gear shifts.
- **Tire Slip & Friction Circle (`forces.js`)**: Lateral tire response uses a first-order relaxation filter toward kinematic/camber lateral acceleration rather than a full coupled longitudinal-lateral Pacejka friction ellipse.

---

## 3. Planned Features (Future Scope)

- **Front Brake & Weight Transfer Pitch Dynamics**: Independent front-brake control with telescopic fork compression, longitudinal load transfer ($\Delta N = m a_x h / L$), and stoppie/wheelie pitch limits.
- **Rear-Wheel Lockup & Highside Slip Modeling**: Coupled longitudinal/lateral tire saturation when rear braking is applied aggressively at high lean angles.
- **Rider Upper-Body Lean Offset**: Optional independent rider torso shift relative to the motorcycle centerline to demonstrate hanging-off vs upright cornering lean angles.
- **Physics Test Track Markers**: Optional slalom cones and constant-radius skidpad rings on the ground plane for standardized maneuver benchmarking.
