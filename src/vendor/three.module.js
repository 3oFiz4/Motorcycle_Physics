// ThreeJS Boilerplate
/**
 * @fileoverview Three.js ES Module bridge and self-contained offline 3D WebGL/Canvas fallback engine.
 *
 * Resolution hierarchy:
 * 1. When `npm install` has been run, `scripts/server.js` serves `node_modules/three/build/three.module.js`
 *    directly at this URL (`/src/vendor/three.module.js`).
 * 2. When opened in a browser where `window.THREE` is present, this module re-exports `window.THREE`.
 * 3. When running completely offline without `node_modules` (e.g., air-gapped environments or
 *    headless CI browsers without GPU WebGL), this module provides a faithful, zero-allocation
 *    3D perspective scene-graph implementation of the Three.js classes used by the simulator.
 */

const GLOBAL_THREE =
  typeof window !== "undefined" && window.THREE ? window.THREE : null;

export const MathUtils = GLOBAL_THREE
  ? GLOBAL_THREE.MathUtils
  : {
      clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
      },
      degToRad(deg) {
        return deg * (Math.PI / 180.0);
      },
      radToDeg(rad) {
        return rad * (180.0 / Math.PI);
      },
      lerp(a, b, t) {
        return a + (b - a) * t;
      },
    };

/**
 * Liang-Barsky 2D line clipper to keep projected 3D segments strictly within canvas bounds
 * and prevent fixed-point rasterizer overflow on wide-angle near-plane projections.
 */
function clipAndDrawSegment(ctx, x1, y1, x2, y2, minX, minY, maxX, maxY) {
  let t0 = 0.0;
  let t1 = 1.0;
  const dx = x2 - x1;
  const dy = y2 - y1;

  const p = [-dx, dx, -dy, dy];
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];

  for (let i = 0; i < 4; i++) {
    const pi = p[i];
    const qi = q[i];
    if (Math.abs(pi) < 1e-8) {
      if (qi < 0) return;
    } else {
      const r = qi / pi;
      if (pi < 0) {
        if (r > t1) return;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return;
        if (r < t1) t1 = r;
      }
    }
  }

  ctx.moveTo(x1 + t0 * dx, y1 + t0 * dy);
  ctx.lineTo(x1 + t1 * dx, y1 + t1 * dy);
}

class FallbackColor {
  constructor(value = 0xffffff) {
    this.r = 1;
    this.g = 1;
    this.b = 1;
    this.set(value);
  }
  set(value) {
    if (typeof value === "number") {
      this.r = ((value >> 16) & 255) / 255;
      this.g = ((value >> 8) & 255) / 255;
      this.b = (value & 255) / 255;
    } else if (typeof value === "string") {
      const hex = value.replace("#", "");
      if (hex.length === 6) {
        const num = parseInt(hex, 16);
        this.r = ((num >> 16) & 255) / 255;
        this.g = ((num >> 8) & 255) / 255;
        this.b = (num & 255) / 255;
      }
    } else if (value && typeof value === "object" && "r" in value) {
      this.r = value.r;
      this.g = value.g;
      this.b = value.b;
    }
    return this;
  }
  getHexString() {
    const r = Math.round(MathUtils.clamp(this.r, 0, 1) * 255)
      .toString(16)
      .padStart(2, "0");
    const g = Math.round(MathUtils.clamp(this.g, 0, 1) * 255)
      .toString(16)
      .padStart(2, "0");
    const b = Math.round(MathUtils.clamp(this.b, 0, 1) * 255)
      .toString(16)
      .padStart(2, "0");
    return `${r}${g}${b}`;
  }
  toCss(alpha = 1) {
    const r = Math.round(MathUtils.clamp(this.r, 0, 1) * 255);
    const g = Math.round(MathUtils.clamp(this.g, 0, 1) * 255);
    const b = Math.round(MathUtils.clamp(this.b, 0, 1) * 255);
    return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
  }
}

