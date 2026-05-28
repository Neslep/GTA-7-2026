// =========================================================================
// GTA 7 2026 — A tiny open-world joyride
// =========================================================================
const { Scene, PerspectiveCamera, WebGLRenderer, Color, Fog, PCFSoftShadowMap,
  AmbientLight, DirectionalLight, HemisphereLight, PointLight,
  Mesh, Group, Object3D, Vector3, Vector2, Euler, Quaternion, MathUtils, Raycaster,
  PlaneGeometry, BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry,
  MeshStandardMaterial, MeshBasicMaterial, MeshLambertMaterial,
  CanvasTexture, RepeatWrapping, DoubleSide } = THREE;

// -------------------- OPTIMIZED GRAPHICS PRESET --------------------
const GFX = {
  pixelRatioCap: 1,
  shadowMapSize: 768,
  environmentHz: 4,
  hudHz: 2,
  rainHz: 20,
  rainParticles: 180,
  stormParticles: 260,
  rainRadius: 42,
  rainHeight: 34,
  rainSize: 1.0,
  roadWetRoughness: 0.58,
  lightningExposure: 0.12,
};

function applyGfxSettings() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, GFX.pixelRatioCap));
  if (sun && sun.shadow) {
    const sz = GFX.shadowMapSize;
    if (sun.shadow.mapSize.x !== sz) {
      sun.shadow.mapSize.set(sz, sz);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
  }
}

// -------------------- RENDERER / SCENE --------------------
const scene = new Scene();
scene.background = new Color(0x79ccff);
scene.fog = new Fog(0xc2def1, 80, 380);

const camera = new PerspectiveCamera(72, innerWidth/innerHeight, 0.1, 500);
camera.position.set(0, 5, 12);

const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  applyGfxSettings();
  renderer.setSize(innerWidth, innerHeight);
});

// -------------------- LIGHTING (bright day) --------------------
const ambientLight = new AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const hemiLight = new HemisphereLight(0xc8ecff, 0x52644a, 0.6);
scene.add(hemiLight);

const sun = new DirectionalLight(0xffffff, 1.3);
sun.position.set(20, 150, 40);
sun.castShadow = true;
const SH = 160;
sun.shadow.camera.left = -SH; sun.shadow.camera.right = SH;
sun.shadow.camera.top = SH; sun.shadow.camera.bottom = -SH;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 320;
sun.shadow.mapSize.set(GFX.shadowMapSize, GFX.shadowMapSize);
sun.shadow.bias = -0.0005;
scene.add(sun);
applyGfxSettings();

// -------------------- WORLD CONFIG --------------------
const BLOCK = 40;      // size of one city block including road
const ROAD = 9;        // road width
const GRID = 8;        // GRID x GRID blocks
const HALF = GRID * BLOCK / 2;

// -------------------- DISTRICTS --------------------
const cityDistricts = [
  { id: 'harbor', label: 'BEACH / HARBOR', xMin: -HALF, xMax: 0, zMin: -HALF, zMax: 0, color: 0x2c5364 },
  { id: 'downtown', label: 'DOWNTOWN', xMin: 0, xMax: HALF, zMin: -HALF, zMax: 0, color: 0x4a3a58 },
  { id: 'industrial', label: 'INDUSTRIAL ZONE', xMin: -HALF, xMax: 0, zMin: 0, zMax: HALF, color: 0x4a4438 },
  { id: 'uptown', label: 'UPTOWN', xMin: 0, xMax: HALF, zMin: 0, zMax: HALF, color: 0x334d3c },
];

function getDistrictAt(x, z) {
  return cityDistricts.find(d => x >= d.xMin && x < d.xMax && z >= d.zMin && z < d.zMax) || cityDistricts[1];
}

function applyDistrictBuildingStyle(baseHue, x, z) {
  const district = getDistrictAt(x, z);
  if (district.id === 'downtown') return { hue: 0.72 + Math.random() * 0.08, sat: 0.18, light: 0.32 };
  if (district.id === 'industrial') return { hue: 0.08 + Math.random() * 0.06, sat: 0.16, light: 0.27 };
  if (district.id === 'harbor') return { hue: 0.54 + Math.random() * 0.06, sat: 0.22, light: 0.33 };
  return { hue: 0.28 + Math.random() * 0.08, sat: 0.18, light: 0.34 };
}
