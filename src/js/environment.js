// -------------------- DYNAMIC TIME / WEATHER / GRAPHICS --------------------
const GAME_DAY_SECONDS = 12 * 60;
const WEATHER_ORDER = ['clear', 'cloudy', 'rain', 'storm'];
const WEATHER_LABELS = {
  clear: 'CLEAR',
  cloudy: 'CLOUDY',
  rain: 'RAIN',
  storm: 'STORM',
};
const WEATHER_TARGETS = {
  clear: { cloud: 0, rain: 0, storm: 0 },
  cloudy: { cloud: 0.9, rain: 0, storm: 0 },
  rain: { cloud: 0.85, rain: 1, storm: 0 },
  storm: { cloud: 1, rain: 1, storm: 1 },
};

const DAY_STOPS = [
  { h: 0, sky: 0x071026, fog: 0x0d1428, sun: 0x6f8fd8, ambient: 0x182448, hemiSky: 0x102858, hemiGround: 0x08080f, exposure: 0.82, sunI: 0.03, ambientI: 0.24, hemiI: 0.24, fogNear: 60, fogFar: 245 },
  { h: 5.5, sky: 0x26385f, fog: 0x5c607d, sun: 0xff9f58, ambient: 0xffc08a, hemiSky: 0xffb070, hemiGround: 0x243050, exposure: 1.02, sunI: 0.58, ambientI: 0.34, hemiI: 0.4, fogNear: 66, fogFar: 310 },
  { h: 8, sky: 0x75b8ff, fog: 0xa9cbe6, sun: 0xffe0aa, ambient: 0xffe7c6, hemiSky: 0xb8dcff, hemiGround: 0x405040, exposure: 1.14, sunI: 1.08, ambientI: 0.42, hemiI: 0.48, fogNear: 82, fogFar: 390 },
  { h: 12, sky: 0x79ccff, fog: 0xc2def1, sun: 0xffffff, ambient: 0xe8f5ff, hemiSky: 0xc8ecff, hemiGround: 0x52644a, exposure: 1.17, sunI: 1.32, ambientI: 0.46, hemiI: 0.52, fogNear: 94, fogFar: 430 },
  { h: 16.5, sky: 0x78baff, fog: 0xb8cde5, sun: 0xffdfa2, ambient: 0xffdfc0, hemiSky: 0xa9d6ff, hemiGround: 0x4a5140, exposure: 1.12, sunI: 1.02, ambientI: 0.42, hemiI: 0.48, fogNear: 82, fogFar: 390 },
  { h: 18.5, sky: 0x3f3b68, fog: 0x8b6278, sun: 0xff8e4a, ambient: 0xffb27a, hemiSky: 0xff8d68, hemiGround: 0x25263e, exposure: 1.02, sunI: 0.56, ambientI: 0.35, hemiI: 0.42, fogNear: 64, fogFar: 305 },
  { h: 21, sky: 0x111a35, fog: 0x14203b, sun: 0x88a8ff, ambient: 0x22305a, hemiSky: 0x1d3568, hemiGround: 0x080810, exposure: 0.84, sunI: 0.06, ambientI: 0.26, hemiI: 0.28, fogNear: 58, fogFar: 250 },
  { h: 24, sky: 0x071026, fog: 0x0d1428, sun: 0x6f8fd8, ambient: 0x182448, hemiSky: 0x102858, hemiGround: 0x08080f, exposure: 0.82, sunI: 0.03, ambientI: 0.24, hemiI: 0.24, fogNear: 60, fogFar: 245 },
];

let environmentHour = 16.5;
let environmentPaused = false;
let environmentWeather = 'clear';
let environmentWeatherIndex = 0;
let nextWeatherTimer = 70 + Math.random() * 70;
let visualUpdateTimer = 99;
let hudUpdateTimer = 99;
let rainUpdateTimer = 0;
let environmentExposure = renderer.toneMappingExposure;
let lightningFlash = 0;
let lightningFlashTarget = 0;
let lightningCooldown = 8 + Math.random() * 12;
let activeRainCount = 0;
let lastRainDrawCount = -1;

const envState = { cloud: 0, rain: 0, storm: 0 };
const envProfile = {
  sky: new Color(),
  fog: new Color(),
  sun: new Color(),
  ambient: new Color(),
  hemiSky: new Color(),
  hemiGround: new Color(),
  exposure: 1,
  sunI: 1,
  ambientI: 0.4,
  hemiI: 0.4,
  fogNear: 80,
  fogFar: 380,
};
const envColorA = new Color();
const envColorB = new Color();
const envColorC = new Color();
const roadBaseColor = roadMat.color.clone();
const roadWetColor = new Color(0x101822);
const sidewalkBaseColor = sidewalkMat.color.clone();
const sidewalkWetColor = new Color(0x3f4652);
const groundBaseColor = ground.material.color.clone();
const groundWetColor = new Color(0x283a31);

