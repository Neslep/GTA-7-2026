// -------------------- GROUND --------------------
const ground = new Mesh(
  new PlaneGeometry(GRID * BLOCK + 360, GRID * BLOCK + 360),
  new MeshStandardMaterial({ color: 0x3d4a3d, roughness: 0.9 })
);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);

// -------------------- ROADS --------------------
const roadMat = new MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.95 });
const sidewalkMat = new MeshStandardMaterial({ color: 0x6a6a78, roughness: 0.8 });
const lineMat = new MeshBasicMaterial({ color: 0xffd200 });

const roadsGroup = new Group();
scene.add(roadsGroup);

// Procedural road network: a grid of intersecting strips
for (let i = 0; i <= GRID; i++) {
  const pos = -HALF + i * BLOCK;
  // Horizontal road
  const h = new Mesh(new PlaneGeometry(GRID*BLOCK + ROAD, ROAD), roadMat);
  h.rotation.x = -Math.PI/2;
  h.position.set(0, 0.02, pos);
  h.receiveShadow = true;
  roadsGroup.add(h);
  // Sidewalk strips
  for (const dz of [-ROAD/2 - 1, ROAD/2 + 1]) {
    const sw = new Mesh(new BoxGeometry(GRID*BLOCK + ROAD, 0.25, 1.6), sidewalkMat);
    sw.position.set(0, 0.12, pos + dz);
    sw.receiveShadow = true;
    sw.castShadow = true;
    roadsGroup.add(sw);
  }
  // Vertical road
  const v = new Mesh(new PlaneGeometry(ROAD, GRID*BLOCK + ROAD), roadMat);
  v.rotation.x = -Math.PI/2;
  v.position.set(pos, 0.02, 0);
  v.receiveShadow = true;
  roadsGroup.add(v);
  for (const dx of [-ROAD/2 - 1, ROAD/2 + 1]) {
    const sw = new Mesh(new BoxGeometry(1.6, 0.25, GRID*BLOCK + ROAD), sidewalkMat);
    sw.position.set(pos + dx, 0.12, 0);
    sw.receiveShadow = true;
    roadsGroup.add(sw);
  }
}

// Dashed yellow center lines
for (let i = 0; i <= GRID; i++) {
  const pos = -HALF + i * BLOCK;
  for (let j = -HALF; j < HALF; j += 4) {
    const dh = new Mesh(new PlaneGeometry(2, 0.15), lineMat);
    dh.rotation.x = -Math.PI/2;
    dh.position.set(j + 1, 0.04, pos);
    roadsGroup.add(dh);
    const dv = new Mesh(new PlaneGeometry(0.15, 2), lineMat);
    dv.rotation.x = -Math.PI/2;
    dv.position.set(pos, 0.04, j + 1);
    roadsGroup.add(dv);
  }
}

function makeDistrictMarker(district) {
  const w = district.xMax - district.xMin;
  const d = district.zMax - district.zMin;
  const marker = new Mesh(
    new PlaneGeometry(w - ROAD, d - ROAD),
    new MeshBasicMaterial({ color: district.color, transparent: true, opacity: 0.06 })
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.set((district.xMin + district.xMax) / 2, 0.025, (district.zMin + district.zMax) / 2);
  scene.add(marker);
}
for (const district of cityDistricts) makeDistrictMarker(district);

// -------------------- BUILDINGS --------------------
const buildings = []; // AABB collision data
const buildingMeshes = []; // for minimap

// Cached window canvas texture — gives buildings that lit-window grid look
function makeWindowTexture(litChance = 0.4) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1a22';
  ctx.fillRect(0, 0, 128, 128);
  const cols = 8, rows = 8;
  const w = 128/cols, h = 128/rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (Math.random() < litChance) {
        const hue = Math.random();
        ctx.fillStyle = hue < 0.6 ? '#ffd28a' : (hue < 0.85 ? '#ffb070' : '#88c8ff');
      } else {
        ctx.fillStyle = '#2a2a36';
      }
      ctx.fillRect(x*w + 2, y*h + 2, w - 4, h - 4);
    }
  }
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  return tex;
}
const windowTextures = [makeWindowTexture(0.3), makeWindowTexture(0.5), makeWindowTexture(0.7)];

function placeBuilding(cx, cz, blockX, blockZ) {
  const w = 6 + Math.random() * 8;
  const d = 6 + Math.random() * 8;
  const h = 6 + Math.random() * Math.random() * 38; // skewed toward shorter
  const tex = windowTextures[Math.floor(Math.random() * windowTextures.length)].clone();
  tex.needsUpdate = true;
  tex.repeat.set(Math.max(1, Math.round(w/3)), Math.max(1, Math.round(h/3)));
  const baseHue = 0.05 + Math.random() * 0.15;  // warm sunset tones
  const districtStyle = applyDistrictBuildingStyle(baseHue, cx, cz);
  const mat = new MeshStandardMaterial({
    color: new Color().setHSL(districtStyle.hue, districtStyle.sat + Math.random()*0.16, districtStyle.light + Math.random()*0.12),
    map: tex,
    roughness: 0.75,
  });
  // simple top cap
  const topMat = new MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.7 });
  const b = new Mesh(new BoxGeometry(w, h, d), [mat, mat, topMat, mat, mat, mat]);
  b.position.set(cx, h/2, cz);
  b.castShadow = true;
  b.receiveShadow = true;
  scene.add(b);
  buildings.push({ x: cx, z: cz, w: w/2 + 0.5, d: d/2 + 0.5, h, mesh: b });
  buildingMeshes.push(b);

  // Occasional rooftop antenna
  if (h > 18 && Math.random() < 0.5) {
    const ant = new Mesh(
      new CylinderGeometry(0.05, 0.05, 4 + Math.random()*4, 6),
      new MeshStandardMaterial({ color: 0x222226 })
    );
    ant.position.set(cx + (Math.random()-0.5)*w*0.6, h + 2, cz + (Math.random()-0.5)*d*0.6);
    ant.castShadow = true;
    scene.add(ant);
  }
}

