import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Sfx } from "./audio";
import {
  WEAPONS, PERKS, ENEMY_DEFS, RADIO_LINES, WAVE_QUIPS, CHIP_BONUSES,
  type WeaponDef, type PerkDef,
} from "./data";

/* ============================== types ============================== */

export interface HudWeapon { id: number; name: string; mag: number; magSize: number; unlocked: boolean; active: boolean; kind: string }
export interface HudData {
  hp: number; maxHp: number; level: number; xp: number; xpNext: number;
  kills: number; wave: number; time: number;
  weapons: HudWeapon[]; weaponIdx: number; reloading: boolean; reloadFrac: number;
  basiliskHp: number; basiliskMax: number; progress: number;
  sandeActive: boolean; sandeFrac: number; dashFrac: number;
  spread: number; aiming: boolean; implants: string[]; yaw: number;
  radar: { x: number; z: number; k: string }[];
  net: {
    role: "host" | "guest" | null; ping: number; room: string; gdead: boolean; respawnIn: number;
    squad: { name: string; hp: number; maxHp: number; me: boolean; dead: boolean }[];
  };
}
export interface RunStats { kills: number; level: number; timeSec: number; accuracy: number; dmgDealt: number; wave: number }
export type GameEv =
  | { t: "toast"; text: string; tone: "panam" | "sys" | "chip" | "warn" }
  | { t: "float"; x: number; y: number; text: string; crit: boolean; heal?: boolean }
  | { t: "banner"; text: string; sub?: string }
  | { t: "hurt" }
  | { t: "levelup"; options: PerkDef[] }
  | { t: "death"; stats: RunStats; reason: string }
  | { t: "victory"; stats: RunStats }
  | { t: "pause" };

export interface EngineCallbacks { onHud: (h: HudData) => void; onEvent: (e: GameEv) => void }

/* ============================== consts ============================== */

const TRAVEL = 640;
const CORRIDOR = 88;
const SANDE_TIME = 4.5;
const DASH_CD = 3.5;

interface Enemy {
  eid: number; root: THREE.Group; kind: "drone" | "soldier" | "heavy";
  hp: number; maxHp: number; speed: number; fireT: number; meleeT: number;
  orbitA: number; strafe: number; fuse: number; flash: number; bobT: number;
  burst: number; burstT: number; dead: boolean;
  bar: THREE.Sprite; barTex: THREE.CanvasTexture; barCtx: CanvasRenderingContext2D;
  mats: THREE.MeshStandardMaterial[]; rotors?: THREE.Group;
}
interface Bolt { mesh: THREE.Mesh; vel: THREE.Vector3; dmg: number; life: number; visual?: boolean; pid?: string | null }
interface Particle { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; max: number }
interface Tracer { mesh: THREE.Mesh; life: number; max: number }
interface Pickup { group: THREE.Group; kind: "med" | "chip"; t: number; id: number }

interface SquadMember {
  pid: string; name: string; hp: number; maxHp: number; dead: boolean;
  x: number; y: number; z: number; yaw: number; w: number; f: boolean; last: number;
}
interface RemotePlayer {
  pid: string; name: string; group: THREE.Group; accent: THREE.MeshStandardMaterial;
  muzzle: THREE.PointLight; tx: number; ty: number; tz: number; trot: number; dead: boolean;
}

let EID = 1;
let PICKUP_ID = 1;
export const GUEST_NAMES = ["ПАНАМ", "ДЖЕККИ", "ДЖУДИ"];
export const AVATAR_COLORS = [0xff9a3d, 0xff2d78, 0x00e5ff];

