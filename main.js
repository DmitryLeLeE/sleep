// НОЧНАЯ СМЕНА — 3D-атлас сна. Three.js без сборки.
import * as THREE from 'three';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const fmt = (v, dec = 0) => v.toFixed(dec).replace('.', ',');
const TAU = Math.PI * 2;

document.documentElement.classList.add('js');
const RM = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = RM.matches;
RM.addEventListener?.('change', (e) => { reduced = e.matches; });
const isMobile = () => innerWidth <= 760;

// CSS-цвета текущего режима (для 2D-канвасов)
let ink = {};
function readInk() {
  const cs = getComputedStyle(document.documentElement);
  const g = (n) => cs.getPropertyValue(n).trim();
  ink = { paper: g('--paper'), paper2: g('--paper-2'), card: g('--card'), ink: g('--ink'), soft: g('--ink-soft'), red: g('--red'), blue: g('--blue'), ochre: g('--ochre') };
}
readInk();

/* =====================================================================
   РЕЖИМ «ПЕЧАТЬ / ЧЕРТЁЖ»
   ===================================================================== */
let mode = document.documentElement.dataset.mode === 'blueprint' ? 'blueprint' : 'print';
const modeListeners = [];
function setMode(m) {
  mode = m;
  if (m === 'blueprint') document.documentElement.dataset.mode = 'blueprint';
  else delete document.documentElement.dataset.mode;
  $$('.modes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  document.querySelector('meta[name="theme-color"]').content = m === 'blueprint' ? '#163c78' : '#efe6cf';
  try { localStorage.setItem('nsmena-mode', m); } catch (e) { /* хранилище недоступно */ }
  readInk();
  modeListeners.forEach((f) => f());
}
$$('.modes button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
setMode(mode);

/* =====================================================================
   3D: МОЗГ ИЗ ЛИНИЙ И ТОЧЕК
   ===================================================================== */
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const rand = rng(1961);

// Точка на поверхности полушария. h = ±1, a — угол вокруг продольной оси, z ∈ [-1, 1] (лоб = +1)
function hemi(h, a, z, shrink = 1) {
  const rz = Math.sqrt(Math.max(0, 1 - z * z));
  const lx = Math.cos(a), ly = Math.sin(a);
  const side = lx * h;
  const sm = side > 0 ? side : side * 0.95;
  let x = h * (0.36 + 0.34 * rz * sm * shrink);
  let y = 0.08 + (ly > 0 ? 0.52 : 0.40) * rz * ly * shrink;
  // височная доля
  if (ly < -0.15 && side > -0.3) {
    const tz = Math.exp(-(((z - 0.12) / 0.36) ** 2));
    y -= 0.14 * tz * -ly * shrink;
    x += h * 0.05 * tz * shrink;
  }
  let Z = z * 0.84 * (1 + 0.05 * ly);
  // извилины
  const d = 0.028 * Math.sin(x * 19 + Z * 5) * Math.sin(Z * 15 + y * 12) * shrink;
  const cx = h * 0.36, cy = 0.08;
  x = cx + (x - cx) * (1 + d); y = cy + (y - cy) * (1 + d); Z *= 1 + d;
  return [x, y, Z];
}

function buildBrain() {
  const P = [], PR = [], PG = [];           // точки: позиции, случайное, регион
  const L = [], LR = [], LG = [];           // линии
  const surface = [], hippo = [];
  const addP = (p, region) => { P.push(...p); PR.push(rand()); PG.push(region); };
  const addL = (a, b, region) => { const r = rand(); L.push(...a, ...b); LR.push(r, r); LG.push(region, region); };

  for (const h of [-1, 1]) {
    // нейроны на коре
    let n = 0;
    while (n < 1500) {
      const z = rand() * 2 - 1;
      if (rand() > Math.sqrt(1 - z * z)) continue;
      const p = hemi(h, rand() * TAU, z * 0.98);
      addP(p, 0); surface.push(p); n++;
    }
    // глубинные нейроны
    for (let i = 0; i < 260; i++) {
      const z = rand() * 1.8 - 0.9;
      addP(hemi(h, rand() * TAU, z, 0.35 + rand() * 0.5), 6);
    }
    // извилины — продольные волнистые линии
    for (let k = 0; k < 28; k++) {
      const a0 = (k / 28) * TAU;
      let prev = null;
      for (let j = 0; j <= 90; j++) {
        const z = -0.97 + (1.94 * j) / 90;
        const a = a0 + 0.22 * Math.sin(z * 8 + k * 1.7) + 0.09 * Math.sin(z * 21 + k * 0.6);
        const p = hemi(h, a, z);
        if (prev) addL(prev, p, 0);
        prev = p;
      }
    }
    // поперечные борозды
    for (let k = 0; k < 10; k++) {
      const z0 = -0.85 + (1.7 * k) / 9;
      let prev = null;
      for (let j = 0; j <= 120; j++) {
        const a = (j / 120) * TAU;
        const z = z0 + 0.07 * Math.sin(a * 5 + k) + 0.04 * Math.sin(a * 11 + k * 2);
        const p = hemi(h, a, clamp(z, -0.98, 0.98));
        if (prev) addL(prev, p, 0);
        prev = p;
      }
    }
    // гиппокамп — изогнутая «морская коньковая» трубка
    let prevH = null;
    for (let i = 0; i <= 60; i++) {
      const u = i / 60;
      const c = [h * (0.25 + 0.07 * u), -0.02 - 0.26 * Math.sin(u * Math.PI * 0.55), -0.34 + 0.62 * u];
      if (prevH) addL(prevH, c, 3);
      prevH = c;
      for (let k = 0; k < 3; k++) {
        const p = [c[0] + (rand() - 0.5) * 0.06, c[1] + (rand() - 0.5) * 0.06, c[2] + (rand() - 0.5) * 0.04];
        addP(p, 3); hippo.push(p);
      }
    }
  }
  // связи между соседними нейронами
  const sub = surface.filter((_, i) => i % 3 === 0);
  for (let i = 0; i < sub.length; i++) {
    let best = [-1, -1], bd = [9, 9];
    const a = sub[i];
    for (let j = 0; j < sub.length; j++) {
      if (i === j) continue;
      const b = sub[j];
      const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
      if (d < bd[0]) { bd[1] = bd[0]; best[1] = best[0]; bd[0] = d; best[0] = j; }
      else if (d < bd[1]) { bd[1] = d; best[1] = j; }
    }
    for (const j of best) if (j > i && bd[best.indexOf(j)] < 0.02) addL(a, sub[j], 0);
  }
  // мозжечок
  const cc = [0, -0.36, -0.64], cr = [0.44, 0.19, 0.25];
  for (let k = 0; k < 13; k++) {
    const yy = -0.9 + (1.8 * k) / 12;
    const rr = Math.sqrt(1 - yy * yy);
    let prev = null;
    for (let j = 0; j <= 80; j++) {
      const t = (j / 80) * TAU;
      const w = 1 + 0.03 * Math.sin(t * 9 + k);
      const p = [cc[0] + cr[0] * rr * Math.cos(t) * w, cc[1] + cr[1] * yy, cc[2] + cr[2] * rr * Math.sin(t) * w];
      if (prev) addL(prev, p, 1);
      prev = p;
    }
  }
  for (let i = 0; i < 320; i++) {
    const t = rand() * TAU, yy = rand() * 2 - 1, rr = Math.sqrt(1 - yy * yy);
    addP([cc[0] + cr[0] * rr * Math.cos(t), cc[1] + cr[1] * yy, cc[2] + cr[2] * rr * Math.sin(t)], 1);
  }
  // ствол мозга
  for (let k = 0; k < 10; k++) {
    const t = (k / 10) * TAU;
    let prev = null;
    for (let j = 0; j <= 20; j++) {
      const u = j / 20, r = 0.1 - 0.03 * u;
      const p = [r * Math.cos(t), -0.18 - 0.85 * u, -0.28 - 0.18 * u + r * Math.sin(t)];
      if (prev) addL(prev, p, 2);
      prev = p;
    }
  }
  for (let i = 0; i < 120; i++) {
    const u = rand(), t = rand() * TAU, r = 0.1 - 0.03 * u;
    addP([r * Math.cos(t), -0.18 - 0.85 * u, -0.28 - 0.18 * u + r * Math.sin(t)], 2);
  }
  // СХЯ (регион 4) и эпифиз (регион 5)
  const SCN = [0, -0.33, 0.28], PIN = [0, -0.02, -0.3];
  for (let i = 0; i < 50; i++) addP([SCN[0] + (rand() - 0.5) * 0.07, SCN[1] + (rand() - 0.5) * 0.04, SCN[2] + (rand() - 0.5) * 0.05], 4);
  for (let i = 0; i < 40; i++) addP([PIN[0] + (rand() - 0.5) * 0.05, PIN[1] + (rand() - 0.5) * 0.05, PIN[2] + (rand() - 0.5) * 0.05], 5);

  const mk = (pos, r, g) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aRand', new THREE.Float32BufferAttribute(r, 1));
    geo.setAttribute('aRegion', new THREE.Float32BufferAttribute(g, 1));
    return geo;
  };

  // частицы эффектов: 0 — промывка, 1 — перенос памяти, 2 — мелатонин
  const FS = [], FE = [], FK = [], FD = [];
  for (let i = 0; i < 700; i++) { const s = surface[(rand() * surface.length) | 0]; FS.push(...s); FE.push(0, 0, 0); FK.push(0); FD.push(rand()); }
  for (let i = 0; i < 260; i++) { const s = hippo[(rand() * hippo.length) | 0]; const e = surface[(rand() * surface.length) | 0]; FS.push(...s); FE.push(...e); FK.push(1); FD.push(rand()); }
  for (let i = 0; i < 160; i++) { FS.push(...PIN); const a = rand() * TAU; FE.push(Math.cos(a) * 0.5, 0.5 + rand() * 0.4, Math.sin(a) * 0.5); FK.push(2); FD.push(rand()); }
  const fx = new THREE.BufferGeometry();
  fx.setAttribute('position', new THREE.Float32BufferAttribute(FS, 3));
  fx.setAttribute('aEnd', new THREE.Float32BufferAttribute(FE, 3));
  fx.setAttribute('aKind', new THREE.Float32BufferAttribute(FK, 1));
  fx.setAttribute('aSeed', new THREE.Float32BufferAttribute(FD, 1));

  // глаза, зрительные нервы, спинной мозг
  const X = [], XG = [];
  const seg = (a, b, g) => { X.push(...a, ...b); XG.push(g, g); };
  for (const h of [-1, 1]) {
    const E = [h * 0.3, -0.3, 1.12];
    for (let j = 0; j < 40; j++) {
      const t0 = (j / 40) * TAU, t1 = ((j + 1) / 40) * TAU;
      seg([E[0] + 0.13 * Math.cos(t0), E[1] + 0.13 * Math.sin(t0), E[2]], [E[0] + 0.13 * Math.cos(t1), E[1] + 0.13 * Math.sin(t1), E[2]], 0);
      seg([E[0] + 0.045 * Math.cos(t0), E[1] + 0.045 * Math.sin(t0), E[2] + 0.02], [E[0] + 0.045 * Math.cos(t1), E[1] + 0.045 * Math.sin(t1), E[2] + 0.02], 2);
    }
    // зрительный нерв → перекрёст → СХЯ
    const CH = [0, -0.36, 0.44], E0 = [E[0], E[1], E[2] - 0.12];
    const at = (u) => [lerp(E0[0], CH[0], u), lerp(E0[1], CH[1], u), lerp(E0[2], CH[2], u)];
    for (let j = 0; j < 12; j++) seg(at(j / 12), at((j + 1) / 12), 1);
    seg(CH, SCN, 1);
  }
  for (let j = 0; j < 14; j++) {
    const y0 = -1.03 - j * 0.05;
    seg([0, y0, -0.46], [0, y0 - 0.05, -0.47], 3);
    if (j % 3 === 0) seg([-0.09, y0, -0.46], [0.09, y0, -0.46], 3);
  }
  const extra = new THREE.BufferGeometry();
  extra.setAttribute('position', new THREE.Float32BufferAttribute(X, 3));
  extra.setAttribute('aGroup', new THREE.Float32BufferAttribute(XG, 1));

  return { points: mk(P, PR, PG), lines: mk(L, LR, LG), fx, extra };
}

const COMMON = /* glsl */`
uniform float uTime;
uniform float uW[11];
uniform float uPressure;
uniform float uHyp;
uniform float uRemOn;
`;
const BRAIN_COLOR = /* glsl */`
attribute float aRand;
attribute float aRegion;
vec3 brainColor(vec3 p) {
  float t = uTime;
  float b = 0.55 + 0.45 * aRand;
  vec3 col = vec3(0.07, 0.09, 0.95) * b;
  float vis = 1.0;
  if (aRegion > 2.5 && aRegion < 3.5) {
    vis = 0.2 + 0.8 * uW[7];
    col = mix(col, vec3(0.1, 1.0, 0.08) * (0.9 + 0.3 * sin(t * 4.0 + p.z * 9.0)), uW[7]);
  } else if (aRegion > 3.5) {
    vis = 0.1 + 0.9 * uW[2];
    float pulse = 0.65 + 0.35 * sin(t * 3.0);
    col = aRegion < 4.5 ? vec3(1.0, 0.12, 0.06) * pulse * 1.4 : vec3(0.1, 0.2, 1.0) * 1.3;
  } else if (aRegion > 5.5) {
    vis = 0.55;
  }
  // 1 · давление сна: охра поднимается снизу
  float lvl = mix(-1.05, 0.72, uPressure);
  float fill = smoothstep(lvl + 0.06, lvl - 0.06, p.y);
  col = mix(col, vec3(0.04, 0.95, 0.1) * b, uW[1] * fill * 0.9);
  // 2 · часы: всё приглушено, кроме ядер
  col *= mix(1.0, aRegion > 3.5 ? 1.0 : 0.35, uW[2]);
  // 3 · стадии: мерное «дыхание»
  col *= 1.0 + uW[3] * 0.4 * sin(t * 1.3 + p.z * 1.5);
  // 4 · глубокий сон: волна ото лба к затылку
  float zf = mix(1.05, -1.15, fract(t * 0.42));
  float band = exp(-pow((p.z - zf) / 0.13, 2.0));
  col = mix(col * (1.0 - 0.5 * uW[4]), vec3(1.0, 0.16, 0.05) * 1.35, uW[4] * band);
  // 5 · уборка: мозг затихает
  col *= mix(1.0, 0.5, uW[5]);
  // 6 · быстрый сон: рассинхронные вспышки
  float fl = step(0.72, fract(sin(aRand * 91.37 + floor(t * 9.0) * 13.13) * 4375.85));
  col += uW[6] * fl * vec3(0.95, 0.1, 0.22) * 0.9;
  // 7 · память: кора приглушена, гиппокамп ярок
  col *= mix(1.0, aRegion > 2.5 && aRegion < 3.5 ? 1.0 : 0.6, uW[7]);
  // 8 · цикл: яркость по глубине сна
  col *= mix(1.0, 0.4 + 0.9 * uHyp, uW[8]);
  col += uW[8] * uRemOn * fl * vec3(0.9, 0.1, 0.2) * 0.8;
  // 9 · недосып: провалы, красная лобная кора
  float drop = step(0.5, fract(sin(aRand * 57.13 + floor(t * 4.0) * 7.77) * 9631.3));
  col *= mix(1.0, 0.12 + 0.88 * drop, uW[9]);
  col = mix(col, vec3(0.95, 0.08, 0.05), uW[9] * smoothstep(0.2, 0.8, p.z) * 0.6);
  // 10 · утро
  col = mix(col, vec3(0.08, 0.62, 0.95) * b * 1.1, uW[10] * 0.55);
  return col * vis;
}
`;

const PTS_VERT = COMMON + BRAIN_COLOR + /* glsl */`
uniform float uSize;
uniform float uPR;
varying vec3 vCol;
void main() {
  vCol = brainColor(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * uPR * (0.6 + 0.8 * aRand) / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const PTS_FRAG = /* glsl */`
varying vec3 vCol;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.08, d);
  gl_FragColor = vec4(vCol, a * 0.85);
}`;
const LINE_VERT = COMMON + BRAIN_COLOR + /* glsl */`
varying vec3 vCol;
void main() {
  vCol = brainColor(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const LINE_FRAG = /* glsl */`
uniform float uAlpha;
varying vec3 vCol;
void main() { gl_FragColor = vec4(vCol, uAlpha); }`;

const FX_VERT = COMMON + /* glsl */`
attribute vec3 aEnd;
attribute float aKind;
attribute float aSeed;
uniform float uPR;
varying vec3 vCol;
void main() {
  vec3 p = position;
  float vis = 0.0;
  vec3 c = vec3(0.0);
  float sz = 0.02;
  if (aKind < 0.5) {
    float f = fract(uTime * 0.18 + aSeed);
    p = position * (1.0 - 0.42 * f) + vec3(0.0, -0.22 * f, 0.0);
    vis = uW[5] * sin(3.14159 * f);
    c = vec3(0.12, 0.35, 1.0) * 1.4;
    sz = 0.026;
  } else if (aKind < 1.5) {
    float f = fract(uTime * 0.22 + aSeed);
    p = mix(position, aEnd, f) + vec3(0.0, sin(3.14159 * f) * 0.35, 0.0);
    vis = uW[7] * sin(3.14159 * f);
    c = vec3(0.12, 1.0, 0.05) * 1.3;
    sz = 0.028;
  } else {
    float f = fract(uTime * 0.12 + aSeed);
    p = position + aEnd * f;
    vis = uW[2] * (1.0 - f);
    c = vec3(0.1, 0.25, 1.0) * 1.3;
    sz = 0.024;
  }
  vCol = c * vis;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = sz * uPR * (0.7 + 0.6 * aSeed) / -mv.z * step(0.001, vis);
  gl_Position = projectionMatrix * mv;
}`;
const EXTRA_VERT = COMMON + /* glsl */`
attribute float aGroup;
uniform vec2 uEye;
varying vec3 vCol;
void main() {
  vec3 p = position;
  float vis = 0.0;
  vec3 c = vec3(0.85);
  if (aGroup < 0.5) { vis = max(uW[2], uW[6]); }
  else if (aGroup < 1.5) { vis = uW[2]; c = vec3(0.05, 1.0, 0.05) * (0.55 + 0.45 * sin(uTime * 5.0 - p.z * 18.0)); }
  else if (aGroup < 2.5) { p.xy += uEye; vis = max(uW[2], uW[6]); c = vec3(1.0, 0.15, 0.08); }
  else { vis = uW[6]; c = vec3(1.0, 0.1, 0.06); }
  vCol = c * vis;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

/* ---------- ПОСТ-ШЕЙДЕР: офсетная печать 1960-х / синька ---------- */
const POST_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tScene;
uniform vec2 uRes;
uniform float uDpr;
uniform float uMode;
uniform vec2 uMouse;
uniform float uLens;
uniform float uCell;
varying vec2 vUv;

vec3 rawAt(vec2 px) { return texture2D(tScene, px / uRes).rgb; }
vec3 blurAt(vec2 px, float r) {
  vec3 c = rawAt(px) * 0.36;
  c += rawAt(px + vec2(r, 0.0)) * 0.16;
  c += rawAt(px - vec2(r, 0.0)) * 0.16;
  c += rawAt(px + vec2(0.0, r)) * 0.16;
  c += rawAt(px - vec2(0.0, r)) * 0.16;
  return c;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// раскладка на краски: r → кирпичная, g → охра, b → ультрамарин, общее → чёрная
vec4 separate(vec3 c) {
  float k = min(min(c.r, c.g), c.b);
  return vec4(c - k, k * 1.4);
}
float screenDot(vec2 px, float ang, float cell, vec4 mask, vec2 off, float gain) {
  vec2 q = px + off;
  float s = sin(ang), co = cos(ang);
  vec2 rp = vec2(co * q.x + s * q.y, -s * q.x + co * q.y);
  vec2 cc = (floor(rp / cell) + 0.5) * cell;
  vec2 sp = vec2(co * cc.x - s * cc.y, s * cc.x + co * cc.y) - off;
  float d = clamp(dot(separate(blurAt(sp, cell * 0.38)), mask) * gain, 0.0, 1.0);
  // неровная пропечатка
  d *= 0.78 + 0.32 * vnoise(sp * 0.006 + mask.xy * 7.0);
  float rad = sqrt(d) * cell * 0.66;
  float dist = length(rp - cc);
  return 1.0 - smoothstep(rad - 0.8, rad + 0.8, dist);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec3 c = rawAt(px);
  vec3 outc;
  if (uMode < 0.5) {
    float cell = uCell * uDpr;
    float g = 1.9;
    float cR = screenDot(px, 0.2618, cell, vec4(1.0, 0.0, 0.0, 0.0), vec2(1.7, -0.9) * uDpr, g);
    float cO = screenDot(px, 0.0, cell, vec4(0.0, 1.0, 0.0, 0.0), vec2(0.6, 1.5) * uDpr, g);
    float cB = screenDot(px, 1.309, cell, vec4(0.0, 0.0, 1.0, 0.0), vec2(-1.3, 1.1) * uDpr, g);
    float cK = screenDot(px, 0.7854, cell, vec4(0.0, 0.0, 0.0, 1.0), vec2(0.0), g);
    float grain = 0.86 + 0.14 * hash(floor(px / (1.5 * uDpr)));
    outc = vec3(1.0);
    outc *= mix(vec3(1.0), vec3(0.85, 0.60, 0.14), cO * 0.92 * grain);
    outc *= mix(vec3(1.0), vec3(0.75, 0.17, 0.15), cR * 0.94 * grain);
    outc *= mix(vec3(1.0), vec3(0.13, 0.26, 0.69), cB * 0.94 * grain);
    outc *= mix(vec3(1.0), vec3(0.12, 0.11, 0.11), cK * 0.9 * grain);
  } else {
    // синька: белые линии контура + штриховка заливки
    float st = 1.5 * uDpr;
    float l = dot(blurAt(px, uDpr), vec3(0.4, 0.3, 0.5));
    float gx = dot(rawAt(px + vec2(st, 0.0)) - rawAt(px - vec2(st, 0.0)), vec3(0.33));
    float gy = dot(rawAt(px + vec2(0.0, st)) - rawAt(px - vec2(0.0, st)), vec3(0.33));
    float edge = length(vec2(gx, gy));
    float line = clamp(edge * 2.4 + smoothstep(0.35, 0.8, l), 0.0, 1.0);
    float hatch = step(0.62, fract((px.x + px.y) / (7.0 * uDpr)));
    float fill = smoothstep(0.04, 0.3, l) * hatch * 0.55;
    outc = vec3(0.94, 0.97, 1.0) * max(line, fill);
  }
  // лупа: кадр без обработки
  float dist = length(px - uMouse);
  float R = 96.0 * uDpr * uLens;
  if (uLens > 0.01 && dist < R) {
    vec3 raw = c.r * vec3(1.0, 0.36, 0.26) + c.g * vec3(1.0, 0.8, 0.28) + c.b * vec3(0.36, 0.56, 1.0);
    outc = vec3(0.035, 0.045, 0.1) + raw * 1.2;
  }
  float ring = 1.0 - smoothstep(1.0 * uDpr, 2.2 * uDpr, abs(dist - R));
  vec2 dd = abs(px - uMouse);
  float cross = (step(dd.x, 0.8 * uDpr) * step(R - 14.0 * uDpr, dd.y) + step(dd.y, 0.8 * uDpr) * step(R - 14.0 * uDpr, dd.x)) * step(dist, R + 12.0 * uDpr);
  float mark = clamp(ring + cross, 0.0, 1.0) * step(0.01, uLens);
  vec3 markCol = uMode < 0.5 ? vec3(0.12, 0.11, 0.11) : vec3(1.0);
  outc = mix(outc, markCol, mark);
  gl_FragColor = vec4(outc, 1.0);
}`;

/* ---------- инициализация WebGL ---------- */
const stageCanvas = $('#stage');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas: stageCanvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
} catch (e) {
  stageCanvas.remove();
  console.warn('WebGL недоступен — атлас работает без 3D.');
}

const three = {};
if (renderer) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 50);
  const brain = buildBrain();
  const shared = {
    uTime: { value: 0 }, uW: { value: new Array(11).fill(0) },
    uPressure: { value: 0 }, uHyp: { value: 0.5 }, uRemOn: { value: 0 },
    uPR: { value: 1 }, uEye: { value: new THREE.Vector2() },
  };
  const add = { blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true };
  const pts = new THREE.Points(brain.points, new THREE.ShaderMaterial({
    uniforms: { ...shared, uSize: { value: 0.016 } }, vertexShader: PTS_VERT, fragmentShader: PTS_FRAG, ...add,
  }));
  const lines = new THREE.LineSegments(brain.lines, new THREE.ShaderMaterial({
    uniforms: { ...shared, uAlpha: { value: 0.42 } }, vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, ...add,
  }));
  const fx = new THREE.Points(brain.fx, new THREE.ShaderMaterial({ uniforms: shared, vertexShader: FX_VERT, fragmentShader: PTS_FRAG, ...add }));
  const extra = new THREE.LineSegments(brain.extra, new THREE.ShaderMaterial({
    uniforms: { ...shared, uAlpha: { value: 0.9 } }, vertexShader: EXTRA_VERT, fragmentShader: LINE_FRAG, ...add,
  }));
  const group = new THREE.Group();
  group.add(lines, pts, fx, extra);
  scene.add(group);
  pts.frustumCulled = lines.frustumCulled = fx.frustumCulled = extra.frustumCulled = false;

  const rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const postMat = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: rt.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uDpr: { value: 1 },
      uMode: { value: 0 }, uMouse: { value: new THREE.Vector2(-999, -999) }, uLens: { value: 0 }, uCell: { value: 5.5 },
    },
    vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false,
  });
  const postScene = new THREE.Scene();
  const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat);
  postQuad.frustumCulled = false;
  postScene.add(postQuad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  Object.assign(three, { scene, camera, shared, rt, postMat, postScene, postCam, group });
  modeListeners.push(() => { postMat.uniforms.uMode.value = mode === 'blueprint' ? 1 : 0; });
  postMat.uniforms.uMode.value = mode === 'blueprint' ? 1 : 0;
}