// Populate each block with 2-4 buildings + props
for (let bx = 0; bx < GRID; bx++) {
  for (let bz = 0; bz < GRID; bz++) {
    const cx0 = -HALF + bx * BLOCK + BLOCK/2;
    const cz0 = -HALF + bz * BLOCK + BLOCK/2;
    const usable = BLOCK - ROAD - 4;
    // Park block ~15%
    if (Math.random() < 0.12) {
      // Grass park with trees
      const grass = new Mesh(
        new PlaneGeometry(usable, usable),
        new MeshStandardMaterial({ color: 0x4d6b3a, roughness: 0.9 })
      );
      grass.rotation.x = -Math.PI/2;
      grass.position.set(cx0, 0.05, cz0);
      grass.receiveShadow = true;
      scene.add(grass);
      // Trees
      for (let t = 0; t < 6; t++) {
        const tx = cx0 + (Math.random()-0.5) * usable * 0.8;
        const tz = cz0 + (Math.random()-0.5) * usable * 0.8;
        makeTree(tx, tz);
      }
      continue;
    }
    const district = getDistrictAt(cx0, cz0);
    const count = district.id === 'downtown' ? 3 : (district.id === 'industrial' || district.id === 'harbor' ? 1 + Math.floor(Math.random()*2) : 2 + Math.floor(Math.random()*2));
    for (let n = 0; n < count; n++) {
      const px = cx0 + (Math.random()-0.5) * (usable - 8);
      const pz = cz0 + (Math.random()-0.5) * (usable - 8);
      placeBuilding(px, pz, bx, bz);
    }
  }
}

function makeTree(x, z) {
  const g = new Group();
  const trunk = new Mesh(
    new CylinderGeometry(0.25, 0.35, 2.5, 6),
    new MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 })
  );
  trunk.position.y = 1.25;
  trunk.castShadow = true;
  g.add(trunk);
  const foliage = new Mesh(
    new SphereGeometry(1.6 + Math.random()*0.6, 8, 6),
    new MeshStandardMaterial({ color: new Color().setHSL(0.28 + Math.random()*0.05, 0.6, 0.3) })
  );
  foliage.position.y = 3.2;
  foliage.castShadow = true;
  g.add(foliage);
  g.position.set(x, 0, z);
  scene.add(g);
  buildings.push({ x, z, w: 0.7, d: 0.7, h: 4, mesh: g });
}

// -------------------- STREET LAMPS --------------------
const cityStreetLamps = [];
for (let i = 0; i <= GRID; i++) {
  for (let j = 0; j < GRID; j++) {
    if (Math.random() < 0.7) {
      const x = -HALF + j * BLOCK + BLOCK/2;
      const z = -HALF + i * BLOCK;
      makeLamp(x, z + ROAD/2 + 1.5);
    }
    if (Math.random() < 0.7) {
      const z = -HALF + j * BLOCK + BLOCK/2;
      const x = -HALF + i * BLOCK;
      makeLamp(x + ROAD/2 + 1.5, z);
    }
  }
}
function makeLamp(x, z) {
  const g = new Group();
  const pole = new Mesh(
    new CylinderGeometry(0.1, 0.12, 5, 6),
    new MeshStandardMaterial({ color: 0x222226 })
  );
  pole.position.y = 2.5; pole.castShadow = true;
  g.add(pole);
  const arm = new Mesh(
    new BoxGeometry(1.2, 0.1, 0.1),
    new MeshStandardMaterial({ color: 0x222226 })
  );
  arm.position.set(0.6, 4.95, 0);
  g.add(arm);
  const bulb = new Mesh(
    new SphereGeometry(0.18, 8, 6),
    new MeshStandardMaterial({ color: 0xffe4b5, emissive: 0xffd28a, emissiveIntensity: 1.5 })
  );
  bulb.position.set(1.2, 4.85, 0);
  g.add(bulb);
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  scene.add(g);
  cityStreetLamps.push({ group: g, bulb });
}

// -------------------- CITY LOCATIONS / AMBIENT SCENES --------------------
const cityLocations = [];
const citySceneActors = [];
const cityBillboards = [];
const reservedAreas = [];
const placedProps = [];

function areaOverlaps(a, b, padding = 0) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 + padding &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 + padding;
}

function isOnRoad(x, z, padding = 1.4) {
  for (let i = 0; i <= GRID; i++) {
    const roadPos = -HALF + i * BLOCK;
    if (Math.abs(z - roadPos) < ROAD / 2 + padding || Math.abs(x - roadPos) < ROAD / 2 + padding) return true;
  }
  return false;
}

function isAreaClear(x, z, w, d, padding = 1.5) {
  const area = { x, z, w, d };
  for (const reserved of reservedAreas) {
    if (areaOverlaps(area, reserved, padding)) return false;
  }
  for (const b of buildings) {
    if (areaOverlaps(area, { x: b.x, z: b.z, w: b.w * 2, d: b.d * 2 }, padding)) return false;
  }
  return true;
}

