// -------------------- VEHICLES --------------------
function makeCar(color = 0xff3030) {
  const g = new Group();
  // Body (lower part)
  const body = new Mesh(
    new BoxGeometry(2, 0.7, 4.2),
    new MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.5 })
  );
  body.position.y = 0.7;
  body.castShadow = true;
  g.add(body);
  // Cabin (upper part)
  const cabin = new Mesh(
    new BoxGeometry(1.85, 0.7, 2.3),
    new MeshStandardMaterial({ color: 0x202028, roughness: 0.3, metalness: 0.4 })
  );
  cabin.position.set(0, 1.4, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  const leftDoor = new Group();
  leftDoor.position.set(-1.04, 0.95, 0.62);
  const doorPanel = new Mesh(
    new BoxGeometry(0.08, 0.62, 1.28),
    new MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.5 })
  );
  doorPanel.position.set(0, 0, -0.55);
  leftDoor.add(doorPanel);
  g.add(leftDoor);
  // Windshield reflection strip
  const ws = new Mesh(
    new BoxGeometry(1.7, 0.5, 0.1),
    new MeshStandardMaterial({ color: 0x88c8ff, emissive: 0x88c8ff, emissiveIntensity: 0.2 })
  );
  ws.position.set(0, 1.5, 0.95);
  ws.rotation.x = -0.3;
  g.add(ws);
  // Wheels
  const wheelGeo = new CylinderGeometry(0.42, 0.42, 0.35, 8);
  const wheelMat = new MeshLambertMaterial({ color: 0x111114 });
  const wheels = [];
  for (const [x, z] of [[-1.05, 1.3], [1.05, 1.3], [-1.05, -1.3], [1.05, -1.3]]) {
    const w = new Mesh(wheelGeo, wheelMat);
    w.position.set(x, 0.42, z);
    w.rotation.z = Math.PI/2;
    g.add(w);
    wheels.push(w);
  }
  // Headlights
  for (const x of [-0.6, 0.6]) {
    const hl = new Mesh(
      new BoxGeometry(0.35, 0.18, 0.08),
      new MeshStandardMaterial({ color: 0xfff4d8, emissive: 0xfff4d8, emissiveIntensity: 1.5 })
    );
    hl.position.set(x, 0.85, 2.1);
    g.add(hl);
  }
  // Taillights
  for (const x of [-0.7, 0.7]) {
    const tl = new Mesh(
      new BoxGeometry(0.3, 0.12, 0.06),
      new MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1.2 })
    );
    tl.position.set(x, 0.95, -2.1);
    g.add(tl);
  }
  return { group: g, wheels, body, leftDoor, color };
}

function makePickup(color = 0x2080ff) {
  const g = new Group();
  const paint = new MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.45 });
  const dark = new MeshStandardMaterial({ color: 0x181820, roughness: 0.5, metalness: 0.25 });
  const body = new Mesh(new BoxGeometry(2.25, 0.82, 5.1), paint);
  body.position.y = 0.78;
  body.castShadow = true;
  g.add(body);
  const cabin = new Mesh(new BoxGeometry(2.0, 0.95, 1.85), dark);
  cabin.position.set(0, 1.45, 0.95);
  cabin.castShadow = true;
  g.add(cabin);
  const bed = new Mesh(new BoxGeometry(2.05, 0.42, 2.15), new MeshStandardMaterial({ color: 0x202028, roughness: 0.75, metalness: 0.15 }));
  bed.position.set(0, 1.18, -1.35);
  bed.castShadow = true;
  g.add(bed);
  const leftDoor = new Group();
  leftDoor.position.set(-1.16, 0.98, 1.48);
  const doorPanel = new Mesh(new BoxGeometry(0.08, 0.72, 1.05), paint);
  doorPanel.position.set(0, 0, -0.46);
  leftDoor.add(doorPanel);
  g.add(leftDoor);

  const wheelGeo = new CylinderGeometry(0.48, 0.48, 0.38, 10);
  const wheelMat = new MeshLambertMaterial({ color: 0x101014 });
  const wheels = [];
  for (const [x, z] of [[-1.18, 1.65], [1.18, 1.65], [-1.18, -1.65], [1.18, -1.65]]) {
    const w = new Mesh(wheelGeo, wheelMat);
    w.position.set(x, 0.47, z);
    w.rotation.z = Math.PI / 2;
    g.add(w);
    wheels.push(w);
  }
  for (const x of [-0.68, 0.68]) {
    const hl = new Mesh(new BoxGeometry(0.38, 0.18, 0.08), new MeshStandardMaterial({ color: 0xfff4d8, emissive: 0xfff4d8, emissiveIntensity: 1.4 }));
    hl.position.set(x, 0.92, 2.56);
    g.add(hl);
  }
  return { group: g, wheels, body, leftDoor, color, kind: 'pickup' };
}

