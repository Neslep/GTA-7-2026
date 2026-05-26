// -------------------- INPUT --------------------
const keys = {};
const keySources = { keyboard: {}, touch: {} };
const mouse = { x: 0, y: 0, dx: 0, dy: 0, locked: false };
const hasTouchControls = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

function setInputKey(source, code, isDown) {
  if (!code || !keySources[source]) return;
  keySources[source][code] = isDown;
  keys[code] = Boolean(keySources.keyboard[code] || keySources.touch[code]);
}

function clearKeySource(source) {
  for (const code of Object.keys(keySources[source])) {
    setInputKey(source, code, false);
  }
}

addEventListener('keydown', e => { setInputKey('keyboard', e.code, true); });
addEventListener('keyup', e => { setInputKey('keyboard', e.code, false); });
addEventListener('mousemove', e => {
  if (mouse.locked) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
});
addEventListener('mousedown', e => {
  if (e.button === 0 && hud.classList.contains('active') && !inVehicle && !blackjackActive) setInputKey('keyboard', 'KeyE', true);
});
addEventListener('mouseup', e => {
  if (e.button === 0) setInputKey('keyboard', 'KeyE', false);
});

const playBtn = document.getElementById('playBtn');
const intro = document.getElementById('intro');
const hud = document.getElementById('hud');
const mobileRunBtn = document.getElementById('mobileRunBtn');
const mobileJumpBtn = document.getElementById('mobileJumpBtn');
const mobileCarBtn = document.getElementById('mobileCarBtn');
const mobileHitBtn = document.getElementById('mobileHitBtn');
const qualityButtons = [];

if (hasTouchControls) document.body.classList.add('touch-ui');

function requestGamePointerLock() {
  if (hasTouchControls || !renderer.domElement.requestPointerLock) return;
  renderer.domElement.requestPointerLock();
}

playBtn.addEventListener('click', () => {
  intro.style.opacity = '0';
  setTimeout(() => intro.style.display = 'none', 800);
  hud.classList.add('active');
  requestGamePointerLock();
});
document.addEventListener('pointerlockchange', () => {
  mouse.locked = document.pointerLockElement === renderer.domElement;
});
renderer.domElement.addEventListener('click', () => {
  if (!mouse.locked && hud.classList.contains('active')) requestGamePointerLock();
});

// -------------------- MOBILE TOUCH CONTROLS --------------------
renderer.domElement.style.touchAction = 'none';

const touchLook = { pointerId: null, x: 0, y: 0 };
renderer.domElement.addEventListener('pointerdown', e => {
  if (!hud.classList.contains('active') || blackjackActive || e.pointerType === 'mouse') return;
  touchLook.pointerId = e.pointerId;
  touchLook.x = e.clientX;
  touchLook.y = e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);
  e.preventDefault();
});
renderer.domElement.addEventListener('pointermove', e => {
  if (e.pointerId !== touchLook.pointerId) return;
  mouse.dx += e.clientX - touchLook.x;
  mouse.dy += e.clientY - touchLook.y;
  touchLook.x = e.clientX;
  touchLook.y = e.clientY;
  e.preventDefault();
});
function endTouchLook(e) {
  if (e.pointerId === touchLook.pointerId) touchLook.pointerId = null;
}
renderer.domElement.addEventListener('pointerup', endTouchLook);
renderer.domElement.addEventListener('pointercancel', endTouchLook);

const movePad = document.getElementById('movePad');
const stick = { pointerId: null, centerX: 0, centerY: 0, max: 52 };

function setStickPosition(x, y) {
  movePad.style.setProperty('--stick-x', `${x}px`);
  movePad.style.setProperty('--stick-y', `${y}px`);
}

function syncStickKeys(x, y) {
  const threshold = stick.max * 0.28;
  setInputKey('touch', 'KeyW', y < -threshold);
  setInputKey('touch', 'KeyS', y > threshold);
  setInputKey('touch', 'KeyA', x < -threshold);
  setInputKey('touch', 'KeyD', x > threshold);
}

function updateStick(e) {
  const dx = e.clientX - stick.centerX;
  const dy = e.clientY - stick.centerY;
  const dist = Math.hypot(dx, dy);
  const limited = Math.min(dist, stick.max);
  const angle = Math.atan2(dy, dx);
  const x = dist === 0 ? 0 : Math.cos(angle) * limited;
  const y = dist === 0 ? 0 : Math.sin(angle) * limited;
  setStickPosition(x, y);
  syncStickKeys(x, y);
}

function resetStick() {
  stick.pointerId = null;
  setStickPosition(0, 0);
  syncStickKeys(0, 0);
  movePad.classList.remove('active');
}

movePad.addEventListener('pointerdown', e => {
  if (!hud.classList.contains('active') || blackjackActive) return;
  const rect = movePad.getBoundingClientRect();
  stick.pointerId = e.pointerId;
  stick.centerX = rect.left + rect.width / 2;
  stick.centerY = rect.top + rect.height / 2;
  stick.max = Math.max(38, Math.min(58, rect.width * 0.34));
  movePad.setPointerCapture(e.pointerId);
  movePad.classList.add('active');
  updateStick(e);
  e.preventDefault();
});
movePad.addEventListener('pointermove', e => {
  if (e.pointerId !== stick.pointerId) return;
  updateStick(e);
  e.preventDefault();
});
movePad.addEventListener('pointerup', e => {
  if (e.pointerId === stick.pointerId) resetStick();
});
movePad.addEventListener('pointercancel', e => {
  if (e.pointerId === stick.pointerId) resetStick();
});

document.querySelectorAll('[data-touch-key]').forEach(button => {
  const code = button.dataset.touchKey;
  button.addEventListener('pointerdown', e => {
    if (!hud.classList.contains('active') || blackjackActive) return;
    button.setPointerCapture(e.pointerId);
    button.classList.add('pressed');
    setInputKey('touch', code, true);
    e.preventDefault();
  });
  const release = e => {
    if (e.pointerId && button.hasPointerCapture(e.pointerId)) button.releasePointerCapture(e.pointerId);
    button.classList.remove('pressed');
    setInputKey('touch', code, false);
  };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('contextmenu', e => e.preventDefault());
});

let lastMobileControlMode = '';
function setMobileControlMode(driving, canEnterVehicle, canHijackVehicle = false, canUseLocation = false, locationLabel = 'ENTER') {
  if (!mobileRunBtn || !mobileJumpBtn || !mobileCarBtn) return;
  const runLabel = driving ? 'BOOST' : 'RUN';
  const jumpLabel = driving ? 'BRAKE' : 'JUMP';
  const carLabel = driving ? (canUseLocation ? locationLabel : 'EXIT') : (canUseLocation ? locationLabel : (canEnterVehicle ? 'ENTER' : (canHijackVehicle ? 'HIJACK' : 'CAR')));
  const ready = driving || canEnterVehicle || canHijackVehicle || canUseLocation;
  const signature = `${runLabel}|${jumpLabel}|${carLabel}|${ready}`;
  if (signature === lastMobileControlMode) return;
  lastMobileControlMode = signature;
  mobileRunBtn.textContent = runLabel;
  mobileJumpBtn.textContent = jumpLabel;
  mobileCarBtn.textContent = carLabel;
  mobileCarBtn.classList.toggle('ready', ready);
}

addEventListener('blur', () => {
  clearKeySource('keyboard');
  clearKeySource('touch');
  resetStick();
});

let fPressedLast = false;
let ePressedLast = false;

// -------------------- CAMERA ORBIT STATE --------------------
const camYaw = { v: 0 };
const camPitch = { v: 0.15 };

// -------------------- GAME STATE --------------------
let inVehicle = null;       // reference to vehicle object when driving
let nearestVehicle = null;  // for prompt
let nearestTrafficVehicle = null; // running AI traffic car available for hijack
let nearestLocation = null; // interactive city landmark
let nearestMissionStart = null;
let nearestServiceLocation = null;
let activeLocation = null;  // player is inside this landmark interior
let locationReturnPos = new Vector3();
let wantedLevel = 0;
let alertTimer = 0;
let activeMission = null;
let missionTarget = null;
let missionTimer = 0;
let missionReward = 0;
let missionStatusTimer = 0;
let bankAlarm = false;
let bankAlarmTimer = 0;
let policeCars = [];
let distanceTraveled = 0;
let lastPos = new Vector3();
let hijackState = null;
let arrestState = null;
let jailTimer = 0;
let cuffVisual = null;
const activeProjectiles = [];
const activeEffects = [];
const fxGeometries = {
  muzzleFlame: new ConeGeometry(0.18, 0.7, 10),
  muzzleCore: new SphereGeometry(0.12, 8, 6),
  tracer: new BoxGeometry(0.045, 0.045, 4.5),
  dust: new SphereGeometry(0.12, 6, 5),
  spark: new BoxGeometry(0.035, 0.035, 0.55),
};