/* ============================== helpers ============================== */

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function sandTexture(): THREE.CanvasTexture {
  const t = canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = "#4a342a";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5200; i++) {
      const g = Math.random();
      ctx.fillStyle = g < 0.5 ? "rgba(30,18,14,0.25)" : g < 0.8 ? "rgba(96,68,52,0.22)" : "rgba(255,170,110,0.10)";
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = "rgba(20,10,10,0.08)";
      ctx.beginPath();
      ctx.ellipse(Math.random() * 256, Math.random() * 256, 8 + Math.random() * 26, 4 + Math.random() * 10, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function windowsTexture(): THREE.CanvasTexture {
  return canvasTex(64, 128, (ctx) => {
    ctx.fillStyle = "#0c0a16";
    ctx.fillRect(0, 0, 64, 128);
    const cols = ["#00e5ff", "#fcee0a", "#ff2d78", "#ffb35a", "#7ad7ff"];
    for (let y = 4; y < 124; y += 8)
      for (let x = 4; x < 60; x += 8)
        if (Math.random() < 0.34) {
          ctx.fillStyle = cols[Math.floor(Math.random() * cols.length)];
          ctx.globalAlpha = 0.5 + Math.random() * 0.5;
          ctx.fillRect(x, y, 4, 4);
        }
    ctx.globalAlpha = 1;
  });
}
function billboardTexture(text: string, color: string, hazard = false): THREE.CanvasTexture {
  return canvasTex(512, 256, (ctx) => {
    ctx.fillStyle = "#0d0818";
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, 492, 236);
    if (hazard) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(10, 200, 492, 46);
      ctx.clip();
      for (let x = -60; x < 560; x += 46) {
        ctx.fillStyle = x % 92 === 0 ? "#fcee0a" : "#141021";
        ctx.beginPath();
        ctx.moveTo(x, 246); ctx.lineTo(x + 26, 200); ctx.lineTo(x + 46, 200); ctx.lineTo(x + 20, 246);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.font = "700 84px Rajdhani, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = color;
    ctx.shadowBlur = 34;
    ctx.fillStyle = color;
    ctx.fillText(text, 256, hazard ? 108 : 128, 460);
    ctx.shadowBlur = 0;
    ctx.font = "600 26px Rajdhani, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText("NIGHT CITY // BADLANDS TRANSIT", 256, hazard ? 44 : 216);
  });
}
function roadTexture(): THREE.CanvasTexture {
  const t = canvasTex(128, 512, (ctx) => {
    ctx.fillStyle = "#17141d";
    ctx.fillRect(0, 0, 128, 512);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(Math.random() * 128, Math.random() * 512, 1.5, 1.5);
    }
    ctx.fillStyle = "#e8c832";
    for (let y = 0; y < 512; y += 96) ctx.fillRect(60, y, 8, 52);
    ctx.fillStyle = "rgba(0,229,255,0.5)";
    ctx.fillRect(6, 0, 3, 512);
    ctx.fillRect(119, 0, 3, 512);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(26, 0, 14, 512);
    ctx.fillRect(88, 0, 14, 512);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function skyTexture(): THREE.CanvasTexture {
  return canvasTex(32, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#05020c");
    g.addColorStop(0.35, "#160a2e");
    g.addColorStop(0.55, "#43124b");
    g.addColorStop(0.72, "#8c1f52");
    g.addColorStop(0.85, "#e04a3a");
    g.addColorStop(0.94, "#ff9350");
    g.addColorStop(1, "#ffc873");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 256);
  });
}

/* ============================== engine ============================== */

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private cb: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  sfx = new Sfx();

  private mode: "attract" | "play" = "attract";
  paused = false;
  private awaitPerk = false;
  private ended: null | "dead" | "won" = null;
  private victoryT = -1;

  /* player */
  private pos = new THREE.Vector3(5, 0, -8);
  private vel = new THREE.Vector3();
  private yaw = Math.PI; private pitch = 0;
  private onGround = true;
  private hp = 100; private maxHp = 100;
  private invulnT = 0; private dashCd = 0; private sandeT = 0; private sandeCd = 0;
  private shakeT = 0; private recoil = 0; private bobPhase = 0; private shotKick = 0;
  private keys = new Set<string>();
  private mouseDown = false; private aiming = false;
  private weaponIdx = 0;
  private mags = WEAPONS.map((w) => w.mag);
  private unlockedW = WEAPONS.map((w) => w.unlockWave <= 1);
  private fireCd = 0; private reloading = false; private reloadT = 0;
  private fovTarget = 75;

  /* rpg */
  private level = 1; private xp = 0; private xpNext = 60; private pendingLevels = 0;
  private perks: Record<string, number> = {};
  private dmgMult = 1; private critCh = 0.08; private critMult = 2; private speedMult = 1;
  private resist = 0; private regen = 0; private leech = 0;
  private sandeCdMult = 1; private magMult = 1; private reloadMult = 1; private spreadMult = 1;
  private mantis = false; private ice = false;

  /* run */
  private runT = 0; private kills = 0; private shots = 0; private hitsC = 0; private dmgDealt = 0;
  private wave = 0; private waveT = 2.5; private hudT = 0; private timeScale = 1;
  private radioIdx = 0;

  /* entities */
  private enemies: Enemy[] = [];
  private enemyById = new Map<number, Enemy>();
  private enemyRoots: THREE.Group[] = [];
  private bolts: Bolt[] = [];
  private particles: Particle[] = [];
  private tracers: Tracer[] = [];
  private pickups: Pickup[] = [];
  private spawnQueue: { kind: "drone" | "soldier" | "heavy"; t: number }[] = [];

  /* basilisk */
  private basilisk!: THREE.Group;
  private basiliskHp = 1000; private basiliskMax = 1000;
  private coreLight!: THREE.PointLight; private coreMat!: THREE.MeshStandardMaterial;
  private basiliskDead = false;

  /* world refs */
  private sunLight!: THREE.DirectionalLight;
  private dust!: THREE.Points; private dustPos!: Float32Array;
  private avs: { m: THREE.Mesh; sp: number; dir: number }[] = [];
  private flickers: { m: THREE.MeshStandardMaterial; phase: number; base: number }[] = [];
  private beaconBeam!: THREE.Mesh;
  private viewmodel!: THREE.Group; private muzzleAnchor!: THREE.Object3D;
  private muzzleLight!: THREE.PointLight; private muzzleFlashT = 0;
  private ray = new THREE.Raycaster();

  /* temps */
  private tmpV = new THREE.Vector3(); private tmpV2 = new THREE.Vector3();

  /* ---------- net (co-op) ---------- */
  netMode: null | "host" | "guest" = null;
  roomCode = "";
  netPing = 0;
  guestDead = false;
  private netSendFn: ((to: string | null, m: unknown) => void) | null = null;
  private netTick = 0; private netStateTick = 0;
  private squad = new Map<string, SquadMember>();
  private remotePlayers = new Map<string, RemotePlayer>();
  private netTargets = new Map<number, { x: number; z: number; rot: number; hp: number; max: number; fuse: number }>();
  private netBkZ = 0; private netBkHp = 1000; private netPk = new Map<number, Pickup>();
  private respawnWait = 0; private reqSent = false;
  private guestName = "ПАНАМ";
  private avInfo = new Map<string, { name: string; hp: number; dead: boolean }>();

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks) {
    this.canvas = canvas;
    this.cb = cb;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x2a1030, 70, 470);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 2000);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.45, 0.78));
    this.composer.addPass(new OutputPass());

    this.buildWorld();
    this.buildViewmodel("pistol");

    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("pointerlockchange", this.onPlChange);
    canvas.addEventListener("contextmenu", this.onCtx);
    canvas.addEventListener("mousedown", this.onCanvasDown);

    this.clock.start();
    this.loop();
  }

  /* ---------------- world ---------------- */

  private buildWorld() {
    /* lights */
    const hemi = new THREE.HemisphereLight(0x7a4a8a, 0x3a2418, 0.55);
    this.scene.add(hemi);
    this.sunLight = new THREE.DirectionalLight(0xff9a4d, 1.25);
    this.sunLight.position.set(-120, 100, -160);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    const sc = this.sunLight.shadow.camera;
    sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 400;
    this.scene.add(this.sunLight, this.sunLight.target);

    /* sky */
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false })
    );
    this.scene.add(sky);

    /* sun */
    const sun = new THREE.Mesh(new THREE.CircleGeometry(75, 32), new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }));
    sun.position.set(240, 74, 780);
    sun.lookAt(0, 40, 0);
    this.scene.add(sun);
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(150, 32),
      new THREE.MeshBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, fog: false })
    );
    halo.position.copy(sun.position);
    halo.lookAt(0, 40, 0);
    this.scene.add(halo);

    /* ground */
    const sandT = sandTexture();
    sandT.repeat.set(60, 160);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, TRAVEL + 900),
      new THREE.MeshStandardMaterial({ map: sandT, color: 0xcbb4a0, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, (TRAVEL + 300) / 2 - 250);
    ground.receiveShadow = true;
    this.scene.add(ground);

    /* road */
    const roadT = roadTexture();
    roadT.repeat.set(1, 90);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(13, TRAVEL + 500),
      new THREE.MeshStandardMaterial({ map: roadT, roughness: 0.9 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, (TRAVEL + 200) / 2 - 150);
    road.receiveShadow = true;
    this.scene.add(road);

    /* skyline */
    const winT = windowsTexture();
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rnd(430, 700);
      const w = rnd(14, 42), h = rnd(40, 175), d = rnd(14, 42);
      const t = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: 0x141021, emissive: 0xffffff, emissiveMap: winT, emissiveIntensity: 0.85, roughness: 0.8 })
      );
      t.position.set(Math.cos(a) * r, h / 2 - 2, -120 + Math.sin(a) * r);
      this.scene.add(t);
    }

    /* props */
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < 90; i++) {
      const s = rnd(0.5, 3);
      const x = (Math.random() < 0.5 ? -1 : 1) * rnd(12, 150);
      const rock = new THREE.Mesh(rockGeo, new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.07, 0.25, rnd(0.16, 0.26)), flatShading: true, roughness: 1 }));
      rock.scale.set(s, s * rnd(0.6, 1), s);
      rock.position.set(x, s * 0.28, rnd(-80, TRAVEL + 180));
      rock.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3));
      this.scene.add(rock);
    }
    for (let i = 0; i < 40; i++) {
      const h = rnd(1.6, 3.4);
      const cactus = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x2e5d3a, roughness: 0.9, flatShading: true });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, h, 7), mat);
      trunk.position.y = h / 2;
      cactus.add(trunk);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, h * 0.45, 6), mat);
      arm.position.set(0.42, h * 0.55, 0);
      arm.rotation.z = -0.9;
      cactus.add(arm);
      cactus.position.set((Math.random() < 0.5 ? -1 : 1) * rnd(14, 140), 0, rnd(-60, TRAVEL + 160));
      this.scene.add(cactus);
    }
    const pylonCols = [0x00e5ff, 0xff2d78, 0xfcee0a];
    for (let i = 0; i < 14; i++) {
      const x = (i % 2 === 0 ? -1 : 1) * rnd(20, 60);
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.5, 15, 0.5), new THREE.MeshStandardMaterial({ color: 0x17141f, roughness: 0.7 }));
      pole.position.y = 7.5;
      g.add(pole);
      const col = pylonCols[i % 3];
      const panel = new THREE.MeshStandardMaterial({ color: 0x0c0a14, emissive: col, emissiveIntensity: 1.6, roughness: 0.5 });
      const head = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.2, 0.25), panel);
      head.position.y = 13.4;
      g.add(head);
      this.flickers.push({ m: panel, phase: rnd(0, 9), base: 1.6 });
      g.position.set(x, 0, -40 + i * ((TRAVEL + 120) / 14));
      this.scene.add(g);
    }
    const boards: { t: string; c: string; h?: boolean }[] = [
      { t: "ARASAKA", c: "#ff3b4e" }, { t: "НАЙТ-СИТИ ← 12КМ", c: "#00e5ff" },
      { t: "ОПАСНО // МИНЫ", c: "#fcee0a", h: true }, { t: "ALDECALDOS", c: "#ff9a3d" },
      { t: "ЭВАКУАЦИЯ →", c: "#00e5ff" }, { t: "KANG TAO", c: "#ff2d78" },
      { t: "СОЛНЦЕ САДИТСЯ", c: "#ffb35a" },
    ];
    boards.forEach((b, i) => {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x111018, roughness: 0.8 });
      [-3.4, 3.4].forEach((px) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9, 0.4), mat);
        leg.position.set(px, 4.5, 0);
        g.add(leg);
      });
      const tex = billboardTexture(b.t, b.c, !!b.h);
      const bm = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.05, roughness: 0.6, side: THREE.DoubleSide });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), bm);
      plane.position.y = 10.6;
      g.add(plane);
      this.flickers.push({ m: bm, phase: rnd(0, 9), base: 1.05 });
      const x = (i % 2 === 0 ? -1 : 1) * rnd(26, 55);
      g.position.set(x, 0, -20 + i * ((TRAVEL + 80) / boards.length));
      g.rotation.y = x > 0 ? -0.5 : 0.5;
      this.scene.add(g);
    });
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      const rust = new THREE.MeshStandardMaterial({ color: 0x4d3226, roughness: 1, flatShading: true });
      const body = new THREE.Mesh(new THREE.BoxGeometry(rnd(2, 3.4), 1.1, rnd(3.6, 5)), rust);
      body.position.y = 0.7;
      body.rotation.y = rnd(0, 3);
      body.rotation.z = rnd(-0.14, 0.14);
      g.add(body);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.4), rust);
      cab.position.set(rnd(-0.6, 0.6), 1.5, rnd(-1, 1));
      cab.rotation.y = rnd(0, 3);
      g.add(cab);
      g.position.set((Math.random() < 0.5 ? -1 : 1) * rnd(16, 120), 0, rnd(-40, TRAVEL + 120));
      this.scene.add(g);
    }

    /* dust */
    const N = 340;
    this.dustPos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.dustPos[i * 3] = rnd(-40, 40);
      this.dustPos[i * 3 + 1] = rnd(0.2, 11);
      this.dustPos[i * 3 + 2] = rnd(-40, 40);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(this.dustPos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffc9a0, size: 0.075, transparent: true, opacity: 0.5, sizeAttenuation: true }));
    this.scene.add(this.dust);

    /* AVs */
    for (let i = 0; i < 5; i++) {
      const col = i % 2 === 0 ? 0x00e5ff : 0xff2d78;
      const m = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 0.9), new THREE.MeshBasicMaterial({ color: col }));
      m.position.set(rnd(-400, 400), rnd(45, 95), rnd(-120, TRAVEL));
      this.scene.add(m);
      this.avs.push({ m, sp: rnd(14, 34), dir: i % 2 === 0 ? 1 : -1 });
    }

    /* basilisk */
    this.basilisk = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x333849, metalness: 0.65, roughness: 0.42 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1f29, metalness: 0.5, roughness: 0.6 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.7, 8.6), hullMat);
    hull.position.y = 1.75; hull.castShadow = true;
    this.basilisk.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.15, 3.4), darkMat);
    cabin.position.set(0, 3.15, -0.6); cabin.castShadow = true;
    this.basilisk.add(cabin);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, 0.1), new THREE.MeshStandardMaterial({ color: 0x04222a, emissive: 0x00e5ff, emissiveIntensity: 2.4 }));
    visor.position.set(0, 3.3, -2.36);
    this.basilisk.add(visor);
    [-1, 1].forEach((s) => {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.9, 5.4), darkMat);
      pod.position.set(s * 2.75, 1.35, 0.4); pod.castShadow = true;
      this.basilisk.add(pod);
      const track = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 7.6), new THREE.MeshStandardMaterial({ color: 0x101118, roughness: 1 }));
      track.position.set(s * 2.2, 0.62, 0);
      this.basilisk.add(track);
    });
    this.coreMat = new THREE.MeshStandardMaterial({ color: 0x062a30, emissive: 0x00e5ff, emissiveIntensity: 2.6 });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 0.5, 10), this.coreMat);
    core.position.set(0, 3.0, 3.1);
    this.basilisk.add(core);
    this.coreLight = new THREE.PointLight(0x00e5ff, 2.4, 26);
    this.coreLight.position.set(0, 3.4, 3.2);
    this.basilisk.add(this.coreLight);
    const under = new THREE.PointLight(0x00c8e0, 1.3, 12);
    under.position.set(0, 0.4, 0);
    this.basilisk.add(under);
    const ram = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 0.8), hullMat);
    ram.position.set(0, 1.2, -4.6); ram.rotation.x = 0.35;
    this.basilisk.add(ram);
    const ant = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2030, emissiveIntensity: 3 }));
    ant.position.set(1.1, 4.3, 1.2);
    this.basilisk.add(ant);
    this.flickers.push({ m: ant.material as THREE.MeshStandardMaterial, phase: 0, base: 3 });
    this.basilisk.position.set(0, 0, 0);
    this.scene.add(this.basilisk);

    /* evacuation beacon */
    const beacon = new THREE.Group();
    this.beaconBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 3.4, 150, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
    );
    this.beaconBeam.position.y = 75;
    beacon.add(this.beaconBeam);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.35, 8, 26), new THREE.MeshStandardMaterial({ color: 0x0a2a30, emissive: 0x00e5ff, emissiveIntensity: 2.2 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4;
    beacon.add(ring);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.6, 0.5, 14), new THREE.MeshStandardMaterial({ color: 0x191c26, metalness: 0.6, roughness: 0.5 }));
    pad.position.y = 0.12;
    beacon.add(pad);
    const bLight = new THREE.PointLight(0x00e5ff, 2.6, 70);
    bLight.position.y = 6;
    beacon.add(bLight);
    beacon.position.set(0, 0, TRAVEL);
    this.scene.add(beacon);
  }

  private buildViewmodel(kind: WeaponDef["kind"]) {
    if (this.viewmodel) {
      this.camera.remove(this.viewmodel);
      this.viewmodel.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material;
        if (mat) mat.dispose();
      });
    }
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x191b24, metalness: 0.8, roughness: 0.35 });
    const accent = new THREE.MeshStandardMaterial({ color: 0x08272c, emissive: 0x00e5ff, emissiveIntensity: 1.8 });
    const bodyLen = kind === "shotgun" ? 0.72 : kind === "smg" ? 0.62 : 0.5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.15, bodyLen), metal);
    g.add(body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(kind === "shotgun" ? 0.1 : 0.07, kind === "shotgun" ? 0.1 : 0.07, kind === "shotgun" ? 0.5 : 0.36), metal);
    barrel.position.set(0, 0.02, -(bodyLen / 2 + 0.16));
    g.add(barrel);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.03, bodyLen * 0.7), accent);
    strip.position.set(0, 0.065, -0.02);
    g.add(strip);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.12), metal);
    grip.position.set(0, -0.15, bodyLen * 0.24);
    grip.rotation.x = 0.3;
    g.add(grip);
    if (kind === "smg") {
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.26, 0.14), metal);
      mag.position.set(0, -0.18, -0.06);
      g.add(mag);
    }
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), new THREE.MeshStandardMaterial({ color: 0x332900, emissive: 0xfcee0a, emissiveIntensity: 2 }));
    tip.position.set(0, 0.02, -(bodyLen / 2 + 0.36));
    g.add(tip);
    this.muzzleAnchor = new THREE.Object3D();
    this.muzzleAnchor.position.set(0, 0.02, -(bodyLen / 2 + 0.42));
    g.add(this.muzzleAnchor);
    g.position.set(0.32, -0.3, -0.55);
    this.viewmodel = g;
    this.camera.add(g);
    if (!this.muzzleLight) {
      this.muzzleLight = new THREE.PointLight(0xffd27a, 0, 16);
      this.muzzleLight.position.set(0.3, -0.2, -1.1);
      this.camera.add(this.muzzleLight);
    }
  }

  /* ---------------- lifecycle ---------------- */

  start() {
    this.reset();
    this.mode = "play";
    this.sfx.ensure();
    this.sfx.startMusic();
    if (this.netMode === "guest") {
      this.cb.onEvent({ t: "banner", text: "СВЯЗЬ УСТАНОВЛЕНА", sub: `Ты — ${this.guestName}. Прикрывай Ви и «Базилиск»` });
    } else if (this.netMode === "host") {
      this.cb.onEvent({ t: "banner", text: "РЕЖИМ СО-ОП", sub: "Отряд в сети — доведите «Базилиск» до маяка" });
    } else {
      this.cb.onEvent({ t: "banner", text: "ЭСКАП-ПРОТОКОЛ", sub: "Доведи «Базилиск» до маяка" });
    }
    this.requestLock();
  }

  reset() {
    [...this.enemies].forEach((e) => this.removeEnemy(e, true));
    this.bolts.forEach((b) => this.scene.remove(b.mesh));
    this.bolts = [];
    this.particles.forEach((p) => this.scene.remove(p.mesh));
    this.particles = [];
    this.tracers.forEach((t) => this.scene.remove(t.mesh));
    this.tracers = [];
    this.pickups.forEach((p) => this.scene.remove(p.group));
    this.pickups = [];
    this.spawnQueue = [];

    this.pos.set(5, 0, -8); this.vel.set(0, 0, 0);
    this.yaw = Math.PI; this.pitch = -0.05;
    this.hp = 100; this.maxHp = 100;
    this.invulnT = 0; this.dashCd = 0; this.sandeT = 0; this.sandeCd = 0;
    this.shakeT = 0; this.recoil = 0; this.shotKick = 0;
    this.weaponIdx = 0;
    this.mags = WEAPONS.map((w) => Math.round(w.mag));
    this.unlockedW = WEAPONS.map((w) => w.unlockWave <= 1);
    this.fireCd = 0; this.reloading = false; this.reloadT = 0;
    this.buildViewmodel("pistol");

    this.level = 1; this.xp = 0; this.xpNext = 60; this.pendingLevels = 0;
    this.perks = {};
    this.dmgMult = 1; this.critCh = 0.08; this.critMult = 2; this.speedMult = 1;
    this.resist = 0; this.regen = 0; this.leech = 0;
    this.sandeCdMult = 1; this.magMult = 1; this.reloadMult = 1; this.spreadMult = 1;
    this.mantis = false; this.ice = false;

    this.runT = 0; this.kills = 0; this.shots = 0; this.hitsC = 0; this.dmgDealt = 0;
    this.wave = 0; this.waveT = 3; this.timeScale = 1; this.radioIdx = 0;
    this.guestDead = false; this.respawnWait = 0; this.reqSent = false;
    this.netTargets.clear();
    this.netPk.forEach((pk) => this.scene.remove(pk.group));
    this.netPk.clear();
    this.netBkZ = 0; this.netBkHp = this.basiliskMax;
    this.basilisk.position.set(0, 0, 0);
    this.basilisk.visible = true;
    this.basiliskHp = this.basiliskMax; this.basiliskDead = false;
    this.ended = null; this.victoryT = -1; this.paused = false; this.awaitPerk = false;
  }

  resume() { this.requestLock(); }

  private requestLock() {
    try {
      const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === "function") p.catch(() => undefined);
    } catch { /* noop */ }
  }

  choosePerk(id: string) {
    if (!this.awaitPerk) return;
    const def = PERKS.find((p) => p.id === id);
    if (!def) return;
    this.perks[id] = (this.perks[id] || 0) + 1;
    switch (id) {
      case "ribs": this.maxHp += 40; this.hp = Math.min(this.maxHp, this.hp + 40); break;
      case "regen": this.regen += 1.4; break;
      case "adrenal": this.speedMult += 0.1; break;
      case "tech": this.dmgMult += 0.18; break;
      case "kiroshi": this.critCh += 0.1; this.critMult += 0.25; break;
      case "overclock": this.sandeCdMult *= 0.75; break;
      case "leech": this.leech += 6; break;
      case "plating": this.resist = Math.min(0.6, this.resist + 0.12); break;
      case "loader": this.magMult += 0.3; this.reloadMult *= 0.75; this.mags = this.mags.map((m, i) => Math.min(m + Math.round(WEAPONS[i].mag * 0.3), Math.round(WEAPONS[i].mag * this.magMult))); break;
      case "mantis": this.mantis = true; break;
      case "ice": this.ice = true; break;
      case "coproc": this.spreadMult *= 0.6; break;
    }
    this.sfx.pickup();
    this.cb.onEvent({ t: "toast", text: `Имплант установлен: ${def.name}`, tone: "chip" });
    this.pendingLevels--;
    if (this.pendingLevels > 0) {
      const opts = this.pickPerkOptions();
      if (opts.length) this.cb.onEvent({ t: "levelup", options: opts });
      else { this.pendingLevels = 0; this.awaitPerk = false; this.requestLock(); }
    } else {
      this.awaitPerk = false;
      this.requestLock();
    }
  }

  setMuted(m: boolean) { this.sfx.setMuted(m); }

  /* ================= NET (co-op WebRTC) ================= */

  attachNet(send: (to: string | null, m: unknown) => void, role: "host" | "guest", room: string) {
    this.netSendFn = send;
    this.netMode = role;
    this.roomCode = room;
    this.netBkZ = 0;
  }
  netSquadNames(): string[] {
    return Array.from(this.squad.values()).map((m) => m.name);
  }
  detachNet() { this.netSendFn = null; this.netMode = null; this.roomCode = ""; }
  toAttract() {
    this.detachNet();
    this.reset();
    this.mode = "attract";
  }

  private r1 = (v: number) => Math.round(v * 10) / 10;

  private netToast(text: string, tone: "panam" | "sys" | "chip" | "warn" = "sys") {
    this.cb.onEvent({ t: "toast", text, tone });
    if (this.netMode === "host" && this.netSendFn) this.netSendFn(null, { t: "toast", text, tone });
  }
  private netBanner(text: string, sub?: string) {
    this.cb.onEvent({ t: "banner", text, sub });
    if (this.netMode === "host" && this.netSendFn) this.netSendFn(null, { t: "banner", text, sub });
  }

  /* ----- host side ----- */

  netGuestJoined(pid: string) {
    const name = GUEST_NAMES[this.squad.size % GUEST_NAMES.length];
    const color = AVATAR_COLORS[this.squad.size % AVATAR_COLORS.length];
    this.squad.set(pid, { pid, name, hp: 100, maxHp: 100, dead: false, x: this.pos.x + 2, y: 0, z: this.pos.z - 2, yaw: 0, w: 0, f: false, last: performance.now() });
    this.ensureRemote(pid, name, color);
    this.netSendFn?.(pid, { t: "welcome", name, room: this.roomCode });
    this.netToast(`${name} в сети // отряд +1`, "sys");
    this.sendSnapshot();
  }
  netGuestLeft(pid: string) {
    const m = this.squad.get(pid);
    if (!m) return;
    this.squad.delete(pid);
    const rp = this.remotePlayers.get(pid);
    if (rp) { this.scene.remove(rp.group); this.remotePlayers.delete(pid); }
    this.netToast(`${m.name}: связь потеряна`, "warn");
  }
  private hostGuestState(from: string, m: { p: number[]; yaw: number; hp: number; w: number; f: boolean }) {
    const s = this.squad.get(from);
    if (!s) return;
    s.last = performance.now();
    s.x = m.p[0]; s.y = m.p[1]; s.z = m.p[2];
    s.yaw = m.yaw; s.hp = m.hp; s.w = m.w; s.f = m.f;
    if (s.hp <= 0 && !s.dead) { s.dead = true; this.netSendFn?.(from, { t: "die" }); }
    if (s.hp > 0 && s.dead) s.dead = false;
    const rp = this.remotePlayers.get(from);
    if (rp) { rp.tx = s.x; rp.tz = s.z; rp.trot = s.yaw; rp.dead = s.dead; if (s.f) rp.muzzle.intensity = 3.2; }
  }
  private hostGuestShot(from: string, m: { o: number[]; d: number[]; w: number; mult: number; crit: number }) {
    const w = WEAPONS[m.w];
    if (!w) return;
    const origin = new THREE.Vector3(m.o[0], m.o[1], m.o[2]);
    const base = new THREE.Vector3(m.d[0], m.d[1], m.d[2]).normalize();
    for (let p = 0; p < w.pellets; p++) {
      const dir = base.clone().add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(w.spread * 1.25)).normalize();
      this.ray.set(origin, dir);
      this.ray.far = 160;
      const hits = this.ray.intersectObjects(this.enemyRoots, true);
      if (!hits.length) continue;
      const h = hits[0];
      const en = this.enemyById.get((h.object.userData.eid as number) ?? -1);
      if (!en || en.dead) continue;
      const falloff = w.kind === "shotgun" ? clamp(1.4 - h.distance / 42, 0.35, 1.15) : clamp(1.25 - h.distance / 110, 0.55, 1.1);
      let dmg = w.dmg * m.mult * falloff;
      const crit = Math.random() < m.crit;
      if (crit) dmg *= 2;
      this.spawnSparks(h.point, 0xffb35a, 3, 4);
      this.damageEnemy(en, dmg, h.point, crit, from);
      this.netSendFn?.(from, { t: "float", at: [this.r1(h.point.x), this.r1(h.point.y), this.r1(h.point.z)], txt: String(Math.round(dmg)), crit });
    }
  }
  private hostGuestDash(from: string, m: { p: number[]; mdmg: number }) {
    const p = new THREE.Vector3(m.p[0], m.p[1], m.p[2]);
    this.spawnSparks(p.clone().add(new THREE.Vector3(0, 1, 0)), 0x00e5ff, 10, 4);
    if (m.mdmg > 0) {
      [...this.enemies].forEach((e) => {
        if (e.root.position.distanceTo(p) < 4.2) this.damageEnemy(e, m.mdmg, e.root.position.clone().add(new THREE.Vector3(0, 1.4, 0)), false, from);
      });
    }
  }
  private hostPick(from: string, id: number) {
    const pk = this.pickups.find((x) => x.id === id);
    if (!pk) return;
    this.scene.remove(pk.group);
    this.pickups = this.pickups.filter((x) => x.id !== id);
    this.squad.forEach((_m, pid) => { if (pid !== from) this.netSendFn?.(pid, { t: "pick", id }); });
  }

  private nearestPlayer(ep: THREE.Vector3): { pos: THREE.Vector3; pid: string | null; d: number } {
    let best: { pos: THREE.Vector3; pid: string | null; d: number } = { pos: this.pos, pid: null, d: ep.distanceTo(this.pos) };
    this.squad.forEach((m) => {
      if (m.dead) return;
      const p = new THREE.Vector3(m.x, m.y, m.z);
      const d = ep.distanceTo(p);
      if (d < best.d) best = { pos: p, pid: m.pid, d };
    });
    return best;
  }

  private sendSnapshot() {
    if (!this.netSendFn) return;
    const e = this.enemies.map((en) => [
      en.eid, en.kind, this.r1(en.root.position.x), this.r1(en.root.position.y), this.r1(en.root.position.z),
      this.r1(en.root.rotation.y), Math.round(en.hp), Math.round(en.maxHp), en.fuse > 0 ? 1 : 0,
    ]);
    const av: (string | number | boolean)[][] = [[
      "H", "ВИ", this.r1(this.pos.x), 0, this.r1(this.pos.z), this.r1(this.yaw),
      Math.round(this.hp), this.weaponIdx, this.mouseDown, false,
    ]];
    this.squad.forEach((m) => {
      av.push([m.pid, m.name, this.r1(m.x), 0, this.r1(m.z), this.r1(m.yaw), Math.round(m.hp), m.w, m.f, m.dead]);
    });
    const pk = this.pickups.map((p) => [p.id, this.r1(p.group.position.x), this.r1(p.group.position.z), p.kind]);
    this.netSendFn(null, {
      t: "snap", e, av,
      bk: [this.r1(this.basilisk.position.z), Math.round(this.basiliskHp)],
      wv: this.wave, pk,
    });
  }

  private sendState() {
    this.netSendFn?.(null, {
      t: "s",
      p: [this.r1(this.pos.x), this.r1(this.pos.y), this.r1(this.pos.z)],
      yaw: Math.round(this.yaw * 100) / 100,
      hp: Math.round(this.hp), w: this.weaponIdx, f: this.mouseDown, dead: this.guestDead,
    });
  }

  /* ----- avatars ----- */

  private ensureRemote(pid: string, name: string, color: number): RemotePlayer {
    let rp = this.remotePlayers.get(pid);
    if (rp) return rp;
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x1e1f2a, roughness: 0.7 });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.36), dark);
    legs.position.y = 0.42; g.add(legs);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.95, 0.44), new THREE.MeshStandardMaterial({ color: 0x2b2d3d, roughness: 0.6 }));
    torso.position.y = 1.32; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.42), dark);
    head.position.y = 2.02; g.add(head);
    const accent = new THREE.MeshStandardMaterial({ color: 0x0a0a10, emissive: color, emissiveIntensity: 2.4 });
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.06), accent);
    visor.position.set(0, 2.04, 0.22); g.add(visor);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.46), accent);
    stripe.position.y = 1.6; g.add(stripe);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.9), dark);
    gun.position.set(0.42, 1.35, 0.3); g.add(gun);
    const muzzle = new THREE.PointLight(color, 0, 10);
    muzzle.position.set(0.42, 1.4, 0.9);
    g.add(muzzle);
    const nc = document.createElement("canvas");
    nc.width = 256; nc.height = 64;
    const nctx = nc.getContext("2d")!;
    nctx.font = "700 34px Rajdhani, sans-serif";
    nctx.textAlign = "center"; nctx.textBaseline = "middle";
    nctx.fillStyle = "#" + color.toString(16).padStart(6, "0");
    nctx.shadowColor = nctx.fillStyle; nctx.shadowBlur = 14;
    nctx.fillText(name, 128, 32);
    const nt = new THREE.CanvasTexture(nc);
    nt.colorSpace = THREE.SRGBColorSpace;
    const ns = new THREE.Sprite(new THREE.SpriteMaterial({ map: nt, transparent: true, depthWrite: false }));
    ns.scale.set(2.2, 0.55, 1);
    ns.position.y = 2.75;
    ns.raycast = () => undefined;
    g.add(ns);
    g.position.set(this.pos.x + 2, 0, this.pos.z - 2);
    this.scene.add(g);
    rp = { pid, name, group: g, accent, muzzle, tx: g.position.x, ty: 0, tz: g.position.z, trot: 0, dead: false };
    this.remotePlayers.set(pid, rp);
    return rp;
  }

  private updateRemotePlayers(raw: number) {
    const k = Math.min(1, 14 * raw);
    this.remotePlayers.forEach((rp) => {
      rp.group.visible = !rp.dead;
      rp.group.position.x += (rp.tx - rp.group.position.x) * k;
      rp.group.position.z += (rp.tz - rp.group.position.z) * k;
      let dr = rp.trot - rp.group.rotation.y;
      while (dr > Math.PI) dr -= Math.PI * 2;
      while (dr < -Math.PI) dr += Math.PI * 2;
      rp.group.rotation.y += dr * k;
      rp.muzzle.intensity = Math.max(0, rp.muzzle.intensity - raw * 22);
    });
    if (this.netMode === "host") {
      const now = performance.now();
      [...this.squad.values()].forEach((m) => {
        if (now - m.last > 8000) this.netGuestLeft(m.pid);
      });
    }
  }

  /* ----- guest side ----- */

  private makePickupGroup(kind: "med" | "chip"): THREE.Group {
    const g = new THREE.Group();
    if (kind === "med") {
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.55), new THREE.MeshStandardMaterial({ color: 0x10241a, emissive: 0x39ff9d, emissiveIntensity: 1.4 })));
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.06), new THREE.MeshStandardMaterial({ color: 0x052e18, emissive: 0x39ff9d, emissiveIntensity: 2.6 }));
      c1.position.z = 0.29; g.add(c1);
      const c2 = c1.clone(); c2.rotation.z = Math.PI / 2; g.add(c2);
    } else {
      const chip = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 6), new THREE.MeshStandardMaterial({ color: 0x201a05, emissive: 0xfcee0a, emissiveIntensity: 2.2, metalness: 0.8, roughness: 0.3 }));
      chip.rotation.x = Math.PI / 2; g.add(chip);
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.16), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x00e5ff, emissiveIntensity: 3 })));
    }
    return g;
  }

  private applySnapshot(m: { e: (string | number)[][]; av: (string | number | boolean)[][]; bk: number[]; wv: number; pk: (string | number)[][] }) {
    /* enemies */
    const seen = new Set<number>();
    for (const row of m.e) {
      const id = row[0] as number;
      const kind = row[1] as "drone" | "soldier" | "heavy";
      const x = row[2] as number, y = row[3] as number, z = row[4] as number;
      const rot = row[5] as number, hp = row[6] as number, max = row[7] as number, fuse = row[8] as number;
      seen.add(id);
      this.netTargets.set(id, { x, z, rot, hp, max, fuse });
      const ex = this.enemyById.get(id);
      if (!ex) {
        const e = this.spawnEnemy(kind, { id, x, z, hp, max });
        e.root.position.set(x, kind === "drone" ? 2.6 : 0, z);
        e.root.rotation.y = rot;
      } else if (Math.abs(ex.hp - hp) > 0.5) {
        ex.hp = hp; ex.maxHp = max;
        this.drawBar(ex, hp / max);
      }
    }
    for (const e of [...this.enemies]) {
      if (!seen.has(e.eid)) { this.netTargets.delete(e.eid); this.removeEnemy(e, false); }
    }
    /* remote players */
    let ci = 0;
    this.avInfo.clear();
    for (const a of m.av) {
      const pid = a[0] as string;
      if (pid === "G") continue;
      const name = a[1] as string;
      this.avInfo.set(pid, { name, hp: a[6] as number, dead: a[9] as boolean });
      const rp = this.ensureRemote(pid, name, pid === "H" ? 0xfcee0a : AVATAR_COLORS[ci++ % AVATAR_COLORS.length]);
      rp.tx = a[2] as number; rp.tz = a[4] as number; rp.trot = a[5] as number;
      rp.dead = a[9] as boolean;
      if (a[8]) rp.muzzle.intensity = 3.2;
    }
    /* basilisk */
    this.netBkZ = m.bk[0];
    this.netBkHp = m.bk[1];
    this.wave = m.wv;
    /* pickups */
    const seenP = new Set<number>();
    for (const p of m.pk) {
      const id = p[0] as number;
      seenP.add(id);
      if (!this.netPk.has(id)) {
        const g = this.makePickupGroup(p[3] as "med" | "chip");
        g.position.set(p[1] as number, 0.8, p[2] as number);
        this.scene.add(g);
        this.netPk.set(id, { group: g, kind: p[3] as "med" | "chip", t: rnd(0, 9), id });
      }
    }
    for (const [id, pk] of [...this.netPk]) {
      if (!seenP.has(id)) { this.scene.remove(pk.group); this.netPk.delete(id); }
    }
  }

  private updateGuestSim(raw: number) {
    /* interpolate enemies */
    const k = Math.min(1, 11 * raw);
    for (const e of this.enemies) {
      const t = this.netTargets.get(e.eid);
      if (!t) continue;
      e.root.position.x += (t.x - e.root.position.x) * k;
      e.root.position.z += (t.z - e.root.position.z) * k;
      let dr = t.rot - e.root.rotation.y;
      while (dr > Math.PI) dr -= Math.PI * 2;
      while (dr < -Math.PI) dr += Math.PI * 2;
      e.root.rotation.y += dr * k;
      if (e.kind === "drone") {
        e.bobT += raw * 3;
        e.root.position.y = 2.6 + Math.sin(e.bobT) * 0.4;
        if (e.rotors) e.rotors.rotation.y += raw * 22;
      }
      if (t.fuse > 0 && e.fuse < 0) e.fuse = 0.5;
      if (e.fuse > 0) {
        const blink = Math.sin(performance.now() * 0.03) > 0;
        e.mats.forEach((mm) => { mm.emissiveIntensity = blink ? 4 : 0.6; });
      }
    }
    /* basilisk */
    this.basilisk.position.z += (this.netBkZ - this.basilisk.position.z) * Math.min(1, 4 * raw);
    this.basiliskHp = this.netBkHp;
    const tt = performance.now() * 0.001;
    this.coreLight.intensity = 2.2 + Math.sin(tt * 3.4) * 0.7;
    if (this.netBkHp <= 0 && !this.basiliskDead) { this.basiliskDead = true; this.basilisk.visible = false; }
    /* pickups */
    for (const [id, pk] of [...this.netPk]) {
      pk.t += raw;
      pk.group.rotation.y += raw * 2.4;
      pk.group.position.y = 0.8 + Math.sin(pk.t * 2.4) * 0.18;
      if (!this.guestDead && pk.group.position.distanceTo(this.pos) < 1.6) {
        if (pk.kind === "med") { this.heal(35); this.sfx.pickup(); } else this.applyChip();
        this.scene.remove(pk.group);
        this.netPk.delete(id);
        this.netSendFn?.(null, { t: "pick", id });
      }
    }
    /* respawn flow */
    if (this.guestDead) {
      this.respawnWait -= raw;
      if (this.respawnWait <= 0 && !this.reqSent) {
        this.reqSent = true;
        this.netSendFn?.(null, { t: "rreq" });
      }
    }
  }

  /* ----- message router ----- */

  netReceive(from: string, m: { t: string; [k: string]: unknown }) {
    if (!m || typeof m.t !== "string") return;
    if (this.netMode === "host") {
      switch (m.t) {
        case "s": this.hostGuestState(from, m as unknown as { p: number[]; yaw: number; hp: number; w: number; f: boolean }); break;
        case "shot": this.hostGuestShot(from, m as unknown as { o: number[]; d: number[]; w: number; mult: number; crit: number }); break;
        case "dash": this.hostGuestDash(from, m as unknown as { p: number[]; mdmg: number }); break;
        case "pick": this.hostPick(from, m.id as number); break;
        case "rreq": {
          const s = this.squad.get(from);
          if (s && s.dead) this.netSendFn?.(from, { t: "respawn", p: [this.r1(this.basilisk.position.x + rnd(-3, 3)), 0, this.r1(this.basilisk.position.z - rnd(3, 7))] });
          break;
        }
        default: break;
      }
      return;
    }
    if (this.netMode !== "guest") return;
    switch (m.t) {
      case "welcome": this.guestName = (m.name as string) ?? "ПАНАМ"; break;
      case "snap": this.applySnapshot(m as never); break;
      case "xp": this.addXp(m.v as number, new THREE.Vector3(...(m.at as number[]))); if (this.leech > 0) this.heal(this.leech); break;
      case "dmg": if (!this.guestDead) this.damagePlayer(m.v as number); break;
      case "heal": this.heal(m.v as number); break;
      case "bolt": this.fireBolt(new THREE.Vector3(...(m.o as number[])), new THREE.Vector3(...(m.a as number[])), 0, 26, m.c as number, true); break;
      case "boom": {
        const at = new THREE.Vector3(...(m.at as number[]));
        this.spawnExplosion(at, (m.big ? 26 : 14), m.c as number);
        this.sfx.explode(!!m.big);
        break;
      }
      case "float": this.emitFloat(new THREE.Vector3(...(m.at as number[])), m.txt as string, !!m.crit, !!m.heal); break;
      case "wave": this.wave = m.n as number; this.cb.onEvent({ t: "banner", text: `ВОЛНА ${m.n}`, sub: "Корпоративное преследование" }); this.sfx.wave(); break;
      case "radio": this.cb.onEvent({ t: "toast", text: m.txt as string, tone: "panam" }); break;
      case "toast": this.cb.onEvent({ t: "toast", text: m.txt as string, tone: m.tone as "panam" | "sys" | "chip" | "warn" }); break;
      case "banner": this.cb.onEvent({ t: "banner", text: m.txt as string, sub: m.sub as string | undefined }); break;
      case "pick": {
        const pk = this.netPk.get(m.id as number);
        if (pk) { this.scene.remove(pk.group); this.netPk.delete(m.id as number); }
        break;
      }
      case "die":
        this.guestDead = true;
        this.respawnWait = 5;
        this.reqSent = false;
        this.mouseDown = false;
        this.cb.onEvent({ t: "toast", text: "ТЫ ПАЛА // ВОЗРОЖДЕНИЕ ЧЕРЕЗ 5 СЕК", tone: "warn" });
        break;
      case "respawn": {
        const p = m.p as number[];
        this.pos.set(p[0], 0, p[2]);
        this.vel.set(0, 0, 0);
        this.hp = this.maxHp;
        this.guestDead = false;
        this.invulnT = 2;
        this.cb.onEvent({ t: "toast", text: "ВОЗРОЖДЕНИЕ // НЕЙРОЛИНК ПЕРЕЗАПУЩЕН", tone: "sys" });
        break;
      }
      case "end": this.endRun(m.kind as "dead" | "won", (m.reason as string) ?? ""); break;
      default: break;
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("mousedown", this.onMouseDown);
    document.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("pointerlockchange", this.onPlChange);
    this.canvas.removeEventListener("contextmenu", this.onCtx);
    this.canvas.removeEventListener("mousedown", this.onCanvasDown);
    this.sfx.stopMusic();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
    this.renderer.dispose();
  }

  /* ---------------- input ---------------- */

  private onCtx = (e: Event) => e.preventDefault();
  private onCanvasDown = () => {
    if (this.mode === "play" && !this.ended && !this.awaitPerk && document.pointerLockElement !== this.canvas) {
      this.requestLock();
    }
  };
  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  };
  private onKeyDown = (e: KeyboardEvent) => {
    if (["Space", "Tab", "KeyQ", "KeyR"].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    if (this.mode !== "play" || this.paused || this.awaitPerk || this.ended) return;
    if (e.code === "KeyQ") this.trySande();
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.tryDash();
    if (e.code === "KeyR") this.startReload();
    if (e.code === "Digit1") this.switchWeapon(0);
    if (e.code === "Digit2") this.switchWeapon(1);
    if (e.code === "Digit3") this.switchWeapon(2);
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.canvas) return;
    if (this.paused || this.awaitPerk || this.ended) return;
    const s = 0.0021 * (this.aiming ? 0.6 : 1);
    this.yaw -= e.movementX * s;
    this.pitch = clamp(this.pitch - e.movementY * s, -1.45, 1.45);
  };
  private onMouseDown = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.canvas) return;
    if (this.paused || this.awaitPerk || this.ended) return;
    if (e.button === 0) {
      this.mouseDown = true;
      if (!WEAPONS[this.weaponIdx].auto) this.tryFire();
    }
    if (e.button === 2) { this.aiming = true; this.fovTarget = 62; }
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = false;
    if (e.button === 2) { this.aiming = false; this.fovTarget = 75; }
  };
  private onPlChange = () => {
    const locked = document.pointerLockElement === this.canvas;
    if (!locked && this.mode === "play" && !this.ended && !this.awaitPerk && !this.paused && !this.netMode) {
      this.paused = true;
      this.mouseDown = false;
      this.cb.onEvent({ t: "pause" });
    }
    if (!locked) this.mouseDown = false;
  };

  /* ---------------- actions ---------------- */

  private trySande() {
    if (this.sandeCd > 0 || this.sandeT > 0) { this.sfx.deny(); return; }
    this.sandeT = SANDE_TIME;
    this.sfx.sande();
    this.fovTarget = 70;
  }
  private tryDash() {
    if (this.dashCd > 0) { this.sfx.deny(); return; }
    this.dashCd = DASH_CD;
    const f = this.tmpV.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const move = this.tmpV2.set(0, 0, 0);
    if (this.keys.has("KeyW")) move.sub(f);
    if (this.keys.has("KeyS")) move.add(f);
    if (this.keys.has("KeyA")) move.sub(new THREE.Vector3(f.z, 0, -f.x));
    if (this.keys.has("KeyD")) move.add(new THREE.Vector3(f.z, 0, -f.x));
    const dir = move.lengthSq() > 0 ? move.normalize() : f.clone().negate();
    this.vel.x += dir.x * 26;
    this.vel.z += dir.z * 26;
    this.invulnT = Math.max(this.invulnT, 0.35);
    this.sfx.dash();
    this.spawnSparks(this.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0x00e5ff, 10, 4);
    if (this.netMode === "guest") {
      this.netSendFn?.(null, {
        t: "dash",
        p: [this.r1(this.pos.x), this.r1(this.pos.y), this.r1(this.pos.z)],
        mdmg: this.mantis ? 90 * this.dmgMult : 0,
      });
    }
    if (this.mantis) {
      const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).negate();
      [...this.enemies].forEach((e) => {
        const d = e.root.position.distanceTo(this.pos);
        if (d < 4.2) {
          const toE = e.root.position.clone().sub(this.pos).normalize();
          if (toE.dot(fwd) > -0.2 || d < 2) this.damageEnemy(e, 90 * this.dmgMult, e.root.position.clone().add(new THREE.Vector3(0, 1.4, 0)), false);
        }
      });
    }
  }
  private startReload() {
    const w = WEAPONS[this.weaponIdx];
    const size = Math.round(w.mag * this.magMult);
    if (this.reloading || this.mags[this.weaponIdx] >= size) return;
    this.reloading = true;
    this.reloadT = w.reload * this.reloadMult;
    this.sfx.reload();
  }
  private switchWeapon(i: number) {
    if (i === this.weaponIdx || !this.unlockedW[i]) { if (!this.unlockedW[i]) this.sfx.deny(); return; }
    this.weaponIdx = i;
    this.reloading = false;
    this.fireCd = Math.max(this.fireCd, 0.18);
    this.buildViewmodel(WEAPONS[i].kind);
    this.sfx.ui();
  }

  private tryFire() {
    if (this.reloading || this.fireCd > 0 || this.ended || this.paused || this.guestDead) return;
    if (this.awaitPerk && !this.netMode) return;
    const w = WEAPONS[this.weaponIdx];
    if (this.mags[this.weaponIdx] <= 0) { this.startReload(); return; }
    this.mags[this.weaponIdx]--;
    this.fireCd = 1 / w.rof;
    this.shots += w.pellets;
    this.muzzleFlashT = 0.06;
    this.recoil += w.kick;
    this.shotKick = Math.min(1.4, this.shotKick + 0.22);
    this.sfx.shoot(w.kind);
    const from = this.muzzleAnchor.getWorldPosition(new THREE.Vector3());
    const camDir = this.camera.getWorldDirection(new THREE.Vector3());
    const spreadBase = w.spread * this.spreadMult * (this.aiming ? 0.45 : 1) + this.shotKick * 0.008;
    for (let p = 0; p < w.pellets; p++) {
      const dir = camDir.clone().add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(spreadBase)).normalize();
      this.ray.set(this.camera.getWorldPosition(this.tmpV.clone()), dir);
      this.ray.far = 160;
      const hits = this.ray.intersectObjects(this.enemyRoots, true);
      let end: THREE.Vector3;
      if (hits.length) {
        const h = hits[0];
        end = h.point.clone();
        const eid = (h.object.userData.eid as number) ?? -1;
        const en = this.enemyById.get(eid);
        if (en && !en.dead) {
          this.spawnSparks(h.point, 0xffb35a, 2, 3);
          if (this.netMode !== "guest") {
            let dmg = w.dmg * this.dmgMult * (this.sandeT > 0 ? 1.5 : 1);
            const falloff = w.kind === "shotgun" ? clamp(1.4 - h.distance / 42, 0.35, 1.15) : clamp(1.25 - h.distance / 110, 0.55, 1.1);
            dmg *= falloff;
            const crit = Math.random() < this.critCh;
            if (crit) dmg *= this.critMult;
            this.hitsC++;
            this.dmgDealt += dmg;
            this.damageEnemy(en, dmg, h.point, crit);
          } else {
            this.hitsC++;
            this.sfx.hit();
          }
        }
      } else {
        end = from.clone().add(dir.clone().multiplyScalar(110));
        end.y = Math.max(0.05, end.y);
      }
      this.spawnTracer(from, end);
    }
    if (this.netMode === "guest") {
      this.netSendFn?.(null, {
        t: "shot",
        o: [this.r1(from.x), this.r1(from.y), this.r1(from.z)],
        d: [this.r1(camDir.x), this.r1(camDir.y), this.r1(camDir.z)],
        w: this.weaponIdx, mult: this.dmgMult * (this.sandeT > 0 ? 1.5 : 1), crit: this.critCh,
      });
    }
  }

  /* ---------------- combat ---------------- */

  private drawBar(e: Enemy, fracRaw: number, crit = false) {
    const frac = clamp(fracRaw, 0, 1);
    const ctx = e.barCtx;
    ctx.clearRect(0, 0, 96, 12);
    ctx.fillStyle = "rgba(5,3,12,0.75)";
    ctx.fillRect(0, 0, 96, 12);
    ctx.fillStyle = crit ? "#fcee0a" : frac > 0.5 ? "#39ff9d" : frac > 0.25 ? "#ff9a3d" : "#ff3b4e";
    ctx.fillRect(2, 2, 92 * frac, 8);
    e.barTex.needsUpdate = true;
  }

  private damageEnemy(e: Enemy, dmg: number, point: THREE.Vector3, crit: boolean, byPid: string | null = null) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.1;
    this.drawBar(e, e.hp / e.maxHp, crit);
    this.spawnSparks(point, e.kind === "drone" ? 0xff2d78 : 0xffb35a, 4, 5);
    this.emitFloat(point, `${Math.round(dmg)}`, crit);
    if (crit) this.sfx.crit(); else this.sfx.hit();
    if (e.hp <= 0) this.killEnemy(e, true, byPid);
  }

  private killEnemy(e: Enemy, grantXp: boolean, byPid: string | null = null) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    const def = ENEMY_DEFS[e.kind];
    const p = e.root.position.clone(); p.y += 1.2;
    const color = e.kind === "drone" ? 0xff2d78 : e.kind === "heavy" ? 0xff9a3d : 0xffb35a;
    this.spawnExplosion(p, e.kind === "heavy" ? 26 : 14, color);
    this.sfx.explode(e.kind !== "soldier");
    if (this.netMode === "host" && this.netSendFn) {
      this.netSendFn(null, { t: "boom", at: [this.r1(p.x), this.r1(p.y), this.r1(p.z)], c: color, big: e.kind !== "soldier" });
    }
    if (grantXp) {
      if (byPid && this.netSendFn) this.netSendFn(byPid, { t: "xp", v: def.xp, at: [this.r1(p.x), this.r1(p.y + 0.8), this.r1(p.z)] });
      else this.addXp(def.xp, p);
    }
    if (this.leech > 0 && !byPid) this.heal(this.leech);
    if (e.kind === "heavy") this.spawnPickup("chip", p);
    else if (Math.random() < (e.kind === "soldier" ? 0.2 : 0.08)) this.spawnPickup("med", p);
    if (this.ice && Math.random() < 0.25) {
      this.spawnExplosion(p, 18, 0x00e5ff);
      [...this.enemies].forEach((o) => {
        if (o !== e && !o.dead && o.root.position.distanceTo(p) < 5.5) this.damageEnemy(o, 55 * this.dmgMult, o.root.position.clone().add(new THREE.Vector3(0, 1.4, 0)), false);
      });
    }
    this.removeEnemy(e, false);
  }

  private removeEnemy(e: Enemy, _silent: boolean) {
    e.dead = true;
    this.scene.remove(e.root);
    this.enemyById.delete(e.eid);
    this.enemies = this.enemies.filter((x) => x !== e);
    this.enemyRoots = this.enemyRoots.filter((x) => x !== e.root);
    e.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | undefined;
      if (mat) mat.dispose();
    });
  }

  private fireBolt(from: THREE.Vector3, to: THREE.Vector3, dmg: number, speed: number, color: number, visual = false, pid: string | null = null) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 6, 6),
      new THREE.MeshBasicMaterial({ color })
    );
    mesh.position.copy(from);
    const vel = to.clone().sub(from).normalize().multiplyScalar(speed);
    this.scene.add(mesh);
    this.bolts.push({ mesh, vel, dmg, life: 3.2, visual, pid });
  }

  private explodeAtPlayer(p: THREE.Vector3, radius: number, dmg: number) {
    this.spawnExplosion(p.clone(), 18, 0xff2d78);
    this.sfx.explode(false);
    if (this.netMode === "host" && this.netSendFn) {
      this.netSendFn(null, { t: "boom", at: [this.r1(p.x), this.r1(p.y), this.r1(p.z)], c: 0xff2d78, big: false });
    }
    const dP = p.distanceTo(this.pos.clone().add(new THREE.Vector3(0, 1, 0)));
    if (dP < radius) this.damagePlayer(dmg * (1 - dP / radius) + 6);
    this.squad.forEach((_m, pid) => {
      const m = this.squad.get(pid)!;
      if (m.dead) return;
      const dG = p.distanceTo(new THREE.Vector3(m.x, m.y + 1, m.z));
      if (dG < radius) this.netSendFn?.(pid, { t: "dmg", v: dmg * (1 - dG / radius) + 6 });
    });
    const dB = p.distanceTo(this.basilisk.position.clone().add(new THREE.Vector3(0, 2, 0)));
    if (dB < radius + 3 && !this.basiliskDead) {
      this.basiliskHp -= dmg * 1.6;
      this.spawnSparks(this.basilisk.position.clone().add(new THREE.Vector3(rnd(-2, 2), rnd(1, 3), rnd(-3, 3))), 0x00e5ff, 8, 6);
    }
  }

  /* ---------------- rpg ---------------- */

  private addXp(v: number, at?: THREE.Vector3) {
    this.xp += v;
    if (at) this.emitFloat(at.clone().add(new THREE.Vector3(0, 0.8, 0)), `+${v} XP`, false, true);
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = 60 + (this.level - 1) * 55;
      this.pendingLevels++;
    }
    if (this.pendingLevels > 0 && !this.awaitPerk) {
      this.awaitPerk = true;
      this.mouseDown = false;
      if (document.pointerLockElement === this.canvas && !this.netMode) document.exitPointerLock();
      const opts = this.pickPerkOptions();
      if (opts.length) {
        this.sfx.levelup();
        this.cb.onEvent({ t: "levelup", options: opts });
      } else {
        this.pendingLevels = 0;
        this.awaitPerk = false;
      }
    }
  }

  private pickPerkOptions(): PerkDef[] {
    const pool = PERKS.filter((p) => (this.perks[p.id] || 0) < p.max);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3);
  }

  private heal(v: number) {
    if (this.hp >= this.maxHp) return;
    this.hp = Math.min(this.maxHp, this.hp + v);
    this.emitFloat(this.pos.clone().add(new THREE.Vector3(0, 2, 0)), `+${Math.round(v)}`, false, true);
  }

  private damagePlayer(d: number) {
    if (this.invulnT > 0 || this.ended) return;
    const real = d * (1 - this.resist);
    this.hp -= real;
    this.invulnT = 0.2;
    this.shakeT = 0.4;
    this.sfx.hurt();
    this.cb.onEvent({ t: "hurt" });
    if (this.hp <= 0) {
      this.hp = 0;
      if (this.netMode === "guest") {
        this.guestDead = true;
        this.respawnWait = 5;
        this.reqSent = false;
        this.mouseDown = false;
        this.cb.onEvent({ t: "toast", text: "ТЫ ПАЛА // ВОЗРОЖДЕНИЕ ЧЕРЕЗ 5 СЕК", tone: "warn" });
      } else {
        this.endRun("dead", "Ви пала в пустошах");
      }
    }
  }

  private applyChip() {
    const c = CHIP_BONUSES[Math.floor(Math.random() * CHIP_BONUSES.length)];
    switch (c.id) {
      case "chip_hp": this.maxHp += 15; this.hp = Math.min(this.maxHp, this.hp + 15); break;
      case "chip_dmg": this.dmgMult += 0.08; break;
      case "chip_regen": this.regen += 1; break;
      case "chip_crit": this.critCh += 0.05; break;
      case "chip_cd": this.sandeCdMult *= 0.9; break;
    }
    this.sfx.pickup();
    this.cb.onEvent({ t: "toast", text: `Киберимплант: ${c.name} — ${c.desc}`, tone: "chip" });
  }

  /* ---------------- spawning ---------------- */

  private spawnWave(n: number) {
    const mult = 1 + 0.5 * this.squad.size;
    const drones = Math.min(Math.round((3 + Math.floor(n * 1.15)) * mult), 16);
    const soldiers = Math.min(Math.round((1 + Math.ceil(n * 0.85)) * mult), 12);
    const heavies = n >= 3 ? Math.ceil((n / 3) * mult) : 0;
    let i = 0;
    const push = (kind: "drone" | "soldier" | "heavy", count: number) => {
      for (let k = 0; k < count; k++) this.spawnQueue.push({ kind, t: i++ * 0.5 });
    };
    push("soldier", soldiers);
    push("drone", drones);
    push("heavy", heavies);
    this.netBanner(`ВОЛНА ${n}`, n % 3 === 0 ? "Обнаружен тяжёлый юнит" : "Корпоративное преследование");
    this.sfx.wave();
    if (this.netMode === "host" && this.netSendFn) this.netSendFn(null, { t: "wave", n });
    if (Math.random() < 0.5) this.netToast(WAVE_QUIPS[Math.floor(Math.random() * WAVE_QUIPS.length)], "panam");
    if (n === 2 && !this.unlockedW[1]) { this.unlockedW[1] = true; this.netToast("Оружие разблокировано: HJKE «ХИКЭЦУ» [2]", "sys"); }
    if (n === 4 && !this.unlockedW[2]) { this.unlockedW[2] = true; this.netToast("Оружие разблокировано: «ИГЛА» [3]", "sys"); }
  }

  private spawnEnemy(kind: "drone" | "soldier" | "heavy", net?: { id: number; x: number; z: number; hp: number; max: number }): Enemy {
    if (this.enemies.length > 26) {
      if (net) { /* still create synced enemies */ }
      else return this.enemies[0];
    }
    const def = ENEMY_DEFS[kind];
    const waveScale = 1 + (this.wave - 1) * 0.16;
    let x: number, z: number;
    if (net) { x = net.x; z = net.z; }
    else {
      const behind = Math.random() < 0.6;
      z = clamp(this.basilisk.position.z + (behind ? -rnd(30, 80) : rnd(55, 125)), -40, TRAVEL + 140);
      x = (Math.random() < 0.5 ? -1 : 1) * rnd(16, CORRIDOR + 12);
    }
    const eid = net ? net.id : EID++;
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.userData.eid = eid;
    const mats: THREE.MeshStandardMaterial[] = [];
    const M = (color: number, emissive = 0x000000, intensity = 0) => {
      const m = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: 0.7 });
      m.userData.base = intensity;
      mats.push(m);
      return m;
    };
    let rotors: THREE.Group | undefined;
    const tag = (mesh: THREE.Mesh) => { mesh.userData.eid = eid; };

    if (kind === "soldier") {
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.36), M(0x1c1d26));
      legs.position.y = 0.42; tag(legs); root.add(legs);
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.95, 0.44), M(0x262836, 0xff2d3b, 0.12));
      torso.position.y = 1.32; torso.castShadow = true; tag(torso); root.add(torso);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.42), M(0x14151d));
      head.position.y = 2.02; tag(head); root.add(head);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.06), M(0x2a0004, 0xff2030, 2.6));
      visor.position.set(0, 2.04, 0.22); tag(visor); root.add(visor);
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.9), M(0x0f1016));
      gun.position.set(0.42, 1.35, 0.3); tag(gun); root.add(gun);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.5), M(0x31333f, 0xff2d3b, 0.25));
      pad.position.y = 1.85; tag(pad); root.add(pad);
    } else if (kind === "drone") {
      rotors = new THREE.Group();
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.44, 0), M(0x30102a, 0xff2d78, 1.9));
      core.castShadow = true; tag(core); root.add(core);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), M(0x1a0010, 0xff80b0, 3));
      eye.position.z = 0.34; tag(eye); root.add(eye);
      for (let a = 0; a < 4; a++) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.05, 0.13), M(0x181820));
        arm.rotation.y = (Math.PI / 2) * a + Math.PI / 4;
        tag(arm); root.add(arm);
        const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 8), M(0x202028, 0xff2d78, 0.5));
        const ang = (Math.PI / 2) * a + Math.PI / 4;
        rotor.position.set(Math.cos(ang) * 0.72, 0.1, Math.sin(ang) * 0.72);
        tag(rotor); rotors.add(rotor);
      }
      root.add(rotors);
      root.position.y = 2.6;
    } else {
      const legs = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.7), M(0x1a1620));
      legs.position.y = 0.5; tag(legs); root.add(legs);
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 0.95), M(0x2a2230, 0xff9a3d, 0.14));
      torso.position.y = 1.9; torso.castShadow = true; tag(torso); root.add(torso);
      const coreB = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.12), M(0x200f00, 0xff9a3d, 3));
      coreB.position.set(0, 2.0, 0.5); tag(coreB); root.add(coreB);
      const headH = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.5), M(0x141218));
      headH.position.y = 3.05; tag(headH); root.add(headH);
      const visorH = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.06), M(0x200f00, 0xff9a3d, 2.6));
      visorH.position.set(0, 3.05, 0.27); tag(visorH); root.add(visorH);
      [-1, 1].forEach((s) => {
        const sh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.7), M(0x332a3d, 0xff9a3d, 0.3));
        sh.position.set(s * 1.05, 2.75, 0); tag(sh); root.add(sh);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 8), M(0x101014));
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(s * 1.05, 2.75, 0.7); tag(barrel); root.add(barrel);
      });
    }

    /* hp bar */
    const bc = document.createElement("canvas");
    bc.width = 96; bc.height = 12;
    const bctx = bc.getContext("2d")!;
    bctx.fillStyle = "rgba(5,3,12,0.75)";
    bctx.fillRect(0, 0, 96, 12);
    bctx.fillStyle = "#39ff9d";
    bctx.fillRect(2, 2, 92, 8);
    const barTex = new THREE.CanvasTexture(bc);
    barTex.colorSpace = THREE.SRGBColorSpace;
    const bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: barTex, transparent: true, depthWrite: false }));
    bar.scale.set(kind === "heavy" ? 2.6 : 1.7, kind === "heavy" ? 0.32 : 0.21, 1);
    bar.position.y = kind === "drone" ? 1.1 : kind === "heavy" ? 4.1 : 2.7;
    bar.raycast = () => undefined;
    root.add(bar);

    const e: Enemy = {
      eid, root, kind,
      hp: net ? net.hp : def.hp * waveScale, maxHp: net ? net.max : def.hp * waveScale,
      speed: def.speed * (1 + (this.wave - 1) * 0.03),
      fireT: rnd(0.6, 1.6), meleeT: 0,
      orbitA: rnd(0, Math.PI * 2), strafe: Math.random() < 0.5 ? -1 : 1,
      fuse: -1, flash: 0, bobT: rnd(0, 9), burst: 0, burstT: 0, dead: false,
      bar, barTex, barCtx: bctx, mats, rotors,
    };
    this.enemies.push(e);
    this.enemyById.set(eid, e);
    this.enemyRoots.push(root);
    this.scene.add(root);
    return e;
  }

  private spawnPickup(kind: "med" | "chip", p: THREE.Vector3) {
    const g = new THREE.Group();
    if (kind === "med") {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.55), new THREE.MeshStandardMaterial({ color: 0x10241a, emissive: 0x39ff9d, emissiveIntensity: 1.4 }));
      g.add(box);
      const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.06), new THREE.MeshStandardMaterial({ color: 0x052e18, emissive: 0x39ff9d, emissiveIntensity: 2.6 }));
      cross1.position.z = 0.29;
      g.add(cross1);
      const cross2 = cross1.clone();
      cross2.rotation.z = Math.PI / 2;
      g.add(cross2);
    } else {
      const chip = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 6), new THREE.MeshStandardMaterial({ color: 0x201a05, emissive: 0xfcee0a, emissiveIntensity: 2.2, metalness: 0.8, roughness: 0.3 }));
      chip.rotation.x = Math.PI / 2;
      g.add(chip);
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.16), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x00e5ff, emissiveIntensity: 3 }));
      g.add(core);
    }
    g.position.copy(p);
    g.position.y = 0.8;
    this.scene.add(g);
    this.pickups.push({ group: g, kind, t: rnd(0, 9), id: PICKUP_ID++ });
  }

  /* ---------------- fx ---------------- */

  private spawnSparks(p: THREE.Vector3, color: number, n: number, power: number) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 130) break;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), new THREE.MeshBasicMaterial({ color }));
      m.position.copy(p);
      const vel = new THREE.Vector3(rnd(-1, 1), rnd(0.2, 1.4), rnd(-1, 1)).normalize().multiplyScalar(rnd(2, 4) * power * 0.5);
      this.scene.add(m);
      this.particles.push({ mesh: m, vel, life: rnd(0.25, 0.5), max: 0.5 });
    }
  }

  private spawnExplosion(p: THREE.Vector3, n: number, color: number) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 150) break;
      const s = rnd(0.08, 0.22);
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshBasicMaterial({ color: Math.random() < 0.4 ? 0xffffff : color }));
      m.position.copy(p);
      const vel = new THREE.Vector3(rnd(-1, 1), rnd(0, 1.6), rnd(-1, 1)).normalize().multiplyScalar(rnd(3, 11));
      this.scene.add(m);
      this.particles.push({ mesh: m, vel, life: rnd(0.3, 0.8), max: 0.8 });
    }
    const light = new THREE.PointLight(color, 6, 24);
    light.position.copy(p);
    this.scene.add(light);
    const decay = () => {
      light.intensity *= 0.78;
      if (light.intensity > 0.05 && !this.disposed) requestAnimationFrame(decay);
      else this.scene.remove(light);
    };
    requestAnimationFrame(decay);
  }

  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len < 0.5) return;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.025, len),
      new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
    this.scene.add(m);
    this.tracers.push({ mesh: m, life: 0.07, max: 0.07 });
    if (this.tracers.length > 26) {
      const old = this.tracers.shift()!;
      this.scene.remove(old.mesh);
    }
  }

  private emitFloat(world: THREE.Vector3, text: string, crit: boolean, heal = false) {
    const v = world.clone().project(this.camera);
    if (v.z > 1) return;
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    this.cb.onEvent({ t: "float", x, y, text, crit, heal });
  }

  private stats(): RunStats {
    return {
      kills: this.kills, level: this.level, timeSec: this.runT,
      accuracy: this.shots > 0 ? Math.min(100, Math.round((this.hitsC / this.shots) * 100)) : 0,
      dmgDealt: Math.round(this.dmgDealt), wave: this.wave,
    };
  }

  private endRun(kind: "dead" | "won", reason = "") {
    if (this.ended) return;
    this.ended = kind;
    this.mouseDown = false;
    this.sfx.stopMusic();
    if (this.netMode === "host" && this.netSendFn) this.netSendFn(null, { t: "end", kind, reason });
    if (kind === "dead") { this.sfx.lose(); this.cb.onEvent({ t: "death", stats: this.stats(), reason }); }
    else { this.sfx.win(); this.cb.onEvent({ t: "victory", stats: this.stats() }); }
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  /* ---------------- update ---------------- */

  private updatePlayer(dt: number) {
    if (this.guestDead) { this.vel.set(0, 0, 0); return; }
    const f = this.tmpV.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const r = this.tmpV2.set(f.z, 0, -f.x);
    const wish = new THREE.Vector3();
    if (this.keys.has("KeyW")) wish.sub(f);
    if (this.keys.has("KeyS")) wish.add(f);
    if (this.keys.has("KeyA")) wish.sub(r);
    if (this.keys.has("KeyD")) wish.add(r);
    if (wish.lengthSq() > 0) wish.normalize();
    const maxSp = 7.6 * this.speedMult * (this.aiming ? 0.6 : 1);
    const accel = this.onGround ? 12 : 3.5;
    this.vel.x += (wish.x * maxSp - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wish.z * maxSp - this.vel.z) * Math.min(1, accel * dt);
    if (this.keys.has("Space") && this.onGround) { this.vel.y = 8.6; this.onGround = false; }
    this.vel.y -= 24 * dt;
    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y <= 0) { this.pos.y = 0; this.vel.y = 0; this.onGround = true; }
    const bz = this.netMode === "guest" ? this.netBkZ : this.basilisk.position.z;
    this.pos.x = clamp(this.pos.x, -CORRIDOR - 6, CORRIDOR + 6);
    this.pos.z = clamp(this.pos.z, bz - 75, bz + 130);
    this.pos.z = Math.max(-30, this.pos.z);

    const spd = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && spd > 0.5) this.bobPhase += dt * (6 + spd * 0.9);

    this.fireCd -= dt;
    this.shotKick = Math.max(0, this.shotKick - dt * 3.2);
    this.invulnT -= dt;
    this.dashCd = Math.max(0, this.dashCd - dt);
    if (this.sandeT > 0) {
      this.sandeT -= dt;
      if (this.sandeT <= 0) { this.sandeCd = 12 * this.sandeCdMult; this.fovTarget = this.aiming ? 62 : 75; }
    } else this.sandeCd = Math.max(0, this.sandeCd - dt);
    if (this.regen > 0) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
    if (this.reloading) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.reloading = false;
        this.mags[this.weaponIdx] = Math.round(WEAPONS[this.weaponIdx].mag * this.magMult);
      }
    }
    const w = WEAPONS[this.weaponIdx];
    if (this.mouseDown && w.auto) this.tryFire();
  }

  private updateCamera(raw: number) {
    this.camera.position.set(this.pos.x, this.pos.y + 1.66, this.pos.z);
    this.recoil = Math.max(0, this.recoil - raw * 4.5);
    this.shakeT = Math.max(0, this.shakeT - raw);
    const sh = this.shakeT * 0.05;
    this.camera.rotation.set(
      this.pitch + this.recoil + (Math.random() - 0.5) * sh,
      this.yaw + (Math.random() - 0.5) * sh,
      (Math.random() - 0.5) * sh * 0.5
    );
    const targetFov = this.sandeT > 0 ? 70 : this.fovTarget;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, raw * 8);
    this.camera.updateProjectionMatrix();
    /* viewmodel anim */
    if (this.viewmodel) {
      const spd = Math.hypot(this.vel.x, this.vel.z);
      const bobA = this.onGround ? Math.min(1, spd / 7) : 0;
      this.viewmodel.position.set(
        0.32 + Math.sin(this.bobPhase) * 0.012 * bobA,
        -0.3 + Math.abs(Math.cos(this.bobPhase)) * 0.014 * bobA,
        -0.55 + this.recoil * 1.6
      );
      const w = WEAPONS[this.weaponIdx];
      this.viewmodel.rotation.x = this.reloading ? -Math.sin(clamp(1 - this.reloadT / (w.reload * this.reloadMult), 0, 1) * Math.PI) * 0.9 : this.recoil * 1.2;
      this.viewmodel.rotation.z = this.aiming ? -0.06 : 0;
    }
    if (this.muzzleLight) {
      this.muzzleFlashT = Math.max(0, this.muzzleFlashT - raw);
      this.muzzleLight.intensity = this.muzzleFlashT > 0 ? 4 : 0;
    }
    /* shadow follows player */
    this.sunLight.position.set(this.pos.x + 90, 110, this.pos.z + 140);
    this.sunLight.target.position.copy(this.pos);
    this.sunLight.target.updateMatrixWorld();
  }

  private updateBasilisk(dt: number) {
    if (this.basiliskDead) return;
    if (this.basilisk.position.z < TRAVEL) this.basilisk.position.z += 3.5 * dt;
    const t = performance.now() * 0.001;
    this.coreLight.intensity = 2.2 + Math.sin(t * 3.4) * 0.7;
    this.coreMat.emissiveIntensity = 2.4 + Math.sin(t * 3.4) * 0.8;
    const progress = clamp(this.basilisk.position.z / TRAVEL, 0, 1);
    while (this.radioIdx < RADIO_LINES.length && progress >= RADIO_LINES[this.radioIdx].at) {
      this.netToast(RADIO_LINES[this.radioIdx].text, "panam");
      this.radioIdx++;
    }
    if (this.basiliskHp <= 0) {
      this.basiliskDead = true;
      this.basilisk.visible = false;
      this.spawnExplosion(this.basilisk.position.clone().add(new THREE.Vector3(0, 2, 0)), 40, 0x00e5ff);
      this.spawnExplosion(this.basilisk.position.clone().add(new THREE.Vector3(0, 3, 0)), 30, 0xff9a3d);
      this.sfx.explode(true);
      this.endRun("dead", "«Базилиск» уничтожен — Панам погибла");
      return;
    }
    if (progress >= 1 && !this.ended && this.victoryT < 0) {
      this.victoryT = 1.6;
      this.netBanner("ТОЧКА ЭВАКУАЦИИ", "Гипердвигатель заряжен");
    }
  }

  private updateEnemies(dt: number) {
    const playerEye = this.tmpV.set(this.pos.x, this.pos.y + 1.4, this.pos.z);
    const basiliskC = this.tmpV2.set(this.basilisk.position.x, 2, this.basilisk.position.z);
    for (const e of [...this.enemies]) {
      if (e.dead) continue;
      e.bobT += dt * 3;
      if (e.flash > 0) {
        e.flash -= dt;
        const on = e.flash > 0;
        e.mats.forEach((m) => { m.emissiveIntensity = on ? 3.2 : (m.userData.base as number); });
      }
      const ep = e.root.position;
      const dP = ep.distanceTo(this.pos);
      const dB = this.basiliskDead ? 9999 : ep.distanceTo(this.basilisk.position);
      const targetBasilisk = dB < dP && !this.basiliskDead;

      if (e.kind === "soldier") {
        const np = this.nearestPlayer(ep);
        const target = targetBasilisk ? basiliskC : np.pos;
        const d = targetBasilisk ? dB : np.d;
        const aimEye = np.pid ? new THREE.Vector3(np.pos.x, np.pos.y + 1.4, np.pos.z) : playerEye;
        const dir = this.tmpV2.clone().copy(target).sub(ep).setY(0);
        if (dir.lengthSq() > 0.01) {
          dir.normalize();
          const want = d > (targetBasilisk ? 7 : 15) ? 1 : d < 9 ? -0.6 : 0;
          const strafeV = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(Math.sin(e.bobT * 0.7) * 0.5 * e.strafe);
          ep.addScaledVector(dir, e.speed * want * dt);
          ep.addScaledVector(strafeV, e.speed * 0.6 * dt);
          e.root.rotation.y = Math.atan2(dir.x, dir.z);
        }
        e.meleeT -= dt;
        if (!targetBasilisk && np.d < 2.1 && e.meleeT <= 0) {
          if (np.pid) this.netSendFn?.(np.pid, { t: "dmg", v: 12 });
          else this.damagePlayer(12);
          e.meleeT = 1;
        }
        e.fireT -= dt;
        if (e.fireT <= 0 && np.d < 65) {
          const from = ep.clone().add(new THREE.Vector3(0.42, 1.5, 0));
          const to = aimEye.clone().add(new THREE.Vector3(rnd(-1, 1), rnd(-0.6, 1), rnd(-1, 1)).multiplyScalar(0.5 + np.d * 0.02));
          const dmgS = ENEMY_DEFS.soldier.dmg * (1 + (this.wave - 1) * 0.12);
          if (np.pid) {
            this.fireBolt(from, to, dmgS, 26, 0xff5060, false, np.pid);
            this.netSendFn?.(np.pid, { t: "bolt", o: [this.r1(from.x), this.r1(from.y), this.r1(from.z)], a: [this.r1(to.x), this.r1(to.y), this.r1(to.z)], c: 0xff5060 });
          } else {
            this.fireBolt(from, to, dmgS, 26, 0xff5060);
          }
          e.fireT = rnd(1.2, 2.1);
        }
      } else if (e.kind === "drone") {
        if (e.rotors) e.rotors.rotation.y += dt * 22;
        if (e.fuse < 0) {
          const np = this.nearestPlayer(ep);
          const target = np.d < 40 || this.basiliskDead ? np.pos : this.basilisk.position;
          e.orbitA += dt * 1.15;
          const R = 8;
          const desired = new THREE.Vector3(
            target.x + Math.cos(e.orbitA) * R,
            2.7 + Math.sin(e.bobT) * 0.5,
            target.z + Math.sin(e.orbitA) * R
          );
          const toDes = desired.sub(ep);
          const dist = toDes.length();
          if (dist > 0.1) ep.addScaledVector(toDes.normalize(), Math.min(e.speed * 1.35 * dt, dist));
          const nearP = np.d < 3.4;
          const nearB = !this.basiliskDead && ep.distanceTo(this.basilisk.position.clone().add(new THREE.Vector3(0, 2.5, 0))) < 4.5;
          if (nearP || nearB) { e.fuse = 0.55; this.sfx.ui(); }
        } else {
          e.fuse -= dt;
          const blink = Math.sin(performance.now() * 0.03) > 0;
          e.mats.forEach((m) => { m.emissiveIntensity = blink ? 4 : 0.6; });
          if (e.fuse <= 0) {
            this.explodeAtPlayer(ep.clone(), 5, ENEMY_DEFS.drone.dmg * (1 + (this.wave - 1) * 0.1));
            this.removeEnemy(e, false);
            continue;
          }
        }
      } else {
        const np = this.nearestPlayer(ep);
        const target = targetBasilisk ? basiliskC : np.pos;
        const d = targetBasilisk ? dB : np.d;
        const aimEye = np.pid ? new THREE.Vector3(np.pos.x, np.pos.y + 1.4, np.pos.z) : playerEye;
        const dir = target.clone().sub(ep).setY(0);
        if (dir.lengthSq() > 0.01) {
          dir.normalize();
          if (d > 8) ep.addScaledVector(dir, e.speed * dt);
          e.root.rotation.y = Math.atan2(dir.x, dir.z);
        }
        e.fireT -= dt;
        if (e.burst > 0) {
          e.burstT -= dt;
          if (e.burstT <= 0) {
            e.burst--;
            e.burstT = 0.13;
            const from = ep.clone().add(new THREE.Vector3(rnd(-1, 1) * 0.9, 2.75, 0.6));
            const to = aimEye.clone().add(new THREE.Vector3(rnd(-1, 1), rnd(-0.5, 0.8), rnd(-1, 1)).multiplyScalar(0.7 + np.d * 0.015));
            const dmgH = ENEMY_DEFS.heavy.dmg * (1 + (this.wave - 1) * 0.1);
            if (np.pid) {
              this.fireBolt(from, to, dmgH, 30, 0xffa040, false, np.pid);
              this.netSendFn?.(np.pid, { t: "bolt", o: [this.r1(from.x), this.r1(from.y), this.r1(from.z)], a: [this.r1(to.x), this.r1(to.y), this.r1(to.z)], c: 0xffa040 });
            } else {
              this.fireBolt(from, to, dmgH, 30, 0xffa040);
            }
          }
        } else if (e.fireT <= 0 && np.d < 75) {
          e.burst = 3;
          e.burstT = 0;
          e.fireT = rnd(2.0, 2.7);
        }
        e.meleeT -= dt;
        if (!targetBasilisk && np.d < 2.6 && e.meleeT <= 0) {
          if (np.pid) this.netSendFn?.(np.pid, { t: "dmg", v: 22 });
          else this.damagePlayer(22);
          e.meleeT = 1.2;
        }
      }
      /* bob + altitude for drone root */
      if (e.kind !== "drone") ep.y = 0;
      /* despawn if far behind */
      if (ep.z < this.basilisk.position.z - 100) this.removeEnemy(e, false);
    }
  }

  private updateBolts(dt: number) {
    for (const b of [...this.bolts]) {
      b.life -= dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      const p = b.mesh.position;
      if (b.life <= 0 || p.y < 0.05) {
        if (p.y < 0.3 && !b.visual) this.spawnSparks(p.clone(), 0x8a6a50, 3, 3);
        this.scene.remove(b.mesh);
        this.bolts = this.bolts.filter((x) => x !== b);
        continue;
      }
      if (b.visual) continue;
      if (b.pid) {
        const s = this.squad.get(b.pid);
        if (s && !s.dead && p.distanceTo(this.tmpV.set(s.x, s.y + 1.2, s.z)) < 1.0) {
          this.netSendFn?.(b.pid, { t: "dmg", v: b.dmg });
          this.spawnSparks(p.clone(), 0xff5060, 5, 4);
          this.scene.remove(b.mesh);
          this.bolts = this.bolts.filter((x) => x !== b);
        }
        continue;
      }
      if (p.distanceTo(this.tmpV.set(this.pos.x, this.pos.y + 1.2, this.pos.z)) < 1.0) {
        this.damagePlayer(b.dmg);
        this.spawnSparks(p.clone(), 0xff5060, 5, 4);
        this.scene.remove(b.mesh);
        this.bolts = this.bolts.filter((x) => x !== b);
        continue;
      }
      if (!this.basiliskDead && Math.abs(p.x - this.basilisk.position.x) < 3.6 && Math.abs(p.z - this.basilisk.position.z) < 5 && p.y < 4.4) {
        this.basiliskHp -= b.dmg * 2.4;
        this.spawnSparks(p.clone(), 0x00e5ff, 5, 4);
        this.scene.remove(b.mesh);
        this.bolts = this.bolts.filter((x) => x !== b);
      }
    }
  }

  private updateParticles(dt: number) {
    for (const p of [...this.particles]) {
      p.life -= dt;
      p.vel.y -= 14 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 6;
      p.mesh.rotation.z += dt * 5;
      const s = Math.max(0.01, p.life / p.max);
      p.mesh.scale.setScalar(s);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles = this.particles.filter((x) => x !== p);
      }
    }
    for (const t of [...this.tracers]) {
      t.life -= dt;
      (t.mesh.material as THREE.MeshBasicMaterial).opacity = (t.life / t.max) * 0.9;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        (t.mesh.material as THREE.Material).dispose();
        this.tracers = this.tracers.filter((x) => x !== t);
      }
    }
  }

  private updatePickups(dt: number) {
    if (this.netMode === "guest") return;
    for (const p of [...this.pickups]) {
      p.t += dt;
      p.group.rotation.y += dt * 2.4;
      p.group.position.y = 0.8 + Math.sin(p.t * 2.4) * 0.18;
      if (p.group.position.distanceTo(this.pos) < 1.6) {
        if (p.kind === "med") { this.heal(35); this.sfx.pickup(); }
        else this.applyChip();
        this.scene.remove(p.group);
        this.pickups = this.pickups.filter((x) => x !== p);
      }
    }
  }

  private updateWaves(raw: number) {
    if (this.netMode === "guest") return;
    for (const q of [...this.spawnQueue]) {
      q.t -= raw;
      if (q.t <= 0) {
        this.spawnEnemy(q.kind);
        this.spawnQueue = this.spawnQueue.filter((x) => x !== q);
      }
    }
    this.waveT -= raw;
    if (this.waveT <= 0) {
      this.wave++;
      this.spawnWave(this.wave);
      this.waveT = Math.max(13, 25 - this.wave * 1.4);
    }
  }

  private updateEnv(raw: number, t: number) {
    /* dust around camera */
    const cx = this.mode === "attract" ? 0 : this.pos.x;
    const cz = this.mode === "attract" ? 0 : this.pos.z;
    for (let i = 0; i < this.dustPos.length; i += 3) {
      this.dustPos[i] += Math.sin(t + i) * 0.01 + 0.02;
      this.dustPos[i + 2] += 0.03;
      if (this.dustPos[i] - cx > 40) this.dustPos[i] -= 80;
      if (this.dustPos[i] - cx < -40) this.dustPos[i] += 80;
      if (this.dustPos[i + 2] - cz > 40) this.dustPos[i + 2] -= 80;
      if (this.dustPos[i + 2] - cz < -40) this.dustPos[i + 2] += 80;
    }
    (this.dust.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    this.dust.position.y = 0;
    /* AVs */
    for (const a of this.avs) {
      a.m.position.x += a.sp * a.dir * raw;
      if (a.m.position.x > 520) a.m.position.x = -520;
      if (a.m.position.x < -520) a.m.position.x = 520;
    }
    /* flicker */
    for (const f of this.flickers) {
      const drop = Math.sin(t * 13 + f.phase) > 0.985 ? 0.25 : 1;
      f.m.emissiveIntensity = f.base * (0.85 + Math.sin(t * 2.2 + f.phase) * 0.15) * drop;
    }
    /* beacon */
    const s = 1 + Math.sin(t * 2.6) * 0.08;
    this.beaconBeam.scale.set(s, 1, s);
  }

  private emitHud() {
    const w = WEAPONS[this.weaponIdx];
    const radar: HudData["radar"] = [];
    for (const e of this.enemies) {
      radar.push({ x: (e.root.position.x - this.pos.x) / 1.3, z: (e.root.position.z - this.pos.z) / 1.3, k: e.kind });
    }
    for (const p of this.pickups) {
      radar.push({ x: (p.group.position.x - this.pos.x) / 1.3, z: (p.group.position.z - this.pos.z) / 1.3, k: p.kind });
    }
    if (this.netMode === "host") {
      this.squad.forEach((m) => {
        if (!m.dead) radar.push({ x: (m.x - this.pos.x) / 1.3, z: (m.z - this.pos.z) / 1.3, k: "ally" });
      });
    } else if (this.netMode === "guest") {
      this.remotePlayers.forEach((rp) => {
        if (!rp.dead) radar.push({ x: (rp.group.position.x - this.pos.x) / 1.3, z: (rp.group.position.z - this.pos.z) / 1.3, k: "ally" });
      });
    }
    radar.push({ x: -this.pos.x / 1.3, z: (TRAVEL - this.pos.z) / 1.3, k: "beacon" });
    radar.push({ x: (this.basilisk.position.x - this.pos.x) / 1.3, z: (this.basilisk.position.z - this.pos.z) / 1.3, k: "basilisk" });

    const implants: string[] = ["Sandevistan MK.V", "Оптика «Кироши»"];
    if (this.mantis) implants.push("Клинки «Бомомол»");
    if (this.ice) implants.push("Дэймон «Схлоп»");

    this.cb.onHud({
      hp: Math.max(0, Math.round(this.hp)), maxHp: this.maxHp,
      level: this.level, xp: Math.round(this.xp), xpNext: this.xpNext,
      kills: this.kills, wave: this.wave, time: this.runT,
      weapons: WEAPONS.map((wp, i) => ({
        id: i, name: wp.name, mag: this.mags[i],
        magSize: Math.round(wp.mag * this.magMult),
        unlocked: this.unlockedW[i], active: i === this.weaponIdx, kind: wp.kind,
      })),
      weaponIdx: this.weaponIdx,
      reloading: this.reloading,
      reloadFrac: this.reloading ? clamp(1 - this.reloadT / (w.reload * this.reloadMult), 0, 1) : 0,
      basiliskHp: Math.max(0, Math.round(this.basiliskHp)), basiliskMax: this.basiliskMax,
      progress: clamp(this.basilisk.position.z / TRAVEL, 0, 1),
      sandeActive: this.sandeT > 0,
      sandeFrac: this.sandeT > 0 ? this.sandeT / SANDE_TIME : this.sandeCd > 0 ? 1 - this.sandeCd / (12 * this.sandeCdMult) : 1,
      dashFrac: 1 - this.dashCd / DASH_CD,
      spread: clamp((w.spread * this.spreadMult + this.shotKick * 0.012) * 900, 6, 46),
      aiming: this.aiming,
      implants,
      yaw: this.yaw,
      radar,
      net: {
        role: this.netMode,
        ping: this.netPing,
        room: this.roomCode,
        gdead: this.guestDead,
        respawnIn: Math.max(0, Math.ceil(this.respawnWait)),
        squad: (() => {
          const list: HudData["net"]["squad"] = [];
          if (this.netMode === "host") {
            list.push({ name: "ВИ", hp: Math.round(this.hp), maxHp: this.maxHp, me: true, dead: this.ended === "dead" });
            this.squad.forEach((m) => list.push({ name: m.name, hp: Math.max(0, Math.round(m.hp)), maxHp: m.maxHp, me: false, dead: m.dead }));
          } else if (this.netMode === "guest") {
            list.push({ name: this.guestName, hp: Math.round(this.hp), maxHp: this.maxHp, me: true, dead: this.guestDead });
            this.avInfo.forEach((v, pid) => {
              if (pid !== "H") return;
              list.push({ name: "ВИ", hp: Math.max(0, v.hp), maxHp: 100, me: false, dead: v.dead });
            });
            this.avInfo.forEach((v, pid) => {
              if (pid === "H") return;
              list.push({ name: v.name, hp: Math.max(0, v.hp), maxHp: 100, me: false, dead: v.dead });
            });
          }
          return list;
        })(),
      },
    });
  }

  /* ---------------- main loop ---------------- */

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const raw = clamp(this.clock.getDelta(), 0.001, 0.05);
    const t = performance.now() * 0.001;

    if (this.mode === "attract") {
      const a = t * 0.22;
      this.camera.position.set(Math.sin(a) * 17, 6.5 + Math.sin(t * 0.5) * 1.2, this.basilisk.position.z + Math.cos(a) * 17);
      this.camera.lookAt(this.basilisk.position.x, 2.6, this.basilisk.position.z);
      this.viewmodel.visible = false;
      this.updateEnv(raw, t);
      this.composer.render();
      return;
    }
    this.viewmodel.visible = true;

    if (!this.paused && !this.ended && (!this.awaitPerk || !!this.netMode)) {
      this.timeScale += ((this.sandeT > 0 ? 0.32 : 1) - this.timeScale) * Math.min(1, raw * 7);
      const dt = raw * this.timeScale;
      this.runT += raw;
      this.updatePlayer(raw);
      if (this.netMode === "guest") {
        this.updateGuestSim(raw);
      } else {
        this.updateBasilisk(dt);
        this.updateEnemies(dt);
        this.updateWaves(raw);
        this.updatePickups(dt);
        if (this.victoryT >= 0 && !this.ended) {
          this.victoryT -= raw;
          if (this.victoryT <= 0) this.endRun("won");
        }
      }
      this.updateBolts(dt);
      this.updateRemotePlayers(raw);
      if (this.netMode === "host") {
        this.netTick += raw;
        if (this.netTick >= 0.1) { this.netTick = 0; this.sendSnapshot(); }
      }
      if (this.netMode === "guest" && !this.guestDead) {
        this.netStateTick += raw;
        if (this.netStateTick >= 1 / 15) { this.netStateTick = 0; this.sendState(); }
      }
    }
    this.updateParticles(this.paused || this.awaitPerk ? 0 : raw * this.timeScale || raw * 0.016);
    this.updateCamera(raw);
    this.updateEnv(raw, t);

    this.hudT -= raw;
    if (this.hudT <= 0) {
      this.hudT = 0.05;
      this.emitHud();
    }
    this.composer.render();
  };
}