function makeTruck(color = 0xf0f0f0) {
  const g = new Group();
  const cabMat = new MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.35 });
  const boxMat = new MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.62, metalness: 0.12 });
  const body = new Mesh(new BoxGeometry(2.45, 0.9, 2.1), cabMat);
  body.position.set(0, 0.95, 1.85);
  body.castShadow = true;
  g.add(body);
  const cargo = new Mesh(new BoxGeometry(2.7, 1.75, 4.2), boxMat);
  cargo.position.set(0, 1.45, -1.35);
  cargo.castShadow = true;
  cargo.receiveShadow = true;
  g.add(cargo);
  const windshield = new Mesh(new BoxGeometry(1.75, 0.42, 0.08), new MeshStandardMaterial({ color: 0x88c8ff, emissive: 0x88c8ff, emissiveIntensity: 0.18 }));
  windshield.position.set(0, 1.54, 2.92);
  windshield.rotation.x = -0.2;
  g.add(windshield);
  const leftDoor = new Group();
  leftDoor.position.set(-1.26, 1.05, 2.26);
  const doorPanel = new Mesh(new BoxGeometry(0.08, 0.9, 1.05), cabMat);
  doorPanel.position.set(0, 0, -0.5);
  leftDoor.add(doorPanel);
  g.add(leftDoor);

  const wheelGeo = new CylinderGeometry(0.55, 0.55, 0.42, 10);
  const wheelMat = new MeshLambertMaterial({ color: 0x0e0e12 });
  const wheels = [];
  for (const [x, z] of [[-1.32, 2.1], [1.32, 2.1], [-1.32, -0.65], [1.32, -0.65], [-1.32, -2.25], [1.32, -2.25]]) {
    const w = new Mesh(wheelGeo, wheelMat);
    w.position.set(x, 0.55, z);
    w.rotation.z = Math.PI / 2;
    g.add(w);
    wheels.push(w);
  }
  return { group: g, wheels, body, leftDoor, color, kind: 'truck' };
}

function makePoliceVan() {
  const van = makeTruck(0x102040);
  van.kind = 'policeVan';
  van.body.material.color.set(0x102040);
  const sideMat = new MeshBasicMaterial({ color: 0x88c8ff });
  for (const x of [-1.38, 1.38]) {
    const panel = new Mesh(new BoxGeometry(0.04, 0.5, 1.8), sideMat);
    panel.position.set(x, 1.75, -1.35);
    van.group.add(panel);
  }
  const rearBars = new Group();
  const barMat = new MeshStandardMaterial({ color: 0xb8c4d0, roughness: 0.3, metalness: 0.75 });
  for (let i = 0; i < 5; i++) {
    const bar = new Mesh(new CylinderGeometry(0.035, 0.035, 0.85, 6), barMat);
    bar.position.set(-0.48 + i * 0.24, 1.45, -3.5);
    rearBars.add(bar);
  }
  van.group.add(rearBars);
  const red = new Mesh(new BoxGeometry(0.35, 0.16, 0.22), new MeshBasicMaterial({ color: 0xff2020 }));
  red.position.set(-0.35, 2.45, 0.95);
  const blue = new Mesh(new BoxGeometry(0.35, 0.16, 0.22), new MeshBasicMaterial({ color: 0x2080ff }));
  blue.position.set(0.35, 2.45, 0.95);
  van.group.add(red, blue);
  van.sirenRed = red;
  van.sirenBlue = blue;
  return van;
}