function disposeObjectMaterials(root) {
  const materials = new Set();
  root.traverse(obj => {
    if (!obj.material) return;
    if (Array.isArray(obj.material)) obj.material.forEach(mat => materials.add(mat));
    else materials.add(obj.material);
  });
  materials.forEach(mat => mat.dispose());
}

let blackjackActive = false;
let blackjackRound = 'idle';
let blackjackDeck = [];
let blackjackPlayerHand = [];
let blackjackDealerHand = [];
let blackjackDealerRevealed = false;
let playerCash = 500;
let casinoBet = 50;
let blackjackRoundBet = 50;
let casinoResult = 'Press New Round to deal.';

const missionCatalog = [
  { id: 'bank-delivery', name: 'Bank Delivery', startId: 'bank', targetId: 'garage', seconds: 70, reward: 1200, objective: 'Deliver the bank package to the garage.' },
  { id: 'club-pickup', name: 'Club Pickup', startId: 'nightclub', targetId: 'shop', seconds: 65, reward: 850, objective: 'Pick up the club parcel and reach the shop.' },
  { id: 'airport-run', name: 'Airport Run', startId: 'hotel', targetId: 'airport', seconds: 90, reward: 1600, objective: 'Move the VIP package from the hotel to the helipad.' },
  { id: 'harbor-drop', name: 'Harbor Drop', startId: 'harbor', targetId: 'radio', seconds: 85, reward: 1350, objective: 'Carry the dock manifest to the radio station.' },
  { id: 'emergency-ride', name: 'Emergency Ride', startId: 'hospital', targetId: 'fire', seconds: 75, reward: 1100, objective: 'Run emergency supplies to the fire station.' },
];

// -------------------- COLLISION HELPER --------------------
function collidesAt(x, z, radius = 0.6) {
  for (const b of buildings) {
    if (Math.abs(x - b.x) < b.w + radius && Math.abs(z - b.z) < b.d + radius) {
      return b;
    }
  }
  return null;
}
function resolveCollision(curX, curZ, newX, newZ, radius = 0.6) {
  // Try full move
  if (!collidesAt(newX, newZ, radius)) return [newX, newZ];
  // Try axis-separated (slide)
  if (!collidesAt(newX, curZ, radius)) return [newX, curZ];
  if (!collidesAt(curX, newZ, radius)) return [curX, newZ];
  return [curX, curZ];
}

// -------------------- LOCATION INTERACTION STATE --------------------
function findNearestLocation() {
  if (inVehicle || activeLocation) return null;
  let nearest = null;
  let best = 6.5;
  for (const loc of cityLocations) {
    const dx = loc.entrance.x - player.group.position.x;
    const dz = loc.entrance.z - player.group.position.z;
    const d = Math.hypot(dx, dz);
    if (d < best) {
      best = d;
      nearest = loc;
    }
  }
  return nearest;
}

function canUseShopService(loc) {
  return !!loc && loc.type === 'shop' && !inVehicle && !activeLocation && !nearestMissionStart;
}

function canUseOnFootService(loc) {
  return !!loc && (loc.type === 'shop' || loc.type === 'hospital') && !inVehicle && !activeLocation && !nearestMissionStart;
}

function getLocationById(id) {
  return cityLocations.find(loc => loc.id === id);
}

function getPlayerRefObject() {
  return inVehicle ? inVehicle.group : player.group;
}

function getPlayerRefPosition() {
  return getPlayerRefObject().position;
}

function distanceToLocation(loc) {
  const ref = getPlayerRefPosition();
  return Math.hypot(loc.entrance.x - ref.x, loc.entrance.z - ref.z);
}

function findMissionStart() {
  if (activeMission || inVehicle || !activeLocation) return null;
  for (const mission of missionCatalog) {
    const start = getLocationById(mission.startId);
    if (start && activeLocation.id === start.id) return mission;
  }
  return null;
}

function startMission(missionDef) {
  if (!missionDef) return;
  const target = getLocationById(missionDef.targetId);
  if (!target) return;
  activeMission = {
    ...missionDef,
    status: 'active',
    statusText: missionDef.objective,
  };
  missionTarget = target;
  missionTimer = missionDef.seconds;
  missionReward = missionDef.reward;
  missionStatusTimer = 0;
  document.getElementById('mode').textContent = 'MISSION';
  if (typeof flashObjectivePanel === 'function') flashObjectivePanel();
}

function completeMission(text = 'MISSION COMPLETE') {
  if (!activeMission) return;
  if (activeMission.id === 'bank-alarm' || activeMission.id === 'escape-heat') {
    bankAlarm = false;
    setWantedLevel(0);
  }
  activeMission.status = 'complete';
  activeMission.statusText = `${text} +$${missionReward}`;
  missionStatusTimer = 3.5;
  missionTarget = null;
  missionTimer = 0;
  if (typeof triggerScreenFlash === 'function') triggerScreenFlash('success');
  if (typeof flashObjectivePanel === 'function') flashObjectivePanel();
  if (!inVehicle && !activeLocation) document.getElementById('mode').textContent = wantedLevel > 0 ? 'WANTED' : 'ON FOOT';
}

function failMission(text = 'MISSION FAILED') {
  if (!activeMission) return;
  activeMission.status = 'failed';
  activeMission.statusText = text;
  missionStatusTimer = 3.5;
  missionTarget = null;
  missionTimer = 0;
  if (typeof triggerScreenFlash === 'function') triggerScreenFlash('fail');
  if (typeof flashObjectivePanel === 'function') flashObjectivePanel();
}

function startEscapeHeatMission() {
  if (activeMission && activeMission.id === 'escape-heat' && activeMission.status === 'active') return;
  const garage = getLocationById('garage');
  const gas = getLocationById('gas');
  activeMission = {
    id: 'escape-heat',
    name: 'Escape Heat',
    status: 'active',
    statusText: 'Reach GAS or GARAGE to cool down.',
  };
  missionTarget = distanceToLocation(garage) < distanceToLocation(gas) ? garage : gas;
  missionTimer = 90;
  missionReward = 500;
}

function updateMission(dt) {
  if (!activeMission) return;
  if (activeMission.id === 'jail' || activeMission.id === 'arrested') return;

  if (activeMission.status !== 'active') {
    missionStatusTimer -= dt;
    if (missionStatusTimer <= 0) activeMission = null;
    return;
  }

  missionTimer = Math.max(0, missionTimer - dt);
  if (missionTimer <= 0) {
    failMission('TIME EXPIRED');
    return;
  }

  if (activeMission.id === 'escape-heat') {
    const gas = getLocationById('gas');
    const garage = getLocationById('garage');
    if ((gas && distanceToLocation(gas) < 7) || (garage && distanceToLocation(garage) < 7)) {
      setWantedLevel(0);
      bankAlarm = false;
      completeMission('HEAT LOST');
    } else if (missionTarget && distanceToLocation(missionTarget) > 75) {
      missionTarget = distanceToLocation(garage) < distanceToLocation(gas) ? garage : gas;
    }
    return;
  }

  if (missionTarget && distanceToLocation(missionTarget) < 7) completeMission();
}

function setWantedLevel(level) {
  const next = Math.max(0, Math.min(5, Math.floor(level)));
  wantedLevel = next;
  alertTimer = next > 0 ? 99 : 0;
  if (next > 0) {
    document.getElementById('mode').textContent = 'WANTED';
    spawnPoliceCar();
    startEscapeHeatMission();
  } else if (!inVehicle && !activeLocation) {
    document.getElementById('mode').textContent = 'ON FOOT';
  }
}

function reportCrime(level = 1, reason = 'WANTED') {
  if (jailTimer > 0 || arrestState) return;
  setWantedLevel(Math.max(wantedLevel + level, level));
  const modeEl = document.getElementById('mode');
  if (modeEl && !inVehicle) modeEl.textContent = reason;
}

function enterLocation(loc) {
  if (!loc || inVehicle) return;
  locationReturnPos.copy(loc.entrance);
  activeLocation = loc;
  player.group.position.set(loc.insidePos.x, 0, loc.insidePos.z + 5);
  player.velocityY = 0;
  player.onGround = true;
  player.group.rotation.z = 0;
  player.heldItem.visible = true;
  nearestLocation = null;
  camYaw.v = 0;
  camPitch.v = 0.12;
  document.getElementById('mode').textContent = loc.type === 'bar' ? 'IN BAR' : `IN ${loc.label}`;
}

function exitLocation() {
  if (!activeLocation) return;
  player.group.position.set(locationReturnPos.x, 0, locationReturnPos.z + 1.6);
  player.velocityY = 0;
  player.onGround = true;
  activeLocation = null;
  document.getElementById('mode').textContent = 'ON FOOT';
}

function triggerLocationAlert(reason = 'ALERT') {
  setWantedLevel(Math.max(wantedLevel + 1, 2));
  const modeEl = document.getElementById('mode');
  if (modeEl && !inVehicle) modeEl.textContent = reason;
}