function reserveArea(x, z, w, d, padding = 0) {
  reservedAreas.push({ x, z, w: w + padding * 2, d: d + padding * 2 });
}

function removeMeshFromScene(mesh) {
  if (!mesh) return;
  if (mesh.parent) mesh.parent.remove(mesh);
  else scene.remove(mesh);
}

function removeOverlappingBuildings(x, z, w, d, padding = 2) {
  const area = { x, z, w, d };
  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i];
    if (!areaOverlaps(area, { x: b.x, z: b.z, w: b.w * 2, d: b.d * 2 }, padding)) continue;
    removeMeshFromScene(b.mesh);
    const meshIndex = buildingMeshes.indexOf(b.mesh);
    if (meshIndex !== -1) buildingMeshes.splice(meshIndex, 1);
    buildings.splice(i, 1);
  }
}

function isPointReserved(x, z, radius = 1.2) {
  for (const area of reservedAreas) {
    if (Math.abs(x - area.x) < area.w / 2 + radius && Math.abs(z - area.z) < area.d / 2 + radius) return true;
  }
  for (const prop of placedProps) {
    if (Math.hypot(x - prop.x, z - prop.z) < prop.radius + radius) return true;
  }
  return false;
}

function findSafePoint(x, z, radius = 1.2, options = {}) {
  const avoidRoad = options.avoidRoad !== false;
  const maxRadius = options.maxRadius || 10;
  const candidates = [[x, z]];
  for (let r = 2; r <= maxRadius; r += 2) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      candidates.push([x + Math.cos(a) * r, z + Math.sin(a) * r]);
    }
  }
  for (const [cx, cz] of candidates) {
    if (Math.abs(cx) > HALF - 3 || Math.abs(cz) > HALF - 3) continue;
    if (avoidRoad && isOnRoad(cx, cz, radius)) continue;
    if (collidesAtPoint(cx, cz, radius)) continue;
    if (isPointReserved(cx, cz, radius)) continue;
    return [cx, cz];
  }
  return [x, z];
}

function collidesAtPoint(x, z, radius = 0.8) {
  for (const b of buildings) {
    if (Math.abs(x - b.x) < b.w + radius && Math.abs(z - b.z) < b.d + radius) return true;
  }
  return false;
}

function makeTextTexture(text, bg = '#111118', fg = '#ffd200', glow = '#ff5900') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = glow;
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, c.width - 20, c.height - 20);
  ctx.font = '700 72px IBM Plex Mono, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fg;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 18;
  ctx.fillText(text, c.width / 2, c.height / 2 + 4);
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function makeSign(text, color = '#ffd200', glow = '#ff5900', width = 7, height = 2.2) {
  const sign = new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({
      map: makeTextTexture(text, '#101018', color, glow),
      transparent: true,
    })
  );
  return sign;
}

function makeNeonLight(x, y, z, color, intensity = 1.8, distance = 18) {
  const light = new PointLight(color, intensity, distance);
  light.position.set(x, y, z);
  scene.add(light);
  return light;
}

function makeBench(x, z) {
  [x, z] = findSafePoint(x, z, 1.4);
  const g = new Group();
  const mat = new MeshStandardMaterial({ color: 0x6a3a20, roughness: 0.75 });
  const metal = new MeshStandardMaterial({ color: 0x202028, roughness: 0.55, metalness: 0.4 });
  const seat = new Mesh(new BoxGeometry(2.4, 0.18, 0.55), mat);
  seat.position.y = 0.72;
  const back = new Mesh(new BoxGeometry(2.4, 0.16, 0.48), mat);
  back.position.set(0, 1.05, -0.34);
  back.rotation.x = -0.22;
  g.add(seat, back);
  for (const lx of [-0.85, 0.85]) {
    const leg = new Mesh(new BoxGeometry(0.12, 0.65, 0.12), metal);
    leg.position.set(lx, 0.34, 0.16);
    g.add(leg);
  }
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() < 0.5 ? 0 : Math.PI / 2;
  scene.add(g);
  placedProps.push({ x, z, radius: 1.9 });
}

function makeTrashCan(x, z) {
  [x, z] = findSafePoint(x, z, 0.9);
  const can = new Mesh(
    new CylinderGeometry(0.35, 0.42, 0.9, 10),
    new MeshStandardMaterial({ color: 0x2b6b54, roughness: 0.8, metalness: 0.2 })
  );
  can.position.set(x, 0.45, z);
  can.castShadow = true;
  scene.add(can);
  placedProps.push({ x, z, radius: 1.0 });
}

function makeATM(x, z) {
  [x, z] = findSafePoint(x, z, 1.1);
  const g = new Group();
  const body = new Mesh(
    new BoxGeometry(1.4, 2.1, 0.65),
    new MeshStandardMaterial({ color: 0x1d2430, roughness: 0.45, metalness: 0.25 })
  );
  body.position.y = 1.05;
  body.castShadow = true;
  const screen = new Mesh(
    new BoxGeometry(0.85, 0.45, 0.05),
    new MeshStandardMaterial({ color: 0x88c8ff, emissive: 0x00c3ff, emissiveIntensity: 0.8 })
  );
  screen.position.set(0, 1.35, 0.36);
  g.add(body, screen);
  g.position.set(x, 0, z);
  scene.add(g);
  placedProps.push({ x, z, radius: 1.3 });
}

