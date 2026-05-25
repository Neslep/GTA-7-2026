// =========================================================================
// GTA 7 2026 — A tiny open-world joyride
// =========================================================================
const { Scene, PerspectiveCamera, WebGLRenderer, Color, Fog, PCFSoftShadowMap,
  AmbientLight, DirectionalLight, HemisphereLight, PointLight,
  Mesh, Group, Object3D, Vector3, Vector2, Euler, Quaternion, MathUtils, Raycaster,
  PlaneGeometry, BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry,
  MeshStandardMaterial, MeshBasicMaterial, MeshLambertMaterial,
  CanvasTexture, RepeatWrapping } = THREE;

// -------------------- RENDERER / SCENE --------------------
const scene = new Scene();
scene.background = new Color(0x16182a);
scene.fog = new Fog(0x2a2a4a, 80, 380);

const camera = new PerspectiveCamera(72, innerWidth/innerHeight, 0.1, 1000);
camera.position.set(0, 5, 12);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// -------------------- LIGHTING (golden hour) --------------------
scene.add(new AmbientLight(0xffd6a8, 0.45));
scene.add(new HemisphereLight(0xffb070, 0x202040, 0.45));

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

// -------------------- WORLD CONFIG --------------------
const BLOCK = 40;      // size of one city block including road
const ROAD = 9;        // road width
const GRID = 6;        // GRID x GRID blocks
const HALF = GRID * BLOCK / 2;