function triggerBankAlarm() {
  if (bankAlarm) return;
  bankAlarm = true;
  bankAlarmTimer = 55;
  setWantedLevel(Math.max(wantedLevel, 3));
  activeMission = {
    id: 'bank-alarm',
    name: 'Bank Alarm',
    status: 'active',
    statusText: 'Escape the bank and reach GAS or GARAGE.',
  };
  missionTarget = getLocationById('garage');
  missionTimer = 80;
  missionReward = 0;
  document.getElementById('mode').textContent = 'BANK ALARM';
  if (typeof triggerScreenFlash === 'function') triggerScreenFlash('alarm');
  if (typeof flashObjectivePanel === 'function') flashObjectivePanel();
}

function tryBankVaultInteraction() {
  if (!activeLocation || activeLocation.type !== 'bank' || !activeLocation.vaultPos) return false;
  const d = Math.hypot(player.group.position.x - activeLocation.vaultPos.x, player.group.position.z - activeLocation.vaultPos.z);
  if (d > 3.5) return false;
  triggerBankAlarm();
  return true;
}

function isNearSensitiveLocation(x, z) {
  if (activeLocation && (activeLocation.type === 'bank' || activeLocation.type === 'police')) return true;
  for (const loc of cityLocations) {
    if (loc.type !== 'bank' && loc.type !== 'police') continue;
    if (Math.hypot(loc.entrance.x - x, loc.entrance.z - z) < loc.alertRadius) return true;
  }
  return false;
}

function hitNearbySceneActor() {
  const attackRange = player.heldType === 'gun' ? 9 : 2.2;
  const attackArc = player.heldType === 'gun' ? 0.55 : 0.35;
  let target = null;
  let best = attackRange;
  const px = player.group.position.x;
  const pz = player.group.position.z;
  const fx = Math.sin(player.yaw);
  const fz = Math.cos(player.yaw);

  for (const actor of citySceneActors) {
    const dx = actor.group.position.x - px;
    const dz = actor.group.position.z - pz;
    const dist = Math.hypot(dx, dz);
    if (dist > best || dist < 0.001) continue;
    const dot = (dx / dist) * fx + (dz / dist) * fz;
    if (dot < attackArc) continue;
    best = dist;
    target = actor;
  }

  if (!target) return false;
  const dx = target.group.position.x - px;
  const dz = target.group.position.z - pz;
  const dist = Math.max(0.001, Math.hypot(dx, dz));
  const knock = player.heldType === 'gun' ? 1.2 : 0.45;
  target.group.position.x += dx / dist * knock;
  target.group.position.z += dz / dist * knock;
  target.hitTimer = 0.28;
  if (isNearSensitiveLocation(px, pz)) triggerLocationAlert('WANTED');
  return true;
}

function makeSmokeGroup() {
  const smoke = new Group();
  for (let i = 0; i < 5; i++) {
    const puff = new Mesh(
      new SphereGeometry(0.18 + i * 0.03, 8, 6),
      new MeshBasicMaterial({ color: 0x777780, transparent: true, opacity: 0.26 })
    );
    puff.position.set((Math.random() - 0.5) * 0.8, 1.4 + i * 0.18, -1.2 - i * 0.08);
    smoke.add(puff);
  }
  smoke.visible = false;
  return smoke;
}

function ensureVehicleDamageState(veh) {
  if (!veh) return;
  if (typeof veh.health !== 'number') veh.health = 100;
  if (!veh.smoke) {
    veh.smoke = makeSmokeGroup();
    veh.group.add(veh.smoke);
  }
}

function damageVehicle(veh, amount) {
  ensureVehicleDamageState(veh);
  veh.health = Math.max(0, veh.health - amount);
  if (veh.smoke) veh.smoke.visible = veh.health < 45;
  if (amount >= 10 && typeof triggerScreenFlash === 'function') triggerScreenFlash('impact');
}

function repairVehicleAtGarage(veh) {
  if (!veh) return false;
  ensureVehicleDamageState(veh);
  veh.health = 100;
  if (veh.smoke) veh.smoke.visible = false;
  const palette = [0xe83030, 0x2080ff, 0xffd200, 0x10b070, 0xff7030, 0xa040c0, 0xf0f0f0];
  const nextColor = palette[Math.floor(Math.random() * palette.length)];
  if (veh.body && veh.body.material && veh.body.material.color) veh.body.material.color.set(nextColor);
  veh.color = nextColor;
  return true;
}

function findNearestServiceLocation() {
  if (activeLocation) return null;
  const ref = getPlayerRefPosition();
  let nearest = null;
  let best = 7;
  for (const loc of cityLocations) {
    if (loc.type !== 'garage' && loc.type !== 'gas' && loc.type !== 'shop' && loc.type !== 'hospital') continue;
    const d = Math.hypot(loc.entrance.x - ref.x, loc.entrance.z - ref.z);
    if (d < best) {
      best = d;
      nearest = loc;
    }
  }
  return nearest;
}

function useServiceLocation(loc) {
  if (!loc) return false;
  if (loc.type === 'garage' && inVehicle) {
    repairVehicleAtGarage(inVehicle);
    setWantedLevel(Math.max(0, wantedLevel - 2));
    return true;
  }
  if (loc.type === 'gas' && inVehicle) {
    ensureVehicleDamageState(inVehicle);
    inVehicle.health = Math.min(100, inVehicle.health + 35);
    if (inVehicle.smoke) inVehicle.smoke.visible = inVehicle.health < 45;
    setWantedLevel(Math.max(0, wantedLevel - 1));
    return true;
  }
  if (loc.type === 'shop' && !inVehicle) {
    setHeldItem(player.heldType === 'gun' ? 'object' : 'gun');
    return true;
  }
  if (loc.type === 'hospital' && !inVehicle) {
    setWantedLevel(Math.max(0, wantedLevel - 2));
    player.knockTimer = 0;
    player.velocityY = 0;
    return true;
  }
  return false;
}

function canPlayBlackjack() {
  if (!activeLocation || activeLocation.type !== 'casino' || blackjackActive || inVehicle) return false;
  if (!activeLocation.blackjackPos) return true;
  const dx = player.group.position.x - activeLocation.blackjackPos.x;
  const dz = player.group.position.z - activeLocation.blackjackPos.z;
  return Math.hypot(dx, dz) < 8.2;
}

function getBlackjackEls() {
  return {
    overlay: document.getElementById('blackjackOverlay'),
    cash: document.getElementById('blackjackCash'),
    bet: document.getElementById('blackjackBet'),
    result: document.getElementById('blackjackResult'),
    dealerScore: document.getElementById('dealerScore'),
    playerScore: document.getElementById('playerScore'),
    dealerHand: document.getElementById('dealerHand'),
    playerHand: document.getElementById('playerHand'),
    hit: document.getElementById('blackjackHitBtn'),
    stand: document.getElementById('blackjackStandBtn'),
    double: document.getElementById('blackjackDoubleBtn'),
    next: document.getElementById('blackjackNewBtn'),
    exit: document.getElementById('blackjackExitBtn'),
  };
}

function openBlackjack() {
  if (!activeLocation || activeLocation.type !== 'casino') return;
  blackjackActive = true;
  clearKeySource('keyboard');
  clearKeySource('touch');
  resetStick();
  document.body.classList.add('blackjack-open');
  const { overlay } = getBlackjackEls();
  if (overlay) {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
  }
  if (!blackjackPlayerHand.length || blackjackRound === 'done') startBlackjackRound();
  else renderBlackjack();
}

function closeBlackjack() {
  blackjackActive = false;
  clearKeySource('keyboard');
  clearKeySource('touch');
  resetStick();
  document.body.classList.remove('blackjack-open');
  const { overlay } = getBlackjackEls();
  if (overlay) {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

function makeBlackjackDeck() {
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suits = ['♠', '♥', '♦', '♣'];
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) deck.push({ rank, suit });
  }
  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function drawCard() {
  if (blackjackDeck.length < 12) blackjackDeck = shuffleDeck(makeBlackjackDeck());
  return blackjackDeck.pop();
}

function scoreHand(hand) {
  let score = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === 'A') {
      score += 11;
      aces++;
    } else if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') {
      score += 10;
    } else {
      score += Number(card.rank);
    }
  }
  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }
  return score;
}

function isBlackjack(hand) {
  return hand.length === 2 && scoreHand(hand) === 21;
}

function startBlackjackRound() {
  if (playerCash < casinoBet) {
    blackjackRound = 'idle';
    casinoResult = `Need $${casinoBet} to sit at this table.`;
    renderBlackjack();
    return;
  }
  blackjackRound = 'active';
  blackjackRoundBet = casinoBet;
  casinoResult = 'Hit, stand, or double.';
  blackjackDealerRevealed = false;
  blackjackDeck = shuffleDeck(makeBlackjackDeck());
  blackjackPlayerHand = [drawCard(), drawCard()];
  blackjackDealerHand = [drawCard(), drawCard()];

  const playerNat = isBlackjack(blackjackPlayerHand);
  const dealerNat = isBlackjack(blackjackDealerHand);
  if (playerNat || dealerNat) {
    blackjackDealerRevealed = true;
    if (playerNat && dealerNat) finishBlackjackRound('push');
    else if (playerNat) finishBlackjackRound('blackjack');
    else finishBlackjackRound('lose');
    return;
  }
  renderBlackjack();
}

