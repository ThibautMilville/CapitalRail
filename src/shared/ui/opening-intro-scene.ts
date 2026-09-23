import * as THREE from "three";

export type IntroSceneOptions = {
  canvas: HTMLCanvasElement;
  durationMs: number;
  lowPower?: boolean;
  /** Fired once when the mark starts lifting and the app name should appear */
  onReveal?: () => void;
  onComplete: () => void;
};

export type IntroSceneHandle = {
  dispose: () => void;
};

const EMERALD = 0x36b8a6;
const EMERALD_LIGHT = 0x7af0d0;
const TEAL_DEEP = 0x1f4a52;

const HEX_OUTER = 1.12;
const HEX_INNER = 0.86;
const RAIL_Y = 0.42;
const RAIL_H = 0.2;
const RAIL_LEFT = -1.5;
const OPEN_RAIL_RIGHT = 1.5;
const BLOCKED_RAIL_RIGHT = 0.62;

/* Build beats run on [0, BUILD_END]; the tail lifts the mark and reveals the name */
const BUILD_END = 0.72;
const LIFT_START = 0.7;
const LIFT_END = 0.86;
const LABEL_AT = 0.76;
/** Upward shift of the mark, as a share of the visible height */
const LIFT_RATIO = 0.07;

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function segment(t: number, a: number, b: number) {
  return clamp01((t - a) / (b - a));
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutBackSoft(t: number) {
  const c1 = 1.1;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function hexPath(target: THREE.Path, radius: number) {
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) target.moveTo(x, y);
    else target.lineTo(x, y);
  }
  target.closePath();
}

function createHexRingGeometry(lowPower: boolean) {
  const shape = new THREE.Shape();
  hexPath(shape, HEX_OUTER);
  const hole = new THREE.Path();
  hexPath(hole, HEX_INNER);
  shape.holes.push(hole);

  const depth = 0.2;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.03,
    bevelSegments: lowPower ? 1 : 3,
    curveSegments: 1,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function createRailGeometry(length: number, lowPower: boolean) {
  const r = RAIL_H / 2;
  const shape = new THREE.Shape();
  shape.moveTo(r, -r);
  shape.lineTo(length - r, -r);
  shape.absarc(length - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(r, r);
  shape.absarc(r, 0, r, Math.PI / 2, (Math.PI * 3) / 2, false);

  const depth = 0.16;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: lowPower ? 1 : 2,
    curveSegments: lowPower ? 8 : 16,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function createEnvMap() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const u = x / size;
      const elev = y / size;
      const band = 0.25 + 0.75 * Math.max(0, Math.sin(u * Math.PI * 2));
      const sky = 0.05 + elev * 0.5;
      const strip = Math.exp(-Math.pow((elev - 0.72) * 14, 2)) * 0.9;
      const light = Math.min(1, sky * band + strip);
      data[i] = Math.floor(14 + 200 * light);
      data[i + 1] = Math.floor(34 + 215 * light);
      data[i + 2] = Math.floor(36 + 205 * light);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createMetal(color: number, roughness: number, emissive = 0x000000) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.9,
    roughness,
    emissive,
    emissiveIntensity: 0,
    envMapIntensity: 1,
    transparent: true,
    opacity: 0,
  });
}

function setOpacity(material: THREE.MeshStandardMaterial, opacity: number) {
  material.opacity = opacity;
  material.depthWrite = opacity > 0.95;
}

/**
 * Cinematic CapitalRail emblem build: the hex gate spins in, the two rails
 * slide through it (one open, one blocked), a light pulse runs along the
 * open rail only, a specular sweep crosses the finished mark, then the mark
 * lifts slightly so the app name can appear underneath.
 */