const envTimeEl = document.getElementById('envTime');
const envPhaseEl = document.getElementById('envPhase');
const envWeatherEl = document.getElementById('envWeather');

function sampleDayProfile(hour) {
  let a = DAY_STOPS[0];
  let b = DAY_STOPS[DAY_STOPS.length - 1];
  for (let i = 0; i < DAY_STOPS.length - 1; i++) {
    if (hour >= DAY_STOPS[i].h && hour < DAY_STOPS[i + 1].h) {
      a = DAY_STOPS[i];
      b = DAY_STOPS[i + 1];
      break;
    }
  }
  const t = MathUtils.smoothstep((hour - a.h) / Math.max(0.001, b.h - a.h), 0, 1);
  envProfile.sky.lerpColors(envColorA.setHex(a.sky), envColorB.setHex(b.sky), t);
  envProfile.fog.lerpColors(envColorA.setHex(a.fog), envColorB.setHex(b.fog), t);
  envProfile.sun.lerpColors(envColorA.setHex(a.sun), envColorB.setHex(b.sun), t);
  envProfile.ambient.lerpColors(envColorA.setHex(a.ambient), envColorB.setHex(b.ambient), t);
  envProfile.hemiSky.lerpColors(envColorA.setHex(a.hemiSky), envColorB.setHex(b.hemiSky), t);
  envProfile.hemiGround.lerpColors(envColorA.setHex(a.hemiGround), envColorB.setHex(b.hemiGround), t);
  envProfile.exposure = MathUtils.lerp(a.exposure, b.exposure, t);
  envProfile.sunI = MathUtils.lerp(a.sunI, b.sunI, t);
  envProfile.ambientI = MathUtils.lerp(a.ambientI, b.ambientI, t);
  envProfile.hemiI = MathUtils.lerp(a.hemiI, b.hemiI, t);
  envProfile.fogNear = MathUtils.lerp(a.fogNear, b.fogNear, t);
  envProfile.fogFar = MathUtils.lerp(a.fogFar, b.fogFar, t);
}

function getEnvironmentPreset() {
  return GFX;
}

function getWeatherTarget() {
  return WEATHER_TARGETS[environmentWeather] || WEATHER_TARGETS.clear;
}

function chooseNextWeather() {
  const roll = Math.random();
  if (environmentWeather === 'clear') return roll < 0.55 ? 'cloudy' : (roll < 0.86 ? 'rain' : 'storm');
  if (environmentWeather === 'cloudy') return roll < 0.42 ? 'clear' : (roll < 0.82 ? 'rain' : 'storm');
  if (environmentWeather === 'rain') return roll < 0.55 ? 'cloudy' : (roll < 0.86 ? 'clear' : 'storm');
  return roll < 0.64 ? 'rain' : 'cloudy';
}

function setEnvironmentWeather(nextWeather, resetTimer = true) {
  if (!WEATHER_TARGETS[nextWeather]) return;
  environmentWeather = nextWeather;
  environmentWeatherIndex = WEATHER_ORDER.indexOf(nextWeather);
  if (resetTimer) nextWeatherTimer = 90 + Math.random() * 120;
  updateEnvironmentHud(true);
}

function cycleEnvironmentWeather() {
  const nextIndex = (environmentWeatherIndex + 1) % WEATHER_ORDER.length;
  setEnvironmentWeather(WEATHER_ORDER[nextIndex]);
}

function getDayPhaseLabel(hour) {
  if (hour < 5 || hour >= 21) return 'NIGHT';
  if (hour < 8) return 'DAWN';
  if (hour < 11) return 'MORNING';
  if (hour < 16.5) return 'DAY';
  if (hour < 19) return 'SUNSET';
  return 'EVENING';
}