function blackjackHit() {
  if (blackjackRound !== 'active') return;
  blackjackPlayerHand.push(drawCard());
  const playerScore = scoreHand(blackjackPlayerHand);
  if (playerScore > 21) finishBlackjackRound('bust');
  else renderBlackjack();
}

function blackjackStand() {
  if (blackjackRound !== 'active') return;
  blackjackDealerRevealed = true;
  while (scoreHand(blackjackDealerHand) < 17) blackjackDealerHand.push(drawCard());
  const playerScore = scoreHand(blackjackPlayerHand);
  const dealerScore = scoreHand(blackjackDealerHand);
  if (dealerScore > 21) finishBlackjackRound('win');
  else if (playerScore > dealerScore) finishBlackjackRound('win');
  else if (playerScore < dealerScore) finishBlackjackRound('lose');
  else finishBlackjackRound('push');
}

function blackjackDouble() {
  if (blackjackRound !== 'active' || blackjackPlayerHand.length !== 2) return;
  if (playerCash < blackjackRoundBet * 2) {
    casinoResult = `Need $${blackjackRoundBet * 2} cash to double.`;
    renderBlackjack();
    return;
  }
  blackjackRoundBet *= 2;
  blackjackPlayerHand.push(drawCard());
  if (scoreHand(blackjackPlayerHand) > 21) finishBlackjackRound('bust');
  else blackjackStand();
}

function finishBlackjackRound(result) {
  blackjackRound = 'done';
  blackjackDealerRevealed = true;
  let cashDelta = 0;
  if (result === 'blackjack') {
    cashDelta = Math.floor(blackjackRoundBet * 1.5);
    casinoResult = `BLACKJACK! You win $${cashDelta}.`;
  } else if (result === 'win') {
    cashDelta = blackjackRoundBet;
    casinoResult = `WIN. You take $${cashDelta}.`;
  } else if (result === 'lose') {
    cashDelta = -blackjackRoundBet;
    casinoResult = `LOSE. Dealer takes $${blackjackRoundBet}.`;
  } else if (result === 'bust') {
    cashDelta = -blackjackRoundBet;
    casinoResult = `BUST. You lose $${blackjackRoundBet}.`;
  } else {
    casinoResult = 'PUSH. Bet returned.';
  }
  playerCash = Math.max(0, playerCash + cashDelta);
  renderBlackjack();
}

function makeBlackjackCardEl(card, hidden = false) {
  const el = document.createElement('div');
  el.className = `playing-card${hidden ? ' hidden' : ''}${!hidden && (card.suit === '♥' || card.suit === '♦') ? ' red' : ''}`;
  if (hidden) {
    el.innerHTML = '<div class="card-rank">?</div><div class="card-suit">◆</div><div class="card-foot">?</div>';
    return el;
  }
  el.innerHTML = `<div class="card-rank">${card.rank}</div><div class="card-suit">${card.suit}</div><div class="card-foot">${card.rank}</div>`;
  return el;
}

function renderBlackjack() {
  const els = getBlackjackEls();
  if (!els.overlay) return;
  els.cash.textContent = `$${playerCash}`;
  els.bet.textContent = `$${blackjackRoundBet || casinoBet}`;
  els.result.textContent = casinoResult;
  els.playerScore.textContent = scoreHand(blackjackPlayerHand);
  els.dealerScore.textContent = blackjackDealerRevealed ? scoreHand(blackjackDealerHand) : '?';
  els.playerHand.replaceChildren(...blackjackPlayerHand.map(card => makeBlackjackCardEl(card)));
  els.dealerHand.replaceChildren(...blackjackDealerHand.map((card, i) => makeBlackjackCardEl(card, !blackjackDealerRevealed && i === 0)));
  const active = blackjackRound === 'active';
  els.hit.disabled = !active;
  els.stand.disabled = !active;
  els.double.disabled = !active || blackjackPlayerHand.length !== 2 || playerCash < blackjackRoundBet * 2;
  els.next.disabled = active || playerCash < casinoBet;
}

function bindBlackjackControls() {
  const els = getBlackjackEls();
  if (!els.overlay || els.overlay.dataset.bound === 'true') return;
  els.hit.addEventListener('click', blackjackHit);
  els.stand.addEventListener('click', blackjackStand);
  els.double.addEventListener('click', blackjackDouble);
  els.next.addEventListener('click', startBlackjackRound);
  els.exit.addEventListener('click', closeBlackjack);
  els.overlay.addEventListener('pointerdown', e => e.stopPropagation());
  els.overlay.dataset.bound = 'true';
}

bindBlackjackControls();

addEventListener('keydown', e => {
  if (!blackjackActive) return;
  if (e.code === 'Escape') closeBlackjack();
  if (e.code === 'KeyH') blackjackHit();
  if (e.code === 'KeyS') blackjackStand();
  if (e.code === 'KeyD') blackjackDouble();
  if (e.code === 'KeyN') startBlackjackRound();
});

function spawnPoliceCar() {
  if (policeCars.length >= Math.min(3, Math.max(1, wantedLevel))) return;
  const car = wantedLevel >= 2 && Math.random() < 0.55 ? makePoliceVan() : makeCar(0x102040);
  const ref = getPlayerRefPosition();
  const angle = Math.random() * Math.PI * 2;
  car.group.position.set(ref.x + Math.sin(angle) * 38, 0, ref.z + Math.cos(angle) * 38);
  car.group.rotation.y = angle + Math.PI;
  let red = car.sirenRed;
  let blue = car.sirenBlue;
  if (!red || !blue) {
    red = new Mesh(new BoxGeometry(0.35, 0.16, 0.22), new MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.35, 1.85, 0.1);
    blue = new Mesh(new BoxGeometry(0.35, 0.16, 0.22), new MeshBasicMaterial({ color: 0x2080ff }));
    blue.position.set(0.35, 1.85, 0.1);
    car.group.add(red, blue);
  }
  scene.add(car.group);
  policeCars.push({
    ...car,
    kind: car.kind || 'police',
    policeRole: car.kind === 'policeVan' ? 'transport' : 'patrol',
    velocity: 0,
    health: car.kind === 'policeVan' ? 190 : 140,
    sirenRed: red,
    sirenBlue: blue,
    bumpTimer: 0,
  });
}

function ensurePoliceTransport(policeCar) {
  if (policeCar.kind === 'policeVan') return policeCar;
  const van = makePoliceVan();
  van.group.position.copy(policeCar.group.position);
  van.group.rotation.y = policeCar.group.rotation.y;
  van.velocity = 0;
  van.health = 190;
  van.policeRole = 'transport';
  scene.add(van.group);
  policeCars.push({
    ...van,
    kind: 'policeVan',
    policeRole: 'transport',
    velocity: 0,
    health: 190,
    sirenRed: van.sirenRed,
    sirenBlue: van.sirenBlue,
    bumpTimer: 0,
  });
  return policeCars[policeCars.length - 1];
}

function ensureCuffVisual() {
  if (cuffVisual) return cuffVisual;
  cuffVisual = new Group();
  const metal = new MeshStandardMaterial({ color: 0xc8d0d8, roughness: 0.25, metalness: 0.85 });
  for (const x of [-0.22, 0.22]) {
    const cuff = new Mesh(new CylinderGeometry(0.13, 0.13, 0.08, 14), metal);
    cuff.position.set(x, 1.02, -0.28);
    cuff.rotation.z = Math.PI / 2;
    cuffVisual.add(cuff);
  }
  const chain = new Mesh(new BoxGeometry(0.28, 0.04, 0.04), metal);
  chain.position.set(0, 1.02, -0.28);
  cuffVisual.add(chain);
  cuffVisual.visible = false;
  player.group.add(cuffVisual);
  return cuffVisual;
}

function setPlayerCuffed(cuffed) {
  const cuffs = ensureCuffVisual();
  cuffs.visible = cuffed;
  if (!cuffed) return;
  player.leftArm.rotation.set(0.85, 0, -0.55);
  player.rightArm.rotation.set(0.85, 0, 0.55);
  player.heldItem.visible = false;
}

function makePoliceOfficerActor() {
  const officer = makePed();
  const uniform = new MeshStandardMaterial({ color: 0x16345c, roughness: 0.55 });
  const dark = new MeshStandardMaterial({ color: 0x101018, roughness: 0.65 });
  officer.body.material = uniform;
  officer.leftArm.material = uniform;
  officer.rightArm.material = uniform;
  officer.leftLeg.material = dark;
  officer.rightLeg.material = dark;
  const cap = new Mesh(new BoxGeometry(0.42, 0.12, 0.38), new MeshStandardMaterial({ color: 0x102040, roughness: 0.5 }));
  cap.position.y = 1.9;
  const badge = new Mesh(new BoxGeometry(0.08, 0.1, 0.03), new MeshBasicMaterial({ color: 0xffd200 }));
  badge.position.set(0.16, 1.22, 0.18);
  officer.group.add(cap, badge);
  officer.group.visible = true;
  return {
    ...officer,
    walkPhase: 0,
    startPos: new Vector3(),
  };
}