// Путь камеры: обложка + 10 глав (позиция и точка взгляда)
const CAM = [
  [[3.3, 1.4, 3.2], [0, -0.1, 0]],
  [[2.7, 0.7, 2.3], [0, -0.05, 0]],
  [[1.5, -0.5, 3.3], [0, -0.3, 0.35]],
  [[-3.0, 0.5, 1.2], [0, 0, 0]],
  [[-3.4, 1.5, -0.2], [0, -0.05, 0]],
  [[0.5, 3.8, 1.2], [0, -0.1, 0]],
  [[2.1, 0.1, 3.5], [0, -0.2, 0.2]],
  [[2.6, -0.5, -0.8], [0, -0.1, 0]],
  [[-1.9, 2.0, -3.0], [0, -0.1, 0]],
  [[2.9, 0.5, 1.4], [0, 0, 0]],
  [[0.0, 0.9, 3.5], [0, 0, 0]],
];
const CAM_SCALE = 0.9;
const camCurve = new THREE.CatmullRomCurve3(CAM.map((c) => new THREE.Vector3(...c[0]).multiplyScalar(CAM_SCALE)), false, 'centripetal');
const lookCurve = new THREE.CatmullRomCurve3(CAM.map((c) => new THREE.Vector3(...c[1])), false, 'centripetal');
const camPos = new THREE.Vector3(...CAM[0][0]).multiplyScalar(CAM_SCALE);
const camLook = new THREE.Vector3();
const tmpV = new THREE.Vector3(), tmpL = new THREE.Vector3();

