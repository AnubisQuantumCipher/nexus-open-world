/**
 * NEXUS — Open World Unlimited
 * Browser prototype: free-roam + FPS + racing + voxel build + progression loops.
 * Research-backed hooks: XP/levels, variable loot, quests, combos, multi-mode freedom.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// ─────────────────────────────────────────────────────────────
// DOM
// ─────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const titleScreen = $("title-screen");
const gameRoot = $("game-root");
const canvas = $("c");
const playBtn = $("play-btn");
const resumeBtn = $("resume-btn");
const minimapCanvas = $("minimap");
const minimapCtx = minimapCanvas.getContext("2d");

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────
const state = {
  started: false,
  paused: false,
  settingsOpen: false,
  tigerForm: false, // F = lion form
  mode: "FREE ROAM", // FREE ROAM | RACE | COMBAT | BUILD
  pointerLocked: false,
  keys: {},
  mouse: { dx: 0, dy: 0 },
  clock: new THREE.Clock(),
  elapsed: 0,

  // Player preferences (settings)
  sensitivity: 1,
  invertY: false,
  /** "afk" = monsters never attack · "survival" = monsters hunt you */
  gameMode: "afk",

  // Player stats (addictive progression)
  level: 1,
  xp: 0,
  xpToNext: 100,
  coins: 0, // green coins
  gems: 0,
  purpleGems: 0, // unique purple gems — buy Iron Man costumes
  ironManSuit: null, // "mark3" | "gold" | "warmachine" | null
  eatAnim: null, // { t, food, banana }
  nearMichael: false,
  wasNearMichael: false,
  michaelOffer: false,
  michaelRocketChoice: false, // waiting: Buy money vs Try free
  rocketOwned: false, // bought Iron Man rocket for keeps
  rocketTrial: false, // free 20s try
  rocketTrialLeft: 0,
  michaelJoyride: false, // Michael flies rocket alone
  michaelJoyrideLeft: 0,
  // Nifty Fidget Power shop (limited — ends November)
  nearNiftyBundle: false,
  niftyBundleOwned: false,
  niftyBundleOffer: false,
  activeSword: null, // "nifty" | "venom" | "waterdino" | null
  hatPowerOn: false,
  niftyShootStreak: 0,
  niftyLastShot: 0,
  niftyPowerBall: null, // forming / ready ball after a shoot streak
  niftyProjectiles: [],
  /** Free try: { kind, left } — 30s then taken away; buy needs green coins */
  fidgetTrial: null,
  // Inventory (I) — fidget powers saved forever
  inventoryOpen: false,
  /** Owned forever: put away = back in inv, equip = hold in hand */
  inv: {
    nifty: false,
    venom: false,
    waterdino: false,
    hatPower: false,
    waterDinosaur: false, // only if you bought Water Dino
  },
  waterDinoPet: null,
  /** Ron's personal animal (cute worm) — always follows Ron */
  ronAnimalPet: null,
  ronAnimalIntro: false,
  nearTreasure: null,
  cinemaOpen: false,
  cinemaShow: "spiderman",
  cinemaT: 0,
  streak: 0,
  combo: 0,
  comboTimer: 0,
  kills: 0,
  blocksBuilt: 0,
  racesWon: 0,
  distance: 0,

  // Combat
  hp: 100,
  maxHp: 100,
  ammo: 30,
  reserve: 90,
  maxAmmo: 30,
  reloading: false,
  fireCooldown: 0,
  invuln: 0,

  // Inventory / hotbar — no gun
  // 1 dirt · 2 wood · 3 crystal · 4 hands
  slot: 1,
  blocks: { dirt: 64, wood: 32, crystal: 8 },
  weather: "spring", // spring | thunder | snow
  _weatherFlash: 0,
  _weatherNextBolt: 6,

  // Vehicle
  inVehicle: false,
  vehicle: null,
  nearVehicle: null,

  // Ladder / tree climb (K = climb on, X = jump off)
  ladder: null, // { x, z, bottomY, topY, faceZ }
  nearLadder: false,
  climbing: false,
  climbKind: null, // "ladder" | "tree"
  climbTree: null,
  onTree: false, // walking on tree canopy
  nearTree: null,
  // Player identity
  playerName: "Ron",
  calendarOpen: false,
  leaderboardOpen: false,
  nearLucas: false,
  wasNearLucas: false,
  // Pirate hangout
  nearPirate: false,
  pirateOffer: 0, // 0 guitar · 1 diving suit · 2+ snacks
  foodChoice: 0, // 0 salmon · 1 blue banana · 2 bar
  eatCooldown: 0,
  pirateGreeted: false,
  wasNearPirate: false,
  divingSuit: false,
  guitarPlaying: false,
  // Character speech
  speechQueue: [],
  speechTimer: 0,
  speechShowing: false,
  speechWho: "player", // "player" | "pirate"

  // Race
  racing: false,
  raceStartTime: 0,
  raceCheckpoint: 0,
  raceCheckpoints: [],
  bestRace: null,

  // World refs
  lastPos: new THREE.Vector3(),
};

const WORLD_SIZE = 980;
const HALF = WORLD_SIZE / 2;

// ─────────────────────────────────────────────────────────────
// THREE SETUP
// ─────────────────────────────────────────────────────────────
// Performance profile: fewer lights, cheaper materials, capped resolution
// Tuned for smooth play on laptops / integrated GPUs
const PERF = {
  pixelRatio: Math.min(window.devicePixelRatio || 1, 1.75),
  shadows: false,
  shadowMap: 1024,
  minimapEvery: 6,
  oceanEvery: 2, // update ocean verts every N frames
  maxSplashes: 12,
  farCull: 160,
};

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
  stencil: false,
  depth: true,
  alpha: false,
});
renderer.setPixelRatio(PERF.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // soft, realistic shadow edges
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25; // bright, film-like realism
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.info.autoReset = true;

const scene = new THREE.Scene();
// GTA open-world day sky (warm clear Los Santos vibe + soft distance haze)
scene.background = new THREE.Color(0x87b0d8);
scene.fog = new THREE.Fog(0xb8cce0, 140, 560);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.2, 800);
camera.position.set(0, 8, 20);

// GTA daylight — warm sun, soft sky bounce, ground bounce
const hemi = new THREE.HemisphereLight(0xd8e8ff, 0x5a6a48, 1.05);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff0d8, 1.75);
sun.position.set(110, 170, 70);
sun.castShadow = false;
scene.add(sun);
scene.add(sun.target); // shadows aim at wherever the player is standing

// Configure the sun's shadow projector once. Without this, castShadow does nothing.
sun.shadow.mapSize.set(2048, 2048);            // crisp shadow resolution
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 520;
sun.shadow.camera.left = -130;
sun.shadow.camera.right = 130;
sun.shadow.camera.top = 130;
sun.shadow.camera.bottom = -130;
sun.shadow.bias = -0.0004;                     // kills shadow "acne" speckles
sun.shadow.normalBias = 0.04;                  // clean contact where feet meet ground

/**
 * The day/night cycle already moves sun.position (it follows the camera).
 * We only re-aim the sun's shadow at the player, so the shadow stays centered
 * on the action and doesn't vanish when you roam far from the world center.
 */
function updateSunShadow() {
  if (!PERF.shadows || !sun.castShadow) return;
  sun.target.position.set(player.pos.x, 0, player.pos.z);
  sun.target.updateMatrixWorld();
}

const fill = new THREE.AmbientLight(0xe8eef4, 0.5);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xa8c4e0, 0.42);
rim.position.set(-90, 50, -100);
scene.add(rim);

const bounce = new THREE.DirectionalLight(0xc8d8a8, 0.22);
bounce.position.set(20, 15, -40);
scene.add(bounce);

// GTA-style sky dome (warm horizon, soft blue zenith — not MC flat blue)
(function addSkyDome() {
  const geo = new THREE.SphereGeometry(400, 40, 24);
  const cols = [];
  const zenith = new THREE.Color(0x5a9ad0);
  const mid = new THREE.Color(0x8eb8d8);
  const horizon = new THREE.Color(0xd8e6f0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 400;
    const t = THREE.MathUtils.clamp(y * 0.5 + 0.5, 0, 1);
    const c = horizon.clone().lerp(mid, t).lerp(zenith, t * t);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  const dome = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  dome.name = "skyDome";
  scene.add(dome);
  state._skyDome = dome;

  // Soft volumetric-style clouds (GTA sky — puffy spheres, NOT cube stacks)
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xf4f7fb,
    flatShading: false,
    transparent: true,
    opacity: 0.55,
    roughness: 1,
    metalness: 0,
    depthWrite: false,
  });
  const cloudRoot = new THREE.Group();
  cloudRoot.name = "gtaClouds";
  function addCloud(cx, cy, cz) {
    const g = new THREE.Group();
    const blobs = 4 + ((Math.abs(cx * 0.1) | 0) % 4);
    for (let b = 0; b < blobs; b++) {
      const r = 6 + (b % 3) * 3.5;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), cloudMat);
      puff.position.set(
        (b - blobs * 0.5) * 5.5,
        Math.sin(b * 1.3) * 1.8,
        Math.cos(b * 0.9) * 4
      );
      puff.scale.set(1.4 + (b % 2) * 0.3, 0.45 + (b % 3) * 0.08, 1.1);
      g.add(puff);
    }
    g.position.set(cx, cy, cz);
    cloudRoot.add(g);
    return g;
  }
  for (let i = 0; i < 22; i++) {
    const cx = (Math.random() - 0.5) * 520;
    const cz = (Math.random() - 0.5) * 520;
    const cy = 85 + Math.random() * 40;
    addCloud(cx, cy, cz);
  }
  scene.add(cloudRoot);
  state._mcClouds = cloudRoot;
})();

// Bright sun (day) + moon (night) — driven by sleep
const sunDir = new THREE.Vector3(0.48, 0.78, 0.35).normalize();
const SUN_DISTANCE = 150;
const sunGroup = new THREE.Group();
const sunCore = new THREE.Mesh(
  new THREE.SphereGeometry(5, 12, 10),
  new THREE.MeshBasicMaterial({ color: 0xfff6d0, fog: false })
);
const sunGlow1 = new THREE.Mesh(
  new THREE.SphereGeometry(9, 10, 8),
  new THREE.MeshBasicMaterial({
    color: 0xffcc55,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    fog: false,
  })
);
const sunHalo = new THREE.Mesh(
  new THREE.RingGeometry(8, 16, 24),
  new THREE.MeshBasicMaterial({
    color: 0xffe8b0,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  })
);
sunGroup.add(sunCore, sunGlow1, sunHalo);
scene.add(sunGroup);

// Soft moon for nighttime
const moonGroup = new THREE.Group();
const moonCore = new THREE.Mesh(
  new THREE.SphereGeometry(4.2, 14, 12),
  new THREE.MeshBasicMaterial({ color: 0xe8eef8, fog: false })
);
const moonGlow = new THREE.Mesh(
  new THREE.SphereGeometry(7.5, 10, 8),
  new THREE.MeshBasicMaterial({
    color: 0xa8c0e8,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    fog: false,
  })
);
const moonHalo = new THREE.Mesh(
  new THREE.RingGeometry(7, 13, 24),
  new THREE.MeshBasicMaterial({
    color: 0xc8d8f0,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  })
);
// Simple crater dots
const moonCraterMat = new THREE.MeshBasicMaterial({ color: 0xc5cdd8, fog: false });
for (const [cx, cy, cr] of [
  [1.2, 0.8, 0.7],
  [-1.0, -0.5, 0.55],
  [0.3, -1.3, 0.4],
  [-0.6, 1.1, 0.35],
]) {
  const crater = new THREE.Mesh(new THREE.SphereGeometry(cr, 6, 5), moonCraterMat);
  crater.position.set(cx, cy, 3.6);
  moonGroup.add(crater);
}
moonGroup.add(moonCore, moonGlow, moonHalo);
moonGroup.visible = false;
scene.add(moonGroup);

// 0 = full day, 1 = full night (lerps when sleeping / waking)
state.dayNight = 0;
state._skyDayColors = null; // cached original dome colors

const driftingClouds = []; // { group, speed, bob }

function updateSunVisual(dt = 0.016) {
  // Sleep → night, wake → day
  const targetNight = player.sleeping ? 1 : 0;
  // Smooth sunset / sunrise over a couple seconds
  const rate = player.sleeping ? 0.55 : 0.7;
  state.dayNight += (targetNight - state.dayNight) * Math.min(1, rate * dt);
  if (Math.abs(state.dayNight - targetNight) < 0.002) state.dayNight = targetNight;
  const n = state.dayNight; // 0 day … 1 night

  const origin = camera.position;

  // Sun arc: high in day → sinks below horizon at night
  // day elev ~0.78, night elev ~-0.55
  const sunElev = 0.78 - n * 1.35;
  const sunAz = 0.48 + n * 0.35;
  const sunZ = 0.35 - n * 0.1;
  sunDir.set(sunAz, sunElev, sunZ).normalize();

  sunGroup.position.set(
    origin.x + sunDir.x * SUN_DISTANCE,
    origin.y + sunDir.y * SUN_DISTANCE * 0.9,
    origin.z + sunDir.z * SUN_DISTANCE
  );
  sunHalo.lookAt(camera.position);
  sun.position.copy(origin).addScaledVector(sunDir, 90);

  // Fade sun visual as it sets
  const sunVis = THREE.MathUtils.clamp(1 - n * 1.4, 0, 1);
  sunGroup.visible = sunVis > 0.02;
  sunCore.material.opacity = 1;
  sunGlow1.material.opacity = 0.3 * sunVis;
  sunHalo.material.opacity = 0.18 * sunVis;
  // Warm orange as sun sets
  sunCore.material.color.setHex(n < 0.45 ? 0xfff6d0 : 0xff9944);
  sun.color.setHex(n < 0.5 ? 0xfff3dc : 0xff6a33);
  sun.intensity = 1.15 * (1 - n * 0.92);

  // Moon rises opposite the sun as night comes
  const moonElev = -0.4 + n * 1.15; // below horizon by day, high at night
  const moonDir = new THREE.Vector3(-0.55, moonElev, -0.4).normalize();
  moonGroup.position.set(
    origin.x + moonDir.x * SUN_DISTANCE,
    origin.y + moonDir.y * SUN_DISTANCE * 0.9,
    origin.z + moonDir.z * SUN_DISTANCE
  );
  moonHalo.lookAt(camera.position);
  const moonVis = THREE.MathUtils.clamp((n - 0.25) / 0.55, 0, 1);
  moonGroup.visible = moonVis > 0.02;
  moonGlow.material.opacity = 0.28 * moonVis;
  moonHalo.material.opacity = 0.14 * moonVis;
  moonCore.scale.setScalar(0.85 + moonVis * 0.2);

  // Lights: GTA day / cool night
  hemi.intensity = 1.0 * (1 - n * 0.75) + 0.12;
  hemi.color.setHex(n > 0.5 ? 0x1e3a5f : 0xd8e8ff);
  hemi.groundColor.setHex(n > 0.5 ? 0x0a1520 : 0x5a6a48);
  fill.intensity = 0.45 * (1 - n * 0.7) + 0.06;
  fill.color.setHex(n > 0.5 ? 0x6080b0 : 0xe8eef4);
  renderer.toneMappingExposure = 1.22 - n * 0.4;

  // Sky + fog — GTA clear day (not blocky blue, not full snow haze)
  if (state.spiderGame) {
    // Spider mini-game keeps its own atmosphere
  } else if (!isUnderwater(player.pos.x, player.pos.y, player.pos.z) || state.inVehicle) {
    const dayBg = new THREE.Color(0x87b0d8);
    const nightBg = new THREE.Color(0x050818);
    const dayFog = new THREE.Color(0xb8cce0);
    const nightFog = new THREE.Color(0x0a1020);
    scene.background.copy(dayBg).lerp(nightBg, n);
    scene.fog.color.copy(dayFog).lerp(nightFog, n);
    scene.fog.near = 140 - n * 40;
    scene.fog.far = 560 - n * 140;
  }
  // Drift MC block clouds slowly
  if (state._mcClouds) {
    state._mcClouds.position.x = Math.sin(state.elapsed * 0.012) * 40;
    state._mcClouds.position.z = Math.cos(state.elapsed * 0.01) * 30;
    state._mcClouds.visible = n < 0.85;
  }

  // Sky dome colors
  if (state._skyDome && state._skyDome.geometry.attributes.color) {
    const colAttr = state._skyDome.geometry.attributes.color;
    if (!state._skyDayColors) {
      state._skyDayColors = new Float32Array(colAttr.array);
    }
    const dayC = state._skyDayColors;
    const nightZenith = new THREE.Color(0x050818);
    const nightHorizon = new THREE.Color(0x1a2744);
    for (let i = 0; i < colAttr.count; i++) {
      const di = i * 3;
      const dayCol = new THREE.Color(dayC[di], dayC[di + 1], dayC[di + 2]);
      // Approximate: higher verts were more zenith-blue
      const yBlend = dayC[di + 2]; // blue channel as rough height cue
      const nightCol = nightHorizon.clone().lerp(nightZenith, THREE.MathUtils.clamp(yBlend, 0, 1));
      dayCol.lerp(nightCol, n);
      colAttr.setXYZ(i, dayCol.r, dayCol.g, dayCol.b);
    }
    colAttr.needsUpdate = true;
  }

  if (state._skyDome) state._skyDome.position.copy(origin);

  // Stars fade in at night
  if (state._stars) {
    state._stars.visible = n > 0.35;
    state._stars.material.opacity = THREE.MathUtils.clamp((n - 0.35) / 0.4, 0, 0.9);
    state._stars.position.copy(origin);
  }

  // Drift clouds (cheap) — dimmer at night
  for (let i = 0; i < driftingClouds.length; i++) {
    const c = driftingClouds[i];
    c.group.position.x += c.speed * 0.012 * (1 - n * 0.4);
    if (c.group.position.x > HALF + 60) c.group.position.x = -HALF - 60;
    c.group.traverse((ch) => {
      if (ch.material && ch.material.opacity != null && c._baseOp == null) {
        // store once
      }
    });
  }
}

// Star field for night sky
(function addStars() {
  const n = 400;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // Hemisphere above
    const u = Math.random();
    const v = Math.random();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(0.15 + v * 0.85); // upper sky
    const r = 320;
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi);
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.4,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    })
  );
  stars.visible = false;
  scene.add(stars);
  state._stars = stars;
})();

const ambNeon = { intensity: 0.35 }; // stub

// ─────────────────────────────────────────────────────────────
// SOUND (Web Audio — footsteps, ocean, wind, rocket, monkeys)
// ─────────────────────────────────────────────────────────────
const SFX = {
  ctx: null,
  master: null,
  enabled: true,
  footTimer: 0,
  oceanNodes: null,
  windNodes: null,
  birdTimer: 0,
  snoreNodes: null,
  playerSnoreNodes: null,
  rocketNodes: null,
  lastMonkey: 0,
};

function ensureAudio() {
  if (SFX.ctx) return SFX.ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  SFX.ctx = new AC();
  SFX.master = SFX.ctx.createGain();
  SFX.master.gain.value = 0.48; // ambient world (ocean/wind/birds) more audible
  SFX.master.connect(SFX.ctx.destination);
  return SFX.ctx;
}

function resumeAudio() {
  const ctx = ensureAudio();
  if (ctx && ctx.state === "suspended") ctx.resume();
}

/** Short noise burst (footstep / splash / chitter) */
function playNoise(opts = {}) {
  const ctx = ensureAudio();
  if (!ctx || !SFX.enabled) return;
  const dur = opts.dur || 0.08;
  const bufferSize = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize;
    const env = Math.pow(1 - t, opts.decay || 2.5);
    data[i] = (Math.random() * 2 - 1) * env * (opts.amp || 0.4);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filter || "lowpass";
  filter.frequency.value = opts.freq || 800;
  const g = ctx.createGain();
  g.gain.value = opts.vol ?? 0.5;
  src.connect(filter);
  filter.connect(g);
  g.connect(SFX.master);
  src.start();
}

function playTone(freq, dur, type = "sine", vol = 0.12) {
  const ctx = ensureAudio();
  if (!ctx || !SFX.enabled) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g);
  g.connect(SFX.master);
  o.start();
  o.stop(ctx.currentTime + dur);
}

function playFootstep(onSand = false, sprint = false) {
  playNoise({
    dur: 0.07,
    freq: onSand ? 1400 : 600,
    amp: sprint ? 0.55 : 0.35,
    vol: onSand ? 0.28 : 0.22,
    decay: 3,
    filter: "bandpass",
  });
  // soft thud
  playTone(onSand ? 90 : 70, 0.05, "triangle", 0.06);
}

function playSplash() {
  playNoise({ dur: 0.2, freq: 1200, amp: 0.5, vol: 0.35, decay: 1.8, filter: "highpass" });
  playTone(180, 0.15, "sine", 0.05);
}

function playMonkeySound() {
  const f = 400 + Math.random() * 500;
  playTone(f, 0.12, "square", 0.06);
  playTone(f * 1.4, 0.1, "sawtooth", 0.04);
  playNoise({ dur: 0.1, freq: 2000, amp: 0.25, vol: 0.15, decay: 2 });
}

function makeLoopNoise(ctx, seconds, amp = 0.2) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    // Brown-ish noise (smoother waves / wind)
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * amp * 3.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

function startAmbientOcean() {
  const ctx = ensureAudio();
  if (!ctx || SFX.oceanNodes) return;
  // Layered ocean: low rumble + mid wash + high foam hiss
  const low = makeLoopNoise(ctx, 3, 0.22);
  const mid = makeLoopNoise(ctx, 2.2, 0.18);
  const high = makeLoopNoise(ctx, 1.6, 0.12);
  const fLow = ctx.createBiquadFilter();
  fLow.type = "lowpass";
  fLow.frequency.value = 280;
  const fMid = ctx.createBiquadFilter();
  fMid.type = "bandpass";
  fMid.frequency.value = 700;
  fMid.Q.value = 0.6;
  const fHigh = ctx.createBiquadFilter();
  fHigh.type = "highpass";
  fHigh.frequency.value = 1800;
  const g = ctx.createGain();
  g.gain.value = 0.0;
  const mix = ctx.createGain();
  mix.gain.value = 1;
  low.connect(fLow);
  mid.connect(fMid);
  high.connect(fHigh);
  fLow.connect(mix);
  fMid.connect(mix);
  fHigh.connect(mix);
  mix.connect(g);
  g.connect(SFX.master);
  low.start();
  mid.start();
  high.start();
  SFX.oceanNodes = { g, fLow, fMid, fHigh, mix };
}

function startAmbientWind() {
  const ctx = ensureAudio();
  if (!ctx || SFX.windNodes) return;
  const src = makeLoopNoise(ctx, 2.5, 0.2);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 450;
  filter.Q.value = 0.4;
  const g = ctx.createGain();
  g.gain.value = 0.0;
  src.connect(filter);
  filter.connect(g);
  g.connect(SFX.master);
  src.start();
  SFX.windNodes = { src, g, filter };
}

function startAnimalSnoreLoop() {
  const ctx = ensureAudio();
  if (!ctx || SFX.snoreNodes) return;
  // Long snore buffer: inhale rumbles + soft exhale
  const dur = 2.4;
  const n = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const t = i / ctx.sampleRate;
    const phase = (t % dur) / dur;
    // Two-phase snore: loud inhale then soft exhale
    let env = 0;
    if (phase < 0.45) {
      env = Math.sin((phase / 0.45) * Math.PI) * 0.9;
    } else if (phase < 0.55) {
      env = 0.05;
    } else {
      env = Math.sin(((phase - 0.55) / 0.45) * Math.PI) * 0.35;
    }
    const rumble =
      Math.sin(t * Math.PI * 2 * 55) * 0.35 +
      Math.sin(t * Math.PI * 2 * 72) * 0.2 +
      (Math.random() * 2 - 1) * 0.25;
    data[i] = rumble * env * 0.55;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  const g = ctx.createGain();
  g.gain.value = 0.0;
  src.connect(filter);
  filter.connect(g);
  g.connect(SFX.master);
  src.start();
  SFX.snoreNodes = { src, g, filter };
}

/** Ron's snore while sleeping (Z / ZZZ) */
function startPlayerSnoreLoop() {
  const ctx = ensureAudio();
  if (!ctx || SFX.playerSnoreNodes) return;
  const dur = 2.6;
  const n = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const t = i / ctx.sampleRate;
    const phase = (t % dur) / dur;
    let env = 0;
    if (phase < 0.42) {
      env = Math.sin((phase / 0.42) * Math.PI) * 1.0; // big inhale snore
    } else if (phase < 0.52) {
      env = 0.04;
    } else {
      env = Math.sin(((phase - 0.52) / 0.48) * Math.PI) * 0.4; // soft exhale
    }
    const rumble =
      Math.sin(t * Math.PI * 2 * 48) * 0.4 +
      Math.sin(t * Math.PI * 2 * 62) * 0.25 +
      Math.sin(t * Math.PI * 2 * 90) * 0.12 +
      (Math.random() * 2 - 1) * 0.2;
    data[i] = rumble * env * 0.65;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 380;
  const g = ctx.createGain();
  g.gain.value = 0;
  src.connect(filter);
  filter.connect(g);
  g.connect(SFX.master);
  src.start();
  SFX.playerSnoreNodes = { src, g, filter };
}

/** Occasional bird chirp */
function playBirdChirp() {
  const ctx = ensureAudio();
  if (!ctx || !SFX.enabled) return;
  const base = 1800 + Math.random() * 1400;
  const notes = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < notes; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    const t0 = ctx.currentTime + i * 0.09;
    const f = base * (1 + i * 0.08 + (Math.random() - 0.5) * 0.05);
    o.frequency.setValueAtTime(f, t0);
    o.frequency.exponentialRampToValueAtTime(f * 1.15, t0 + 0.07);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    o.connect(g);
    g.connect(SFX.master);
    o.start(t0);
    o.stop(t0 + 0.14);
  }
  // Soft wing-like tick
  playNoise({ dur: 0.04, freq: 3500, amp: 0.15, vol: 0.06, decay: 4, filter: "highpass" });
}

function startRocketLoop() {
  const ctx = ensureAudio();
  if (!ctx || SFX.rocketNodes) return;
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.value = 55;
  const o2 = ctx.createOscillator();
  o2.type = "square";
  o2.frequency.value = 40;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 400;
  const g = ctx.createGain();
  g.gain.value = 0;
  o.connect(filter);
  o2.connect(filter);
  filter.connect(g);
  g.connect(SFX.master);
  o.start();
  o2.start();
  SFX.rocketNodes = { o, o2, g, filter };
}

function updateSounds(dt) {
  resumeAudio();
  startAmbientOcean();
  startAmbientWind();
  startAnimalSnoreLoop();

  // ── Ocean (louder near shore / in water) ──
  if (SFX.oceanNodes) {
    const z = player.pos.z;
    const distToShore = Math.abs(z - OCEAN_START);
    const nearOcean = Math.max(0, 1 - distToShore / 100);
    const southOcean = z > OCEAN_START - 5 ? Math.min(1, (z - (OCEAN_START - 5)) / 30) : 0;
    const inWater = isOcean(player.pos.x, player.pos.z) ? 0.7 : 0;
    // Always a faint distant sea, strong near beach
    const target = Math.min(0.72, 0.08 + nearOcean * 0.45 + southOcean * 0.35 + inWater);
    SFX.oceanNodes.g.gain.value += (target - SFX.oceanNodes.g.gain.value) * Math.min(1, 2.5 * dt);
    // Wave filter pulse
    if (SFX.oceanNodes.fMid) {
      SFX.oceanNodes.fMid.frequency.value = 650 + Math.sin(state.elapsed * 0.7) * 120;
    }
  }

  // ── Wind (open plains + stronger on mountains / height) ──
  if (SFX.windNodes) {
    const elev = Math.max(0, player.pos.y);
    const open = Math.min(1, Math.hypot(player.pos.x, player.pos.z) / 120);
    const height = Math.min(1, elev / 18);
    const onTree = state.onTree || state.climbing ? 0.25 : 0;
    const target = Math.min(0.38, 0.06 + open * 0.12 + height * 0.28 + onTree);
    SFX.windNodes.g.gain.value += (target - SFX.windNodes.g.gain.value) * Math.min(1, 2 * dt);
    SFX.windNodes.filter.frequency.value = 380 + Math.sin(state.elapsed * 0.35) * 90 + height * 200;
  }

  // ── Sleeping animal snore ──
  if (SFX.snoreNodes) {
    let nearest = Infinity;
    for (const t of pandas) {
      if (!t.group) continue;
      const d = Math.hypot(
        player.pos.x - t.group.position.x,
        player.pos.z - t.group.position.z
      );
      if (d < nearest) nearest = d;
    }
    // Hearable within ~28 units, clear snore within ~12
    let target = 0;
    if (nearest < 28) {
      target = Math.min(0.55, (1 - nearest / 28) * 0.55);
      if (nearest < 10) target = Math.min(0.7, target + 0.2);
    }
    SFX.snoreNodes.g.gain.value += (target - SFX.snoreNodes.g.gain.value) * Math.min(1, 3 * dt);
  }

  // ── Ron snoring while asleep (Z / ZZZ) ──
  startPlayerSnoreLoop();
  if (SFX.playerSnoreNodes) {
    const target = player.sleeping ? 0.72 : 0;
    SFX.playerSnoreNodes.g.gain.value +=
      (target - SFX.playerSnoreNodes.g.gain.value) * Math.min(1, 4 * dt);
  }

  // ── Birds (periodic chirps outdoors) ──
  SFX.birdTimer -= dt;
  if (SFX.birdTimer <= 0) {
    SFX.birdTimer = 2.5 + Math.random() * 5.5;
    // Fewer birds over deep ocean / indoors-ish
    const inDeepOcean = player.pos.z > OCEAN_START + 25;
    if (!inDeepOcean && Math.random() < 0.85) {
      playBirdChirp();
      // Sometimes a second bird answers
      if (Math.random() < 0.4) {
        setTimeout(() => playBirdChirp(), 200 + Math.random() * 400);
      }
    }
  }

  // Rocket roar
  if (SFX.rocketNodes) {
    const flying = state.inVehicle && state.vehicle?.type === "rocket";
    const thrust = flying && (state.keys["KeyW"] || state.keys["Space"]);
    const target = thrust ? 0.28 : flying ? 0.06 : 0;
    SFX.rocketNodes.g.gain.value += (target - SFX.rocketNodes.g.gain.value) * Math.min(1, 5 * dt);
    if (thrust) {
      SFX.rocketNodes.filter.frequency.value = 350 + Math.sin(state.elapsed * 20) * 80;
      SFX.rocketNodes.o.frequency.value = 50 + Math.random() * 8;
    }
  }
}

// Splash particles for ocean waves
const splashParticles = [];
function spawnWaveSplash(x, z, n = 4) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.08 + Math.random() * 0.08, 4, 4),
      new THREE.MeshBasicMaterial({
        color: 0xe0f7ff,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      })
    );
    m.position.set(x + (Math.random() - 0.5) * 2, WATER_SURFACE + 0.1, z + (Math.random() - 0.5));
    scene.add(m);
    splashParticles.push({
      mesh: m,
      vel: new THREE.Vector3((Math.random() - 0.5) * 2, 2 + Math.random() * 3.5, (Math.random() - 0.5) * 1.5),
      life: 0.5 + Math.random() * 0.4,
    });
  }
}

function updateSplashParticles(dt) {
  for (let i = splashParticles.length - 1; i >= 0; i--) {
    const p = splashParticles[i];
    p.life -= dt;
    p.vel.y -= 12 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.material.opacity = Math.max(0, p.life * 1.2);
    if (p.life <= 0 || p.mesh.position.y < WATER_SURFACE - 0.2) {
      scene.remove(p.mesh);
      splashParticles.splice(i, 1);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// PLAYER
// ─────────────────────────────────────────────────────────────
const player = {
  // Rim of the hole — look down to see the raised floor
  pos: new THREE.Vector3(0, 40, 8),
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: -0.35,
  height: 1.85, // slim yellow Ron
  radius: 0.35,
  onGround: false,
  speed: 9,
  sprintMult: 1.65,
  jumpForce: 9.5,
  eye: new THREE.Object3D(),
  // Camera zoom: 0 = first person, higher = third person (scroll out)
  // Start in third person so you can see realistic walk/run
  camDist: 5.5,
  camDistTarget: 5.5,
  // Front / turn-around view — camera in front so you see full character
  turnAround: false,
  // Sleep mode (Z = ZZZ)
  sleeping: false,
  snorePhase: 0,
  zzzTimer: 0,
  walkCycle: 0,
  parachuting: false,
  fallPeakY: 0,
  // Tree fall → bounce → head/body jiggle
  fromTreeJump: false,
  wasAirborne: false,
  landJiggle: 0, // seconds of wiggle left
  landJiggleAmp: 0,
  bounceLeft: 0, // number of bounce hops remaining
  fromLadderJump: false,
  _noodleBounce: false,
};

// Spider-Man mini-game (from Woody / UGC) → full jungle world
state.spiderGame = false;
state.spiderOffer = false;
state.spiderFriendly = false; // Y = stop attacking · talk + powers together
state.spiderReturn = null;
state.spiderWebCooldown = 0;
state.spiderWebs = [];
state.wasNearUgc = false;
state.hasSpiderSuit = false;
state.spiderJungle = null; // built once: { root, x, z, spawnY }
state.spiderTalkTimer = 0;
state.spiderPowerTimer = 0;
state.spiderTalkI = 0;
// Jungle pocket world (far from beach / city)
const SPIDER_JUNGLE_X = 300;
const SPIDER_JUNGLE_Z = -280;
const SPIDER_JUNGLE_R = 85;


player.eye.position.copy(player.pos);
player.eye.position.y += player.height;
scene.add(player.eye);

// ═══════════════════════════════════════════════════════════
// PLAYER CHARACTER — classic slim yellow RON
// Yellow skin · red shirt · dark red pants
// Every part = tall standing rectangle (slim, not fat)
// ═══════════════════════════════════════════════════════════
const AV = {
  // Yellow Ron skin — slightly more natural (soft, not pure flat cartoon)
  skin: 0xf5d76e,
  skinShadow: 0xd4b24a,
  skinLight: 0xffe9a0,
  shirt: 0xe11d2e,      // red shirt
  shirtDark: 0xb01522,
  pants: 0x5c1018,      // dark red pants
  pantsDark: 0x3d0a10,
  shoes: 0x2a2118,
  shoeSole: 0x1a1510,
  hair: 0xb8954a,       // golden-brown dreads (like image)
  hairHi: 0xd4b06a,
  hairDark: 0x8a6a30,
  outline: 0x1a1a1a,
  depth: 0.36,
};

// Skin only: soft standard material (looks a bit more real than flat Lambert)
const matSkin = new THREE.MeshStandardMaterial({
  color: AV.skin,
  roughness: 0.72,
  metalness: 0.02,
  flatShading: false,
});
const matSkinShadow = new THREE.MeshStandardMaterial({
  color: AV.skinShadow,
  roughness: 0.82,
  metalness: 0.02,
  flatShading: false,
});
const matSkinBright = new THREE.MeshStandardMaterial({
  color: AV.skinLight,
  roughness: 0.65,
  metalness: 0.03,
  flatShading: false,
});
const matShirt = new THREE.MeshStandardMaterial({ color: AV.shirt, roughness: 0.78, metalness: 0.04, flatShading: false });
const matShirtDark = new THREE.MeshStandardMaterial({ color: AV.shirtDark, roughness: 0.8, metalness: 0.04, flatShading: false });
const matPants = new THREE.MeshStandardMaterial({ color: AV.pants, roughness: 0.82, metalness: 0.03, flatShading: false });
const matPantsDark = new THREE.MeshStandardMaterial({ color: AV.pantsDark, roughness: 0.84, metalness: 0.03, flatShading: false });
const matShoes = new THREE.MeshStandardMaterial({ color: AV.shoes, roughness: 0.72, metalness: 0.06, flatShading: false });
const matShoeSole = new THREE.MeshStandardMaterial({ color: AV.shoeSole, roughness: 0.88, metalness: 0.04, flatShading: false });
const matHair = new THREE.MeshStandardMaterial({ color: AV.hair, roughness: 0.68, metalness: 0.04, flatShading: false });
const matHairHi = new THREE.MeshStandardMaterial({ color: AV.hairHi, roughness: 0.62, metalness: 0.04, flatShading: false });

function _tintSkin(mat, hex) {
  if (mat && mat.color) mat.color.setHex(hex);
}

const DRY_COLORS = {
  hair: 0x111111,
  hairHi: 0x6a6a6a,
  shirt: AV.shirt,
  shirtDark: AV.shirtDark,
  pants: AV.pants,
  pantsDark: AV.pantsDark,
};
const WET_COLORS = {
  hair: 0x050505,
  hairHi: 0x2a2a2a,
  shirt: 0x7a121c,      // wet red (darker)
  shirtDark: 0x4a0c12,
  pants: 0x2a080c,      // wet dark red
  pantsDark: 0x150406,
};
state.wetness = 0;
state.wasSwimming = false;

const matEyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
const matEyePupil = new THREE.MeshBasicMaterial({ color: 0x1a1208 });
const matLip = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
const matBrow = new THREE.MeshBasicMaterial({ color: 0x3d2818 });
const matOutline = new THREE.LineBasicMaterial({ color: AV.outline });
const matHairOutline = new THREE.LineBasicMaterial({ color: 0x1a0f0a });

/** Smooth character part (rounded — not a cube-style/Roblox brick) */
function avPart(parent, w, h, d, x, y, z, mat) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const r = Math.min(0.1, Math.min(w, h, d) * 0.28);
  let geo;
  try {
    geo = new RoundedBoxGeometry(w, h, d, 2, Math.max(0.02, r));
  } catch (_) {
    geo = new THREE.BoxGeometry(w, h, d);
  }
  if (mat && "flatShading" in mat) mat.flatShading = false;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.userData.mesh = mesh;
  g.add(mesh);
  parent.add(g);
  return g;
}

function avLimb(joint, w, h, d, ox, oy, oz, mat) {
  const hold = new THREE.Group();
  hold.position.set(ox, oy, oz);
  const r = Math.min(0.09, Math.min(w, h, d) * 0.28);
  let geo;
  try {
    geo = new RoundedBoxGeometry(w, h, d, 2, Math.max(0.02, r));
  } catch (_) {
    geo = new THREE.BoxGeometry(w, h, d);
  }
  if (mat && "flatShading" in mat) mat.flatShading = false;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  hold.add(mesh);
  joint.add(hold);
  return hold;
}

// Slim upright rectangles — each part is taller than wide (standing up)
//   ██      head  (tall rectangle)
//  ████     body  (standing rectangle)
// █ ██ █    arms  (standing rectangles)
//  █  █     legs  (standing rectangles, matching size)
const HEAD_W = 0.34;
const HEAD_H = 0.52; // taller than wide = standing rectangle
const HEAD_D = 0.34;
const NECK_H = 0.02;
const TORSO_W = 0.58; // slim body (not fat)
const TORSO_H = 0.72; // standing rectangle
const TORSO_D = 0.32;
const ARM_W = 0.20; // thin
const ARM_D = 0.20;
const ARM_H = 0.70; // standing rectangle
const UPPER_ARM_H = ARM_H * 0.55;
const FOREARM_H = ARM_H * 0.45;
// Legs match arm thickness, standing tall
const THIGH_H = 0.40;
const SHIN_H = 0.38;
const LEG_W = 0.20; // same width as arms
const FOOT_H = 0.04;
const FOOT_LEN = 0.26;
const LEG_GAP = 0.06;
const D = TORSO_D;

const HIP_Y = THIGH_H + SHIN_H + FOOT_H;
const TORSO_Y = HIP_Y + TORSO_H / 2;
const HEAD_Y = HIP_Y + TORSO_H + NECK_H + HEAD_H / 2;
const SHOULDER_Y = HIP_Y + TORSO_H - 0.01;
const LEG_X = LEG_W / 2 + LEG_GAP / 2;


const CHARACTERS = {
  ron: {
    shirt: 0xe11d2e,
    shirtDark: 0xb01522,
    pants: 0x7f1d1d,
    pantsDark: 0x5c1515,
  },
};

const avatar = new THREE.Group();
const avBody = new THREE.Group();
avatar.add(avBody);

// TORSO — green standing rectangle
const avTorso = avPart(avBody, TORSO_W, TORSO_H, TORSO_D, 0, TORSO_Y, 0, matShirt);

// HEAD — yellow standing rectangle
const avHead = avPart(avBody, HEAD_W, HEAD_H, HEAD_D, 0, HEAD_Y, 0, matSkin);

// Face — classic Roblox smile face (match screenshot)
const matFaceWhite = matEyeWhite;
const matFaceIris = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
const matFacePupil = matEyePupil;
const matFaceNose = matSkinShadow;
const matFaceLip = matLip;
const matFaceBrow = matBrow;

const avFace = new THREE.Group();
avFace.name = "ronFace";
const faceZ = -HEAD_D / 2 - 0.015;

// Eyes: white + black pupil (classic)
for (const sx of [-1, 1]) {
  const white = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.03), matFaceWhite);
  white.position.set(sx * 0.11, 0.06, faceZ);
  const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.025), matFacePupil);
  pupil.position.set(sx * 0.11, 0.05, faceZ - 0.012);
  avFace.add(white, pupil);
}
// Smile — simple dark U
const avNose = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), matSkin);
avNose.visible = false;
const smileL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.02), matLip);
smileL.position.set(-0.06, -0.12, faceZ);
smileL.rotation.z = 0.4;
const smileR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.02), matLip);
smileR.position.set(0.06, -0.12, faceZ);
smileR.rotation.z = -0.4;
const smileM = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.022, 0.02), matLip);
smileM.position.set(0, -0.145, faceZ);
const avLipTop = smileM;
const avLipBot = smileL;
const avSmile = smileR;
avFace.add(avNose, smileL, smileR, smileM);
avHead.add(avFace);
state._ronFace = avFace;

// HAIR — fluffy pillowy TRIPLET BUBBLE (3 distinct rounded cloud lobes)
// Soft black afro-puff texture; outline reads as three connected bubbles on the head.
matHair.color.setHex(0x111111);
matHairHi.color.setHex(0x6a6a6a);
AV.hair = 0x111111;
AV.hairHi = 0x6a6a6a;
AV.hairDark = 0x050505;

const avHairRoot = new THREE.Group();
avHairRoot.name = "cloudAfro";
// Sit on top of yellow head, nudged slightly back so face stays open
const HAIR_STICK_Y = HEAD_H * 0.5 + 0.02;
avHairRoot.position.set(0, HAIR_STICK_Y, 0.03);
avHead.add(avHairRoot);

const avHairCloudMeshes = [];
const avHairStrands = []; // used for soft bounce targets (bubble groups)
const avHairBubbles = []; // the 3 distinct lobes

// Fluffy black + soft grey feature tones
const fluffDark = new THREE.MeshLambertMaterial({ color: 0x0c0c0c });
const fluffMid = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
const fluffSoft = new THREE.MeshLambertMaterial({ color: 0x2e2e2e });
const fluffHi = new THREE.MeshLambertMaterial({ color: 0x5a5a5a });
const fluffDeep = new THREE.MeshLambertMaterial({ color: 0x050505 });
const fluffMats = [fluffDark, fluffMid, fluffSoft, fluffDeep, fluffMid];

const matCloudHair = fluffMid;
const matCloudHairSoft = fluffSoft;
const matCloudHairMid = fluffSoft;
const matCloudHairShadow = fluffDeep;
const matScalp = fluffMid;
const matScalpDark = fluffDark;

// Thin dark under-cap so yellow scalp never peeks between bubbles
const scalpCap = new THREE.Mesh(
  new THREE.BoxGeometry(HEAD_W * 1.02, 0.04, HEAD_D * 1.02),
  fluffDark
);
scalpCap.position.set(0, 0.012, 0.015);
avHairRoot.add(scalpCap);
avHairCloudMeshes.push(scalpCap);

/**
 * One pillowy bubble lobe: big sphere + many small offset spheres = fluffy texture.
 * Returns a Group planted on the head.
 */
function makeFluffyBubble(x, y, z, radius, opts = {}) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.userData.baseX = x;
  group.userData.baseY = y;
  group.userData.baseZ = z;
  group.userData.baseR = radius;
  group.userData.phase = opts.phase != null ? opts.phase : Math.random() * Math.PI * 2;
  group.userData.side = opts.side != null ? opts.side : 0;

  // Main pillowy core (slightly squashed = soft cloud silhouette)
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 18, 14),
    opts.mat || fluffMid
  );
  core.scale.set(1.05, 0.92, 1.0);
  core.castShadow = true;
  group.add(core);
  avHairCloudMeshes.push(core);

  // Feature highlight lobe on the top-front of this bubble
  const hi = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.42, 12, 10),
    fluffHi
  );
  hi.position.set(radius * 0.15 * (opts.side || 0), radius * 0.35, -radius * 0.25);
  hi.scale.set(1.1, 0.85, 1.0);
  group.add(hi);
  avHairCloudMeshes.push(hi);

  // Cluster of smaller spheres = fluffy / featured texture
  const n = opts.puffs != null ? opts.puffs : 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (opts.phase || 0);
    const elev = -0.25 + (i % 5) * 0.18;
    const rr = radius * (0.55 + (i % 3) * 0.12);
    const pr = radius * (0.28 + (i % 4) * 0.08);
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(pr, 10, 8),
      fluffMats[i % fluffMats.length]
    );
    // Spread on the outer shell so silhouette stays rounded + bumpy
    puff.position.set(
      Math.cos(a) * rr * 0.72,
      Math.sin(elev) * radius * 0.55 + radius * 0.08,
      Math.sin(a) * rr * 0.72
    );
    // Avoid long front bangs covering face (prefer top / side / back)
    if (puff.position.z < -radius * 0.55) puff.position.z = -radius * 0.4;
    puff.scale.set(
      0.95 + (i % 3) * 0.08,
      0.8 + (i % 2) * 0.12,
      0.95 + (i % 4) * 0.05
    );
    puff.castShadow = i % 2 === 0;
    group.add(puff);
    avHairCloudMeshes.push(puff);
  }

  // Soft underside shadow blob (grounds bubble on head)
  const under = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.7, 10, 8),
    fluffDeep
  );
  under.position.set(0, -radius * 0.45, 0.02);
  under.scale.set(1.15, 0.45, 1.05);
  group.add(under);
  avHairCloudMeshes.push(under);

  avHairRoot.add(group);
  avHairBubbles.push(group);
  // Soft bounce via strand-like API (joints empty; animate group)
  avHairStrands.push({
    root: group,
    joints: [],
    phase: group.userData.phase,
    side: group.userData.side,
    amp: 0.08,
    baseTilt: 0,
    restX: 0,
    restZ: 0,
    mode: "bubble",
    baseY: y,
    baseX: x,
    baseZ: z,
  });
  return group;
}

// ═══════════════════════════════════════════════════════════
// TRIPLET BUBBLE outline — 3 distinct pillowy forms on the head
//   1) LEFT lobe   2) CENTER / top lobe   3) RIGHT lobe
// Overlap a little so they read as one haircut, not floating balls
// ═══════════════════════════════════════════════════════════
const BUBBLE_R = 0.145;

// 1 — LEFT bubble
makeFluffyBubble(-0.13, 0.09, 0.02, BUBBLE_R * 1.02, {
  side: -1,
  phase: 0.4,
  puffs: 11,
  mat: fluffMid,
});

// 2 — CENTER / crown bubble (highest — main pillow on top)
makeFluffyBubble(0.0, 0.15, 0.04, BUBBLE_R * 1.12, {
  side: 0,
  phase: 1.2,
  puffs: 12,
  mat: fluffDark,
});

// 3 — RIGHT bubble
makeFluffyBubble(0.13, 0.09, 0.02, BUBBLE_R * 1.02, {
  side: 1,
  phase: 2.1,
  puffs: 11,
  mat: fluffMid,
});

// Tiny fill puffs in the seams so the triplet joins smoothly (still short, on top)
for (const seam of [
  { x: -0.06, y: 0.1, z: 0.03, r: 0.07 },
  { x: 0.06, y: 0.1, z: 0.03, r: 0.07 },
  { x: 0.0, y: 0.06, z: 0.08, r: 0.065 }, // short back nape cloud
]) {
  const fill = new THREE.Mesh(
    new THREE.SphereGeometry(seam.r, 12, 10),
    fluffDark
  );
  fill.position.set(seam.x, seam.y, seam.z);
  fill.scale.set(1.1, 0.75, 1.0);
  fill.castShadow = true;
  avHairRoot.add(fill);
  avHairCloudMeshes.push(fill);
}

state._hairRoot = avHairRoot;
state._cloudAfro = avHairRoot;
state._cloudAfroMeshes = avHairCloudMeshes;
state._hairBubbles = avHairBubbles;
state._wetHairRoot = null;
state._wetHairMeshes = [];
state._dryHairRoot = null;
state._stringHair = false;
state._hairBaseY = HAIR_STICK_Y;
state._hairBaseZ = 0.03;

function ensureHairOnHead() {
  const hair = state._cloudAfro || state._hairRoot || avHairRoot;
  if (!hair || !avHead) return;
  if (hair.parent !== avHead) {
    if (hair.parent) hair.parent.remove(hair);
    avHead.add(hair);
  }
  hair.visible = true;
  hair.position.x = 0;
  hair.position.z = state._hairBaseZ != null ? state._hairBaseZ : 0.03;
  if (Number.isNaN(hair.position.y)) hair.position.y = HAIR_STICK_Y;
  hair.scale.set(1, 1, 1);
}
ensureHairOnHead();
state._ensureHairOnHead = ensureHairOnHead;

// ARMS — upper + lower so elbow bend shows while walking/running
function makeArm(side) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * (TORSO_W / 2 + ARM_W / 2), SHOULDER_Y, 0);
  avBody.add(shoulder);

  // Upper arm (shoulder → elbow)
  const upper = avLimb(shoulder, ARM_W, ARM_H * 0.55, ARM_D, 0, -ARM_H * 0.275, 0, matSkin);

  const elbow = new THREE.Group();
  elbow.position.set(0, -ARM_H * 0.55, 0);
  shoulder.add(elbow);
  // Lower arm (elbow → hand) — needed so arms look like they swing for real
  const lower = avLimb(elbow, ARM_W * 0.92, ARM_H * 0.5, ARM_D * 0.92, 0, -ARM_H * 0.25, 0, matSkin);
  const handRoot = new THREE.Group();
  handRoot.position.set(0, -ARM_H * 0.5, 0);
  elbow.add(handRoot);
  const palm = avLimb(handRoot, ARM_W * 0.85, 0.12, ARM_D * 0.9, 0, -0.04, 0.02, matSkin);

  shoulder.rotation.set(0, 0, 0);
  elbow.rotation.set(0, 0, 0);
  return { shoulder, elbow, upper, lower, hand: palm, handRoot };
}

const avArmL = makeArm(-1);
const avArmR = makeArm(1);
const avShoulderL = avArmL.shoulder;
const avShoulderR = avArmR.shoulder;
const avElbowL = avArmL.elbow;
const avElbowR = avArmR.elbow;

/** Classic yellow Ron skin on head + arms */
function paintPlayerYellowSkin() {
  // Soft natural yellow skin (not neon flat)
  const yellow = 0xf5d76e;
  const shadow = 0xd4b24a;
  const light = 0xffe9a0;
  AV.skin = yellow;
  AV.skinShadow = shadow;
  AV.skinLight = light;
  if (matSkin) {
    matSkin.color.setHex(yellow);
    if (matSkin.roughness != null) matSkin.roughness = 0.72;
    if (matSkin.metalness != null) matSkin.metalness = 0.02;
  }
  if (matSkinShadow) {
    matSkinShadow.color.setHex(shadow);
    if (matSkinShadow.roughness != null) matSkinShadow.roughness = 0.82;
  }
  if (matSkinBright) {
    matSkinBright.color.setHex(light);
    if (matSkinBright.roughness != null) matSkinBright.roughness = 0.65;
  }
  if (avHead && avHead.userData.mesh) avHead.userData.mesh.material = matSkin;
  for (const sh of [avShoulderL, avShoulderR]) {
    if (!sh) continue;
    sh.traverse((ch) => {
      if (ch.isMesh && (ch.material === matSkin || ch.material === matSkinShadow || ch.material === matSkinBright)) {
        ch.material = matSkin;
      }
    });
  }
}
paintPlayerYellowSkin();
state._paintPlayerYellowSkin = paintPlayerYellowSkin;
ensureHairOnHead();

// LEGS — solid black R6 blocks
function makeLeg(side) {
  const hip = new THREE.Group();
  hip.position.set(side * LEG_X, HIP_Y + 0.01, 0);
  avBody.add(hip);

  // Full black thigh
  const thighMesh = avLimb(hip, LEG_W, THIGH_H, TORSO_D * 0.95, 0, -THIGH_H / 2, 0, matPants);
  hip.userData.thighMesh = thighMesh;

  const knee = new THREE.Group();
  knee.position.set(0, -THIGH_H, 0);
  hip.add(knee);
  const shinMesh = avLimb(knee, LEG_W, SHIN_H, TORSO_D * 0.95, 0, -SHIN_H / 2, 0, matPants);
  knee.userData.shinMesh = shinMesh;

  const ankle = new THREE.Group();
  ankle.position.set(0, -SHIN_H, 0);
  knee.add(ankle);
  // Black foot flush with leg (R6 no separate shoe look)
  const footMesh = avLimb(ankle, LEG_W, 0.08, FOOT_LEN, 0, -0.02, 0.02, matPants);
  ankle.userData.footMesh = footMesh;

  return { hip, knee, ankle, thighMesh, shinMesh, footMesh };
}

const avLegL = makeLeg(-1);
const avLegR = makeLeg(1);

const avBase = new THREE.Group();
avBase.visible = false;
avatar.add(avBase);

const torsoY = TORSO_Y;
const headY = HEAD_Y;
const armY = SHOULDER_Y;
const FOOT_D = FOOT_LEN;

const avAnim = { phase: 0, walkWeight: 0, sprint: 0 };

avatar.visible = false;
scene.add(avatar);

// ═══════════════════════════════════════════════════════════
// GLB loader for animals only — player is classic blocky Ron again
// ═══════════════════════════════════════════════════════════
const gltfLoader = new GLTFLoader();
state.realPlayer = { ready: false, root: null, mixer: null, actions: {}, current: null, clock: 0 };
// Slim yellow Ron — upright rectangles
if (avBody) avBody.visible = true;
player.height = 1.85;



// ── Parachute ──
const parachute = new THREE.Group();
parachute.visible = false;
const chuteMat = new THREE.MeshLambertMaterial({
  color: 0xe11d48,
  side: THREE.DoubleSide,
});
const chuteWhite = new THREE.MeshLambertMaterial({
  color: 0xf8fafc,
  side: THREE.DoubleSide,
});
const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.35, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), chuteMat);
canopy.position.y = 2.85;
canopy.scale.set(1.15, 0.55, 1.15);
parachute.add(canopy);
for (let i = 0; i < 6; i++) {
  const panel = new THREE.Mesh(
    new THREE.SphereGeometry(1.36, 6, 4, (i / 6) * Math.PI * 2, Math.PI / 6, 0, Math.PI * 0.5),
    i % 2 ? chuteWhite : chuteMat
  );
  panel.position.y = 2.85;
  panel.scale.set(1.15, 0.55, 1.15);
  parachute.add(panel);
}
const lineMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
const chuteLines = [];
for (let i = 0; i < 4; i++) {
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.8, 4), lineMat);
  line.position.set((i % 2 === 0 ? -0.35 : 0.35), 1.9, (i < 2 ? 0.15 : -0.15));
  line.rotation.z = (i % 2 === 0 ? 0.25 : -0.25);
  line.rotation.x = (i < 2 ? -0.15 : 0.1);
  parachute.add(line);
  chuteLines.push(line);
}
const handleL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), new THREE.MeshLambertMaterial({ color: 0x1e293b }));
handleL.position.set(-0.45, 1.15, 0.2);
const handleR = handleL.clone();
handleR.position.x = 0.45;
parachute.add(handleL, handleR);
const pack = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.2), new THREE.MeshLambertMaterial({ color: 0x334155 }));
pack.position.set(0, 1.05, 0.28);
parachute.add(pack);
avatar.add(parachute);

// No gun — empty camera attach (kept so older references stay safe)
const weaponGroup = new THREE.Group();
weaponGroup.visible = false;
camera.add(weaponGroup);
scene.add(camera);

const CAM_DIST_MIN = 0;
const CAM_DIST_MAX = 14;
const CAM_DIST_THIRD = 0.4; // past this → show your character
const CAM_DIST_DEFAULT_TP = 5.5; // comfortable “see myself” distance

// ─────────────────────────────────────────────────────────────
// WORLD GENERATION
// ─────────────────────────────────────────────────────────────
const colliders = []; // axis-aligned boxes {min, max}
const breakables = new Map(); // mesh.uuid -> {mesh, hp, type}
const placeables = [];
const enemies = [];
const collectibles = [];
const vehicles = [];
const particles = [];
const bullets = [];
const trees = [];
const buildings = [];
const apples = []; // eatable apples on trees
const oceanLife = []; // fish, dolphins, octopus
const treeSites = []; // for monkey climbing
const monkeys = [];
const beachFishers = []; // NPCs fishing on the sand
const treeVines = []; // swaying vine leaves on trees
const pandas = []; // the panda(s) on the meadow
const wildlife = []; // REAL 3D grassland animals (deer, cows, sheep, …)
const oceanWater = []; // animated wave surfaces
const _animalTemplateCache = {}; // path -> gltf for cloning

// Cohesive low-poly palette
const blockMats = {
  dirt: new THREE.MeshStandardMaterial({ color: 0x866043, roughness: 0.95, metalness: 0.0, flatShading: false }),
  grass: new THREE.MeshStandardMaterial({ color: 0x4a8f3c, roughness: 0.9, metalness: 0.0, flatShading: false }), // natural grass
  grassJungle: new THREE.MeshStandardMaterial({ color: 0x3a7a32, roughness: 0.9, metalness: 0.0, flatShading: false }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6b511f, roughness: 0.85, metalness: 0.05, flatShading: false }),
  jungleLog: new THREE.MeshStandardMaterial({ color: 0x5a4a22, roughness: 0.88, metalness: 0.04, flatShading: false }),
  jungleLogDark: new THREE.MeshStandardMaterial({ color: 0x3d3318, roughness: 0.9, metalness: 0.04, flatShading: false }),
  junglePlank: new THREE.MeshStandardMaterial({ color: 0x9f8443, roughness: 0.85, metalness: 0.05, flatShading: false }),
  podzol: new THREE.MeshStandardMaterial({ color: 0x6a4f2f, roughness: 0.92, metalness: 0.0, flatShading: false }),
  pathBlock: new THREE.MeshStandardMaterial({ color: 0x9a7b4f, roughness: 0.95, metalness: 0.0, flatShading: false }),
  cobble: new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 0.92, metalness: 0.05, flatShading: false }),
  mossyCobble: new THREE.MeshStandardMaterial({ color: 0x6b7a5a, roughness: 0.9, metalness: 0.05, flatShading: false }),
  stone: new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 0.9, metalness: 0.08, flatShading: false }),
  crystal: new THREE.MeshStandardMaterial({
    color: 0x5eead4,
    emissive: 0x2dd4bf,
    emissiveIntensity: 0.55,
    roughness: 0.25,
    metalness: 0.35,
  }),
  neon: new THREE.MeshStandardMaterial({
    color: 0xff6bcb,
    emissive: 0xff6bcb,
    emissiveIntensity: 0.65,
    roughness: 0.4,
    metalness: 0.2,
  }),
  road: new THREE.MeshStandardMaterial({ color: 0x3d4454, roughness: 0.9, metalness: 0.08, flatShading: false }),
  sidewalk: new THREE.MeshStandardMaterial({ color: 0xc5cdd8, roughness: 0.92, metalness: 0.05, flatShading: false }),
  curb: new THREE.MeshStandardMaterial({ color: 0x9aa3b2, roughness: 0.88, metalness: 0.1, flatShading: false }),
  water: new THREE.MeshStandardMaterial({
    color: 0x3f76e4,
    transparent: true,
    opacity: 0.85,
    roughness: 0.15,
    metalness: 0.25,
  }),
  // GTA foliage — muted olive/forest greens (NOT neon Minecraft green)
  leaf: new THREE.MeshStandardMaterial({ color: 0x3a6b32, roughness: 0.9, metalness: 0.0, flatShading: false }),
  leaf2: new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 0.9, metalness: 0.0, flatShading: false }),
  leaf3: new THREE.MeshStandardMaterial({ color: 0x4a7a38, roughness: 0.88, metalness: 0.0, flatShading: false }),
  leaf4: new THREE.MeshStandardMaterial({ color: 0x456e34, roughness: 0.9, metalness: 0.0, flatShading: false }),
  leaf5: new THREE.MeshStandardMaterial({ color: 0x2a5024, roughness: 0.9, metalness: 0.0, flatShading: false }),
  leafJungle: new THREE.MeshStandardMaterial({ color: 0x2d5c28, roughness: 0.88, metalness: 0.0, flatShading: false }),
  leafJungle2: new THREE.MeshStandardMaterial({ color: 0x234a22, roughness: 0.9, metalness: 0.0, flatShading: false }),
  leafJungle3: new THREE.MeshStandardMaterial({ color: 0x3a6630, roughness: 0.88, metalness: 0.0, flatShading: false }),
  leafJungle4: new THREE.MeshStandardMaterial({ color: 0x1a3d1a, roughness: 0.92, metalness: 0.0, flatShading: false }),
  leafJungleHi: new THREE.MeshStandardMaterial({ color: 0x4a7040, roughness: 0.86, metalness: 0.02, flatShading: false }),
  // Pineapple fruit (home trees)
  pineapple: new THREE.MeshStandardMaterial({ color: 0xe8a317, roughness: 0.7, metalness: 0.08 }),
  pineappleDark: new THREE.MeshStandardMaterial({ color: 0x8a6a10, roughness: 0.75, metalness: 0.05 }),
  pineappleLeaf: new THREE.MeshStandardMaterial({ color: 0x2d8a1e, roughness: 0.8, metalness: 0.0 }),
  leafWhite: new THREE.MeshStandardMaterial({ color: 0xdcefdc, roughness: 0.88, metalness: 0.0, flatShading: false }), // pale birch leaves
  leafWhite2: new THREE.MeshStandardMaterial({ color: 0xc5e1c5, roughness: 0.88, metalness: 0.0, flatShading: false }),
  leafWhite3: new THREE.MeshStandardMaterial({ color: 0xb8d4a8, roughness: 0.88, metalness: 0.0, flatShading: false }), // soft green birch
  bark: new THREE.MeshStandardMaterial({ color: 0x6b511f, roughness: 0.9, metalness: 0.02, flatShading: false }),
  barkDark: new THREE.MeshStandardMaterial({ color: 0x5a4018, roughness: 0.9, metalness: 0.02, flatShading: false }),
  barkBirch: new THREE.MeshStandardMaterial({ color: 0xf7f4ef, roughness: 0.88, metalness: 0.0, flatShading: false }),
  barkBirchMark: new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9, metalness: 0.05, flatShading: false }),
  barkBirchSoft: new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.88, metalness: 0.0, flatShading: false }),
  dirtMound: new THREE.MeshStandardMaterial({ color: 0x6b5344, roughness: 0.95, metalness: 0.0, flatShading: false }),
  grassTuft: new THREE.MeshStandardMaterial({ color: 0x4a9c45, roughness: 0.9, metalness: 0.0, flatShading: false }),
  apple: new THREE.MeshStandardMaterial({ color: 0xe11d48, emissive: 0x9f1239, emissiveIntensity: 0.2, roughness: 0.55, metalness: 0.05 }),
  appleStem: new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.9, metalness: 0.0 }),
  // Capuchin-style monkey fur (GTA-ish warm brown + cream face)
  monkey: new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.92, metalness: 0.0 }),
  monkeyMid: new THREE.MeshStandardMaterial({ color: 0xa67c52, roughness: 0.9, metalness: 0.0 }),
  monkeyDark: new THREE.MeshStandardMaterial({ color: 0x4a2c14, roughness: 0.92, metalness: 0.0 }),
  monkeyFur: new THREE.MeshStandardMaterial({ color: 0x6b3f1f, roughness: 0.93, metalness: 0.0 }),
  monkeyFace: new THREE.MeshStandardMaterial({ color: 0xf3d5b5, roughness: 0.75, metalness: 0.0 }),
  monkeyBelly: new THREE.MeshStandardMaterial({ color: 0xe8c4a0, roughness: 0.8, metalness: 0.0 }),
  monkeyNose: new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.7, metalness: 0.05 }),
  monkeyPalm: new THREE.MeshStandardMaterial({ color: 0xe8b896, roughness: 0.75, metalness: 0.0 }),
  boat: new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.75, metalness: 0.1, flatShading: false }),
  boatAccent: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7, metalness: 0.15, flatShading: false }),
  boatSail: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.85, metalness: 0.0, flatShading: false }),
  fish: new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45, metalness: 0.25 }),
  fishBlue: new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4, metalness: 0.3 }),
  fishYellow: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45, metalness: 0.2 }),
  dolphin: new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4, metalness: 0.15 }),
  dolphinDark: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.45, metalness: 0.12 }),
  dolphinBelly: new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.5, metalness: 0.08 }),
  whale: new THREE.MeshStandardMaterial({ color: 0x3d4f5f, roughness: 0.45, metalness: 0.15 }),
  whaleBelly: new THREE.MeshStandardMaterial({ color: 0xc5cdd4, roughness: 0.55, metalness: 0.08 }),
  whaleEye: new THREE.MeshBasicMaterial({ color: 0x111827 }),
  octopus: new THREE.MeshStandardMaterial({ color: 0xc026d3, roughness: 0.55, metalness: 0.1, emissive: 0x86198f, emissiveIntensity: 0.15 }),
  octopusDark: new THREE.MeshStandardMaterial({ color: 0x86198f, roughness: 0.6, metalness: 0.1 }),
  plaza: new THREE.MeshStandardMaterial({ color: 0xb8c0cc, roughness: 0.88, metalness: 0.08, flatShading: false }),
  plazaRing: new THREE.MeshStandardMaterial({ color: 0x7b8fa8, roughness: 0.85, metalness: 0.12, flatShading: false }),
  building: [
    new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.85, metalness: 0.1, flatShading: false }),
    new THREE.MeshStandardMaterial({ color: 0xd4dce8, roughness: 0.85, metalness: 0.1, flatShading: false }),
    new THREE.MeshStandardMaterial({ color: 0xb8c5d6, roughness: 0.85, metalness: 0.1, flatShading: false }),
    new THREE.MeshStandardMaterial({ color: 0x9eb0c4, roughness: 0.85, metalness: 0.1, flatShading: false }),
    new THREE.MeshStandardMaterial({ color: 0xc8d4e0, roughness: 0.85, metalness: 0.1, flatShading: false }),
    new THREE.MeshStandardMaterial({ color: 0xa8b8c8, roughness: 0.85, metalness: 0.1, flatShading: false }),
  ],
  window: new THREE.MeshBasicMaterial({ color: 0x7dd3fc }),
  accent: [
    new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
    new THREE.MeshBasicMaterial({ color: 0xa78bfa }),
    new THREE.MeshBasicMaterial({ color: 0xf472b6 }),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
  ],
  // Themed city districts
  cityWhite: [
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    new THREE.MeshLambertMaterial({ color: 0xf1f5f9 }),
    new THREE.MeshLambertMaterial({ color: 0xe2e8f0 }),
    new THREE.MeshLambertMaterial({ color: 0xcbd5e1 }),
  ],
  cityBlack: [
    new THREE.MeshLambertMaterial({ color: 0x0f0f12 }),
    new THREE.MeshLambertMaterial({ color: 0x1a1a22 }),
    new THREE.MeshLambertMaterial({ color: 0x27272f }),
    new THREE.MeshLambertMaterial({ color: 0x3f3f46 }),
  ],
  cityGold: [
    new THREE.MeshLambertMaterial({ color: 0xb45309 }),
    new THREE.MeshLambertMaterial({ color: 0xd97706 }),
    new THREE.MeshLambertMaterial({ color: 0xf59e0b }),
    new THREE.MeshLambertMaterial({ color: 0x92400e }),
  ],
  cityCyan: [
    new THREE.MeshLambertMaterial({ color: 0x0e7490 }),
    new THREE.MeshLambertMaterial({ color: 0x155e75 }),
    new THREE.MeshLambertMaterial({ color: 0x0891b2 }),
    new THREE.MeshLambertMaterial({ color: 0x164e63 }),
  ],
  winWarm: new THREE.MeshBasicMaterial({ color: 0xfde68a }),
  winCool: new THREE.MeshBasicMaterial({ color: 0x67e8f9 }),
  winNeon: new THREE.MeshBasicMaterial({ color: 0xf0abfc }),
  winDark: new THREE.MeshBasicMaterial({ color: 0x1e3a5f }),
  heliBody: new THREE.MeshLambertMaterial({ color: 0x1e293b }),
  heliAccent: new THREE.MeshLambertMaterial({ color: 0xfbbf24 }),
  heliGlass: new THREE.MeshLambertMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.55,
  }),
  ladder: new THREE.MeshLambertMaterial({ color: 0x94a3b8 }),
};

const GEO = {
  // Soft shared shapes (higher segments = less blocky)
  block: (() => {
    try { return new RoundedBoxGeometry(1, 1, 1, 2, 0.12); }
    catch (_) { return new THREE.BoxGeometry(1, 1, 1); }
  })(),
  trunk: new THREE.CylinderGeometry(0.18, 0.32, 2.4, 14),
  trunkTall: new THREE.CylinderGeometry(0.14, 0.28, 3.2, 14),
  leaf: new THREE.SphereGeometry(1.15, 14, 12),
  leafSm: new THREE.SphereGeometry(0.72, 12, 10),
  leafTiny: new THREE.SphereGeometry(0.4, 10, 8),
  leafCone: new THREE.ConeGeometry(1.1, 2.4, 12),
  apple: new THREE.SphereGeometry(0.14, 12, 10),
  crystal: new THREE.OctahedronGeometry(0.5, 1),
  enemyBody: (() => {
    try { return new RoundedBoxGeometry(0.8, 1.4, 0.5, 2, 0.1); }
    catch (_) { return new THREE.BoxGeometry(0.8, 1.4, 0.5); }
  })(),
  enemyHead: new THREE.SphereGeometry(0.32, 12, 10),
  spark: new THREE.SphereGeometry(0.06, 6, 6),
  fish: new THREE.ConeGeometry(0.18, 0.55, 8),
  dolphin: new THREE.SphereGeometry(0.35, 12, 10),
  octopus: new THREE.SphereGeometry(0.4, 12, 10),
};

function addCollider(x, y, z, w, h, d) {
  const halfW = w / 2, halfH = h / 2, halfD = d / 2;
  colliders.push({
    min: new THREE.Vector3(x - halfW, y - halfH, z - halfD),
    max: new THREE.Vector3(x + halfW, y + halfH, z + halfD),
  });
}

function noise2(x, z) {
  return (
    Math.sin(x * 0.04) * Math.cos(z * 0.045) * 3.5 +
    Math.sin(x * 0.018 + 1.5) * Math.cos(z * 0.02) * 8 +
    Math.sin(x * 0.09 + z * 0.07) * 1.8
  );
}

// ── PHOTO CRATER (best realistic match to user image) ──
// Snowy mountain bowl · dark lake at bottom · pointed spire · cable · NO white ball clutter
const CRATER_CX = 0;
const CRATER_CZ = 52;
const CRATER_R = 54; // rim opening
const CRATER_LAKE_R = 13.5; // dark lake diameter (photo proportions)
const CRATER_RIM_Y = 48; // high snow rim
const WATER_SURFACE = 9.5; // lake surface (deep enough to read as a crater, still visible from rim)

// Ocean aliases = crater lake
const OCEAN_CX = CRATER_CX;
const OCEAN_CZ = CRATER_CZ;
const OCEAN_R = CRATER_LAKE_R;
const OCEAN_MTN_X = CRATER_CX;
const OCEAN_MTN_Z = CRATER_CZ;
const OCEAN_MTN_R = 3.2; // spire foundation rock
const OCEAN_START = CRATER_CZ - CRATER_R + 5;

/** Rock base under the tower in the lake */
function oceanMountainY(x, z) {
  const d = Math.hypot(x - OCEAN_MTN_X, z - OCEAN_MTN_Z);
  if (d >= OCEAN_MTN_R) return null;
  const t = 1 - d / OCEAN_MTN_R;
  return WATER_SURFACE + 0.15 + t * t * 2.2;
}

/**
 * EMPTY WORLD terrain — almost flat grass field only.
 * All landmarks/clutter removed per user request.
 */
function groundY(x, z) {
  const ax = Math.abs(x);

  // Spider-Man jungle pocket (low, natural floor)
  {
    const jdx = x - SPIDER_JUNGLE_X;
    const jdz = z - SPIDER_JUNGLE_Z;
    if (jdx * jdx + jdz * jdz < SPIDER_JUNGLE_R * SPIDER_JUNGLE_R) {
      const edge = Math.sqrt(jdx * jdx + jdz * jdz) / SPIDER_JUNGLE_R;
      return (
        1.05 +
        noise2(x * 0.18, z * 0.18) * 0.45 +
        noise2(x * 0.08, z * 0.08) * 0.3 -
        edge * edge * 0.35
      );
    }
  }

  // Spire foundation in lake
  {
    const mY = oceanMountainY(x, z);
    if (mY != null && mY > WATER_SURFACE + 0.1) return mY;
  }

  const dC = Math.hypot(x - CRATER_CX, z - CRATER_CZ);

  // ── Photo crater bowl (only inside the mountain) ──
  if (dC < CRATER_R) {
    const t = dC / CRATER_R;
    if (dC < CRATER_LAKE_R + 0.9) {
      const edge = dC / (CRATER_LAKE_R + 0.9);
      if (edge < 0.9) {
        return WATER_SURFACE - 3.2 - (1 - edge) * 1.6 + noise2(x * 0.2, z * 0.2) * 0.12;
      }
      return WATER_SURFACE - 0.2 + (edge - 0.9) * 6;
    }
    const inner = (CRATER_LAKE_R + 0.9) / CRATER_R;
    const u = Math.max(0, (t - inner) / (1 - inner));
    const wall = Math.pow(u, 1.55);
    const ridge =
      noise2(x * 0.09, z * 0.09) * 2.4 * wall +
      noise2(x * 0.22, z * 0.22) * 1.1 * wall +
      noise2(x * 0.45, z * 0.45) * 0.45 * wall;
    return WATER_SURFACE + 0.45 + wall * (CRATER_RIM_Y - WATER_SURFACE - 0.45) + ridge;
  }

  // ── GTA lowlands base (smooth rolling countryside) ──
  let h =
    0.85 +
    noise2(x * 0.012, z * 0.012) * 1.6 +
    noise2(x * 0.035, z * 0.035) * 0.9 +
    noise2(x * 0.08, z * 0.08) * 0.35;

  // Gentle city plateau near spawn / roads (flat playable GTA streets feel)
  if (ax < 95 && z > -55 && z < 35) {
    const cityFlat = 1.05 + noise2(x * 0.04, z * 0.04) * 0.18;
    h = THREE.MathUtils.lerp(h, cityFlat, 0.72);
  }

  // Crater mountain massif — rises only near the hole (photo landmark)
  // Outer skirts: foothills → snow rim (not the whole map)
  if (dC < CRATER_R + 95) {
    const outer = (dC - CRATER_R) / 95; // 0 at rim edge, 1 at far skirt
    const massif = Math.pow(1 - Math.max(0, Math.min(1, outer)), 1.65);
    const rimH =
      CRATER_RIM_Y +
      4 +
      noise2(x * 0.06, z * 0.06) * 3.5 +
      noise2(x * 0.14, z * 0.14) * 1.5;
    h = Math.max(h, massif * rimH + (1 - massif) * h);
  }

  // Lookout ridge on north side of crater (spawn overlook)
  if (Math.abs(x) < 40 && z > CRATER_CZ - CRATER_R - 18 && z < CRATER_CZ - CRATER_R + 10) {
    const look = 1 - Math.abs(z - (CRATER_CZ - CRATER_R + 2)) / 14;
    if (look > 0) {
      h = Math.max(h, CRATER_RIM_Y + 2 + look * look * 6 + noise2(x * 0.1, z * 0.1) * 1.2);
    }
  }

  // Soft distant hills (GTA countryside — not cube peaks)
  {
    const d1 = Math.hypot(x + 55, z + 75);
    if (d1 < 42) {
      const t = 1 - d1 / 42;
      h = Math.max(h, 2 + t * t * 22 + noise2(x * 0.2, z * 0.2) * 2.2 * t);
    }
    const d2 = Math.hypot(x + 30, z + 100);
    if (d2 < 48) {
      const t = 1 - d2 / 48;
      h = Math.max(h, 2 + t * t * 26 + noise2(x * 0.18, z * 0.18) * 2.4 * t);
    }
    const d3 = Math.hypot(x - 70, z + 70);
    if (d3 < 38) {
      const t = 1 - d3 / 38;
      h = Math.max(h, 1.5 + t * t * 16 + noise2(x * 0.2, z * 0.2) * 1.8 * t);
    }
  }

  // Airport district rise (NE) — smooth pad, not block mountain
  {
    const dA = Math.hypot(x - 95, z + 95);
    if (dA < 55) {
      const t = 1 - dA / 55;
      h = Math.max(h, 3 + t * t * 14 + noise2(x * 0.1, z * 0.1) * 1.2 * t);
    }
  }

  // Far map edge soft rise (world border feel)
  if (ax > 140 || Math.abs(z) > 150) {
    const edge = Math.max(ax - 140, Math.abs(z) - 150, 0);
    h = Math.max(h, Math.min(12, 1.5 + edge * 0.06 + noise2(x * 0.05, z * 0.05) * 1.5));
  }

  return Math.max(0.15, h);
}

function isOcean(x, z) {
  const mY = oceanMountainY(x, z);
  if (mY != null && mY > WATER_SURFACE + 0.35) return false;
  // Dark lake only at the BOTTOM of the photo crater
  const d = Math.hypot(x - CRATER_CX, z - CRATER_CZ);
  return d < CRATER_LAKE_R - 0.65;
}

// Climbable peaks — solid SURFACE you run ON (not inside)
const MOUNTAIN_PEAKS = [
  { x: -55, z: -75, h: 52, r: 26, name: "NORTH PEAK", snowy: true },
  { x: 70, z: -70, h: 28, r: 18, name: "EAST RIDGE", snowy: true },
  { x: -90, z: 35, h: 26, r: 17, name: "WEST SPIRE", snowy: true },
  { x: 45, z: 85, h: 24, r: 16, name: "SOUTH KNOB", snowy: true },
  { x: -30, z: -100, h: 56, r: 28, name: "SNOW DOME", snowy: true },
];

/**
 * Height of the solid mountain surface under (x,z), or null if not on a peak.
 * Smooth dome so you can RUN ON the mountain, never fall inside.
 */
function peakSurfaceY(x, z) {
  let best = null;
  for (let i = 0; i < MOUNTAIN_PEAKS.length; i++) {
    const pk = MOUNTAIN_PEAKS[i];
    const d = Math.hypot(x - pk.x, z - pk.z);
    // slight padding so edge is walkable
    if (d >= pk.r * 1.05) continue;
    const t = 1 - d / (pk.r * 1.08);
    // smoother dome — easier to crawl up the outside
    const dome = Math.pow(Math.max(0, t), 1.05);
    // base follows terrain under the peak footprint
    const base =
      8 +
      noise2(pk.x * 0.05, pk.z * 0.05) * 3 +
      noise2(x * 0.08, z * 0.08) * 1.2;
    const y = base + pk.h * dome + noise2(x * 0.25, z * 0.25) * 0.6 * t;
    if (best == null || y > best) best = y;
  }
  // Ocean island mountain as solid walkable cone
  {
    const mY = oceanMountainY(x, z);
    if (mY != null && mY > 0.5) {
      if (best == null || mY > best) best = mY;
    }
  }
  return best;
}


/** True when player should swim (over deep ocean, not in boat/rocket) */
function isInWater(x, y, z) {
  if (!isOcean(x, z)) return false;
  return y < WATER_SURFACE + 1.5;
}

/** Fully underwater (head under surface) */
function isUnderwater(x, y, z) {
  return isOcean(x, z) && y < WATER_SURFACE - 0.35;
}

/** Soak Ron's hair + clothes when swimming; dry out on land */
function updateWetAppearance(dt, swimming) {
  const target = swimming ? 1 : 0;
  // Soak instantly in water; dry slowly on land
  const rate = swimming ? 6 : 0.14;
  state.wetness += (target - state.wetness) * Math.min(1, rate * dt);
  if (state.wetness < 0.02 && !swimming) state.wetness = 0;
  if (state.wetness > 0.98 && swimming) state.wetness = 1;

  const w = state.wetness;
  const lerpC = (dry, wet) => {
    const c = new THREE.Color(dry);
    c.lerp(new THREE.Color(wet), w);
    return c;
  };
  matHair.color.copy(lerpC(DRY_COLORS.hair, WET_COLORS.hair));
  matHairHi.color.copy(lerpC(DRY_COLORS.hairHi, WET_COLORS.hairHi));
  matShirt.color.copy(lerpC(DRY_COLORS.shirt, WET_COLORS.shirt));
  matShirtDark.color.copy(lerpC(DRY_COLORS.shirtDark, WET_COLORS.shirtDark));
  matPants.color.copy(lerpC(DRY_COLORS.pants, WET_COLORS.pants));
  matPantsDark.color.copy(lerpC(DRY_COLORS.pantsDark, WET_COLORS.pantsDark));

  // Cloud/short hair STAYS on the head always (never hide it when wet)
  const soaked = w > 0.35;
  if (state._cloudAfro || state._hairRoot) {
    const hair = state._cloudAfro || state._hairRoot;
    hair.visible = true;
  }
  // Only hide old dry strand hair if we actually have a separate wet mesh
  if (state._wetHairRoot && state._dryHairRoot && state._dryHairRoot !== state._cloudAfro) {
    state._dryHairRoot.visible = !soaked;
    state._wetHairRoot.visible = soaked;
    if (soaked && state._wetHairMeshes) {
      const t = state.elapsed || 0;
      state._wetHairMeshes.forEach((m, i) => {
        m.rotation.z = Math.sin(t * 2.2 + i) * 0.1 * w;
        m.rotation.x = (m.userData.baseRx || 0.3) + Math.sin(t * 1.6 + i) * 0.05 * w;
      });
    }
  }

  // Splash toast once when entering water
  if (swimming && !state.wasSwimming) {
    toast("💧 Hair soaking wet! Clothes drenched!", "");
    playSplash();
    // Force third person briefly so you SEE the wet hair
    if (player.camDistTarget < 2.5) player.camDistTarget = 3.8;
  }
  state.wasSwimming = swimming;
}

function freezeMesh(mesh) {
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  mesh.castShadow = false;
}

function addBox(x, y, z, w, h, d, mat, opts = {}) {
  // Soft rounded boxes — removes hard cube-style cube edges
  const r = Math.min(0.14, Math.min(w, h, d) * 0.18);
  let geo;
  try {
    geo = new RoundedBoxGeometry(w, h, d, 3, Math.max(0.02, r));
  } catch (_) {
    geo = new THREE.BoxGeometry(w, h, d);
  }
  if (mat && mat.flatShading) mat.flatShading = false;
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.receiveShadow = !!opts.receive;
  scene.add(m);
  freezeMesh(m);
  if (opts.collide) addCollider(x, y, z, w, h, d);
  return m;
}

/** Grass blades that GROW OUT of the green ground (tall, dense, clearly visible) */
function makeGrassBladeTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  // SOLID green blade (tip stays visible — no full fade-out)
  const grd = ctx.createLinearGradient(0, 0, 0, size);
  grd.addColorStop(0, "rgba(180, 255, 90, 1)");   // bright tip
  grd.addColorStop(0.15, "rgba(80, 220, 55, 1)");
  grd.addColorStop(0.4, "rgba(40, 185, 50, 1)");
  grd.addColorStop(0.7, "rgba(25, 145, 40, 1)");
  grd.addColorStop(1, "rgba(14, 95, 28, 1)");     // deep base in soil
  ctx.fillStyle = grd;

  // Fat tapered blade so it reads from any angle
  ctx.beginPath();
  ctx.moveTo(size * 0.5, 1);
  ctx.quadraticCurveTo(size * 0.82, size * 0.28, size * 0.7, size);
  ctx.lineTo(size * 0.3, size);
  ctx.quadraticCurveTo(size * 0.18, size * 0.28, size * 0.5, 1);
  ctx.closePath();
  ctx.fill();

  // Vein
  ctx.strokeStyle = "rgba(220, 255, 140, 0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, 6);
  ctx.lineTo(size * 0.5, size - 4);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function makeGrassBladeGeometry() {
  // A little higher — clearly sticks UP out of the ground
  const H = 1.4;
  const geo = new THREE.PlaneGeometry(0.13, H, 2, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y + H / 2) / H; // 0 base → 1 tip
    const taper = 1 - t * 0.88;
    pos.setX(i, pos.getX(i) * taper);
    pos.setZ(i, Math.sin(t * Math.PI) * 0.08 + t * t * 0.05);
  }
  pos.needsUpdate = true;
  geo.translate(0, H / 2, 0); // pivot at ground = blade grows upward
  geo.computeVertexNormals();
  return geo;
}

function buildPhotoRealGrass() {
  const bladeTex = makeGrassBladeTexture();
  const bladeGeo = makeGrassBladeGeometry();
  const mat = new THREE.MeshStandardMaterial({
    map: bladeTex,
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.15,
    side: THREE.DoubleSide,
    roughness: 0.72,
    metalness: 0.0,
    depthWrite: true,
    vertexColors: true,
  });

  // Lots of blades so grass visibly grows out of the ground everywhere you walk
  const COUNT = 90000;
  const mesh = new THREE.InstancedMesh(bladeGeo, mat, COUNT);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
  mesh.name = "photoRealGrass";
  mesh.frustumCulled = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 1; // draw on top of ground carpet

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let placed = 0;

  const rng = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  /**
   * Plant one blade GROWING OUT of the ground surface.
   * y = ground + tiny offset so roots sit in the green carpet and blades stick up.
   */
  function plantBlade(x, z, i, yawExtra = 0) {
    if (placed >= COUNT) return false;
    if (typeof isOcean === "function" && isOcean(x, z)) return false;
    // Keep blades off the deep water / mountain beach
    if (Math.hypot(x - OCEAN_CX, z - OCEAN_CZ) < OCEAN_R + 4) return false;
    const gy = Math.max(0, groundY(x, z));
    if (gy > 4.5 || gy < 0) return false;

    // A little higher grass
    const h = 1.45 + rng(i * 11.3) * 1.55; // ~1.45–3.0 scale
    const w = 0.9 + rng(i * 13.7) * 1.15;
    const lean = (rng(i * 17.1) - 0.5) * 0.28; // slight lean, still upright

    // Sit just above ground so grass COMES OUT of the green floor
    dummy.position.set(x, gy + 0.02, z);
    dummy.rotation.set(lean * 0.35, rng(i * 19.9) * Math.PI * 2 + yawExtra, lean * 0.55);
    dummy.scale.set(w, h, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);

    const shade = 0.85 + rng(i * 23.3) * 0.35;
    color.setRGB(0.1 * shade, Math.min(1, 0.9 * shade), 0.1 * shade);
    if (mesh.setColorAt) mesh.setColorAt(placed, color);
    placed++;
    return true;
  }

  // ── PASS 1: Super-dense lawn around YOU / home — grass exploding out of the ground ──
  for (let i = 0; i < COUNT && placed < COUNT * 0.55; i++) {
    // Tight packing near spawn so every step shows blades rising up
    const near = rng(i * 2.2) < 0.7;
    let x, z;
    if (near) {
      x = (rng(i * 1.7) - 0.5) * 55;
      z = 4 + (rng(i * 2.3) - 0.2) * 50;
    } else {
      x = (rng(i * 4.1) - 0.5) * 120;
      z = (rng(i * 5.2) - 0.1) * 90;
    }
    plantBlade(x, z, i, 0);
  }

  // ── PASS 2: Crossed blades (X shape tufts) = thick grass coming out ──
  let j = 0;
  while (placed < COUNT * 0.82 && j < COUNT) {
    const i = j + 9000;
    const x = (rng(i * 1.9) - 0.5) * 100;
    const z = 2 + (rng(i * 2.7) - 0.15) * 80;
    plantBlade(x, z, i, Math.PI / 2);
    // Clump buddy right next to it (tuft growing together)
    if (placed < COUNT) {
      plantBlade(
        x + (rng(i + 3) - 0.5) * 0.12,
        z + (rng(i + 4) - 0.5) * 0.12,
        i + 1,
        Math.PI / 3
      );
    }
    j++;
  }

  // ── PASS 3: Fill remaining with mid/far fields ──
  j = 0;
  while (placed < COUNT && j < COUNT * 2) {
    const i = j + 20000;
    const x = (rng(i * 6.1) - 0.5) * 220;
    const z = (rng(i * 7.3) - 0.05) * 140;
    plantBlade(x, z, i, rng(i) * Math.PI);
    j++;
  }

  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
  state._grassMesh = mesh;

  // No flat carpet planes (they floated black/green and looked broken)

  console.log(
    "%c[NEXUS] Grass blades: " + placed,
    "color:#22c55e;font-weight:bold"
  );
}


/** Gentle breeze on grass instances (cheap uniform lean) */
function updateGrassSway(dt) {
  const mesh = state._grassMesh;
  if (!mesh || !mesh.material) return;
  // Material-level fake sway via slight rotation of whole field is too strong.
  // Instead nudge a uniform wind phase used only for a subtle material offset if present.
  state._grassWind = (state._grassWind || 0) + dt * 1.4;
  // Light whole-field rock (very small) so blades feel alive without per-instance cost
  mesh.rotation.z = Math.sin(state._grassWind) * 0.004;
  mesh.rotation.x = Math.cos(state._grassWind * 0.7) * 0.002;
}

function buildWorld() {
  // ══════════════════════════════════════════════════════════
  // FULL WORLD REDO — GTA open-world look + photo crater mountain
  // Smooth terrain · grass/dirt/asphalt · NO Minecraft cubes
  // ══════════════════════════════════════════════════════════
  const cAsphalt = new THREE.Color(0x2c2c30);
  const cAsphalt2 = new THREE.Color(0x38383e);
  const cSidewalk = new THREE.Color(0x8a9098);
  const cConcrete = new THREE.Color(0x6e7278);
  const cDirt = new THREE.Color(0x6b5344);
  const cDirtDark = new THREE.Color(0x564536);
  const cDryGrass = new THREE.Color(0x4a6b38);
  const cDryGrass2 = new THREE.Color(0x3d5c30);
  const cGrassRich = new THREE.Color(0x3f6e34);
  const cScrub = new THREE.Color(0x5a6a42);
  const cRockCliff = new THREE.Color(0x3a4048);
  const cRockLit = new THREE.Color(0x5c6570);
  const cRockSnow = new THREE.Color(0xa8b4c0);
  const cSnowDeep = new THREE.Color(0xf4f7fa);
  const cSnowSoft = new THREE.Color(0xe0e6ee);

  // Higher-res smooth ground (GTA rolling hills, not voxels)
  const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 360, 360);
  const gpos = groundGeo.attributes.position;
  const colors = [];

  /** Asphalt road mask — GTA street grid feel (smooth painted on mesh) */
  function roadMask(x, z) {
    // Main N–S boulevard toward crater lookout
    if (Math.abs(x) < 4.2 && z > -70 && z < CRATER_CZ - CRATER_R - 2) return 1;
    // E–W cross street through city
    if (Math.abs(z + 8) < 3.6 && Math.abs(x) < 90) return 1;
    // Diagonal toward airport (NE)
    const dAir = Math.abs((z + 20) - (-0.85 * (x - 10)));
    if (x > 15 && x < 100 && z > -110 && z < -20 && dAir < 3.8) return 1;
    // Ring road around city plaza
    const dPlaza = Math.hypot(x, z - 5);
    if (dPlaza > 22 && dPlaza < 26 && z > -25 && z < 35) return 0.85;
    // Shoulder / dirt track toward mountain
    if (Math.abs(x - 18) < 2.2 && z > 20 && z < CRATER_CZ - CRATER_R - 8) return 0.55;
    return 0;
  }

  // 0–1 noise ONLY for colors (noise2 is height-scale and was turning the world pink)
  function n01(x, z, sx = 1, sz = 1) {
    return THREE.MathUtils.clamp(
      (Math.sin(x * 0.11 * sx) * Math.cos(z * 0.09 * sz) + 1) * 0.5 * 0.65 +
        (Math.sin(x * 0.27 * sx + 1.7) * Math.cos(z * 0.23 * sz) + 1) * 0.5 * 0.35,
      0,
      1
    );
  }

  for (let i = 0; i < gpos.count; i++) {
    const x = gpos.getX(i);
    const planeY = gpos.getY(i);
    const z = -planeY;
    const h = groundY(x, z);
    gpos.setZ(i, Math.max(h, 0));
    const col = new THREE.Color();
    const n = n01(x, z, 1, 1);
    const n2 = n01(x, z, 1.7, 1.4);
    const dC = Math.hypot(x - CRATER_CX, z - CRATER_CZ);

    if (isOcean(x, z)) {
      col.set(0x0a3d52);
    } else if (dC < CRATER_R + 4) {
      // Photo crater walls — dark rock + snow
      const wallT = THREE.MathUtils.clamp(
        (h - WATER_SURFACE) / Math.max(1, CRATER_RIM_Y - WATER_SURFACE),
        0,
        1
      );
      const stripe = n01(x * 3.2, z * 2.8, 1, 1);
      const snowPatch = Math.pow(n01(x, z, 2.2, 2.0), 1.35);
      if (wallT < 0.28) {
        col.lerpColors(cRockCliff, new THREE.Color(0x2f353c), 0.4 + stripe * 0.35);
      } else if (wallT < 0.62) {
        col.lerpColors(cRockCliff, cRockLit, 0.25 + stripe * 0.4);
        col.lerp(cSnowSoft, THREE.MathUtils.clamp(snowPatch * 0.45 * wallT, 0, 0.55));
      } else {
        col.lerpColors(cSnowSoft, cSnowDeep, 0.4 + n * 0.35);
        col.lerp(cRockLit, THREE.MathUtils.clamp((1 - snowPatch) * 0.32, 0, 0.4));
      }
    } else if (dC < CRATER_R + 90 && h > 12) {
      // Mountain skirts: rock → snow
      const t = THREE.MathUtils.clamp((h - 12) / 30, 0, 1);
      col.lerpColors(cRockLit, cRockSnow, t * 0.55);
      col.lerp(cSnowSoft, t * t * 0.7);
      col.lerp(cDirt, (1 - t) * 0.25);
    } else {
      // GTA lowlands: grass, dirt, asphalt, scrub
      const rm = roadMask(x, z);
      if (rm > 0.5) {
        col.lerpColors(cAsphalt, cAsphalt2, n * 0.5);
        if (Math.abs(x) < 0.35 && z > -70 && z < 30) col.lerp(new THREE.Color(0x9a9aa0), 0.35);
      } else if (rm > 0.2) {
        col.lerpColors(cDirtDark, cAsphalt, 0.55);
      } else {
        col.lerpColors(cDryGrass, cGrassRich, THREE.MathUtils.clamp(n * 0.55 + n2 * 0.2, 0, 1));
        col.lerp(cDryGrass2, (1 - n) * 0.35);
        // Dirt patches (0–1 only)
        const dirtN = n01(x, z, 2.4, 2.1);
        if (dirtN > 0.62) col.lerp(cDirt, THREE.MathUtils.clamp((dirtN - 0.62) * 2.2, 0, 0.55));
        if (h > 4 && h < 12) col.lerp(cScrub, 0.25 + n * 0.2);
        const dPlaza = Math.hypot(x, z - 5);
        if (dPlaza < 18) {
          col.lerpColors(cConcrete, cSidewalk, n * 0.4);
          col.lerp(cAsphalt2, dPlaza < 8 ? 0.15 : 0);
        }
      }
    }
    // Hard clamp — never allow out-of-range RGB (that caused the pink world)
    colors.push(
      THREE.MathUtils.clamp(col.r, 0, 1),
      THREE.MathUtils.clamp(col.g, 0, 1),
      THREE.MathUtils.clamp(col.b, 0, 1)
    );
  }
  groundGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: false,
      roughness: 0.9,
      metalness: 0.02,
      envMapIntensity: 0.85,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  freezeMesh(ground);
  addCollider(0, -2, 0, WORLD_SIZE * 2, 4, WORLD_SIZE * 2);

  // Soft road overlays (extra GTA asphalt definition — smooth planes, not cubes)
  (function paintGTARoads() {
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2e, roughness: 0.92, metalness: 0.06, flatShading: false,
    });
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xc8c8cc, roughness: 0.7, metalness: 0.1, flatShading: false,
    });
    function roadStrip(x0, z0, x1, z1, w) {
      const dx = x1 - x0, dz = z1 - z0;
      const len = Math.hypot(dx, dz) || 1;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      const gy = groundY(mx, mz) + 0.04;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, len, 1, 1), roadMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = Math.atan2(dx, dz);
      mesh.position.set(mx, gy, mz);
      mesh.receiveShadow = true;
      scene.add(mesh);
      freezeMesh(mesh);
      // Center dashed line
      const steps = Math.max(3, Math.floor(len / 8));
      for (let s = 0; s < steps; s++) {
        if (s % 2) continue;
        const t = (s + 0.5) / steps;
        const lx = x0 + dx * t, lz = z0 + dz * t;
        const ly = groundY(lx, lz) + 0.05;
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 2.2), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = Math.atan2(dx, dz);
        dash.position.set(lx, ly, lz);
        scene.add(dash);
        freezeMesh(dash);
      }
    }
    // Boulevard toward crater lookout
    roadStrip(0, -55, 0, CRATER_CZ - CRATER_R - 6, 8.5);
    // Cross street
    roadStrip(-85, -8, 85, -8, 7.5);
    // Airport road
    roadStrip(20, -25, 95, -95, 7);
  })();

  // Photo crater lake (dark water at bottom of mountain hole)
  buildRealisticOcean();

  // ── Trees (kept, but not in the snow crater) ──
  const grassMat = blockMats.grass;
  const stoneMat = blockMats.stone;
  const dirtMat = blockMats.dirt;
  const woodMat = blockMats.wood;
  const leafMat = blockMats.leaf;
  const leafMat2 = blockMats.leaf2;
  const logMat = blockMats.jungleLog;
  const logDark = blockMats.jungleLogDark || blockMats.jungleLog;
  const jLeaf = [
    blockMats.leafJungle,
    blockMats.leafJungle2,
    blockMats.leafJungle3,
    blockMats.leafJungle4 || blockMats.leafJungle2,
    blockMats.leafJungleHi || blockMats.leaf3,
    blockMats.leaf,
    blockMats.leaf3,
  ];

  /** Pineapple growing on a tree (body + crown of leaves) */
  function placePineapple(px, py, pz, scale = 1) {
    const g = new THREE.Group();
    g.position.set(px, py, pz);
    // Golden scaly body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12 * scale, 0.16 * scale, 0.32 * scale, 14),
      blockMats.pineapple
    );
    body.castShadow = true;
    g.add(body);
    // Diamond pattern rings (detail)
    for (let r = 0; r < 3; r++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.13 * scale + r * 0.01, 0.015 * scale, 4, 8),
        blockMats.pineappleDark
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.08 * scale + r * 0.09 * scale;
      g.add(ring);
    }
    // Green crown
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const frond = new THREE.Mesh(
        new THREE.ConeGeometry(0.04 * scale, 0.22 * scale, 4),
        blockMats.pineappleLeaf
      );
      frond.position.set(
        Math.cos(a) * 0.05 * scale,
        0.2 * scale,
        Math.sin(a) * 0.05 * scale
      );
      frond.rotation.z = Math.cos(a) * 0.55;
      frond.rotation.x = Math.sin(a) * 0.55;
      g.add(frond);
    }
    // Center frond
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.03 * scale, 0.18 * scale, 4),
      blockMats.pineappleLeaf
    );
    tip.position.y = 0.28 * scale;
    g.add(tip);
    // Tiny stem attach
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02 * scale, 0.02 * scale, 0.1 * scale, 5),
      blockMats.appleStem
    );
    stem.position.y = -0.2 * scale;
    g.add(stem);
    scene.add(g);
    freezeMesh(g);
    return g;
  }

  /** Smooth GTA-style tree — cylinder trunk + soft sphere canopy (no cube leaves) */
  function placeJungleTree(tx, tz, opts = {}) {
    // Continuous positions — NOT snapped to a grid (that looks Minecraft)
    const gx = tx + (noise2(tx * 0.7, tz * 0.5) - 0.5) * 0.4;
    const gz = tz + (noise2(tz * 0.6, tx * 0.4) - 0.5) * 0.4;
    const gy = Math.max(0, groundY(gx, gz));
    // Trees on lowlands + foothills only (not on snow crater)
    if (gy < 0 || gy > 16) return null;
    if (isOcean(gx, gz)) return null;
    if (Math.hypot(gx - CRATER_CX, gz - CRATER_CZ) < CRATER_R + 10) return null;
    // Keep small clear zone near road plaza
    if (Math.abs(gx) < 12 && Math.abs(gz + 8) < 10 && !opts.force) return null;

    const seed = Math.abs(Math.sin(gx * 3.1 + gz * 1.7));
    const tall = opts.tall || (5 + Math.floor(seed * 5)); // 5–9
    const thick = opts.thick || (0.55 + seed * 0.35);
    const withPineapple = !!opts.pineapple || opts.home;

    // ── Trunk (segmented jungle log with bark variation) ──
    for (let y = 0; y < tall; y++) {
      const tw = thick * (1 - y * 0.03);
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(tw * 0.85, tw, 1.05, 14),
        y % 2 === 0 ? logMat : logDark
      );
      log.position.set(gx, gy + 0.52 + y, gz);
      log.rotation.y = y * 0.35;
      log.castShadow = true;
      scene.add(log);
      freezeMesh(log);
      // Bark knots / growths
      if (y > 0 && y < tall - 1 && (y + (gx | 0)) % 2 === 0) {
        const knot = new THREE.Mesh(
          new THREE.SphereGeometry(tw * 0.28, 10, 8),
          logDark
        );
        const ka = y * 1.7;
        knot.position.set(
          gx + Math.cos(ka) * tw * 0.9,
          gy + 0.5 + y,
          gz + Math.sin(ka) * tw * 0.9
        );
        scene.add(knot);
        freezeMesh(knot);
      }
    }

    // Side branches (detail)
    const branchN = 3 + Math.floor(seed * 3);
    for (let b = 0; b < branchN; b++) {
      const by = gy + 2.2 + b * (tall / branchN) * 0.7;
      const ba = b * 2.1 + seed * 6;
      const bl = 0.9 + seed * 0.8;
      const branch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.14, bl, 10),
        logDark
      );
      branch.position.set(
        gx + Math.cos(ba) * bl * 0.45,
        by,
        gz + Math.sin(ba) * bl * 0.45
      );
      branch.rotation.z = Math.cos(ba) * 1.1;
      branch.rotation.x = Math.sin(ba) * 1.1;
      scene.add(branch);
      freezeMesh(branch);
      // Leaf tuft at branch tip
      const tuft = new THREE.Mesh(
        new THREE.SphereGeometry(0.55 + seed * 0.25, 12, 10),
        jLeaf[b % jLeaf.length]
      );
      tuft.position.set(
        gx + Math.cos(ba) * bl * 0.95,
        by + 0.15,
        gz + Math.sin(ba) * bl * 0.95
      );
      tuft.scale.set(1.2, 0.75, 1.1);
      scene.add(tuft);
      freezeMesh(tuft);
    }

    // ── Layered jungle canopy (multiple spheres + palm fronds) ──
    const top = gy + tall;
    const canopyLayers = [
      { y: top - 0.2, r: 1.9, s: 1.15 },
      { y: top + 0.55, r: 1.55, s: 1.0 },
      { y: top + 1.15, r: 1.1, s: 0.9 },
      { y: top + 0.2, r: 1.35, s: 0.85 },
    ];
    canopyLayers.forEach((c, i) => {
      const ox = Math.sin(i * 2.3 + seed * 4) * 0.35;
      const oz = Math.cos(i * 1.7 + seed * 3) * 0.35;
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(c.r, 14, 12),
        jLeaf[i % jLeaf.length]
      );
      leaf.position.set(gx + ox, c.y, gz + oz);
      leaf.scale.set(c.s * 1.15, c.s * 0.72, c.s * 1.1);
      leaf.castShadow = true;
      scene.add(leaf);
      freezeMesh(leaf);
    });

    // Broad palm-style fronds for jungle detail
    for (let f = 0; f < 8; f++) {
      const a = (f / 8) * Math.PI * 2 + seed;
      const frond = new THREE.Mesh(
        new THREE.ConeGeometry(0.35, 1.6, 5),
        jLeaf[(f + 2) % jLeaf.length]
      );
      frond.position.set(
        gx + Math.cos(a) * 1.1,
        top + 0.3,
        gz + Math.sin(a) * 1.1
      );
      frond.rotation.z = Math.cos(a) * 1.2;
      frond.rotation.x = Math.sin(a) * 1.2;
      frond.rotation.y = a;
      scene.add(frond);
      freezeMesh(frond);
    }

    // Hanging vines
    for (let v = 0; v < 4; v++) {
      const a = v * 1.6 + seed * 2;
      const vh = 1.2 + (v % 3) * 0.5;
      const vine = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.06, vh, 5),
        blockMats.leafJungle2
      );
      vine.position.set(
        gx + Math.cos(a) * 1.3,
        top - 0.5 - vh * 0.35,
        gz + Math.sin(a) * 1.3
      );
      scene.add(vine);
      freezeMesh(vine);
      // Compatible with updateTreeVines (soft wind sway)
      treeVines.push({
        root: vine,
        joints: [],
        phase: a,
        speed: 1.1 + (v % 3) * 0.25,
        amp: 0.12 + (v % 2) * 0.06,
      });
    }

    // ── Pineapples growing on tree (especially home trees) ──
    if (withPineapple) {
      const nFruit = opts.home ? 4 + Math.floor(seed * 3) : 2 + Math.floor(seed * 2);
      for (let p = 0; p < nFruit; p++) {
        const a = p * 2.3 + seed * 5;
        const pr = 0.9 + (p % 3) * 0.25;
        placePineapple(
          gx + Math.cos(a) * pr,
          top - 0.4 - (p % 2) * 0.35,
          gz + Math.sin(a) * pr,
          0.85 + (p % 3) * 0.15
        );
      }
    }

    treeSites.push({
      x: gx,
      z: gz,
      groundY: gy,
      climbHeight: tall,
      topY: gy + tall + 1.2,
      kind: "jungle",
      hasApples: false,
      hasPineapple: withPineapple,
    });
    trees.push({ x: gx, z: gz, y: gy, tall, kind: "jungle" });
    return { gx, gz, gy, tall, top };
  }

  // Home grove — detailed jungle trees WITH pineapples (around spawn / your home)
  const homeGrove = [
    [16, 18], [-16, 16], [20, 28], [-18, 30], [12, 36], [-14, 38],
    [28, 14], [-28, 18], [24, 40], [-22, 42], [8, 44], [-8, 46],
    [32, 24], [-32, 26], [18, 8], [-20, 10],
  ];
  for (const [hx, hz] of homeGrove) {
    if (Math.hypot(hx - CRATER_CX, hz - CRATER_CZ) < CRATER_R + 8) continue;
    placeJungleTree(hx, hz, { home: true, pineapple: true, tall: 6 + Math.floor(Math.abs(hx) % 3) });
  }

  // Sparse trees only OUTSIDE the snow crater (photo has few trees on cliffs)
  for (let i = 0; i < 80; i++) {
    const tx = Math.sin(i * 3.71) * 160 + Math.cos(i * 1.1) * 40;
    const tz = Math.cos(i * 2.93) * 120 + Math.sin(i * 0.7) * 30;
    if (Math.hypot(tx - CRATER_CX, tz - CRATER_CZ) < CRATER_R + 12) continue;
    placeJungleTree(tx, tz, { pineapple: false, tall: 5 + (i % 4) });
  }

  // (dirt survival houses removed — no random houses in the world)

  // (old MC tall grass replaced by buildPhotoRealGrass)

  // Dirt block hillsides removed — no cube-style dirt cubes

  // Detailed climbable mountains (you climb them — walk on flat land below)
  // Detailed climbable mountains (walk flat land · climb peaks with K)
  buildDetailedClimbMountains();
  // Photo-style snow crater + lake spire (user reference image)
  buildCraterLandmark();

  // Lucas — on Snow Dome (leaderboard)
  spawnLucasOnPeak();

  // PANDA REMOVED (user request — permanently off)
  // Do not call spawnWalkingPanda

  // Fewer gems — keep clear of airport / crater (no junk spikes)
  [
    [22, 38], [-25, 42], [40, -15], [-35, -18], [70, 25], [-75, 30],
    [50, 90], [-55, 95], [15, -75], [-20, 88],
  ].forEach(([x, z]) => {
    if (Math.hypot(x - 95, z + 95) < 55) return; // clear airport
    if (Math.hypot(x - CRATER_CX, z - CRATER_CZ) < CRATER_R + 8) return;
    spawnCrystal(x, z);
  });

  // Purple gems near Michael only (not black junk on approach road)
  [
    [145, -100], [155, -90], [140, -85], [160, -95],
    [5, 55], [-15, -30], [60, 40], [20, 20],
  ].forEach(([x, z]) => spawnPurpleGem(x, z));

  state.raceCheckpoints = [];

  // ════════════════════════════════════════════════
  // CLEAN AIRPORT HUB — light concrete, NO black poles/pads
  // ════════════════════════════════════════════════
  const mtnX = 95;
  const mtnZ = -95;
  // Sit on real terrain (no floating black underside platforms)
  const mtnY = Math.max(1.2, groundY(mtnX, mtnZ));
  const matConcrete = new THREE.MeshStandardMaterial({
    color: 0x9aa3ad, roughness: 0.88, metalness: 0.08, flatShading: false, side: THREE.DoubleSide,
  });
  const matConcreteLt = new THREE.MeshStandardMaterial({
    color: 0xb8c0c8, roughness: 0.9, metalness: 0.05, flatShading: false, side: THREE.DoubleSide,
  });
  const matHangar = new THREE.MeshStandardMaterial({
    color: 0x8b95a1, roughness: 0.65, metalness: 0.25, flatShading: false, side: THREE.DoubleSide,
  });
  const matHangarRoof = new THREE.MeshStandardMaterial({
    color: 0x6b7580, roughness: 0.7, metalness: 0.2, flatShading: false, side: THREE.DoubleSide,
  });
  const matRunway = new THREE.MeshStandardMaterial({
    color: 0x4b5560, roughness: 0.9, metalness: 0.1, flatShading: false, side: THREE.DoubleSide,
  });
  const matAccent = new THREE.MeshStandardMaterial({
    color: 0xd1d5db, roughness: 0.75, metalness: 0.1, flatShading: false, side: THREE.DoubleSide,
  });

  // Thin apron following ground — not a huge floating black slab
  const padTop = mtnY + 0.12;
  addBox(mtnX, mtnY + 0.06, mtnZ, 48, 0.18, 24, matConcrete, { receive: true, collide: true });
  // Runway
  addBox(mtnX, mtnY + 0.08, mtnZ + 14, 44, 0.1, 7, matRunway, { receive: true });
  for (let i = -4; i <= 4; i++) {
    addBox(mtnX + i * 4.5, mtnY + 0.14, mtnZ + 14, 1.4, 0.03, 0.35, matAccent);
  }
  const airSign = makeNameLabel("✈ AIRPORT");
  airSign.position.set(mtnX, mtnY + 5.5, mtnZ + 18);
  airSign.scale.set(4.5, 0.8, 1);
  scene.add(airSign);

  // Open hangar — light metal, no dark roof ridge spikes
  const hx = mtnX;
  const hz = mtnZ - 3;
  const hW = 36;
  const hD = 16;
  const hH = 6.2;
  addBox(hx, mtnY + 0.08, hz, hW, 0.16, hD, matConcreteLt, { receive: true });
  addBox(hx, mtnY + hH / 2, hz - hD / 2 + 0.25, hW, hH, 0.4, matHangar, { receive: true, collide: true });
  addBox(hx - hW / 2 + 0.25, mtnY + hH / 2, hz, 0.4, hH, hD, matHangar, { receive: true, collide: true });
  addBox(hx + hW / 2 - 0.25, mtnY + hH / 2, hz, 0.4, hH, hD, matHangar, { receive: true, collide: true });
  addBox(hx, mtnY + hH + 0.15, hz, hW + 1.5, 0.35, hD + 1.5, matHangarRoof, { receive: true, collide: true });
  addCollider(hx, mtnY + 0.2, hz, hW, 0.3, hD);
  // Soft posts (light gray — not black sticks)
  for (const px of [-14, 0, 14]) {
    addBox(hx + px, mtnY + hH / 2, hz + hD / 2 - 0.35, 0.4, hH, 0.4, matConcreteLt, { receive: true, collide: true });
  }
  const hangLabel = makeNameLabel("HANGAR");
  hangLabel.position.set(hx, mtnY + hH + 1.0, hz + hD / 2 + 0.4);
  hangLabel.scale.set(3.5, 0.6, 1);
  scene.add(hangLabel);

  for (const px of [-12, 0, 12]) {
    addBox(hx + px, mtnY + 0.16, hz + 1.5, 0.12, 0.03, 8, matAccent);
  }

  state.hangarSlots = {
    rocket: { x: hx - 12, z: hz + 1, type: "rocket" },
    airplane: { x: hx, z: hz + 1, type: "airplane" },
    jet: { x: hx + 12, z: hz + 1, type: "jet" },
    ironman: { x: hx + 18, z: hz + 3, type: "ironman" },
  };
  const r0 = spawnRocket(hx - 12, padTop, hz + 1);
  if (r0) {
    r0.hangarKey = "rocket";
    r0.locked = false;
    r0.group.position.set(hx - 12, padTop + 1.55, hz + 1);
  }
  const a0 = spawnAirplane(hx, hz + 1);
  if (a0) {
    a0.hangarKey = "airplane";
    a0.locked = false;
    a0.group.position.set(hx, padTop + 1.35, hz + 1);
  }
  const jet = spawnJet(hx + 12, hz + 1);
  if (jet) {
    jet.locked = false;
    jet.price = 0;
    jet.hangarKey = "jet";
    if (jet.priceTag) jet.priceTag.visible = false;
    jet.group.position.set(hx + 12, padTop + 1.35, hz + 1);
  }
  // NO black runway light poles (those looked like black sticks pointing at the station)

  // ── Michael workshop — light yard, no black fence boxes ──
  const michX = mtnX + 48;
  const michZ = mtnZ;
  const mGy = Math.max(mtnY, groundY(michX, michZ));
  addBox((mtnX + michX) / 2, mGy + 0.05, mtnZ, 22, 0.14, 10, matConcrete, { receive: true, collide: true });
  addBox(michX, mGy + 0.06, michZ, 26, 0.14, 20, matConcreteLt, { receive: true, collide: true });
  // Soft wood posts (rounded cylinders — not black boxes)
  const postMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9, flatShading: false });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const fx = michX + Math.cos(a) * 13;
    const fz = michZ + Math.sin(a) * 10;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.1, 10), postMat);
    post.position.set(fx, mGy + 0.55, fz);
    scene.add(post);
    freezeMesh(post);
  }
  const michLabel = makeNameLabel("🔧 MICHAEL'S WORKSHOP");
  michLabel.position.set(michX, mGy + 5, michZ - 12);
  michLabel.scale.set(4.5, 0.75, 1);
  scene.add(michLabel);
  spawnMichaelGarage(michX, michZ, mGy);

  // Avengers stand — light plaza (was black 0x1e1b4b pad — user hated black things)
  const avX = hx + 20;
  const avZ = hz + 10;
  state.avengersHub = { x: avX, z: avZ, y: padTop };
  addBox(avX, padTop, avZ, 14, 0.14, 10, matConcreteLt, { receive: true, collide: true });
  const avLabel = makeNameLabel("🦸 AVENGERS · FIDGET BUNDLE");
  avLabel.position.set(avX, padTop + 5.5, avZ);
  avLabel.scale.set(4.5, 0.75, 1);
  scene.add(avLabel);
  spawnNiftyBundleStand(avX, avZ, padTop);

  // Beach / pirate clutter REMOVED from crater lake edge (was broken black junk)
  // Keep simple ocean life only if it won't spawn as black blobs at wrong places
  try { spawnOceanLife(); } catch (_) {}

  // Soft distant islands (smooth cylinders — not box cubes)
  for (const [ix, iz, r] of [
    [30, 235, 16],
    [-55, 255, 12],
  ]) {
    const gy = Math.max(0.5, groundY(ix, iz));
    const sand = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.15, r * 1.35, 1.4, 28),
      new THREE.MeshStandardMaterial({ color: 0xc9b98a, roughness: 0.95, flatShading: false })
    );
    sand.position.set(ix, gy * 0.25 + 0.3, iz);
    scene.add(sand);
    freezeMesh(sand);
    const green = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.75, r * 0.9, 0.45, 24),
      new THREE.MeshStandardMaterial({ color: 0x3f6e34, roughness: 0.92, flatShading: false })
    );
    green.position.set(ix, gy * 0.35 + 0.9, iz);
    scene.add(green);
    freezeMesh(green);
  }

  // ── Realistic fluffy clouds (soft white, slow drift) ──
  const cloudWhite = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    fog: false,
  });
  const cloudGrey = new THREE.MeshBasicMaterial({
    color: 0xc5ced9,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    fog: false,
  });
  const cloudSoft = new THREE.MeshBasicMaterial({
    color: 0xe8eef5,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    fog: false,
  });
  const cloudPink = new THREE.MeshBasicMaterial({
    color: 0xfff0e8,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    fog: false,
  });

  function addCloud(x, y, z, s = 1, stormy = false) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    const w = stormy ? cloudGrey : cloudWhite;
    const g2 = stormy ? cloudSoft : cloudGrey;
    // Few lobes only (performance)
    const parts = [
      [0, 0.2, 0, 5.0, w, 1.2, 0.65, 1.05],
      [3.8, 0.4, 0.5, 3.8, w, 1.1, 0.6, 1.0],
      [-3.6, 0.35, -0.4, 3.6, g2, 1.1, 0.55, 0.95],
      [1.2, 1.5, 0, 2.8, w, 1.0, 0.7, 0.95],
      [-1.5, 1.3, 0.4, 2.5, cloudSoft, 1.0, 0.55, 0.9],
    ];
    parts.forEach(([px, py, pz, r, mat, sx, sy, sz]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), mat);
      m.position.set(px, py, pz);
      m.scale.set(sx, sy, sz);
      g.add(m);
    });
    scene.add(g);
    driftingClouds.push({
      group: g,
      speed: 0.7 + Math.random() * 1.0,
      bob: 0.1,
      phase: Math.random() * 6,
      baseY: y,
    });
  }

  // Big sky of clouds for larger world
  addCloud(50, 60, -40, 2.2, false);
  addCloud(-55, 66, 25, 2.0, true);
  addCloud(40, 58, 65, 2.3, false);
  addCloud(-35, 70, -75, 2.1, true);
  addCloud(90, 64, 20, 1.9, false);
  addCloud(-80, 62, -20, 2.0, true);
  addCloud(10, 72, -90, 2.4, false);
  addCloud(140, 68, -50, 2.0, false);
  addCloud(-150, 70, 40, 2.1, true);
  addCloud(0, 78, -140, 2.5, false);
  addCloud(100, 62, 80, 1.8, true);
  addCloud(-100, 65, -100, 2.0, false);
  addCloud(180, 70, 10, 1.7, false);
  addCloud(-180, 68, -30, 1.8, true);
  addCloud(0, 68, 40, 1.85, false);
}

function buildDetailedClimbMountains() {
  state.mountainClimbs = state.mountainClimbs || [];
  const matRock = new THREE.MeshStandardMaterial({
    color: 0x6b7280, roughness: 0.92, metalness: 0.08, flatShading: false,
  });
  const matRockDark = new THREE.MeshStandardMaterial({
    color: 0x4b5563, roughness: 0.94, metalness: 0.06, flatShading: false,
  });
  const matRockHi = new THREE.MeshStandardMaterial({
    color: 0x8b919a, roughness: 0.88, metalness: 0.1, flatShading: false,
  });
  const matSnow = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9, roughness: 0.9, metalness: 0.0, flatShading: false,
  });
  const matIce = new THREE.MeshStandardMaterial({
    color: 0xbae6fd, roughness: 0.25, metalness: 0.35, transparent: true, opacity: 0.85, flatShading: false,
  });
  // Light metal ladders (not black sticks)
  const matRail = new THREE.MeshStandardMaterial({
    color: 0xb0b8c0, roughness: 0.55, metalness: 0.35, flatShading: false,
  });
  const matRung = new THREE.MeshStandardMaterial({
    color: 0xc8d0d8, roughness: 0.5, metalness: 0.3, flatShading: false,
  });

  // Use shared peak list — solid surface via peakSurfaceY + dense top colliders
  const peaks = MOUNTAIN_PEAKS;

  for (const pk of peaks) {
    // Skip peaks that touch the empty hole — no white ball clutter in/around the hole
    if (Math.hypot(pk.x - CRATER_CX, pk.z - CRATER_CZ) < CRATER_R + pk.r + 15) {
      continue;
    }
    // Skip peaks near airport — black ladders were pointing at the airplane station
    if (Math.hypot(pk.x - 95, pk.z + 95) < 70) {
      continue;
    }
    const baseY = Math.max(0.2, 8 + noise2(pk.x * 0.05, pk.z * 0.05) * 3);
    // Walk colliders only — NO white sphere blobs / snow balls / rock balls
    const radSteps = 12;
    for (let ri = 0; ri < radSteps; ri++) {
      const frac = (ri + 0.35) / radSteps;
      const rad = pk.r * frac * 1.0;
      const segs = Math.max(8, Math.floor(10 + frac * 14));
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2 + ri * 0.08;
        const cx = pk.x + Math.cos(a) * rad;
        const cz = pk.z + Math.sin(a) * rad;
        const sy = peakSurfaceY(cx, cz);
        if (sy == null) continue;
        addCollider(cx, sy - 0.08, cz, 2.6, 0.28, 2.6);
      }
    }
    {
      const sy = peakSurfaceY(pk.x, pk.z);
      if (sy != null) addCollider(pk.x, sy - 0.08, pk.z, 4.5, 0.3, 4.5);
    }
    // White snow-cap spheres REMOVED (user asked to remove those)
    // Dodecahedron rock blobs REMOVED
    // Climb ladder on south face (toward flat land)
    const ladderX = pk.x;
    const ladderZ = pk.z + pk.r * 0.85;
    const ladderBottom = Math.max(0.1, groundY(ladderX, ladderZ));
    const ladderTop = baseY + pk.h + 0.4;
    const ladderH = ladderTop - ladderBottom;
    const ladderG = new THREE.Group();
    ladderG.position.set(ladderX, ladderBottom, ladderZ);
    const railL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, ladderH, 14), matRail);
    railL.position.set(-0.35, ladderH / 2, 0);
    const railR = railL.clone();
    railR.position.x = 0.35;
    ladderG.add(railL, railR);
    const rungs = Math.floor(ladderH / 0.45);
    for (let i = 0; i < rungs; i++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 14), matRung);
      rung.position.set(0, 0.25 + i * 0.45, 0.05);
      ladderG.add(rung);
    }
    scene.add(ladderG);
    freezeMesh(ladderG);
    const lab = makeNameLabel(`⛰ ${pk.name} · WALK UP · K ladder`);
    lab.position.set(ladderX, ladderBottom + 2.2, ladderZ + 1.2);
    lab.scale.set(3.2, 0.45, 1);
    scene.add(lab);

    state.mountainClimbs.push({
      x: ladderX,
      z: ladderZ,
      bottomY: ladderBottom,
      topY: ladderTop,
      roofX: pk.x,
      roofZ: pk.z,
      roofY: baseY + pk.h + 0.55,
      grabRange: 3.2,
      name: pk.name,
      kind: "mountain",
    });
  }

  // Ocean peak climb REMOVED — hole stays empty (no props in the hole)
  if (false) {
    const lx = OCEAN_MTN_X;
    const lz = OCEAN_MTN_Z + OCEAN_MTN_R * 0.75;
    const bot = WATER_SURFACE + 0.15;
    const top = (oceanMountainY(OCEAN_MTN_X, OCEAN_MTN_Z) || 20) + 0.3;
    const h = top - bot;
    const g = new THREE.Group();
    g.position.set(lx, bot, lz);
    const rl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, h, 14), matRail);
    rl.position.set(-0.35, h / 2, 0);
    const rr = rl.clone();
    rr.position.x = 0.35;
    g.add(rl, rr);
    for (let i = 0; i < Math.floor(h / 0.45); i++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 14), matRung);
      rung.position.set(0, 0.25 + i * 0.45, 0.05);
      g.add(rung);
    }
    scene.add(g);
    freezeMesh(g);
    const lab = makeNameLabel("⛰ OCEAN PEAK · K CLIMB");
    lab.position.set(lx, bot + 2, lz + 1.5);
    lab.scale.set(3, 0.45, 1);
    scene.add(lab);
    state.mountainClimbs.push({
      x: lx,
      z: lz,
      bottomY: bot,
      topY: top,
      roofX: OCEAN_MTN_X,
      roofZ: OCEAN_MTN_Z,
      roofY: top + 0.3,
      grabRange: 3.5,
      name: "OCEAN PEAK",
      kind: "mountain",
    });
  }
}

function nearestMountainClimb(maxDist = 3.5) {
  const list = state.mountainClimbs || [];
  let best = null;
  let bestD = maxDist;
  for (const m of list) {
    const d = Math.hypot(player.pos.x - m.x, player.pos.z - m.z);
    const nearY = player.pos.y > m.bottomY - 1.5 && player.pos.y < m.topY + 1.5;
    if (d < bestD && nearY) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

function spawnCrystal(x, z) {
  const y = groundY(x, z) + 1.2;
  const mesh = new THREE.Mesh(GEO.crystal, blockMats.crystal);
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  scene.add(mesh);
  collectibles.push({ mesh, light: null, type: "gem", value: 1, bob: Math.random() * Math.PI * 2, baseY: y });
}

/** Unique purple gems — rare diamonds used to buy Iron Man costumes at Michael's */
function spawnPurpleGem(x, z) {
  const y = groundY(x, z) + 1.35;
  const g = new THREE.Group();
  const matPurple = new THREE.MeshStandardMaterial({
    color: 0xa855f7,
    emissive: 0x7c3aed,
    emissiveIntensity: 0.65,
    roughness: 0.2,
    metalness: 0.45,
  });
  const matCore = new THREE.MeshStandardMaterial({
    color: 0xe9d5ff,
    emissive: 0xc084fc,
    emissiveIntensity: 0.85,
    roughness: 0.15,
    metalness: 0.5,
  });
  const matDark = new THREE.MeshStandardMaterial({
    color: 0x5b21b6,
    emissive: 0x4c1d95,
    emissiveIntensity: 0.4,
    roughness: 0.3,
    metalness: 0.35,
  });
  // Faceted diamond look (stacked rotated boxes)
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), matCore);
  core.rotation.y = Math.PI / 4;
  const mid = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), matPurple);
  mid.rotation.set(0.3, 0.5, 0.1);
  const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), matDark);
  tip.position.y = 0.35;
  // Glow ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.04, 6, 16),
    new THREE.MeshBasicMaterial({ color: 0xd8b4fe, transparent: true, opacity: 0.7 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.05;
  // Sparkle points
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xfaf5ff })
    );
    const a = (i / 4) * Math.PI * 2;
    sp.position.set(Math.cos(a) * 0.45, 0.1 + (i % 2) * 0.15, Math.sin(a) * 0.45);
    g.add(sp);
  }
  g.add(core, mid, tip, ring);
  g.position.set(x, y, z);
  scene.add(g);
  collectibles.push({
    mesh: g,
    light: null,
    type: "purpleGem",
    value: 1,
    bob: Math.random() * Math.PI * 2,
    baseY: y,
    spin: 1.8 + Math.random() * 0.6,
  });
  return g;
}

const wheelGeoShared = new THREE.BoxGeometry(0.35, 0.7, 0.7);
const wheelMatShared = new THREE.MeshLambertMaterial({ color: 0x111111 });

function spawnVehicle(x, y, z, color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.7, 4.2),
    new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.15 })
  );
  body.position.y = 0.55;
  body.castShadow = false;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, 2),
    new THREE.MeshLambertMaterial({ color: 0x111827 })
  );
  cabin.position.set(0, 1.15, -0.2);
  const wheels = [];
  [[-1, 1.2], [1, 1.2], [-1, -1.2], [1, -1.2]].forEach(([wx, wz]) => {
    const w = new THREE.Mesh(wheelGeoShared, wheelMatShared);
    w.position.set(wx * 1.05, 0.4, wz);
    group.add(w);
    wheels.push(w);
  });
  // Headlight glow as mesh only (no PointLight)
  const hl = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.15, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffffaa })
  );
  hl.position.set(0, 0.7, 2.15);
  group.add(body, cabin, hl);
  group.position.set(x, y, z);
  scene.add(group);

  const v = {
    group,
    wheels,
    color,
    speed: 0,
    yaw: 0,
    maxSpeed: 38,
    accel: 28,
    brake: 40,
    turn: 2.2,
    occupied: false,
  };
  vehicles.push(v);
  return v;
}

/**
 * Long white / blue / yellow rocket SHIP (flies nose-forward).
 * Local axes: +Z = nose/forward, Y = up.
 */
function spawnRocket(x, y, z) {
  const group = new THREE.Group();
  const matWhite = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
  const matBlue = new THREE.MeshLambertMaterial({ color: 0x2563eb });
  const matBlueDark = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });
  const matYellow = new THREE.MeshLambertMaterial({
    color: 0xfacc15,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.3,
  });
  const matGlass = new THREE.MeshLambertMaterial({
    color: 0x7dd3fc,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const matGlassRim = new THREE.MeshLambertMaterial({ color: 0x1e40af });
  const matMetal = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 });

  // LONG fuselage along Z
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 4.8, 14), matWhite);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.15;
  // Extra mid tube for length
  const body2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 1.4, 12), matWhite);
  body2.rotation.x = Math.PI / 2;
  body2.position.z = -2.2;
  // Blue bands
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.48, 0.45, 14), matBlue);
  stripe.rotation.x = Math.PI / 2;
  stripe.position.z = 0.6;
  const stripe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.46, 0.35, 12), matBlue);
  stripe2.rotation.x = Math.PI / 2;
  stripe2.position.z = -1.1;
  // Yellow rings
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.16, 14), matYellow);
  ring.rotation.x = Math.PI / 2;
  ring.position.z = -0.4;
  const ring2 = ring.clone();
  ring2.position.z = -2.6;
  // Long nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.4, 14), matWhite);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = 3.0;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 10), matBlue);
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = 3.75;
  // Cockpit canopy UNDER the rocket ship (not on top)
  const cockpitFrame = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.045, 6, 18), matGlassRim);
  cockpitFrame.rotation.x = Math.PI / 2;
  cockpitFrame.position.set(0, -0.48, 0.9);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 12), matGlass);
  canopy.position.set(0, -0.55, 0.9);
  canopy.scale.set(1.05, 0.85, 1.25);
  // Side windows (mid body, not on top)
  for (const wz of [0.1, -0.6, -1.4]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.28), matGlass);
    win.position.set(0.42, -0.05, wz);
    group.add(win);
    const winL = win.clone();
    winL.position.x = -0.42;
    group.add(winL);
  }

  // All fins UNDER / beside-under the rocket — nothing on top of the ship
  function makeFin(xSign) {
    const f = new THREE.Group();
    // Side fins hang below the body (not sticking up)
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.9), matBlueDark);
    base.position.set(xSign * 0.48, -0.45, -2.9);
    const tipFin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.35), matYellow);
    tipFin.position.set(xSign * 0.55, -0.85, -3.15);
    f.add(base, tipFin);
    return f;
  }
  const finL = makeFin(-1);
  const finR = makeFin(1);
  // Center fins under the belly
  const finBot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.85), matBlueDark);
  finBot.position.set(0, -0.7, -2.85);
  const finBotY = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.32), matYellow);
  finBotY.position.set(0, -1.05, -3.1);
  const finUnder = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.9), matBlue);
  finUnder.position.set(0, -0.78, -2.4);
  const finUnderTip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.28), matYellow);
  finUnderTip.position.set(0, -1.08, -2.7);

  // Engine nozzle (far rear of long ship)
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.38, 0.55, 14), matBlueDark);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = -3.15;
  // Multi-layer REAL FIRE plume — under/behind nozzle (not on top of ship)
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 2.0, 10),
    new THREE.MeshBasicMaterial({ color: 0xff6a00, transparent: true, opacity: 0.9 })
  );
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, -0.05, -4.2);
  flame.visible = false;
  const flameMid = new THREE.Mesh(
    new THREE.ConeGeometry(0.36, 1.5, 8),
    new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.95 })
  );
  flameMid.rotation.x = -Math.PI / 2;
  flameMid.position.set(0, -0.05, -3.95);
  flameMid.visible = false;
  const flameInner = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 1.1, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
  );
  flameInner.rotation.x = -Math.PI / 2;
  flameInner.position.set(0, -0.05, -3.7);
  flameInner.visible = false;
  const flameGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.45, depthWrite: false })
  );
  flameGlow.position.set(0, -0.08, -3.4);
  flameGlow.visible = false;

  // Landing gear UNDER the rocket ship (supports sitting on the pad)
  const skidL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 14), matYellow);
  skidL.rotation.x = Math.PI / 2;
  skidL.position.set(-0.52, -0.95, 0.15);
  const skidR = skidL.clone();
  skidR.position.x = 0.52;
  const skidMid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 14), matMetal);
  skidMid.rotation.x = Math.PI / 2;
  skidMid.position.set(0, -0.98, -1.2);
  const gearStrutL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), matMetal);
  gearStrutL.position.set(-0.45, -0.65, 0.5);
  const gearStrutR = gearStrutL.clone();
  gearStrutR.position.x = 0.45;
  const gearStrutBackL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.5, 0.09), matMetal);
  gearStrutBackL.position.set(-0.4, -0.62, -1.4);
  const gearStrutBackR = gearStrutBackL.clone();
  gearStrutBackR.position.x = 0.4;
  // Foot pads under struts (on the ground)
  const footPad = (sx, sz) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.35), matYellow);
    p.position.set(sx, -1.12, sz);
    return p;
  };
  // Panel rings along long body
  const panel1 = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.025, 6, 18), matMetal);
  panel1.rotation.y = Math.PI / 2;
  panel1.position.z = 1.4;
  const panel2 = panel1.clone();
  panel2.position.z = -0.2;
  const panel3 = panel1.clone();
  panel3.position.z = -1.8;
  const nozzleRim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 16), matMetal);
  nozzleRim.position.z = -3.4;

  // Pilot in underside cockpit
  const pilot = new THREE.Group();
  pilot.position.set(0, -0.35, 0.85);
  pilot.scale.setScalar(0.4);
  const pLegL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.35), matPants);
  pLegL.position.set(-0.22, 0.25, 0.15);
  pLegL.rotation.x = Math.PI / 2.2;
  const pLegR = pLegL.clone();
  pLegR.position.x = 0.22;
  const pTorso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, 0.45), matShirt);
  pTorso.position.set(0, 0.85, 0);
  const pHead = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.4), matSkin);
  pHead.position.set(0, 1.45, 0.02);
  const pEyeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.05), matEyeWhite);
  pEyeL.position.set(-0.09, 1.48, 0.22);
  const pEyeR = pEyeL.clone();
  pEyeR.position.x = 0.09;
  const pPupL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.04), matEyePupil);
  pPupL.position.set(-0.09, 1.48, 0.25);
  const pPupR = pPupL.clone();
  pPupR.position.x = 0.09;
  const pHair = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.42), matHair);
  pHair.position.set(0, 1.75, 0);
  const pArmL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, 0.22), matSkin);
  pArmL.position.set(-0.55, 0.75, 0.1);
  pArmL.rotation.z = 0.4;
  const pArmR = pArmL.clone();
  pArmR.position.x = 0.55;
  pArmR.rotation.z = -0.4;
  pilot.add(pLegL, pLegR, pTorso, pHead, pEyeL, pEyeR, pPupL, pPupR, pHair, pArmL, pArmR);
  pilot.visible = false;

  group.add(
    body,
    body2,
    stripe,
    stripe2,
    ring,
    ring2,
    nose,
    tip,
    panel1,
    panel2,
    panel3,
    canopy,
    cockpitFrame,
    finL,
    finR,
    finBot,
    finBotY,
    finUnder,
    finUnderTip,
    nozzle,
    nozzleRim,
    flame,
    flameMid,
    flameInner,
    flameGlow,
    skidL,
    skidR,
    skidMid,
    gearStrutL,
    gearStrutR,
    gearStrutBackL,
    gearStrutBackR,
    footPad(-0.45, 0.5),
    footPad(0.45, 0.5),
    footPad(-0.4, -1.4),
    footPad(0.4, -1.4),
    pilot
  );

  // Long + large rocket ship
  group.scale.setScalar(1.75);

  const gy = groundY(x, z);
  // Sit on landing gear (gear hangs under body)
  group.position.set(x, gy + 1.55, z);
  group.rotation.order = "YXZ";
  group.rotation.x = -0.04;
  scene.add(group);

  const rocket = {
    group,
    wheels: [],
    color: 0x2563eb,
    type: "rocket",
    speed: 0,
    yaw: 0,
    pitch: 0.12,
    maxSpeed: 52,
    accel: 28,
    turn: 2.0,
    pitchRate: 1.35,
    occupied: false,
    flame,
    flameMid,
    flameInner,
    flameGlow,
    pilot,
    vel: new THREE.Vector3(),
  };
  vehicles.push(rocket);
  return rocket;
}

/** Powerful red/gold Iron Man rocket — ultra detailed */
function spawnIronManRocket(x, z) {
  const group = new THREE.Group();
  const matRed = new THREE.MeshLambertMaterial({ color: 0xb91c1c, flatShading: false });
  const matRedDark = new THREE.MeshLambertMaterial({ color: 0x7f1d1d, flatShading: false });
  const matRedHi = new THREE.MeshLambertMaterial({ color: 0xef4444, flatShading: false });
  const matGold = new THREE.MeshLambertMaterial({
    color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.4, flatShading: false,
  });
  const matGoldHi = new THREE.MeshLambertMaterial({ color: 0xfde68a, flatShading: false });
  const matGoldDark = new THREE.MeshLambertMaterial({ color: 0x92400e, flatShading: false });
  const matBlack = new THREE.MeshLambertMaterial({ color: 0x0f172a, flatShading: false });
  const matSteel = new THREE.MeshLambertMaterial({ color: 0x94a3b8, flatShading: false });
  const matChrome = new THREE.MeshLambertMaterial({ color: 0xe2e8f0, flatShading: false });
  const matGlass = new THREE.MeshLambertMaterial({
    color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.4,
    transparent: true, opacity: 0.55, flatShading: false,
  });
  const matArc = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
  const matArcCore = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const matRivet = new THREE.MeshLambertMaterial({ color: 0xcbd5e1, flatShading: false });

  // Main fuselage segments (panelized)
  for (let i = 0; i < 11; i++) {
    const t = i / 7;
    const r = 0.42 + Math.sin(t * Math.PI) * 0.12;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.95, r, 0.72, 16),
      i % 2 ? matRed : matRedDark
    );
    seg.rotation.x = Math.PI / 2;
    seg.position.z = 2.2 - i * 0.7;
    group.add(seg);
    // Gold ring every other
    if (i % 2 === 0) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.035, 6, 20), matGold);
      ring.position.z = 2.2 - i * 0.7;
      group.add(ring);
    }
  }
  // Armor plating grid
  for (let i = 0; i < 12; i++) {
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.08, 0.45),
      i % 3 === 0 ? matGold : matRedHi
    );
    const a = (i / 12) * Math.PI * 2;
    plate.position.set(Math.cos(a) * 0.48, Math.sin(a) * 0.48, 0.8 - (i % 4) * 0.9);
    plate.lookAt(0, 0, plate.position.z);
    group.add(plate);
  }
  // Side vents
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.28), matBlack);
      vent.position.set(sx * 0.55, 0.1, 1.5 - i * 0.55);
      group.add(vent);
      const ventGold = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.24), matGold);
      ventGold.position.set(sx * 0.58, 0.1, 1.5 - i * 0.55);
      group.add(ventGold);
    }
  }
  // Arc reactor array
  const reactor = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16), matArc);
  reactor.rotation.x = Math.PI / 2;
  reactor.position.set(0, 0.52, 0.5);
  const reactorCore = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 12), matArcCore);
  reactorCore.rotation.x = Math.PI / 2;
  reactorCore.position.set(0, 0.54, 0.5);
  const reactorRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 18), matGold);
  reactorRing.position.set(0, 0.52, 0.5);
  group.add(reactor, reactorCore, reactorRing);
  // Nose cone multi-layer
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 16), matGold);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = 3.2;
  const noseMid = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 12), matGoldHi);
  noseMid.rotation.x = -Math.PI / 2;
  noseMid.position.z = 3.85;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 10), matChrome);
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = 4.25;
  // Pitot tubes
  for (const sx of [-0.15, 0.15]) {
    const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), matSteel);
    pitot.rotation.x = Math.PI / 2;
    pitot.position.set(sx, 0.15, 3.6);
    group.add(pitot);
  }
  group.add(nose, noseMid, tip);
  // Cockpit bubble + frame
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 12), matGlass);
  canopy.position.set(0, -0.38, 1.1);
  canopy.scale.set(1.15, 0.7, 1.4);
  const canopyFrame = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.03, 6, 16), matGold);
  canopyFrame.rotation.x = Math.PI / 2;
  canopyFrame.position.set(0, -0.35, 1.1);
  group.add(canopy, canopyFrame);
  // HUD bars on canopy
  for (let i = 0; i < 3; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.02), matGoldHi);
    bar.position.set(0, -0.25 - i * 0.08, 0.75);
    group.add(bar);
  }
  // Wings / stabilizers under with gold leading edges
  for (const sx of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.75, 1.15), matGold);
    fin.position.set(sx * 0.58, -0.5, -2.5);
    group.add(fin);
    const lead = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.08), matGoldHi);
    lead.position.set(sx * 0.62, -0.5, -1.95);
    group.add(lead);
    // Control surface
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.35), matRedDark);
    flap.position.set(sx * 0.58, -0.65, -2.95);
    group.add(flap);
  }
  const finBot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 1.0), matRedDark);
  finBot.position.set(0, -0.72, -2.6);
  group.add(finBot);
  // Dual thrusters with inner rings
  for (const sx of [-0.3, 0.3]) {
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.55, 12), matBlack);
    noz.rotation.x = Math.PI / 2;
    noz.position.set(sx, 0, -3.15);
    group.add(noz);
    const nozRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 6, 14), matGold);
    nozRing.position.set(sx, 0, -3.4);
    group.add(nozRing);
    const nozIn = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.2, 10), matSteel);
    nozIn.rotation.x = Math.PI / 2;
    nozIn.position.set(sx, 0, -3.0);
    group.add(nozIn);
  }
  const fireL = makeHotFire(1.15);
  fireL.group.position.set(-0.3, 0, -3.85);
  fireL.group.visible = false;
  const fireR = makeHotFire(1.15);
  fireR.group.position.set(0.3, 0, -3.85);
  fireR.group.visible = false;
  group.add(fireL.group, fireR.group);
  // Rivets along body
  for (let i = 0; i < 24; i++) {
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), matRivet);
    const a = (i / 12) * Math.PI * 2;
    const z = 1.8 - (i % 8) * 0.45;
    rivet.position.set(Math.cos(a) * 0.52, Math.sin(a) * 0.52, z);
    group.add(rivet);
  }
  // Name plate IRON MAN
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 0.08), matGold);
  plate.position.set(0, 0.2, -0.3);
  const plateIn = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.18, 0.04), matBlack);
  plateIn.position.set(0, 0.2, -0.35);
  group.add(plate, plateIn);
  // Landing gear detailed
  for (const [sx, sz] of [[-0.4, 0.9], [0.4, 0.9], [-0.35, -1.6], [0.35, -1.6]]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), matSteel);
    strut.position.set(sx, -0.65, sz);
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), matGold);
    joint.position.set(sx, -0.4, sz);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.32), matGoldDark);
    pad.position.set(sx, -0.92, sz);
    group.add(strut, joint, pad);
  }
  // Antenna / sensors
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 5), matSteel);
  ant.position.set(0.2, 0.7, -1.5);
  const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), matArc);
  antTip.position.set(0.2, 1.0, -1.5);
  group.add(ant, antTip);

  group.scale.setScalar(1.15);
  const gy = groundY(x, z);
  group.position.set(x, gy + 0.85, z);
  group.rotation.order = "YXZ";
  group.rotation.x = 0.05;
  group.rotation.z = 1.35;
  group.rotation.y = 0.2;
  scene.add(group);

  const rocket = {
    group, wheels: [], color: 0xb91c1c, type: "rocket", subtype: "ironman",
    name: "Iron Man Rocket", speed: 0, yaw: 0.4, pitch: 0.1,
    maxSpeed: 95, accel: 48, turn: 2.4, pitchRate: 1.7,
    occupied: false, locked: true, price: 8000,
    flame: fireL.outer, flameMid: fireL.mid, flameInner: fireL.white, flameGlow: fireL.glow,
    fires: [fireL, fireR], pilot: null, vel: new THREE.Vector3(), hangarKey: "ironman",
  };
  vehicles.push(rocket);
  state.ironManRocket = rocket;
  return rocket;
}

const michaelBuilders = [];
const MICHAEL_JELLO_PRICE = 80;
const MICHAEL_SPAGHETTI_PRICE = 25; // bowl of spaghetti & meatballs
const MICHAEL_ROCKET_PRICE = 8000;
const MICHAEL_MASK_PRICE = 15; // regular crystals (gems)
// Unique purple gems buy Iron Man costumes
const MICHAEL_SUIT_MARK3_PRICE = 12;
const MICHAEL_SUIT_GOLD_PRICE = 18;
const MICHAEL_SUIT_WAR_PRICE = 15;
const MICHAEL_SUIT_DINO_PRICE = 55; // expensive green dinosaur costume
const MICHAEL_JOYRIDE_SECONDS = 102;
const TREASURE_PURPLE_GEMS = 10; // free gems from beach chest

// ── Fidget Power shop (AVENGERS SERVER hangar · ends November) ──
// TRY free 30s · BUY with green coins (not free, not crazy expensive yet)
// Inventory only gets what you BUY — never free extras.
const NIFTY_BUNDLE_END_MONTH = 11; // shop open through November
const FIDGET_TRIAL_SECONDS = 30;
const NIFTY_SWORDS = {
  nifty: {
    key: "nifty",
    name: "Nifty Fidget Power",
    emoji: "🌪️",
    price: 250, // green coins to buy (try free 30s)
    desc: "Tornado in hand · shoot · power ball · Hat Power · TRY 30s free",
    includes: ["hatPower"],
  },
  venom: {
    key: "venom",
    name: "Venom",
    emoji: "🐍",
    price: 300,
    desc: "Toxic venom fidget · spit shots · TRY 30s free",
    includes: [],
  },
  waterdino: {
    key: "waterdino",
    name: "Water Dino",
    emoji: "🦕",
    price: 400,
    desc: "Water dino + ocean dinosaur · 2 powers · TRY 30s free",
    includes: ["waterDinosaur"],
    powers: 2,
  },
};
// Legacy alias for any old prompts
const NIFTY_BUNDLE_PRICE = NIFTY_SWORDS.nifty.price;

/** Shop still open? (game calendar July–November) */
function isNiftyBundleOnSale() {
  return gameDate.month >= 7 && gameDate.month <= NIFTY_BUNDLE_END_MONTH;
}

function anyFidgetOwned() {
  return hasInvItem("nifty") || hasInvItem("venom") || hasInvItem("waterdino");
}

function checkNiftyBundleExpiry() {
  if (!state.niftyStand) return;
  const onSale = isNiftyBundleOnSale();
  if (state.niftyStand.forSaleLabel) {
    state.niftyStand.forSaleLabel.visible = onSale;
  }
  if (state.niftyStand.soldOutLabel) {
    state.niftyStand.soldOutLabel.visible = !onSale;
  }
  if (state.niftyStand.ownedLabel) {
    state.niftyStand.ownedLabel.visible = anyFidgetOwned();
  }
}

/** Red / white / blue materials shared by power gear */
function niftyMats() {
  return {
    red: new THREE.MeshStandardMaterial({
      color: 0xdc2626, emissive: 0x991b1b, emissiveIntensity: 0.55, metalness: 0.35, roughness: 0.4, flatShading: false,
    }),
    white: new THREE.MeshStandardMaterial({
      color: 0xf8fafc, emissive: 0xcbd5e1, emissiveIntensity: 0.25, metalness: 0.2, roughness: 0.45, flatShading: false,
    }),
    blue: new THREE.MeshStandardMaterial({
      color: 0x2563eb, emissive: 0x1d4ed8, emissiveIntensity: 0.55, metalness: 0.35, roughness: 0.4, flatShading: false,
    }),
    gold: new THREE.MeshStandardMaterial({
      color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.45, metalness: 0.55, roughness: 0.35, flatShading: false,
    }),
    dark: new THREE.MeshStandardMaterial({
      color: 0x1e293b, metalness: 0.5, roughness: 0.45, flatShading: false,
    }),
  };
}

/**
 * Baby tiny tornado for the palm — detailed red/white/blue spinning power.
 * Spins like a fidget tornado inside your hand.
 */
function buildBabyTornado(scale = 1) {
  const root = new THREE.Group();
  root.name = "babyTornado";
  const m = niftyMats();
  const layers = [
    { y: 0.02, r: 0.16, h: 0.06, mat: m.blue, spin: 1 },
    { y: 0.09, r: 0.13, h: 0.07, mat: m.white, spin: -1.2 },
    { y: 0.17, r: 0.10, h: 0.07, mat: m.red, spin: 1.4 },
    { y: 0.24, r: 0.07, h: 0.06, mat: m.white, spin: -1.6 },
    { y: 0.30, r: 0.045, h: 0.05, mat: m.blue, spin: 1.8 },
    { y: 0.35, r: 0.028, h: 0.04, mat: m.red, spin: -2 },
  ];
  const rings = [];
  for (const L of layers) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(L.r * 0.55, L.r, L.h, 10, 1, true),
      L.mat
    );
    ring.position.y = L.y;
    root.add(ring);
    rings.push({ mesh: ring, spin: L.spin });
    // Detail fins / spark bits on each band
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, L.h * 0.7, 0.018),
        i % 2 === 0 ? m.gold : m.white
      );
      fin.position.set(Math.cos(a) * L.r * 0.85, L.y, Math.sin(a) * L.r * 0.85);
      fin.rotation.y = a;
      root.add(fin);
      rings.push({ mesh: fin, spin: L.spin * 0.9 });
    }
  }
  // Core glow pillar
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.03, 0.36, 14),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
  );
  core.position.y = 0.18;
  root.add(core);
  // Tiny star sparkles orbiting
  const sparks = [];
  for (let i = 0; i < 11; i++) {
    const c = [0xef4444, 0xffffff, 0x3b82f6][i % 3];
    const sp = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.018, 0),
      new THREE.MeshBasicMaterial({ color: c })
    );
    root.add(sp);
    sparks.push({ mesh: sp, a: (i / 8) * Math.PI * 2, r: 0.12 + (i % 3) * 0.03, y: 0.08 + (i % 4) * 0.07 });
  }
  root.scale.setScalar(scale);
  root.userData.rings = rings;
  root.userData.sparks = sparks;
  root.userData.core = core;
  return root;
}

function animateBabyTornado(tornado, dt, t) {
  if (!tornado || !tornado.userData) return;
  const rings = tornado.userData.rings || [];
  for (const r of rings) {
    if (r.mesh) r.mesh.rotation.y += dt * 9 * (r.spin || 1);
  }
  const sparks = tornado.userData.sparks || [];
  for (const s of sparks) {
    s.a += dt * 7;
    s.mesh.position.set(Math.cos(s.a) * s.r, s.y + Math.sin(t * 8 + s.a) * 0.02, Math.sin(s.a) * s.r);
    s.mesh.rotation.x += dt * 6;
    s.mesh.rotation.y += dt * 8;
  }
  if (tornado.userData.core) {
    const pulse = 1 + Math.sin(t * 14) * 0.12;
    tornado.userData.core.scale.set(pulse, 1, pulse);
  }
  tornado.rotation.y += dt * 4.5;
}

/** Super-detailed fidget power (all three are fancy) */
function buildNiftySword(kind = "nifty") {
  const root = new THREE.Group();
  root.name = `sword_${kind}`;
  const m = niftyMats();

  // Shared detailed grip + guard base
  function addFancyGrip(wrapMats) {
    const gripCore = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 0.32, 10), m.dark);
    gripCore.position.y = 0.15;
    root.add(gripCore);
    for (let i = 0; i < 7; i++) {
      const wrap = new THREE.Mesh(
        new THREE.TorusGeometry(0.048, 0.012, 6, 14),
        wrapMats[i % wrapMats.length]
      );
      wrap.rotation.x = Math.PI / 2;
      wrap.position.y = 0.04 + i * 0.04;
      root.add(wrap);
    }
    // Finger ridges
    for (let i = 0; i < 4; i++) {
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.03), m.dark);
      ridge.position.set(0.02, 0.08 + i * 0.05, 0.03);
      root.add(ridge);
    }
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), m.gold);
    pommel.position.y = -0.02;
    root.add(pommel);
    const pommelGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), wrapMats[0]);
    pommelGem.position.y = -0.02;
    pommelGem.position.z = 0.04;
    root.add(pommelGem);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.1), m.gold);
    guard.position.y = 0.32;
    root.add(guard);
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.06), wrapMats[1] || m.white);
      wing.position.set(sx * 0.2, 0.32, 0);
      wing.rotation.z = sx * 0.35;
      root.add(wing);
    }
  }

  if (kind === "nifty") {
    addFancyGrip([m.red, m.white, m.blue]);
    const bladeH = 0.78;
    const stripeH = bladeH / 8;
    const colors = [m.red, m.white, m.blue, m.red, m.white, m.blue, m.red, m.white];
    for (let i = 0; i < 11; i++) {
      const w = 0.085 - i * 0.005;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(w, stripeH * 0.96, 0.03), colors[i]);
      seg.position.y = 0.36 + stripeH * 0.5 + i * stripeH;
      root.add(seg);
      // Side bevels
      const bev = new THREE.Mesh(new THREE.BoxGeometry(0.012, stripeH * 0.9, 0.04), m.gold);
      bev.position.set(w * 0.55, seg.position.y, 0);
      root.add(bev);
    }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 7), m.white);
    tip.position.y = 0.36 + bladeH + 0.05;
    root.add(tip);
    // Power runes along blade
    for (let i = 0; i < 5; i++) {
      const rune = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.02, 0),
        new THREE.MeshBasicMaterial({ color: [0xef4444, 0xffffff, 0x3b82f6][i % 3] })
      );
      rune.position.set(-0.02, 0.42 + i * 0.12, 0.02);
      root.add(rune);
    }
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, bladeH * 0.92, 0.042),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 })
    );
    edge.position.y = 0.36 + bladeH * 0.5;
    root.add(edge);
    // Baby tornado — detailed, spins in hand / on guard
    const tornado = buildBabyTornado(1.15);
    tornado.position.set(0.14, 0.2, 0.04);
    root.add(tornado);
    root.userData.tornado = tornado;
    // Second mini swirl in palm
    const tornado2 = buildBabyTornado(0.55);
    tornado2.position.set(-0.1, 0.18, 0.02);
    root.add(tornado2);
    root.userData.tornado2 = tornado2;
  } else if (kind === "venom") {
    const matBlack = new THREE.MeshStandardMaterial({
      color: 0x050505, metalness: 0.6, roughness: 0.3, flatShading: false,
    });
    const matPurple = new THREE.MeshStandardMaterial({
      color: 0x7c3aed, emissive: 0x5b21b6, emissiveIntensity: 0.65, metalness: 0.4, roughness: 0.35, flatShading: false,
    });
    const matToxic = new THREE.MeshStandardMaterial({
      color: 0xa3e635, emissive: 0x4d7c0f, emissiveIntensity: 0.8, metalness: 0.25, roughness: 0.4, flatShading: false,
    });
    const matVein = new THREE.MeshStandardMaterial({
      color: 0x4c1d95, emissive: 0x2e1065, emissiveIntensity: 0.5, metalness: 0.35, roughness: 0.4, flatShading: false,
    });
    addFancyGrip([matToxic, matPurple, matBlack]);
    const bladeH = 0.76;
    const stripeH = bladeH / 8;
    for (let i = 0; i < 11; i++) {
      const mat = i % 3 === 0 ? matBlack : i % 3 === 1 ? matPurple : matToxic;
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(0.09 - i * 0.006, stripeH * 0.96, 0.034),
        mat
      );
      seg.position.y = 0.36 + stripeH * 0.5 + i * stripeH;
      root.add(seg);
    }
    // Jagged teeth edges
    for (let i = 0; i < 11; i++) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 4), matToxic);
      fang.position.set(0.055, 0.4 + i * 0.08, 0.01);
      fang.rotation.z = -0.9;
      root.add(fang);
      const fangL = fang.clone();
      fangL.position.x = -0.055;
      fangL.rotation.z = 0.9;
      root.add(fangL);
    }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 5), matToxic);
    tip.position.y = 0.36 + bladeH + 0.06;
    root.add(tip);
    // Symbiote veins
    for (let i = 0; i < 4; i++) {
      const vein = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.015), matVein);
      vein.position.set((i % 2 === 0 ? 0.03 : -0.03), 0.5 + i * 0.1, 0.02);
      vein.rotation.z = (i % 2 === 0 ? 0.2 : -0.2);
      root.add(vein);
    }
    // Big venom eye on guard
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), matToxic);
    eyeWhite.position.set(0, 0.32, 0.08);
    root.add(eyeWhite);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), matBlack);
    pupil.position.set(0, 0.32, 0.12);
    root.add(pupil);
    // Dripping goo droplets
    for (let i = 0; i < 3; i++) {
      const drip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), matToxic);
      drip.position.set(0.04 - i * 0.03, 0.28 - i * 0.04, 0.06);
      root.add(drip);
    }
    root.userData.venomPulse = [eyeWhite, tip];
  } else if (kind === "waterdino") {
    const matOcean = new THREE.MeshStandardMaterial({
      color: 0x0284c7, emissive: 0x0369a1, emissiveIntensity: 0.55, metalness: 0.4, roughness: 0.35, flatShading: false,
    });
    const matTeal = new THREE.MeshStandardMaterial({
      color: 0x14b8a6, emissive: 0x0f766e, emissiveIntensity: 0.5, metalness: 0.35, roughness: 0.4, flatShading: false,
    });
    const matDeep = new THREE.MeshStandardMaterial({
      color: 0x164e63, metalness: 0.5, roughness: 0.35, flatShading: false,
    });
    const matFoam = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe, emissive: 0x7dd3fc, emissiveIntensity: 0.35, metalness: 0.2, roughness: 0.45, flatShading: false,
    });
    const matScale = new THREE.MeshStandardMaterial({
      color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.45, metalness: 0.4, roughness: 0.35, flatShading: false,
    });
    const matBelly = new THREE.MeshStandardMaterial({
      color: 0xa5f3fc, metalness: 0.2, roughness: 0.55, flatShading: false,
    });
    addFancyGrip([matOcean, matTeal, matFoam]);
    const bladeH = 0.8;
    const stripeH = bladeH / 8;
    for (let i = 0; i < 11; i++) {
      const mat = i % 3 === 0 ? matOcean : i % 3 === 1 ? matTeal : matScale;
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(0.1 - i * 0.006, stripeH * 0.96, 0.036),
        mat
      );
      seg.position.y = 0.36 + stripeH * 0.5 + i * stripeH;
      root.add(seg);
      // Scale plates
      const scale = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), matDeep);
      scale.position.set(0.06, seg.position.y, 0.02);
      root.add(scale);
    }
    // Full dino head as tip
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.14), matTeal);
    head.position.set(0, 0.36 + bladeH + 0.02, 0.02);
    root.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.12), matOcean);
    snout.position.set(0, 0.36 + bladeH - 0.01, 0.12);
    root.add(snout);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.1), matBelly);
    jaw.position.set(0, 0.36 + bladeH - 0.05, 0.1);
    root.add(jaw);
    for (let i = 0; i < 4; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 4), matFoam);
      tooth.position.set(-0.03 + i * 0.02, 0.36 + bladeH - 0.07, 0.14);
      root.add(tooth);
    }
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
    eye.position.set(0.04, 0.36 + bladeH + 0.04, 0.08);
    root.add(eye);
    // Sail fins
    for (let i = 0; i < 5; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07 + i * 0.01, 0.02), matDeep);
      fin.position.set(0.09, 0.45 + i * 0.1, 0);
      fin.rotation.z = -0.5;
      root.add(fin);
    }
    // Water bubbles detail
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(
        new THREE.SphereGeometry(0.015 + (i % 3) * 0.005, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.7 })
      );
      b.position.set(-0.06, 0.4 + i * 0.08, 0.03);
      root.add(b);
    }
    root.userData.waterBubbles = true;
  }
  return root;
}

/**
 * BIG ocean-colored water dinosaur — feet on the ground (y=0 is soles).
 * Only if you bought Water Dino. Follows you · POWER 2 bite/roar.
 */
function buildWaterDinosaur() {
  const root = new THREE.Group();
  root.name = "waterDinosaur";

  // Ocean / water colors
  const matOcean = new THREE.MeshStandardMaterial({
    color: 0x0284c7, // ocean blue
    emissive: 0x0369a1,
    emissiveIntensity: 0.4,
    metalness: 0.35,
    roughness: 0.4,
    flatShading: false,
  });
  const matDeep = new THREE.MeshStandardMaterial({
    color: 0x0c4a6e, // deep ocean
    emissive: 0x075985,
    emissiveIntensity: 0.25,
    metalness: 0.4,
    roughness: 0.45,
    flatShading: false,
  });
  const matAqua = new THREE.MeshStandardMaterial({
    color: 0x22d3ee, // bright water
    emissive: 0x0891b2,
    emissiveIntensity: 0.35,
    metalness: 0.3,
    roughness: 0.4,
    flatShading: false,
  });
  const matFoam = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe, // sea foam belly
    metalness: 0.15,
    roughness: 0.55,
    flatShading: false,
  });
  const matWave = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.3,
    metalness: 0.25,
    roughness: 0.5,
    flatShading: false,
  });
  const matEye = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const matPupil = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const matTooth = new THREE.MeshStandardMaterial({ color: 0xf8fafc, flatShading: false });

  // Build so feet sit on y=0 — never buried
  // Tall BIG dino proportions
  const LEG_H = 1.15;
  const BODY_H = 1.1;
  const BODY_Y = LEG_H + BODY_H * 0.45; // body center

  // ── 4 thick ocean legs standing ON the ground ──
  const legSpots = [
    [-0.55, 0.45],
    [0.55, 0.45],
    [-0.6, -0.55],
    [0.6, -0.55],
  ];
  for (const [sx, sz] of legSpots) {
    // Foot pad on ground (bottom at y=0)
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.5), matDeep);
    foot.position.set(sx, 0.09, sz);
    root.add(foot);
    // Toes
    for (let t = 0; t < 3; t++) {
      const toe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.16), matAqua);
      toe.position.set(sx + (t - 1) * 0.12, 0.08, sz + 0.28);
      root.add(toe);
    }
    // Leg shaft
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.32, LEG_H, 0.34), matOcean);
    leg.position.set(sx, LEG_H * 0.5 + 0.08, sz);
    root.add(leg);
    // Knee band (wave stripe)
    const knee = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.38), matAqua);
    knee.position.set(sx, LEG_H * 0.45, sz);
    root.add(knee);
  }

  // ── Huge ocean body ──
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, BODY_H, 2.2), matOcean);
  body.position.set(0, BODY_Y, 0);
  root.add(body);
  // Wave stripes on body
  for (let i = 0; i < 4; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.25), matAqua);
    stripe.position.set(0, BODY_Y - 0.25 + i * 0.2, 0.2 - i * 0.15);
    root.add(stripe);
  }
  // Foam belly
  const belly = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 1.7), matFoam);
  belly.position.set(0, BODY_Y - 0.35, 0.05);
  root.add(belly);

  // ── Long neck ──
  const neck1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.6), matOcean);
  neck1.position.set(0, BODY_Y + 0.7, 0.85);
  root.add(neck1);
  const neck2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.55), matAqua);
  neck2.position.set(0, BODY_Y + 1.25, 1.15);
  root.add(neck2);

  // ── Big head ──
  const headY = BODY_Y + 1.7;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.85), matOcean);
  head.position.set(0, headY, 1.55);
  root.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.7), matAqua);
  snout.position.set(0, headY - 0.05, 2.1);
  root.add(snout);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.6), matFoam);
  jaw.position.set(0, headY - 0.28, 2.0);
  root.add(jaw);
  // Teeth
  for (let i = 0; i < 6; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), matTooth);
    tooth.position.set(-0.2 + i * 0.08, headY - 0.38, 2.25);
    root.add(tooth);
  }
  // Eyes
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), matEye);
    eye.position.set(sx * 0.28, headY + 0.12, 1.85);
    root.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), matPupil);
    pupil.position.set(sx * 0.28, headY + 0.12, 1.95);
    root.add(pupil);
  }
  // Head crest fin (ocean)
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.5), matDeep);
  crest.position.set(0, headY + 0.4, 1.5);
  root.add(crest);

  // ── Back sail / ocean fins ──
  for (let i = 0; i < 7; i++) {
    const h = 0.55 + (i % 3) * 0.15;
    const sail = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, 0.28), matDeep);
    sail.position.set(0, BODY_Y + BODY_H * 0.45 + h * 0.35, 0.7 - i * 0.28);
    root.add(sail);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.2), matAqua);
    tip.position.set(0, sail.position.y + h * 0.4, sail.position.z);
    root.add(tip);
  }

  // ── Big ocean tail ──
  const tail1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.65, 0.9), matOcean);
  tail1.position.set(0, BODY_Y - 0.05, -1.3);
  root.add(tail1);
  const tail2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.8), matAqua);
  tail2.position.set(0, BODY_Y + 0.05, -2.0);
  root.add(tail2);
  const tail3 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.6), matWave);
  tail3.position.set(0, BODY_Y + 0.15, -2.55);
  root.add(tail3);
  // Tail fluke (like ocean creature)
  const fluke = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.15, 0.45), matDeep);
  fluke.position.set(0, BODY_Y + 0.2, -2.9);
  root.add(fluke);
  const flukeUp = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.35), matAqua);
  flukeUp.position.set(0, BODY_Y + 0.55, -2.85);
  root.add(flukeUp);

  // Side flippers / fins
  for (const sx of [-1, 1]) {
    const flip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.45), matDeep);
    flip.position.set(sx * 0.95, BODY_Y - 0.15, 0.15);
    flip.rotation.z = sx * 0.25;
    root.add(flip);
    const flipTip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.3), matAqua);
    flipTip.position.set(sx * 1.45, BODY_Y - 0.1, 0.15);
    root.add(flipTip);
  }

  // Soft water glow under body (not a ground-clip ring)
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.18, depthWrite: false })
  );
  glow.position.set(0, 0.6, 0);
  glow.scale.set(1.4, 0.5, 1.6);
  root.add(glow);

  // Splash rings sit AT feet level, slightly above ground
  const splash = new THREE.Mesh(
    new THREE.TorusGeometry(1.1, 0.06, 6, 20),
    new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.5 })
  );
  splash.rotation.x = Math.PI / 2;
  splash.position.y = 0.08; // just above soles
  root.add(splash);

  root.userData.splash = splash;
  root.userData.jaw = jaw;
  root.userData.glow = glow;
  // Feet on y=0 — scale makes it BIG ocean dino
  root.scale.setScalar(2.4);
  root.userData.standScale = 2.4;
  return root;
}

/** Ground Y for dino feet — never sinks into terrain */
function waterDinoGroundY(x, z) {
  let gy = 0;
  try {
    gy = typeof groundY === "function" ? groundY(x, z) : 0;
  } catch (_) {
    gy = 0;
  }
  // Keep above ocean floor / flat pads; small lift so feet sit on top of grass
  if (!Number.isFinite(gy)) gy = 0;
  return Math.max(0.02, gy) + 0.06;
}

function ensureWaterDinosaur() {
  const trialOk = state.fidgetTrial && state.fidgetTrial.kind === "waterdino";
  if (!hasInvItem("waterdino") && !hasInvItem("waterDinosaur") && !trialOk) return null;
  if (state.waterDinoPet?.root) {
    // Rebuild if old tiny/sunk version
    if (!state.waterDinoPet.root.userData?.standScale || state.waterDinoPet.root.userData.standScale < 2) {
      removeWaterDinosaur();
    } else {
      return state.waterDinoPet;
    }
  }
  const root = buildWaterDinosaur();
  const px = player.pos.x - 3.5;
  const pz = player.pos.z - 2.5;
  const gy = waterDinoGroundY(px, pz);
  root.position.set(px, gy, pz);
  scene.add(root);
  state.waterDinoPet = { root, t: 0, biteCd: 0 };
  return state.waterDinoPet;
}

function removeWaterDinosaur() {
  if (state.waterDinoPet?.root) {
    scene.remove(state.waterDinoPet.root);
  }
  state.waterDinoPet = null;
}

function updateWaterDinosaur(dt) {
  const trialOk = state.fidgetTrial && state.fidgetTrial.kind === "waterdino";
  if (!hasInvItem("waterdino") && !hasInvItem("waterDinosaur") && !trialOk) {
    if (state.waterDinoPet) removeWaterDinosaur();
    return;
  }
  const pet = ensureWaterDinosaur();
  if (!pet || !pet.root) return;
  pet.t += dt;
  pet.biteCd = Math.max(0, pet.biteCd - dt);

  // Follow beside player — big dino needs more space
  const dist = 4.2;
  const tx = player.pos.x - Math.sin(player.yaw) * dist - Math.cos(player.yaw) * 1.2;
  const tz = player.pos.z - Math.cos(player.yaw) * dist + Math.sin(player.yaw) * 1.2;
  const ty = waterDinoGroundY(tx, tz);
  const ease = Math.min(1, 2.4 * dt);
  pet.root.position.x += (tx - pet.root.position.x) * ease;
  pet.root.position.z += (tz - pet.root.position.z) * ease;
  // Pin Y to ground every frame (plus tiny bob) so it never sinks
  const bob = Math.sin(pet.t * 2.2) * 0.04;
  pet.root.position.y = ty + bob;

  const dx = player.pos.x - pet.root.position.x;
  const dz = player.pos.z - pet.root.position.z;
  pet.root.rotation.y = Math.atan2(dx, dz);

  if (pet.root.userData.splash) {
    pet.root.userData.splash.scale.setScalar(1 + Math.sin(pet.t * 5) * 0.1);
    pet.root.userData.splash.material.opacity = 0.35 + Math.sin(pet.t * 4) * 0.15;
  }
  if (pet.root.userData.glow) {
    pet.root.userData.glow.material.opacity = 0.12 + Math.sin(pet.t * 3) * 0.06;
  }
}

/** Power 2 for Water Dino — dino bite / roar */
function waterDinoPower2() {
  if (!canUseFidget("waterdino")) {
    toast("Buy Water Dino or TRY free 30s — water dinosaur + 2 powers!", "kill");
    return;
  }
  const pet = ensureWaterDinosaur();
  if (!pet || pet.biteCd > 0) {
    if (pet && pet.biteCd > 0) toast(`Water dino recharging… ${pet.biteCd.toFixed(1)}s`, "");
    return;
  }
  pet.biteCd = 1.4;
  playTone(120, 0.2, "sawtooth", 0.1);
  playTone(90, 0.25, "square", 0.08);
  toast("🦕 WATER DINO POWER 2 — BITE!", "kill");
  playerSay("Water dino!");
  // Damage nearby enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(
      e.group.position.x - pet.root.position.x,
      e.group.position.z - pet.root.position.z
    );
    if (d < 5.5) {
      damageEnemy(e, 45);
      spawnHitSparks(e.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 10, 0x22d3ee);
    }
  }
  // Visual roar ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.08, 6, 20),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(pet.root.position);
  ring.position.y += 0.8;
  scene.add(ring);
  if (!state.niftyProjectiles) state.niftyProjectiles = [];
  state.niftyProjectiles.push({
    mesh: ring,
    ring: null,
    vel: new THREE.Vector3(0, 0.4, 0),
    life: 0.5,
    dmg: 0,
    kind: "fx",
    grow: true,
  });
}

// ═══════════════════════════════════════════════════════════
// RON'S ANIMAL — cute beige worm buddy (always follows Ron)
// Based on the worm character art: glossy tan body, stalk eyes, smile
// ═══════════════════════════════════════════════════════════

function buildRonsAnimal() {
  const root = new THREE.Group();
  root.name = "ronsAnimal";

  const matBody = new THREE.MeshPhysicalMaterial({
    color: 0xc4a882,
    roughness: 0.35,
    metalness: 0.02,
    clearcoat: 0.55,
    clearcoatRoughness: 0.25,
    sheen: 0.4,
    sheenColor: new THREE.Color(0xe8d4b8),
    sheenRoughness: 0.5,
  });
  const matBodySoft = new THREE.MeshPhysicalMaterial({
    color: 0xb8966e,
    roughness: 0.4,
    metalness: 0.0,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
  });
  const matEyeWhite = new THREE.MeshPhysicalMaterial({
    color: 0xf0e6d4,
    roughness: 0.25,
    metalness: 0.0,
    clearcoat: 0.6,
  });
  const matPupil = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.5 });
  const matFace = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 });
  const matCheek = new THREE.MeshStandardMaterial({
    color: 0xc47868,
    roughness: 0.6,
    transparent: true,
    opacity: 0.55,
  });

  // Body segments along an S-curve (head high → tail curled down)
  // Local: +Z is face direction, Y up. Head at front-left of curve in image.
  const segs = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1); // 0 head → 1 tail
    // S-curve in XZ and slight Y drop toward tail
    const x = Math.sin(t * Math.PI * 0.95) * 0.55;
    const z = -t * 1.35;
    const y = 0.22 + Math.sin(t * Math.PI) * 0.08 - t * 0.12;
    // Thickness: fat head, taper to curled tip
    const r = 0.22 * (1.15 - t * 0.55) * (i === 0 ? 1.12 : 1);
    const geo = new THREE.SphereGeometry(r, 14, 12);
    const mesh = new THREE.Mesh(geo, i < 3 ? matBody : matBodySoft);
    mesh.position.set(x, y, z);
    // Squash a bit for organic worm look
    mesh.scale.set(1.05, 0.92 + (1 - t) * 0.08, 1.1);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    segs.push(mesh);
  }
  root.userData.bodySegs = segs;

  // Head is first segment — face sits on it
  const head = segs[0];
  const hx = head.position.x;
  const hy = head.position.y;
  const hz = head.position.z;

  // Eye stalks (big round eyes on top of head, slightly apart)
  const eyeGroup = new THREE.Group();
  eyeGroup.position.set(hx, hy + 0.18, hz + 0.06);
  root.add(eyeGroup);
  root.userData.eyeGroup = eyeGroup;

  for (const sx of [-1, 1]) {
    const stalk = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 10, 8),
      matBody
    );
    stalk.position.set(sx * 0.11, 0.02, 0);
    stalk.scale.set(1, 1.15, 0.95);
    eyeGroup.add(stalk);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), matEyeWhite);
    eye.position.set(sx * 0.12, 0.1, 0.02);
    eyeGroup.add(eye);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), matPupil);
    pupil.position.set(sx * 0.12, 0.11, 0.085);
    eyeGroup.add(pupil);

    // Tiny highlight
    const shine = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    shine.position.set(sx * 0.1, 0.13, 0.1);
    eyeGroup.add(shine);
  }

  // Smile (two short arcs as thin boxes) + freckle cheeks
  const smile = new THREE.Group();
  smile.position.set(hx, hy - 0.02, hz + 0.18);
  root.add(smile);
  const smileL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.012), matFace);
  smileL.position.set(-0.035, 0, 0);
  smileL.rotation.z = 0.35;
  const smileR = smileL.clone();
  smileR.position.x = 0.035;
  smileR.rotation.z = -0.35;
  smile.add(smileL, smileR);
  // Small V / mouth dip in center
  const smileMid = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.012), matFace);
  smileMid.position.set(0, -0.012, 0);
  smile.add(smileMid);

  for (const sx of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), matCheek);
    cheek.position.set(hx + sx * 0.12, hy - 0.04, hz + 0.14);
    root.add(cheek);
  }

  // Soft ground shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);
  root.userData.shadow = shadow;

  // Overall scale — pet-sized buddy next to Ron
  root.scale.setScalar(1.15);
  root.userData.standScale = 1.15;
  return root;
}

function ronAnimalGroundY(x, z) {
  let gy = 0;
  try {
    gy = typeof groundY === "function" ? groundY(x, z) : 0;
  } catch (_) {
    gy = 0;
  }
  if (!Number.isFinite(gy)) gy = 0;
  return Math.max(0.02, gy) + 0.04;
}

/** Always with Ron — his personal animal companion */
function ensureRonsAnimal() {
  if (state.ronAnimalPet?.root) return state.ronAnimalPet;
  const root = buildRonsAnimal();
  const px = player.pos.x - 1.4;
  const pz = player.pos.z - 1.1;
  const gy = ronAnimalGroundY(px, pz);
  root.position.set(px, gy, pz);
  scene.add(root);
  state.ronAnimalPet = { root, t: 0, hop: 0 };
  if (!state.ronAnimalIntro) {
    state.ronAnimalIntro = true;
    try {
      toast("🪱 Ron's animal joined you!", "reward");
      if (typeof playerSay === "function") playerSay("My animal!");
    } catch (_) {}
  }
  return state.ronAnimalPet;
}

function removeRonsAnimal() {
  if (state.ronAnimalPet?.root) {
    scene.remove(state.ronAnimalPet.root);
  }
  state.ronAnimalPet = null;
}

function updateRonsAnimal(dt) {
  const pet = ensureRonsAnimal();
  if (!pet || !pet.root) return;
  pet.t += dt;

  // Follow beside / slightly behind Ron (closer than water dino)
  const dist = 1.55;
  const side = 0.85;
  const yaw = player.yaw || 0;
  const tx = player.pos.x - Math.sin(yaw) * dist - Math.cos(yaw) * side;
  const tz = player.pos.z - Math.cos(yaw) * dist + Math.sin(yaw) * side;
  const ty = ronAnimalGroundY(tx, tz);

  // If Ron is in vehicle, still try to stick nearby at ground level
  const ease = Math.min(1, 3.2 * dt);
  pet.root.position.x += (tx - pet.root.position.x) * ease;
  pet.root.position.z += (tz - pet.root.position.z) * ease;

  // Cute wiggle bob + inchworm hop feel
  const bob = Math.sin(pet.t * 4.5) * 0.035 + Math.sin(pet.t * 2.1) * 0.02;
  pet.root.position.y = ty + bob;

  // Face toward Ron
  const dx = player.pos.x - pet.root.position.x;
  const dz = player.pos.z - pet.root.position.z;
  if (Math.hypot(dx, dz) > 0.05) {
    const targetYaw = Math.atan2(dx, dz);
    let cur = pet.root.rotation.y;
    let diff = targetYaw - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    pet.root.rotation.y = cur + diff * Math.min(1, 5 * dt);
  }

  // Body segment wiggle (wave down the worm)
  const segs = pet.root.userData.bodySegs;
  if (segs && segs.length) {
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const wave = Math.sin(pet.t * 5.5 - i * 0.55) * 0.04;
      s.position.x = Math.sin((i / (segs.length - 1)) * Math.PI * 0.95) * 0.55 + wave;
      s.rotation.z = wave * 1.2;
      s.rotation.x = Math.sin(pet.t * 4 - i * 0.4) * 0.08;
    }
  }

  // Eyes look / blink-ish squash
  if (pet.root.userData.eyeGroup) {
    const eg = pet.root.userData.eyeGroup;
    eg.rotation.y = Math.sin(pet.t * 1.3) * 0.12;
    eg.position.y = 0.18 + Math.sin(pet.t * 3.2) * 0.012;
    // Soft blink every ~4s
    const blink = Math.max(0, Math.sin(pet.t * 1.6) - 0.92) * 12;
    eg.scale.y = 1 - Math.min(0.7, blink);
  }

  if (pet.root.userData.shadow) {
    pet.root.userData.shadow.material.opacity = 0.18 + Math.sin(pet.t * 3) * 0.04;
  }
}

/** Hat Power — red / white / blue power hat */
function buildHatPower() {
  const hat = new THREE.Group();
  hat.name = "hatPower";
  const m = niftyMats();
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.30, 0.04, 16), m.dark);
  brim.position.y = 0.02;
  hat.add(brim);
  const crownBlue = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 0.12, 14), m.blue);
  crownBlue.position.y = 0.10;
  hat.add(crownBlue);
  const crownWhite = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.08, 14), m.white);
  crownWhite.position.y = 0.20;
  hat.add(crownWhite);
  const crownRed = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.10, 14), m.red);
  crownRed.position.y = 0.29;
  hat.add(crownRed);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), m.gold);
  star.position.set(0, 0.22, 0.17);
  hat.add(star);
  for (const sx of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.08), m.white);
    fin.position.set(sx * 0.2, 0.18, 0);
    fin.rotation.z = sx * 0.35;
    hat.add(fin);
  }
  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.02, 6, 20),
    new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.55 })
  );
  glow.rotation.x = Math.PI / 2;
  glow.position.y = 0.06;
  hat.add(glow);
  hat.userData.glow = glow;
  hat.userData.star = star;
  return hat;
}

/**
 * Shop stand in the AVENGERS SERVER (hangar hub) — full fidget bundle.
 * Limited time: only available until the end of November.
 */
function spawnNiftyBundleStand(x, z, baseY = null) {
  const gy = baseY != null ? baseY : groundY(x, z);
  const stand = new THREE.Group();
  stand.position.set(x, gy, z);
  const m = niftyMats();

  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(7.5, 0.18, 5.5),
    new THREE.MeshStandardMaterial({ color: 0xb8c0c8, roughness: 0.9, flatShading: false })
  );
  pad.position.y = 0.1;
  stand.add(pad);
  for (let i = 0; i < 5; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 0.04, 0.55),
      i % 3 === 0 ? m.red : i % 3 === 1 ? m.gold : m.blue
    );
    stripe.position.set(0, 0.2, -1.6 + i * 0.7);
    stand.add(stripe);
  }

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 2.4, 0.15),
    new THREE.MeshLambertMaterial({ color: 0x0f0a1e, flatShading: false })
  );
  board.position.set(0, 1.6, -2.2);
  stand.add(board);
  const boardBorder = new THREE.Mesh(new THREE.BoxGeometry(7.0, 2.55, 0.08), m.gold);
  boardBorder.position.set(0, 1.6, -2.28);
  stand.add(boardBorder);

  const title = makeNameLabel("🦸 AVENGERS SERVER · FIDGET BUNDLE");
  title.position.set(0, 3.35, -2.0);
  title.scale.set(4.4, 0.7, 1);
  stand.add(title);

  const forSaleLabel = makeNameLabel("LIMITED · ENDS NOVEMBER · BUY EACH · GREEN COINS");
  forSaleLabel.position.set(0, 2.85, -2.0);
  forSaleLabel.scale.set(3.8, 0.55, 1);
  stand.add(forSaleLabel);

  const soldOutLabel = makeNameLabel("SHOP CLOSED · NOVEMBER ONLY");
  soldOutLabel.position.set(0, 2.85, -2.0);
  soldOutLabel.scale.set(3.4, 0.55, 1);
  soldOutLabel.visible = false;
  stand.add(soldOutLabel);

  const ownedLabel = makeNameLabel("I = inventory · only items YOU bought");
  ownedLabel.position.set(0, 2.45, -2.0);
  ownedLabel.scale.set(3.4, 0.5, 1);
  ownedLabel.visible = false;
  stand.add(ownedLabel);

  const displayGroup = new THREE.Group();
  const swordKinds = ["nifty", "venom", "waterdino"];
  const displays = [];
  for (let i = 0; i < 3; i++) {
    const kind = swordKinds[i];
    const info = NIFTY_SWORDS[kind];
    const px = -2.1 + i * 2.1;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.55, 10), m.dark);
    ped.position.set(px, 0.45, 0.2);
    displayGroup.add(ped);
    const sword = buildNiftySword(kind);
    sword.position.set(px, 0.85, 0.2);
    sword.rotation.z = -0.25;
    sword.scale.setScalar(1.35);
    displayGroup.add(sword);
    const lab = makeNameLabel(`${info.name.toUpperCase()}`);
    lab.position.set(px, 2.15, 0.2);
    lab.scale.set(1.55, 0.3, 1);
    displayGroup.add(lab);
    const priceLab = makeNameLabel(`${info.price} GREEN COINS`);
    priceLab.position.set(px, 1.85, 0.2);
    priceLab.scale.set(1.35, 0.28, 1);
    displayGroup.add(priceLab);
    displays.push({ sword, kind, priceLab });
  }
  // Water dino display pet on the right pedestal area
  const dinoDisp = buildWaterDinosaur();
  // Shop preview — stand ON the platform (feet at local y=0), not buried
  dinoDisp.position.set(2.2, 0.22, 1.55);
  dinoDisp.scale.setScalar(0.55); // smaller preview of the big ocean dino
  dinoDisp.rotation.y = -0.55;
  displayGroup.add(dinoDisp);
  const dinoLab = makeNameLabel("BIG OCEAN WATER DINOSAUR + 2 POWERS");
  dinoLab.position.set(2.2, 2.4, 1.55);
  dinoLab.scale.set(1.6, 0.28, 1);
  displayGroup.add(dinoLab);
  // Hat only comes with Nifty when bought
  const hatPed = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.2, 1.1), m.gold);
  hatPed.position.set(-2.1, 0.35, 1.55);
  displayGroup.add(hatPed);
  const hatDisp = buildHatPower();
  hatDisp.position.set(-2.1, 0.55, 1.55);
  hatDisp.scale.setScalar(1.15);
  displayGroup.add(hatDisp);
  const hatLab = makeNameLabel("HAT POWER w/ NIFTY");
  hatLab.position.set(-2.1, 1.15, 1.55);
  hatLab.scale.set(1.5, 0.28, 1);
  displayGroup.add(hatLab);

  stand.add(displayGroup);
  scene.add(stand);

  addCollider(x, gy + 0.15, z, 7.5, 0.35, 5.5);
  addCollider(x, gy + 1.5, z - 2.2, 6.8, 2.4, 0.4);

  const entry = {
    root: stand,
    x,
    z,
    gy,
    displayGroup,
    displays,
    hatDisp,
    forSaleLabel,
    soldOutLabel,
    ownedLabel,
    price: NIFTY_BUNDLE_PRICE,
  };
  state.niftyStand = entry;
  checkNiftyBundleExpiry();
  return entry;
}

function nearestNiftyBundle(maxDist = 7) {
  const s = state.niftyStand;
  if (!s) return null;
  const d = Math.hypot(player.pos.x - s.x, player.pos.z - s.z);
  return d <= maxDist ? s : null;
}

function showNiftyBundleUI(show) {
  const el = $("nifty-offer");
  if (!el) return;
  if (show) el.classList.remove("hidden");
  else el.classList.add("hidden");
  // Refresh shop button states
  if (show) refreshFidgetShopUI();
}

function refreshFidgetShopUI() {
  for (const kind of ["nifty", "venom", "waterdino"]) {
    const btn = $(`buy-fidget-${kind}`);
    const tryBtn = $(`try-fidget-${kind}`);
    const info = NIFTY_SWORDS[kind];
    if (!info) continue;
    if (btn) {
      if (hasInvItem(kind)) {
        btn.classList.add("owned");
        btn.disabled = true;
        const t = btn.querySelector(".choice-title");
        if (t) t.textContent = "OWNED";
        const d = btn.querySelector(".choice-desc");
        if (d) d.textContent = "In your inventory forever";
        const k = btn.querySelector(".choice-key");
        if (k) k.textContent = "YOURS";
      } else {
        btn.classList.remove("owned");
        btn.disabled = false;
        const t = btn.querySelector(".choice-title");
        if (t) t.textContent = `BUY ${info.name.toUpperCase()}`;
        const d = btn.querySelector(".choice-desc");
        if (d) d.textContent = `${info.price} green coins · keep forever`;
        const k = btn.querySelector(".choice-key");
        if (k) k.textContent = `${info.price} 🟢`;
      }
    }
    if (tryBtn) {
      if (hasInvItem(kind)) {
        tryBtn.disabled = true;
        tryBtn.classList.add("owned");
        const t = tryBtn.querySelector(".choice-title");
        if (t) t.textContent = "OWNED";
      } else {
        tryBtn.disabled = false;
        tryBtn.classList.remove("owned");
        const t = tryBtn.querySelector(".choice-title");
        if (t) t.textContent = `TRY FREE ${FIDGET_TRIAL_SECONDS}s`;
        const d = tryBtn.querySelector(".choice-desc");
        if (d) d.textContent = `Use ${info.name} free for ${FIDGET_TRIAL_SECONDS}s · then it's gone unless you BUY`;
        const k = tryBtn.querySelector(".choice-key");
        if (k) k.textContent = "T / click";
      }
    }
  }
  const you = $("nifty-your-coins");
  if (you) you.textContent = String(state.coins | 0);
  const trialEl = $("fidget-trial");
  if (trialEl) {
    if (state.fidgetTrial) trialEl.classList.remove("hidden");
    else trialEl.classList.add("hidden");
  }
  updateFidgetTrialUI();
}

function updateFidgetTrialUI() {
  const t = $("fidget-trial-time");
  if (t && state.fidgetTrial) {
    t.textContent = String(Math.max(0, Math.ceil(state.fidgetTrial.left)));
  }
  const name = $("fidget-trial-name");
  if (name && state.fidgetTrial && NIFTY_SWORDS[state.fidgetTrial.kind]) {
    name.textContent = NIFTY_SWORDS[state.fidgetTrial.kind].name;
  }
}

function canUseFidget(kind) {
  return hasInvItem(kind) || (state.fidgetTrial && state.fidgetTrial.kind === kind);
}

// ── SAVE FOREVER (Safari localStorage) — inventory + money + progress ──
// Stays on this Mac/Safari profile until you clear website data.
const INV_STORAGE_KEY = "nexus_save_forever_v3";

function hasInvItem(id) {
  return !!(state.inv && state.inv[id]);
}

function saveInventoryForever() {
  try {
    const data = {
      version: 3,
      savedAt: Date.now(),
      inv: {
        nifty: !!state.inv.nifty,
        venom: !!state.inv.venom,
        waterdino: !!state.inv.waterdino,
        hatPower: !!state.inv.hatPower,
        waterDinosaur: !!state.inv.waterDinosaur,
      },
      hatPowerOn: !!state.hatPowerOn,
      // Progress stays forever too
      coins: state.coins | 0,
      gems: state.gems | 0,
      purpleGems: state.purpleGems | 0,
      level: state.level | 0,
      xp: state.xp | 0,
      xpToNext: state.xpToNext | 0,
      rocketOwned: !!state.rocketOwned,
      kills: state.kills | 0,
      blocksBuilt: state.blocksBuilt | 0,
      racesWon: state.racesWon | 0,
    };
    localStorage.setItem(INV_STORAGE_KEY, JSON.stringify(data));
    // Also mirror under old key names so nothing is lost
    localStorage.setItem("nexus_fidget_inventory_v2", JSON.stringify({ inv: data.inv, hatPowerOn: data.hatPowerOn }));
  } catch (_) {}
}

function loadInventoryForever() {
  try {
    try { localStorage.removeItem("nexus_fidget_inventory_v1"); } catch (_) {}
    let raw = localStorage.getItem(INV_STORAGE_KEY);
    // Migrate v2 inventory-only save if present
    if (!raw) raw = localStorage.getItem("nexus_fidget_inventory_v2");
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.inv) {
      // ONLY restore flags that were true (purchased) — never invent free items
      state.inv.nifty = !!data.inv.nifty;
      state.inv.venom = !!data.inv.venom;
      state.inv.waterdino = !!data.inv.waterdino;
      state.inv.hatPower = !!data.inv.hatPower;
      state.inv.waterDinosaur = !!data.inv.waterDinosaur;
    }
    if (state.inv.waterdino) state.inv.waterDinosaur = true;
    if (!state.inv.nifty) state.inv.hatPower = false;
    state.niftyBundleOwned = anyFidgetOwned();
    if (state.inv.hatPower && data.hatPowerOn) {
      state._restoreHatPower = true;
    }
    // Restore money & progress forever
    if (typeof data.coins === "number") state.coins = data.coins;
    if (typeof data.gems === "number") state.gems = data.gems;
    if (typeof data.purpleGems === "number") state.purpleGems = data.purpleGems;
    if (typeof data.level === "number" && data.level >= 1) state.level = data.level;
    if (typeof data.xp === "number") state.xp = data.xp;
    if (typeof data.xpToNext === "number" && data.xpToNext > 0) state.xpToNext = data.xpToNext;
    if (data.rocketOwned) state.rocketOwned = true;
    if (typeof data.kills === "number") state.kills = data.kills;
    if (typeof data.blocksBuilt === "number") state.blocksBuilt = data.blocksBuilt;
    if (typeof data.racesWon === "number") state.racesWon = data.racesWon;
  } catch (_) {}
}

function grantFidgetToInventory(id) {
  if (!state.inv) state.inv = {};
  state.inv[id] = true;
  state.niftyBundleOwned = anyFidgetOwned();
  saveInventoryForever();
  renderInventory();
  checkNiftyBundleExpiry();
}

function openNiftyBundleOffer() {
  if (!isNiftyBundleOnSale()) {
    toast("Fidget shop closed — only open through November!", "kill");
    checkNiftyBundleExpiry();
    return;
  }
  state.niftyBundleOffer = true;
  showNiftyBundleUI(true);
  toast(`Fidget shop · TRY free ${FIDGET_TRIAL_SECONDS}s · BUY with green coins · only buys stay forever`, "quest");
}

/**
 * Buy ONE fidget with green coins. Only that item goes in inventory forever.
 */
function buyFidgetItem(kind) {
  const info = NIFTY_SWORDS[kind];
  if (!info) return;
  if (!isNiftyBundleOnSale()) {
    toast("Shop closed — November only!", "kill");
    return;
  }
  if (hasInvItem(kind)) {
    toast(`You already own ${info.name} — press I for inventory`, "reward");
    openInventory();
    return;
  }
  const price = info.price;
  if (state.coins < price) {
    toast(`Need ${price}🟢 to BUY (you have ${state.coins}🟢) · or press T to TRY free ${FIDGET_TRIAL_SECONDS}s!`, "kill");
    refreshFidgetShopUI();
    return;
  }
  if (state.fidgetTrial) endFidgetTrial("bought");
  addCoins(-price);
  grantFidgetToInventory(kind);
  if (info.includes) {
    for (const extra of info.includes) grantFidgetToInventory(extra);
  }
  if (state.niftyStand?.displays) {
    for (const d of state.niftyStand.displays) {
      if (d.kind === kind && d.sword) {
        d.sword.traverse((ch) => {
          if (ch.isMesh && ch.material) {
            ch.material = ch.material.clone();
            ch.material.transparent = true;
            ch.material.opacity = 0.35;
          }
        });
      }
    }
  }
  equipFidgetLoadout(kind, true);
  toast(`BOUGHT ${info.emoji} ${info.name}! −${price}🟢 · yours forever`, "reward");
  addXP(40);
  updateHUD();
  saveInventoryForever();
  refreshFidgetShopUI();
  openInventory();
  state.niftyBundleOffer = false;
  showNiftyBundleUI(false);
  try { canvas.requestPointerLock(); } catch (_) {}
}

/** Free TRY 30s — full use, then gone unless you BUY with green coins */
function startFidgetTrial(kind) {
  const info = NIFTY_SWORDS[kind];
  if (!info) return;
  if (hasInvItem(kind)) {
    toast(`You already own ${info.name}!`, "reward");
    equipSword(kind);
    return;
  }
  if (!isNiftyBundleOnSale()) {
    toast("Shop closed — November only!", "kill");
    return;
  }
  if (state.fidgetTrial) endFidgetTrial("switch");
  state.niftyBundleOffer = false;
  showNiftyBundleUI(false);
  state.fidgetTrial = { kind, left: FIDGET_TRIAL_SECONDS };
  equipFidgetLoadout(kind, false);
  showFidgetTrialUI(true);
  updateFidgetTrialUI();
  toast(`FREE TRY · ${info.emoji} ${info.name} · ${FIDGET_TRIAL_SECONDS}s · BUY with 🟢 to keep forever`, "quest");
  playerSay(`Trying ${info.name}!`);
  try { canvas.requestPointerLock(); } catch (_) {}
}

function equipFidgetLoadout(kind, permanent) {
  if (kind === "nifty") {
    if (permanent) applyHatPower(true);
    else applyHatPowerTrial(true);
    equipSword(kind);
    if (permanent) playerSay("Nifty Fidget Power!");
  } else if (kind === "venom") {
    equipSword(kind);
    if (permanent) playerSay("Venom!");
  } else if (kind === "waterdino") {
    equipSword(kind);
    ensureWaterDinosaur();
    if (permanent) {
      playerSay("Water dino!");
      setTimeout(() => toast("🦕 Click = Power 1 · G = Power 2 BITE", "quest"), 800);
    }
  }
}

function applyHatPowerTrial(on) {
  if (state._hatPowerMesh) {
    state._hatPowerMesh.parent?.remove(state._hatPowerMesh);
    state._hatPowerMesh = null;
  }
  state.hatPowerOn = !!on;
  if (!on) return;
  const hat = buildHatPower();
  hat.position.set(0, HEAD_H * 0.55 + 0.12, 0.02);
  hat.scale.setScalar(1.05);
  avHead.add(hat);
  state._hatPowerMesh = hat;
}

function showFidgetTrialUI(show) {
  const el = $("fidget-trial");
  if (!el) return;
  if (show) el.classList.remove("hidden");
  else el.classList.add("hidden");
}

function endFidgetTrial(reason = "timeout") {
  if (!state.fidgetTrial && reason !== "force") return;
  const kind = state.fidgetTrial?.kind;
  state.fidgetTrial = null;
  showFidgetTrialUI(false);
  if (kind && !hasInvItem(kind)) {
    if (state.activeSword === kind) unequipSword({ quiet: true });
    if (kind === "nifty" && !hasInvItem("hatPower")) {
      applyHatPowerTrial(false);
      state.hatPowerOn = false;
    }
    if (kind === "waterdino" && !hasInvItem("waterdino") && !hasInvItem("waterDinosaur")) {
      removeWaterDinosaur();
    }
  }
  if (reason === "timeout") {
    toast(`⏰ Try over! Buy with green coins to keep forever`, "kill");
    playerSay("Try time's up!");
  } else if (reason === "done") {
    toast("Try ended — BUY with green coins to keep it", "quest");
  }
  updateHUD();
}

function updateFidgetTrial(dt) {
  if (!state.fidgetTrial) return;
  state.fidgetTrial.left -= dt;
  updateFidgetTrialUI();
  if (state.fidgetTrial.left <= 0) endFidgetTrial("timeout");
}

function buyNiftyBundle() {
  openNiftyBundleOffer();
}

function cancelNiftyBundleOffer() {
  state.niftyBundleOffer = false;
  showNiftyBundleUI(false);
  toast("Shop closed. TRY free 30s or BUY with green coins!", "");
  try { canvas.requestPointerLock(); } catch (_) {}
}

function applyHatPower(on) {
  if (state._hatPowerMesh) {
    state._hatPowerMesh.parent?.remove(state._hatPowerMesh);
    state._hatPowerMesh = null;
  }
  state.hatPowerOn = !!on;
  if (!on) {
    saveInventoryForever();
    renderInventory();
    if (hasInvItem("hatPower")) toast("Hat Power stored in inventory", "");
    return;
  }
  // Hat if bought with Nifty, or mid free-try of Nifty
  if (!hasInvItem("hatPower") && !(state.fidgetTrial && state.fidgetTrial.kind === "nifty")) {
    toast("Hat Power only comes when you BUY Nifty Fidget Power!", "kill");
    state.hatPowerOn = false;
    return;
  }
  const hat = buildHatPower();
  hat.position.set(0, HEAD_H * 0.55 + 0.12, 0.02);
  hat.scale.setScalar(1.05);
  avHead.add(hat);
  state._hatPowerMesh = hat;
  toast("Hat Power ON — red · white · blue!", "reward");
  saveInventoryForever();
  renderInventory();
}

/**
 * Put sword away — disappears from hand, stays in inventory if you own it.
 */
function unequipSword(opts = {}) {
  const quiet = !!opts.quiet;
  const was = state.activeSword;
  if (state._heldSword) {
    state._heldSword.parent?.remove(state._heldSword);
    state._heldSword = null;
  }
  if (state._fpsSword) {
    state._fpsSword.parent?.remove(state._fpsSword);
    state._fpsSword = null;
  }
  state.activeSword = null;
  weaponGroup.visible = false;
  if (state.niftyPowerBall?.mesh) {
    scene.remove(state.niftyPowerBall.mesh);
    state.niftyPowerBall = null;
  }
  state.niftyShootStreak = 0;
  if (was && NIFTY_SWORDS[was] && hasInvItem(was)) {
    if (!quiet) {
      const info = NIFTY_SWORDS[was];
      toast(`${info.emoji} ${info.name} stored in inventory forever`, "quest");
    }
    saveInventoryForever();
  }
  renderInventory();
  updateHUD();
}

function equipSword(kind) {
  if (!NIFTY_SWORDS[kind]) return;
  // Must own it OR be on a free 30s try
  if (!canUseFidget(kind)) {
    const info = NIFTY_SWORDS[kind];
    toast(`Buy ${info.name} for ${info.price}🟢 or TRY free ${FIDGET_TRIAL_SECONDS}s at the shop!`, "kill");
    return;
  }
  // Click same sword again = put away into inventory
  if (state.activeSword === kind) {
    unequipSword();
    return;
  }
  if (state.activeSword) unequipSword({ quiet: true });

  state.activeSword = kind;
  state.slot = 5;

  const sword = buildNiftySword(kind);
  avArmR.handRoot.add(sword);
  sword.position.set(0.02, -0.14, -0.08);
  sword.rotation.set(0.35, 0.15, 0.55);
  sword.scale.setScalar(1.15);
  state._heldSword = sword;

  const fps = buildNiftySword(kind);
  weaponGroup.add(fps);
  fps.position.set(0.35, -0.28, -0.55);
  fps.rotation.set(0.15, 0.4, -0.35);
  fps.scale.setScalar(1.0);
  state._fpsSword = fps;
  weaponGroup.visible = !player.camDist || player.camDist < 1.2;

  if (kind === "waterdino") ensureWaterDinosaur();

  const info = NIFTY_SWORDS[kind];
  toast(`${info.emoji} ${info.name} equipped! Click off to store in inventory`, "reward");
  if (kind === "nifty") playerSay("Nifty Fidget Power!");
  if (kind === "waterdino") toast("Power 1: click shoot · Power 2: G water-dino bite", "quest");
  setMode("COMBAT");
  renderInventory();
  updateHUD();
}

function toggleInventory() {
  if (state.inventoryOpen) closeInventory();
  else openInventory();
}

function openInventory() {
  state.inventoryOpen = true;
  document.body.classList.add("inv-open");
  const el = $("inventory-panel");
  if (el) el.classList.remove("hidden");
  renderInventory();
  // Unlock mouse so you can click items
  try { document.exitPointerLock(); } catch (_) {}
  toast("INVENTORY · click a fidget to equip · click equipped to store forever", "quest");
}

function closeInventory() {
  state.inventoryOpen = false;
  document.body.classList.remove("inv-open");
  const el = $("inventory-panel");
  if (el) el.classList.add("hidden");
  if (state.started && !state.paused && !state.settingsOpen) {
    try { canvas.requestPointerLock(); } catch (_) {}
  }
}

function renderInventory() {
  const grid = $("inv-grid");
  if (!grid) return;
  // ONLY items you actually bought — never show unbought stuff
  const catalog = [
    { id: "nifty", name: "Nifty Fidget Power", emoji: "🌪️", desc: "Tornado · shoot · power ball", key: "8" },
    { id: "hatPower", name: "Hat Power", emoji: "🎩", desc: "Came with Nifty · RWB hat", key: "H" },
    { id: "venom", name: "Venom", emoji: "🐍", desc: "Toxic spit power", key: "9" },
    { id: "waterdino", name: "Water Dino", emoji: "🦕", desc: "2 powers · water dinosaur pet", key: "0" },
    { id: "waterDinosaur", name: "Water Dinosaur", emoji: "🌊", desc: "Pet that follows you (with Water Dino)", key: "G" },
  ];
  grid.innerHTML = "";
  let any = false;
  for (const it of catalog) {
    if (!hasInvItem(it.id)) continue; // skip unbought completely
    any = true;
    const row = document.createElement("button");
    row.type = "button";
    row.className = "inv-item owned";
    const equipped =
      (it.id === "hatPower" && state.hatPowerOn) ||
      (it.id === "waterDinosaur" && !!state.waterDinoPet) ||
      (it.id !== "hatPower" && it.id !== "waterDinosaur" && state.activeSword === it.id);
    if (equipped) row.classList.add("equipped");
    row.dataset.invId = it.id;
    row.innerHTML = `
      <span class="inv-emoji">${it.emoji}</span>
      <span class="inv-meta">
        <span class="inv-name">${it.name}</span>
        <span class="inv-desc">${equipped ? "EQUIPPED · click to store / put away" : "Yours forever · click to equip"}</span>
      </span>
      <span class="inv-key">${equipped ? "OFF" : it.key}</span>
    `;
    row.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (it.id === "hatPower") {
        applyHatPower(!state.hatPowerOn);
      } else if (it.id === "waterDinosaur") {
        if (state.waterDinoPet) {
          removeWaterDinosaur();
          toast("Water dinosaur resting (still yours forever)", "quest");
        } else {
          ensureWaterDinosaur();
          toast("Water dinosaur out!", "reward");
        }
      } else if (state.activeSword === it.id) {
        unequipSword();
      } else {
        equipSword(it.id);
      }
      renderInventory();
    });
    grid.appendChild(row);
  }
  const emptyHint = $("inv-empty-hint");
  if (emptyHint) {
    emptyHint.classList.toggle("hidden", any);
  }
  const badge = $("inv-count-badge");
  if (badge) {
    const n = catalog.filter((it) => hasInvItem(it.id)).length;
    badge.textContent = String(n);
  }
}

/** Shoot the Nifty Fidget Power — powerful, addicting RWB energy */
function shootNiftyPower() {
  if (!state.activeSword || !canUseFidget(state.activeSword)) return false;
  if (state.fireCooldown > 0) return true;
  if (state.inVehicle || player.sleeping) return true;

  // If power ball is ready, launch it instead
  if (state.niftyPowerBall && state.niftyPowerBall.phase === "ready") {
    launchNiftyPowerBall();
    state.fireCooldown = 0.25;
    return true;
  }

  const kind = state.activeSword;
  state.fireCooldown = kind === "nifty" ? 0.11 : 0.16;
  state.niftyLastShot = state.elapsed;
  state.niftyShootStreak = (state.niftyShootStreak || 0) + 1;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.normalize();
  const origin = camera.position.clone().add(dir.clone().multiplyScalar(0.8));
  origin.y -= 0.15;

  if (kind === "nifty") {
    const cols = [0xef4444, 0xffffff, 0x3b82f6];
    const col = cols[state.niftyShootStreak % 3];
    const bolt = new THREE.Mesh(
      new THREE.SphereGeometry(0.12 + Math.min(0.08, state.niftyShootStreak * 0.008), 10, 8),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95 })
    );
    bolt.position.copy(origin);
    scene.add(bolt);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.025, 6, 14),
      new THREE.MeshBasicMaterial({ color: cols[(state.niftyShootStreak + 1) % 3], transparent: true, opacity: 0.7 })
    );
    ring.position.copy(origin);
    ring.lookAt(origin.clone().add(dir));
    scene.add(ring);

    const speed = 48 + Math.min(22, state.niftyShootStreak * 1.5);
    const dmg = 22 + Math.min(40, state.niftyShootStreak * 2.2);
    if (!state.niftyProjectiles) state.niftyProjectiles = [];
    state.niftyProjectiles.push({
      mesh: bolt,
      ring,
      vel: dir.clone().multiplyScalar(speed),
      life: 1.6,
      dmg,
      kind: "bolt",
    });

    playTone(520 + (state.niftyShootStreak % 5) * 40, 0.06, "square", 0.07);
    playTone(220, 0.04, "sawtooth", 0.04);
    spawnHitSparks(origin, 4, col);
    if (state.niftyShootStreak % 3 === 0) {
      toast(`POWER x${state.niftyShootStreak}!`, "kill");
    }
    if (state.niftyShootStreak >= 6 && !state.niftyPowerBall) {
      state._niftyReadyBall = true;
    }
  } else {
    // Venom = toxic blobs · Water Dino = water bite shots
    const isVenom = kind === "venom";
    const col = isVenom ? 0xa3e635 : 0x22d3ee;
    const col2 = isVenom ? 0x6b21a8 : 0x0ea5e9;
    let proj;
    if (isVenom) {
      // Venom spit blob
      proj = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 8),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.92 })
      );
      const drip = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.18, 6),
        new THREE.MeshBasicMaterial({ color: col2, transparent: true, opacity: 0.85 })
      );
      drip.rotation.x = Math.PI;
      drip.position.y = -0.12;
      proj.add(drip);
    } else {
      // Water Dino aqua slash / wave bite
      proj = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.1, 0.16),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9 })
      );
      const fin = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.2, 5),
        new THREE.MeshBasicMaterial({ color: col2, transparent: true, opacity: 0.85 })
      );
      fin.position.y = 0.12;
      proj.add(fin);
    }
    proj.position.copy(origin);
    proj.lookAt(origin.clone().add(dir));
    scene.add(proj);
    if (!state.niftyProjectiles) state.niftyProjectiles = [];
    state.niftyProjectiles.push({
      mesh: proj,
      ring: null,
      vel: dir.clone().multiplyScalar(isVenom ? 38 : 42),
      life: isVenom ? 1.25 : 1.15,
      dmg: isVenom ? 30 : 34,
      kind: isVenom ? "venom" : "waterdino",
    });
    playTone(isVenom ? 220 : 520, 0.06, isVenom ? "sawtooth" : "sine", 0.07);
    spawnHitSparks(origin, 4, col);
  }

  addCombo();
  addXP(1);
  return true;
}

/** When you stop shooting, energy condenses into a POWER BALL */
function tryFormNiftyPowerBall() {
  if (!state._niftyReadyBall && (state.niftyShootStreak || 0) < 5) return;
  if (state.niftyPowerBall) return;
  if (state.activeSword !== "nifty") return;
  state._niftyReadyBall = false;
  const streak = state.niftyShootStreak || 5;
  state.niftyShootStreak = 0;

  const ball = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  ball.add(core);
  const shellR = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.45, wireframe: true })
  );
  ball.add(shellR);
  const shellB = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.35, wireframe: true })
  );
  ball.add(shellB);
  const orbs = [];
  for (let i = 0; i < 6; i++) {
    const c = [0xef4444, 0xffffff, 0x3b82f6][i % 3];
    const o = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshBasicMaterial({ color: c })
    );
    ball.add(o);
    orbs.push({ mesh: o, a: (i / 6) * Math.PI * 2 });
  }
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const pos = camera.position.clone().add(dir.clone().multiplyScalar(1.4));
  pos.y -= 0.1;
  ball.position.copy(pos);
  scene.add(ball);

  state.niftyPowerBall = {
    mesh: ball,
    core,
    shellR,
    shellB,
    orbs,
    life: 8,
    phase: "ready",
    power: 55 + Math.min(80, streak * 6),
    vel: new THREE.Vector3(),
    t: 0,
  };
  playTone(180, 0.2, "sine", 0.1);
  playTone(540, 0.15, "square", 0.06);
  toast("POWER BALL ready! Click again to LAUNCH it!", "reward");
  playerSay("Power ball!");
}

function launchNiftyPowerBall() {
  const pb = state.niftyPowerBall;
  if (!pb || pb.phase !== "ready") return false;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  pb.phase = "flying";
  pb.vel.copy(dir.multiplyScalar(36));
  pb.life = 3.5;
  playTone(120, 0.25, "sawtooth", 0.1);
  toast("POWER BALL LAUNCHED!", "kill");
  return true;
}

function updateNiftyPower(dt) {
  const stand = state.niftyStand;
  if (stand && stand.displays) {
    for (const d of stand.displays) {
      if (d.sword?.userData?.tornado) {
        animateBabyTornado(d.sword.userData.tornado, dt, state.elapsed);
      }
      if (d.sword) d.sword.rotation.y = Math.sin(state.elapsed * 0.8 + (d.kind === "nifty" ? 0 : 1)) * 0.15;
    }
    if (stand.hatDisp) {
      stand.hatDisp.rotation.y += dt * 0.7;
      if (stand.hatDisp.userData?.star) {
        stand.hatDisp.userData.star.rotation.y += dt * 2;
      }
    }
  }

  if (state._heldSword?.userData?.tornado) {
    animateBabyTornado(state._heldSword.userData.tornado, dt, state.elapsed);
  }
  if (state._heldSword?.userData?.tornado2) {
    animateBabyTornado(state._heldSword.userData.tornado2, dt, state.elapsed + 1);
  }
  if (state._fpsSword?.userData?.tornado) {
    animateBabyTornado(state._fpsSword.userData.tornado, dt, state.elapsed);
  }
  if (state._fpsSword?.userData?.tornado2) {
    animateBabyTornado(state._fpsSword.userData.tornado2, dt, state.elapsed + 1);
  }
  updateWaterDinosaur(dt);
  updateRonsAnimal(dt);
  // Projectile grow FX (dino roar rings)
  if (state.niftyProjectiles) {
    for (const p of state.niftyProjectiles) {
      if (p.grow && p.mesh) p.mesh.scale.multiplyScalar(1 + dt * 4);
    }
  }
  if (state._hatPowerMesh?.userData?.glow) {
    const g = state._hatPowerMesh.userData.glow;
    g.material.opacity = 0.4 + Math.sin(state.elapsed * 6) * 0.2;
    g.rotation.z += dt * 1.5;
  }
  if (state._hatPowerMesh?.userData?.star) {
    state._hatPowerMesh.userData.star.rotation.y += dt * 3;
  }

  // When done shooting → power ball forms
  if (
    state.activeSword === "nifty" &&
    state.niftyShootStreak > 0 &&
    state.elapsed - (state.niftyLastShot || 0) > 0.45
  ) {
    if (state.niftyShootStreak >= 5 || state._niftyReadyBall) {
      tryFormNiftyPowerBall();
    } else {
      state.niftyShootStreak = 0;
    }
  }

  if (!state.niftyProjectiles) state.niftyProjectiles = [];
  for (let i = state.niftyProjectiles.length - 1; i >= 0; i--) {
    const p = state.niftyProjectiles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.ring) {
      p.ring.position.copy(p.mesh.position);
      p.ring.rotation.z += dt * 12;
    }
    let hit = false;
    for (const e of enemies) {
      if (!e.alive) continue;
      const ep = e.group.position;
      if (p.mesh.position.distanceTo(ep) < 1.6) {
        damageEnemy(e, p.dmg);
        spawnHitSparks(ep.clone().add(new THREE.Vector3(0, 1, 0)), 8, 0xffffff);
        hit = true;
        break;
      }
    }
    if (hit || p.life <= 0) {
      scene.remove(p.mesh);
      if (p.ring) scene.remove(p.ring);
      state.niftyProjectiles.splice(i, 1);
    }
  }

  const pb = state.niftyPowerBall;
  if (pb && pb.mesh) {
    pb.t += dt;
    pb.life -= dt;
    for (const o of pb.orbs || []) {
      o.a += dt * 5;
      o.mesh.position.set(Math.cos(o.a) * 0.45, Math.sin(o.a * 1.3) * 0.2, Math.sin(o.a) * 0.45);
    }
    pb.shellR.rotation.y += dt * 2;
    pb.shellB.rotation.x += dt * 1.5;
    const pulse = 1 + Math.sin(pb.t * 8) * 0.08;
    pb.core.scale.setScalar(pulse);

    if (pb.phase === "ready") {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const target = camera.position.clone().add(dir.multiplyScalar(1.5));
      target.y -= 0.05;
      pb.mesh.position.lerp(target, Math.min(1, dt * 8));
    } else if (pb.phase === "flying") {
      pb.mesh.position.addScaledVector(pb.vel, dt);
      for (const e of enemies) {
        if (!e.alive) continue;
        if (pb.mesh.position.distanceTo(e.group.position) < 2.8) {
          damageEnemy(e, pb.power);
          spawnHitSparks(e.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 14, 0x3b82f6);
          for (const e2 of enemies) {
            if (!e2.alive || e2 === e) continue;
            if (e2.group.position.distanceTo(pb.mesh.position) < 5) {
              damageEnemy(e2, pb.power * 0.45);
            }
          }
          pb.life = 0;
          break;
        }
      }
    }
    if (pb.life <= 0) {
      spawnHitSparks(pb.mesh.position.clone(), 16, 0xffffff);
      scene.remove(pb.mesh);
      state.niftyPowerBall = null;
      toast("Power ball burst!", "kill");
    }
  }

  if (state.activeSword) {
    const thirdPerson = !state.inVehicle && player.camDist > 1.15;
    weaponGroup.visible = !thirdPerson && !state.inVehicle;
    if (state._heldSword) state._heldSword.visible = true;
  }
}

/** Floating name label above Michael's head */

// ═══════════════════════════════════════════════════════════
// LEADERBOARD + LUCAS (top of Snow Dome · 3.6M wins)
// ═══════════════════════════════════════════════════════════
const LEADERBOARD = [
  { name: "Lucas", wins: 3600000, note: "Talk to him on Snow Dome ⛰" },
  { name: "Ron", wins: 0, note: "You" },
  { name: "Michael", wins: 128400, note: "Workshop champ" },
  { name: "Pirate Captain", wins: 88200, note: "Coast raids" },
  { name: "Woody", wins: 45100, note: "Beach treasure" },
];

function formatWins(n) {
  if (n >= 1e6) {
    const m = n / 1e6;
    return (Math.abs(m - Math.round(m * 10) / 10) < 1e-9
      ? m.toFixed(1).replace(/\.0$/, "")
      : m.toFixed(1)) + "M";
  }
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "K";
  return String(n);
}

function renderLeaderboard() {
  const host = $("lb-list");
  if (!host) return;
  // Keep Ron's row updated with local progress if any
  const rows = LEADERBOARD.map((r) => ({ ...r }));
  const ron = rows.find((r) => r.name === "Ron");
  if (ron) {
    ron.wins = Math.max(ron.wins, state.racesWon || 0, state.kills || 0);
    ron.note = "You";
  }
  rows.sort((a, b) => b.wins - a.wins);
  host.innerHTML = "";
  rows.forEach((r, i) => {
    const row = document.createElement("div");
    row.className = "lb-row" + (i === 0 ? " top" : "");
    row.innerHTML =
      `<div class="lb-rank">#${i + 1}</div>` +
      `<div class="lb-name">${r.name}<small>${r.note || ""}</small></div>` +
      `<div class="lb-wins">${formatWins(r.wins)} wins</div>`;
    host.appendChild(row);
  });
}

function openLeaderboard() {
  state.leaderboardOpen = true;
  state.paused = true;
  renderLeaderboard();
  $("leaderboard-panel")?.classList.remove("hidden");
  try { document.exitPointerLock(); } catch (_) {}
}

function closeLeaderboard() {
  if (!state.leaderboardOpen) return;
  state.leaderboardOpen = false;
  $("leaderboard-panel")?.classList.add("hidden");
  if (!state.settingsOpen && !state.calendarOpen && !state.inventoryOpen) {
    state.paused = false;
  }
}

function setupLeaderboardUI() {
  const btn = $("leaderboard-btn");
  const panel = $("leaderboard-panel");
  const close = $("leaderboard-close");
  const done = $("leaderboard-done");
  const open = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (state.leaderboardOpen) closeLeaderboard();
    else openLeaderboard();
  };
  btn?.addEventListener("click", open);
  btn?.addEventListener("mousedown", (e) => e.stopPropagation());
  close?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeLeaderboard();
  });
  done?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeLeaderboard();
  });
  panel?.addEventListener("click", (e) => {
    if (e.target === panel) closeLeaderboard();
  });
}

/** Lucas NPC — stands all the way up on Snow Dome peak */
function spawnLucasOnPeak() {
  // Highest peak in the list
  const pk = MOUNTAIN_PEAKS.find((p) => p.name === "SNOW DOME") || MOUNTAIN_PEAKS[MOUNTAIN_PEAKS.length - 1];
  const x = pk.x;
  const z = pk.z;
  const y = (typeof peakSurfaceY === "function" && peakSurfaceY(x, z)) || groundY(x, z) + (pk.h || 40);

  const root = new THREE.Group();
  root.position.set(x, y, z);
  root.name = "lucas";

  // Simple person — gold jacket champ look
  const matSkin = new THREE.MeshLambertMaterial({ color: 0xf0c4a0, flatShading: false });
  const matHair = new THREE.MeshLambertMaterial({ color: 0x3b2a1a, flatShading: false });
  const matShirt = new THREE.MeshLambertMaterial({ color: 0xfbbf24, flatShading: false });
  const matPants = new THREE.MeshLambertMaterial({ color: 0x1e293b, flatShading: false });
  const matShoe = new THREE.MeshLambertMaterial({ color: 0x111111, flatShading: false });
  const matGold = new THREE.MeshLambertMaterial({ color: 0xf59e0b, flatShading: false });

  function box(w, h, d, px, py, pz, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(px, py, pz);
    root.add(m);
    return m;
  }

  // Body
  box(0.42, 0.55, 0.28, 0, 1.15, 0, matShirt);
  box(0.38, 0.12, 0.3, 0, 0.88, 0, matGold); // belt
  // Legs
  box(0.16, 0.45, 0.18, -0.12, 0.45, 0, matPants);
  box(0.16, 0.45, 0.18, 0.12, 0.45, 0, matPants);
  box(0.17, 0.1, 0.24, -0.12, 0.12, 0.02, matShoe);
  box(0.17, 0.1, 0.24, 0.12, 0.12, 0.02, matShoe);
  // Arms
  box(0.14, 0.42, 0.14, -0.32, 1.15, 0, matSkin);
  box(0.14, 0.42, 0.14, 0.32, 1.15, 0, matSkin);
  // Head
  box(0.34, 0.36, 0.32, 0, 1.62, 0, matSkin);
  box(0.36, 0.12, 0.34, 0, 1.82, 0.02, matHair);
  // Crown / champ badge
  box(0.28, 0.1, 0.28, 0, 1.95, 0, matGold);
  box(0.08, 0.12, 0.08, 0, 2.05, 0, matGold);
  // Eyes
  box(0.06, 0.06, 0.04, -0.08, 1.66, -0.16, new THREE.MeshBasicMaterial({ color: 0x111111 }));
  box(0.06, 0.06, 0.04, 0.08, 1.66, -0.16, new THREE.MeshBasicMaterial({ color: 0x111111 }));
  // Smile
  box(0.12, 0.03, 0.03, 0, 1.54, -0.16, new THREE.MeshBasicMaterial({ color: 0x7f1d1d }));

  // Platform so he stands cleanly on peak
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.8, 0.25, 12),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.55, metalness: 0.35, flatShading: false })
  );
  pad.position.y = 0.05;
  root.add(pad);
  addCollider(x, y + 0.05, z, 3.2, 0.35, 3.2);

  const nameLab = makeNameLabel("LUCAS");
  nameLab.position.set(0, 2.45, 0);
  nameLab.scale.set(2.4, 0.45, 1);
  root.add(nameLab);

  const winsLab = makeNameLabel("3.6M WINS · #1");
  winsLab.position.set(0, 2.95, 0);
  winsLab.scale.set(3.0, 0.5, 1);
  root.add(winsLab);

  const talkLab = makeNameLabel("TALK · E");
  talkLab.position.set(0, 3.35, 0);
  talkLab.scale.set(2.2, 0.4, 1);
  root.add(talkLab);

  scene.add(root);
  // Don't freezeMesh root — Lucas turns to face you when talking

  state.lucas = {
    root,
    x,
    z,
    y,
    name: "Lucas",
    wins: 3600000,
    phase: 0,
  };
  console.log("%c[NEXUS] Lucas on Snow Dome — 3.6M wins", "color:#fbbf24;font-weight:bold");
  return state.lucas;
}

function nearestLucas(maxDist = 5.5) {
  const L = state.lucas;
  if (!L) return null;
  const d = Math.hypot(player.pos.x - L.x, player.pos.z - L.z);
  const nearY = Math.abs(player.pos.y - L.y) < 6;
  return d <= maxDist && nearY ? L : null;
}

function talkToLucas() {
  const L = nearestLucas(6.5) || state.lucas;
  if (!L) {
    toast("Lucas is all the way up on Snow Dome ⛰", "quest");
    return;
  }
  const wins = formatWins(L.wins || 3600000);
  toast(`👑 Lucas: "I'm #1 with ${wins} wins. Keep grinding!"`, "reward");
  playerSay?.(`Lucas has ${wins} wins!`);
  // Open leaderboard so you see him on top
  openLeaderboard();
  // Highlight toast after open
  setTimeout(() => {
    toast(`🏆 Leaderboard · Lucas — ${wins} wins`, "quest");
  }, 400);
}

function updateLucas(dt) {
  const L = state.lucas;
  if (!L || !L.root) return;
  L.phase = (L.phase || 0) + dt;
  // Idle bob / look around
  L.root.rotation.y = Math.sin(L.phase * 0.5) * 0.35;
  L.root.position.y = L.y + Math.sin(L.phase * 1.8) * 0.03;
  // Face player when nearby
  if (state.nearLucas) {
    const dx = player.pos.x - L.x;
    const dz = player.pos.z - L.z;
    L.root.rotation.y = Math.atan2(dx, dz);
  }
}


function makeNameLabel(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 512, 96);
  ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
  roundRect(ctx, 24, 12, 464, 72, 18);
  ctx.fill();
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 4;
  roundRect(ctx, 24, 12, 464, 72, 18);
  ctx.stroke();
  ctx.fillStyle = "#fef08a";
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.8, 0.55, 1);
  return sprite;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Michael's garage on the mountain — door opens when you approach.
 * Michael mixes red + green Jell-O inside; unbuilt Iron Man rocket lays inside.
 */
function spawnMichaelGarage(x, z, baseY = null) {
  // baseY = leveled pad height when sitting next to airport (or null = terrain)
  const gy = baseY != null ? baseY : Math.max(0, groundY(x, z));
  const garage = new THREE.Group();
  garage.position.set(x, gy, z);
  scene.add(garage);

  const matWall = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.75, metalness: 0.25, flatShading: false });
  const matWallDark = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.7, metalness: 0.3, flatShading: false });
  const matRoof = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.65, metalness: 0.45, flatShading: false });
  const matFloor = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.85, metalness: 0.15, flatShading: false });
  const matDoor = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.55, metalness: 0.5, flatShading: false });
  const matTrim = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.4, metalness: 0.65, emissive: 0xb45309, emissiveIntensity: 0.15, flatShading: false });
  const matSign = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5, metalness: 0.35, emissive: 0x7f1d1d, emissiveIntensity: 0.2, flatShading: false });

  const W = 12;
  const D = 14;
  const H = 5.5;

  // Floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.25, D), matFloor);
  floor.position.set(0, 0.12, 0);
  garage.add(floor);

  // Walls (open front at -Z) — side walls leave CLEAR window openings
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.35), matWall);
  back.position.set(0, H / 2, D / 2 - 0.15);
  // Window layout along Z
  const winZs = [-2.5, 1.5, 4.5];
  const winH = 1.45; // glass height
  const winW = 1.25; // glass depth span
  const winY = 2.75; // center Y
  const winBottom = winY - winH / 2;
  const winTop = winY + winH / 2;

  function buildSideWall(sx) {
    const wallG = new THREE.Group();
    const thick = 0.32;
    const x = sx * (W / 2 - thick / 2);
    // Bottom band (floor → under windows)
    const bot = new THREE.Mesh(new THREE.BoxGeometry(thick, winBottom, D), matWallDark);
    bot.position.set(x, winBottom / 2, 0);
    // Top band (above windows → roof)
    const topH = H - winTop;
    const top = new THREE.Mesh(new THREE.BoxGeometry(thick, topH, D), matWallDark);
    top.position.set(x, winTop + topH / 2, 0);
    wallG.add(bot, top);
    // Vertical pillars between / beside windows (full mid-band height)
    const midH = winH;
    const zEdges = [-D / 2, ...winZs.flatMap((z) => [z - winW / 2, z + winW / 2]), D / 2];
    for (let i = 0; i < zEdges.length - 1; i++) {
      const z0 = zEdges[i];
      const z1 = zEdges[i + 1];
      const span = z1 - z0;
      // Skip pure window openings (odd pairs after first)
      const isWinGap = winZs.some((wz) => Math.abs((z0 + z1) / 2 - wz) < 0.05 && span < winW + 0.05);
      if (isWinGap || span < 0.08) continue;
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(thick, midH, span), matWallDark);
      pillar.position.set(x, winY, (z0 + z1) / 2);
      wallG.add(pillar);
    }
    garage.add(wallG);
  }
  buildSideWall(-1);
  buildSideWall(1);

  // Front wall pieces (door opening in middle)
  const frontL = new THREE.Mesh(new THREE.BoxGeometry(1.6, H, 0.3), matWall);
  frontL.position.set(-W / 2 + 0.8, H / 2, -D / 2 + 0.15);
  const frontR = new THREE.Mesh(new THREE.BoxGeometry(1.6, H, 0.3), matWall);
  frontR.position.set(W / 2 - 0.8, H / 2, -D / 2 + 0.15);
  const frontTop = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, 1.0, 0.3), matWall);
  frontTop.position.set(0, H - 0.5, -D / 2 + 0.15);
  garage.add(back, frontL, frontR, frontTop);

  // Roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.35, D + 0.6), matRoof);
  roof.position.set(0, H + 0.1, 0);
  garage.add(roof);

  // Sign
  const sign = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.9, 0.15), matSign);
  sign.position.set(0, H + 0.7, -D / 2 - 0.1);
  garage.add(sign);
  const signLabel = makeNameLabel("MICHAEL'S GARAGE");
  signLabel.position.set(0, H + 0.7, -D / 2 - 0.5);
  signLabel.scale.set(4.2, 0.7, 1);
  garage.add(signLabel);

  // Gold trim
  const trim = new THREE.Mesh(new THREE.BoxGeometry(W - 3.5, 0.15, 0.2), matTrim);
  trim.position.set(0, 0.4, -D / 2 + 0.25);
  garage.add(trim);

  // Concrete apron / ramp in front
  const matConcrete = new THREE.MeshLambertMaterial({ color: 0x9ca3af, flatShading: false });
  const matConcreteDark = new THREE.MeshLambertMaterial({ color: 0x6b7280, flatShading: false });
  const apron = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 0.18, 6), matConcrete);
  apron.position.set(0, 0.05, -D / 2 - 3);
  garage.add(apron);
  // Parking lines
  for (const lx of [-3, 0, 3]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 4.5), new THREE.MeshLambertMaterial({ color: 0xfbbf24 }));
    line.position.set(lx, 0.15, -D / 2 - 2.8);
    garage.add(line);
  }

  // CLEAR glass windows — see people inside Michael's house
  const matWinClear = new THREE.MeshStandardMaterial({
    color: 0xe8f4ff,
    transparent: true,
    opacity: 0.12,
    roughness: 0.05,
    metalness: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const sx of [-1, 1]) {
    for (const wz of winZs) {
      // Clear glass pane (see Michael & suits inside)
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, winH, winW),
        matWinClear
      );
      glass.position.set(sx * (W / 2 - 0.02), winY, wz);
      glass.renderOrder = 2;
      // Thin frame rim only (top/bottom/sides) — not a solid panel
      const fw = 0.08;
      const topF = new THREE.Mesh(new THREE.BoxGeometry(0.1, fw, winW + 0.12), matTrim);
      topF.position.set(sx * (W / 2 - 0.02), winY + winH / 2 + fw / 2, wz);
      const botF = new THREE.Mesh(new THREE.BoxGeometry(0.1, fw, winW + 0.12), matTrim);
      botF.position.set(sx * (W / 2 - 0.02), winY - winH / 2 - fw / 2, wz);
      const sideF1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, winH, fw), matTrim);
      sideF1.position.set(sx * (W / 2 - 0.02), winY, wz - winW / 2 - fw / 2);
      const sideF2 = sideF1.clone();
      sideF2.position.z = wz + winW / 2 + fw / 2;
      // Thin muntins
      const barH = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, winW * 0.92), matTrim);
      barH.position.set(sx * (W / 2 - 0.015), winY, wz);
      const barV = new THREE.Mesh(new THREE.BoxGeometry(0.04, winH * 0.92, 0.04), matTrim);
      barV.position.set(sx * (W / 2 - 0.015), winY, wz);
      garage.add(glass, topF, botF, sideF1, sideF2, barH, barV);
    }
  }

  // ── 4K CARTOON TV ROOM (inside Michael's house) ──
  const tvRoom = new THREE.Group();
  tvRoom.position.set(-2.2, 0, 4.2);
  // Theater platform
  const stage = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.2, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.2 })
  );
  stage.position.y = 0.25;
  // Couch for watching
  const couch = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.55, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.8 })
  );
  couch.position.set(0, 0.55, 1.0);
  const couchBack = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.7, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.8 })
  );
  couchBack.position.set(0, 0.95, 1.3);
  // Giant 4K screen
  const tvCanvas = document.createElement("canvas");
  tvCanvas.width = 1280;
  tvCanvas.height = 720;
  const tvTex = new THREE.CanvasTexture(tvCanvas);
  tvTex.colorSpace = THREE.SRGBColorSpace;
  tvTex.minFilter = THREE.LinearFilter;
  tvTex.magFilter = THREE.LinearFilter;
  const tvScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 2.48),
    new THREE.MeshBasicMaterial({ map: tvTex, toneMapped: false })
  );
  tvScreen.position.set(0, 2.15, -1.35);
  // TV bezel
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(4.7, 2.75, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.6 })
  );
  bezel.position.set(0, 2.15, -1.4);
  // LED strip under screen
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.06, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  led.position.set(0, 0.85, -1.3);
  // Label
  const tvLabel = makeNameLabel("MICHAEL 4K+ PRO TV");
  tvLabel.position.set(0, 3.7, -1.2);
  tvLabel.scale.set(2.8, 0.5, 1);
  // Speakers
  for (const sx of [-1, 1]) {
    const spk = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 1.2, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6, metalness: 0.3 })
    );
    spk.position.set(sx * 2.55, 1.4, -1.2);
    tvRoom.add(spk);
  }
  tvRoom.add(stage, couch, couchBack, bezel, tvScreen, led, tvLabel);
  garage.add(tvRoom);
  // Store for animation
  state.michaelTv = { canvas: tvCanvas, tex: tvTex, screen: tvScreen, t: 0, show: "spiderman" };

  // Roof vents + corrugated ridges
  for (let i = -4; i <= 4; i++) {
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, D + 0.4), matRoof);
    ridge.position.set(i * 1.2, H + 0.28, 0);
    garage.add(ridge);
  }
  for (const vx of [-3, 3]) {
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.5, 14), matWallDark);
    vent.position.set(vx, H + 0.55, 2);
    garage.add(vent);
  }

  // Overhead shop lights
  for (const lz of [-3, 0, 3]) {
    const lightBar = new THREE.Mesh(new THREE.BoxGeometry(4, 0.12, 0.35), matTrim);
    lightBar.position.set(0, H - 0.35, lz);
    const bulb = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.08, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xfef3c7 })
    );
    bulb.position.set(0, H - 0.45, lz);
    garage.add(lightBar, bulb);
  }

  // Tool wall pegboard
  const peg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 3.2), new THREE.MeshLambertMaterial({ color: 0xb45309 }));
  peg.position.set(-W / 2 + 0.4, 2.2, 0.5);
  garage.add(peg);
  // Tools hanging
  const matTool = new THREE.MeshLambertMaterial({ color: 0x64748b });
  const matToolRed = new THREE.MeshLambertMaterial({ color: 0xdc2626 });
  for (let i = 0; i < 5; i++) {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.08), new THREE.MeshLambertMaterial({ color: 0x78350f }));
    handle.position.set(-W / 2 + 0.55, 2.6 - i * 0.35, -0.6 + i * 0.5);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.18), i % 2 ? matToolRed : matTool);
    head.position.set(-W / 2 + 0.55, 2.85 - i * 0.35, -0.6 + i * 0.5);
    garage.add(handle, head);
  }
  // Wrench
  const wrench = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 6, 12, Math.PI), matTool);
  wrench.position.set(-W / 2 + 0.55, 1.5, 1.8);
  wrench.rotation.y = Math.PI / 2;
  garage.add(wrench);

  // Oil drum + crate
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 12), new THREE.MeshLambertMaterial({ color: 0x1d4ed8 }));
  drum.position.set(4.2, 0.7, 4.5);
  const drumRim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 6, 12), matTrim);
  drumRim.rotation.x = Math.PI / 2;
  drumRim.position.set(4.2, 1.2, 4.5);
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.9), new THREE.MeshLambertMaterial({ color: 0xa16207 }));
  crate.position.set(4.0, 0.55, 2.8);
  garage.add(drum, drumRim, crate);

  // Tire stack
  for (let i = 0; i < 3; i++) {
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.12, 8, 14), new THREE.MeshLambertMaterial({ color: 0x1c1917 }));
    tire.rotation.x = Math.PI / 2;
    tire.position.set(4.5, 0.35 + i * 0.28, 0.5);
    garage.add(tire);
  }

  // Ceiling beams
  for (const bz of [-4, -1, 2, 5]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(W - 0.8, 0.22, 0.28), matWallDark);
    beam.position.set(0, H - 0.15, bz);
    garage.add(beam);
  }

  // Corner pillars
  for (const [px, pz] of [[-W/2+0.4, -D/2+0.4], [W/2-0.4, -D/2+0.4], [-W/2+0.4, D/2-0.4], [W/2-0.4, D/2-0.4]]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.4, H, 0.4), matConcreteDark);
    pillar.position.set(px, H / 2, pz);
    garage.add(pillar);
  }

  // Garage door (rolls up = moves up + rotates slightly)
  const doorGroup = new THREE.Group();
  doorGroup.position.set(0, 0, -D / 2 + 0.2);
  const door = new THREE.Mesh(new THREE.BoxGeometry(8.6, H - 1.1, 0.18), matDoor);
  door.position.y = (H - 1.1) / 2;
  // Door panels
  for (let i = 0; i < 6; i++) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(7.0, 0.08, 0.05),
      matWallDark
    );
    panel.position.set(0, 0.55 + i * 0.7, -0.08);
    doorGroup.add(panel);
  }
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.12), matTrim);
  handle.position.set(0, 1.2, -0.15);
  doorGroup.add(door, handle);
  garage.add(doorGroup);

  // Workbench inside
  const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 1.2), new THREE.MeshLambertMaterial({ color: 0x78350f }));
  bench.position.set(-2.5, 0.55, 2.5);
  garage.add(bench);

  // Jell-O bowls (red + green) on bench — Michael mixes these
  const matJRed = new THREE.MeshLambertMaterial({ color: 0xef4444, transparent: true, opacity: 0.85 });
  const matJGreen = new THREE.MeshLambertMaterial({ color: 0x22c55e, transparent: true, opacity: 0.85 });
  const matBowl = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
  const bowlR = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.22, 10), matBowl);
  bowlR.position.set(-3.1, 1.1, 2.5);
  const jelloR = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.14, 10), matJRed);
  jelloR.position.set(-3.1, 1.22, 2.5);
  const bowlG = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.22, 10), matBowl);
  bowlG.position.set(-1.9, 1.1, 2.5);
  const jelloG = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.14, 10), matJGreen);
  jelloG.position.set(-1.9, 1.22, 2.5);
  // Mixing bowl in center
  const mixBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.25, 10), matBowl);
  mixBowl.position.set(-2.5, 1.12, 2.2);
  const jelloMix = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.22, 0.12, 10),
    new THREE.MeshLambertMaterial({ color: 0xa3e635, transparent: true, opacity: 0.8 })
  );
  jelloMix.position.set(-2.5, 1.25, 2.2);
  garage.add(bowlR, jelloR, bowlG, jelloG, mixBowl, jelloMix);
  // Display spaghetti bowl on bench (visual — buy with 1)
  const spagDisplay = createDetailedSpaghettiBowl();
  spagDisplay.position.set(-0.5, 1.15, 2.4);
  spagDisplay.scale.setScalar(0.9);
  garage.add(spagDisplay);
  const spagLabel = makeNameLabel("SPAGHETTI · 1");
  spagLabel.position.set(-0.5, 1.7, 2.4);
  spagLabel.scale.set(1.6, 0.35, 1);
  garage.add(spagLabel);

  // Workbench shelf + tools on top
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 0.45), new THREE.MeshLambertMaterial({ color: 0x57534e }));
  shelf.position.set(-2.5, 1.7, 2.7);
  garage.add(shelf);
  const matSteel = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
  // Screwdriver, hammer, pliers
  const sd = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 12), new THREE.MeshLambertMaterial({ color: 0xfbbf24 }));
  sd.rotation.z = Math.PI / 2;
  sd.position.set(-3.4, 1.2, 2.15);
  const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), matSteel);
  hammer.position.set(-2.0, 1.15, 2.0);
  const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.22), matSteel);
  hammerHead.position.set(-1.8, 1.18, 2.0);
  garage.add(shelf, sd, hammer, hammerHead);
  // Wall clock / poster
  const poster = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.06), new THREE.MeshLambertMaterial({ color: 0x1e3a5f }));
  poster.position.set(2.5, 3.2, D / 2 - 0.25);
  garage.add(poster);
  const posterStar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.08), matTrim);
  posterStar.position.set(2.5, 3.2, D / 2 - 0.3);
  garage.add(posterStar);

  // Iron Man rocket parked upright outside the garage door
  // Locked until BUY (green coins) or TRY (20 second free ride)
  const rocket = spawnIronManRocket(x, z - 8);
  rocket.price = MICHAEL_ROCKET_PRICE;
  rocket.locked = true;
  rocket.homeX = x;
  rocket.homeY = gy + 1.7;
  rocket.homeZ = z - 9;
  rocket.homeYaw = Math.PI;
  rocket.group.position.set(x, gy + 1.7, z - 9);
  rocket.group.rotation.set(-0.08, Math.PI, 0);
  rocket.group.scale.setScalar(1.15);
  rocket.yaw = Math.PI;

  // Michael standing at workbench mixing Jell-O
  const michael = buildMichaelCharacter();
  michael.root.position.set(-2.5, 0.25, 1.6);
  michael.root.rotation.y = Math.PI; // face workbench / door
  garage.add(michael.root);

  // Iron Man mask on table
  const maskDisplay = michael.maskOnTable;
  maskDisplay.position.set(-1.2, 1.35, 2.35);
  maskDisplay.rotation.set(0.15, 0.6, 0.1);
  maskDisplay.scale.setScalar(0.95);
  garage.add(maskDisplay);
  const maskStand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 0.08, 14),
    matTrim
  );
  maskStand.position.set(-1.2, 1.12, 2.35);
  garage.add(maskStand);

  // ── Iron Man COSTUMES on mannequins (display in Michael's home) ──
  function makeIronManSuit(colorMain, colorGold, label) {
    const g = new THREE.Group();
    const matR = new THREE.MeshStandardMaterial({
      color: colorMain, emissive: colorMain, emissiveIntensity: 0.22,
      roughness: 0.35, metalness: 0.75, flatShading: false,
    });
    const matG = new THREE.MeshStandardMaterial({
      color: colorGold, emissive: colorGold, emissiveIntensity: 0.35,
      roughness: 0.3, metalness: 0.85, flatShading: false,
    });
    const matBlk = new THREE.MeshStandardMaterial({
      color: 0x111111, roughness: 0.6, metalness: 0.4, flatShading: false,
    });
    const matSilver = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1, roughness: 0.25, metalness: 0.9, flatShading: false,
    });
    // Mannequin stand / podium
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.14, 12), matTrim);
    stand.position.y = 0.07;
    const standRing = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 6, 16), matSilver);
    standRing.rotation.x = Math.PI / 2;
    standRing.position.y = 0.15;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 12), matBlk);
    pole.position.y = 0.32;
    // Boots with thruster glow
    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.3), matR);
    bootL.position.set(-0.15, 0.38, 0);
    const bootR = bootL.clone();
    bootR.position.x = 0.15;
    const thrL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 0.06, 14),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc })
    );
    thrL.position.set(-0.15, 0.16, 0);
    const thrR = thrL.clone();
    thrR.position.x = 0.15;
    // Legs + armor plates
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.55, 0.26), matR);
    legL.position.set(-0.15, 0.78, 0);
    const legR = legL.clone();
    legR.position.x = 0.15;
    const thighPlateL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.1), matG);
    thighPlateL.position.set(-0.15, 0.9, -0.12);
    const thighPlateR = thighPlateL.clone();
    thighPlateR.position.x = 0.15;
    // Knee gold
    const kneeL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.28), matG);
    kneeL.position.set(-0.15, 0.55, 0);
    const kneeR = kneeL.clone();
    kneeR.position.x = 0.15;
    // Hip belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.32), matG);
    belt.position.set(0, 1.0, 0);
    // Torso armor layers
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.38), matR);
    torso.position.y = 1.35;
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.38, 0.18), matG);
    chest.position.set(0, 1.45, -0.14);
    const abs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.12), matG);
    abs.position.set(0, 1.12, -0.16);
    // Arc reactor (glowing)
    const arc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.07, 14),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc })
    );
    arc.rotation.x = Math.PI / 2;
    arc.position.set(0, 1.4, -0.22);
    const arcRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.015, 6, 14),
      new THREE.MeshBasicMaterial({ color: 0xe0f2fe })
    );
    arcRing.position.set(0, 1.4, -0.22);
    // Shoulders
    const shL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.3), matG);
    shL.position.set(-0.4, 1.62, 0);
    const shR = shL.clone();
    shR.position.x = 0.4;
    // Arms + gauntlets + repulsors
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.2), matR);
    armL.position.set(-0.42, 1.2, 0);
    const armR = armL.clone();
    armR.position.x = 0.42;
    const gauntL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.22), matG);
    gauntL.position.set(-0.42, 0.9, 0);
    const gauntR = gauntL.clone();
    gauntR.position.x = 0.42;
    const repL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.04, 14),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    repL.rotation.x = Math.PI / 2;
    repL.position.set(-0.42, 0.82, -0.12);
    const repR = repL.clone();
    repR.position.x = 0.42;
    // Helmet with faceplate
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.36), matR);
    helm.position.y = 1.9;
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.08), matG);
    face.position.set(0, 1.88, -0.2);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.08), matG);
    jaw.position.set(0, 1.72, -0.18);
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.045, 0.04), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    eyeL.position.set(-0.08, 1.92, -0.24);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.08;
    // Back thruster pack
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.18), matBlk);
    pack.position.set(0, 1.4, 0.22);
    const packJet = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.2, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    packJet.position.set(0, 1.25, 0.28);
    g.add(
      stand, standRing, pole, bootL, bootR, thrL, thrR, legL, legR,
      thighPlateL, thighPlateR, kneeL, kneeR, belt,
      torso, chest, abs, arc, arcRing, shL, shR, armL, armR,
      gauntL, gauntR, repL, repR, helm, face, jaw, eyeL, eyeR, pack, packJet
    );
    const lab = makeNameLabel(label);
    lab.position.set(0, 2.45, 0);
    lab.scale.set(1.5, 0.38, 1);
    g.add(lab);
    return g;
  }
  // Three suits on display rack — buy with unique purple gems
  const suitRed = makeIronManSuit(0xb91c1c, 0xfbbf24, `MARK 3 · ${MICHAEL_SUIT_MARK3_PRICE}💜`);
  suitRed.position.set(3.2, 0.2, -2.5);
  suitRed.rotation.y = -0.4;
  const suitGold = makeIronManSuit(0xfbbf24, 0xfde68a, `GOLD · ${MICHAEL_SUIT_GOLD_PRICE}💜`);
  suitGold.position.set(3.2, 0.2, 0.5);
  suitGold.rotation.y = -0.2;
  const suitWar = makeIronManSuit(0x9f1239, 0x64748b, `WAR · ${MICHAEL_SUIT_WAR_PRICE}💜`);
  suitWar.position.set(3.2, 0.2, 3.5);
  suitWar.rotation.y = 0.15;
  // Expensive green dinosaur costume display
  const suitDino = makeDinoCostumeDisplay(`DINO · ${MICHAEL_SUIT_DINO_PRICE}💜`);
  suitDino.position.set(-3.5, 0.2, -3.5);
  suitDino.rotation.y = 0.5;
  garage.add(suitRed, suitGold, suitWar, suitDino);
  // Price pedestals under suits
  for (const [pz, price] of [
    [-2.5, MICHAEL_SUIT_MARK3_PRICE],
    [0.5, MICHAEL_SUIT_GOLD_PRICE],
    [3.5, MICHAEL_SUIT_WAR_PRICE],
  ]) {
    const gemIcon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.12, 0),
      new THREE.MeshStandardMaterial({
        color: 0xa855f7, emissive: 0x7c3aed, emissiveIntensity: 0.7, roughness: 0.25, metalness: 0.4,
      })
    );
    gemIcon.position.set(3.2, 0.35, pz);
    garage.add(gemIcon);
  }
  // Display platform
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.15, 7.5),
    new THREE.MeshLambertMaterial({ color: 0x1f2937, flatShading: false })
  );
  platform.position.set(3.2, 0.12, 0.5);
  garage.add(platform);
  // Glass case frames
  for (const z of [-2.5, 0.5, 3.5]) {
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 2.4, 0.08),
      new THREE.MeshLambertMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.35 })
    );
    frame.position.set(3.2, 1.3, z - 0.55);
    garage.add(frame);
  }

  const entry = {
    garage,
    doorGroup,
    doorOpen: 0, // 0 closed … 1 open
    doorTarget: 0,
    michael,
    rocket,
    jelloR,
    jelloG,
    jelloMix,
    mixBowl,
    maskDisplay,
    hasMask: true,
    suits: {
      mark3: { mesh: suitRed, sold: false, price: MICHAEL_SUIT_MARK3_PRICE, name: "Mark 3", key: "mark3" },
      gold: { mesh: suitGold, sold: false, price: MICHAEL_SUIT_GOLD_PRICE, name: "Gold", key: "gold" },
      warmachine: { mesh: suitWar, sold: false, price: MICHAEL_SUIT_WAR_PRICE, name: "War Machine", key: "warmachine" },
      dino: { mesh: suitDino, sold: false, price: MICHAEL_SUIT_DINO_PRICE, name: "Green Dinosaur", key: "dino" },
    },
    phase: 0,
    gx: x,
    gz: z,
    gy,
    name: "Michael Builder",
  };
  // alias fields for update anim
  entry.root = michael.root;
  entry.armL = michael.armL;
  entry.armR = michael.armR;
  entry.eyeL = michael.eyeL;
  entry.eyeR = michael.eyeR;
  entry.spoon = michael.spoon;
  entry.nameLabel = michael.nameLabel;

  // Solid walls — can't walk through garage
  addCollider(x, gy + H / 2, z + D / 2 - 0.15, W, H, 0.55);
  addCollider(x - W / 2 + 0.15, gy + H / 2, z, 0.55, H, D);
  addCollider(x + W / 2 + 0.0, gy + H / 2, z, 0.55, H, D);
  // Front wall pieces (leave doorway open in middle ~8.6 wide)
  addCollider(x - W / 2 + 0.8, gy + H / 2, z - D / 2 + 0.15, 1.8, H, 0.5);
  addCollider(x + W / 2 - 0.8, gy + H / 2, z - D / 2 + 0.15, 1.8, H, 0.5);
  addCollider(x, gy + H - 0.5, z - D / 2 + 0.15, W - 0.4, 1.2, 0.5);
  // Walkable roof
  addCollider(x, gy + H + 0.15, z, W + 0.8, 0.45, D + 0.8);
  // Floor platform + apron in front
  addCollider(x, gy + 0.15, z, W, 0.35, D);
  addCollider(x, gy + 0.12, z - D / 2 - 3, W + 2, 0.3, 6);
  // Suit display platform
  addCollider(x + 3.2, gy + 0.2, z + 0.5, 2.4, 0.25, 7.5);

  // ── Ladder ON the RIGHT WALL of Michael's house (local coords — never sky) ──
  // Garage group is already at (x, gy, z). Ladder sits on the exterior wall face.
  const wallFaceX = W / 2; // outer face of right wall (local)
  const ladderLocalX = wallFaceX + 0.22; // just outside wall, flush
  const ladderLocalZ = 0; // center of house side (not floating out front)
  const ladderX = x + ladderLocalX;
  const ladderZ = z + ladderLocalZ;
  const ladderBottom = gy + 0.02;
  const ladderTop = gy + H + 0.15;
  const ladderGroup = new THREE.Group();
  // Y=0 local = ground of house floor — rails grow UP the wall
  ladderGroup.position.set(ladderLocalX, 0, ladderLocalZ);
  const matRail = new THREE.MeshStandardMaterial({
    color: 0x64748b, roughness: 0.55, metalness: 0.45, flatShading: false,
  });
  const matRung = new THREE.MeshStandardMaterial({
    color: 0x94a3b8, roughness: 0.5, metalness: 0.4, flatShading: false,
  });
  const matGoldL = new THREE.MeshStandardMaterial({
    color: 0xfbbf24, roughness: 0.4, metalness: 0.5, flatShading: false,
  });
  const railH = H + 0.35;
  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.09, railH, 0.09), matRail);
  railL.position.set(-0.32, railH / 2, 0);
  const railR = railL.clone();
  railR.position.x = 0.32;
  ladderGroup.add(railL, railR);
  const rungCount = Math.floor(railH / 0.42);
  for (let i = 0; i < rungCount; i++) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.07, 0.09), matRung);
    rung.position.set(0, 0.28 + i * 0.42, 0.02);
    ladderGroup.add(rung);
  }
  // Gold mounts dig INTO the wall (negative X toward house interior)
  for (let i = 0; i < 4; i++) {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.2), matGoldL);
    mount.position.set(-0.38, 0.7 + i * 1.35, 0);
    ladderGroup.add(mount);
  }
  const ladderLabel = makeNameLabel("LADDER · K climb");
  ladderLabel.position.set(0, railH + 0.55, 0);
  ladderLabel.scale.set(1.8, 0.4, 1);
  ladderGroup.add(ladderLabel);
  garage.add(ladderGroup);

  state.ladder = {
    x: ladderX,
    z: ladderZ,
    bottomY: ladderBottom,
    topY: ladderTop,
    roofX: x + wallFaceX - 1.2,
    roofZ: ladderZ,
    roofY: gy + H + 0.45,
    grabRange: 2.6,
    name: "Michael ladder",
  };

  michaelBuilders.push(entry);
  state.ironManRocket = rocket;
  state.michaelGarage = entry;
  return entry;
}

function buildMichaelCharacter() {
  const root = new THREE.Group();
  // Dark red skin palette
  const matSkin = new THREE.MeshLambertMaterial({ color: 0x8b1a1a, flatShading: false });
  const matSkinDark = new THREE.MeshLambertMaterial({ color: 0x5c1010, flatShading: false });
  const matSkinMid = new THREE.MeshLambertMaterial({ color: 0xa32020, flatShading: false });
  const matSkinShadow = new THREE.MeshLambertMaterial({ color: 0x4a0c0c, flatShading: false });
  const matBlack = new THREE.MeshLambertMaterial({ color: 0x0a0a0a, flatShading: false });
  const matBlackSoft = new THREE.MeshLambertMaterial({ color: 0x1a1a1a, flatShading: false });
  const matBlackHi = new THREE.MeshLambertMaterial({ color: 0x2a2a2a, flatShading: false });
  const matWhite = new THREE.MeshLambertMaterial({ color: 0xf8fafc, flatShading: false });
  const matWhiteSoft = new THREE.MeshLambertMaterial({ color: 0xe2e8f0, flatShading: false });
  const matGold = new THREE.MeshLambertMaterial({
    color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.4, flatShading: false,
  });
  const matGoldDark = new THREE.MeshLambertMaterial({ color: 0xb45309, flatShading: false });
  const matGoldHi = new THREE.MeshLambertMaterial({ color: 0xfde68a, flatShading: false });
  const matPirate = new THREE.MeshLambertMaterial({ color: 0x1e3a5f, flatShading: false });
  const matPirateHi = new THREE.MeshLambertMaterial({ color: 0x2a4a7a, flatShading: false });
  const matPirateTrim = new THREE.MeshLambertMaterial({ color: 0xc9a227, flatShading: false });
  const matArc = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
  // Bacon hair: white + brown strips
  const matBaconW = new THREE.MeshLambertMaterial({ color: 0xf5f5f4, flatShading: false });
  const matBaconW2 = new THREE.MeshLambertMaterial({ color: 0xe7e5e4, flatShading: false });
  const matBaconB = new THREE.MeshLambertMaterial({ color: 0x78350f, flatShading: false });
  const matBaconB2 = new THREE.MeshLambertMaterial({ color: 0x92400e, flatShading: false });
  const matBaconB3 = new THREE.MeshLambertMaterial({ color: 0xa16207, flatShading: false });
  const matEyeWhite = new THREE.MeshLambertMaterial({ color: 0xfafafa, flatShading: false });
  const matPupil = new THREE.MeshBasicMaterial({ color: 0x0c0a09 });
  const matIris = new THREE.MeshBasicMaterial({ color: 0x44403c });
  const matLip = new THREE.MeshLambertMaterial({ color: 0x6b1414, flatShading: false });
  const matBrow = new THREE.MeshLambertMaterial({ color: 0x57534e, flatShading: false });

  // ── Detailed legs (taller) ──
  function makeLeg(sx) {
    const g = new THREE.Group();
    g.position.set(sx, 0, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.55, 0.28), matBlack);
    thigh.position.y = 0.75;
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.29), matBlackHi);
    seam.position.set(sx > 0 ? 0.1 : -0.1, 0.75, 0);
    const knee = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.28), matBlackSoft);
    knee.position.y = 0.45;
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.48, 0.25), matBlack);
    shin.position.y = 0.2;
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.08, 0.27), matBlackHi);
    cuff.position.y = 0.02;
    // White shoe detailed
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.42), matWhite);
    shoe.position.set(0, -0.05, 0.06);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.44), matWhiteSoft);
    sole.position.set(0, -0.12, 0.06);
    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.1), matWhite);
    toe.position.set(0, -0.04, -0.18);
    const lace1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.02), matBlack);
    lace1.position.set(0, 0.02, 0.0);
    const lace2 = lace1.clone();
    lace2.position.z = 0.06;
    g.add(thigh, seam, knee, shin, cuff, shoe, sole, toe, lace1, lace2);
    return g;
  }
  const legL = makeLeg(-0.2);
  const legR = makeLeg(0.2);

  // ── Detailed torso (taller) ──
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.95, 0.44), matBlackSoft);
  torso.position.y = 1.25;
  // Abs / panel lines
  for (let i = 0; i < 4; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.02), matBlackHi);
    line.position.set(0, 1.0 - i * 0.14, -0.22);
    root.add(line);
  }
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.55, 0.4), matPirate);
  shirt.position.set(0, 1.4, -0.02);
  // Shirt buttons
  for (let i = 0; i < 4; i++) {
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), matPirateTrim);
    btn.position.set(0, 1.55 - i * 0.12, -0.22);
    root.add(btn);
  }
  // Shirt folds
  for (const sx of [-0.2, 0.2]) {
    const fold = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.02), matPirateHi);
    fold.position.set(sx, 1.4, -0.2);
    root.add(fold);
  }
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.22), matPirate);
  collar.position.set(0, 1.72, -0.12);
  const collarTipL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.12), matPirateHi);
  collarTipL.position.set(-0.18, 1.7, -0.18);
  const collarTipR = collarTipL.clone();
  collarTipR.position.x = 0.18;
  const sash = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.42), matPirateTrim);
  sash.position.set(0, 0.88, 0);
  const sashKnot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.1), matGold);
  sashKnot.position.set(0.28, 0.88, -0.2);
  // Gold armor chest with segments
  const goldChest = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.52, 0.5), matGold);
  goldChest.position.set(0, 1.4, 0.04);
  for (let i = 0; i < 3; i++) {
    const gseg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.52), matGoldDark);
    gseg.position.set(0, 1.55 - i * 0.14, 0.05);
    root.add(gseg);
  }
  const arc = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), matArc);
  arc.rotation.x = Math.PI / 2;
  arc.position.set(0, 1.4, -0.24);
  const arcRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 6, 14), matGoldHi);
  arcRing.position.set(0, 1.4, -0.24);
  // Shoulder pads layered
  function shoulderPad(sx) {
    const g = new THREE.Group();
    g.position.set(sx * 0.48, 1.72, 0);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.36), matGold);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.3), matGoldHi);
    top.position.y = 0.12;
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.38), matGoldDark);
    rim.position.y = -0.1;
    g.add(base, top, rim);
    return g;
  }
  const padL = shoulderPad(-1);
  const padR = shoulderPad(1);

  // ── Detailed arms ──
  function makeArm(sx) {
    const g = new THREE.Group();
    g.position.set(sx * 0.55, 1.6, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.22), matBlack);
    upper.position.y = -0.2;
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.38, 0.23), matBlackHi);
    seam.position.set(sx * 0.08, -0.2, 0);
    const elbow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.24), matBlackSoft);
    elbow.position.y = -0.42;
    const gaunt = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.26), matGold);
    gaunt.position.y = -0.62;
    for (let i = 0; i < 3; i++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.28), matGoldDark);
      band.position.y = -0.5 - i * 0.1;
      g.add(band);
    }
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.18), matSkin);
    hand.position.y = -0.82;
    // Fingers
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.1, 0.04), matSkinMid);
      finger.position.set((f - 1.5) * 0.045, -0.95, -0.02);
      g.add(finger);
    }
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.04), matSkin);
    thumb.position.set(sx * 0.1, -0.88, 0.06);
    g.add(upper, seam, elbow, gaunt, hand, thumb);
    return g;
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);
  // Red jello scoop left
  const scoopL = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xef4444, transparent: true, opacity: 0.9 })
  );
  scoopL.position.set(0, -1.0, 0);
  armL.add(scoopL);
  // Spoon right
  const spoon = new THREE.Group();
  spoon.position.set(0, -0.95, 0);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.35, 12), matGoldDark);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshLambertMaterial({ color: 0x94a3b8 }));
  bowl.position.y = -0.2;
  bowl.scale.set(1, 0.5, 1.1);
  const drip = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 6, 5),
    new THREE.MeshLambertMaterial({ color: 0x22c55e, transparent: true, opacity: 0.9 })
  );
  drip.position.y = -0.22;
  spoon.add(handle, bowl, drip);
  armR.add(spoon);

  // ── UPSIDE-DOWN TRIANGLE HEAD (wide top, point chin) — dark red, detailed ──
  const headG = new THREE.Group();
  headG.position.y = 2.05;
  // Stack of tapering boxes = inverted triangle silhouette
  const layers = [
    [0.52, 0.12, 0.4, 0.2],   // forehead wide
    [0.48, 0.12, 0.38, 0.08],
    [0.42, 0.12, 0.36, 0.0],  // eyes
    [0.36, 0.1, 0.34, -0.1],
    [0.28, 0.1, 0.3, -0.2],   // mouth
    [0.18, 0.1, 0.24, -0.3],  // chin taper
    [0.1, 0.08, 0.16, -0.38], // chin point
  ];
  for (const [w, h, d, y] of layers) {
    const layer = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matSkin);
    layer.position.y = y;
    headG.add(layer);
  }
  // Cheek planes (triangle sides)
  for (const sx of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.28), matSkinDark);
    cheek.position.set(sx * 0.22, -0.05, 0.02);
    cheek.rotation.z = sx * 0.35;
    headG.add(cheek);
  }
  // Temple shadow
  for (const sx of [-1, 1]) {
    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.12), matSkinShadow);
    temple.position.set(sx * 0.22, 0.12, 0.1);
    headG.add(temple);
  }
  // Ears
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.1), matSkinDark);
    ear.position.set(sx * 0.28, 0.02, 0.05);
    headG.add(ear);
  }
  // Detailed eyes
  for (const sx of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.04), matSkinShadow);
    socket.position.set(sx * 0.11, 0.06, -0.2);
    const white = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.04), matEyeWhite);
    white.position.set(sx * 0.11, 0.06, -0.22);
    const iris = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.035), matIris);
    iris.position.set(sx * 0.11, 0.06, -0.24);
    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 0.03), matPupil);
    pupil.position.set(sx * 0.11, 0.06, -0.255);
    const shine = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.02), matEyeWhite);
    shine.position.set(sx * 0.12, 0.075, -0.26);
    headG.add(socket, white, iris, pupil, shine);
  }
  // Brows
  for (const sx of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.04), matBrow);
    brow.position.set(sx * 0.11, 0.14, -0.2);
    brow.rotation.z = sx * -0.1;
    headG.add(brow);
  }
  // Nose bridge + tip
  const noseBridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.08), matSkinDark);
  noseBridge.position.set(0, 0.0, -0.22);
  const noseTip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.1), matSkinMid);
  noseTip.position.set(0, -0.08, -0.26);
  const nostrilL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.03), matSkinShadow);
  nostrilL.position.set(-0.03, -0.1, -0.3);
  const nostrilR = nostrilL.clone();
  nostrilR.position.x = 0.03;
  headG.add(noseBridge, noseTip, nostrilL, nostrilR);
  // Mouth + lips
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.04), matLip);
  mouth.position.set(0, -0.2, -0.22);
  const lipLine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.015, 0.03), matSkinShadow);
  lipLine.position.set(0, -0.2, -0.24);
  headG.add(mouth, lipLine);
  // Chin point detail
  const chin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.1), matSkinDark);
  chin.position.set(0, -0.4, -0.05);
  headG.add(chin);
  // Neck
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.22), matSkinDark);
  neck.position.y = 1.78;

  // ── SHORT BACON HAIR (white + brown layered strips) ──
  const hairRoot = new THREE.Group();
  hairRoot.position.set(0, 2.28, 0);
  // Cap base
  const scalp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.42), matBaconW);
  scalp.position.set(0, 0.0, 0.02);
  hairRoot.add(scalp);
  // Bacon strips across top (short, layered, white/brown alternating)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 7; col++) {
      const isBrown = (row + col) % 2 === 0;
      const mat = isBrown
        ? (col % 3 === 0 ? matBaconB : matBaconB2)
        : (col % 2 === 0 ? matBaconW : matBaconW2);
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.06 + Math.random() * 0.04, 0.28 + row * 0.02),
        mat
      );
      strip.position.set(
        (col - 3) * 0.07,
        0.06 + row * 0.04,
        -0.02 + row * 0.02
      );
      strip.rotation.x = -0.15 + row * 0.05;
      strip.rotation.z = (col - 3) * 0.03;
      // Slight curl at tips
      strip.rotation.y = (col - 3) * 0.04;
      hairRoot.add(strip);
      // Speckle detail on brown strips
      if (isBrown && col % 2 === 0) {
        const speck = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 0.02, 0.08),
          matBaconB3
        );
        speck.position.copy(strip.position);
        speck.position.y += 0.03;
        hairRoot.add(speck);
      }
    }
  }
  // Front short bacon fringe
  for (let i = 0; i < 6; i++) {
    const mat = i % 2 === 0 ? matBaconW : matBaconB;
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.12), mat);
    fringe.position.set((i - 2.5) * 0.08, 0.02, -0.22);
    fringe.rotation.x = 0.5;
    hairRoot.add(fringe);
  }
  // Sideburns short
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const mat = i % 2 ? matBaconB : matBaconW2;
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.1), mat);
      side.position.set(sx * 0.26, -0.08 - i * 0.08, 0.0);
      hairRoot.add(side);
    }
  }
  // Back short bacon
  for (let i = 0; i < 5; i++) {
    const mat = i % 2 ? matBaconB2 : matBaconW;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.1), mat);
    back.position.set((i - 2) * 0.09, 0.0, 0.2);
    hairRoot.add(back);
  }

  // Mask on table object (still buyable)
  const maskOnTable = new THREE.Group();
  const matGoldM = new THREE.MeshLambertMaterial({
    color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.4, flatShading: false,
  });
  const matGoldDarkM = new THREE.MeshLambertMaterial({ color: 0xb45309, flatShading: false });
  const matEye = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const helm = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.48, 0.44), matGoldM);
  const faceplate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.08), matGoldDarkM);
  faceplate.position.set(0, -0.05, -0.22);
  const maskEyeL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.055, 0.04), matEye);
  maskEyeL.position.set(-0.09, 0.02, -0.26);
  const maskEyeR = maskEyeL.clone();
  maskEyeR.position.x = 0.09;
  const maskMouth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.03), matBlack);
  maskMouth.position.set(0, -0.14, -0.26);
  // Extra mask detail
  const maskCrest = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.1), matGoldHi);
  maskCrest.position.set(0, 0.28, 0);
  const maskCheekL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.12), matGoldDarkM);
  maskCheekL.position.set(-0.2, -0.05, -0.1);
  const maskCheekR = maskCheekL.clone();
  maskCheekR.position.x = 0.2;
  maskOnTable.add(helm, faceplate, maskEyeL, maskEyeR, maskMouth, maskCrest, maskCheekL, maskCheekR);

  const nameLabel = makeNameLabel("Michael Builder");
  nameLabel.position.set(0, 2.85, 0);

  // Eye refs for pulse anim
  const eyeL = headG.children.find(() => false);
  // store pupil meshes for pulse - use first iris-ish
  let eyeLref = null, eyeRref = null;
  headG.traverse((c) => {
    if (c.material === matPupil) {
      if (!eyeLref) eyeLref = c;
      else if (!eyeRref) eyeRref = c;
    }
  });

  root.add(
    legL, legR, torso, shirt, collar, collarTipL, collarTipR, sash, sashKnot,
    goldChest, arc, arcRing, padL, padR, armL, armR, headG, neck, hairRoot, nameLabel
  );
  // Taller overall
  root.scale.setScalar(1.28);

  return {
    root,
    armL,
    armR,
    spoon,
    scoopL,
    eyeL: eyeLref,
    eyeR: eyeRref,
    maskOnTable,
    helm: maskOnTable,
    nameLabel,
  };
}


function updateMichaelBuilders(dt) {
  for (const m of michaelBuilders) {
    m.phase += dt;

    // Garage door open/close when player near
    const dist = Math.hypot(player.pos.x - m.gx, player.pos.z - m.gz);
    m.doorTarget = dist < 22 ? 1 : 0;
    m.doorOpen += (m.doorTarget - m.doorOpen) * Math.min(1, 2.2 * dt);
    if (m.doorGroup) {
      // Roll door up
      m.doorGroup.position.y = m.doorOpen * 5.2; // fully clear doorway
      m.doorGroup.rotation.x = -m.doorOpen * 0.15;
    }

    // Mixing red + green Jell-O (arms stir when door open / always inside)
    if (m.armR) {
      m.armR.rotation.x = -0.9 + Math.sin(m.phase * 3.5) * 0.55;
      m.armR.rotation.z = 0.4 + Math.sin(m.phase * 2.2) * 0.2;
      m.armR.rotation.y = Math.sin(m.phase * 2.8) * 0.35;
    }
    if (m.armL) {
      m.armL.rotation.x = -0.7 + Math.sin(m.phase * 3.5 + 1.5) * 0.45;
      m.armL.rotation.z = -0.35;
      m.armL.rotation.y = Math.sin(m.phase * 2.5) * 0.25;
    }
    if (m.spoon) m.spoon.rotation.z = Math.sin(m.phase * 4) * 0.6;
    // Mix bowl wobble / color pulse
    if (m.jelloMix) {
      m.jelloMix.position.y = m.gy + 1.25 + Math.sin(m.phase * 4) * 0.02;
      const t = (Math.sin(m.phase * 2) + 1) * 0.5;
      m.jelloMix.material.color.setRGB(0.55 + t * 0.3, 0.75 - t * 0.2, 0.15);
    }
    if (m.jelloR) m.jelloR.scale.y = 1 + Math.sin(m.phase * 3) * 0.08;
    if (m.jelloG) m.jelloG.scale.y = 1 + Math.sin(m.phase * 3 + 1) * 0.08;

    if (m.eyeL) {
      const pulse = 0.75 + Math.sin(m.phase * 5) * 0.25;
      m.eyeL.scale.setScalar(pulse);
      if (m.eyeR) m.eyeR.scale.setScalar(pulse);
    }
  }
}

function nearestMichael(maxDist = 12) {
  let best = null;
  let bestD = Infinity;
  for (const m of michaelBuilders) {
    const d = Math.hypot(player.pos.x - m.gx, player.pos.z - m.gz);
    if (d < bestD && d < maxDist) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

/** Display mannequin for expensive green dinosaur costume */
function makeDinoCostumeDisplay(label) {
  const g = new THREE.Group();
  const matG = new THREE.MeshStandardMaterial({
    color: 0x22c55e, roughness: 0.7, metalness: 0.08, flatShading: false,
  });
  const matD = new THREE.MeshStandardMaterial({
    color: 0x15803d, roughness: 0.75, metalness: 0.05, flatShading: false,
  });
  const matBelly = new THREE.MeshStandardMaterial({
    color: 0x86efac, roughness: 0.8, metalness: 0.0, flatShading: false,
  });
  const matEye = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const matPup = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.5, 0.12, 10),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.5, metalness: 0.4 })
  );
  stand.position.y = 0.06;
  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.9), matG);
  body.position.set(0, 1.15, 0);
  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.55), matBelly);
  belly.position.set(0, 1.05, -0.2);
  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.5), matG);
  head.position.set(0, 1.7, -0.45);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.35), matD);
  snout.position.set(0, 1.58, -0.75);
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.05), matEye);
    e.position.set(sx * 0.12, 1.78, -0.7);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.04), matPup);
    p.position.set(sx * 0.12, 1.78, -0.73);
    g.add(e, p);
  }
  // Spikes on back
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.12), matD);
    sp.position.set(0, 1.55, 0.35 - i * 0.18);
    g.add(sp);
  }
  // Tail
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.7), matG);
  tail.position.set(0, 1.0, 0.7);
  tail.rotation.x = -0.35;
  // Legs
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.22), matD);
    leg.position.set(sx * 0.18, 0.55, 0.1);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.3), matD);
    foot.position.set(sx * 0.18, 0.28, -0.05);
    g.add(leg, foot);
  }
  // Arms
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.12), matG);
    arm.position.set(sx * 0.35, 1.25, -0.15);
    g.add(arm);
  }
  g.add(stand, body, belly, head, snout, tail);
  const lab = makeNameLabel(label);
  lab.position.set(0, 2.35, 0);
  lab.scale.set(1.6, 0.38, 1);
  g.add(lab);
  return g;
}

const treasureChests = [];

/** Treasure chest on beach sand — open for free purple gems */
function spawnTreasureChest(x, z) {
  const gy = Math.max(0.05, groundY(x, z));
  const g = new THREE.Group();
  g.position.set(x, gy, z);
  const matWood = new THREE.MeshStandardMaterial({
    color: 0x92400e, roughness: 0.85, metalness: 0.1, flatShading: false,
  });
  const matDark = new THREE.MeshStandardMaterial({
    color: 0x78350f, roughness: 0.9, metalness: 0.08, flatShading: false,
  });
  const matGold = new THREE.MeshStandardMaterial({
    color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.35,
    roughness: 0.4, metalness: 0.7, flatShading: false,
  });
  const matPurple = new THREE.MeshStandardMaterial({
    color: 0xa855f7, emissive: 0x7c3aed, emissiveIntensity: 0.55,
    roughness: 0.3, metalness: 0.4,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.75), matWood);
  base.position.y = 0.28;
  const lid = new THREE.Group();
  lid.position.set(0, 0.55, 0.28);
  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.18, 0.78), matDark);
  lidMesh.position.set(0, 0.05, -0.28);
  lid.add(lidMesh);
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.08, 0.12), matGold);
  band.position.set(0, 0.55, 0);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.1), matGold);
  lock.position.set(0, 0.42, -0.4);
  // Sparkle gems peeking
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), matPurple);
  gem.position.set(0, 0.4, 0);
  gem.visible = false;
  const label = makeNameLabel("TREASURE");
  label.position.set(0, 1.3, 0);
  label.scale.set(1.8, 0.4, 1);
  g.add(base, lid, band, lock, gem, label);
  scene.add(g);
  const entry = {
    group: g,
    lid,
    gem,
    lock,
    open: false,
    x, z, gy,
    gems: TREASURE_PURPLE_GEMS,
  };
  treasureChests.push(entry);
  return entry;
}

function nearestTreasure(maxDist = 3.2) {
  let best = null;
  let bestD = Infinity;
  for (const t of treasureChests) {
    if (t.open) continue;
    const d = Math.hypot(player.pos.x - t.x, player.pos.z - t.z);
    if (d < bestD && d < maxDist) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

function tryOpenTreasure() {
  const t = nearestTreasure(3.5) || state.nearTreasure;
  if (!t || t.open) return false;
  t.open = true;
  // Lid flips open
  if (t.lid) t.lid.rotation.x = -1.4;
  if (t.lock) t.lock.visible = false;
  if (t.gem) t.gem.visible = true;
  addPurpleGems(t.gems);
  addXP(40);
  addCoins(30);
  playTone(520, 0.1, "sine", 0.12);
  playTone(780, 0.14, "triangle", 0.1);
  playTone(1040, 0.16, "sine", 0.08);
  toast(`💎 TREASURE! +${t.gems} free purple gems 💜 · +30🟢`, "reward");
  playerSay("Purple gems!");
  // Sparkle burst
  for (let i = 0; i < 12; i++) {
    const sp = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.08, 0),
      new THREE.MeshBasicMaterial({ color: 0xc084fc })
    );
    sp.position.set(t.x, t.gy + 0.6, t.z);
    scene.add(sp);
    particles.push({
      mesh: sp,
      life: 0.8 + Math.random() * 0.4,
      max: 1.2,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        3 + Math.random() * 4,
        (Math.random() - 0.5) * 6
      ),
      type: "spark",
    });
  }
  updateHUD();
  return true;
}

function updateTreasure(dt) {
  for (const t of treasureChests) {
    if (t.gem && t.gem.visible) {
      t.gem.rotation.y += dt * 2.5;
      t.gem.position.y = 0.45 + Math.sin(state.elapsed * 3) * 0.08;
    }
  }
  // Toy Story Woody idle — standing tall, holds chest
  if (state.ugcHolder) {
    const u = state.ugcHolder;
    u.phase = (u.phase || 0) + dt;
    if (u.root) {
      u.root.position.y = u.baseY + Math.sin(u.phase * 1.6) * 0.025;
      // Gentle chest present sway
      if (u.chestGroup) {
        u.chestGroup.position.y = (u.chestBaseY || 1.05) + Math.sin(u.phase * 2.2) * 0.02;
      }
      if (u.armL) u.armL.rotation.x = -0.55 + Math.sin(u.phase * 1.4) * 0.04;
      if (u.armR) u.armR.rotation.x = -0.55 + Math.sin(u.phase * 1.4 + 0.3) * 0.04;
      if (u.headG) u.headG.rotation.y = Math.sin(u.phase * 0.7) * 0.12;
    }
  }
  // Gate door animation
  if (state.gateDoor) {
    const g = state.gateDoor;
    g.openAmt += ((g.open ? 1 : 0) - g.openAmt) * Math.min(1, 3.2 * dt);
    if (g.left) g.left.rotation.y = -g.openAmt * 1.35;
    if (g.right) g.right.rotation.y = g.openAmt * 1.35;
  }
}

/** Toy Story Woody — standing upright, holding a treasure chest */
function spawnUgcChestHolder(x, z) {
  const gy = Math.max(0.05, groundY(x, z));
  const root = new THREE.Group();
  root.position.set(x, gy, z);

  // Toy Story Woody palette
  const matSkin = new THREE.MeshStandardMaterial({ color: 0xf5c79a, roughness: 0.7, metalness: 0.0, flatShading: false });
  const matYellow = new THREE.MeshStandardMaterial({ color: 0xf5d76e, roughness: 0.65, metalness: 0.05, flatShading: false });
  const matCow = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.75, metalness: 0.0, flatShading: false });
  const matCowSpot = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.8, metalness: 0.0, flatShading: false });
  const matRed = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55, metalness: 0.1, flatShading: false });
  const matBrown = new THREE.MeshStandardMaterial({ color: 0x7c4a2d, roughness: 0.8, metalness: 0.05, flatShading: false });
  const matBoot = new THREE.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.75, metalness: 0.08, flatShading: false });
  const matHat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7, metalness: 0.05, flatShading: false });
  const matHatBand = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.6, metalness: 0.15, flatShading: false });
  const matBelt = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.7, metalness: 0.2, flatShading: false });
  const matBuckle = new THREE.MeshStandardMaterial({
    color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.25, roughness: 0.35, metalness: 0.55, flatShading: false,
  });
  const matHair = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85, metalness: 0.0, flatShading: false });
  const matEye = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.4, metalness: 0.1, flatShading: false });
  const matWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.0, flatShading: false });
  const matGold = new THREE.MeshStandardMaterial({
    color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.55, flatShading: false,
  });
  const matChestWood = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.85, metalness: 0.05, flatShading: false });
  const matChestDark = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.88, metalness: 0.05, flatShading: false });

  // ── Legs (standing) — detailed cowboy jeans + stitching ──
  for (const sx of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.24), matBrown);
    thigh.position.set(sx * 0.14, 0.55, 0);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.02), matCowSpot);
    seam.position.set(sx * 0.14, 0.55, -0.13);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.38, 0.22), matBrown);
    shin.position.set(sx * 0.14, 0.22, 0.02);
    // Cowboy boots with sole + heel
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.38), matBoot);
    boot.position.set(sx * 0.14, 0.1, 0.06);
    const bootTip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.14), matBoot);
    bootTip.position.set(sx * 0.14, 0.08, -0.16);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.4), matCowSpot);
    sole.position.set(sx * 0.14, 0.02, 0.04);
    // Spur star
    const spur = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), matBuckle);
    spur.position.set(sx * 0.14, 0.12, 0.24);
    root.add(thigh, seam, shin, boot, bootTip, sole, spur);
  }

  // ── Torso: yellow shirt + cow-print vest ──
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.62, 0.34), matYellow);
  torso.position.y = 1.12;
  // Cow vest front
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.5, 0.12), matCow);
  vest.position.set(0, 1.14, -0.16);
  // Black cow spots on vest
  for (const [sx, sy] of [[-0.12, 0.12], [0.1, 0.05], [-0.05, -0.1], [0.14, -0.08], [0, 0.18]]) {
    const spot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.04), matCowSpot);
    spot.position.set(sx, 1.14 + sy, -0.22);
    root.add(spot);
  }
  // Red bandana around neck
  const bandana = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.36), matRed);
  bandana.position.set(0, 1.42, 0.02);
  // Bandana knot hanging
  const knot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.08), matRed);
  knot.position.set(0, 1.32, -0.2);
  // Belt + sheriff-style buckle
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.36), matBelt);
  belt.position.set(0, 0.82, 0);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.06), matBuckle);
  buckle.position.set(0, 0.82, -0.2);

  // ── Head (visible Toy Story face) ──
  const headG = new THREE.Group();
  headG.position.set(0, 1.72, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.36), matSkin);
  // Ears
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.08), matSkin);
    ear.position.set(sx * 0.22, 0.02, 0);
    headG.add(ear);
  }
  // Eyes
  for (const sx of [-1, 1]) {
    const white = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.04), matWhite);
    white.position.set(sx * 0.1, 0.06, -0.19);
    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.03), matEye);
    pupil.position.set(sx * 0.1, 0.06, -0.21);
    headG.add(white, pupil);
  }
  // Nose + smile
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.08), matSkin);
  nose.position.set(0, -0.02, -0.2);
  const smile = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.03), matRed);
  smile.position.set(0, -0.12, -0.19);
  // Chin dimple line
  const chin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.03), new THREE.MeshStandardMaterial({
    color: 0xe8b888, roughness: 0.7, flatShading: false,
  }));
  chin.position.set(0, -0.16, -0.18);
  // Hair under hat
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.32), matHair);
  hair.position.set(0, 0.18, 0.02);
  headG.add(head, nose, smile, chin, hair);

  // ── Cowboy hat ──
  const hatG = new THREE.Group();
  hatG.position.set(0, 0.28, 0);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.05, 14), matHat);
  brim.position.y = 0.02;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.22, 12), matHat);
  crown.position.y = 0.14;
  // Hat dent top
  const dent = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.16), matHat);
  dent.position.y = 0.26;
  const hBand = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.05, 12), matHatBand);
  hBand.position.y = 0.06;
  hatG.add(brim, crown, dent, hBand);
  headG.add(hatG);

  // ── Arms holding chest in front (standing) ──
  const armL = new THREE.Group();
  armL.position.set(-0.38, 1.28, 0);
  const armLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.48, 0.16), matYellow);
  armLMesh.position.y = -0.2;
  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), matSkin);
  handL.position.y = -0.48;
  armL.add(armLMesh, handL);
  armL.rotation.x = -0.55;
  armL.rotation.z = 0.25;

  const armR = new THREE.Group();
  armR.position.set(0.38, 1.28, 0);
  const armRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.48, 0.16), matYellow);
  armRMesh.position.y = -0.2;
  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), matSkin);
  handR.position.y = -0.48;
  armR.add(armRMesh, handR);
  armR.rotation.x = -0.55;
  armR.rotation.z = -0.25;

  // ── Treasure chest held in both hands ──
  const chestGroup = new THREE.Group();
  chestGroup.position.set(0, 1.05, -0.52);
  chestGroup.scale.setScalar(0.62);
  const cBase = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.52, 0.72), matChestWood);
  cBase.position.y = 0.26;
  const cLid = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.18, 0.74), matChestDark);
  cLid.position.set(0, 0.58, 0);
  const cBand1 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.1), matGold);
  cBand1.position.set(0, 0.52, -0.36);
  const cBand2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.74), matGold);
  cBand2.position.set(0, 0.28, 0);
  const cLock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.1), matGold);
  cLock.position.set(0, 0.42, -0.4);
  // Glow gems peeking from lid seam
  const gemGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.08, 0.2),
    new THREE.MeshStandardMaterial({
      color: 0xa855f7, emissive: 0x7c3aed, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.4, flatShading: false,
    })
  );
  gemGlow.position.set(0, 0.52, -0.1);
  chestGroup.add(cBase, cLid, cBand1, cBand2, cLock, gemGlow);

  const label = makeNameLabel("WOODY · TOY STORY");
  label.position.set(0, 2.55, 0);
  label.scale.set(2.6, 0.45, 1);

  root.add(torso, vest, bandana, knot, belt, buckle, headG, armL, armR, chestGroup, label);
  root.scale.setScalar(1.25); // standing tall
  // Face inland toward spawn (model faces -Z by default)
  root.rotation.y = 0;
  scene.add(root);

  state.ugcHolder = {
    root,
    armL,
    armR,
    chestGroup,
    chestBaseY: 1.05,
    headG,
    hatG,
    phase: 0,
    baseY: gy,
    x, z,
    name: "Woody",
  };
  return root;
}

/** Gate door on the beach path — press E to open / close */
function spawnGateDoor(x, z) {
  const gy = Math.max(0.05, groundY(x, z));
  const root = new THREE.Group();
  root.position.set(x, gy, z);

  const matPost = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.85, metalness: 0.15, flatShading: false });
  const matGate = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.7, metalness: 0.25, flatShading: false });
  const matGold = new THREE.MeshStandardMaterial({
    color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.25, roughness: 0.45, metalness: 0.5, flatShading: false,
  });
  const matBar = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.5, metalness: 0.4, flatShading: false });

  // Posts
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), matPost);
  postL.position.set(-1.6, 1.6, 0);
  const postR = postL.clone();
  postR.position.x = 1.6;
  // Arch
  const arch = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.35, 0.4), matGold);
  arch.position.set(0, 3.25, 0);
  // Left / right swinging doors
  const left = new THREE.Group();
  left.position.set(-1.45, 0, 0);
  const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 0.12), matGate);
  leftPanel.position.set(0.7, 1.4, 0);
  // Bars on door
  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.06), matBar);
    bar.position.set(0.7, 0.5 + i * 0.55, 0.08);
    left.add(bar);
  }
  left.add(leftPanel);
  const right = new THREE.Group();
  right.position.set(1.45, 0, 0);
  const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 0.12), matGate);
  rightPanel.position.set(-0.7, 1.4, 0);
  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.06), matBar);
    bar.position.set(-0.7, 0.5 + i * 0.55, 0.08);
    right.add(bar);
  }
  right.add(rightPanel);
  // Handle
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.2), matGold);
  handle.position.set(0.05, 1.3, 0.15);
  // Sign
  const sign = makeNameLabel("GATE · E OPEN");
  sign.position.set(0, 3.7, 0);
  sign.scale.set(2.2, 0.45, 1);

  root.add(postL, postR, arch, left, right, handle, sign);
  scene.add(root);

  // Collider when closed (blocks path through middle)
  const colliderClosed = () => {
    // remove old mid colliders if any
    if (state.gateDoor && state.gateDoor.colliderIdx != null) {
      // leave list; we use dynamic resolve below via open flag
    }
  };

  state.gateDoor = {
    root,
    left,
    right,
    open: false,
    openAmt: 0,
    blocking: true,
    x, z, gy,
    halfW: 1.5,
    halfD: 0.35,
  };
  // Initial closed collider
  addCollider(x, gy + 1.4, z, 3.0, 2.8, 0.5);
  state.gateDoor.colliderMinY = gy;
  return root;
}

function nearestGate(maxDist = 4.5) {
  const g = state.gateDoor;
  if (!g) return null;
  const d = Math.hypot(player.pos.x - g.x, player.pos.z - g.z);
  return d < maxDist ? g : null;
}

function tryToggleGate() {
  const g = nearestGate(5) || (state.nearGate ? state.gateDoor : null);
  if (!g) return false;
  g.open = !g.open;
  if (g.open) {
    toast("🚪 Gate OPEN — walk through!", "reward");
    playerSay("Open sesame!");
    playTone(440, 0.08, "sine", 0.1);
    playTone(660, 0.1, "triangle", 0.08);
  } else {
    toast("🚪 Gate CLOSED", "");
    playTone(320, 0.1, "sine", 0.08);
  }
  g.blocking = !g.open;
  return true;
}

/** Room buried in the beach sand — GAME pad on top, open door to enter */
function spawnSandGameRoom(x, z) {
  const gy = Math.max(0.05, groundY(x, z));
  const root = new THREE.Group();
  root.position.set(x, gy - 0.05, z);

  const matSand = new THREE.MeshStandardMaterial({ color: 0xd4b896, roughness: 0.95, flatShading: false });
  const matWall = new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 0.9, flatShading: false });
  const matFloor = new THREE.MeshStandardMaterial({ color: 0xb8956a, roughness: 0.92, flatShading: false });
  const matDoor = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.75, metalness: 0.1, flatShading: false });
  const matTrim = new THREE.MeshStandardMaterial({
    color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.25, roughness: 0.4, metalness: 0.4, flatShading: false,
  });
  const matNeon = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const matGame = new THREE.MeshStandardMaterial({
    color: 0x0f172a, roughness: 0.4, metalness: 0.45, emissive: 0x0ea5e9, emissiveIntensity: 0.35, flatShading: false,
  });

  // Sand mound with room hollowed inside
  const mound = new THREE.Mesh(new THREE.BoxGeometry(9.5, 1.4, 8.5), matSand);
  mound.position.y = 0.45;
  // Extra sand banks so it feels “in the sand”
  const bankL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 7), matSand);
  bankL.position.set(-4.2, 0.35, 0.2);
  const bankR = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 7), matSand);
  bankR.position.set(4.2, 0.35, 0.2);
  // Interior floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.2, 5.5), matFloor);
  floor.position.y = 0.05;
  // Walls
  const back = new THREE.Mesh(new THREE.BoxGeometry(6.5, 2.8, 0.35), matWall);
  back.position.set(0, 1.3, 2.6);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.8, 5.5), matWall);
  left.position.set(-3.15, 1.3, 0);
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.8, 5.5), matWall);
  right.position.set(3.15, 1.3, 0);
  // Front with door hole
  const frontL = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.8, 0.35), matWall);
  frontL.position.set(-2.2, 1.3, -2.6);
  const frontR = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.8, 0.35), matWall);
  frontR.position.set(2.2, 1.3, -2.6);
  const frontTop = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 0.35), matWall);
  frontTop.position.set(0, 2.45, -2.6);
  // Roof / sand cover — GAME sits ON TOP
  const roof = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.45, 6.4), matSand);
  roof.position.y = 2.95;
  const gamePad = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 2.5), matGame);
  gamePad.position.set(0, 3.22, 0);
  // Glowing screen = the game console on the sand roof
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.1, 1.6),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  screen.position.set(0, 3.35, 0);
  // Spider web pattern lines on screen
  for (let i = 0; i < 4; i++) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.04, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xe0f2fe })
    );
    line.position.set(0, 3.4, -0.5 + i * 0.35);
    root.add(line);
  }
  const webIcon = makeNameLabel("🕷 GAME");
  webIcon.position.set(0, 3.75, 0);
  webIcon.scale.set(2.8, 0.55, 1);
  const gameSub = makeNameLabel("ON THE SAND");
  gameSub.position.set(0, 3.45, 1.4);
  gameSub.scale.set(2.0, 0.35, 1);

  // Door stays open — walk straight in (no E)
  const doorG = new THREE.Group();
  doorG.position.set(-1.1, 0, -2.55);
  doorG.rotation.y = -1.5; // permanently open
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.15, 2.2, 0.12), matDoor);
  door.position.set(1.05, 1.15, 0);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.15), matTrim);
  handle.position.set(1.8, 1.15, 0.1);
  const doorWin = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.5, 0.04),
    new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.55 })
  );
  doorWin.position.set(1.05, 1.55, -0.08);
  doorG.add(door, handle, doorWin);

  // Inside neon + Spider-Man poster
  const neon = new THREE.Mesh(new THREE.BoxGeometry(4, 0.08, 0.08), matNeon);
  neon.position.set(0, 2.5, 2.3);
  const poster = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.2, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x0f172a })
  );
  poster.position.set(0, 1.6, 2.4);
  const posterBlue = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.7, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  posterBlue.position.set(0, 1.65, 2.38);
  const insideLabel = makeNameLabel("SPIDER-MAN");
  insideLabel.position.set(0, 2.35, 2.35);
  insideLabel.scale.set(1.8, 0.35, 1);

  const label = makeNameLabel("SAND ROOM");
  label.position.set(0, 4.15, -2.9);
  label.scale.set(2.2, 0.45, 1);

  root.add(
    mound, bankL, bankR, floor, back, left, right, frontL, frontR, frontTop,
    roof, gamePad, screen, webIcon, gameSub, doorG, neon, poster, posterBlue, insideLabel, label
  );
  scene.add(root);

  // Wall colliders — open doorway (no door block)
  addCollider(x, gy + 1.3, z + 2.6, 6.5, 2.8, 0.5);
  addCollider(x - 3.15, gy + 1.3, z, 0.5, 2.8, 5.5);
  addCollider(x + 3.15, gy + 1.3, z, 0.5, 2.8, 5.5);
  addCollider(x - 2.2, gy + 1.3, z - 2.6, 2.2, 2.8, 0.5);
  addCollider(x + 2.2, gy + 1.3, z - 2.6, 2.2, 2.8, 0.5);
  addCollider(x, gy + 2.95, z, 7.4, 0.5, 6.4); // roof walkable

  state.sandRoom = {
    root,
    doorG,
    open: true,
    openAmt: 1,
    x, z, gy,
    doorCollider: null,
  };
  return root;
}

function nearestSandRoom(maxDist = 4) {
  const r = state.sandRoom;
  if (!r) return null;
  const d = Math.hypot(player.pos.x - r.x, player.pos.z - (r.z - 2.6));
  return d < maxDist ? r : null;
}

function tryOpenSandRoom() {
  // Door always open — no E interaction
  return false;
}

function updateSandRoom(dt) {
  // Door stays open; nothing to animate
}

/** Prompt near Woody (UGC): do you wanna play the Spider-Man game? */
function offerSpiderGame() {
  if (state.spiderGame || state.spiderOffer) return;
  state.spiderOffer = true;
  state.speechQueue.length = 0;
  state.speechShowing = false;
  state.speechQueue.push({
    text: "Do you wanna play the Spider-Man game? Quick — press Y for YES or N for NO!",
    who: "woody",
  });
  if (!state.speechShowing) advanceSpeech();
  toast("🕷 Do you wanna play the Spider-Man game? [Y] YES · [N] NO", "quest");
}

/** Build a rich jungle world once — Spider-Man pocket realm */
function ensureSpiderJungleWorld() {
  if (state.spiderJungle && state.spiderJungle.root) return state.spiderJungle;

  const cx = SPIDER_JUNGLE_X;
  const cz = SPIDER_JUNGLE_Z;
  const root = new THREE.Group();
  root.name = "spiderJungle";
  root.position.set(cx, 0, cz);
  scene.add(root);

  const matGrass = new THREE.MeshStandardMaterial({
    color: 0x1f6b28, roughness: 0.92, metalness: 0.0, flatShading: false,
  });
  const matGrass2 = new THREE.MeshStandardMaterial({
    color: 0x3d9b32, roughness: 0.9, metalness: 0.0, flatShading: false,
  });
  const matGrass3 = new THREE.MeshStandardMaterial({
    color: 0x145c1f, roughness: 0.93, metalness: 0.0, flatShading: false,
  });
  const matMoss = new THREE.MeshStandardMaterial({
    color: 0x4ade80, roughness: 0.88, metalness: 0.0, flatShading: false,
  });
  const matDirt = new THREE.MeshStandardMaterial({
    color: 0x5c4030, roughness: 0.95, metalness: 0.0, flatShading: false,
  });
  const matMud = new THREE.MeshStandardMaterial({
    color: 0x3f2a1a, roughness: 0.96, metalness: 0.0, flatShading: false,
  });
  const matTrunk = new THREE.MeshStandardMaterial({
    color: 0x4a3422, roughness: 0.9, metalness: 0.02, flatShading: false,
  });
  const matTrunk2 = new THREE.MeshStandardMaterial({
    color: 0x3b2a1a, roughness: 0.9, metalness: 0.02, flatShading: false,
  });
  const matTrunk3 = new THREE.MeshStandardMaterial({
    color: 0x6b4423, roughness: 0.88, metalness: 0.02, flatShading: false,
  });
  const matCanopy = new THREE.MeshStandardMaterial({
    color: 0x15803d, roughness: 0.8, metalness: 0.0, flatShading: false,
  });
  const matCanopy2 = new THREE.MeshStandardMaterial({
    color: 0x22c55e, roughness: 0.78, metalness: 0.0, flatShading: false,
  });
  const matCanopy3 = new THREE.MeshStandardMaterial({
    color: 0x166534, roughness: 0.82, metalness: 0.0, flatShading: false,
  });
  const matCanopyLite = new THREE.MeshStandardMaterial({
    color: 0x4ade80, roughness: 0.75, metalness: 0.0, flatShading: false,
  });
  const matVine = new THREE.MeshStandardMaterial({
    color: 0x3d8c40, roughness: 0.85, metalness: 0.0, flatShading: false,
  });
  const matVineDark = new THREE.MeshStandardMaterial({
    color: 0x14532d, roughness: 0.88, metalness: 0.0, flatShading: false,
  });
  const matRock = new THREE.MeshStandardMaterial({
    color: 0x6b7280, roughness: 0.9, metalness: 0.1, flatShading: false,
  });
  const matRockMoss = new THREE.MeshStandardMaterial({
    color: 0x4b5563, roughness: 0.92, metalness: 0.08, flatShading: false,
  });
  const matWater = new THREE.MeshStandardMaterial({
    color: 0x0e7490, transparent: true, opacity: 0.72, roughness: 0.15, metalness: 0.3, flatShading: false,
  });
  const matWaterDeep = new THREE.MeshStandardMaterial({
    color: 0x155e75, transparent: true, opacity: 0.8, roughness: 0.2, metalness: 0.25, flatShading: false,
  });
  const matBamboo = new THREE.MeshStandardMaterial({
    color: 0x65a30d, roughness: 0.7, metalness: 0.05, flatShading: false,
  });
  const matPalm = new THREE.MeshStandardMaterial({
    color: 0x16a34a, roughness: 0.75, metalness: 0.0, flatShading: false, side: THREE.DoubleSide,
  });
  const matFlower = [
    new THREE.MeshBasicMaterial({ color: 0xf43f5e }),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    new THREE.MeshBasicMaterial({ color: 0xa78bfa }),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
    new THREE.MeshBasicMaterial({ color: 0xfb923c }),
    new THREE.MeshBasicMaterial({ color: 0xf472b6 }),
  ];
  const matFern = new THREE.MeshStandardMaterial({
    color: 0x22c55e, roughness: 0.88, metalness: 0.0, flatShading: false, side: THREE.DoubleSide,
  });
  const matFern2 = new THREE.MeshStandardMaterial({
    color: 0x15803d, roughness: 0.9, metalness: 0.0, flatShading: false, side: THREE.DoubleSide,
  });
  const matGlow = new THREE.MeshStandardMaterial({
    color: 0xa3e635, emissive: 0x65a30d, emissiveIntensity: 0.45, roughness: 0.5, metalness: 0.1, flatShading: false,
  });

  // ── Layered jungle floor (rich terrain feel) ──
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(SPIDER_JUNGLE_R - 1, SPIDER_JUNGLE_R - 1, 1.4, 48),
    matGrass
  );
  floor.position.y = 0.55;
  floor.receiveShadow = true;
  root.add(floor);
  // Outer darker jungle edge
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(SPIDER_JUNGLE_R + 4, SPIDER_JUNGLE_R + 2, 2.2, 40),
    matGrass3
  );
  rim.position.y = 0.2;
  root.add(rim);
  // Patchy grass islands
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    const rad = 20 + (i % 5) * 8;
    const patch = new THREE.Mesh(
      new THREE.CylinderGeometry(4 + (i % 3), 4.5 + (i % 3), 0.35, 10),
      i % 2 ? matGrass2 : matMoss
    );
    patch.position.set(Math.cos(ang) * rad, 1.15, Math.sin(ang) * rad);
    root.add(patch);
  }
  // Dirt trail through jungle
  for (let i = 0; i < 12; i++) {
    const t = (i / 11) * Math.PI * 1.6 - 0.3;
    const pr = 8 + i * 4.5;
    const px = Math.cos(t) * pr * 0.55;
    const pz = Math.sin(t) * pr * 0.7 - 4;
    const dirt = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 4.5), i % 2 ? matDirt : matMud);
    dirt.position.set(px, 1.18, pz);
    dirt.rotation.y = t;
    root.add(dirt);
  }
  // Center clearing
  const clear = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 0.28, 24), matGrass2);
  clear.position.y = 1.2;
  root.add(clear);
  const clearDirt = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 0.22, 16), matDirt);
  clearDirt.position.y = 1.28;
  root.add(clearDirt);

  addCollider(cx, 0.95, cz, (SPIDER_JUNGLE_R - 1) * 2, 1.1, (SPIDER_JUNGLE_R - 1) * 2);

  const canopyMats = [matCanopy, matCanopy2, matCanopy3, matCanopyLite];
  const trees = [];

  // ── Dense multi-layer rainforest trees ──
  for (let i = 0; i < 95; i++) {
    const ang = (i / 95) * Math.PI * 2 + (i % 7) * 0.11;
    const rad = 14 + (i % 13) * 4.6 + (i % 5) * 0.9;
    if (rad > SPIDER_JUNGLE_R - 6) continue;
    const lx = Math.cos(ang) * rad + ((i % 3) - 1) * 1.2;
    const lz = Math.sin(ang) * rad + ((i % 4) - 1.5) * 0.9;
    if (Math.hypot(lx, lz) < 11) continue; // keep spawn clear
    const h = 11 + (i % 9) * 1.6 + (i % 4) * 0.5;
    const trunkW = 0.5 + (i % 4) * 0.14;
    const tG = new THREE.Group();
    tG.position.set(lx, 1.15, lz);

    // Tapered trunk segments
    const segs = 3;
    for (let s = 0; s < segs; s++) {
      const sh = h / segs;
      const sw = trunkW * (1 - s * 0.12);
      const trunk = new THREE.Mesh(
        new THREE.BoxGeometry(sw, sh, sw),
        s % 2 ? matTrunk : (i % 3 ? matTrunk2 : matTrunk3)
      );
      trunk.position.y = sh * 0.5 + s * sh;
      trunk.rotation.y = s * 0.15;
      tG.add(trunk);
      // Moss patch on trunk
      if (s === 1) {
        const moss = new THREE.Mesh(new THREE.BoxGeometry(sw * 1.15, sh * 0.4, 0.08), matMoss);
        moss.position.set(0, sh * 0.5 + s * sh, sw * 0.55);
        tG.add(moss);
      }
    }
    // Big multi-layer canopy (feels like real jungle roof)
    const canopyY = h + 0.3;
    for (let c = 0; c < 6; c++) {
      const size = 2.8 + c * 0.85 + (i % 3) * 0.3;
      const leaf = new THREE.Mesh(
        new THREE.BoxGeometry(size, 0.9 + (c % 2) * 0.25, size * 0.92),
        canopyMats[(i + c) % canopyMats.length]
      );
      const a = c * 0.9 + i * 0.2;
      leaf.position.set(Math.cos(a) * 0.7, canopyY + c * 0.48, Math.sin(a) * 0.7);
      leaf.rotation.y = a;
      tG.add(leaf);
    }
    // Hanging vine curtains
    for (let v = 0; v < 3; v++) {
      const vineH = 3.5 + (i + v) % 6;
      const vine = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, vineH, 0.07),
        v % 2 ? matVine : matVineDark
      );
      vine.position.set(
        Math.cos(v * 2.1) * 1.4,
        h - vineH * 0.3,
        Math.sin(v * 2.1) * 1.4
      );
      tG.add(vine);
      // Leaf tuft on vine
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), matCanopy2);
      tuft.position.set(vine.position.x, h - vineH * 0.55, vine.position.z);
      tG.add(tuft);
    }
    root.add(tG);
    trees.push({ x: cx + lx, z: cz + lz, h, trunkW });
    addCollider(cx + lx, 1.15 + h * 0.45, cz + lz, trunkW + 0.35, h * 0.9, trunkW + 0.35);
    addCollider(cx + lx, 1.15 + h + 1.4, cz + lz, 4.2, 0.55, 4.2);
  }

  // ── Palm trees near water ──
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const rad = 22 + (i % 3) * 3;
    const lx = Math.cos(ang) * rad + 8;
    const lz = Math.sin(ang) * rad - 10;
    const pG = new THREE.Group();
    pG.position.set(lx, 1.2, lz);
    const ph = 9 + i % 4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, ph, 14), matTrunk3);
    trunk.position.y = ph / 2;
    trunk.rotation.z = (i % 2 ? 0.08 : -0.06);
    pG.add(trunk);
    for (let f = 0; f < 7; f++) {
      const frond = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 3.2), matPalm);
      frond.position.set(0, ph + 0.1, 0);
      frond.rotation.y = (f / 7) * Math.PI * 2;
      frond.rotation.x = 0.55;
      pG.add(frond);
    }
    root.add(pG);
  }

  // ── Bamboo thicket ──
  for (let i = 0; i < 40; i++) {
    const lx = -28 + (i % 8) * 1.1 + Math.sin(i) * 0.4;
    const lz = 18 + Math.floor(i / 8) * 1.3 + Math.cos(i) * 0.3;
    const bh = 5 + (i % 5) * 0.8;
    const bamboo = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, bh, 12), matBamboo);
    bamboo.position.set(lx, 1.2 + bh / 2, lz);
    root.add(bamboo);
    if (i % 3 === 0) {
      const node = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.22), matMoss);
      node.position.set(lx, 1.2 + bh * 0.6, lz);
      root.add(node);
    }
  }

  // ── Ferns, undergrowth, tropical flowers ──
  for (let i = 0; i < 140; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 10 + Math.random() * (SPIDER_JUNGLE_R - 16);
    const lx = Math.cos(ang) * rad;
    const lz = Math.sin(ang) * rad;
    if (Math.hypot(lx, lz) < 10) continue;
    const fern = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.85 + Math.random() * 0.9, 0.85),
      i % 2 ? matFern : matFern2
    );
    fern.position.set(lx, 1.45, lz);
    fern.rotation.y = Math.random() * Math.PI;
    root.add(fern);
    // Cross fern plane
    if (i % 2 === 0) {
      const fern2 = fern.clone();
      fern2.rotation.y += Math.PI / 2;
      root.add(fern2);
    }
    if (i % 2 === 0) {
      const flower = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.22, 0.22),
        matFlower[i % matFlower.length]
      );
      flower.position.set(lx + 0.25, 1.6, lz + 0.15);
      root.add(flower);
      // Stem
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, 0.05), matVine);
      stem.position.set(lx + 0.25, 1.4, lz + 0.15);
      root.add(stem);
    }
  }

  // ── Fallen logs ──
  for (let i = 0; i < 11; i++) {
    const ang = (i / 8) * Math.PI * 2 + 0.4;
    const rad = 18 + (i % 3) * 10;
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.5, 5 + (i % 3), 14),
      matTrunk
    );
    log.rotation.z = Math.PI / 2;
    log.rotation.y = ang;
    log.position.set(Math.cos(ang) * rad, 1.55, Math.sin(ang) * rad);
    root.add(log);
    const mossLog = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 0.5), matMoss);
    mossLog.position.copy(log.position);
    mossLog.position.y += 0.4;
    mossLog.rotation.y = ang;
    root.add(mossLog);
  }

  // ── Mossy rocks + cliff shelf ──
  for (let i = 0; i < 28; i++) {
    const ang = (i / 28) * Math.PI * 2;
    const rad = 15 + (i % 6) * 9;
    const rock = new THREE.Mesh(
      new THREE.BoxGeometry(1.3 + (i % 4) * 0.5, 0.8 + (i % 3) * 0.5, 1.1 + (i % 5) * 0.35),
      i % 2 ? matRock : matRockMoss
    );
    rock.position.set(Math.cos(ang) * rad, 1.5, Math.sin(ang) * rad);
    rock.rotation.y = i * 0.5;
    rock.rotation.z = (i % 5) * 0.05;
    root.add(rock);
    if (i % 3 === 0) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.6), matMoss);
      m.position.set(rock.position.x, rock.position.y + 0.45, rock.position.z);
      root.add(m);
    }
  }
  // Small cliff wall
  const cliff = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 3.5), matRockMoss);
  cliff.position.set(-32, 4, 8);
  root.add(cliff);
  addCollider(cx - 32, 4, cz + 8, 18, 7, 3.5);
  // Waterfall down cliff
  const fall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 6.5, 0.4), matWater);
  fall.position.set(-32, 4.2, 10.2);
  root.add(fall);
  const mist = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 0.8, 2),
    new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.35 })
  );
  mist.position.set(-32, 1.6, 12);
  root.add(mist);

  // ── Twin jungle ponds + stream ──
  const pond = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 8, 0.4, 20), matWater);
  pond.position.set(20, 1.22, -14);
  root.add(pond);
  const pondDeep = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.5, 0.25, 14), matWaterDeep);
  pondDeep.position.set(20, 1.15, -14);
  root.add(pondDeep);
  const pondRim = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.28, 18), matMud);
  pondRim.position.set(20, 1.1, -14);
  root.add(pondRim);
  // Stream to second pool
  const stream = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 16), matWater);
  stream.position.set(12, 1.2, -4);
  stream.rotation.y = 0.45;
  root.add(stream);
  const pond2 = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.5, 0.35, 16), matWater);
  pond2.position.set(6, 1.2, 10);
  root.add(pond2);

  // ── Ancient stone ruin spawn pad (overgrown) ──
  const ruin = new THREE.Mesh(new THREE.BoxGeometry(10, 0.65, 10), matRock);
  ruin.position.set(0, 1.35, 0);
  root.add(ruin);
  const ruinMoss = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.12, 9.5), matMoss);
  ruinMoss.position.set(0, 1.7, 0);
  root.add(ruinMoss);
  for (const [px, pz] of [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.85, 3.6, 0.85), matRock);
    pillar.position.set(px, 3.0, pz);
    root.add(pillar);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 1.1), matRockMoss);
    cap.position.set(px, 4.9, pz);
    root.add(cap);
    const pm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.1), matMoss);
    pm.position.set(px, 3.2, pz - 0.45);
    root.add(pm);
  }
  // Glowing jungle crystals on ruin
  for (const [gx, gz] of [[-1.5, 0], [1.5, 0], [0, -1.5], [0, 1.5]]) {
    const crystal = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), matGlow);
    crystal.position.set(gx, 2.1, gz);
    crystal.rotation.y = Math.PI / 4;
    root.add(crystal);
  }
  addCollider(cx, 1.45, cz, 10, 0.75, 10);

  // ── Floating canopy clouds / light rays markers ──
  for (let i = 0; i < 12; i++) {
    const cloud = new THREE.Mesh(
      new THREE.SphereGeometry(2.2 + (i % 3) * 0.6, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xd1fae5, transparent: true, opacity: 0.22 })
    );
    const ang = (i / 12) * Math.PI * 2;
    cloud.position.set(Math.cos(ang) * 35, 16 + (i % 4), Math.sin(ang) * 35);
    cloud.scale.set(1.6, 0.55, 1.2);
    root.add(cloud);
  }

  // Fireflies (static glow dots — feel alive)
  for (let i = 0; i < 35; i++) {
    const bug = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 5, 4),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xfef08a : 0xa3e635 })
    );
    const ang = Math.random() * Math.PI * 2;
    const rad = 8 + Math.random() * 50;
    bug.position.set(Math.cos(ang) * rad, 2 + Math.random() * 8, Math.sin(ang) * rad);
    root.add(bug);
  }

  // Title labels
  const title = makeNameLabel("🌿 JUNGLE WORLD");
  title.position.set(0, 9.5, 0);
  title.scale.set(5, 0.75, 1);
  root.add(title);
  const sub = makeNameLabel("☁ CLOUDY BIRD SPIDER-MAN");
  sub.position.set(0, 8.4, 0);
  sub.scale.set(3.5, 0.55, 1);
  root.add(sub);

  // Vine arch gateway near spawn
  for (let i = 0; i < 11; i++) {
    const vine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.5 + i * 0.2, 0.12), matVine);
    vine.position.set(-5 + i * 1.4, 4.8, -8);
    root.add(vine);
  }
  const archTop = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 12, 12), matCanopy);
  archTop.position.set(0, 7.5, -8);
  root.add(archTop);

  const spawnY = Math.max(2.4, groundY(cx, cz) + 0.6);
  state.spiderJungle = {
    root,
    x: cx,
    z: cz,
    spawnY,
    trees,
  };
  return state.spiderJungle;
}

function applyJungleAtmosphere(on) {
  if (on) {
    // Deep rainforest: warm green mist + filtered sunlight feel
    scene.background.setHex(0x3d6b4f);
    if (scene.fog) {
      scene.fog.color.setHex(0x5a8f68);
      scene.fog.near = 12;
      scene.fog.far = 115;
    }
    if (typeof hemi !== "undefined" && hemi) {
      hemi.color.setHex(0xd9f99d);
      hemi.groundColor.setHex(0x1a4d28);
      hemi.intensity = 1.05;
    }
    if (typeof sun !== "undefined" && sun) {
      sun.color.setHex(0xfff4c8);
      sun.intensity = Math.max(sun.intensity, 0.85);
    }
  }
  // off: day/night + weather systems restore next frame
}

function startSpiderGame() {
  state.spiderOffer = false;
  state.spiderGame = true;
  // Remember beach / Woody so HOME brings you back
  state.spiderReturn = {
    x: player.pos.x,
    y: player.pos.y,
    z: player.pos.z,
    yaw: player.yaw,
  };

  const jungle = ensureSpiderJungleWorld();
  // Enter the NEW jungle world
  player.pos.set(jungle.x, jungle.spawnY + 0.5, jungle.z);
  player.vel.set(0, 0, 0);
  player.onGround = true;
  player.parachuting = false;
  player.yaw = 0;
  player.camDistTarget = Math.max(player.camDistTarget, 6.5);
  player.camDist = Math.max(player.camDist, 6);

  applySpiderManCostume(true);
  applyJungleAtmosphere(true);
  // Exactly ONE of each: Red Hulk, Spider-Man, Venom, Captain America
  const roster = [
    { kind: "hulk", ang: 0.4 },
    { kind: "spiderman", ang: 2.0 },
    { kind: "venom", ang: 3.6 },
    { kind: "captain", ang: 5.2 },
  ];
  for (const f of roster) {
    const r = 20;
    spawnEnemy(
      jungle.x + Math.cos(f.ang) * r,
      jungle.z + Math.sin(f.ang) * r,
      f.kind
    );
  }
  state._spiderPrevMode = state.gameMode;
  state.gameMode = "survival";
  state.spiderFightCd = 0;
  toast("🐦 YOU vs RED HULK · SPIDER-MAN · VENOM · CAP! Click FIGHT · F webs · H HOME", "reward");
  playerSay("Let\'s fight!");
  showSpiderHUD(true);
}

function exitSpiderGame() {
  if (!state.spiderGame) return;
  state.spiderGame = false;
  applySpiderManCostume(false);
  showSpiderHUD(false);
  applyJungleAtmosphere(false);
  if (state.spiderWebs) {
    for (const w of state.spiderWebs) {
      if (w.mesh && w.mesh.parent) scene.remove(w.mesh);
    }
  }
  state.spiderWebs = [];
  // HOME → back to Woody / beach where you said yes
  const r = state.spiderReturn;
  if (r) {
    player.pos.set(r.x, r.y, r.z);
    player.yaw = r.yaw || 0;
  }
  player.vel.set(0, 0, 0);
  player.onGround = true;
  state.spiderReturn = null;
  state.hasSpiderSuit = false;
  state.spiderFriendly = false;
  state.spiderTalkTimer = 0;
  state.spiderPowerTimer = 0;
  // Restore game mode from before spider fight
  if (state._spiderPrevMode) {
    state.gameMode = state._spiderPrevMode;
    state._spiderPrevMode = null;
  }
  if (typeof paintPlayerYellowSkin === "function") paintPlayerYellowSkin();
  if (typeof ensureHairOnHead === "function") ensureHairOnHead();
  toast("🏠 Home — back to the beach!", "reward");
  playerSay("Back home!");
}

function showSpiderHUD(show) {
  const el = $("spider-hud");
  if (!el) return;
  if (show) el.classList.remove("hidden");
  else el.classList.add("hidden");
}

function applySpiderManCostume(on) {
  if (state._spiderParts) {
    for (const p of state._spiderParts) {
      if (p.parent) p.parent.remove(p);
    }
  }
  state._spiderParts = [];
  state._spiderTails = [];
  if (!on) {
    if (state._ronFace) state._ronFace.visible = true;
    if (avHairRoot) avHairRoot.visible = true;
    if (typeof paintPlayerYellowSkin === "function") paintPlayerYellowSkin();
    return;
  }
  // Suit from drawing: RED + YELLOW + WHITE, bird on chest, spiky hair, FOUR tails on back
  const matRed = new THREE.MeshStandardMaterial({
    color: 0xdc2626, roughness: 0.45, metalness: 0.15, emissive: 0x7f1d1d, emissiveIntensity: 0.15, flatShading: false,
  });
  const matRedDeep = new THREE.MeshStandardMaterial({
    color: 0x991b1b, roughness: 0.5, metalness: 0.12, flatShading: false,
  });
  const matYellow = new THREE.MeshStandardMaterial({
    color: 0xfacc15, roughness: 0.4, metalness: 0.2, emissive: 0xca8a04, emissiveIntensity: 0.12, flatShading: false,
  });
  const matWhite = new THREE.MeshStandardMaterial({
    color: 0xf8fafc, roughness: 0.45, metalness: 0.1, flatShading: false,
  });
  const matBlack = new THREE.MeshStandardMaterial({
    color: 0x0f172a, roughness: 0.55, metalness: 0.1, flatShading: false,
  });
  const matEye = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const parts = [];
  const add = (parent, mesh) => {
    if (!parent || !mesh) return;
    parent.add(mesh);
    parts.push(mesh);
  };

  if (state._ronFace) state._ronFace.visible = false;
  if (avHairRoot) avHairRoot.visible = false;

  // ── BODY: red suit + yellow panels + white trim + BIRD on chest ──
  if (avTorso) {
    const suit = new THREE.Mesh(
      new THREE.BoxGeometry(TORSO_W * 1.14, TORSO_H * 1.1, TORSO_D * 1.18),
      matRed
    );
    add(avTorso, suit);
    // Yellow belly / mid panel
    const mid = new THREE.Mesh(
      new THREE.BoxGeometry(TORSO_W * 0.7, TORSO_H * 0.45, 0.08),
      matYellow
    );
    mid.position.set(0, -0.05, -TORSO_D / 2 - 0.05);
    add(avTorso, mid);
    // White side stripes
    for (const sx of [-1, 1]) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, TORSO_H * 0.85, TORSO_D * 0.55),
        matWhite
      );
      stripe.position.set(sx * (TORSO_W * 0.52), 0.02, 0);
      add(avTorso, stripe);
    }
    // White belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(TORSO_W * 1.15, 0.1, TORSO_D * 1.22), matWhite);
    belt.position.set(0, -TORSO_H * 0.42, 0);
    add(avTorso, belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.06), matYellow);
    buckle.position.set(0, -TORSO_H * 0.42, -TORSO_D / 2 - 0.06);
    add(avTorso, buckle);

    // ── BIRD emblem on chest (like the drawing) ──
    const birdG = new THREE.Group();
    birdG.position.set(0, TORSO_H * 0.12, -TORSO_D / 2 - 0.1);
    // Body
    const birdBody = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.06), matBlack);
    // Head
    const birdHead = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.06), matBlack);
    birdHead.position.set(0.12, 0.06, 0);
    // Beak (yellow)
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.05), matYellow);
    beak.position.set(0.2, 0.05, 0);
    // Wings
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.05), matWhite);
    wingL.position.set(-0.02, 0.02, 0.02);
    wingL.rotation.z = 0.45;
    const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.05), matWhite);
    wingR.position.set(-0.02, -0.04, 0.02);
    wingR.rotation.z = -0.35;
    // Tail feathers
    const bTail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.04), matYellow);
    bTail.position.set(-0.14, 0, 0);
    birdG.add(birdBody, birdHead, beak, wingL, wingR, bTail);
    add(avTorso, birdG);

    // ── FOUR tails on the BACK (curved like the drawing) ──
    const tails = [];
    const tailSpecs = [
      { x: -0.22, y: 0.25, z: TORSO_D / 2 + 0.08, rx: 0.35, ry: -0.55, segs: 5 },
      { x: 0.22, y: 0.25, z: TORSO_D / 2 + 0.08, rx: 0.35, ry: 0.55, segs: 5 },
      { x: -0.16, y: -0.15, z: TORSO_D / 2 + 0.08, rx: 0.55, ry: -0.35, segs: 5 },
      { x: 0.16, y: -0.15, z: TORSO_D / 2 + 0.08, rx: 0.55, ry: 0.35, segs: 5 },
    ];
    for (let ti = 0; ti < tailSpecs.length; ti++) {
      const ts = tailSpecs[ti];
      const root = new THREE.Group();
      root.position.set(ts.x, ts.y, ts.z);
      root.rotation.x = ts.rx;
      root.rotation.y = ts.ry;
      let parent = root;
      const joints = [];
      for (let s = 0; s < ts.segs; s++) {
        const joint = new THREE.Group();
        joint.position.set(0, 0, s === 0 ? 0 : 0.16);
        parent.add(joint);
        const thick = 0.1 - s * 0.012;
        const mat = s % 2 === 0 ? matRed : (s === ts.segs - 1 ? matYellow : matWhite);
        const seg = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, 0.18), mat);
        seg.position.z = 0.08;
        joint.add(seg);
        joints.push(joint);
        parent = joint;
        parts.push(seg);
      }
      add(avTorso, root);
      tails.push({ root, joints, phase: ti * 0.9 });
    }
    state._spiderTails = tails;
  }

  // ── HEAD: red mask, angry almond eyes, spiky crown hair ──
  if (avHead) {
    const mask = new THREE.Mesh(
      new THREE.BoxGeometry(HEAD_W * 1.22, HEAD_H * 1.08, HEAD_D * 1.22),
      matRed
    );
    add(avHead, mask);
    // White jaw / chin band
    const jaw = new THREE.Mesh(
      new THREE.BoxGeometry(HEAD_W * 1.05, HEAD_H * 0.28, HEAD_D * 1.05),
      matWhite
    );
    jaw.position.set(0, -HEAD_H * 0.28, 0);
    add(avHead, jaw);
    // Angry almond eyes (black slits like drawing)
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.05), matEye);
      eye.position.set(sx * 0.1, 0.1, -HEAD_D / 2 - 0.07);
      eye.rotation.z = sx * 0.2;
      eye.scale.set(1, 1.15, 1);
      add(avHead, eye);
      // Yellow eye rim
      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.03), matYellow);
      rim.position.set(sx * 0.1, 0.1, -HEAD_D / 2 - 0.05);
      rim.rotation.z = sx * 0.2;
      add(avHead, rim);
    }
    // Spiky crown / hair on top (like drawing spikes)
    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22 + (i % 2) * 0.08, 0.08), matYellow);
      spike.position.set((i - 2) * 0.1, HEAD_H * 0.55, -0.02 + (i % 2) * 0.04);
      spike.rotation.z = (i - 2) * 0.12;
      add(avHead, spike);
    }
    // Red side spikes
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.08), matRedDeep);
      side.position.set(sx * HEAD_W * 0.55, HEAD_H * 0.35, 0);
      side.rotation.z = sx * -0.4;
      add(avHead, side);
    }
  }

  // ── ARMS: red sleeves, yellow bands, white cuffs ──
  for (const sh of [avShoulderL, avShoulderR]) {
    if (!sh) continue;
    const sleeve = new THREE.Mesh(
      new THREE.BoxGeometry(ARM_W * 1.18, ARM_H * 0.98, ARM_D * 1.18),
      matRed
    );
    sleeve.position.set(0, -ARM_H * 0.48, 0);
    add(sh, sleeve);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(ARM_W * 1.22, 0.1, ARM_D * 1.22),
      matYellow
    );
    stripe.position.set(0, -ARM_H * 0.3, 0);
    add(sh, stripe);
    const cuff = new THREE.Mesh(
      new THREE.BoxGeometry(ARM_W * 1.2, 0.12, ARM_D * 1.2),
      matWhite
    );
    cuff.position.set(0, -ARM_H * 0.88, 0);
    add(sh, cuff);
  }

  // ── LEGS: red thigh + shin (bend with human run) + yellow stripe + white boots ──
  for (const leg of [avLegL, avLegR]) {
    if (!leg?.hip) continue;
    // Thigh cover (on hip — bends at hip)
    const thigh = new THREE.Mesh(
      new THREE.BoxGeometry(LEG_W * 1.2, THIGH_H * 1.05, TORSO_D * 1.0),
      matRed
    );
    thigh.position.set(0, -THIGH_H / 2, 0);
    add(leg.hip, thigh);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, THIGH_H * 0.9, TORSO_D * 0.55),
      matYellow
    );
    stripe.position.set(leg === avLegL ? -LEG_W * 0.55 : LEG_W * 0.55, -THIGH_H / 2, 0);
    add(leg.hip, stripe);
    // Shin cover (on knee — bends at knee like humans)
    if (leg.knee) {
      const shin = new THREE.Mesh(
        new THREE.BoxGeometry(LEG_W * 1.15, SHIN_H * 1.05, TORSO_D * 0.95),
        matRed
      );
      shin.position.set(0, -SHIN_H / 2, 0);
      add(leg.knee, shin);
      const shinStripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, SHIN_H * 0.85, TORSO_D * 0.5),
        matYellow
      );
      shinStripe.position.set(leg === avLegL ? -LEG_W * 0.52 : LEG_W * 0.52, -SHIN_H / 2, 0);
      add(leg.knee, shinStripe);
      // White boot on shin/ankle
      const boot = new THREE.Mesh(
        new THREE.BoxGeometry(LEG_W * 1.25, 0.26, TORSO_D * 1.1),
        matWhite
      );
      boot.position.set(0, -SHIN_H + 0.05, 0.05);
      add(leg.knee, boot);
      // Yellow boot toe
      const toe = new THREE.Mesh(new THREE.BoxGeometry(LEG_W * 0.9, 0.1, 0.12), matYellow);
      toe.position.set(0, -SHIN_H + 0.02, -TORSO_D * 0.35);
      add(leg.knee, toe);
    }
  }

  // Extra costume detail: white gloves on arms if present
  for (const sh of [avShoulderL, avShoulderR]) {
    if (!sh) continue;
    const glove = new THREE.Mesh(
      new THREE.BoxGeometry(ARM_W * 1.25, 0.16, ARM_D * 1.25),
      matWhite
    );
    glove.position.set(0, -ARM_H * 0.98, 0);
    add(sh, glove);
  }

  state._spiderParts = parts;
  state.hasSpiderSuit = true;
}

/** Y in Spider-Man game: stop attacking — heroes talk and show powers together */
function toggleSpiderFriendly() {
  if (!state.spiderGame) return;
  state.spiderFriendly = !state.spiderFriendly;
  state.spiderTalkTimer = 0;
  state.spiderPowerTimer = 0;
  state.spiderTalkI = 0;
  if (state.spiderFriendly) {
    const j = state.spiderJungle;
    const friends = enemies.filter(
      (e) =>
        e.alive &&
        e.group &&
        (e.kind === "hulk" ||
          e.kind === "captain" ||
          e.kind === "venom" ||
          e.kind === "human" ||
          e.kind === "spiderman")
    );
    friends.forEach((e, i) => {
      e.state = "friendly";
      e.attackCd = 99;
      if (j) {
        const ang = (i / Math.max(1, friends.length)) * Math.PI * 2;
        e._friendHome = {
          x: j.x + Math.cos(ang) * 8,
          z: j.z + Math.sin(ang) * 8,
        };
      }
    });
    toast("✌️ FRIENDS · they stop attacking · talk + powers! (Y again = fight)", "reward");
    playerSay("We're friends now!");
  } else {
    for (const e of enemies) {
      if (e.alive) {
        e.state = "patrol";
        e.attackCd = 0.5;
        e._friendHome = null;
      }
    }
    toast("⚔️ FIGHT MODE · they attack again! (Y = friends)", "quest");
    playerSay("Let's fight!");
  }
}

const SPIDER_TALKS = [
  { who: "RED HULK", text: "Hulk smash... for fun!" },
  { who: "SPIDER-MAN", text: "My spider-sense is tingling — friendly vibes!" },
  { who: "VENOM", text: "We are Venom... we like snacks." },
  { who: "CAP", text: "Avengers... assemble for a chat!" },
  { who: "RED HULK", text: "Your turn for powers, Cap!" },
  { who: "SPIDER-MAN", text: "Webs up — check this out!" },
  { who: "VENOM", text: "We can turn human... then back!" },
  { who: "CAP", text: "Shield toss — not at friends!" },
];

function updateSpiderFriendly(dt) {
  if (!state.spiderGame || !state.spiderFriendly) return;
  const friends = enemies.filter(
    (e) =>
      e.alive &&
      e.group &&
      (e.kind === "hulk" ||
        e.kind === "captain" ||
        e.kind === "venom" ||
        e.kind === "human" ||
        e.kind === "spiderman")
  );
  if (!friends.length) return;

  const j = state.spiderJungle;
  const cx = j ? j.x : player.pos.x;
  const cz = j ? j.z : player.pos.z;
  for (const e of friends) {
    e.attackCd = 99;
    e.state = "friendly";
    const hx = e._friendHome?.x ?? cx;
    const hz = e._friendHome?.z ?? cz;
    const dx = hx - e.group.position.x;
    const dz = hz - e.group.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.6) {
      e.group.position.x += (dx / d) * Math.min(e.speed * 0.7, 4) * dt;
      e.group.position.z += (dz / d) * Math.min(e.speed * 0.7, 4) * dt;
    }
    e.group.rotation.y = Math.atan2(cx - e.group.position.x, cz - e.group.position.z);
    e.bob += dt;
    e.group.position.y = groundY(e.group.position.x, e.group.position.z) + Math.sin(e.bob * 4) * 0.06;
  }

  state.spiderTalkTimer -= dt;
  if (state.spiderTalkTimer <= 0) {
    state.spiderTalkTimer = 3.2;
    const line = SPIDER_TALKS[state.spiderTalkI % SPIDER_TALKS.length];
    state.spiderTalkI++;
    toast(`${line.who}: "${line.text}"`, "quest");
  }

  state.spiderPowerTimer -= dt;
  if (state.spiderPowerTimer <= 0) {
    state.spiderPowerTimer = 2.4;
    if (friends.length < 2) return;
    const a = friends[Math.floor(Math.random() * friends.length)];
    let b = friends[Math.floor(Math.random() * friends.length)];
    if (b === a) b = friends[(friends.indexOf(a) + 1) % friends.length];
    const from = a.group.position.clone();
    from.y += 1.4;
    const to = b.group.position.clone();
    to.y += 1.4;
    const dir = to.clone().sub(from);
    const len = Math.max(0.5, dir.length());
    dir.normalize();
    let color = 0xfacc15;
    if (a.kind === "hulk") color = 0xdc2626;
    else if (a.kind === "captain") color = 0x3b82f6;
    else if (a.kind === "venom" || a.kind === "human") color = 0x111827;
    else if (a.kind === "spiderman") color = 0xef4444;
    const geo = new THREE.CylinderGeometry(0.06, 0.04, len, 12);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
    );
    mesh.position.copy(from).addScaledVector(dir, len * 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    scene.add(mesh);
    state.spiderWebs.push({ mesh, life: 0.55, max: 0.55 });
    if (typeof spawnHitSparks === "function") spawnHitSparks(to, 8, color);
    playTone(520, 0.06, "sine", 0.08);
  }
}

/** Melee fight punch — Bird Spider-Man combat */
function spiderFight() {
  if (!state.spiderGame) return;
  if (state.spiderFriendly) {
    toast("Friends mode — press Y to fight again", "");
    return;
  }
  if ((state.spiderFightCooldown || 0) > 0) return;
  state.spiderFightCooldown = 0.28;

  const origin = player.pos.clone();
  origin.y += player.height * 0.55;
  const dir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
  dir.y = -player.pitch * 0.3;
  dir.normalize();

  // Punch whoosh visual (red/yellow)
  const fist = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.28, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  );
  fist.position.copy(origin).addScaledVector(dir, 1.2);
  fist.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  scene.add(fist);
  state.spiderWebs.push({ mesh: fist, life: 0.18, max: 0.18 });

  // Hit nearby enemies in front
  let hit = 0;
  for (const e of enemies) {
    if (!e.alive || !e.group) continue;
    const to = e.group.position.clone().sub(player.pos);
    const dist = to.length();
    if (dist > 4.2) continue;
    to.y = 0;
    if (to.lengthSq() < 0.01) continue;
    to.normalize();
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
    if (to.dot(forward) < 0.25) continue;
    damageEnemy(e, 22);
    // Knockback
    e.group.position.x += forward.x * 1.4;
    e.group.position.z += forward.z * 1.4;
    spawnHitSparks(e.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 10, 0xdc2626);
    hit++;
  }
  playTone(220, 0.06, "square", 0.1);
  playTone(440, 0.05, "sawtooth", 0.07);
  if (hit > 0) {
    playerSay(["Fight!", "Bird power!", "Take that!"]);
    toast(`👊 Hit ${hit} foe${hit > 1 ? "s" : ""}!`, "kill");
  } else {
    playerSay("Hi-yah!");
  }
  // Small lunge
  player.vel.addScaledVector(dir, 4);
  player.vel.y += 1.5;
}

function shootSpiderWeb() {
  if (!state.spiderGame || state.spiderWebCooldown > 0) return;
  state.spiderWebCooldown = 0.22;
  const origin = player.pos.clone();
  origin.y += player.height * 0.72;
  const dir = new THREE.Vector3(0, 0, -1);
  dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
  dir.y = 0.12 - player.pitch * 0.65;
  dir.normalize();

  // Red/yellow web line
  const len = 12;
  const geo = new THREE.CylinderGeometry(0.03, 0.015, len, 12);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.95,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(origin).addScaledVector(dir, len * 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  scene.add(mesh);
  state.spiderWebs.push({ mesh, life: 0.5, max: 0.5 });

  player.vel.addScaledVector(dir, 9);
  player.vel.y += 4.5;
  if (player.vel.y > 12) player.vel.y = 12;
  const hSpd = Math.hypot(player.vel.x, player.vel.z);
  if (hSpd > 14) {
    player.vel.x = (player.vel.x / hSpd) * 14;
    player.vel.z = (player.vel.z / hSpd) * 14;
  }
  player.onGround = false;
  player.wasAirborne = true;
  player.parachuting = false;
  playTone(880, 0.05, "sine", 0.08);
  playTone(1200, 0.06, "triangle", 0.06);
  if (Math.random() < 0.35) playerSay("Web!");
}

function updateSpiderGame(dt) {
  if (!state.spiderGame) return;
  state.spiderWebCooldown = Math.max(0, state.spiderWebCooldown - dt);
  state.spiderFightCd = Math.max(0, (state.spiderFightCd || 0) - dt);
  state.spiderFightCooldown = Math.max(0, (state.spiderFightCooldown || 0) - dt);
  applyJungleAtmosphere(true);
  updateSpiderFriendly(dt);
  // Animate four back tails
  if (state._spiderTails) {
    for (const t of state._spiderTails) {
      t.phase = (t.phase || 0) + dt * 4.5;
      if (t.joints) {
        t.joints.forEach((j, i) => {
          j.rotation.x = Math.sin(t.phase + i * 0.55) * 0.22;
          j.rotation.y = Math.cos(t.phase * 0.8 + i * 0.4) * 0.15;
        });
      }
    }
  }
  // Space = fly
  if (state.keys["Space"] || state.keys["Spacebar"]) {
    player.vel.y += 32 * dt;
    if (player.vel.y > 18) player.vel.y = 18;
    player.onGround = false;
    player.parachuting = false;
  }
  // Soft keep-inside jungle radius
  if (state.spiderJungle) {
    const jx = state.spiderJungle.x;
    const jz = state.spiderJungle.z;
    const dx = player.pos.x - jx;
    const dz = player.pos.z - jz;
    const dist = Math.hypot(dx, dz);
    if (dist > SPIDER_JUNGLE_R - 4) {
      const s = (SPIDER_JUNGLE_R - 5) / dist;
      player.pos.x = jx + dx * s;
      player.pos.z = jz + dz * s;
      player.vel.x *= -0.3;
      player.vel.z *= -0.3;
    }
  }
  // Webs / punch / Cap shield projectiles
  for (let i = (state.spiderWebs || []).length - 1; i >= 0; i--) {
    const w = state.spiderWebs[i];
    w.life -= dt;
    if (w._capProj && w._dir && w.mesh) {
      w.mesh.position.x += w._dir.x * 28 * dt;
      w.mesh.position.z += w._dir.z * 28 * dt;
      w.mesh.rotation.z += dt * 14;
      // Hit player?
      if (!state.spiderFriendly) {
        const d = Math.hypot(w.mesh.position.x - player.pos.x, w.mesh.position.z - player.pos.z);
        if (d < 1.6) {
          damagePlayer(w._dmg || 10);
          w.life = 0;
          toast("Shield hit!", "kill");
        }
      }
    }
    if (w.mesh.material) {
      w.mesh.material.transparent = true;
      w.mesh.material.opacity = Math.max(0, w.life / w.max);
    }
    if (w.life <= 0) {
      scene.remove(w.mesh);
      state.spiderWebs.splice(i, 1);
    }
  }
  // Yellow-red trail while moving
  if (Math.random() < 0.18 && Math.hypot(player.vel.x, player.vel.y, player.vel.z) > 3) {
    const c = new THREE.Mesh(
      new THREE.SphereGeometry(0.14 + Math.random() * 0.1, 6, 5),
      new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? 0xdc2626 : 0xfacc15,
        transparent: true,
        opacity: 0.55,
      })
    );
    c.position.copy(player.pos);
    c.position.y += 0.4;
    scene.add(c);
    particles.push({
      mesh: c,
      life: 0.45,
      max: 0.45,
      vel: new THREE.Vector3((Math.random() - 0.5) * 2, 1.2, (Math.random() - 0.5) * 2),
      type: "spark",
    });
  }
}



/**
 * Press D near Michael: he drives the Iron Man rocket for 102 seconds.
 */
function startMichaelJoyride() {
  if (state.michaelJoyride) {
    toast(`Michael is already flying! ${Math.ceil(state.michaelJoyrideLeft)}s left`, "quest");
    return;
  }
  if (state.rocketTrial) {
    toast("Finish your rocket TRY first (DONE)", "");
    return;
  }
  const m = nearestMichael(28) || state.michaelGarage;
  const rocket = (m && m.rocket) || state.ironManRocket;
  if (!rocket || !rocket.group) {
    toast("Michael's rocket isn't ready", "kill");
    return;
  }
  if (state.inVehicle && state.vehicle === rocket) {
    toast("You're in the rocket — exit first (E)", "");
    return;
  }
  if (rocket.occupied && state.vehicle !== rocket) {
    toast("Rocket is busy", "");
    return;
  }

  // Park then launch with Michael as pilot
  parkIronManRocketHome(m);
  rocket.locked = false;
  rocket.occupied = true; // block player boarding mid-show
  rocket.crashing = false;
  if (rocket.vel) rocket.vel.set(0, 0, 0);
  rocket.speed = 0;
  rocket.pitch = 0.25;

  // Hide Michael at workbench; put him (or a pilot clone) on the rocket
  if (m && m.root) {
    m.root.visible = false;
    m._joyrideHidden = true;
  }
  // Simple pilot figure on rocket if none
  if (!rocket.michaelPilot) {
    const pilot = new THREE.Group();
    const matR = new THREE.MeshStandardMaterial({
      color: 0xb91c1c, emissive: 0x7f1d1d, emissiveIntensity: 0.2, flatShading: false,
    });
    const matG = new THREE.MeshStandardMaterial({
      color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.3, flatShading: false,
    });
    const matSkin = new THREE.MeshStandardMaterial({ color: 0x8b1a1a, flatShading: false });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.35), matR);
    body.position.y = 0.4;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.28), matSkin);
    head.position.y = 0.85;
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.3), matR);
    helm.position.y = 0.9;
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.06), matG);
    face.position.set(0, 0.88, -0.16);
    const eyes = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.04, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc })
    );
    eyes.position.set(0, 0.92, -0.18);
    pilot.add(body, head, helm, face, eyes);
    pilot.position.set(0, -0.35, 0.9);
    pilot.scale.setScalar(0.55);
    rocket.group.add(pilot);
    rocket.michaelPilot = pilot;
  }
  rocket.michaelPilot.visible = true;

  state.michaelJoyride = true;
  state.michaelJoyrideLeft = MICHAEL_JOYRIDE_SECONDS;
  state.michaelJoyrideRocket = rocket;
  state.michaelJoyrideM = m;
  state.michaelJoyrideAngle = 0;
  state.michaelJoyrideHome = getMichaelRocketHome(m);

  state.speechQueue.push({
    text: `Watch this! I'm flying my Iron Man rocket for ${MICHAEL_JOYRIDE_SECONDS} seconds — Michael Builder at the wheel!`,
    who: "michael",
  });
  if (!state.speechShowing) advanceSpeech();
  toast(`🚀 Michael is flying! ${MICHAEL_JOYRIDE_SECONDS}s joyride`, "reward");
  playerSay("Go Michael!");
  showMichaelJoyrideUI(true);
  updateMichaelJoyrideUI();
}

function showMichaelJoyrideUI(show) {
  const el = $("michael-joyride");
  if (!el) return;
  if (show) el.classList.remove("hidden");
  else el.classList.add("hidden");
}

function updateMichaelJoyrideUI() {
  const t = $("michael-joyride-time");
  if (t) t.textContent = Math.max(0, Math.ceil(state.michaelJoyrideLeft));
}

function endMichaelJoyride() {
  if (!state.michaelJoyride) return;
  const rocket = state.michaelJoyrideRocket || state.ironManRocket;
  const m = state.michaelJoyrideM || state.michaelGarage;
  state.michaelJoyride = false;
  state.michaelJoyrideLeft = 0;
  showMichaelJoyrideUI(false);

  if (rocket) {
    rocket.occupied = false;
    rocket.speed = 0;
    rocket.pitch = 0.08;
    if (rocket.vel) rocket.vel.set(0, 0, 0);
    if (rocket.michaelPilot) rocket.michaelPilot.visible = false;
    if (rocket.fires) {
      for (const f of rocket.fires) {
        if (f.group) f.group.visible = false;
      }
    }
    if (!state.rocketOwned && !state.rocketTrial) rocket.locked = true;
    parkIronManRocketHome(m);
  }
  if (m && m.root && m._joyrideHidden) {
    m.root.visible = true;
    m._joyrideHidden = false;
  }
  state.speechQueue.push({
    text: "Whew! That was a full 102-second flight. Rocket's back home. Press D anytime near me to watch again!",
    who: "michael",
  });
  if (!state.speechShowing) advanceSpeech();
  toast("✅ Michael landed — rocket back at the garage", "reward");
}

function updateMichaelJoyride(dt) {
  if (!state.michaelJoyride) return;
  state.michaelJoyrideLeft -= dt;
  updateMichaelJoyrideUI();
  const rocket = state.michaelJoyrideRocket;
  if (!rocket || !rocket.group) {
    endMichaelJoyride();
    return;
  }
  const home = state.michaelJoyrideHome || getMichaelRocketHome();
  // Fly a big sky loop near Michael's workshop / coast
  state.michaelJoyrideAngle = (state.michaelJoyrideAngle || 0) + dt * 0.42;
  const a = state.michaelJoyrideAngle;
  const cx = home.x;
  const cz = home.z;
  const R = 55;
  const px = cx + Math.cos(a) * R;
  const pz = cz + Math.sin(a) * R * 0.65;
  const py = (home.y || 2) + 18 + Math.sin(a * 2) * 8 + Math.sin(a * 0.5) * 4;
  // Smooth move
  const g = rocket.group;
  g.position.x += (px - g.position.x) * Math.min(1, 3 * dt);
  g.position.y += (py - g.position.y) * Math.min(1, 2.5 * dt);
  g.position.z += (pz - g.position.z) * Math.min(1, 3 * dt);
  // Face tangent of path
  const yaw = a + Math.PI / 2;
  rocket.yaw = yaw;
  g.rotation.order = "YXZ";
  g.rotation.y = yaw;
  g.rotation.x = -0.15 + Math.sin(a * 2) * 0.12;
  g.rotation.z = Math.sin(a) * 0.1;
  rocket.speed = 40;
  // Engine fire on
  if (rocket.fires) {
    for (const f of rocket.fires) {
      if (f.group) f.group.visible = true;
      if (f.outer) f.outer.scale.set(1.1, 1.1, 1.4 + Math.random() * 0.4);
    }
  } else if (rocket.flame) {
    rocket.flame.visible = true;
  }
  if (state.michaelJoyrideLeft <= 0) endMichaelJoyride();
}

function talkToMichael() {
  const m = nearestMichael();
  if (!m) return;
  state.michaelOffer = true;
  state.speechQueue.length = 0;
  state.speechShowing = false;
  state.speechQueue.push({
    text: `Hey! I'm Michael. Want a big bowl of spaghetti and meatballs? Press 1 — pick it up and eat it! Press 2 for the rocket. That's the main stuff.`,
    who: "michael",
  });
  advanceSpeech();
  toast(
    `🔧 [1] 🍝 Spaghetti & meatballs · [2] Rocket · (suits later)`,
    "quest"
  );
}

const ROCKET_TRIAL_SECONDS = 20;

function getMichaelRocketHome(m) {
  m = m || state.michaelGarage || nearestMichael(40);
  const rocket = (m && m.rocket) || state.ironManRocket;
  if (rocket && rocket.homeX != null) {
    return { x: rocket.homeX, y: rocket.homeY, z: rocket.homeZ, yaw: rocket.homeYaw ?? Math.PI, m, rocket };
  }
  if (m) {
    return { x: m.gx, y: m.gy + 1.7, z: m.gz - 9, yaw: Math.PI, m, rocket };
  }
  return { x: -85, y: 2, z: 19, yaw: Math.PI, m: null, rocket };
}

/** Park Iron Man rocket at Michael's apron (where it belongs) */
function parkIronManRocketHome(m) {
  const home = getMichaelRocketHome(m);
  const rocket = home.rocket;
  if (!rocket || !rocket.group) return home;
  rocket.group.position.set(home.x, home.y, home.z);
  rocket.group.rotation.order = "YXZ";
  rocket.group.rotation.set(-0.08, home.yaw, 0);
  rocket.group.scale.setScalar(1.15);
  rocket.yaw = home.yaw;
  rocket.pitch = 0.08;
  rocket.speed = 0;
  if (rocket.vel) rocket.vel.set(0, 0, 0);
  rocket.crashing = false;
  rocket.occupied = false;
  if (rocket.flame) rocket.flame.visible = false;
  if (rocket.flameMid) rocket.flameMid.visible = false;
  if (rocket.flameInner) rocket.flameInner.visible = false;
  if (rocket.flameGlow) rocket.flameGlow.visible = false;
  if (rocket.pilot) rocket.pilot.visible = false;
  // Keep home coords fresh
  rocket.homeX = home.x;
  rocket.homeY = home.y;
  rocket.homeZ = home.z;
  rocket.homeYaw = home.yaw;
  return home;
}

function showRocketOfferUI(show) {
  const el = $("rocket-offer");
  if (!el) return;
  if (show) el.classList.remove("hidden");
  else el.classList.add("hidden");
}

function showRocketTrialUI(show) {
  const el = $("rocket-trial");
  if (!el) return;
  if (show) el.classList.remove("hidden");
  else el.classList.add("hidden");
}

function updateRocketTrialUI() {
  const t = $("rocket-trial-time");
  if (t) t.textContent = Math.max(0, Math.ceil(state.rocketTrialLeft));
}

/** BUY with green coins (game real money) — keep forever */
function buyIronManRocket(m) {
  m = m || nearestMichael(18) || state.michaelGarage;
  const rocket = (m && m.rocket) || state.ironManRocket;
  const price = MICHAEL_ROCKET_PRICE;
  state.michaelRocketChoice = false;
  showRocketOfferUI(false);
  state.michaelOffer = false;

  if (state.rocketOwned) {
    toast("You already own the Iron Man rocket!", "");
    return;
  }
  if (state.coins < price) {
    state.speechQueue.push({
      text: `Buying costs ${price} green coins (real money in the game). You only have ${state.coins}. Or press 2 then T to TRY free for 20 seconds!`,
      who: "michael",
    });
    if (!state.speechShowing) advanceSpeech();
    toast(`Need ${price}🟢 to BUY (or TRY free with T)`, "kill");
    // Re-open choice so they can still try
    state.michaelRocketChoice = true;
    state.michaelOffer = true;
    showRocketOfferUI(true);
    return;
  }
  addCoins(-price);
  state.rocketOwned = true;
  state.rocketTrial = false;
  state.rocketTrialLeft = 0;
  showRocketTrialUI(false);
  const home = parkIronManRocketHome(m);
  if (rocket) {
    rocket.locked = false;
    rocket.owned = true;
  }
  state.speechQueue.push({
    text: "Sold! The Iron Man rocket is yours forever — parked outside my garage where it belongs. Press E anytime!",
    who: "michael",
  });
  if (!state.speechShowing) advanceSpeech();
  toast(`🚀 BOUGHT Iron Man rocket! −${price}🟢 · yours forever`, "reward");
  playerSay("I bought the rocket!");
  // Board immediately at home
  if (!state.inVehicle && rocket) {
    setTimeout(() => {
      if (!state.inVehicle && rocket) enterVehicle(rocket);
    }, 120);
  }
  updateHUD();
}

/** TRY free for 20 seconds — must bring back + Done */
function startIronManRocketTrial(m) {
  m = m || nearestMichael(18) || state.michaelGarage;
  const rocket = (m && m.rocket) || state.ironManRocket;
  state.michaelRocketChoice = false;
  showRocketOfferUI(false);
  state.michaelOffer = false;

  if (state.rocketOwned) {
    toast("You already own it — no need to try!", "reward");
    return;
  }
  if (!rocket) {
    toast("Rocket not ready", "kill");
    return;
  }
  // Cancel any mid-flight crash state
  rocket.crashing = false;
  parkIronManRocketHome(m);
  rocket.locked = false;
  state.rocketTrial = true;
  state.rocketTrialLeft = ROCKET_TRIAL_SECONDS;
  showRocketTrialUI(true);
  updateRocketTrialUI();

  state.speechQueue.push({
    text: `Free TRY for ${ROCKET_TRIAL_SECONDS} seconds! Fly the Iron Man rocket, then bring it back to my garage and click DONE. When you're done you'll appear where the rocket belongs.`,
    who: "michael",
  });
  if (!state.speechShowing) advanceSpeech();
  toast(`🚀 FREE TRY · ${ROCKET_TRIAL_SECONDS}s · fly it, bring it back, click DONE`, "quest");
  playerSay("Trying the rocket!");

  if (!state.inVehicle) {
    setTimeout(() => {
      if (state.rocketTrial && rocket && !state.inVehicle) enterVehicle(rocket);
    }, 100);
  }
  updateHUD();
}

/**
 * End try (Done button or timer) — rocket + player return to Michael parking.
 */
function endIronManRocketTrial(reason = "done") {
  if (!state.rocketTrial && reason !== "force") return;
  const wasTrial = state.rocketTrial;
  state.rocketTrial = false;
  state.rocketTrialLeft = 0;
  showRocketTrialUI(false);
  showRocketOfferUI(false);
  state.michaelRocketChoice = false;

  // Exit vehicle without crash
  if (state.inVehicle && state.vehicle) {
    const v = state.vehicle;
    unseatPlayerFromCraft();
    closeRocketCinema();
    v.occupied = false;
    if (v.flame) v.flame.visible = false;
    if (v.flameMid) v.flameMid.visible = false;
    if (v.flameInner) v.flameInner.visible = false;
    if (v.flameGlow) v.flameGlow.visible = false;
    if (v.pilot) v.pilot.visible = false;
    state.inVehicle = false;
    state.vehicle = null;
    weaponGroup.visible = true;
    $("speedo")?.classList.add("hidden");
  }

  const home = parkIronManRocketHome(state.michaelGarage);
  const rocket = home.rocket;
  // If not owned, lock again
  if (rocket && !state.rocketOwned) {
    rocket.locked = true;
    rocket.owned = false;
  }

  // Player appears next to where the rocket/plane belongs
  player.pos.set(home.x + 3.2, walkHeight(home.x + 3.2, home.z) + 0.1, home.z + 1.2);
  player.vel.set(0, 0, 0);
  player.yaw = Math.atan2(home.x - player.pos.x, home.z - player.pos.z);
  player.onGround = true;
  player.parachuting = false;
  player.sleeping = false;

  if (wasTrial || reason === "force") {
    if (reason === "timeout") {
      toast("⏰ Try time over! Rocket returned to Michael's — press 2 to BUY or TRY again", "quest");
      playerSay("Time's up!");
      state.speechQueue.push({
        text: "Time's up on the free try! Rocket is back where it belongs. Press 2 — B to BUY with green coins, or T to TRY again.",
        who: "michael",
      });
    } else {
      toast("✅ DONE! You're back at Michael's where the rocket belongs", "reward");
      playerSay("Done with the try!");
      state.speechQueue.push({
        text: "Nice flying! Rocket is parked back home. Want to BUY it with green coins (press 2 then B) or TRY again (2 then T)?",
        who: "michael",
      });
    }
    if (!state.speechShowing) advanceSpeech();
  }
  updateHUD();
}

function updateRocketTrial(dt) {
  if (!state.rocketTrial) return;
  state.rocketTrialLeft -= dt;
  updateRocketTrialUI();
  if (state.rocketTrialLeft <= 0) {
    endIronManRocketTrial("timeout");
  }
}

/** choice: "jello" | "rocket" | "rocketBuy" | "rocketTry" | "mask" | suits | "no" */
function answerMichael(choice) {
  const m = nearestMichael(18);
  if (!m) return;
  state.michaelOffer = false;

  // Spaghetti & meatballs — main food (Digit 1)
  if (choice === "spaghetti" || choice === "jello") {
    if (state.eatAnim) {
      toast("Finish eating first!", "");
      return;
    }
    if (state.coins < MICHAEL_SPAGHETTI_PRICE) {
      state.speechQueue.push({
        text: `Spaghetti and meatballs is ${MICHAEL_SPAGHETTI_PRICE} green coins. You only have ${state.coins}.`,
        who: "michael",
      });
      if (!state.speechShowing) advanceSpeech();
      toast(`Need ${MICHAEL_SPAGHETTI_PRICE}🟢 for spaghetti`, "kill");
      return;
    }
    addCoins(-MICHAEL_SPAGHETTI_PRICE);
    state.speechQueue.push({
      text: "One giant bowl of spaghetti and meatballs! Pick it up — eat every bite!",
      who: "michael",
    });
    if (!state.speechShowing) advanceSpeech();
    startEatSpaghettiBowl();
    toast(`🍝 Spaghetti & meatballs! Hold the bowl · eat it · −${MICHAEL_SPAGHETTI_PRICE}🟢`, "reward");
    updateHUD();
    return;
  }

  // Step 1: open BUY vs TRY choice (not instant buy / not bye)
  if (choice === "rocket") {
    if (state.rocketOwned) {
      state.speechQueue.push({
        text: "You already own the Iron Man rocket — it's parked outside. Press E anytime!",
        who: "michael",
      });
      if (!state.speechShowing) advanceSpeech();
      parkIronManRocketHome(m);
      const rocket = m.rocket || state.ironManRocket;
      if (rocket) rocket.locked = false;
      toast("🚀 You own it — press E to board outside!", "reward");
      return;
    }
    if (state.rocketTrial) {
      toast("You're already on a free TRY! Fly back and press DONE when finished.", "quest");
      return;
    }
    // Stay in offer mode — wait for B (buy) or T (try)
    state.michaelOffer = true;
    state.michaelRocketChoice = true;
    state.speechQueue.length = 0;
    state.speechShowing = false;
    state.speechQueue.push({
      text: `Iron Man rocket — TWO OPTIONS only. Press B to BUY with green coins (real money in the game: ${MICHAEL_ROCKET_PRICE}🟢), or press T to TRY it free for 20 seconds. After your try, bring it back here and click DONE — you'll appear where the rocket belongs.`,
      who: "michael",
    });
    advanceSpeech();
    toast(`🚀 [B] BUY ${MICHAEL_ROCKET_PRICE}🟢   or   [T] TRY free 20s — then bring it back & DONE`, "quest");
    showRocketOfferUI(true);
    return;
  }

  if (choice === "rocketBuy") {
    buyIronManRocket(m);
    return;
  }
  if (choice === "rocketTry") {
    startIronManRocketTrial(m);
    return;
  }

  if (choice === "mask") {
    if (state.gems < MICHAEL_MASK_PRICE) {
      state.speechQueue.push({
        text: `The Iron Man mask needs ${MICHAEL_MASK_PRICE} crystals. You have ${state.gems}.`,
        who: "michael",
      });
      if (!state.speechShowing) advanceSpeech();
      toast(`Need ${MICHAEL_MASK_PRICE} crystals 💎 (you have ${state.gems})`, "kill");
      return;
    }
    if (m.hasMask === false) {
      toast("You already bought the mask!", "");
      return;
    }
    addGems(-MICHAEL_MASK_PRICE);
    m.hasMask = false;
    if (m.maskDisplay) m.maskDisplay.visible = false;
    applyIronManMask(true);
    state.speechQueue.push({
      text: "Looking sharp! That's my Iron Man mask.",
      who: "michael",
    });
    if (!state.speechShowing) advanceSpeech();
    playerSay("Awesome mask!");
    toast(`🎭 Iron Man mask equipped! −${MICHAEL_MASK_PRICE} 💎`, "reward");
    updateHUD();
    return;
  }

  // Costumes — paid with UNIQUE purple gems only
  if (choice === "mark3" || choice === "gold" || choice === "warmachine" || choice === "dino") {
    buyMichaelSuit(choice, m);
    return;
  }

  state.michaelRocketChoice = false;
  showRocketOfferUI(false);
  state.speechQueue.push({ text: "Alright, come back when you're ready. Press 2 for the rocket — B to buy or T to try.", who: "michael" });
  if (!state.speechShowing) advanceSpeech();
  toast("Maybe later. Press 2 for rocket BUY or TRY.", "");
}

/** Buy an Iron Man costume with unique purple gems */
function buyMichaelSuit(suitKey, m) {
  m = m || nearestMichael(18);
  if (!m || !m.suits || !m.suits[suitKey]) return;
  const suit = m.suits[suitKey];
  if (suit.sold) {
    toast(`${suit.name} suit already sold!`, "");
    state.speechQueue.push({ text: `You already bought the ${suit.name} suit!`, who: "michael" });
    if (!state.speechShowing) advanceSpeech();
    return;
  }
  if (state.purpleGems < suit.price) {
    state.speechQueue.push({
      text: `The ${suit.name} costume needs ${suit.price} unique purple gems. You only have ${state.purpleGems}. Hunt purple diamonds around the world!`,
      who: "michael",
    });
    if (!state.speechShowing) advanceSpeech();
    toast(`Need ${suit.price} unique 💜 gems (you have ${state.purpleGems})`, "kill");
    return;
  }
  addPurpleGems(-suit.price);
  suit.sold = true;
  if (suit.mesh) suit.mesh.visible = false; // take suit off the mannequin
  if (suitKey === "dino") {
    applyDinosaurCostume(true);
    state.speechQueue.push({
      text: `ROAR! The expensive green dinosaur costume is yours — ${suit.price} purple gems well spent!`,
      who: "michael",
    });
    playerSay("Dino power!");
    toast(`🦕 GREEN DINOSAUR costume! −${suit.price} 💜 (expensive!)`, "reward");
  } else {
    applyIronManSuit(suitKey);
    state.speechQueue.push({
      text: `Boom! The ${suit.name} Iron Man costume is yours — forged with unique purple gems. Wear it proud!`,
      who: "michael",
    });
    playerSay(`${suit.name} suit on!`);
    toast(`🦾 ${suit.name.toUpperCase()} costume equipped! −${suit.price} 💜`, "reward");
  }
  progressQuest("suit", 1);
  if (!state.speechShowing) advanceSpeech();
  updateHUD();
}

/** Expensive green dinosaur costume on Ron */
function applyDinosaurCostume(on) {
  // Clear iron suit overlays
  if (state._ironSuitParts) {
    for (const p of state._ironSuitParts) {
      if (p.parent) p.parent.remove(p);
    }
    state._ironSuitParts = [];
  }
  if (state._dinoParts) {
    for (const p of state._dinoParts) {
      if (p.parent) p.parent.remove(p);
    }
  }
  state._dinoParts = [];
  if (!on) {
    state.ironManSuit = null;
    if (typeof paintPlayerYellowSkin === "function") paintPlayerYellowSkin();
    return;
  }
  state.ironManSuit = "dino";
  applyIronManMask(false);

  const matG = new THREE.MeshStandardMaterial({
    color: 0x22c55e, roughness: 0.7, metalness: 0.05, flatShading: false,
  });
  const matD = new THREE.MeshStandardMaterial({
    color: 0x15803d, roughness: 0.75, metalness: 0.05, flatShading: false,
  });
  const matBelly = new THREE.MeshStandardMaterial({
    color: 0x86efac, roughness: 0.85, metalness: 0.0, flatShading: false,
  });
  const matEye = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const matPup = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
  const matTooth = new THREE.MeshStandardMaterial({ color: 0xf8fafc, flatShading: false });

  if (avTorso) {
    avTorso.material = matG.clone();
    const belly = new THREE.Mesh(
      new THREE.BoxGeometry(TORSO_W * 0.7, TORSO_H * 0.55, 0.08),
      matBelly
    );
    belly.position.set(0, -0.05, -TORSO_D / 2 - 0.02);
    avTorso.add(belly);
    state._dinoParts.push(belly);
    // Back spikes
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.12), matD);
      sp.position.set(0, 0.2 - i * 0.12, TORSO_D / 2 + 0.06);
      avTorso.add(sp);
      state._dinoParts.push(sp);
    }
  }
  if (avHead) {
    const snout = new THREE.Mesh(
      new THREE.BoxGeometry(HEAD_W * 0.7, HEAD_H * 0.35, 0.22),
      matD
    );
    snout.position.set(0, -0.08, -HEAD_D / 2 - 0.1);
    const crest = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.22, 0.14),
      matD
    );
    crest.position.set(0, HEAD_H * 0.4, 0.05);
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.04), matEye);
      e.position.set(sx * 0.1, 0.1, -HEAD_D / 2 - 0.02);
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.03), matPup);
      p.position.set(sx * 0.1, 0.1, -HEAD_D / 2 - 0.04);
      avHead.add(e, p);
      state._dinoParts.push(e, p);
    }
    // Teeth
    for (let i = -1; i <= 1; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.04), matTooth);
      tooth.position.set(i * 0.07, -0.18, -HEAD_D / 2 - 0.16);
      avHead.add(tooth);
      state._dinoParts.push(tooth);
    }
    avHead.add(snout, crest);
    state._dinoParts.push(snout, crest);
    // Head block stays YELLOW under dino accessories
    if (typeof paintPlayerYellowSkin === "function") paintPlayerYellowSkin();
  }
  // Tail on body
  if (avBody) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.55), matG);
    tail.position.set(0, HIP_Y + 0.35, TORSO_D * 0.9);
    tail.rotation.x = -0.4;
    avBody.add(tail);
    state._dinoParts.push(tail);
  }
  toast("🦕 Green dinosaur costume online — ROAR!", "reward");
}

function addPurpleGems(n) {
  state.purpleGems = Math.max(0, (state.purpleGems || 0) + n);
  updateHUD();
}

/** Equip full Iron Man costume colors on Ron's block body */
function applyIronManSuit(suitKey) {
  // Remove previous suit overlays + dino costume
  if (state._ironSuitParts) {
    for (const p of state._ironSuitParts) {
      if (p.parent) p.parent.remove(p);
    }
  }
  state._ironSuitParts = [];
  if (state._dinoParts) {
    for (const p of state._dinoParts) {
      if (p.parent) p.parent.remove(p);
    }
    state._dinoParts = [];
  }
  // Keep base head/arms yellow under armor
  if (typeof paintPlayerYellowSkin === "function") paintPlayerYellowSkin();
  state.ironManSuit = suitKey;

  let main = 0xb91c1c;
  let gold = 0xfbbf24;
  let name = "Mark 3";
  if (suitKey === "gold") {
    main = 0xfbbf24;
    gold = 0xfde68a;
    name = "Gold";
  } else if (suitKey === "warmachine") {
    main = 0x9f1239;
    gold = 0x64748b;
    name = "War Machine";
  }

  const matR = new THREE.MeshStandardMaterial({
    color: main, emissive: main, emissiveIntensity: 0.25,
    roughness: 0.35, metalness: 0.75, flatShading: false,
  });
  const matG = new THREE.MeshStandardMaterial({
    color: gold, emissive: gold, emissiveIntensity: 0.3,
    roughness: 0.3, metalness: 0.85, flatShading: false,
  });
  const matEye = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
  const matArc = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  // Repaint body blocks into suit armor
  if (avTorso && avTorso.material) {
    avTorso.material = matR.clone();
  }
  // Helmet over head
  if (avHead) {
    const helm = new THREE.Mesh(
      new THREE.BoxGeometry(HEAD_W * 1.2, HEAD_H * 1.05, HEAD_D * 1.2),
      matR.clone()
    );
    helm.position.set(0, 0.02, 0.02);
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(HEAD_W * 0.9, HEAD_H * 0.45, 0.08),
      matG.clone()
    );
    face.position.set(0, 0.05, -HEAD_D / 2 - 0.05);
    const eL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.04), matEye);
    eL.position.set(-0.1, 0.12, -HEAD_D / 2 - 0.07);
    const eR = eL.clone();
    eR.position.x = 0.1;
    avHead.add(helm, face, eL, eR);
    state._ironSuitParts.push(helm, face, eL, eR);
  }
  // Chest arc reactor on torso
  if (avTorso) {
    const arc = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12), matArc);
    arc.rotation.x = Math.PI / 2;
    arc.position.set(0, 0.08, -TORSO_D / 2 - 0.02);
    avTorso.add(arc);
    const chestPlate = new THREE.Mesh(
      new THREE.BoxGeometry(TORSO_W * 0.75, TORSO_H * 0.4, 0.06),
      matG.clone()
    );
    chestPlate.position.set(0, 0.12, -TORSO_D / 2 - 0.01);
    avTorso.add(chestPlate);
    state._ironSuitParts.push(arc, chestPlate);
  }
  // Shoulder pads
  for (const side of [-1, 1]) {
    const shoulder = side < 0 ? avShoulderL : avShoulderR;
    if (!shoulder) continue;
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(ARM_W * 1.15, 0.18, ARM_D * 1.15),
      matG.clone()
    );
    pad.position.set(0, 0.02, 0);
    shoulder.add(pad);
    state._ironSuitParts.push(pad);
  }
  // Matching helmet faceplate
  applyIronManMask(true);
  toast(`🦾 ${name} armor online`, "reward");
}

/** Equip gold Iron Man mask on Ron */
function applyIronManMask(on) {
  if (state._ironMaskParts) {
    for (const p of state._ironMaskParts) {
      if (p.parent) p.parent.remove(p);
    }
  }
  state._ironMaskParts = [];
  if (state._ronFace && !state.hasPirateGear) state._ronFace.visible = !on;
  if (!on || !avHead) return;
  const matGold = new THREE.MeshLambertMaterial({
    color: 0xfbbf24,
    emissive: 0xb45309,
    emissiveIntensity: 0.35,
    flatShading: false,
  });
  const matGoldDark = new THREE.MeshLambertMaterial({ color: 0xb45309, flatShading: false });
  const matEye = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const helm = new THREE.Mesh(new THREE.BoxGeometry(HEAD_W * 1.15, HEAD_H * 0.95, HEAD_D * 1.15), matGold);
  helm.position.set(0, 0.02, 0.02);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(HEAD_W * 0.85, HEAD_H * 0.5, 0.08), matGoldDark);
  plate.position.set(0, 0.02, -HEAD_D / 2 - 0.04);
  const eL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.04), matEye);
  eL.position.set(-0.1, 0.1, -HEAD_D / 2 - 0.06);
  const eR = eL.clone();
  eR.position.x = 0.1;
  avHead.add(helm, plate, eL, eR);
  state._ironMaskParts = [helm, plate, eL, eR];
  state.hasIronMask = true;
}

/** Wooden boat that floats on the ocean */
function spawnBoat(x, z) {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 4.2), blockMats.boat);
  hull.position.y = 0.15;
  const hullFront = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.4, 4), blockMats.boat);
  hullFront.rotation.x = -Math.PI / 2;
  hullFront.position.set(0, 0.15, 2.4);
  hullFront.scale.set(1, 0.55, 0.6);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 2.8), blockMats.boatAccent);
  deck.position.y = 0.4;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 12), blockMats.boat);
  mast.position.set(0, 1.9, 0);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), blockMats.boatSail);
  sail.position.set(0.05, 1.8, 0.2);
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.2, 0.4), blockMats.boat);
  bench.position.set(0, 0.55, -0.3);
  group.add(hull, hullFront, deck, mast, sail, bench);
  group.position.set(x, WATER_SURFACE + 0.15, z);
  scene.add(group);

  vehicles.push({
    group,
    wheels: [],
    type: "boat",
    color: 0x92400e,
    speed: 0,
    yaw: 0,
    maxSpeed: 22,
    accel: 14,
    turn: 1.6,
    occupied: false,
    flame: null,
    flameInner: null,
  });
}

/** Build layered hot engine fire: blue core → white → yellow → orange outer */
/** Pirate captain who drives a boat along the coastline */
function spawnPirateBoatCaptain(x, z) {
  const root = new THREE.Group();
  // Build a boat hull
  const matWood = new THREE.MeshLambertMaterial({ color: 0x8b5a2b, flatShading: false });
  const matDark = new THREE.MeshLambertMaterial({ color: 0x5c3d1e, flatShading: false });
  const matSail = new THREE.MeshLambertMaterial({ color: 0xf5f0e6, flatShading: false, side: THREE.DoubleSide });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 4.8), matWood);
  hull.position.y = 0.25;
  const bow = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 1.2), matDark);
  bow.position.set(0, 0.3, -2.6);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 12), matDark);
  mast.position.set(0, 2.0, 0.2);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.2), matSail);
  sail.position.set(0.15, 1.9, 0.2);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 3.2), matDark);
  deck.position.y = 0.55;
  root.add(hull, bow, mast, sail, deck);

  // Pirate (simple) sitting at helm — no wheelchair
  const matCoat = new THREE.MeshLambertMaterial({ color: 0x1a2744, flatShading: false });
  const matTrim = new THREE.MeshLambertMaterial({ color: 0xc9a227, flatShading: false });
  const matSkin = new THREE.MeshLambertMaterial({ color: 0xf0c4a0, flatShading: false });
  const matOcto = new THREE.MeshLambertMaterial({ color: 0x22c55e, flatShading: false });
  const matOctoD = new THREE.MeshLambertMaterial({ color: 0x15803d, flatShading: false });
  const matHat = new THREE.MeshLambertMaterial({ color: 0x0f0f0f, flatShading: false });
  const matSash = new THREE.MeshLambertMaterial({ color: 0xb91c1c, flatShading: false });

  const person = new THREE.Group();
  person.position.set(0, 0.9, 0.9);
  // Body
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.4), matCoat);
  torso.position.y = 0.55;
  const sash = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.42), matSash);
  sash.position.y = 0.28;
  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 14), matSkin);
  neck.position.y = 0.95;
  // Octopus head + neck connection
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), matOcto);
  head.position.y = 1.28;
  // Face
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), matOcto);
  face.position.set(0, 1.22, -0.22);
  face.scale.set(1.1, 1, 0.7);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    eye.position.set(sx * 0.1, 1.3, -0.28);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: 0x0a0a0a }));
    pup.position.set(sx * 0.1, 1.3, -0.34);
    person.add(eye, pup);
  }
  // Tentacles under head
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const tent = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.45, 5), i % 2 ? matOcto : matOctoD);
    tent.position.set(Math.cos(a) * 0.18, 1.05, Math.sin(a) * 0.12);
    tent.rotation.x = 0.6 + Math.sin(a) * 0.3;
    tent.rotation.z = Math.cos(a) * 0.4;
    person.add(tent);
  }
  // Pirate hat
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.22, 10), matHat);
  hat.position.y = 1.55;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 12), matHat);
  brim.position.y = 1.44;
  // Arms holding wheel
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.14), matSkin);
  armL.position.set(-0.35, 0.55, -0.25);
  armL.rotation.x = -0.8;
  const armR = armL.clone();
  armR.position.x = 0.35;
  // Ship wheel
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 6, 14), matTrim);
  wheel.position.set(0, 0.85, -0.55);
  wheel.rotation.x = Math.PI / 2;
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.04), matTrim);
    sp.rotation.z = (i / 6) * Math.PI;
    sp.position.set(0, 0.85, -0.55);
    person.add(sp);
  }
  person.add(torso, sash, neck, head, face, hat, brim, armL, armR, wheel);
  root.add(person);

  // Name
  const label = makeNameLabel("PIRATE CAPTAIN");
  label.position.set(0, 3.2, 0);
  label.scale.set(2.4, 0.45, 1);
  root.add(label);

  root.position.set(x, WATER_SURFACE + 0.15, z);
  root.scale.setScalar(1.35);
  scene.add(root);

  const fisher = {
    root,
    person,
    wheel,
    sail,
    phase: Math.random() * 10,
    timer: 0,
    driving: true,
    homeX: x,
    homeZ: z,
    angle: 0,
    speed: 0.45,
    // stubs so old update doesn't crash
    tentacles: null,
    headRoot: null,
    shoulderR: { rotation: { x: 0 } },
    elbowR: { rotation: { x: 0 } },
    bobber: { position: { set() {} } },
    line: { scale: { y: 1 }, position: { set() {} } },
    catchFish: { visible: false },
    state: "drive",
  };
  beachFishers.push(fisher);

  // Boardable pirate boat vehicle — press B (or E) to sail WITH the pirate
  const boat = {
    group: root,
    wheels: [],
    type: "boat",
    subtype: "pirate",
    name: "Pirate Ship",
    color: 0x1a2744,
    speed: 0,
    yaw: root.rotation.y || 0,
    maxSpeed: 26,
    accel: 16,
    turn: 1.75,
    occupied: false,
    locked: false,
    flame: null,
    flameInner: null,
    pilot: person, // pirate stays on board with you
    fisher,
    pirateBuddy: true,
  };
  fisher.vehicle = boat;
  vehicles.push(boat);
  state.pirateBoat = boat;
  return root;
}


function makeHotFire(scale = 1) {
  const g = new THREE.Group();
  // Outer orange plume
  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(0.32 * scale, 1.4 * scale, 8),
    new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.85 })
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.z = -0.7 * scale;
  // Mid yellow
  const mid = new THREE.Mesh(
    new THREE.ConeGeometry(0.2 * scale, 1.15 * scale, 8),
    new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.92 })
  );
  mid.rotation.x = -Math.PI / 2;
  mid.position.z = -0.55 * scale;
  // White hot core
  const white = new THREE.Mesh(
    new THREE.ConeGeometry(0.1 * scale, 0.85 * scale, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
  );
  white.rotation.x = -Math.PI / 2;
  white.position.z = -0.4 * scale;
  // Blue hottest tip (near nozzle)
  const blue = new THREE.Mesh(
    new THREE.ConeGeometry(0.08 * scale, 0.45 * scale, 6),
    new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.9 })
  );
  blue.rotation.x = -Math.PI / 2;
  blue.position.z = -0.2 * scale;
  // Soft glow
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.28 * scale, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.4, depthWrite: false })
  );
  glow.position.z = -0.15 * scale;
  g.add(outer, mid, white, blue, glow);
  g.visible = false;
  return { group: g, outer, mid, white, blue, glow };
}

/** Prop airplane — larger passenger prop plane with detailed body */
function spawnAirplane(x, z) {
  const group = new THREE.Group();
  const matWhite = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
  const matWhiteSoft = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
  const matBlue = new THREE.MeshLambertMaterial({ color: 0x1d4ed8 });
  const matBlueDark = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });
  const matSilver = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
  const matSilverDark = new THREE.MeshLambertMaterial({ color: 0x64748b });
  const matDark = new THREE.MeshLambertMaterial({ color: 0x1e293b });
  const matGlass = new THREE.MeshStandardMaterial({
    color: 0xa5f3fc, transparent: true, opacity: 0.28, roughness: 0.12, metalness: 0.2,
  });
  const matGlassDark = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9, transparent: true, opacity: 0.35, roughness: 0.2, metalness: 0.15,
  });
  const matRed = new THREE.MeshLambertMaterial({ color: 0xdc2626 });
  const matYellow = new THREE.MeshLambertMaterial({ color: 0xfacc15 });
  const matBlack = new THREE.MeshLambertMaterial({ color: 0x0f172a });
  const matRubber = new THREE.MeshLambertMaterial({ color: 0x292524 });

  // Main fuselage (longer / thicker)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.68, 7.2, 14), matWhite);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.1;
  // Belly cargo bulge
  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.35, 4.2), matWhiteSoft);
  belly.position.set(0, -0.45, 0.2);
  // Nose cone
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 12), matWhite);
  nose.position.z = 3.7;
  nose.scale.set(1, 0.92, 1.15);
  const noseTip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 10), matBlack);
  noseTip.rotation.x = -Math.PI / 2;
  noseTip.position.z = 4.45;
  // Cockpit glass bubble
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 10), matGlass);
  cockpit.position.set(0, 0.38, 2.15);
  cockpit.scale.set(1.0, 0.78, 1.35);
  const cockFrame = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 6, 16), matBlueDark);
  cockFrame.rotation.x = Math.PI / 2;
  cockFrame.position.set(0, 0.35, 2.15);
  // Passenger window row
  for (let i = 0; i < 7; i++) {
    const wz = 1.2 - i * 0.55;
    for (const sx of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.28), matGlassDark);
      win.position.set(sx * 0.62, 0.18, wz);
      group.add(win);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.34), matBlueDark);
      frame.position.set(sx * 0.64, 0.18, wz);
      group.add(frame);
    }
  }
  // Blue livery stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.14, 6.2), matBlue);
  stripe.position.set(0, 0.02, 0.15);
  const stripeGold = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.05, 6.15), matYellow);
  stripeGold.position.set(0, -0.08, 0.15);
  // Wings (wider)
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.12, 2.2), matWhite);
  wing.position.set(0, -0.02, 0.15);
  const wingRoot = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 2.0), matWhiteSoft);
  wingRoot.position.set(0, 0.02, 0.15);
  const wingEdge = new THREE.Mesh(new THREE.BoxGeometry(11.3, 0.07, 0.18), matBlue);
  wingEdge.position.set(0, 0.02, 1.15);
  const wingTrail = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.05, 0.12), matBlueDark);
  wingTrail.position.set(0, 0.0, -0.9);
  // Wing tips
  for (const sx of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.9), matBlue);
    tip.position.set(sx * 5.5, 0.22, 0.1);
    group.add(tip);
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 6),
      new THREE.MeshBasicMaterial({ color: sx > 0 ? 0x22c55e : 0xef4444 })
    );
    light.position.set(sx * 5.55, 0.45, 0.35);
    group.add(light);
  }
  // Engine nacelles (more detailed)
  function makeEngine(sx) {
    const eg = new THREE.Group();
    eg.position.set(sx, -0.42, 0.2);
    const cowling = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 2.0, 12), matSilver);
    cowling.rotation.x = Math.PI / 2;
    const intake = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 6, 14), matSilverDark);
    intake.position.z = 1.0;
    const spinner = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), matBlack);
    spinner.position.z = 1.15;
    spinner.scale.set(1, 1, 1.3);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.35, 10), matDark);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.z = -1.05;
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 0.8), matWhiteSoft);
    mount.position.set(0, 0.28, 0);
    eg.add(cowling, intake, spinner, exhaust, mount);
    return eg;
  }
  const engL = makeEngine(-3.2);
  const engR = makeEngine(3.2);
  // Propellers
  const propL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.85, 0.14), matDark);
  propL.position.set(-3.2, -0.42, 1.35);
  const propL2 = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.1, 0.14), matDark);
  propL2.position.copy(propL.position);
  const propR = propL.clone();
  propR.position.x = 3.2;
  const propR2 = propL2.clone();
  propR2.position.x = 3.2;
  // Hot engine fire
  const fireL = makeHotFire(0.95);
  fireL.group.position.set(-3.2, -0.42, -1.0);
  const fireR = makeHotFire(0.95);
  fireR.group.position.set(3.2, -0.42, -1.0);
  // Tail assembly
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.0, 1.35), matWhite);
  tailFin.position.set(0, 1.0, -3.15);
  const tailBlue = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.55), matBlue);
  tailBlue.position.set(0, 1.75, -3.4);
  const tailLogo = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.45), matYellow);
  tailLogo.position.set(0.08, 1.15, -3.15);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 0.95), matWhite);
  stab.position.set(0, 0.48, -3.2);
  const stabTipL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.5), matBlue);
  stabTipL.position.set(-1.75, 0.6, -3.2);
  const stabTipR = stabTipL.clone();
  stabTipR.position.x = 1.75;
  // Landing gear (struts + wheels)
  function gear(sx, sz, tall = 0.55) {
    const g = new THREE.Group();
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, tall, 12), matSilverDark);
    strut.position.y = -tall / 2;
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 10), matRubber);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.y = -tall;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 14), matSilver);
    hub.rotation.z = Math.PI / 2;
    hub.position.y = -tall;
    g.add(strut, wheel, hub);
    g.position.set(sx, -0.55, sz);
    return g;
  }
  const gearL = gear(-1.15, 0.9, 0.6);
  const gearR = gear(1.15, 0.9, 0.6);
  const gearNose = gear(0, 2.4, 0.5);
  // Passenger door
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.9), matRed);
  door.position.set(0.68, 0.05, 0.5);
  const doorWin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.22), matGlass);
  doorWin.position.set(0.72, 0.22, 0.5);
  // Antenna
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 5), matDark);
  ant.position.set(0, 0.75, 1.0);
  // Belly lights
  const landLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xfef9c3 })
  );
  landLight.position.set(0, -0.55, 2.8);

  group.add(
    body, belly, nose, noseTip, cockpit, cockFrame,
    stripe, stripeGold, wing, wingRoot, wingEdge, wingTrail,
    engL, engR, propL, propL2, propR, propR2, fireL.group, fireR.group,
    tailFin, tailBlue, tailLogo, stab, stabTipL, stabTipR,
    gearL, gearR, gearNose, door, doorWin, ant, landLight
  );
  // Spin both blade pairs on props — store extras on props
  propL.userData.pair = propL2;
  propR.userData.pair = propR2;

  group.scale.setScalar(1.55);
  const gy = groundY(x, z);
  group.position.set(x, gy + 1.15, z);
  group.rotation.order = "YXZ";
  scene.add(group);

  const plane = {
    group,
    wheels: [],
    type: "airplane",
    color: 0x1d4ed8,
    speed: 0,
    yaw: 0,
    pitch: 0.05,
    maxSpeed: 58,
    accel: 30,
    turn: 1.9,
    pitchRate: 1.25,
    occupied: false,
    locked: false,
    flame: fireL.outer,
    flameMid: fireL.mid,
    flameInner: fireL.white,
    flameGlow: fireL.glow,
    fires: [fireL, fireR],
    propL,
    propR,
    propL2,
    propR2,
    pilot: null,
    vel: new THREE.Vector3(),
  };
  vehicles.push(plane);
  return plane;
}


/** Fighter jet — bigger, more realistic */
function spawnJet(x, z) {
  const group = new THREE.Group();
  const matBody = new THREE.MeshLambertMaterial({ color: 0x3d4a5c });
  const matWing = new THREE.MeshLambertMaterial({ color: 0x1e293b });
  const matAccent = new THREE.MeshLambertMaterial({ color: 0x22d3ee });
  const matGrey = new THREE.MeshLambertMaterial({ color: 0x64748b });
  const matGlass = new THREE.MeshLambertMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.5,
  });
  const matEngine = new THREE.MeshLambertMaterial({ color: 0x0f172a });
  const matRed = new THREE.MeshLambertMaterial({ color: 0xef4444 });

  // Long pointed fuselage
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 5.6, 12), matBody);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.2;
  // Intake / belly
  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.35, 3.2), matGrey);
  belly.position.set(0, -0.35, 0.1);
  // Sharp nose
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.6, 12), matBody);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = 3.5;
  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 12), matGrey);
  pitot.rotation.x = Math.PI / 2;
  pitot.position.z = 4.4;
  // Bubble canopy
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 12), matGlass);
  canopy.position.set(0, 0.42, 1.0);
  canopy.scale.set(0.95, 0.75, 1.4);
  const canopyFrame = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 16), matAccent);
  canopyFrame.rotation.x = Math.PI / 2;
  canopyFrame.position.set(0, 0.38, 1.0);
  // Swept wings
  const wing = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.1, 2.2), matWing);
  wing.position.set(0, 0, -0.15);
  wing.rotation.y = 0; // visual sweep via trapezoid-like tips
  const wingLead = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.06, 0.2), matAccent);
  wingLead.position.set(0, 0.02, 0.85);
  // Wingtips
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.7), matAccent);
  wingTipL.position.set(-3.5, 0.3, -0.2);
  const wingTipR = wingTipL.clone();
  wingTipR.position.x = 3.5;
  // Missiles under wings (detail)
  const misL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 14), matGrey);
  misL.rotation.x = Math.PI / 2;
  misL.position.set(-1.8, -0.25, 0.1);
  const misR = misL.clone();
  misR.position.x = 1.8;
  const misTipL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 6), matRed);
  misTipL.rotation.x = -Math.PI / 2;
  misTipL.position.set(-1.8, -0.25, 0.75);
  const misTipR = misTipL.clone();
  misTipR.position.x = 1.8;
  // Twin vertical stabilizers
  const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 1.0), matWing);
  tailL.position.set(-0.45, 0.7, -2.4);
  tailL.rotation.z = 0.25;
  const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 1.0), matWing);
  tailR.position.set(0.45, 0.7, -2.4);
  tailR.rotation.z = -0.25;
  const stab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.7), matWing);
  stab.position.set(0, 0.2, -2.5);
  // Twin engines
  const engL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.8, 10), matEngine);
  engL.rotation.x = Math.PI / 2;
  engL.position.set(-0.65, -0.28, -1.2);
  const engR = engL.clone();
  engR.position.x = 0.65;
  const engRimL = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 12), matAccent);
  engRimL.position.set(-0.65, -0.28, -2.1);
  const engRimR = engRimL.clone();
  engRimR.position.x = 0.65;
  // Dual hot fire
  const fireL = makeHotFire(1.15);
  fireL.group.position.set(-0.65, -0.28, -2.15);
  const fireR = makeHotFire(1.15);
  fireR.group.position.set(0.65, -0.28, -2.15);
  // Landing gear
  const gear = (sx, sz) => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 14), matGrey);
    s.rotation.z = Math.PI / 2;
    s.position.set(sx, -0.7, sz);
    return s;
  };
  // Intake detail
  const intake = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 1.2), matEngine);
  intake.position.set(0, -0.15, 1.6);

  const tag = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.4, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x22c55e })
  );
  tag.position.set(0, 1.9, 0);
  tag.visible = false;

  group.add(
    body, belly, nose, pitot, canopy, canopyFrame,
    wing, wingLead, wingTipL, wingTipR,
    misL, misR, misTipL, misTipR,
    tailL, tailR, stab,
    engL, engR, engRimL, engRimR,
    fireL.group, fireR.group,
    gear(-0.9, 0.6), gear(0.9, 0.6), gear(0, 1.8),
    intake, tag
  );
  group.scale.setScalar(1.85); // bigger jet
  const gy = groundY(x, z);
  group.position.set(x, gy + 1.15, z);
  group.rotation.order = "YXZ";
  scene.add(group);

  const jet = {
    group,
    wheels: [],
    type: "jet",
    color: 0x22d3ee,
    speed: 0,
    yaw: 0,
    pitch: 0.05,
    maxSpeed: 75,
    accel: 40,
    turn: 2.3,
    pitchRate: 1.55,
    occupied: false,
    locked: false,
    price: 0,
    flame: fireL.outer,
    flameMid: fireL.mid,
    flameInner: fireL.white,
    flameGlow: fireL.glow,
    fires: [fireL, fireR],
    pilot: null,
    priceTag: tag,
    vel: new THREE.Vector3(),
  };
  vehicles.push(jet);
  return jet;
}

// ─────────────────────────────────────────────────────────────
// CRATER LAKE (photo style) — dark water at the BOTTOM of the hole
// ─────────────────────────────────────────────────────────────
function buildRealisticOcean() {
  // Photo crater lake — deep teal-black water, calm mirror
  oceanWater.length = 0;
  state._oceanBobTiles = [];

  // Colors matched to reference photo (deep alpine lake)
  const LAKE_DEEP = 0x061e2c;
  const LAKE_MID = 0x0a3548;
  const LAKE_TEAL = 0x0d4a5c;
  const LAKE_EDGE = 0x156878;
  const LAKE_DARK = 0x031018;
  const lakeR = CRATER_LAKE_R;

  // Deep water volume under surface
  const deep = new THREE.Mesh(
    new THREE.CylinderGeometry(lakeR + 0.9, lakeR + 1.8, 7, 64),
    new THREE.MeshStandardMaterial({
      color: LAKE_DARK, transparent: true, opacity: 0.98, roughness: 0.9, metalness: 0.06, flatShading: false,
    })
  );
  deep.position.set(CRATER_CX, WATER_SURFACE - 3.6, CRATER_CZ);
  scene.add(deep);
  freezeMesh(deep);

  const mid = new THREE.Mesh(
    new THREE.CylinderGeometry(lakeR + 0.35, lakeR + 1.0, 3.0, 64),
    new THREE.MeshStandardMaterial({
      color: LAKE_DEEP, transparent: true, opacity: 0.78, roughness: 0.18, metalness: 0.32, flatShading: false,
    })
  );
  mid.position.set(CRATER_CX, WATER_SURFACE - 1.2, CRATER_CZ);
  scene.add(mid);
  freezeMesh(mid);

  // Main lake surface — glossy dark teal (photo)
  const surfaceGeo = new THREE.CircleGeometry(lakeR + 0.35, 128);
  const surfMat = new THREE.MeshStandardMaterial({
    color: LAKE_TEAL,
    emissive: 0x031820,
    emissiveIntensity: 0.08,
    transparent: true,
    opacity: 0.94,
    roughness: 0.045,
    metalness: 0.72,
    side: THREE.DoubleSide,
    vertexColors: true,
    envMapIntensity: 1.45,
    flatShading: false,
  });
  const surface = new THREE.Mesh(surfaceGeo, surfMat);
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(CRATER_CX, WATER_SURFACE + 0.05, CRATER_CZ);
  scene.add(surface);

  const posAttr = surfaceGeo.attributes.position;
  const base = new Float32Array(posAttr.count * 3);
  const cols = [];
  const cDeep = new THREE.Color(LAKE_DEEP);
  const cMid = new THREE.Color(LAKE_MID);
  const cTeal = new THREE.Color(LAKE_TEAL);
  const cEdge = new THREE.Color(LAKE_EDGE);
  for (let i = 0; i < posAttr.count; i++) {
    const lx = posAttr.getX(i);
    const ly = posAttr.getY(i);
    base[i * 3] = lx;
    base[i * 3 + 1] = ly;
    base[i * 3 + 2] = posAttr.getZ(i);
    const r = Math.hypot(lx, ly);
    const edge = Math.min(1, r / (lakeR + 0.35));
    const col = new THREE.Color();
    if (edge < 0.5) col.lerpColors(cDeep, cMid, edge / 0.5);
    else if (edge < 0.82) col.lerpColors(cMid, cTeal, (edge - 0.5) / 0.32);
    else col.lerpColors(cTeal, cEdge, (edge - 0.82) / 0.18);
    cols.push(col.r, col.g, col.b);
  }
  surfaceGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));

  // Very gentle lake ripple (photo water is almost still)
  oceanWater.push({
    mesh: surface, verts: true, base, amp: 0.09, speed: 0.55, phase: 0.35, foam: false, gta: true,
  });

  // Soft sky reflection sheen
  const surface2 = new THREE.Mesh(
    new THREE.CircleGeometry(lakeR * 0.72, 48),
    new THREE.MeshStandardMaterial({
      color: 0x8eb8c8, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.85,
      side: THREE.DoubleSide, flatShading: false, depthWrite: false,
    })
  );
  surface2.rotation.x = -Math.PI / 2;
  surface2.position.set(CRATER_CX - 1.2, WATER_SURFACE + 0.08, CRATER_CZ + 0.8);
  scene.add(surface2);
  freezeMesh(surface2);

  // Subtle edge ring (not bright foam)
  const shallowRing = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(4, lakeR - 2.2), lakeR + 0.45, 64),
    new THREE.MeshStandardMaterial({
      color: 0x0e4558, emissive: 0x052530, emissiveIntensity: 0.06,
      transparent: true, opacity: 0.32, roughness: 0.25, metalness: 0.4, side: THREE.DoubleSide, flatShading: false,
    })
  );
  shallowRing.rotation.x = -Math.PI / 2;
  shallowRing.position.set(CRATER_CX, WATER_SURFACE + 0.03, CRATER_CZ);
  scene.add(shallowRing);
  oceanWater.push({
    mesh: shallowRing, foam: true, speed: 0.5, phase: 0, gtaShallow: true, baseY: WATER_SURFACE + 0.03,
  });

  // Low underwater caustics
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const rr = 4 + (i % 3) * 2.2;
    const cx = CRATER_CX + Math.cos(a) * rr;
    const cz = CRATER_CZ + Math.sin(a) * rr;
    if (Math.hypot(cx - OCEAN_MTN_X, cz - OCEAN_MTN_Z) < OCEAN_MTN_R * 0.9) continue;
    const caust = new THREE.Mesh(
      new THREE.CircleGeometry(1.8 + (i % 2) * 0.5, 16),
      new THREE.MeshBasicMaterial({ color: 0x4a9aaa, transparent: true, opacity: 0.05, depthWrite: false })
    );
    caust.rotation.x = -Math.PI / 2;
    caust.position.set(cx, WATER_SURFACE - 1.1, cz);
    scene.add(caust);
    oceanWater.push({ mesh: caust, foam: true, caustic: true, speed: 0.4 + (i % 3) * 0.1, phase: a });
  }

  // Stone/rock island under the spire (photo base)
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x5c6570, roughness: 0.93, flatShading: false });
  const rockDark = new THREE.MeshStandardMaterial({ color: 0x3f464e, roughness: 0.95, flatShading: false });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rr = 1.1 + (i % 4) * 0.4;
    const rx = OCEAN_MTN_X + Math.cos(a) * rr;
    const rz = OCEAN_MTN_Z + Math.sin(a) * rr;
    const ry = oceanMountainY(rx, rz);
    if (ry == null) continue;
    const rock = new THREE.Mesh(
      new THREE.SphereGeometry(0.5 + (i % 3) * 0.18, 14, 12),
      i % 2 ? rockMat : rockDark
    );
    rock.position.set(rx, ry + 0.15, rz);
    rock.scale.set(1.25, 0.55, 1.15);
    rock.rotation.y = a;
    scene.add(rock);
    freezeMesh(rock);
  }

  state._splashT = 0;
  state._oceanUnderFog = true;
  state._gtaOcean = true;
}

/**
 * Photo crater landmark — match the reference as closely as the engine allows:
 * dark striated rock walls, snow patches, deep teal lake, faceted concrete needle,
 * cable from rim, sparse pines, soft mist. NO white ball clutter.
 */
function buildCraterLandmark() {
  const snow = new THREE.MeshStandardMaterial({
    color: 0xf4f7fa, roughness: 0.9, metalness: 0.01, flatShading: false,
  });
  const snowSoft = new THREE.MeshStandardMaterial({
    color: 0xdfe6ee, roughness: 0.94, metalness: 0.01, flatShading: false,
  });
  const rock = new THREE.MeshStandardMaterial({
    color: 0x4a525c, roughness: 0.95, metalness: 0.04, flatShading: false,
  });
  const rockDark = new THREE.MeshStandardMaterial({
    color: 0x2f353c, roughness: 0.96, metalness: 0.03, flatShading: false,
  });
  // Photo tower: pale grey concrete, slightly matte
  const concrete = new THREE.MeshStandardMaterial({
    color: 0xc5ccd4, roughness: 0.52, metalness: 0.18, flatShading: false,
  });
  const concreteMid = new THREE.MeshStandardMaterial({
    color: 0xb0b8c0, roughness: 0.55, metalness: 0.2, flatShading: false,
  });
  const concreteDark = new THREE.MeshStandardMaterial({
    color: 0x9aa3ad, roughness: 0.58, metalness: 0.22, flatShading: false,
  });
  const cableMat = new THREE.MeshStandardMaterial({
    color: 0x3a4048, roughness: 0.28, metalness: 0.82, flatShading: false,
  });
  const pine = new THREE.MeshStandardMaterial({
    color: 0x1b3024, roughness: 0.9, metalness: 0.02, flatShading: false,
  });
  const pine2 = new THREE.MeshStandardMaterial({
    color: 0x243828, roughness: 0.9, metalness: 0.02, flatShading: false,
  });
  const trunkM = new THREE.MeshStandardMaterial({
    color: 0x3a2a1e, roughness: 0.94, metalness: 0, flatShading: false,
  });

  // ── High-res bowl overlay: dark rock + snow patches (photo look) ──
  const radialSeg = 120;
  const ringSeg = 64;
  const bPos = [];
  const bCol = [];
  const bIdx = [];
  const cSnow = new THREE.Color(0xf2f5f8);
  const cSnow2 = new THREE.Color(0xd8e0e8);
  const cRock = new THREE.Color(0x2e343c);
  const cRock2 = new THREE.Color(0x4e5762);
  const cRock3 = new THREE.Color(0x3a424c);
  for (let ri = 0; ri <= ringSeg; ri++) {
    const t = ri / ringSeg; // 0 lake edge → 1 rim
    const r = CRATER_LAKE_R * 0.97 + t * (CRATER_R - CRATER_LAKE_R * 0.97);
    for (let ai = 0; ai <= radialSeg; ai++) {
      const a = (ai / radialSeg) * Math.PI * 2;
      // Slight irregular rim (use 0–1 sin, not height-scale noise2)
      const rJitter = 1 + Math.sin(a * 3.1) * Math.cos(a * 2.4) * 0.03 * t;
      const x = CRATER_CX + Math.cos(a) * r * rJitter;
      const z = CRATER_CZ + Math.sin(a) * r * rJitter;
      const y = groundY(x, z) + 0.1;
      bPos.push(x, y, z);
      // Photo palette: lower = dark rock, upper = snow with rock peeking
      const stripe = (Math.sin(a * 5.5 + t * 4) + 1) * 0.5;
      const patch01 = (Math.sin(x * 0.18) * Math.cos(z * 0.16) + 1) * 0.5;
      const snowAmt = THREE.MathUtils.clamp(Math.pow(t, 1.35) * (0.55 + patch01 * 0.45), 0, 1);
      const col = cRock.clone().lerp(cRock2, stripe * 0.55).lerp(cRock3, (1 - stripe) * 0.35);
      if (t < 0.32) {
        col.lerp(cSnow2, snowAmt * 0.12);
      } else if (t < 0.65) {
        col.lerp(cSnow, snowAmt * 0.55);
      } else {
        col.lerp(cSnow, THREE.MathUtils.clamp(0.55 + snowAmt * 0.4, 0, 1));
        col.lerp(cRock2, THREE.MathUtils.clamp((1 - snowAmt) * 0.28, 0, 0.4));
      }
      bCol.push(
        THREE.MathUtils.clamp(col.r, 0, 1),
        THREE.MathUtils.clamp(col.g, 0, 1),
        THREE.MathUtils.clamp(col.b, 0, 1)
      );
    }
  }
  for (let ri = 0; ri < ringSeg; ri++) {
    for (let ai = 0; ai < radialSeg; ai++) {
      const i0 = ri * (radialSeg + 1) + ai;
      const i1 = i0 + 1;
      const i2 = i0 + (radialSeg + 1);
      const i3 = i2 + 1;
      bIdx.push(i0, i2, i1, i1, i2, i3);
    }
  }
  const bowlGeo = new THREE.BufferGeometry();
  bowlGeo.setAttribute("position", new THREE.Float32BufferAttribute(bPos, 3));
  bowlGeo.setAttribute("color", new THREE.Float32BufferAttribute(bCol, 3));
  bowlGeo.setIndex(bIdx);
  bowlGeo.computeVertexNormals();
  const bowl = new THREE.Mesh(
    bowlGeo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: false,
      roughness: 0.92,
      metalness: 0.03,
      side: THREE.DoubleSide,
    })
  );
  scene.add(bowl);
  freezeMesh(bowl);

  // Soft rock outcrops (smooth spheres/ellipsoids — NOT box ledges)
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + 0.15;
    const t = 0.15 + (i % 5) * 0.12;
    const rr = CRATER_LAKE_R + t * (CRATER_R - CRATER_LAKE_R);
    const x = CRATER_CX + Math.cos(a) * rr;
    const z = CRATER_CZ + Math.sin(a) * rr;
    const gy = groundY(x, z);
    const outcrop = new THREE.Mesh(
      new THREE.SphereGeometry(1.1 + (i % 4) * 0.35, 14, 12),
      i % 2 ? rockDark : rock
    );
    outcrop.position.set(x, gy + 0.15, z);
    outcrop.scale.set(1.5, 0.45 + (i % 3) * 0.1, 1.1);
    outcrop.rotation.y = a;
    scene.add(outcrop);
    freezeMesh(outcrop);
  }

  // Snow blankets on upper rim / gentle slopes (flat discs, not balls)
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + 0.07;
    const rr = CRATER_R * (0.72 + (i % 7) * 0.035);
    const x = CRATER_CX + Math.cos(a) * rr;
    const z = CRATER_CZ + Math.sin(a) * rr;
    const gy = groundY(x, z);
    if (gy < WATER_SURFACE + 14) continue;
    const patch = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4 + (i % 5) * 0.55, 1.7 + (i % 4) * 0.4, 0.18, 16),
      i % 3 ? snow : snowSoft
    );
    patch.position.set(x, gy + 0.1, z);
    patch.rotation.y = a;
    scene.add(patch);
    freezeMesh(patch);
  }

  // Sparse evergreens on mid slopes (photo)
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + 0.55;
    const rr = CRATER_LAKE_R + 12 + (i % 6) * 5.2 + ((i * 7) % 5);
    if (rr > CRATER_R - 5) continue;
    const x = CRATER_CX + Math.cos(a) * rr;
    const z = CRATER_CZ + Math.sin(a) * rr;
    const gy = groundY(x, z);
    if (gy < WATER_SURFACE + 9 || gy > CRATER_RIM_Y - 4) continue;
    const hScale = 0.75 + (i % 4) * 0.18;
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * hScale, 0.13 * hScale, 1.2 * hScale, 8), trunkM);
    tr.position.set(x, gy + 0.6 * hScale, z);
    const cr = new THREE.Mesh(
      new THREE.ConeGeometry(0.55 * hScale, 1.9 * hScale, 9),
      i % 2 ? pine : pine2
    );
    cr.position.set(x, gy + 1.85 * hScale, z);
    // second tier for fuller pine
    if (i % 3 !== 0) {
      const cr2 = new THREE.Mesh(
        new THREE.ConeGeometry(0.4 * hScale, 1.3 * hScale, 8),
        pine
      );
      cr2.position.set(x, gy + 2.7 * hScale, z);
      scene.add(cr2);
      freezeMesh(cr2);
    }
    scene.add(tr, cr);
    freezeMesh(tr);
    freezeMesh(cr);
  }

  // Soft mist / cloud sheets (photo right side especially) — low opacity, flattened
  for (let i = 0; i < 14; i++) {
    // Bias mist toward +X side like the photo
    const a = (i / 14) * Math.PI * 1.1 - 0.2 + Math.PI * 0.05;
    const rr = CRATER_R * (0.38 + (i % 4) * 0.14);
    const x = CRATER_CX + Math.cos(a) * rr + 8;
    const z = CRATER_CZ + Math.sin(a) * rr;
    const y = groundY(x, z) + 4 + (i % 4) * 2.5;
    const mist = new THREE.Mesh(
      new THREE.SphereGeometry(6 + (i % 4) * 2.2, 20, 14),
      new THREE.MeshStandardMaterial({
        color: 0xeef2f6,
        transparent: true,
        opacity: 0.1 + (i % 3) * 0.025,
        roughness: 1,
        depthWrite: false,
        flatShading: false,
      })
    );
    mist.position.set(x, y, z);
    mist.scale.set(2.2, 0.28 + (i % 3) * 0.08, 1.7);
    scene.add(mist);
    freezeMesh(mist);
  }

  // ── Faceted concrete needle spire (photo tower) ──
  // Looks like a tall slender pyramid with geometric segments, not a cartoon cone stack
  const spire = new THREE.Group();
  spire.position.set(CRATER_CX, WATER_SURFACE + 0.1, CRATER_CZ);

  // Stone platform in lake
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.6, 1.15, 6), concreteDark);
  pad.position.y = 0.45;
  pad.rotation.y = 0.2;

  // Lower hexagonal shaft
  const bodyLo = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 3.1, 10.5, 6), concrete);
  bodyLo.position.y = 5.7;
  bodyLo.rotation.y = 0.2;

  // Mid taper
  const bodyMid = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 2.15, 9.0, 6), concreteMid);
  bodyMid.position.y = 15.0;
  bodyMid.rotation.y = 0.2;

  // Upper slender shaft
  const bodyHi = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.15, 7.5, 6), concrete);
  bodyHi.position.y = 23.2;
  bodyHi.rotation.y = 0.2;

  // Sharp needle tip
  const needle = new THREE.Mesh(new THREE.ConeGeometry(0.58, 12.5, 6), concreteDark);
  needle.position.y = 32.8;
  needle.rotation.y = 0.2;

  // Tiny metal tip sparkle
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 2.4, 8),
    new THREE.MeshStandardMaterial({
      color: 0xdfe6ee, roughness: 0.2, metalness: 0.85, emissive: 0x8899aa, emissiveIntensity: 0.15, flatShading: false,
    })
  );
  tip.position.y = 39.8;

  // Soft sun glint at tip (photo star highlight)
  const glint = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false })
  );
  glint.position.y = 40.4;

  // Subtle glass / panel band mid-shaft (photo building detail)
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(2.18, 2.18, 0.9, 6, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x6eb8d0, emissive: 0x0a4a60, emissiveIntensity: 0.15,
      transparent: true, opacity: 0.4, roughness: 0.15, metalness: 0.5, flatShading: false, side: THREE.DoubleSide,
    })
  );
  glass.position.y = 9.2;
  glass.rotation.y = 0.2;

  // Small buttress fins at base (photo has angular base volume)
  for (let f = 0; f < 3; f++) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 6.5, 1.8),
      concreteMid
    );
    const fa = (f / 3) * Math.PI * 2 + 0.35;
    fin.position.set(Math.cos(fa) * 2.4, 3.8, Math.sin(fa) * 2.4);
    fin.rotation.y = -fa;
    spire.add(fin);
  }

  spire.add(pad, bodyLo, bodyMid, bodyHi, needle, tip, glint, glass);
  scene.add(spire);
  freezeMesh(spire);

  // Cable from high NW rim down to near tip (photo)
  const rimX = CRATER_CX - CRATER_R * 0.52;
  const rimZ = CRATER_CZ - CRATER_R * 0.58;
  const rimY = groundY(rimX, rimZ) + 2.2;
  const tipWorld = new THREE.Vector3(CRATER_CX, WATER_SURFACE + 39.2, CRATER_CZ);
  const rimPt = new THREE.Vector3(rimX, rimY, rimZ);
  // sag in the middle (real cable hang)
  const midPt = tipWorld.clone().lerp(rimPt, 0.48);
  midPt.y -= 8.5;
  midPt.x -= 2;
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(rimPt, midPt, tipWorld), 64, 0.045, 8, false),
    cableMat
  );
  scene.add(cable);
  freezeMesh(cable);

  // Small anchor post on rim for the cable
  const anchor = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.4, 8), concreteDark);
  anchor.position.set(rimX, rimY - 0.4, rimZ);
  scene.add(anchor);
  freezeMesh(anchor);

  // Lake stone curb (photo circular edge)
  const curb = new THREE.Mesh(
    new THREE.TorusGeometry(CRATER_LAKE_R - 0.25, 0.42, 12, 80),
    rockDark
  );
  curb.rotation.x = Math.PI / 2;
  curb.position.set(CRATER_CX, WATER_SURFACE + 0.12, CRATER_CZ);
  scene.add(curb);
  freezeMesh(curb);

  // Second thinner outer curb ring
  const curb2 = new THREE.Mesh(
    new THREE.TorusGeometry(CRATER_LAKE_R + 0.6, 0.22, 10, 64),
    rock
  );
  curb2.rotation.x = Math.PI / 2;
  curb2.position.set(CRATER_CX, WATER_SURFACE + 0.28, CRATER_CZ);
  scene.add(curb2);
  freezeMesh(curb2);

  addCollider(CRATER_CX, WATER_SURFACE + 0.5, CRATER_CZ, 7.0, 1.0, 7.0);
  addCollider(CRATER_CX, WATER_SURFACE + 12, CRATER_CZ, 4.2, 22, 4.2);

  state.craterSpire = { group: spire, x: CRATER_CX, z: CRATER_CZ, y: WATER_SURFACE };
  console.log("%c[NEXUS] Photo crater (rock walls · dark lake · spire · cable)", "color:#e2e8f0;font-weight:bold");
}

let _oceanFrame = 0;
function updateOceanWater(t) {
  _oceanFrame++;
  const doVerts = _oceanFrame % PERF.oceanEvery === 0;
  for (const w of oceanWater) {
    if (w.foam) {
      if (w.caustic) {
        w.mesh.material.opacity = 0.05 + Math.sin(t * w.speed + w.phase) * 0.045;
        w.mesh.scale.setScalar(1 + Math.sin(t * w.speed * 0.7 + w.phase) * 0.1);
      } else if (w.gtaShallow) {
        const by = w.baseY != null ? w.baseY : WATER_SURFACE + 0.12;
        w.mesh.position.y = by + Math.sin(t * w.speed) * 0.05;
        w.mesh.material.opacity = 0.38 + Math.sin(t * 1.3) * 0.1;
      } else if (w.gtaFoam) {
        w.mesh.material.opacity = (w.baseOp || 0.4) + Math.sin(t * w.speed + w.phase) * 0.14;
        // Foam drifts in and out like GTA shoreline
        const pulse = 1 + Math.sin(t * w.speed * 0.8 + w.phase) * 0.08;
        w.mesh.scale.set(pulse, 1, pulse);
        w.mesh.position.y = WATER_SURFACE + 0.18 + Math.sin(t * w.speed * 1.5 + w.phase) * 0.06;
      } else if (w.mcBob) {
        const by = w.baseY != null ? w.baseY : WATER_SURFACE + 0.05;
        w.mesh.position.y = by + Math.sin(t * w.speed + w.phase) * 0.06;
      } else {
        w.mesh.material.opacity = 0.45 + Math.sin(t * 2 + (w.phase || 0)) * 0.15;
      }
      continue;
    }
    if (!w.verts || !doVerts) continue;
    const pos = w.mesh.geometry.attributes.position;
    const base = w.base;
    const amp = w.amp;
    const spd = w.speed;
    const ph = w.phase;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      const wx = OCEAN_CX + bx;
      const wz = OCEAN_CZ + by;
      const dm = Math.hypot(wx - OCEAN_MTN_X, wz - OCEAN_MTN_Z);
      if (dm < OCEAN_MTN_R * 0.7) {
        pos.setXYZ(i, bx, by, -4);
        continue;
      }
      // GTA multi-swell motion
      const swell =
        Math.sin(bx * 0.036 + by * 0.02 + t * spd * 0.9 + ph) * amp * 1.35 +
        Math.sin(bx * 0.07 - by * 0.045 + t * spd * 1.4 + ph * 1.2) * amp * 0.7 +
        Math.sin(bx * 0.022 + by * 0.028 + t * spd * 0.5) * amp * 1.0;
      const chop =
        Math.sin(bx * 0.17 + t * spd * 2.2 + ph) * amp * 0.26 +
        Math.sin(by * 0.2 + t * spd * 1.9) * amp * 0.2 +
        Math.sin((bx + by) * 0.13 + t * spd * 2.7) * amp * 0.16;
      const edge = Math.min(1, Math.hypot(bx, by) / (OCEAN_R + 1.5));
      const wave = (swell + chop) * (0.5 + edge * 0.6);
      pos.setXYZ(i, bx, by, wave);
    }
    pos.needsUpdate = true;
    if (_oceanFrame % 3 === 0) w.mesh.geometry.computeVertexNormals();
  }
  if (state._oceanBobTiles) {
    for (const bt of state._oceanBobTiles) {
      bt.mesh.position.y = bt.baseY + Math.sin(t * bt.speed + bt.phase) * bt.amp;
    }
  }
  // Shore splash
  const dShore = Math.hypot(player.pos.x - OCEAN_CX, player.pos.z - OCEAN_CZ);
  if (Math.abs(dShore - OCEAN_R) < 18) {
    state._splashT = (state._splashT || 0) + 0.016;
    if (state._splashT > 0.45 && splashParticles.length < PERF.maxSplashes) {
      state._splashT = 0;
      const a = Math.atan2(player.pos.z - OCEAN_CZ, player.pos.x - OCEAN_CX);
      spawnWaveSplash(
        OCEAN_CX + Math.cos(a) * (OCEAN_R - 4) + (Math.random() - 0.5) * 12,
        OCEAN_CZ + Math.sin(a) * (OCEAN_R - 4) + (Math.random() - 0.5) * 12,
        2
      );
      if (Math.random() < 0.25) playSplash();
    }
  }
}

function spawnBeachFisher(x, z) {
  const gy = Math.max(0, groundY(x, z));
  const root = new THREE.Group();
  root.position.set(x, gy, z);
  // Face the ocean (+Z)
  root.rotation.y = Math.PI;

  const matChair = new THREE.MeshLambertMaterial({ color: 0x3d2914 });
  const matChairMetal = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
  const matTire = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  // Pirate clothes
  const matCoat = new THREE.MeshLambertMaterial({ color: 0x1a2744 }); // navy coat
  const matCoatTrim = new THREE.MeshLambertMaterial({ color: 0xc9a227 }); // gold trim
  const matShirt = new THREE.MeshLambertMaterial({ color: 0xf5f0e6 }); // white shirt
  const matPants = new THREE.MeshLambertMaterial({ color: 0x2c1810 }); // dark brown pants
  const matSash = new THREE.MeshLambertMaterial({ color: 0xb91c1c }); // red sash
  const matBoot = new THREE.MeshLambertMaterial({ color: 0x1c1410 });
  // Green octopus head
  const matOcto = new THREE.MeshLambertMaterial({ color: 0x22c55e });
  const matOctoDark = new THREE.MeshLambertMaterial({ color: 0x15803d });
  const matOctoLight = new THREE.MeshLambertMaterial({ color: 0x4ade80 });
  const matSuckers = new THREE.MeshLambertMaterial({ color: 0xbbf7d0 });
  // Pirate hat
  const matHat = new THREE.MeshLambertMaterial({ color: 0x0f0f0f });
  const matHatBand = new THREE.MeshLambertMaterial({ color: 0xb91c1c });
  const matSkull = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
  const matRod = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
  const matLine = new THREE.MeshBasicMaterial({ color: 0xcbd5e1 });
  const matReel = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });

  // ── Wheelchair (taller / bigger) ──
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.14, 0.75), matChair);
  seat.position.set(0, 0.68, 0.05);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 0.12), matChair);
  back.position.set(0, 1.2, 0.4);
  // Backrest gold X braces
  const brace1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.04), matCoatTrim);
  brace1.position.set(0, 1.15, 0.35);
  brace1.rotation.z = 0.4;
  const brace2 = brace1.clone();
  brace2.rotation.z = -0.4;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.65), matChairMetal);
  armL.position.set(-0.45, 0.95, 0.05);
  const armR = armL.clone();
  armR.position.x = 0.45;
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.3), matChairMetal);
  foot.position.set(0, 0.32, -0.48);
  function wheel(sx) {
    const w = new THREE.Group();
    w.position.set(sx, 0.5, 0.15);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.09, 8, 18), matTire);
    tire.rotation.y = Math.PI / 2;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 14), matChairMetal);
    hub.rotation.z = Math.PI / 2;
    for (let i = 0; i < 11; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.4, 0.035), matChairMetal);
      sp.rotation.z = (i / 8) * Math.PI;
      w.add(sp);
    }
    w.add(tire, hub);
    return w;
  }
  const wheelL = wheel(-0.55);
  const wheelR = wheel(0.55);
  const castL = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.05, 6, 10), matTire);
  castL.rotation.y = Math.PI / 2;
  castL.position.set(-0.28, 0.16, -0.42);
  const castR = castL.clone();
  castR.position.x = 0.28;

  // ── Pirate body (taller) ──
  const person = new THREE.Group();
  person.position.set(0, 0.68, 0.05);

  // Human neck (under octopus head)
  const matSkin = new THREE.MeshLambertMaterial({ color: 0xf0c4a0 });
  const matSkinDark = new THREE.MeshLambertMaterial({ color: 0xe0b090 });
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.18, 14), matSkin);
  neck.position.y = 1.05;

  // White ruffled shirt
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.52, 0.38), matShirt);
  shirt.position.y = 0.68;
  // Collar ruffle
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.22), matShirt);
  collar.position.set(0, 0.98, -0.12);
  // Navy coat (longer / bulkier human torso)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.78, 0.52), matCoat);
  torso.position.y = 0.6;
  // Coat tails
  const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.45, 0.12), matCoat);
  tailL.position.set(-0.22, 0.12, 0.28);
  tailL.rotation.x = 0.25;
  const tailR = tailL.clone();
  tailR.position.x = 0.22;
  // Gold lapels
  const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.07), matCoatTrim);
  lapelL.position.set(-0.24, 0.62, -0.24);
  const lapelR = lapelL.clone();
  lapelR.position.x = 0.24;
  // Epaulettes (shoulder gold)
  const epL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.28), matCoatTrim);
  epL.position.set(-0.4, 0.95, 0);
  const epR = epL.clone();
  epR.position.x = 0.4;
  // Buttons (more)
  for (let i = 0; i < 4; i++) {
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), matCoatTrim);
    btn.position.set(0, 0.85 - i * 0.15, -0.25);
    person.add(btn);
  }
  // Red sash + knot
  const sash = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.16, 0.5), matSash);
  sash.position.y = 0.28;
  const sashKnot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), matSash);
  sashKnot.position.set(0.28, 0.28, -0.28);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.06), matCoatTrim);
  buckle.position.set(0, 0.28, -0.28);

  // ── GREEN OCTOPUS HEAD (removable) ──
  const headRoot = new THREE.Group();
  headRoot.position.y = 1.28;
  const headBaseY = 1.28;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), matOcto);
  head.scale.set(1.1, 1.0, 1.05);
  // Bumpy head ridges
  for (let i = 0; i < 5; i++) {
    const bump = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), matOctoDark);
    const a = (i / 5) * Math.PI * 2;
    bump.position.set(Math.cos(a) * 0.28, 0.22, Math.sin(a) * 0.22);
    headRoot.add(bump);
  }
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), matOctoLight);
  face.position.set(0, -0.02, -0.26);
  face.scale.set(1.15, 1.05, 0.75);
  // Big eyes with lids
  const eyeWL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), matEyeWhite);
  eyeWL.position.set(-0.15, 0.08, -0.36);
  const eyeWR = eyeWL.clone();
  eyeWR.position.x = 0.15;
  const lidL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), matOctoDark);
  lidL.position.set(-0.15, 0.14, -0.34);
  lidL.scale.set(1, 0.4, 0.8);
  const lidR = lidL.clone();
  lidR.position.x = 0.15;
  const pupL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), matEyePupil);
  pupL.position.set(-0.15, 0.08, -0.44);
  const pupR = pupL.clone();
  pupR.position.x = 0.15;
  // Shine
  const shineL = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), matEyeWhite);
  shineL.position.set(-0.13, 0.11, -0.46);
  const shineR = shineL.clone();
  shineR.position.x = 0.17;
  // Beak
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 6), matOctoDark);
  beak.rotation.x = Math.PI;
  beak.position.set(0, -0.14, -0.38);

  // Longer tentacles with more segments + suckers
  const tentacles = [];
  for (let i = 0; i < 11; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const tentRoot = new THREE.Group();
    tentRoot.position.set(Math.cos(ang) * 0.3, -0.2, Math.sin(ang) * 0.24);
    const segs = [];
    let parent = tentRoot;
    for (let s = 0; s < 6; s++) {
      const seg = new THREE.Group();
      seg.position.y = s === 0 ? 0 : -0.18;
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08 - s * 0.01, 0.065 - s * 0.009, 0.2, 14),
        s % 2 ? matOcto : matOctoDark
      );
      mesh.position.y = -0.1;
      for (let su = 0; su < 3; su++) {
        const suck = new THREE.Mesh(new THREE.SphereGeometry(0.028, 5, 4), matSuckers);
        suck.position.set(0, -0.02 - su * 0.05, 0.06);
        mesh.add(suck);
      }
      // Tip curl on last segments
      if (s > 3) mesh.rotation.x = 0.25 * (s - 3);
      seg.add(mesh);
      parent.add(seg);
      segs.push(seg);
      parent = seg;
    }
    tentRoot.rotation.x = 0.65 + Math.sin(ang) * 0.35;
    tentRoot.rotation.z = Math.cos(ang) * 0.55;
    headRoot.add(tentRoot);
    tentacles.push({ root: tentRoot, segs, phase: i * 0.7 });
  }
  headRoot.add(head, face, eyeWL, eyeWR, lidL, lidR, pupL, pupR, shineL, shineR, beak);

  // ── Bigger pirate hat (parented to octopus head) ──
  const hat = new THREE.Group();
  hat.position.y = 0.28;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.28, 12), matHat);
  crown.position.y = 0.16;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 14), matHat);
  brim.position.y = 0.02;
  const flapF = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.35, 0.1), matHat);
  flapF.position.set(0, 0.22, -0.52);
  flapF.rotation.x = -0.55;
  const flapL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.7), matHat);
  flapL.position.set(-0.52, 0.22, 0);
  flapL.rotation.z = 0.5;
  const flapR = flapL.clone();
  flapR.position.x = 0.52;
  flapR.rotation.z = -0.5;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.1, 12), matHatBand);
  band.position.y = 0.06;
  // Feather plume
  const feather = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.7, 5), matSash);
  feather.position.set(0.35, 0.55, 0.1);
  feather.rotation.z = -0.6;
  feather.rotation.x = 0.3;
  const feather2 = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.5, 5), matCoatTrim);
  feather2.position.set(0.4, 0.5, 0.05);
  feather2.rotation.z = -0.45;
  // Skull & bones
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), matSkull);
  skull.position.set(0, 0.22, -0.58);
  const eyeSkL = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), matHat);
  eyeSkL.position.set(-0.035, 0.23, -0.66);
  const eyeSkR = eyeSkL.clone();
  eyeSkR.position.x = 0.035;
  const bone1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.035), matSkull);
  bone1.position.set(0, 0.1, -0.58);
  bone1.rotation.z = 0.55;
  const bone2 = bone1.clone();
  bone2.rotation.z = -0.55;
  hat.add(crown, brim, flapF, flapL, flapR, band, feather, feather2, skull, eyeSkL, eyeSkR, bone1, bone2);

  // Legs / boots (taller)
  const thighL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.5), matPants);
  thighL.position.set(-0.18, 0.2, -0.18);
  const thighR = thighL.clone();
  thighR.position.x = 0.18;
  const shinL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.18), matPants);
  shinL.position.set(-0.18, -0.02, -0.48);
  const shinR = shinL.clone();
  shinR.position.x = 0.18;
  const footL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.34), matBoot);
  footL.position.set(-0.18, -0.22, -0.58);
  const footR = footL.clone();
  footR.position.x = 0.18;
  // Boot cuffs
  const cuffL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2), matBoot);
  cuffL.position.set(-0.18, 0.12, -0.48);
  const cuffR = cuffL.clone();
  cuffR.position.x = 0.18;

  // Human arms (skin hands — more human body)
  const matSleeve = matCoat;
  const shoulderL = new THREE.Group();
  shoulderL.position.set(-0.48, 0.95, 0);
  const upperL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.44, 0.2), matSleeve);
  upperL.position.y = -0.22;
  shoulderL.add(upperL);
  const cuffArmL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.22), matCoatTrim);
  cuffArmL.position.y = -0.42;
  shoulderL.add(cuffArmL);
  const elbowL = new THREE.Group();
  elbowL.position.y = -0.44;
  shoulderL.add(elbowL);
  const lowerL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.38, 0.17), matSkin);
  lowerL.position.y = -0.19;
  elbowL.add(lowerL);
  // Human hand + fingers
  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.16), matSkin);
  handL.position.set(0, -0.4, -0.02);
  elbowL.add(handL);
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.04), matSkin);
    finger.position.set((i - 1.5) * 0.04, -0.5, -0.04);
    elbowL.add(finger);
  }
  const thumbL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.04), matSkin);
  thumbL.position.set(-0.1, -0.42, 0.04);
  thumbL.rotation.z = 0.5;
  elbowL.add(thumbL);

  const shoulderR = new THREE.Group();
  shoulderR.position.set(0.48, 0.95, 0);
  const upperR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.44, 0.2), matSleeve);
  upperR.position.y = -0.22;
  shoulderR.add(upperR);
  const cuffArmR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.22), matCoatTrim);
  cuffArmR.position.y = -0.42;
  shoulderR.add(cuffArmR);
  const elbowR = new THREE.Group();
  elbowR.position.y = -0.44;
  shoulderR.add(elbowR);
  const lowerR = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.38, 0.17), matSkin);
  lowerR.position.y = -0.19;
  elbowR.add(lowerR);
  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.16), matSkin);
  handR.position.set(0, -0.4, -0.02);
  elbowR.add(handR);
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.04), matSkin);
    finger.position.set((i - 1.5) * 0.04, -0.5, -0.04);
    elbowR.add(finger);
  }

  // Longer fishing rod
  const rodGroup = new THREE.Group();
  rodGroup.position.set(0, -0.35, 0);
  elbowR.add(rodGroup);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 2.9, 12), matRod);
  rod.rotation.x = Math.PI / 2;
  rod.position.set(0, 0, -1.3);
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 14), matReel);
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.1, 0, -0.3);
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 4), matLine);
  line.position.set(0, 0, -2.5);
  const bobber = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 6, 5),
    new THREE.MeshLambertMaterial({ color: 0xef4444 })
  );
  bobber.position.set(0, 0, -3.0);
  // Salmon (pink MC salmon colors)
  const catchFish = new THREE.Group();
  catchFish.visible = false;
  const fishBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.22, 0.55),
    new THREE.MeshLambertMaterial({ color: 0xe07a5f })
  );
  const fishBelly = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.1, 0.45),
    new THREE.MeshLambertMaterial({ color: 0xf4a261 })
  );
  fishBelly.position.y = -0.08;
  const fishTail = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.2, 0.16),
    new THREE.MeshLambertMaterial({ color: 0xc45c44 })
  );
  fishTail.position.z = 0.35;
  const fishFin = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.14, 0.12),
    new THREE.MeshLambertMaterial({ color: 0xd96b52 })
  );
  fishFin.position.set(0, 0.14, 0);
  catchFish.add(fishBody, fishBelly, fishTail, fishFin);
  catchFish.position.set(0, 0, -2.8);
  rodGroup.add(rod, reel, line, bobber, catchFish);

  // Hat rides with octopus head when he takes it off
  headRoot.add(hat);

  // Extra pirate detail: belt, pocket, medals, eyepatch on hat, guitar prop, sand crate
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.1, 0.54), matBoot);
  belt.position.y = 0.22;
  const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.1), matCoatTrim);
  pouch.position.set(0.32, 0.22, -0.28);
  const medal1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 14), matCoatTrim);
  medal1.rotation.x = Math.PI / 2;
  medal1.position.set(-0.15, 0.72, -0.28);
  const medal2 = medal1.clone();
  medal2.position.x = -0.05;
  const medalRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.02), matSash);
  medalRibbon.position.set(-0.15, 0.8, -0.28);
  const coatButtonRow = [];
  for (let i = 0; i < 5; i++) {
    const rb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), matCoatTrim);
    rb.position.set(0.18, 0.88 - i * 0.12, -0.28);
    coatButtonRow.push(rb);
  }
  // Coat inner lining detail
  const lining = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.08), new THREE.MeshLambertMaterial({ color: 0x7f1d1d }));
  lining.position.set(0, 0.55, 0.22);
  // Coat pocket flaps
  const pocketL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.06), matCoat);
  pocketL.position.set(-0.28, 0.4, -0.28);
  const pocketR = pocketL.clone();
  pocketR.position.x = 0.28;
  // Collar points
  const colL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.08), matCoat);
  colL.position.set(-0.2, 0.98, -0.22);
  colL.rotation.z = 0.3;
  const colR = colL.clone();
  colR.position.x = 0.2;
  colR.rotation.z = -0.3;
  // Peg-style boot detail + sock
  const bootCuffL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.22), matSash);
  bootCuffL.position.set(-0.18, 0.02, -0.35);
  const bootCuffR = bootCuffL.clone();
  bootCuffR.position.x = 0.18;
  // Boot buckles
  const buckL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.04), matCoatTrim);
  buckL.position.set(-0.18, -0.12, -0.7);
  const buckR = buckL.clone();
  buckR.position.x = 0.18;
  // Detailed mini guitar
  const guitar = new THREE.Group();
  const gBody = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.12), new THREE.MeshLambertMaterial({ color: 0xb45309 }));
  gBody.position.set(0, 0.15, 0);
  const gHole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10), matHat);
  gHole.rotation.x = Math.PI / 2;
  gHole.position.set(0, 0.15, -0.07);
  const gNeck = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.48, 0.05), new THREE.MeshLambertMaterial({ color: 0x78350f }));
  gNeck.position.set(0, 0.52, 0);
  const gHead = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.06), matCoatTrim);
  gHead.position.set(0, 0.76, 0);
  // Strings
  for (let s = 0; s < 4; s++) {
    const str = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.7, 0.008),
      new THREE.MeshBasicMaterial({ color: 0xe7e5e4 })
    );
    str.position.set((s - 1.5) * 0.025, 0.42, -0.06);
    guitar.add(str);
  }
  guitar.add(gBody, gHole, gNeck, gHead);
  guitar.position.set(0.55, 0.7, 0.15);
  guitar.rotation.z = -0.4;
  guitar.rotation.y = 0.3;
  // Sand bucket + fishing net bag beside chair
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.28, 14), new THREE.MeshLambertMaterial({ color: 0x78716c }));
  bucket.position.set(-0.7, 0.2, -0.2);
  const bucketRim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 6, 12), matChairMetal);
  bucketRim.rotation.x = Math.PI / 2;
  bucketRim.position.set(-0.7, 0.34, -0.2);
  const net = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.08), new THREE.MeshLambertMaterial({ color: 0xe7e5e4 }));
  net.position.set(-0.7, 0.35, 0.15);
  // Net mesh pattern
  for (let n = 0; n < 4; n++) {
    const nl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.015, 0.02), matChairMetal);
    nl.position.set(-0.7, 0.28 + n * 0.05, 0.2);
    root.add(nl);
  }
  // Wheelchair extra frame bars
  const frameBar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.05), matChairMetal);
  frameBar.position.set(0, 0.45, 0.35);
  const frameBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), matChairMetal);
  frameBar2.position.set(-0.42, 0.7, 0.35);
  const frameBar3 = frameBar2.clone();
  frameBar3.position.x = 0.42;
  // Seat cushion detail
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.08, 0.68), new THREE.MeshLambertMaterial({ color: 0x44403c }));
  cushion.position.set(0, 0.78, 0.05);
  // Headrest pad
  const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.1), matChair);
  headrest.position.set(0, 1.55, 0.38);

  // Octopus face extra: brows, freckles, more tentacle tip curls
  const browL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.04), matOctoDark);
  browL.position.set(-0.15, 0.2, -0.4);
  browL.rotation.z = 0.2;
  const browR = browL.clone();
  browR.position.x = 0.15;
  browR.rotation.z = -0.2;
  headRoot.add(browL, browR);
  for (let f = 0; f < 6; f++) {
    const freck = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 4), matOctoDark);
    freck.position.set((f % 3 - 1) * 0.08, -0.06 + (f > 2 ? -0.06 : 0), -0.42);
    headRoot.add(freck);
  }
  // Eyepatch dangling from hat
  const patch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.04), matHat);
  patch.position.set(-0.2, 0.05, -0.55);
  const patchStrap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.02), matHat);
  patchStrap.position.set(0, 0.12, -0.5);
  hat.add(patch, patchStrap);
  // Hat gold trim ring
  const hatTrim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.02, 6, 16), matCoatTrim);
  hatTrim.rotation.x = Math.PI / 2;
  hatTrim.position.y = 0.04;
  hat.add(hatTrim);

  // Telescope prop on lap
  const scope = new THREE.Group();
  const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.55, 14), matChairMetal);
  scopeBody.rotation.z = Math.PI / 2;
  const scopeLens = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 14), new THREE.MeshBasicMaterial({ color: 0x1e3a5f }));
  scopeLens.rotation.z = Math.PI / 2;
  scopeLens.position.x = 0.28;
  scope.add(scopeBody, scopeLens);
  scope.position.set(-0.35, 0.85, -0.15);
  scope.rotation.y = 0.4;
  person.add(scope);

  // Name plate under chair
  const namePlate = makeNameLabel("PIRATE RYAN");
  namePlate.position.set(0, 2.85, 0);
  namePlate.scale.set(2.2, 0.45, 1);
  root.add(namePlate);

  person.add(
    neck, shirt, collar, torso, tailL, tailR, lapelL, lapelR, epL, epR, sash, sashKnot, buckle,
    headRoot,
    thighL, thighR, shinL, shinR, footL, footR, cuffL, cuffR,
    shoulderL, shoulderR,
    belt, pouch, medal1, medal2, medalRibbon, ...coatButtonRow, bootCuffL, bootCuffR,
    lining, pocketL, pocketR, colL, colR, buckL, buckR
  );

  root.add(
    seat, back, brace1, brace2, armL, armR, foot, wheelL, wheelR, castL, castR, person,
    guitar, bucket, bucketRim, net, frameBar, frameBar2, frameBar3, cushion, headrest
  );
  // Taller pirate
  root.scale.setScalar(1.95);
  scene.add(root);

  // Rest pose: arms holding rod toward ocean
  shoulderR.rotation.x = -0.9;
  elbowR.rotation.x = 0.4;
  shoulderL.rotation.x = -0.5;
  elbowL.rotation.x = 0.3;

  beachFishers.push({
    root,
    person,
    shoulderL,
    shoulderR,
    elbowL,
    elbowR,
    rodGroup,
    rod,
    line,
    bobber,
    catchFish,
    wheelL,
    wheelR,
    tentacles,
    headRoot,
    hat,
    headBaseY,
    hatBaseY: 0.28,
    headOff: false,
    // fishing loop; hat off only while eating salmon
    state: "wait",
    timer: 1.5 + Math.random(),
    phase: 0,
    castPower: 0,
    lineLen: 1.2,
  });
}

function updateTreeVines(dt) {
  // Sway hanging leaf vanes like string vines in the wind
  for (const v of treeVines) {
    v.phase += dt * v.speed;
    const wind = Math.sin(v.phase) * v.amp;
    const wind2 = Math.cos(v.phase * 0.85) * v.amp * 0.6;
    v.root.rotation.z = wind * 0.35;
    v.root.rotation.x = wind2 * 0.25;
    v.joints.forEach((j, i) => {
      const t = (i + 1) / v.joints.length;
      j.rotation.z = Math.sin(v.phase + i * 0.7) * v.amp * t;
      j.rotation.x = Math.cos(v.phase * 1.1 + i * 0.5) * v.amp * 0.5 * t;
    });
  }
}

function updatePandas(dt) {
  if (!pandas || !pandas.length) return; // panda removed from game
  const landZMax = OCEAN_START - 16;
  for (const p of pandas) {
    p.phase = (p.phase || 0) + dt;
    p.modeTimer = (p.modeTimer ?? 4) - dt;

    // Switch: walk → eat → walk → sleep → …
    if (p.modeTimer <= 0) {
      const modes = ["walk", "eat", "walk", "sleep", "walk", "eat"];
      const i = (p.modeI || 0) % modes.length;
      p.mode = modes[i];
      p.modeI = i + 1;
      if (p.mode === "walk") {
        p.modeTimer = 10 + Math.random() * 10;
        let tries = 0;
        let nx = p.homeX, nz = p.homeZ;
        while (tries < 12) {
          const ang = Math.random() * Math.PI * 2;
          const dist = 10 + Math.random() * (p.radius || 28);
          nx = p.homeX + Math.cos(ang) * dist;
          nz = p.homeZ + Math.sin(ang) * dist * 0.7;
          if (nz < landZMax - 2 && !(typeof isOcean === "function" && isOcean(nx, nz))) {
            const gy = groundY(nx, nz);
            if (gy >= 0.05 && gy < 10) break;
          }
          tries++;
        }
        p.targetX = nx;
        p.targetZ = nz;
      } else if (p.mode === "eat") {
        p.modeTimer = 5 + Math.random() * 6;
      } else {
        p.modeTimer = 7 + Math.random() * 7;
      }
    }

    const mode = p.mode || "walk";
    const gyHere = Math.max(0, groundY(p.group.position.x, p.group.position.z));
    let moving = false;

    if (mode === "walk") {
      if (p.targetX == null) p.targetX = p.homeX;
      if (p.targetZ == null) p.targetZ = p.homeZ;
      if (
        (typeof isOcean === "function" && isOcean(p.targetX, p.targetZ)) ||
        p.targetZ > landZMax ||
        groundY(p.targetX, p.targetZ) > 10
      ) {
        p.targetX = p.homeX;
        p.targetZ = p.homeZ;
      }

      const prevX = p.group.position.x;
      const prevZ = p.group.position.z;
      const speed = 2.4;
      const dx = p.targetX - prevX;
      const dz = p.targetZ - prevZ;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.4) {
        moving = true;
        const step = Math.min(1, (speed * dt) / dist);
        p.group.position.x = prevX + dx * step;
        p.group.position.z = prevZ + dz * step;
      } else {
        p.modeTimer = Math.min(p.modeTimer, 0.35);
      }
      p.group.position.y = Math.max(0, groundY(p.group.position.x, p.group.position.z));
      p.group.rotation.x = 0;
      p.group.rotation.z = 0;

      const mdx = p.group.position.x - prevX;
      const mdz = p.group.position.z - prevZ;
      if (mdx * mdx + mdz * mdz > 0.00001) {
        const wantYaw = Math.atan2(mdx, mdz) + Math.PI;
        let dy = wantYaw - (p.group.rotation.y || 0);
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        p.group.rotation.y = (p.group.rotation.y || 0) + dy * Math.min(1, 6 * dt);
      }

      // ── REAL quadruped walk — feet lift and step (diagonal gait) ──
      animatePandaLegs(p, dt, true);
      if (p.bodyRoot) {
        const w = p.phase * 3.2;
        p.bodyRoot.position.y = (p.bodyBaseY || 1.35) + Math.abs(Math.sin(w * 2)) * 0.06;
        p.bodyRoot.rotation.z = Math.sin(w) * 0.04;
        p.bodyRoot.rotation.x = 0;
      }
      if (p.headG) {
        p.headG.rotation.x = Math.sin(p.phase * 2.5) * 0.05;
        p.headG.rotation.y = Math.sin(p.phase * 0.7) * 0.08;
      }
    } else if (mode === "eat") {
      p.group.position.y = gyHere;
      p.group.rotation.x = 0;
      p.group.rotation.z = 0;
      animatePandaLegs(p, dt, false); // stand still
      if (p.bodyRoot) {
        p.bodyRoot.position.y = (p.bodyBaseY || 1.35) * 0.92;
        p.bodyRoot.rotation.x = 0.12;
        p.bodyRoot.rotation.z = 0;
      }
      if (p.headG) {
        // Head down to grass, munch
        const munch = Math.sin(p.phase * 6) * 0.08;
        p.headG.rotation.x = 0.55 + munch;
        p.headG.rotation.y = Math.sin(p.phase * 1.2) * 0.1;
      }
    } else {
      // Sleep on side
      p.group.position.y = gyHere + 0.2;
      animatePandaLegs(p, dt, false, true);
      const breath = Math.sin(p.phase * 1.1) * 0.03;
      if (p.bodyRoot) {
        p.bodyRoot.position.y = (p.bodyBaseY || 1.35) * 0.45 + breath;
        p.bodyRoot.rotation.z = Math.PI / 2;
        p.bodyRoot.rotation.x = 0.08;
      }
      if (p.headG) {
        p.headG.rotation.x = 0.1 + breath;
        p.headG.rotation.y = 0.2;
      }
    }

    updatePandaCollider(p);
  }
}

/** Quadruped leg animation — front-left+back-right, then front-right+back-left */
function animatePandaLegs(p, dt, walking, sleeping = false) {
  if (!p.legs) return;
  const sm = Math.min(1, 12 * dt);
  const w = p.phase * 3.4;
  // Diagonal pairs
  const fl = Math.sin(w);
  const fr = Math.sin(w + Math.PI);
  const bl = Math.sin(w + Math.PI);
  const br = Math.sin(w);

  function drive(leg, swing) {
    if (!leg) return;
    if (sleeping) {
      leg.hip.rotation.x += (0.9 - leg.hip.rotation.x) * sm;
      leg.knee.rotation.x += (1.1 - leg.knee.rotation.x) * sm;
      return;
    }
    if (!walking) {
      // Idle stand
      leg.hip.rotation.x += (0 - leg.hip.rotation.x) * sm;
      leg.knee.rotation.x += (0.08 - leg.knee.rotation.x) * sm;
      leg.hip.rotation.z += (0 - leg.hip.rotation.z) * sm;
      return;
    }
    // Forward swing + lift
    const hipX = swing * 0.55;
    const lift = Math.max(0, -swing); // when swinging back recovery, lift knee
    const kneeX = 0.12 + lift * 0.85 + Math.max(0, swing) * 0.1;
    leg.hip.rotation.x += (hipX - leg.hip.rotation.x) * sm;
    leg.knee.rotation.x += (kneeX - leg.knee.rotation.x) * sm;
    // Slight outward
    const out = (leg.side || 1) * 0.04;
    leg.hip.rotation.z += (out - leg.hip.rotation.z) * sm;
  }

  drive(p.legs.FL, fl);
  drive(p.legs.FR, fr);
  drive(p.legs.BL, bl);
  drive(p.legs.BR, br);
}

/** Keep a solid AABB on the panda so the player collides with it */
function updatePandaCollider(p) {
  if (!p || !p.group) return;
  const px = p.group.position.x;
  const py = p.group.position.y;
  const pz = p.group.position.z;
  let halfW = 1.35;
  let halfD = 1.7;
  let height = 2.4;
  if (p.mode === "sleep") {
    halfW = 1.9;
    halfD = 1.9;
    height = 1.4;
  } else if (p.mode === "eat") {
    halfW = 1.4;
    halfD = 1.8;
    height = 2.1;
  }
  if (!p.collider) {
    p.collider = {
      min: new THREE.Vector3(),
      max: new THREE.Vector3(),
      panda: true,
    };
    colliders.push(p.collider);
  }
  p.collider.min.set(px - halfW, py, pz - halfD);
  p.collider.max.set(px + halfW, py + height, pz + halfD);
}

/** Build one leg: hip → upper → knee → lower → paw (feet you can see move) */
function makePandaLeg(parent, side, isFront, mats) {
  const hip = new THREE.Group();
  // side: -1 left, +1 right · front legs more forward (-Z)
  const x = side * 0.72;
  const z = isFront ? -0.85 : 0.9;
  hip.position.set(x, 1.05, z);
  parent.add(hip);

  const upperLen = isFront ? 0.75 : 0.85;
  const upper = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, upperLen, 0.38),
    mats.black
  );
  upper.position.y = -upperLen / 2;
  upper.castShadow = true;
  hip.add(upper);

  const knee = new THREE.Group();
  knee.position.y = -upperLen;
  hip.add(knee);

  const lowerLen = isFront ? 0.65 : 0.7;
  const lower = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, lowerLen, 0.34),
    mats.black
  );
  lower.position.y = -lowerLen / 2;
  lower.castShadow = true;
  knee.add(lower);

  // Visible foot / paw
  const paw = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.22, 0.58),
    mats.black
  );
  paw.position.set(0, -lowerLen - 0.08, isFront ? -0.06 : 0.06);
  paw.castShadow = true;
  knee.add(paw);

  // Toe pads (white tips so motion reads clearly)
  for (let i = 0; i < 3; i++) {
    const toe = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.08, 0.14),
      mats.white
    );
    toe.position.set((i - 1) * 0.14, -lowerLen - 0.12, isFront ? -0.28 : 0.28);
    knee.add(toe);
  }

  return { hip, knee, upper, lower, paw, side, isFront };
}

/** Full big panda with jointed legs — walks with real foot steps */
function buildAnimatedPanda() {
  const mats = {
    white: new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
    black: new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
    nose: new THREE.MeshLambertMaterial({ color: 0x111111 }),
    eye: new THREE.MeshBasicMaterial({ color: 0x111111 }),
  };

  const root = new THREE.Group();
  root.name = "animatedPanda";

  // Body (white belly + black band)
  const bodyRoot = new THREE.Group();
  bodyRoot.position.y = 1.35;
  root.add(bodyRoot);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.35, 2.4), mats.white);
  torso.castShadow = true;
  bodyRoot.add(torso);
  // Black shoulder/band across back
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.55, 1.1), mats.black);
  band.position.set(0, 0.35, -0.15);
  bodyRoot.add(band);
  // Belly fluff
  const belly = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.8), mats.white);
  belly.position.set(0, -0.35, 0.05);
  bodyRoot.add(belly);

  // Head
  const headG = new THREE.Group();
  headG.position.set(0, 0.55, -1.35);
  bodyRoot.add(headG);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.05, 1.05), mats.white);
  head.castShadow = true;
  headG.add(head);
  // Black eye patches
  for (const sx of [-1, 1]) {
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.12), mats.black);
    patch.position.set(sx * 0.32, 0.12, -0.52);
    headG.add(patch);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.08), mats.eye);
    eye.position.set(sx * 0.32, 0.12, -0.58);
    headG.add(eye);
    // Ears
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.22), mats.black);
    ear.position.set(sx * 0.42, 0.58, 0.1);
    headG.add(ear);
  }
  // Snout
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.4), mats.white);
  snout.position.set(0, -0.15, -0.65);
  headG.add(snout);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.12), mats.nose);
  nose.position.set(0, -0.05, -0.88);
  headG.add(nose);

  // Four jointed legs with visible paws
  const legs = {
    FL: makePandaLeg(root, -1, true, mats),
    FR: makePandaLeg(root, 1, true, mats),
    BL: makePandaLeg(root, -1, false, mats),
    BR: makePandaLeg(root, 1, false, mats),
  };

  // Soft shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  root.add(shadow);

  // Overall size — big but not giant
  root.scale.setScalar(1.55);

  return {
    root,
    bodyRoot,
    bodyBaseY: 1.35,
    headG,
    legs,
    shadow,
  };
}

/** PANDA REMOVED — permanently disabled (user request) */
function spawnWalkingPanda(_x, _z, _radius = 14) {
  return null;
}

// Compat: old names do nothing harmful if called

// ═══════════════════════════════════════════════════════════
// REAL 3D GRASSLAND WILDLIFE — actual animal meshes (GLB)
// Deer · cows · sheep · rabbits · horses · goats · birds
// Deer · cows · sheep · horses · wolves · bears · monkeys (no tigers)
// ═══════════════════════════════════════════════════════════

const ANIMAL_MODELS = {
  deer: { path: "assets/models/Deer.glb", size: 1.9, speed: 0.22 },
  cow: { path: "assets/models/Cow.glb", size: 2.2, speed: 0.12 },
  sheep: { path: "assets/models/Sheep.glb", size: 1.1, speed: 0.14 },
  rabbit: { path: "assets/models/Rabbit.glb", size: 0.45, speed: 0.28 },
  horse: { path: "assets/models/Horse.glb", size: 2.3, speed: 0.26 }, // animated three.js horse
  horseAlt: { path: "assets/models/HorsePoly.glb", size: 2.2, speed: 0.24 },
  goat: { path: "assets/models/Goat.glb", size: 1.15, speed: 0.18 },
  bird: { path: "assets/models/Bird.glb", size: 0.55, speed: 0.35, fly: true },
  wolf: { path: "assets/models/Wolf.glb", size: 1.35, speed: 0.3 },
  bear: { path: "assets/models/Bear.glb", size: 2.0, speed: 0.14 },
  monkey: { path: "assets/models/Monkey.glb", size: 0.85, speed: 0.25 },
  fox: { path: "assets/models/Fox.glb", size: 0.9, speed: 0.32 },
  panda: { path: "assets/models/Panda.glb", size: 5.5, speed: 0.12 },
};

function prepareAnimalModel(model, targetSize) {
  model.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
      if (c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        for (let i = 0; i < mats.length; i++) {
          const m = mats[i];
          if (!m) continue;
          if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
            m.roughness = Math.min(0.95, (m.roughness ?? 0.8) + 0.05);
            m.metalness = Math.min(0.12, m.metalness ?? 0);
            m.envMapIntensity = 0.5;
            m.needsUpdate = true;
          } else if (m.color) {
            const upgraded = new THREE.MeshStandardMaterial({
              color: m.color,
              map: m.map || null,
              roughness: 0.88,
              metalness: 0.0,
            });
            if (Array.isArray(c.material)) c.material[i] = upgraded;
            else c.material = upgraded;
          }
        }
      }
    }
  });
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const longest = Math.max(size.x, size.y, size.z, 0.001);
  model.scale.setScalar(targetSize / longest);
  box.setFromObject(model);
  model.position.set(0, -box.min.y, 0);
  return -box.min.y;
}

/** Clone a cached GLB template (loads once per path) */
function loadAnimalTemplate(path, cb) {
  if (_animalTemplateCache[path]) {
    cb(_animalTemplateCache[path]);
    return;
  }
  if (_animalTemplateCache[path + ":loading"]) {
    _animalTemplateCache[path + ":loading"].push(cb);
    return;
  }
  _animalTemplateCache[path + ":loading"] = [cb];
  gltfLoader.load(
    path,
    (gltf) => {
      _animalTemplateCache[path] = gltf;
      const waiters = _animalTemplateCache[path + ":loading"] || [];
      delete _animalTemplateCache[path + ":loading"];
      for (const fn of waiters) fn(gltf);
    },
    undefined,
    (err) => {
      console.error("[NEXUS] animal load failed", path, err);
      delete _animalTemplateCache[path + ":loading"];
    }
  );
}

/**
 * Spawn one REAL 3D animal on the grass.
 * @param {string} kind  key in ANIMAL_MODELS
 */
function spawnWildlife(kind, x, z, opts = {}) {
  const def = ANIMAL_MODELS[kind];
  if (!def) {
    console.warn("unknown animal", kind);
    return null;
  }
  const gy = Math.max(0, groundY(x, z));
  const group = new THREE.Group();
  group.position.set(x, gy, z);
  group.name = "wildlife_" + kind;

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(opts.shadowR || def.size * 0.45, 14),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  scene.add(group);

  const entry = {
    kind,
    group,
    model: null,
    modelReady: false,
    modelBaseY: 0,
    mixer: null,
    actions: {},
    homeX: x,
    homeZ: z,
    radius: opts.radius ?? 10 + Math.random() * 12,
    angle: Math.random() * Math.PI * 2,
    turnSpeed: (def.speed || 0.2) * (0.7 + Math.random() * 0.6),
    walkRate: 3.2 + Math.random() * 1.2,
    phase: Math.random() * 10,
    fly: !!def.fly || !!opts.fly,
    flyHeight: opts.flyHeight ?? (def.fly ? 4 + Math.random() * 5 : 0),
  };
  wildlife.push(entry);

  loadAnimalTemplate(def.path, (gltf) => {
    const model = gltf.scene.clone(true);
    const baseY = prepareAnimalModel(model, opts.size ?? def.size);
    group.add(model);
    entry.model = model;
    entry.modelReady = true;
    entry.modelBaseY = baseY;

    // Play built-in walk/idle animations when the GLB has them (Horse, Fox, …)
    if (gltf.animations && gltf.animations.length) {
      const mixer = new THREE.AnimationMixer(model);
      const actions = {};
      for (const clip of gltf.animations) {
        if (!clip.name && gltf.animations.length === 1) clip.name = "Walk";
        const name = clip.name || "anim";
        actions[name] = mixer.clipAction(clip);
      }
      // Prefer Walk / Run / horse clip
      const prefer =
        actions.Walk ||
        actions.walk ||
        actions.Run ||
        actions.horse_A_ ||
        actions[Object.keys(actions)[0]];
      if (prefer) {
        prefer.play();
        prefer.timeScale = 0.9 + Math.random() * 0.3;
      }
      entry.mixer = mixer;
      entry.actions = actions;
    }
  });

  return entry;
}

/** Fill meadows / savanna / plains with real animals */
function spawnAllGrasslandWildlife() {
  return; // disabled — panda only

  // Avoid deep ocean (z large south)
  const land = (x, z) => z < OCEAN_START - 18;

  const packs = [
    // Deer herds — open meadows
    ...Array.from({ length: 8 }, (_, i) => ({
      kind: "deer",
      x: -30 + (i % 4) * 18 + Math.random() * 6,
      z: 10 + Math.floor(i / 4) * 22 + Math.random() * 8,
      radius: 14,
    })),
    // Cows grazing
    ...Array.from({ length: 6 }, (_, i) => ({
      kind: "cow",
      x: 15 + (i % 3) * 16,
      z: -10 + Math.floor(i / 3) * 18,
      radius: 12,
    })),
    // Sheep flock
    ...Array.from({ length: 8 }, (_, i) => ({
      kind: "sheep",
      x: -90 + (i % 4) * 10,
      z: 5 + Math.floor(i / 4) * 12,
      radius: 11,
      size: 1.0 + Math.random() * 0.2,
    })),
    // Rabbits
    ...Array.from({ length: 10 }, (_, i) => ({
      kind: "rabbit",
      x: -20 + Math.sin(i * 1.7) * 40,
      z: 15 + Math.cos(i * 1.3) * 30,
      radius: 8,
      size: 0.4 + Math.random() * 0.15,
    })),
    // Horses (animated Horse.glb)
    ...Array.from({ length: 5 }, (_, i) => ({
      kind: "horse",
      x: 40 + i * 12,
      z: 30 + (i % 2) * 15,
      radius: 16,
    })),
    // Goats on hillsides
    ...Array.from({ length: 5 }, (_, i) => ({
      kind: "goat",
      x: -40 + i * 14,
      z: -40 + i * 5,
      radius: 10,
    })),
    // Birds over grass
    ...Array.from({ length: 8 }, (_, i) => ({
      kind: "bird",
      x: Math.sin(i * 0.9) * 70,
      z: Math.cos(i * 1.1) * 50,
      radius: 22,
      fly: true,
      flyHeight: 5 + Math.random() * 7,
      size: 0.5 + Math.random() * 0.2,
    })),
    // Wild animals inland
    { kind: "wolf", x: -100, z: 40, radius: 20 },
    { kind: "wolf", x: -110, z: 55, radius: 18 },
    { kind: "bear", x: -120, z: -20, radius: 14 },
    { kind: "bear", x: 70, z: 80, radius: 15 },
    { kind: "fox", x: 10, z: 50, radius: 14 },
    { kind: "fox", x: -15, z: 60, radius: 12 },
    // Monkeys on grass near trees (real mesh)
    ...Array.from({ length: 6 }, (_, i) => ({
      kind: "monkey",
      x: 20 + (i % 3) * 12,
      z: 20 + Math.floor(i / 3) * 14,
      radius: 9,
      size: 0.75 + Math.random() * 0.2,
    })),
  ];

  let n = 0;
  for (const p of packs) {
    if (!land(p.x, p.z)) continue;
    // Stay on walkable grass-ish height
    const gy = groundY(p.x, p.z);
    if (gy < 0.05 || gy > 14) continue;
    spawnWildlife(p.kind, p.x, p.z, p);
    n++;
  }
  console.log(
    "%c[NEXUS] Spawning " + n + " REAL 3D grassland animals",
    "color:#86efac;font-weight:bold"
  );
  if (typeof toast === "function") {
    try {
      toast("Real animals loading in the grass…", "quest");
    } catch (_) {}
  }
}

function updateWildlife(dt) {
  return; // disabled — panda only

  const landZMax = OCEAN_START - 16;
  for (const a of wildlife) {
    a.phase += dt;
    if (a.mixer) a.mixer.update(dt);

    // Patrol circle on land
    a.angle += dt * (a.turnSpeed || 0.2);
    const r = a.radius || 12;
    let tx = a.homeX + Math.cos(a.angle) * r;
    let tz = a.homeZ + Math.sin(a.angle) * r * 0.65;
    if (tz > landZMax) {
      tz = landZMax - 1;
      a.angle += Math.PI * 0.6;
      a.turnSpeed = -Math.abs(a.turnSpeed || 0.2);
    }
    if (typeof isOcean === "function" && isOcean(tx, tz)) {
      a.angle += Math.PI * 0.8;
      tx = a.homeX;
      tz = Math.min(a.homeZ, landZMax - 2);
    }
    let gy = Math.max(0, groundY(tx, tz));
    if (gy < 0.05 || gy > 14) {
      a.angle += 1.2;
      tx = a.homeX;
      tz = a.homeZ;
      gy = Math.max(0, groundY(tx, tz));
    }

    const prevX = a.group.position.x;
    const prevZ = a.group.position.z;
    const lerp = Math.min(1, (a.fly ? 3.5 : 4.5) * dt);
    a.group.position.x = THREE.MathUtils.lerp(prevX, tx, lerp);
    a.group.position.z = THREE.MathUtils.lerp(prevZ, tz, lerp);

    if (a.fly) {
      const bob = Math.sin(a.phase * 2.4) * 0.45;
      a.group.position.y = gy + a.flyHeight + bob;
      a.group.rotation.z = Math.sin(a.phase * 3) * 0.12;
      a.group.rotation.x = Math.sin(a.phase * 2) * 0.08;
    } else {
      a.group.position.y = gy;
    }

    const mdx = a.group.position.x - prevX;
    const mdz = a.group.position.z - prevZ;
    if (mdx * mdx + mdz * mdz > 0.00001) {
      const wantYaw = Math.atan2(mdx, mdz) + Math.PI;
      let dy = wantYaw - (a.group.rotation.y || 0);
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      a.group.rotation.y = (a.group.rotation.y || 0) + dy * Math.min(1, 7 * dt);
    }

    // Body walk bob when no skeletal animation
    if (a.modelReady && a.model && !a.mixer) {
      const w = a.phase * (a.walkRate || 3.5);
      const bob = Math.abs(Math.sin(w * 2)) * (a.kind === "rabbit" ? 0.1 : 0.05);
      a.model.position.y = (a.modelBaseY || 0) + bob;
      a.model.rotation.z = Math.sin(w) * 0.05;
      a.model.rotation.x = Math.sin(w * 2) * 0.03;
    }
  }
}



function updateBeachFishers(dt) {
  for (const f of beachFishers) {
    f.phase += dt;
    f.timer -= dt;

    // Pirate captain driving boat along the coast (pause when YOU sail with him)
    if (f.driving && f.root && !(f.vehicle && f.vehicle.occupied)) {
      f.angle = (f.angle || 0) + dt * f.speed;
      const R = 28;
      const cx = f.homeX;
      const cz = OCEAN_START + 22;
      const px = cx + Math.cos(f.angle) * R;
      const pz = cz + Math.sin(f.angle) * (R * 0.35);
      f.root.position.x = px;
      f.root.position.z = pz;
      f.root.position.y = WATER_SURFACE + 0.2 + Math.sin(f.phase * 2.2) * 0.08;
      // Face travel direction
      f.root.rotation.y = f.angle + Math.PI / 2;
      f.root.rotation.z = Math.sin(f.phase * 1.5) * 0.06;
      f.root.rotation.x = Math.sin(f.phase * 1.2) * 0.04;
      if (f.sail) f.sail.rotation.y = Math.sin(f.phase * 0.8) * 0.12;
      if (f.wheel) f.wheel.rotation.z = f.phase * 1.5;
      if (f.person) f.person.rotation.y = Math.sin(f.phase * 0.5) * 0.08;
      continue;
    }

    // Green octopus tentacles always wiggle
    if (f.tentacles) {
      for (const tent of f.tentacles) {
        tent.phase += dt * 3;
        tent.root.rotation.x = 0.55 + Math.sin(tent.phase) * 0.25;
        tent.root.rotation.z += Math.sin(tent.phase * 1.3) * 0.01;
        tent.segs.forEach((seg, i) => {
          seg.rotation.x = Math.sin(tent.phase + i * 0.8) * 0.35;
          seg.rotation.z = Math.cos(tent.phase * 0.9 + i) * 0.2;
        });
      }
    }

    // Keep head on neck (only HAT comes off while eating)
    if (f.headRoot) {
      const baseY = f.headBaseY ?? 1.28;
      f.headRoot.position.set(0, baseY, 0);
      f.headRoot.rotation.set(0, 0, 0);
    }

    if (f.state === "wait") {
      // Idle: gentle rod sway
      f.shoulderR.rotation.x = -0.85 + Math.sin(f.phase * 1.2) * 0.05;
      f.elbowR.rotation.x = 0.35 + Math.sin(f.phase * 1.5) * 0.04;
      f.bobber.position.set(0, Math.sin(f.phase * 2) * 0.04, -1.4);
      f.line.scale.y = 0.3;
      f.line.position.set(0, 0, -1.3);
      f.catchFish.visible = false;
      if (f.timer <= 0) {
        f.state = "cast";
        f.timer = 1.1;
        f.castPower = 0;
      }
    } else if (f.state === "cast") {
      // Throw cast — arm swings back then forward
      const u = 1 - f.timer / 1.1;
      if (u < 0.35) {
        // Pull back
        const p = u / 0.35;
        f.shoulderR.rotation.x = -0.85 - p * 1.2;
        f.elbowR.rotation.x = 0.35 + p * 0.5;
        f.shoulderL.rotation.x = -0.4;
      } else {
        // Whip forward
        const p = (u - 0.35) / 0.65;
        f.shoulderR.rotation.x = -2.05 + p * 1.6;
        f.elbowR.rotation.x = 0.85 - p * 0.4;
        f.lineLen = 1.2 + p * 4;
        f.line.scale.y = 0.4 + p * 2.5;
        f.line.position.set(0, -p * 0.8, -1.4 - p * 2.2);
        f.bobber.position.set(0, -p * 1.2, -1.5 - p * 3.5);
      }
      f.catchFish.visible = false;
      if (f.timer <= 0) {
        f.state = "float";
        f.timer = 2.5 + Math.random() * 2.5;
        // Snap bobber to water surface world-ish offset
        f.lineLen = 5;
      }
    } else if (f.state === "float") {
      // Line out, bobber on water — waiting for bite
      f.shoulderR.rotation.x = -0.55 + Math.sin(f.phase * 0.8) * 0.04;
      f.elbowR.rotation.x = 0.25;
      f.line.scale.y = 3.2;
      f.line.position.set(0, -1.4, -3.2);
      // Bobber sits on water (local tip roughly over ocean)
      f.bobber.position.set(0, -2.5 + Math.sin(f.phase * 3) * 0.08, -5.5);
      f.catchFish.visible = false;
      // Occasional water splash at bobber
      if (Math.random() < 0.02) {
        const wp = new THREE.Vector3();
        f.bobber.getWorldPosition(wp);
        spawnWaveSplash(wp.x, wp.z, 1);
      }
      if (f.timer <= 0) {
        f.state = "bite";
        f.timer = 0.6;
      }
    } else if (f.state === "bite") {
      // Tug! rod dips
      f.shoulderR.rotation.x = -0.3 + Math.sin(f.phase * 18) * 0.15;
      f.elbowR.rotation.x = 0.5 + Math.sin(f.phase * 20) * 0.1;
      f.bobber.position.set(0, -2.7 + Math.sin(f.phase * 20) * 0.2, -5.5);
      f.line.scale.y = 3.2;
      f.line.position.set(0, -1.5, -3.2);
      if (f.timer <= 0) {
        f.state = "reel";
        f.timer = 1.4;
      }
    } else if (f.state === "reel") {
      // Reel in — rod tip up, fish appears on line
      const u = 1 - f.timer / 1.4;
      f.shoulderR.rotation.x = -0.3 - u * 0.9;
      f.elbowR.rotation.x = 0.5 - u * 0.15;
      f.shoulderL.rotation.x = -0.6;
      // Spin reel visually via bob
      f.line.scale.y = 3.2 * (1 - u * 0.7);
      f.line.position.set(0, -1.4 + u * 0.9, -3.2 + u * 1.5);
      f.bobber.position.set(0, -2.5 + u * 2.2, -5.5 + u * 2.8);
      f.catchFish.visible = true;
      f.catchFish.position.set(0, -2.3 + u * 2.0, -5.2 + u * 2.6);
      f.catchFish.rotation.y = f.phase * 8;
      f.catchFish.rotation.z = Math.sin(f.phase * 10) * 0.4;
      // Wheels tiny roll when excited
      f.wheelL.rotation.x += dt * 0.5;
      f.wheelR.rotation.x += dt * 0.5;
      if (f.timer <= 0) {
        f.state = "show";
        f.timer = 2.8; // eat salmon + hat off
      }
    } else if (f.state === "show") {
      // Eat salmon — take HAT off while eating
      const u = Math.min(1, (2.8 - f.timer) / 0.6); // hat lift first half-second
      f.shoulderR.rotation.x = -1.35;
      f.elbowR.rotation.x = 0.85; // bring salmon to mouth
      // Left hand lifts hat off head
      f.shoulderL.rotation.x = -1.7;
      f.elbowL.rotation.x = 0.9;
      f.line.scale.y = 0.35;
      f.line.position.set(0, -0.2, -0.6);
      f.bobber.position.set(0, -0.15, -0.75);
      // Salmon at mouth — eating
      f.catchFish.visible = true;
      f.catchFish.position.set(0.05, 0.35, -0.55);
      f.catchFish.rotation.set(0.6, f.phase * 1.5, Math.sin(f.phase * 6) * 0.2);
      // Bite motion
      f.person.rotation.x = -0.12 + Math.sin(f.phase * 8) * 0.04;
      // Hat comes off and is held in left hand
      if (f.hat) {
        const hy = f.hatBaseY ?? 0.28;
        f.hat.position.set(-0.55 * u, hy + 0.35 * u + Math.sin(f.phase * 2) * 0.03, -0.25 * u);
        f.hat.rotation.z = u * 0.7;
        f.hat.rotation.x = u * 0.4;
        f.hat.rotation.y = Math.sin(f.phase) * 0.15;
      }
      if (f.timer <= 0) {
        f.state = "wait";
        f.timer = 1.2 + Math.random() * 1.5;
        f.catchFish.visible = false;
        f.person.rotation.x = 0;
        f.lineLen = 1.2;
        // Put hat back on head
        if (f.hat) {
          f.hat.position.set(0, f.hatBaseY ?? 0.28, 0);
          f.hat.rotation.set(0, 0, 0);
        }
        f.shoulderL.rotation.x = -0.5;
        f.elbowL.rotation.x = 0.3;
      }
    } else if (f.hat && f.state !== "show") {
      // Keep hat seated on head when not eating
      f.hat.position.set(0, f.hatBaseY ?? 0.28, 0);
      f.hat.rotation.set(0, 0, 0);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// REALISTIC MONKEY (capuchin-like, jointed, tree jumper)
// ─────────────────────────────────────────────────────────────
function makeMonkeyLimb(len, rTop, rBot, mat) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rBot, rTop, len, 7), mat);
  mesh.position.y = -len / 2;
  return mesh;
}

function createRealisticMonkey() {
  const g = new THREE.Group();
  const fur = blockMats.monkey;
  const furD = blockMats.monkeyDark;
  const furM = blockMats.monkeyMid;
  const faceC = blockMats.monkeyFace;
  const bellyC = blockMats.monkeyBelly;
  const palm = blockMats.monkeyPalm;

  // ── Torso (rounded, slightly forward) ──
  const torso = new THREE.Group();
  torso.position.y = 0.55;
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), fur);
  chest.scale.set(1.05, 1.25, 0.95);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), bellyC);
  belly.position.set(0, -0.06, 0.14);
  belly.scale.set(0.95, 1.05, 0.75);
  const hips = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), furM);
  hips.position.y = -0.28;
  hips.scale.set(1.1, 0.75, 1);
  torso.add(chest, belly, hips);
  g.add(torso);

  // ── Head group (neck pivot) ──
  const headG = new THREE.Group();
  headG.position.set(0, 0.95, 0.04);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), fur);
  skull.scale.set(1.05, 1.0, 1.0);
  // Cream face mask (capuchin-style)
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), faceC);
  face.position.set(0, -0.02, 0.1);
  face.scale.set(0.95, 1.05, 0.85);
  // Muzzle
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), faceC);
  muzzle.position.set(0, -0.08, 0.18);
  muzzle.scale.set(1.15, 0.75, 1.05);
  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5), blockMats.monkeyNose);
  nose.position.set(0, -0.06, 0.24);
  // Mouth line
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.02), blockMats.monkeyNose);
  mouth.position.set(0, -0.12, 0.22);
  // Ears (round, side of head)
  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), furD);
  earL.position.set(-0.19, 0.02, -0.02);
  earL.scale.set(0.55, 1.0, 0.7);
  const earR = earL.clone();
  earR.position.x = 0.19;
  // Inner ear
  const earInL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), faceC);
  earInL.position.set(-0.2, 0.02, 0.01);
  earInL.scale.set(0.4, 0.8, 0.5);
  const earInR = earInL.clone();
  earInR.position.x = 0.2;
  // Eyes
  const eyeWL = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), matEyeWhite);
  eyeWL.position.set(-0.065, 0.02, 0.175);
  const eyeWR = eyeWL.clone();
  eyeWR.position.x = 0.065;
  const pupL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), matEyePupil);
  pupL.position.set(-0.065, 0.02, 0.205);
  const pupR = pupL.clone();
  pupR.position.x = 0.065;
  // Brow ridge
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.04), furD);
  brow.position.set(0, 0.08, 0.16);
  // Fur crown on top of head
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), furD);
  crown.position.set(0, 0.12, -0.02);
  crown.scale.set(1.1, 0.7, 1);
  headG.add(skull, face, muzzle, nose, mouth, earL, earR, earInL, earInR, eyeWL, eyeWR, pupL, pupR, brow, crown);
  g.add(headG);

  // ── Arms (long — real monkeys have long arms) ──
  function makeArm(side) {
    const s = side; // -1 left, +1 right
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.28, 0.78, 0.02);
    const upper = new THREE.Group();
    const upperMesh = makeMonkeyLimb(0.32, 0.055, 0.045, furD);
    upper.add(upperMesh);
    const elbow = new THREE.Group();
    elbow.position.y = -0.32;
    const lowerMesh = makeMonkeyLimb(0.28, 0.04, 0.035, furM);
    elbow.add(lowerMesh);
    const wrist = new THREE.Group();
    wrist.position.y = -0.28;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), palm);
    hand.scale.set(1.1, 0.7, 1.3);
    // Fingers
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 0.08, 4), palm);
      finger.position.set((f - 1.5) * 0.028, -0.05, 0.03);
      finger.rotation.x = 0.4;
      wrist.add(finger);
    }
    // Thumb
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 0.06, 4), palm);
    thumb.position.set(s * -0.05, -0.02, 0.04);
    thumb.rotation.z = s * 0.8;
    wrist.add(hand, thumb);
    elbow.add(wrist);
    upper.add(elbow);
    shoulder.add(upper);
    // Rest pose: arms hang slightly forward
    shoulder.rotation.z = s * 0.35;
    shoulder.rotation.x = 0.15;
    g.add(shoulder);
    return { shoulder, upper, elbow, wrist, hand };
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // ── Legs ──
  function makeLeg(side) {
    const s = side;
    const hip = new THREE.Group();
    hip.position.set(s * 0.12, 0.32, 0.02);
    const upper = new THREE.Group();
    const thigh = makeMonkeyLimb(0.26, 0.06, 0.05, fur);
    upper.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.26;
    const shin = makeMonkeyLimb(0.24, 0.045, 0.04, furD);
    knee.add(shin);
    const ankle = new THREE.Group();
    ankle.position.y = -0.24;
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), palm);
    foot.scale.set(0.9, 0.55, 1.45);
    foot.position.set(0, -0.02, 0.04);
    // Toes
    for (let t = 0; t < 3; t++) {
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), palm);
      toe.position.set((t - 1) * 0.025, -0.03, 0.1);
      ankle.add(toe);
    }
    ankle.add(foot);
    knee.add(ankle);
    upper.add(knee);
    hip.add(upper);
    g.add(hip);
    return { hip, upper, knee, ankle, foot };
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // ── Multi-segment prehensile tail ──
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 0.48, -0.18);
  const segs = [];
  let parent = tailRoot;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04 - i * 0.005, 0.035 - i * 0.005, 0.16, 12),
      i < 3 ? furD : furM
    );
    mesh.position.y = -0.08;
    seg.add(mesh);
    if (i === 0) {
      seg.rotation.x = 0.9;
    } else {
      seg.position.y = -0.15;
      seg.rotation.x = 0.25;
    }
    parent.add(seg);
    parent = seg;
    segs.push(seg);
  }
  g.add(tailRoot);

  return {
    group: g,
    torso,
    headG,
    armL,
    armR,
    legL,
    legR,
    tailRoot,
    tailSegs: segs,
  };
}

function spawnMonkeys(count = 7) {
  const spawns = [
    [25, 25],
    [40, 20],
    [20, 45],
    [32, -20],
    [-15, 35],
    [45, 35],
    [28, 40],
    [50, 15],
  ];
  for (let i = 0; i < count; i++) {
    const [sx, sz] = spawns[i % spawns.length];
    const parts = createRealisticMonkey();
    const gy = Math.max(0, groundY(sx, sz));
    parts.group.position.set(sx + (i % 3) * 2.4, gy, sz + Math.floor(i / 3) * 2.2);
    // Slight size variation
    const sc = 0.92 + (i % 4) * 0.05;
    parts.group.scale.setScalar(sc);
    scene.add(parts.group);

    // Swap blocky monkey for REAL Monkey.glb mesh (keep AI group)
    (function (monkeyParts, scale) {
      loadAnimalTemplate("assets/models/Monkey.glb", (gltf) => {
        const model = gltf.scene.clone(true);
        prepareAnimalModel(model, 0.9 * scale);
        // Hide old blocky meshes
        monkeyParts.group.traverse((c) => {
          if (c.isMesh) c.visible = false;
        });
        monkeyParts.group.add(model);
        monkeyParts.realModel = model;
      });
    })(parts, sc);

    monkeys.push({
      ...parts,
      // Compatibility aliases for animation
      armL: parts.armL.upper,
      armR: parts.armR.upper,
      legL: parts.legL.upper,
      legR: parts.legR.upper,
      shoulderL: parts.armL.shoulder,
      shoulderR: parts.armR.shoulder,
      elbowL: parts.armL.elbow,
      elbowR: parts.armR.elbow,
      hipL: parts.legL.hip,
      hipR: parts.legR.hip,
      kneeL: parts.legL.knee,
      kneeR: parts.legR.knee,
      head: parts.headG,
      tail: parts.tailRoot,
      tailSegs: parts.tailSegs,
      state: i % 2 === 0 ? "treeJump" : "wander",
      timer: 0.3 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      vel: new THREE.Vector3(),
      yaw: Math.random() * Math.PI * 2,
      climbTree: null,
      nextTree: null,
      climbT: 0,
      climbDir: 1,
      bounceCount: 0,
      leapFrom: new THREE.Vector3(),
      leapTo: new THREE.Vector3(),
      leapT: 0,
      leapDur: 0.7,
      heldApple: null,
    });
  }
}

function pickNearestTree(mx, mz, preferApples = false, exclude = null) {
  if (!treeSites.length) return null;
  let best = null;
  let bestD = Infinity;
  for (const t of treeSites) {
    if (exclude && t === exclude) continue;
    const d = (t.x - mx) ** 2 + (t.z - mz) ** 2;
    const score = preferApples && t.hasApples ? d * 0.5 : d;
    if (score < bestD && d < 55 * 55) {
      bestD = score;
      best = t;
    }
  }
  return best || treeSites[0];
}

function pickNearbyTree(mx, mz, exclude, maxDist = 14) {
  let best = null;
  let bestD = Infinity;
  for (const t of treeSites) {
    if (t === exclude) continue;
    const d = Math.hypot(t.x - mx, t.z - mz);
    if (d < 2.5 || d > maxDist) continue;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

function animMonkeyTail(m, amount = 1) {
  if (!m.tailSegs) return;
  m.tailSegs.forEach((seg, i) => {
    seg.rotation.x = (i === 0 ? 0.85 : 0.2) + Math.sin(m.phase * 2 + i * 0.7) * 0.2 * amount;
    seg.rotation.z = Math.sin(m.phase * 1.5 + i) * 0.15 * amount;
  });
}

function resetMonkeyPose(m) {
  if (m.shoulderL) {
    m.shoulderL.rotation.set(0.15, 0, -0.35);
    m.shoulderR.rotation.set(0.15, 0, 0.35);
  }
  if (m.elbowL) {
    m.elbowL.rotation.set(0.2, 0, 0);
    m.elbowR.rotation.set(0.2, 0, 0);
  }
  if (m.hipL) {
    m.hipL.rotation.set(0, 0, 0);
    m.hipR.rotation.set(0, 0, 0);
  }
  if (m.kneeL) {
    m.kneeL.rotation.set(0.15, 0, 0);
    m.kneeR.rotation.set(0.15, 0, 0);
  }
  if (m.head) m.head.rotation.set(0, 0, 0);
  if (m.group) {
    m.group.rotation.x = 0;
    m.group.rotation.z = 0;
  }
}

function startMonkeyLeap(m, targetTree, grabHeightFrac = 0.65) {
  if (!targetTree) return false;
  const g = m.group;
  m.leapFrom.set(g.position.x, g.position.y, g.position.z);
  const grabY = targetTree.groundY + targetTree.climbHeight * grabHeightFrac;
  m.leapTo.set(targetTree.x, grabY, targetTree.z);
  const dist = m.leapFrom.distanceTo(m.leapTo);
  m.leapDur = THREE.MathUtils.clamp(0.45 + dist * 0.06, 0.5, 1.15);
  m.leapT = 0;
  m.climbTree = targetTree;
  m.climbT = targetTree.climbHeight * grabHeightFrac;
  m.state = "leap";
  m.timer = m.leapDur + 0.5;
  m.yaw = Math.atan2(-(m.leapTo.x - m.leapFrom.x), -(m.leapTo.z - m.leapFrom.z));
  return true;
}

function updateMonkeys(dt) {
  for (const m of monkeys) {
    const g = m.group;
    // Sleep far monkeys
    const dx = g.position.x - player.pos.x;
    const dz = g.position.z - player.pos.z;
    if (dx * dx + dz * dz > PERF.farCull * PERF.farCull) {
      g.visible = false;
      continue;
    }
    g.visible = true;
    m.timer -= dt;
    m.phase += dt * 8;
    const ground = walkHeight(g.position.x, g.position.z);

    // Pick new behavior
    if (
      m.timer <= 0 &&
      m.state !== "climb" &&
      m.state !== "eat" &&
      m.state !== "descend" &&
      m.state !== "leap" &&
      m.state !== "treeJump" &&
      m.state !== "branch"
    ) {
      const r = Math.random();
      resetMonkeyPose(m);
      if (r < 0.42 && treeSites.length) {
        // Leap onto a tree like a real monkey
        const t = pickNearestTree(g.position.x, g.position.z, true);
        if (t && Math.hypot(t.x - g.position.x, t.z - g.position.z) < 22) {
          startMonkeyLeap(m, t, 0.55 + Math.random() * 0.25);
        } else {
          m.state = "wander";
          m.timer = 2;
          m.yaw = Math.random() * Math.PI * 2;
          m.vel.set(-Math.sin(m.yaw) * 3.5, 0, -Math.cos(m.yaw) * 3.5);
        }
      } else if (r < 0.62) {
        m.state = "bounce";
        m.timer = 2.2 + Math.random() * 2;
        m.vel.y = 7 + Math.random() * 4;
        m.bounceCount = 0;
        m.yaw = Math.random() * Math.PI * 2;
      } else if (r < 0.75) {
        m.state = "play";
        m.timer = 1.8 + Math.random() * 1.5;
      } else if (r < 0.88) {
        m.state = "sit";
        m.timer = 2 + Math.random() * 2;
      } else {
        m.state = "wander";
        m.timer = 2.5 + Math.random() * 2.5;
        m.yaw = Math.random() * Math.PI * 2;
        const spd = 3 + Math.random() * 1.8;
        m.vel.set(-Math.sin(m.yaw) * spd, 0, -Math.cos(m.yaw) * spd);
      }
    }

    if (m.state === "wander") {
      g.position.x += m.vel.x * dt;
      g.position.z += m.vel.z * dt;
      if (isOcean(g.position.x, g.position.z) || Math.abs(g.position.x) > HALF - 12) {
        m.yaw += Math.PI;
        m.vel.x *= -1;
        m.vel.z *= -1;
      }
      if (groundY(g.position.x, g.position.z) > 2.5) {
        m.yaw += 1.2;
        m.vel.set(-Math.sin(m.yaw) * 3.5, 0, -Math.cos(m.yaw) * 3.5);
      }
      g.position.y = ground;
      g.rotation.y = m.yaw;
      // Walk cycle — shoulder / hip joints
      const s = Math.sin(m.phase);
      if (m.shoulderL) {
        m.shoulderL.rotation.x = 0.2 + s * 0.55;
        m.shoulderR.rotation.x = 0.2 - s * 0.55;
        m.elbowL.rotation.x = 0.4 + Math.abs(s) * 0.3;
        m.elbowR.rotation.x = 0.4 + Math.abs(s) * 0.3;
        m.hipL.rotation.x = -s * 0.5;
        m.hipR.rotation.x = s * 0.5;
        m.kneeL.rotation.x = 0.2 + Math.max(0, -s) * 0.5;
        m.kneeR.rotation.x = 0.2 + Math.max(0, s) * 0.5;
      }
      if (m.head) m.head.rotation.y = Math.sin(m.phase * 0.5) * 0.15;
      animMonkeyTail(m, 1);
    } else if (m.state === "bounce") {
      m.vel.y -= 22 * dt;
      g.position.y += m.vel.y * dt;
      g.position.x += -Math.sin(m.yaw) * 5.2 * dt;
      g.position.z += -Math.cos(m.yaw) * 5.2 * dt;
      if (g.position.y <= ground) {
        g.position.y = ground;
        m.bounceCount++;
        m.vel.y = 7 + Math.random() * 5;
        m.yaw += (Math.random() - 0.5) * 1.4;
        // After a few bounces, leap into a tree
        if (m.bounceCount >= 2 && Math.random() < 0.55) {
          const t = pickNearestTree(g.position.x, g.position.z, true);
          if (t && Math.hypot(t.x - g.position.x, t.z - g.position.z) < 16) {
            startMonkeyLeap(m, t, 0.5 + Math.random() * 0.3);
          }
        }
      }
      if (m.shoulderL) {
        m.shoulderL.rotation.x = -0.8 + Math.sin(m.phase * 2) * 0.3;
        m.shoulderR.rotation.x = -0.8 - Math.sin(m.phase * 2) * 0.3;
        m.shoulderL.rotation.z = -0.9;
        m.shoulderR.rotation.z = 0.9;
        m.hipL.rotation.x = Math.sin(m.phase) * 0.9;
        m.hipR.rotation.x = -Math.sin(m.phase) * 0.9;
      }
      g.rotation.y = m.yaw;
      g.rotation.x = THREE.MathUtils.clamp(m.vel.y * 0.025, -0.25, 0.4);
      animMonkeyTail(m, 1.4);
    } else if (m.state === "leap" && m.climbTree) {
      // Ballistic arc leap onto tree / between trees
      m.leapT += dt;
      const u = Math.min(1, m.leapT / m.leapDur);
      const ease = u * u * (3 - 2 * u);
      g.position.x = THREE.MathUtils.lerp(m.leapFrom.x, m.leapTo.x, ease);
      g.position.z = THREE.MathUtils.lerp(m.leapFrom.z, m.leapTo.z, ease);
      const arc = Math.sin(u * Math.PI) * (1.8 + m.leapFrom.distanceTo(m.leapTo) * 0.12);
      g.position.y = THREE.MathUtils.lerp(m.leapFrom.y, m.leapTo.y, ease) + arc;
      g.rotation.y = m.yaw;
      g.rotation.x = -0.35 + Math.sin(u * Math.PI) * 0.5;
      // Flying pose: arms forward, legs tucked
      if (m.shoulderL) {
        m.shoulderL.rotation.x = -1.4;
        m.shoulderR.rotation.x = -1.4;
        m.shoulderL.rotation.z = -0.5;
        m.shoulderR.rotation.z = 0.5;
        m.elbowL.rotation.x = 0.6;
        m.elbowR.rotation.x = 0.6;
        m.hipL.rotation.x = 1.0;
        m.hipR.rotation.x = 1.0;
        m.kneeL.rotation.x = 1.2;
        m.kneeR.rotation.x = 1.2;
      }
      animMonkeyTail(m, 1.6);
      if (u >= 1) {
        // Grab the tree!
        m.state = "climb";
        m.climbDir = 1;
        m.timer = 4 + Math.random() * 3;
        g.rotation.x = -0.2;
      }
    } else if (m.state === "treeJump") {
      // Jump from one tree canopy to another
      const from = m.climbTree || pickNearestTree(g.position.x, g.position.z);
      const to = pickNearbyTree(from ? from.x : g.position.x, from ? from.z : g.position.z, from, 16);
      if (from && to) {
        m.climbTree = from;
        m.climbT = from.climbHeight * 0.7;
        g.position.set(from.x, from.groundY + m.climbT, from.z);
        startMonkeyLeap(m, to, 0.6 + Math.random() * 0.2);
      } else if (from) {
        m.climbTree = from;
        m.state = "climb";
        m.climbT = from.climbHeight * 0.5;
        m.timer = 3;
      } else {
        m.state = "bounce";
        m.timer = 2;
        m.vel.y = 6;
      }
    } else if (m.state === "play") {
      g.position.y = ground + Math.abs(Math.sin(m.phase * 2.2)) * 0.4;
      g.rotation.y += dt * 3.5;
      if (m.shoulderL) {
        m.shoulderL.rotation.x = -1.2 + Math.sin(m.phase * 3) * 0.5;
        m.shoulderR.rotation.x = -1.2 - Math.sin(m.phase * 3) * 0.5;
        m.shoulderL.rotation.z = -1.1;
        m.shoulderR.rotation.z = 1.1;
      }
      animMonkeyTail(m, 1.8);
      g.position.x += -Math.sin(g.rotation.y) * 1.8 * dt;
      g.position.z += -Math.cos(g.rotation.y) * 1.8 * dt;
    } else if (m.state === "climb" && m.climbTree) {
      const t = m.climbTree;
      const dx = t.x - g.position.x;
      const dz = t.z - g.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.7 && m.climbT < 0.4) {
        // Run to trunk
        g.position.x += (dx / dist) * 5 * dt;
        g.position.z += (dz / dist) * 5 * dt;
        g.position.y = walkHeight(g.position.x, g.position.z);
        g.rotation.y = Math.atan2(-dx, -dz);
        const s = Math.sin(m.phase * 2);
        if (m.shoulderL) {
          m.shoulderL.rotation.x = 0.3 + s * 0.7;
          m.shoulderR.rotation.x = 0.3 - s * 0.7;
          m.hipL.rotation.x = -s * 0.6;
          m.hipR.rotation.x = s * 0.6;
        }
      } else {
        // Climb / scramble up trunk with alternating limbs
        m.climbT += dt * 2.2 * m.climbDir;
        const h = THREE.MathUtils.clamp(m.climbT, 0, t.climbHeight);
        m.climbT = h;
        const ang = m.phase * 0.8;
        g.position.x = t.x + Math.sin(ang) * 0.22;
        g.position.z = t.z + Math.cos(ang) * 0.22;
        g.position.y = t.groundY + h;
        g.rotation.y = ang + Math.PI;
        g.rotation.x = -0.25;
        const climbPhase = Math.sin(m.phase * 4);
        if (m.shoulderL) {
          m.shoulderL.rotation.x = -1.5 + climbPhase * 0.7;
          m.shoulderR.rotation.x = -1.5 - climbPhase * 0.7;
          m.elbowL.rotation.x = 0.9;
          m.elbowR.rotation.x = 0.9;
          m.hipL.rotation.x = 0.6 - climbPhase * 0.5;
          m.hipR.rotation.x = 0.6 + climbPhase * 0.5;
          m.kneeL.rotation.x = 0.9;
          m.kneeR.rotation.x = 0.9;
        }
        animMonkeyTail(m, 0.8);
        // In canopy: eat, jump to another tree, or scramble on branches
        if (h >= t.climbHeight - 0.2 && m.climbDir > 0) {
          const rr = Math.random();
          if (rr < 0.4) {
            m.state = "eat";
            m.timer = 2.2 + Math.random();
            for (const a of apples) {
              if (a.eaten || a.tree !== t.group) continue;
              a.eaten = true;
              a.mesh.visible = false;
              setTimeout(() => {
                if (a.mesh) {
                  a.eaten = false;
                  a.mesh.visible = true;
                }
              }, 16000);
              break;
            }
          } else if (rr < 0.75) {
            // Jump to another tree!
            const next = pickNearbyTree(t.x, t.z, t, 15);
            if (next) {
              startMonkeyLeap(m, next, 0.55 + Math.random() * 0.3);
            } else {
              m.state = "branch";
              m.timer = 2 + Math.random() * 2;
            }
          } else {
            m.state = "branch";
            m.timer = 2.5 + Math.random() * 2;
          }
        }
      }
    } else if (m.state === "branch" && m.climbTree) {
      // Move around in the canopy / hang
      const t = m.climbTree;
      const sway = Math.sin(m.phase * 1.5);
      g.position.x = t.x + Math.cos(m.phase * 0.7) * 0.55;
      g.position.z = t.z + Math.sin(m.phase * 0.7) * 0.55;
      g.position.y = t.groundY + t.climbHeight * 0.75 + Math.sin(m.phase) * 0.15;
      g.rotation.y = m.phase * 0.7;
      g.rotation.x = -0.4 + sway * 0.1;
      if (m.shoulderL) {
        m.shoulderL.rotation.x = -2.2;
        m.shoulderR.rotation.x = -2.0;
        m.shoulderL.rotation.z = -0.3;
        m.shoulderR.rotation.z = 0.3;
        m.hipL.rotation.x = 0.8;
        m.hipR.rotation.x = 0.9;
      }
      animMonkeyTail(m, 1.2);
      if (m.timer <= 0) {
        const next = pickNearbyTree(t.x, t.z, t, 14);
        if (next && Math.random() < 0.55) {
          startMonkeyLeap(m, next, 0.6);
        } else {
          m.state = "descend";
          m.climbDir = -1;
          m.timer = 3;
        }
      }
    } else if (m.state === "eat" && m.climbTree) {
      const t = m.climbTree;
      g.position.x = t.x + 0.25;
      g.position.z = t.z;
      g.position.y = t.groundY + t.climbHeight * 0.72;
      g.rotation.x = 0.15;
      // Hands to mouth
      if (m.shoulderL) {
        m.shoulderL.rotation.x = -2.0 + Math.sin(m.phase * 5) * 0.2;
        m.shoulderR.rotation.x = -1.6;
        m.elbowL.rotation.x = 1.4;
        m.elbowR.rotation.x = 1.1;
        m.hipL.rotation.x = 0.9;
        m.hipR.rotation.x = 1.0;
      }
      if (m.head) m.head.rotation.x = Math.sin(m.phase * 4) * 0.12;
      animMonkeyTail(m, 0.6);
      if (m.timer <= 0) {
        if (m.head) m.head.rotation.x = 0;
        const next = pickNearbyTree(t.x, t.z, t, 13);
        if (next && Math.random() < 0.5) {
          startMonkeyLeap(m, next, 0.65);
        } else {
          m.state = "descend";
          m.climbDir = -1;
          m.timer = 3;
        }
      }
    } else if (m.state === "descend" && m.climbTree) {
      const t = m.climbTree;
      m.climbT = Math.max(0, m.climbT - dt * 2.6);
      g.position.x = t.x;
      g.position.z = t.z;
      g.position.y = t.groundY + m.climbT;
      g.rotation.y -= dt * 1.4;
      g.rotation.x = -0.2;
      const climbPhase = Math.sin(m.phase * 4);
      if (m.shoulderL) {
        m.shoulderL.rotation.x = -1.4 + climbPhase * 0.6;
        m.shoulderR.rotation.x = -1.4 - climbPhase * 0.6;
        m.hipL.rotation.x = 0.5 - climbPhase * 0.4;
        m.hipR.rotation.x = 0.5 + climbPhase * 0.4;
      }
      if (m.climbT <= 0.12) {
        g.position.y = walkHeight(g.position.x, g.position.z);
        m.state = "bounce";
        m.timer = 1.6 + Math.random();
        m.vel.y = 5 + Math.random() * 3;
        m.climbTree = null;
        resetMonkeyPose(m);
      }
    } else if (m.state === "sit") {
      g.position.y = ground;
      g.rotation.x = 0.2;
      if (m.shoulderL) {
        m.shoulderL.rotation.x = 0.3;
        m.shoulderR.rotation.x = 0.25;
        m.shoulderL.rotation.z = -0.4;
        m.shoulderR.rotation.z = 0.4;
        m.hipL.rotation.x = 1.3;
        m.hipR.rotation.x = 1.3;
        m.kneeL.rotation.x = 1.4;
        m.kneeR.rotation.x = 1.4;
      }
      if (m.head) m.head.rotation.y = Math.sin(m.phase * 0.4) * 0.35;
      animMonkeyTail(m, 0.5);
    }

    g.position.x = THREE.MathUtils.clamp(g.position.x, -HALF + 8, HALF - 8);
    g.position.z = THREE.MathUtils.clamp(g.position.z, -HALF + 8, OCEAN_START - 5);
  }
}

/**
 * Movable dolphin with hinge groups for fluid swim (not stiff).
 * BLACK & WHITE · Root → body → tail → flukes | pec fins
 */
function createDolphin() {
  const root = new THREE.Group();
  // Pure black & white palette (no blue)
  const black = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
  const blackSoft = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const blackHi = new THREE.MeshLambertMaterial({ color: 0x2c2c2c });
  const white = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
  const whiteSoft = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });

  function box(parent, w, h, d, x, y, z, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // Hinge chain so body can flex while swimming
  const body = new THREE.Group();
  root.add(body);
  const mid = new THREE.Group();
  mid.position.z = 0.55;
  body.add(mid);
  const front = new THREE.Group();
  front.position.z = 0.9;
  mid.add(front);
  const head = new THREE.Group();
  head.position.z = 0.85;
  front.add(head);
  const tail = new THREE.Group();
  tail.position.z = -0.7;
  body.add(tail);
  const tail2 = new THREE.Group();
  tail2.position.z = -0.7;
  tail.add(tail2);
  const fluke = new THREE.Group();
  fluke.position.z = -0.55;
  tail2.add(fluke);

  // Body — black top, white belly
  box(body, 0.95, 0.8, 1.1, 0, 0.12, 0, black);
  box(body, 0.72, 0.28, 1.4, 0, -0.22, 0.1, white);
  box(mid, 1.0, 0.85, 1.1, 0, 0.14, 0, black);
  box(mid, 0.7, 0.25, 1.0, 0, -0.2, 0, white);
  // White side patches
  box(mid, 0.12, 0.35, 0.7, -0.52, 0.05, 0.05, whiteSoft);
  box(mid, 0.12, 0.35, 0.7, 0.52, 0.05, 0.05, whiteSoft);
  box(front, 0.95, 0.8, 0.95, 0, 0.12, 0, blackSoft);
  box(front, 0.65, 0.22, 0.85, 0, -0.2, 0, white);
  // Head + snout — black with white chin
  box(head, 0.88, 0.75, 0.75, 0, 0.15, 0.2, black);
  box(head, 0.55, 0.25, 0.4, 0, 0.45, 0.3, blackHi);
  box(head, 0.42, 0.32, 0.75, 0, 0.0, 0.85, blackSoft);
  box(head, 0.36, 0.22, 0.4, 0, -0.04, 1.25, black);
  box(head, 0.3, 0.04, 0.35, 0, -0.12, 1.05, blackHi);
  box(head, 0.38, 0.14, 0.55, 0, -0.18, 0.75, white);
  // White eye patches
  box(head, 0.28, 0.22, 0.08, -0.42, 0.22, 0.35, white);
  box(head, 0.28, 0.22, 0.08, 0.42, 0.22, 0.35, white);
  box(head, 0.14, 0.14, 0.06, -0.38, 0.25, 0.45, eyeWhite);
  box(head, 0.14, 0.14, 0.06, 0.38, 0.25, 0.45, eyeWhite);
  box(head, 0.08, 0.08, 0.05, -0.38, 0.25, 0.39, eyeMat);
  box(head, 0.08, 0.08, 0.05, 0.38, 0.25, 0.39, eyeMat);
  // Dorsal — black
  box(mid, 0.16, 0.5, 0.5, 0, 0.75, -0.1, black);
  box(mid, 0.14, 0.4, 0.35, 0, 1.05, -0.2, blackHi);
  // Pec fins — black
  const pecL = new THREE.Group();
  pecL.position.set(-0.55, -0.02, 0.2);
  mid.add(pecL);
  box(pecL, 0.85, 0.12, 0.45, -0.35, 0, 0, black);
  pecL.rotation.z = 0.35;
  const pecR = new THREE.Group();
  pecR.position.set(0.55, -0.02, 0.2);
  mid.add(pecR);
  box(pecR, 0.85, 0.12, 0.45, 0.35, 0, 0, black);
  pecR.rotation.z = -0.35;
  // Tail — black + white underside
  box(tail, 0.55, 0.5, 0.75, 0, 0.08, 0, black);
  box(tail, 0.4, 0.14, 0.6, 0, -0.12, 0, whiteSoft);
  box(tail2, 0.42, 0.38, 0.55, 0, 0.06, 0, blackSoft);
  // Flukes — black
  box(fluke, 0.95, 0.1, 0.5, -0.5, 0.04, 0, black);
  box(fluke, 0.95, 0.1, 0.5, 0.5, 0.04, 0, black);
  box(fluke, 0.35, 0.08, 0.25, -0.9, 0.04, -0.2, blackHi);
  box(fluke, 0.35, 0.08, 0.25, 0.9, 0.04, -0.2, blackHi);

  return { group: root, body, mid, front, head, tail, tail2, fluke, pecL, pecR };
}


// ── RON LION FORM (F) ──
/**
 * Build a bold blocky LION (Ron animal form) — user drawing:
 * long yellow body · orange mane head · short stubby legs · cartoon face.
 * Body points −Z (same as avatar face direction).
 */
function buildYellowTiger() {
  /**
   * Yellow lion — BIGGER body, more muscle / surface detail
   */
  const root = new THREE.Group();
  root.name = "earthLion";

  const yellow = new THREE.MeshStandardMaterial({ color: 0xffd54a, roughness: 0.88, metalness: 0.04 });
  const yellowDeep = new THREE.MeshStandardMaterial({ color: 0xe09818, roughness: 0.9, metalness: 0.04 });
  const yellowMid = new THREE.MeshStandardMaterial({ color: 0xf0b428, roughness: 0.88, metalness: 0.03 });
  const yellowLight = new THREE.MeshStandardMaterial({ color: 0xffe566, roughness: 0.86, metalness: 0.03 });
  const yellowBelly = new THREE.MeshStandardMaterial({ color: 0xfff3b0, roughness: 0.94, metalness: 0 });
  const yellowShade = new THREE.MeshStandardMaterial({ color: 0xc88810, roughness: 0.92, metalness: 0.04 });
  const yellowHi = new THREE.MeshStandardMaterial({ color: 0xfff080, roughness: 0.85, metalness: 0.05 });
  const mane = [
    new THREE.MeshStandardMaterial({ color: 0xc47a12, roughness: 1, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: 0xa8620e, roughness: 1, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: 0xd4891a, roughness: 1, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: 0xb86e10, roughness: 1, metalness: 0 }),
  ];
  const faceM = new THREE.MeshStandardMaterial({ color: 0xffcc55, roughness: 0.88, metalness: 0.02 });
  const faceShade = new THREE.MeshStandardMaterial({ color: 0xe8b040, roughness: 0.9, metalness: 0.02 });
  const noseM = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.65, metalness: 0.08 });
  const noseTip = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.55, metalness: 0.1 });
  const black = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const eyeAmber = new THREE.MeshLambertMaterial({ color: 0xf0a020 });
  const pink = new THREE.MeshLambertMaterial({ color: 0xe8a090 });
  const clawM = new THREE.MeshLambertMaterial({ color: 0x3a3028 });
  const padM = new THREE.MeshLambertMaterial({ color: 0x4a3830 });
  const lipM = new THREE.MeshLambertMaterial({ color: 0xc45a48 });

  function box(p, w, h, d, x, y, z, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    p.add(m);
    return m;
  }
  function puff(p, x, y, z, sx, sy, sz, mat) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    p.add(m);
    return m;
  }

  // ══════════ BIG DETAILED BODY ══════════
  // Core torso (wider + longer + taller)
  box(root, 0.85, 0.72, 2.35, 0, 0.78, 0.2, yellow);
  // Nested torso shells for depth
  box(root, 0.78, 0.62, 2.15, 0, 0.78, 0.2, yellowMid);
  // Chest power (photo lion chest)
  puff(root, 0, 0.85, -0.85, 2.35, 2.0, 1.9, yellow);
  box(root, 0.95, 0.82, 0.7, 0, 0.82, -0.7, yellowDeep);
  box(root, 0.88, 0.7, 0.55, 0, 0.8, -0.85, yellowMid);
  // Pectoral splits
  box(root, 0.32, 0.35, 0.45, -0.28, 0.75, -0.78, yellowShade);
  box(root, 0.32, 0.35, 0.45, 0.28, 0.75, -0.78, yellowShade);
  // Shoulder caps
  puff(root, -0.42, 0.95, -0.6, 1.15, 1.05, 1.1, yellowDeep);
  puff(root, 0.42, 0.95, -0.6, 1.15, 1.05, 1.1, yellowDeep);
  box(root, 0.28, 0.24, 0.35, -0.4, 1.0, -0.5, yellowShade);
  box(root, 0.28, 0.24, 0.35, 0.4, 1.0, -0.5, yellowShade);
  // Scapula ridges
  box(root, 0.18, 0.12, 0.32, -0.32, 1.12, -0.4, yellowHi);
  box(root, 0.18, 0.12, 0.32, 0.32, 1.12, -0.4, yellowHi);

  // Rib cage rows (left + right)
  for (let i = 0; i < 6; i++) {
    const z = -0.45 + i * 0.32;
    box(root, 0.1, 0.42, 0.14, -0.46, 0.78, z, yellowShade);
    box(root, 0.1, 0.42, 0.14, 0.46, 0.78, z, yellowShade);
    box(root, 0.06, 0.28, 0.1, -0.5, 0.72, z, yellowDeep);
    box(root, 0.06, 0.28, 0.1, 0.5, 0.72, z, yellowDeep);
  }
  // Spine vertebrae bumps
  for (let i = 0; i < 11; i++) {
    box(root, 0.22, 0.12, 0.16, 0, 1.14, -0.75 + i * 0.28, yellowLight);
    box(root, 0.14, 0.08, 0.12, 0, 1.2, -0.75 + i * 0.28, yellowHi);
  }
  // Back muscle plates
  box(root, 0.7, 0.14, 1.85, 0, 1.05, 0.15, yellowMid);
  box(root, 0.25, 0.16, 1.5, -0.22, 1.0, 0.15, yellowShade);
  box(root, 0.25, 0.16, 1.5, 0.22, 1.0, 0.15, yellowShade);

  // Belly — multi plate
  box(root, 0.62, 0.16, 1.85, 0, 0.4, 0.15, yellowBelly);
  box(root, 0.52, 0.12, 0.5, 0, 0.38, -0.65, yellowBelly);
  box(root, 0.48, 0.1, 0.4, 0, 0.37, 0.85, yellowBelly);
  // Soft belly puffs
  puff(root, 0, 0.38, 0.1, 1.6, 0.7, 3.2, yellowBelly);
  // Under-chest
  box(root, 0.55, 0.14, 0.45, 0, 0.42, -0.85, yellowLight);

  // Waist tuck
  box(root, 0.7, 0.55, 0.4, 0, 0.72, 0.5, yellowMid);

  // Hip / rump — big powerful
  puff(root, 0, 0.78, 1.15, 1.9, 1.7, 1.7, yellowDeep);
  box(root, 0.8, 0.68, 0.55, 0, 0.76, 1.05, yellow);
  // Glute blocks
  box(root, 0.3, 0.35, 0.35, -0.32, 0.78, 1.12, yellowShade);
  box(root, 0.3, 0.35, 0.35, 0.32, 0.78, 1.12, yellowShade);
  // Hip bones
  box(root, 0.16, 0.14, 0.2, -0.38, 0.95, 1.0, yellowHi);
  box(root, 0.16, 0.14, 0.2, 0.38, 0.95, 1.0, yellowHi);
  // Thigh start on body
  box(root, 0.28, 0.4, 0.35, -0.38, 0.55, 1.0, yellowDeep);
  box(root, 0.28, 0.4, 0.35, 0.38, 0.55, 1.0, yellowDeep);

  // Flank highlight strips
  for (let i = 0; i < 5; i++) {
    box(root, 0.07, 0.28, 0.14, -0.44, 0.7, -0.4 + i * 0.32, yellowLight);
    box(root, 0.07, 0.28, 0.14, 0.44, 0.7, -0.4 + i * 0.32, yellowLight);
  }

  // ══════════ BIG DETAILED LEGS ══════════
  const legs = [];
  const legSpecs = [
    { x: -0.34, z: -0.72, front: true },
    { x: 0.34, z: -0.72, front: true },
    { x: -0.36, z: 0.85, front: false },
    { x: 0.36, z: 0.85, front: false },
  ];
  for (const L of legSpecs) {
    const g = new THREE.Group();
    g.position.set(L.x, 0, L.z);
    root.add(g);
    // thick thigh
    box(g, 0.26, 0.42, 0.28, 0, 0.58, 0, yellowDeep);
    box(g, 0.2, 0.32, 0.22, 0, 0.55, L.front ? 0.04 : -0.02, yellowShade);
    // knee
    puff(g, 0, 0.38, 0.03, 0.7, 0.55, 0.65, yellowMid);
    box(g, 0.18, 0.12, 0.18, 0, 0.36, 0.04, yellowHi);
    // shin
    box(g, 0.18, 0.32, 0.18, 0, 0.2, L.front ? 0.04 : 0.06, yellow);
    box(g, 0.12, 0.22, 0.12, 0, 0.2, L.front ? 0.08 : 0.1, yellowMid);
    // ankle
    box(g, 0.16, 0.1, 0.16, 0, 0.08, 0.04, yellowShade);
    // big paw
    box(g, 0.28, 0.11, 0.34, 0, 0.05, 0.06, yellowLight);
    box(g, 0.24, 0.06, 0.2, 0, 0.03, -0.02, yellowMid);
    // toes
    for (const tx of [-0.09, -0.03, 0.03, 0.09]) {
      box(g, 0.055, 0.06, 0.1, tx, 0.04, -0.12, yellowLight);
      box(g, 0.04, 0.035, 0.05, tx, 0.025, -0.18, padM);
      box(g, 0.03, 0.04, 0.05, tx, 0.035, -0.2, clawM);
    }
    // main pad
    box(g, 0.14, 0.04, 0.12, 0, 0.02, 0.02, padM);
    legs.push(g);
  }

  // ══════════ HEAD (keep detailed) ══════════
  const head = new THREE.Group();
  head.position.set(0, 1.0, -1.45);
  root.add(head);

  box(head, 0.48, 0.44, 0.42, 0, 0.12, -0.05, faceM);
  box(head, 0.42, 0.12, 0.38, 0, 0.3, -0.02, faceShade);
  box(head, 0.14, 0.2, 0.22, -0.22, 0.1, -0.12, faceShade);
  box(head, 0.14, 0.2, 0.22, 0.22, 0.1, -0.12, faceShade);
  box(head, 0.32, 0.26, 0.28, 0, 0.02, -0.32, faceM);
  box(head, 0.28, 0.1, 0.22, 0, 0.12, -0.36, faceShade);
  box(head, 0.26, 0.14, 0.18, 0, -0.04, -0.46, yellowBelly);
  box(head, 0.09, 0.12, 0.18, 0, 0.12, -0.44, faceShade);
  box(head, 0.13, 0.09, 0.11, 0, 0.06, -0.55, noseM);
  box(head, 0.07, 0.045, 0.045, 0, 0.08, -0.6, noseTip);
  box(head, 0.03, 0.025, 0.03, -0.035, 0.055, -0.59, black);
  box(head, 0.03, 0.025, 0.03, 0.035, 0.055, -0.59, black);
  box(head, 0.22, 0.045, 0.09, 0, -0.08, -0.5, lipM);
  box(head, 0.18, 0.03, 0.05, 0, -0.12, -0.48, black);
  box(head, 0.2, 0.12, 0.14, 0, -0.15, -0.4, yellowBelly);
  puff(head, -0.15, -0.04, -0.4, 0.42, 0.34, 0.4, yellowBelly);
  puff(head, 0.15, -0.04, -0.4, 0.42, 0.34, 0.4, yellowBelly);
  for (const sx of [-1, 1]) {
    box(head, 0.025, 0.025, 0.02, sx * 0.17, -0.02, -0.44, black);
    box(head, 0.025, 0.025, 0.02, sx * 0.19, 0.02, -0.42, black);
    box(head, 0.025, 0.025, 0.02, sx * 0.15, 0.05, -0.4, black);
  }
  box(head, 0.11, 0.11, 0.05, -0.12, 0.18, -0.28, white);
  box(head, 0.11, 0.11, 0.05, 0.12, 0.18, -0.28, white);
  box(head, 0.065, 0.065, 0.04, -0.12, 0.17, -0.31, eyeAmber);
  box(head, 0.065, 0.065, 0.04, 0.12, 0.17, -0.31, eyeAmber);
  box(head, 0.038, 0.05, 0.035, -0.12, 0.17, -0.33, black);
  box(head, 0.038, 0.05, 0.035, 0.12, 0.17, -0.33, black);
  box(head, 0.12, 0.03, 0.05, -0.12, 0.25, -0.27, faceShade);
  box(head, 0.12, 0.03, 0.05, 0.12, 0.25, -0.27, faceShade);
  box(head, 0.15, 0.055, 0.09, -0.13, 0.3, -0.22, yellowDeep);
  box(head, 0.15, 0.055, 0.09, 0.13, 0.3, -0.22, yellowDeep);
  puff(head, -0.2, 0.38, 0.02, 0.5, 0.5, 0.4, yellow);
  puff(head, 0.2, 0.38, 0.02, 0.5, 0.5, 0.4, yellow);
  box(head, 0.085, 0.085, 0.04, -0.2, 0.38, -0.04, pink);
  box(head, 0.085, 0.085, 0.04, 0.2, 0.38, -0.04, pink);
  box(head, 0.06, 0.14, 0.06, -0.06, 0.3, -0.14, faceShade);
  box(head, 0.06, 0.14, 0.06, 0.06, 0.3, -0.14, faceShade);

  // Mane — normal size
  const maneRoot = new THREE.Group();
  head.add(maneRoot);
  const manePuffs = [];
  const manePts = [
    [0, 0.12, 0.28, 1.35, 1.15, 1.1, 0],
    [0, 0.28, 0.18, 1.2, 0.95, 1.0, 1],
    [-0.32, 0.08, 0.08, 0.85, 1.15, 0.95, 2],
    [0.32, 0.08, 0.08, 0.85, 1.15, 0.95, 3],
    [-0.3, 0.22, 0.0, 0.75, 0.9, 0.8, 0],
    [0.3, 0.22, 0.0, 0.75, 0.9, 0.8, 1],
    [0, 0.36, 0.08, 1.15, 0.8, 0.95, 2],
    [-0.14, 0.34, 0.1, 0.7, 0.7, 0.7, 3],
    [0.14, 0.34, 0.1, 0.7, 0.7, 0.7, 0],
    [0, -0.12, 0.06, 1.0, 0.7, 0.85, 1],
    [-0.16, -0.08, 0.0, 0.65, 0.6, 0.65, 2],
    [0.16, -0.08, 0.0, 0.65, 0.6, 0.65, 3],
    [-0.26, 0.05, -0.12, 0.6, 0.9, 0.65, 0],
    [0.26, 0.05, -0.12, 0.6, 0.9, 0.65, 1],
  ];
  for (const [x, y, z, sx, sy, sz, mi] of manePts) {
    const m = puff(maneRoot, x, y, z, sx, sy, sz, mane[mi]);
    manePuffs.push({ mesh: m, baseScale: { x: sx, y: sy, z: sz }, phase: Math.random() * Math.PI * 2 });
  }
  const maneStrings = [];
  function addLock(x, y, z, len, wide, mat, bx, bz, phase) {
    const strand = new THREE.Group();
    strand.position.set(x, y, z);
    maneRoot.add(strand);
    const j0 = new THREE.Group();
    strand.add(j0);
    const a = new THREE.Mesh(new THREE.BoxGeometry(wide, len * 0.55, wide * 0.35), mat);
    a.position.y = -len * 0.28;
    j0.add(a);
    const j1 = new THREE.Group();
    j1.position.y = -len * 0.55;
    j0.add(j1);
    const b = new THREE.Mesh(new THREE.BoxGeometry(wide * 0.75, len * 0.35, wide * 0.28), mat);
    b.position.y = -len * 0.18;
    j1.add(b);
    maneStrings.push({
      group: strand, joints: [j0, j1], baseRotX: bx, baseRotZ: bz, phase,
      speed: 1.7 + Math.random() * 0.8, amp: 0.1,
    });
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    addLock(Math.cos(a) * 0.34, -0.05, Math.sin(a) * 0.22 + 0.1, 0.28, 0.1, mane[i % mane.length], 0.25, Math.sin(a) * 0.08, i * 0.8);
  }

  // Tail — longer, more segments
  const tail = new THREE.Group();
  tail.position.set(0, 0.9, 1.45);
  root.add(tail);
  box(tail, 0.12, 0.12, 0.32, 0, 0.05, 0.14, yellow);
  box(tail, 0.11, 0.11, 0.3, 0, 0.1, 0.4, yellowMid);
  box(tail, 0.1, 0.1, 0.28, 0, 0.14, 0.64, yellowDeep);
  box(tail, 0.09, 0.09, 0.18, 0, 0.16, 0.84, yellowShade);
  puff(tail, 0, 0.18, 0.98, 0.85, 0.75, 1.0, mane[1]);
  box(tail, 0.07, 0.07, 0.1, 0, 0.18, 1.08, mane[3]);

  root.userData.legs = legs;
  root.userData.tail = tail;
  root.userData.head = head;
  root.userData.maneRoot = maneRoot;
  root.userData.manePuffs = manePuffs;
  root.userData.maneStrings = maneStrings;
  root.userData.bodyStrings = [];
  root.userData.stringManeVersion = 10; // longer body + roar/jump
  // BIGGER overall
  root.scale.setScalar(1.95);
  root.visible = false;
  return root;
}

function ensureYellowTiger() {
  if (state._tigerRoot && state._tigerRoot.userData.stringManeVersion !== 10) {
    if (avatar && state._tigerRoot.parent) state._tigerRoot.parent.remove(state._tigerRoot);
    else if (avatar) try { avatar.remove(state._tigerRoot); } catch (_) {}
    state._tigerRoot = null;
  }
  if (state._tigerRoot) {
    state._tigerRoot.visible = !!state.tigerForm;
    return state._tigerRoot;
  }
  if (!avatar) return null;
  const lion = buildYellowTiger();
  lion.position.set(0, 0, 0);
  lion.scale.setScalar(1.35);
  avatar.add(lion);
  state._tigerRoot = lion;
  lion.visible = !!state.tigerForm;
  return lion;
}

/** Keep lion / Ron body visibility correct every frame */
function applyLionFormVisuals() {
  const on = !!state.tigerForm;
  const lion = state._tigerRoot || (on ? ensureYellowTiger() : null);
  if (lion) lion.visible = on;
  if (avBody) {
    if (on) avBody.visible = false;
  }
  if (on && avatar) avatar.visible = true;
}


/** Lion roar — sound + mouth open + shake */
function playLionRoar() {
  if (!state.tigerForm) {
    toast("Turn into the lion first (F)!", "");
    return;
  }
  const now = performance.now();
  if (state._lionRoarUntil && now < state._lionRoarUntil - 800) return; // spam guard
  state._lionRoarUntil = now + 1400;
  state._lionRoaring = true;

  // Web Audio roar
  try {
    resumeAudio?.();
    const ctx = SFX.ctx || (window.AudioContext && new AudioContext());
    if (ctx && ctx.state === "suspended") ctx.resume();
    if (ctx) {
      SFX.ctx = ctx;
      const t0 = ctx.currentTime;
      // low growl body
      const o1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      const f1 = ctx.createBiquadFilter();
      o1.type = "sawtooth";
      o1.frequency.setValueAtTime(55, t0);
      o1.frequency.exponentialRampToValueAtTime(38, t0 + 0.9);
      f1.type = "lowpass";
      f1.frequency.value = 280;
      g1.gain.setValueAtTime(0.0001, t0);
      g1.gain.exponentialRampToValueAtTime(0.35, t0 + 0.08);
      g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
      o1.connect(f1);
      f1.connect(g1);
      g1.connect(SFX.master || ctx.destination);
      o1.start(t0);
      o1.stop(t0 + 1.25);
      // mid roar
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = "square";
      o2.frequency.setValueAtTime(90, t0);
      o2.frequency.exponentialRampToValueAtTime(60, t0 + 0.7);
      g2.gain.setValueAtTime(0.0001, t0);
      g2.gain.exponentialRampToValueAtTime(0.12, t0 + 0.05);
      g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
      o2.connect(g2);
      g2.connect(SFX.master || ctx.destination);
      o2.start(t0);
      o2.stop(t0 + 0.95);
      // noise burst
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const ng = ctx.createGain();
      const nf = ctx.createBiquadFilter();
      nf.type = "bandpass";
      nf.frequency.value = 400;
      ng.gain.setValueAtTime(0.18, t0);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      src.connect(nf);
      nf.connect(ng);
      ng.connect(SFX.master || ctx.destination);
      src.start(t0);
    }
  } catch (_) {}

  // Visual: open mouth on lion head
  const lion = state._tigerRoot;
  if (lion && lion.userData.head) {
    // spawn roar shockwave rings
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.4, 0.55, 24),
          new THREE.MeshBasicMaterial({
            color: 0xffcc44,
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        ring.rotation.x = -Math.PI / 2;
        const origin = camera.position.clone().add(
          new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw).multiplyScalar(2)
        );
        ring.position.set(player.pos.x, player.pos.y + 1.2, player.pos.z);
        scene.add(ring);
        const start = performance.now();
        function animRing() {
          const u = (performance.now() - start) / 600;
          if (u >= 1) {
            scene.remove(ring);
            return;
          }
          const s = 1 + u * 8;
          ring.scale.set(s, s, s);
          ring.material.opacity = 0.55 * (1 - u);
          ring.position.set(player.pos.x, player.pos.y + 1.2, player.pos.z);
          requestAnimationFrame(animRing);
        }
        requestAnimationFrame(animRing);
      }, i * 90);
    }
  }
  // light camera punch
  state._roarShake = 0.35;
  toast("🦁 ROOOAR!", "kill");
  try { playerSay?.("ROAR!"); } catch (_) {}
}

function lionPounceJump() {
  if (!state.tigerForm) return false;
  if (state.inVehicle || state.climbing || state.onTree) return false;
  if (!player.onGround) return false;
  // Strong lion leap
  player.vel.y = (player.jumpForce || 9.5) * 1.55;
  const dir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
  player.vel.x += dir.x * 6;
  player.vel.z += dir.z * 6;
  player.onGround = false;
  player.fallPeakY = player.pos.y;
  toast("🦁 Leap!", "reward");
  return true;
}

function toggleTigerForm(force) {
  if (state.inVehicle) {
    toast("Get out of the vehicle first!", "");
    return false;
  }
  if (state.ironManSuit) {
    toast("Take off the Iron Man suit first!", "");
    return false;
  }
  const on = force != null ? !!force : !state.tigerForm;
  state.tigerForm = on;
  const lion = ensureYellowTiger();
  if (lion) {
    lion.visible = on;
    lion.position.set(0, 0, 0);
  }
  if (avBody) avBody.visible = !on;
  if (typeof parachute !== "undefined" && parachute) parachute.visible = !on && parachute.visible;
  if (on) {
    if (avatar) avatar.visible = true;
    player.camDistTarget = Math.max(player.camDistTarget || 0, 12);
    player.camDist = Math.max(player.camDist || 0, 11);
    player.turnAround = false;
    toast("🦁 LION! Space/J = jump · G = ROAR · F = back to Ron", "reward");
    try { playerSay?.("Lion power!"); } catch (_) {}
  } else {
    if (avBody) avBody.visible = true;
    toast("💛 Back to Ron!", "quest");
    try { playerSay?.("I'm Ron again!"); } catch (_) {}
  }
  document.querySelectorAll(".char-slot").forEach((btn) => {
    if (btn.dataset.char === "tiger") btn.classList.toggle("selected", on);
    if (btn.dataset.char === "ron") btn.classList.toggle("selected", !on);
  });
  const youAre = $("you-are-name");
  if (youAre) youAre.textContent = on ? "Lion" : "Ron";
  return true;
}

function setPlayerCharacter(id, opts = {}) {
  if (id === "tiger") {
    toggleTigerForm(true);
    return;
  }
  if (state.tigerForm) toggleTigerForm(false);
  state.characterId = "ron";
  state.playerName = "Ron";
  if (typeof paintPlayerYellowSkin === "function") paintPlayerYellowSkin();
  const cr =
    typeof CHARACTERS !== "undefined" && CHARACTERS.ron
      ? CHARACTERS.ron
      : { shirt: 0xe11d2e, shirtDark: 0xb01522, pants: 0x7f1d1d, pantsDark: 0x5c1515 };
  if (matShirt) matShirt.color.setHex(cr.shirt);
  if (matPants) matPants.color.setHex(cr.pants);
  if (typeof DRY_COLORS !== "undefined") {
    DRY_COLORS.shirt = cr.shirt;
    DRY_COLORS.shirtDark = cr.shirtDark;
    DRY_COLORS.pants = cr.pants;
    DRY_COLORS.pantsDark = cr.pantsDark;
  }
  document.querySelectorAll(".char-slot").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.char === "ron");
  });
  const youAre = $("you-are-name");
  if (youAre) youAre.textContent = "Ron";
  if (opts.toast !== false) toast("💛 Playing as Ron!", "reward");
}

function loadSavedCharacter() {
  setPlayerCharacter("ron", { toast: false, save: false });
  try {
    localStorage.removeItem("nexus-character");
  } catch (_) {}
}

function setupCharacterWheel() {
  document.querySelectorAll(".char-slot").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.char;
      if (id === "tiger") toggleTigerForm(true);
      else if (id === "ron") toggleTigerForm(false);
      if (state.started && !state.paused && !state.inventoryOpen && !state.stationsOpen) {
        try {
          canvas.requestPointerLock();
        } catch (_) {}
      }
    });
  });
  $("char-wheel")?.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    try {
      document.exitPointerLock();
    } catch (_) {}
  });
  loadSavedCharacter();
}

function tryPickCharacter(id) {
  if (id === "tiger") return toggleTigerForm(true);
  if (id === "ron") {
    if (state.tigerForm) toggleTigerForm(false);
    else toast("Already Ron!", "");
    return true;
  }
  return false;
}

function cyclePlayerCharacter() {
  return toggleTigerForm();
}

function updateTigerAnim(dt) {
  const tiger = state._tigerRoot;
  if (!tiger || !state.tigerForm) return;
  const t = state.elapsed;
  const spd = player.vel ? Math.hypot(player.vel.x, player.vel.z) : 0;
  const moving = spd > 0.4;
  const walkBoost = moving ? 1.55 + Math.min(1.1, spd * 0.08) : 0.5;

  // Lion legs: diagonal pairs swing opposite (real run/walk)
  const legs = tiger.userData.legs || [];
  const gait = t * (moving ? 11 : 0);
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    if (!leg) continue;
    if (moving) {
      const phase = gait + (i === 0 || i === 3 ? 0 : Math.PI);
      const swing = Math.sin(phase);
      leg.position.y = Math.max(0, swing) * 0.12;
      leg.rotation.x = swing * 0.55;
    } else {
      leg.position.y = 0;
      leg.rotation.x = 0;
    }
  }
  if (tiger.userData.tail) {
    tiger.userData.tail.rotation.y = Math.sin(t * 3) * 0.35;
    tiger.userData.tail.rotation.x = Math.sin(t * 2.2) * 0.12;
  }
  if (tiger.userData.head) {
    tiger.userData.head.rotation.y = Math.sin(t * 1.2) * 0.08;
  }

  // Soft mane: puffs breathe a little, locks sway (not hard ice cubes)
  const puffs = tiger.userData.manePuffs || [];
  for (let i = 0; i < puffs.length; i++) {
    const p = puffs[i];
    if (!p || !p.mesh) continue;
    const w = t * 1.6 + (p.phase || i);
    const breath = 1 + Math.sin(w) * 0.03 * walkBoost;
    p.mesh.scale.set(
      p.baseScale.x * breath,
      p.baseScale.y * (1 + Math.sin(w + 1) * 0.04 * walkBoost),
      p.baseScale.z * breath
    );
  }
  const mane = tiger.userData.maneStrings || [];
  for (let i = 0; i < mane.length; i++) {
    const s = mane[i];
    if (!s || !s.group) continue;
    const w = t * s.speed * walkBoost + s.phase;
    s.group.rotation.x = s.baseRotX + Math.sin(w) * s.amp * 0.5 * walkBoost;
    s.group.rotation.z = s.baseRotZ + Math.cos(w * 0.9) * s.amp * 0.45 * walkBoost;
    const joints = s.joints || [];
    for (let j = 0; j < joints.length; j++) {
      const jt = joints[j];
      if (!jt) continue;
      const a = s.amp * (0.3 + j * 0.4) * walkBoost;
      jt.rotation.x = Math.sin(w + j) * a;
      jt.rotation.z = Math.cos(w * 1.1 + j) * a * 0.65;
    }
  }

  tiger.rotation.y = 0;
}


// LEGS — solid black R6 blocks
function spawnOceanLife() {
  // Colorful fish schools
  for (let i = 0; i < 10; i++) {
    const mats = [blockMats.fish, blockMats.fishBlue, blockMats.fishYellow];
    const g = new THREE.Group();
    const body = new THREE.Mesh(GEO.fish, mats[i % 3]);
    body.rotation.z = Math.PI / 2;
    body.scale.setScalar(0.9 + (i % 3) * 0.15);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 4), mats[i % 3]);
    tail.rotation.z = -Math.PI / 2;
    tail.position.x = -0.35;
    g.add(body, tail);
    const x = (Math.random() - 0.5) * 110;
    const z = OCEAN_START + 20 + Math.random() * 70;
    g.position.set(x, WATER_SURFACE - 1.2 - Math.random() * 2.5, z);
    scene.add(g);
    oceanLife.push({
      type: "fish",
      group: g,
      phase: Math.random() * Math.PI * 2,
      speed: 2 + Math.random() * 3,
      radius: 5 + Math.random() * 10,
      home: g.position.clone(),
      depth: 1 + Math.random() * 2.5,
    });
  }

  // Black & white dolphins removed from ocean (user request)

  // Sea turtles
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x4d7c0f })
    );
    shell.scale.set(1.2, 0.55, 1.4);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x65a30d })
    );
    head.position.set(0, 0, 0.7);
    const flipL = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 6, 5),
      new THREE.MeshLambertMaterial({ color: 0x3f6212 })
    );
    flipL.position.set(-0.45, -0.05, 0.1);
    flipL.scale.set(1.4, 0.25, 0.7);
    const flipR = flipL.clone();
    flipR.position.x = 0.45;
    g.add(shell, head, flipL, flipR);
    const x = -40 + i * 35;
    const z = OCEAN_START + 30 + i * 15;
    g.position.set(x, WATER_SURFACE - 2.5, z);
    scene.add(g);
    oceanLife.push({
      type: "turtle",
      group: g,
      phase: Math.random() * 10,
      speed: 0.9,
      radius: 8,
      home: g.position.clone(),
      depth: 2.2 + Math.random(),
      flipL,
      flipR,
    });
  }

  // Jellyfish
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 10, 8),
      new THREE.MeshLambertMaterial({
        color: i % 2 ? 0xf9a8d4 : 0xc4b5fd,
        transparent: true,
        opacity: 0.7,
      })
    );
    bell.scale.set(1, 0.6, 1);
    for (let t = 0; t < 5; t++) {
      const tent = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.015, 0.8, 4),
        new THREE.MeshLambertMaterial({ color: 0xfbcfe8, transparent: true, opacity: 0.6 })
      );
      tent.position.set(Math.cos(t) * 0.15, -0.5, Math.sin(t) * 0.15);
      g.add(tent);
    }
    g.add(bell);
    g.position.set((Math.random() - 0.5) * 80, WATER_SURFACE - 2 - Math.random() * 2, OCEAN_START + 40 + Math.random() * 40);
    scene.add(g);
    oceanLife.push({
      type: "jelly",
      group: g,
      phase: Math.random() * 10,
      speed: 0.6,
      radius: 4,
      home: g.position.clone(),
      depth: 2 + Math.random() * 2,
    });
  }

  // Shark (simple sea predator)
  {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x64748b })
    );
    body.scale.set(1, 0.7, 2.4);
    const fin = new THREE.Mesh(
      new THREE.ConeGeometry(0.25, 0.7, 5),
      new THREE.MeshLambertMaterial({ color: 0x475569 })
    );
    fin.position.set(0, 0.45, 0);
    const snout = new THREE.Mesh(
      new THREE.ConeGeometry(0.25, 0.8, 6),
      new THREE.MeshLambertMaterial({ color: 0x64748b })
    );
    snout.rotation.x = -Math.PI / 2;
    snout.position.z = 1.2;
    g.add(body, fin, snout);
    g.position.set(40, WATER_SURFACE - 2.8, OCEAN_START + 55);
    scene.add(g);
    oceanLife.push({
      type: "shark",
      group: g,
      phase: 0,
      speed: 2.5,
      radius: 40,
      home: g.position.clone(),
      depth: 2.5,
    });
  }

  // Octopus on seabed
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group();
    const head = new THREE.Mesh(GEO.octopus, blockMats.octopus);
    head.position.y = 0.25;
    head.scale.set(1.1, 0.9, 1.1);
    for (let t = 0; t < 8; t++) {
      const ang = (t / 8) * Math.PI * 2;
      const tent = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.03, 0.9, 5),
        t % 2 ? blockMats.octopus : blockMats.octopusDark
      );
      tent.position.set(Math.cos(ang) * 0.25, -0.15, Math.sin(ang) * 0.25);
      tent.rotation.z = Math.cos(ang) * 0.7;
      tent.rotation.x = Math.sin(ang) * 0.7;
      g.add(tent);
    }
    g.add(head);
    g.position.set(i === 0 ? -30 : 40, WATER_SURFACE - 4.2, OCEAN_START + 45 + i * 18);
    scene.add(g);
    oceanLife.push({
      type: "octopus",
      group: g,
      phase: Math.random() * Math.PI * 2,
      speed: 0.7,
      radius: 3,
      home: g.position.clone(),
      depth: 4,
    });
  }
}

const enemyBodyMat = new THREE.MeshLambertMaterial({ color: 0xff006e, emissive: 0x440022, emissiveIntensity: 0.35 });
const enemyHeadMat = new THREE.MeshLambertMaterial({ color: 0x1a1a2e, emissive: 0x00f5d4, emissiveIntensity: 0.35 });

/**
 * Build Avengers / villain fighters for Spider-Man mode.
 * kinds: "hulk" | "captain" | "venom" | "default"
 */
/**
 * 4K-style human fighters — real earth proportions (not block people).
 * Sphere heads, jointed limbs, layered clothing, better materials.
 */
function buildAvengerEnemyMesh(kind) {
  const group = new THREE.Group();
  const labelName =
    kind === "hulk" ? "RED HULK"
    : kind === "captain" ? "CAP AMERICA"
    : kind === "venom" ? "VENOM"
    : kind === "spiderman" ? "SPIDER-MAN"
    : kind === "human" ? "EDDIE BROCK"
    : "FOE";

  const mat = (color, opts = {}) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness != null ? opts.roughness : 0.55,
      metalness: opts.metalness != null ? opts.metalness : 0.08,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.emissiveIntensity || 0,
      flatShading: false,
    });

  /** Realistic humanoid skeleton with bendable legs for running */
  function buildHuman(scale, skinHex, opts = {}) {
    const g = new THREE.Group();
    const skin = mat(skinHex, { roughness: 0.72 });
    const hairC = opts.hair != null ? opts.hair : 0x1c1917;
    const shirtC = opts.shirt != null ? opts.shirt : 0x334155;
    const pantsC = opts.pants != null ? opts.pants : 0x1e293b;
    const shoeC = opts.shoe != null ? opts.shoe : 0x0f172a;
    const shirt = mat(shirtC, { roughness: 0.65 });
    const pants = mat(pantsC, { roughness: 0.7 });
    const shoes = mat(shoeC, { roughness: 0.55, metalness: 0.1 });
    const hairM = mat(hairC, { roughness: 0.9 });

    // --- Head (sphere = human skull) ---
    const headG = new THREE.Group();
    headG.position.y = 1.68 * scale;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13 * scale, 20, 16), skin);
    skull.scale.set(1, 1.08, 0.95);
    // Jaw / lower face
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.1 * scale, 14, 12), skin);
    jaw.position.set(0, -0.06 * scale, 0.02 * scale);
    jaw.scale.set(0.95, 0.7, 0.9);
    // Nose
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.03 * scale, 0.045 * scale, 0.05 * scale), skin);
    nose.position.set(0, -0.01 * scale, 0.12 * scale);
    // Ears
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.035 * scale, 8, 6), skin);
      ear.position.set(sx * 0.13 * scale, 0, 0);
      ear.scale.set(0.5, 1, 0.7);
      headG.add(ear);
    }
    // Eyes
    for (const sx of [-1, 1]) {
      const white = new THREE.Mesh(
        new THREE.SphereGeometry(0.028 * scale, 10, 8),
        mat(0xf8fafc, { roughness: 0.3 })
      );
      white.position.set(sx * 0.045 * scale, 0.02 * scale, 0.1 * scale);
      white.scale.set(1, 1.1, 0.6);
      const iris = new THREE.Mesh(
        new THREE.SphereGeometry(0.016 * scale, 10, 8),
        mat(opts.eyeColor || 0x3b82f6, { roughness: 0.25, metalness: 0.1 })
      );
      iris.position.set(sx * 0.045 * scale, 0.02 * scale, 0.118 * scale);
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.008 * scale, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x0a0a0a })
      );
      pupil.position.set(sx * 0.045 * scale, 0.02 * scale, 0.128 * scale);
      headG.add(white, iris, pupil);
    }
    // Brows
    for (const sx of [-1, 1]) {
      const brow = new THREE.Mesh(
        new THREE.BoxGeometry(0.05 * scale, 0.012 * scale, 0.02 * scale),
        hairM
      );
      brow.position.set(sx * 0.045 * scale, 0.05 * scale, 0.11 * scale);
      brow.rotation.z = sx * -0.15;
      headG.add(brow);
    }
    // Lips
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(0.05 * scale, 0.012 * scale, 0.02 * scale),
      mat(0xc08478, { roughness: 0.6 })
    );
    lip.position.set(0, -0.06 * scale, 0.11 * scale);
    // Hair cap
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.135 * scale, 16, 12), hairM);
    hair.position.y = 0.04 * scale;
    hair.scale.set(1.05, 0.75, 1.05);
    headG.add(skull, jaw, nose, lip, hair);
    g.add(headG);

    // --- Neck ---
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * scale, 0.055 * scale, 0.1 * scale, 12), skin);
    neck.position.y = 1.52 * scale;
    g.add(neck);

    // --- Torso (human chest + waist) ---
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17 * scale, 0.15 * scale, 0.48 * scale, 16),
      shirt
    );
    torso.position.y = 1.22 * scale;
    const hips = new THREE.Mesh(
      new THREE.SphereGeometry(0.15 * scale, 14, 10),
      pants
    );
    hips.position.y = 0.95 * scale;
    hips.scale.set(1.15, 0.7, 0.9);
    g.add(torso, hips);

    // --- Arms (upper + forearm + hand) ---
    for (const sx of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(sx * 0.24 * scale, 1.4 * scale, 0);
      const upper = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05 * scale, 0.045 * scale, 0.28 * scale, 10),
        opts.armMat || shirt
      );
      upper.position.y = -0.14 * scale;
      const elbow = new THREE.Group();
      elbow.position.y = -0.28 * scale;
      const fore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042 * scale, 0.038 * scale, 0.26 * scale, 10),
        opts.forearmMat || skin
      );
      fore.position.y = -0.13 * scale;
      const hand = new THREE.Mesh(
        new THREE.SphereGeometry(0.045 * scale, 10, 8),
        skin
      );
      hand.position.y = -0.28 * scale;
      hand.scale.set(1, 0.85, 0.7);
      elbow.add(fore, hand);
      shoulder.add(upper, elbow);
      g.add(shoulder);
      if (!g.userData.arms) g.userData.arms = [];
      g.userData.arms.push({ shoulder, elbow, sx });
    }

    // --- Legs (thigh + shin + foot) for human run ---
    const runLegs = [];
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.09 * scale, 0.92 * scale, 0);
      const thigh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065 * scale, 0.055 * scale, 0.38 * scale, 12),
        pants
      );
      thigh.position.y = -0.19 * scale;
      const knee = new THREE.Group();
      knee.position.y = -0.38 * scale;
      const shin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05 * scale, 0.045 * scale, 0.36 * scale, 12),
        pants
      );
      shin.position.y = -0.18 * scale;
      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(0.09 * scale, 0.06 * scale, 0.18 * scale),
        shoes
      );
      foot.position.set(0, -0.38 * scale, 0.04 * scale);
      knee.add(shin, foot);
      hip.add(thigh, knee);
      g.add(hip);
      runLegs.push({ hip, knee });
    }
    g.userData.runLegs = runLegs;
    g.userData.headG = headG;
    g.userData.scaleH = scale;
    return g;
  }

  if (kind === "hulk") {
    // RED HULK — massive human body, red skin, real muscles
    const h = buildHuman(1.45, 0xb91c1c, {
      hair: 0x450a0a,
      shirt: 0x7f1d1d,
      pants: 0x1c1917,
      shoe: 0x0c0a09,
      eyeColor: 0xfbbf24,
      armMat: mat(0xb91c1c, { roughness: 0.7 }),
      forearmMat: mat(0xb91c1c, { roughness: 0.7 }),
    });
    // Extra muscle mass
    const pecs = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 14, 12),
      mat(0x991b1b, { roughness: 0.65 })
    );
    pecs.position.set(0, 1.35 * 1.45, -0.12);
    pecs.scale.set(1.6, 0.7, 0.9);
    const traps = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 10),
      mat(0xb91c1c, { roughness: 0.65 })
    );
    traps.position.set(0, 1.55 * 1.45, 0.05);
    traps.scale.set(1.8, 0.6, 1.1);
    // Torn black pants detail
    const shorts = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.24, 0.35, 14),
      mat(0x0f172a, { roughness: 0.85 })
    );
    shorts.position.y = 0.85;
    h.add(pecs, traps, shorts);
    // Anger scars
    for (const sx of [-1, 1]) {
      const scar = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.02, 0.01),
        mat(0x7f1d1d, { roughness: 0.9 })
      );
      scar.position.set(sx * 0.06, 1.68 * 1.45, 0.12);
      h.add(scar);
    }
    group.add(h);
  } else if (kind === "spiderman") {
    // Spider-Man — human under red/blue suit, lenses, web pattern
    const matRed = mat(0xdc2626, { roughness: 0.42, metalness: 0.12 });
    const matBlue = mat(0x1e40af, { roughness: 0.42, metalness: 0.12 });
    const matWeb = mat(0x0f172a, { roughness: 0.5 });
    const matLens = mat(0xf8fafc, { roughness: 0.2, metalness: 0.4, emissive: 0xe2e8f0, emissiveIntensity: 0.15 });
    const h = buildHuman(1.05, 0xdc2626, {
      hair: 0xdc2626,
      shirt: 0xdc2626,
      pants: 0x1e40af,
      shoe: 0xdc2626,
      eyeColor: 0xf8fafc,
      armMat: matBlue,
      forearmMat: matRed,
    });
    // Hide hair under mask — red mask sphere
    if (h.userData.headG) {
      h.userData.headG.traverse((ch) => {
        if (ch.isMesh) ch.material = matRed;
      });
      // Big white eye lenses
      for (const sx of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), matLens);
        lens.position.set(sx * 0.05, 1.7, 0.11);
        lens.scale.set(1.1, 1.3, 0.5);
        lens.rotation.z = sx * -0.2;
        h.add(lens);
      }
    }
    // Chest spider
    const emb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), matWeb);
    emb.position.set(0, 1.28, -0.16);
    emb.scale.set(1, 1.2, 0.4);
    // Web lines on chest
    for (let i = 0; i < 5; i++) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.012, 0.01),
        matWeb
      );
      line.position.set(0, 1.4 - i * 0.07, -0.17);
      h.add(line);
    }
    h.add(emb);
    group.add(h);
  } else if (kind === "human") {
    // Eddie Brock — real human (Venom turns back into this)
    const h = buildHuman(1.08, 0xe8b896, {
      hair: 0x1c1917,
      shirt: 0x1e293b,
      pants: 0x334155,
      shoe: 0x0f172a,
      eyeColor: 0x3b82f6,
    });
    // Stubble
    const stubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 10),
      mat(0x44403c, { roughness: 0.95 })
    );
    stubble.position.set(0, 1.62, 0.04);
    stubble.scale.set(1, 0.55, 0.9);
    h.add(stubble);
    group.add(h);
  } else if (kind === "venom") {
    // Venom — humanoid black symbiote over body shape
    const matV = mat(0x0a0a0a, { roughness: 0.35, metalness: 0.35 });
    const matW = mat(0xf8fafc, { roughness: 0.25, metalness: 0.15 });
    const matTongue = mat(0xef4444, { roughness: 0.55 });
    const h = buildHuman(1.2, 0x0a0a0a, {
      hair: 0x0a0a0a,
      shirt: 0x0a0a0a,
      pants: 0x0a0a0a,
      shoe: 0x0a0a0a,
      eyeColor: 0xf8fafc,
      armMat: matV,
      forearmMat: matV,
    });
    if (h.userData.headG) {
      h.userData.headG.traverse((ch) => {
        if (ch.isMesh) ch.material = matV;
      });
      // Huge white eyes
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), matW);
        eye.position.set(sx * 0.06, 1.72 * 1.05, 0.12);
        eye.scale.set(1.2, 1.5, 0.45);
        eye.rotation.z = sx * -0.15;
        h.add(eye);
      }
      // Open maw
      const maw = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), matV);
      maw.position.set(0, 1.55, 0.1);
      maw.scale.set(1.1, 0.6, 0.9);
      const tongue = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.015, 0.35, 14),
        matTongue
      );
      tongue.position.set(0, 1.45, 0.18);
      tongue.rotation.x = 0.9;
      // Teeth
      for (let i = -2; i <= 2; i++) {
        const tooth = new THREE.Mesh(
          new THREE.ConeGeometry(0.015, 0.05, 5),
          matW
        );
        tooth.position.set(i * 0.025, 1.58, 0.14);
        tooth.rotation.x = Math.PI;
        h.add(tooth);
      }
      h.add(maw, tongue);
    }
    // White spider emblem
    const emb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), matW);
    emb.position.set(0, 1.35, -0.18);
    emb.scale.set(1, 1.3, 0.35);
    // Symbiote tendrils
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const tend = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.01, 0.45 + i * 0.08, 12),
          matV
        );
        tend.position.set(sx * (0.2 + i * 0.05), 1.5 + i * 0.05, 0.15);
        tend.rotation.z = sx * (0.6 + i * 0.2);
        tend.rotation.x = 0.3;
        h.add(tend);
      }
    }
    h.add(emb);
    group.add(h);
  } else if (kind === "captain") {
    // Captain America — human soldier proportions
    const matBlue = mat(0x1d4ed8, { roughness: 0.48, metalness: 0.15 });
    const matRed = mat(0xdc2626, { roughness: 0.5 });
    const matWhite = mat(0xf8fafc, { roughness: 0.45 });
    const h = buildHuman(1.1, 0xf0c4a0, {
      hair: 0x92400e,
      shirt: 0x1d4ed8,
      pants: 0x1e3a8a,
      shoe: 0x991b1b,
      eyeColor: 0x2563eb,
      armMat: matBlue,
      forearmMat: mat(0xf0c4a0, { roughness: 0.7 }),
    });
    // Cowl / mask
    const cowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 12),
      matBlue
    );
    cowl.position.set(0, 1.72, 0);
    cowl.scale.set(1.05, 0.75, 1.05);
    // A on forehead
    const aMark = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.02), matWhite);
    aMark.position.set(0, 1.78, 0.13);
    // Wing ears
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.05), matWhite);
      wing.position.set(sx * 0.14, 1.8, 0);
      h.add(wing);
    }
    // Chest star + stripes
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), matWhite);
    star.position.set(0, 1.32, -0.16);
    star.scale.set(1, 1, 0.4);
    for (let i = 0; i < 4; i++) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.025, 0.02),
        i % 2 ? matRed : matWhite
      );
      stripe.position.set(0, 1.2 - i * 0.05, -0.16);
      h.add(stripe);
    }
    // Shield (round, detailed)
    const shield = new THREE.Group();
    shield.position.set(0.32, 1.2, -0.05);
    const layers = [
      [0.16, 0xdc2626],
      [0.12, 0xf8fafc],
      [0.085, 0xdc2626],
      [0.055, 0x1d4ed8],
    ];
    for (const [r, col] of layers) {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, 0.035, 28),
        mat(col, { metalness: 0.35, roughness: 0.35 })
      );
      ring.rotation.x = Math.PI / 2;
      shield.add(ring);
    }
    const sStar = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), matWhite);
    sStar.position.z = -0.02;
    shield.add(sStar);
    h.add(cowl, aMark, star, shield);
    group.add(h);
  } else {
    const h = buildHuman(1.0, 0xff006e, { shirt: 0xff006e, pants: 0x1a1a2e });
    group.add(h);
  }

  if (typeof makeNameLabel === "function" && kind !== "default") {
    const lab = makeNameLabel(labelName);
    lab.position.set(0, kind === "hulk" ? 3.4 : 2.7, 0);
    lab.scale.set(1.9, 0.4, 1);
    group.add(lab);
  }
  group.userData.kind = kind;
  // Collect runLegs from children if nested
  if (!group.userData.runLegs) {
    group.traverse((ch) => {
      if (ch.userData && ch.userData.runLegs) {
        group.userData.runLegs = ch.userData.runLegs;
      }
    });
  }
  return group;
}

function spawnEnemy(x, z, kind = null) {
  // In Spider-Man game: cycle Hulk / Cap / Venom instead of red-blue blobs
  if (!kind) {
    if (state.spiderGame) {
      const kinds = ["hulk", "spiderman", "venom", "captain"];
      kind = kinds[enemies.filter((e) => e.alive).length % 4];
    } else {
      kind = "default";
    }
  }
  const gy = Math.max(0, groundY(x, z));
  const group = buildAvengerEnemyMesh(kind);
  group.position.set(x, gy, z);
  scene.add(group);

  const stats =
    kind === "hulk"
      ? { hp: 100, speed: 4.6, damage: 16, scaleBob: 1.25 }
      : kind === "captain"
      ? { hp: 60, speed: 5.4, damage: 11, scaleBob: 1.0 }
      : kind === "venom"
      ? { hp: 75, speed: 5.8, damage: 13, scaleBob: 1.08 }
      : kind === "spiderman"
      ? { hp: 55, speed: 6.2, damage: 10, scaleBob: 1.0 }
      : kind === "human"
      ? { hp: 35, speed: 4.0, damage: 6, scaleBob: 1.0 }
      : { hp: 40, speed: 3.5 + Math.random() * 2, damage: 8, scaleBob: 1.0 };

  enemies.push({
    group,
    kind,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed,
    damage: stats.damage,
    attackCd: 0,
    state: "patrol",
    target: null,
    alive: true,
    bob: Math.random() * 10,
    scaleBob: stats.scaleBob,
  });
}

// ─────────────────────────────────────────────────────────────
// PHYSICS / COLLISION
// ─────────────────────────────────────────────────────────────
/**
 * Walkable surface:
 * - land / mountains: terrain height
 * - ocean: water surface (you swim, don't fall through void)
 */

/** Stand / walk on rocket & plane tops (no falling through) */
function tryStandOnVehicles() {
  if (state.inVehicle || player.sleeping || player.parachuting) return false;
  let bestTop = -Infinity;
  let onDeck = false;
  for (const v of vehicles) {
    if (!v || !v.group || v.crashing) continue;
    // Local deck: top of fuselage / hull — walk on everything
    let halfX = 1.3;
    let halfZ = 3.0;
    let deckLocalY = 0.55;
    if (v.type === "airplane") {
      halfX = 6.2;
      halfZ = 4.0;
      deckLocalY = 0.42;
    } else if (v.type === "jet") {
      halfX = 3.8;
      halfZ = 3.6;
      deckLocalY = 0.48;
    } else if (v.type === "rocket" || v.subtype === "ironman") {
      halfX = 1.7;
      halfZ = 4.6;
      deckLocalY = 0.72;
    } else if (v.type === "boat") {
      halfX = 1.5;
      halfZ = 2.6;
      deckLocalY = 0.75;
    } else if (v.type === "car" || v.type === "bike") {
      halfX = 1.2;
      halfZ = 2.0;
      deckLocalY = 0.9;
    }
    // Always try — even unknown types get a small deck

    // Use local point transformed for height
    const local = new THREE.Vector3(0, deckLocalY, 0);
    v.group.updateMatrixWorld(true);
    const world = local.clone().applyMatrix4(v.group.matrixWorld);
    // Horizontal distance in world XZ (expand for wing span using yaw)
    const yaw = v.group.rotation.y || v.yaw || 0;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const dx = player.pos.x - world.x;
    const dz = player.pos.z - world.z;
    // rotate into vehicle local XZ
    const lx = dx * cos + dz * sin;
    const lz = -dx * sin + dz * cos;
    if (Math.abs(lx) > halfX || Math.abs(lz) > halfZ) continue;

    const topY = world.y;
    // Feet near deck and not flying up
    if (player.pos.y >= topY - 1.15 && player.pos.y <= topY + 0.7 && player.vel.y <= 1.5) {
      if (topY > bestTop) {
        bestTop = topY;
        onDeck = true;
      }
    }
  }
  if (onDeck) {
    player.pos.y = bestTop + 0.04;
    player.vel.y = 0; // stay on deck — don't fall through
    player.onGround = true;
    player.parachuting = false;
    player._onVehicleDeck = true;
    return true;
  }
  player._onVehicleDeck = false;
  return false;
}

function walkHeight(x, z) {
  const g = groundY(x, z);
  if (isOcean(x, z)) {
    // Still walkable on ocean island mountain top
    const peak = peakSurfaceY(x, z);
    if (peak != null && peak > WATER_SURFACE + 0.5) return peak;
    return WATER_SURFACE;
  }
  const peak = typeof peakSurfaceY === "function" ? peakSurfaceY(x, z) : null;
  // Stand ON mountain surface (never below it / inside rock)
  if (peak != null) return Math.max(g, peak);
  return Math.max(0, g);
}

function resolvePlayer(pos, radius) {
  // Lion form: slightly wider feet for mountain grip
  if (state.tigerForm) radius = Math.max(radius, 0.55);
  const gy = walkHeight(pos.x, pos.z);
  const peakY = typeof peakSurfaceY === "function" ? peakSurfaceY(pos.x, pos.z) : null;
  // On a mountain peak: treat as solid ground surface (run/climb on top, never inside)
  const onPeak = peakY != null;
  const surfaceY = onPeak ? Math.max(gy, peakY) : gy;
  const swimming =
    isOcean(pos.x, pos.z) &&
    pos.y < WATER_SURFACE + 1.6 &&
    !(onPeak && peakY > WATER_SURFACE + 0.5);
  let onGround = false;
  if (!swimming && pos.y < surfaceY + 0.08) {
    pos.y = surfaceY;
    onGround = true;
    if (player.vel && player.vel.y < 0) player.vel.y = 0;
  }
  // Extra: if somehow inside mountain volume, push UP to surface
  if (onPeak && pos.y < peakY - 0.05) {
    pos.y = peakY;
    onGround = true;
    if (player.vel) player.vel.y = Math.max(0, player.vel.y);
  }
  // In ocean: deep swim volume (dive down to seafloor)
  if (swimming) {
    const floor = Math.max(groundY(pos.x, pos.z), WATER_SURFACE - 14);
    if (pos.y < floor + 0.35) {
      pos.y = floor + 0.35;
      player.vel.y = Math.max(0, player.vel.y);
    }
    // Soft surface clamp — allow diving below freely
    if (pos.y > WATER_SURFACE + 0.85 && player.vel.y > 0) {
      player.vel.y *= 0.45;
    }
  }

  // World bounds
  pos.x = THREE.MathUtils.clamp(pos.x, -HALF + 2, HALF - 2);
  pos.z = THREE.MathUtils.clamp(pos.z, -HALF + 2, HALF - 2);

  // Colliders near player — roofs / bridges are walkable platforms
  const prx = pos.x;
  const prz = pos.z;
  const range = 18;
  const r = radius + 0.08;
  const rSq = r * r;
  const midY = pos.y + player.height * 0.5;
  let bestRoof = -Infinity;

  for (let i = 0, n = colliders.length; i < n; i++) {
    const c = colliders[i];
    // Skip giant ground slab
    if (c.max.y - c.min.y <= 2.1 && c.min.y < 0) continue;
    // On mountain: ignore tall "inside" walls — only stand on thin surface pads
    if (onPeak) {
      const ch = c.max.y - c.min.y;
      // Skip huge tall colliders that form hollow interiors
      if (ch > 2.5) continue;
    }
    // Gate open — don't block the path
    if (state.gateDoor && state.gateDoor.open && state.gateDoor.blocking === false) {
      const gx = state.gateDoor.x, gz = state.gateDoor.z;
      const midX = (c.min.x + c.max.x) * 0.5;
      const midZ = (c.min.z + c.max.z) * 0.5;
      if (Math.abs(midX - gx) < 2 && Math.abs(midZ - gz) < 1.2) continue;
    }
    // Sand room door open
    if (state.sandRoom && state.sandRoom.open) {
      const d = state.sandRoom.doorColliderApprox;
      if (d) {
        const midX = (c.min.x + c.max.x) * 0.5;
        const midZ = (c.min.z + c.max.z) * 0.5;
        if (Math.abs(midX - d.x) < 1.5 && Math.abs(midZ - d.z) < 0.8) continue;
      }
    }
    if (c.max.x < prx - range || c.min.x > prx + range) continue;
    if (c.max.z < prz - range || c.min.z > prz + range) continue;

    // Standing on top of buildings / roofs / bridges / decks
    const onTopX = prx > c.min.x - radius && prx < c.max.x + radius;
    const onTopZ = prz > c.min.z - radius && prz < c.max.z + radius;
    if (onTopX && onTopZ && player.vel.y <= 0.65) {
      const top = c.max.y;
      // Snap onto platform if feet are near the top (generous so you don't fall through)
      if (pos.y >= top - 0.85 && pos.y <= top + 0.5) {
        if (top > bestRoof) bestRoof = top;
      }
    }

    // AABB side collision — solid walls you cannot walk through
    const expand = radius + 0.12;
    const overlapsX = prx + expand > c.min.x && prx - expand < c.max.x;
    const overlapsZ = prz + expand > c.min.z && prz - expand < c.max.z;
    const bodyBottom = pos.y + 0.08;
    const bodyTop = pos.y + player.height * 0.92;
    const overlapsY = bodyTop > c.min.y + 0.05 && bodyBottom < c.max.y - 0.02;

    // Prefer standing on top rather than side-push when above
    if (overlapsX && overlapsZ && player.vel.y <= 0.55) {
      const top = c.max.y;
      if (pos.y >= top - 0.65 && pos.y <= top + 0.45) {
        if (top > bestRoof) bestRoof = top;
        continue;
      }
    }

    if (overlapsX && overlapsZ && overlapsY) {
      // How deep we penetrate from each side
      const penL = (prx + expand) - c.min.x;
      const penR = c.max.x - (prx - expand);
      const penF = (prz + expand) - c.min.z;
      const penB = c.max.z - (prz - expand);
      const minPen = Math.min(penL, penR, penF, penB);
      // Only push if clearly inside (skip thin contact)
      if (minPen > 0 && minPen < expand * 2.4) {
        if (minPen === penL) pos.x -= penL;
        else if (minPen === penR) pos.x += penR;
        else if (minPen === penF) pos.z -= penF;
        else pos.z += penB;
      }
    }
  }

  if (bestRoof > -Infinity) {
    pos.y = bestRoof;
    onGround = true;
    player.vel.y = 0;
  }
  return onGround;
}

// ─────────────────────────────────────────────────────────────
// COMBAT
// ─────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2(0, 0);

function shoot() {
  // Nifty Fidget Power swords — shoot energy / power ball
  if (state.activeSword && hasInvItem(state.activeSword)) {
    if (shootNiftyPower()) return;
  }
  // Gun removed — left click only breaks / mines blocks
  if (state.fireCooldown > 0) return;
  state.fireCooldown = 0.12;
  breakBlockInFront();
}

function tryReload() {
  if (state.reloading || state.ammo >= state.maxAmmo || state.reserve <= 0) return;
  state.reloading = true;
  toast("Reloading...", "");
  setTimeout(() => {
    const need = state.maxAmmo - state.ammo;
    const take = Math.min(need, state.reserve);
    state.ammo += take;
    state.reserve -= take;
    state.reloading = false;
    updateHUD();
  }, 900);
}

function damageEnemy(e, dmg) {
  e.hp -= dmg;
  e.group.scale.setScalar(1.12);
  setTimeout(() => { if (e.alive) e.group.scale.setScalar(1); }, 80);
  addCombo();
  if (e.hp <= 0) {
    killEnemy(e);
  }
}

function killEnemy(e) {
  e.alive = false;
  scene.remove(e.group);
  state.kills++;
  state.streak++;
  const reward = 25 + state.combo * 5;
  addXP(15 + state.combo * 3);
  addCoins(reward);
  const who =
    e.kind === "hulk" ? "RED HULK"
    : e.kind === "captain" ? "CAP"
    : e.kind === "venom" || e.kind === "human" ? "VENOM"
    : e.kind === "spiderman" ? "SPIDER-MAN"
    : "Enemy";
  toast(`+${reward} coins · ${who} down!`, "kill");
  spawnHitSparks(e.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 6, 0xff006e);
  progressQuest("kills", 1);

  // Respawn later (Avengers kinds if still in Spider-Man game)
  setTimeout(() => {
    if (state.spiderGame && state.spiderJungle) {
      const j = state.spiderJungle;
      const ang = Math.random() * Math.PI * 2;
      const r = 14 + Math.random() * 28;
      const kinds = ["hulk", "spiderman", "venom", "captain"];
      spawnEnemy(j.x + Math.cos(ang) * r, j.z + Math.sin(ang) * r, e.kind && e.kind !== "human" ? e.kind : kinds[Math.floor(Math.random() * 4)]);
    } else {
      const nx = (Math.random() - 0.5) * 140;
      const nz = (Math.random() - 0.5) * 140;
      spawnEnemy(nx, nz, "default");
    }
  }, 8000 + Math.random() * 5000);

  updateHUD();
}

function damagePlayer(amount) {
  if (state.invuln > 0 || state.paused) return;
  state.hp = Math.max(0, state.hp - amount);
  state.invuln = 0.6;
  state.streak = 0;
  document.body.classList.add("hurt");
  setTimeout(() => document.body.classList.remove("hurt"), 350);
  updateHUD();
  if (state.hp <= 0) {
    // Soft death — respawn, lose some streak/coins
    toast("Downed! Respawning at plaza...", "kill");
    state.hp = state.maxHp;
    state.ammo = state.maxAmmo;
    player.pos.set(0, 4, 16);
    player.vel.set(0, 0, 0);
    if (state.inVehicle) exitVehicle();
    addCoins(-Math.min(50, state.coins));
    state.combo = 0;
    updateHUD();
  }
}

// ─────────────────────────────────────────────────────────────
// BUILDING
// ─────────────────────────────────────────────────────────────
function breakBlockInFront() {
  raycaster.setFromCamera(_ndc, camera);
  raycaster.far = 6;
  const meshes = [...breakables.values()];
  const hits = raycaster.intersectObjects(meshes, false);
  if (!hits.length) return;
  damageBlock(hits[0].object, 1);
}

function damageBlock(mesh, dmg) {
  mesh.userData.hp -= dmg;
  mesh.scale.setScalar(0.92);
  setTimeout(() => { if (mesh.parent) mesh.scale.setScalar(1); }, 60);
  if (mesh.userData.hp <= 0) {
    const type = mesh.userData.type;
    if (state.blocks[type] !== undefined) state.blocks[type] = (state.blocks[type] || 0) + 1;
    else state.blocks[type] = 1;
    removeBlock(mesh);
    addXP(2);
    toast(`Mined ${type}!`, "reward");
    progressQuest("mine", 1);
  }
}

function removeBlock(mesh) {
  // Remove matching collider
  const p = mesh.position;
  for (let i = colliders.length - 1; i >= 0; i--) {
    const c = colliders[i];
    const cx = (c.min.x + c.max.x) / 2;
    const cy = (c.min.y + c.max.y) / 2;
    const cz = (c.min.z + c.max.z) / 2;
    if (Math.abs(cx - p.x) < 0.1 && Math.abs(cy - p.y) < 0.1 && Math.abs(cz - p.z) < 0.1) {
      colliders.splice(i, 1);
      break;
    }
  }
  breakables.delete(mesh.uuid);
  scene.remove(mesh);
}

function placeBlock() {
  const slotTypes = [null, "dirt", "wood", "crystal", null]; // 4 = hands only
  const type = slotTypes[state.slot];
  if (!type) return;
  if ((state.blocks[type] || 0) <= 0) {
    toast(`No ${type} blocks! Mine more.`, "");
    return;
  }

  raycaster.setFromCamera(_ndc, camera);
  raycaster.far = 6;
  // Place against existing surfaces or ground
  const meshes = [...breakables.values(), ...buildings];
  const hits = raycaster.intersectObjects(meshes, false);
  let placePos;
  if (hits.length) {
    const h = hits[0];
    placePos = h.point.clone().add(h.face.normal.clone().multiplyScalar(0.51));
  } else {
    // Place on ground in front
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    dir.y = 0;
    dir.normalize();
    const p = player.pos.clone().add(dir.multiplyScalar(3));
    placePos = new THREE.Vector3(Math.floor(p.x) + 0.5, Math.floor(groundY(p.x, p.z)) + 0.5, Math.floor(p.z) + 0.5);
  }

  placePos.x = Math.floor(placePos.x) + 0.5;
  placePos.y = Math.floor(placePos.y) + 0.5;
  placePos.z = Math.floor(placePos.z) + 0.5;

  // Don't place inside player
  if (placePos.distanceTo(player.pos.clone().add(new THREE.Vector3(0, 1, 0))) < 1.2) return;

  const mesh = new THREE.Mesh(GEO.block, blockMats[type]);
  mesh.position.copy(placePos);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData = { kind: "block", type, hp: type === "crystal" ? 4 : 2 };
  scene.add(mesh);
  breakables.set(mesh.uuid, mesh);
  addCollider(placePos.x, placePos.y, placePos.z, 1, 1, 1);
  state.blocks[type]--;
  state.blocksBuilt++;
  addXP(3);
  progressQuest("build", 1);
  setMode("BUILD");
  updateHUD();
}

// ─────────────────────────────────────────────────────────────
// VEHICLES & RACING
// ─────────────────────────────────────────────────────────────
function vehicleBoardRange(v) {
  if (!v) return 8;
  if (v.type === "boat") return 14;
  if (v.subtype === "ironman") return 18;
  if (v.type === "airplane" || v.type === "jet" || v.type === "rocket") return 16;
  return 10;
}

function nearestVehicle() {
  let best = null;
  let bestD = 30;
  for (const v of vehicles) {
    if (!v || !v.group) continue;
    if (v.crashing) continue;
    // Allow re-boarding even if occupied flag stuck (as long as we're not already driving it)
    if (v.occupied && state.vehicle === v && state.inVehicle) continue;
    if (v.occupied && state.vehicle !== v && state.inVehicle) continue;
    if (v.occupied && !state.inVehicle) v.occupied = false; // unstick
    const dx = v.group.position.x - player.pos.x;
    const dz = v.group.position.z - player.pos.z;
    // Horizontal only — pad height differences don't block boarding
    const d = Math.sqrt(dx * dx + dz * dz);
    const range = vehicleBoardRange(v);
    if (d < range && d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

/** Glowing airplane pilot glasses on Ron's head */
function applyPilotGoggles(on) {
  if (state._pilotGoggles) {
    for (const p of state._pilotGoggles) {
      if (p.parent) p.parent.remove(p);
    }
  }
  state._pilotGoggles = [];
  if (!on || !avHead) return;

  const matFrame = new THREE.MeshStandardMaterial({
    color: 0x1e293b, roughness: 0.45, metalness: 0.65, flatShading: false,
  });
  const matStrap = new THREE.MeshStandardMaterial({
    color: 0x334155, roughness: 0.85, metalness: 0.1, flatShading: false,
  });
  // Bright glowing lenses
  const matLens = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 1.15,
    roughness: 0.15,
    metalness: 0.35,
    transparent: true,
    opacity: 0.92,
  });
  const matLensGlow = new THREE.MeshBasicMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.55,
  });
  const matRim = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.55,
    roughness: 0.35,
    metalness: 0.7,
    flatShading: false,
  });

  const g = new THREE.Group();
  g.name = "pilotGoggles";
  // Strap around head
  const strap = new THREE.Mesh(new THREE.BoxGeometry(HEAD_W * 1.22, 0.07, HEAD_D * 1.15), matStrap);
  strap.position.set(0, 0.08, 0);
  // Bridge
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.06), matFrame);
  bridge.position.set(0, 0.1, -HEAD_D / 2 - 0.02);
  // Two glowing lenses
  for (const sx of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.05), matRim);
    rim.position.set(sx * 0.11, 0.1, -HEAD_D / 2 - 0.04);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.04), matLens);
    lens.position.set(sx * 0.11, 0.1, -HEAD_D / 2 - 0.06);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.02), matLensGlow);
    glow.position.set(sx * 0.11, 0.1, -HEAD_D / 2 - 0.08);
    g.add(rim, lens, glow);
  }
  // Side arms of glasses
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, HEAD_D * 0.7), matFrame);
    arm.position.set(sx * (HEAD_W / 2 + 0.02), 0.09, -0.02);
    g.add(arm);
  }
  g.add(strap, bridge);
  avHead.add(g);
  state._pilotGoggles = [g];
  state.hasPilotGoggles = true;
}

/** Pirate glasses + hat + coat — look like a pirate too on the boat */
/** White pirate suit + white pirate mask when you board the pirate boat (PT look) */
function applyPirateGear(on) {
  if (state._pirateGearParts) {
    for (const p of state._pirateGearParts) {
      if (p.parent) p.parent.remove(p);
    }
  }
  state._pirateGearParts = [];
  state.hasPirateGear = false;
  // Show normal face when gear off
  if (state._ronFace) state._ronFace.visible = !on;
  if (!on) {
    if (avTorso && state._pirateSavedTorsoMat) {
      const torsoMesh = avTorso.userData.mesh;
      if (torsoMesh) torsoMesh.material = state._pirateSavedTorsoMat;
      state._pirateSavedTorsoMat = null;
    }
    if (state._pirateSavedPantsMats) {
      for (const { mesh, mat } of state._pirateSavedPantsMats) {
        if (mesh) mesh.material = mat;
      }
      state._pirateSavedPantsMats = null;
    }
    // Restore natural skin + hair on head
    if (typeof paintPlayerYellowSkin === "function") paintPlayerYellowSkin();
    if (typeof ensureHairOnHead === "function") ensureHairOnHead();
    return;
  }
  if (!avHead) return;

  // WHITE pirate palette — no black glows
  const matWhite = new THREE.MeshStandardMaterial({
    color: 0xf8fafc, roughness: 0.55, metalness: 0.12, flatShading: false,
  });
  const matWhiteSoft = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0, roughness: 0.6, metalness: 0.08, flatShading: false,
  });
  const matWhiteHi = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.4, metalness: 0.15, flatShading: false,
  });
  const matSilver = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1, roughness: 0.35, metalness: 0.45, flatShading: false,
  });
  const matSash = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9, roughness: 0.65, metalness: 0.05, flatShading: false,
  });
  const matEyeSlot = new THREE.MeshStandardMaterial({
    color: 0x94a3b8, roughness: 0.3, metalness: 0.2, flatShading: false,
  });

  const parts = [];

  // Hide face under the white mask — hair stays on head
  if (state._ronFace) state._ronFace.visible = false;
  if (typeof ensureHairOnHead === "function") ensureHairOnHead();

  // ── WHITE pirate hat ──
  const hat = new THREE.Group();
  hat.position.set(0, HEAD_H * 0.42, 0);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(HEAD_W * 1.2, 0.18, HEAD_D * 1.2), matWhite);
  crown.position.y = 0.09;
  const brimF = new THREE.Mesh(new THREE.BoxGeometry(HEAD_W * 1.5, 0.06, 0.15), matWhiteSoft);
  brimF.position.set(0, 0.02, -HEAD_D * 0.55);
  const brimB = new THREE.Mesh(new THREE.BoxGeometry(HEAD_W * 1.4, 0.06, 0.13), matWhiteSoft);
  brimB.position.set(0, 0.02, HEAD_D * 0.5);
  const brimL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, HEAD_D * 1.15), matWhiteSoft);
  brimL.position.set(-HEAD_W * 0.68, 0.02, 0);
  const brimR = brimL.clone();
  brimR.position.x = HEAD_W * 0.68;
  const band = new THREE.Mesh(new THREE.BoxGeometry(HEAD_W * 1.22, 0.07, HEAD_D * 1.22), matSash);
  band.position.y = 0.02;
  // White skull badge
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.04), matWhiteHi);
  skull.position.set(0, 0.1, -HEAD_D * 0.55 - 0.04);
  const bone = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), matSilver);
  bone.position.set(0, 0.04, -HEAD_D * 0.55 - 0.04);
  hat.add(crown, brimF, brimB, brimL, brimR, band, skull, bone);
  avHead.add(hat);
  parts.push(hat);

  // ── WHITE pirate MASK (full face) ──
  const mask = new THREE.Group();
  mask.name = "whitePirateMask";
  const maskShell = new THREE.Mesh(
    new THREE.BoxGeometry(HEAD_W * 1.12, HEAD_H * 0.95, HEAD_D * 0.55),
    matWhite
  );
  maskShell.position.set(0, 0.02, -HEAD_D * 0.15);
  // Eye holes (soft grey — not black glow)
  for (const sx of [-1, 1]) {
    const hole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.05), matEyeSlot);
    hole.position.set(sx * 0.09, 0.1, -HEAD_D / 2 - 0.02);
    const shine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.03), matWhiteHi);
    shine.position.set(sx * 0.09, 0.1, -HEAD_D / 2 - 0.04);
    mask.add(hole, shine);
  }
  // Mask nose ridge
  const maskNose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.1), matWhiteSoft);
  maskNose.position.set(0, 0.0, -HEAD_D / 2 - 0.06);
  // Mask mouth slit
  const maskMouth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.04), matWhiteSoft);
  maskMouth.position.set(0, -0.14, -HEAD_D / 2 - 0.03);
  // Cheek plates
  for (const sx of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.08), matWhiteSoft);
    cheek.position.set(sx * 0.16, -0.02, -HEAD_D / 2 + 0.02);
    mask.add(cheek);
  }
  // Forehead crest
  const crest = new THREE.Mesh(new THREE.BoxGeometry(HEAD_W * 0.9, 0.08, 0.1), matWhiteHi);
  crest.position.set(0, 0.22, -HEAD_D / 2 + 0.02);
  mask.add(maskShell, maskNose, maskMouth, crest);
  avHead.add(mask);
  parts.push(mask);

  // ── WHITE pirate SUIT (coat + pants) ──
  if (avTorso) {
    // avTorso is a Group — recolor its mesh
    const torsoMesh = avTorso.userData.mesh || avTorso.children.find((c) => c.isMesh);
    if (torsoMesh) {
      state._pirateSavedTorsoMat = torsoMesh.material;
      torsoMesh.material = matWhite;
    } else {
      state._pirateSavedTorsoMat = avTorso.material;
      if (avTorso.material) avTorso.material = matWhite;
    }
    const coat = new THREE.Mesh(
      new THREE.BoxGeometry(TORSO_W * 1.08, TORSO_H * 1.05, TORSO_D * 1.15),
      matWhite
    );
    coat.position.set(0, 0, 0);
    avTorso.add(coat);
    parts.push(coat);
    const lapel = new THREE.Mesh(
      new THREE.BoxGeometry(TORSO_W * 0.85, TORSO_H * 0.5, 0.06),
      matWhiteHi
    );
    lapel.position.set(0, 0.12, -TORSO_D / 2 - 0.04);
    avTorso.add(lapel);
    parts.push(lapel);
    const sash = new THREE.Mesh(
      new THREE.BoxGeometry(TORSO_W * 1.12, 0.12, TORSO_D * 1.2),
      matSash
    );
    sash.position.set(0, -TORSO_H * 0.12, 0);
    avTorso.add(sash);
    parts.push(sash);
    // Silver buttons (not glowing black)
    for (let i = 0; i < 3; i++) {
      const btn = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), matSilver);
      btn.position.set(0, 0.18 - i * 0.14, -TORSO_D / 2 - 0.06);
      avTorso.add(btn);
      parts.push(btn);
    }
  }
  // White pants panels on legs
  state._pirateSavedPantsMats = [];
  for (const leg of [avLegL, avLegR]) {
    if (!leg || !leg.hip) continue;
    leg.hip.traverse((ch) => {
      if (ch.isMesh && ch.material && ch.visible !== false) {
        state._pirateSavedPantsMats.push({ mesh: ch, mat: ch.material });
        ch.material = matWhiteSoft;
      }
    });
  }

  state._pirateGearParts = parts;
  state.hasPirateGear = true;
}

/** Red & black pirate clothes + red pirate hat (press J on boat) */
function applyRedBlackPirateGear(on) {
  // Clear any existing pirate gear first
  if (state._pirateGearParts) {
    for (const p of state._pirateGearParts) {
      if (p.parent) p.parent.remove(p);
    }
  }
  state._pirateGearParts = [];
  if (!on) {
    state.hasPirateGear = false;
    state.pirateOutfit = null;
    if (state._ronFace) state._ronFace.visible = true;
    if (avTorso && state._pirateSavedTorsoMat) {
      const torsoMesh = avTorso.userData.mesh;
      if (torsoMesh) torsoMesh.material = state._pirateSavedTorsoMat;
      state._pirateSavedTorsoMat = null;
    }
    if (state._pirateSavedPantsMats) {
      for (const { mesh, mat } of state._pirateSavedPantsMats) {
        if (mesh) mesh.material = mat;
      }
      state._pirateSavedPantsMats = null;
    }
    if (typeof paintPlayerYellowSkin === "function") paintPlayerYellowSkin();
    if (typeof ensureHairOnHead === "function") ensureHairOnHead();
    return;
  }
  if (!avHead) return;

  const matRed = new THREE.MeshStandardMaterial({
    color: 0xb91c1c, roughness: 0.65, metalness: 0.15, flatShading: false,
  });
  const matRedDark = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d, roughness: 0.7, metalness: 0.1, flatShading: false,
  });
  const matBlack = new THREE.MeshStandardMaterial({
    color: 0x171717, roughness: 0.75, metalness: 0.2, flatShading: false,
  });
  const matBlackSoft = new THREE.MeshStandardMaterial({
    color: 0x292524, roughness: 0.8, metalness: 0.1, flatShading: false,
  });
  const matGold = new THREE.MeshStandardMaterial({
    color: 0xfbbf24, roughness: 0.4, metalness: 0.65, flatShading: false,
  });
  const matWhite = new THREE.MeshStandardMaterial({
    color: 0xf8fafc, roughness: 0.6, metalness: 0.05, flatShading: false,
  });

  const parts = [];
  // Keep face visible under open hat (no mask)
  if (state._ronFace) state._ronFace.visible = true;

  // ── RED pirate hat ──
  const hat = new THREE.Group();
  hat.position.set(0, HEAD_H * 0.42, 0);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(HEAD_W * 1.25, 0.2, HEAD_D * 1.25), matRed);
  crown.position.y = 0.1;
  const brimF = new THREE.Mesh(new THREE.BoxGeometry(HEAD_W * 1.55, 0.07, 0.16), matRedDark);
  brimF.position.set(0, 0.02, -HEAD_D * 0.55);
  const brimB = new THREE.Mesh(new THREE.BoxGeometry(HEAD_W * 1.45, 0.07, 0.14), matRedDark);
  brimB.position.set(0, 0.02, HEAD_D * 0.5);
  const brimL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, HEAD_D * 1.2), matRedDark);
  brimL.position.set(-HEAD_W * 0.7, 0.02, 0);
  const brimR = brimL.clone();
  brimR.position.x = HEAD_W * 0.7;
  const band = new THREE.Mesh(new THREE.BoxGeometry(HEAD_W * 1.28, 0.08, HEAD_D * 1.28), matBlack);
  band.position.y = 0.02;
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.04), matWhite);
  skull.position.set(0, 0.12, -HEAD_D * 0.55 - 0.04);
  const bone = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), matGold);
  bone.position.set(0, 0.05, -HEAD_D * 0.55 - 0.04);
  // Feather plume
  const feather = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.04), matRed);
  feather.position.set(0.12, 0.28, 0.05);
  feather.rotation.z = -0.4;
  hat.add(crown, brimF, brimB, brimL, brimR, band, skull, bone, feather);
  avHead.add(hat);
  parts.push(hat);

  // ── Red & black coat ──
  if (avTorso) {
    const torsoMesh = avTorso.userData.mesh || avTorso.children.find((c) => c.isMesh);
    if (torsoMesh) {
      state._pirateSavedTorsoMat = torsoMesh.material;
      torsoMesh.material = matBlack;
    }
    const coat = new THREE.Mesh(
      new THREE.BoxGeometry(TORSO_W * 1.12, TORSO_H * 1.1, TORSO_D * 1.2),
      matBlack
    );
    avTorso.add(coat);
    parts.push(coat);
    // Red panels
    const redFront = new THREE.Mesh(
      new THREE.BoxGeometry(TORSO_W * 0.7, TORSO_H * 0.85, 0.08),
      matRed
    );
    redFront.position.set(0, 0.05, -TORSO_D / 2 - 0.05);
    avTorso.add(redFront);
    parts.push(redFront);
    const redStripe = new THREE.Mesh(
      new THREE.BoxGeometry(TORSO_W * 1.14, 0.1, TORSO_D * 1.22),
      matRedDark
    );
    redStripe.position.set(0, -TORSO_H * 0.15, 0);
    avTorso.add(redStripe);
    parts.push(redStripe);
    // Gold buttons
    for (let i = 0; i < 4; i++) {
      const btn = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), matGold);
      btn.position.set(0, 0.22 - i * 0.12, -TORSO_D / 2 - 0.08);
      avTorso.add(btn);
      parts.push(btn);
    }
  }
  // Black pants with red stripe
  state._pirateSavedPantsMats = [];
  for (const leg of [avLegL, avLegR]) {
    if (!leg || !leg.hip) continue;
    leg.hip.traverse((ch) => {
      if (ch.isMesh && ch.material && ch.visible !== false) {
        state._pirateSavedPantsMats.push({ mesh: ch, mat: ch.material });
        ch.material = matBlackSoft;
      }
    });
  }
  // Red arm cuffs
  for (const sh of [avShoulderL, avShoulderR]) {
    if (!sh) continue;
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(ARM_W * 1.15, 0.12, ARM_D * 1.15), matRed);
    cuff.position.set(0, -ARM_H * 0.85, 0);
    sh.add(cuff);
    parts.push(cuff);
  }

  state._pirateGearParts = parts;
  state.hasPirateGear = true;
  state.pirateOutfit = "redblack";
  if (typeof ensureHairOnHead === "function") ensureHairOnHead();
  toast("🏴‍☠️ Red & black pirate clothes + red hat ON!", "reward");
  playerSay("Arrr! Red pirate style!");
}

function toggleBoatPirateClothes() {
  if (!state.inVehicle || (state.vehicle?.type !== "boat" && state.vehicle?.subtype !== "pirate")) {
    toast("Board a boat first, then press J", "");
    return;
  }
  if (state.pirateOutfit === "redblack" || state.hasPirateGear) {
    applyRedBlackPirateGear(false);
    toast("Pirate clothes off", "");
  } else {
    applyRedBlackPirateGear(true);
  }
}

function boardPirateBoat() {
  const boat = state.pirateBoat || vehicles.find((v) => v.subtype === "pirate");
  if (!boat || !boat.group) {
    toast("Find the pirate boat on the ocean!", "");
    return false;
  }
  if (state.inVehicle) {
    if (state.vehicle === boat) {
      toast("You're already on the pirate boat!", "");
      return true;
    }
    toast("Exit your vehicle first (E)", "");
    return false;
  }
  // Must be reasonably near the pirate boat
  const d = Math.hypot(player.pos.x - boat.group.position.x, player.pos.z - boat.group.position.z);
  if (d > 18) {
    toast("Get closer to the pirate boat, then press B", "quest");
    return false;
  }
  // Stop AI cruise while you sail together
  if (boat.fisher) boat.fisher.driving = false;
  const ok = enterVehicle(boat);
  if (ok) {
    pirateSay("Aye Ryan! Press J for red and black pirate clothes and a red hat!");
    toast("🏴‍☠️ On the pirate boat! Press J for red & black clothes + red hat", "reward");
  }
  return ok;
}

/** Cockpit seat offset (local to craft group) */
function pilotSeatLocal(v) {
  if (!v) return { x: 0, y: 0.4, z: 0.5, scale: 0.45, yaw: Math.PI };
  if (v.type === "airplane") {
    // In the glass bubble, facing camera-friendly (glowing goggles visible)
    return { x: 0, y: 0.22, z: 1.95, scale: 0.42, yaw: Math.PI };
  }
  if (v.type === "jet") {
    return { x: 0, y: 0.15, z: 0.85, scale: 0.4, yaw: Math.PI };
  }
  if (v.type === "rocket" || v.subtype === "ironman") {
    return { x: 0, y: -0.55, z: 0.75, scale: 0.32, yaw: Math.PI };
  }
  if (v.subtype === "pirate") {
    // Sit next to the pirate captain (he is at ~0.9 local Z)
    return { x: 0.45, y: 0.72, z: 0.55, scale: 0.55, yaw: Math.PI };
  }
  if (v.type === "boat") {
    return { x: 0, y: 0.55, z: 0.2, scale: 0.7, yaw: 0 };
  }
  return { x: 0, y: 0.6, z: 0, scale: 0.55, yaw: 0 };
}

/** Sit Ron in the craft — pilot goggles OR pirate gear */
function seatPlayerInCraft(v) {
  if (!v || !v.group) return;
  const isPirateBoat = v.subtype === "pirate";

  // Keep the pirate captain visible on HIS boat; hide dummy pilots elsewhere
  if (v.pilot && !isPirateBoat) v.pilot.visible = false;
  if (v.pilot && isPirateBoat) v.pilot.visible = true;

  const seat = pilotSeatLocal(v);
  // Detach from scene root if needed, parent under craft
  if (avatar.parent) avatar.parent.remove(avatar);
  v.group.add(avatar);
  avatar.position.set(seat.x, seat.y, seat.z);
  avatar.rotation.order = "YXZ";
  avatar.rotation.set(isPirateBoat ? 0.05 : 0.12, seat.yaw, 0);
  avatar.scale.setScalar(seat.scale);
  avatar.visible = true;
  state._seatedInCraft = true;
  state._pilotSeatType = v.subtype || v.type;

  if (isPirateBoat) {
    applyPilotGoggles(false);
    // Don't auto-dress — press J for red/black pirate clothes + red hat
    applyPirateGear(false);
    player.camDistTarget = Math.max(player.camDistTarget, 10);
    player.camDist = Math.max(player.camDist, 9);
    toast("🏴‍☠️ On the boat! Press J for red & black pirate clothes + red hat", "quest");
  } else {
    applyPirateGear(false);
    applyPilotGoggles(true);
    player.camDistTarget = Math.max(player.camDistTarget, v.type === "airplane" ? 12 : 10);
    player.camDist = Math.max(player.camDist, v.type === "airplane" ? 11 : 9);
  }
}

function unseatPlayerFromCraft() {
  applyPilotGoggles(false);
  applyPirateGear(false);
  applyRedBlackPirateGear(false);
  // Resume pirate AI cruise if we left his boat
  if (state.vehicle?.subtype === "pirate" && state.vehicle.fisher) {
    state.vehicle.fisher.driving = true;
  }
  // Put avatar back in the world scene
  if (avatar.parent && avatar.parent !== scene) {
    avatar.parent.remove(avatar);
  }
  if (avatar.parent !== scene) scene.add(avatar);
  avatar.scale.setScalar(1);
  avatar.rotation.set(0, player.yaw || 0, 0);
  avatar.position.set(player.pos.x, player.pos.y, player.pos.z);
  state._seatedInCraft = false;
  state._pilotSeatType = null;
  // Back to natural skin after leaving craft
  if (typeof paintPlayerYellowSkin === "function") paintPlayerYellowSkin();
}

/** Sitting pilot limb pose (block character in the seat) */
function applyPilotSitPose(dt) {
  const sm = Math.min(1, 14 * dt);
  // Legs bent up like sitting
  const hipSit = 1.05;
  const kneeSit = 1.15;
  avLegL.hip.rotation.x = lerpAngle(avLegL.hip.rotation.x, hipSit, sm);
  avLegR.hip.rotation.x = lerpAngle(avLegR.hip.rotation.x, hipSit, sm);
  avLegL.knee.rotation.x = lerpAngle(avLegL.knee.rotation.x, kneeSit, sm);
  avLegR.knee.rotation.x = lerpAngle(avLegR.knee.rotation.x, kneeSit, sm);
  // Arms forward on the stick / yoke
  avShoulderL.rotation.x = lerpAngle(avShoulderL.rotation.x, -0.85, sm);
  avShoulderR.rotation.x = lerpAngle(avShoulderR.rotation.x, -0.85, sm);
  avShoulderL.rotation.z = lerpAngle(avShoulderL.rotation.z, 0.25, sm);
  avShoulderR.rotation.z = lerpAngle(avShoulderR.rotation.z, -0.25, sm);
  avElbowL.rotation.x = lerpAngle(avElbowL.rotation.x, 0.55, sm);
  avElbowR.rotation.x = lerpAngle(avElbowR.rotation.x, 0.55, sm);
  // Gentle pilot sway with craft pitch/speed
  const v = state.vehicle;
  const sway = v ? Math.sin(state.elapsed * 2.2) * 0.03 + (v.pitch || 0) * 0.15 : 0;
  avBody.rotation.x = THREE.MathUtils.lerp(avBody.rotation.x || 0, 0.08 + sway * 0.2, sm);
  avBody.position.y = THREE.MathUtils.lerp(avBody.position.y || 0, 0, sm);
  if (avHead) {
    avHead.rotation.x = THREE.MathUtils.lerp(avHead.rotation.x || 0, -0.05 + Math.sin(state.elapsed * 1.4) * 0.03, sm);
    avHead.rotation.y = THREE.MathUtils.lerp(avHead.rotation.y || 0, Math.sin(state.elapsed * 0.7) * 0.08, sm);
  }
  // Pulse pilot / pirate glass glow
  const glowRoots = [];
  if (state._pilotGoggles) glowRoots.push(...state._pilotGoggles);
  if (state._pirateGearParts) glowRoots.push(...state._pirateGearParts);
  for (const root of glowRoots) {
    root.traverse((ch) => {
      if (ch.material && ch.material.emissiveIntensity != null) {
        ch.material.emissiveIntensity = 0.75 + Math.sin(state.elapsed * 5) * 0.4;
      }
      if (ch.material && ch.material.opacity != null && ch.material.transparent && ch.material.color) {
        const hex = ch.material.color.getHex();
        if (hex === 0x7dd3fc || hex === 0x38bdf8 || hex === 0x67e8f9 || hex === 0x22d3ee) {
          ch.material.opacity = 0.45 + Math.sin(state.elapsed * 6) * 0.22;
        }
      }
    });
  }
}

/** Try to board whatever is nearest — used by E and click */
function tryBoardNearest() {
  // Gate door on beach path
  if (!state.inVehicle && tryToggleGate()) return true;
  // Treasure chest on the beach sand
  if (!state.inVehicle && tryOpenTreasure()) return true;

  if (state.inVehicle) {
    // Free TRY: don't abandon mid-air — must return via DONE
    if (state.rocketTrial && state.vehicle?.subtype === "ironman") {
      toast("Bring the rocket back to Michael, then click DONE (or press D)", "quest");
      return true;
    }
    // Don't steal rocket while Michael is joyriding
    if (state.michaelJoyride && state.vehicle?.subtype === "ironman") {
      toast("Michael is flying — wait for him to land", "quest");
      return true;
    }
    exitVehicle();
    return true;
  }
  const v = nearestVehicle() || state.nearVehicle;
  if (v) {
    const ok = enterVehicle(v);
    if (ok) return true;
  }
  // Fallback: any free craft within 22m
  let best = null;
  let bestD = 22;
  for (const c of vehicles) {
    if (!c?.group || c.crashing) continue;
    const d = Math.hypot(c.group.position.x - player.pos.x, c.group.position.z - player.pos.z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (best) return !!enterVehicle(best);
  toast("Walk next to a plane / rocket / boat, then press E", "");
  return false;
}

function enterVehicle(v) {
  if (!v || !v.group) {
    toast("Can't board — no vehicle", "");
    return false;
  }
  // Clear stuck flags
  if (v.crashing) {
    toast("That craft crashed — wait for a new one", "kill");
    return false;
  }
  if (v.occupied && state.vehicle !== v) {
    // force free if stuck occupied with no driver
    if (!state.inVehicle) v.occupied = false;
    else {
      toast("Already in use!", "");
      return false;
    }
  }
  // Iron Man rocket: only if owned or currently on free TRY
  if (v.subtype === "ironman") {
    if (state.michaelJoyride) {
      toast("Michael is flying his rocket for 102s — wait!", "quest");
      return false;
    }
    if (!state.rocketOwned && !state.rocketTrial) {
      toast("Talk to Michael · press 2 · then B to BUY or T to TRY (20s)", "quest");
      return false;
    }
    v.locked = false;
  } else if (v.locked && v.price && !v.owned) {
    // other paid craft
    toast(`This craft costs coins — unlock it first`, "");
    return false;
  } else {
    v.locked = false;
  }
  if (v.priceTag) v.priceTag.visible = false;

  // Close UI that blocks movement / keys
  try {
    if (state.cinemaOpen) closeRocketCinema();
    if (state.calendarOpen) closeCalendar();
    if (state.settingsOpen) closeSettings();
  } catch (_) {}
  state.paused = false;
  player.sleeping = false;
  player.parachuting = false;
  player.turnAround = false;
  state.climbing = false;
  state.onTree = false;

  state.inVehicle = true;
  state.vehicle = v;
  v.occupied = true;
  v.speed = 0;
  if (v.vertSpeed != null) v.vertSpeed = 0;
  weaponGroup.visible = false;
  $("speedo")?.classList.remove("hidden");
  const unit = document.querySelector(".speed-unit");

  // Snap craft upright at a boardable height
  const gx = v.group.position.x;
  const gz = v.group.position.z;
  // Prefer pad/roof under craft
  let gy = Math.max(0, groundY(gx, gz));
  // If player is standing higher (on pad), lift craft to their feet
  if (player.pos.y > gy + 0.5) gy = player.pos.y;
  v.group.rotation.order = "YXZ";
  if (v.type === "boat") {
    // Stay on the water — don't lift like a plane
    if (v.yaw == null) v.yaw = v.group.rotation.y || 0;
    v.group.rotation.y = v.yaw;
    v.group.rotation.x = 0;
    v.group.rotation.z = 0;
    v.group.position.y = WATER_SURFACE + 0.2;
    v.speed = 0;
  } else {
    v.group.rotation.x = -0.08;
    v.group.rotation.z = 0;
    if (v.yaw == null) v.yaw = v.group.rotation.y || 0;
    v.group.rotation.y = v.yaw;
    v.group.position.y = gy + 1.6;
    v.pitch = 0.1;
    v.speed = 0;
    if (v.vel) v.vel.set(0, 0, 0);
  }

  // Put player on craft
  player.pos.copy(v.group.position);
  player.vel.set(0, 0, 0);

  // Pirate boat: pause captain AI while you sail together
  if (v.subtype === "pirate" && v.fisher) v.fisher.driving = false;

  // Seat YOUR character (pilot goggles OR pirate hat/glasses/suit)
  seatPlayerInCraft(v);

  if (v.type === "rocket" || v.type === "jet" || v.type === "airplane") {
    if (unit) unit.textContent = "FLIGHT";
    if (v.type === "jet") {
      toast("✈️ Jet! You are sitting in the cockpit with glowing glasses · E exit", "reward");
    } else if (v.type === "airplane") {
      toast("🛩️ Airplane! Ron is sitting with glowing pilot glasses — look from behind!", "reward");
    } else if (v.subtype === "ironman") {
      toast("🚀 IRON MAN ROCKET! U = TV · 5/6/7 transform · E exit", "reward");
    } else {
      toast("🚀 Rocket! W thrust · Space climb · Ctrl dive · A/D turn · E exit", "reward");
    }
  } else if (v.type === "boat") {
    if (unit) unit.textContent = "KNOTS";
    if (v.subtype === "pirate") {
      toast("🏴‍☠️ Pirate boat! Press J for red/black outfit · WASD · E leave", "reward");
    } else {
      toast("⛵ Boat! WASD sail · E exit", "reward");
    }
  } else {
    if (unit) unit.textContent = "KM/H";
    toast("Vroom! WASD · E exit", "reward");
  }
  setMode("FREE ROAM");
  // Re-lock mouse for flight controls
  try { canvas.requestPointerLock?.(); } catch (_) {}
  return true;
}

// ── Iron Man rocket: mini cartoons (U) + electric color transform ──
// Terminator 2 poster for Iron Man rocket TV (channel 4)
state._terminatorPoster = new Image();
state._terminatorPoster.src = "assets/terminator-poster.jpg";

const ROCKET_SHOWS = {
  spiderman: { title: "Spider-Man · 4K+ PRO", bg: "#0c4a6e", accent: "#ef4444" },
  toystory: { title: "Toy Story · 4K+ PRO", bg: "#422006", accent: "#fbbf24" },
  avengers: { title: "Avengers · 4K+ PRO", bg: "#1e1b4b", accent: "#a78bfa" },
  terminator: { title: "Terminator 2 · Judgment Day · 4K+ PRO", bg: "#020617", accent: "#fca5a5" },
};

function isInIronManRocket() {
  return state.inVehicle && state.vehicle?.subtype === "ironman";
}

function openRocketCinema(showId = "spiderman") {
  if (!isInIronManRocket()) return;
  // Toy Story mode: 11s space flight loading, then join Avengers
  if (showId === "toystory") {
    startToyStoryLoading();
    return;
  }
  state.cinemaOpen = true;
  state.cinemaShow = showId in ROCKET_SHOWS ? showId : "spiderman";
  state.cinemaT = 0;
  const panel = $("rocket-cinema");
  panel?.classList.remove("hidden");
  $("cinema-title").textContent = `4K+ PRO TV · ${ROCKET_SHOWS[state.cinemaShow].title}`;
  document.querySelectorAll(".cinema-channels button").forEach((b) => {
    b.classList.toggle("active", b.dataset.show === state.cinemaShow);
  });
  // Free cursor a bit for buttons (optional pointer unlock)
  if (document.pointerLockElement) document.exitPointerLock();
}

function closeRocketCinema() {
  state.cinemaOpen = false;
  $("rocket-cinema")?.classList.add("hidden");
}

function toggleRocketCinema() {
  if (!isInIronManRocket()) {
    toast("Board the Iron Man rocket first!", "");
    return;
  }
  if (state.cinemaOpen) closeRocketCinema();
  else openRocketCinema(state.cinemaShow || "spiderman");
}

function setRocketShow(id) {
  if (!(id in ROCKET_SHOWS)) return;
  // Toy Story channel = loading gate into Avengers
  if (id === "toystory") {
    startToyStoryLoading();
    return;
  }
  state.cinemaShow = id;
  state.cinemaT = 0;
  if ($("cinema-title")) {
    $("cinema-title").textContent = `4K+ PRO TV · ${ROCKET_SHOWS[id].title}`;
  }
  document.querySelectorAll(".cinema-channels button").forEach((b) => {
    b.classList.toggle("active", b.dataset.show === id);
  });
  toast(`▶ Now playing: ${ROCKET_SHOWS[id].title}`, "quest");
}

// ── Flight cutscenes: DRAW your Ron flying (space ↑ or Earth ↓) ──
const TOY_STORY_LOAD_SEC = 11;
const EARTH_RETURN_SEC = 11;
state.toyStoryLoading = false;
state.earthReturnLoading = false;
state._flightMode = null; // "space" | "earth"
state._toyStoryLoadRaf = 0;
state._toyStoryLoadEnd = 0;
state._toyStoryLoadStart = 0;

function _hexCss(hex) {
  return "#" + (hex >>> 0).toString(16).padStart(6, "0");
}

/** Draw YOUR blocky Ron at local origin (yellow · red shirt · dark red pants · bubble hair) */
function drawRonCharacter2D(ctx, t, opts = {}) {
  const dive = !!opts.dive; // nose-down toward Earth
  const skin = _hexCss(AV.skin);
  const shirt = _hexCss(AV.shirt);
  const pants = _hexCss(AV.pants);
  const hair = "#141414";
  const hairHi = "#5a5a5a";

  ctx.save();
  if (dive) {
    // Dive pose: tilt forward so he heads toward Earth
    ctx.rotate(0.55 + Math.sin(t * 1.8) * 0.05);
  } else {
    ctx.rotate(Math.sin(t * 1.5) * 0.06);
  }

  // Shadow under (faint)
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 108, 36, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (dark red)
  ctx.fillStyle = pants;
  ctx.fillRect(-18, 48, 14, 48);
  ctx.fillRect(4, 48, 14, 48);
  ctx.fillStyle = "#2a2118";
  ctx.fillRect(-20, 90, 16, 10);
  ctx.fillRect(4, 90, 16, 10);

  // Arms out (flying) — yellow skin
  ctx.fillStyle = skin;
  ctx.save();
  ctx.translate(-28, 8);
  ctx.rotate(-0.85 + Math.sin(t * 3) * 0.08);
  ctx.fillRect(-8, 0, 12, 46);
  ctx.restore();
  ctx.save();
  ctx.translate(28, 8);
  ctx.rotate(0.85 + Math.sin(t * 3 + 1) * 0.08);
  ctx.fillRect(-4, 0, 12, 46);
  ctx.restore();

  // Torso — red shirt
  ctx.fillStyle = shirt;
  ctx.fillRect(-22, -4, 44, 56);
  ctx.fillStyle = _hexCss(AV.shirtDark);
  ctx.fillRect(-22, 36, 44, 8);

  // Neck + head
  ctx.fillStyle = skin;
  ctx.fillRect(-6, -18, 12, 16);
  ctx.fillRect(-16, -58, 32, 42);

  // Face
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(-7, -42, 5, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(7, -42, 5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(-7, -41, 2.2, 0, Math.PI * 2);
  ctx.arc(7, -41, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -32, 7, 0.15, Math.PI - 0.15);
  ctx.stroke();
  ctx.fillStyle = _hexCss(AV.skinShadow);
  ctx.fillRect(-2, -36, 4, 5);

  // Fluffy triplet bubble hair
  function bubble(bx, by, r, mat) {
    ctx.fillStyle = mat;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hairHi;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(bx - r * 0.25, by - r * 0.3, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  bubble(-18, -62, 16, hair);
  bubble(0, -72, 18, hair);
  bubble(18, -62, 16, hair);
  bubble(-8, -66, 10, hair);
  bubble(8, -66, 10, hair);
  bubble(0, -58, 9, hair);

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(-28, 112, 56, 16);
  ctx.fillStyle = "#fef08a";
  ctx.font = "bold 11px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("RON", 0, 124);
  ctx.restore();
}

function _drawFlightTitle(ctx, title, sub) {
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  const rx = 24, ry = 20, rw = 420, rh = 48, rr = 12;
  ctx.moveTo(rx + rr, ry);
  ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rr);
  ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rr);
  ctx.arcTo(rx, ry + rh, rx, ry, rr);
  ctx.arcTo(rx, ry, rx + rw, ry, rr);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fef08a";
  ctx.font = "bold 22px system-ui,sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(title, 40, 48);
  ctx.fillStyle = "#7dd3fc";
  ctx.font = "14px system-ui,sans-serif";
  ctx.fillText(sub, 40, 66);
}

/** Draw YOUR character flying UP into space */
function drawRonFlyingInSpace(ctx, w, h, t, progress) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#02010a");
  sky.addColorStop(0.45, "#0b1230");
  sky.addColorStop(0.75, "#1a0b3a");
  sky.addColorStop(1, "#020617");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 5; i++) {
    const nx = w * (0.15 + i * 0.18) + Math.sin(t * 0.4 + i) * 30;
    const ny = h * (0.25 + (i % 3) * 0.18) + Math.cos(t * 0.35 + i) * 20;
    const rg = ctx.createRadialGradient(nx, ny, 10, nx, ny, 120 + i * 20);
    rg.addColorStop(0, i % 2 ? "rgba(167,139,250,0.22)" : "rgba(56,189,248,0.18)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(nx, ny, 140, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 90; i++) {
    const x = ((i * 97 + t * 18) % w + w) % w;
    const y = ((i * 53 + t * 8) % (h * 0.95) + h) % h;
    const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 2.5 + i));
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(x, y, 1 + (i % 3), 1 + (i % 3));
  }

  // Distant Earth at bottom
  const earthY = h + 40 - progress * 30;
  const eg = ctx.createRadialGradient(w * 0.5, earthY, 20, w * 0.5, earthY, 180);
  eg.addColorStop(0, "#38bdf8");
  eg.addColorStop(0.45, "#166534");
  eg.addColorStop(0.8, "#0f172a");
  eg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.arc(w * 0.5, earthY, 180, 0, Math.PI * 2);
  ctx.fill();

  const cx = w * 0.5 + Math.sin(t * 1.4) * 18;
  const cy = h * 0.72 - progress * h * 0.38 + Math.sin(t * 2.2) * 8;
  const sc = 1.35 + progress * 0.15;

  // Trail under feet (going up)
  ctx.save();
  for (let i = 0; i < 11; i++) {
    const sy = cy + 90 * sc + i * 18 + (t * 40 + i * 12) % 40;
    ctx.strokeStyle = `rgba(251,191,36,${Math.max(0.05, 0.35 - i * 0.035)})`;
    ctx.lineWidth = 3 + i * 0.4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(t * 8 + i) * 6, sy);
    ctx.lineTo(cx + Math.sin(t * 8 + i + 1) * 4, sy + 28);
    ctx.stroke();
  }
  const thr = ctx.createRadialGradient(cx, cy + 95 * sc, 4, cx, cy + 110 * sc, 55);
  thr.addColorStop(0, "rgba(56,189,248,0.65)");
  thr.addColorStop(0.5, "rgba(167,139,250,0.25)");
  thr.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = thr;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 105 * sc, 28, 50, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(sc, sc);
  drawRonCharacter2D(ctx, t, { dive: false });
  ctx.restore();

  _drawFlightTitle(ctx, "Toy Story Mode", "Your character · flying into space");
}

/** Draw YOUR character flying BACK DOWN to Earth (Y button) */
function drawRonFlyingBackToEarth(ctx, w, h, t, progress) {
  // Space → sky blue as he re-enters
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#02010a");
  sky.addColorStop(0.25, "#0b1230");
  sky.addColorStop(0.55, progress > 0.45 ? "#1e3a5f" : "#1a0b3a");
  sky.addColorStop(0.8, progress > 0.55 ? "#38bdf8" : "#0f172a");
  sky.addColorStop(1, progress > 0.65 ? "#7dd3fc" : "#020617");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Stars fade as atmosphere thickens
  const starA = Math.max(0, 1 - progress * 1.2);
  if (starA > 0.05) {
    for (let i = 0; i < 70; i++) {
      const x = ((i * 91 + t * 10) % w + w) % w;
      const y = ((i * 47 + t * 4) % (h * 0.55) + h) % (h * 0.55);
      const a = starA * (0.3 + 0.7 * Math.abs(Math.sin(t * 2 + i)));
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(x, y, 1 + (i % 3), 1 + (i % 3));
    }
  }

  // Clouds appear late in re-entry
  if (progress > 0.5) {
    const ca = (progress - 0.5) * 2;
    ctx.fillStyle = `rgba(255,255,255,${0.35 * ca})`;
    for (let i = 0; i < 6; i++) {
      const cx0 = ((i * 180 + t * 30) % (w + 100)) - 50;
      const cy0 = h * 0.55 + (i % 3) * 40;
      ctx.beginPath();
      ctx.ellipse(cx0, cy0, 70, 22, 0, 0, Math.PI * 2);
      ctx.ellipse(cx0 + 40, cy0 + 6, 50, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // BIG Earth rising from bottom — grows as he flies home
  const earthR = 160 + progress * 220;
  const earthY = h + earthR * 0.35 - progress * 80;
  const eg = ctx.createRadialGradient(w * 0.5, earthY - earthR * 0.15, earthR * 0.1, w * 0.5, earthY, earthR);
  eg.addColorStop(0, "#7dd3fc");
  eg.addColorStop(0.25, "#22c55e");
  eg.addColorStop(0.5, "#166534");
  eg.addColorStop(0.75, "#0e4d2c");
  eg.addColorStop(1, "#0f172a");
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.arc(w * 0.5, earthY, earthR, 0, Math.PI * 2);
  ctx.fill();
  // Continent blobs
  ctx.fillStyle = "rgba(22,101,52,0.85)";
  ctx.beginPath();
  ctx.ellipse(w * 0.42, earthY - earthR * 0.15, earthR * 0.22, earthR * 0.12, 0.3, 0, Math.PI * 2);
  ctx.ellipse(w * 0.58, earthY + earthR * 0.05, earthR * 0.18, earthR * 0.1, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Atmosphere rim
  ctx.strokeStyle = `rgba(125,211,252,${0.4 + progress * 0.4})`;
  ctx.lineWidth = 8 + progress * 6;
  ctx.beginPath();
  ctx.arc(w * 0.5, earthY, earthR + 6, Math.PI, 0);
  ctx.stroke();

  // Ron dives from top of screen toward Earth
  const cx = w * 0.5 + Math.sin(t * 1.6) * 22;
  const cy = h * 0.12 + progress * h * 0.48 + Math.sin(t * 2) * 6;
  const sc = 1.15 + progress * 0.35;

  // Heat / re-entry trail ABOVE him (he's diving feet-first trail behind/above)
  ctx.save();
  for (let i = 0; i < 10; i++) {
    const sy = cy - 40 * sc - i * 16 - (t * 50 + i * 10) % 30;
    ctx.strokeStyle = `rgba(${255},${180 - i * 10},${40},${Math.max(0.05, 0.5 - i * 0.04)})`;
    ctx.lineWidth = 4 + i * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(t * 10 + i) * 5, sy);
    ctx.lineTo(cx + Math.sin(t * 10 + i + 1) * 3, sy - 22);
    ctx.stroke();
  }
  const thr = ctx.createRadialGradient(cx, cy - 40 * sc, 4, cx, cy - 70 * sc, 60);
  thr.addColorStop(0, "rgba(251,146,60,0.7)");
  thr.addColorStop(0.4, "rgba(239,68,68,0.35)");
  thr.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = thr;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 55 * sc, 24, 55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(sc, sc);
  drawRonCharacter2D(ctx, t, { dive: true });
  ctx.restore();

  _drawFlightTitle(ctx, "Flying Home", "Your character · flying back to Earth");
}

function _prepFlightCanvas() {
  const canvas = $("ts-load-canvas");
  if (!canvas) return null;
  // Always size from the window so the picture is never 0×0
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = Math.max(320, window.innerWidth || 1280);
  const cssH = Math.max(240, window.innerHeight || 720);
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  return canvas;
}

function _setFlightArt(mode) {
  const art = $("ts-load-art");
  if (!art) return;
  // Real drawn pictures of YOUR character
  art.src =
    mode === "earth"
      ? "assets/earth-return-loading.jpg"
      : "assets/toystory-space-loading.jpg";
  art.alt =
    mode === "earth"
      ? "Your character flying back to Earth"
      : "Your character flying up into space";
  // Restart zoom animation so the picture feels alive
  art.style.animation = "none";
  void art.offsetWidth;
  art.style.animation = "";
}

function _setFlightUi(title, sub, seconds) {
  const titleEl = document.querySelector(".ts-load-title");
  const subEl = document.querySelector(".ts-load-sub");
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.innerHTML = sub;
  if ($("ts-load-bar")) $("ts-load-bar").style.width = "0%";
  if ($("ts-load-sec")) $("ts-load-sec").textContent = String(seconds);
}

/**
 * Paint one frame.
 * The PHOTO (#ts-load-art) is the drawn picture — always visible.
 * Canvas only draws YOUR animated blocky Ron on top (transparent bg).
 */
function _paintFlightFrame(mode, elapsed, done) {
  const canvas = $("ts-load-canvas");
  if (!canvas) return;
  if (!canvas.width || !canvas.height) _prepFlightCanvas();
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Soft vignette so text stays readable without hiding the picture
  const vg = ctx.createRadialGradient(w * 0.5, h * 0.45, h * 0.15, w * 0.5, h * 0.5, h * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  // Animate YOUR character over the drawn picture
  let cx, cy, sc, dive;
  if (mode === "earth") {
    // Dive down toward Earth (picture already shows Earth)
    cx = w * 0.5 + Math.sin(elapsed * 1.6) * (w * 0.03);
    cy = h * 0.18 + done * h * 0.42 + Math.sin(elapsed * 2) * 8;
    sc = Math.min(w, h) / 420 * (1.1 + done * 0.35);
    dive = true;
    // Re-entry trail above him
    ctx.save();
    for (let i = 0; i < 10; i++) {
      const sy = cy - 30 * sc - i * 14 - ((elapsed * 50 + i * 10) % 28);
      ctx.strokeStyle = `rgba(251,146,60,${Math.max(0.05, 0.45 - i * 0.04)})`;
      ctx.lineWidth = (3 + i * 0.4) * (sc / 1.2);
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(elapsed * 10 + i) * 5, sy);
      ctx.lineTo(cx + Math.sin(elapsed * 10 + i + 1) * 3, sy - 20);
      ctx.stroke();
    }
    ctx.restore();
  } else {
    // Fly up into space
    cx = w * 0.5 + Math.sin(elapsed * 1.4) * (w * 0.025);
    cy = h * 0.68 - done * h * 0.35 + Math.sin(elapsed * 2.2) * 8;
    sc = Math.min(w, h) / 420 * (1.15 + done * 0.2);
    dive = false;
    // Thruster trail under feet
    ctx.save();
    for (let i = 0; i < 11; i++) {
      const sy = cy + 70 * sc + i * 14 + ((elapsed * 40 + i * 12) % 32);
      ctx.strokeStyle = `rgba(251,191,36,${Math.max(0.05, 0.35 - i * 0.035)})`;
      ctx.lineWidth = (3 + i * 0.35) * (sc / 1.2);
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(elapsed * 8 + i) * 5, sy);
      ctx.lineTo(cx + Math.sin(elapsed * 8 + i + 1) * 3, sy + 22);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(sc, sc);
  drawRonCharacter2D(ctx, elapsed, { dive });
  ctx.restore();
}

function startToyStoryLoading() {
  if (state.toyStoryLoading || state.earthReturnLoading) return;
  state.toyStoryLoading = true;
  state.earthReturnLoading = false;
  state._flightMode = "space";
  state._toyStoryLoadStart = performance.now();
  state._toyStoryLoadEnd = state._toyStoryLoadStart + TOY_STORY_LOAD_SEC * 1000;

  $("rocket-cinema")?.classList.add("hidden");
  state.cinemaOpen = false;
  state.paused = false;

  const overlay = $("toystory-loading");
  if (overlay) {
    overlay.classList.remove("hidden");
    overlay.style.display = "flex";
  }
  _setFlightArt("space");
  _setFlightUi(
    "TOY STORY MODE",
    "Picture of your character flying up… joining the <strong>Avengers</strong>",
    TOY_STORY_LOAD_SEC
  );
  // Force layout, then size + draw the first frame RIGHT NOW
  void overlay?.offsetWidth;
  _prepFlightCanvas();
  _paintFlightFrame("space", 0, 0);

  if (document.pointerLockElement) document.exitPointerLock();
  toast("🚀 Picture: Ron flying into space…", "quest");

  if (state._toyStoryLoadRaf) cancelAnimationFrame(state._toyStoryLoadRaf);
  const tick = (now) => {
    if (!state.toyStoryLoading) return;
    const leftMs = Math.max(0, state._toyStoryLoadEnd - now);
    const left = leftMs / 1000;
    const elapsed = (now - state._toyStoryLoadStart) / 1000;
    const done = 1 - left / TOY_STORY_LOAD_SEC;

    _paintFlightFrame("space", elapsed, done);

    if ($("ts-load-bar")) $("ts-load-bar").style.width = `${Math.min(100, done * 100).toFixed(1)}%`;
    if ($("ts-load-sec")) $("ts-load-sec").textContent = String(Math.max(0, Math.ceil(left)));

    if (leftMs <= 0) {
      finishToyStoryLoading();
      return;
    }
    state._toyStoryLoadRaf = requestAnimationFrame(tick);
  };
  state._toyStoryLoadRaf = requestAnimationFrame(tick);
}

function finishToyStoryLoading() {
  if (!state.toyStoryLoading) return;
  state.toyStoryLoading = false;
  state._flightMode = null;
  if (state._toyStoryLoadRaf) {
    cancelAnimationFrame(state._toyStoryLoadRaf);
    state._toyStoryLoadRaf = 0;
  }
  const overlay = $("toystory-loading");
  if (overlay) {
    overlay.classList.add("hidden");
    overlay.style.display = "";
  }
  if ($("ts-load-bar")) $("ts-load-bar").style.width = "100%";

  if (!isInIronManRocket()) {
    toast("Board the Iron Man rocket to join the Avengers!", "");
    return;
  }
  state.cinemaOpen = true;
  state.cinemaShow = "avengers";
  state.cinemaT = 0;
  $("rocket-cinema")?.classList.remove("hidden");
  if ($("cinema-title")) {
    $("cinema-title").textContent = `4K+ PRO TV · ${ROCKET_SHOWS.avengers.title}`;
  }
  document.querySelectorAll(".cinema-channels button").forEach((b) => {
    b.classList.toggle("active", b.dataset.show === "avengers");
  });
  toast("🦸 Welcome to the Avengers! · Press Y to fly home to Earth", "quest");
  // Fidget bundle is in the Avengers Server (hangar plaza)
  if (state.niftyStand || state.avengersHub) {
    setTimeout(() => {
      toast("🌪️ Fidget Bundle is in the AVENGERS SERVER · walk to the hangar plaza!", "reward");
    }, 1600);
  }
  // Soft-open shop UI if bundle still on sale (player is "in" Avengers)
  if (typeof isNiftyBundleOnSale === "function" && isNiftyBundleOnSale()) {
    setTimeout(() => {
      if (state.cinemaShow === "avengers" && !state.niftyBundleOffer) {
        try {
          openNiftyBundleOffer();
        } catch (_) {}
      }
    }, 2200);
  }
}

/** Y button — show drawn picture of your character flying BACK to Earth */
function startEarthReturnLoading() {
  if (state.toyStoryLoading || state.earthReturnLoading) return;
  state.earthReturnLoading = true;
  state.toyStoryLoading = false;
  state._flightMode = "earth";
  state._toyStoryLoadStart = performance.now();
  state._toyStoryLoadEnd = state._toyStoryLoadStart + EARTH_RETURN_SEC * 1000;

  // Leave Avengers TV while the picture is up
  $("rocket-cinema")?.classList.add("hidden");
  state.cinemaOpen = false;
  state.paused = false;
  $("pause-menu")?.classList.add("hidden");

  const overlay = $("toystory-loading");
  if (overlay) {
    overlay.classList.remove("hidden");
    overlay.style.display = "flex";
  }
  _setFlightArt("earth");
  _setFlightUi(
    "FLYING HOME",
    "Picture of your character flying back to <strong>Earth</strong>",
    EARTH_RETURN_SEC
  );
  void overlay?.offsetWidth;
  _prepFlightCanvas();
  _paintFlightFrame("earth", 0, 0);

  if (document.pointerLockElement) document.exitPointerLock();
  toast("🌍 Picture: Ron flying back to Earth…", "quest");

  if (state._toyStoryLoadRaf) cancelAnimationFrame(state._toyStoryLoadRaf);
  const tick = (now) => {
    if (!state.earthReturnLoading) return;
    const leftMs = Math.max(0, state._toyStoryLoadEnd - now);
    const left = leftMs / 1000;
    const elapsed = (now - state._toyStoryLoadStart) / 1000;
    const done = 1 - left / EARTH_RETURN_SEC;

    _paintFlightFrame("earth", elapsed, done);

    if ($("ts-load-bar")) $("ts-load-bar").style.width = `${Math.min(100, done * 100).toFixed(1)}%`;
    if ($("ts-load-sec")) $("ts-load-sec").textContent = String(Math.max(0, Math.ceil(left)));

    if (leftMs <= 0) {
      finishEarthReturnLoading();
      return;
    }
    state._toyStoryLoadRaf = requestAnimationFrame(tick);
  };
  state._toyStoryLoadRaf = requestAnimationFrame(tick);
}

function finishEarthReturnLoading() {
  if (!state.earthReturnLoading) return;
  state.earthReturnLoading = false;
  state._flightMode = null;
  if (state._toyStoryLoadRaf) {
    cancelAnimationFrame(state._toyStoryLoadRaf);
    state._toyStoryLoadRaf = 0;
  }
  const overlay = $("toystory-loading");
  if (overlay) {
    overlay.classList.add("hidden");
    overlay.style.display = "";
  }
  if ($("ts-load-bar")) $("ts-load-bar").style.width = "100%";
  closeRocketCinema();
  toast("🌍 Welcome back to Earth!", "reward");
}

/** Helpers for detailed mini-cartoons on Iron Man TV */
function _cinRoundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function _cinGrad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [p, c] of stops) g.addColorStop(p, c);
  return g;
}
function _cinStars(ctx, w, h, t, n = 40) {
  for (let i = 0; i < n; i++) {
    const x = ((i * 97 + t * 12) % w);
    const y = ((i * 53) % (h * 0.7));
    const a = 0.3 + 0.7 * Math.abs(Math.sin(t * 3 + i));
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(x, y, 1.5 + (i % 3) * 0.5, 1.5 + (i % 3) * 0.5);
  }
}
function _cinPerson(ctx, x, y, scale, suit, skin, t, pose = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 48, 18, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs
  const legSwing = Math.sin(t * 8 + pose) * 10;
  ctx.strokeStyle = suit;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-5, 18);
  ctx.lineTo(-8 - legSwing * 0.3, 42);
  ctx.moveTo(5, 18);
  ctx.lineTo(8 + legSwing * 0.3, 42);
  ctx.stroke();
  // Boots
  ctx.fillStyle = "#111";
  ctx.fillRect(-14 - legSwing * 0.3, 40, 12, 6);
  ctx.fillRect(2 + legSwing * 0.3, 40, 12, 6);
  // Torso
  ctx.fillStyle = suit;
  _cinRoundRect(ctx, -14, -8, 28, 30, 6);
  ctx.fill();
  // Arms
  const armSwing = Math.sin(t * 8 + pose + 1) * 18;
  ctx.strokeStyle = suit;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(-22, 8 + armSwing * 0.2);
  ctx.lineTo(-26, 22 + armSwing * 0.4);
  ctx.moveTo(14, 0);
  ctx.lineTo(22, 8 - armSwing * 0.2);
  ctx.lineTo(28 + Math.sin(t * 4) * 4, 10 + armSwing * 0.3);
  ctx.stroke();
  // Head
  ctx.fillStyle = skin || "#f5d0b0";
  ctx.beginPath();
  ctx.arc(0, -20, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Draw one 4K+ PRO cartoon frame into any 2d canvas context */
function draw4KShowInto(ctx, w, h, showId, t) {
  const show = ROCKET_SHOWS[showId] || ROCKET_SHOWS.spiderman;
  ctx.fillStyle = show.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  if (showId === "spiderman") {
    // Night city gradient sky
    ctx.fillStyle = _cinGrad(ctx, 0, 0, 0, h, [
      [0, "#0b1a33"], [0.45, "#0c4a6e"], [1, "#082f49"],
    ]);
    ctx.fillRect(0, 0, w, h);
    // Moon
    ctx.fillStyle = "#fef9c3";
    ctx.beginPath();
    ctx.arc(w * 0.85, h * 0.15, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0c4a6e";
    ctx.beginPath();
    ctx.arc(w * 0.87, h * 0.13, 22, 0, Math.PI * 2);
    ctx.fill();
    _cinStars(ctx, w, h, t, 55);
    // Layered skyline with windows
    for (let layer = 0; layer < 3; layer++) {
      const base = h - 30 - layer * 18;
      for (let i = 0; i < 16; i++) {
        const bw = 22 + ((i + layer) % 4) * 12;
        const bh = 50 + ((i * 41 + layer * 17) % 110) + layer * 20;
        const bx = i * 44 - layer * 10 + Math.sin(t * 0.2 + layer) * 2;
        ctx.fillStyle = layer === 0 ? "#0a1628" : layer === 1 ? "#0f2744" : "#163556";
        ctx.fillRect(bx, base - bh, bw, bh);
        // Windows lit
        for (let wy = 8; wy < bh - 10; wy += 12) {
          for (let wx = 4; wx < bw - 6; wx += 10) {
            if (((i * 3 + wy + wx + layer) % 5) === 0) continue;
            const lit = Math.sin(t * 2 + i + wy) > -0.3;
            ctx.fillStyle = lit ? "#fde68a" : "#1e293b";
            ctx.fillRect(bx + wx, base - bh + wy, 5, 6);
          }
        }
        // Antenna
        if (i % 3 === 0) {
          ctx.strokeStyle = "#64748b";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx + bw / 2, base - bh);
          ctx.lineTo(bx + bw / 2, base - bh - 14);
          ctx.stroke();
        }
      }
    }
    // Web lines network
    const hx = w * 0.5 + Math.sin(t * 2) * 90;
    const hy = h * 0.32 + Math.cos(t * 1.5) * 28;
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.15, 0);
    ctx.quadraticCurveTo(hx - 20, hy - 10, hx, hy);
    ctx.stroke();
    // Web spiral near hero
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1.2;
    for (let r = 12; r < 55; r += 10) {
      ctx.beginPath();
      ctx.arc(hx, hy, r, 0, Math.PI * 1.4);
      ctx.stroke();
    }
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2 + t * 0.2;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + Math.cos(ang) * 50, hy + Math.sin(ang) * 50);
      ctx.stroke();
    }
    // Detailed Spider-Man
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(Math.sin(t * 2) * 0.15);
    // Body suit
    ctx.fillStyle = "#dc2626";
    _cinRoundRect(ctx, -14, -4, 28, 36, 8);
    ctx.fill();
    // Blue sections
    ctx.fillStyle = "#1d4ed8";
    ctx.fillRect(-14, 8, 28, 14);
    // Head
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(0, -18, 14, 0, Math.PI * 2);
    ctx.fill();
    // Eye lenses
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(-6, -18, 5, 4, -0.2, 0, Math.PI * 2);
    ctx.ellipse(6, -18, 5, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-6, -18, 5, 4, -0.2, 0, Math.PI * 2);
    ctx.ellipse(6, -18, 5, 4, 0.2, 0, Math.PI * 2);
    ctx.stroke();
    // Web pattern on torso
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 5, -2);
      ctx.lineTo(i * 5, 30);
      ctx.stroke();
    }
    // Legs swinging
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    const ls = Math.sin(t * 9) * 14;
    ctx.beginPath();
    ctx.moveTo(-6, 30);
    ctx.lineTo(-14 - ls, 58);
    ctx.moveTo(6, 30);
    ctx.lineTo(14 + ls, 58);
    ctx.stroke();
    // Web shooter arm
    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(12, 4);
    ctx.lineTo(30, -6);
    ctx.stroke();
    ctx.restore();
    // Title card
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    _cinRoundRect(ctx, 10, 8, 260, 36, 8);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px system-ui";
    ctx.fillText("Spider-Man · 4K+ PRO", 22, 32);
    ctx.fillStyle = "#fca5a5";
    ctx.font = "13px system-ui";
    ctx.fillText("swinging through the city", 140, 32);

  } else if (showId === "toystory") {
    // Bedroom wallpaper stripes
    ctx.fillStyle = _cinGrad(ctx, 0, 0, 0, h * 0.62, [
      [0, "#fef3c7"], [1, "#fde68a"],
    ]);
    ctx.fillRect(0, 0, w, h * 0.62);
    for (let x = 0; x < w; x += 28) {
      ctx.fillStyle = "rgba(251,191,36,0.25)";
      ctx.fillRect(x, 0, 10, h * 0.62);
    }
    // Cloud stickers on wall
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    for (let i = 0; i < 5; i++) {
      const cx = 60 + i * 120;
      const cy = 40 + (i % 2) * 25;
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.arc(cx + 16, cy + 4, 14, 0, Math.PI * 2);
      ctx.arc(cx - 14, cy + 6, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    // Window
    ctx.fillStyle = "#7dd3fc";
    ctx.fillRect(w - 130, 30, 100, 90);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 4;
    ctx.strokeRect(w - 130, 30, 100, 90);
    ctx.beginPath();
    ctx.moveTo(w - 80, 30);
    ctx.lineTo(w - 80, 120);
    ctx.moveTo(w - 130, 75);
    ctx.lineTo(w - 30, 75);
    ctx.stroke();
    // Sun in window
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(w - 55, 55, 14, 0, Math.PI * 2);
    ctx.fill();
    // Floor with wood planks
    ctx.fillStyle = "#92400e";
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
    for (let i = 0; i < 12; i++) {
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.62 + i * 14);
      ctx.lineTo(w, h * 0.62 + i * 14);
      ctx.stroke();
    }
    // Toy chest
    ctx.fillStyle = "#b45309";
    ctx.fillRect(20, h * 0.55, 90, 55);
    ctx.fillStyle = "#78350f";
    ctx.fillRect(18, h * 0.52, 94, 12);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(55, h * 0.7, 16, 8);
    // Cowboy (Woody-like)
    const cx = w * 0.32 + Math.sin(t * 1.2) * 16;
    const cy = h * 0.48;
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 70, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Boots
    ctx.fillStyle = "#78350f";
    ctx.fillRect(cx - 16, cy + 55, 12, 14);
    ctx.fillRect(cx + 4, cy + 55, 12, 14);
    // Legs
    ctx.fillStyle = "#1d4ed8";
    ctx.fillRect(cx - 12, cy + 28, 10, 30);
    ctx.fillRect(cx + 2, cy + 28, 10, 30);
    // Body (yellow shirt)
    ctx.fillStyle = "#fbbf24";
    _cinRoundRect(ctx, cx - 16, cy, 32, 32, 4);
    ctx.fill();
    // Cow spots vest
    ctx.fillStyle = "#fff";
    ctx.fillRect(cx - 14, cy + 4, 28, 18);
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(cx - 6, cy + 10, 4, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy + 14, 3, 0, Math.PI * 2);
    ctx.fill();
    // Bandana
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(cx - 12, cy - 2, 24, 6);
    // Head
    ctx.fillStyle = "#f5d0b0";
    ctx.beginPath();
    ctx.arc(cx, cy - 14, 14, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 15, 3.5, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy - 15, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 15, 1.5, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy - 15, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Smile
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy - 10, 5, 0.1, Math.PI - 0.1);
    ctx.stroke();
    // Cowboy hat
    ctx.fillStyle = "#92400e";
    ctx.fillRect(cx - 20, cy - 28, 40, 8);
    ctx.fillRect(cx - 12, cy - 40, 24, 14);
    // Badge star
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 14px system-ui";
    ctx.fillText("★", cx - 5, cy + 18);
    // Space ranger (Buzz-like)
    const sx = w * 0.68;
    const sy = h * 0.42 + Math.abs(Math.sin(t * 3)) * -48;
    // Jet glow
    ctx.fillStyle = `rgba(56,189,248,${0.3 + Math.sin(t * 10) * 0.15})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 50, 16, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body suit white
    ctx.fillStyle = "#f8fafc";
    _cinRoundRect(ctx, sx - 16, sy, 32, 42, 8);
    ctx.fill();
    // Green torso panel
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(sx - 12, sy + 8, 24, 18);
    // Purple belt
    ctx.fillStyle = "#7c3aed";
    ctx.fillRect(sx - 16, sy + 28, 32, 6);
    // Wings
    ctx.fillStyle = "rgba(125,211,252,0.55)";
    ctx.fillRect(sx - 34, sy + 6, 16, 28);
    ctx.fillRect(sx + 18, sy + 6, 16, 28);
    // Head / helmet
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(sx, sy - 10, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(sx, sy - 10, 12, 0, Math.PI * 2);
    ctx.fill();
    // Face inside
    ctx.fillStyle = "#f5d0b0";
    ctx.beginPath();
    ctx.arc(sx, sy - 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(sx - 3, sy - 9, 1.5, 0, Math.PI * 2);
    ctx.arc(sx + 3, sy - 9, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Arm raised
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx + 14, sy + 10);
    ctx.lineTo(sx + 28, sy - 8 + Math.sin(t * 5) * 4);
    ctx.stroke();
    // Title
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    _cinRoundRect(ctx, 10, 8, 240, 36, 8);
    ctx.fill();
    ctx.fillStyle = "#fef08a";
    ctx.font = "bold 20px system-ui";
    ctx.fillText("Toy Story · 4K+ PRO", 22, 32);
    ctx.fillStyle = "#fff";
    ctx.font = "13px system-ui";
    ctx.fillText("to infinity!", 130, 32);

  } else if (showId === "avengers") {
    // Cosmic background
    ctx.fillStyle = _cinGrad(ctx, 0, 0, w, h, [
      [0, "#0f0a1e"], [0.5, "#1e1b4b"], [1, "#0c0a1a"],
    ]);
    ctx.fillRect(0, 0, w, h);
    _cinStars(ctx, w, h, t, 80);
    // Nebula blobs
    for (let i = 0; i < 4; i++) {
      const nx = w * (0.2 + i * 0.2) + Math.sin(t + i) * 20;
      const ny = h * 0.4 + Math.cos(t * 0.7 + i) * 30;
      const grd = ctx.createRadialGradient(nx, ny, 5, nx, ny, 80);
      grd.addColorStop(0, i % 2 ? "rgba(167,139,250,0.25)" : "rgba(56,189,248,0.2)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(nx, ny, 80, 0, Math.PI * 2);
      ctx.fill();
    }
    // Heroes with icons
    const heroes = [
      { c: "#ef4444", name: "IM", emblem: "◆" },
      { c: "#3b82f6", name: "CA", emblem: "★" },
      { c: "#22c55e", name: "TH", emblem: "⚡" },
      { c: "#a855f7", name: "BW", emblem: "◉" },
      { c: "#f59e0b", name: "HK", emblem: "▓" },
      { c: "#e11d48", name: "WW", emblem: "◈" },
    ];
    for (let i = 0; i < heroes.length; i++) {
      const a = t * 1.1 + (i / heroes.length) * Math.PI * 2;
      const r = 85 + Math.sin(t * 2 + i) * 12;
      const x = w / 2 + Math.cos(a) * r;
      const y = h / 2 + Math.sin(a) * r * 0.55;
      // Glow
      const glow = ctx.createRadialGradient(x, y, 2, x, y, 28);
      glow.addColorStop(0, heroes[i].c);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 28, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.fillStyle = heroes[i].c;
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 14px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(heroes[i].emblem, x, y + 5);
      ctx.font = "bold 10px system-ui";
      ctx.fillText(heroes[i].name, x, y + 34);
    }
    ctx.textAlign = "left";
    // Center portal / A
    const pulse = 28 + Math.sin(t * 3) * 8;
    ctx.fillStyle = `rgba(254,240,138,${0.2 + Math.sin(t * 4) * 0.1})`;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, pulse + 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1e1b4b";
    ctx.font = "bold 28px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("A", w / 2, h / 2 + 10);
    ctx.textAlign = "left";
    // Energy beams between heroes
    ctx.strokeStyle = "rgba(254,240,138,0.25)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < heroes.length; i++) {
      const a = t * 1.1 + (i / heroes.length) * Math.PI * 2;
      const r = 85 + Math.sin(t * 2 + i) * 12;
      const x = w / 2 + Math.cos(a) * r;
      const y = h / 2 + Math.sin(a) * r * 0.55;
      ctx.beginPath();
      ctx.moveTo(w / 2, h / 2);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    _cinRoundRect(ctx, 10, 8, 250, 36, 8);
    ctx.fill();
    ctx.fillStyle = "#e9d5ff";
    ctx.font = "bold 20px system-ui";
    ctx.fillText("Avengers · 4K+ PRO", 22, 32);
    ctx.fillStyle = "#fff";
    ctx.font = "13px system-ui";
    ctx.fillText("assemble!", 130, 32);

  } else {
    // ═══ TERMINATOR 2 poster look (Iron Man rocket TV / Michael 4K room) ═══
    // Matches classic T2 poster: leather jacket, shades, shotgun, motorcycle
    const img = state._terminatorPoster;
    const hasImg = img && img.complete && img.naturalWidth > 0;

    // Dark blue-black cinematic wash (poster palette)
    ctx.fillStyle = _cinGrad(ctx, 0, 0, w * 0.3, h, [
      [0, "#020617"], [0.45, "#0c1929"], [1, "#020617"],
    ]);
    ctx.fillRect(0, 0, w, h);

    if (hasImg) {
      // Ken Burns: slow zoom + drift on the poster
      const zoom = 1.08 + Math.sin(t * 0.35) * 0.04;
      const panX = Math.sin(t * 0.22) * 18;
      const panY = Math.cos(t * 0.18) * 10;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      // Cover fit
      const scale = Math.max(w / iw, h / ih) * zoom;
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (w - dw) / 2 + panX;
      const dy = (h - dh) / 2 + panY;
      ctx.drawImage(img, dx, dy, dw, dh);
      // Cool blue grade over poster
      ctx.fillStyle = "rgba(15, 40, 80, 0.18)";
      ctx.fillRect(0, 0, w, h);
      // Soft vignette like theatrical poster
      const vig = ctx.createRadialGradient(w * 0.45, h * 0.4, h * 0.15, w * 0.5, h * 0.5, h * 0.75);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    } else {
      // Fallback poster recreation if image not loaded yet
      // Motorcycle chrome bars
      const mx = w * 0.5;
      const my = h * 0.62;
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(mx - 160, my + 40);
      ctx.quadraticCurveTo(mx - 40, my - 30, mx + 40, my - 10);
      ctx.quadraticCurveTo(mx + 120, my + 10, mx + 180, my + 50);
      ctx.stroke();
      // Handlebars
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(mx - 90, my - 20);
      ctx.lineTo(mx + 100, my - 5);
      ctx.stroke();
      // Headlight
      const hl = ctx.createRadialGradient(mx - 100, my + 30, 4, mx - 100, my + 30, 40);
      hl.addColorStop(0, "#f8fafc");
      hl.addColorStop(0.3, "#94a3b8");
      hl.addColorStop(1, "rgba(30,41,59,0)");
      ctx.fillStyle = hl;
      ctx.beginPath();
      ctx.arc(mx - 100, my + 30, 40, 0, Math.PI * 2);
      ctx.fill();
      // Leather jacket body
      ctx.fillStyle = _cinGrad(ctx, mx - 80, my - 160, mx + 80, my + 40, [
        [0, "#3f3f46"], [0.5, "#1c1917"], [1, "#0c0a09"],
      ]);
      _cinRoundRect(ctx, mx - 70, my - 140, 140, 180, 16);
      ctx.fill();
      // Collar
      ctx.fillStyle = "#292524";
      ctx.beginPath();
      ctx.moveTo(mx - 50, my - 120);
      ctx.lineTo(mx - 15, my - 155);
      ctx.lineTo(mx - 5, my - 100);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(mx + 50, my - 120);
      ctx.lineTo(mx + 15, my - 155);
      ctx.lineTo(mx + 5, my - 100);
      ctx.closePath();
      ctx.fill();
      // Head
      ctx.fillStyle = "#e8b89a";
      ctx.beginPath();
      ctx.arc(mx, my - 175, 42, 0, Math.PI * 2);
      ctx.fill();
      // Sunglasses
      ctx.fillStyle = "#0a0a0a";
      _cinRoundRect(ctx, mx - 34, my - 188, 68, 18, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(148,163,184,0.35)";
      ctx.fillRect(mx - 30, my - 185, 28, 10);
      ctx.fillRect(mx + 4, my - 185, 28, 10);
      // Shotgun over shoulder
      ctx.save();
      ctx.translate(mx - 55, my - 150);
      ctx.rotate(-0.55);
      ctx.fillStyle = "#1c1917";
      ctx.fillRect(0, 0, 18, 160);
      ctx.fillStyle = "#44403c";
      ctx.fillRect(2, -10, 14, 40);
      ctx.fillStyle = "#a8a29e";
      ctx.fillRect(5, 150, 8, 30);
      ctx.restore();
      // Arms on bars
      ctx.strokeStyle = "#1c1917";
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.moveTo(mx - 40, my - 40);
      ctx.lineTo(mx - 90, my - 15);
      ctx.moveTo(mx + 40, my - 40);
      ctx.lineTo(mx + 95, my - 5);
      ctx.stroke();
    }

    // Top credit — SCHWARZENEGGER style metal red
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = `bold ${Math.floor(w * 0.045)}px Impact, system-ui, sans-serif`;
    ctx.letterSpacing = "6px";
    const topY = h * 0.09;
    ctx.fillStyle = _cinGrad(ctx, w * 0.2, topY - 30, w * 0.8, topY + 10, [
      [0, "#7f1d1d"], [0.5, "#fecaca"], [1, "#7f1d1d"],
    ]);
    // letter-spacing not always supported — manual spacing
    const credit = "SCHWARZENEGGER";
    ctx.font = `bold ${Math.floor(w * 0.042)}px system-ui, sans-serif`;
    ctx.shadowColor = "rgba(248,113,113,0.6)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#fca5a5";
    ctx.fillText(credit, w / 2, topY);
    ctx.shadowBlur = 0;
    ctx.fillStyle = _cinGrad(ctx, w * 0.25, topY - 24, w * 0.75, topY, [
      [0, "#450a0a"], [0.5, "#fda4af"], [1, "#450a0a"],
    ]);
    ctx.fillText(credit, w / 2, topY);

    // Bottom titles — TERMINATOR 2 / JUDGMENT DAY
    const titleY = h * 0.88;
    ctx.font = `bold ${Math.floor(w * 0.055)}px system-ui, sans-serif`;
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#f8fafc";
    ctx.fillText("TERMINATOR 2", w / 2, titleY);
    ctx.font = `bold ${Math.floor(w * 0.038)}px system-ui, sans-serif`;
    ctx.fillStyle = "#fde68a";
    ctx.fillText("JUDGMENT DAY", w / 2, titleY + h * 0.05);
    ctx.shadowBlur = 0;

    // Gold underline like poster
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.28, titleY + 8);
    ctx.lineTo(w * 0.72, titleY + 8);
    ctx.stroke();

    // Subtle film grain flicker
    if (Math.random() < 0.5) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Iron Man rocket TV corner badge
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    _cinRoundRect(ctx, 14, h - 48, 260, 34, 8);
    ctx.fill();
    ctx.fillStyle = "#7dd3fc";
    ctx.font = "bold 13px system-ui";
    ctx.fillText("IRON MAN ROCKET · CH 4", 24, h - 26);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "11px system-ui";
    ctx.fillText("Terminator 2 poster · 4K+ PRO", 24, h - 12);

    // Timestamp like poster UI (animated clock)
    const mins = Math.floor(t / 60) % 60;
    const secs = Math.floor(t) % 60;
    const clock = `2:${String(17 + (mins % 3)).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    _cinRoundRect(ctx, w - 120, h - 40, 106, 26, 6);
    ctx.fill();
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px monospace";
    ctx.fillText(clock, w - 22, h - 22);
    ctx.textAlign = "left";
    ctx.restore();
  }
  ctx.restore();

  // 4K+ PRO post: soft film grain, vignette, badge
  ctx.fillStyle = "rgba(0,0,0,0.04)";
  for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);
  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.8);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  if (Math.random() < 0.04) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    ctx.fillRect(0, 0, w, h);
  }
  // 4K+ PRO badge
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  _cinRoundRect(ctx, w - 118, h - 32, 108, 24, 6);
  ctx.fill();
  ctx.fillStyle = "#fde68a";
  ctx.font = "bold 12px system-ui";
  ctx.fillText("4K+ PRO REAL", w - 110, h - 15);
}

/** Draw rocket cinema HUD (high-res 4K+ PRO) */
function drawRocketCinemaFrame(dt) {
  // Always advance shared show clock a bit for garage TV
  state.cinemaT = (state.cinemaT || 0) + dt;
  const t = state.cinemaT;

  // Michael's in-garage 4K TV (always on)
  if (state.michaelTv && state.michaelTv.canvas) {
    const tv = state.michaelTv;
    tv.t = t;
    // Cycle shows every ~18s when not focused on rocket cinema
    if (!state.cinemaOpen) {
      const cycle = ["spiderman", "toystory", "avengers", "terminator"];
      tv.show = cycle[Math.floor(t / 18) % cycle.length];
    } else {
      tv.show = state.cinemaShow || "spiderman";
    }
    const tctx = tv.canvas.getContext("2d");
    draw4KShowInto(tctx, tv.canvas.width, tv.canvas.height, tv.show, t);
    if (tv.tex) tv.tex.needsUpdate = true;
  }

  if (!state.cinemaOpen) return;
  const canvas = $("cinema-canvas");
  if (!canvas) return;
  // True HD internal resolution for sharp 4K+ look when scaled
  if (canvas.width < 1280) {
    canvas.width = 1280;
    canvas.height = 720;
  }
  const ctx = canvas.getContext("2d");
  // Image smoothing for scaled output
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  draw4KShowInto(ctx, canvas.width, canvas.height, state.cinemaShow || "spiderman", t);
}

const ROCKET_SKINS = {
  red: {
    name: "Red Iron Man",
    body: 0xb91c1c,
    dark: 0x7f1d1d,
    hi: 0xef4444,
    gold: 0xfbbf24,
    goldDark: 0xb45309,
  },
  white: {
    name: "White Rocket",
    body: 0xf8fafc,
    dark: 0xcbd5e1,
    hi: 0xffffff,
    gold: 0x94a3b8,
    goldDark: 0x64748b,
  },
  purple: {
    name: "Purple Rocket",
    body: 0x7c3aed,
    dark: 0x5b21b6,
    hi: 0xa78bfa,
    gold: 0xe9d5ff,
    goldDark: 0xc084fc,
  },
};

/** Electrocute / transform Iron Man rocket color skin */
function transformIronManRocket(skinId) {
  if (!isInIronManRocket()) {
    toast("Must be in the Iron Man rocket to transform!", "");
    return;
  }
  const skin = ROCKET_SKINS[skinId];
  if (!skin) return;
  const v = state.vehicle;
  if (!v?.group) return;

  // Cache original materials once
  if (!v._matCache) {
    v._matCache = [];
    v.group.traverse((obj) => {
      if (obj.isMesh && obj.material && obj.material.color) {
        v._matCache.push({
          mesh: obj,
          hex: obj.material.color.getHex(),
          emissive: obj.material.emissive ? obj.material.emissive.getHex() : null,
        });
      }
    });
  }

  // Electric zap VFX
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.35 + Math.random() * 0.4),
      new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0x38bdf8 : 0xa5f3fc })
    );
    const wp = v.group.position.clone();
    wp.x += (Math.random() - 0.5) * 4;
    wp.y += Math.random() * 3;
    wp.z += (Math.random() - 0.5) * 5;
    m.position.copy(wp);
    m.rotation.set(Math.random(), Math.random(), Math.random());
    scene.add(m);
    particles.push({
      mesh: m,
      life: 0.35 + Math.random() * 0.25,
      max: 0.6,
      vel: new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6),
      type: "spark",
    });
  }
  playTone(180, 0.08, "sawtooth", 0.12);
  playTone(420, 0.12, "square", 0.08);
  playNoise({ dur: 0.2, freq: 2500, amp: 0.4, vol: 0.25, decay: 1.5, filter: "highpass" });

  // Recolor meshes by original hue buckets
  let i = 0;
  v.group.traverse((obj) => {
    if (!obj.isMesh || !obj.material || !obj.material.color) return;
    const orig = v._matCache[i++];
    if (!orig) return;
    const h = orig.hex;
    // Rough classify original reds vs golds vs blacks
    const r = (h >> 16) & 255;
    const g = (h >> 8) & 255;
    const b = h & 255;
    if (r > 150 && g < 100 && b < 100) {
      obj.material.color.setHex(skin.body);
    } else if (r > 100 && g < 80 && b < 80) {
      obj.material.color.setHex(skin.dark);
    } else if (r > 180 && g > 140 && b < 100) {
      obj.material.color.setHex(skin.gold);
      if (obj.material.emissive) obj.material.emissive.setHex(skin.goldDark);
    } else if (r > 200 && g > 180 && b > 100) {
      obj.material.color.setHex(skin.gold);
    } else if (r > 200 && g > 50 && b < 80) {
      obj.material.color.setHex(skin.hi);
    }
    // leave glass / arc / chrome mostly alone
  });

  v.skinId = skinId;
  toast(`⚡ ELECTRO TRANSFORM → ${skin.name}!`, "reward");
  playerSay(skinId === "white" ? "White rocket mode!" : skinId === "purple" ? "Purple rocket mode!" : "Iron Man red!");
}

const crashingCraft = []; // unpiloted planes falling / exploding
const crashFires = []; // big lasting wreck fires after crash

/** One rising smoke puff (dark / grey) */
function spawnSmokePuff(pos, size = 1, speed = 1) {
  const s = size * (0.7 + Math.random() * 0.8);
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(s, 7, 6),
    new THREE.MeshBasicMaterial({
      color: Math.random() > 0.45 ? 0x2a2a2a : 0x555555,
      transparent: true,
      opacity: 0.55 + Math.random() * 0.25,
      depthWrite: false,
    })
  );
  m.position.copy(pos);
  m.position.x += (Math.random() - 0.5) * 1.2 * size;
  m.position.y += 0.3 + Math.random() * 0.8;
  m.position.z += (Math.random() - 0.5) * 1.2 * size;
  scene.add(m);
  particles.push({
    mesh: m,
    life: 2.2 + Math.random() * 2.5,
    max: 4.5,
    vel: new THREE.Vector3(
      (Math.random() - 0.5) * 1.4 * speed,
      1.6 + Math.random() * 2.4 * speed,
      (Math.random() - 0.5) * 1.4 * speed
    ),
    type: "smoke",
    grow: 1.8 + Math.random() * 1.4,
  });
}

/** Flying ember / flame chunk */
function spawnFireEmber(pos, big = false) {
  const colors = [0xff2200, 0xff5500, 0xff8800, 0xffcc00, 0xffffff, 0xff3300];
  const c = colors[(Math.random() * colors.length) | 0];
  const sz = (big ? 0.22 : 0.1) + Math.random() * (big ? 0.45 : 0.22);
  const m = new THREE.Mesh(
    Math.random() > 0.4
      ? new THREE.SphereGeometry(sz, 5, 4)
      : new THREE.BoxGeometry(sz, sz * 1.4, sz),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95 })
  );
  m.position.copy(pos);
  m.position.x += (Math.random() - 0.5) * 2;
  m.position.y += Math.random() * 1.5;
  m.position.z += (Math.random() - 0.5) * 2;
  scene.add(m);
  particles.push({
    mesh: m,
    life: 0.8 + Math.random() * 1.1,
    max: 1.8,
    vel: new THREE.Vector3(
      (Math.random() - 0.5) * (big ? 22 : 12),
      5 + Math.random() * (big ? 16 : 10),
      (Math.random() - 0.5) * (big ? 22 : 12)
    ),
    type: "spark",
  });
}

/**
 * Big lasting crash fire: tall layered flames + thick smoke column + orange light.
 * Burns for many seconds so you can walk up and see it.
 */
function spawnCrashFire(pos, power = 1) {
  const group = new THREE.Group();
  group.position.copy(pos);
  group.position.y = pos.y;

  // Ground scorch mark
  const scorch = new THREE.Mesh(
    new THREE.CircleGeometry(2.8 * power, 16),
    new THREE.MeshBasicMaterial({
      color: 0x1a0a00,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    })
  );
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.y = 0.04;
  group.add(scorch);

  // Multiple flame pillars (outer orange → mid yellow → white core)
  const flames = [];
  const flameSpecs = [
    { x: 0, z: 0, s: 1.35 * power, h: 3.6 * power },
    { x: 1.1, z: 0.4, s: 0.95 * power, h: 2.8 * power },
    { x: -0.9, z: 0.7, s: 1.05 * power, h: 3.1 * power },
    { x: 0.35, z: -1.0, s: 0.85 * power, h: 2.5 * power },
    { x: -0.5, z: -0.6, s: 0.75 * power, h: 2.2 * power },
    { x: 0.7, z: 1.1, s: 0.7 * power, h: 2.0 * power },
  ];
  for (const sp of flameSpecs) {
    const pillar = new THREE.Group();
    pillar.position.set(sp.x, 0, sp.z);
    const outer = new THREE.Mesh(
      new THREE.ConeGeometry(sp.s * 0.55, sp.h, 7),
      new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.88, depthWrite: false })
    );
    outer.position.y = sp.h * 0.45;
    const mid = new THREE.Mesh(
      new THREE.ConeGeometry(sp.s * 0.32, sp.h * 0.85, 6),
      new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.92, depthWrite: false })
    );
    mid.position.y = sp.h * 0.42;
    const core = new THREE.Mesh(
      new THREE.ConeGeometry(sp.s * 0.14, sp.h * 0.55, 5),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false })
    );
    core.position.y = sp.h * 0.32;
    // Soft glow ball at base of each pillar
    const baseGlow = new THREE.Mesh(
      new THREE.SphereGeometry(sp.s * 0.55, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.45, depthWrite: false })
    );
    baseGlow.position.y = 0.35 * power;
    baseGlow.scale.y = 0.55;
    pillar.add(outer, mid, core, baseGlow);
    group.add(pillar);
    flames.push({ pillar, outer, mid, core, baseGlow, baseH: sp.h, phase: Math.random() * Math.PI * 2 });
  }

  // Big ambient fire glow (visible from far)
  const bigGlow = new THREE.Mesh(
    new THREE.SphereGeometry(3.2 * power, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.22, depthWrite: false })
  );
  bigGlow.position.y = 1.5 * power;
  group.add(bigGlow);

  // Orange point light for the blaze
  const light = new THREE.PointLight(0xff6622, 3.5 * power, 38 * power, 1.6);
  light.position.set(0, 2.2 * power, 0);
  group.add(light);

  scene.add(group);
  crashFires.push({
    group,
    flames,
    scorch,
    bigGlow,
    light,
    life: 16 + Math.random() * 6, // burn ~16–22s
    maxLife: 20,
    power,
    smokeCd: 0,
    emberCd: 0,
  });
}

function updateCrashFires(dt) {
  for (let i = crashFires.length - 1; i >= 0; i--) {
    const f = crashFires[i];
    f.life -= dt;
    const t = state.elapsed;
    const fade = Math.max(0, Math.min(1, f.life / 4)); // last 4s fade out
    const alive = f.life > 0 ? 1 : 0;

    // Flicker each flame pillar — big living fire
    for (const fl of f.flames) {
      const flick =
        0.78 +
        Math.sin(t * 18 + fl.phase) * 0.14 +
        Math.sin(t * 41 + fl.phase * 2) * 0.1 +
        Math.random() * 0.16;
      const stretch = 0.9 + Math.sin(t * 22 + fl.phase) * 0.18 + Math.random() * 0.28;
      fl.pillar.scale.set(flick * 0.95, stretch, flick * 0.95);
      fl.pillar.rotation.y = Math.sin(t * 3 + fl.phase) * 0.12;
      fl.outer.material.opacity = (0.75 + Math.random() * 0.2) * fade;
      fl.mid.material.opacity = (0.8 + Math.random() * 0.15) * fade;
      fl.core.material.opacity = (0.85 + Math.random() * 0.12) * fade;
      fl.baseGlow.material.opacity = (0.35 + Math.random() * 0.25) * fade;
      // Heat color shift orange ↔ red
      const heat = 0.5 + 0.5 * Math.sin(t * 14 + fl.phase);
      fl.outer.material.color.setHex(heat > 0.55 ? 0xff3300 : 0xff6600);
      fl.mid.material.color.setHex(heat > 0.6 ? 0xffee44 : 0xffaa00);
    }
    if (f.bigGlow) {
      f.bigGlow.scale.setScalar(0.9 + Math.sin(t * 9) * 0.15 + Math.random() * 0.12);
      f.bigGlow.material.opacity = 0.18 * fade * (0.8 + Math.random() * 0.4);
    }
    if (f.light) {
      f.light.intensity = (2.4 + Math.sin(t * 20) * 0.8 + Math.random() * 1.2) * f.power * fade;
      f.light.distance = 32 * f.power;
    }
    if (f.scorch) f.scorch.material.opacity = 0.55 * Math.min(1, f.life / 2 + 0.3);

    // Continuous thick smoke column
    f.smokeCd -= dt;
    if (f.smokeCd <= 0 && f.life > 1.5 && particles.length < 220) {
      f.smokeCd = 0.07 + Math.random() * 0.08;
      const p = f.group.position.clone();
      p.y += 1.2 + Math.random() * 1.5;
      p.x += (Math.random() - 0.5) * 2.2 * f.power;
      p.z += (Math.random() - 0.5) * 2.2 * f.power;
      spawnSmokePuff(p, 1.4 * f.power + Math.random() * 0.8, 1.1);
      // Extra tall plume puffs
      if (Math.random() < 0.45) {
        const p2 = p.clone();
        p2.y += 1.5;
        spawnSmokePuff(p2, 1.8 * f.power, 1.35);
      }
    }

    // Sparks / embers popping out of the blaze
    f.emberCd -= dt;
    if (f.emberCd <= 0 && f.life > 2 && particles.length < 200) {
      f.emberCd = 0.05 + Math.random() * 0.1;
      const ep = f.group.position.clone();
      ep.y += 0.8 + Math.random() * 2.2;
      spawnFireEmber(ep, Math.random() > 0.65);
    }

    if (f.life <= 0) {
      scene.remove(f.group);
      f.group.traverse((ch) => {
        if (ch.geometry) ch.geometry.dispose();
        if (ch.material) ch.material.dispose();
      });
      crashFires.splice(i, 1);
    }
  }
}

function explodeAt(pos, big = true) {
  const power = big ? 1.35 : 0.85;
  // Initial BOOM flash
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(2.8 * power, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffeeaa, transparent: true, opacity: 0.9, depthWrite: false })
  );
  flash.position.copy(pos);
  flash.position.y += 1.2;
  scene.add(flash);
  particles.push({
    mesh: flash,
    life: 0.35,
    max: 0.35,
    vel: new THREE.Vector3(0, 1.5, 0),
    type: "flash",
    grow: 2.8,
  });

  // Ring of secondary fireballs
  for (let i = 0; i < (big ? 8 : 4); i++) {
    const ang = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
    const r = 1.2 + Math.random() * 1.8;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.5 + Math.random() * 0.7, 8, 6),
      new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? 0xff5500 : 0xffaa00,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    ball.position.set(pos.x + Math.cos(ang) * r, pos.y + 0.6 + Math.random(), pos.z + Math.sin(ang) * r);
    scene.add(ball);
    particles.push({
      mesh: ball,
      life: 0.55 + Math.random() * 0.4,
      max: 1,
      vel: new THREE.Vector3(Math.cos(ang) * 6, 4 + Math.random() * 6, Math.sin(ang) * 6),
      type: "spark",
    });
  }

  // Flying debris + fire chunks
  const n = big ? 48 : 22;
  for (let i = 0; i < n; i++) spawnFireEmber(pos, true);

  // Debris metal pieces
  for (let i = 0; i < (big ? 18 : 8); i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.2 + Math.random() * 0.55, 0.08 + Math.random() * 0.25, 0.2 + Math.random() * 0.55),
      new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0x444444 : 0x888888 })
    );
    m.position.copy(pos);
    m.position.y += 0.5;
    scene.add(m);
    particles.push({
      mesh: m,
      life: 1.2 + Math.random() * 1.2,
      max: 2.2,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        6 + Math.random() * 14,
        (Math.random() - 0.5) * 20
      ),
      type: "spark",
    });
  }

  // Massive smoke burst on impact
  for (let i = 0; i < (big ? 22 : 10); i++) {
    const p = pos.clone();
    p.y += 0.5 + Math.random() * 2;
    spawnSmokePuff(p, 1.5 + Math.random() * 1.8, 1.4 + Math.random());
  }
  // Black mushroom cloud
  for (let i = 0; i < (big ? 10 : 4); i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(1.4 + Math.random() * 1.6, 8, 6),
      new THREE.MeshBasicMaterial({
        color: 0x1a1a1a,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      })
    );
    m.position.copy(pos);
    m.position.y += 2 + i * 0.6;
    m.position.x += (Math.random() - 0.5) * 2;
    m.position.z += (Math.random() - 0.5) * 2;
    scene.add(m);
    particles.push({
      mesh: m,
      life: 3 + Math.random() * 2,
      max: 5,
      vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, 3.5 + Math.random() * 2, (Math.random() - 0.5) * 1.5),
      type: "smoke",
      grow: 2.2,
    });
  }

  // Leave a BIG lasting fire at the crash site
  spawnCrashFire(pos, power);

  playNoise({ dur: 0.45, freq: 160, amp: 0.95, vol: 0.65, decay: 1.8, filter: "lowpass" });
  playTone(70, 0.45, "sawtooth", 0.2);
  playTone(45, 0.6, "square", 0.12);
}

function respawnHangarCraft(type) {
  const slot = state.hangarSlots?.[type];
  if (!slot) return null;
  // Remove any leftover parked craft of same type at hangar
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i];
    if (v.type === type && !v.occupied && !v.crashing) {
      const dx = v.group.position.x - slot.x;
      const dz = v.group.position.z - slot.z;
      if (dx * dx + dz * dz < 25) {
        scene.remove(v.group);
        vehicles.splice(i, 1);
      }
    }
  }
  let nv = null;
  if (type === "ironman") {
    nv = spawnIronManRocket(slot.x, slot.z);
    if (nv) nv.locked = false;
  } else if (type === "rocket") {
    nv = spawnRocket(slot.x, 0, slot.z);
  } else if (type === "airplane") {
    nv = spawnAirplane(slot.x, slot.z);
  } else if (type === "jet") {
    nv = spawnJet(slot.x, slot.z);
    if (nv) {
      nv.locked = false;
      nv.price = 0;
      if (nv.priceTag) nv.priceTag.visible = false;
    }
  }
  if (nv) {
    nv.hangarKey = type;
    toast(`✨ New ${type} ready at the hangar!`, "reward");
  }
  return nv;
}

function updateCrashingCraft(dt) {
  for (let i = crashingCraft.length - 1; i >= 0; i--) {
    const v = crashingCraft[i];
    if (!v || !v.group) {
      crashingCraft.splice(i, 1);
      continue;
    }
    v.vel = v.vel || new THREE.Vector3();
    v.vel.y -= 28 * dt;
    v.vel.x *= 1 - 0.3 * dt;
    v.vel.z *= 1 - 0.3 * dt;
    v.group.position.x += v.vel.x * dt;
    v.group.position.y += v.vel.y * dt;
    v.group.position.z += v.vel.z * dt;
    // Spin while falling
    v.group.rotation.x += dt * 1.8;
    v.group.rotation.z += dt * 2.4;
    v.group.rotation.y += dt * 0.9;

    // Smoke + fire trail while diving
    v._crashTrailCd = (v._crashTrailCd || 0) - dt;
    if (v._crashTrailCd <= 0 && particles.length < 200) {
      v._crashTrailCd = 0.06;
      const p = v.group.position.clone();
      spawnSmokePuff(p, 1.1, 0.9);
      if (Math.random() < 0.55) spawnFireEmber(p, false);
      // On-fire look: light engine flames if present
      if (v.fires) {
        for (const f of v.fires) {
          if (f.group) f.group.visible = true;
        }
      }
    }

    const gy = walkHeight(v.group.position.x, v.group.position.z);
    if (v.group.position.y <= gy + 0.8) {
      // BIG BOOM — fire + smoke stays burning
      const boomPos = v.group.position.clone();
      boomPos.y = gy + 0.35;
      explodeAt(boomPos, true);
      toast("💥 Crash! Big fire and smoke!", "kill");
      const type = v.type;
      scene.remove(v.group);
      const vi = vehicles.indexOf(v);
      if (vi >= 0) vehicles.splice(vi, 1);
      crashingCraft.splice(i, 1);
      // Respawn same type at hangar (new jet/plane/rocket)
      setTimeout(() => respawnHangarCraft(type), 1200);
    }
  }
}

function exitVehicle() {
  if (!state.vehicle) return;
  closeRocketCinema();
  const v = state.vehicle;
  // Get out of the seat first (avatar back to world)
  unseatPlayerFromCraft();
  v.occupied = false;
  if (v.flame) v.flame.visible = false;
  if (v.flameMid) v.flameMid.visible = false;
  if (v.flameInner) v.flameInner.visible = false;
  if (v.flameGlow) v.flameGlow.visible = false;
  if (v.pilot) v.pilot.visible = false;
  const exit = v.group.position.clone();
  const airExit = (v.type === "rocket" || v.type === "jet" || v.type === "airplane") &&
    v.group.position.y > walkHeight(v.group.position.x, v.group.position.z) + 8;
  if (v.type === "rocket" || v.type === "jet" || v.type === "airplane") {
    if (airExit) {
      // Jump out with parachute — craft falls and will explode
      exit.x += 2.5;
      exit.y = v.group.position.y - 0.5;
      exit.z += 1;
      player.fallPeakY = exit.y;
      player.parachuting = true;
      player.camDistTarget = Math.max(player.camDistTarget, 6);
      player.vel.set(0, -2, 0);
      // Unpiloted dive to ground
      v.crashing = true;
      v.vel = new THREE.Vector3(
        -Math.sin(v.yaw) * Math.max(6, v.speed * 0.4),
        -4,
        -Math.cos(v.yaw) * Math.max(6, v.speed * 0.4)
      );
      v.speed = 0;
      crashingCraft.push(v);
      toast("🪂 Jumped out! Craft is going down — parachute open!", "reward");
    } else {
      const parkY = Math.max(0, groundY(v.group.position.x, v.group.position.z)) +
        (v.type === "jet" || v.type === "airplane" ? 0.75 : 0.55);
      exit.x += 2.8;
      exit.y = walkHeight(exit.x, exit.z) + 0.5;
      player.vel.set(0, 0, 0);
      v.group.position.y = parkY;
      v.group.rotation.order = "YXZ";
      v.group.rotation.x = -0.08;
      v.group.rotation.z = 0;
      if (v.vel) v.vel.set(0, 0, 0);
      v.speed = 0;
      v.pitch = 0;
    }
  } else if (v.type === "boat") {
    exit.x += 2.5;
    exit.z += 1;
    exit.y = WATER_SURFACE + 0.5;
    v.speed = 0;
    player.vel.set(0, 0, 0);
  } else {
    exit.x += Math.cos(v.yaw) * 2.5;
    exit.z += Math.sin(v.yaw) * 2.5;
    exit.y = walkHeight(exit.x, exit.z) + 0.5;
    player.vel.set(0, 0, 0);
  }
  player.pos.copy(exit);
  state.inVehicle = false;
  state.vehicle = null;
  weaponGroup.visible = false;
  $("speedo").classList.add("hidden");
  const unit = document.querySelector(".speed-unit");
  if (unit) unit.textContent = "KM/H";
  if (state.racing) endRace(false);
}

function startRace() {
  // Foot race or any vehicle (cars removed — rockets / on foot OK)
  if (state.vehicle?.type === "rocket") {
    toast("Land first — race on foot or exit rocket (E)!", "");
    return;
  }
  state.racing = true;
  state.raceCheckpoint = 0;
  state.raceStartTime = 0;
  setMode("RACE");
  $("race-hud").classList.remove("hidden");
  updateRaceHUD();

  // Highlight first CP
  state.raceCheckpoints.forEach((cp, i) => {
    cp.mesh.material.opacity = i === 0 ? 0.95 : 0.25;
  });

  // Countdown
  const cd = $("race-countdown");
  cd.classList.remove("hidden");
  let n = 3;
  cd.textContent = "3";
  const tick = () => {
    n--;
    if (n > 0) {
      cd.textContent = String(n);
      cd.style.animation = "none";
      void cd.offsetWidth;
      cd.style.animation = "";
      setTimeout(tick, 800);
    } else if (n === 0) {
      cd.textContent = "GO!";
      state.raceStartTime = performance.now();
      setTimeout(() => cd.classList.add("hidden"), 600);
    }
  };
  setTimeout(tick, 800);
  toast("Race started! Hit the golden rings!", "quest");
}

function updateRace(dt) {
  if (!state.racing || !state.raceStartTime) return;
  const cp = state.raceCheckpoints[state.raceCheckpoint];
  if (!cp) return;
  const pos = state.vehicle ? state.vehicle.group.position : player.pos;
  if (pos.distanceTo(cp.mesh.position) < 5) {
    state.raceCheckpoint++;
    progressQuest("checkpoints", 1);
    addXP(10);
    addCoins(15);
    toast(`Checkpoint ${state.raceCheckpoint}/${state.raceCheckpoints.length}!`, "quest");
    if (state.raceCheckpoint >= state.raceCheckpoints.length) {
      endRace(true);
    } else {
      state.raceCheckpoints.forEach((c, i) => {
        c.mesh.material.opacity = i === state.raceCheckpoint ? 0.95 : 0.25;
      });
    }
  }
  updateRaceHUD();
}

function endRace(won) {
  state.racing = false;
  $("race-hud").classList.add("hidden");
  state.raceCheckpoints.forEach((c) => {
    c.mesh.material.opacity = 0.35;
  });
  if (won) {
    const t = (performance.now() - state.raceStartTime) / 1000;
    state.racesWon++;
    const bonus = Math.max(50, Math.floor(300 - t * 5));
    addCoins(bonus);
    addXP(80);
    addGems(2);
    toast(`🏆 RACE WIN! ${t.toFixed(2)}s · +${bonus} coins · +2 gems`, "reward");
    progressQuest("races", 1);
    if (!state.bestRace || t < state.bestRace) state.bestRace = t;
  } else {
    toast("Race cancelled.", "");
  }
  setMode("FREE ROAM");
  updateHUD();
}

function updateRaceHUD() {
  if (!state.raceStartTime) {
    $("race-timer").textContent = "0:00.00";
  } else {
    const t = (performance.now() - state.raceStartTime) / 1000;
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(2).padStart(5, "0");
    $("race-timer").textContent = `${m}:${s}`;
  }
  $("race-checkpoint").textContent = `CHECKPOINT ${state.raceCheckpoint}/${state.raceCheckpoints.length}`;
}

// ─────────────────────────────────────────────────────────────
// PROGRESSION (kids' favorite loops)
// ─────────────────────────────────────────────────────────────
function addXP(n) {
  state.xp += n;
  while (state.xp >= state.xpToNext) {
    state.xp -= state.xpToNext;
    state.level++;
    state.xpToNext = Math.floor(100 * Math.pow(1.25, state.level - 1));
    state.maxHp = 100 + (state.level - 1) * 10;
    state.hp = state.maxHp;
    state.reserve += 30;
    // Unlock flavor
    showLevelUp();
    addGems(1);
    toast(`LEVEL ${state.level}! Max HP up · +1 gem`, "reward");
  }
  updateHUD();
  saveInventoryForever();
}

function addCoins(n) {
  state.coins = Math.max(0, state.coins + n);
  updateHUD();
  saveInventoryForever();
}

function addGems(n) {
  state.gems = Math.max(0, state.gems + n);
  updateHUD();
  saveInventoryForever();
}

function addCombo() {
  state.combo++;
  state.comboTimer = 2.5;
  if (state.combo >= 2) {
    const el = $("combo-display");
    $("combo-num").textContent = state.combo;
    el.classList.remove("hidden");
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  }
}

function showLevelUp() {
  const el = $("levelup-flash");
  el.classList.remove("hidden");
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
  setTimeout(() => el.classList.add("hidden"), 1400);
}

// Quests — always something to chase (cube-style goals + Fortnite challenges)
const quests = [
  { id: "explore", label: "Explore far meadows", target: 1, progress: 0, reward: 60, done: false },
  { id: "build", label: "Place blocks", target: 10, progress: 0, reward: 50, done: false },
  { id: "mine", label: "Mine blocks", target: 15, progress: 0, reward: 50, done: false },
  { id: "gems", label: "Collect crystals", target: 8, progress: 0, reward: 100, done: false },
  { id: "purpleGems", label: "Collect unique purple gems", target: 5, progress: 0, reward: 150, done: false },
  { id: "suit", label: "Buy an Iron Man costume", target: 1, progress: 0, xp: 200, done: false },
  { id: "races", label: "Win a race", target: 1, progress: 0, reward: 150, done: false },
  { id: "checkpoints", label: "Hit race rings", target: 6, progress: 0, reward: 60, done: false },
];

function progressQuest(id, n = 1) {
  const q = quests.find((x) => x.id === id && !x.done);
  if (!q) return;
  q.progress = Math.min(q.target, q.progress + n);
  if (q.progress >= q.target) {
    q.done = true;
    addCoins(q.reward);
    addXP(Math.floor(q.reward / 2));
    toast(`✅ Quest complete: ${q.label} · +${q.reward} coins`, "quest");
    // Soft refresh quest after delay
    setTimeout(() => {
      q.done = false;
      q.progress = 0;
      q.target = Math.ceil(q.target * 1.3);
      q.reward = Math.floor(q.reward * 1.2);
      renderQuests();
      toast(`New quest: ${q.label} (x${q.target})`, "quest");
    }, 4000);
  }
  renderQuests();
}

function renderQuests() {
  const ul = $("quest-list");
  ul.innerHTML = quests
    .filter((q) => !q.done || q.progress > 0)
    .slice(0, 4)
    .map(
      (q) =>
        `<li class="${q.done ? "done" : ""}">${q.label}<span class="q-prog">${q.progress}/${q.target} · ${q.reward}💰</span></li>`
    )
    .join("");
}

// ─────────────────────────────────────────────────────────────
// VFX
// ─────────────────────────────────────────────────────────────
const tracerMat = new THREE.LineBasicMaterial({ color: 0x00f5d4, transparent: true, opacity: 0.85 });
const sparkMatCache = new Map();
function sparkMat(color) {
  let m = sparkMatCache.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    sparkMatCache.set(color, m);
  }
  return m;
}

function spawnTracer(origin, dir) {
  const len = 2.2;
  const geo = new THREE.BufferGeometry().setFromPoints([
    origin,
    origin.clone().addScaledVector(dir, len),
  ]);
  const line = new THREE.Line(geo, tracerMat);
  scene.add(line);
  particles.push({ mesh: line, life: 0.06, max: 0.06, type: "tracer" });
}

function spawnHitSparks(pos, count = 5, color = 0x00f5d4) {
  const n = Math.min(count, 6);
  const mat = sparkMat(color);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(GEO.spark, mat);
    m.position.copy(pos);
    scene.add(m);
    particles.push({
      mesh: m,
      life: 0.25 + Math.random() * 0.15,
      max: 0.4,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        Math.random() * 6,
        (Math.random() - 0.5) * 8
      ),
      type: "spark",
    });
  }
}

function flashCrosshair() {
  const ch = $("crosshair");
  ch.classList.add("hit");
  setTimeout(() => ch.classList.remove("hit"), 80);
}

function toast(msg, type = "") {
  const stack = $("toast-stack");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

/** Turn camera around to face Ron — full character view */
function toggleTurnAround() {
  if (state.inVehicle || player.sleeping) return;
  player.turnAround = !player.turnAround;
  if (player.turnAround) {
    // Zoom out so the whole body is visible
    player.camDistTarget = Math.max(player.camDistTarget, CAM_DIST_DEFAULT_TP);
    player.pitch = Math.min(player.pitch, 0.15);
    toast("🔄 Turn around — full character view (V or middle-click again to exit)", "quest");
  } else {
    toast("Back to normal view", "");
  }
}

// ── In-game calendar (M) — July → December only; starts July 31, 2026 ──
// Sleep (Z) advances one day: July 31 → Aug 1 → … → Dec 31 → next year July 1.
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const CAL_MONTH_START = 7; // July
const CAL_MONTH_END = 12; // December
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const gameDate = {
  year: 2026,
  month: 7, // July
  day: 31, // today
};

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function formatGameDate() {
  return `${MONTH_NAMES[gameDate.month - 1]} ${gameDate.day}, ${gameDate.year}`;
}

/** Advance one day (called when Ron sleeps through the night) */
function advanceGameDay() {
  // Keep date inside July–December range
  if (gameDate.month < CAL_MONTH_START || gameDate.month > CAL_MONTH_END) {
    gameDate.month = CAL_MONTH_START;
    gameDate.day = 1;
  }
  const dim = daysInMonth(gameDate.year, gameDate.month);
  gameDate.day += 1;
  if (gameDate.day > dim) {
    gameDate.day = 1;
    gameDate.month += 1;
    // After December → jump to July next year
    if (gameDate.month > CAL_MONTH_END) {
      gameDate.month = CAL_MONTH_START;
      gameDate.year += 1;
      toast(`🎉 New year ${gameDate.year} — back to July!`, "reward");
    } else {
      toast(`📅 ${MONTH_NAMES[gameDate.month - 1]} ${gameDate.year}`, "quest");
      // December = Nifty Fidget Power bundle season over
      if (gameDate.month === 12) {
        checkNiftyBundleExpiry();
        if (!state.niftyBundleOwned) {
          toast("⏰ Nifty Fidget Power bundle ended with November!", "kill");
        }
      }
    }
  } else {
    // Same month — show the new day (July 31 → Aug path, etc.)
    toast(`📅 ${formatGameDate()}`, "quest");
  }
  checkNiftyBundleExpiry();
  if (state.calendarOpen) renderCalendar();
  updateCalendarHud();
}

function updateCalendarHud() {
  const big = $("cal-date-big");
  const y = $("cal-year");
  if (big) big.textContent = formatGameDate();
  if (y) y.textContent = String(gameDate.year);
  const btn = $("calendar-btn");
  if (btn && !state.calendarOpen) {
    btn.title = `Calendar (M) — ${formatGameDate()}`;
  }
}

function renderCalendar() {
  const host = $("cal-months");
  if (!host) return;
  updateCalendarHud();
  host.innerHTML = "";

  // Only July through December
  for (let m = CAL_MONTH_START; m <= CAL_MONTH_END; m++) {
    const box = document.createElement("div");
    box.className = "cal-month" + (m === gameDate.month ? " current-month" : "");
    const name = document.createElement("div");
    name.className = "cal-month-name";
    name.textContent = MONTH_NAMES[m - 1];
    box.appendChild(name);

    const grid = document.createElement("div");
    grid.className = "cal-days";
    for (const d of DOW) {
      const el = document.createElement("div");
      el.className = "cal-dow";
      el.textContent = d;
      grid.appendChild(el);
    }

    const dim = daysInMonth(gameDate.year, m);
    // JS Date: month is 0-based; day 1 → weekday of first
    const firstDow = new Date(gameDate.year, m - 1, 1).getDay();
    for (let i = 0; i < firstDow; i++) {
      const empty = document.createElement("div");
      empty.className = "cal-day empty";
      grid.appendChild(empty);
    }
    for (let d = 1; d <= dim; d++) {
      const cell = document.createElement("div");
      cell.className = "cal-day";
      cell.textContent = String(d);
      const isToday = m === gameDate.month && d === gameDate.day;
      const isPast =
        m < gameDate.month || (m === gameDate.month && d < gameDate.day);
      if (isToday) cell.classList.add("today");
      else if (isPast) cell.classList.add("past");
      grid.appendChild(cell);
    }
    box.appendChild(grid);
    host.appendChild(box);
  }
}

function toggleCalendar() {
  if (!state.started) return;
  state.calendarOpen = !state.calendarOpen;
  const panel = $("calendar-panel");
  const btn = $("calendar-btn");
  if (!panel) return;
  if (state.calendarOpen) {
    // Free mouse to use calendar
    if (document.pointerLockElement) document.exitPointerLock();
    state.paused = true; // soft pause while calendar open
    panel.classList.remove("hidden");
    btn?.classList.add("open");
    renderCalendar();
  } else {
    panel.classList.add("hidden");
    btn?.classList.remove("open");
    // Unpause if only calendar had paused (not ESC pause menu)
    if ($("pause-menu")?.classList.contains("hidden")) {
      state.paused = false;
      state.clock.getDelta();
      canvas.requestPointerLock?.();
    }
  }
}

function closeCalendar() {
  if (!state.calendarOpen) return;
  state.calendarOpen = false;
  $("calendar-panel")?.classList.add("hidden");
  $("calendar-btn")?.classList.remove("open");
  if ($("pause-menu")?.classList.contains("hidden")) {
    state.paused = false;
    state.clock.getDelta();
  }
}

/** True if standing on / in a boat (or any vehicle deck) — no sleeping there */
function isOnBoatOrVehicle() {
  if (state.inVehicle) return true;
  if (player._onVehicleDeck) return true;
  // Near any boat hull — don't allow lie-down sleep on deck
  for (const v of vehicles) {
    if (!v || !v.group) continue;
    if (v.type !== "boat" && v.subtype !== "pirate") continue;
    const d = Math.hypot(player.pos.x - v.group.position.x, player.pos.z - v.group.position.z);
    if (d < 5.5) return true;
  }
  return false;
}

/** Z = sleep — lays down on land only (never on boats) */
function toggleSleep() {
  if (state.climbing || state.onTree) return;
  // Wake is always allowed
  if (player.sleeping) {
    // fall through to wake
  } else if (state.inVehicle || isOnBoatOrVehicle()) {
    toast("No sleeping on the boat — stay awake and sail!", "");
    return;
  }
  if (isInWater(player.pos.x, player.pos.y, player.pos.z)) {
    toast("Can't sleep in the water!", "");
    return;
  }
  // Must be on solid ground to lie down
  if (!player.onGround && !player.sleeping) {
    toast("Stand on the ground to sleep", "");
    return;
  }
  player.sleeping = !player.sleeping;
  const sleepBtn = $("sleep-btn");
  if (player.sleeping) {
    player.vel.set(0, 0, 0);
    player.parachuting = false;
    player.turnAround = false;
    // Snap feet to ground, then he lays down
    player.pos.y = walkHeight(player.pos.x, player.pos.z);
    player.onGround = true;
    player.camDistTarget = Math.max(player.camDistTarget, 5.5);
    player.pitch = 0.2; // look a bit down at sleeping Ron
    player.zzzTimer = 0.3;
    player.snorePhase = 0;
    resumeAudio();
    startPlayerSnoreLoop();
    playerSay("Time to sleep…");
    setTimeout(() => {
      if (player.sleeping) playerSay("Zzz…");
    }, 700);
    toast(
      `😴 Sleeping through ${formatGameDate()}… sun sets 🌙 (Z / ZZZ to wake)`,
      "quest"
    );
    if (sleepBtn) {
      sleepBtn.classList.add("asleep");
      sleepBtn.textContent = "☀️ Wake";
    }
  } else {
    // Stand back up — new day begins
    avatar.rotation.x = 0;
    avatar.rotation.z = 0;
    advanceGameDay();
    playerSay("I'm awake!");
    toast(`☀️ Good morning! It's ${formatGameDate()}`, "reward");
    if (sleepBtn) {
      sleepBtn.classList.remove("asleep");
      sleepBtn.textContent = "😴 ZZZ";
    }
  }
}

function updateSleeping(dt) {
  if (!player.sleeping) return;
  // Don't walk away, but fidget / roll while asleep
  player.vel.set(0, 0, 0);
  player.zzzTimer -= dt;
  player.snorePhase += dt;
  // Tiny position fidget so he "moves around" on the ground
  const fidget = Math.sin(player.snorePhase * 0.7) * 0.012
    + Math.sin(player.snorePhase * 1.9) * 0.008;
  const sideFidget = Math.cos(player.snorePhase * 0.55) * 0.01;
  // Store for avatar pose (yaw wiggle while sleeping)
  player._sleepFidgetX = fidget;
  player._sleepFidgetZ = sideFidget;
  player._sleepRoll = Math.sin(player.snorePhase * 0.4) * 0.12
    + Math.sin(player.snorePhase * 1.3) * 0.05;
  player._sleepToss = Math.sin(player.snorePhase * 0.25) * 0.08; // roll onto other side slowly
  if (player.zzzTimer <= 0) {
    player.zzzTimer = 1.4 + Math.random() * 0.9;
    const zzz = ["Zzz", "Zzz…", "ZZZ", "zZz", "Zzz… 😴", "mmph…", "…zzz"][
      Math.floor(Math.random() * 7)
    ];
    playerSay(zzz);
  }
  // Soft HP regen while sleeping
  if (state.hp < state.maxHp) {
    state.hp = Math.min(state.maxHp, state.hp + 4 * dt);
    if (Math.floor(state.elapsed) % 2 === 0) updateHUD();
  }
}

// ── Player / pirate speech — text bubbles only (no voice) ──
const _speechProj = new THREE.Vector3();

function playerSay(lines) {
  const list = Array.isArray(lines) ? lines.slice() : [lines];
  for (const line of list) {
    state.speechQueue.push({ text: line, who: "player" });
  }
  if (!state.speechShowing) advanceSpeech();
}
function pirateSay(lines) {
  const list = Array.isArray(lines) ? lines.slice() : [lines];
  for (const line of list) {
    state.speechQueue.push({ text: line, who: "pirate" });
  }
  if (!state.speechShowing) advanceSpeech();
}
function advanceSpeech() {
  const bubble = $("speech-bubble");
  if (!bubble) return;
  if (!state.speechQueue.length) {
    bubble.classList.add("hidden");
    bubble.classList.remove("pirate");
    state.speechShowing = false;
    state.speechTimer = 0;
    return;
  }
  const item = state.speechQueue.shift();
  const text = typeof item === "string" ? item : item.text;
  const who = typeof item === "string" ? "player" : item.who || "player";
  state.speechWho = who;
  const label =
    who === "pirate"
      ? "Pirate"
      : who === "michael"
        ? "Michael Builder"
        : state.playerName || "Ron";
  bubble.textContent = `${label}: ${text}`;
  bubble.classList.toggle("pirate", who === "pirate" || who === "michael" || who === "woody");
  bubble.classList.remove("hidden");
  // re-trigger pop animation
  bubble.style.animation = "none";
  void bubble.offsetWidth;
  bubble.style.animation = "";
  state.speechShowing = true;
  // Hold bubble longer for longer lines (text only — no spoken voice)
  state.speechTimer = Math.max(1.4, 0.55 + String(text).length * 0.055);
}
function updateSpeechBubble(dt) {
  const bubble = $("speech-bubble");
  if (!bubble) return;
  if (state.speechShowing) {
    state.speechTimer -= dt;
    if (state.speechTimer <= 0) advanceSpeech();
  }
  if (!state.speechShowing) {
    bubble.classList.add("hidden");
    return;
  }
  // Project above player (Ron) or pirate head
  if (state.speechWho === "pirate") {
    const p = nearestPirate(80) || beachFishers[0];
    if (p && p.root) {
      _speechProj.set(p.root.position.x, p.root.position.y + 3.4, p.root.position.z);
    } else {
      _speechProj.set(player.pos.x, player.pos.y + player.height + 0.35, player.pos.z);
    }
  } else {
    const headY = player.pos.y + player.height + 0.35;
    _speechProj.set(player.pos.x, headY, player.pos.z);
  }
  _speechProj.project(camera);
  const x = (_speechProj.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-_speechProj.y * 0.5 + 0.5) * window.innerHeight;
  // Hide if behind camera
  if (_speechProj.z > 1) {
    bubble.style.opacity = "0";
  } else {
    bubble.style.opacity = "1";
    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
  }
}

// ── Pirate snacks ──
const PIRATE_FOODS = [
  { id: "salmon", name: "Salmon", emoji: "🐟", heal: 28, phrase: "Yum, salmon!" },
  { id: "blueBanana", name: "Blue Banana", emoji: "🔵🍌", heal: 22, phrase: "Mmm, blue banana!" },
  { id: "bar", name: "Bar", emoji: "🍫", heal: 12, phrase: "Chocolate bar!" },
];

/** Realistic detailed blue banana (for eat animation) */
function createDetailedBlueBanana() {
  const g = new THREE.Group();
  // Real banana colors shifted blue
  const matPeel = new THREE.MeshLambertMaterial({ color: 0x3b82f6, flatShading: false });
  const matPeelHi = new THREE.MeshLambertMaterial({ color: 0x60a5fa, flatShading: false });
  const matPeelDark = new THREE.MeshLambertMaterial({ color: 0x1e40af, flatShading: false });
  const matStem = new THREE.MeshLambertMaterial({ color: 0x1e3a2f, flatShading: false });
  const matTip = new THREE.MeshLambertMaterial({ color: 0x172554, flatShading: false });
  const matFlesh = new THREE.MeshLambertMaterial({ color: 0x93c5fd, flatShading: false });
  const matSpot = new THREE.MeshLambertMaterial({ color: 0x1e3a8a, flatShading: false });

  // Curved banana body made of tapered segments
  const segs = 8;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const thick = 0.07 + Math.sin(t * Math.PI) * 0.045;
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(thick, 8, 6),
      i % 2 === 0 ? matPeel : matPeelHi
    );
    const ang = t * 0.85; // classic banana curve
    const y = t * 0.42;
    const z = Math.sin(ang) * 0.12;
    seg.position.set(0, y - 0.05, z);
    seg.scale.set(0.95, 1.15, 1.05);
    g.add(seg);
    // Ridge along edge
    if (i > 0 && i < segs - 1) {
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.02, thick * 1.2, 0.02), matPeelDark);
      ridge.position.set(thick * 0.85, y - 0.05, z);
      g.add(ridge);
    }
  }
  // Stem (where it broke from bunch)
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.08, 12), matStem);
  stem.position.set(0, 0.4, 0.02);
  stem.rotation.x = 0.4;
  g.add(stem);
  const stemCap = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), matStem);
  stemCap.position.set(0, 0.44, 0.04);
  g.add(stemCap);
  // Blossom end tip
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 6), matTip);
  tip.position.set(0, -0.08, 0.02);
  tip.rotation.x = Math.PI;
  g.add(tip);
  // Brownish-blue speckles
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Mesh(new THREE.SphereGeometry(0.012, 4, 4), matSpot);
    const t = 0.15 + i * 0.1;
    sp.position.set((i % 2 ? 0.05 : -0.04), t, 0.06 + Math.sin(i) * 0.02);
    g.add(sp);
  }
  // Peeled flesh strip (shows when biting later)
  const flesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), matFlesh);
  flesh.position.set(0.02, 0.22, 0.08);
  flesh.visible = false;
  flesh.name = "flesh";
  g.add(flesh);

  g.scale.setScalar(1.15);
  return g;
}

/** Detailed realistic bowl of spaghetti & meatballs */
function createDetailedSpaghettiBowl() {
  const g = new THREE.Group();
  g.name = "spaghettiBowl";

  const matBowl = new THREE.MeshStandardMaterial({
    color: 0xf5f0e6, roughness: 0.35, metalness: 0.05, flatShading: false,
  });
  const matBowlRim = new THREE.MeshStandardMaterial({
    color: 0xe8e0d0, roughness: 0.4, metalness: 0.08, flatShading: false,
  });
  const matPasta = new THREE.MeshStandardMaterial({
    color: 0xf0c14a, roughness: 0.7, metalness: 0.0, flatShading: false,
  });
  const matPastaDeep = new THREE.MeshStandardMaterial({
    color: 0xd4a017, roughness: 0.75, metalness: 0.0, flatShading: false,
  });
  const matSauce = new THREE.MeshStandardMaterial({
    color: 0xb91c1c, roughness: 0.55, metalness: 0.0, flatShading: false,
  });
  const matSauceDark = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d, roughness: 0.6, metalness: 0.0, flatShading: false,
  });
  const matMeat = new THREE.MeshStandardMaterial({
    color: 0x78350f, roughness: 0.85, metalness: 0.0, flatShading: false,
  });
  const matMeatHi = new THREE.MeshStandardMaterial({
    color: 0xa16207, roughness: 0.8, metalness: 0.0, flatShading: false,
  });
  const matCheese = new THREE.MeshStandardMaterial({
    color: 0xfef3c7, roughness: 0.9, metalness: 0.0, flatShading: false,
  });
  const matBasil = new THREE.MeshStandardMaterial({
    color: 0x16a34a, roughness: 0.8, metalness: 0.0, flatShading: false,
  });
  const matFork = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1, roughness: 0.25, metalness: 0.85, flatShading: false,
  });

  // Ceramic bowl
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.18, 14), matBowl);
  bowl.position.y = 0.09;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 16), matBowlRim);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.17;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.04, 12), matBowlRim);
  base.position.y = 0.02;
  g.add(bowl, rim, base);

  // Sauce mound
  const sauce = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), matSauce);
  sauce.position.y = 0.2;
  sauce.scale.set(1.15, 0.55, 1.15);
  sauce.name = "sauce";
  g.add(sauce);
  const sauceGloss = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), matSauceDark);
  sauceGloss.position.set(0.06, 0.26, -0.04);
  sauceGloss.scale.set(1, 0.5, 1);
  g.add(sauceGloss);

  // Noodle strands (curved box strips / torus segments)
  const noodleRoot = new THREE.Group();
  noodleRoot.name = "noodles";
  noodleRoot.position.y = 0.22;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r = 0.06 + (i % 4) * 0.03;
    const n = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.22 + (i % 3) * 0.06, 5),
      i % 2 ? matPasta : matPastaDeep
    );
    n.position.set(Math.cos(a) * r, 0.02 + (i % 5) * 0.015, Math.sin(a) * r);
    n.rotation.z = Math.cos(a) * 0.9 + (i % 3) * 0.2;
    n.rotation.x = Math.sin(a * 1.3) * 0.7;
    n.rotation.y = a;
    noodleRoot.add(n);
  }
  // Nest swirl on top
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.08 + i * 0.015, 0.012, 4, 12),
      i % 2 ? matPasta : matPastaDeep
    );
    ring.rotation.x = Math.PI / 2 + (i % 2) * 0.3;
    ring.rotation.z = i * 0.4;
    ring.position.y = 0.04 + i * 0.012;
    noodleRoot.add(ring);
  }
  g.add(noodleRoot);

  // Meatballs
  const meatRoot = new THREE.Group();
  meatRoot.name = "meatballs";
  const meatSpots = [
    [0.08, 0.28, 0.05],
    [-0.1, 0.26, -0.06],
    [0.02, 0.3, -0.1],
    [-0.04, 0.27, 0.1],
  ];
  for (let i = 0; i < meatSpots.length; i++) {
    const [mx, my, mz] = meatSpots[i];
    const mb = new THREE.Mesh(new THREE.SphereGeometry(0.055 + (i % 2) * 0.01, 10, 8), matMeat);
    mb.position.set(mx, my, mz);
    mb.scale.set(1.1, 0.95, 1.05);
    // Sauce drip on meatball
    const drip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), matSauce);
    drip.position.set(mx * 0.3, my + 0.03, mz * 0.3);
    meatRoot.add(mb, drip);
    // Speckle
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.015), matMeatHi);
    sp.position.set(mx + 0.02, my + 0.02, mz);
    meatRoot.add(sp);
  }
  g.add(meatRoot);

  // Parmesan flakes
  for (let i = 0; i < 10; i++) {
    const flake = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.008, 0.02), matCheese);
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.14;
    flake.position.set(Math.cos(a) * r, 0.32 + Math.random() * 0.04, Math.sin(a) * r);
    flake.rotation.set(Math.random(), Math.random(), Math.random());
    g.add(flake);
  }
  // Basil leaves
  for (const sx of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.04), matBasil);
    leaf.position.set(sx * 0.1, 0.34, sx * 0.05);
    leaf.rotation.z = sx * 0.5;
    g.add(leaf);
  }

  // Fork stuck in pasta
  const fork = new THREE.Group();
  fork.position.set(0.16, 0.28, 0.08);
  fork.rotation.set(0.5, 0.3, -0.4);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.18, 0.025), matFork);
  handle.position.y = -0.05;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.02), matFork);
  head.position.y = 0.06;
  fork.add(handle, head);
  for (let i = 0; i < 3; i++) {
    const tine = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.08, 0.01), matFork);
    tine.position.set(-0.02 + i * 0.02, 0.1, 0);
    fork.add(tine);
  }
  g.add(fork);

  // Steam wisps (simple transparent boxes)
  for (let i = 0; i < 3; i++) {
    const steam = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 })
    );
    steam.position.set((i - 1) * 0.06, 0.4 + i * 0.05, 0);
    steam.name = "steam" + i;
    g.add(steam);
  }

  g.scale.setScalar(1.15);
  return g;
}

function createSpaghettiSpoon() {
  const g = new THREE.Group();
  g.name = "eatSpoon";
  const matMetal = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8, roughness: 0.25, metalness: 0.9, flatShading: false,
  });
  const matHandle = new THREE.MeshStandardMaterial({
    color: 0xa8a29e, roughness: 0.4, metalness: 0.7, flatShading: false,
  });
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.28, 0.035), matHandle);
  handle.position.y = -0.08;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), matMetal);
  bowl.position.y = 0.1;
  bowl.scale.set(1.1, 0.55, 1.2);
  // Spaghetti on spoon
  const pasta = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xf0c14a, roughness: 0.7, flatShading: false })
  );
  pasta.position.y = 0.12;
  pasta.scale.set(1.2, 0.5, 1.1);
  pasta.name = "spoonPasta";
  const sauce = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 6, 5),
    new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5, flatShading: false })
  );
  sauce.position.set(0.01, 0.14, 0);
  g.add(handle, bowl, pasta, sauce);
  return g;
}

function startEatSpaghettiBowl() {
  if (state.eatAnim?.banana) {
    state.eatAnim.banana.parent?.remove(state.eatAnim.banana);
  }
  if (state.eatAnim?.bowl) {
    state.eatAnim.bowl.parent?.remove(state.eatAnim.bowl);
  }
  if (state.eatAnim?.spoon) {
    state.eatAnim.spoon.parent?.remove(state.eatAnim.spoon);
  }
  // Ron holds the BOWL in his LEFT hand
  const bowl = createDetailedSpaghettiBowl();
  avArmL.handRoot.add(bowl);
  bowl.position.set(-0.02, -0.1, -0.12);
  bowl.rotation.set(0.2, -0.3, -0.15);
  bowl.scale.setScalar(1.4);

  // Ron PICKS UP the SPOON in his RIGHT hand (visible while eating)
  const spoon = createSpaghettiSpoon();
  avArmR.handRoot.add(spoon);
  spoon.position.set(0.0, -0.08, -0.1);
  spoon.rotation.set(0.8, 0.2, 0.4);
  spoon.scale.setScalar(1.15);
  spoon.visible = true;

  state.eatAnim = {
    t: 0,
    food: "spaghetti",
    bowl,
    spoon,
    banana: null,
    healed: false,
    bites: 0,
  };
  // Third person so you SEE Ron hold the spoon
  if (player.camDistTarget < 4.5) player.camDistTarget = 5.5;
  player.camDist = Math.max(player.camDist, 5);
  playerSay("Ron picks up the spoon!");
  toast("🍝 Ron is holding the spoon in his hand!", "reward");
  playTone(480, 0.08, "sine", 0.08);
}

function startEatBlueBanana() {
  // Remove old
  if (state.eatAnim?.banana) {
    state.eatAnim.banana.parent?.remove(state.eatAnim.banana);
  }
  const banana = createDetailedBlueBanana();
  // Hold in right hand
  avArmR.handRoot.add(banana);
  banana.position.set(0.02, -0.12, -0.06);
  banana.rotation.set(0.4, 0.3, 1.2);
  banana.scale.setScalar(1.2);
  state.eatAnim = {
    t: 0,
    food: "blueBanana",
    banana,
    healed: false,
  };
  // See yourself eating
  if (player.camDistTarget < 3.5) player.camDistTarget = 4.2;
  playerSay("This blue banana looks so real…");
}

function updateEatAnim(dt) {
  const a = state.eatAnim;
  if (!a) return;
  a.t += dt;
  const t = a.t;

  // ── Spaghetti bowl: lift → eat bites → empty → disappear ──
  if (a.food === "spaghetti" && a.bowl) {
    const bowl = a.bowl;
    const spoon = a.spoon;
    // Steam float
    bowl.traverse((ch) => {
      if (ch.name && String(ch.name).startsWith("steam")) {
        ch.position.y += dt * 0.08;
        if (ch.material && ch.material.opacity != null) {
          ch.material.opacity = 0.15 + Math.sin(state.elapsed * 3 + ch.position.x * 10) * 0.1;
        }
      }
    });
    if (t < 0.55) {
      // Lift bowl (left hand) + pick up spoon (right hand)
      const u = t / 0.55;
      bowl.position.set(-0.02, -0.1 + u * 0.06, -0.12 - u * 0.02);
      bowl.rotation.set(0.2 + u * 0.15, -0.3, -0.15);
      bowl.scale.setScalar(1.4);
      if (spoon) {
        spoon.visible = true;
        // Scoop from bowl → raise spoon
        spoon.position.set(0.0, -0.08 + u * 0.02, -0.1 - u * 0.04);
        spoon.rotation.set(0.5 + u * 0.5, 0.2, 0.3 + u * 0.2);
        spoon.scale.setScalar(1.15);
      }
    } else if (t < 4.2) {
      // Eating — spoon held in RIGHT HAND, dips bowl → up to mouth → back
      const u = (t - 0.55) / 3.65;
      const bite = Math.sin(t * 9);
      // Scoop cycle 0..1 per bite
      const scoop = (Math.sin(t * 4.5) + 1) * 0.5; // 0 = in bowl, 1 = at mouth
      bowl.position.set(-0.02, -0.04 + bite * 0.008, -0.14);
      bowl.rotation.set(0.35 + bite * 0.05, -0.25, -0.1);
      if (spoon) {
        spoon.visible = true;
        // Hand holds spoon: low at bowl, high toward mouth
        spoon.position.set(
          0.02 + scoop * 0.04,
          -0.06 + scoop * 0.14 + bite * 0.01,
          -0.1 - scoop * 0.08
        );
        spoon.rotation.set(
          0.6 + scoop * 0.7 + bite * 0.08,
          0.15 + scoop * 0.1,
          0.35 - scoop * 0.15
        );
        spoon.scale.setScalar(1.15);
        const spPasta = spoon.getObjectByName("spoonPasta");
        // Pasta on spoon when coming up from bowl
        if (spPasta) {
          const load = scoop < 0.55 ? Math.min(1, scoop * 2) : Math.max(0.15, 1 - (scoop - 0.55) * 2);
          spPasta.scale.setScalar(Math.max(0.12, load * (1 - u * 0.7)));
          spPasta.visible = true;
        }
      }
      // Shrink noodles / meatballs as eaten
      const noodles = bowl.getObjectByName("noodles");
      const meat = bowl.getObjectByName("meatballs");
      const sauce = bowl.getObjectByName("sauce");
      const foodScale = Math.max(0.05, 1 - u * 1.05);
      if (noodles) noodles.scale.setScalar(foodScale);
      if (meat) meat.scale.setScalar(foodScale);
      if (sauce) sauce.scale.set(1.15 * foodScale, 0.55 * foodScale, 1.15 * foodScale);
      // Occasional bite chomp
      const biteN = Math.floor(u * 6);
      if (biteN > (a.bites || 0)) {
        a.bites = biteN;
        playTone(520 + biteN * 30, 0.06, "sine", 0.07);
        playNoise({ dur: 0.05, freq: 900, amp: 0.15, vol: 0.08, decay: 2 });
        playerSay(biteN === 1 ? "Mmm meatballs!" : biteN === 3 ? "So good…" : "Nom nom!");
      }
      if (!a.healed && u > 0.25) {
        a.healed = true;
        const heal = 40;
        const before = state.hp;
        state.hp = Math.min(state.maxHp, state.hp + heal);
        toast(`🍝 +${Math.round(state.hp - before)} HP from spaghetti!`, "reward");
        updateHUD();
      }
      // Bowl scale stays until empty
      bowl.scale.setScalar(1.35 * (1 - u * 0.15));
    } else if (t < 5.0) {
      // Empty bowl tips, fades / shrinks away
      const u = (t - 4.2) / 0.8;
      bowl.position.set(0.05, 0.02 - u * 0.15, -0.12);
      bowl.rotation.set(0.2 + u * 1.2, 0.4, u * 0.5);
      bowl.scale.setScalar(Math.max(0.05, 1.2 * (1 - u)));
      bowl.traverse((ch) => {
        if (ch.material && ch.material.opacity != null && ch.material.transparent) {
          ch.material.opacity *= 0.9;
        }
      });
    } else {
      bowl.parent?.remove(bowl);
      if (spoon && spoon.parent) spoon.parent.remove(spoon);
      state.eatAnim = null;
      playerSay("All gone! That was amazing spaghetti!");
      toast("🍝 Bowl finished — spaghetti gone!", "reward");
    }
    return;
  }

  // ── Blue banana (original) ──
  // 0–0.45: lift from hip toward face
  // 0.45–1.1: hold at mouth / bite
  // 1.1–1.6: finish & shrink
  if (a.banana) {
    if (t < 0.45) {
      const u = t / 0.45;
      a.banana.position.set(0.02, -0.12 + u * 0.05, -0.06 - u * 0.04);
      a.banana.rotation.set(0.4 - u * 0.2, 0.3, 1.2 - u * 0.4);
    } else if (t < 1.15) {
      const u = (t - 0.45) / 0.7;
      a.banana.position.set(0.0, -0.02 + Math.sin(u * 8) * 0.01, -0.12);
      a.banana.rotation.set(0.9, 0.1, 0.5);
      const flesh = a.banana.getObjectByName("flesh");
      if (flesh) flesh.visible = true;
      const s = 1.2 * (1 - u * 0.55);
      a.banana.scale.setScalar(Math.max(0.2, s));
      if (!a.healed && u > 0.3) {
        a.healed = true;
        playTone(640, 0.08, "sine", 0.1);
        playNoise({ dur: 0.08, freq: 1200, amp: 0.2, vol: 0.1, decay: 2 });
      }
    } else {
      a.banana.scale.multiplyScalar(0.85);
      if (t > 1.7) {
        a.banana.parent?.remove(a.banana);
        state.eatAnim = null;
      }
    }
  }
}

// Pirate greets Ron as "Ryan" (his nickname for you)
const PIRATE_GREET =
  "Ryan, do you want to hear my guitar music, or do you want to swim inside of the water with the diving suit?";

function nearestPirate(maxDist = 5.5) {
  let best = null;
  let bestD = Infinity;
  for (const f of beachFishers) {
    if (!f.root) continue;
    // Pirate boat is larger — allow boarding range
    const range = f.vehicle?.subtype === "pirate" ? Math.max(maxDist, 14) : maxDist;
    const d = Math.hypot(player.pos.x - f.root.position.x, player.pos.z - f.root.position.z);
    if (d < bestD && d < range) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

function onPirateApproach() {
  // Greet once when you walk up
  if (state.pirateGreeted) return;
  state.pirateGreeted = true;
  pirateSay(PIRATE_GREET);
  pirateSay("Press B to sail with me, Ryan — ye'll wear pirate glasses, a pirate hat, and a pirate suit too!");
  toast("🏴‍☠️ Press B to board the pirate boat · hat · glasses · suit!", "quest");
}

function playPirateGuitar() {
  resumeAudio();
  ensureAudio();
  if (state.guitarPlaying) {
    toast("🎸 Already jamming!", "");
    return;
  }
  state.guitarPlaying = true;
  pirateSay("Alright Ryan, listen to this sea shanty!");
  toast("🎸 Pirate guitar music!", "reward");

  // Plucky guitar-like arpeggio (Web Audio)
  const ctx = SFX.ctx;
  if (!ctx || !SFX.master) {
    state.guitarPlaying = false;
    return;
  }
  // Open chords-ish melody (A minor seafaring vibe)
  const notes = [
    220, 261.63, 329.63, 440, 329.63, 261.63, // Am arpeggio
    196, 246.94, 293.66, 392, 293.66, 246.94, // G
    174.61, 220, 261.63, 349.23, 261.63, 220, // F
    196, 246.94, 293.66, 392, 493.88, 392, // G up
    220, 261.63, 329.63, 440, 523.25, 440, 329.63, 261.63,
  ];
  const start = ctx.currentTime + 0.05;
  notes.forEach((freq, i) => {
    const t0 = start + i * 0.28;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    o.type = "triangle";
    o2.type = "sawtooth";
    o.frequency.value = freq;
    o2.frequency.value = freq * 2.002;
    f.type = "lowpass";
    f.frequency.value = 1800;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(SFX.master);
    o.start(t0);
    o2.start(t0);
    o.stop(t0 + 0.5);
    o2.stop(t0 + 0.5);
  });
  // Soft strum bed
  [0, 1.7, 3.4, 5.1].forEach((off, i) => {
    const chord = i % 2 === 0 ? [220, 261.63, 329.63] : [196, 246.94, 293.66];
    chord.forEach((freq) => {
      const t0 = start + off;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
      o.connect(g);
      g.connect(SFX.master);
      o.start(t0);
      o.stop(t0 + 1.5);
    });
  });
  setTimeout(() => {
    state.guitarPlaying = false;
    pirateSay("Ha! Not bad for an old sea dog, eh Ryan?");
  }, notes.length * 280 + 400);
}

function equipDivingSuitAndSwim() {
  const pirate = nearestPirate();
  pirateSay("Here ya go Ryan — put on the diving suit and swim in the water!");
  playerSay("Thanks! I'm Ron, and I'm ready to dive!");
  state.divingSuit = true;
  applyDivingSuitVisual(true);
  // Walk Ron into the ocean
  const sx = pirate ? pirate.root.position.x : player.pos.x;
  player.pos.x = sx + 2;
  player.pos.z = OCEAN_START + 10;
  player.pos.y = WATER_SURFACE - 1.2;
  player.vel.set(0, -1, 2);
  player.onGround = false;
  // Force third person so you see the suit
  if (player.camDistTarget < 3.5) player.camDistTarget = 4.5;
  toast("🤿 Diving suit on! Swim with WASD · Space surface · Ctrl dive", "reward");
  playSplash();
}

function applyDivingSuitVisual(on) {
  // Remove old suit meshes
  if (state._diveSuitParts) {
    for (const m of state._diveSuitParts) {
      if (m.parent) m.parent.remove(m);
    }
  }
  state._diveSuitParts = [];
  if (!on || !avBody) return;

  const parts = [];
  const add = (mesh, parent = avBody) => {
    parent.add(mesh);
    parts.push(mesh);
    return mesh;
  };

  const matSuit = new THREE.MeshLambertMaterial({ color: 0x1a3a5c, flatShading: false });
  const matSuitDark = new THREE.MeshLambertMaterial({ color: 0x0f2438, flatShading: false });
  const matSuitHi = new THREE.MeshLambertMaterial({ color: 0x2a5a8a, flatShading: false });
  const matNeoprene = new THREE.MeshLambertMaterial({ color: 0x0b1220, flatShading: false });
  const matAccent = new THREE.MeshLambertMaterial({ color: 0x22d3ee, flatShading: false });
  const matYellow = new THREE.MeshLambertMaterial({ color: 0xfbbf24, flatShading: false });
  const matOrange = new THREE.MeshLambertMaterial({ color: 0xf97316, flatShading: false });
  const matGlass = new THREE.MeshLambertMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.42,
    flatShading: false,
  });
  const matGlassRim = new THREE.MeshLambertMaterial({ color: 0xe2e8f0, flatShading: false });
  const matTank = new THREE.MeshLambertMaterial({ color: 0xd1d5db, flatShading: false });
  const matTankBand = new THREE.MeshLambertMaterial({ color: 0x374151, flatShading: false });
  const matValve = new THREE.MeshLambertMaterial({ color: 0xfbbf24, flatShading: false });
  const matHose = new THREE.MeshLambertMaterial({ color: 0x1f2937, flatShading: false });
  const matGauge = new THREE.MeshLambertMaterial({ color: 0xf8fafc, flatShading: false });
  const matGaugeFace = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const matBlack = new THREE.MeshLambertMaterial({ color: 0x111827, flatShading: false });
  const matBoot = new THREE.MeshLambertMaterial({ color: 0x1e293b, flatShading: false });
  const matGlove = new THREE.MeshLambertMaterial({ color: 0x0f172a, flatShading: false });
  const matRed = new THREE.MeshLambertMaterial({ color: 0xef4444, flatShading: false });

  // ── Full body wetsuit panels ──
  add(new THREE.Mesh(new THREE.BoxGeometry(TORSO_W * 1.12, TORSO_H * 1.02, D * 1.12), matSuit)).position.set(
    0,
    TORSO_Y,
    0
  );
  // Chest zipper strip
  add(new THREE.Mesh(new THREE.BoxGeometry(0.08, TORSO_H * 0.85, 0.06), matBlack)).position.set(
    0,
    TORSO_Y,
    -D / 2 - 0.04
  );
  // Cyan reflective strips
  for (const y of [0.18, -0.1, -0.35]) {
    const strip = add(new THREE.Mesh(new THREE.BoxGeometry(TORSO_W * 1.14, 0.05, 0.04), matAccent));
    strip.position.set(0, TORSO_Y + y, -D / 2 - 0.05);
  }
  // Side seams
  for (const sx of [-1, 1]) {
    const seam = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, TORSO_H * 0.9, D * 1.05), matSuitDark));
    seam.position.set(sx * (TORSO_W / 2 + 0.02), TORSO_Y, 0);
  }
  // Weight belt
  const belt = add(new THREE.Mesh(new THREE.BoxGeometry(TORSO_W * 1.2, 0.12, D * 1.2), matYellow));
  belt.position.set(0, HIP_Y + 0.12, 0);
  for (const sx of [-0.28, -0.1, 0.1, 0.28]) {
    const weight = add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.14), matBlack));
    weight.position.set(sx, HIP_Y + 0.12, -D / 2 - 0.08);
  }
  // Belt buckle
  add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.06), matGlassRim)).position.set(
    0,
    HIP_Y + 0.12,
    -D / 2 - 0.1
  );

  // ── Detailed helmet ──
  const helmY = HEAD_Y + 0.06;
  // Outer dome
  const dome = add(new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 12), matGlass));
  dome.position.set(0, helmY, 0);
  dome.scale.set(1.05, 1.1, 1.05);
  // Metal neck ring
  const neckRing = add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.055, 8, 18), matGlassRim));
  neckRing.rotation.x = Math.PI / 2;
  neckRing.position.set(0, HEAD_Y - 0.18, 0);
  // Lower collar
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.14, 12), matBlack)).position.set(
    0,
    HEAD_Y - 0.28,
    0
  );
  // Faceplate frame
  const plate = add(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.08), matGlassRim));
  plate.position.set(0, helmY + 0.02, -0.38);
  // Clear face window
  const window = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.04), matGlass));
  window.position.set(0, helmY + 0.02, -0.42);
  // Headlamp
  const lamp = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 14), matYellow));
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(0, helmY + 0.28, -0.28);
  const lampGlass = add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), matAccent));
  lampGlass.position.set(0, helmY + 0.28, -0.34);
  // Side ear pods / comms
  for (const sx of [-1, 1]) {
    const pod = add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.12), matSuitDark));
    pod.position.set(sx * 0.4, helmY, 0);
    const ant = add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 5), matBlack));
    ant.position.set(sx * 0.42, helmY + 0.16, 0.05);
  }
  // Breathing regulator on face
  const reg = add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.12), matBlack));
  reg.position.set(0, helmY - 0.14, -0.4);
  const mouth = add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.08, 14), matYellow));
  mouth.rotation.x = Math.PI / 2;
  mouth.position.set(0, helmY - 0.14, -0.48);

  // ── Dual air tanks with bands + valves + hose ──
  for (const sx of [-0.18, 0.18]) {
    const tank = add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.62, 10), matTank));
    tank.position.set(sx, TORSO_Y + 0.08, D / 2 + 0.2);
    // Top dome
    const cap = add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), matTank));
    cap.position.set(sx, TORSO_Y + 0.39, D / 2 + 0.2);
    cap.scale.y = 0.55;
    // Bands
    for (const by of [-0.15, 0.1]) {
      const band = add(new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.05, 10), matTankBand));
      band.position.set(sx, TORSO_Y + 0.08 + by, D / 2 + 0.2);
    }
    // Bottom boot
    const boot = add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.06, 14), matBlack));
    boot.position.set(sx, TORSO_Y - 0.24, D / 2 + 0.2);
  }
  // Tank manifold / valve block
  const manifold = add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.12), matValve));
  manifold.position.set(0, TORSO_Y + 0.42, D / 2 + 0.2);
  // Pressure gauge
  const gauge = add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 12), matGauge));
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(0.22, TORSO_Y + 0.15, -D / 2 - 0.12);
  const gFace = add(new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), matGaugeFace));
  gFace.position.set(0.22, TORSO_Y + 0.15, -D / 2 - 0.145);
  // Hose from tanks to regulator (segment chain)
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const hx = 0.12 + Math.sin(t * Math.PI) * 0.08;
    const hy = TORSO_Y + 0.35 - t * 0.55;
    const hz = D / 2 + 0.12 - t * (D + 0.45);
    const seg = add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), matHose));
    seg.position.set(hx, hy, hz);
  }
  // Second hose (octo yellow)
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const hx = -0.15;
    const hy = TORSO_Y + 0.3 - t * 0.4;
    const hz = D / 2 + 0.1 - t * 0.5;
    const seg = add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), matYellow));
    seg.position.set(hx, hy, hz);
  }

  // ── Fins / dive boots on feet area ──
  const footY = 0.08;
  for (const sx of [-LEG_X, LEG_X]) {
    const bootMesh = add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.42), matBoot));
    bootMesh.position.set(sx, footY, 0.05);
    // Fin blade
    const fin = add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.45), matOrange));
    fin.position.set(sx, footY + 0.02, 0.38);
    fin.rotation.x = -0.15;
    // Fin tip
    const tip = add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.12), matYellow));
    tip.position.set(sx, footY + 0.04, 0.58);
  }

  // ── Arm / glove overlays (approx shoulder positions) ──
  for (const sx of [-1, 1]) {
    const sleeve = add(
      new THREE.Mesh(new THREE.BoxGeometry(ARM_W * 1.25, UPPER_ARM_H * 0.9, ARM_W * 1.25), matSuitHi)
    );
    sleeve.position.set(sx * (TORSO_W / 2 + ARM_W * 0.35), SHOULDER_Y - UPPER_ARM_H * 0.35, 0);
    // Elbow pad
    const pad = add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), matNeoprene));
    pad.position.set(sx * (TORSO_W / 2 + ARM_W * 0.35), SHOULDER_Y - UPPER_ARM_H - 0.05, 0);
    // Glove
    const glove = add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.18), matGlove));
    glove.position.set(
      sx * (TORSO_W / 2 + ARM_W * 0.35),
      SHOULDER_Y - UPPER_ARM_H - FOREARM_H - 0.05,
      0
    );
  }

  // ── Leg suit panels ──
  for (const sx of [-LEG_X, LEG_X]) {
    const thigh = add(new THREE.Mesh(new THREE.BoxGeometry(LEG_W * 1.1, THIGH_H * 0.9, LEG_W * 1.1), matSuit));
    thigh.position.set(sx, HIP_Y - THIGH_H * 0.4, 0);
    const shin = add(
      new THREE.Mesh(new THREE.BoxGeometry(LEG_W * 1.05, SHIN_H * 0.85, LEG_W * 1.05), matSuitDark)
    );
    shin.position.set(sx, HIP_Y - THIGH_H - SHIN_H * 0.4, 0);
    // Knee pad
    const knee = add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.18), matNeoprene));
    knee.position.set(sx, HIP_Y - THIGH_H, -LEG_W * 0.35);
  }

  // ── Rescue knife on leg ──
  const knife = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.04), matGlassRim));
  knife.position.set(LEG_X + 0.18, HIP_Y - THIGH_H * 0.5, 0);
  const knifeTip = add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.03), matRed));
  knifeTip.position.set(LEG_X + 0.18, HIP_Y - THIGH_H * 0.5 - 0.14, 0);

  // ── Name patch "RON" ──
  const patch = add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.03), matYellow));
  patch.position.set(0.22, TORSO_Y + 0.28, -D / 2 - 0.06);
  // Depth gauge + compass console on wrist
  const wrist = add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.16), matBlack));
  wrist.position.set(TORSO_W / 2 + ARM_W * 0.35, SHOULDER_Y - UPPER_ARM_H - FOREARM_H * 0.3, 0.05);
  const dial = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10), matGauge));
  dial.rotation.x = Math.PI / 2;
  dial.position.set(TORSO_W / 2 + ARM_W * 0.35, SHOULDER_Y - UPPER_ARM_H - FOREARM_H * 0.3, -0.06);
  // BCD inflator hose
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const h = add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), matYellow));
    h.position.set(0.2 + t * 0.1, TORSO_Y + 0.35 - t * 0.35, -D / 2 - 0.08 - t * 0.05);
  }
  // Mask strap behind helmet
  const strap = add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, HEAD_D * 0.9), matBlack));
  strap.position.set(0, HEAD_Y + 0.05, 0.05);
  // Bubble valve on helmet
  const bub = add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), matGlassRim));
  bub.position.set(0.2, HEAD_Y + 0.25, 0.15);
  // Weight belt extra blocks
  for (const sx of [-0.35, 0.35]) {
    const w = add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.14), matBlack));
    w.position.set(sx, HIP_Y + 0.12, D / 2 + 0.08);
  }
  // Fin straps
  for (const sx of [-LEG_X, LEG_X]) {
    const fs = add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.08), matYellow));
    fs.position.set(sx, 0.14, 0.1);
  }

  state._diveSuitParts = parts;
}

function choosePirateOffer() {
  if (state.eatCooldown > 0 || state.inVehicle || state.climbing || state.onTree) return;
  const pirate = nearestPirate();
  if (!pirate) return;
  if (state.pirateOffer === 0) {
    state.eatCooldown = 0.8;
    playPirateGuitar();
  } else if (state.pirateOffer === 1) {
    state.eatCooldown = 0.8;
    equipDivingSuitAndSwim();
  } else {
    // Snacks: map offer 2,3,4 → food 0,1,2
    state.foodChoice = state.pirateOffer - 2;
    eatPirateFood();
  }
}

function eatPirateFood() {
  if (state.eatCooldown > 0 || state.inVehicle || state.climbing || state.onTree || player.sleeping) return;
  if (state.eatAnim) return;
  const pirate = nearestPirate();
  if (!pirate) return;
  const food = PIRATE_FOODS[state.foodChoice] || PIRATE_FOODS[0];
  state.eatCooldown = 2.0;

  // Pirate tip of the hat
  if (pirate.hat && !pirate.headOff) {
    pirate.hat.rotation.z = 0.35;
    setTimeout(() => {
      if (pirate.hat) pirate.hat.rotation.z = 0;
    }, 500);
  }

  // Blue banana: full pick-up → mouth animation with detailed banana
  if (food.id === "blueBanana") {
    startEatBlueBanana();
    const heal = food.heal;
    const before = state.hp;
    state.hp = Math.min(state.maxHp, state.hp + heal);
    const gained = Math.round(state.hp - before);
    setTimeout(() => {
      playerSay(food.phrase);
      toast(`${food.emoji} Ate ${food.name}! +${gained} HP`, "reward");
      updateHUD();
    }, 900);
    return;
  }

  // Other snacks: instant eat
  const heal = food.heal;
  const before = state.hp;
  state.hp = Math.min(state.maxHp, state.hp + heal);
  const gained = Math.round(state.hp - before);
  playTone(520, 0.08, "sine", 0.1);
  playTone(720, 0.12, "triangle", 0.08);
  playNoise({ dur: 0.1, freq: 900, amp: 0.2, vol: 0.12, decay: 2 });
  playerSay(food.phrase);
  toast(`${food.emoji} Ate ${food.name}! +${gained} HP`, "reward");
  updateHUD();
}

function setMode(mode) {
  state.mode = mode;
  const banner = $("mode-banner");
  banner.textContent = mode;
  banner.className = "";
  if (mode === "RACE") banner.classList.add("race");
  else if (mode === "COMBAT") banner.classList.add("combat");
  else if (mode === "BUILD") banner.classList.add("build");
}

// ─────────────────────────────────────────────────────────────
// HUD
// ─────────────────────────────────────────────────────────────
function updateHUD() {
  $("hud-level").textContent = state.level;
  $("hud-coins").textContent = state.coins;
  const coinEl = $("hud-coins");
  if (coinEl) coinEl.style.color = "#4ade80"; // green coins
  const gemEl = $("hud-gems");
  if (gemEl) {
    // Show unique purple gems (costume currency) prominently + crystals
    gemEl.textContent = `${state.purpleGems || 0}💜 · ${state.gems}💎`;
    gemEl.style.color = "#c084fc";
    gemEl.style.fontSize = "0.85em";
  }
  $("hud-streak").textContent = state.streak;
  $("xp-fill").style.width = `${(state.xp / state.xpToNext) * 100}%`;
  $("hp-fill").style.width = `${(state.hp / state.maxHp) * 100}%`;
  $("hp-text").textContent = Math.ceil(state.hp);
  $("ammo-fill").style.width = `${(state.ammo / state.maxAmmo) * 100}%`;
  $("ammo-text").textContent = `${state.ammo} / ${state.reserve}`;
  $("p-kills").textContent = state.kills;
  $("p-built").textContent = state.blocksBuilt;
  $("p-races").textContent = state.racesWon;
  $("p-dist").textContent = Math.floor(state.distance);

  const names = { 1: "DIRT BLOCKS", 2: "WOOD BLOCKS", 3: "CRYSTAL BLOCKS", 4: "HANDS" };
  if (state.activeSword && NIFTY_SWORDS[state.activeSword]) {
    const sw = NIFTY_SWORDS[state.activeSword];
    $("weapon-name").textContent = `${sw.emoji} ${sw.name.toUpperCase()}`;
  } else {
    $("weapon-name").textContent = names[state.slot] || "HANDS / BLOCKS";
  }

  document.querySelectorAll(".slot").forEach((s) => {
    s.classList.toggle("selected", Number(s.dataset.slot) === state.slot && !state.activeSword);
  });
}

function drawMinimap() {
  const ctx = minimapCtx;
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const t = state.elapsed || 0;
  const night = state.dayNight || 0;

  ctx.clearRect(0, 0, w, h);

  // Clip everything to a circle (planet-style frame)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, w / 2 - 1, 0, Math.PI * 2);
  ctx.clip();

  // ── Space background ──
  const space = ctx.createRadialGradient(cx, cy, 4, cx, cy, w * 0.55);
  space.addColorStop(0, "#0b1224");
  space.addColorStop(0.55, "#050814");
  space.addColorStop(1, "#02040a");
  ctx.fillStyle = space;
  ctx.fillRect(0, 0, w, h);

  // Stars
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 55; i++) {
    const sx = (i * 73 + 11) % w;
    const sy = (i * 41 + 7) % h;
    const tw = 0.5 + (Math.sin(t * 2 + i) * 0.5 + 0.5) * 0.8;
    ctx.globalAlpha = 0.35 + (i % 5) * 0.12;
    ctx.beginPath();
    ctx.arc(sx, sy, tw * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ── Solar system (Sun + orbiting planets) ──
  const sunX = cx - 52;
  const sunY = cy;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 28);
  sunGlow.addColorStop(0, "rgba(255, 240, 160, 0.95)");
  sunGlow.addColorStop(0.35, "rgba(255, 180, 40, 0.55)");
  sunGlow.addColorStop(1, "rgba(255, 120, 0, 0)");
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 28, 0, Math.PI * 2);
  ctx.fill();
  const sunCoreG = ctx.createRadialGradient(sunX - 2, sunY - 2, 1, sunX, sunY, 11);
  sunCoreG.addColorStop(0, "#fffce8");
  sunCoreG.addColorStop(0.5, "#ffd54a");
  sunCoreG.addColorStop(1, "#ff8c1a");
  ctx.fillStyle = sunCoreG;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 10, 0, Math.PI * 2);
  ctx.fill();

  const orbits = [
    { r: 22, speed: 0.9, col: "#a8a29e", pr: 2.0 },
    { r: 32, speed: 0.55, col: "#fbbf24", pr: 2.6 },
    { r: 48, speed: 0.35, col: null, pr: 0 },
    { r: 62, speed: 0.28, col: "#ef4444", pr: 2.2 },
    { r: 78, speed: 0.14, col: "#d4a574", pr: 4.2 },
  ];
  for (const o of orbits) {
    ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sunX, sunY, o.r, 0, Math.PI * 2);
    ctx.stroke();
    if (o.col) {
      const ang = t * o.speed + o.r * 0.1;
      const pxp = sunX + Math.cos(ang) * o.r;
      const pyp = sunY + Math.sin(ang) * o.r;
      ctx.fillStyle = o.col;
      ctx.beginPath();
      ctx.arc(pxp, pyp, o.pr, 0, Math.PI * 2);
      ctx.fill();
      if (o.pr > 3.5) {
        ctx.strokeStyle = "rgba(120, 80, 40, 0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(pxp, pyp, o.pr * 0.9, o.pr * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // ── EARTH — circular planet like Earth ──
  const earthAng = t * 0.35 + 1.2;
  const earthOrbitR = 48;
  const ex = sunX + Math.cos(earthAng) * earthOrbitR;
  const ey = sunY + Math.sin(earthAng) * earthOrbitR;
  const er = 22;

  const atmo = ctx.createRadialGradient(ex, ey, er * 0.7, ex, ey, er * 1.35);
  atmo.addColorStop(0, "rgba(56, 189, 248, 0)");
  atmo.addColorStop(0.75, "rgba(56, 189, 248, 0.15)");
  atmo.addColorStop(1, "rgba(125, 211, 252, 0)");
  ctx.fillStyle = atmo;
  ctx.beginPath();
  ctx.arc(ex, ey, er * 1.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(ex, ey, er, 0, Math.PI * 2);
  ctx.clip();

  const oceanG = ctx.createRadialGradient(ex - 4, ey - 4, 2, ex, ey, er);
  oceanG.addColorStop(0, "#3b82f6");
  oceanG.addColorStop(0.55, "#1d4ed8");
  oceanG.addColorStop(1, "#1e3a8a");
  ctx.fillStyle = oceanG;
  ctx.fillRect(ex - er, ey - er, er * 2, er * 2);

  ctx.fillStyle = "#4ade80";
  const lands = [
    [-0.35, -0.15, 0.42, 0.55],
    [0.25, 0.1, 0.38, 0.4],
    [-0.1, 0.4, 0.28, 0.22],
    [0.45, -0.35, 0.2, 0.25],
    [-0.5, 0.25, 0.18, 0.3],
  ];
  for (const [lx, ly, lw, lh] of lands) {
    ctx.beginPath();
    ctx.ellipse(ex + lx * er, ey + ly * er, lw * er, lh * er, lx * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.ellipse(ex - 0.32 * er, ey - 0.12 * er, 0.22 * er, 0.28 * er, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(ex + 0.22 * er, ey + 0.08 * er, 0.18 * er, 0.2 * er, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(241, 245, 249, 0.92)";
  ctx.beginPath();
  ctx.ellipse(ex, ey - er * 0.82, er * 0.45, er * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(ex, ey + er * 0.85, er * 0.4, er * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  ctx.beginPath();
  ctx.ellipse(ex + 0.1 * er, ey - 0.25 * er, 0.35 * er, 0.1 * er, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(ex - 0.2 * er, ey + 0.3 * er, 0.3 * er, 0.08 * er, -0.3, 0, Math.PI * 2);
  ctx.fill();

  const px =
    state.inVehicle && state.vehicle ? state.vehicle.group.position.x : player.pos.x;
  const pz =
    state.inVehicle && state.vehicle ? state.vehicle.group.position.z : player.pos.z;
  const worldToEarth = (x, z) => {
    const nx = THREE.MathUtils.clamp(x / (WORLD_SIZE * 0.45), -1, 1);
    const nz = THREE.MathUtils.clamp(z / (WORLD_SIZE * 0.45), -1, 1);
    return [ex + nx * er * 0.72, ey + nz * er * 0.72];
  };

  // Game ocean band (south)
  ctx.fillStyle = "rgba(59, 130, 246, 0.4)";
  ctx.fillRect(ex - er, ey + er * 0.25, er * 2, er * 0.75);

  // Vehicles
  ctx.fillStyle = "#fbbf24";
  for (const v of vehicles) {
    if (!v.group) continue;
    const [mx, my] = worldToEarth(v.group.position.x, v.group.position.z);
    const dx = mx - ex;
    const dy = my - ey;
    if (dx * dx + dy * dy > er * er * 0.95) continue;
    ctx.beginPath();
    ctx.arc(mx, my, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player on Earth
  {
    const [mx, my] = worldToEarth(px, pz);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + Math.sin(player.yaw) * 5, my + Math.cos(player.yaw) * 5);
    ctx.stroke();
  }

  // Night shade on Earth when sleeping
  if (night > 0.08) {
    const shade = ctx.createLinearGradient(ex - er, ey, ex + er, ey);
    shade.addColorStop(0, `rgba(2, 6, 23, ${0.15 + night * 0.55})`);
    shade.addColorStop(0.45, `rgba(2, 6, 23, ${night * 0.15})`);
    shade.addColorStop(1, "rgba(2, 6, 23, 0)");
    ctx.fillStyle = shade;
    ctx.fillRect(ex - er, ey - er, er * 2, er * 2);
  }

  ctx.restore();

  // Earth rim
  ctx.strokeStyle = "rgba(186, 230, 253, 0.65)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ex, ey, er, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(224, 242, 254, 0.9)";
  ctx.font = "bold 8px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("EARTH", ex, ey + er + 11);

  // Moon around Earth
  const moonA = t * 1.1;
  const mmx = ex + Math.cos(moonA) * (er + 7);
  const mmy = ey + Math.sin(moonA) * (er + 7);
  ctx.fillStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.arc(mmx, mmy, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Outer ring of map
  ctx.strokeStyle = "rgba(125, 211, 252, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, w / 2 - 1.5, 0, Math.PI * 2);
  ctx.stroke();
}



// ─────────────────────────────────────────────────────────────
// WEATHER (Settings: Spring · Thunder · Snow)
// ─────────────────────────────────────────────────────────────
const weatherFx = {
  group: new THREE.Group(),
  rain: null,
  snow: null,
  petals: null,
};

function _makeFallPoints(count, color, size, opacity) {
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 70;
    positions[i * 3 + 1] = Math.random() * 40 + 4;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 70;
    speeds[i] = 0.6 + Math.random() * 1.4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.userData.speeds = speeds;
  const mat = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity,
    depthWrite: false,
    sizeAttenuation: true,
    fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.visible = false;
  return pts;
}

function buildWeatherFX() {
  weatherFx.rain = _makeFallPoints(1200, 0x9ad4ff, 0.14, 0.6);
  weatherFx.snow = _makeFallPoints(450, 0xffffff, 0.22, 0.85);
  weatherFx.petals = _makeFallPoints(180, 0xffb6c8, 0.28, 0.75);
  weatherFx.group.add(weatherFx.rain, weatherFx.snow, weatherFx.petals);
  weatherFx.group.name = "weatherFx";
  scene.add(weatherFx.group);
}

function setWeather(mode, announce = true) {
  const m = mode === "thunder" || mode === "snow" ? mode : "spring";
  state.weather = m;
  state._weatherFlash = 0;
  state._weatherNextBolt = 4 + Math.random() * 6;

  document.querySelectorAll(".weather-card").forEach((el) => {
    el.classList.toggle("selected", el.dataset.weather === m);
  });
  const status = $("weather-status");
  if (status) {
    const label = m === "thunder" ? "Thunder" : m === "snow" ? "Snow" : "Spring";
    const emoji = m === "thunder" ? "⚡" : m === "snow" ? "❄️" : "🌸";
    status.innerHTML = `Weather: <strong>${emoji} ${label}</strong>`;
  }

  if (weatherFx.rain) weatherFx.rain.visible = m === "thunder";
  if (weatherFx.snow) weatherFx.snow.visible = m === "snow";
  if (weatherFx.petals) weatherFx.petals.visible = m === "spring";

  if (announce) {
    if (m === "thunder") toast("⚡ Thunder — dark sky, rain & lightning!", "quest");
    else if (m === "snow") toast("❄️ Snow — cold air and snowflakes!", "quest");
    else toast("🌸 Spring — soft light and petals!", "reward");
  }
}

function _stepFallPoints(pts, dt, fallSpeed, drift, wrapY, spread) {
  if (!pts || !pts.visible) return;
  const pos = pts.geometry.attributes.position;
  const speeds = pts.geometry.userData.speeds;
  const arr = pos.array;
  for (let i = 0; i < pos.count; i++) {
    const i3 = i * 3;
    const sp = speeds[i] || 1;
    arr[i3 + 1] -= fallSpeed * sp * dt;
    arr[i3] += drift * sp * dt * 0.35;
    if (arr[i3 + 1] < 0) {
      arr[i3] = (Math.random() - 0.5) * spread;
      arr[i3 + 1] = wrapY * (0.55 + Math.random() * 0.55);
      arr[i3 + 2] = (Math.random() - 0.5) * spread;
    }
    // Keep flakes near player horizontally
    if (Math.abs(arr[i3]) > spread * 0.55) arr[i3] = (Math.random() - 0.5) * spread;
    if (Math.abs(arr[i3 + 2]) > spread * 0.55) arr[i3 + 2] = (Math.random() - 0.5) * spread;
  }
  pos.needsUpdate = true;
}

function updateWeather(dt) {
  if (!weatherFx.group) return;
  const origin = camera.position;
  weatherFx.group.position.set(origin.x, 0, origin.z);

  const w = state.weather || "spring";
  const night = state.dayNight || 0;
  const underwater = isUnderwater(player.pos.x, player.pos.y, player.pos.z) && !state.inVehicle;

  if (w === "thunder") {
    _stepFallPoints(weatherFx.rain, dt, 28, 6, 38, 70);
    state._weatherNextBolt = (state._weatherNextBolt || 5) - dt;
    if (state._weatherNextBolt <= 0) {
      state._weatherFlash = 0.18 + Math.random() * 0.12;
      state._weatherNextBolt = 5 + Math.random() * 10;
    }
    if (state._weatherFlash > 0) {
      state._weatherFlash -= dt;
      const flash = Math.max(0, state._weatherFlash) / 0.2;
      if (!underwater) {
        scene.background.lerp(new THREE.Color(0xd0e4ff), flash * 0.85);
        fill.intensity = Math.min(1.4, fill.intensity + flash * 1.2);
        sun.intensity = Math.min(2.2, sun.intensity + flash * 1.5);
      }
    }
    // Stormy dark tint (when not flashing / underwater)
    if (!underwater && state._weatherFlash <= 0) {
      const stormBg = new THREE.Color(0x3a4a62).lerp(new THREE.Color(0x0a1020), night);
      const stormFog = new THREE.Color(0x5a6a80).lerp(new THREE.Color(0x121820), night);
      scene.background.lerp(stormBg, 0.12);
      scene.fog.color.lerp(stormFog, 0.12);
      scene.fog.near = Math.min(scene.fog.near, 55);
      scene.fog.far = Math.min(scene.fog.far, 280);
      hemi.intensity = Math.min(hemi.intensity, 0.45 + (1 - night) * 0.15);
      sun.intensity = Math.min(sun.intensity, 0.35 + (1 - night) * 0.2);
      fill.intensity = Math.min(fill.intensity, 0.2);
      renderer.toneMappingExposure = Math.min(renderer.toneMappingExposure, 0.88);
    }
  } else if (w === "snow") {
    _stepFallPoints(weatherFx.snow, dt, 4.5, 1.2, 36, 65);
    if (!underwater) {
      const snowBg = new THREE.Color(0xb8c8dc).lerp(new THREE.Color(0x0a1220), night);
      const snowFog = new THREE.Color(0xd0dce8).lerp(new THREE.Color(0x121a28), night);
      scene.background.lerp(snowBg, 0.1);
      scene.fog.color.lerp(snowFog, 0.12);
      scene.fog.near = Math.min(scene.fog.near, 70);
      scene.fog.far = Math.min(scene.fog.far, 320);
      hemi.color.lerp(new THREE.Color(0xc8d8f0), 0.08);
      fill.color.lerp(new THREE.Color(0xe8f0ff), 0.08);
      sun.intensity = Math.min(sun.intensity, 0.75 + (1 - night) * 0.15);
      renderer.toneMappingExposure = Math.min(renderer.toneMappingExposure, 0.98);
    }
  } else {
    // Spring — soft petals + warm bright air
    _stepFallPoints(weatherFx.petals, dt, 2.2, 2.5, 30, 55);
    if (!underwater && night < 0.4) {
      const springBg = new THREE.Color(0x8ec8ff);
      const springFog = new THREE.Color(0xb8e0c8);
      scene.background.lerp(springBg, 0.06);
      scene.fog.color.lerp(springFog, 0.05);
      hemi.groundColor.lerp(new THREE.Color(0x7ab86a), 0.05);
      fill.color.lerp(new THREE.Color(0xfff5e8), 0.04);
      hemi.intensity = Math.max(hemi.intensity, 0.9);
      sun.intensity = Math.max(sun.intensity, 1.05);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────────────────────
// ── Settings ─────────────────────────────────────────────────
const settingsBtn = $("settings-btn");
const settingsPanel = $("settings-panel");
const settingsClose = $("settings-close");
const settingsDone = $("settings-done");

function setGameMode(mode, announce = true) {
  const m = mode === "survival" ? "survival" : "afk";
  state.gameMode = m;

  // UI cards (AFK / Survival only — not weather)
  document.querySelectorAll(".mode-card[data-mode]").forEach((el) => {
    el.classList.toggle("selected", el.dataset.mode === m);
  });

  const pill = $("mode-pill");
  if (pill) {
    pill.textContent = m === "survival" ? "SURVIVAL" : "AFK";
    pill.classList.toggle("survival", m === "survival");
  }

  const status = $("mode-status");
  if (status) {
    status.innerHTML =
      m === "survival"
        ? 'Mode: <strong>SURVIVAL</strong> — monsters hunt you. Protect yourself!'
        : 'Mode: <strong>AFK</strong> — monsters will not attack you';
  }

  if (announce) {
    if (m === "survival") {
      toast("SURVIVAL mode — monsters will attack!", "kill");
    } else {
      toast("AFK mode — monsters are peaceful", "quest");
    }
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem("nexus-settings");
    if (!raw) {
      applyGraphics("medium", false); // default look: soft shadows on
      setGameMode(state.gameMode, false);
      setWeather(state.weather || "spring", false);
      return;
    }
    const s = JSON.parse(raw);
    if (s.sensitivity != null) state.sensitivity = Number(s.sensitivity) || 1;
    if (s.invertY != null) state.invertY = !!s.invertY;
    if (s.gameMode) state.gameMode = s.gameMode === "survival" ? "survival" : "afk";
    applyGraphics(s.graphics || "medium", false);
    if (s.showQuests === false) $("quest-panel")?.classList.add("hidden-by-settings");
    if (s.showControls === false) $("controls-help")?.classList.add("hidden");
    if (s.showMinimap === false) $("minimap-frame")?.classList.add("hidden");
    // Sync UI
    const sens = $("set-sensitivity");
    if (sens) {
      sens.value = String(state.sensitivity);
      $("set-sensitivity-val").textContent = state.sensitivity.toFixed(1);
    }
    if ($("set-inverty")) $("set-inverty").checked = state.invertY;
    if ($("set-graphics") && s.graphics) $("set-graphics").value = s.graphics;
    if ($("set-quests")) $("set-quests").checked = s.showQuests !== false;
    if ($("set-controls")) $("set-controls").checked = s.showControls !== false;
    if ($("set-minimap")) $("set-minimap").checked = s.showMinimap !== false;
    setGameMode(state.gameMode, false);
    if (s.weather) setWeather(s.weather, false);
    else setWeather(state.weather || "spring", false);
  } catch (_) {
    setGameMode(state.gameMode, false);
    setWeather(state.weather || "spring", false);
  }
}

function saveSettings() {
  try {
    localStorage.setItem(
      "nexus-settings",
      JSON.stringify({
        sensitivity: state.sensitivity,
        invertY: state.invertY,
        gameMode: state.gameMode,
        graphics: $("set-graphics")?.value || "medium",
        showQuests: $("set-quests")?.checked !== false,
        showControls: $("set-controls")?.checked !== false,
        showMinimap: $("set-minimap")?.checked !== false,
        weather: state.weather || "spring",
      })
    );
  } catch (_) {
    /* private mode etc */
  }
}

function applyGraphics(level, toastMsg = true) {
  if (level === "low") {
    PERF.pixelRatio = 1;
    PERF.shadows = false;
    PERF.minimapEvery = 6;
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;
    sun.castShadow = false;
  } else if (level === "high") {
    PERF.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    PERF.shadows = true;
    PERF.minimapEvery = 2;
    renderer.setPixelRatio(PERF.pixelRatio);
    renderer.shadowMap.enabled = true;
    sun.castShadow = true;
  } else {
    // MEDIUM (default): soft shadows on — the realistic look, still smooth on most machines
    PERF.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
    PERF.shadows = true;
    PERF.minimapEvery = 4;
    renderer.setPixelRatio(PERF.pixelRatio);
    renderer.shadowMap.enabled = true;
    sun.castShadow = true;
  }
  if (toastMsg) toast(`Graphics: ${level}`, "reward");
}

function openSettings() {
  if (!state.started) return;
  state.settingsOpen = true;
  settingsPanel.classList.remove("hidden");
  // Unlock mouse so you can click options in-game
  if (document.pointerLockElement) document.exitPointerLock();
  state.paused = true;
  $("pause-menu")?.classList.add("hidden");
}

function closeSettings() {
  if (!state.settingsOpen) return;
  state.settingsOpen = false;
  settingsPanel.classList.add("hidden");
  saveSettings();
  state.paused = false;
  if (state.started) {
    canvas.requestPointerLock?.();
    state.clock.getDelta();
  }
}

function setupSettingsUI() {
  // Click Settings in the top-left HUD
  const onSettingsClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (state.settingsOpen) closeSettings();
    else openSettings();
  };
  settingsBtn?.addEventListener("click", onSettingsClick);
  settingsBtn?.addEventListener("mousedown", (e) => {
    // Beat canvas pointer-lock capture when cursor is free
    e.stopPropagation();
  });
  settingsClose?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeSettings();
  });
  settingsDone?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeSettings();
  });
  settingsPanel?.addEventListener("click", (e) => {
    if (e.target === settingsPanel) closeSettings();
  });

  $("set-sensitivity")?.addEventListener("input", (e) => {
    state.sensitivity = Number(e.target.value) || 1;
    $("set-sensitivity-val").textContent = state.sensitivity.toFixed(1);
  });
  $("set-inverty")?.addEventListener("change", (e) => {
    state.invertY = e.target.checked;
  });
  $("set-graphics")?.addEventListener("change", (e) => {
    applyGraphics(e.target.value, true);
  });
  $("set-quests")?.addEventListener("change", (e) => {
    $("quest-panel")?.classList.toggle("hidden-by-settings", !e.target.checked);
  });
  $("set-controls")?.addEventListener("change", (e) => {
    $("controls-help")?.classList.toggle("hidden", !e.target.checked);
  });
  $("set-minimap")?.addEventListener("change", (e) => {
    $("minimap-frame")?.classList.toggle("hidden", !e.target.checked);
  });

  // AFK / Survival mode cards
  document.querySelectorAll(".mode-card[data-mode]").forEach((card) => {
    card.addEventListener("click", (e) => {
      e.stopPropagation();
      setGameMode(card.dataset.mode, true);
      saveSettings();
    });
  });

  // Weather cards: Spring · Thunder · Snow
  document.querySelectorAll(".weather-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      e.stopPropagation();
      setWeather(card.dataset.weather, true);
      saveSettings();
    });
  });

  loadSettings();
}

function setupInput() {
  window.addEventListener("keydown", (e) => {
    state.keys[e.code] = true;
    if (e.code === "Escape") {
      if (state.leaderboardOpen) {
        closeLeaderboard();
        return;
      }
      if (state.inventoryOpen) {
        closeInventory();
        return;
      }
      if (state.calendarOpen) {
        closeCalendar();
        return;
      }
      if (state.settingsOpen) {
        closeSettings();
        return;
      }
      togglePause();
      return;
    }
    // I = inventory (blue panel · fidget powers forever)
    if (state.started && e.code === "KeyI" && !e.repeat) {
      e.preventDefault();
      if (state.settingsOpen) return;
      toggleInventory();
      return;
    }
    // O = open Settings while in-game (works even with mouse locked)
    if (state.started && (e.code === "KeyO") && !e.repeat) {
      e.preventDefault();
      if (state.settingsOpen) closeSettings();
      else openSettings();
      return;
    }
    // M = calendar (works even while calendar is open, to close)
    if (state.started && e.code === "KeyM" && !e.repeat) {
      e.preventDefault();
      if (state.settingsOpen) return;
      toggleCalendar();
      return;
    }
    // Boarding / talk — works even if soft-paused (calendar), but not in settings
    if (state.started && !state.settingsOpen && e.code === "KeyE" && !e.repeat) {
      e.preventDefault();
      state.paused = false;
      $("pause-menu")?.classList.add("hidden");
      // Lucas on Snow Dome first
      if (state.nearLucas || nearestLucas(6.5)) {
        talkToLucas();
        return;
      }
      tryBoardNearest();
      return;
    }
    // Y = fly-home picture — works even if soft-paused / cinema open
    // (must run BEFORE the paused early-return)
    if (
      state.started &&
      !state.settingsOpen &&
      e.code === "KeyY" &&
      !e.repeat &&
      !state.spiderOffer &&
      !state.spiderGame &&
      !state.toyStoryLoading &&
      !state.earthReturnLoading
    ) {
      e.preventDefault();
      startEarthReturnLoading();
      return;
    }
    if (!state.started || state.paused || state.settingsOpen) return;

    // Near pirate: 1 guitar · 2 diving suit · 3–5 snacks
    if (state.nearPirate && !state.inVehicle) {
      if (e.code === "Digit1") {
        state.pirateOffer = 0;
        return;
      }
      if (e.code === "Digit2") {
        state.pirateOffer = 1;
        return;
      }
      if (e.code === "Digit3") {
        state.pirateOffer = 2;
        state.foodChoice = 0;
        return;
      }
      if (e.code === "Digit4") {
        state.pirateOffer = 3;
        state.foodChoice = 1;
        return;
      }
      if (e.code === "Digit5") {
        state.pirateOffer = 4;
        state.foodChoice = 2;
        return;
      }
    }
    if (e.code === "Digit1") setSlot(1);
    if (e.code === "Digit2") setSlot(2);
    if (e.code === "Digit3") setSlot(3);
    if (e.code === "Digit4") setSlot(4);
    if (e.code === "KeyR" && !e.repeat) {
      if (state.racing) endRace(false);
      else startRace();
    }
    // KeyE handled above (boarding)

    // U = Iron Man rocket mini cartoons
    if (e.code === "KeyU" && !e.repeat) {
      toggleRocketCinema();
    }
    // In Iron Man rocket: 1–4 shows, 5–7 transform (when cinema open or always in rocket)
    if (isInIronManRocket() && !e.repeat) {
      if (e.code === "Digit1") {
        if (!state.cinemaOpen) openRocketCinema("spiderman");
        else setRocketShow("spiderman");
        return;
      }
      if (e.code === "Digit2") {
        if (!state.cinemaOpen) openRocketCinema("toystory");
        else setRocketShow("toystory");
        return;
      }
      if (e.code === "Digit3") {
        if (!state.cinemaOpen) openRocketCinema("avengers");
        else setRocketShow("avengers");
        return;
      }
      if (e.code === "Digit4") {
        if (!state.cinemaOpen) openRocketCinema("terminator");
        else setRocketShow("terminator");
        return;
      }
      if (e.code === "Digit5") {
        transformIronManRocket("white");
        return;
      }
      if (e.code === "Digit6") {
        transformIronManRocket("purple");
        return;
      }
      if (e.code === "Digit7") {
        transformIronManRocket("red");
        return;
      }
    }
    // T = accept pirate offer (guitar / diving suit / snack)
    if (e.code === "KeyT" && !e.repeat && !state.inVehicle) {
      if (state.nearPirate) choosePirateOffer();
    }
    // Fidget shop offer UI — T try first listed unowned, or N cancel
    if (state.niftyBundleOffer && !e.repeat) {
      if (e.code === "KeyT") {
        // Try first unowned fidget (or cycle nifty → venom → waterdino)
        const order = ["nifty", "venom", "waterdino"];
        const pick = order.find((k) => !hasInvItem(k)) || "nifty";
        startFidgetTrial(pick);
        return;
      }
      if (e.code === "KeyN" || e.code === "Escape") {
        cancelNiftyBundleOffer();
        return;
      }
    }
    // During free fidget try: D or Enter ends try early
    if (state.fidgetTrial && !e.repeat && (e.code === "KeyD" || e.code === "Enter")) {
      endFidgetTrial("done");
      return;
    }
    // Near fidget shop — B/E opens buy menu (each item expensive, separate)
    if (state.nearNiftyBundle && !e.repeat && !state.inVehicle && !state.michaelRocketChoice) {
      if (e.code === "KeyB" || e.code === "KeyE") {
        openNiftyBundleOffer();
        return;
      }
    }
    // Equip if you bought it OR on free try
    if (!e.repeat && !state.inVehicle && !state.cinemaOpen) {
      if (e.code === "Digit8") {
        if (canUseFidget("nifty")) equipSword("nifty");
        else toast(`Buy Nifty for ${NIFTY_SWORDS.nifty.price}🟢 or TRY free 30s at shop`, "kill");
        return;
      }
      if (e.code === "Digit9") {
        if (canUseFidget("venom")) equipSword("venom");
        else toast(`Buy Venom for ${NIFTY_SWORDS.venom.price}🟢 or TRY free 30s at shop`, "kill");
        return;
      }
      if (e.code === "Digit0") {
        if (canUseFidget("waterdino")) equipSword("waterdino");
        else toast(`Buy Water Dino for ${NIFTY_SWORDS.waterdino.price}🟢 or TRY free 30s at shop`, "kill");
        return;
      }
      if (e.code === "KeyH" && !state.spiderGame) {
        if (hasInvItem("hatPower") || (state.fidgetTrial && state.fidgetTrial.kind === "nifty")) {
          applyHatPower(!state.hatPowerOn);
        } else toast("Hat Power comes when you BUY Nifty (or during free try)", "kill");
        return;
      }
      if (e.code === "KeyG" && !state.spiderGame) {
        waterDinoPower2();
        return;
      }
    }
    // Buy / Try choice open (works near Michael or while trial UI is up)
    if (state.michaelRocketChoice && !e.repeat) {
      if (e.code === "KeyB" || e.code === "Digit1") {
        answerMichael("rocketBuy");
        return;
      }
      if (e.code === "KeyT" || e.code === "Digit2") {
        // Digit2 also opens rocket menu — only as TRY when choice is open
        answerMichael("rocketTry");
        return;
      }
      if (e.code === "KeyN" || e.code === "Escape") {
        state.michaelRocketChoice = false;
        showRocketOfferUI(false);
        state.michaelOffer = false;
        toast("Maybe later.", "");
        return;
      }
    }
    // During free try: D = Done (return rocket home)
    if (state.rocketTrial && !e.repeat && (e.code === "KeyD" || e.code === "Enter")) {
      endIronManRocketTrial("done");
      return;
    }
    // D near Michael = he drives rocket for 102 seconds (not while YOU are flying trial)
    if (
      e.code === "KeyD" &&
      !e.repeat &&
      !state.rocketTrial &&
      !state.inVehicle &&
      !state.michaelRocketChoice &&
      (state.nearMichael || nearestMichael(30))
    ) {
      startMichaelJoyride();
      return;
    }
    // B = board pirate boat
    if (e.code === "KeyB" && !e.repeat && !state.inVehicle && !state.michaelRocketChoice) {
      if (boardPirateBoat()) return;
    }
    // J = put on / take off red & black pirate clothes + red hat (on boat)
    if (e.code === "KeyJ" && !e.repeat && state.inVehicle) {
      toggleBoatPirateClothes();
      return;
    }
    // Spider-Man game offer Y/N (only when offered, not already in game)
    if (state.spiderOffer && !state.spiderGame && !e.repeat) {
      if (e.code === "KeyY") {
        startSpiderGame();
        return;
      }
      if (e.code === "KeyN") {
        state.spiderOffer = false;
        toast("Maybe later!", "");
        return;
      }
    }
    // Y inside Spider-Man game = friends mode (stop attacking · talk · powers)
    if (state.spiderGame && e.code === "KeyY" && !e.repeat) {
      toggleSpiderFriendly();
      return;
    }
    // H = Home from Spider-Man game
    if (e.code === "KeyH" && !e.repeat && state.spiderGame) {
      exitSpiderGame();
      return;
    }
    // Spider: F = webs · R or click = fight
    if (state.spiderGame && e.code === "KeyF" && !e.repeat) {
      shootSpiderWeb();
      return;
    }
    if (state.spiderGame && e.code === "KeyR" && !e.repeat) {
      spiderFight();
      return;
    }
    // Near Michael garage: 1 Jell-O · 2 rocket BUY/TRY · 3 mask · 4–6 suits · 7 dino
    if (state.nearMichael && !state.inVehicle) {
      if (e.code === "Digit1" && !e.repeat) {
        answerMichael("spaghetti");
        return;
      }
      if (e.code === "Digit2" && !e.repeat) {
        answerMichael("rocket");
        return;
      }
      if (e.code === "Digit3" && !e.repeat) {
        answerMichael("mask");
        return;
      }
      if (e.code === "Digit4" && !e.repeat) {
        answerMichael("mark3");
        return;
      }
      if (e.code === "Digit5" && !e.repeat) {
        answerMichael("gold");
        return;
      }
      if (e.code === "Digit6" && !e.repeat) {
        answerMichael("warmachine");
        return;
      }
      if (e.code === "Digit7" && !e.repeat) {
        answerMichael("dino");
        return;
      }
      if (e.code === "KeyN" && !e.repeat) {
        answerMichael("no");
        return;
      }
    }
    // Ladder / tree: K = climb on, X = jump off
    if (e.code === "KeyK" && !e.repeat && !state.inVehicle) {
      if (!tryMountTree()) tryMountLadder();
    }
    if (e.code === "KeyX" && !e.repeat && (state.climbing || state.onTree)) {
      if (state.onTree || state.climbKind === "tree") jumpOffTree();
      else jumpOffLadder();
    }
    // Z = ZZZ sleep (or jump off tree/ladder only with X now)
    if (e.code === "KeyZ" && !e.repeat) {
      if (state.climbing || state.onTree) {
        if (state.onTree || state.climbKind === "tree") jumpOffTree();
        else jumpOffLadder();
      } else if (!state.inVehicle) {
        toggleSleep();
      }
    }
    // Space while on tree canopy = jump off
    if (
      (e.code === "Space" || e.code === "Spacebar") &&
      !e.repeat &&
      state.onTree
    ) {
      e.preventDefault();
      jumpOffTree();
    }
    // Space while climbing ladder = jump off → noodle bounce
    if (
      (e.code === "Space" || e.code === "Spacebar") &&
      !e.repeat &&
      state.climbing &&
      state.climbKind === "ladder"
    ) {
      e.preventDefault();
      jumpOffLadder();
    }
    // F or L = LION form
    if ((e.code === "KeyF" || e.code === "KeyL") && !e.repeat && !state.inVehicle && !state.climbing && !state.onTree && !state.spiderGame) {
      e.preventDefault();
      if (typeof toggleTigerForm === "function") toggleTigerForm();
    }
    // G = lion ROAR (or click roar intent)
    if (e.code === "KeyG" && !e.repeat && state.tigerForm) {
      e.preventDefault();
      playLionRoar();
    }
    // J = lion pounce jump
    
    // Talk to Lucas (#1 · 3.6M wins)
    if (e.code === "KeyE" && !e.repeat && state.nearLucas && !state.inVehicle) {
      e.preventDefault();
      talkToLucas();
      return;
    }
if (e.code === "KeyJ" && !e.repeat && state.tigerForm) {
      e.preventDefault();
      lionPounceJump();
    }
    if (e.code === "KeyC") tryReload();
    // V = turn around / see full character (front view)
    if (e.code === "KeyV" && !e.repeat && !state.inVehicle) {
      toggleTurnAround();
    }
  });
  window.addEventListener("keyup", (e) => {
    state.keys[e.code] = false;
  });

  document.addEventListener("mousemove", (e) => {
    if (!state.pointerLocked || state.paused || state.settingsOpen) return;
    state.mouse.dx += e.movementX;
    state.mouse.dy += e.movementY;
  });

  document.addEventListener("mousedown", (e) => {
    if (!state.started || state.paused || state.settingsOpen) return;
    if (!state.pointerLocked) {
      canvas.requestPointerLock();
      return;
    }
    if (e.button === 0) {
      if (state.spiderGame) {
        // Left click = FIGHT punch
        spiderFight();
        return;
      }
      if (state.inVehicle) return;
      shoot();
    }
    // Middle mouse = turn around / full character view
    if (e.button === 1) {
      e.preventDefault();
      if (!state.inVehicle) toggleTurnAround();
    }
    if (e.button === 2) {
      e.preventDefault();
      if (!state.inVehicle) placeBlock();
    }
  });

  document.addEventListener("contextmenu", (e) => e.preventDefault());

  // Click 😴 ZZZ → lay down on ground and sleep
  const sleepBtn = $("sleep-btn");
  sleepBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!state.started || state.settingsOpen) return;
    if (state.calendarOpen) closeCalendar();
    if (state.paused && !player.sleeping) return;
    toggleSleep();
  });
  sleepBtn?.addEventListener("mousedown", (e) => {
    // Don't steal pointer lock fight — just sleep
    e.stopPropagation();
  });

  // Click 📅 M → open calendar (July–December)
  const calBtn = $("calendar-btn");
  calBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!state.started || state.settingsOpen) return;
    toggleCalendar();
  });
  calBtn?.addEventListener("mousedown", (e) => e.stopPropagation());
  $("cal-close")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeCalendar();
  });
  $("calendar-panel")?.addEventListener("click", (e) => {
    if (e.target === $("calendar-panel")) closeCalendar();
  });

  // Iron Man TV channel buttons + transform
  document.querySelectorAll(".cinema-channels button").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.id === "earth-return-btn") {
        startEarthReturnLoading();
        return;
      }
      if (btn.dataset.show) {
        // Toy Story always runs the 11s space loading → Avengers
        if (btn.dataset.show === "toystory") {
          startToyStoryLoading();
          return;
        }
        if (!state.cinemaOpen) openRocketCinema(btn.dataset.show);
        else setRocketShow(btn.dataset.show);
      }
    });
    btn.addEventListener("mousedown", (e) => e.stopPropagation());
  });
  // Also bind standalone if button is outside the loop later
  $("earth-return-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    startEarthReturnLoading();
  });
  document.querySelectorAll(".cinema-transform button").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.dataset.skin) transformIronManRocket(btn.dataset.skin);
    });
    btn.addEventListener("mousedown", (e) => e.stopPropagation());
  });

  // Scroll wheel / trackpad: zoom out = see yourself, zoom in = first person
  const onZoomWheel = (e) => {
    if (!state.started || state.settingsOpen) return;
    if (state.inVehicle) return;
    e.preventDefault();
    // Normalize trackpad + mouse wheel
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16; // lines
    if (e.deltaMode === 2) delta *= 40; // pages
    // Scroll down / pinch out → zoom out (see character)
    const step = THREE.MathUtils.clamp(delta * 0.012, -1.4, 1.4);
    const prev = player.camDistTarget;
    player.camDistTarget = THREE.MathUtils.clamp(
      player.camDistTarget + step,
      CAM_DIST_MIN,
      CAM_DIST_MAX
    );
    // First time entering third person → snap to a good view
    if (prev <= CAM_DIST_THIRD && player.camDistTarget > CAM_DIST_THIRD) {
      player.camDistTarget = Math.max(player.camDistTarget, CAM_DIST_DEFAULT_TP);
      if (!state._shownSelfToast) {
        state._shownSelfToast = true;
        toast("Third person — scroll more to zoom · scroll in for FPS", "quest");
      }
    }
  };
  // Click the yellow interact prompt to board
  const interactPrompt = $("interact-prompt");
  interactPrompt?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!state.started) return;
    state.paused = false;
    tryBoardNearest();
  });

  // Listen on window so it works with pointer lock + trackpads
  window.addEventListener("wheel", onZoomWheel, { passive: false });

  document.addEventListener("pointerlockchange", () => {
    state.pointerLocked = document.pointerLockElement === canvas;
    if (!state.pointerLocked && state.started && !state.paused) {
      // Don't auto-pause on brief unlock; user can ESC
    }
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function setSlot(i) {
  // Hotbar: 1 dirt · 2 wood · 3 crystal · 4 hands (no gun)
  // Switching to blocks = put sword away into inventory forever
  if (state.activeSword) unequipSword();
  state.slot = Math.max(1, Math.min(4, i | 0));
  weaponGroup.visible = false;
  if (!state.racing) setMode("BUILD");
  updateHUD();
}

// Click hotbar slots
document.querySelectorAll(".slot").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const n = Number(el.dataset.slot);
    if (n >= 1 && n <= 4) setSlot(n);
  });
});

function togglePause() {
  if (!state.started) return;
  if (state.settingsOpen) {
    closeSettings();
    return;
  }
  state.paused = !state.paused;
  $("pause-menu").classList.toggle("hidden", !state.paused);
  if (state.paused) {
    document.exitPointerLock();
    state.clock.getDelta(); // flush
  } else {
    canvas.requestPointerLock();
    state.clock.getDelta();
  }
  updateHUD();
}

// ─────────────────────────────────────────────────────────────
// UPDATE LOOP
// ─────────────────────────────────────────────────────────────
function update(dt) {
  state.elapsed += dt;
  state.fireCooldown = Math.max(0, state.fireCooldown - dt);
  state.invuln = Math.max(0, state.invuln - dt);
  state.comboTimer -= dt;
  if (state.comboTimer <= 0) {
    state.combo = 0;
    $("combo-display").classList.add("hidden");
  }

  // Look (sensitivity from Settings)
  const lookSens = 0.0022 * (state.sensitivity || 1);
  const ySign = state.invertY ? -1 : 1;
  if (!state.inVehicle) {
    player.yaw -= state.mouse.dx * lookSens;
    player.pitch -= state.mouse.dy * lookSens * ySign;
    player.pitch = THREE.MathUtils.clamp(player.pitch, -1.4, 1.4);
  } else {
    player.pitch -= state.mouse.dy * 0.0015 * (state.sensitivity || 1) * ySign;
    player.pitch = THREE.MathUtils.clamp(player.pitch, -0.4, 0.35);
  }
  state.mouse.dx = 0;
  state.mouse.dy = 0;

  // Ladder / tree proximity
  updateLadderProximity();
  state.nearTree = !state.climbing && !state.onTree && !state.inVehicle ? nearestClimbableTree() : null;
  state.nearPirate = !state.inVehicle && !state.climbing && !state.onTree && !player.sleeping && !!nearestPirate();
  state.nearLucas = !!(nearestLucas && nearestLucas(5.5));
  if (state.nearLucas && !state.wasNearLucas) {
    toast("👑 Lucas is here — 3.6M wins · press E to talk", "quest");
  }
  state.wasNearLucas = state.nearLucas;

  state.nearMichael =
    !state.inVehicle && !state.climbing && !state.onTree && !player.sleeping && !!nearestMichael();
  state.nearNiftyBundle =
    !state.inVehicle && !state.climbing && !state.onTree && !player.sleeping && !!nearestNiftyBundle(7.5);
  state.nearTreasure =
    !state.inVehicle && !state.climbing && !player.sleeping ? nearestTreasure(3.5) : null;
  state.nearGate =
    !state.inVehicle && !state.climbing && !player.sleeping ? nearestGate(4.5) : null;
  state.nearUgc =
    !state.inVehicle && state.ugcHolder
      ? Math.hypot(player.pos.x - state.ugcHolder.x, player.pos.z - state.ugcHolder.z) < 4.5
      : false;
  state.nearSandRoom =
    !state.inVehicle && !player.sleeping ? nearestSandRoom(4.5) : null;
  // Woody offers Spider-Man game once when approached
  if (state.nearUgc && !state.wasNearUgc && !state.spiderGame) {
    offerSpiderGame();
  }
  state.wasNearUgc = state.nearUgc;
  // Pirate greets Ron (calls him Ryan) when you walk up
  if (state.nearPirate && !state.wasNearPirate) onPirateApproach();
  if (!state.nearPirate && state.wasNearPirate) {
    // Left the pirate — can hear the greeting again next visit
    state.pirateGreeted = false;
  }
  state.wasNearPirate = state.nearPirate;
  // Michael greets once when approached
  if (state.nearMichael && !state.wasNearMichael) {
    talkToMichael();
  }
  if (!state.nearMichael) state.michaelOffer = false;
  state.wasNearMichael = state.nearMichael;
  if (state.eatCooldown > 0) state.eatCooldown -= dt;

  if (player.sleeping) {
    updateSleeping(dt);
  } else if (state.inVehicle && state.vehicle) {
    updateVehicle(dt);
  } else if (state.onTree || (state.climbing && state.climbKind === "tree")) {
    updateTreeClimb(dt);
  } else if (state.climbing) {
    updateLadderClimb(dt);
  } else {
    updateOnFoot(dt);
  }

  updateEatAnim(dt);
  updateMichaelBuilders(dt);
  updateRocketTrial(dt);
  updateMichaelJoyride(dt);
  updateNiftyPower(dt);
  updateFidgetTrial(dt);
  updateTreasure(dt);
  updateSandRoom(dt);
  updateSpiderGame(dt);
  drawRocketCinemaFrame(dt);
  updateSpeechBubble(dt);

  // Collectibles (skip far ones for bob/collect checks)
  const pCollect = state.inVehicle ? state.vehicle.group.position : player.pos;
  for (let i = collectibles.length - 1; i >= 0; i--) {
    const c = collectibles[i];
    if (!c.mesh.parent) continue;
    const dx = c.mesh.position.x - pCollect.x;
    const dz = c.mesh.position.z - pCollect.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > 2500) continue; // >50 units away: skip animation
    c.bob += dt * 2;
    c.mesh.rotation.y += dt * 2;
    c.mesh.position.y = (c.baseY || 1.2) + Math.sin(c.bob) * 0.25;
    if (d2 < 3.24) {
      // ~1.8 units
      scene.remove(c.mesh);
      collectibles.splice(i, 1);
      if (c.type === "purpleGem") {
        addPurpleGems(1);
        addXP(20);
        addCoins(15);
        playTone(660, 0.08, "sine", 0.1);
        playTone(990, 0.12, "triangle", 0.08);
        toast("+1 UNIQUE PURPLE GEM 💜 · costume currency!", "reward");
        progressQuest("purpleGems", 1);
        // Respawn rare purple gem elsewhere after a while
        setTimeout(() => {
          spawnPurpleGem((Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200);
        }, 22000);
      } else {
        addGems(1);
        addXP(12);
        addCoins(20);
        toast("+1 crystal gem · +20 coins", "reward");
        progressQuest("gems", 1);
        setTimeout(() => {
          spawnCrystal((Math.random() - 0.5) * 150, (Math.random() - 0.5) * 150);
        }, 12000);
      }
    }
  }

  updateEnemies(dt);
  if (state.racing) updateRace(dt);

  // Near vehicle / ladder / pirate / tree prompts
  state.nearVehicle = state.inVehicle || state.climbing || state.onTree || player.sleeping ? null : nearestVehicle();
  const prompt = $("interact-prompt");
  if (player.sleeping) {
    prompt.classList.remove("hidden");
    prompt.innerHTML = `😴 <b>Ron</b> is sleeping… <b>Zzz</b> · press <kbd>Z</kbd> to wake up`;
  } else if (state.onTree) {
    prompt.classList.remove("hidden");
    prompt.innerHTML = `🌳 On the tree — <kbd>WASD</kbd> walk · <kbd>X</kbd> or <kbd>Space</kbd> jump off`;
  } else if (state.climbing && state.climbKind === "tree") {
    prompt.classList.remove("hidden");
    prompt.innerHTML = `🌳 Tree: <kbd>W</kbd> up · <kbd>S</kbd> down · walk on top · <kbd>X</kbd> jump off`;
  } else if (state.climbing) {
    prompt.classList.remove("hidden");
    prompt.innerHTML = `🪜 Climb: <kbd>W</kbd> up · <kbd>S</kbd> down · mountain or ladder · <kbd>X</kbd> jump off`;
  } else if (state.rocketTrial) {
    prompt.classList.remove("hidden");
    prompt.innerHTML = `🚀 <b>FREE TRY</b> · <b>${Math.ceil(state.rocketTrialLeft)}s</b> left · bring rocket back to Michael · <kbd>D</kbd> or click <b>DONE</b>`;
  } else if (state.michaelJoyride) {
    prompt.classList.remove("hidden");
    prompt.innerHTML = `🚀 <b>Michael</b> is flying his rocket! <b>${Math.ceil(state.michaelJoyrideLeft)}s</b> left of ${MICHAEL_JOYRIDE_SECONDS}s`;
  } else if (state.michaelRocketChoice) {
    prompt.classList.remove("hidden");
    prompt.innerHTML = `🚀 Iron Man rocket — <kbd>B</kbd> <b>BUY</b> ${MICHAEL_ROCKET_PRICE}🟢 (real money) · <kbd>T</kbd> <b>TRY</b> free 20s · <kbd>N</kbd> cancel · you: ${state.coins}🟢`;
  } else if (state.nearGate) {
    prompt.classList.remove("hidden");
    const open = state.gateDoor && state.gateDoor.open;
    prompt.innerHTML = open
      ? `🚪 <b>Gate OPEN</b> — press <kbd>E</kbd> to close`
      : `🚪 <b>Gate door</b> — press <kbd>E</kbd> to OPEN and walk through`;
  } else if (state.spiderGame) {
    prompt.classList.remove("hidden");
    prompt.innerHTML = state.spiderFriendly
      ? `✌️ <b>FRIENDS</b> · they talk + powers · <kbd>Y</kbd> fight again · <kbd>H</kbd> HOME`
      : `🐦 <b>Bird Spider-Man</b> · Click FIGHT · <kbd>Y</kbd> friends/talk · <kbd>F</kbd> webs · <kbd>H</kbd> HOME`;
  } else if (state.spiderOffer) {
    prompt.classList.remove("hidden");
    prompt.innerHTML = `🕷 Do you wanna play the Spider-Man game? <kbd>Y</kbd> YES → jungle world · <kbd>N</kbd> NO`;
  } else if (state.nearUgc) {
    prompt.classList.remove("hidden");
    prompt.innerHTML = `🤠 <b>Woody</b> (Toy Story) · holds treasure · Do you wanna play Spider-Man? <kbd>Y</kbd> jungle · <kbd>N</kbd> no`;
  } else if (state.nearTreasure) {
    prompt.classList.remove("hidden");
    prompt.innerHTML = `🧰 <b>Treasure chest</b> on the sand! Press <kbd>E</kbd> to open — free purple gems 💜`;
  } else if (state.fidgetTrial) {
    prompt.classList.remove("hidden");
    const ft = state.fidgetTrial;
    const nm = NIFTY_SWORDS[ft.kind]?.name || "Fidget";
    prompt.innerHTML = `⏱️ <b>FREE TRY</b> · ${nm} · <b>${Math.ceil(ft.left)}s</b> left · then gone · <kbd>D</kbd> done · BUY with 🟢 to keep`;
  } else if (state.nearNiftyBundle) {
    prompt.classList.remove("hidden");
    if (!isNiftyBundleOnSale()) {
      prompt.innerHTML = `⏰ <b>Fidget shop closed</b> — only open through <b>November</b>`;
    } else {
      prompt.innerHTML = `💎 <b>FIDGET SHOP</b> · <kbd>B</kbd> open · <b>TRY free 30s</b> or <b>BUY</b> with 🟢 · you: <b>${state.coins}</b>🟢 · <kbd>I</kbd> bag`;
    }
  } else if (state.nearLucas) {
    prompt.classList.remove("hidden");
    prompt.innerHTML = `👑 <b>Lucas</b> · #1 with <b>3.6M wins</b> · press <kbd>E</kbd> to talk · 🏆 Leaderboard`;
  } else if (state.nearMichael) {
    prompt.classList.remove("hidden");
    const owned = state.rocketOwned;
    const pg = state.purpleGems || 0;
    prompt.innerHTML = owned
      ? `🔧 <b>Michael's</b> · <kbd>1</kbd> 🍝 Spaghetti · <kbd>D</kbd> he flies · you: ${state.coins}🟢 <b>${pg}</b>💜 · <kbd>E</kbd> rocket · 🌪️ bundle next door`
      : `🔧 <b>Michael's</b> · <kbd>1</kbd> 🍝 Spaghetti · <kbd>2</kbd> Rocket · 🌪️ <b>BUY BUNDLE</b> next door · you: ${state.coins}🟢`;
  } else if (state.inVehicle && state.vehicle?.subtype === "pirate") {
    prompt.classList.remove("hidden");
    prompt.innerHTML = `🏴‍☠️ <b>On boat!</b> <kbd>J</kbd> red/black pirate clothes + red hat · <kbd>W</kbd>/<kbd>S</kbd> drive · <kbd>A</kbd>/<kbd>D</kbd> turn · <kbd>E</kbd> leave`;
  } else if (state.nearPirate) {
    prompt.classList.remove("hidden");
    const offers = [
      { i: 0, emoji: "🎸", name: "Guitar music" },
      { i: 1, emoji: "🤿", name: "Diving suit swim" },
      { i: 2, emoji: "🐟", name: "Salmon" },
      { i: 3, emoji: "🔵🍌", name: "Blue banana" },
      { i: 4, emoji: "🍫", name: "Bar" },
    ];
    const opts = offers
      .map((f) => {
        const sel = f.i === state.pirateOffer ? "selected" : "";
        return `<span class="food-opt ${sel}">[${f.i + 1}] ${f.emoji} ${f.name}</span>`;
      })
      .join(" ");
    prompt.innerHTML = `🏴‍☠️ Hey <b>Ron</b>! <kbd>B</kbd> board (WHITE suit + mask) · ${opts} — <kbd>T</kbd>`;
  } else if (state.nearTree && !state.inVehicle) {
    prompt.classList.remove("hidden");
    prompt.innerHTML = `Press <kbd>K</kbd> to climb the <b>tree</b> · <kbd>X</kbd>/<kbd>Space</kbd> jump off on top`;
  } else if (state.nearLadder && !state.inVehicle) {
    prompt.classList.remove("hidden");
    const climb = state._activeClimb;
    prompt.innerHTML = climb && climb.kind === "mountain"
      ? `⛰ <b>${climb.name}</b> — press <kbd>K</kbd> to CLIMB · <kbd>W</kbd> up · stand on top (not inside)`
      : `🪜 Ladder — press <kbd>K</kbd> to climb · <kbd>W</kbd> up · <kbd>S</kbd> down · <kbd>X</kbd> jump off`;
  } else if (state.nearVehicle) {
    prompt.classList.remove("hidden");
    if (state.nearVehicle.subtype === "ironman") {
      prompt.innerHTML = `🚀 Press <kbd>E</kbd> (or click) to board the <b>IRON MAN ROCKET</b>`;
    } else if (state.nearVehicle.type === "rocket") {
      prompt.innerHTML = `🚀 Press <kbd>E</kbd> (or click) to board the <b>rocket</b>`;
    } else if (state.nearVehicle.type === "airplane") {
      prompt.innerHTML = `🛩️ Press <kbd>E</kbd> (or click) to board the <b>airplane</b>`;
    } else if (state.nearVehicle.type === "jet") {
      prompt.innerHTML = `✈️ Press <kbd>E</kbd> (or click) to board the <b>JET</b>`;
    } else if (state.nearVehicle.subtype === "pirate") {
      prompt.innerHTML = `🏴‍☠️ Press <kbd>B</kbd> or <kbd>E</kbd> to board · then <kbd>J</kbd> for red/black pirate clothes`;
    } else if (state.nearVehicle.type === "boat") {
      prompt.innerHTML = `⛵ Press <kbd>E</kbd> (or click) to sail the <b>boat</b>`;
    } else {
      prompt.innerHTML = `Press <kbd>E</kbd> (or click) to enter`;
    }
  } else if (
    state.inVehicle &&
    (state.vehicle?.type === "rocket" || state.vehicle?.type === "jet" || state.vehicle?.type === "airplane")
  ) {
    prompt.classList.remove("hidden");
    if (state.vehicle.subtype === "ironman") {
      prompt.innerHTML = `🚀 <b>Iron Man</b> · <kbd>W</kbd> thrust · <kbd>U</kbd> cartoons · <kbd>5</kbd> white · <kbd>6</kbd> purple · <kbd>7</kbd> red · <kbd>E</kbd> exit`;
    } else {
      const icon = state.vehicle.type === "jet" ? "✈️" : state.vehicle.type === "airplane" ? "🛩️" : "🚀";
      prompt.innerHTML = `${icon} <kbd>W</kbd> thrust · <kbd>Space</kbd> climb · <kbd>Ctrl</kbd> dive · <kbd>A</kbd>/<kbd>D</kbd> turn · <kbd>E</kbd> exit`;
    }
  } else if (state.inVehicle && state.vehicle?.type === "boat") {
    prompt.classList.remove("hidden");
    prompt.innerHTML = `⛵ <kbd>W</kbd>/<kbd>S</kbd> sail · <kbd>A</kbd>/<kbd>D</kbd> turn · <kbd>E</kbd> exit`;
  } else if (!state.inVehicle && isInWater(player.pos.x, player.pos.y, player.pos.z)) {
    prompt.classList.remove("hidden");
    const deep = isUnderwater(player.pos.x, player.pos.y, player.pos.z);
    prompt.innerHTML = state.divingSuit
      ? `🤿 <b>Ron</b> diving suit${deep ? " · UNDERWATER" : ""} · WASD · <kbd>Space</kbd> up · <kbd>Ctrl</kbd> dive · look to steer`
      : `🏊${deep ? " Diving deep" : " Swimming"} · soaking wet · WASD · <kbd>Space</kbd> surface · <kbd>Ctrl</kbd> dive · look down to go deeper`;
  } else if (state.inVehicle && !state.racing) {
    prompt.classList.remove("hidden");
    prompt.innerHTML = `Press <kbd>E</kbd> exit`;
  } else {
    prompt.classList.add("hidden");
  }

  updateOceanLife(dt);
  if (typeof updateTigerAnim === "function") updateTigerAnim(dt);
  updateOceanWater(state.elapsed);
  updateSplashParticles(dt);
  updateApples();
  updateMonkeys(dt);
  updateSounds(dt);
  updateCrashingCraft(dt);
  updateBeachFishers(dt);
  updateTreeVines(dt);
  updatePandas(dt);
  // wildlife disabled — panda only
  if (typeof updateGrassSway === 'function') updateGrassSway(dt);

  // Occasional monkey chatter
  if (state.elapsed - SFX.lastMonkey > 4 + Math.random() * 5) {
    SFX.lastMonkey = state.elapsed;
    if (monkeys.length && Math.random() < 0.55) playMonkeySound();
  }

  // Particles (sparks, smoke, flash)
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    const lifeFrac = p.max ? Math.max(0, p.life / p.max) : Math.max(0, p.life);
    if (p.type === "spark") {
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 12 * dt;
      if (p.mesh.material && p.mesh.material.opacity != null) {
        p.mesh.material.opacity = Math.min(1, lifeFrac * 1.4);
      }
    } else if (p.type === "smoke") {
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y *= 1 - 0.15 * dt;
      p.vel.x *= 1 - 0.2 * dt;
      p.vel.z *= 1 - 0.2 * dt;
      // Drift + billow upward
      p.vel.x += (Math.random() - 0.5) * 0.8 * dt;
      p.vel.z += (Math.random() - 0.5) * 0.8 * dt;
      const grow = p.grow || 1.5;
      const s = 1 + (1 - lifeFrac) * grow;
      p.mesh.scale.setScalar(s);
      if (p.mesh.material) {
        p.mesh.material.opacity = Math.max(0, lifeFrac * 0.55);
      }
    } else if (p.type === "flash") {
      p.mesh.position.addScaledVector(p.vel || new THREE.Vector3(), dt);
      const grow = p.grow || 2;
      const s = 1 + (1 - lifeFrac) * grow;
      p.mesh.scale.setScalar(s);
      if (p.mesh.material) p.mesh.material.opacity = lifeFrac * 0.9;
    }
    if (p.life <= 0) {
      scene.remove(p.mesh);
      if (p.mesh.geometry && p.mesh.geometry !== GEO.spark) p.mesh.geometry.dispose();
      if (p.mesh.material && p.mesh.material.dispose && p.type !== "tracer") {
        // leave shared materials alone
      }
      particles.splice(i, 1);
    }
  }

  // Lasting crash fires (big flame + smoke)
  updateCrashFires(dt);

  // Lion roar camera shake
  if (state._roarShake && state._roarShake > 0) {
    state._roarShake = Math.max(0, state._roarShake - dt * 1.8);
    const s = state._roarShake;
    camera.position.x += (Math.random() - 0.5) * s * 0.35;
    camera.position.y += (Math.random() - 0.5) * s * 0.25;
  }
  // Smooth zoom (scroll target → actual distance)
  player.camDist += (player.camDistTarget - player.camDist) * Math.min(1, 12 * dt);
  const thirdPerson = !state.inVehicle && player.camDist > CAM_DIST_THIRD;

  // Force third person while parachuting / turn-around / sleeping / LION form so you SEE the character
  const showSelf =
    thirdPerson ||
    player.parachuting ||
    player.turnAround ||
    player.sleeping ||
    !!state.eatAnim ||
    !!state.tigerForm ||
    (state.inVehicle && state._seatedInCraft);
  // Lion form always keeps camera zoomed out enough to see the body
  if (state.tigerForm && player.camDistTarget < 11) {
    player.camDistTarget = 12;
  }
  if (player.parachuting && player.camDist < 4) {
    player.camDist = THREE.MathUtils.lerp(player.camDist, 5.5, Math.min(1, 4 * dt));
  }
  if ((player.turnAround || player.sleeping || state.eatAnim) && player.camDist < 4) {
    player.camDist = THREE.MathUtils.lerp(player.camDist, CAM_DIST_DEFAULT_TP, Math.min(1, 8 * dt));
  }

  // Avatar pose + visibility — show YOU when zoomed out or parachuting
  updateAvatar(dt, showSelf);

  // Camera
  if (state.inVehicle && state.vehicle) {
    // Keep YOU visible in the cockpit (seated + glowing glasses)
    if (state._seatedInCraft) {
      avatar.visible = true;
    } else {
      avatar.visible = false;
    }
    if (parachute) parachute.visible = false;
    weaponGroup.visible = false;
    const v = state.vehicle;
    if (v.type === "rocket") {
      const dist = 11;
      const height = 3.6;
      const behindX = Math.sin(v.yaw) * Math.cos(v.pitch) * dist;
      const behindY = -Math.sin(v.pitch) * dist + height;
      const behindZ = Math.cos(v.yaw) * Math.cos(v.pitch) * dist;
      const lerp = 1 - Math.pow(0.0005, dt);
      camera.position.x += (v.group.position.x + behindX - camera.position.x) * lerp;
      camera.position.y += (v.group.position.y + behindY - camera.position.y) * lerp;
      camera.position.z += (v.group.position.z + behindZ - camera.position.z) * lerp;
      // Look toward cockpit so you see the pilot
      camera.lookAt(
        v.group.position.x - Math.sin(v.yaw) * 0.4,
        v.group.position.y + 0.3,
        v.group.position.z - Math.cos(v.yaw) * 0.4
      );
      player.yaw = v.yaw;
    } else if (v.type === "boat") {
      // See yourself + the pirate on deck
      const dist = v.subtype === "pirate" ? 10 : 9;
      const height = v.subtype === "pirate" ? 5.2 : 4.5;
      const side = v.subtype === "pirate" ? 2.2 : 0;
      const behindX = Math.sin(v.yaw) * dist + Math.cos(v.yaw) * side;
      const behindZ = Math.cos(v.yaw) * dist - Math.sin(v.yaw) * side;
      const lerp = 1 - Math.pow(0.001, dt);
      camera.position.x += (v.group.position.x + behindX - camera.position.x) * lerp;
      camera.position.y += (v.group.position.y + height - camera.position.y) * lerp;
      camera.position.z += (v.group.position.z + behindZ - camera.position.z) * lerp;
      camera.lookAt(v.group.position.x, v.group.position.y + 1.2, v.group.position.z);
      player.yaw = v.yaw;
    } else if (v.type === "airplane") {
      // Chase cam from rear-quarter so you SEE Ron sitting with glowing glasses
      const dist = 12;
      const height = 4.8 + player.pitch * 2.2;
      const side = 3.2 + Math.sin(state.elapsed * 0.2) * 0.6; // side angle shows face + goggles
      const behindX = Math.sin(v.yaw) * dist + Math.cos(v.yaw) * side;
      const behindZ = Math.cos(v.yaw) * dist - Math.sin(v.yaw) * side;
      const ty = v.group.position.y + height;
      const lerp = 1 - Math.pow(0.0008, dt);
      camera.position.x += (v.group.position.x + behindX - camera.position.x) * lerp;
      camera.position.y += (ty - camera.position.y) * lerp;
      camera.position.z += (v.group.position.z + behindZ - camera.position.z) * lerp;
      // Aim at cockpit (glass + pilot)
      const lookX = v.group.position.x - Math.sin(v.yaw) * 0.6 + Math.cos(v.yaw) * 0.35;
      const lookZ = v.group.position.z - Math.cos(v.yaw) * 0.6 - Math.sin(v.yaw) * 0.35;
      camera.lookAt(lookX, v.group.position.y + 1.85, lookZ);
      player.yaw = v.yaw;
    } else {
      const behindX = Math.sin(v.yaw) * 9;
      const behindZ = Math.cos(v.yaw) * 9;
      const ty = v.group.position.y + 3.8 + player.pitch * 2;
      const lerp = 1 - Math.pow(0.001, dt);
      camera.position.x += (v.group.position.x + behindX - camera.position.x) * lerp;
      camera.position.y += (ty - camera.position.y) * lerp;
      camera.position.z += (v.group.position.z + behindZ - camera.position.z) * lerp;
      camera.lookAt(v.group.position.x, v.group.position.y + 1.2, v.group.position.z);
      player.yaw = v.yaw + Math.PI;
    }
  } else if (showSelf) {
    // Third person / parachute / turn-around: always see your character
    weaponGroup.visible = false;
    avatar.visible = true;

    const dist = Math.max(
      player.camDist,
      player.parachuting ? 5.5 : player.turnAround ? CAM_DIST_DEFAULT_TP : 2.2
    );
    // Turn-around: camera in FRONT of Ron so you see face + full body
    const yaw = player.yaw + (player.turnAround ? Math.PI : 0);
    // Clamp pitch so you don't flip under the ground / inside head
    const pitch = THREE.MathUtils.clamp(
      player.turnAround ? Math.min(player.pitch, 0.25) : player.pitch,
      -0.85,
      0.55
    );

    // Look-at point: chest/center of character
    const lookX = player.pos.x;
    const lookY = player.pos.y + 1.15;
    const lookZ = player.pos.z;

    // Place camera behind (or in front if turn-around) + above
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const camX = lookX + Math.sin(yaw) * cosP * dist;
    const camY = lookY + sinP * dist + 0.55 + dist * 0.08;
    const camZ = lookZ + Math.cos(yaw) * cosP * dist;

    camera.position.set(camX, Math.max(0.4, camY), camZ);
    camera.lookAt(lookX, lookY, lookZ);
  } else {
    // First person
    weaponGroup.visible = false;
    camera.position.set(player.pos.x, player.pos.y + player.height, player.pos.z);
    camera.rotation.order = "YXZ";
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
  }

  // Sun / moon + day-night (sleep → night, wake → day)
  updateSunVisual(dt);
  updateWeather(dt);

  // Underwater look: blue-green fog when diving (overrides day/night sky briefly)
  if (state.spiderGame) {
    applyJungleAtmosphere(true);
  } else if (isUnderwater(player.pos.x, player.pos.y, player.pos.z) && !state.inVehicle) {
    const depth = Math.min(1, (WATER_SURFACE - player.pos.y) / 10);
    // Real ocean underwater: teal-blue near surface → deep navy
    scene.fog.color.setHex(depth < 0.4 ? 0x0a4a6a : 0x021828);
    scene.fog.near = 2 + depth * 2;
    scene.fog.far = 30 + depth * 22;
    scene.background.setHex(depth < 0.4 ? 0x0c5a78 : 0x031a2a);
  }
  {
    const px = state.inVehicle && state.vehicle ? state.vehicle.group.position.x : player.pos.x;
    const pz = state.inVehicle && state.vehicle ? state.vehicle.group.position.z : player.pos.z;
    sun.target.position.set(px, 0, pz);
    sun.target.updateMatrixWorld();
    if (!sun.target.parent) scene.add(sun.target);
  }

  // Spin rooftop helicopter blades
  if (state._heliRotor) {
    state._heliRotor.blade1.rotation.y += dt * 10;
    state._heliRotor.blade2.rotation.y += dt * 10;
    if (state._heliRotor.tailRotor) state._heliRotor.tailRotor.rotation.x += dt * 22;
  }

  // Minimap every N frames
  state._mm = (state._mm || 0) + 1;
  if (state._mm % PERF.minimapEvery === 0) drawMinimap();
}

function lerpAngle(cur, target, t) {
  return cur + (target - cur) * t;
}

function updateAvatar(dt, thirdPerson) {
  // Seated pilot in airplane / craft — keep parented pose + glowing glasses
  if (state.inVehicle && state._seatedInCraft) {
    avatar.visible = true;
    if (parachute) parachute.visible = false;
    applyPilotSitPose(dt);
    if (typeof ensureHairOnHead === "function") ensureHairOnHead();
    return;
  }

  // Always show body when parachuting / sleeping / eating / LION form so you see yourself
  const forceShow =
    player.parachuting ||
    player.sleeping ||
    player.turnAround ||
    !!state.eatAnim ||
    !!state.tigerForm;
  if (!thirdPerson && !forceShow) {
    avatar.visible = false;
    if (parachute) parachute.visible = false;
    return;
  }
  avatar.visible = true;
  // Position/rotation applied below (standing vs laid-down sleep)
  if (!player.sleeping) {
    avatar.position.set(player.pos.x, player.pos.y, player.pos.z);
    avatar.rotation.order = "YXZ";
    avatar.rotation.x = 0;
    avatar.rotation.z = 0;
    avatar.rotation.y = player.yaw;
  }

  const spd = Math.hypot(player.vel.x, player.vel.z);
  const onGround = player.onGround;
  const moving = spd > 0.4 && onGround;
  const sprinting = moving && (state.keys["ShiftLeft"] || state.keys["ShiftRight"]);

  // Blocky character only (Soldier.glb off) — hide Ron mesh while LION form
  if (avBody) avBody.visible = !state.tigerForm;
  if (state.tigerForm) {
    const lion = state._tigerRoot || ensureYellowTiger();
    if (lion) lion.visible = true;
  } else if (state._tigerRoot) {
    state._tigerRoot.visible = false;
  }
  if (state.realPlayer && state.realPlayer.root) state.realPlayer.root.visible = false;

  // Smooth blend in/out of walk
  const ease = Math.min(1, 10 * dt);
  avAnim.walkWeight += ((moving ? 1 : 0) - avAnim.walkWeight) * ease;
  // Zoom out a bit while moving so you can SEE arms/legs swing
  if (moving && !state.inVehicle && player.camDistTarget < 3.2) {
    player.camDistTarget = 4.8;
  }
  avAnim.sprint += ((sprinting ? 1 : 0) - avAnim.sprint) * Math.min(1, 7 * dt);
  const w = avAnim.walkWeight;
  const spr = avAnim.sprint;

  // Clear walk/run cadence — arms & legs pump back-and-forth
  if (w > 0.04) {
    // Walk ~2 Hz · run faster so swing is obvious
    const cadence = 2.15 + spd * 0.07 + spr * 1.15;
    avAnim.phase += dt * cadence * Math.PI * 2;
    player.walkCycle = avAnim.phase;
  }

  const t = avAnim.phase;
  // Left / right opposite phases (true bipedal gait)
  const sL = Math.sin(t);
  const sR = Math.sin(t + Math.PI);
  const cL = Math.cos(t);
  const cR = Math.cos(t + Math.PI);
  // Swing vs stance helpers (swing when sin is positive = leg forward)
  const swingL = Math.max(0, sL);
  const swingR = Math.max(0, sR);
  const stanceL = Math.max(0, -sL);
  const stanceR = Math.max(0, -sR);

  // ── Human walk / run: big opposite arm–leg swings ──
  // Stronger so you clearly see back-and-forth while walking or sprinting
  const hipA = (1.05 + spr * 0.55) * w; // legs swing farther
  const armA = (0.95 + spr * 0.6) * w; // arms pump harder

  // Legs at hips — opposite sides
  let hipLX = sL * hipA;
  let hipRX = sR * hipA;
  let hipLZ = sL * 0.04 * w;
  let hipRZ = sR * 0.04 * w;
  // Knees bend on the swinging leg (looks like real running)
  let kneeLX = swingL * (0.55 + spr * 0.45) * w + stanceL * 0.08 * w;
  let kneeRX = swingR * (0.55 + spr * 0.45) * w + stanceR * 0.08 * w;
  let ankleLX = -sL * 0.2 * w;
  let ankleRX = -sR * 0.2 * w;

  // Arms opposite legs: left arm forward when right leg forward
  let shLX = sR * armA; // was inverted weakly — clear opposite to left leg
  let shRX = sL * armA;
  // slight outward hang
  let shLZ = -0.08 - Math.abs(sR) * 0.05 * w;
  let shRZ = 0.08 + Math.abs(sL) * 0.05 * w;
  // Elbows bend while pumping (especially when running)
  let elLX = (0.25 + Math.abs(sR) * (0.45 + spr * 0.35)) * w;
  let elRX = (0.25 + Math.abs(sL) * (0.45 + spr * 0.35)) * w;
  let shLY = sR * 0.08 * w;
  let shRY = sL * 0.08 * w;

  // Pelvis / torso: vertical bob, lateral sway, counter-rotation
  // Humans bounce twice per cycle (once per footfall)
  let bodyBob = Math.abs(Math.sin(t * 2)) * (0.028 + spr * 0.04) * w;
  // Side-to-side weight shift onto stance leg
  let bodySway = Math.sin(t) * (0.035 + spr * 0.02) * w;
  // Shoulders counter-rotate vs hips
  let bodyTwist = Math.sin(t) * (0.07 + spr * 0.06) * w;
  // Forward lean: mild walk · strong run
  let bodyLean = w > 0.15 ? (-0.05 * w - spr * 0.18) : 0;
  // Head stabilizes: smaller bob, slight counter-sway
  let headBob = Math.sin(t * 2) * (0.01 + spr * 0.008) * w;
  let headYaw = -Math.sin(t) * 0.04 * w; // counter to body twist
  let headPitch = -bodyLean * 0.35 + Math.sin(t * 2) * 0.015 * w;

  // Idle: stand tall, soft breathing, arms hang naturally
  if (w < 0.15 && onGround) {
    const breath = Math.sin(state.elapsed * 1.6) * 0.016;
    bodyBob += breath * (1 - w);
    headBob += breath * 0.45 * (1 - w);
    bodyLean = 0;
    bodySway = Math.sin(state.elapsed * 0.7) * 0.008 * (1 - w);
    bodyTwist = 0;
    headYaw = 0;
    headPitch = breath * 0.3;
    hipLZ = 0;
    hipRZ = 0;
    shLX = 0.03;
    shRX = 0.03;
    shLZ = -0.1;
    shRZ = 0.1;
    elLX = 0.15;
    elRX = 0.15;
    shLY = 0;
    shRY = 0;
  }

  // Sleep pose limb targets (full lay-down applied at end of updateAvatar)
  if (player.sleeping) {
    const sp = player.snorePhase || 0;
    // Legs / arms fidget while asleep
    hipLX = 0.08 + Math.sin(sp * 1.3) * 0.12;
    hipRX = 0.05 + Math.cos(sp * 1.1) * 0.1;
    kneeLX = 0.2 + Math.abs(Math.sin(sp * 1.6)) * 0.25;
    kneeRX = 0.25 + Math.abs(Math.cos(sp * 1.4)) * 0.2;
    ankleLX = 0.05 + Math.sin(sp * 2) * 0.08;
    ankleRX = 0.05 + Math.cos(sp * 2.2) * 0.08;
    shLX = 0.1 + Math.sin(sp * 0.9) * 0.2;
    shRX = -0.05 + Math.cos(sp * 1.0) * 0.25;
    shLZ = -1.0 + Math.sin(sp * 0.7) * 0.25;
    shRZ = 1.0 + Math.cos(sp * 0.65) * 0.25;
    elLX = 0.7 + Math.sin(sp * 1.8) * 0.25;
    elRX = 0.65 + Math.cos(sp * 1.5) * 0.3;
    bodyLean = 0;
    bodyBob = 0;
    bodySway = 0;
    bodyTwist = 0;
    headBob = Math.sin(sp * 1.1) * 0.04 + Math.sin(sp * 2.4) * 0.02;
  }

  // Eat food: raise arms to mouth (banana or spaghetti bowl)
  if (state.eatAnim && !player.sleeping) {
    const et = state.eatAnim.t;
    const isSpag = state.eatAnim.food === "spaghetti";
    if (isSpag) {
      // LEFT hand holds bowl · RIGHT hand holds spoon (scoop to mouth)
      if (et < 0.55) {
        const u = et / 0.55;
        // Lift bowl (left)
        shLX = -0.55 - u * 0.7;
        elLX = 0.6 + u * 0.7;
        shLZ = -0.35;
        // Raise spoon hand (right)
        shRX = -0.5 - u * 1.1;
        elRX = 0.5 + u * 1.0;
        shRZ = 0.25;
      } else if (et < 4.2) {
        const scoop = (Math.sin(et * 4.5) + 1) * 0.5; // 0 bowl · 1 mouth
        const bite = Math.sin(et * 9) * 0.06;
        // Left: steady bowl in front of chest
        shLX = -1.15 + bite * 0.05;
        elLX = 1.25;
        shLZ = -0.4;
        shLY = 0.15;
        // Right: spoon dips then lifts to mouth (hand holds it whole time)
        shRX = -1.0 - scoop * 0.75 + bite;
        elRX = 1.0 + scoop * 0.55;
        shRZ = 0.2 - scoop * 0.05;
        shRY = -0.2 - scoop * 0.15;
        headBob += 0.04 + Math.sin(et * 9) * 0.025;
      } else {
        shRX = -0.7;
        shLX = -0.55;
        elRX = 0.55;
        elLX = 0.5;
      }
    } else if (et < 0.45) {
      const u = et / 0.45;
      shRX = -0.4 - u * 1.3;
      elRX = 0.4 + u * 1.1;
      shRZ = 0.15;
    } else if (et < 1.2) {
      shRX = -1.85;
      elRX = 1.55;
      shRZ = 0.05;
      shRY = -0.15;
      headBob += 0.04;
    } else {
      shRX = -0.6;
      elRX = 0.5;
    }
  }

  // Swim / dive pose
  const inWaterPose = isInWater(player.pos.x, player.pos.y, player.pos.z);
  const divingPose = inWaterPose && (state.keys["ControlLeft"] || state.keys["ControlRight"] || player.pos.y < WATER_SURFACE - 0.8);
  if (player.sleeping) {
    // keep sleep limb targets
    hipLZ = 0;
    hipRZ = 0;
  } else if (inWaterPose && !player.parachuting) {
    // Frog / freestyle swim
    const swimT = state.elapsed * (divingPose ? 5.5 : 4.2);
    const kick = Math.sin(swimT);
    hipLX = 0.55 + kick * 0.45;
    hipRX = 0.55 - kick * 0.45;
    hipLZ = 0;
    hipRZ = 0;
    kneeLX = 0.7 + Math.max(0, -kick) * 0.5;
    kneeRX = 0.7 + Math.max(0, kick) * 0.5;
    ankleLX = 0.25;
    ankleRX = 0.25;
    headYaw = 0;
    headPitch = divingPose ? 0.2 : 0.08;
    shLX = divingPose ? -1.6 + Math.sin(swimT) * 0.35 : -1.1 + Math.sin(swimT) * 0.55;
    shRX = divingPose ? -1.6 - Math.sin(swimT) * 0.35 : -1.1 - Math.sin(swimT) * 0.55;
    shLZ = divingPose ? -0.5 : -0.25;
    shRZ = divingPose ? 0.5 : 0.25;
    elLX = 0.55 + Math.abs(Math.sin(swimT)) * 0.4;
    elRX = 0.55 + Math.abs(Math.cos(swimT)) * 0.4;
    bodyLean = divingPose ? 0.85 : 0.35; // nose down when diving
    bodyBob = Math.sin(swimT * 2) * 0.04;
    headBob = divingPose ? 0.15 : 0.05;
  } else if (player.parachuting && !onGround) {
    hipLX = 0.35;
    hipRX = 0.32;
    hipLZ = 0;
    hipRZ = 0;
    kneeLX = 0.55;
    kneeRX = 0.5;
    ankleLX = 0.2;
    ankleRX = 0.18;
    // Arms raised holding chute lines
    shLX = -2.2;
    shRX = -2.2;
    shLZ = -0.35;
    shRZ = 0.35;
    elLX = 0.9;
    elRX = 0.9;
    bodyLean = -0.08;
    bodyBob = Math.sin(state.elapsed * 3) * 0.03;
    headBob = Math.sin(state.elapsed * 2) * 0.04;
    headYaw = 0;
    headPitch = 0.05;
  } else if (!onGround) {
    // Jump / free fall — natural airborne tuck
    hipLX = 0.32;
    hipRX = 0.22;
    hipLZ = 0;
    hipRZ = 0;
    kneeLX = 0.55;
    kneeRX = 0.42;
    ankleLX = 0.18;
    ankleRX = 0.14;
    shLX = -0.55;
    shRX = -0.48;
    elLX = 0.4;
    elRX = 0.35;
    bodyLean = 0.08;
    bodyBob = 0;
    headYaw = 0;
    headPitch = 0.06;
  }

  // Show / hide parachute mesh
  if (typeof parachute !== "undefined") {
    parachute.visible = !!player.parachuting && !onGround;
    if (parachute.visible) {
      canopy.rotation.y = Math.sin(state.elapsed * 1.2) * 0.08;
      canopy.rotation.z = Math.sin(state.elapsed * 0.9) * 0.06;
    }
  }

  // Black hair with highlights — bounces UP when jump, DOWN when fall
  const wet = state.wetness || 0;
  const swimmingNow = isInWater(player.pos.x, player.pos.y, player.pos.z);
  const jumping = !onGround && !swimmingNow;
  const vy = player.vel.y || 0;
  // Strong clear up/down from jump velocity
  const jumpUp = jumping && vy > 0.5;   // going up
  const jumpDown = jumping && vy < -0.5; // falling
  const jumpForce = jumping
    ? Math.min(1.6, 0.5 + Math.abs(vy) * 0.15 + Math.hypot(player.vel.x, player.vel.z) * 0.03)
    : 0;
  const moveAmt = Math.min(0.35, Math.hypot(player.vel.x, player.vel.z) * 0.03);
  if (typeof ensureHairOnHead === "function") ensureHairOnHead();
  if (state._cloudAfro) {
    state._cloudAfro.visible = true;
    // Triplet bubbles stay glued; soft whole-mass bob on jump
    const baseY = state._hairBaseY != null ? state._hairBaseY : HEAD_H * 0.5 + 0.02;
    const baseZ = state._hairBaseZ != null ? state._hairBaseZ : 0.03;
    let hairY = baseY;
    if (jumpUp) hairY = baseY + Math.min(0.06, vy * 0.008);
    else if (jumpDown) hairY = baseY - Math.min(0.04, -vy * 0.006);
    else if (jumping) hairY = baseY + Math.sin(state.elapsed * 11) * 0.015;
    state._cloudAfro.position.x = 0;
    state._cloudAfro.position.z = baseZ;
    state._cloudAfro.position.y = THREE.MathUtils.lerp(
      state._cloudAfro.position.y,
      hairY,
      Math.min(1, 16 * dt)
    );
  }

  // Pillowy bubbles: squash/bounce like soft cushions (not ribbon locks)
  for (const strand of avHairStrands) {
    strand.phase += dt * (jumping ? 12 : swimmingNow ? 2.2 : 2.8 + moveAmt * 5);
    if (strand.mode !== "bubble") {
      // Legacy hang locks (if any remain)
      const restX = strand.restX != null ? strand.restX : 0.1;
      const restZ = strand.restZ != null ? strand.restZ : 0;
      strand.root.rotation.x += (restX - strand.root.rotation.x) * Math.min(1, 10 * dt);
      strand.root.rotation.z += (restZ - strand.root.rotation.z) * Math.min(1, 10 * dt);
      continue;
    }
    const bx = strand.baseX != null ? strand.baseX : 0;
    const by = strand.baseY != null ? strand.baseY : 0;
    const bz = strand.baseZ != null ? strand.baseZ : 0;
    let ty = by;
    let sx = 1;
    let sy = 1;
    let sz = 1;
    if (wet > 0.2) {
      // Wet: flatten a bit
      sy = 1 - wet * 0.18;
      sx = 1 + wet * 0.1;
      sz = 1 + wet * 0.08;
      ty = by - wet * 0.02;
    } else if (jumping) {
      if (jumpUp) {
        ty = by + Math.min(0.05, vy * 0.006);
        sy = 1.08 + jumpForce * 0.06;
        sx = 0.94 - jumpForce * 0.03;
        sz = sx;
      } else if (jumpDown) {
        ty = by - Math.min(0.04, -vy * 0.005);
        sy = 0.9 - jumpForce * 0.04;
        sx = 1.08 + jumpForce * 0.04;
        sz = sx;
      } else {
        const w = Math.sin(strand.phase) * 0.03;
        ty = by + w;
        sy = 1 + w * 0.8;
        sx = 1 - w * 0.4;
        sz = sx;
      }
    } else {
      // Idle / walk: soft pillow jiggle
      const bob = Math.sin(strand.phase) * 0.012 * (0.5 + moveAmt * 2);
      const side = Math.cos(strand.phase * 0.9) * 0.008 * (0.4 + moveAmt);
      ty = by + bob;
      strand.root.position.x = bx + side * (strand.side || 0.5);
      strand.root.position.z = bz;
      sy = 1 + bob * 1.2;
      sx = 1 - bob * 0.5;
      sz = 1 - bob * 0.35;
    }
    strand.root.position.y = THREE.MathUtils.lerp(strand.root.position.y, ty, Math.min(1, 12 * dt));
    if (!jumping && wet <= 0.2) {
      /* x/z set above */
    } else {
      strand.root.position.x = THREE.MathUtils.lerp(strand.root.position.x, bx, Math.min(1, 12 * dt));
      strand.root.position.z = THREE.MathUtils.lerp(strand.root.position.z, bz, Math.min(1, 12 * dt));
    }
    const sm = Math.min(1, 14 * dt);
    strand.root.scale.x += (sx - strand.root.scale.x) * sm;
    strand.root.scale.y += (sy - strand.root.scale.y) * sm;
    strand.root.scale.z += (sz - strand.root.scale.z) * sm;
  }

  const sm = Math.min(1, 16 * dt);

  avLegL.hip.rotation.x = lerpAngle(avLegL.hip.rotation.x, hipLX, sm);
  avLegR.hip.rotation.x = lerpAngle(avLegR.hip.rotation.x, hipRX, sm);
  avLegL.knee.rotation.x = lerpAngle(avLegL.knee.rotation.x, kneeLX, sm);
  avLegR.knee.rotation.x = lerpAngle(avLegR.knee.rotation.x, kneeRX, sm);
  avLegL.ankle.rotation.x = lerpAngle(avLegL.ankle.rotation.x, ankleLX, sm);
  avLegR.ankle.rotation.x = lerpAngle(avLegR.ankle.rotation.x, ankleRX, sm);
  avLegL.hip.rotation.y = lerpAngle(avLegL.hip.rotation.y, 0, sm);
  avLegR.hip.rotation.y = lerpAngle(avLegR.hip.rotation.y, 0, sm);
  // Slight outward hip sway (human)
  const _hipLZ = (typeof hipLZ === "number") ? hipLZ : 0;
  const _hipRZ = (typeof hipRZ === "number") ? hipRZ : 0;
  avLegL.hip.rotation.z = lerpAngle(avLegL.hip.rotation.z, _hipLZ, sm);
  avLegR.hip.rotation.z = lerpAngle(avLegR.hip.rotation.z, _hipRZ, sm);

  // Shoulders: pitch (X) swing, small Z for rest pose
  avShoulderL.rotation.x = lerpAngle(avShoulderL.rotation.x, shLX, sm);
  avShoulderR.rotation.x = lerpAngle(avShoulderR.rotation.x, shRX, sm);
  avShoulderL.rotation.y = lerpAngle(avShoulderL.rotation.y, shLY, sm);
  avShoulderR.rotation.y = lerpAngle(avShoulderR.rotation.y, shRY, sm);
  avShoulderL.rotation.z = lerpAngle(avShoulderL.rotation.z, shLZ, sm);
  avShoulderR.rotation.z = lerpAngle(avShoulderR.rotation.z, shRZ, sm);
  avElbowL.rotation.x = lerpAngle(avElbowL.rotation.x, elLX, sm);
  avElbowR.rotation.x = lerpAngle(avElbowR.rotation.x, elRX, sm);

  // Land jiggle timer tick (Jell-O settle)
  if (player.landJiggle > 0) {
    player.landJiggle = Math.max(0, player.landJiggle - dt);
    player._jiggleT = (player._jiggleT || 0) + dt;
    if (player.landJiggle <= 0) {
      player.landJiggleAmp = 0;
      player._jiggleT = 0;
      player.fromTreeJump = false;
      player.bounceLeft = 0;
      // Snap fully normal so walk works right away
      avHead.rotation.set(0, 0, 0);
      avHead.scale.set(1, 1, 1);
      avBody.scale.set(1, 1, 1);
      avatar.scale.set(1, 1, 1);
      avatar.rotation.x = 0;
      avatar.rotation.z = 0;
    }
  }

  if (player.sleeping) {
    // ── Lie on ground + MOVE AROUND while sleeping ──
    const sp = player.snorePhase || 0;
    const breath = Math.sin(sp * 1.15) * 0.04;
    const roll = player._sleepRoll || 0;
    const toss = player._sleepToss || 0;
    const fx = player._sleepFidgetX || 0;
    const fz = player._sleepFidgetZ || 0;
    avBody.position.set(0, 0, 0);
    // Body wiggles while asleep
    avBody.rotation.set(
      Math.sin(sp * 2.1) * 0.06,
      Math.sin(sp * 0.9) * 0.08,
      Math.sin(sp * 1.4) * 0.05
    );
    avatar.rotation.order = "YXZ";
    avatar.rotation.y = player.yaw + Math.sin(sp * 0.35) * 0.15; // slowly turns while sleeping
    avatar.rotation.x = -Math.PI / 2 + Math.sin(sp * 0.6) * 0.08; // rock on back
    avatar.rotation.z = 0.22 + roll + toss; // roll side to side
    avatar.position.set(
      player.pos.x + fx,
      player.pos.y + 0.38 + breath + Math.abs(Math.sin(sp * 2.4)) * 0.03,
      player.pos.z + fz
    );
    // Head wiggles / nods while snoring
    avHead.rotation.y = 0.1 + Math.sin(sp * 1.7) * 0.18;
    avHead.rotation.x = 0.12 + Math.sin(sp * 2.3) * 0.12;
    avHead.rotation.z = Math.sin(sp * 1.1) * 0.1;
    avHead.position.y = HEAD_Y + headBob;
    avTorso.position.y = TORSO_Y;
    avShoulderL.position.y = SHOULDER_Y;
    avShoulderR.position.y = SHOULDER_Y;
    avBase.visible = false;
  } else {
    // Standing / normal (plus land jiggle if bouncing)
    avatar.rotation.order = "YXZ";
    avatar.rotation.y = player.yaw;

    const j = player.landJiggle || 0;
    const amp = player.landJiggleAmp || 0;
    if (j > 0 && amp > 0) {
      // ── NOODLE bounce: floppy wobble → settle → walk normal ──
      const maxJ = player._jiggleMax || 1.8;
      const u = Math.max(0, Math.min(1, j / maxJ));
      const env = u * u * (3 - 2 * u);
      const noodleMul = player._noodleBounce ? 1.45 : 1;
      const a = amp * env * noodleMul;
      const t = (player._jiggleT || 0);
      const jellyY =
        Math.sin(t * 14) * 0.55 +
        Math.sin(t * 22 + 0.7) * 0.28 +
        Math.sin(t * 31 + 1.4) * 0.12 +
        Math.sin(t * 9 + 2) * 0.2 * noodleMul;
      const jellyX =
        Math.sin(t * 12 + 0.4) * 0.45 +
        Math.sin(t * 19 + 1.1) * 0.22 +
        Math.sin(t * 7) * 0.25 * noodleMul;
      const jellyZ =
        Math.cos(t * 13 + 0.2) * 0.4 +
        Math.sin(t * 25 + 0.9) * 0.18 +
        Math.cos(t * 8 + 1) * 0.22 * noodleMul;
      // Head lags body (jello lag)
      const headLag = t - 0.08;
      const headJ =
        Math.sin(headLag * 18) * 0.7 +
        Math.sin(headLag * 27 + 1) * 0.35 +
        Math.sin(headLag * 36 + 2) * 0.15;

      // Squash when down, stretch when up (classic jelly)
      const squash = 1 + jellyY * 0.22 * a;
      const stretchX = 1 / Math.sqrt(Math.max(0.55, squash));
      avatar.scale.set(stretchX, squash, stretchX);
      avatar.rotation.x = jellyX * 0.22 * a;
      avatar.rotation.z = jellyZ * 0.28 * a;
      avatar.position.set(
        player.pos.x,
        player.pos.y + Math.max(0, jellyY) * 0.12 * a,
        player.pos.z
      );

      avBody.position.y = bodyBob + Math.abs(jellyY) * 0.05 * a;
      avBody.rotation.z = bodySway + jellyZ * 0.35 * a;
      avBody.rotation.y = bodyTwist + jellyX * 0.2 * a;
      avBody.rotation.x = bodyLean + jellyX * 0.15 * a;
      // Body scale jiggle independent of root
      avBody.scale.set(
        1 + jellyZ * 0.06 * a,
        1 + jellyY * 0.1 * a,
        1 + jellyX * 0.06 * a
      );

      // Head bounces like loose jello on top
      avHead.rotation.z = headJ * 0.55 * a;
      avHead.rotation.y = Math.sin(headLag * 16 + 0.5) * 0.4 * a;
      avHead.rotation.x = -bodyLean * 0.15 + headJ * 0.35 * a;
      avHead.position.y = HEAD_Y + headBob + headJ * 0.08 * a;
      avHead.scale.set(
        1 + headJ * 0.08 * a,
        1 - headJ * 0.06 * a,
        1 + headJ * 0.08 * a
      );
    } else {
      // Fully normal standing — walk again (noodle done)
      player._noodleBounce = false;
      player.fromLadderJump = false;
      avatar.scale.set(1, 1, 1);
      avBody.scale.set(1, 1, 1);
      avHead.scale.set(1, 1, 1);
      avatar.rotation.x = 0;
      avatar.rotation.z = 0;
      avatar.position.set(player.pos.x, player.pos.y, player.pos.z);

      avBody.position.y = bodyBob;
      avBody.rotation.z = bodySway;
      avBody.rotation.y = bodyTwist;
      avBody.rotation.x = bodyLean;

      // Head stabilizes: counter-yaw + soft pitch (real human gait)
      const _hy = (typeof headYaw === "number") ? headYaw : -bodyTwist * 0.5;
      const _hp = (typeof headPitch === "number") ? headPitch : -bodyLean * 0.25;
      avHead.rotation.y = lerpAngle(avHead.rotation.y, _hy, sm);
      avHead.rotation.x = lerpAngle(avHead.rotation.x, _hp, sm);
      avHead.rotation.z = lerpAngle(avHead.rotation.z, -bodySway * 0.35, sm);
      avHead.position.y = HEAD_Y + headBob;
    }

    avTorso.position.y = TORSO_Y;
    avShoulderL.position.y = SHOULDER_Y + headBob * 0.3;
    avShoulderR.position.y = SHOULDER_Y + headBob * 0.3;

    avBase.visible = w < 0.4 && j <= 0;
    avBase.position.set(0, FOOT_H * 0.28, 0);
  }
}

function updateLadderProximity() {
  state.nearLadder = false;
  if (state.inVehicle || state.climbing) return;
  // Prefer closest climb target: Michael ladder OR mountain climb ladders
  let best = null;
  let bestD = Infinity;
  const candidates = [];
  if (state.ladder) candidates.push(state.ladder);
  for (const m of state.mountainClimbs || []) candidates.push(m);
  for (const L of candidates) {
    const dist = Math.hypot(player.pos.x - L.x, player.pos.z - L.z);
    const range = L.grabRange || 2.6;
    if (
      dist < range &&
      player.pos.y > L.bottomY - 1.2 &&
      player.pos.y < L.topY + 2.5 &&
      dist < bestD
    ) {
      bestD = dist;
      best = L;
    }
  }
  if (best) {
    state.nearLadder = true;
    state._activeClimb = best; // which ladder/mountain to mount
  } else {
    state._activeClimb = null;
  }
}

function tryMountLadder() {
  if (state.inVehicle || state.climbing || state.onTree) return;
  updateLadderProximity();
  const L = state._activeClimb || state.ladder || nearestMountainClimb(4);
  if (!L) {
    toast("Get closer to a mountain ladder (K) or Michael's ladder", "");
    return;
  }
  const dist = Math.hypot(player.pos.x - L.x, player.pos.z - L.z);
  if (dist > (L.grabRange || 2.6) + 0.8) {
    toast("Get closer to the climb first", "");
    return;
  }
  state.climbing = true;
  state.climbKind = "ladder";
  state.climbTree = null;
  state._climbTarget = L;
  player.vel.set(0, 0, 0);
  player.pos.x = L.x;
  player.pos.z = L.z + 0.15;
  player.pos.y = THREE.MathUtils.clamp(player.pos.y, L.bottomY, L.topY);
  if (L.kind === "mountain") {
    toast(`⛰ Climbing ${L.name}! W up · S down · X jump off`, "quest");
    playerSay("Climbing the mountain!");
  } else {
    toast("Climb ladder! W up · S down · Space/X jump off = noodle bounce", "quest");
  }
}

function jumpOffLadder() {
  if (!state.climbing || state.climbKind === "tree") return;
  state.climbing = false;
  state.climbKind = null;
  const L = state._climbTarget || state.ladder;
  state._climbTarget = null;
  if (L) {
    player.pos.x = L.x + 0.8;
    player.pos.z = L.z;
  }
  player.vel.y = 9;
  player.vel.x = 7;
  player.vel.z = (Math.random() - 0.5) * 2;
  player.onGround = false;
  player.wasAirborne = true;
  player.fallPeakY = player.pos.y;
  player.fromTreeJump = true;
  player.fromLadderJump = true;
  playerSay(["Jump!", "Whee!"]);
  toast("Jumped off! Fall then noodle bounce — then walk normal", "reward");
}

function nearestClimbableTree(maxDist = 2.4) {
  let best = null;
  let bestD = Infinity;
  for (const t of treeSites) {
    const d = Math.hypot(player.pos.x - t.x, player.pos.z - t.z);
    // Allow grab near base or while already elevated near trunk
    const nearBase = d < maxDist && player.pos.y < t.groundY + 3;
    const nearTrunk =
      d < 1.6 && player.pos.y >= t.groundY && player.pos.y <= t.topY + 1.5;
    if ((nearBase || nearTrunk) && d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

function tryMountTree() {
  if (state.inVehicle || state.climbing || state.onTree) return false;
  const t = nearestClimbableTree();
  if (!t) return false;
  state.climbing = true;
  state.climbKind = "tree";
  state.climbTree = t;
  state.onTree = false;
  player.vel.set(0, 0, 0);
  player.pos.x = t.x;
  player.pos.z = t.z;
  player.pos.y = THREE.MathUtils.clamp(player.pos.y, t.groundY + 0.2, t.topY);
  toast("Tree climb! W up · S down · walk on top · X jump off", "quest");
  return true;
}

function jumpOffTree() {
  if (!state.climbing && !state.onTree) return;
  const wasOnTree = state.onTree || state.climbKind === "tree";
  state.climbing = false;
  state.climbKind = null;
  state.onTree = false;
  const t = state.climbTree;
  state.climbTree = null;
  // Leap off outward
  const dir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
  player.vel.x = dir.x * 5.5;
  player.vel.z = dir.z * 5.5;
  player.vel.y = 8.5;
  player.onGround = false;
  player.wasAirborne = true;
  player.fallPeakY = player.pos.y;
  if (wasOnTree) {
    player.fromTreeJump = true;
    playerSay(["Wow!", "Who?"]);
    toast("Jumped off the tree!", "");
  }
}

function updateTreeClimb(dt) {
  const t = state.climbTree;
  if (!t) {
    state.climbing = false;
    state.climbKind = null;
    return;
  }

  // Climbing the trunk
  if (state.climbing && !state.onTree) {
    player.pos.x = t.x;
    player.pos.z = t.z;
    player.vel.set(0, 0, 0);
    player.onGround = false;

    const climbSpeed = 4.8;
    let move = 0;
    if (state.keys["KeyW"] || state.keys["ArrowUp"]) move += 1;
    if (state.keys["KeyS"] || state.keys["ArrowDown"]) move -= 1;
    if (state.keys["Space"] || state.keys["Spacebar"]) move += 1;

    player.pos.y += move * climbSpeed * dt;
    player.pos.y = THREE.MathUtils.clamp(player.pos.y, t.groundY + 0.15, t.topY);

    // Reached canopy → walk on the tree
    if (player.pos.y >= t.topY - 0.08 && move > 0) {
      state.climbing = false;
      state.onTree = true;
      player.pos.y = t.topY + 0.15;
      player.vel.set(0, 0, 0);
      player.onGround = true;
      toast("On the tree! WASD walk · X or Space jump off", "quest");
    }

    // Bottom + S → drop off
    if (player.pos.y <= t.groundY + 0.25 && move < 0) {
      state.climbing = false;
      state.climbKind = null;
      state.climbTree = null;
      player.pos.y = t.groundY + 0.05;
      player.vel.set(0, 0, 0);
    }
    state.distance += Math.abs(move) * climbSpeed * dt * 0.3;
    return;
  }

  // Walking on canopy
  if (state.onTree) {
    const speed = 2.8;
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
    let mx = 0;
    let mz = 0;
    if (state.keys["KeyW"] || state.keys["ArrowUp"]) {
      mx += forward.x;
      mz += forward.z;
    }
    if (state.keys["KeyS"] || state.keys["ArrowDown"]) {
      mx -= forward.x;
      mz -= forward.z;
    }
    if (state.keys["KeyA"] || state.keys["ArrowLeft"]) {
      mx -= right.x;
      mz -= right.z;
    }
    if (state.keys["KeyD"] || state.keys["ArrowRight"]) {
      mx += right.x;
      mz += right.z;
    }
    const len = Math.hypot(mx, mz);
    if (len > 0.001) {
      mx = (mx / len) * speed * dt;
      mz = (mz / len) * speed * dt;
      player.pos.x += mx;
      player.pos.z += mz;
      state.distance += speed * dt * 0.4;
    }
    // Stay near canopy disk
    const dx = player.pos.x - t.x;
    const dz = player.pos.z - t.z;
    const r = Math.hypot(dx, dz);
    const maxR = 2.4;
    if (r > maxR) {
      player.pos.x = t.x + (dx / r) * maxR;
      player.pos.z = t.z + (dz / r) * maxR;
    }
    player.pos.y = t.topY + 0.15;
    player.vel.set(0, 0, 0);
    player.onGround = true;

    // Space while walking on tree = jump off
    if (state.keys["Space"] || state.keys["Spacebar"]) {
      // only once per press handled via keydown X preferred; Space works via edge in jumpOff
    }
  }
}

function updateLadderClimb(dt) {
  const L = state._climbTarget || state.ladder;
  if (!L) {
    state.climbing = false;
    state.climbKind = null;
    return;
  }

  // Stay locked to ladder (ON the face — not inside mountain)
  player.pos.x = L.x;
  player.pos.z = L.z + 0.2;
  player.vel.x = 0;
  player.vel.z = 0;
  player.vel.y = 0;
  player.onGround = false;

  const climbSpeed = L.kind === "mountain" ? 6.2 : 5.5;
  let move = 0;
  if (state.keys["KeyW"] || state.keys["ArrowUp"]) move += 1;
  if (state.keys["KeyS"] || state.keys["ArrowDown"]) move -= 1;

  player.pos.y += move * climbSpeed * dt;
  player.pos.y = THREE.MathUtils.clamp(player.pos.y, L.bottomY, L.topY);

  // Reached the top → stand ON the mountain peak / roof
  if (player.pos.y >= L.topY - 0.05 && move > 0) {
    state.climbing = false;
    state.climbKind = null;
    player.pos.x = L.roofX != null ? L.roofX : L.x - 1.2;
    player.pos.z = L.roofZ != null ? L.roofZ : L.z;
    player.pos.y = L.roofY != null ? L.roofY : L.topY + 0.2;
    player.vel.set(0, 0, 0);
    player.onGround = true;
    state._climbTarget = null;
    if (L.kind === "mountain") {
      toast(`⛰ Summit! On top of ${L.name}`, "reward");
      playerSay("I climbed it!");
    } else {
      toast("On Michael's roof! Space jump off for noodle bounce", "reward");
    }
    addXP(8);
  }

  // Bottom + holding S → get off
  if (player.pos.y <= L.bottomY + 0.05 && move < 0) {
    state.climbing = false;
    state.climbKind = null;
    state._climbTarget = null;
    player.pos.z = L.z + 1.2;
    player.vel.set(0, 0, 0);
  }

  state.distance += Math.abs(move) * climbSpeed * dt * 0.3;
}

function updateOnFoot(dt) {
  // Spider-Man mini-game: fly the seas — never force swim mode
  const spider = !!state.spiderGame;
  const swimming = !spider && isInWater(player.pos.x, player.pos.y, player.pos.z);
  const sprint = state.keys["ShiftLeft"] || state.keys["ShiftRight"];
  const diveBoost = state.divingSuit ? 1.55 : 1;
  const speed = spider
    ? player.speed * 1.35 * (sprint ? 1.25 : 1)
    : swimming
    ? 5.5 * diveBoost
    : player.speed * (sprint ? player.sprintMult : 1) * (player.pos.y > 5 ? 0.92 : 1);

  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
  const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
  const wish = new THREE.Vector3();
  if (state.keys["KeyW"]) wish.add(forward);
  if (state.keys["KeyS"]) wish.sub(forward);
  if (state.keys["KeyD"]) wish.add(right);
  if (state.keys["KeyA"]) wish.sub(right);
  if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

  if (swimming) {
    player.parachuting = false;
    // Full 3D swim: look pitch steers dive; Ctrl forces dive; Space surfaces
    const lookDive = Math.sin(player.pitch); // look down = negative pitch in YXZ? pitch down is negative
    player.vel.x = THREE.MathUtils.lerp(player.vel.x, wish.x, 1 - Math.pow(0.008, dt));
    player.vel.z = THREE.MathUtils.lerp(player.vel.z, wish.z, 1 - Math.pow(0.008, dt));
    let vy = 0;
    const vert = state.divingSuit ? 9 : 7.2;
    const diving = state.keys["ControlLeft"] || state.keys["ControlRight"];
    if (state.keys["Space"] || state.keys["Spacebar"]) vy += vert * 1.15;
    if (diving) vy -= vert * 1.35;
    // Look down dives hard, look up surfaces
    vy += -lookDive * (state.divingSuit ? 7 : 5.5);
    // When moving forward while looking down, dig into the water
    if (wish.lengthSq() > 0.1 && lookDive < -0.15) {
      vy += lookDive * 4;
    }
    // Almost no buoyancy while diving — true underwater swimming
    if (!diving && lookDive > -0.1 && player.pos.y > WATER_SURFACE - 1.2) {
      vy += state.divingSuit ? 0.15 : 0.55;
    }
    if (diving || lookDive < -0.2) {
      vy -= 1.8;
    }
    player.vel.y = THREE.MathUtils.lerp(player.vel.y, vy, 1 - Math.pow(0.03, dt));
    player.vel.multiplyScalar(1 - (diving || lookDive < -0.2 ? 0.28 : 0.42) * dt);
    updateWetAppearance(dt, true);
  } else {
    updateWetAppearance(dt, false);
    player.vel.x = THREE.MathUtils.lerp(player.vel.x, wish.x, 1 - Math.pow(0.0008, dt));
    player.vel.z = THREE.MathUtils.lerp(player.vel.z, wish.z, 1 - Math.pow(0.0008, dt));

    // Track peak height for parachute deploy
    if (player.onGround) {
      player.fallPeakY = player.pos.y;
      player.parachuting = false;
    } else if (player.pos.y > player.fallPeakY) {
      player.fallPeakY = player.pos.y;
    }

    const groundBelow = walkHeight(player.pos.x, player.pos.z);
    const heightAbove = player.pos.y - groundBelow;
    // Open chute when falling from height
    if (
      !player.onGround &&
      heightAbove > 5.5 &&
      player.vel.y < -2.5 &&
      player.fallPeakY - groundBelow > 6
    ) {
      if (!player.parachuting) {
        player.parachuting = true;
        // Auto third-person so you SEE yourself with the chute
        if (player.camDistTarget < 4) player.camDistTarget = 5.5;
        toast("🪂 Parachute open! Hold the handles — steer with WASD", "reward");
      }
    }

    if (spider) {
      // Cloudy Bird Spider-Man: light gravity, air control, Space flies (handled in updateSpiderGame)
      player.parachuting = false;
      player.vel.x = THREE.MathUtils.lerp(player.vel.x, wish.x, 1 - Math.pow(0.04, dt));
      player.vel.z = THREE.MathUtils.lerp(player.vel.z, wish.z, 1 - Math.pow(0.04, dt));
      player.vel.y -= 9 * dt; // floaty
      if (player.vel.y < -7) player.vel.y = -7;
    } else if (player.parachuting) {
      // Soft gravity + terminal velocity under chute
      player.vel.y -= 6 * dt;
      if (player.vel.y < -3.2) player.vel.y = -3.2;
      // Gentle lift if falling too fast
      if (player.vel.y < -2.5) player.vel.y += 8 * dt;
      // Steer while gliding
      player.vel.x = THREE.MathUtils.lerp(player.vel.x, wish.x * 0.65, 1 - Math.pow(0.05, dt));
      player.vel.z = THREE.MathUtils.lerp(player.vel.z, wish.z * 0.65, 1 - Math.pow(0.05, dt));
      // Cut chute near ground
      if (heightAbove < 1.4) player.parachuting = false;
    } else {
      player.vel.y -= 22 * dt;
      if (player.onGround && (state.keys["Space"] || state.keys["Spacebar"])) {
        // Lion leaps higher
        const jf = state.tigerForm ? player.jumpForce * 1.55 : player.jumpForce;
        player.vel.y = jf;
        if (state.tigerForm) {
          const dir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
          player.vel.x += dir.x * 5;
          player.vel.z += dir.z * 5;
        }
        player.onGround = false;
        player.fallPeakY = player.pos.y;
      }
    }
  }

  const prev = player.pos.clone();
  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;
  player.pos.y += player.vel.y * dt;

  const wasInAir = !player.onGround || player.wasAirborne;
  const fallSpeed = player.vel.y;
  player.onGround = resolvePlayer(player.pos, player.radius);
  // CRAWL / RUN ON mountain OUTSIDE — stick to dome surface, never go inside
  {
    const py = typeof peakSurfaceY === "function" ? peakSurfaceY(player.pos.x, player.pos.z) : null;
    if (py != null) {
      // If below surface (inside rock), pop out onto the skin
      if (player.pos.y < py + 0.5) {
        // step-up help for steep crawls
        const step = player.pos.y < py - 0.2 ? Math.min(py, player.pos.y + 18 * dt) : py;
        player.pos.y = Math.max(player.pos.y, step);
        if (player.pos.y >= py - 0.15) {
          player.pos.y = py;
          player.onGround = true;
          if (player.vel.y < 0) player.vel.y = 0;
        }
      }
      // Walking uphill: always glue feet to surface (crawl way up)
      if (player.vel.y <= 3.5 && player.pos.y <= py + 1.2) {
        const cling = Math.min(1, 14 * dt);
        player.pos.y += (py - player.pos.y) * cling;
        if (Math.abs(player.pos.y - py) < 0.25) {
          player.pos.y = py;
          player.onGround = true;
          if (player.vel.y < 0.5) player.vel.y = 0;
        }
      }
    }
  }
  const onDeck = tryStandOnVehicles();
  if (!onDeck && player.onGround && fallSpeed < 0) {
    // ── Hit the ground ──
    const fallDist = Math.max(0, (player.fallPeakY || player.pos.y) - player.pos.y);
    const hard = fallDist > 2.2 || fallSpeed < -8 || player.fromTreeJump;

    if (hard && (wasInAir || player.fromTreeJump || player.fromLadderJump)) {
      // Physical hop + long NOODLE settle
      const noodle = player.fromTreeJump || player.fromLadderJump;
      const strength = noodle
        ? Math.min(9.5, 4.5 + fallDist * 0.45)
        : Math.min(6, 2.2 + fallDist * 0.28);
      if (player.bounceLeft <= 0) {
        player.bounceLeft = noodle ? 4 : fallDist > 5 ? 2 : 1;
      }
      if (player.bounceLeft > 0) {
        player.vel.y = strength * (0.55 + player.bounceLeft * 0.2);
        player.vel.x += (Math.random() - 0.5) * 2.5;
        player.vel.z += (Math.random() - 0.5) * 2.5;
        player.onGround = false;
        player.bounceLeft -= 1;
        player.wasAirborne = true;
      } else {
        player.vel.y = 0;
      }
      const jDur = noodle ? 2.8 : 1.6;
      player.landJiggle = Math.max(player.landJiggle, jDur);
      player._jiggleMax = jDur;
      player._jiggleT = 0;
      player.landJiggleAmp = Math.min(1.35, 0.65 + fallDist * 0.12 + (noodle ? 0.5 : 0));
      player._noodleBounce = noodle;
      if (noodle && player.bounceLeft === 3) {
        playerSay(["Oof!", "Noodle!", "Boing!"]);
        toast("Noodle bounce! Then walk normal...", "reward");
      }
      if (player.bounceLeft <= 0) {
        player.fromTreeJump = false;
        player.fromLadderJump = false;
      }
    } else {
      player.vel.y = 0;
      if (player.landJiggle <= 0) {
        player.fromTreeJump = false;
        player.bounceLeft = 0;
      }
    }
    player.parachuting = false;
    player.fallPeakY = player.pos.y;
  }
  if (!player.onGround) {
    player.wasAirborne = true;
    if (player.vel.y > 0.5) player.fallPeakY = Math.max(player.fallPeakY || player.pos.y, player.pos.y);
  } else if (player.bounceLeft <= 0 && player.landJiggle <= 0) {
    player.wasAirborne = false;
  }

  // Follow mountain slope gently when grounded
  if (player.onGround && !swimming && player.bounceLeft <= 0) {
    const targetY = walkHeight(player.pos.x, player.pos.z);
    if (player.pos.y < targetY + 0.2) player.pos.y = targetY;
  }

  state.distance += prev.distanceTo(player.pos);

  // Footstep sounds when walking on ground
  const moving = wish.lengthSq() > 0.1 && player.onGround && !swimming;
  if (moving) {
    SFX.footTimer -= dt;
    if (SFX.footTimer <= 0) {
      const onSand = player.pos.z > OCEAN_START - 12;
      playFootstep(onSand, sprint);
      SFX.footTimer = sprint ? 0.28 : 0.42;
    }
  } else {
    SFX.footTimer = 0.05;
  }

  // Explore quest: walk into far meadows or mountain valley
  if (Math.hypot(player.pos.x, player.pos.z) > 95 || player.pos.z < -70) {
    progressQuest("explore", 1);
  }
}

function updateVehicle(dt) {
  const v = state.vehicle;
  if (v.type === "rocket" || v.type === "jet" || v.type === "airplane") {
    updateRocket(dt, v);
    // Spin airplane props while flying
    if (v.type === "airplane" && (v.propL || v.propR)) {
      const spin = v.speed * 0.35 + (state.keys["KeyW"] ? 25 : 8);
      if (v.propL) {
        v.propL.rotation.z += spin * dt;
        if (v.propL2) v.propL2.rotation.z += spin * dt;
      }
      if (v.propR) {
        v.propR.rotation.z += spin * dt;
        if (v.propR2) v.propR2.rotation.z += spin * dt;
      }
    }
    return;
  }
  if (v.type === "boat") {
    updateBoat(dt, v);
    return;
  }

  const throttle = (state.keys["KeyW"] ? 1 : 0) + (state.keys["KeyS"] ? -0.6 : 0);
  const steer = (state.keys["KeyA"] ? 1 : 0) + (state.keys["KeyD"] ? -1 : 0);
  const braking = state.keys["Space"] || state.keys["Spacebar"];

  if (braking) {
    v.speed = THREE.MathUtils.lerp(v.speed, 0, 1 - Math.pow(0.01, dt));
  } else {
    v.speed += throttle * v.accel * dt;
  }
  v.speed *= 1 - 0.8 * dt;
  v.speed = THREE.MathUtils.clamp(v.speed, -v.maxSpeed * 0.4, v.maxSpeed);

  if (Math.abs(v.speed) > 0.5) {
    v.yaw += steer * v.turn * (v.speed / v.maxSpeed) * dt;
  }

  const dx = -Math.sin(v.yaw) * v.speed * dt;
  const dz = -Math.cos(v.yaw) * v.speed * dt;
  v.group.position.x += dx;
  v.group.position.z += dz;
  v.group.position.x = THREE.MathUtils.clamp(v.group.position.x, -HALF + 3, HALF - 3);
  v.group.position.z = THREE.MathUtils.clamp(v.group.position.z, -HALF + 3, HALF - 3);
  v.group.position.y = walkHeight(v.group.position.x, v.group.position.z) + 0.15;
  v.group.rotation.y = v.yaw;

  for (const w of v.wheels) {
    w.rotation.x += v.speed * dt * 0.8;
  }

  player.pos.copy(v.group.position);
  player.pos.y += 1;
  state.distance += Math.abs(v.speed) * dt;

  $("speed-num").textContent = Math.abs(Math.round(v.speed * 4.2));
}

function spawnBoatSplash(x, y, z, power = 1) {
  // GTA-style water spray / wake particles
  const n = Math.min(10, 3 + Math.floor(power * 4));
  for (let i = 0; i < n; i++) {
    if (particles.length > 90) break;
    const size = 0.08 + Math.random() * 0.18 * power;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 5, 4),
      new THREE.MeshBasicMaterial({
        color: Math.random() > 0.4 ? 0xdbeafe : 0xf0f9ff,
        transparent: true,
        opacity: 0.75,
      })
    );
    mesh.position.set(
      x + (Math.random() - 0.5) * 1.2,
      y + Math.random() * 0.2,
      z + (Math.random() - 0.5) * 1.2
    );
    scene.add(mesh);
    particles.push({
      mesh,
      life: 0.35 + Math.random() * 0.45,
      max: 0.8,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 6 * power,
        2 + Math.random() * 5 * power,
        (Math.random() - 0.5) * 6 * power
      ),
      type: "spark",
      grow: 1.8,
    });
  }
}

function updateBoat(dt, v) {
  // GTA-style water craft: punchy accel, banked turns, wave plane, wake splashes
  const throttle = (state.keys["KeyW"] ? 1 : 0) + (state.keys["KeyS"] ? -0.55 : 0);
  const steer = (state.keys["KeyA"] ? 1 : 0) + (state.keys["KeyD"] ? -1 : 0);

  // Stronger pull like GTA boats
  const accel = (v.accel || 14) * 1.35;
  const maxSp = (v.maxSpeed || 22) * 1.15;
  v.speed += throttle * accel * dt;
  // Water drag (higher when turning)
  const turnDrag = 0.55 + Math.abs(steer) * 0.35;
  v.speed *= 1 - turnDrag * dt;
  v.speed = THREE.MathUtils.clamp(v.speed, -maxSp * 0.4, maxSp);

  // Steering only works when moving; more grip at speed (GTA feel)
  if (Math.abs(v.speed) > 0.35) {
    const turnRate = (v.turn || 1.6) * (0.55 + Math.min(1, Math.abs(v.speed) / maxSp) * 0.9);
    v.yaw += steer * turnRate * Math.sign(v.speed || 1) * dt;
  }

  // Lateral slide (slight drift in turns)
  if (!v.latVel) v.latVel = 0;
  v.latVel += -steer * Math.abs(v.speed) * 0.35 * dt;
  v.latVel *= 1 - 4.5 * dt;

  const fwdX = -Math.sin(v.yaw);
  const fwdZ = -Math.cos(v.yaw);
  const rightX = Math.cos(v.yaw);
  const rightZ = -Math.sin(v.yaw);
  v.group.position.x += (fwdX * v.speed + rightX * v.latVel) * dt;
  v.group.position.z += (fwdZ * v.speed + rightZ * v.latVel) * dt;

  // Stay on water; if on land, push back toward ocean
  if (!isOcean(v.group.position.x, v.group.position.z)) {
    v.group.position.z = Math.max(v.group.position.z, OCEAN_START + 8);
    v.speed *= 0.45;
    v.latVel *= 0.3;
  }
  v.group.position.x = THREE.MathUtils.clamp(v.group.position.x, -HALF + 5, HALF - 5);
  v.group.position.z = THREE.MathUtils.clamp(v.group.position.z, OCEAN_START + 5, HALF - 5);

  // Wave plane + speed bob (GTA water plane)
  const wave =
    Math.sin(state.elapsed * 2.4 + v.group.position.x * 0.12) * 0.07 +
    Math.sin(state.elapsed * 1.6 + v.group.position.z * 0.09) * 0.05;
  const speedBob = Math.min(0.12, Math.abs(v.speed) * 0.008);
  v.group.position.y = WATER_SURFACE + 0.22 + wave + speedBob;

  // Bank into turns + pitch with throttle
  const bank = THREE.MathUtils.clamp(-steer * Math.min(1, Math.abs(v.speed) / 12) * 0.35, -0.45, 0.45);
  const pitch = THREE.MathUtils.clamp(throttle * 0.12 - Math.abs(v.speed) * 0.004, -0.15, 0.2);
  v.group.rotation.order = "YXZ";
  v.group.rotation.y = v.yaw;
  v.group.rotation.z = THREE.MathUtils.lerp(v.group.rotation.z || 0, bank + Math.sin(state.elapsed * 1.8) * 0.03, Math.min(1, 6 * dt));
  v.group.rotation.x = THREE.MathUtils.lerp(v.group.rotation.x || 0, pitch + Math.sin(state.elapsed * 2.1) * 0.025, Math.min(1, 5 * dt));

  // ── Water splashes / wake (GTA style) ──
  const spd = Math.abs(v.speed);
  if (spd > 2.5) {
    v._splashT = (v._splashT || 0) - dt;
    if (v._splashT <= 0) {
      v._splashT = 0.04 + Math.max(0, 0.12 - spd * 0.004);
      const power = Math.min(2.2, spd / 10);
      // Stern wake
      const bx = v.group.position.x - fwdX * 1.8;
      const bz = v.group.position.z - fwdZ * 1.8;
      spawnBoatSplash(bx, WATER_SURFACE + 0.15, bz, power);
      // Side spray when turning hard
      if (Math.abs(steer) > 0.2 && spd > 5) {
        spawnBoatSplash(
          v.group.position.x + rightX * steer * 1.2,
          WATER_SURFACE + 0.2,
          v.group.position.z + rightZ * steer * 1.2,
          power * 1.1
        );
      }
      // Bow spray at high speed
      if (spd > 12) {
        spawnBoatSplash(
          v.group.position.x + fwdX * 1.5,
          WATER_SURFACE + 0.25,
          v.group.position.z + fwdZ * 1.5,
          power * 0.8
        );
      }
    }
  }

  player.pos.copy(v.group.position);
  player.pos.y += 0.9;
  player.yaw = v.yaw;
  state.distance += Math.abs(v.speed) * dt;

  $("speed-num").textContent = Math.abs(Math.round(v.speed * 3.5));
  const unit = document.querySelector(".speed-unit");
  if (unit) unit.textContent = "KNOTS";
}

function updateOceanLife(dt) {
  for (const life of oceanLife) {
    const g = life.group;
    const dx = g.position.x - player.pos.x;
    const dz = g.position.z - player.pos.z;
    if (dx * dx + dz * dz > 180 * 180) {
      g.visible = false;
      continue;
    }
    g.visible = true;
    life.phase += dt * life.speed * 0.35;
    if (life.type === "fish") {
      g.position.x = life.home.x + Math.cos(life.phase) * life.radius;
      g.position.z = life.home.z + Math.sin(life.phase * 0.9) * life.radius;
      g.position.y = WATER_SURFACE - life.depth + Math.sin(life.phase * 2) * 0.3;
      g.rotation.y = -life.phase + Math.PI / 2;
    } else if (life.type === "dolphin") {
      // Swim FORWARD in OPEN OCEAN water only — never through the island mountain
      // Model snout is +Z → face tangent of path
      const rMin = life.orbitRMin ?? OCEAN_MTN_R + 16;
      const rMax = life.orbitRMax ?? OCEAN_R - 14;
      if (life.orbitA == null) {
        life.orbitA = Math.atan2(g.position.z - OCEAN_CZ, g.position.x - OCEAN_CX);
        life.orbitR = THREE.MathUtils.clamp(life.radius || 46, rMin, rMax);
        life.orbitDir = 1;
        life.orbitSpeed = 0.18;
        life.porpoisePhase = Math.random() * Math.PI * 2;
        life.porpoiseRate = 0.6;
      }
      if (life.swimPhase == null) life.swimPhase = 0;
      if (life.strokeRate == null) life.strokeRate = 5.2;
      if (life.yaw == null) life.yaw = 0;
      if (life.pitch == null) life.pitch = 0;
      if (life.roll == null) life.roll = 0;

      // Keep orbit radius in the safe water ring (outside mountain, inside shore)
      life.orbitR = THREE.MathUtils.clamp(life.orbitR || 46, rMin, rMax);

      const dir = life.orbitDir || 1;
      const prevY = g.position.y;

      // Cruise around the ocean ring (open water)
      life.orbitA += dt * (life.orbitSpeed || 0.18) * dir;
      // Soft radius breathe — still clamped inside safe ring
      let rPulse =
        (life.orbitR || 46) *
        (0.96 + 0.04 * Math.sin(life.orbitA * 0.7 + (life.phase || 0)));
      rPulse = THREE.MathUtils.clamp(rPulse, rMin, rMax);
      let nx = OCEAN_CX + Math.cos(life.orbitA) * rPulse;
      let nz = OCEAN_CZ + Math.sin(life.orbitA) * rPulse;

      // HARD clamp: open water only
      // 1) Never enter island mountain footprint
      {
        const mdx = nx - OCEAN_MTN_X;
        const mdz = nz - OCEAN_MTN_Z;
        const md = Math.hypot(mdx, mdz);
        const mSafe = OCEAN_MTN_R + 12;
        if (md < mSafe) {
          const s = mSafe / Math.max(0.01, md);
          nx = OCEAN_MTN_X + mdx * s;
          nz = OCEAN_MTN_Z + mdz * s;
        }
      }
      // 2) Stay inside ocean disc (not on surrounding land/mountains)
      {
        const odx = nx - OCEAN_CX;
        const odz = nz - OCEAN_CZ;
        const od = Math.hypot(odx, odz);
        const oMax = OCEAN_R - 12;
        if (od > oMax) {
          const s = oMax / Math.max(0.01, od);
          nx = OCEAN_CX + odx * s;
          nz = OCEAN_CZ + odz * s;
        }
      }
      // 3) If still not ocean (edge cases), pull toward known safe ring point
      if (typeof isOcean === "function" && !isOcean(nx, nz)) {
        const a = life.orbitA;
        const safeR = THREE.MathUtils.clamp((rMin + rMax) * 0.5, rMin, rMax);
        nx = OCEAN_CX + Math.cos(a) * safeR;
        nz = OCEAN_CZ + Math.sin(a) * safeR;
      }

      // Face the way they're swimming (tangent of orbit) — FORWARD
      const tangX = -Math.sin(life.orbitA) * dir;
      const tangZ = Math.cos(life.orbitA) * dir;
      const targetYaw = Math.atan2(tangX, tangZ); // matches snout +Z forward
      let dyaw = targetYaw - life.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      life.yaw += dyaw * Math.min(1, 6 * dt);

      // Smooth follow path (glide, not teleport)
      const ease = Math.min(1, 4.2 * dt);
      g.position.x += (nx - g.position.x) * ease;
      g.position.z += (nz - g.position.z) * ease;
      // Final safety: if ease left them near mountain, snap out of rock
      {
        const mdx = g.position.x - OCEAN_MTN_X;
        const mdz = g.position.z - OCEAN_MTN_Z;
        const md = Math.hypot(mdx, mdz);
        const mSafe = OCEAN_MTN_R + 12;
        if (md < mSafe) {
          const s = mSafe / Math.max(0.01, md);
          g.position.x = OCEAN_MTN_X + mdx * s;
          g.position.z = OCEAN_MTN_Z + mdz * s;
        }
      }

      // Slow porpoise: under → leap out → dive back in (classic dolphin swim)
      life.porpoisePhase =
        (life.porpoisePhase || 0) + dt * (life.porpoiseRate || 0.6);
      life.swimPhase += dt * life.strokeRate;
      const p = life.porpoisePhase;
      const stroke = Math.sin(life.swimPhase);
      const stroke2 = Math.sin(life.swimPhase - 0.85);
      const stroke3 = Math.sin(life.swimPhase - 1.6);

      // Shaped arc: spends more time underwater, then a clean slow jump
      // sin(p): -1 = deep, +1 = peak of leap
      const wave = Math.sin(p);
      // Base just under surface; lift into air on the positive half
      let ny = WATER_SURFACE - 1.15 + wave * 1.55 + stroke * 0.12;
      // On the leap half, add a soft extra arc so they clear the water
      if (wave > 0) {
        ny = WATER_SURFACE - 0.35 + wave * 2.35 + stroke * 0.1;
      }
      // Smooth height (no stiff snaps)
      g.position.y += (ny - g.position.y) * Math.min(1, 3.5 * dt);

      // Splash near surface on way out / way in
      const crossedUp =
        prevY < WATER_SURFACE + 0.05 && g.position.y >= WATER_SURFACE + 0.05;
      const crossedDown =
        prevY > WATER_SURFACE - 0.05 && g.position.y <= WATER_SURFACE - 0.05;
      if ((crossedUp || crossedDown) && Math.random() < 0.55) {
        spawnWaveSplash(g.position.x, g.position.z, 3);
      }

      g.rotation.order = "YXZ";
      g.rotation.y = life.yaw;

      // Nose up when rising, nose down when diving (matches the leap)
      const vy = g.position.y - prevY;
      let targetPitch = THREE.MathUtils.clamp(-vy * 4.0, -0.75, 0.75);
      // Extra: at leap crest, start tilting down
      targetPitch += -Math.cos(p) * 0.28;
      life.pitch += (targetPitch - life.pitch) * Math.min(1, 5 * dt);
      g.rotation.x = life.pitch;

      // Bank slightly into the ocean turn
      const targetRoll = THREE.MathUtils.clamp(-dyaw * 10 * dir, -0.35, 0.35);
      life.roll += (targetRoll - life.roll) * Math.min(1, 4 * dt);
      g.rotation.z = life.roll;

      // Fluke-driven body wave (alive, not stiff)
      if (life.body) life.body.rotation.x = stroke * 0.1;
      if (life.mid) life.mid.rotation.x = stroke * 0.16;
      if (life.front) life.front.rotation.x = stroke2 * 0.12;
      if (life.head) life.head.rotation.x = stroke2 * 0.06 + life.pitch * 0.1;
      if (life.tail) life.tail.rotation.x = -stroke * 0.42;
      if (life.tail2) life.tail2.rotation.x = -stroke2 * 0.55;
      if (life.fluke) life.fluke.rotation.x = -stroke3 * 0.85;
      if (life.pecL) {
        life.pecL.rotation.z = 0.32 + stroke * 0.1;
        life.pecL.rotation.x = stroke2 * 0.08;
      }
      if (life.pecR) {
        life.pecR.rotation.z = -0.32 - stroke * 0.1;
        life.pecR.rotation.x = stroke2 * 0.08;
      }
    } else if (life.type === "turtle") {
      g.position.x = life.home.x + Math.cos(life.phase * 0.5) * life.radius;
      g.position.z = life.home.z + Math.sin(life.phase * 0.4) * life.radius;
      g.position.y = WATER_SURFACE - life.depth + Math.sin(life.phase) * 0.25;
      g.rotation.y = -life.phase * 0.5 + Math.PI / 2;
      if (life.flipL) {
        life.flipL.rotation.z = 0.3 + Math.sin(life.phase * 3) * 0.4;
        life.flipR.rotation.z = -0.3 - Math.sin(life.phase * 3) * 0.4;
      }
    } else if (life.type === "jelly") {
      g.position.x = life.home.x + Math.sin(life.phase * 0.3) * life.radius;
      g.position.z = life.home.z + Math.cos(life.phase * 0.25) * life.radius;
      g.position.y = WATER_SURFACE - life.depth + Math.sin(life.phase * 1.5) * 0.6;
      g.scale.y = 0.9 + Math.sin(life.phase * 2) * 0.15;
    } else if (life.type === "shark") {
      const t = life.phase;
      g.position.x = life.home.x + Math.cos(t * 0.5) * life.radius;
      g.position.z = life.home.z + Math.sin(t * 0.4) * life.radius * 0.7;
      g.position.y = WATER_SURFACE - life.depth + Math.sin(t) * 0.3;
      g.rotation.y = -t * 0.5 + Math.PI / 2;
    } else if (life.type === "octopus") {
      g.position.x = life.home.x + Math.sin(life.phase * 0.4) * life.radius;
      g.position.z = life.home.z + Math.cos(life.phase * 0.35) * life.radius;
      g.position.y = WATER_SURFACE - life.depth + Math.sin(life.phase) * 0.2;
      g.rotation.y = life.phase * 0.2;
      g.children.forEach((ch, i) => {
        if (i > 0) ch.rotation.z = Math.sin(life.phase * 3 + i) * 0.25;
      });
    }
  }
}

function updateApples() {
  for (const a of apples) {
    if (a.eaten || !a.mesh) continue;
    a.tree.updateMatrixWorld(true);
    const world = new THREE.Vector3();
    world.copy(a.local).applyMatrix4(a.tree.matrixWorld);
    const dx = player.pos.x - world.x;
    const dy = player.pos.y + 1 - world.y;
    const dz = player.pos.z - world.z;
    if (dx * dx + dy * dy + dz * dz < 2.2) {
      a.eaten = true;
      a.mesh.visible = false;
      // Heal + snack reward
      state.hp = Math.min(state.maxHp, state.hp + 15);
      addXP(4);
      addCoins(5);
      toast("🍎 Ate an apple! +15 HP", "reward");
      updateHUD();
      // Respawn later on same tree
      setTimeout(() => {
        if (a.mesh) {
          a.eaten = false;
          a.mesh.visible = true;
        }
      }, 25000);
    }
  }
}

function updateRocket(dt, v) {
  // Proper rocket-ship flight: nose points where you go
  const thrust = state.keys["KeyW"] ? 1 : 0;
  const brake = state.keys["KeyS"] ? 1 : 0;
  const steer = (state.keys["KeyA"] ? 1 : 0) + (state.keys["KeyD"] ? -1 : 0);
  const climb = state.keys["Space"] || state.keys["Spacebar"] ? 1 : 0;
  const dive = state.keys["ControlLeft"] || state.keys["ControlRight"] ? 1 : 0;

  // Turn and pitch the ship
  v.yaw += steer * v.turn * dt;
  if (climb) v.pitch += v.pitchRate * dt;
  if (dive) v.pitch -= v.pitchRate * dt;
  // Mild auto-level toward slight climb when idle
  if (!climb && !dive) {
    v.pitch = THREE.MathUtils.lerp(v.pitch, 0.05, 1 - Math.pow(0.15, dt));
  }
  v.pitch = THREE.MathUtils.clamp(v.pitch, -0.85, 1.15);

  // Thrust along nose direction (YXZ: yaw then pitch)
  // Forward vector matching group.rotation YXZ
  const cp = Math.cos(v.pitch);
  const sp = Math.sin(v.pitch);
  const fx = -Math.sin(v.yaw) * cp;
  const fy = sp;
  const fz = -Math.cos(v.yaw) * cp;

  if (thrust) v.speed += v.accel * dt;
  if (brake) v.speed -= v.accel * 1.1 * dt;
  // Air drag
  v.speed *= 1 - 0.45 * dt;
  v.speed = THREE.MathUtils.clamp(v.speed, -8, v.maxSpeed);

  // Light gravity always, stronger when not thrusting
  const grav = thrust ? 2.5 : 9;
  v.vel = v.vel || new THREE.Vector3();
  // Blend velocity toward nose * speed, plus gravity
  v.vel.x = THREE.MathUtils.lerp(v.vel.x, fx * v.speed, 1 - Math.pow(0.08, dt));
  v.vel.y = THREE.MathUtils.lerp(v.vel.y, fy * v.speed, 1 - Math.pow(0.08, dt));
  v.vel.z = THREE.MathUtils.lerp(v.vel.z, fz * v.speed, 1 - Math.pow(0.08, dt));
  v.vel.y -= grav * dt;
  // Extra lift while holding Space with some speed
  if (climb && v.speed > 2) v.vel.y += 18 * dt;
  if (dive) v.vel.y -= 12 * dt;

  v.group.position.x += v.vel.x * dt;
  v.group.position.y += v.vel.y * dt;
  v.group.position.z += v.vel.z * dt;

  // World bounds
  v.group.position.x = THREE.MathUtils.clamp(v.group.position.x, -HALF + 4, HALF - 4);
  v.group.position.z = THREE.MathUtils.clamp(v.group.position.z, -HALF + 4, HALF - 4);
  const gy = groundY(v.group.position.x, v.group.position.z) + 0.55;
  if (v.group.position.y < gy) {
    // Hard impact while piloting → crash with big fire & smoke
    const impact = Math.max(0, -(v.vel?.y || 0));
    const hardHit = impact > 16 || (impact > 10 && (v.speed || 0) > 18);
    if (hardHit && !v.crashing && state.inVehicle && state.vehicle === v) {
      const boomPos = v.group.position.clone();
      boomPos.y = gy + 0.35;
      // Eject player near the wreck
      state.inVehicle = false;
      state.vehicle = null;
      v.occupied = false;
      player.pos.set(boomPos.x + 4, gy + 1.2, boomPos.z + 3);
      player.vel.set(0, 4, 0);
      state.hp = Math.max(20, (state.hp || 100) - 25);
      weaponGroup.visible = false;
      $("speedo")?.classList.add("hidden");
      explodeAt(boomPos, true);
      toast("💥 CRASH! Huge fire and smoke!", "kill");
      const type = v.hangarKey || v.type;
      scene.remove(v.group);
      const vi = vehicles.indexOf(v);
      if (vi >= 0) vehicles.splice(vi, 1);
      setTimeout(() => respawnHangarCraft(type), 1400);
      updateHUD();
      return;
    }
    v.group.position.y = gy;
    if (v.vel.y < 0) v.vel.y = 0;
    // Ground friction
    v.speed *= 1 - 2 * dt;
    v.vel.x *= 1 - 3 * dt;
    v.vel.z *= 1 - 3 * dt;
  }
  v.group.position.y = Math.min(v.group.position.y, 100);

  // Align ship to flight attitude (nose = +Z local)
  v.group.rotation.order = "YXZ";
  v.group.rotation.y = v.yaw;
  v.group.rotation.x = v.pitch;
  v.group.rotation.z = THREE.MathUtils.lerp(v.group.rotation.z, -steer * 0.25, 1 - Math.pow(0.05, dt));

  // Hot multi-color engine FIRE (blue → white → yellow → orange)
  const firing = thrust > 0 || (climb > 0 && v.speed > 1);
  const fireSets = v.fires || null;
  if (fireSets) {
    for (const f of fireSets) {
      f.group.visible = firing;
      if (firing) {
        const t = state.elapsed;
        const flicker = 0.8 + Math.sin(t * 60 + f.group.position.x) * 0.2 + Math.random() * 0.2;
        const stretch = 1.0 + Math.random() * 0.7 + thrust * 0.45;
        f.outer.scale.set(flicker * 1.15, flicker * 1.15, stretch);
        f.mid.scale.set(flicker, flicker, stretch * 0.95);
        f.white.scale.set(0.9 + Math.random() * 0.25, 0.9 + Math.random() * 0.25, stretch * 0.85);
        f.blue.scale.set(0.85 + Math.random() * 0.3, 0.85 + Math.random() * 0.3, stretch * 0.6);
        f.glow.scale.setScalar(0.85 + Math.sin(t * 45) * 0.3 + Math.random() * 0.25);
        f.glow.material.opacity = 0.3 + Math.random() * 0.35;
        // Cycle outer color slightly for living fire
        const heat = Math.sin(t * 30 + f.group.id) * 0.5 + 0.5;
        f.outer.material.color.setHex(heat > 0.5 ? 0xff4400 : 0xff6600);
        f.mid.material.color.setHex(heat > 0.6 ? 0xffdd00 : 0xffaa00);
      }
    }
  } else if (v.flame) {
    v.flame.visible = firing;
    if (v.flameMid) v.flameMid.visible = firing;
    if (v.flameInner) v.flameInner.visible = firing;
    if (v.flameGlow) v.flameGlow.visible = firing;
    if (firing) {
      const t = state.elapsed;
      const flicker = 0.85 + Math.sin(t * 55) * 0.18 + Math.random() * 0.15;
      const stretch = 1.0 + Math.random() * 0.55 + thrust * 0.35;
      v.flame.scale.set(flicker * 1.1, flicker * 1.1, stretch);
      if (v.flameMid) v.flameMid.scale.set(flicker, flicker, stretch * 0.9);
      if (v.flameInner) v.flameInner.scale.set(0.9 + Math.random() * 0.2, 0.9 + Math.random() * 0.2, stretch * 0.85);
      if (v.flameGlow) {
        v.flameGlow.scale.setScalar(0.9 + Math.sin(t * 40) * 0.25 + Math.random() * 0.2);
        v.flameGlow.material.opacity = 0.35 + Math.random() * 0.25;
      }
    }
  }
  // Hot embers from engines
  if (firing && Math.random() < 0.2 && particles.length < 50) {
    const cols = [0x3b82f6, 0xffffff, 0xffcc00, 0xff5500, 0xff8800];
    const ember = new THREE.Mesh(
      new THREE.SphereGeometry(0.05 + Math.random() * 0.06, 4, 4),
      new THREE.MeshBasicMaterial({ color: cols[Math.floor(Math.random() * cols.length)], transparent: true, opacity: 0.95 })
    );
    const wp = new THREE.Vector3(
      (Math.random() - 0.5) * 1.2,
      (Math.random() - 0.5) * 0.4,
      -2.4 - Math.random()
    );
    v.group.localToWorld(wp);
    ember.position.copy(wp);
    scene.add(ember);
    particles.push({
      mesh: ember,
      life: 0.25 + Math.random() * 0.3,
      max: 0.5,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 5
      ).addScaledVector(v.vel || new THREE.Vector3(), -0.4),
      type: "spark",
    });
  }
  if (v.pilot) v.pilot.visible = true;
  if (firing) {
    startRocketLoop();
  }

  player.pos.copy(v.group.position);
  player.yaw = v.yaw;
  state.distance += v.vel.length() * dt;

  $("speed-num").textContent = Math.abs(Math.round(v.vel.length() * 3.6));
  const unit = document.querySelector(".speed-unit");
  if (unit) unit.textContent = "FLIGHT";
}

function updateEnemies(dt) {
  const p = state.inVehicle ? state.vehicle.group.position : player.pos;
  let anyCombat = false;
  const survival = state.gameMode === "survival";

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive) continue;

    const dx = p.x - e.group.position.x;
    const dz = p.z - e.group.position.z;
    const distSq = dx * dx + dz * dz;

    // Far enemies: sleep (skip AI/animation)
    if (distSq > 55 * 55) {
      e.group.visible = distSq < 90 * 90;
      continue;
    }
    e.group.visible = true;

    e.bob += dt;
    e.attackCd = Math.max(0, e.attackCd - dt);
    const dist = Math.sqrt(distSq);

    // Friends mode (Y): skip combat AI — handled by updateSpiderFriendly
    if (state.spiderGame && state.spiderFriendly) {
      e.attackCd = 99;
      continue;
    }

    // AFK: patrol only · SURVIVAL / Spider fight: smart hunt
    const fightMode = (survival || state.spiderGame) && !state.spiderFriendly;
    if (fightMode && dist < 48) {
      e.state = "chase";
      anyCombat = true;
    } else {
      e.state = "patrol";
    }

    // Smarter combat AI (harder than simple chase)
    e.specialCd = Math.max(0, (e.specialCd || 0) - dt);
    e.strafeDir = e.strafeDir || (Math.random() > 0.5 ? 1 : -1);
    let running = false;
    if (e.state === "chase") {
      e.group.rotation.y = Math.atan2(dx, dz);
      const inv = dist > 0.01 ? 1 / dist : 0;
      // Circle-strafe when mid-range (smarter than rushing)
      if (dist > 3.5 && dist < 14 && e.kind !== "hulk") {
        const fx = dx * inv;
        const fz = dz * inv;
        const sx = -fz * e.strafeDir;
        const sz = fx * e.strafeDir;
        const mix = 0.55;
        e.group.position.x += (fx * (1 - mix) + sx * mix) * e.speed * 1.15 * dt;
        e.group.position.z += (fz * (1 - mix) + sz * mix) * e.speed * 1.15 * dt;
        if (Math.random() < 0.004) e.strafeDir *= -1;
        running = true;
      } else if (dist > 1.4) {
        // Close the gap
        const boost = e.kind === "hulk" ? 1.25 : e.kind === "spiderman" ? 1.35 : 1.15;
        e.group.position.x += dx * inv * e.speed * boost * dt;
        e.group.position.z += dz * inv * e.speed * boost * dt;
        running = true;
      }

      // Special powers (harder fight)
      if (e.specialCd <= 0 && dist < 18 && !state.inVehicle) {
        if (e.kind === "hulk" && dist < 10) {
          // Red Hulk leap smash
          e.specialCd = 3.5;
          e.group.position.x += dx * inv * 4.5;
          e.group.position.z += dz * inv * 4.5;
          e.group.position.y += 1.2;
          if (dist < 5) {
            damagePlayer(e.damage * 1.4);
            player.vel.y += 6;
            player.vel.x += dx * inv * 8;
            player.vel.z += dz * inv * 8;
            toast("🔴 RED HULK SMASH!", "kill");
          }
          if (typeof spawnHitSparks === "function") {
            spawnHitSparks(e.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 14, 0xdc2626);
          }
          playTone(90, 0.15, "square", 0.12);
        } else if (e.kind === "captain" && dist < 16) {
          // Shield throw projectile
          e.specialCd = 2.8;
          const from = e.group.position.clone();
          from.y += 1.2;
          const dir = new THREE.Vector3(dx, 0, dz).normalize();
          const shield = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35, 0.35, 0.08, 16),
            new THREE.MeshBasicMaterial({ color: 0xdc2626 })
          );
          shield.rotation.x = Math.PI / 2;
          shield.position.copy(from);
          scene.add(shield);
          state.spiderWebs.push({
            mesh: shield,
            life: 0.9,
            max: 0.9,
            _capProj: true,
            _dir: dir,
            _dmg: e.damage,
          });
          toast("🛡️ Cap throws his shield!", "quest");
          playTone(660, 0.08, "triangle", 0.09);
        } else if (e.kind === "spiderman" && dist < 14) {
          // Web yank — pull player closer
          e.specialCd = 2.4;
          player.vel.x += dx * inv * -10;
          player.vel.z += dz * inv * -10;
          player.vel.y += 3;
          toast("🕷 Enemy Spider-Man webs you!", "quest");
          playTone(880, 0.06, "sine", 0.08);
        } else if ((e.kind === "venom" || e.kind === "human") && dist < 12) {
          // Venom dash + bite
          e.specialCd = 2.6;
          e.group.position.x += dx * inv * 5;
          e.group.position.z += dz * inv * 5;
          if (dist < 6) damagePlayer(e.damage * 1.2);
          toast("🖤 Venom lunges!", "kill");
          playTone(140, 0.12, "sawtooth", 0.1);
        }
      }
    } else if (e.state === "patrol") {
      e.group.position.x += Math.sin(e.bob * 0.5) * e.speed * 0.4 * dt;
      e.group.position.z += Math.cos(e.bob * 0.4) * e.speed * 0.4 * dt;
      running = true;
    }

    // Human-like leg run bend on heroes
    const legs = e.group.userData && e.group.userData.runLegs;
    if (legs && legs.length >= 2) {
      const rate = running ? e.bob * (e.state === "chase" ? 14 : 9) : e.bob * 2;
      const a = Math.sin(rate);
      const b = -a;
      const hipA = running ? 0.7 : 0.12;
      const kneeA = running ? 1.05 : 0.15;
      legs[0].hip.rotation.x = a * hipA;
      legs[1].hip.rotation.x = b * hipA;
      legs[0].knee.rotation.x = Math.max(0.08, -Math.cos(rate)) * kneeA;
      legs[1].knee.rotation.x = Math.max(0.08, Math.cos(rate)) * kneeA;
    }

    // Venom turns back into a human, then into Venom again
    if (e.kind === "venom" || e.kind === "human") {
      e.formTimer = (e.formTimer || 8) - dt;
      if (e.formTimer <= 0) {
        e.formTimer = 7 + Math.random() * 5;
        const next = e.kind === "venom" ? "human" : "venom";
        const px = e.group.position.x;
        const pz = e.group.position.z;
        const hpKeep = e.hp;
        scene.remove(e.group);
        const ng = buildAvengerEnemyMesh(next);
        ng.position.set(px, groundY(px, pz), pz);
        scene.add(ng);
        e.group = ng;
        e.kind = next;
        e.hp = Math.max(15, hpKeep);
        if (next === "human") toast("Venom turns back into a human!", "quest");
        else toast("Eddie becomes VENOM!", "kill");
      }
    }

    const baseY = groundY(e.group.position.x, e.group.position.z);
    e.group.position.y = baseY + Math.sin(e.bob * 3) * 0.04 * (e.scaleBob || 1);

    if (fightMode && dist < 2.4 && e.attackCd <= 0 && !state.inVehicle) {
      damagePlayer(e.damage);
      e.attackCd =
        e.kind === "hulk" ? 1.35
        : e.kind === "venom" ? 0.95
        : e.kind === "spiderman" ? 0.9
        : e.kind === "human" ? 1.2
        : 1.1;
    }
    // You can still ram / shoot monsters in either mode
    if (state.inVehicle && dist < 2.5 && Math.abs(state.vehicle.speed) > 12) {
      damageEnemy(e, 30);
      state.vehicle.speed *= 0.7;
    }
  }

  if (survival && anyCombat && !state.racing) {
    setMode("SURVIVAL");
  }
}

// ─────────────────────────────────────────────────────────────
// FRAME
// ─────────────────────────────────────────────────────────────
function frame() {
  requestAnimationFrame(frame);
  if (!state.started) return;
  const dt = Math.min(state.clock.getDelta(), 0.05);
  if (!state.paused) update(dt);
  updateSunShadow();
  renderer.render(scene, camera);
}

// Auto-downgrade if the machine is still struggling
let _fpsFrames = 0;
let _fpsLast = performance.now();
function watchPerf() {
  requestAnimationFrame(watchPerf);
  if (!state.started) return;
  _fpsFrames++;
  const now = performance.now();
  if (now - _fpsLast >= 2000) {
    const fps = (_fpsFrames * 1000) / (now - _fpsLast);
    _fpsFrames = 0;
    _fpsLast = now;
    if (fps < 28 && PERF.shadows) {
      PERF.shadows = false;
      renderer.shadowMap.enabled = false;
      sun.castShadow = false;
      console.info("[NEXUS] Low FPS — shadows disabled for speed");
      toast("Boost mode: shadows off for smoother play", "reward");
    }
    if (fps < 22 && PERF.pixelRatio > 1) {
      PERF.pixelRatio = 1;
      renderer.setPixelRatio(1);
      console.info("[NEXUS] Low FPS — resolution capped");
    }
  }
}
watchPerf();

// ─────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────

/** Empty-world spawn — flat grass, normal standing character (not giant/fat/astronaut) */
function snapPlayerToSafeSpawn() {
  const sx = 0;
  const sz = 8;
  let sy = 1.2;
  try {
    sy = (typeof walkHeight === "function" ? walkHeight(sx, sz) : groundY(sx, sz)) + 0.45;
  } catch (_) {
    try { sy = groundY(sx, sz) + 0.45; } catch (__) { sy = 1.2; }
  }
  if (!Number.isFinite(sy) || sy < 0.5) sy = 1.2;
  player.pos.set(sx, sy, sz);
  player.vel.set(0, 0, 0);
  player.yaw = 0;
  player.pitch = -0.08;
  player.onGround = true;
  player.camDist = 6;
  player.camDistTarget = 6;
  // Keep normal body scale — never force giant/fat/astronaut
  try {
    if (player.mesh) player.mesh.scale.set(1, 1, 1);
    if (player.group) player.group.scale.set(1, 1, 1);
  } catch (_) {}
  if (player.eye) {
    player.eye.position.copy(player.pos);
    player.eye.position.y += player.height;
  }
}

function startGame() {
  titleScreen.classList.add("hidden");
  gameRoot.classList.remove("hidden");
  state.started = true;
  state.clock.start();
  try { snapPlayerToSafeSpawn(); } catch (_) {}
  // Restore ONLY fidgets you actually bought (nothing free)
  loadInventoryForever();
  if (state._restoreHatPower && hasInvItem("hatPower")) {
    applyHatPower(true);
    state._restoreHatPower = false;
  }
  if (hasInvItem("waterdino") || hasInvItem("waterDinosaur")) {
    ensureWaterDinosaur();
  }
  renderInventory();
  checkNiftyBundleExpiry();
  canvas.requestPointerLock();
  updateHUD();
  renderQuests();
  updateCalendarHud();
  resumeAudio();
  toast(`Welcome to NEXUS — today is ${formatGameDate()}!`, "quest");
  setTimeout(() => toast("📅 Press M for calendar · I for inventory (fidgets forever)", "reward"), 1500);
  setTimeout(() => toast("✈ Airport NE · 🔧 Michael + buy bundle · E boards planes", "quest"), 2500);
  if (anyFidgetOwned()) {
    setTimeout(() => toast("Your bought fidgets are in inventory — press I", "reward"), 3500);
  }
}

// Unlock audio on first click / key
window.addEventListener("pointerdown", () => resumeAudio(), { once: true });
window.addEventListener("keydown", () => resumeAudio(), { once: true });

playBtn.addEventListener("click", startGame);
resumeBtn.addEventListener("click", () => {
  if (state.paused && !state.settingsOpen) togglePause();
});

// Fidget shop — buy or try each item
for (const kind of ["nifty", "venom", "waterdino"]) {
  const btn = $(`buy-fidget-${kind}`);
  if (btn) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      buyFidgetItem(kind);
    });
  }
  const tryBtn = $(`try-fidget-${kind}`);
  if (tryBtn) {
    tryBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      startFidgetTrial(kind);
    });
  }
}
const niftyOfferCancel = $("nifty-offer-cancel");
if (niftyOfferCancel) {
  niftyOfferCancel.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    cancelNiftyBundleOffer();
  });
}
$("fidget-trial-done")?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  endFidgetTrial("done");
  try { canvas.requestPointerLock(); } catch (_) {}
});
// Inventory (I) panel
$("inv-close")?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  closeInventory();
});
$("inventory-panel")?.addEventListener("click", (e) => {
  // clicks inside stay open; don't bubble to canvas
  e.stopPropagation();
});
// Load saved inventory as soon as page is ready
loadInventoryForever();
renderInventory();
// Hotbar slots 8 / 9 / 0 for power swords
document.querySelectorAll(".nifty-slot").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const n = String(el.dataset.slot);
    if (n === "8") equipSword("nifty");
    else if (n === "9") equipSword("venom");
    else if (n === "0") equipSword("waterdino");
  });
});

// Michael rocket BUY / TRY / DONE UI
const rocketBuyBtn = $("rocket-buy-btn");
const rocketTryBtn = $("rocket-try-btn");
const rocketOfferCancel = $("rocket-offer-cancel");
const rocketTrialDone = $("rocket-trial-done");
if (rocketBuyBtn) {
  rocketBuyBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    answerMichael("rocketBuy");
    // re-lock pointer for flying after UI click
    try { canvas.requestPointerLock(); } catch (_) {}
  });
}
if (rocketTryBtn) {
  rocketTryBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    answerMichael("rocketTry");
    try { canvas.requestPointerLock(); } catch (_) {}
  });
}
if (rocketOfferCancel) {
  rocketOfferCancel.addEventListener("click", (e) => {
    e.preventDefault();
    state.michaelRocketChoice = false;
    state.michaelOffer = false;
    showRocketOfferUI(false);
    toast("Maybe later.", "");
    try { canvas.requestPointerLock(); } catch (_) {}
  });
}
if (rocketTrialDone) {
  rocketTrialDone.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    endIronManRocketTrial("done");
    try { canvas.requestPointerLock(); } catch (_) {}
  });
}
const spiderHomeBtn = $("spider-home-btn");
if (spiderHomeBtn) {
  spiderHomeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    exitSpiderGame();
    try { canvas.requestPointerLock(); } catch (_) {}
  });
}

buildWorld();
buildWeatherFX();
setupInput();
setupSettingsUI();
setupLeaderboardUI();
// Rainy weather on load
setWeather("spring", false);
updateHUD();
renderQuests();
updateCalendarHud();
frame();

// Debug hook for screenshots / console
window.__nexus = {
  player,
  avatar,
  setZoom(d) {
    player.camDistTarget = d;
    player.camDist = d;
  },
};

console.log("%cNEXUS ready — open world unlocked", "color:#00f5d4;font-size:14px;font-weight:bold");
