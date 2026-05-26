// -------------------- SIMULATION / HUD / MAIN LOOP --------------------
const clock = new THREE.Clock();

function updateAITraffic(dt) {
  for (const c of aiCars) {
    if (c.ignorePlayerTimer > 0) c.ignorePlayerTimer -= dt;

    const playerBlocking = !inVehicle && isPlayerBlockingTraffic(c);
    if (playerBlocking && c.ignorePlayerTimer <= 0) {
      if (!c.yieldTimer) c.yieldTimer = 2.4;
      c.yieldTimer -= dt;
      if (c.yieldTimer <= 0) {
        c.yieldTimer = 0;
        c.ignorePlayerTimer = 2.8;
      }
    } else if (!playerBlocking) {
      c.yieldTimer = 0;
    }

    const moveSpeed = c.yieldTimer > 0 ? 0 : c.speed;
    if (c.horizontal) {
      c.group.position.x += c.direction * -1 * moveSpeed * dt; // -direction matches initial rotation
      // wrap
      if (c.group.position.x > HALF + 10) c.group.position.x = -HALF - 10;
      if (c.group.position.x < -HALF - 10) c.group.position.x = HALF + 10;
    } else {
      c.group.position.z += c.direction * moveSpeed * dt;
      if (c.group.position.z > HALF + 10) c.group.position.z = -HALF - 10;
      if (c.group.position.z < -HALF - 10) c.group.position.z = HALF + 10;
    }
    for (const w of c.wheels) w.rotation.x += moveSpeed * dt * 1.8;
  }
}

function isPlayerBlockingTraffic(car) {
  const px = player.group.position.x;
  const pz = player.group.position.z;
  if (car.horizontal) {
    const moveDir = car.direction * -1;
    const ahead = (px - car.group.position.x) * moveDir;
    return ahead > 0 && ahead < 11 && Math.abs(pz - car.group.position.z) < 2.6;
  }
  const ahead = (pz - car.group.position.z) * car.direction;
  return ahead > 0 && ahead < 11 && Math.abs(px - car.group.position.x) < 2.6;
}

function updatePeds(dt) {
  for (const p of peds) {
    if (p.hitTimer > 0) p.hitTimer -= dt;
    p.hitFlash.visible = p.hitTimer > 0;

    if (p.downTimer > 0) {
      p.downTimer -= dt;
      p.leftLeg.rotation.x = -0.25;
      p.rightLeg.rotation.x = 0.25;
      p.leftArm.rotation.x = 0.35;
      p.rightArm.rotation.x = -0.35;
      if (p.downTimer <= 0) {
        p.group.rotation.z = 0;
        p.health = 100;
      }
      continue;
    }

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
    p.leftLeg.rotation.x = Math.sin(p.walkPhase) * 0.45;
    p.rightLeg.rotation.x = -Math.sin(p.walkPhase) * 0.45;
    p.leftArm.rotation.x = -Math.sin(p.walkPhase) * 0.35;
    p.rightArm.rotation.x = Math.sin(p.walkPhase) * 0.35;
    p.body.position.y = 1.1 + Math.abs(Math.sin(p.walkPhase)) * 0.03;
  }
}

function updateCitySceneActors(dt) {
  for (const actor of citySceneActors) {
    if (actor.hitTimer > 0) actor.hitTimer -= dt;
    actor.phase += dt * (actor.mode === 'dance' ? 6 : 2.2);
    const swing = Math.sin(actor.phase);
    actor.leftLeg.rotation.x = swing * (actor.mode === 'dance' ? 0.7 : 0.18);
    actor.rightLeg.rotation.x = -actor.leftLeg.rotation.x;
    actor.leftArm.rotation.x = -swing * (actor.mode === 'dance' ? 0.85 : 0.2);
    actor.rightArm.rotation.x = -actor.leftArm.rotation.x;
    actor.body.position.y = 1.05 + Math.abs(swing) * (actor.mode === 'dance' ? 0.1 : 0.025);
    actor.body.scale.setScalar(actor.hitTimer > 0 ? 1.18 : 1);
    if (actor.mode === 'dance') actor.group.rotation.y += dt * 0.9;
    if (actor.mode === 'guard') actor.group.rotation.y += Math.sin(actor.phase * 0.35) * dt * 0.25;
  }
}

