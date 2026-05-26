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
  if (e.button === 0 && hud.classList.contains('active') && !inVehicle) setInputKey('keyboard', 'KeyE', true);
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
  if (!hud.classList.contains('active') || e.pointerType === 'mouse') return;
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
  if (!hud.classList.contains('active')) return;
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
    if (!hud.classList.contains('active')) return;
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

function setMobileControlMode(driving, canEnterVehicle, canHijackVehicle = false) {
  if (!mobileRunBtn || !mobileJumpBtn || !mobileCarBtn) return;
  mobileRunBtn.textContent = driving ? 'BOOST' : 'RUN';
  mobileJumpBtn.textContent = driving ? 'BRAKE' : 'JUMP';
  mobileCarBtn.textContent = driving ? 'EXIT' : (canEnterVehicle ? 'ENTER' : (canHijackVehicle ? 'HIJACK' : 'CAR'));
  mobileCarBtn.classList.toggle('ready', driving || canEnterVehicle || canHijackVehicle);
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
let distanceTraveled = 0;
let lastPos = new Vector3();

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

// -------------------- PLAYER ACTIONS --------------------
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

function hitNearbyPed() {
  const attackRange = player.heldType === 'gun' ? 9 : 2.2;
  const attackArc = player.heldType === 'gun' ? 0.55 : 0.35;
  let target = null;
  let best = attackRange;
  const px = player.group.position.x;
  const pz = player.group.position.z;
  const fx = Math.sin(player.yaw);
  const fz = Math.cos(player.yaw);

  for (const ped of peds) {
    if (ped.downTimer > 0) continue;
    const dx = ped.group.position.x - px;
    const dz = ped.group.position.z - pz;
    const dist = Math.hypot(dx, dz);
    if (dist > best || dist < 0.001) continue;
    const dot = (dx / dist) * fx + (dz / dist) * fz;
    if (dot < attackArc) continue;
    best = dist;
    target = ped;
  }

  if (!target) return;
  const dx = target.group.position.x - px;
  const dz = target.group.position.z - pz;
  const dist = Math.max(0.001, Math.hypot(dx, dz));
  const power = player.heldType === 'gun' ? 38 : (player.heldType === 'object' ? 32 : 24);
  const knock = player.heldType === 'gun' ? 1.1 : 0.55;
  damagePed(target, power, dx / dist * knock, dz / dist * knock);
}

function updatePlayerActionPose(moving, sprint, dt) {
  player.actionTimer = Math.max(0, player.actionTimer - dt);
  const attackBlend = player.actionTimer > 0 ? Math.sin((player.actionTimer / 0.28) * Math.PI) : 0;
  const stride = Math.sin(player.walkPhase);
  const runScale = sprint ? 0.75 : 0.42;

  player.body.rotation.x = 0;
  player.head.rotation.x = 0;
  player.group.rotation.z = 0;
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
  // Mouse look
  camYaw.v -= mouse.dx * 0.0025;
  camPitch.v -= mouse.dy * 0.0025;
  camPitch.v = Math.max(-0.6, Math.min(0.7, camPitch.v));
  mouse.dx = 0; mouse.dy = 0;

  // Movement intent in camera-relative direction
  let mx = 0, mz = 0;
  if (keys['KeyW']) mz += 1;
  if (keys['KeyS']) mz -= 1;
  if (keys['KeyA']) mx += 1;
  if (keys['KeyD']) mx -= 1;
  const moving = mx !== 0 || mz !== 0;
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
    player.actionTimer = 0.28;
    hitNearbyPed();
  }
  ePressedLast = !!keys['KeyE'];

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
    while (diff > Math.PI) diff -= Math.PI*2;
    while (diff < -Math.PI) diff += Math.PI*2;
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
  // Acceleration / braking
  const throttle = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
  const isBike = veh.kind === 'bike';
  const maxSpeed = isBike ? (sprint ? 46 : 28) : (sprint ? 38 : 22);
  const accel = isBike ? 18 : 14;
  const decel = isBike ? 7.5 : 6;
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
  veh.velocity = Math.max(-maxSpeed/2, Math.min(maxSpeed, veh.velocity));

  // Steering: A=left, D=right
  const steer = (keys['KeyA'] ? 1 : 0) - (keys['KeyD'] ? 1 : 0);
  const turnRate = isBike ? 2.8 : 1.8;
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
}