function makeBillboard(x, z, text, color = '#00c3ff') {
  [x, z] = findSafePoint(x, z, 2.4);
  const g = new Group();
  const poleMat = new MeshStandardMaterial({ color: 0x24242c, roughness: 0.65, metalness: 0.45 });
  const pole = new Mesh(new CylinderGeometry(0.12, 0.16, 5.4, 8), poleMat);
  pole.position.y = 2.7;
  const board = makeSign(text, color, '#ff5900', 8.5, 2.8);
  board.position.set(0, 5.5, 0.08);
  g.add(pole, board);
  g.position.set(x, 0, z);
  scene.add(g);
  cityBillboards.push(board);
  placedProps.push({ x, z, radius: 3.2 });
}

function makeSceneActor(x, z, color = 0xffd200, mode = 'idle') {
  const offMap = Math.abs(x) > HALF || Math.abs(z) > HALF;
  if (!offMap) [x, z] = findSafePoint(x, z, 0.9, { avoidRoad: mode !== 'dance' });
  const g = new Group();
  const body = new Mesh(new BoxGeometry(0.5, 0.72, 0.32), new MeshStandardMaterial({ color }));
  body.position.y = 1.05;
  const head = new Mesh(new BoxGeometry(0.32, 0.32, 0.32), new MeshStandardMaterial({ color: 0xf0c090 }));
  head.position.y = 1.62;
  const leftLeg = new Mesh(new BoxGeometry(0.17, 0.68, 0.22), new MeshStandardMaterial({ color: 0x181820 }));
  leftLeg.position.set(-0.12, 0.34, 0);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.12;
  const leftArm = new Mesh(new BoxGeometry(0.14, 0.62, 0.18), new MeshStandardMaterial({ color }));
  leftArm.position.set(-0.34, 1.05, 0);
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.34;
  g.add(body, head, leftLeg, rightLeg, leftArm, rightArm);
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  scene.add(g);
  citySceneActors.push({
    group: g, body, leftLeg, rightLeg, leftArm, rightArm,
    originX: x, originZ: z,
    phase: Math.random() * Math.PI * 2,
    hitTimer: 0,
    mode,
  });
  if (!offMap) placedProps.push({ x, z, radius: 1.1 });
  return g;
}

