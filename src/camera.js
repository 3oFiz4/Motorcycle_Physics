// Eye Camera
import * as THREE from "three";

export class RiderCamera {
  constructor(aspect, config) {
    if (!config) throw new Error("config cannot be null in camera");

    this.config = config;
    this.camera = new THREE.PerspectiveCamera(68, aspect || 1.77, 0.1, 250);
    this.camera.rotation.order = "YXZ";
    this.mode = "first-person";
    this.riderEyeHeight = 1.56;
    this.riderForwardOffset = -0.1;
    this.riderPitchAngle = -0.27;
    this.leanRollCoupling = 0.62;
    this.smoothedLean = 0.0;
    this.smoothedAccelPitch = 0.0;
  }

  // toggle chase camera
  toggleDebugCamera() {
    this.mode = this.mode === "first-person" ? "chase-debug" : "first-person";
    return this.mode;
  }

  // update camera position for each frame
  update(state, dt = 0.016) {
    if (!state) throw new Error("state cannot be null in camera update");

    const heading = state.heading;
    const sin_h = Math.sin(heading);
    const cos_h = Math.cos(heading);

    const tgt_pitch = Math.max(
      -0.035,
      Math.min(0.035, -state.longitudinalAcceleration * 0.004),
    );
    const alpha = 1.0 - Math.exp(-14.0 * Math.max(0.001, dt));
    this.smoothedAccelPitch += (tgt_pitch - this.smoothedAccelPitch) * alpha;
    this.smoothedLean +=
      (state.leanAngle - this.smoothedLean) *
      (1.0 - Math.exp(-24.0 * Math.max(0.001, dt)));

    // check whether player handle first person vs chase view?
    if (this.mode === "first-person") {
      const phi = this.smoothedLean;
      const sin_phi = Math.sin(phi);
      const cos_phi = Math.cos(phi);

      const loc_x = this.riderEyeHeight * sin_phi;
      const loc_y = this.riderEyeHeight * cos_phi;
      const loc_z = this.riderForwardOffset;

      const world_x = state.x + loc_x * cos_h - loc_z * sin_h;
      const world_y = state.y + Math.max(0.45, loc_y);
      const world_z = state.z + loc_x * sin_h + loc_z * cos_h;

      this.camera.position.set(world_x, world_y, world_z);
      this.camera.rotation.set(
        this.riderPitchAngle + this.smoothedAccelPitch,
        -heading,
        -phi * this.leanRollCoupling,
        "YXZ",
      );
    } else {
      const chase_dist = 3.8;
      const chase_h = 1.85;
      const world_x = state.x - sin_h * chase_dist;
      const world_y = state.y + chase_h;
      const world_z = state.z + cos_h * chase_dist;

      this.camera.position.set(world_x, world_y, world_z);
      this.camera.rotation.set(-0.22, -heading, 0, "YXZ");
    }
  }
}