export function mountIntroScene(options: IntroSceneOptions): IntroSceneHandle {
  const { canvas, durationMs, onComplete, onReveal, lowPower = false } = options;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !lowPower,
    alpha: true,
    powerPreference: lowPower ? "low-power" : "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const envMap = createEnvMap();
  scene.environment = envMap;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  const baseCameraZ = { value: 6.2 };
  const liftWorld = { value: 0 };

  scene.add(new THREE.AmbientLight(0x0e2a2e, 0.5));
  const key = new THREE.DirectionalLight(0xd8fff4, 1.45);
  key.position.set(-2.4, 3.2, 4.4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x3f8a8c, 0.35);
  fill.position.set(3.2, -1.2, 2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x9af0d6, 0.45);
  rim.position.set(0.15, 1.6, -3.5);
  scene.add(rim);

  const root = new THREE.Group();
  scene.add(root);

  const spinPivot = new THREE.Group();
  root.add(spinPivot);

  const gateGeo = createHexRingGeometry(lowPower);
  const gateMat = createMetal(EMERALD, 0.3, 0x0d3f3a);
  const gate = new THREE.Mesh(gateGeo, gateMat);
  spinPivot.add(gate);

  const openRailGeo = createRailGeometry(OPEN_RAIL_RIGHT - RAIL_LEFT, lowPower);
  const openRailMat = createMetal(EMERALD_LIGHT, 0.18, 0x2fa98f);
  const openRail = new THREE.Mesh(openRailGeo, openRailMat);
  openRail.position.set(RAIL_LEFT, RAIL_Y, 0.04);
  root.add(openRail);

  const blockedRailGeo = createRailGeometry(BLOCKED_RAIL_RIGHT - RAIL_LEFT, lowPower);
  const blockedRailMat = createMetal(TEAL_DEEP, 0.4);
  const blockedRail = new THREE.Mesh(blockedRailGeo, blockedRailMat);
  blockedRail.position.set(RAIL_LEFT, -RAIL_Y, 0.04);
  root.add(blockedRail);

  const sweepUniforms = {
    uProgress: { value: -1 },
    uOpacity: { value: 0 },
    uRadius: { value: HEX_OUTER * 1.45 },
  };
  const sweepMat = new THREE.ShaderMaterial({
    uniforms: sweepUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vLocal;
      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uProgress;
      uniform float uOpacity;
      uniform float uRadius;
      varying vec2 vLocal;
      void main() {
        float disc = 1.0 - smoothstep(uRadius * 0.85, uRadius, length(vLocal));
        if (disc <= 0.001 || uOpacity <= 0.001) discard;
        float band = vLocal.x * 0.82 + vLocal.y * 0.38;
        float d = abs(band - uProgress);
        float streak = (exp(-d * d * 22.0) * 1.1 + exp(-d * d * 5.0) * 0.4) * disc * uOpacity;
        vec3 tint = vec3(0.82, 1.0, 0.95);
        gl_FragColor = vec4(tint * streak, min(1.0, streak));
      }
    `,
  });
  const sweepGeo = new THREE.PlaneGeometry(HEX_OUTER * 3.2, HEX_OUTER * 3.2);
  const sweep = new THREE.Mesh(sweepGeo, sweepMat);
  sweep.position.z = 0.2;
  sweep.renderOrder = 10;
  sweep.visible = false;
  root.add(sweep);

  const flowLength = OPEN_RAIL_RIGHT - RAIL_LEFT;
  const flowUniforms = {
    uProgress: { value: -0.3 },
    uOpacity: { value: 0 },
  };
  const flowMat = new THREE.ShaderMaterial({
    uniforms: flowUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uProgress;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float d = vUv.x - uProgress;
        float head = exp(-d * d * 900.0);
        float tail = d < 0.0 ? exp(d * 9.0) * 0.45 : 0.0;
        float across = 1.0 - smoothstep(0.0, 0.5, abs(vUv.y - 0.5));
        float a = (head + tail) * across * uOpacity;
        gl_FragColor = vec4(vec3(0.75, 1.0, 0.92) * a, min(1.0, a));
      }
    `,
  });
  const flowGeo = new THREE.PlaneGeometry(flowLength, RAIL_H * 0.9);
  const flow = new THREE.Mesh(flowGeo, flowMat);
  flow.position.set(RAIL_LEFT + flowLength / 2, RAIL_Y, 0.15);
  flow.renderOrder = 9;
  flow.visible = false;
  root.add(flow);

  const resize = () => {
    const parent = canvas.parentElement;
    const w = parent?.clientWidth || window.innerWidth;
    const h = parent?.clientHeight || window.innerHeight;
    const aspect = w / Math.max(h, 1);
    camera.aspect = aspect;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fitHeight = (HEX_OUTER * 2) / 0.42;
    const fitWidth = (OPEN_RAIL_RIGHT - RAIL_LEFT + 0.3) / 0.62 / aspect;
    baseCameraZ.value = Math.max(fitHeight, fitWidth) / 2 / halfTan;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);

    const visibleHeight = 2 * baseCameraZ.value * halfTan;
    liftWorld.value = visibleHeight * LIFT_RATIO;
    const bottomWorld = -HEX_OUTER - 0.04 + liftWorld.value;
    const bottomPx = h / 2 - (bottomWorld / (visibleHeight / 2)) * (h / 2);
    parent?.style.setProperty("--cr-intro-label-top", `${Math.round(bottomPx)}px`);
  };
  resize();
  window.addEventListener("resize", resize);

  let finished = false;
  let revealed = false;
  let raf = 0;
  const started = performance.now();

  const finish = () => {
    if (finished) return;
    finished = true;
    onComplete();
  };

  const tick = (now: number) => {
    const t = clamp01((now - started) / durationMs);
    const b = clamp01(t / BUILD_END);

    const gateT = segment(b, 0, 0.38);
    setOpacity(gateMat, easeOutCubic(Math.min(1, gateT / 0.35)));
    spinPivot.scale.setScalar(mix(0.55, 1, easeOutBackSoft(gateT)));
    spinPivot.rotation.y = mix(Math.PI * 3, 0, easeInOutCubic(gateT));
    spinPivot.rotation.x =
      gateT > 0 && gateT < 1 ? Math.sin(gateT * Math.PI) * 0.3 : 0;

    const openT = easeInOutCubic(segment(b, 0.3, 0.56));
    setOpacity(openRailMat, easeOutCubic(segment(b, 0.3, 0.42)));
    openRail.position.x = mix(RAIL_LEFT - 3.2, RAIL_LEFT, openT);

    const blockedT = easeInOutCubic(segment(b, 0.36, 0.6));
    setOpacity(blockedRailMat, easeOutCubic(segment(b, 0.36, 0.48)));
    blockedRail.position.x = mix(RAIL_LEFT - 3.2, RAIL_LEFT, blockedT);

    const settle = easeInOutCubic(segment(b, 0.56, 0.68));
    root.rotation.x = mix(-0.18, 0, settle);
    root.rotation.y = mix(0.22, 0, settle);

    openRailMat.emissiveIntensity = 0.12 + easeOutCubic(segment(b, 0.62, 0.8)) * 0.38;
    gateMat.emissiveIntensity = 0.15 + easeOutCubic(segment(b, 0.62, 0.8)) * 0.25;

    const sweepT = segment(b, 0.68, 0.86);
    sweepUniforms.uProgress.value = mix(-1.6, 1.6, easeInOutCubic(sweepT));
    sweepUniforms.uOpacity.value = sweepT > 0 && sweepT < 1 ? Math.sin(sweepT * Math.PI) * 0.9 : 0;
    sweep.visible = sweepUniforms.uOpacity.value > 0.01;

    const flowT = segment(b, 0.58, 0.9);
    flowUniforms.uProgress.value = mix(-0.1, 1.15, easeInOutCubic(flowT));
    flowUniforms.uOpacity.value = flowT > 0 && flowT < 1 ? Math.sin(flowT * Math.PI) : 0;
    flow.visible = flowUniforms.uOpacity.value > 0.01;

    const liftT = easeInOutCubic(segment(t, LIFT_START, LIFT_END));
    root.position.y = liftWorld.value * liftT;
    camera.position.set(0, 0, baseCameraZ.value);
    camera.lookAt(0, 0, 0);

    if (!revealed && t >= LABEL_AT) {
      revealed = true;
      onReveal?.();
    }

    renderer.render(scene, camera);

    if (t >= 1) {
      finish();
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  const hardTimer = window.setTimeout(finish, durationMs + 1800);

  return {
    dispose: () => {
      finished = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(hardTimer);
      window.removeEventListener("resize", resize);
      gateGeo.dispose();
      openRailGeo.dispose();
      blockedRailGeo.dispose();
      sweepGeo.dispose();
      flowGeo.dispose();
      flowMat.dispose();
      gateMat.dispose();
      openRailMat.dispose();
      blockedRailMat.dispose();
      sweepMat.dispose();
      envMap.dispose();
      renderer.dispose();
    },
  };
}