let W = 0, H = 0, DPR = 1;
function resize() {
  W = innerWidth; H = innerHeight;
  DPR = Math.min(devicePixelRatio || 1, 1.75);
  if (renderer) {
    renderer.setPixelRatio(DPR);
    renderer.setSize(W, H);
    const { camera, rt, postMat, shared } = three;
    camera.aspect = W / H;
    camera.fov = isMobile() ? 50 : 36;
    if (isMobile()) camera.setViewOffset(W, H, 0, H * 0.12, W, H);
    else camera.setViewOffset(W, H, -W * 0.2, 0, W, H);
    camera.updateProjectionMatrix();
    rt.setSize(Math.round(W * DPR), Math.round(H * DPR));
    postMat.uniforms.uRes.value.set(Math.round(W * DPR), Math.round(H * DPR));
    postMat.uniforms.uDpr.value = DPR;
    postMat.uniforms.uCell.value = isMobile() ? 4.5 : 5.5;
    shared.uPR.value = (DPR * H) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  }
  layoutTape();
  sizeCanvases();
}

/* =====================================================================
   СКРОЛЛ И ГЛАВЫ
   ===================================================================== */
const coverEl = $('.cover');
const chapterEls = $$('.chapter');
const sceneEls = [coverEl, ...chapterEls];
const appendixEl = $('.appendix');
let S = 0;          // 0…11: обложка = 0–1, глава i = i…i+1
function readScroll() {
  const mid = innerHeight * 0.5;
  let s = 0;
  for (let i = 0; i < sceneEls.length; i++) {
    const r = sceneEls[i].getBoundingClientRect();
    if (mid >= r.bottom) { s = i + 1; continue; }
    if (mid >= r.top) { s = i + (mid - r.top) / r.height; }
    break;
  }
  S = s;
}
const local = (i) => clamp(S - i);   // прогресс внутри главы i

