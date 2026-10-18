# Test Report (`TEST_REPORT.md`)

## 1. Test Environment

- **OS / Platform**: Linux x86_64 (`Debian / Ubuntu VM Sandbox`)
- **Node.js Runtime**: `v18.20.4` (`node --test` built-in runner)
- **Browser Engine**: Headless Chromium `154.0.8037.92` via Python Selenium WebDriver (`1440x900` viewport)
- **Test Date**: October 2026

---

## 2. Automated Unit & Integration Tests (`tests/physics.test.js`)

All **12 automated tests** in `tests/physics.test.js` were executed via `node --test tests/physics.test.js` and **passed (12/12 pass, 0 fail)**:

| # | Test Name | Expected Behavior | Observed Behavior | Status |
| :- | :--- | :--- | :--- | :---: |
| 1 | Initial state uses SI units and rests at equilibrium | Speed, acceleration, steer angle, lean angle, yaw rate, and throttle initialize to `0` and remain `0` over `2.0 s` idle simulation. | `speed = 0`, `leanAngle = 0`, `heading = 0` after 240 steps (`2.0 s`). | **PASS** |
| 2 | Throttle control is persistent between 0% and 100% | Holding `Shift` increases throttle; releasing `Shift` holds the current percentage; holding `Ctrl` decreases throttle; bounds clamp to `[0.0, 1.0]`. | After `0.8 s` `throttleUp`, `throttle = 0.44` (persisted across `0.5 s` release); saturated cleanly at `1.0` and `0.0`. | **PASS** |
| 3 | Longitudinal motion follows Newton's second law | $a_x = F_{\text{net}} / m$; speed increases progressively; aerodynamic drag grows quadratically with $v$. | Exact match $|a_x - F_{\text{net}}/m| < 10^{-9}$; after `4.0 s` at `75%` throttle, $v > 15\text{ m/s}$ and $F_{\text{drag}} > 50\text{ N}$. | **PASS** |
| 4 | Rear brake (Spacebar) decelerates via physics and never drives speed negative | Engaging rear brake generates negative acceleration ($a_x < -5\text{ m/s}^2$), reduces speed gradually, and clamps cleanly at `0.0 m/s`. | $F_{\text{brake}} = 1750\text{ N}$, $a_x < -5\text{ m/s}^2$; after coming to rest, `speed === 0.0` and `longitudinalAcceleration === 0.0`. | **PASS** |
| 5 | Steering input (A/D) controls handlebar angle without rotating stationary bike | Pressing `A` ($\delta < 0$) or `D` ($\delta > 0$) at $v = 0\text{ m/s}$ rotates the steering bar while `heading` and `yawRate` remain `0`. | $\delta = -0.269\text{ rad}$ (`A`) and $+0.269\text{ rad}$ (`D`) at rest; `heading === 0.0` and `yawRate === 0.0`. | **PASS** |
| 6 | High-speed counter-steering initiates opposite lean and intended turn | At $v = 20\text{ m/s}$ ($72\text{ km/h}$), a `0.35 s` left steer (`A`, $\delta < 0$) produces positive out-tracking and gyroscopic moments, rolling the bike right ($\phi > 0$) and turning right ($r > 0$), satisfying $\tan\phi \approx a_y / g$. | $\delta < -0.02\text{ rad}$, $M_{\text{outtrack}} > 0$, $M_{\text{gyro}} > 0$, $\phi > 0.05\text{ rad}$, $r > 0.02\text{ rad/s}$; after releasing `A`, bike carved right turn ($x > 0.4\text{ m}$) with $|\tan\phi - a_y/g| < 0.05$. | **PASS** |
| 7 | Low-speed vs high-speed turning regime difference | At $v = 1.8\text{ m/s}$ ($6.5\text{ km/h}$), left steer (`A`) turns left ($r < 0$); at $v = 18.0\text{ m/s}$ ($65\text{ km/h}$), left steer (`A`) counter-steers into a right lean ($\phi > 0$) and right turn ($r > 0$). | Low speed: $\delta < 0 \implies r < -0.05\text{ rad/s}$ (left turn). High speed: $\delta < 0 \implies \phi > 0.08\text{ rad}, r > +0.05\text{ rad/s}$ (right turn). | **PASS** |
| 8 | Steering sensitivity scales steering response | Higher sensitivity (`2.0x` vs `0.4x`) produces larger handlebar deflection and stronger resulting roll angle for the same input duration. | At `0.25 s`, $\delta_{2.0\text{x}} > 1.4\,\delta_{0.4\text{x}}$ and $|\phi_{2.0\text{x}}| > |\phi_{0.4\text{x}}|$. | **PASS** |
| 9 | Numerical stability under rapid control reversals and frame drops | 40 cycles of alternating `A`/`D` + brake pulses with `0.25 s` frame-drop spikes keep all state values finite and within physical bounds. | All states finite; $|\phi| \le \phi_{\max}$ and $|\delta| \le \delta_{\max}$ throughout. | **PASS** |
| 10 | Focus-loss / `releaseAllHeldInputs` clears held keys while preserving persistent settings | Calling `releaseAllHeldInputs()` clears `steerLeft`, `throttleUp`, `rearBrake`, and `sensitivityUp` while preserving `throttle` and `steeringSensitivity`. | Held flags reset to `false`; `throttle = 0.65` and `steeringSensitivity = 1.45` preserved. | **PASS** |
| 11 | Runtime configuration updates (`maxRearBrakeForce`) affect physics | Increasing `maxRearBrakeForce` from `1200 N` to `2600 N` produces stronger deceleration from $25\text{ m/s}$. | After `1.0 s` braking, $v_{2600\text{N}} < v_{1200\text{N}} - 4.0\text{ m/s}$. | **PASS** |
| 12 | Telemetry snapshot matches underlying physics state | `getTelemetrySnapshot()` accurately converts SI values to $\text{km/h}$, degrees, and percentages. | `speedKmh === speed * 3.6`, `throttlePercent === 50.0`, `regime === 'COUNTER-STEER (DYNAMIC)'`. | **PASS** |