function makeMotorbike(color = 0xff7030) {
  const g = new Group();
  const frameMat = new MeshStandardMaterial({ color: 0x15151c, roughness: 0.42, metalness: 0.65 });
  const accentMat = new MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.45 });
  const chromeMat = new MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.28, metalness: 0.8 });
  const tireMat = new MeshLambertMaterial({ color: 0x0d0d10 });

  const wheels = [];
  for (const z of [1.15, -1.15]) {
    const wheel = new Mesh(new CylinderGeometry(0.46, 0.46, 0.18, 10), tireMat);
    wheel.position.set(0, 0.46, z);
    wheel.rotation.z = Math.PI / 2;
    g.add(wheel);
    wheels.push(wheel);

    const hub = new Mesh(new CylinderGeometry(0.18, 0.18, 0.22, 8), chromeMat);
    hub.position.copy(wheel.position);
    hub.rotation.z = Math.PI / 2;
    g.add(hub);
  }

  const body = new Mesh(new BoxGeometry(0.62, 0.34, 1.45), accentMat);
  body.position.set(0, 0.95, 0);
  body.castShadow = true;
  g.add(body);

  const seat = new Mesh(new BoxGeometry(0.54, 0.16, 0.82), frameMat);
  seat.position.set(0, 1.18, -0.28);
  g.add(seat);

  const fork = new Mesh(new BoxGeometry(0.12, 0.92, 0.1), chromeMat);
  fork.position.set(0, 0.88, 1.0);
  fork.rotation.x = -0.28;
  g.add(fork);

  const handlebar = new Mesh(new BoxGeometry(1.05, 0.09, 0.12), chromeMat);
  handlebar.position.set(0, 1.42, 0.86);
  g.add(handlebar);

  const headlight = new Mesh(
    new SphereGeometry(0.16, 10, 8),
    new MeshStandardMaterial({ color: 0xfff4d8, emissive: 0xfff4d8, emissiveIntensity: 1.5 })
  );
  headlight.position.set(0, 1.15, 1.32);
  g.add(headlight);

  const tailLight = new Mesh(
    new BoxGeometry(0.24, 0.12, 0.08),
    new MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1.2 })
  );
  tailLight.position.set(0, 1.02, -1.36);
  g.add(tailLight);

  return { group: g, wheels, body, color, kind: 'bike' };
}

// Place player-accessible vehicles at random spots near roads
const vehicles = [];
const carColors = [0xe83030, 0x2080ff, 0xffd200, 0x10b070, 0xff7030, 0xa040c0, 0xf0f0f0, 0x202028];
const bikeColors = [0xff3030, 0xffd200, 0x2080ff, 0x10b070, 0xf0f0f0];
const PARKED = 18;
for (let i = 0; i < PARKED; i++) {
  const col = carColors[Math.floor(Math.random()*carColors.length)];
  const roll = Math.random();
  const car = roll < 0.56 ? makeCar(col) : (roll < 0.84 ? makePickup(col) : makeTruck(col));
  // Try to place on a side street area
  let placed = false, tries = 0;
  while (!placed && tries < 50) {
    tries++;
    const bx = Math.floor(Math.random() * GRID);
    const bz = Math.floor(Math.random() * GRID);
    const cx0 = -HALF + bx * BLOCK + BLOCK/2;
    const cz0 = -HALF + bz * BLOCK + BLOCK/2;
    // Place along an edge of the block, on the road
    const edge = Math.floor(Math.random() * 4);
    let x, z, rot;
    const off = BLOCK/2 - ROAD/2 + 1.6;
    if (edge === 0) { x = cx0 + (Math.random()-0.5)*BLOCK*0.7; z = cz0 - off; rot = 0; }
    else if (edge === 1) { x = cx0 + (Math.random()-0.5)*BLOCK*0.7; z = cz0 + off; rot = Math.PI; }
    else if (edge === 2) { x = cx0 - off; z = cz0 + (Math.random()-0.5)*BLOCK*0.7; rot = Math.PI/2; }
    else { x = cx0 + off; z = cz0 + (Math.random()-0.5)*BLOCK*0.7; rot = -Math.PI/2; }
    car.group.position.set(x, 0, z);
    car.group.rotation.y = rot;
    placed = true;
  }
  scene.add(car.group);
  vehicles.push({
    ...car,
    velocity: 0,
    angularVelocity: 0,
    isAI: false,
    kind: car.kind || 'car',
    occupied: false,
  });
}