function formatGameTime(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function makeRainTexture() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 32;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, 'rgba(210,235,255,0)');
  grad.addColorStop(0.28, 'rgba(210,235,255,0.72)');
  grad.addColorStop(1, 'rgba(210,235,255,0)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, 2);
  ctx.lineTo(4, 30);
  ctx.stroke();
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

const rainMaxParticles = GFX.stormParticles;
const rainPositions = new Float32Array(rainMaxParticles * 3);
const rainSpeeds = new Float32Array(rainMaxParticles);
const rainGeometry = new THREE.BufferGeometry();
const rainPositionAttribute = new THREE.BufferAttribute(rainPositions, 3);
rainGeometry.setAttribute('position', rainPositionAttribute);
rainGeometry.setDrawRange(0, 0);

const rainMaterial = new THREE.PointsMaterial({
  color: 0xb8d8ff,
  map: makeRainTexture(),
  size: GFX.rainSize,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  sizeAttenuation: true,
});
const rainPoints = new THREE.Points(rainGeometry, rainMaterial);
rainPoints.frustumCulled = false;
rainPoints.visible = false;
scene.add(rainPoints);

function resetRainDrop(i, randomY = false) {
  const radius = GFX.rainRadius;
  const height = GFX.rainHeight;
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.sqrt(Math.random()) * radius;
  const p = i * 3;
  rainPositions[p] = Math.cos(angle) * dist;
  rainPositions[p + 1] = randomY ? Math.random() * height + 2 : height + Math.random() * 12;
  rainPositions[p + 2] = Math.sin(angle) * dist;
  rainSpeeds[i] = 18 + Math.random() * 16;
}

for (let i = 0; i < rainMaxParticles; i++) resetRainDrop(i, true);

function updateWeatherBlend(dt) {
  const target = getWeatherTarget();
  const blendSpeed = Math.min(1, dt * 0.45);
  envState.cloud += (target.cloud - envState.cloud) * blendSpeed;
  envState.rain += (target.rain - envState.rain) * blendSpeed;
  envState.storm += (target.storm - envState.storm) * blendSpeed;
}

function updateLightning(dt) {
  lightningFlashTarget = Math.max(0, lightningFlashTarget - dt * 3.4);
  lightningFlash += (lightningFlashTarget - lightningFlash) * Math.min(1, dt * 10);
  if (envState.storm < 0.55) {
    lightningCooldown = Math.max(5, lightningCooldown - dt * 0.18);
    return;
  }
  lightningCooldown -= dt;
  if (lightningCooldown <= 0) {
    lightningFlashTarget = 0.42 + Math.random() * 0.18;
    lightningCooldown = 10 + Math.random() * 16;
  }
}

function applyEnvironmentLook() {
  const preset = getEnvironmentPreset();
  sampleDayProfile(environmentHour);

  envColorC.copy(envProfile.sky);
  envColorC.lerp(envColorA.setHex(0x7f8790), envState.cloud * 0.26);
  envColorC.lerp(envColorA.setHex(0x253342), envState.rain * 0.3);
  envColorC.lerp(envColorA.setHex(0x111827), envState.storm * 0.42);
  envColorC.lerp(envColorA.setHex(0xcfe6ff), lightningFlash * 0.18);
  scene.background.copy(envColorC);

  envColorC.copy(envProfile.fog);
  envColorC.lerp(envColorA.setHex(0x707b88), envState.cloud * 0.22);
  envColorC.lerp(envColorA.setHex(0x33404c), envState.rain * 0.3);
  envColorC.lerp(envColorA.setHex(0x151d2a), envState.storm * 0.42);
  scene.fog.color.copy(envColorC);
  scene.fog.near = Math.max(34, envProfile.fogNear - envState.cloud * 8 - envState.rain * 16 - envState.storm * 18);
  scene.fog.far = Math.max(155, envProfile.fogFar - envState.cloud * 45 - envState.rain * 95 - envState.storm * 90);

  ambientLight.color.copy(envProfile.ambient).lerp(envColorA.setHex(0x506070), envState.cloud * 0.18 + envState.rain * 0.1);
  ambientLight.intensity = Math.max(0.16, envProfile.ambientI - envState.cloud * 0.06 - envState.rain * 0.08 - envState.storm * 0.08);
  hemiLight.color.copy(envProfile.hemiSky).lerp(envColorA.setHex(0x546a82), envState.cloud * 0.18 + envState.rain * 0.1);
  hemiLight.groundColor.copy(envProfile.hemiGround);
  hemiLight.intensity = Math.max(0.18, envProfile.hemiI - envState.cloud * 0.08 - envState.rain * 0.1 - envState.storm * 0.08);

  sun.color.copy(envProfile.sun);
  sun.intensity = Math.max(0.02, envProfile.sunI * (1 - envState.cloud * 0.35 - envState.rain * 0.52 - envState.storm * 0.32));
  const sunAngle = ((environmentHour - 6) / 24) * Math.PI * 2;
  sun.position.set(Math.cos(sunAngle) * 95, Math.sin(sunAngle) * 115, Math.sin(sunAngle * 0.72) * 70);

  environmentExposure = envProfile.exposure - envState.cloud * 0.04 - envState.rain * 0.07 - envState.storm * 0.12;
  renderer.toneMappingExposure = environmentExposure + lightningFlash * preset.lightningExposure;

  const wet = MathUtils.clamp(envState.rain * 0.72 + envState.storm * 0.28, 0, 1);
  roadMat.color.copy(roadBaseColor).lerp(roadWetColor, wet);
  roadMat.roughness = MathUtils.lerp(0.95, preset.roadWetRoughness, wet);
  sidewalkMat.color.copy(sidewalkBaseColor).lerp(sidewalkWetColor, wet * 0.58);
  ground.material.color.copy(groundBaseColor).lerp(groundWetColor, wet * 0.38);
}

function updateRain(dt) {
  const preset = getEnvironmentPreset();
  const stormBudget = GFX.stormParticles;
  const particleBudget = MathUtils.lerp(preset.rainParticles, stormBudget, envState.storm);
  const targetCount = activeLocation ? 0 : Math.floor(particleBudget * envState.rain);
  activeRainCount += (targetCount - activeRainCount) * Math.min(1, dt * 4);
  const drawCount = Math.min(rainMaxParticles, Math.max(0, Math.round(activeRainCount)));
  if (drawCount !== lastRainDrawCount) {
    rainGeometry.setDrawRange(0, drawCount);
    lastRainDrawCount = drawCount;
  }

  if (drawCount <= 0) {
    rainPoints.visible = false;
    rainMaterial.opacity = 0;
    return;
  }

  const ref = getPlayerRefPosition();
  const radius = preset.rainRadius;
  const height = preset.rainHeight;
  const rainPower = MathUtils.clamp(envState.rain + envState.storm * 0.35, 0, 1);
  const windX = (0.8 + envState.storm * 2.2) * dt;
  const windZ = (-0.25 - envState.storm * 0.8) * dt;

  rainPoints.visible = true;
  rainPoints.position.set(ref.x, 0, ref.z);
  rainMaterial.opacity = MathUtils.lerp(0.18, 0.48, rainPower);
  rainMaterial.size = preset.rainSize * (1 + envState.storm * 0.22);
  rainMaterial.color.copy(envColorA.setHex(envState.storm > 0.5 ? 0xd8e8ff : 0xb8d8ff));

  for (let i = 0; i < drawCount; i++) {
    const p = i * 3;
    rainPositions[p] += windX;
    rainPositions[p + 1] -= rainSpeeds[i] * dt * (0.85 + rainPower * 0.45);
    rainPositions[p + 2] += windZ;
    if (
      rainPositions[p + 1] < 0.4 ||
      Math.abs(rainPositions[p]) > radius ||
      Math.abs(rainPositions[p + 2]) > radius
    ) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * radius;
      rainPositions[p] = Math.cos(angle) * dist;
      rainPositions[p + 1] = height + Math.random() * 10;
      rainPositions[p + 2] = Math.sin(angle) * dist;
      rainSpeeds[i] = 18 + Math.random() * 16;
    }
  }
  rainPositionAttribute.updateRange.offset = 0;
  rainPositionAttribute.updateRange.count = drawCount * 3;
  rainPositionAttribute.needsUpdate = true;
}