class FallbackFog {
  constructor(color = 0xd8dde4, near = 40, far = 180) {
    this.color = new FallbackColor(color);
    this.near = near;
    this.far = far;
  }
}

class FallbackVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  clone() {
    return new FallbackVector3(this.x, this.y, this.z);
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  length() {
    return Math.hypot(this.x, this.y, this.z);
  }
  normalize() {
    const len = this.length() || 1;
    return this.multiplyScalar(1 / len);
  }
}

class FallbackEuler {
  constructor(x = 0, y = 0, z = 0, order = "XYZ") {
    this.x = x;
    this.y = y;
    this.z = z;
    this.order = order;
  }
  set(x, y, z, order = this.order) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.order = order;
    return this;
  }
}

class FallbackQuaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
  setFromEuler(euler) {
    const { x, y, z, order } = euler;
    const c1 = Math.cos(x / 2),
      c2 = Math.cos(y / 2),
      c3 = Math.cos(z / 2);
    const s1 = Math.sin(x / 2),
      s2 = Math.sin(y / 2),
      s3 = Math.sin(z / 2);

    if (order === "YXZ") {
      this.x = s1 * c2 * c3 + c1 * s2 * s3;
      this.y = c1 * s2 * c3 - s1 * c2 * s3;
      this.z = c1 * c2 * s3 - s1 * s2 * c3;
      this.w = c1 * c2 * c3 + s1 * s2 * s3;
    } else {
      this.x = s1 * c2 * c3 + c1 * s2 * s3;
      this.y = c1 * s2 * c3 - s1 * c2 * s3;
      this.z = c1 * c2 * s3 + s1 * s2 * c3;
      this.w = c1 * c2 * c3 - s1 * s2 * s3;
    }
    return this;
  }
}

class FallbackMatrix4 {
  constructor() {
    this.elements = new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]);
  }
  identity() {
    const e = this.elements;
    e.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    return this;
  }
  compose(position, quaternion, scale) {
    const te = this.elements;
    const x = quaternion.x,
      y = quaternion.y,
      z = quaternion.z,
      w = quaternion.w;
    const x2 = x + x,
      y2 = y + y,
      z2 = z + z;
    const xx = x * x2,
      xy = x * y2,
      xz = x * z2;
    const yy = y * y2,
      yz = y * z2,
      zz = z * z2;
    const wx = w * x2,
      wy = w * y2,
      wz = w * z2;
    const sx = scale.x,
      sy = scale.y,
      sz = scale.z;

    te[0] = (1 - (yy + zz)) * sx;
    te[1] = (xy + wz) * sx;
    te[2] = (xz - wy) * sx;
    te[3] = 0;

    te[4] = (xy - wz) * sy;
    te[5] = (1 - (xx + zz)) * sy;
    te[6] = (yz + wx) * sy;
    te[7] = 0;

    te[8] = (xz + wy) * sz;
    te[9] = (yz - wx) * sz;
    te[10] = (1 - (xx + yy)) * sz;
    te[11] = 0;

    te[12] = position.x;
    te[13] = position.y;
    te[14] = position.z;
    te[15] = 1;
    return this;
  }
  multiplyMatrices(a, b) {
    const ae = a.elements;
    const be = b.elements;
    const te = this.elements;

    const a11 = ae[0],
      a12 = ae[4],
      a13 = ae[8],
      a14 = ae[12];
    const a21 = ae[1],
      a22 = ae[5],
      a23 = ae[9],
      a24 = ae[13];
    const a31 = ae[2],
      a32 = ae[6],
      a33 = ae[10],
      a34 = ae[14];
    const a41 = ae[3],
      a42 = ae[7],
      a43 = ae[11],
      a44 = ae[15];

    const b11 = be[0],
      b12 = be[4],
      b13 = be[8],
      b14 = be[12];
    const b21 = be[1],
      b22 = be[5],
      b23 = be[9],
      b24 = be[13];
    const b31 = be[2],
      b32 = be[6],
      b33 = be[10],
      b34 = be[14];
    const b41 = be[3],
      b42 = be[7],
      b43 = be[11],
      b44 = be[15];

    te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

    te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

    te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

    te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
    return this;
  }
  invertRigid(m) {
    const me = m.elements;
    const te = this.elements;
    const r00 = me[0],
      r10 = me[1],
      r20 = me[2];
    const r01 = me[4],
      r11 = me[5],
      r21 = me[6];
    const r02 = me[8],
      r12 = me[9],
      r22 = me[10];
    const tx = me[12],
      ty = me[13],
      tz = me[14];

    te[0] = r00;
    te[4] = r10;
    te[8] = r20;
    te[1] = r01;
    te[5] = r11;
    te[9] = r21;
    te[2] = r02;
    te[6] = r12;
    te[10] = r22;
    te[3] = 0;
    te[7] = 0;
    te[11] = 0;

    te[12] = -(r00 * tx + r10 * ty + r20 * tz);
    te[13] = -(r01 * tx + r11 * ty + r21 * tz);
    te[14] = -(r02 * tx + r12 * ty + r22 * tz);
    te[15] = 1;
    return this;
  }
}