const PARKED_BIKES = 10;
for (let i = 0; i < PARKED_BIKES; i++) {
  const col = bikeColors[Math.floor(Math.random()*bikeColors.length)];
  const bike = makeMotorbike(col);
  let placed = false, tries = 0;
  while (!placed && tries < 50) {
    tries++;
    const bx = Math.floor(Math.random() * GRID);
    const bz = Math.floor(Math.random() * GRID);
    const cx0 = -HALF + bx * BLOCK + BLOCK/2;
    const cz0 = -HALF + bz * BLOCK + BLOCK/2;
    const edge = Math.floor(Math.random() * 4);
    let x, z, rot;
    const off = BLOCK/2 - ROAD/2 + 2.2;
    if (edge === 0) { x = cx0 + (Math.random()-0.5)*BLOCK*0.72; z = cz0 - off; rot = 0; }
    else if (edge === 1) { x = cx0 + (Math.random()-0.5)*BLOCK*0.72; z = cz0 + off; rot = Math.PI; }
    else if (edge === 2) { x = cx0 - off; z = cz0 + (Math.random()-0.5)*BLOCK*0.72; rot = Math.PI/2; }
    else { x = cx0 + off; z = cz0 + (Math.random()-0.5)*BLOCK*0.72; rot = -Math.PI/2; }
    bike.group.position.set(x, 0, z);
    bike.group.rotation.y = rot + (Math.random() - 0.5) * 0.18;
    placed = true;
  }
  scene.add(bike.group);
  vehicles.push({
    ...bike,
    velocity: 0,
    angularVelocity: 0,
    isAI: false,
    occupied: false,
  });
}

// -------------------- AI TRAFFIC --------------------
const aiCars = [];
const TRAFFIC_COUNT = 16;
for (let i = 0; i < TRAFFIC_COUNT; i++) {
  const col = carColors[Math.floor(Math.random()*carColors.length)];
  const roll = Math.random();
  const car = roll < 0.6 ? makeCar(col) : (roll < 0.86 ? makePickup(col) : makeTruck(col));
  scene.add(car.group);
  // Pick a road lane to drive on
  const horizontal = Math.random() < 0.5;
  const laneIndex = Math.floor(Math.random() * (GRID + 1));
  const direction = Math.random() < 0.5 ? 1 : -1;
  const laneOff = direction * (ROAD/4);
  const startPos = -HALF + Math.random() * GRID * BLOCK;
  if (horizontal) {
    car.group.position.set(startPos, 0, -HALF + laneIndex * BLOCK + laneOff);
    car.group.rotation.y = direction > 0 ? -Math.PI/2 : Math.PI/2;
  } else {
    car.group.position.set(-HALF + laneIndex * BLOCK + laneOff, 0, startPos);
    car.group.rotation.y = direction > 0 ? 0 : Math.PI;
  }
  const district = getDistrictAt(car.group.position.x, car.group.position.z);
  const districtSpeedBoost = district.id === 'downtown' ? 2 : (district.id === 'industrial' ? -2 : 0);
  const baseSpeed = car.kind === 'truck' ? 5 : 8;
  const speedRange = car.kind === 'truck' ? 5 : 8;
  aiCars.push({
    ...car, horizontal, laneIndex, direction, speed: Math.max(3, baseSpeed + districtSpeedBoost + Math.random() * speedRange),
    laneOff
  });
}

