// =========================================================================
// GTA 7 2026 — A tiny open-world joyride
// =========================================================================
const { Scene, PerspectiveCamera, WebGLRenderer, Color, Fog, PCFSoftShadowMap,
  AmbientLight, DirectionalLight, HemisphereLight, PointLight,
  Mesh, Group, Object3D, Vector3, Vector2, Euler, Quaternion, MathUtils, Raycaster,
  PlaneGeometry, BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry,
  MeshStandardMaterial, MeshBasicMaterial, MeshLambertMaterial,
  CanvasTexture, RepeatWrapping } = THREE;

// -------------------- GRAPHICS QUALITY --------------------
const GRAPHICS_STORAGE_KEY = 'gta7.graphicsQuality';
const GRAPHICS_PRESETS = {
  low: {
    label: 'LOW',
    pixelRatioCap: 1.15,
    shadowMapSize: 1024,
    environmentHz: 7,
    hudHz: 3,
    rainParticles: 420,
    stormParticles: 650,
    rainRadius: 46,
    rainHeight: 34,
    rainSize: 0.95,
    roadWetRoughness: 0.78,
    lightningExposure: 0.22,
  },
  high: {
    label: 'HIGH',
    pixelRatioCap: 2,
    shadowMapSize: 2048,
    environmentHz: 12,
    hudHz: 4,
    rainParticles: 900,
    stormParticles: 1400,
    rainRadius: 68,
    rainHeight: 46,
    rainSize: 1.25,
    roadWetRoughness: 0.48,
    lightningExposure: 0.38,
  },
};

function getStoredGraphicsQuality() {
  try {
    const saved = localStorage.getItem(GRAPHICS_STORAGE_KEY);
    return GRAPHICS_PRESETS[saved] ? saved : null;
  } catch (err) {
    return null;
  }
}

function getDefaultGraphicsQuality() {
  const touchLikely = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  return touchLikely || innerWidth < 820 ? 'low' : 'high';
}

let graphicsQuality = getStoredGraphicsQuality() || getDefaultGraphicsQuality();

function applyGraphicsPresetToRenderer() {
  const preset = GRAPHICS_PRESETS[graphicsQuality] || GRAPHICS_PRESETS.high;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, preset.pixelRatioCap));
  if (sun && sun.shadow) {
    const nextSize = preset.shadowMapSize;
    if (sun.shadow.mapSize.x !== nextSize || sun.shadow.mapSize.y !== nextSize) {
      sun.shadow.mapSize.set(nextSize, nextSize);
      if (sun.shadow.map) {
        sun.shadow.map.dispose();
        sun.shadow.map = null;
      }
    }
  }
  document.body.dataset.graphicsQuality = graphicsQuality;
}

function setGraphicsQuality(nextQuality, persist = true) {
  if (!GRAPHICS_PRESETS[nextQuality]) return graphicsQuality;
  graphicsQuality = nextQuality;
  if (persist) {
    try { localStorage.setItem(GRAPHICS_STORAGE_KEY, graphicsQuality); } catch (err) {}
  }
  applyGraphicsPresetToRenderer();
  dispatchEvent(new CustomEvent('graphicsqualitychange', { detail: { quality: graphicsQuality } }));
  return graphicsQuality;
}

// -------------------- RENDERER / SCENE --------------------
const scene = new Scene();
scene.background = new Color(0x16182a);
scene.fog = new Fog(0x2a2a4a, 80, 380);

const camera = new PerspectiveCamera(72, innerWidth/innerHeight, 0.1, 1000);
camera.position.set(0, 5, 12);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  applyGraphicsPresetToRenderer();
  renderer.setSize(innerWidth, innerHeight);
});

// -------------------- LIGHTING (golden hour) --------------------
const ambientLight = new AmbientLight(0xffd6a8, 0.45);
scene.add(ambientLight);
const hemiLight = new HemisphereLight(0xffb070, 0x202040, 0.45);
scene.add(hemiLight);

const sun = new DirectionalLight(0xffd28a, 1.25);
sun.position.set(80, 110, 35);
sun.castShadow = true;
const SH = 180;
sun.shadow.camera.left = -SH; sun.shadow.camera.right = SH;
sun.shadow.camera.top = SH; sun.shadow.camera.bottom = -SH;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 400;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
scene.add(sun);
applyGraphicsPresetToRenderer();

// -------------------- WORLD CONFIG --------------------
const BLOCK = 40;      // size of one city block including road
const ROAD = 9;        // road width
const GRID = 6;        // GRID x GRID blocks
const HALF = GRID * BLOCK / 2;