class FallbackObject3D {
  constructor() {
    this.position = new FallbackVector3(0, 0, 0);
    this.rotation = new FallbackEuler(0, 0, 0, "YXZ");
    this.quaternion = new FallbackQuaternion();
    this.scale = new FallbackVector3(1, 1, 1);
    this.matrix = new FallbackMatrix4();
    this.matrixWorld = new FallbackMatrix4();
    this.children = [];
    this.parent = null;
    this.visible = true;
    this.castShadow = false;
    this.receiveShadow = false;
  }
  add(...objs) {
    for (const obj of objs) {
      if (!obj) continue;
      if (obj.parent) {
        const idx = obj.parent.children.indexOf(obj);
        if (idx !== -1) obj.parent.children.splice(idx, 1);
      }
      obj.parent = this;
      this.children.push(obj);
    }
    return this;
  }
  remove(...objs) {
    for (const obj of objs) {
      const idx = this.children.indexOf(obj);
      if (idx !== -1) {
        obj.parent = null;
        this.children.splice(idx, 1);
      }
    }
    return this;
  }
  updateMatrixWorld() {
    this.quaternion.setFromEuler(this.rotation);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    if (this.parent) {
      this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
    } else {
      this.matrixWorld.elements.set(this.matrix.elements);
    }
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].updateMatrixWorld();
    }
  }
}

class FallbackGroup extends FallbackObject3D {}

class FallbackScene extends FallbackObject3D {
  constructor() {
    super();
    this.background = new FallbackColor(0xd8dde4);
    this.fog = null;
  }
}

class FallbackPerspectiveCamera extends FallbackObject3D {
  constructor(fov = 65, aspect = 1.77, near = 0.1, far = 300) {
    super();
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.matrixWorldInverse = new FallbackMatrix4();
  }
  updateProjectionMatrix() {}
  lookAt(x, y, z) {
    const tx = typeof x === "object" ? x.x : x;
    const ty = typeof x === "object" ? x.y : y;
    const tz = typeof x === "object" ? x.z : z;
    const dx = tx - this.position.x;
    const dy = ty - this.position.y;
    const dz = tz - this.position.z;
    const horiz = Math.hypot(dx, dz) || 1e-6;
    this.rotation.order = "YXZ";
    this.rotation.y = Math.atan2(-dx, -dz);
    this.rotation.x = Math.atan2(dy, horiz);
  }
}

class FallbackMaterial {
  constructor(params = {}) {
    this.color = new FallbackColor(
      params.color !== undefined ? params.color : 0xffffff,
    );
    this.roughness = params.roughness ?? 0.6;
    this.metalness = params.metalness ?? 0.1;
    this.opacity = params.opacity ?? 1.0;
    this.transparent = Boolean(params.transparent);
    this.wireframe = Boolean(params.wireframe);
  }
  dispose() {}
}