function setOfficerPose(officer, moving, dt) {
  if (!officer) return;
  officer.walkPhase += dt * (moving ? 8 : 2);
  const swing = moving ? Math.sin(officer.walkPhase) : 0;
  officer.leftLeg.rotation.x = swing * 0.42;
  officer.rightLeg.rotation.x = -swing * 0.42;
  officer.leftArm.rotation.x = -swing * 0.3;
  officer.rightArm.rotation.x = swing * 0.3;
  officer.body.position.y = 1.1 + Math.abs(swing) * 0.025;
}

function beginArrest(policeCar) {
  if (arrestState || jailTimer > 0) return;
  const station = getLocationById('police');
  if (!station) return;
  policeCar = ensurePoliceTransport(policeCar);
  if (inVehicle) {
    inVehicle.occupied = false;
    inVehicle.group.rotation.z = 0;
    document.getElementById('speedo').classList.remove('show');
    inVehicle = null;
  }
  activeLocation = null;
  player.group.visible = true;
  player.heldItem.visible = false;
  player.velocityY = 0;
  player.knockTimer = 0;
  keys['KeyW'] = keys['KeyA'] = keys['KeyS'] = keys['KeyD'] = keys['Space'] = false;
  policeCar.arresting = true;
  policeCar.policeRole = 'transport';
  policeCar.velocity = 0;
  const officer = makePoliceOfficerActor();
  const officerStartX = policeCar.group.position.x - Math.sin(policeCar.group.rotation.y) * 3.2;
  const officerStartZ = policeCar.group.position.z - Math.cos(policeCar.group.rotation.y) * 3.2;
  officer.group.position.set(officerStartX, 0, officerStartZ);
  officer.group.rotation.y = policeCar.group.rotation.y;
  officer.startPos.copy(officer.group.position);
  scene.add(officer.group);
  arrestState = {
    car: policeCar,
    station,
    officer,
    phase: 'cuff',
    timer: 0,
  };
  setPlayerCuffed(true);
  activeMission = {
    id: 'arrested',
    name: 'Arrested',
    status: 'active',
    statusText: 'Police are taking you to the station.',
  };
  missionTimer = 999;
  missionTarget = station;
  document.getElementById('mode').textContent = 'ARRESTED';
}

function updateArrest(dt) {
  if (!arrestState) return;
  const a = arrestState;
  a.timer += dt;

  const sideX = a.car.group.position.x - Math.cos(a.car.group.rotation.y) * 1.95;
  const sideZ = a.car.group.position.z - Math.sin(a.car.group.rotation.y) * 1.95;
  if (a.phase === 'cuff') {
    const t = Math.min(1, a.timer / 1.15);
    player.group.visible = true;
    player.group.position.set(sideX, 0, sideZ);
    player.yaw = a.car.group.rotation.y + Math.PI;
    player.group.rotation.y = player.yaw;
    player.body.rotation.x = 0.18;
    player.head.rotation.x = 0.1;
    setPlayerCuffed(true);
    if (a.officer) {
      const officerX = a.officer.startPos.x + (sideX - a.officer.startPos.x) * t;
      const officerZ = a.officer.startPos.z + (sideZ - 0.75 - a.officer.startPos.z) * t;
      a.officer.group.position.set(officerX, 0, officerZ);
      a.officer.group.rotation.y = Math.atan2(sideX - officerX, sideZ - officerZ);
      if (t > 0.82) {
        a.officer.leftArm.rotation.x = -1.05;
        a.officer.rightArm.rotation.x = -1.05;
      } else {
        setOfficerPose(a.officer, true, dt);
      }
    }
    if (a.timer > 1.8) {
      a.phase = 'load';
      a.timer = 0;
      if (a.officer) a.officer.startPos.copy(a.officer.group.position);
    }
    return;
  }

  if (a.phase === 'load') {
    const rearX = a.car.group.position.x - Math.sin(a.car.group.rotation.y) * 2.7;
    const rearZ = a.car.group.position.z - Math.cos(a.car.group.rotation.y) * 2.7;
    const t = Math.min(1, a.timer / 1.4);
    player.group.visible = true;
    player.group.position.set(sideX + (rearX - sideX) * t, 0, sideZ + (rearZ - sideZ) * t);
    player.yaw = a.car.group.rotation.y;
    player.group.rotation.y = player.yaw;
    player.body.rotation.x = 0.28;
    player.head.rotation.x = 0.12;
    setPlayerCuffed(true);
    if (a.officer) {
      a.officer.group.position.set(player.group.position.x - Math.cos(a.car.group.rotation.y) * 0.65, 0, player.group.position.z - Math.sin(a.car.group.rotation.y) * 0.65);
      a.officer.group.rotation.y = a.car.group.rotation.y;
      a.officer.leftArm.rotation.x = -0.95;
      a.officer.rightArm.rotation.x = -0.75;
      setOfficerPose(a.officer, t < 0.95, dt);
    }
    if (a.timer > 1.4) {
      a.phase = 'drive';
      a.timer = 0;
      player.group.visible = false;
      if (a.officer) a.officer.group.visible = false;
    }
    return;
  }

  const target = a.station.entrance;
  const dx = target.x - a.car.group.position.x;
  const dz = target.z - a.car.group.position.z;
  const dist = Math.max(0.001, Math.hypot(dx, dz));
  const desiredYaw = Math.atan2(dx, dz);
  let diff = desiredYaw - a.car.group.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  a.car.group.rotation.y += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  const transportSpeed = a.car.kind === 'policeVan' ? 18 : 20;
  a.car.velocity += (transportSpeed - a.car.velocity) * dt * 1.2;
  const dirX = Math.sin(a.car.group.rotation.y);
  const dirZ = Math.cos(a.car.group.rotation.y);
  a.car.group.position.x += dirX * a.car.velocity * dt;
  a.car.group.position.z += dirZ * a.car.velocity * dt;
  for (const w of a.car.wheels) w.rotation.x += a.car.velocity * dt * 1.8;

  if (dist < 5 || a.timer > 18) {
    enterJailCell(a.station);
  }
}

function enterJailCell(station) {
  const cell = station.jailCellPos || station.insidePos;
  if (arrestState && arrestState.officer) scene.remove(arrestState.officer.group);
  arrestState = null;
  setWantedLevel(0);
  bankAlarm = false;
  activeMission = {
    id: 'jail',
    name: 'Jail',
    status: 'active',
    statusText: 'Wait 60s until release.',
  };
  missionTarget = null;
  missionTimer = 60;
  missionReward = 0;
  jailTimer = 60;
  activeLocation = station;
  locationReturnPos.copy(station.entrance);
  player.group.visible = true;
  player.heldItem.visible = true;
  setHeldItem('empty');
  setPlayerCuffed(false);
  player.body.rotation.x = 0;
  player.head.rotation.x = 0;
  player.leftArm.rotation.set(0, 0, 0);
  player.rightArm.rotation.set(0, 0, 0);
  player.group.position.set(cell.x, 0, cell.z);
  player.yaw = Math.PI;
  player.group.rotation.y = player.yaw;
  player.group.rotation.z = 0;
  camYaw.v = Math.PI;
  camPitch.v = 0.08;
  document.getElementById('mode').textContent = 'JAILED';
}

function updateJail(dt) {
  if (jailTimer <= 0) return;
  jailTimer = Math.max(0, jailTimer - dt);
  if (activeMission && activeMission.id === 'jail') {
    activeMission.statusText = `Release in ${Math.ceil(jailTimer)}s.`;
    missionTimer = jailTimer;
  }
  const station = getLocationById('police');
  if (station && station.jailCellPos) {
    const cell = station.jailCellPos;
    const dx = player.group.position.x - cell.x;
    const dz = player.group.position.z - cell.z;
    if (Math.hypot(dx, dz) > 4) player.group.position.set(cell.x, 0, cell.z);
  }
  if (jailTimer <= 0 && station) {
    const out = station.releasePos || station.exitPos || station.entrance;
    player.group.position.set(out.x, 0, out.z);
    activeLocation = null;
    activeMission = null;
    document.getElementById('mode').textContent = 'RELEASED';
  }
}

