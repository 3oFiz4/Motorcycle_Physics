// 3d ground and environment
import * as THREE from "three";

const GRID_SIZE = 240;
const GRID_DIVISIONS = 120;
const GRID_SNAP_STEP = 10.0;

export class SimulationScene {
  constructor(canvas) {
    if (!canvas) throw new Error("canvas cannot be null in scene");

    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdde2ea);
    this.scene.fog = new THREE.Fog(0xdde2ea, 55, 165);

    this.renderer = this._create_renderer(canvas);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this._setup_lights();
    this._setup_ground_and_grid();
  }

  // fallback if webgl context fail
  _create_renderer(canvas) {
    try {
      return new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch (_err) {
      return new THREE.WebGLRenderer({ canvas, antialias: false });
    }
  }

  // add lights
  _setup_lights() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0xb8c0cc, 0.85);
    hemi.position.set(0, 50, 0);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.75);
    dir.position.set(25, 45, 30);
    this.scene.add(dir);
  }

  // build ground grid
  // TODO: Add ground texture
  // TODO: Add grass texture
  // TODO: Add obstacles like a box, pole whatever
  _setup_ground_and_grid() {
    const geo = new THREE.PlaneGeometry(GRID_SIZE * 2, GRID_SIZE * 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xd6dbe3,
      roughness: 0.92,
      metalness: 0.02,
    });

    this.groundMesh = new THREE.Mesh(geo, mat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = -0.005;
    this.scene.add(this.groundMesh);

    this.gridHelper = new THREE.GridHelper(
      GRID_SIZE,
      GRID_DIVISIONS,
      0x6f7885,
      0x9aa3b0,
    );
    this.gridHelper.position.y = 0.002;
    if (this.gridHelper.material && !Array.isArray(this.gridHelper.material)) {
      this.gridHelper.material.opacity = 0.65;
      this.gridHelper.material.transparent = true;
    }
    this.scene.add(this.gridHelper);
  }

  // snap the grid to bike position
  updateEnvironmentOrigin(world_x, world_z) {
    const snap_x = Math.round(world_x / GRID_SNAP_STEP) * GRID_SNAP_STEP;
    const snap_z = Math.round(world_z / GRID_SNAP_STEP) * GRID_SNAP_STEP;

    [this.groundMesh, this.gridHelper].forEach((mesh) => {
      mesh.position.x = snap_x;
      mesh.position.z = snap_z;
    });
  }

  // resize canvas
  onResize(w, h, cam) {
    if (!w || !h || !cam) return;
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // RENDER
  render(cam) {
    if (!cam) throw new Error("camera cannot be null in render");
    this.renderer.render(this.scene, cam);
  }
}
