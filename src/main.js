// MAIN CYCLE
import { MotorcyclePhysics } from "./physics/motorcyclePhysics.js";
import { SimulationScene } from "./scene.js";
import { MotorcycleModel } from "./motorcycle.js";
import { RiderCamera } from "./camera.js";
import { ControlsManager } from "./input/controls.js";
import { DashboardUI } from "./ui/dashboard.js";
import { TelemetryUI } from "./ui/telemetry.js";

export class MotorcycleSimulatorApp {
  constructor() {
    this.canvas = document.getElementById("sim-canvas");
    if (!this.canvas) throw new Error("canvas element not found in dom");

    this.physics = new MotorcyclePhysics();
    this.simScene = new SimulationScene(this.canvas);
    this.motorcycleModel = new MotorcycleModel(this.physics.config);
    this.simScene.scene.add(this.motorcycleModel.rootGroup);

    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.riderCamera = new RiderCamera(aspect, this.physics.config);

    this.controls = new ControlsManager(this.physics, {
      onReset: () => this.resetSimulation(),
      onToggleCamera: () => this.toggleCameraMode(),
    });

    this.dashboard = new DashboardUI(this.physics, this.controls, {
      onReset: () => this.resetSimulation(),
      onToggleCamera: () => this.toggleCameraMode(),
    });

    this.telemetry = new TelemetryUI(this.physics);

    this.lastFrameTimeMs = null;
    this.animationFrameId = null;

    this._onResize = () => {
      this.simScene.onResize(
        window.innerWidth,
        window.innerHeight,
        this.riderCamera.camera,
      );
    };
    window.addEventListener("resize", this._onResize);

    // sync visuals on boot
    this._sync_visuals(0.016);
    this.dashboard.update();
    this.telemetry.update(performance.now(), 0.016);
    this.simScene.render(this.riderCamera.camera);
  }

  // reset the entire simulations
  resetSimulation() {
    this.controls.releaseAllInputs();
    this.physics.reset();
    this._sync_visuals(0.016);
    this.dashboard.update();
  }

  // camera view toggle
  toggleCameraMode() {
    return this.riderCamera.toggleDebugCamera();
  }

  // sync all 3d components
  _sync_visuals(dt) {
    const s = this.physics.state;
    this.motorcycleModel.syncWithPhysics(s);
    this.simScene.updateEnvironmentOrigin(s.x, s.z);
    this.riderCamera.update(s, dt);
  }

  // legacy caller
  _syncVisuals(dt) {
    this._sync_visuals(dt);
  }

  // start animation loop
  start() {
    if (this.animationFrameId !== null)
      cancelAnimationFrame(this.animationFrameId);
    this.lastFrameTimeMs = performance.now();

    const loop = (now_ms) => {
      this.animationFrameId = requestAnimationFrame(loop);
      const elapsed_sec = Math.max(
        0.0,
        (now_ms - this.lastFrameTimeMs) * 0.001,
      );
      this.lastFrameTimeMs = now_ms;

      this.physics.update(elapsed_sec);
      this._sync_visuals(elapsed_sec);
      this.simScene.render(this.riderCamera.camera);
      this.dashboard.update();
      this.telemetry.update(now_ms, elapsed_sec);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }
}

// HOOK the window onload
window.addEventListener("DOMContentLoaded", () => {
  const app = new MotorcycleSimulatorApp();
  window.__MOTORCYCLE_SIM__ = app;
  app.start();
});