/* ---------- шкала-термометр (гл. 1) ---------- */
const thermoFill = $('#thermo-fill'), thermoHours = $('#thermo-hours');
function updateThermo() {
  const p = clamp(local(1) * 1.25 - 0.05);
  const hgt = p * 200;
  thermoFill.setAttribute('y', String(262 - hgt));
  thermoFill.setAttribute('height', String(hgt + 24));
  thermoHours.textContent = String(Math.round(p * 16));
  return p;
}

/* ---------- циферблат 24 ч (гл. 2) ---------- */
const polar = (h, r) => { const a = ((h - 12) / 24) * TAU; return [Math.sin(a) * r, -Math.cos(a) * r]; };
(function buildDial() {
  const g = $('#dial-ticks');
  let s = '';
  for (let h = 0; h < 24; h++) {
    const major = h % 6 === 0;
    const [x1, y1] = polar(h, 150), [x2, y2] = polar(h, major ? 132 : 140);
    s += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke-width="${major ? 3 : 1.5}"/>`;
    if (h % 3 === 0) { const [tx, ty] = polar(h, 118); s += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}">${String(h).padStart(2, '0')}</text>`; }
  }
  g.innerHTML = s;
  // ночь 22–06
  let d = 'M0 0';
  for (let h = 22; h <= 30; h += 0.25) { const [x, y] = polar(h % 24, 148); d += `L${x.toFixed(1)} ${y.toFixed(1)}`; }
  $('#dial-night').setAttribute('d', d + 'Z');
  // мелатонин 21–07
  const mel = (h) => { const u = (h - 21) / 10; return u < 0 || u > 1 ? 0 : Math.sin(Math.PI * Math.pow(u, 0.8)); };
  let m = '';
  for (let h = 21; h <= 31; h += 0.2) { const [x, y] = polar(h % 24, 38 + 62 * mel(h)); m += (m ? 'L' : 'M') + `${x.toFixed(1)} ${y.toFixed(1)}`; }
  for (let h = 31; h >= 21; h -= 0.2) { const [x, y] = polar(h % 24, 38); m += `L${x.toFixed(1)} ${y.toFixed(1)}`; }
  $('#dial-mel').setAttribute('d', m + 'Z');
  const [tx, ty] = polar(4.5, 128);
  const tmin = $('#dial-tmin'); tmin.setAttribute('cx', tx); tmin.setAttribute('cy', ty);
})();
const dialHand = $('#dial-hand'), dialTime = $('#dial-time'), dialNote = $('#dial-note');
let lastDialMin = -1;
function updateDial() {
  const hours = 18 + clamp(local(2) * 1.2 - 0.05) * 14;
  const hh = hours % 24;
  const mins = Math.round(hh * 60 / 10) * 10;
  if (mins === lastDialMin) return;
  lastDialMin = mins;
  dialHand.setAttribute('transform', `rotate(${(((hh - 12) / 24) * 360).toFixed(1)})`);
  dialTime.textContent = `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  const H = hours;
  dialNote.textContent =
    H < 21 ? 'вечер, свет ещё сдерживает мелатонин' :
    H < 23 ? 'в темноте эпифиз начинает выпускать мелатонин' :
    H < 27 ? 'биологическая ночь: мелатонина много' :
    H < 30 ? 'под утро — минимум температуры тела' :
             'утренний свет гасит мелатонин и подводит часы';
}

/* ---------- гипнограмма (гл. 8) ---------- */
// [стадия, минуты]: 0 бодрств., 1 REM, 2 N1, 3 N2, 4 N3
const NIGHT = [
  [0, 10], [2, 5], [3, 15], [4, 40], [3, 10], [1, 10],
  [3, 20], [4, 30], [3, 15], [1, 20], [0, 2],
  [3, 30], [4, 15], [3, 20], [1, 25],
  [3, 35], [2, 5], [3, 10], [1, 35], [0, 3],
  [3, 40], [1, 40], [2, 5], [0, 10],
];
const NIGHT_LEN = NIGHT.reduce((a, s) => a + s[1], 0);
const STAGE_Y = [40, 80, 120, 160, 200];
const HX = (m) => 70 + (m / NIGHT_LEN) * 550;
(function buildHypno() {
  const svg = $('#hypno');
  let s = '';
  ['Бодрств.', 'REM', 'N1', 'N2', 'N3'].forEach((n, i) => { s += `<path class="grid" d="M70 ${STAGE_Y[i]}H620"/><text x="4" y="${STAGE_Y[i] + 5}">${n}</text>`; });
  for (let h = 0; h <= 7; h++) { const x = HX(h * 60); s += `<path class="grid" d="M${x} 30V214"/><text x="${x - 16}" y="236">${String((23 + h) % 24).padStart(2, '0')}:00</text>`; }
  let m = 0, d = '';
  let n3 = '', rem = '';
  NIGHT.forEach(([st, len]) => {
    const x0 = HX(m), x1 = HX(m + len), y = STAGE_Y[st];
    d += d ? `L${x0.toFixed(1)} ${y}` : `M${x0.toFixed(1)} ${y}`;
    d += `L${x1.toFixed(1)} ${y}`;
    if (st === 4) n3 += `<rect class="n3" x="${x0}" y="${y}" width="${x1 - x0}" height="12"/>`;
    if (st === 1) rem += `<rect class="rem" x="${x0}" y="${y - 6}" width="${x1 - x0}" height="12"/>`;
    m += len;
  });
  s += n3 + `<path class="hline draw" pathLength="1" d="${d}"/>` + rem;
  s += `<text class="fig-lab" x="${HX(30)}" y="232" style="fill:var(--red)">а</text>`;
  s += `<text class="fig-lab" x="${HX(380)}" y="68" style="fill:var(--red)">б</text>`;
  s += `<text class="fig-lab" x="${HX(170)}" y="28" style="fill:var(--red)">в</text>`;
  s += `<circle id="hypno-dot" r="7" cx="70" cy="40" fill="var(--red)" stroke="var(--ink)" stroke-width="2"/>`;
  s += `<text x="480" y="256" class="fig-small">время ночи →</text>`;
  svg.innerHTML += s;
})();
const hypDot = $('#hypno-dot');
function nightAt(min) {
  let m = 0;
  for (const [st, len] of NIGHT) { if (min < m + len) return st; m += len; }
  return 0;
}

/* ---------- колокол хронотипов ---------- */
(function buildBell() {
  const pts = [];
  for (let x = 40; x <= 620; x += 4) {
    const u = (x - 300) / (x < 300 ? 95 : 125);
    const y = 230 - 180 * Math.exp(-0.5 * u * u);
    pts.push(`${x} ${y.toFixed(1)}`);
  }
  $('#bell-line').setAttribute('d', 'M' + pts.join('L'));
  $('#bell-fill').setAttribute('d', 'M40 230L' + pts.join('L') + 'L620 230Z');
  let t = '';
  [['очень ранние', 110], ['ранние', 205], ['средние', 300], ['поздние', 420], ['очень поздние', 540]].forEach(([n, x]) => {
    t += `<path d="M${x} 230v8"/><text x="${x}" y="254">${n}</text>`;
  });
  $('#bell-ticks').innerHTML = t;
})();

/* ---------- пиктограммы по возрастам ---------- */
$$('#ages li').forEach((li) => {
  const mn = +li.dataset.min, mx = +li.dataset.max;
  let s = '';
  for (let i = 0; i < mx; i++) s += `<svg viewBox="0 0 24 40" class="${i < mn ? 'full' : 'range'}" aria-hidden="true"><use href="#pic-man"/></svg>`;
  li.querySelector('.icons').innerHTML = s;
});

/* ---------- архив-картотека ---------- */
$$('.drawer').forEach((d) => d.addEventListener('click', () => d.setAttribute('aria-expanded', String(d.getAttribute('aria-expanded') !== 'true'))));

/* =====================================================================
   ПОЯВЛЕНИЕ: КЛИШЕ, ЦИФРЫ, ДОРИСОВКА СТРЕЛОК
   ===================================================================== */
function countUp(el) {
  const target = parseFloat(el.dataset.count);
  const dec = +(el.dataset.dec || 0);
  if (reduced) { el.textContent = fmt(target, dec); return; }
  const t0 = performance.now(), dur = 1300;
  const step = (now) => {
    const p = clamp((now - t0) / dur);
    el.textContent = fmt(target * (1 - Math.pow(1 - p, 3)), dec);
    if (p < 1) requestAnimationFrame(step);
  };
  el.textContent = fmt(0, dec);
  requestAnimationFrame(step);
}
$$('.draw').forEach((p) => {
  if (reduced) return;
  p.classList.add('is-drawing');
  p.addEventListener('transitionend', () => p.classList.remove('is-drawing'), { once: true });
});
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const el = e.target;
    el.classList.add('is-in');
    if (el.matches('[data-count]')) countUp(el);
    if (el.matches('.fig, .archive-arrow')) $$('.draw', el).forEach((p) => p.classList.add('is-in'));
    io.unobserve(el);
  }
}, { threshold: 0.25 });
$$('.stamp, [data-count], .fig, .archive-arrow').forEach((el) => io.observe(el));

/* =====================================================================
   ЭНЦЕФАЛОГРАММА: генераторы сигналов
   ===================================================================== */
const nz = (t) => Math.sin(t * 37.3) * 0.5 + Math.sin(t * 23.1 + 1.3) * 0.3 + Math.sin(t * 51.7 + 2.1) * 0.2;
function eeg(st, t) {
  switch (st) {
    case 'wake': return 0.2 * Math.sin(TAU * 10 * t) * (0.6 + 0.4 * Math.sin(TAU * 0.3 * t)) + 0.12 * nz(t * 1.3) + 0.06 * Math.sin(TAU * 21 * t);
    case 'n1': return 0.32 * Math.sin(TAU * 5.5 * t + Math.sin(t * 2)) + 0.14 * nz(t) + 0.1 * Math.sin(TAU * 9 * t) * Math.max(0, Math.sin(TAU * 0.15 * t));
    case 'n2': {
      let v = 0.24 * Math.sin(TAU * 5 * t) + 0.12 * nz(t);
      const ph = ((t % 7) + 7) % 7;
      v += 0.38 * Math.exp(-(((ph - 1.8) / 0.35) ** 2)) * Math.sin(TAU * 13 * t);
      const kc = ph - 4.6;
      v += -0.95 * Math.exp(-((kc / 0.13) ** 2)) + 0.6 * Math.exp(-(((kc - 0.36) / 0.18) ** 2));
      return v;
    }
    case 'n3': return 0.72 * Math.sin(TAU * 0.9 * t + 0.6 * Math.sin(TAU * 0.23 * t)) + 0.2 * Math.sin(TAU * 1.7 * t + 1) + 0.1 * nz(t);
    case 'rem': {
      let v = 0.14 * nz(t * 1.4) + 0.12 * Math.sin(TAU * 6 * t);
      const b = Math.max(0, Math.sin(TAU * 0.25 * t));
      v += 0.3 * b * ((((t * 3) % 1) + 1) % 1 * 2 - 1);
      return v;
    }
    case 'dep': {
      const micro = Math.max(0, Math.sin(TAU * 0.12 * t)) ** 6;
      return (1 - micro) * (0.18 * Math.sin(TAU * 10 * t) + 0.12 * nz(t)) + micro * 0.55 * Math.sin(TAU * 4.5 * t);
    }
  }
  return 0;
}
const STAGE_NAME = { wake: 'бодрствование', n1: 'N1 · дремота', n2: 'N2 · веретёна', n3: 'N3 · медленные волны', rem: 'REM · быстрый сон', dep: 'недосып · микросны' };
const HYP2ST = ['wake', 'rem', 'n1', 'n2', 'n3'];

function drawPaper(ctx, w, h, t, speed, dpr) {
  ctx.fillStyle = ink.card; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = mode === 'blueprint' ? 'rgba(255,255,255,.18)' : 'rgba(179,38,30,.22)';
  ctx.lineWidth = 1 * dpr;
  const step = 12 * dpr;
  const off = (t * speed) % step;
  ctx.beginPath();
  for (let x = w - off; x > 0; x -= step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = step / 2; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
}
// рисуем одну дорожку: перо справа, лента уходит влево
function drawTrace(ctx, x0, x1, yMid, amp, t, span, stageAt, dpr) {
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 1) {
    const tt = t - ((x1 - x) / (x1 - x0)) * span;
    const v = eeg(stageAt(tt), tt);
    const y = yMid - v * amp;
    x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = mode === 'blueprint' ? '#ffffff' : ink.blue;
  ctx.lineWidth = 1.6 * dpr;
  ctx.lineJoin = 'round';
  ctx.stroke();
  const yp = yMid - eeg(stageAt(t), t) * amp;
  ctx.fillStyle = ink.red;
  ctx.beginPath(); ctx.moveTo(x1, yp); ctx.lineTo(x1 + 12 * dpr, yp - 5 * dpr); ctx.lineTo(x1 + 12 * dpr, yp + 5 * dpr); ctx.fill();
  ctx.strokeStyle = ink.ink; ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath(); ctx.moveTo(x1 + 12 * dpr, yp); ctx.lineTo(x1 + 30 * dpr, 2); ctx.stroke();
}

const recCanvas = $('#recorder-canvas'), recCtx = recCanvas.getContext('2d');
const recEl = $('.recorder'), recLabel = $('#rec-stage');
let recStage = 'wake', recPrev = 'wake', recSwitch = -99;
function setRecStage(st, t) {
  if (st === recStage) return;
  recPrev = recStage; recStage = st; recSwitch = t;
  recLabel.textContent = STAGE_NAME[st];
}
function drawRecorder(t) {
  const c = recCanvas, dpr = c.width / Math.max(1, c.clientWidth);
  const w = c.width, h = c.height;
  drawPaper(recCtx, w, h, t, 40 * dpr, dpr);
  const stageAt = (tt) => (tt < recSwitch ? recPrev : recStage);
  drawTrace(recCtx, 4, w - 40 * dpr, h / 2, h * 0.36, t, 5, stageAt, dpr);
}

const stripCanvas = $('#eeg-strip'), stripCtx = stripCanvas.getContext('2d');
let stripVisible = false;
new IntersectionObserver((es) => { stripVisible = es[0].isIntersecting; }).observe(stripCanvas);
function drawStrip(t) {
  const c = stripCanvas, dpr = c.width / Math.max(1, c.clientWidth);
  const w = c.width, h = c.height;
  drawPaper(stripCtx, w, h, t, 40 * dpr, dpr);
  const rows = [['wake', 'Бодрств.'], ['n1', 'N1'], ['n2', 'N2'], ['n3', 'N3']];
  const rh = h / rows.length;
  const labW = 74 * dpr;
  rows.forEach(([st, name], i) => {
    const y = rh * (i + 0.5);
    stripCtx.fillStyle = ink.card; stripCtx.fillRect(0, rh * i, labW, rh);
    stripCtx.fillStyle = ink.ink;
    stripCtx.font = `500 ${14 * dpr}px Oswald, sans-serif`;
    stripCtx.fillText(name, 6 * dpr, y + 5 * dpr);
    stripCtx.strokeStyle = ink.ink; stripCtx.lineWidth = 1 * dpr;
    stripCtx.beginPath(); stripCtx.moveTo(0, rh * (i + 1)); stripCtx.lineTo(w, rh * (i + 1)); stripCtx.stroke();
    drawTrace(stripCtx, labW + 4, w - 36 * dpr, y, rh * (st === 'n3' ? 0.5 : 0.42), t + i * 1.7, 6, () => st, dpr);
  });
  stripCtx.fillStyle = ink.red;
  stripCtx.font = `italic 700 ${18 * dpr}px "PT Serif", serif`;
  // метки а, б, в
  stripCtx.fillText('а, б', labW + 8 * dpr, rh * 2 + 20 * dpr);
  stripCtx.fillText('в', labW + 8 * dpr, rh * 3 + 20 * dpr);
}

/* ---------- лента-прогресс ---------- */
const tapeCanvas = $('#tape-canvas'), tapeCtx = tapeCanvas.getContext('2d');
const tapeLinks = $$('.tape-marks a');
const tapeTargets = tapeLinks.map((a) => $(a.getAttribute('href')));
let tapeFracs = [];
function docH() { return Math.max(1, document.documentElement.scrollHeight - innerHeight); }
function layoutTape() {
  tapeFracs = tapeTargets.map((el) => (el ? clamp((el.getBoundingClientRect().top + scrollY) / docH()) : 0));
  tapeLinks.forEach((a, i) => { a.parentElement.style.top = `${(4 + tapeFracs[i] * 92).toFixed(2)}%`; });
}
function drawTape(t) {
  const c = tapeCanvas;
  const w = c.width, h = c.height;
  if (!w || !h) return;
  tapeCtx.clearRect(0, 0, w, h);
  const p = clamp(scrollY / docH());
  const vertical = h > w;
  const dpr = DPR;
  tapeCtx.strokeStyle = ink.red;
  tapeCtx.lineWidth = 1.6 * dpr;
  tapeCtx.beginPath();
  if (vertical) {
    const end = (0.04 + p * 0.92) * h;
    for (let y = 0; y <= end; y += 2) {
      const f = y / h;
      const x = w * 0.5 + Math.sin(y * 0.21) * 3 * dpr * (1 + 2 * Math.abs(Math.sin(f * 17))) + Math.sin(y * 0.047) * 3 * dpr;
      y === 0 ? tapeCtx.moveTo(x, y) : tapeCtx.lineTo(x, y);
    }
    tapeCtx.stroke();
    tapeCtx.fillStyle = ink.ink;
    tapeCtx.fillRect(0, end - 1 * dpr, w, 2 * dpr);
  } else {
    const end = p * w;
    for (let x = 0; x <= end; x += 2) {
      const y = h * 0.5 + Math.sin(x * 0.3) * h * 0.28;
      x === 0 ? tapeCtx.moveTo(x, y) : tapeCtx.lineTo(x, y);
    }
    tapeCtx.stroke();
  }
  // активная глава
  let act = -1;
  tapeFracs.forEach((f, i) => { if (p + 0.003 >= f) act = i; });
  tapeLinks.forEach((a, i) => a.classList.toggle('active', i === act));
}

function fitCanvas(c, hRatio) {
  const d = Math.min(devicePixelRatio || 1, 2);
  const cw = c.clientWidth, ch = hRatio ? cw * hRatio : c.clientHeight;
  if (!cw || !ch) return;
  c.width = Math.round(cw * d);
  c.height = Math.round(ch * d);
}
function sizeCanvases() {
  fitCanvas(recCanvas, isMobile() ? 0 : 0.4);
  fitCanvas(stripCanvas, 0.47);
  fitCanvas(tapeCanvas);
  drawMap();
}

/* =====================================================================
   КАРТА МИРА (приложение В)
   ===================================================================== */
const ISO2 = {4:'AF',8:'AL',12:'DZ',24:'AO',31:'AZ',32:'AR',36:'AU',40:'AT',44:'BS',50:'BD',51:'AM',56:'BE',64:'BT',68:'BO',70:'BA',72:'BW',76:'BR',84:'BZ',90:'SB',96:'BN',100:'BG',104:'MM',108:'BI',112:'BY',116:'KH',120:'CM',124:'CA',140:'CF',144:'LK',148:'TD',152:'CL',156:'CN',158:'TW',170:'CO',178:'CG',180:'CD',188:'CR',191:'HR',192:'CU',196:'CY',203:'CZ',204:'BJ',208:'DK',214:'DO',218:'EC',222:'SV',226:'GQ',231:'ET',232:'ER',233:'EE',238:'FK',242:'FJ',246:'FI',250:'FR',260:'TF',262:'DJ',266:'GA',268:'GE',270:'GM',275:'PS',276:'DE',288:'GH',300:'GR',304:'GL',320:'GT',324:'GN',328:'GY',332:'HT',340:'HN',348:'HU',352:'IS',356:'IN',360:'ID',364:'IR',368:'IQ',372:'IE',376:'IL',380:'IT',384:'CI',388:'JM',392:'JP',398:'KZ',400:'JO',404:'KE',408:'KP',410:'KR',414:'KW',417:'KG',418:'LA',422:'LB',426:'LS',428:'LV',430:'LR',434:'LY',440:'LT',442:'LU',450:'MG',454:'MW',458:'MY',466:'ML',478:'MR',484:'MX',496:'MN',498:'MD',499:'ME',504:'MA',508:'MZ',512:'OM',516:'NA',524:'NP',528:'NL',540:'NC',548:'VU',554:'NZ',558:'NI',562:'NE',566:'NG',578:'NO',586:'PK',591:'PA',598:'PG',600:'PY',604:'PE',608:'PH',616:'PL',620:'PT',624:'GW',626:'TL',630:'PR',634:'QA',642:'RO',643:'RU',646:'RW',682:'SA',686:'SN',688:'RS',694:'SL',703:'SK',704:'VN',705:'SI',706:'SO',710:'ZA',716:'ZW',724:'ES',728:'SS',729:'SD',732:'EH',740:'SR',748:'SZ',752:'SE',756:'CH',760:'SY',762:'TJ',764:'TH',768:'TG',780:'TT',784:'AE',788:'TN',792:'TR',795:'TM',800:'UG',804:'UA',807:'MK',818:'EG',826:'GB',834:'TZ',840:'US',854:'BF',858:'UY',860:'UZ',862:'VE',887:'YE',894:'ZM'};
const RU_EXTRA = { 'N. Cyprus': 'Северный Кипр', 'Somaliland': 'Сомалиленд', 'Kosovo': 'Косово' };
let regionNames = null;
try { regionNames = new Intl.DisplayNames(['ru'], { type: 'region' }); } catch (e) { /* старый браузер */ }
const nameOf = (id, fallback) => { const a = ISO2[+id]; try { if (a && regionNames) return regionNames.of(a); } catch (e) { /* */ } return RU_EXTRA[fallback] || fallback; };

const OECD = 'Дневники времени OECD';
const APP = 'Приложение ENTRAIN, Walch et al., 2016';
const SLEEP = {
  710: { h: 9.2, src: OECD, note: '≈ 553 мин в сутки — наибольшее значение в базе.' },
  156: { h: 9.0, src: OECD, note: '≈ 542 мин в сутки.' },
  233: { h: 8.8, src: OECD, note: '≈ 530 мин в сутки.' },
  840: { h: 8.8, src: OECD, note: '≈ 528 мин в сутки.' },
  356: { h: 8.8, src: OECD, note: '≈ 528–535 мин — выпуски базы расходятся.' },
  250: { h: 8.6, src: OECD, note: 'Около 8,5–8,6 ч по разным выпускам.' },
  380: { h: 8.6, src: OECD, note: 'Около 8,5–8,6 ч по разным выпускам.' },
  276: { h: 8.5, src: OECD, note: 'Около 8,5 ч.' },
  826: { h: 8.5, src: OECD, note: 'Около 8,5 ч.' },
  410: { h: 7.9, src: OECD, note: '≈ 471 мин в сутки — одно из самых коротких значений в базе.' },
  392: { h: 7.4, src: OECD, note: '≈ 442 мин — самое короткое значение в базе OECD. В ENTRAIN — 7 ч 24 мин, тоже самое короткое.' },
  528: { h: 8.2, src: APP, note: '8 ч 12 мин — самое долгое значение в исследовании ENTRAIN.' },
};
const SINGAPORE = { name: 'Сингапур', lon: 103.82, lat: 1.35, h: 7.4, src: APP, note: '7 ч 24 мин — вместе с Японией самое короткое значение в ENTRAIN.' };

// таблица под картой
(function fillTable() {
  const rows = Object.entries(SLEEP).map(([id, d]) => ({ name: nameOf(id, id), ...d }));
  rows.push({ name: SINGAPORE.name, h: SINGAPORE.h, src: SINGAPORE.src, note: SINGAPORE.note });
  rows.sort((a, b) => b.h - a.h);
  $('#map-table').innerHTML = rows.map((r) => `<tr><td>${r.name}</td><td>≈ ${fmt(r.h, 1)}</td><td>${r.src === APP ? 'ENTRAIN (приложение)' : 'OECD (дневники времени)'}</td></tr>`).join('');
})();

const mapCanvas = $('#map'), mapCtx = mapCanvas.getContext('2d');
const mapTip = $('#map-tip'), mapStatus = $('#map-status');
let world = null;            // [{id, name, polys}]
let mapW = 0, mapH = 0;
const LAT_TOP = 84, LAT_SPAN = 150;

function decodeTopo(topo) {
  const tr = topo.transform;
  const arcs = topo.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map((pt) => {
      if (!tr) return pt;
      x += pt[0]; y += pt[1];
      return [x * tr.scale[0] + tr.translate[0], y * tr.scale[1] + tr.translate[1]];
    });
  });
  const arcPts = (i) => (i >= 0 ? arcs[i] : arcs[~i].slice().reverse());
  const ring = (idx) => {
    const out = [];
    idx.forEach((i, k) => { const a = arcPts(i); out.push(...(k ? a.slice(1) : a)); });
    // кольцо через 180-й меридиан (Фиджи, Чукотка) — делаем долготы непрерывными
    const xs = out.map((p) => p[0]);
    if (Math.max(...xs) - Math.min(...xs) > 180) return out.map(([x, y]) => [x < 0 ? x + 360 : x, y]);
    return out;
  };
  return topo.objects.countries.geometries
    .filter((g) => g.arcs && +g.id !== 10)
    .map((g) => {
      const polys = g.type === 'Polygon' ? [g.arcs.map(ring)] : g.arcs.map((p) => p.map(ring));
      const bbox = [180, 90, -180, -90];
      polys.forEach((p) => p.forEach((r) => r.forEach(([x, y]) => {
        bbox[0] = Math.min(bbox[0], x); bbox[1] = Math.min(bbox[1], y); bbox[2] = Math.max(bbox[2], x); bbox[3] = Math.max(bbox[3], y);
      })));
      return { id: g.id, raw: g.properties?.name || '', polys, bbox };
    });
}
function project(lon, lat, w, h) { return [((lon + 180) / 360) * w, ((LAT_TOP - lat) / LAT_SPAN) * h]; }

function drawMap() {
  if (!world) return;
  const cw = mapCanvas.clientWidth;
  if (!cw) return;
  const ch = cw / 2.4;
  mapCanvas.style.aspectRatio = '2.4 / 1';
  const d = Math.min(devicePixelRatio || 1, 2);
  mapCanvas.width = Math.round(cw * d); mapCanvas.height = Math.round(ch * d);
  mapW = cw; mapH = ch;
  const ctx = mapCtx;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  const cell = cw < 600 ? 5 : 7;
  const ang = 0.26, s = Math.sin(ang), co = Math.cos(ang);
  const diag = Math.hypot(cw, ch);
  for (let v = -diag; v < diag; v += cell) {
    for (let u = -diag; u < diag; u += cell) {
      const x = co * u - s * v + cw / 2, y = s * u + co * v + ch / 2;
      if (x < 0 || y < 0 || x >= cw || y >= ch) continue;
      const c = countryAt(x, y);
      if (!c) continue;
      const dat = SLEEP[+c.id];
      if (dat) {
        const r = cell * 0.5 * clamp(0.35 + (dat.h - 7.2) / 2.4, 0.3, 1);
        if (dat.src === APP) { ctx.fillStyle = ink.red; ctx.fillRect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7); }
        else { ctx.fillStyle = ink.blue; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      } else {
        ctx.fillStyle = ink.soft; ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.arc(x, y, cell * 0.16, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
  // Сингапур слишком мал для контура — ставим метку
  const [sx, sy] = project(SINGAPORE.lon, SINGAPORE.lat, cw, ch);
  ctx.fillStyle = ink.red; ctx.strokeStyle = ink.ink; ctx.lineWidth = 1.5;
  ctx.fillRect(sx - 5, sy - 5, 10, 10); ctx.strokeRect(sx - 7, sy - 7, 14, 14);
  mapStatus.textContent = '';
}
function countryAt(x, y) {
  if (!world || !mapW) return null;
  const lon0 = (x / mapW) * 360 - 180, lat = LAT_TOP - (y / mapH) * LAT_SPAN;
  for (const c of world) {
    const [x0, y0, x1, y1] = c.bbox;
    if (lat < y0 || lat > y1) continue;
    const lon = lon0 >= x0 && lon0 <= x1 ? lon0 : lon0 + 360;
    if (lon < x0 || lon > x1) continue;
    let inside = false;
    for (const poly of c.polys) for (const r of poly) {
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i], [xj, yj] = r[j];
        if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
    if (inside) return c;
  }
  return null;
}
function showTip(ev) {
  const r = mapCanvas.getBoundingClientRect();
  const x = ev.clientX - r.left, y = ev.clientY - r.top;
  const [sx, sy] = project(SINGAPORE.lon, SINGAPORE.lat, r.width, r.height);
  let html = '';
  if (Math.hypot(x - sx, y - sy) < 12) {
    html = `<b>${SINGAPORE.name}</b><span class="tv">≈ ${fmt(SINGAPORE.h, 1)} ч</span>${SINGAPORE.note}<br><i>${SINGAPORE.src}</i>`;
  } else {
    const c = countryAt(x, y);
    if (!c) { mapTip.hidden = true; return; }
    const name = nameOf(c.id, c.raw);
    const dat = SLEEP[+c.id];
    html = dat
      ? `<b>${name}</b><span class="tv">≈ ${fmt(dat.h, 1)} ч</span>${dat.note}<br><i>${dat.src}</i>`
      : `<b>${name}</b><br>Нет сверенных сопоставимых данных. Оценки не подставляли.`;
  }
  mapTip.innerHTML = html;
  mapTip.hidden = false;
  const tw = mapTip.offsetWidth, th = mapTip.offsetHeight;
  let tx = x + 14, ty = y + 14;
  if (tx + tw > r.width) tx = Math.max(4, x - tw - 14);
  if (ty + th > r.height) ty = Math.max(4, y - th - 14);
  mapTip.style.left = `${tx}px`; mapTip.style.top = `${ty}px`;
}
mapCanvas.addEventListener('pointermove', showTip);
mapCanvas.addEventListener('pointerdown', showTip);
mapCanvas.addEventListener('pointerleave', () => { mapTip.hidden = true; });
fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json')
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((topo) => { world = decodeTopo(topo); drawMap(); })
  .catch(() => { mapStatus.textContent = 'Карта не загрузилась — все данные есть в таблице ниже.'; });
modeListeners.push(() => drawMap());

/* =====================================================================
   ЛУПА
   ===================================================================== */
const lensLabel = $('#lens-label');
let lensTarget = 0, lensVal = 0;
const mouse = { x: -999, y: -999 };
const NO_LENS = '.panel, .tab, .modes, .recorder, .tape, .cover-grid, .masthead, .legend-ev, .toc, .band, .appendix, .colophon, a, button';
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') { lensTarget = 0; return; }
  mouse.x = e.clientX; mouse.y = e.clientY;
  const over = e.target.closest?.(NO_LENS);
  lensTarget = over || !renderer || stageCanvas.classList.contains('is-hidden') ? 0 : 1;
  lensLabel.style.transform = `translate(${e.clientX + 104}px, ${e.clientY - 12}px)`;
  lensLabel.classList.toggle('on', lensTarget === 1);
});
document.addEventListener('pointerleave', () => { lensTarget = 0; lensLabel.classList.remove('on'); });

/* =====================================================================
   ГЛАВНЫЙ ЦИКЛ
   ===================================================================== */
let time = 0, last = performance.now();
const W11 = new Array(11).fill(0);
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!reduced) time += dt;
  const t = reduced ? 3.2 : time;
  readScroll();

  // веса глав
  for (let i = 1; i <= 10; i++) {
    const w = clamp(1.6 - Math.abs(S - (i + 0.5)) * 2.2);
    W11[i] = smooth(w);
  }
  const pressure = updateThermo();
  updateDial();

  // гипнограмма в главе 8: условная ночь за 45 секунд
  const nightMin = ((t / 45) % 1) * NIGHT_LEN;
  const hypSt = nightAt(nightMin);
  if (W11[8] > 0.01 || S >= 8 && S < 9) {
    hypDot.setAttribute('cx', HX(nightMin).toFixed(1));
    hypDot.setAttribute('cy', STAGE_Y[hypSt]);
  }

  // стадия самописца
  const sec = Math.min(10, Math.floor(S));
  let st = 'wake';
  if (sec === 1) st = local(1) < 0.45 ? 'wake' : 'n1';
  else if (sec === 3) st = 'n2';
  else if (sec === 4 || sec === 5) st = 'n3';
  else if (sec === 6) st = 'rem';
  else if (sec === 7) st = 'n2';
  else if (sec === 8) st = HYP2ST[hypSt];
  else if (sec === 9) st = 'dep';
  setRecStage(st, t);
  const inApp = appendixEl.getBoundingClientRect().top < innerHeight * 0.55;
  const hideStage = inApp || (isMobile() && S < 0.8);
  recEl.classList.toggle('is-hidden', inApp);
  if (!inApp) drawRecorder(t);
  if (stripVisible) drawStrip(t);
  drawTape(t);

  if (renderer) {
    stageCanvas.classList.toggle('is-hidden', hideStage);
    if (!hideStage) {
      const { camera, shared, postMat, scene, rt, postScene, postCam } = three;
      const u = clamp((S - 0.5) / 10);
      camCurve.getPoint(u, tmpV);
      lookCurve.getPoint(u, tmpL);
      // на обложке камера медленно облетает мозг
      const coverW = 1 - smooth(clamp((S - 0.6) / 0.6));
      const ang = coverW * Math.sin(t * 0.12) * 0.7 + (1 - coverW) * Math.sin(t * 0.08) * 0.06;
      const cx = tmpV.x * Math.cos(ang) + tmpV.z * Math.sin(ang), cz = -tmpV.x * Math.sin(ang) + tmpV.z * Math.cos(ang);
      tmpV.x = cx; tmpV.z = cz;
      if (isMobile()) tmpV.multiplyScalar(1.45);
      const k = reduced ? 1 : 1 - Math.pow(0.001, dt);
      camPos.lerp(tmpV, k);
      camLook.lerp(tmpL, k);
      camera.position.copy(camPos);
      camera.lookAt(camLook);

      shared.uTime.value = t;
      shared.uW.value = W11;
      shared.uPressure.value = pressure;
      const hypDepth = [0, 0.55, 0.3, 0.6, 1][hypSt];
      shared.uHyp.value = lerp(shared.uHyp.value, hypDepth, 0.08);
      shared.uRemOn.value = hypSt === 1 ? 1 : 0;
      // быстрые движения глаз — рывками (саккады)
      const sacc = Math.floor(t * 2.6);
      const ex = W11[6] > 0.01 ? (Math.sin(sacc * 12.9898) * 43758.5 % 1) * 0.07 : 0;
      const ey = W11[6] > 0.01 ? (Math.sin(sacc * 78.233) * 12345.6 % 1) * 0.03 : 0;
      shared.uEye.value.set(ex, ey);

      lensVal = lerp(lensVal, lensTarget, reduced ? 1 : 0.2);
      postMat.uniforms.uLens.value = lensVal;
      postMat.uniforms.uMouse.value.set(mouse.x * DPR, (innerHeight - mouse.y) * DPR);

      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    }
  }
  requestAnimationFrame(frame);
}

addEventListener('resize', resize);
if (document.fonts?.ready) document.fonts.ready.then(() => { layoutTape(); });
addEventListener('load', layoutTape);
resize();
requestAnimationFrame(frame);
