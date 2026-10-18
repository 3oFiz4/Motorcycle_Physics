// 3d motorcycle parts
import * as THREE from "three";

// TODO: Ensure the mesh form a TRON Like motorbike.
export class MotorcycleModel {
  constructor(config) {
    if (!config) throw new Error("config cannot be null in model");

    this.config = config;
    this.rootGroup = new THREE.Group();
    this.rollGroup = new THREE.Group();
    this.rootGroup.add(this.rollGroup);

    this.materials = {
      bodyBlack: new THREE.MeshStandardMaterial({
        color: 0x14171d,
        roughness: 0.55,
        metalness: 0.2,
      }),
      bodyAccent: new THREE.MeshStandardMaterial({
        color: 0x262c36,
        roughness: 0.5,
        metalness: 0.25,
      }),
      handlebarMetal: new THREE.MeshStandardMaterial({
        color: 0x2e3542,
        roughness: 0.35,
        metalness: 0.65,
      }),
      gripDark: new THREE.MeshStandardMaterial({
        color: 0x101318,
        roughness: 0.85,
        metalness: 0.05,
      }),
      leftIndicator: new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        roughness: 0.4,
        metalness: 0.1,
      }),
      rightIndicator: new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.4,
        metalness: 0.1,
      }),
      centerSight: new THREE.MeshStandardMaterial({
        color: 0x10b981,
        roughness: 0.3,
        metalness: 0.1,
      }),
      tireRubber: new THREE.MeshStandardMaterial({
        color: 0x1b1e24,
        roughness: 0.88,
        metalness: 0.05,
      }),
    };

    this._build_geometry();
  }

  // build meshes
  _build_geometry() {
    const {
      bodyLength = 2.0,
      bodyHeight = 1.1,
      bodyWidth = 0.35,
      wheelbase = 1.42,
      wheelRadius = 0.31,
      handlebarWidth = 0.78,
    } = this.config;

    const body_geo = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLength);
    this.mainBodyMesh = new THREE.Mesh(body_geo, this.materials.bodyBlack);
    const ground_clear = 0.12;
    this.mainBodyTopY = ground_clear + bodyHeight;
    this.mainBodyMesh.position.set(0, ground_clear + bodyHeight * 0.5, 0);
    this.rollGroup.add(this.mainBodyMesh);

    const spine_geo = new THREE.BoxGeometry(
      bodyWidth * 0.28,
      0.02,
      bodyLength * 0.88,
    );
    this.spineMesh = new THREE.Mesh(spine_geo, this.materials.bodyAccent);
    this.spineMesh.position.set(0, this.mainBodyTopY + 0.01, 0);
    this.rollGroup.add(this.spineMesh);

    const wheel_geo = new THREE.CylinderGeometry(
      wheelRadius,
      wheelRadius,
      0.15,
      16,
    );
    this.rearWheelGroup = new THREE.Group();
    this.rearWheelGroup.position.set(0, wheelRadius, wheelbase * 0.5);
    this.rearWheelMesh = new THREE.Mesh(wheel_geo, this.materials.tireRubber);
    this.rearWheelMesh.rotation.z = Math.PI / 2;
    this.rearWheelGroup.add(this.rearWheelMesh);
    this.rollGroup.add(this.rearWheelGroup);

    this.steeringPivot = new THREE.Group();
    this.steeringPivot.position.set(0, this.mainBodyTopY, -0.64);
    this.rollGroup.add(this.steeringPivot);

    const riser_h = 0.15;
    const stem_geo = new THREE.BoxGeometry(0.07, riser_h, 0.07);
    const stem_mesh = new THREE.Mesh(stem_geo, this.materials.handlebarMetal);
    stem_mesh.position.set(0, riser_h * 0.5, 0);
    this.steeringPivot.add(stem_mesh);

    const bar_y = riser_h;
    const bar_geo = new THREE.BoxGeometry(handlebarWidth, 0.038, 0.042);
    this.handlebarMesh = new THREE.Mesh(bar_geo, this.materials.handlebarMetal);
    this.handlebarMesh.position.set(0, bar_y, 0);
    this.steeringPivot.add(this.handlebarMesh);

    const grip_w = 0.14;
    const grip_geo = new THREE.BoxGeometry(grip_w, 0.048, 0.052);
    const left_grip = new THREE.Mesh(grip_geo, this.materials.gripDark);
    left_grip.position.set(-handlebarWidth * 0.5 + grip_w * 0.5, bar_y, 0);
    this.steeringPivot.add(left_grip);

    const right_grip = new THREE.Mesh(grip_geo, this.materials.gripDark);
    right_grip.position.set(handlebarWidth * 0.5 - grip_w * 0.5, bar_y, 0);
    this.steeringPivot.add(right_grip);

    const cap_geo = new THREE.BoxGeometry(0.025, 0.054, 0.056);
    const left_cap = new THREE.Mesh(cap_geo, this.materials.leftIndicator);
    left_cap.position.set(-handlebarWidth * 0.5 - 0.012, bar_y, 0);
    this.steeringPivot.add(left_cap);

    const right_cap = new THREE.Mesh(cap_geo, this.materials.rightIndicator);
    right_cap.position.set(handlebarWidth * 0.5 + 0.012, bar_y, 0);
    this.steeringPivot.add(right_cap);

    const center_geo = new THREE.BoxGeometry(0.028, 0.056, 0.056);
    const center_marker = new THREE.Mesh(
      center_geo,
      this.materials.centerSight,
    );
    center_marker.position.set(0, bar_y + 0.01, -0.01);
    this.steeringPivot.add(center_marker);

    const fork_geo = new THREE.BoxGeometry(
      0.045,
      this.mainBodyTopY - wheelRadius + 0.05,
      0.055,
    );
    const left_fork = new THREE.Mesh(fork_geo, this.materials.bodyAccent);
    left_fork.position.set(
      -0.11,
      -(this.mainBodyTopY - wheelRadius) * 0.5,
      -0.06,
    );
    this.steeringPivot.add(left_fork);

    const right_fork = new THREE.Mesh(fork_geo, this.materials.bodyAccent);
    right_fork.position.set(
      0.11,
      -(this.mainBodyTopY - wheelRadius) * 0.5,
      -0.06,
    );
    this.steeringPivot.add(right_fork);

    this.frontWheelGroup = new THREE.Group();
    this.frontWheelGroup.position.set(
      0,
      -(this.mainBodyTopY - wheelRadius),
      -0.07,
    );
    this.frontWheelMesh = new THREE.Mesh(wheel_geo, this.materials.tireRubber);
    this.frontWheelMesh.rotation.z = Math.PI / 2;
    this.frontWheelGroup.add(this.frontWheelMesh);
    this.steeringPivot.add(this.frontWheelGroup);
  }

  // legacy caller
  _buildGeometry() {
    this._build_geometry();
  }

  // sync parts with pysics
  syncWithPhysics(state) {
    if (!state) throw new Error("state cannot be null in syncWithPhysics");

    this.rootGroup.position.set(state.x, state.y, state.z);
    this.rootGroup.rotation.set(0, -state.heading, 0, "YXZ");

    const abs_lean = Math.abs(state.leanAngle);
    let lift_y = 0.0;
    if (abs_lean > 0.5) {
      const fact = Math.min(1.0, (abs_lean - 0.5) / 0.932);
      lift_y = fact * 0.16;
    }

    this.rollGroup.position.set(0, lift_y, 0);
    this.rollGroup.rotation.set(0, 0, -state.leanAngle, "YXZ");
    this.steeringPivot.rotation.set(0, -state.steeringAngle, 0, "YXZ");

    [this.frontWheelGroup, this.rearWheelGroup].forEach((w) => {
      w.rotation.x = -state.wheelRotationAngle;
    });
  }
}
