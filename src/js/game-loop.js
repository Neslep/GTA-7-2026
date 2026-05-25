// -------------------- SIMULATION / HUD / MAIN LOOP --------------------
const clock = new THREE.Clock();

function updateAITraffic(dt) {
  for (const c of aiCars) {
    if (c.horizontal) {
      c.group.position.x += c.direction * -1 * c.speed * dt; // -direction matches initial rotation
      // wrap
      if (c.group.position.x > HALF + 10) c.group.position.x = -HALF - 10;
      if (c.group.position.x < -HALF - 10) c.group.position.x = HALF + 10;
    } else {
      c.group.position.z += c.direction * c.speed * dt;
      if (c.group.position.z > HALF + 10) c.group.position.z = -HALF - 10;
      if (c.group.position.z < -HALF - 10) c.group.position.z = HALF + 10;
    }
    for (const w of c.wheels) w.rotation.x += c.speed * dt * 1.8;
  }
}

function updatePeds(dt) {
  for (const p of peds) {
    p.turnTimer -= dt;
    if (p.turnTimer <= 0) {
      p.turnTimer = 2 + Math.random()*4;
      p.dir += (Math.random() - 0.5) * Math.PI;
    }
    const nx = p.group.position.x + Math.sin(p.dir) * p.speed * dt;
    const nz = p.group.position.z + Math.cos(p.dir) * p.speed * dt;
    if (collidesAt(nx, nz, 0.4) || Math.abs(nx) > HALF - 2 || Math.abs(nz) > HALF - 2) {
      p.dir += Math.PI;
    } else {
      p.group.position.x = nx;
      p.group.position.z = nz;
    }
    p.group.rotation.y = p.dir;
    // walk bob
    p.walkPhase += dt * p.speed * 2;
    p.legs.rotation.x = Math.sin(p.walkPhase) * 0.5;
    p.body.position.y = 1.1 + Math.abs(Math.sin(p.walkPhase)) * 0.03;
  }
}

function updateCamera(dt) {
  let targetX, targetY, targetZ, lookX, lookY, lookZ;
  if (inVehicle) {
    const v = inVehicle;
    // Camera follow vehicle
    const dist = 9, height = 4.5;
    // free orbit yaw added to vehicle yaw
    const camDirY = v.group.rotation.y + camYaw.v;
    targetX = v.group.position.x - Math.sin(camDirY) * dist;
    targetZ = v.group.position.z - Math.cos(camDirY) * dist;
    targetY = v.group.position.y + height + camPitch.v * 4;
    lookX = v.group.position.x;
    lookY = v.group.position.y + 1.5;
    lookZ = v.group.position.z;
  } else {
    // Camera follow player
    const dist = 5, height = 2.2;
    targetX = player.group.position.x - Math.sin(camYaw.v) * dist;
    targetZ = player.group.position.z - Math.cos(camYaw.v) * dist;
    targetY = player.group.position.y + height + camPitch.v * 3;
    lookX = player.group.position.x;
    lookY = player.group.position.y + 1.4;
    lookZ = player.group.position.z;
  }
  // Smooth lerp
  camera.position.x += (targetX - camera.position.x) * Math.min(1, dt * 8);
  camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 8);
  camera.position.z += (targetZ - camera.position.z) * Math.min(1, dt * 8);
  camera.lookAt(lookX, lookY, lookZ);
}

// -------------------- VEHICLE ENTRY / EXIT --------------------
function tryEnterExit() {
  if (inVehicle) {
    // Exit
    const v = inVehicle;
    const exitOff = 2.2;
    const ex = v.group.position.x - Math.cos(v.group.rotation.y) * 0.5 + Math.sin(v.group.rotation.y + Math.PI/2) * exitOff;
    const ez = v.group.position.z - Math.sin(v.group.rotation.y) * 0.5 + Math.cos(v.group.rotation.y + Math.PI/2) * exitOff;
    player.group.visible = true;
    player.group.position.set(ex, 0, ez);
    player.yaw = v.group.rotation.y;
    player.group.rotation.y = player.yaw;
    v.occupied = false;
    inVehicle = null;
    document.getElementById('mode').textContent = 'ON FOOT';
    document.getElementById('speedo').classList.remove('show');
  } else if (nearestVehicle) {
    inVehicle = nearestVehicle;
    inVehicle.occupied = true;
    player.group.visible = false;
    document.getElementById('mode').textContent = 'DRIVING';
    document.getElementById('speedo').classList.add('show');
    // Reset cam yaw relative to vehicle
    camYaw.v = 0;
  }
}

function findNearestVehicle() {
  let nearest = null, best = 4.5;
  for (const v of vehicles) {
    if (v.occupied) continue;
    const dx = v.group.position.x - player.group.position.x;
    const dz = v.group.position.z - player.group.position.z;
    const d = Math.hypot(dx, dz);
    if (d < best) { best = d; nearest = v; }
  }
  return nearest;
}