function updateLocationAlert(dt) {
  if (bankAlarm) {
    bankAlarmTimer -= dt;
    const bank = getLocationById('bank');
    if (bank && bank.alarmLight) bank.alarmLight.intensity = Math.sin(frame * 0.45) > 0 ? 3.2 : 0.2;
    if (bankAlarmTimer <= 0) bankAlarm = false;
  } else {
    const bank = getLocationById('bank');
    if (bank && bank.alarmLight) bank.alarmLight.intensity = 0;
  }
}

function updateLocationEffects(dt) {
  for (const loc of cityLocations) {
    if (loc.type === 'bar' && loc.danceFloor) {
      const glow = 0.35 + Math.abs(Math.sin(frame * 0.08)) * 0.85;
      loc.danceFloor.material.emissiveIntensity = glow;
      loc.danceFloor.rotation.y += dt * 0.35;
      if (loc.effectLights) {
        loc.effectLights[0].intensity = 1.2 + Math.abs(Math.sin(frame * 0.1)) * 2.2;
        loc.effectLights[1].intensity = 1.2 + Math.abs(Math.cos(frame * 0.12)) * 2.2;
      }
    }
  }
}

function updateCamera(dt) {
  let targetX, targetY, targetZ, lookX, lookY, lookZ;
  if (inVehicle) {
    const v = inVehicle;
    // Camera follow vehicle
    const dist = v.kind === 'bike' ? 7 : 9;
    const height = v.kind === 'bike' ? 3.4 : 4.5;
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
  if (nearestServiceLocation && useServiceLocation(nearestServiceLocation)) {
    return;
  } else if (nearestMissionStart) {
    startMission(nearestMissionStart);
  } else if (activeLocation) {
    exitLocation();
  } else if (!inVehicle && nearestLocation) {
    enterLocation(nearestLocation);
  } else if (inVehicle) {
    // Exit
    const v = inVehicle;
    const exitOff = v.kind === 'bike' ? 1.5 : 2.2;
    const ex = v.group.position.x - Math.cos(v.group.rotation.y) * 0.5 + Math.sin(v.group.rotation.y + Math.PI/2) * exitOff;
    const ez = v.group.position.z - Math.sin(v.group.rotation.y) * 0.5 + Math.cos(v.group.rotation.y + Math.PI/2) * exitOff;
    player.group.visible = true;
    player.group.position.set(ex, 0, ez);
    player.yaw = v.group.rotation.y;
    player.group.rotation.y = player.yaw;
    player.group.rotation.z = 0;
    player.body.rotation.x = 0;
    player.head.rotation.x = 0;
    player.leftArm.rotation.set(0, 0, 0);
    player.rightArm.rotation.set(0, 0, 0);
    player.leftLeg.rotation.set(0, 0, 0);
    player.rightLeg.rotation.set(0, 0, 0);
    player.heldItem.visible = true;
    v.occupied = false;
    inVehicle = null;
    v.group.rotation.z = 0;
    document.getElementById('mode').textContent = wantedLevel > 0 ? 'WANTED' : 'ON FOOT';
    document.getElementById('speedo').classList.remove('show');
  } else if (nearestVehicle || nearestTrafficVehicle) {
    inVehicle = nearestVehicle || hijackTrafficVehicle(nearestTrafficVehicle);
    inVehicle.occupied = true;
    player.group.visible = inVehicle.kind === 'bike';
    player.heldItem.visible = inVehicle.kind !== 'bike';
    document.getElementById('mode').textContent = inVehicle.kind === 'bike' ? 'RIDING' : 'DRIVING';
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

function findNearestTrafficVehicle() {
  let nearest = null, best = 4.8;
  for (const v of aiCars) {
    const dx = v.group.position.x - player.group.position.x;
    const dz = v.group.position.z - player.group.position.z;
    const d = Math.hypot(dx, dz);
    if (d < best) { best = d; nearest = v; }
  }
  return nearest;
}

function hijackTrafficVehicle(car) {
  const idx = aiCars.indexOf(car);
  if (idx !== -1) aiCars.splice(idx, 1);
  car.isAI = false;
  car.kind = car.kind || 'car';
  car.occupied = false;
  car.velocity = car.speed || 10;
  car.angularVelocity = 0;
  vehicles.push(car);
  nearestTrafficVehicle = null;
  nearestVehicle = car;
  return car;
}

// -------------------- MINIMAP --------------------
const mmCanvas = document.getElementById('minimap');
const mmCtx = mmCanvas.getContext('2d');
const mmSize = 200;
const mmScale = mmSize / (GRID * BLOCK + 30);
const minimapWorldPos = new Vector3();
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
    b.getWorldPosition(minimapWorldPos);
    const [x, y] = w2m(minimapWorldPos.x, minimapWorldPos.z);
    if (x < -10 || x > mmSize+10 || y < -10 || y > mmSize+10) continue;
    const w = b.geometry.parameters.width * mmScale;
    const d = b.geometry.parameters.depth * mmScale;
    mmCtx.fillRect(x - w/2, y - d/2, w, d);
  }
  // Vehicles
  for (const v of vehicles) {
    if (v === inVehicle) continue;
    const [x, y] = w2m(v.group.position.x, v.group.position.z);
    mmCtx.fillStyle = v.kind === 'bike' ? '#ffd200' : '#88c8ff';
    if (v.kind === 'bike') {
      mmCtx.beginPath();
      mmCtx.arc(x, y, 2.5, 0, Math.PI * 2);
      mmCtx.fill();
    } else {
      mmCtx.fillRect(x-2, y-2, 4, 4);
    }
  }
  // AI cars
  mmCtx.fillStyle = '#ff7030';
  for (const v of aiCars) {
    const [x, y] = w2m(v.group.position.x, v.group.position.z);
    mmCtx.fillRect(x-1.5, y-1.5, 3, 3);
  }
  // City location markers
  mmCtx.font = 'bold 8px IBM Plex Mono';
  mmCtx.textAlign = 'center';
  mmCtx.textBaseline = 'middle';
  for (const loc of cityLocations) {
    const [x, y] = w2m(loc.entrance.x, loc.entrance.z);
    if (x < -12 || x > mmSize+12 || y < -12 || y > mmSize+12) continue;
    mmCtx.fillStyle = loc.mapColor;
    mmCtx.beginPath();
    mmCtx.moveTo(x, y - 5);
    mmCtx.lineTo(x + 5, y);
    mmCtx.lineTo(x, y + 5);
    mmCtx.lineTo(x - 5, y);
    mmCtx.closePath();
    mmCtx.fill();
    mmCtx.fillStyle = '#101018';
    mmCtx.fillText(loc.label[0], x, y + 0.5);
  }
  drawMissionMarker(w2m);
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

function drawMissionMarker(w2m) {
  if (!missionTarget || !activeMission || activeMission.status !== 'active') return;
  const [x, y] = w2m(missionTarget.entrance.x, missionTarget.entrance.z);
  if (x < -18 || x > mmSize + 18 || y < -18 || y > mmSize + 18) return;
  mmCtx.save();
  mmCtx.translate(x, y);
  mmCtx.rotate(frame * 0.06);
  mmCtx.strokeStyle = '#ffd200';
  mmCtx.lineWidth = 2;
  mmCtx.beginPath();
  mmCtx.moveTo(0, -9);
  mmCtx.lineTo(9, 0);
  mmCtx.lineTo(0, 9);
  mmCtx.lineTo(-9, 0);
  mmCtx.closePath();
  mmCtx.stroke();
  mmCtx.restore();
}

// -------------------- MAIN LOOP --------------------
const promptEl = document.getElementById('prompt');
const kmhEl = document.getElementById('kmh');
const gearEl = document.getElementById('gear');
const distEl = document.getElementById('dist');
const vnearEl = document.getElementById('vnear');
const locationBadgeEl = document.getElementById('locationBadge');
const objectivePanelEl = document.getElementById('objectivePanel');
const objectiveTitleEl = document.getElementById('objectiveTitle');
const objectiveTextEl = document.getElementById('objectiveText');
const objectiveTimerEl = document.getElementById('objectiveTimer');
const objectiveWantedEl = document.getElementById('objectiveWanted');
let frame = 0;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  frame++;

  if (inVehicle) {
    updateVehicle(dt, inVehicle);
    nearestServiceLocation = findNearestServiceLocation();
    nearestMissionStart = null;
  } else {
    updatePlayer(dt);
    nearestVehicle = findNearestVehicle();
    nearestLocation = findNearestLocation();
    nearestMissionStart = findMissionStart();
    nearestServiceLocation = findNearestServiceLocation();
    nearestTrafficVehicle = nearestVehicle || nearestLocation ? null : findNearestTrafficVehicle();
  }
  updateAITraffic(dt);
  updatePeds(dt);
  updateCitySceneActors(dt);
  updateLocationAlert(dt);
  updateLocationEffects(dt);
  updateMission(dt);
  updatePoliceChase(dt);
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
  if (locationBadgeEl) {
    const locLabel = activeLocation ? activeLocation.label : (nearestLocation ? nearestLocation.label : '');
    locationBadgeEl.textContent = wantedLevel > 0 ? `WANTED LEVEL ${wantedLevel}` : locLabel;
    locationBadgeEl.classList.toggle('show', wantedLevel > 0 || !!locLabel);
    locationBadgeEl.classList.toggle('alert', wantedLevel > 0);
  }
  if (objectivePanelEl) {
    const showObjective = !!activeMission || wantedLevel > 0 || bankAlarm || (inVehicle && inVehicle.health < 100);
    objectivePanelEl.classList.toggle('show', showObjective);
    objectivePanelEl.classList.toggle('alert', wantedLevel > 0 || bankAlarm);
    objectiveTitleEl.textContent = activeMission ? activeMission.name : (wantedLevel > 0 ? 'Wanted' : 'Vehicle Status');
    objectiveTextEl.textContent = activeMission ? activeMission.statusText : (wantedLevel > 0 ? 'Reach GAS or GARAGE to lose heat.' : `Vehicle health ${Math.round(inVehicle ? inVehicle.health : 100)}%`);
    objectiveTimerEl.textContent = activeMission && activeMission.status === 'active' ? `${Math.ceil(missionTimer)}s` : '';
    objectiveWantedEl.textContent = wantedLevel > 0 ? `WANTED ${wantedLevel}` : '';
  }
  // Count nearby vehicles
  let count = 0;
  for (const v of vehicles) {
    if (v === inVehicle) continue;
    if (ref.distanceTo(v.group.position) < 20) count++;
  }
  vnearEl.textContent = count;

  // Prompt
  promptEl.classList.toggle('vehicle-mode', !!inVehicle || !!activeLocation);
  if (nearestServiceLocation && inVehicle && nearestServiceLocation.type === 'garage') {
    promptEl.classList.add('show');
    promptEl.innerHTML = '<kbd>F</kbd>REPAIR / REPAINT';
  }
  else if (nearestServiceLocation && inVehicle && nearestServiceLocation.type === 'gas') {
    promptEl.classList.add('show');
    promptEl.innerHTML = '<kbd>F</kbd>REFUEL / PATCH';
  }
  else if (nearestServiceLocation && !inVehicle && nearestServiceLocation.type === 'shop') {
    promptEl.classList.add('show');
    promptEl.innerHTML = '<kbd>F</kbd>SHOP ITEM';
  }
  else if (nearestMissionStart) {
    promptEl.classList.add('show');
    promptEl.innerHTML = '<kbd>F</kbd>START MISSION';
  }
  else if (activeLocation) {
    promptEl.classList.add('show');
    promptEl.innerHTML = '<kbd>F</kbd>EXIT TO STREET';
  }
  else if (!inVehicle && nearestLocation) {
    promptEl.classList.add('show');
    promptEl.innerHTML = `<kbd>F</kbd>${nearestLocation.prompt}`;
  }
  else if (!inVehicle && (nearestVehicle || nearestTrafficVehicle)) {
    promptEl.classList.add('show');
    promptEl.innerHTML = nearestTrafficVehicle ? '<kbd>F</kbd>HIJACK VEHICLE' : '<kbd>F</kbd>ENTER VEHICLE';
  }
  else if (inVehicle) {
    promptEl.classList.add('show');
    promptEl.innerHTML = '<kbd>F</kbd>EXIT VEHICLE';
  }
  else promptEl.classList.remove('show');
  const useLabel = nearestServiceLocation ? 'USE' : (nearestMissionStart ? 'START' : (activeLocation ? 'EXIT' : 'ENTER'));
  setMobileControlMode(!!inVehicle, !!nearestVehicle, !!nearestTrafficVehicle, !!(activeLocation || nearestLocation || nearestMissionStart || nearestServiceLocation), useLabel);

  renderer.render(scene, camera);
}
lastPos.copy(player.group.position);
loop();
