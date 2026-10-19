# 3D Motorcycle Physics Simulator

<img width="1920" height="1049" alt="image" src="https://github.com/user-attachments/assets/5b2bcc7c-dd6e-4245-a8d7-fb4438c57836" />


some lightweight, browser-based 3D first-person motorcycle physics simulator built with **HTML5**, **CSS3**, **modern ES Modules**, and **Three.js** that is based on actual real physics.

---

## 1. Requirements and Dependencies

- **Node.js**: Version `18.0.0` or newer (used for the zero-dependency local development server `npm start` and the built-in `node --test` runner).
- **Dependencies**:
  - `three` (`^0.160.0`): Resolved via `<script type="importmap">` to `./src/vendor/three.module.js`.
  - **Zero-Config Offline & Online Execution**: project already includes self-contained Three.js ES module bridge (`src/vendor/three.module.js`) and a local HTTP server (`scripts/server.js`). If `npm install` is run, `scripts/server.js` automatically serves `node_modules/three/build/three.module.js`; if run without `npm install` or in an air-gapped offline environment, the bundled 3D engine renders the scene out-of-the-box with zero external network dependencies.

---

## 2. Installation

### Quick Start

```bash
cd motorcycle-simulator
npm start
```

Then open **http://localhost:8080**

### Optional: Install Official Three.js via npm

If you have internet access and wish to install `node_modules/three` from npm, just do:

```bash
cd motorcycle-simulator
npm install
npm start
```

### Alternative: Run with Python's Built-in HTTP Server

Because the application uses native ES modules and includes `./src/vendor/three.module.js`, you can also serve the directory directly with Python:

```bash
cd motorcycle-simulator
python3 -m http.server 8080
```

### Running Tests

```bash
cd motorcycle-simulator
npm test
# or directly:
node --test tests/physics.test.js
```

---

## 3. Control Reference

| Input                    | Function                                  | Physics & UI Behavior                                                                                                                                                                                               |
| :----------------------- | :---------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`A`**                  | Steer handlebars **left** ($\delta < 0$)  | Deflects the steering bar left. At riding speeds ($v > 3.6\text{ m/s}$), a brief left steer counter-steers the front contact patch left, initiating a **rightward lean** ($\phi > 0$) and **right turn** ($r > 0$). |
| **`D`**                  | Steer handlebars **right** ($\delta > 0$) | Deflects the steering bar right. At riding speeds, a brief right steer counter-steers the front contact patch right, initiating a **leftward lean** ($\phi < 0$) and **left turn** ($r < 0$).                       |
| **`Left Arrow`** (`←`)   | Decrease steering sensitivity             | Smoothly reduces steering sensitivity down to `0.25x` (reflected on the sensitivity slider).                                                                                                                        |
| **`Right Arrow`** (`→`)  | Increase steering sensitivity             | Smoothly increases steering sensitivity up to `2.50x` (reflected on the sensitivity slider).                                                                                                                        |
| **`Left Shift`**         | Increase throttle                         | Smoothly increases the **persistent** throttle setting from `0%` toward `100%`. Releasing `Shift` holds the current throttle level.                                                                                 |
| **`Left Ctrl`**          | Decrease throttle                         | Smoothly decreases the **persistent** throttle setting toward `0%`. Releasing `Ctrl` holds the current throttle level.                                                                                              |
| **`Spacebar`**           | Apply rear brake                          | Applies configurable rear-wheel friction braking force (`F_brake,max = 1750 N` default), decelerating the motorcycle to $0\text{ m/s}$ without driving speed negative.                                              |
| **`R`** _(or UI button)_ | Reset motorcycle                          | Resets the motorcycle to the world origin $(0, 0, 0)$ in an upright stationary state while preserving steering sensitivity.                                                                                         |
| **`C`** _(or UI button)_ | Toggle camera view                        | Switches between the default **1st-Person Rider** view and an optional **Debug Chase** view.                                                                                                                        |

---

## 4. Project Structure

```text
motorcycle-simulator/
├── index.html                  # Application shell, HUD layout, and ES module importmap
├── package.json                # Project metadata, scripts (start, dev, test), and dependencies
├── package-lock.json           # Dependency lockfile
├── README.md                   # Overview, setup instructions, controls, and limitations
├── scripts/
│   └── server.js               # Zero-dependency Node.js local static HTTP server
├── src/
│   ├── main.js                 # Application bootstrap and decoupled RAF / fixed-timestep loop
│   ├── scene.js                # Three.js scene, lighting, light-gray ground, and world-snapped grid
│   ├── camera.js               # First-person rider perspective camera & optional debug chase mode
│   ├── motorcycle.js           # Primitive 3D motorcycle (2.0m x 1.1m x 0.35m black cuboid + steering bar)
│   ├── vendor/
│   │   └── three.module.js     # Three.js ES module bridge and self-contained offline 3D renderer
│   ├── physics/
│   │   ├── config.js           # Centralized SI physical parameters and reference dimensions
│   │   ├── motorcyclePhysics.js# Fixed-timestep (120 Hz) state integrator and telemetry snapshotter
│   │   ├── steering.js         # Handlebar actuator dynamics, trail alignment, and sensitivity scaling
│   │   ├── leanDynamics.js     # Transient roll ODE, out-tracking capsize torque, and roll damping
│   │   └── forces.js           # Longitudinal forces, aerodynamic drag, rear braking, and gyro moments
│   ├── input/
│   │   └── controls.js         # Keyboard & pointer input manager with focus-loss anti-stuck protection
│   └── ui/
│       ├── dashboard.js        # Bottom-right speedometer and interactive left control panel
│       └── telemetry.js        # Throttled (20 Hz) collapsible physics telemetry panel
├── styles/
│   └── main.css                # Responsive HUD styling for controls, telemetry, and speedometer
├── feature/
│   └── FEATURES.md             # Detailed breakdown of implemented, partial, and planned features
├── reports/
│   ├── PHYSICS_MODEL.md        # Coordinate system, SI parameters, equations, and model assumptions
│   ├── TEST_REPORT.md          # Unit, integration, and headless browser test results & bug log
│   └── PERFORMANCE_REPORT.md   # Measured frame execution times, memory profile, and bottlenecks
├── tests/
│   └── physics.test.js         # 12 automated unit & integration tests for Node test runner
└── changelog/
    └── CHANGELOG.md            # Version history and engineering changelog
```

---

## 5. Limitations

1. **Simplified Single-Track Roll & Tire Relaxation Model**: Rather than solving a 10+ degree-of-freedom multibody system with non-linear Pacejka Magic Formula embodied with Laplace Transform with Matrix Multiplication (what?) tire slip surfaces and suspension travel, lateral tire response is modeled in a first-order cornering relaxation filter so it blends quite well with low-speed front-wheel kinematic curvature with high-speed camber thrust ($a_y = g \tan\phi$).
2. **No Front/Rear Suspension Pitch or Tire Lockup Slip**
3. **Flat Ground Assumption**: The test environment is an infinite flat horizontal plane ($Y = 0$). Banking, hills, and road surface friction variations are not modeled yet. I might add obstacles, poles, street, grass, ocean.
4. **Hard Bank Angle Stop**: Lean angle is clamped at $\pm 53^\circ$ ($\pm 0.925\text{ rad}$, representing footpeg/chassis ground contact) with progressive boundary stiffness rather than simulating a lowside crash.


## 6. Coming soon
1. Human
2. Body leans: If the motorcycle can leans, the body should be able to lean too
3. Feet stepping with ground