function makeLocationInterior(loc, index) {
  const x = -240 + index * 72;
  const z = 246;
  loc.insidePos = new Vector3(x, 0, z);
  loc.exitPos = new Vector3(x, 0, z + 7);

  const floor = new Mesh(
    new PlaneGeometry(34, 28),
    new MeshStandardMaterial({ color: loc.floorColor || 0x202030, roughness: 0.72 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(x, 0.06, z);
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new MeshStandardMaterial({ color: loc.wallColor || 0x181820, roughness: 0.65 });
  for (const [wx, wz, ww, wd] of [[0, -14, 34, 0.5], [0, 14, 34, 0.5], [-17, 0, 0.5, 28], [17, 0, 0.5, 28]]) {
    const wall = new Mesh(new BoxGeometry(ww, 4.4, wd), wallMat);
    wall.position.set(x + wx, 2.2, z + wz);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
  }

  const exitSign = makeSign('EXIT', '#ffd200', '#00c3ff', 4, 1.2);
  exitSign.position.set(x, 2.5, z + 13.7);
  exitSign.rotation.y = Math.PI;
  scene.add(exitSign);

  if (loc.type === 'bar') {
    const bar = new Mesh(
      new BoxGeometry(13, 1.15, 2),
      new MeshStandardMaterial({ color: 0x241018, roughness: 0.45, metalness: 0.25 })
    );
    bar.position.set(x, 0.58, z + 8);
    scene.add(bar);
    const bartender = makeSceneActor(x, z + 6.4, 0xffd200, 'idle');
    bartender.rotation.y = Math.PI;

    const stage = new Mesh(
      new CylinderGeometry(5, 5, 0.22, 24),
      new MeshStandardMaterial({ color: 0x302038, emissive: 0x301040, emissiveIntensity: 0.45 })
    );
    stage.position.set(x, 0.2, z - 3);
    scene.add(stage);
    loc.danceFloor = stage;
    loc.effectLights = [
      makeNeonLight(x - 7, 3.5, z - 4, 0xff00cc, 2.4, 22),
      makeNeonLight(x + 7, 3.5, z - 4, 0x00c3ff, 2.4, 22),
    ];
    for (let i = 0; i < 6; i++) {
      makeSceneActor(x - 5 + i * 2, z - 2 + (i % 2) * 2, i % 2 ? 0x00c3ff : 0xff5900, 'dance');
    }
  } else if (loc.type === 'bank') {
    const counter = new Mesh(new BoxGeometry(14, 1.5, 1.2), new MeshStandardMaterial({ color: 0xa88c58, roughness: 0.55 }));
    counter.position.set(x, 0.75, z - 5);
    scene.add(counter);
    const vault = new Mesh(new CylinderGeometry(2.2, 2.2, 0.45, 24), new MeshStandardMaterial({ color: 0x889098, roughness: 0.3, metalness: 0.8 }));
    vault.rotation.x = Math.PI / 2;
    vault.position.set(x + 11, 2.2, z - 13.75);
    scene.add(vault);
    loc.vault = vault;
    loc.vaultPos = new Vector3(x + 11, 0, z - 11.6);
    loc.alarmLight = makeNeonLight(x, 4, z - 4, 0xff3030, 0, 24);
    loc.effectLights = [makeNeonLight(x, 4, z - 5, 0xffd200, 1.4, 18)];
    for (let i = 0; i < 3; i++) makeSceneActor(x - 5 + i * 5, z + 2, 0x1f5fff, 'guard');
  } else if (loc.type === 'police') {
    const desk = new Mesh(new BoxGeometry(11, 1.2, 2), new MeshStandardMaterial({ color: 0x1d2d46, roughness: 0.55, metalness: 0.18 }));
    desk.position.set(x, 0.6, z + 4.5);
    scene.add(desk);
    makeNeonLight(x, 3.2, z + 1, loc.lightColor, 1.6, 20);
    for (let i = 0; i < 2; i++) makeSceneActor(x - 3 + i * 6, z + 2.6, 0x1f5fff, 'guard');

    const barMat = new MeshStandardMaterial({ color: 0x9aa4b2, roughness: 0.34, metalness: 0.75 });
    const cellWallMat = new MeshStandardMaterial({ color: 0x334154, roughness: 0.68 });
    const cellBack = new Mesh(new BoxGeometry(12, 3.0, 0.22), cellWallMat);
    cellBack.position.set(x - 3.6, 1.5, z - 11.2);
    scene.add(cellBack);
    for (const cx of [x - 9.6, x + 2.4]) {
      const side = new Mesh(new BoxGeometry(0.22, 3.0, 6.6), cellWallMat);
      side.position.set(cx, 1.5, z - 7.9);
      scene.add(side);
    }
    const topRail = new Mesh(new BoxGeometry(11.6, 0.14, 0.16), barMat);
    topRail.position.set(x - 3.6, 3.05, z - 4.65);
    const bottomRail = new Mesh(new BoxGeometry(11.6, 0.14, 0.16), barMat);
    bottomRail.position.set(x - 3.6, 0.35, z - 4.65);
    scene.add(topRail, bottomRail);
    for (let i = 0; i < 9; i++) {
      const bar = new Mesh(new CylinderGeometry(0.045, 0.045, 2.7, 8), barMat);
      bar.position.set(x - 8.2 + i * 1.15, 1.7, z - 4.65);
      scene.add(bar);
    }
    const bunk = new Mesh(new BoxGeometry(3.2, 0.35, 1.5), new MeshStandardMaterial({ color: 0x303844, roughness: 0.65 }));
    bunk.position.set(x - 1.4, 0.55, z - 9.6);
    scene.add(bunk);
    loc.jailCellPos = new Vector3(x - 5.2, 0, z - 8.2);
    loc.jailCameraPos = new Vector3(x + 3.6, 3.0, z - 1.4);
    loc.releasePos = new Vector3(x, 0, z + 8);
  } else if (loc.type === 'casino') {
    const table = new Mesh(
      new CylinderGeometry(5.2, 5.2, 0.35, 32),
      new MeshStandardMaterial({ color: 0x07503a, roughness: 0.48, metalness: 0.08, emissive: 0x022018, emissiveIntensity: 0.35 })
    );
    table.scale.z = 0.62;
    table.position.set(x, 0.42, z - 2.5);
    scene.add(table);
    loc.blackjackPos = new Vector3(x, 0, z - 2.5);

    const rail = new Mesh(
      new THREE.TorusGeometry(5.25, 0.12, 8, 36),
      new MeshStandardMaterial({ color: 0xffd200, roughness: 0.35, metalness: 0.35, emissive: 0x403000, emissiveIntensity: 0.5 })
    );
    rail.rotation.x = Math.PI / 2;
    rail.scale.y = 0.62;
    rail.position.set(x, 0.64, z - 2.5);
    scene.add(rail);

    const tableSign = makeSign('BLACKJACK', '#ffd200', '#ff00cc', 7, 1.5);
    tableSign.position.set(x, 2.4, z - 8.2);
    scene.add(tableSign);

    const chipColors = [0xff3030, 0x00c3ff, 0xffd200, 0xffffff];
    for (let i = 0; i < 8; i++) {
      const chip = new Mesh(
        new CylinderGeometry(0.28, 0.28, 0.08, 16),
        new MeshStandardMaterial({ color: chipColors[i % chipColors.length], emissive: chipColors[i % chipColors.length], emissiveIntensity: 0.18 })
      );
      chip.position.set(x - 2.6 + (i % 4) * 0.55, 0.72 + Math.floor(i / 4) * 0.09, z - 2.6);
      scene.add(chip);
    }

    const dealer = makeSceneActor(x, z - 6.5, 0xffd200, 'idle');
    dealer.rotation.y = 0;
    makeNeonLight(x - 7, 3.2, z - 3.5, 0xff00cc, 1.7, 18);
    makeNeonLight(x + 7, 3.2, z - 3.5, 0x00c3ff, 1.7, 18);
    for (let i = 0; i < 4; i++) makeSceneActor(x - 6 + i * 4, z + 2, i % 2 ? 0x00c3ff : 0xff5900, 'idle');
  } else {
    const service = new Mesh(new BoxGeometry(10, 1.2, 2.2), new MeshStandardMaterial({ color: loc.color, roughness: 0.55 }));
    service.position.set(x, 0.6, z - 5);
    scene.add(service);
    makeNeonLight(x, 3.2, z - 2, loc.lightColor, 1.5, 20);
    for (let i = 0; i < 3; i++) makeSceneActor(x - 4 + i * 4, z + 1, loc.color, 'idle');
  }
}

function makeLocation(opts, index) {
  removeOverlappingBuildings(opts.x, opts.z, opts.w + 12, opts.d + 14, 3);
  removeOverlappingBuildings(opts.x, opts.z + opts.d / 2 + 4, 7, 8, 2);
  reserveArea(opts.x, opts.z, opts.w, opts.d, 5);
  reserveArea(opts.x, opts.z + opts.d / 2 + 4, 7, 8, 1);
  const loc = {
    id: opts.id,
    type: opts.type,
    label: opts.label,
    prompt: opts.prompt,
    mapColor: opts.mapColor,
    color: opts.color,
    lightColor: opts.lightColor,
    x: opts.x,
    z: opts.z,
    entrance: new Vector3(opts.x, 0, opts.z + opts.d / 2 + 4),
    radius: opts.radius || 7,
    alertRadius: opts.alertRadius || 13,
  };

  const g = new Group();
  const mat = new MeshStandardMaterial({
    color: opts.color,
    roughness: 0.62,
    metalness: 0.12,
    emissive: opts.emissive || 0x000000,
    emissiveIntensity: opts.emissiveIntensity || 0,
  });
  const building = new Mesh(new BoxGeometry(opts.w, opts.h, opts.d), mat);
  building.position.y = opts.h / 2;
  building.castShadow = true;
  building.receiveShadow = true;
  g.add(building);

  const door = new Mesh(
    new BoxGeometry(2.2, 2.9, 0.14),
    new MeshStandardMaterial({ color: 0x111118, roughness: 0.35, metalness: 0.25 })
  );
  door.position.set(0, 1.45, opts.d / 2 + 0.08);
  g.add(door);

  const sign = makeSign(opts.label, opts.signColor, opts.signGlow, opts.signWidth || 7, 2);
  sign.position.set(0, Math.min(opts.h - 1, 5.4), opts.d / 2 + 0.12);
  g.add(sign);

  const marker = new Mesh(
    new CylinderGeometry(1.8, 1.8, 0.08, 32),
    new MeshBasicMaterial({ color: opts.markerColor, transparent: true, opacity: 0.42 })
  );
  marker.position.set(0, 0.08, opts.d / 2 + 3.7);
  g.add(marker);

  g.position.set(opts.x, 0, opts.z);
  scene.add(g);
  loc.group = g;
  loc.light = makeNeonLight(opts.x, 4.2, opts.z + opts.d / 2 + 3, opts.lightColor, opts.lightIntensity || 1.4, 22);
  cityLocations.push(loc);
  buildings.push({ x: opts.x, z: opts.z, w: opts.w / 2 + 0.5, d: opts.d / 2 + 0.5, h: opts.h, mesh: building });
  buildingMeshes.push(building);

  makeLocationInterior(loc, index);
  return loc;
}

function makeContainerStack(x, z, cols = 3) {
  const colors = [0x2080ff, 0xff7030, 0x10b070, 0xffd200];
  for (let i = 0; i < cols; i++) {
    const c = new Mesh(
      new BoxGeometry(4, 1.8, 1.8),
      new MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.65, metalness: 0.25 })
    );
    c.position.set(x + i * 4.4, 0.9, z + (i % 2) * 2.2);
    c.castShadow = true;
    scene.add(c);
  }
}

function addHelipadProps(loc) {
  const pad = new Mesh(
    new CylinderGeometry(7, 7, 0.12, 32),
    new MeshStandardMaterial({ color: 0x202830, roughness: 0.5, metalness: 0.2 })
  );
  pad.position.set(loc.x, 0.12, loc.z + 2);
  scene.add(pad);
  const h = makeSign('H', '#88c8ff', '#00c3ff', 4, 4);
  h.rotation.x = -Math.PI / 2;
  h.position.set(loc.x, 0.2, loc.z + 2);
  scene.add(h);
}

function addHarborProps(loc) {
  const water = new Mesh(
    new PlaneGeometry(36, 24),
    new MeshBasicMaterial({ color: 0x12344a, transparent: true, opacity: 0.55 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(loc.x - 10, 0.03, loc.z - 4);
  scene.add(water);
  makeContainerStack(loc.x + 8, loc.z - 4, 4);
  const crane = new Group();
  crane.add(new Mesh(new BoxGeometry(0.45, 8, 0.45), new MeshStandardMaterial({ color: 0xffd200, roughness: 0.45 })));
  const arm = new Mesh(new BoxGeometry(9, 0.35, 0.35), new MeshStandardMaterial({ color: 0xffd200, roughness: 0.45 }));
  arm.position.set(4.2, 4.1, 0);
  crane.add(arm);
  crane.position.set(loc.x - 12, 0, loc.z - 7);
  scene.add(crane);
}

function addCasinoProps(loc) {
  for (let i = 0; i < 5; i++) {
    const chip = new Mesh(
      new CylinderGeometry(0.55, 0.55, 0.12, 18),
      new MeshStandardMaterial({ color: i % 2 ? 0xff3030 : 0x00c3ff, emissive: i % 2 ? 0x401010 : 0x003040, emissiveIntensity: 0.4 })
    );
    chip.position.set(loc.x - 5 + i * 2.5, 0.25, loc.entrance.z - 1.8);
    scene.add(chip);
  }
}

function addStadiumProps(loc) {
  const ring = new Mesh(
    new CylinderGeometry(16, 16, 5, 48, 1, true),
    new MeshStandardMaterial({ color: 0x343848, roughness: 0.6, metalness: 0.15, side: DoubleSide })
  );
  ring.position.set(loc.x, 2.5, loc.z);
  scene.add(ring);
  for (const [dx, dz] of [[-14, -9], [14, -9], [-14, 9], [14, 9]]) {
    const pole = new Mesh(new CylinderGeometry(0.16, 0.18, 8, 8), new MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.6 }));
    pole.position.set(loc.x + dx, 4, loc.z + dz);
    scene.add(pole);
  }
}

function addFireStationProps(loc) {
  const truck = makeCar(0xd82020);
  truck.group.position.set(loc.x - 8, 0, loc.entrance.z - 2.5);
  truck.group.rotation.y = Math.PI / 2;
  scene.add(truck.group);
  makeNeonLight(loc.x, 3.2, loc.entrance.z, 0xff3030, 1.2, 16);
}

function addHospitalProps(loc) {
  const crossA = new Mesh(new BoxGeometry(1.0, 4.2, 0.18), new MeshBasicMaterial({ color: 0xff3030 }));
  const crossB = new Mesh(new BoxGeometry(3.0, 1.0, 0.18), new MeshBasicMaterial({ color: 0xff3030 }));
  crossA.position.set(loc.x, 6.4, loc.z + 8.1);
  crossB.position.copy(crossA.position);
  scene.add(crossA, crossB);
}

function addRadioTowerProps(loc) {
  const tower = new Group();
  const mat = new MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.35, metalness: 0.55 });
  for (const x of [-1.4, 1.4]) {
    const leg = new Mesh(new CylinderGeometry(0.08, 0.14, 26, 6), mat);
    leg.position.set(x, 13, 0);
    leg.rotation.z = x > 0 ? -0.08 : 0.08;
    tower.add(leg);
  }
  for (let y = 4; y < 24; y += 4) {
    const brace = new Mesh(new BoxGeometry(3.2, 0.08, 0.08), mat);
    brace.position.y = y;
    tower.add(brace);
  }
  const beacon = new Mesh(new SphereGeometry(0.5, 12, 8), new MeshStandardMaterial({ color: 0xff3030, emissive: 0xff3030, emissiveIntensity: 1.8 }));
  beacon.position.y = 27;
  tower.add(beacon);
  tower.position.set(loc.x, 0, loc.z - 2);
  scene.add(tower);
  loc.beacon = beacon;
}