function tickRain(dt) {
  const preset = getEnvironmentPreset();
  rainUpdateTimer += dt;
  if (rainUpdateTimer < 1 / preset.rainHz) return;
  const rainDt = Math.min(0.08, rainUpdateTimer);
  rainUpdateTimer = 0;
  updateRain(rainDt);
}

function updateEnvironmentHud(force = false) {
  const preset = getEnvironmentPreset();
  if (!force && hudUpdateTimer < 1 / preset.hudHz) return;
  hudUpdateTimer = 0;
  if (envTimeEl) envTimeEl.textContent = formatGameTime(environmentHour);
  if (envPhaseEl) envPhaseEl.textContent = getDayPhaseLabel(environmentHour);
  if (envWeatherEl) envWeatherEl.textContent = WEATHER_LABELS[environmentWeather] || 'CLEAR';
}

function updateEnvironment(dt) {
  const preset = getEnvironmentPreset();
  if (!environmentPaused) environmentHour = (environmentHour + dt * 24 / GAME_DAY_SECONDS) % 24;

  nextWeatherTimer -= dt;
  if (nextWeatherTimer <= 0) setEnvironmentWeather(chooseNextWeather());

  updateWeatherBlend(dt);
  updateLightning(dt);
  tickRain(dt);

  visualUpdateTimer += dt;
  hudUpdateTimer += dt;
  if (visualUpdateTimer >= 1 / preset.environmentHz) {
    visualUpdateTimer = 0;
    applyEnvironmentLook();
  } else if (lightningFlash > 0) {
    renderer.toneMappingExposure = environmentExposure + lightningFlash * preset.lightningExposure;
  }
  updateEnvironmentHud();
}



addEventListener('keydown', e => {
  if (e.repeat || !hud.classList.contains('active')) return;
  if (e.code === 'KeyT') {
    cycleEnvironmentWeather();
    e.preventDefault();
  } else if (e.code === 'KeyY') {
    environmentHour = (environmentHour + 3) % 24;
    visualUpdateTimer = 99;
    updateEnvironmentHud(true);
    e.preventDefault();
  } else if (e.code === 'KeyU') {
    environmentPaused = !environmentPaused;
    updateEnvironmentHud(true);
    e.preventDefault();
  }
});

applyEnvironmentLook();
updateEnvironmentHud(true);