---

## 3. End-to-End Browser & UI Verification

Using headless Chromium (`1440x900`) and Selenium WebDriver against the running local HTTP server:

1. **Startup & Scene Inspection**:
   - Verified that `index.html` loads cleanly, initializes `window.__MOTORCYCLE_SIM__`, renders the light-gray ground plane, subtle darker-gray grid lines, black cuboid motorcycle body, visible straight steering bar with left/right grips and center sight, left control panel, top-right telemetry panel, and bottom-right speedometer.
2. **Real-Time Control & UI Synchronization**:
   - Dispatched `ShiftLeft` keydown for `140` steps (`1.17 s`), verified persistent throttle rose to `64%` (`#speedo-throttle-value` and `#ctrl-throttle-value` both displayed `64%`) and remained at `64%` after `ShiftLeft` keyup.
   - Dispatched `ArrowRight` keydown for `30` steps, verified steering sensitivity increased from `1.00x` to `1.14x` in both the physics state (`1.1375`) and UI (`1.14x`).
   - Accelerated to `129.0 km/h` (`35.85 m/s`, Gear `4`, `7546 RPM`) and dispatched `KeyA` (steer left) for `0.35 s` (`42` steps):
     - Handlebar angle updated to `-6.34° (-0.111 rad) · LEFT` (`#ctrl-steer-angle-value` and `#tel-steer-angle`), and the 3D steering bar rotated visibly counter-clockwise in the first-person view.
     - On-screen `A Steer Left (-δ)` indicator pill activated (`.is-active` class true).
     - Out-tracking roll moment reached `+850.1 N·m` and gyroscopic precession moment reached `+114.5 N·m` (`H = 157.3 kg·m²/s`), banking the motorcycle right to `+15.83° (+0.276 rad)` with yaw rate `+3.19 °/s` (`+0.056 rad/s`).
3. **Browser Console Audit**:
   - Captured `driver.get_log("browser")` across startup, control actuation, and 600 rendered frames: **`[]` (0 errors, 0 warnings)**.

---

## 4. Bugs Found and Fixed During Development

1. **Bug #1 — Asymptotic Creep Under Rear Braking Near Zero Velocity (`src/physics/forces.js`)**:
   - **Symptom**: `tests/physics.test.js` Test 4 initially failed with `actual: 0.0000268073 m/s` vs `expected: 0 m/s` after `6.0 s` of full rear braking.
   - **Root Cause**: Smoothing Coulomb rolling resistance and rear brake force with $\tanh(v / 0.08)$ caused braking force to vanish linearly as $v \to 0$, producing exponential decay ($v(t) \propto e^{-\lambda t}$) rather than a finite-time stop.
   - **Fix**: Replaced the $\tanh(v/v_{\text{eps}})$ attenuation on dry friction forces with full Coulomb braking down to $v = 0$ and static stiction clamping when $v + a_x \Delta t \le 0$.
2. **Bug #2 — Signed Zero (`-0.0`) Longitudinal Acceleration at Rest (`src/physics/motorcyclePhysics.js`)**:
   - **Symptom**: `Object.is(sim.state.longitudinalAcceleration, 0)` failed in `assert.equal` because `-prevSpeed / dt` evaluated to `-0.0` when `prevSpeed === 0.0`.
   - **Fix**: Guarded the stopping deceleration calculation with `prevSpeed > 0.0 ? -prevSpeed / dt : 0.0`.
3. **Bug #3 — Near-Plane Wide-Angle Grid Line Coordinate Overflow (`src/vendor/three.module.js`)**:
   - **Symptom**: Visual inspection of the counter-steering screenshot revealed a bundle of diagonal grid lines folding across the upper-right sky when the camera banked at high speed.
   - **Root Cause**: Grid lines located $\pm 100\text{ m}$ laterally that intersected the camera near plane ($z = 0.08\text{ m}$) projected to screen coordinates exceeding $\pm 750,000\text{ px}$, overflowing the 16-bit fixed-point coordinate limit ($\pm 32,767\text{ px}$) in Chromium's 2D canvas rasterizer. Also, projecting the horizon at finite distance $y = 0$ instead of the camera's horizontal eye plane $y = y_{\text{cam}}$ caused distant lateral grid lines to sit slightly above the drawn horizon line.
   - **Fix**: Added a Liang-Barsky 2D viewport segment clipper (`clipAndDrawSegment`) before drawing grid lines and projected the horizon along the exact asymptotic plane $y = y_{\text{cam}}$.
4. **Bug #4 — Missing Favicon 404 Console Error (`index.html`)**:
   - **Symptom**: Headless Chromium logged a `404 (Not Found)` network error for `/favicon.ico`.
   - **Fix**: Embedded an inline SVG data-URI `<link rel="icon" ...>` in `index.html`, resulting in zero console messages.

---

## 5. Known Failures or Limitations

- **None of the 12 acceptance criteria failed.**
- **Testing Limitation**: Browser benchmarks and visual verification were performed in headless Chromium using software rendering inside the Linux VM sandbox. Hardware-accelerated GPU WebGL frame rates on physical desktop GPUs are expected to be higher ($60\text{–}144+\text{ FPS}$ capped by monitor VSync).
