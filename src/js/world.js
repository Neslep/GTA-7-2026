// -------------------- GROUND --------------------
const ground = new Mesh(
  new PlaneGeometry(600, 600),
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
  const mat = new MeshStandardMaterial({
    color: new Color().setHSL(baseHue, 0.15 + Math.random()*0.2, 0.25 + Math.random()*0.2),
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
    const count = 2 + Math.floor(Math.random()*3);
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
}