function updatePoliceChase(dt) {
  if (arrestState || jailTimer > 0) return;
  if (wantedLevel <= 0) return;
  while (policeCars.length < Math.min(3, wantedLevel)) spawnPoliceCar();
  const target = getPlayerRefObject();
  const targetSpeed = inVehicle ? Math.abs(inVehicle.velocity || 0) : ((keys['ShiftLeft'] || keys['ShiftRight']) ? 8.5 : 4.2);

  for (const car of policeCars) {
    let dx = target.position.x - car.group.position.x;
    let dz = target.position.z - car.group.position.z;
    const dist = Math.max(0.001, Math.hypot(dx, dz));
    if (dist > 115) {
      const rearYaw = inVehicle ? inVehicle.group.rotation.y + Math.PI : player.yaw + Math.PI;
      car.group.position.set(
        target.position.x + Math.sin(rearYaw) * 34 + (Math.random() - 0.5) * 8,
        0,
        target.position.z + Math.cos(rearYaw) * 34 + (Math.random() - 0.5) * 8
      );
      car.group.rotation.y = rearYaw + Math.PI;
      car.velocity = Math.max(car.velocity, 16);
    }

    const lead = MathUtils.clamp(dist / 38, 0.25, 2.2);
    let leadX = target.position.x;
    let leadZ = target.position.z;
    if (inVehicle) {
      leadX += Math.sin(inVehicle.group.rotation.y) * targetSpeed * lead;
      leadZ += Math.cos(inVehicle.group.rotation.y) * targetSpeed * lead;
    } else {
      leadX += Math.sin(player.yaw) * targetSpeed * lead * 0.45;
      leadZ += Math.cos(player.yaw) * targetSpeed * lead * 0.45;
    }
    dx = leadX - car.group.position.x;
    dz = leadZ - car.group.position.z;
    const desiredYaw = Math.atan2(dx, dz);
    let diff = desiredYaw - car.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = car.kind === 'policeVan' ? 1.9 : 2.55;
    car.group.rotation.y += Math.max(-turn * dt, Math.min(turn * dt, diff));
    const escapeBoost = inVehicle ? Math.min(14, targetSpeed * 0.45) : Math.min(5, targetSpeed * 0.35);
    const chaseTopSpeed = (car.kind === 'policeVan' ? wantedLevel * 3 + 15 : wantedLevel * 4 + 17) + escapeBoost;
    car.velocity += (chaseTopSpeed - car.velocity) * dt * (dist > 45 ? 1.45 : 0.92);
    const dirX = Math.sin(car.group.rotation.y);
    const dirZ = Math.cos(car.group.rotation.y);
    let nx = car.group.position.x + dirX * car.velocity * dt;
    let nz = car.group.position.z + dirZ * car.velocity * dt;
    [nx, nz] = resolveCollision(car.group.position.x, car.group.position.z, nx, nz, 1.3);
    car.group.position.x = nx;
    car.group.position.z = nz;
    for (const w of car.wheels) w.rotation.x += car.velocity * dt * 1.8;
    const pulse = Math.sin(performance.now() * 0.018) > 0;
    car.sirenRed.visible = pulse;
    car.sirenBlue.visible = !pulse;

    car.bumpTimer = Math.max(0, car.bumpTimer - dt);
    if (dist < 3.1 && car.bumpTimer <= 0) {
      car.bumpTimer = 0.8;
      if (inVehicle) {
        damageVehicle(inVehicle, 14 + wantedLevel * 4);
        if (wantedLevel >= 3 && inVehicle.health <= 20) beginArrest(car);
      }
      else if (wantedLevel >= 2) beginArrest(car);
      else triggerLocationAlert('WANTED');
    }
    if (!inVehicle && wantedLevel >= 3 && dist < 2.2) {
      beginArrest(car);
    }
  }
}

