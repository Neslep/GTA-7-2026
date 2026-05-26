// -------------------- SIMULATION / HUD / MAIN LOOP --------------------
const clock = new THREE.Clock();

function updateAITraffic(dt) {
  for (const c of aiCars) {
    const blocker = getTrafficBlocker(c);
    if (blocker) c.blockedTimer = (c.blockedTimer || 0) + dt;
    else c.blockedTimer = 0;

    const waiting = blocker && c.blockedTimer < 1.15;
    c.brakeBlend = MathUtils.clamp((c.brakeBlend || 0) + (waiting ? dt * 8 : -dt * 4), 0, 1);
    const moveSpeed = c.speed * (1 - c.brakeBlend);
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
    if (!waiting && moveSpeed > 2) ramCharactersWithVehicle(c, moveSpeed);
  }
}

function isPointBlockingTraffic(car, px, pz, lookAhead = 13, laneWidth = 3.1) {
  if (car.horizontal) {
    const moveDir = car.direction * -1;
    const ahead = (px - car.group.position.x) * moveDir;
    return ahead > 0 && ahead < lookAhead && Math.abs(pz - car.group.position.z) < laneWidth;
  }
  const ahead = (pz - car.group.position.z) * car.direction;
  return ahead > 0 && ahead < lookAhead && Math.abs(px - car.group.position.x) < laneWidth;
}

function getTrafficBlocker(car) {
  if (!inVehicle && !hijackState && isPointBlockingTraffic(car, player.group.position.x, player.group.position.z)) return { type: 'player', ref: player };
  for (const ped of peds) {
    if (ped.downTimer > 0) continue;
    if (isPointBlockingTraffic(car, ped.group.position.x, ped.group.position.z, 10, 2.7)) return { type: 'ped', ref: ped };
  }
  return null;
}

function ramCharactersWithVehicle(car, speed) {
  const dirX = car.horizontal ? car.direction * -1 : 0;
  const dirZ = car.horizontal ? 0 : car.direction;
  const hitPower = MathUtils.clamp(speed / 10, 0.8, 2.4);

  if (!inVehicle && !hijackState) {
    const dx = player.group.position.x - car.group.position.x;
    const dz = player.group.position.z - car.group.position.z;
    if (Math.hypot(dx, dz) < 2.25) {
      knockPlayerByVehicle(dirX * 7.5, dirZ * 7.5, hitPower);
      spawnSparkBurst(player.group.position.x, 0.75, player.group.position.z, 0.7);
      cullTrafficBlockerWait(car);
    }
  }

  for (const ped of peds) {
    if (ped.downTimer > 0) continue;
    const dx = ped.group.position.x - car.group.position.x;
    const dz = ped.group.position.z - car.group.position.z;
    if (Math.hypot(dx, dz) > 2.15) continue;
    damagePed(ped, 60, dirX * 1.8 * hitPower, dirZ * 1.8 * hitPower);
    ped.knockTimer = 0.72;
    ped.knockVx = dirX * 8.5 * hitPower;
    ped.knockVz = dirZ * 8.5 * hitPower;
    ped.knockVY = 5 * hitPower;
    ped.downTimer = Math.max(ped.downTimer, 2.1);
    ped.group.rotation.z = Math.PI / 2;
    spawnSparkBurst(ped.group.position.x, 0.7, ped.group.position.z, 0.65);
    cullTrafficBlockerWait(car);
  }
}

function cullTrafficBlockerWait(car) {
  car.blockedTimer = 0;
  car.brakeBlend = Math.min(car.brakeBlend || 0, 0.25);
}