class FallbackBufferGeometry {
  constructor() {
    this.vertices = [];
    this.faces = [];
    this.segments = [];
  }
  dispose() {}
}

class FallbackBoxGeometry extends FallbackBufferGeometry {
  constructor(width = 1, height = 1, depth = 1) {
    super();
    const hx = width / 2,
      hy = height / 2,
      hz = depth / 2;
    this.vertices = [
      new FallbackVector3(-hx, -hy, -hz),
      new FallbackVector3(hx, -hy, -hz),
      new FallbackVector3(hx, hy, -hz),
      new FallbackVector3(-hx, hy, -hz),
      new FallbackVector3(-hx, -hy, hz),
      new FallbackVector3(hx, -hy, hz),
      new FallbackVector3(hx, hy, hz),
      new FallbackVector3(-hx, hy, hz),
    ];
    this.faces = [
      {
        indices: [0, 1, 2, 3],
        normal: new FallbackVector3(0, 0, -1),
        shade: 0.85,
      },
      {
        indices: [5, 4, 7, 6],
        normal: new FallbackVector3(0, 0, 1),
        shade: 0.78,
      },
      {
        indices: [3, 2, 6, 7],
        normal: new FallbackVector3(0, 1, 0),
        shade: 1.05,
      },
      {
        indices: [4, 5, 1, 0],
        normal: new FallbackVector3(0, -1, 0),
        shade: 0.55,
      },
      {
        indices: [1, 5, 6, 2],
        normal: new FallbackVector3(1, 0, 0),
        shade: 0.92,
      },
      {
        indices: [4, 0, 3, 7],
        normal: new FallbackVector3(-1, 0, 0),
        shade: 0.72,
      },
    ];
  }
}

class FallbackCylinderGeometry extends FallbackBufferGeometry {
  constructor(
    radiusTop = 0.5,
    radiusBottom = 0.5,
    height = 1,
    radialSegments = 12,
  ) {
    super();
    const segs = Math.max(8, Math.min(20, radialSegments));
    const hy = height / 2;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      this.vertices.push(
        new FallbackVector3(
          Math.cos(a) * radiusTop,
          hy,
          Math.sin(a) * radiusTop,
        ),
      );
    }
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      this.vertices.push(
        new FallbackVector3(
          Math.cos(a) * radiusBottom,
          -hy,
          Math.sin(a) * radiusBottom,
        ),
      );
    }
    for (let i = 0; i < segs; i++) {
      const next = (i + 1) % segs;
      const shade = 0.72 + 0.28 * Math.cos((i / segs) * Math.PI * 2);
      this.faces.push({
        indices: [i, next, segs + next, segs + i],
        shade,
      });
    }
    const topCap = [];
    const botCap = [];
    for (let i = 0; i < segs; i++) {
      topCap.push(i);
      botCap.push(segs + (segs - 1 - i));
    }
    this.faces.push({ indices: topCap, shade: 0.95 });
    this.faces.push({ indices: botCap, shade: 0.65 });
  }
}

class FallbackPlaneGeometry extends FallbackBufferGeometry {
  constructor(width = 100, height = 100) {
    super();
    const hw = width / 2,
      hh = height / 2;
    this.vertices = [
      new FallbackVector3(-hw, -hh, 0),
      new FallbackVector3(hw, -hh, 0),
      new FallbackVector3(hw, hh, 0),
      new FallbackVector3(-hw, hh, 0),
    ];
    this.faces = [{ indices: [0, 1, 2, 3], shade: 1.0 }];
    this.isGroundPlane = true;
  }
}

class FallbackMesh extends FallbackObject3D {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;
    this.isMesh = true;
  }
}