// -------------------- PLAYER ACTIONS --------------------
function worldForwardFromYaw(yaw) {
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

function applyHitToNearestTarget(range, arc, damage, knock) {
  let target = null;
  let targetType = 'ped';
  let best = range;
  const px = player.group.position.x;
  const pz = player.group.position.z;
  const forward = worldForwardFromYaw(player.yaw);

  for (const ped of peds) {
    if (ped.downTimer > 0) continue;
    const dx = ped.group.position.x - px;
    const dz = ped.group.position.z - pz;
    const dist = Math.hypot(dx, dz);
    if (dist > best || dist < 0.001) continue;
    const dot = (dx / dist) * forward.x + (dz / dist) * forward.z;
    if (dot < arc) continue;
    best = dist;
    target = ped;
    targetType = 'ped';
  }

  for (const actor of citySceneActors) {
    const dx = actor.group.position.x - px;
    const dz = actor.group.position.z - pz;
    const dist = Math.hypot(dx, dz);
    if (dist > best || dist < 0.001) continue;
    const dot = (dx / dist) * forward.x + (dz / dist) * forward.z;
    if (dot < arc) continue;
    best = dist;
    target = actor;
    targetType = 'actor';
  }

  for (const vehicle of [...vehicles, ...aiCars, ...policeCars]) {
    if (!vehicle || vehicle === inVehicle) continue;
    const dx = vehicle.group.position.x - px;
    const dz = vehicle.group.position.z - pz;
    const dist = Math.hypot(dx, dz);
    if (dist > best || dist < 0.001) continue;
    const dot = (dx / dist) * forward.x + (dz / dist) * forward.z;
    if (dot < arc) continue;
    best = dist;
    target = vehicle;
    targetType = 'vehicle';
  }

  if (!target) return false;
  const dx = target.group.position.x - px;
  const dz = target.group.position.z - pz;
  const dist = Math.max(0.001, Math.hypot(dx, dz));
  if (targetType === 'ped') {
    damagePed(target, damage, dx / dist * knock, dz / dist * knock);
    reportCrime(player.heldType === 'gun' ? 2 : 1, 'ASSAULT');
  } else {
    if (targetType === 'vehicle') {
      damageVehicle(target, damage * 0.75);
      target.group.position.x += dx / dist * knock * 0.45;
      target.group.position.z += dz / dist * knock * 0.45;
      spawnSparkBurst(target.group.position.x, 0.8, target.group.position.z, player.heldType === 'gun' ? 1.25 : 0.8);
      reportCrime(player.heldType === 'gun' ? 2 : 1, 'VEHICLE ATTACK');
      return true;
    }
    target.group.position.x += dx / dist * knock;
    target.group.position.z += dz / dist * knock;
    target.hitTimer = 0.28;
    reportCrime(player.heldType === 'gun' ? 2 : 1, 'ASSAULT');
  }
  if (isNearSensitiveLocation(px, pz)) triggerLocationAlert('WANTED');
  return true;
}

function damageTargetsNearPoint(x, z, radius, damage, knock) {
  let hit = false;
  for (const ped of peds) {
    if (ped.downTimer > 0) continue;
    const dx = ped.group.position.x - x;
    const dz = ped.group.position.z - z;
    const dist = Math.hypot(dx, dz);
    if (dist > radius || dist < 0.001) continue;
    damagePed(ped, damage, dx / dist * knock, dz / dist * knock);
    hit = true;
  }
  for (const actor of citySceneActors) {
    const dx = actor.group.position.x - x;
    const dz = actor.group.position.z - z;
    const dist = Math.hypot(dx, dz);
    if (dist > radius || dist < 0.001) continue;
    actor.group.position.x += dx / dist * knock;
    actor.group.position.z += dz / dist * knock;
    actor.hitTimer = 0.28;
    hit = true;
  }
  for (const vehicle of [...vehicles, ...aiCars, ...policeCars]) {
    if (!vehicle || vehicle === inVehicle) continue;
    const dx = vehicle.group.position.x - x;
    const dz = vehicle.group.position.z - z;
    const dist = Math.hypot(dx, dz);
    if (dist > radius + 1.2 || dist < 0.001) continue;
    damageVehicle(vehicle, damage * 0.9);
    vehicle.group.position.x += dx / dist * knock * 0.55;
    vehicle.group.position.z += dz / dist * knock * 0.55;
    spawnSparkBurst(vehicle.group.position.x, 0.8, vehicle.group.position.z, 1.1);
    hit = true;
  }
  if (hit) reportCrime(1, 'ATTACK');
  if (hit && isNearSensitiveLocation(x, z)) triggerLocationAlert('WANTED');
  return hit;
}

function spawnMuzzleFlash() {
  const forward = worldForwardFromYaw(player.yaw);
  const flash = new Group();
  const flame = new Mesh(
    fxGeometries.muzzleFlame,
    new MeshBasicMaterial({ color: 0xffd200, transparent: true, opacity: 0.92 })
  );
  flame.rotation.x = Math.PI / 2;
  const core = new Mesh(
    fxGeometries.muzzleCore,
    new MeshBasicMaterial({ color: 0xff5900, transparent: true, opacity: 0.85 })
  );
  flash.add(flame, core);
  flash.position.set(
    player.group.position.x + forward.x * 0.95,
    player.group.position.y + 1.35,
    player.group.position.z + forward.z * 0.95
  );
  flash.rotation.y = player.yaw;
  scene.add(flash);
  activeEffects.push({ group: flash, ttl: 0.08, maxTtl: 0.08, kind: 'flash' });

  const tracer = new Mesh(
    fxGeometries.tracer,
    new MeshBasicMaterial({ color: 0xfff4d8, transparent: true, opacity: 0.72 })
  );
  tracer.position.set(
    player.group.position.x + forward.x * 3.2,
    player.group.position.y + 1.32,
    player.group.position.z + forward.z * 3.2
  );
  tracer.rotation.y = player.yaw;
  scene.add(tracer);
  activeEffects.push({ group: tracer, ttl: 0.12, maxTtl: 0.12, kind: 'tracer' });
}

function spawnImpactDust(x, z) {
  const dust = new Group();
  const dustMat = new MeshBasicMaterial({ color: 0xb8b0a8, transparent: true, opacity: 0.34 });
  for (let i = 0; i < 4; i++) {
    const puff = new Mesh(fxGeometries.dust, dustMat);
    puff.scale.setScalar(0.65 + Math.random() * 0.65);
    puff.position.set((Math.random() - 0.5) * 0.5, 0.25 + Math.random() * 0.45, (Math.random() - 0.5) * 0.5);
    dust.add(puff);
  }
  dust.position.set(x, 0, z);
  scene.add(dust);
  activeEffects.push({ group: dust, ttl: 0.32, maxTtl: 0.32, kind: 'dust' });
}

function spawnSparkBurst(x, y, z, intensity = 1) {
  const sparks = new Group();
  const count = Math.min(16, Math.max(6, Math.floor(8 * intensity)));
  const warmMat = new MeshBasicMaterial({ color: 0xff8a00, transparent: true, opacity: 0.95 });
  const whiteMat = new MeshBasicMaterial({ color: 0xfff4d8, transparent: true, opacity: 0.95 });
  for (let i = 0; i < count; i++) {
    const spark = new Mesh(fxGeometries.spark, Math.random() < 0.35 ? whiteMat : warmMat);
    spark.scale.z = 0.7 + Math.random() * 0.65;
    spark.position.set((Math.random() - 0.5) * 0.45, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.45);
    spark.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    spark.userData.vx = (Math.random() - 0.5) * 5.5 * intensity;
    spark.userData.vy = (1.2 + Math.random() * 4.2) * intensity;
    spark.userData.vz = (Math.random() - 0.5) * 5.5 * intensity;
    sparks.add(spark);
  }
  sparks.position.set(x, y, z);
  scene.add(sparks);
  activeEffects.push({ group: sparks, ttl: 0.42, maxTtl: 0.42, kind: 'sparks' });
}

function throwHeldObject() {
  const forward = worldForwardFromYaw(player.yaw);
  const mesh = new Mesh(
    new BoxGeometry(0.42, 0.32, 0.42),
    new MeshStandardMaterial({ color: 0x88c8ff, roughness: 0.55, metalness: 0.15 })
  );
  mesh.castShadow = true;
  mesh.position.set(
    player.group.position.x + forward.x * 0.85,
    player.group.position.y + 1.2,
    player.group.position.z + forward.z * 0.85
  );
  scene.add(mesh);
  activeProjectiles.push({
    mesh,
    type: 'object',
    vx: forward.x * 18,
    vy: 4.5,
    vz: forward.z * 18,
    ttl: 1.25,
  });
}

function performPlayerAttack() {
  player.actionTimer = 0.28;
  if (player.heldType === 'gun') {
    spawnMuzzleFlash();
    const hit = applyHitToNearestTarget(16, 0.72, 44, 1.25);
    if (!hit) reportCrime(2, 'SHOTS FIRED');
  } else if (player.heldType === 'object') {
    throwHeldObject();
    applyHitToNearestTarget(4.8, 0.58, 26, 0.75);
    setHeldItem('empty');
  } else {
    hitNearbyPed();
  }
}

function updateCombatEffects(dt) {
  for (let i = activeEffects.length - 1; i >= 0; i--) {
    const fx = activeEffects[i];
    fx.ttl -= dt;
    const alpha = Math.max(0, fx.ttl / fx.maxTtl);
    if (fx.kind !== 'sparks') fx.group.scale.setScalar(0.7 + (1 - alpha) * 1.4);
    fx.group.traverse(obj => {
      if (fx.kind === 'sparks' && obj.isMesh) {
        obj.position.x += (obj.userData.vx || 0) * dt;
        obj.position.y += (obj.userData.vy || 0) * dt;
        obj.position.z += (obj.userData.vz || 0) * dt;
        obj.userData.vy = (obj.userData.vy || 0) - 12 * dt;
        obj.rotation.x += dt * 18;
        obj.rotation.y += dt * 12;
      }
      if (obj.material && obj.material.transparent) {
        if (typeof obj.material.userData.baseOpacity !== 'number') obj.material.userData.baseOpacity = obj.material.opacity;
        obj.material.opacity = obj.material.userData.baseOpacity * alpha;
      }
    });
    if (fx.ttl <= 0) {
      disposeObjectMaterials(fx.group);
      scene.remove(fx.group);
      activeEffects.splice(i, 1);
    }
  }

  for (let i = activeProjectiles.length - 1; i >= 0; i--) {
    const p = activeProjectiles[i];
    p.ttl -= dt;
    p.vy -= 15 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.rotation.x += dt * 9;
    p.mesh.rotation.y += dt * 12;
    const bodyHit = damageTargetsNearPoint(p.mesh.position.x, p.mesh.position.z, 1.3, 34, 1.0);
    const hit = bodyHit || p.mesh.position.y <= 0.25 || collidesAt(p.mesh.position.x, p.mesh.position.z, 0.25);
    if (hit || p.ttl <= 0) {
      spawnImpactDust(p.mesh.position.x, p.mesh.position.z);
      if (p.mesh.material) p.mesh.material.dispose();
      scene.remove(p.mesh);
      activeProjectiles.splice(i, 1);
    }
  }
}

function clearHeldItem() {
  while (player.heldItem.children.length) player.heldItem.remove(player.heldItem.children[0]);
}

function setHeldItem(type) {
  if (player.heldType === type) return;
  player.heldType = type;
  clearHeldItem();
  player.heldItem.position.set(0.58, 1.05, 0.34);
  player.heldItem.rotation.set(0, 0, 0);

  if (type === 'gun') {
    const gunMat = new MeshStandardMaterial({ color: 0x181820, roughness: 0.35, metalness: 0.6 });
    const barrel = new Mesh(new BoxGeometry(0.16, 0.14, 0.72), gunMat);
    barrel.position.set(0, 0.06, 0.22);
    const grip = new Mesh(new BoxGeometry(0.14, 0.34, 0.16), gunMat);
    grip.position.set(0, -0.15, -0.06);
    grip.rotation.x = -0.35;
    const sight = new Mesh(new BoxGeometry(0.12, 0.05, 0.2), new MeshBasicMaterial({ color: 0xff3030 }));
    sight.position.set(0, 0.16, 0.2);
    player.heldItem.add(barrel, grip, sight);
  } else if (type === 'object') {
    const box = new Mesh(
      new BoxGeometry(0.46, 0.34, 0.46),
      new MeshStandardMaterial({ color: 0x88c8ff, roughness: 0.55, metalness: 0.15 })
    );
    box.castShadow = true;
    player.heldItem.add(box);
  }
}

function damagePed(ped, amount, knockX, knockZ) {
  if (ped.downTimer > 0) return;
  ped.health -= amount;
  ped.hitTimer = 0.22;
  ped.group.position.x += knockX;
  ped.group.position.z += knockZ;
  ped.dir = Math.atan2(knockX, knockZ);
  if (ped.health <= 0) {
    ped.health = 100;
    ped.downTimer = 2.2;
    ped.group.rotation.z = Math.PI / 2;
  }
}

function knockPlayerByVehicle(knockX, knockZ, power = 1) {
  if (inVehicle || activeLocation) return;
  player.knockTimer = 0.75;
  player.knockVx = knockX * power;
  player.knockVz = knockZ * power;
  player.velocityY = Math.max(player.velocityY, 4.8 + power * 1.6);
  player.onGround = false;
  player.actionTimer = 0.34;
  player.group.rotation.z = Math.sign(knockX || 1) * 0.65;
  triggerLocationAlert('WANTED');
}

function hitNearbyPed() {
  const power = player.heldType === 'object' ? 32 : 24;
  const knock = player.heldType === 'object' ? 0.7 : 0.55;
  if (!applyHitToNearestTarget(2.2, 0.35, power, knock)) hitNearbySceneActor();
}

function updatePlayerActionPose(moving, sprint, dt) {
  player.actionTimer = Math.max(0, player.actionTimer - dt);
  const attackBlend = player.actionTimer > 0 ? Math.sin((player.actionTimer / 0.28) * Math.PI) : 0;
  const stride = Math.sin(player.walkPhase);
  const runScale = sprint ? 0.75 : 0.42;

  player.body.rotation.x = 0;
  player.head.rotation.x = 0;
  if (player.knockTimer <= 0) player.group.rotation.z = 0;
  player.leftLeg.rotation.x = moving && player.onGround ? stride * runScale : 0;
  player.rightLeg.rotation.x = moving && player.onGround ? -stride * runScale : 0;
  player.leftArm.rotation.x = moving ? -stride * runScale * 0.75 : 0.12;
  player.rightArm.rotation.x = moving ? stride * runScale * 0.75 : 0.12;
  player.leftArm.rotation.z = -0.08;
  player.rightArm.rotation.z = 0.08;

  if (!player.onGround) {
    player.leftLeg.rotation.x = 0.28;
    player.rightLeg.rotation.x = -0.28;
    player.leftArm.rotation.x = -0.35;
    player.rightArm.rotation.x = -0.35;
  }

  if (player.heldType === 'gun') {
    player.rightArm.rotation.x = -1.25 - attackBlend * 0.18;
    player.leftArm.rotation.x = -0.85;
    player.heldItem.position.set(0.5, 1.28, 0.58);
  } else if (player.heldType === 'object') {
    player.rightArm.rotation.x = -0.72 - attackBlend * 0.65;
    player.leftArm.rotation.x = -0.35;
    player.heldItem.position.set(0.58, 1.08 + attackBlend * 0.2, 0.32);
    player.heldItem.rotation.y += dt * 1.8;
  } else if (attackBlend > 0) {
    player.leftArm.rotation.x = 0.12;
    player.leftArm.rotation.z = -0.08;
    player.rightArm.rotation.x = -1.2 * attackBlend;
    player.rightArm.rotation.z = 0.08 + 0.42 * attackBlend;
  }
}

function updateBikeRiderPose(veh) {
  const yaw = veh.group.rotation.y;
  const lean = veh.group.rotation.z;
  const seatOffsetZ = -0.22;
  player.group.visible = true;
  player.group.position.set(
    veh.group.position.x + Math.sin(yaw) * seatOffsetZ,
    veh.group.position.y + 0.28,
    veh.group.position.z + Math.cos(yaw) * seatOffsetZ
  );
  player.group.rotation.y = yaw;
  player.group.rotation.z = lean * 0.55;
  player.yaw = yaw;

  player.body.position.y = 1.02;
  player.body.rotation.x = -0.24;
  player.head.rotation.x = 0.16;
  player.heldItem.visible = false;

  player.leftArm.rotation.set(-1.2, 0, -0.36);
  player.rightArm.rotation.set(-1.2, 0, 0.36);
  player.leftLeg.rotation.set(-0.95, 0, -0.28);
  player.rightLeg.rotation.set(-0.95, 0, 0.28);
}

// -------------------- UPDATE LOOPS --------------------
function updatePlayer(dt) {
  if (blackjackActive) {
    mouse.dx = 0;
    mouse.dy = 0;
    ePressedLast = false;
    return;
  }
  // Mouse look
  camYaw.v -= mouse.dx * 0.0025;
  camPitch.v += mouse.dy * 0.0025;
  camPitch.v = Math.max(-0.6, Math.min(0.7, camPitch.v));
  mouse.dx = 0; mouse.dy = 0;

  // Movement intent in camera-relative direction
  let mx = 0, mz = 0;
  if (keys['KeyW']) mz += 1;
  if (keys['KeyS']) mz -= 1;
  if (keys['KeyA']) mx += 1;
  if (keys['KeyD']) mx -= 1;
  let moving = mx !== 0 || mz !== 0;
  if (moving) {
    const len = Math.hypot(mx, mz);
    mx /= len; mz /= len;
  }
  const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
  const speed = sprint ? 8.5 : 4.2;

  if (keys['Digit1']) setHeldItem('gun');
  if (keys['Digit2']) setHeldItem('object');
  if (keys['Digit0']) setHeldItem('empty');
  if (keys['KeyE'] && !ePressedLast) {
    if (!tryBankVaultInteraction()) performPlayerAttack();
  }
  ePressedLast = !!keys['KeyE'];

  if (player.knockTimer > 0) {
    player.knockTimer -= dt;
    player.group.position.x += player.knockVx * dt;
    player.group.position.z += player.knockVz * dt;
    player.knockVx *= Math.max(0, 1 - dt * 3.2);
    player.knockVz *= Math.max(0, 1 - dt * 3.2);
    player.group.rotation.z *= Math.max(0, 1 - dt * 2.5);
    mx = 0;
    mz = 0;
    moving = false;
  }

  // Rotate intent by camera yaw
  const cosY = Math.cos(camYaw.v), sinY = Math.sin(camYaw.v);
  const wx = mx * cosY + mz * sinY;
  const wz = -mx * sinY + mz * cosY;

  let nx = player.group.position.x + wx * speed * dt;
  let nz = player.group.position.z + wz * speed * dt;
  [nx, nz] = resolveCollision(player.group.position.x, player.group.position.z, nx, nz, 0.5);
  player.group.position.x = nx;
  player.group.position.z = nz;

  // Face movement direction
  if (moving) {
    const target = Math.atan2(wx, wz);
    let diff = target - player.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.yaw += diff * Math.min(1, dt * 12);
    player.group.rotation.y = player.yaw;
  }

  // Jump + gravity
  if (player.onGround && keys['Space']) {
    player.velocityY = 6.5;
    player.onGround = false;
  }
  player.velocityY -= 18 * dt;
  player.group.position.y += player.velocityY * dt;
  if (player.group.position.y <= 0) {
    player.group.position.y = 0;
    player.velocityY = 0;
    player.onGround = true;
  }

  // Walk bob animation
  if (moving && player.onGround) {
    player.walkPhase += dt * speed * 1.4;
    player.body.position.y = 1.15 + Math.sin(player.walkPhase * 2) * 0.04;
  } else {
    player.body.position.y = 1.15;
  }
  updatePlayerActionPose(moving, sprint, dt);
}

function updateVehicle(dt, veh) {
  ensureVehicleDamageState(veh);
  // Acceleration / braking
  const throttle = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
  const isBike = veh.kind === 'bike';
  const isHeavy = veh.kind === 'truck' || veh.kind === 'policeVan';
  const isPickup = veh.kind === 'pickup';
  const damageLimit = Math.max(0.45, veh.health / 100);
  const maxBase = isBike ? (sprint ? 46 : 28) : (isHeavy ? (sprint ? 28 : 18) : (isPickup ? (sprint ? 34 : 22) : (sprint ? 38 : 22)));
  const maxSpeed = maxBase * damageLimit;
  const accel = isBike ? 18 : (isHeavy ? 9 : 14);
  const decel = isBike ? 7.5 : (isHeavy ? 4.5 : 6);
  if (throttle > 0) veh.velocity += accel * dt;
  else if (throttle < 0) veh.velocity -= accel * 0.7 * dt;
  else {
    // natural friction
    if (veh.velocity > 0) veh.velocity = Math.max(0, veh.velocity - decel * dt);
    else if (veh.velocity < 0) veh.velocity = Math.min(0, veh.velocity + decel * dt);
  }
  if (keys['Space']) {
    // Handbrake
    if (veh.velocity > 0) veh.velocity = Math.max(0, veh.velocity - 22 * dt);
    else veh.velocity = Math.min(0, veh.velocity + 22 * dt);
  }
  veh.velocity = Math.max(-maxSpeed / 2, Math.min(maxSpeed, veh.velocity));

  // Steering: A=left, D=right
  const steer = (keys['KeyA'] ? 1 : 0) - (keys['KeyD'] ? 1 : 0);
  const turnRate = isBike ? 2.8 : (isHeavy ? 1.25 : 1.8);
  // turning effectiveness depends on speed
  const speedFactor = Math.min(1, Math.abs(veh.velocity) / (isBike ? 4 : 6));
  veh.group.rotation.y += steer * turnRate * dt * speedFactor;
  if (isBike) {
    veh.group.rotation.z = -steer * Math.min(0.36, Math.abs(veh.velocity) * 0.014) * speedFactor;
  }

  // Move
  const dirX = Math.sin(veh.group.rotation.y);
  const dirZ = Math.cos(veh.group.rotation.y);
  let nx = veh.group.position.x + dirX * veh.velocity * dt;
  let nz = veh.group.position.z + dirZ * veh.velocity * dt;
  const before = [veh.group.position.x, veh.group.position.z];
  [nx, nz] = resolveCollision(before[0], before[1], nx, nz, isBike ? 0.8 : 1.4);
  // If we collided, kill speed
  if (Math.abs(nx - (before[0] + dirX * veh.velocity * dt)) > 0.01 ||
    Math.abs(nz - (before[1] + dirZ * veh.velocity * dt)) > 0.01) {
    damageVehicle(veh, Math.min(18, Math.abs(veh.velocity) * 0.8));
    veh.velocity *= 0.3;
  }
  veh.group.position.x = nx;
  veh.group.position.z = nz;

  // Spin wheels visually
  for (const w of veh.wheels) {
    w.rotation.x += veh.velocity * dt * 1.8;
  }
  if (isBike && Math.abs(steer) < 0.01) veh.group.rotation.z *= Math.max(0, 1 - dt * 6);
  if (isBike && veh.occupied) updateBikeRiderPose(veh);
  if (veh.smoke) {
    veh.smoke.visible = veh.health < 45;
    veh.smoke.rotation.y += dt * 1.5;
  }
}