// -------------------- PEDESTRIANS --------------------
function makePed() {
  const g = new Group();
  const shirtCol = new Color().setHSL(Math.random(), 0.6, 0.45);
  const pantsCol = new Color().setHSL(Math.random()*0.1 + 0.55, 0.3, 0.25);
  const skinCol = new Color().setHSL(0.06, 0.5, 0.5 + Math.random()*0.15);

  const body = new Mesh(
    new BoxGeometry(0.5, 0.7, 0.3),
    new MeshStandardMaterial({ color: shirtCol })
  );
  body.position.y = 1.1;
  g.add(body);

  const legMat = new MeshStandardMaterial({ color: pantsCol });
  const leftLeg = new Mesh(
    new BoxGeometry(0.2, 0.72, 0.24),
    legMat
  );
  leftLeg.position.set(-0.13, 0.38, 0);
  g.add(leftLeg);
  const rightLeg = new Mesh(
    new BoxGeometry(0.2, 0.72, 0.24),
    legMat
  );
  rightLeg.position.set(0.13, 0.38, 0);
  g.add(rightLeg);

  const armMat = new MeshStandardMaterial({ color: shirtCol });
  const leftArm = new Mesh(
    new BoxGeometry(0.16, 0.72, 0.2),
    armMat
  );
  leftArm.position.set(-0.31, 1.08, 0);
  g.add(leftArm);
  const rightArm = new Mesh(
    new BoxGeometry(0.16, 0.72, 0.2),
    armMat
  );
  rightArm.position.set(0.31, 1.08, 0);
  g.add(rightArm);

  const legs = new Object3D();
  legs.add(leftLeg, rightLeg);
  g.add(legs);
  const arms = new Object3D();
  arms.add(leftArm, rightArm);
  g.add(arms);

  const hitFlash = new Mesh(
    new BoxGeometry(0.62, 0.82, 0.36),
    new MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.45 })
  );
  hitFlash.position.y = 1.1;
  hitFlash.visible = false;
  g.add(hitFlash);

  const head = new Mesh(
    new BoxGeometry(0.32, 0.32, 0.32),
    new MeshStandardMaterial({ color: skinCol })
  );
  head.position.y = 1.65;
  g.add(head);

  return { group: g, body, head, legs, leftLeg, rightLeg, arms, leftArm, rightArm, hitFlash };
}
const peds = [];
const PED_COUNT = 24;
for (let i = 0; i < PED_COUNT; i++) {
  const p = makePed();
  // Place on a random sidewalk
  const bx = Math.floor(Math.random() * GRID);
  const bz = Math.floor(Math.random() * GRID);
  const cx0 = -HALF + bx * BLOCK + BLOCK/2;
  const cz0 = -HALF + bz * BLOCK + BLOCK/2;
  p.group.position.set(cx0 + (Math.random()-0.5)*BLOCK*0.6, 0, cz0 + (Math.random()-0.5)*BLOCK*0.6);
  const district = getDistrictAt(p.group.position.x, p.group.position.z);
  if (district.id === 'industrial' && Math.random() < 0.45) {
    p.group.position.x = 60 + Math.random() * 70;
    p.group.position.z = 60 + Math.random() * 70;
  }
  const dir = Math.random() * Math.PI * 2;
  p.group.rotation.y = dir;
  scene.add(p.group);
  peds.push({
    ...p,
    dir,
    speed: 1.2 + Math.random() * 0.8,
    walkPhase: Math.random() * Math.PI * 2,
    turnTimer: 2 + Math.random()*3,
    health: 100,
    hitTimer: 0,
    downTimer: 0,
  });
}

// -------------------- PLAYER (on foot) --------------------
const player = (() => {
  const g = new Group();
  const body = new Mesh(
    new BoxGeometry(0.55, 0.75, 0.32),
    new MeshStandardMaterial({ color: 0xffd200 })
  );
  body.position.y = 1.15; g.add(body);
  const legMat = new MeshStandardMaterial({ color: 0x1a1a22 });
  const leftLeg = new Mesh(new BoxGeometry(0.22, 0.76, 0.28), legMat);
  leftLeg.position.set(-0.14, 0.4, 0); g.add(leftLeg);
  const rightLeg = new Mesh(new BoxGeometry(0.22, 0.76, 0.28), legMat);
  rightLeg.position.set(0.14, 0.4, 0); g.add(rightLeg);
  const armMat = new MeshStandardMaterial({ color: 0xffd200 });
  const leftArm = new Mesh(new BoxGeometry(0.17, 0.76, 0.22), armMat);
  leftArm.position.set(-0.34, 1.15, 0); g.add(leftArm);
  const rightArm = new Mesh(new BoxGeometry(0.17, 0.76, 0.22), armMat);
  rightArm.position.set(0.34, 1.15, 0); g.add(rightArm);
  const legs = new Object3D();
  legs.add(leftLeg, rightLeg);
  g.add(legs);
  const arms = new Object3D();
  arms.add(leftArm, rightArm);
  g.add(arms);
  const head = new Mesh(
    new BoxGeometry(0.34, 0.34, 0.34),
    new MeshStandardMaterial({ color: 0xf0c090 })
  );
  head.position.y = 1.7; g.add(head);
  // Cap accent
  const cap = new Mesh(
    new BoxGeometry(0.36, 0.12, 0.36),
    new MeshStandardMaterial({ color: 0xff5900 })
  );
  cap.position.y = 1.92; g.add(cap);

  const heldItem = new Group();
  g.add(heldItem);
  scene.add(g);
  return {
    group: g, body, head, legs, leftLeg, rightLeg, arms, leftArm, rightArm, cap, heldItem,
    pos: new Vector3(0, 0, 0),
    yaw: 0,
    velocityY: 0,
    onGround: true,
    walkPhase: 0,
    actionTimer: 0,
    knockTimer: 0,
    knockVx: 0,
    knockVz: 0,
    heldType: 'empty',
  };
})();
player.group.position.set(0, 0, 8);