function decorateLocation(loc) {
  if (loc.id === 'airport') addHelipadProps(loc);
  if (loc.id === 'harbor') addHarborProps(loc);
  if (loc.id === 'casino') addCasinoProps(loc);
  if (loc.id === 'stadium') addStadiumProps(loc);
  if (loc.id === 'fire') addFireStationProps(loc);
  if (loc.id === 'hospital') addHospitalProps(loc);
  if (loc.id === 'radio') addRadioTowerProps(loc);
}

function makeLocationProps() {
  makeBillboard(-2, -88, 'MIDNIGHT FM', '#ff5900');
  makeBillboard(72, 8, 'CITY SALE', '#00c3ff');
  makeBillboard(-128, 126, 'INDUSTRIAL', '#ffd200');
  makeBillboard(126, 126, 'UPTOWN', '#10b070');
  makeATM(24, -55);
  makeATM(-96, 24);
  makeContainerStack(-132, 126, 4);
  makeContainerStack(-92, 112, 3);
  for (const [x, z] of [[-71, -51], [-50, -51], [58, -51], [101, 27], [-17, 64], [20, 67]]) makeBench(x, z);
  for (const [x, z] of [[-112, -126], [-96, -124], [120, 108], [138, 102], [104, 138]]) makeBench(x, z);
  for (const [x, z] of [[-71, -55], [-52, -56], [58, -56], [99, 31], [-20, 69], [23, 70], [62, 70]]) makeTrashCan(x, z);

  makeSceneActor(-70, -54, 0xff5900, 'dance');
  makeSceneActor(-66, -54, 0x00c3ff, 'dance');
  makeSceneActor(27, -54, 0x1f5fff, 'guard');
  makeSceneActor(31, -54, 0x1f5fff, 'guard');
  makeSceneActor(101, 23, 0x10b070, 'idle');
  makeSceneActor(97, 26, 0xffd200, 'idle');
  makeSceneActor(-16, 67, 0xff7030, 'idle');
  makeSceneActor(18, 65, 0xf0f0f0, 'idle');
  makeSceneActor(-116, -126, 0x00c3ff, 'idle');
  makeSceneActor(-108, -124, 0xffd200, 'idle');
  makeSceneActor(118, 110, 0x10b070, 'idle');
  makeSceneActor(128, 104, 0xff7030, 'idle');
}