function updatePeds(dt) {
  for (const p of peds) {
    if (p.hitTimer > 0) p.hitTimer -= dt;
    p.hitFlash.visible = p.hitTimer > 0;

    if (p.knockTimer > 0) {
      p.knockTimer -= dt;
      p.knockVY = (p.knockVY || 0) - 14 * dt;
      p.group.position.x += (p.knockVx || 0) * dt;
      p.group.position.y = Math.max(0, p.group.position.y + (p.knockVY || 0) * dt);
      p.group.position.z += (p.knockVz || 0) * dt;
      p.knockVx *= Math.max(0, 1 - dt * 2.6);
      p.knockVz *= Math.max(0, 1 - dt * 2.6);
    }

    if (p.downTimer > 0) {
      p.downTimer -= dt;
      p.leftLeg.rotation.x = -0.25;
      p.rightLeg.rotation.x = 0.25;
      p.leftArm.rotation.x = 0.35;
      p.rightArm.rotation.x = -0.35;
      if (p.downTimer <= 0) {
        p.group.rotation.z = 0;
        p.group.position.y = 0;
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
  for (let i = 0; i < cityBillboards.length; i++) {
    const board = cityBillboards[i];
    if (board.material) board.material.opacity = 0.68 + Math.abs(Math.sin(frame * 0.035 + i)) * 0.32;
  }
  const ref = getPlayerRefPosition();
  for (const lamp of cityStreetLamps) {
    const d = Math.hypot(lamp.group.position.x - ref.x, lamp.group.position.z - ref.z);
    const nearBoost = d < 34 ? 0.55 : 0;
    const alertBoost = wantedLevel > 0 || bankAlarm ? 0.45 : 0;
    if (lamp.bulb.material) lamp.bulb.material.emissiveIntensity = 1.2 + nearBoost + alertBoost;
  }
  for (const loc of cityLocations) {
    if (loc.light) {
      loc.light.intensity = (loc.light.baseIntensity || loc.light.intensity || 1.2) *
        (0.88 + Math.abs(Math.sin(frame * 0.035 + loc.x * 0.01)) * 0.18);
      loc.light.baseIntensity = loc.light.baseIntensity || loc.light.intensity;
    }
    if (loc.beacon && loc.beacon.material) {
      loc.beacon.material.emissiveIntensity = Math.sin(frame * 0.12) > 0 ? 2.8 : 0.4;
      loc.beacon.visible = Math.sin(frame * 0.12) > -0.2;
    }
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

function flashObjectivePanel() {
  if (!objectivePanelEl) return;
  objectivePanelEl.classList.remove('flash');
  void objectivePanelEl.offsetWidth;
  objectivePanelEl.classList.add('flash');
}

function triggerScreenFlash(type = 'impact') {
  if (!screenFlashEl) return;
  screenFlashEl.className = '';
  void screenFlashEl.offsetWidth;
  screenFlashEl.classList.add(`flash-${type}`);
}

function setHudAlertState(active) {
  if (!hud) return;
  hud.classList.toggle('alert-state', active);
}

function ensureVehicleVisualEffects(veh) {
  if (!veh || veh.visualFxReady) return;
  const trailMat = new MeshBasicMaterial({ color: 0xffd200, transparent: true, opacity: 0.0 });
  const trail = new Mesh(new BoxGeometry(1.7, 0.08, 3.2), trailMat);
  trail.position.set(0, 0.38, -2.8);
  veh.group.add(trail);

  const skidMat = new MeshBasicMaterial({ color: 0x111114, transparent: true, opacity: 0.0 });
  const leftSkid = new Mesh(new BoxGeometry(0.18, 0.03, 2.6), skidMat.clone());
  const rightSkid = new Mesh(new BoxGeometry(0.18, 0.03, 2.6), skidMat.clone());
  leftSkid.position.set(-0.72, 0.04, -2.2);
  rightSkid.position.set(0.72, 0.04, -2.2);
  veh.group.add(leftSkid, rightSkid);

  veh.visualTrail = trail;
  veh.visualSkids = [leftSkid, rightSkid];
  veh.visualFxReady = true;
}

function updateVehicleEffects(dt, veh) {
  if (!veh) return;
  ensureVehicleVisualEffects(veh);
  const boosting = (keys['ShiftLeft'] || keys['ShiftRight']) && Math.abs(veh.velocity || 0) > 6;
  const braking = keys['Space'] && Math.abs(veh.velocity || 0) > 5;
  if (veh.visualTrail) {
    veh.visualTrail.material.opacity += ((boosting ? 0.36 : 0) - veh.visualTrail.material.opacity) * Math.min(1, dt * 8);
    veh.visualTrail.scale.z = 0.8 + Math.min(2.0, Math.abs(veh.velocity || 0) / 20);
  }
  if (veh.visualSkids) {
    for (const skid of veh.visualSkids) {
      skid.material.opacity += ((braking ? 0.42 : 0) - skid.material.opacity) * Math.min(1, dt * 10);
    }
  }
  if (veh.smoke) {
    veh.smoke.visible = veh.health < 45;
    veh.smoke.rotation.y += dt * (veh.health < 25 ? 3.6 : 1.5);
    veh.smoke.scale.setScalar(veh.health < 25 ? 1.55 : 1);
  }
  const hazard = veh.health < 28 && Math.sin(frame * 0.28) > 0;
  if (veh.body && veh.body.material) veh.body.material.emissiveIntensity = hazard ? 0.25 : 0;
}

function updateHudEffects(dt) {
  const vehicleHealth = inVehicle && typeof inVehicle.health === 'number' ? inVehicle.health : 100;
  const danger = wantedLevel > 0 || bankAlarm || (inVehicle && vehicleHealth < 35);
  setHudAlertState(wantedLevel > 0 || bankAlarm);
  hud.classList.toggle('danger-vignette', !!danger);
  if (minimapWrapEl) minimapWrapEl.classList.toggle('wanted', wantedLevel > 0 || bankAlarm);
  if (vehicleHealthBarEl) {
    const scale = Math.max(0, Math.min(1, vehicleHealth / 100));
    vehicleHealthBarEl.style.transform = `scaleX(${scale})`;
    vehicleHealthBarEl.classList.toggle('low', scale < 0.35);
  }
}

function updateDistrictLabel() {
  if (!districtLabelEl) return;
  const ref = getPlayerRefPosition();
  const district = getDistrictAt(ref.x, ref.z);
  districtLabelEl.textContent = district.label;
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
  if (hijackState) return;
  if (nearestServiceLocation && (inVehicle || canUseOnFootService(nearestServiceLocation)) && useServiceLocation(nearestServiceLocation)) {
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
  } else if (nearestTrafficVehicle) {
    startHijackTrafficVehicle(nearestTrafficVehicle);
  } else if (nearestVehicle) {
    enterVehicleNow(nearestVehicle);
  }
}

function enterVehicleNow(vehicle) {
  inVehicle = vehicle;
  inVehicle.occupied = true;
  inVehicle.isHijacking = false;
  if (inVehicle.leftDoor) inVehicle.leftDoor.rotation.y = 0;
  player.group.visible = inVehicle.kind === 'bike';
  player.heldItem.visible = inVehicle.kind !== 'bike';
  document.getElementById('mode').textContent = inVehicle.kind === 'bike' ? 'RIDING' : 'DRIVING';
  document.getElementById('speedo').classList.add('show');
  camYaw.v = 0;
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
    if (v.isHijacking) continue;
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

function vehicleLocalPoint(vehicle, x, y, z) {
  return vehicle.group.localToWorld(new Vector3(x, y, z));
}

function startHijackTrafficVehicle(car) {
  const hijacked = hijackTrafficVehicle(car);
  hijacked.isHijacking = true;
  hijacked.occupied = true;
  hijacked.velocity = 0;
  hijacked.speed = 0;
  if (hijacked.leftDoor) hijacked.leftDoor.rotation.y = 0;

  const driver = makePed();
  const start = vehicleLocalPoint(hijacked, -0.35, 0, -0.15);
  driver.group.position.set(start.x, 0, start.z);
  driver.group.rotation.y = hijacked.group.rotation.y + Math.PI / 2;
  scene.add(driver.group);

  const playerPos = vehicleLocalPoint(hijacked, -2.35, 0, 0.15);
  player.group.position.set(playerPos.x, 0, playerPos.z);
  player.yaw = hijacked.group.rotation.y - Math.PI / 2;
  player.group.rotation.y = player.yaw;
  hijackState = {
    car: hijacked,
    driver,
    t: 0,
    duration: 1.25,
  };
  setWantedLevel(Math.max(wantedLevel, 1));
  player.heldItem.visible = true;
  document.getElementById('mode').textContent = 'HIJACKING';
}

function updateHijackSequence(dt) {
  if (!hijackState) return;
  const h = hijackState;
  h.t += dt;
  const p = Math.min(1, h.t / h.duration);
  if (h.car.leftDoor) h.car.leftDoor.rotation.y = -Math.sin(Math.min(1, p * 1.8) * Math.PI / 2) * 1.25;

  const doorPos = vehicleLocalPoint(h.car, -1.55, 0, 0.08);
  const tossPos = vehicleLocalPoint(h.car, -3.5, 0, -0.55);
  const lift = Math.sin(Math.min(1, p) * Math.PI) * 0.45;
  h.driver.group.position.set(
    doorPos.x + (tossPos.x - doorPos.x) * p,
    lift,
    doorPos.z + (tossPos.z - doorPos.z) * p
  );
  h.driver.group.rotation.y = h.car.group.rotation.y + Math.PI / 2 + p * 0.8;
  h.driver.group.rotation.z = p > 0.55 ? Math.PI / 2 : p * 0.9;

  const playerPos = vehicleLocalPoint(h.car, -2.1 + p * 0.55, 0, 0.22);
  player.group.position.set(playerPos.x, 0, playerPos.z);
  player.rightArm.rotation.x = -1.2;
  player.leftArm.rotation.x = -0.65;

  if (p >= 1) {
    h.driver.group.position.y = 0;
    peds.push({
      ...h.driver,
      dir: h.car.group.rotation.y + Math.PI / 2,
      speed: 1.0,
      walkPhase: 0,
      turnTimer: 2.5,
      health: 100,
      hitTimer: 0,
      downTimer: 2.4,
    });
    if (h.car.leftDoor) h.car.leftDoor.rotation.y = 0;
    const car = h.car;
    hijackState = null;
    enterVehicleNow(car);
  }
}

function getVehicleCollisionRadius(vehicle) {
  if (vehicle.kind === 'bike') return 1.15;
  if (vehicle.kind === 'police') return 1.85;
  return 1.75;
}

function getVehicleForwardSpeed(vehicle) {
  if (typeof vehicle.velocity === 'number') return vehicle.velocity;
  if (typeof vehicle.speed === 'number') return vehicle.speed * (1 - (vehicle.brakeBlend || 0));
  return 0;
}

function setVehicleForwardSpeed(vehicle, speed) {
  if (typeof vehicle.velocity === 'number') {
    vehicle.velocity = speed;
  } else if (typeof vehicle.speed === 'number') {
    vehicle.brakeBlend = MathUtils.clamp(1 - Math.abs(speed) / Math.max(0.001, vehicle.speed), 0.15, 0.85);
  }
}

function getVehiclePhysicsList() {
  const list = [];
  for (const v of vehicles) list.push(v);
  for (const v of aiCars) list.push(v);
  for (const v of policeCars) list.push(v);
  return list;
}

function updateVehicleCollisions(dt) {
  const all = getVehiclePhysicsList();
  for (const v of all) {
    v.sparkCooldown = Math.max(0, (v.sparkCooldown || 0) - dt);
  }

  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    if (!a.group) continue;
    for (let j = i + 1; j < all.length; j++) {
      const b = all[j];
      if (!b.group || a === b) continue;
      const dx = b.group.position.x - a.group.position.x;
      const dz = b.group.position.z - a.group.position.z;
      const dist = Math.max(0.001, Math.hypot(dx, dz));
      const minDist = getVehicleCollisionRadius(a) + getVehicleCollisionRadius(b);
      if (dist >= minDist) continue;

      const nx = dx / dist;
      const nz = dz / dist;
      const overlap = minDist - dist;
      const aLocked = a.occupied && a !== inVehicle;
      const bLocked = b.occupied && b !== inVehicle;
      const aPush = bLocked ? 1 : 0.5;
      const bPush = aLocked ? 1 : 0.5;
      a.group.position.x -= nx * overlap * aPush;
      a.group.position.z -= nz * overlap * aPush;
      b.group.position.x += nx * overlap * bPush;
      b.group.position.z += nz * overlap * bPush;

      const av = getVehicleForwardSpeed(a);
      const bv = getVehicleForwardSpeed(b);
      const impact = Math.abs(av - bv) + Math.max(Math.abs(av), Math.abs(bv)) * 0.45;
      if (impact < 1.3) continue;

      setVehicleForwardSpeed(a, -av * 0.22 + bv * 0.12);
      setVehicleForwardSpeed(b, -bv * 0.22 + av * 0.12);
      if (a.kind === 'bike') a.group.rotation.z += (Math.random() - 0.5) * 0.28;
      if (b.kind === 'bike') b.group.rotation.z += (Math.random() - 0.5) * 0.28;
      damageVehicle(a, Math.min(20, impact * 0.65));
      damageVehicle(b, Math.min(20, impact * 0.65));

      if ((a.sparkCooldown || 0) <= 0 && (b.sparkCooldown || 0) <= 0) {
        spawnSparkBurst(
          (a.group.position.x + b.group.position.x) / 2,
          0.8,
          (a.group.position.z + b.group.position.z) / 2,
          MathUtils.clamp(impact / 9, 0.8, 2.2)
        );
        a.sparkCooldown = 0.32;
        b.sparkCooldown = 0.32;
      }
    }
  }
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
  mmCtx.shadowColor = wantedLevel > 0 ? '#ff5900' : '#ffd200';
  mmCtx.shadowBlur = 10;
  mmCtx.strokeStyle = '#101018';
  mmCtx.lineWidth = 2;
  mmCtx.beginPath();
  mmCtx.moveTo(0, -8);
  mmCtx.lineTo(6, 6);
  mmCtx.lineTo(-6, 6);
  mmCtx.closePath();
  mmCtx.stroke();
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
  mmCtx.globalAlpha = 0.55 + Math.abs(Math.sin(frame * 0.12)) * 0.45;
  mmCtx.shadowColor = '#ffd200';
  mmCtx.shadowBlur = 8;
  mmCtx.lineWidth = 2.5;
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
const screenFlashEl = document.getElementById('screenFlash');
const vehicleHealthBarEl = document.getElementById('vehicleHealthBar');
const minimapWrapEl = document.getElementById('minimap-wrap');
const districtLabelEl = document.getElementById('districtLabel');
let frame = 0;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  frame++;

  if (hijackState) {
    updateHijackSequence(dt);
    nearestVehicle = null;
    nearestTrafficVehicle = null;
    nearestLocation = null;
    nearestMissionStart = null;
    nearestServiceLocation = null;
  } else if (inVehicle) {
    updateVehicle(dt, inVehicle);
    updateVehicleEffects(dt, inVehicle);
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
  updateCombatEffects(dt);
  updateCitySceneActors(dt);
  updateLocationAlert(dt);
  updateLocationEffects(dt);
  updateMission(dt);
  updatePoliceChase(dt);
  updateVehicleCollisions(dt);
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
  updateHudEffects(dt);
  updateDistrictLabel();
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
  else if (canUseShopService(nearestServiceLocation)) {
    promptEl.classList.add('show');
    promptEl.innerHTML = '<kbd>F</kbd>SHOP ITEM';
  }
  else if (nearestServiceLocation && canUseOnFootService(nearestServiceLocation) && nearestServiceLocation.type === 'hospital') {
    promptEl.classList.add('show');
    promptEl.innerHTML = '<kbd>F</kbd>PATCH UP';
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
  const serviceReady = !!nearestServiceLocation && (inVehicle || canUseOnFootService(nearestServiceLocation));
  const useLabel = serviceReady ? 'USE' : (nearestMissionStart ? 'START' : (activeLocation ? 'EXIT' : 'ENTER'));
  setMobileControlMode(!!inVehicle, !!nearestVehicle, !!nearestTrafficVehicle, !!(activeLocation || nearestLocation || nearestMissionStart || serviceReady), useLabel);

  renderer.render(scene, camera);
}
lastPos.copy(player.group.position);
loop();
