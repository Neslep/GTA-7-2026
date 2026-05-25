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
  // Windshield reflection strip
  const ws = new Mesh(
    new BoxGeometry(1.7, 0.5, 0.1),
    new MeshStandardMaterial({ color: 0x88c8ff, emissive: 0x88c8ff, emissiveIntensity: 0.2 })
  );
  ws.position.set(0, 1.5, 0.95);
  ws.rotation.x = -0.3;
  g.add(ws);
  // Wheels
  const wheelGeo = new CylinderGeometry(0.42, 0.42, 0.35, 12);
  const wheelMat = new MeshStandardMaterial({ color: 0x111114, roughness: 0.9 });
  const wheels = [];
  for (const [x, z] of [[-1.05, 1.3], [1.05, 1.3], [-1.05, -1.3], [1.05, -1.3]]) {
    const w = new Mesh(wheelGeo, wheelMat);
    w.position.set(x, 0.42, z);
    w.rotation.z = Math.PI/2;
    w.castShadow = true;
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
  return { group: g, wheels, body, color };
}

// Place player-accessible vehicles at random spots near roads
const vehicles = [];
const carColors = [0xe83030, 0x2080ff, 0xffd200, 0x10b070, 0xff7030, 0xa040c0, 0xf0f0f0, 0x202028];
const PARKED = 12;
for (let i = 0; i < PARKED; i++) {
  const col = carColors[Math.floor(Math.random()*carColors.length)];
  const car = makeCar(col);
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
    occupied: false,
  });
}

// -------------------- AI TRAFFIC --------------------
const aiCars = [];
const TRAFFIC_COUNT = 14;
for (let i = 0; i < TRAFFIC_COUNT; i++) {
  const col = carColors[Math.floor(Math.random()*carColors.length)];
  const car = makeCar(col);
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
  aiCars.push({
    ...car, horizontal, laneIndex, direction, speed: 8 + Math.random() * 8,
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
  body.castShadow = true;
  g.add(body);

  const legs = new Mesh(
    new BoxGeometry(0.45, 0.7, 0.28),
    new MeshStandardMaterial({ color: pantsCol })
  );
  legs.position.y = 0.4;
  legs.castShadow = true;
  g.add(legs);

  const head = new Mesh(
    new BoxGeometry(0.32, 0.32, 0.32),
    new MeshStandardMaterial({ color: skinCol })
  );
  head.position.y = 1.65;
  head.castShadow = true;
  g.add(head);

  return { group: g, body, head, legs };
}
const peds = [];
const PED_COUNT = 22;
for (let i = 0; i < PED_COUNT; i++) {
  const p = makePed();
  // Place on a random sidewalk
  const bx = Math.floor(Math.random() * GRID);
  const bz = Math.floor(Math.random() * GRID);
  const cx0 = -HALF + bx * BLOCK + BLOCK/2;
  const cz0 = -HALF + bz * BLOCK + BLOCK/2;
  p.group.position.set(cx0 + (Math.random()-0.5)*BLOCK*0.6, 0, cz0 + (Math.random()-0.5)*BLOCK*0.6);
  const dir = Math.random() * Math.PI * 2;
  p.group.rotation.y = dir;
  scene.add(p.group);
  peds.push({
    ...p,
    dir,
    speed: 1.2 + Math.random() * 0.8,
    walkPhase: Math.random() * Math.PI * 2,
    turnTimer: 2 + Math.random()*3,
  });
}

// -------------------- PLAYER (on foot) --------------------
const player = (() => {
  const g = new Group();
  const body = new Mesh(
    new BoxGeometry(0.55, 0.75, 0.32),
    new MeshStandardMaterial({ color: 0xffd200 })
  );
  body.position.y = 1.15; body.castShadow = true; g.add(body);
  const legs = new Mesh(
    new BoxGeometry(0.5, 0.75, 0.3),
    new MeshStandardMaterial({ color: 0x1a1a22 })
  );
  legs.position.y = 0.4; legs.castShadow = true; g.add(legs);
  const head = new Mesh(
    new BoxGeometry(0.34, 0.34, 0.34),
    new MeshStandardMaterial({ color: 0xf0c090 })
  );
  head.position.y = 1.7; head.castShadow = true; g.add(head);
  // Cap accent
  const cap = new Mesh(
    new BoxGeometry(0.36, 0.12, 0.36),
    new MeshStandardMaterial({ color: 0xff5900 })
  );
  cap.position.y = 1.92; g.add(cap);
  scene.add(g);
  return {
    group: g, body, head, legs, cap,
    pos: new Vector3(0, 0, 0),
    yaw: 0,
    velocityY: 0,
    onGround: true,
    walkPhase: 0,
  };
})();
player.group.position.set(0, 0, 8);