makeLocation({
  id: 'nightclub',
  type: 'bar',
  label: 'NIGHT CLUB',
  prompt: 'ENTER BAR',
  mapColor: '#ff00cc',
  markerColor: 0xff00cc,
  color: 0x221028,
  lightColor: 0xff00cc,
  signColor: '#ff80f0',
  signGlow: '#ff00cc',
  signWidth: 9,
  x: -62, z: -62, w: 18, d: 12, h: 9,
  emissive: 0x1a0018,
  emissiveIntensity: 0.18,
}, 0);
makeLocation({
  id: 'bank',
  type: 'bank',
  label: 'BANK',
  prompt: 'ENTER BANK',
  mapColor: '#ffd200',
  markerColor: 0xffd200,
  color: 0x777068,
  lightColor: 0xffd200,
  signColor: '#fff2a0',
  signGlow: '#ffd200',
  x: 20, z: -62, w: 18, d: 13, h: 12,
}, 1);
makeLocation({
  id: 'police',
  type: 'police',
  label: 'POLICE',
  prompt: 'ENTER POLICE',
  mapColor: '#2080ff',
  markerColor: 0x2080ff,
  color: 0x283a56,
  lightColor: 0x2080ff,
  signColor: '#88c8ff',
  signGlow: '#2080ff',
  x: 102, z: 22, w: 18, d: 12, h: 10,
}, 2);
makeLocation({
  id: 'gas',
  type: 'gas',
  label: 'GAS',
  prompt: 'ENTER GAS STATION',
  mapColor: '#10b070',
  markerColor: 0x10b070,
  color: 0x204035,
  lightColor: 0x10b070,
  signColor: '#96ffd0',
  signGlow: '#10b070',
  x: -20, z: 62, w: 16, d: 11, h: 7,
}, 3);
makeLocation({
  id: 'garage',
  type: 'garage',
  label: 'GARAGE',
  prompt: 'ENTER GARAGE',
  mapColor: '#ff7030',
  markerColor: 0xff7030,
  color: 0x3b3630,
  lightColor: 0xff7030,
  signColor: '#ffd0a0',
  signGlow: '#ff7030',
  x: 20, z: 62, w: 18, d: 12, h: 8,
}, 4);
makeLocation({
  id: 'shop',
  type: 'shop',
  label: 'SHOP',
  prompt: 'ENTER SHOP',
  mapColor: '#00c3ff',
  markerColor: 0x00c3ff,
  color: 0x23364a,
  lightColor: 0x00c3ff,
  signColor: '#b8f2ff',
  signGlow: '#00c3ff',
  x: 62, z: 62, w: 17, d: 11, h: 8,
}, 5);

