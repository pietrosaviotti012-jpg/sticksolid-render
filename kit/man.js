// The StickSolid 3D man (and the secondary characters) on a transparent background, posed or moving.
// window.renderMan(cfg) -> PNG data URL
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeSolid } from './lib/solid.js';
import { solidMove } from './lib/moves-solid.js';

const SIZE = 1600;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

// arms hang down at rest; z on a shoulder swings the arm out to the side (both sides use the same sign
// convention after the mirror below), x swings it forward. Angles in radians.
const POSES = {
  stand: { lSh: [0, 0, 0.12], rSh: [0, 0, -0.12], lEl: [-0.15, 0, 0], rEl: [-0.15, 0, 0] },
  wave: { lSh: [0, 0, 0.12], rSh: [-0.2, 0, -2.5], rEl: [0, 0, -0.9], lEl: [-0.15, 0, 0], head: [0.05, -0.12, 0.08] },
  hips: { lSh: [0.1, 0, 0.55], rSh: [0.1, 0, -0.55], lEl: [-1.9, 0.0, 0.4], rEl: [-1.9, 0.0, -0.4] },
  shrug: { lSh: [-0.3, 0, 0.5], rSh: [-0.3, 0, -0.5], lEl: [-1.6, 0, -0.5], rEl: [-1.6, 0, 0.5], head: [0, 0, 0.12] },
  whoa: { lSh: [-1.2, 0, 0.35], rSh: [-1.2, 0, -0.35], lEl: [-0.6, 0, 0], rEl: [-0.6, 0, 0], spine: [-0.08, 0, 0], head: [-0.12, 0, 0] },
  hi: { rSh: [0, 0, -0.12], rEl: [-0.15, 0, 0], lSh: [-0.25, 0, 2.05], lEl: [0, 0, 0.9], head: [0.04, 0.1, -0.06] },
  point: { lSh: [0, 0, 0.12], lEl: [-0.15, 0, 0], rSh: [-0.25, 0, -1.45], rEl: [0, 0, -0.15], head: [0, -0.35, 0] },
  cheer: { lSh: [-0.2, 0, 2.5], rSh: [-0.2, 0, -2.5], lEl: [0, 0, 0.5], rEl: [0, 0, -0.5], head: [-0.1, 0, 0] },
  thumb: { lSh: [0, 0, 0.12], rSh: [-1.0, 0, -0.5], rEl: [-1.3, 0, -0.2], lEl: [-0.15, 0, 0] },
};

window.renderMan = (cfg = {}) => {
  // cfg.bg paints a solid background (videos); without it the picture is transparent (compositing)
  renderer.setClearColor(cfg.bg ? new THREE.Color(cfg.bg) : 0x000000, cfg.bg ? 1 : 0);
  const scene = new THREE.Scene();
  // cfg.theme (a colour theme from temi.json, "solid" part): a sky gradient behind, coloured key and rim lights,
  // the fill from the sky, exposure and a light fog. Without it: neutral studio light, transparent background.
  const th = cfg.theme || {};
  if (th.sky) {
    const cvs = document.createElement('canvas'); cvs.width = 4; cvs.height = 512;
    const gx = cvs.getContext('2d'), gr = gx.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.55, th.sky[1]); gr.addColorStop(1, th.sky[2]);
    gx.fillStyle = gr; gx.fillRect(0, 0, 4, 512);
    const tex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace; scene.background = tex;
  }
  if (th.fog) scene.fog = new THREE.Fog(new THREE.Color(th.fog[0]), th.fog[1], th.fog[2]);
  renderer.toneMappingExposure = th.exposure ?? 1.05;
  scene.environment = env; scene.environmentIntensity = th.env ?? 0.55;
  scene.add(new THREE.HemisphereLight(new THREE.Color(th.hemi?.[0] || '#ffffff'), new THREE.Color(th.hemi?.[1] || '#b8a890'), th.hemi?.[2] ?? 0.9));
  const key = new THREE.DirectionalLight(new THREE.Color(th.key?.[0] || '#fff4e8'), th.key?.[1] ?? 2.4);
  key.position.set(-2.5, 5, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  const c = key.shadow.camera; c.left = c.bottom = -2; c.right = c.top = 2; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 5;
  scene.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color(th.rim?.[0] || '#ffffff'), th.rim?.[1] ?? 1.4); rim.position.set(3, 3, -4); scene.add(rim);
  if (cfg.ground !== false) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.ShadowMaterial({ color: new THREE.Color(th.shadow || '#1a1020'), opacity: 0.28 }));
    g.rotation.x = -Math.PI / 2; g.receiveShadow = true; scene.add(g);
  }

  // secondary characters: cfg.look (hair, beard, glasses, colours), cfg.hem (how long the top is: -0.075 a T-shirt,
  // -0.42 a lab coat or a long jacket), cfg.sleeves 'long', cfg.hat ('helmet' | 'cap'), cfg.size (0.62 a child),
  // cfg.headBig (a child's bigger head)
  const man = makeSolid(cfg);
  // the dressing (shirt, trousers, shoes, hats, child size) lives in lib/solid.js, shared with the video projects

  // a ready-made move at time cfg.t (lib/moves-solid.js) replaces the fixed pose
  const mv = cfg.move ? solidMove(cfg.move, cfg.t || 0) : null;
  const pose = mv ? { ...mv.pose, ...(cfg.poseExtra || {}) } : { ...(POSES[cfg.pose || 'stand']), ...(cfg.poseExtra || {}) };
  man.setPose(pose);
  man.setFace(mv ? { ...mv.face, ...(cfg.face || {}) } : (cfg.face || {}));
  man.root.rotation.y = cfg.turn || 0;
  if (mv && mv.root) man.root.position.set(...mv.root);
  scene.add(man.root);

  const cam = new THREE.PerspectiveCamera(cfg.fov || 24, 1, 0.1, 50);
  cam.position.set(...(cfg.camPos || [0, 1.3, 4.6]));
  cam.lookAt(new THREE.Vector3(...(cfg.camLook || [0, 1.05, 0])));
  renderer.render(scene, cam);
  // where the fists land on the picture (pixels of the 1600 square), so a 2D character can meet them
  man.root.updateMatrixWorld(true);
  const px = (k) => { const v = new THREE.Vector3(0, -0.07, 0.01); man.j[k].localToWorld(v); v.project(cam); return [(v.x + 1) / 2 * SIZE, (1 - v.y) / 2 * SIZE]; };
  const hd = (() => { const v = new THREE.Vector3(0, 0.1, 0.05); man.j.head.localToWorld(v); v.project(cam); return [(v.x + 1) / 2 * SIZE, (1 - v.y) / 2 * SIZE]; })();
  // feet: the lowest point of the shoes (the ankle joint plus the sole), so a page can stand him on a ground line
  const sole = (k) => { const v = new THREE.Vector3(0, -0.09, 0.04); man.j[k].localToWorld(v); v.project(cam); return (1 - v.y) / 2 * SIZE; };
  window.lastFists = { r: px('rWr'), l: px('lWr'), head: hd, feet: Math.max(sole('rAn'), sole('lAn')) };
  // dispose this frame's geometry and materials so long videos do not fill the GPU memory
  if (cfg.keep !== true) setTimeout(() => scene.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } }), 0);
  return cfg.asCanvas ? renderer.domElement : renderer.domElement.toDataURL('image/png');
};
// for pages that draw Solid inside their own canvas (the closing card): returns the WebGL canvas itself
window.renderManCanvas = (cfg = {}) => window.renderMan({ ...cfg, asCanvas: true });
window.manReady = true;