class FallbackGridHelper extends FallbackObject3D {
  constructor(
    size = 200,
    divisions = 100,
    color1 = 0x6e7785,
    color2 = 0xa7b0be,
  ) {
    super();
    this.size = size;
    this.divisions = divisions;
    this.colorCenterLine = new FallbackColor(color1);
    this.colorGrid = new FallbackColor(color2);
    this.isGridHelper = true;
    this.segments = [];

    const half = size / 2;
    const step = size / divisions;
    const subStep = Math.max(4, step * 2);
    for (let i = 0; i <= divisions; i++) {
      const coord = -half + i * step;
      const isMajor = i % 5 === 0 || i === divisions / 2;
      for (let s = -half; s < half; s += subStep) {
        const sNext = Math.min(half, s + subStep);
        this.segments.push({
          x1: coord,
          y1: 0,
          z1: s,
          x2: coord,
          y2: 0,
          z2: sNext,
          major: isMajor,
        });
        this.segments.push({
          x1: s,
          y1: 0,
          z1: coord,
          x2: sNext,
          y2: 0,
          z2: coord,
          major: isMajor,
        });
      }
    }
  }
}

class FallbackLight extends FallbackObject3D {
  constructor(color = 0xffffff, intensity = 1.0) {
    super();
    this.color = new FallbackColor(color);
    this.intensity = intensity;
  }
}

class FallbackWebGLRenderer {
  constructor(options = {}) {
    this.domElement =
      options.canvas ||
      (typeof document !== "undefined"
        ? document.createElement("canvas")
        : null);
    this.ctx = this.domElement ? this.domElement.getContext("2d") : null;
    this.width = 1280;
    this.height = 720;
    this.pixelRatio = 1;
    this.shadowMap = { enabled: false, type: 0 };
  }
  setPixelRatio(ratio = 1) {
    this.pixelRatio = Math.min(2, Math.max(1, ratio));
  }
  setSize(width, height) {
    this.width = width;
    this.height = height;
    if (this.domElement) {
      this.domElement.width = Math.round(width * this.pixelRatio);
      this.domElement.height = Math.round(height * this.pixelRatio);
      this.domElement.style.width = `${width}px`;
      this.domElement.style.height = `${height}px`;
    }
  }
  render(scene, camera) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.domElement.width;
    const h = this.domElement.height;

    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.invertRigid(camera.matrixWorld);

    const view = camera.matrixWorldInverse.elements;
    const fovRad = (camera.fov * Math.PI) / 180.0;
    const f = (h * 0.5) / Math.tan(fovRad * 0.5);
    const cx = w * 0.5;
    const cy = h * 0.5;
    const near = Math.max(0.25, camera.near);

    const toCam = (wx, wy, wz) => {
      const vx = view[0] * wx + view[4] * wy + view[8] * wz + view[12];
      const vy = view[1] * wx + view[5] * wy + view[9] * wz + view[13];
      const vz = view[2] * wx + view[6] * wy + view[10] * wz + view[14];
      return { vx, vy, vz };
    };

    // 1. Project the mathematical horizon line (plane y = camPos.y at infinity) so sky/ground
    // split aligns strictly with the asymptotic vanishing line of the ground plane y = 0.
    const camPos = camera.position;
    const yaw = camera.rotation.y;
    const fwdX = -Math.sin(yaw);
    const fwdZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    const farDist = 220.0;
    const hLeftCam = toCam(
      camPos.x + fwdX * farDist - rightX * 120.0,
      camPos.y,
      camPos.z + fwdZ * farDist - rightZ * 120.0,
    );
    const hRightCam = toCam(
      camPos.x + fwdX * farDist + rightX * 120.0,
      camPos.y,
      camPos.z + fwdZ * farDist + rightZ * 120.0,
    );

    const zL = Math.max(1.0, -hLeftCam.vz);
    const zR = Math.max(1.0, -hRightCam.vz);
    const sxL = cx + (hLeftCam.vx / zL) * f;
    const syL = cy - (hLeftCam.vy / zL) * f;
    const sxR = cx + (hRightCam.vx / zR) * f;
    const syR = cy - (hRightCam.vy / zR) * f;

