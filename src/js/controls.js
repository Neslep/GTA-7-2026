// -------------------- INPUT --------------------
const keys = {};
const mouse = { x: 0, y: 0, dx: 0, dy: 0, locked: false };

addEventListener('keydown', e => { keys[e.code] = true; });
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('mousemove', e => {
  if (mouse.locked) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
});

const playBtn = document.getElementById('playBtn');
const intro = document.getElementById('intro');
const hud = document.getElementById('hud');

playBtn.addEventListener('click', () => {
  intro.style.opacity = '0';
  setTimeout(() => intro.style.display = 'none', 800);
  hud.classList.add('active');
  renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  mouse.locked = document.pointerLockElement === renderer.domElement;
});
renderer.domElement.addEventListener('click', () => {
  if (!mouse.locked && hud.classList.contains('active')) renderer.domElement.requestPointerLock();
});

let fPressedLast = false;

// -------------------- CAMERA ORBIT STATE --------------------
const camYaw = { v: 0 };
const camPitch = { v: 0.15 };

// -------------------- GAME STATE --------------------
let inVehicle = null;       // reference to vehicle object when driving
let nearestVehicle = null;  // for prompt
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
    player.legs.rotation.x = Math.sin(player.walkPhase) * 0.4;
  } else {
    player.body.position.y = 1.15;
    player.legs.rotation.x *= 0.85;
  }
}

function updateVehicle(dt, veh) {
  // Acceleration / braking
  const throttle = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
  const maxSpeed = sprint ? 38 : 22;
  const accel = 14;
  const decel = 6;
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
  const turnRate = 1.8;
  // turning effectiveness depends on speed
  const speedFactor = Math.min(1, Math.abs(veh.velocity) / 6);
  veh.group.rotation.y += steer * turnRate * dt * speedFactor;

  // Move
  const dirX = Math.sin(veh.group.rotation.y);
  const dirZ = Math.cos(veh.group.rotation.y);
  let nx = veh.group.position.x + dirX * veh.velocity * dt;
  let nz = veh.group.position.z + dirZ * veh.velocity * dt;
  const before = [veh.group.position.x, veh.group.position.z];
  [nx, nz] = resolveCollision(before[0], before[1], nx, nz, 1.4);
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
}
