// -------------------- PLAYROOM MULTIPLAYER PRESENCE --------------------
// Client code must only use the public gameId. Keep the Playroom API key server-side.
const GTAOnline = (() => {
  const GAME_ID = 'z2t6AJgj7IrYbAUoi4uD';
  const MAX_PLAYERS = 4;
  const SEND_HZ = 15;
  const LERP_SPEED = 12;

  const onlinePanelEl = document.getElementById('onlinePanel');
  const onlineStateEl = document.getElementById('onlineState');
  const onlineRoomEl = document.getElementById('onlineRoom');
  const remotePlayers = new Map();

  const state = {
    launched: false,
    connected: false,
    sendTimer: 0,
    roomCode: '',
    playerCount: 1,
  };

  function playroomApi() {
    return window.Playroom || window.PlayroomKit || window.playroomkit || null;
  }

  function setOnlinePanel(label, roomText, online) {
    if (!onlinePanelEl) return;
    onlinePanelEl.classList.toggle('online', !!online);
    onlinePanelEl.classList.toggle('offline', !online);
    if (onlineStateEl) onlineStateEl.textContent = label;
    if (onlineRoomEl) {
      onlineRoomEl.textContent = roomText || '';
      onlineRoomEl.style.display = roomText ? '' : 'none';
    }
  }

  function parseColor(value, fallback = 0xffd200) {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return fallback;
    const clean = value.replace('#', '').trim();
    const parsed = Number.parseInt(clean, 16);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function profileColor(playerState) {
    const profile = playerState && playerState.getProfile ? playerState.getProfile() : null;
    return parseColor(profile && profile.color && profile.color.hex, 0xffd200);
  }

  function profileName(playerState) {
    const profile = playerState && playerState.getProfile ? playerState.getProfile() : null;
    return (profile && profile.name) || `PLAYER ${String(playerState.id || '').slice(0, 4)}`;
  }

  function createRemoteAvatar(color) {
    const g = new Group();
    const body = new Mesh(
      new BoxGeometry(0.55, 0.75, 0.32),
      new MeshStandardMaterial({ color, roughness: 0.52, metalness: 0.08 })
    );
    body.position.y = 1.15;
    g.add(body);

    const legMat = new MeshStandardMaterial({ color: 0x171720, roughness: 0.6 });
    const leftLeg = new Mesh(new BoxGeometry(0.22, 0.76, 0.28), legMat);
    const rightLeg = new Mesh(new BoxGeometry(0.22, 0.76, 0.28), legMat);
    leftLeg.position.set(-0.14, 0.4, 0);
    rightLeg.position.set(0.14, 0.4, 0);
    g.add(leftLeg, rightLeg);

    const armMat = new MeshStandardMaterial({ color, roughness: 0.52 });
    const leftArm = new Mesh(new BoxGeometry(0.17, 0.76, 0.22), armMat);
    const rightArm = new Mesh(new BoxGeometry(0.17, 0.76, 0.22), armMat);
    leftArm.position.set(-0.34, 1.15, 0);
    rightArm.position.set(0.34, 1.15, 0);
    g.add(leftArm, rightArm);

    const head = new Mesh(
      new BoxGeometry(0.34, 0.34, 0.34),
      new MeshStandardMaterial({ color: 0xf0c090, roughness: 0.55 })
    );
    head.position.y = 1.7;
    g.add(head);

    const cap = new Mesh(
      new BoxGeometry(0.36, 0.12, 0.36),
      new MeshStandardMaterial({ color: 0xff5900, roughness: 0.5 })
    );
    cap.position.y = 1.92;
    g.add(cap);

    const heldItem = new Group();
    g.add(heldItem);
    scene.add(g);

    return {
      group: g,
      body,
      head,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      cap,
      heldItem,
      heldType: '',
      walkPhase: 0,
    };
  }

  function makeNameSprite(label) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(10, 10, 18, 0.72)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255, 210, 0, 0.86)';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    ctx.fillStyle = '#fff';
    ctx.font = '700 22px IBM Plex Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.slice(0, 18).toUpperCase(), canvas.width / 2, canvas.height / 2);

    const texture = new CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sprite.scale.set(3.6, 0.9, 1);
    scene.add(sprite);
    return sprite;
  }

  function setRemoteHeldItem(remote, type) {
    if (remote.avatar.heldType === type) return;
    remote.avatar.heldType = type || 'empty';
    const root = remote.avatar.heldItem;
    while (root.children.length) root.remove(root.children[0]);
    root.position.set(0.58, 1.05, 0.34);
    root.rotation.set(0, 0, 0);

    if (type === 'gun') {
      const gunMat = new MeshStandardMaterial({ color: 0x181820, roughness: 0.35, metalness: 0.6 });
      const barrel = new Mesh(new BoxGeometry(0.16, 0.14, 0.72), gunMat);
      const grip = new Mesh(new BoxGeometry(0.14, 0.34, 0.16), gunMat);
      const sight = new Mesh(new BoxGeometry(0.12, 0.05, 0.2), new MeshBasicMaterial({ color: 0xff3030 }));
      barrel.position.set(0, 0.06, 0.22);
      grip.position.set(0, -0.15, -0.06);
      grip.rotation.x = -0.35;
      sight.position.set(0, 0.16, 0.2);
      root.add(barrel, grip, sight);
    } else if (type === 'object') {
      const box = new Mesh(
        new BoxGeometry(0.46, 0.34, 0.46),
        new MeshStandardMaterial({ color: 0x88c8ff, roughness: 0.55, metalness: 0.15 })
      );
      box.castShadow = true;
      root.add(box);
    }
  }

  function createRemoteVehicle(kind, color) {
    const vehicle = kind === 'bike' ? makeMotorbike(color) : makeCar(color);
    vehicle.group.visible = false;
    scene.add(vehicle.group);
    return vehicle;
  }

  function ensureRemoteVehicle(remote, kind) {
    const vehicleKind = kind === 'bike' ? 'bike' : 'car';
    if (remote.vehicle && remote.vehicleKind === vehicleKind) return remote.vehicle;
    if (remote.vehicle) {
      disposeObjectMaterials(remote.vehicle.group);
      scene.remove(remote.vehicle.group);
    }
    remote.vehicleKind = vehicleKind;
    remote.vehicle = createRemoteVehicle(vehicleKind, remote.color);
    return remote.vehicle;
  }

  function removeRemotePlayer(id) {
    const remote = remotePlayers.get(id);
    if (!remote) return;
    disposeObjectMaterials(remote.avatar.group);
    scene.remove(remote.avatar.group);
    if (remote.vehicle) {
      disposeObjectMaterials(remote.vehicle.group);
      scene.remove(remote.vehicle.group);
    }
    if (remote.label) {
      if (remote.label.material && remote.label.material.map) remote.label.material.map.dispose();
      if (remote.label.material) remote.label.material.dispose();
      scene.remove(remote.label);
    }
    remotePlayers.delete(id);
    updatePlayerCount();
  }

  function registerPlayer(playerState) {
    const api = playroomApi();
    if (!api || !api.myPlayer || playerState.id === api.myPlayer().id || remotePlayers.has(playerState.id)) return;

    const color = profileColor(playerState);
    const remote = {
      state: playerState,
      color,
      avatar: createRemoteAvatar(color),
      vehicle: null,
      vehicleKind: '',
      label: makeNameSprite(profileName(playerState)),
      lastPoseAt: performance.now(),
      lastX: 0,
      lastZ: 0,
    };
    remote.avatar.group.visible = false;
    remotePlayers.set(playerState.id, remote);
    playerState.onQuit(() => removeRemotePlayer(playerState.id));
    updatePlayerCount();
  }

  function updatePlayerCount() {
    state.playerCount = remotePlayers.size + (state.connected ? 1 : 0);
    const roomText = state.roomCode ? `ROOM ${state.roomCode} · ${state.playerCount}/${MAX_PLAYERS}` : `${state.playerCount}/${MAX_PLAYERS}`;
    setOnlinePanel(state.connected ? 'ONLINE' : 'OFFLINE', state.connected ? roomText : '', state.connected);
  }

  function localPose() {
    const driving = !!inVehicle;
    const ref = driving ? inVehicle.group : player.group;
    return {
      x: Number(ref.position.x.toFixed(3)),
      y: Number(ref.position.y.toFixed(3)),
      z: Number(ref.position.z.toFixed(3)),
      yaw: Number((driving ? ref.rotation.y : player.yaw).toFixed(4)),
      lean: Number(ref.rotation.z.toFixed(4)),
      mode: driving ? 'vehicle' : 'foot',
      vehicleKind: driving ? (inVehicle.kind || 'car') : '',
      heldType: player.heldType || 'empty',
      visible: player.group.visible,
      t: performance.now(),
    };
  }

  function publishLocalPose(dt) {
    const api = playroomApi();
    if (!state.connected || !api || !api.myPlayer) return;
    state.sendTimer += dt;
    if (state.sendTimer < 1 / SEND_HZ) return;
    state.sendTimer = 0;
    api.myPlayer().setState('pose', localPose(), false);
  }

  function poseTargetGroup(remote, pose) {
    if (pose.mode === 'vehicle') {
      const vehicle = ensureRemoteVehicle(remote, pose.vehicleKind);
      vehicle.group.visible = true;
      remote.avatar.group.visible = pose.vehicleKind === 'bike';
      return vehicle.group;
    }
    if (remote.vehicle) remote.vehicle.group.visible = false;
    remote.avatar.group.visible = true;
    return remote.avatar.group;
  }

  function angleDelta(from, to) {
    let delta = to - from;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
  }

  function updateRemoteAvatarPose(remote, pose, dt) {
    const avatar = remote.avatar;
    const moving = Math.hypot(avatar.group.position.x - remote.lastX, avatar.group.position.z - remote.lastZ) > 0.015;
    remote.lastX = avatar.group.position.x;
    remote.lastZ = avatar.group.position.z;
    avatar.walkPhase += dt * (moving ? 7.5 : 2.5);
    const stride = Math.sin(avatar.walkPhase);

    avatar.group.rotation.y = pose.yaw || 0;
    avatar.group.rotation.z = pose.lean || 0;
    avatar.leftLeg.rotation.x = moving ? stride * 0.46 : 0;
    avatar.rightLeg.rotation.x = moving ? -stride * 0.46 : 0;
    avatar.leftArm.rotation.x = moving ? -stride * 0.32 : 0.12;
    avatar.rightArm.rotation.x = moving ? stride * 0.32 : 0.12;
    avatar.leftArm.rotation.z = -0.08;
    avatar.rightArm.rotation.z = 0.08;
    avatar.body.position.y = 1.15 + (moving ? Math.abs(stride) * 0.035 : 0);
    setRemoteHeldItem(remote, pose.heldType || 'empty');

    if (pose.heldType === 'gun') {
      avatar.rightArm.rotation.x = -1.25;
      avatar.leftArm.rotation.x = -0.85;
      avatar.heldItem.position.set(0.5, 1.28, 0.58);
    } else if (pose.heldType === 'object') {
      avatar.rightArm.rotation.x = -0.72;
      avatar.leftArm.rotation.x = -0.35;
      avatar.heldItem.rotation.y += dt * 1.8;
    }

    if (pose.mode === 'vehicle' && pose.vehicleKind !== 'bike') avatar.group.visible = false;
    if (pose.mode === 'vehicle' && pose.vehicleKind === 'bike') {
      avatar.group.position.y = (pose.y || 0) + 0.28;
      avatar.body.position.y = 1.02;
      avatar.body.rotation.x = -0.24;
      avatar.head.rotation.x = 0.16;
      avatar.heldItem.visible = false;
      avatar.leftArm.rotation.set(-1.2, 0, -0.36);
      avatar.rightArm.rotation.set(-1.2, 0, 0.36);
      avatar.leftLeg.rotation.set(-0.95, 0, -0.28);
      avatar.rightLeg.rotation.set(-0.95, 0, 0.28);
    } else {
      avatar.body.rotation.x = 0;
      avatar.head.rotation.x = 0;
      avatar.heldItem.visible = true;
    }
  }

  function updateRemotePlayers(dt) {
    const now = performance.now();
    for (const remote of remotePlayers.values()) {
      const pose = remote.state.getState('pose');
      const hasPose = !!pose && Number.isFinite(pose.x) && Number.isFinite(pose.z);
      remote.avatar.group.visible = hasPose && remote.avatar.group.visible;
      if (!hasPose) continue;

      remote.lastPoseAt = pose.t || now;
      const target = poseTargetGroup(remote, pose);
      const alpha = Math.min(1, dt * LERP_SPEED);
      target.position.x += (pose.x - target.position.x) * alpha;
      target.position.y += ((pose.y || 0) - target.position.y) * alpha;
      target.position.z += (pose.z - target.position.z) * alpha;
      target.rotation.y += angleDelta(target.rotation.y, pose.yaw || 0) * alpha;
      target.rotation.z += ((pose.lean || 0) - target.rotation.z) * alpha;

      if (pose.mode === 'vehicle' && pose.vehicleKind === 'bike') {
        remote.avatar.group.position.x = target.position.x;
        remote.avatar.group.position.z = target.position.z;
      }
      updateRemoteAvatarPose(remote, pose, dt);
      if (remote.label) {
        remote.label.visible = now - remote.lastPoseAt < 5000;
        remote.label.position.set(target.position.x, target.position.y + (pose.mode === 'vehicle' ? 3.1 : 2.45), target.position.z);
      }
    }
  }

  async function launch() {
    if (state.launched) return true;
    const api = playroomApi();
    if (!api || !api.insertCoin) {
      state.launched = true;
      setOnlinePanel('OFFLINE', 'LOCAL MODE', false);
      console.warn('Playroom Kit did not load. Starting in local mode.');
      return true;
    }

    try {
      await api.insertCoin({ gameId: GAME_ID, maxPlayersPerRoom: MAX_PLAYERS });
      state.launched = true;
      state.connected = true;
      if (api.getRoomCode) state.roomCode = api.getRoomCode();
      api.onPlayerJoin(registerPlayer);
      api.myPlayer().setState('pose', localPose(), true);
      updatePlayerCount();
      return true;
    } catch (error) {
      console.warn('Playroom launch cancelled or failed.', error);
      setOnlinePanel('OFFLINE', 'LOCAL MODE', false);
      return false;
    }
  }

  function update(dt) {
    publishLocalPose(dt);
    updateRemotePlayers(dt);
  }

  setOnlinePanel('OFFLINE', '', false);

  return {
    launch,
    update,
    get launched() { return state.launched; },
    get connected() { return state.connected; },
  };
})();

window.GTAOnline = GTAOnline;