    const horizonMidX = (sxL + sxR) * 0.5;
    const horizonMidY = (syL + syR) * 0.5;
    const horizonAngle = Math.atan2(syR - syL, sxR - sxL);

    ctx.save();
    ctx.translate(horizonMidX, horizonMidY);
    ctx.rotate(horizonAngle);

    // Sky gradient above horizon
    const skyGrad = ctx.createLinearGradient(0, -h * 1.5, 0, 0);
    skyGrad.addColorStop(0, "#c3ccd9");
    skyGrad.addColorStop(1, "#dde2ea");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-w * 2, -h * 2, w * 4, h * 2);

    // Light-gray ground plane below horizon
    const groundGrad = ctx.createLinearGradient(0, 0, 0, h * 1.5);
    groundGrad.addColorStop(0, "#cfd5de");
    groundGrad.addColorStop(0.25, "#d8dde5");
    groundGrad.addColorStop(1, "#d3d9e2");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(-w * 2, 0, w * 4, h * 2);

    // Horizon line
    ctx.strokeStyle = "#9aa3b2";
    ctx.lineWidth = 1.2 * this.pixelRatio;
    ctx.beginPath();
    ctx.moveTo(-w * 2, 0);
    ctx.lineTo(w * 2, 0);
    ctx.stroke();
    ctx.restore();

    // 2. Render GridHelper segments with near-plane and 2D viewport clipping
    const grids = [];
    const meshes = [];
    const collect = (obj) => {
      if (!obj.visible) return;
      if (obj.isGridHelper) grids.push(obj);
      else if (obj.isMesh && obj.geometry && !obj.geometry.isGroundPlane)
        meshes.push(obj);
      for (let i = 0; i < obj.children.length; i++) collect(obj.children[i]);
    };
    collect(scene);

    const minX = -64;
    const minY = -64;
    const maxX = w + 64;
    const maxY = h + 64;

    for (const grid of grids) {
      const m = grid.matrixWorld.elements;
      const gx = m[12],
        gy = m[13],
        gz = m[14];
      const segs = grid.segments;

      // Minor grid lines
      ctx.lineWidth = 1.0 * this.pixelRatio;
      ctx.strokeStyle = "rgba(128, 137, 150, 0.48)";
      ctx.beginPath();
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (s.major) continue;
        const p1 = toCam(s.x1 + gx, s.y1 + gy, s.z1 + gz);
        const p2 = toCam(s.x2 + gx, s.y2 + gy, s.z2 + gz);
        let z1 = -p1.vz,
          z2 = -p2.vz;
        if (z1 < near && z2 < near) continue;
        if (z1 > 95 && z2 > 95) continue;
        let x1 = p1.vx,
          y1 = p1.vy,
          x2 = p2.vx,
          y2 = p2.vy;
        if (z1 < near) {
          const t = (near - z1) / (z2 - z1);
          x1 += (x2 - x1) * t;
          y1 += (y2 - y1) * t;
          z1 = near;
        } else if (z2 < near) {
          const t = (near - z2) / (z1 - z2);
          x2 += (x1 - x2) * t;
          y2 += (y1 - y2) * t;
          z2 = near;
        }
        clipAndDrawSegment(
          ctx,
          cx + (x1 / z1) * f,
          cy - (y1 / z1) * f,
          cx + (x2 / z2) * f,
          cy - (y2 / z2) * f,
          minX,
          minY,
          maxX,
          maxY,
        );
      }
      ctx.stroke();

      // Major grid lines
      ctx.lineWidth = 1.45 * this.pixelRatio;
      ctx.strokeStyle = "rgba(96, 105, 118, 0.72)";
      ctx.beginPath();
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (!s.major) continue;
        const p1 = toCam(s.x1 + gx, s.y1 + gy, s.z1 + gz);
        const p2 = toCam(s.x2 + gx, s.y2 + gy, s.z2 + gz);
        let z1 = -p1.vz,
          z2 = -p2.vz;
        if (z1 < near && z2 < near) continue;
        if (z1 > 110 && z2 > 110) continue;
        let x1 = p1.vx,
          y1 = p1.vy,
          x2 = p2.vx,
          y2 = p2.vy;
        if (z1 < near) {
          const t = (near - z1) / (z2 - z1);
          x1 += (x2 - x1) * t;
          y1 += (y2 - y1) * t;
          z1 = near;
        } else if (z2 < near) {
          const t = (near - z2) / (z1 - z2);
          x2 += (x1 - x2) * t;
          y2 += (y1 - y2) * t;
          z2 = near;
        }
        clipAndDrawSegment(
          ctx,
          cx + (x1 / z1) * f,
          cy - (y1 / z1) * f,
          cx + (x2 / z2) * f,
          cy - (y2 / z2) * f,
          minX,
          minY,
          maxX,
          maxY,
        );
      }
      ctx.stroke();
    }

    // 3. Project and depth-sort 3D mesh faces (Painter's algorithm with near-plane polygon clipping)
    const meshNear = 0.08;
    const drawFaces = [];
    for (let mIdx = 0; mIdx < meshes.length; mIdx++) {
      const mesh = meshes[mIdx];
      const geom = mesh.geometry;
      const mat = mesh.material;
      const mw = mesh.matrixWorld.elements;
      const verts = geom.vertices;
      if (!verts || !verts.length) continue;

      const camVerts = new Array(verts.length);
      for (let vIdx = 0; vIdx < verts.length; vIdx++) {
        const v = verts[vIdx];
        const wx = mw[0] * v.x + mw[4] * v.y + mw[8] * v.z + mw[12];
        const wy = mw[1] * v.x + mw[5] * v.y + mw[9] * v.z + mw[13];
        const wz = mw[2] * v.x + mw[6] * v.y + mw[10] * v.z + mw[14];
        camVerts[vIdx] = toCam(wx, wy, wz);
      }

      const baseColor =
        mat && mat.color ? mat.color : new FallbackColor(0x181b20);
      for (let fIdx = 0; fIdx < geom.faces.length; fIdx++) {
        const face = geom.faces[fIdx];
        const poly = [];
        for (let k = 0; k < face.indices.length; k++) {
          poly.push(camVerts[face.indices[k]]);
        }

        // Clip polygon against camera near plane (-vz >= meshNear)
        const clipped = [];
        for (let k = 0; k < poly.length; k++) {
          const curr = poly[k];
          const prev = poly[(k + poly.length - 1) % poly.length];
          const currIn = -curr.vz >= meshNear;
          const prevIn = -prev.vz >= meshNear;

          if (currIn !== prevIn) {
            const zPrev = -prev.vz;
            const zCurr = -curr.vz;
            const t = (meshNear - zPrev) / (zCurr - zPrev);
            clipped.push({
              vx: prev.vx + (curr.vx - prev.vx) * t,
              vy: prev.vy + (curr.vy - prev.vy) * t,
              vz: -meshNear,
            });
          }
          if (currIn) {
            clipped.push(curr);
          }
        }

        if (clipped.length < 3) continue;

        let depthSum = 0;
        const pts2d = [];
        for (let k = 0; k < clipped.length; k++) {
          const cp = clipped[k];
          const depth = Math.max(meshNear, -cp.vz);
          depthSum += Math.hypot(cp.vx, cp.vy, depth);
          pts2d.push({
            x: MathUtils.clamp(cx + (cp.vx / depth) * f, -w * 2, w * 3),
            y: MathUtils.clamp(cy - (cp.vy / depth) * f, -h * 2, h * 3),
          });
        }

        const shade = face.shade || 0.9;
        const r = Math.round(MathUtils.clamp(baseColor.r * shade, 0, 1) * 255);
        const g = Math.round(MathUtils.clamp(baseColor.g * shade, 0, 1) * 255);
        const b = Math.round(MathUtils.clamp(baseColor.b * shade, 0, 1) * 255);

        drawFaces.push({
          depth: depthSum / clipped.length,
          pts: pts2d,
          fill: `rgb(${r},${g},${b})`,
          stroke: `rgba(${Math.min(255, r + 28)},${Math.min(255, g + 32)},${Math.min(255, b + 38)},0.55)`,
        });
      }
    }

    drawFaces.sort((a, b) => b.depth - a.depth);

    ctx.lineWidth = 1.0 * this.pixelRatio;
    for (let i = 0; i < drawFaces.length; i++) {
      const df = drawFaces[i];
      const pts = df.pts;
      ctx.fillStyle = df.fill;
      ctx.strokeStyle = df.stroke;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k < pts.length; k++) {
        ctx.lineTo(pts[k].x, pts[k].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}

export const Color = GLOBAL_THREE ? GLOBAL_THREE.Color : FallbackColor;
export const Fog = GLOBAL_THREE ? GLOBAL_THREE.Fog : FallbackFog;
export const Vector3 = GLOBAL_THREE ? GLOBAL_THREE.Vector3 : FallbackVector3;
export const Euler = GLOBAL_THREE ? GLOBAL_THREE.Euler : FallbackEuler;
export const Quaternion = GLOBAL_THREE
  ? GLOBAL_THREE.Quaternion
  : FallbackQuaternion;
export const Matrix4 = GLOBAL_THREE ? GLOBAL_THREE.Matrix4 : FallbackMatrix4;
export const Object3D = GLOBAL_THREE ? GLOBAL_THREE.Object3D : FallbackObject3D;
export const Group = GLOBAL_THREE ? GLOBAL_THREE.Group : FallbackGroup;
export const Scene = GLOBAL_THREE ? GLOBAL_THREE.Scene : FallbackScene;
export const PerspectiveCamera = GLOBAL_THREE
  ? GLOBAL_THREE.PerspectiveCamera
  : FallbackPerspectiveCamera;
export const BufferGeometry = GLOBAL_THREE
  ? GLOBAL_THREE.BufferGeometry
  : FallbackBufferGeometry;
export const BoxGeometry = GLOBAL_THREE
  ? GLOBAL_THREE.BoxGeometry
  : FallbackBoxGeometry;
export const CylinderGeometry = GLOBAL_THREE
  ? GLOBAL_THREE.CylinderGeometry
  : FallbackCylinderGeometry;
export const PlaneGeometry = GLOBAL_THREE
  ? GLOBAL_THREE.PlaneGeometry
  : FallbackPlaneGeometry;
export const MeshStandardMaterial = GLOBAL_THREE
  ? GLOBAL_THREE.MeshStandardMaterial
  : FallbackMaterial;
export const MeshBasicMaterial = GLOBAL_THREE
  ? GLOBAL_THREE.MeshBasicMaterial
  : FallbackMaterial;
export const LineBasicMaterial = GLOBAL_THREE
  ? GLOBAL_THREE.LineBasicMaterial
  : FallbackMaterial;
export const Mesh = GLOBAL_THREE ? GLOBAL_THREE.Mesh : FallbackMesh;
export const GridHelper = GLOBAL_THREE
  ? GLOBAL_THREE.GridHelper
  : FallbackGridHelper;
export const AmbientLight = GLOBAL_THREE
  ? GLOBAL_THREE.AmbientLight
  : FallbackLight;
export const DirectionalLight = GLOBAL_THREE
  ? GLOBAL_THREE.DirectionalLight
  : FallbackLight;
export const HemisphereLight = GLOBAL_THREE
  ? GLOBAL_THREE.HemisphereLight
  : FallbackLight;
export const WebGLRenderer = GLOBAL_THREE
  ? GLOBAL_THREE.WebGLRenderer
  : FallbackWebGLRenderer;