// -------------------- MINIMAP --------------------
const mmCanvas = document.getElementById('minimap');
const mmCtx = mmCanvas.getContext('2d');
const mmSize = 200;
const mmScale = mmSize / (GRID * BLOCK + 30);
function drawMinimap() {
  mmCtx.clearRect(0, 0, mmSize, mmSize);
  // BG
  mmCtx.fillStyle = '#181826';
  mmCtx.fillRect(0, 0, mmSize, mmSize);

  const playerRef = inVehicle ? inVehicle.group : player.group;
  const px = playerRef.position.x;
  const pz = playerRef.position.z;

  function w2m(x, z) {
    return [
      (x - px) * mmScale + mmSize/2,
      (z - pz) * mmScale + mmSize/2,
    ];
  }

  // Roads
  mmCtx.strokeStyle = '#3a3a4a';
  mmCtx.lineWidth = ROAD * mmScale;
  for (let i = 0; i <= GRID; i++) {
    const pos = -HALF + i * BLOCK;
    let [x1, y1] = w2m(-HALF, pos);
    let [x2, y2] = w2m(HALF, pos);
    mmCtx.beginPath(); mmCtx.moveTo(x1, y1); mmCtx.lineTo(x2, y2); mmCtx.stroke();
    [x1, y1] = w2m(pos, -HALF);
    [x2, y2] = w2m(pos, HALF);
    mmCtx.beginPath(); mmCtx.moveTo(x1, y1); mmCtx.lineTo(x2, y2); mmCtx.stroke();
  }
  // Buildings (subset)
  mmCtx.fillStyle = '#4a4a5a';
  for (const b of buildingMeshes) {
    const [x, y] = w2m(b.position.x, b.position.z);
    if (x < -10 || x > mmSize+10 || y < -10 || y > mmSize+10) continue;
    const w = b.geometry.parameters.width * mmScale;
    const d = b.geometry.parameters.depth * mmScale;
    mmCtx.fillRect(x - w/2, y - d/2, w, d);
  }
  // Vehicles
  for (const v of vehicles) {
    if (v === inVehicle) continue;
    const [x, y] = w2m(v.group.position.x, v.group.position.z);
    mmCtx.fillStyle = '#88c8ff';
    mmCtx.fillRect(x-2, y-2, 4, 4);
  }
  // AI cars
  mmCtx.fillStyle = '#ff7030';
  for (const v of aiCars) {
    const [x, y] = w2m(v.group.position.x, v.group.position.z);
    mmCtx.fillRect(x-1.5, y-1.5, 3, 3);
  }
  // Player (always center)
  mmCtx.save();
  mmCtx.translate(mmSize/2, mmSize/2);
  mmCtx.rotate(-(inVehicle ? inVehicle.group.rotation.y : player.yaw));
  mmCtx.fillStyle = '#ffd200';
  mmCtx.beginPath();
  mmCtx.moveTo(0, -7);
  mmCtx.lineTo(5, 5);
  mmCtx.lineTo(-5, 5);
  mmCtx.closePath();
  mmCtx.fill();
  mmCtx.restore();
  // North indicator
  mmCtx.fillStyle = '#ffd200';
  mmCtx.font = 'bold 10px IBM Plex Mono';
  mmCtx.fillText('N', mmSize - 16, 16);
}

// -------------------- MAIN LOOP --------------------
const promptEl = document.getElementById('prompt');
const kmhEl = document.getElementById('kmh');
const gearEl = document.getElementById('gear');
const distEl = document.getElementById('dist');
const vnearEl = document.getElementById('vnear');
let frame = 0;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  frame++;

  if (inVehicle) {
    updateVehicle(dt, inVehicle);
  } else {
    updatePlayer(dt);
    nearestVehicle = findNearestVehicle();
  }
  updateAITraffic(dt);
  updatePeds(dt);
  updateCamera(dt);

  // F press
  if (keys['KeyF'] && !fPressedLast) tryEnterExit();
  fPressedLast = !!keys['KeyF'];

  // Track distance
  const ref = inVehicle ? inVehicle.group.position : player.group.position;
  const dd = ref.distanceTo(lastPos);
  if (dd < 5) distanceTraveled += dd; // ignore teleports
  lastPos.copy(ref);

  // HUD
  if (frame % 2 === 0) drawMinimap();
  if (inVehicle) {
    kmhEl.textContent = Math.round(Math.abs(inVehicle.velocity) * 3.6);
    gearEl.textContent = inVehicle.velocity < -0.5 ? 'R' : 'D';
  }
  distEl.textContent = Math.floor(distanceTraveled);
  // Count nearby vehicles
  let count = 0;
  for (const v of vehicles) {
    if (v === inVehicle) continue;
    if (ref.distanceTo(v.group.position) < 20) count++;
  }
  vnearEl.textContent = count;

  // Prompt
  if (!inVehicle && nearestVehicle) promptEl.classList.add('show');
  else if (inVehicle) {
    promptEl.classList.add('show');
    promptEl.innerHTML = '<kbd>F</kbd>EXIT VEHICLE';
  }
  else promptEl.classList.remove('show');
  if (!inVehicle) promptEl.innerHTML = '<kbd>F</kbd>ENTER VEHICLE';
  setMobileControlMode(!!inVehicle, !!nearestVehicle);

  renderer.render(scene, camera);
}
lastPos.copy(player.group.position);
loop();