decorateLocation(makeLocation({
  id: 'airport',
  type: 'airport',
  label: 'HELIPAD',
  prompt: 'VISIT HELIPAD',
  mapColor: '#88c8ff',
  markerColor: 0x88c8ff,
  color: 0x263240,
  lightColor: 0x88c8ff,
  signColor: '#d8f4ff',
  signGlow: '#00c3ff',
  x: -140, z: -140, w: 30, d: 18, h: 7,
}, 6));
decorateLocation(makeLocation({
  id: 'harbor',
  type: 'harbor',
  label: 'HARBOR',
  prompt: 'ENTER HARBOR',
  mapColor: '#2fd4ff',
  markerColor: 0x2fd4ff,
  color: 0x23384a,
  lightColor: 0x00c3ff,
  signColor: '#b8f2ff',
  signGlow: '#00c3ff',
  x: -100, z: -140, w: 24, d: 18, h: 7,
}, 7));
decorateLocation(makeLocation({
  id: 'casino',
  type: 'casino',
  label: 'CASINO',
  prompt: 'ENTER CASINO',
  mapColor: '#ff00cc',
  markerColor: 0xff00cc,
  color: 0x2a1438,
  lightColor: 0xff00cc,
  signColor: '#ffb8f2',
  signGlow: '#ff00cc',
  x: 100, z: -100, w: 22, d: 16, h: 13,
  emissive: 0x240018,
  emissiveIntensity: 0.16,
}, 8));
decorateLocation(makeLocation({
  id: 'hotel',
  type: 'hotel',
  label: 'HOTEL',
  prompt: 'ENTER HOTEL',
  mapColor: '#ffd200',
  markerColor: 0xffd200,
  color: 0x544436,
  lightColor: 0xffd200,
  signColor: '#fff2a0',
  signGlow: '#ffd200',
  x: 140, z: -60, w: 18, d: 14, h: 22,
}, 9));
decorateLocation(makeLocation({
  id: 'stadium',
  type: 'stadium',
  label: 'STADIUM',
  prompt: 'ENTER STADIUM',
  mapColor: '#f0f0f0',
  markerColor: 0xf0f0f0,
  color: 0x343848,
  lightColor: 0xf0f0f0,
  signColor: '#ffffff',
  signGlow: '#88c8ff',
  x: 100, z: -140, w: 34, d: 22, h: 6,
}, 10));
decorateLocation(makeLocation({
  id: 'fire',
  type: 'fire',
  label: 'FIRE',
  prompt: 'ENTER FIRE STATION',
  mapColor: '#ff3030',
  markerColor: 0xff3030,
  color: 0x542020,
  lightColor: 0xff3030,
  signColor: '#ffd0d0',
  signGlow: '#ff3030',
  x: -100, z: 100, w: 22, d: 14, h: 8,
}, 11));
decorateLocation(makeLocation({
  id: 'hospital',
  type: 'hospital',
  label: 'HOSPITAL',
  prompt: 'ENTER HOSPITAL',
  mapColor: '#ff3030',
  markerColor: 0xff3030,
  color: 0xe8e8e8,
  lightColor: 0xff3030,
  signColor: '#ffffff',
  signGlow: '#ff3030',
  x: 100, z: 100, w: 24, d: 16, h: 12,
}, 12));
decorateLocation(makeLocation({
  id: 'radio',
  type: 'radio',
  label: 'RADIO',
  prompt: 'VISIT RADIO TOWER',
  mapColor: '#00c3ff',
  markerColor: 0x00c3ff,
  color: 0x273448,
  lightColor: 0x00c3ff,
  signColor: '#b8f2ff',
  signGlow: '#00c3ff',
  x: -140, z: 100, w: 18, d: 12, h: 9,
}, 13));

makeLocationProps();
