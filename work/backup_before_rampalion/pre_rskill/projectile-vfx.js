import * as THREE from './vendor/three.module.js';
import { prefersLightFx, prefersLowEndGfx } from './mobile.js';
import { W, H } from './canvas.js';

// Three.js instanced VFX layer. Hitboxes stay in Canvas; Emily's beam body and
// flowing particles share this visual-only layer with the other weapon motes.
function vfxCaps() {
  if (prefersLightFx()) return { limit: 900, transient: 220 };
  return { limit: 2800, transient: 720 };
}

/** Kit → particle palette / emit density language (not geometry).
 *  Hold identities (sunbird/flameward, sightbeam, dragonaxe, shell, jupiterorb,
 *  coffinround, plasmaslash, railbolt) keep distinct dens/stretch/smoke reads. */
const KIT = {
  // Basic autofire — narrow Yatagarasu fire jet
  foxflame: { hue: '#ff7a32', core: '#fff2c8', smoke: '#ff9a48', dens: 1.18, stretch: 0.72 },
  // Hirume HOLD — phoenix wing-fan silhouette (tick73)
  sunbird: { hue: '#ff9420', core: '#fff8c8', smoke: '#ff5830', dens: 1.76, stretch: 0.58 },
  // Unused napalm bloom leftover from lore remap (do not spawn)
  flameward: { hue: '#ff5a18', core: '#ffe8b0', smoke: '#ff6a38', dens: 1.82, stretch: 0.48 },
  sunseal: { hue: '#ff7a32', core: '#fff2c8', smoke: '#ff9a48', dens: 1.1, stretch: 1.0 },
  tracer: { hue: '#ffd06a', core: '#fff8e8', smoke: '#c48a48', dens: 0.92, stretch: 1.12 },
  lockround: { hue: '#ffc078', core: '#fff4dc', smoke: '#a46838', dens: 1.22, stretch: 0.78 },
  cleave: { hue: '#ff5a78', core: '#ffe0e8', smoke: '#ff8aa0', dens: 1.0, stretch: 1.2 },
  // Returning axe — heavy tumble chips (narrower mass than fan sheet)
  dragonaxe: { hue: '#ff3a62', core: '#ffe8f0', smoke: '#ff7090', dens: 1.34, stretch: 0.92 },
  // Artillery shell — sparse ash/smoke (≠ HMG dense short chips)
  shell: { hue: '#ffb45a', core: '#fff4d8', smoke: '#6a8098', dens: 0.78, stretch: 0.82 },
  commandmissile: { hue: '#ffb45a', core: '#fff0d0', smoke: '#8aa0b4', dens: 1.0, stretch: 1.4 },
  orbital: { hue: '#ffb45a', core: '#fff0d0', smoke: '#8aa0b4', dens: 0.95, stretch: 1.3 },
  lightning: { hue: '#6ef0ff', core: '#f4ffff', smoke: '#4ad0ff', dens: 1.35, stretch: 1.25 },
  chainarc: { hue: '#6ef0ff', core: '#f4ffff', smoke: '#4ad0ff', dens: 1.45, stretch: 1.3 },
  // HMG volley — denser short violet chips (≠ arty ash, ≠ gold lance)
  coffinround: { hue: '#c89cff', core: '#f8f0ff', smoke: '#8a68c8', dens: 1.34, stretch: 1.12 },
  coffinmissile: { hue: '#c89cff', core: '#f4e8ff', smoke: '#9a70d8', dens: 1.0, stretch: 1.35 },
  coffinwall: { hue: '#c89cff', core: '#f4e8ff', smoke: '#9a70d8', dens: 0.95, stretch: 1.2 },
  coffinshield: { hue: '#c89cff', core: '#f4e8ff', smoke: '#9a70d8', dens: 0.9, stretch: 1.0 },
  // Crescent slash — thin long magenta sheet (≠ fan fat embers, ≠ cloud puffs)
  plasmaslash: { hue: '#ff6ae0', core: '#fff0ff', smoke: '#c050ff', dens: 1.06, stretch: 1.86 },
  plasmacross: { hue: '#ff7ae8', core: '#ffe8ff', smoke: '#d060ff', dens: 1.1, stretch: 1.1 },
  swordguard: { hue: '#ff7ae8', core: '#ffe8ff', smoke: '#d060ff', dens: 0.95, stretch: 1.0 },
  orbitblade: { hue: '#ff7ae8', core: '#ffe8ff', smoke: '#d060ff', dens: 1.05, stretch: 1.2 },
  // Railspike — sparse long cyan needles (≠ continuous railbeam body)
  railbolt: { hue: '#48b8ff', core: '#f6ffff', smoke: '#2468d8', dens: 0.4, stretch: 2.9 },
  // Thunder cloud — puffier cyan volume (≠ crescent sheet, ≠ HMG chips)
  jupiterorb: { hue: '#5ef0ff', core: '#ffffff', smoke: '#40c8ff', dens: 1.82, stretch: 0.58 },
  empfield: { hue: '#6ef0ff', core: '#f4ffff', smoke: '#40c8ff', dens: 1.2, stretch: 1.0 },
  teslacoil: { hue: '#6ef0ff', core: '#ffffff', smoke: '#50d0ff', dens: 1.15, stretch: 1.0 },
  // Emily basic laser — denser continuous body (≠ railspike needles)
  railbeam: { hue: '#6ec8ff', core: '#eafcff', smoke: '#4a98ff', dens: 1.34, stretch: 1.48 },
  busterbeam: { hue: '#8edfff', core: '#ffffff', smoke: '#58adff', dens: 1.8, stretch: 2.25 },
  // Overwatch lance — sparse gold needle ribbon (≠ HMG volley chips)
  sightbeam: { hue: '#ffd86a', core: '#fffaf0', smoke: '#b88840', dens: 0.72, stretch: 2.48 },
  swordlance: { hue: '#ff7ae8', core: '#ffe8ff', smoke: '#d060ff', dens: 1.05, stretch: 1.65 },
  teslabeam: { hue: '#6ef0ff', core: '#f4ffff', smoke: '#4ad0ff', dens: 1.3, stretch: 1.7 },
  cyclopsbeam: { hue: '#ff5a78', core: '#ffe0e8', smoke: '#ff8aa0', dens: 1.1, stretch: 1.7 },
  xenoxcore: { hue: '#6ec8ff', core: '#ffffff', smoke: '#4a98ff', dens: 1.2, stretch: 1.0 },
};

/** Hold-FIRE primary style per character (≠ basic autofire style). */
const HOLD_STYLE = {
  hirume: 'sunbird',
  constantia: 'lockround',
  lrl: 'dragonaxe',
  merlin: 'shell',
  fafnir: 'jupiterorb',
  eternity: 'coffinwall',
  labiata: 'plasmaslash',
  emily: 'railbolt',
};

function isPlasmaStyle(style) {
  return style === 'lightning' || style === 'jupiterorb' || style === 'teslabeam'
    || style === 'empfield' || style === 'teslacoil' || style === 'chainarc';
}

function isBeamStyle(b) {
  return (b.beamLength > 0) || b.style === 'railbeam' || b.style === 'busterbeam' || b.style === 'sightbeam'
    || b.style === 'swordlance' || b.style === 'teslabeam' || b.style === 'cyclopsbeam';
}

const vertexShader = `
attribute vec4 placement;
attribute vec4 effect;
attribute vec3 tint;
varying vec2 p;
varying vec4 fx;
varying vec3 color;
void main() {
  p=uv*2.0-1.0; fx=effect; color=tint;
  float c=cos(placement.z), s=sin(placement.z);
  vec2 local=position.xy*vec2(placement.w, effect.w);
  vec2 world=placement.xy+vec2(local.x*c-local.y*s,local.x*s+local.y*c);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(world,0.0,1.0);
}`;

// Soft textured quads: 0–4 shot particles; 5+ bomb helpers remapped to soft falloffs
// (no gear spokes / zigzag polylines / regular polygons). Additive-friendly falloffs + color ramps.
const fragmentShader = `
precision highp float;
varying vec2 p;
varying vec4 fx;
varying vec3 color;
float hash(float n){return fract(sin(n*127.1+311.7)*43758.5453);}
float noise(vec2 v){vec2 i=floor(v),f=fract(v);f=f*f*(3.0-2.0*f);return mix(mix(hash(i.x+i.y*57.0),hash(i.x+1.0+i.y*57.0),f.x),mix(hash(i.x+(i.y+1.0)*57.0),hash(i.x+1.0+(i.y+1.0)*57.0),f.x),f.y);}
void main(){
  float type=fx.x,t=fx.y,fade=fx.z;
  vec3 hue=color;
  float body=0.0,core=0.0,halo=0.0;
  if(type<0.5){
    // Soft mote — hotter pin, kit mid bloom, cooler outer (fine grit vs bright chip)
    float d=length(p);
    float n=noise(p*3.4+vec2(t*2.6,0.55));
    float tipBias=pow(clamp(1.0-d*0.92,0.0,1.0),1.55);
    halo=exp(-d*d*(1.22+n*.28))*.52;
    body=exp(-d*d*(6.2+n*1.15))*mix(0.88,1.08,tipBias);
    core=exp(-d*d*(44.0+n*7.0))*tipBias;
    // Life-ish cool bias via age in fx.y (t): late motes lean smoke, early stay hot.
    float coolBand=smoothstep(0.58,0.92,t);
    hue=mix(hue*0.58,hue,clamp(body*1.4,0.0,1.0));
    hue=mix(hue,hue*0.72,coolBand*0.55);
    hue=mix(hue,vec3(1.0,0.988,0.945),clamp(core*1.22,0.0,1.0)*(1.0-coolBand*0.35));
  }else if(type<1.5){
    // Soft streak spark — longer tip-forward falloff (motion chip, not a hard needle)
    vec2 q=p*vec2(0.34,1.78); float d=length(q);
    float tip=pow(clamp(1.0-abs(p.y)*1.12,0.0,1.0),1.38)*smoothstep(1.08,-0.62,p.x);
    float tail=smoothstep(-1.12,-0.08,p.x);
    float tipCore=pow(tip,1.55)*smoothstep(0.35,-0.75,p.x);
    halo=exp(-d*d*0.88)*tip*.42*tail;
    body=exp(-d*d*(7.2+tip*2.2))*tip;
    core=exp(-d*d*38.0)*tipCore;
    hue=mix(hue*0.66,hue,body);
    hue=mix(hue,vec3(1.0,0.992,0.96),core);
  }else if(type<2.5){
    // Soft smoke puff — wide low-energy bloom (stays behind sparks)
    float d=length(p*vec2(0.82,1.08)); float n=noise(p*1.55+vec2(t*.85,t*.55));
    halo=exp(-d*d*(0.75+n*.4))*.62; body=exp(-d*d*(1.85+n*.55))*.72; core=exp(-d*d*7.0)*.18;
    hue=mix(hue*0.42,hue*0.85,body);
  }else if(type<3.5){
    // Hot core pin — tight white point for impact readability
    float d=length(p);
    halo=exp(-d*d*3.4)*.28; body=exp(-d*d*12.0); core=exp(-d*d*64.0);
    hue=mix(hue,vec3(1.0,0.995,0.97),0.55+core*0.45);
  }else if(type<4.5){
    // Plasma mote — soft additive sparkle without hard rings
    float d=length(p); float n=noise(p*3.6+vec2(t*4.0,t*2.4));
    halo=exp(-d*d*1.2)*.55+smoothstep(0.62,0.98,n)*exp(-d*d*2.8)*.18;
    body=exp(-d*d*5.2)+exp(-abs(d-(0.28+n*0.1))*16.0)*.28;
    core=exp(-d*d*32.0);
    hue=mix(vec3(0.45,0.9,1.0),color,clamp(body+core*0.8,0.0,1.0));
    hue=mix(hue,vec3(0.95,1.0,1.0),core*0.75);
  }else if(type<5.5){
    // Bomb soft orb
    float d=length(p); halo=exp(-d*d*2.2)*.5; body=exp(-d*d*10.0); core=exp(-d*d*160.0);
  }else if(type<6.5){
    // Soft shock puff (annular falloff — not a stroked ring glyph)
    float d=abs(length(p)-(.18+t*.58));
    core=exp(-d*240.0)*.75; body=exp(-d*70.0)*.55; halo=exp(-d*12.0)*.22;
  }else if(type<7.5){
    // Soft elongated spark (bomb spray) — tip-weighted
    float d=length(p*vec2(.72,5.6)); float tip=smoothstep(1.0,-0.4,p.x);
    core=exp(-d*d*56.0)*tip; body=exp(-d*d*11.0)*tip; halo=exp(-d*d*1.45)*tip*.14;
    hue=mix(hue,vec3(1.0,0.98,0.94),core);
  }else if(type<8.5){
    float angle=atan(p.y,p.x),r=length(p);
    float warp=(noise(vec2(angle*8.0,t*7.0))-.5)*.032; float d=abs(r-.68-warp);
    core=exp(-d*320.0)*.85; body=exp(-d*78.0); halo=exp(-d*16.0)*.38;
    body+=exp(-abs(r-.61-warp)*150.0)*.3; halo+=exp(-r*r*1.8)*.08;
  }else if(type<9.5){
    float r=length(p); body=exp(-abs(r-.60)*90.0)*.7+exp(-r*r*18.0)*.35;
    core=exp(-r*r*80.0)*.7; halo=exp(-abs(r-.60)*18.0)*.18;
  }else if(type<10.5){
    float warp=sin(p.x*24.0-t*24.0)*.018; float d=abs(p.y-warp);
    float taper=1.0-smoothstep(.85,1.0,abs(p.x));
    core=exp(-d*d*780.0)*taper; body=exp(-d*d*95.0)*taper; halo=exp(-d*d*14.0)*taper*.18;
  }else if(type<11.5){
    float r=length(p),a=atan(p.y,p.x)+t*.7; float n=noise(vec2(a*1.8,r*5.0+t*2.0));
    float rings=min(abs(r-.62),abs(r-.44));
    core=exp(-rings*180.0)*.45+exp(-r*r*22.0)*.55;
    body=exp(-rings*70.0)+exp(-abs(r-(.50+n*.08))*40.0)*.4;
    halo=exp(-r*r*1.6)*.28+exp(-rings*16.0)*.2;
  }else if(type<12.5){
    float d=length(p*vec2(1.1,1.35));
    halo=exp(-d*d*1.4)*.45; body=exp(-d*d*6.0); core=exp(-d*d*28.0);
  }else if(type<13.5){
    float n=noise(p*vec2(6.0,3.0)+vec2(t*8.0,0.0));
    float warp=sin(p.x*8.0-t*18.0)*.035+(n-.5)*.06; float d=abs(p.y-warp);
    float taper=1.0-smoothstep(.88,1.0,abs(p.x));
    core=exp(-d*d*420.0)*taper; body=exp(-d*d*55.0)*taper; halo=exp(-d*d*8.0)*taper*.45;
  }else if(type<14.5){
    // Emily: continuous laser core that scales with P; motes animate above it.
    float env=smoothstep(-1.0,-.82,p.x)*(1.0-smoothstep(.82,1.0,p.x));
    float warp=sin(p.x*22.0-t*26.0)*.015;
    float d=abs(p.y-warp);
    halo=exp(-d*d*3.0)*env*.36;
    body=exp(-d*d*26.0)*env;
    core=exp(-d*d*260.0)*env;
    body+=exp(-pow((abs(p.y)-.38-.02*sin(p.x*24.0+t*19.0))*24.0,2.0))*env*.22;
  }else{
    float d=length(p); halo=exp(-d*d*1.5)*.5; body=exp(-d*d*5.0); core=exp(-d*d*24.0);
  }
  float edge=(1.0-smoothstep(.9,1.0,abs(p.x)))*(1.0-smoothstep(.9,1.0,abs(p.y)));
  // Additive soft sprite: bright core rides over kit body; alpha stays soft (screen blend)
  vec3 rgb=hue*(halo*0.5+body*1.2)+vec3(1.0,0.992,0.96)*core*1.85;
  float alpha=clamp(halo*0.38+body*0.92+core*1.25,0.0,1.0)*fade*edge;
  gl_FragColor=vec4(rgb,alpha);
}`;

function kitOf(style) {
  return KIT[style] || { hue: '#ffe08a', core: '#fffef8', smoke: '#ffb060', dens: 1, stretch: 1.2 };
}

function holdStyleOf(player) {
  const key = player?.charKey || '';
  return HOLD_STYLE[key] || player?.meta?.shot?.style || '';
}

/** Per-hold identity emit biases (particle language only — no geometry). */
function holdIdentity(style) {
  switch (style) {
    case 'sunbird':
      // Phoenix wing-fan — rising lateral sheet (Hirume HOLD).
      return { kind: 'fan', side: 2.42, streak: 0.12, smoke: 0.66, rise: 64, drag: 0.64 };
    case 'flameward':
      // Napalm bloom — falling ember volume (≠ phoenix wing sheet)
      return { kind: 'arty', side: 1.48, streak: 0.1, smoke: 0.82, rise: -38, drag: 0.72 };
    case 'sightbeam':
      // Gold overwatch lance — tight needle (≠ HMG spray)
      return { kind: 'lance', side: 0.14, streak: 0.96, smoke: 0.02, rise: 0, drag: 1.42 };
    case 'dragonaxe':
      // Heavy tumble chips — narrower than fan, chunkier than crescent
      return { kind: 'axe', side: 1.34, streak: 0.48, smoke: 0.30, rise: 3, drag: 0.50 };
    case 'shell':
      // Falling ash bloom (≠ HMG side grit)
      return { kind: 'arty', side: 1.12, streak: 0.14, smoke: 0.74, rise: -44, drag: 0.86 };
    case 'jupiterorb':
      // Puffy volume, low streak (≠ crescent lateral sheet)
      return { kind: 'cloud', side: 2.55, streak: 0.26, smoke: 0.14, rise: 12, drag: 0.62 };
    case 'coffinround':
      // HMG volley — short tracers + grit (≠ lance, ≠ arty ash)
      return { kind: 'hmg', side: 0.54, streak: 0.88, smoke: 0.03, rise: 0, drag: 1.16 };
    case 'coffinwall':
      // P1 Coffin for Two — parked plate (existing cloud kind, not HMG grit)
      return { kind: 'cloud', side: 1.62, streak: 0.14, smoke: 0.38, rise: 8, drag: 0.72 };
    case 'plasmaslash':
      // Thin lateral sheet — almost no rise/smoke vs fan
      return { kind: 'crescent', side: 2.82, streak: 0.84, smoke: 0.02, rise: 0, drag: 0.94 };
    case 'railbolt':
      // Railspike — ultra-tight fast needles (≠ railbeam body)
      return { kind: 'spike', side: 0.1, streak: 0.98, smoke: 0.01, rise: 0, drag: 1.55 };
    default:
      return { kind: 'default', side: 1, streak: 0.45, smoke: 0.16, rise: 0, drag: 1 };
  }
}

export class ProjectileVfx {
  constructor(canvas) {
    this.canvas = canvas;
    this.active = false;
    this.disposed = false;
    this.particles = [];
    this._gpuEmpty = true;
    this.colors = new Map();
    this.clock = 0;
    this.lastTime = 0;
    this._emitAcc = 0;
    const caps = vfxCaps();
    this.limit = caps.limit;
    this.transientLimit = caps.transient;
    try {
      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: prefersLightFx() ? 'low-power' : 'high-performance',
      });
      this.renderer.setClearColor(0, 0);
      this.renderer.setPixelRatio(Math.min(
        devicePixelRatio || 1,
        prefersLowEndGfx() ? 1 : prefersLightFx() ? 1.25 : 2,
      ));
      this.renderer.domElement.className = 'projectile-vfx';
      Object.assign(this.renderer.domElement.style, {
        position: 'absolute', inset: '0', width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: '1', mixBlendMode: 'screen',
      });
      this.renderer.domElement.setAttribute('aria-hidden', 'true');
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(0, W, 0, H, -1, 1);
      const plane = new THREE.PlaneGeometry(1, 1);
      this.geometry = new THREE.InstancedBufferGeometry();
      this.geometry.index = plane.index.clone();
      this.geometry.setAttribute('position', plane.attributes.position.clone());
      this.geometry.setAttribute('uv', plane.attributes.uv.clone());
      plane.dispose();
      this.placement = new THREE.InstancedBufferAttribute(new Float32Array(this.limit * 4), 4).setUsage(THREE.DynamicDrawUsage);
      this.effect = new THREE.InstancedBufferAttribute(new Float32Array(this.limit * 4), 4).setUsage(THREE.DynamicDrawUsage);
      this.tint = new THREE.InstancedBufferAttribute(new Float32Array(this.limit * 3), 3).setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute('placement', this.placement);
      this.geometry.setAttribute('effect', this.effect);
      this.geometry.setAttribute('tint', this.tint);
      this.material = new THREE.ShaderMaterial({
        vertexShader, fragmentShader, side: THREE.DoubleSide,
        transparent: true, depthTest: false, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.mesh = new THREE.Mesh(this.geometry, this.material);
      this.mesh.frustumCulled = false;
      this.scene.add(this.mesh);
      this.geometry.instanceCount = 0;
      this.renderer.debug.onShaderError = () => { this.failed = true; };
      this.resize();
      this.put(480, 270, 0, 40, 40, 0, 0, 1, '#ffd56a');
      this.geometry.instanceCount = 1;
      this.renderer.render(this.scene, this.camera);
      this.geometry.instanceCount = 0;
      if (this.failed) throw new Error('Projectile shader compilation failed');
      this.renderer.clear();
      this.onLost = (e) => {
        e.preventDefault();
        this.active = false;
        this.renderer.domElement.style.display = 'none';
      };
      this.onRestored = () => {
        if (!this.disposed) {
          this.active = true;
          this.renderer.domElement.style.display = '';
        }
      };
      this.renderer.domElement.addEventListener('webglcontextlost', this.onLost);
      this.renderer.domElement.addEventListener('webglcontextrestored', this.onRestored);
      canvas.parentElement.appendChild(this.renderer.domElement);
      this.active = true;
    } catch (error) {
      console.warn('[projectile-vfx] Canvas fallback:', error);
      this.dispose();
    }
  }

  resize() {
    if (!this.renderer) return;
    this.renderer.setPixelRatio(Math.min(
      devicePixelRatio || 1,
      prefersLowEndGfx() ? 1 : prefersLightFx() ? 1.25 : 2,
    ));
    const r = this.canvas.getBoundingClientRect();
    this.renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
  }

  put(x, y, angle, w, h, type, age, opacity, color) {
    const i = this.count || 0;
    if (i >= this.limit) return;
    this.placement.setXYZW(i, x, y, angle, w);
    this.effect.setXYZW(i, type, age, opacity, h);
    let c = this.colors.get(color);
    if (!c) {
      c = new THREE.Color(color || '#ffffff');
      this.colors.set(color, c);
    }
    this.tint.setXYZ(i, c.r, c.g, c.b);
    this.count = i + 1;
  }

  _add(p) {
    if (this.particles.length >= this.transientLimit) {
      this.particles[0] = this.particles[this.particles.length - 1];
      this.particles.pop();
    }
    this.particles.push(p);
  }

  /** Spawn soft motes with life/velocity — the only burst language. */
  _spray(x, y, color, angle = 0, {
    n = 6, speed = 90, life = 0.22, size = 10, type = 0, cone = 0.9, drag = 5.8,
    smoke = 0, core = '#fffef8', cool = '',
  } = {}) {
    const light = prefersLightFx();
    const load = this.particles.length / this.transientLimit;
    let count = Math.max(2, Math.round(n * (light ? 0.45 : 1) * (load > 0.85 ? 0.35 : load > 0.6 ? 0.6 : 1)));
    const hot = core || '#fffef8';
    const mid = color;
    const cold = cool || color;
    // Soft flash core — brief pin, not a fat circle
    this._add({
      x, y, vx: 0, vy: 0, size: size * (0.85 + Math.random() * 0.35), type: 3, age: 0,
      life: light ? 0.07 : 0.1, color: hot, angle: 0, drag: 0,
      rampHot: hot, rampCool: mid,
    });
    this._add({
      x, y, vx: 0, vy: 0, size: size * (1.4 + Math.random() * 0.7), type: type === 4 ? 4 : 0, age: 0,
      life: light ? 0.09 : 0.14, color: mid, angle: 0, drag: 0,
      rampHot: hot, rampCool: cold,
    });
    for (let i = 0; i < count; i++) {
      // Prefer streak sparks for impact readability; keep some soft motes for grit.
      const a = angle + (i - (count - 1) * 0.5) * (cone / Math.max(1, count - 1))
        + (Math.random() - 0.5) * 0.45;
      const sp = speed * (0.35 + Math.random() * 1.05);
      const streak = Math.random() < 0.62;
      // Fine grit vs brighter chip — same emit budget / count, size language only.
      const fine = streak && Math.random() < 0.58;
      const szMul = streak
        ? (fine ? (0.12 + Math.random() * 0.38) : (0.32 + Math.random() * 0.58))
        : (0.28 + Math.random() * 0.7);
      this._add({
        x: x + (Math.random() - 0.5) * 5,
        y: y + (Math.random() - 0.5) * 5,
        vx: Math.cos(a) * sp * (fine ? 1.12 : 1),
        vy: Math.sin(a) * sp * (fine ? 1.12 : 1),
        size: size * szMul,
        type: streak ? 1 : type,
        age: 0,
        life: life * (fine ? (0.38 + Math.random() * 0.55) : (0.45 + Math.random() * 0.75)),
        color: fine ? hot : (i % 4 === 0 ? hot : mid),
        angle: a,
        drag: streak ? drag * (fine ? 1.28 : 1.15) : drag,
        rampHot: hot,
        rampCool: cold,
      });
    }
    if (smoke > 0 && !light && load < 0.75) {
      for (let i = 0; i < smoke; i++) {
        const a = angle + Math.PI + (Math.random() - 0.5) * 1.2;
        const sp = 14 + Math.random() * 32;
        this._add({
          x, y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10,
          size: size * (0.7 + Math.random() * 1.1),
          type: 2, age: 0,
          life: 0.26 + Math.random() * 0.24,
          color: cold, angle: a, drag: 2.4,
          rampHot: mid, rampCool: cold,
        });
      }
    }
  }

  burst(x, y, color, angle = 0, strong = false, impact = false, style = '') {
    const kit = kitOf(style);
    const plasma = isPlasmaStyle(style);
    const id = holdIdentity(style);
    // Hold identities: fan=wide ember cone, lance/spike=tight needle, axe=heavy chips, etc.
    let cone = impact ? Math.PI * 2 : 1.15;
    let smoke = impact ? (strong ? 3 : 2) : (strong ? 1 : 0);
    let n = strong ? (impact ? 16 : 11) : (impact ? 11 : 6);
    let speed = impact ? 210 : 120;
    let size = impact ? (strong ? 18 : 14) : (strong ? 12 : 9);
    let type = plasma ? 4 : 0;
    // Hirume's small flame used to disappear into enemy sprites on contact.
    if (impact && style === 'foxflame') {
      n += 3;
      size *= 1.3;
    }
    if (!impact) {
      if (id.kind === 'fan') { cone = 2.38; smoke = strong ? 7 : 5; n += 2; speed *= 0.76; size *= 1.18; }
      else if (id.kind === 'lance') { cone = 0.22; smoke = 0; n = Math.max(3, n - 2); speed *= 1.35; size *= 0.72; }
      else if (id.kind === 'spike') { cone = 0.14; smoke = 0; n = Math.max(2, n - 3); speed *= 1.52; size *= 0.62; }
      else if (id.kind === 'axe') { cone = 1.38; smoke = strong ? 2 : 1; size *= 1.48; speed *= 0.70; n += 1; }
      else if (id.kind === 'arty') { cone = 1.28; smoke = strong ? 7 : 5; speed *= 0.52; size *= 1.16; }
      else if (id.kind === 'cloud') { cone = Math.PI * 1.85; smoke = 0; n += 5; type = 4; size *= 1.18; }
      else if (id.kind === 'hmg') { cone = 0.56; smoke = 0; n += 6; speed *= 1.18; size *= 0.76; }
      else if (id.kind === 'crescent') { cone = 2.62; smoke = 0; n += 2; speed *= 1.14; size *= 0.84; }
    }
    this._spray(x, y, color || kit.hue, angle, {
      n, speed,
      life: impact ? 0.24 : 0.16,
      size,
      type,
      cone,
      smoke,
      core: kit.core,
      cool: kit.smoke,
      // Stronger damping → sparks die as streaks, not floating soft circles
      drag: (impact ? 7.2 : 5.6) * id.drag,
    });
  }

  /**
   * Labiata X slam (user: a real explosion, not drawn shapes): a GPU particle eruption -
   * white-hot flash, flattened shock rings along the ground, a billowing plasma plume, a
   * spark fountain shooting up with gravity, ground spray, side geysers and rising motes.
   * power < 1 = the follow-up pulse (column + motes only).
   */
  slam(x, y, power = 1) {
    if (!this.active) return;
    const m = (prefersLightFx() ? 0.45 : 1) * power;
    const R = (a, b) => a + Math.random() * (b - a);
    const add = (o) => this._add({ age: 0, angle: 0, drag: 2, vx: 0, vy: 0, ...o });
    const HOT = '#ffffff';
    const MID = '#8fe0ff';
    const COOL = '#2f6dff';
    const n = (k) => Math.max(1, Math.round(k * m));
    // Flash.
    add({ x, y, size: 560 * power, type: 5, life: 0.24, color: '#c8f2ff', rampHot: HOT, rampCool: MID, drag: 0 });
    add({ x, y, size: 320 * power, type: 3, life: 0.16, color: HOT, drag: 0 });
    // Central geyser: long hot streaks shooting straight up, overlapping into one column,
    // with a few big glows swelling at its foot.
    for (let i = 0; i < n(44); i++) {
      add({ x: x + R(-22, 22), y: y + R(-10, 0), vx: R(-30, 30), vy: -R(1300, 2300), size: R(70, 140), type: 1,
        life: R(0.3, 0.5), color: MID, rampHot: HOT, rampCool: COOL, drag: 2.6, delay: i * 0.006 });
    }
    for (let i = 0; i < n(5); i++) {
      add({ x: x + R(-30, 30), y: y - R(0, 40), vx: R(-20, 20), vy: -R(150, 420), size: R(90, 140), type: 0,
        life: R(0.4, 0.7), color: MID, rampHot: HOT, rampCool: COOL, drag: 1.5, delay: i * 0.03 });
    }
    // Rising plasma motes.
    for (let i = 0; i < n(50); i++) {
      add({ x: x + R(-280, 280), y: y + R(-10, 10), vx: R(-30, 30), vy: R(-280, -80), size: R(14, 34),
        type: 4, life: R(0.8, 1.5), color: '#7fe7ff', rampHot: HOT, rampCool: COOL, drag: 0.6, delay: R(0, 0.3) });
    }
    if (power < 1) return;
    // Shock rings racing along the floor (flattened).
    [[0, 1150, 0.5], [0.08, 820, 0.45]].forEach(([delay, size, life]) => add({
      x, y, size, hMul: 0.3, type: 6, life, delay, color: MID, rampHot: HOT, rampCool: MID, drag: 0, grow: 0 }));
    // Spark fountain: streaks up with gravity, falling back as they cool.
    for (let i = 0; i < n(110); i++) {
      const a = -Math.PI / 2 + R(-0.5, 0.5);
      const sp = R(500, 1500);
      add({ x: x + R(-30, 30), y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(10, 26), type: 1,
        life: R(0.5, 1.1), color: '#9fe6ff', rampHot: HOT, rampCool: COOL, drag: 1.6, grav: 1100 });
    }
    // Ground spray, low and wide both ways.
    for (let i = 0; i < n(70); i++) {
      const right = i % 2 === 0;
      const a = right ? R(-0.35, 0.02) : Math.PI + R(-0.02, 0.35);
      const sp = R(600, 1300);
      add({ x, y: y + R(-6, 6), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(8, 20), type: 1,
        life: R(0.35, 0.7), color: MID, rampHot: HOT, rampCool: COOL, drag: 2.8, grav: 600 });
    }
    // Billowing plume: plasma smoke rolling up and out.
    for (let i = 0; i < n(40); i++) {
      const a = R(-Math.PI, 0);
      const sp = R(80, 360);
      add({ x: x + R(-80, 80), y: y + R(-20, 10), vx: Math.cos(a) * sp * 1.5, vy: Math.sin(a) * sp - R(120, 300),
        // Additive: a dimmer blue keeps the cloud's volume readable instead of a white blob.
        size: R(110, 220), type: 2, life: R(0.9, 1.6), color: '#2f78d8', rampHot: '#7fc8ff', rampCool: '#173c9a',
        drag: 1.7, grow: 1.8, delay: R(0, 0.12) });
    }
    // Side geysers bursting out of the fissure, going outward.
    for (const side of [-1, 1]) {
      for (let i = 1; i <= 3; i++) {
        const gx = x + side * i * 190;
        for (let j = 0; j < n(10); j++) {
          add({ x: gx + R(-10, 10), y, vx: R(-15, 15), vy: -R(500, 1000) / (1 + i * 0.2), size: R(36, 70),
            type: 0, life: R(0.3, 0.5), color: MID, rampHot: HOT, rampCool: COOL, drag: 2.4,
            delay: 0.06 + i * 0.07 + j * 0.01 });
        }
      }
    }
  }

  impact(b) {
    // LRL uses its dedicated cut/contact sheet, including thrown-axe hits.
    if (b.nativeKey === 'lrl' || b.nativeKey === 'lrl-axe') return;
    if (!this.active) return;
    const load = this.particles.length / this.transientLimit;
    if (load > 0.9 && !b.special && !b.pierce) return;
    if (load > 0.75 && !b.special && Math.random() > 0.4) return;
    this.burst(b.x, b.y, b.color, Math.atan2(b.vy, b.vx), b.pierce || b.special, true, b.style);
  }

  /** Continuous trail emitters along each shot path. */
  _emitTrail(b, angle, dt, light) {
    const kit = kitOf(b.style);
    const load = this.particles.length / this.transientLimit;
    if (load > 0.92) return;
    const plasma = isPlasmaStyle(b.style);
    const beam = isBeamStyle(b);
    const id = holdIdentity(b.style);
    const ward = b.style === 'coffinwall' || b.style === 'coffinshield';
    // Thunder cloud: skip linear bolt trail (was reading as a seeking missile wake).
    // Volume comes from the cloud emitter below — dens/side/emit budgets untouched.
    const stormCloud = b.style === 'jupiterorb';
    // EMP pulse field: skip linear bolt trail (was reading as a cyan seeking-orb wake).
    // Volume comes from the cloud emitter below — dens/side/emit budgets untouched.
    const empPulse = b.style === 'empfield';
    // Phoenix fan: skip linear bolt trail (was reading as a seeker-dart wake).
    // Volume comes from the ember cloud emitter below — dens/side/emit budgets untouched.
    const phoenixFan = b.style === 'sunbird';
    // Artillery breech shell: skip linear bolt trail (was reading as a horizontal laser bolt).
    // Volume comes from the arty ash drip below — dens/side/emit budgets untouched.
    const breechShell = b.style === 'shell';
    // Xenox split core: skip linear bolt trail (was reading as a cyan seeking-orb wake).
    // Volume comes from the fragment cloud emitter below — dens/side/emit budgets untouched.
    const xenoxSplit = b.style === 'xenoxcore';
    // RIP coffin missile: skip linear bolt trail (was reading as a violet seeking-bolt wake).
    // Volume comes from the casket cloud emitter below — dens/side/emit budgets untouched.
    const coffinCasket = b.style === 'coffinmissile';
    // Winchester lock round: skip linear bolt trail (was reading as a gold seeking-bolt wake).
    // Volume comes from the lock-collar cloud emitter below — dens/side/emit budgets untouched.
    const lockSlug = b.style === 'lockround';
    // Fragarach command marker: skip linear bolt trail (was reading as a parked orange bolt wake).
    // Volume comes from the marker-ring cloud emitter below — dens/side/emit budgets untouched.
    const commandMarker = b.style === 'commandmissile';
    // Trollsberd cross-cut: skip linear bolt trail (was reading as a magenta flying-bolt / laser wake).
    // Volume comes from the diagonal-lobe cloud emitter below — dens/side/emit budgets untouched.
    const crossCut = b.style === 'plasmacross';
    // Yatagarasu purification seal: skip linear bolt trail (was reading as a parked fire-orb / seeker wake).
    // Volume comes from the seal-ring cloud emitter below — dens/side/emit budgets untouched.
    const sunSeal = b.style === 'sunseal';
    const chargeBoost = b.charge ? 1.12 : 1;
    const dens = kit.dens * (b.special ? 1.35 : b.pierce ? 1.15 : 1) * (beam ? 1.35 : 1) * chargeBoost;
    // Stationary RIP ward: skip linear bolt trail (was reading as a parked laser).
    // Volume comes from the cloud emitter below — dens/side/emit budgets untouched.
    if (!ward && !stormCloud && !empPulse && !phoenixFan && !breechShell && !xenoxSplit && !coffinCasket && !lockSlug && !commandMarker && !crossCut && !sunSeal) {
      // Denser along-trail emission: more small chips, fewer fat blobs.
      b._trailAcc = (b._trailAcc || 0) + dt * dens * (light ? 34 : 72);
      let n = 0;
      const maxN = light ? 3 : (id.kind === 'spike' ? 3 : id.kind === 'hmg' ? 5 : id.kind === 'lance' ? 4 : 6);
      while (b._trailAcc >= 1 && n < maxN) {
        b._trailAcc -= 1;
        n += 1;
        // Bias density toward the bullet (near tip) with a thinner tail ribbon.
        const along = Math.random();
        const tipBias = along * along; // denser near head
        // Crescent uses short along-path + wide side (blade sheet) — ≠ long laser shaft.
        const teslaBolt = b.style === 'lightning';
        const slashWave = b.style === 'cleave';
        const winchNeedle = b.style === 'tracer';
        // Tracer ballistic needle — short brass wake (≠ long gold laser shaft). dens/emit untouched.
        const backLen = id.kind === 'spike' ? 48
          : (id.kind === 'lance' ? 36
            : (beam ? 28
              : (id.kind === 'hmg' ? 7
                : (id.kind === 'axe' ? 14 : id.kind === 'arty' ? 12 : id.kind === 'fan' ? 9 : id.kind === 'crescent' ? 11
                  : (teslaBolt ? 11 : slashWave ? 12 : winchNeedle ? 9 : 18)))));
        const back = 3 + tipBias * backLen + Math.random() * 4;
        const sideBase = (plasma ? 9 : 5) * id.side;
        const side = (Math.random() - 0.5) * sideBase * (0.35 + tipBias) * (b.special ? 1.35 : 1)
          * (id.kind === 'crescent' ? 1.35 : slashWave ? 1.28 : winchNeedle ? 0.72 : 1);
        const ox = b.x - Math.cos(angle) * back - Math.sin(angle) * side;
        const oy = b.y - Math.sin(angle) * back + Math.cos(angle) * side;
        const drift = 10 + Math.random() * (id.kind === 'hmg' ? 28 : 34);
        const smokeChance = plasma ? 0.1 : id.smoke;
        const isSmoke = !light && tipBias > 0.5 && Math.random() < smokeChance;
        // Lightning biases to fork streaks (≠ soft cyan seeker-disk trail). dens/emit untouched.
        // Cleave biases to wide wave-edge streaks (≠ solid rose laser wake). dens/emit untouched.
        const isStreak = !isSmoke && Math.random() < (id.streak + (1 - tipBias) * 0.2 + (teslaBolt ? 0.28 : 0) + (slashWave ? 0.22 : 0));
        // Heavy axe chips vs needle grit vs ember motes
        let sizeVar = isSmoke
          ? (8 + Math.random() * 12)
          : (isStreak
            ? (3.5 + Math.random() * 10)
            : (2.5 + Math.random() * 7));
        if (id.kind === 'axe' && !isSmoke) sizeVar *= 1.68;
        if (id.kind === 'lance') sizeVar *= isStreak ? 0.68 : 0.52;
        if (id.kind === 'hmg') sizeVar *= isStreak ? 0.82 : 0.64;
        if (id.kind === 'spike') sizeVar *= isStreak ? 0.65 : 0.42;
        if (id.kind === 'fan' && !isStreak) sizeVar *= 1.52;
        if (b.style === 'foxflame' && !isStreak) sizeVar *= 0.85;
        if (id.kind === 'crescent') sizeVar *= isStreak ? 1.16 : 0.72;
        if (id.kind === 'arty' && isSmoke) sizeVar *= 1.38;
        if (id.kind === 'cloud' && !isStreak) sizeVar *= 1.32;
        if (teslaBolt && isStreak) sizeVar *= 0.78;
        if (slashWave && !isSmoke) sizeVar *= isStreak ? 1.22 : 0.88;
        if (winchNeedle) sizeVar *= isStreak ? 0.72 : 0.55;
        const rise = id.rise;
        // Crescent streaks lean perpendicular to flight (blade edge), not laser-aligned.
        const crescentAng = id.kind === 'crescent'
          ? angle + (Math.random() < 0.5 ? 1 : -1) * (1.05 + Math.random() * 0.35)
          : 0;
        // Axe streaks tumble across flight (cleave chips), not seeker-wake aligned.
        const axeAng = id.kind === 'axe'
          ? angle + (Math.random() < 0.5 ? 1 : -1) * (0.85 + Math.random() * 0.55)
          : 0;
        // Slash-wave edge — tall crest angle (≠ axe tumble, ≠ solid rose laser ribbon).
        const waveAng = slashWave
          ? angle + (Math.random() < 0.5 ? 1 : -1) * (1.15 + Math.random() * 0.40)
          : 0;
        // Lightning fork angle — jagged lateral spark (≠ solid seeker-wake ribbon).
        const boltAng = teslaBolt
          ? angle + (Math.random() < 0.5 ? 1 : -1) * (0.55 + Math.random() * 0.65)
          : 0;
        this._add({
          x: ox, y: oy,
          vx: -Math.cos(angle) * drift + (Math.random() - 0.5) * (id.kind === 'hmg' ? 38 : id.kind === 'crescent' ? 32 : id.kind === 'axe' ? 30 : slashWave ? 32 : teslaBolt ? 34 : 18),
          vy: -Math.sin(angle) * drift + (Math.random() - 0.5) * (id.kind === 'hmg' ? 38 : id.kind === 'crescent' ? 32 : id.kind === 'axe' ? 30 : slashWave ? 32 : teslaBolt ? 34 : 18) - rise,
          size: sizeVar * (b.special ? 1.2 : 1) * (kit.stretch > 1.4 && isStreak && id.kind !== 'crescent' && id.kind !== 'axe' && !teslaBolt && !slashWave && !winchNeedle ? 1.12 : 1),
          type: isSmoke ? 2 : (plasma ? (isStreak ? 1 : 4) : (isStreak ? 1 : 0)),
          age: 0,
          life: isSmoke ? 0.28 + Math.random() * 0.2
            : (id.kind === 'hmg' ? 0.04 + Math.random() * (0.05 + tipBias * 0.04)
              : (id.kind === 'arty' ? 0.14 + Math.random() * (0.16 + tipBias * 0.08)
                : 0.08 + Math.random() * (0.1 + tipBias * 0.08))),
          // Axe spark cadence: cream tip → rose cool (≠ solid seeker-chip tint).
          // Cleave wave cadence: cream tip → rose cool (≠ solid rose laser-bolt tint).
          // HMG tracer cadence: cream tip → violet cool (≠ solid laser-bolt tint).
          // Lightning spark cadence: white tip → cyan cool (≠ solid cyan seeker tint).
          // Winchester ballistic cadence: cream tip → brass cool (≠ solid gold laser tint).
          color: isSmoke ? kit.smoke
            : (id.kind === 'axe' || slashWave
              ? (Math.random() < 0.55 ? '#fff0f4' : (Math.random() < 0.5 ? kit.core : (b.color || kit.hue)))
              : (id.kind === 'hmg'
                ? (Math.random() < 0.5 ? '#fff8f0' : (Math.random() < 0.5 ? kit.core : (b.color || kit.hue)))
                : (teslaBolt
                  ? (Math.random() < 0.55 ? '#ffffff' : (Math.random() < 0.5 ? kit.core : (b.color || kit.hue)))
                  : (winchNeedle
                    ? (Math.random() < 0.55 ? '#fff8e8' : (Math.random() < 0.5 ? kit.core : (b.color || kit.hue)))
                    : (Math.random() < 0.4 ? kit.core : (b.color || kit.hue)))))),
          angle: isStreak ? (id.kind === 'crescent' ? crescentAng
            : (id.kind === 'axe' ? axeAng
              : (slashWave ? waveAng
                : (teslaBolt ? boltAng
                  : angle + (Math.random() - 0.5) * (
                    id.kind === 'fan' ? 0.42
                      : id.kind === 'hmg' ? 0.48
                        : id.kind === 'lance' ? 0.08
                          : id.kind === 'spike' ? 0.05
                            : winchNeedle ? 0.10 : 0.2
                  )))))
            : Math.random() * Math.PI * 2,
          drag: (isSmoke ? 2.1 : (isStreak ? 6.4 : 5.2)) * id.drag,
          rampHot: kit.core,
          rampCool: kit.smoke,
        });
      }
    }
    // Stationary / ward plasma clouds — particle volume, not a gear / hard seal mark.
    // sunbird joins flameward so phoenix hold fans read as ember volume.
    // coffinwall joins coffinshield so eternity HOLD reads as a clear-zone, not a bolt.
    const cloud = b.style === 'jupiterorb' || b.style === 'teslacoil' || b.style === 'empfield'
      || b.style === 'flameward' || b.style === 'sunbird' || b.style === 'sunseal'
      || b.style === 'coffinwall' || b.style === 'coffinshield' || b.style === 'swordguard'
      || b.style === 'xenoxcore' || b.style === 'coffinmissile' || b.style === 'lockround'
      || b.style === 'commandmissile' || b.style === 'plasmacross';
    if (cloud && load < 0.8) {
      // xenoxcore / coffinmissile / lockround / commandmissile / plasmacross / sunseal use default cloudRate (20/44) — dens/emit untouched.
      const cloudRate = b.style === 'jupiterorb' ? (light ? 32 : 66) : (light ? 20 : 44);
      b._cloudAcc = (b._cloudAcc || 0) + dt * cloudRate;
      while (b._cloudAcc >= 1) {
        b._cloudAcc -= 1;
        const a = Math.random() * Math.PI * 2;
        const seal = b.style === 'sunseal';
        const ember = b.style === 'flameward' || b.style === 'sunbird' || seal;
        const storm = b.style === 'jupiterorb';
        const emp = b.style === 'empfield';
        const xenox = b.style === 'xenoxcore';
        const coffin = b.style === 'coffinmissile';
        const lock = b.style === 'lockround';
        const command = b.style === 'commandmissile';
        const cross = b.style === 'plasmacross';
        // EMP cloud sits on a pulse ring (annulus), not a filled seeker disk.
        // Xenox fragment cloud biases onto lateral split lobes (≠ filled seeker disk).
        // RIP coffin cloud biases onto a tall casket body (≠ filled seeker disk, ≠ ward zone).
        // Winchester lock cloud sits on a brass collar ring (≠ filled seeker disk, ≠ EMP cyan pulse).
        // Command marker cloud sits on a designation ring (≠ filled seeker disk, ≠ flying shell ash).
        // Cross-cut cloud biases onto soft diagonal lobes (≠ filled seeker disk, ≠ crescent tall sheet).
        // Purification seal cloud sits on an ember ring (≠ filled fire-orb disk, ≠ phoenix wing sheet).
        const rad = emp || lock || command || seal
          ? (b.r || 8) * (0.58 + Math.random() * 0.55)
          : xenox || coffin || cross
            ? (b.r || 8) * (0.35 + Math.random() * 0.85)
            : (b.r || 8) * (0.15 + Math.random() * 1.05);
        const phoenix = b.style === 'sunbird';
        const wardCloud = b.style === 'coffinwall' || b.style === 'coffinshield';
        const spark = Math.random() < (storm ? 0.55 : emp ? 0.62 : xenox ? 0.58 : coffin ? 0.56 : lock || command || cross || seal ? 0.54 : phoenix ? 0.5 : 0.4);
        // Soft diagonal lobe offset — X-cut sheet language without hard cross geometry.
        const diagFlip = cross ? (Math.random() < 0.5 ? 1 : -1) : 0;
        const cx = Math.cos(a) * rad * (wardCloud ? 0.5 : storm ? 1.38 : phoenix ? 1.42 : emp || seal ? 1.06 : lock || command ? 1.04 : xenox ? 0.72 : coffin ? 0.58 : cross ? 0.82 : 1)
          + (cross ? Math.sin(a) * rad * 0.55 * diagFlip : 0);
        const cy = Math.sin(a) * rad * (wardCloud ? 1.35 : storm ? 0.78 : phoenix ? 1.22 : emp || seal ? 1.04 : lock || command ? 1.02 : xenox ? 1.38 : coffin ? 1.48 : cross ? 0.82 : 1)
          + (cross ? Math.cos(a) * rad * 0.55 * diagFlip : 0);
        this._add({
          // Ward cloud stretches tall (clear-zone plate), not a round bolt halo.
          // Storm cloud stretches wide (weather field), not a seeker-orb halo.
          // EMP cloud stays near-circular pulse ring (≠ weather oval, ≠ seeker disk).
          // Phoenix cloud stretches wide + tall (wing-fan sheet), not a dart halo.
          // Xenox cloud stretches tall/lateral (split fragment sheet), not a seeker disk.
          // RIP coffin cloud stretches tall casket lid (≠ HMG slug trail, ≠ seeker bolt wake).
          // Winchester lock cloud stays near-circular collar (≠ gold seeker wake, ≠ lance ribbon).
          // Command marker cloud stays near-circular designation ring (≠ parked bolt wake, ≠ shell trail).
          // Cross-cut cloud sits on soft diagonal lobes (≠ magenta bolt wake, ≠ crescent blade sheet).
          // Purification seal cloud stays near-circular ember ring (≠ filled fire orb, ≠ phoenix fan).
          x: b.x + cx,
          y: b.y + cy,
          vx: Math.cos(a) * (6 + Math.random() * (storm ? 38 : emp ? 42 : lock || command || cross || seal ? 34 : xenox ? 36 : coffin ? 32 : phoenix ? 34 : 28)),
          vy: Math.sin(a) * (6 + Math.random() * (storm ? 38 : emp ? 42 : lock || command || cross || seal ? 34 : xenox ? 36 : coffin ? 32 : phoenix ? 34 : 28)) - (ember ? (seal ? 14 : 22) : (storm ? 8 : command ? 10 : 0)),
          size: spark ? (2.5 + Math.random() * (storm ? 7 : emp ? 5.5 : lock || command || cross || seal ? 5.4 : xenox ? 5.8 : coffin ? 6.0 : phoenix ? 6.5 : 6)) : (5 + Math.random() * (emp || lock || command || cross || seal ? 7 : xenox || coffin ? 7.5 : 9)),
          type: ember ? (Math.random() < 0.3 ? 2 : (spark ? 1 : 0)) : (spark ? 1 : (coffin || lock || command || cross ? 0 : 4)),
          age: 0,
          life: 0.12 + Math.random() * (storm ? 0.2 : emp ? 0.14 : lock || command || cross || seal ? 0.14 : xenox ? 0.15 : coffin ? 0.15 : phoenix ? 0.18 : 0.16),
          // Storm spark cadence: white tip → cyan cool (≠ solid seeker-orb tint).
          // EMP spark cadence: white tip → cyan cool (≠ solid seeking-orb tint).
          // Xenox spark cadence: ice tip → rail cyan cool (≠ solid cyan seeker tint).
          // RIP coffin spark cadence: cream tip → violet cool (≠ solid violet seeker tint).
          // Winchester lock spark cadence: cream tip → brass cool (≠ solid gold seeker tint).
          // Command marker spark cadence: cream tip → ash cool (≠ solid orange seeker / parked bolt tint).
          // Cross-cut spark cadence: cream tip → magenta cool (≠ solid magenta bolt / laser tint).
          // Purification seal spark cadence: cream tip → orange cool (≠ solid fire-orb / seeker tint).
          // Phoenix spark cadence: cream tip → orange cool (≠ solid seeker-dart tint).
          color: storm || emp || xenox
            ? (spark ? (Math.random() < 0.55 ? '#ffffff' : kit.core) : (b.color || kit.hue))
            : coffin
              ? (spark ? (Math.random() < 0.55 ? '#fff8f0' : kit.core) : (b.color || kit.hue))
              : lock
                ? (spark ? (Math.random() < 0.55 ? '#fff8e8' : kit.core) : (b.color || kit.hue))
                : command
                  ? (spark ? (Math.random() < 0.55 ? '#fff0d0' : kit.core) : (Math.random() < 0.35 ? kit.smoke : (b.color || kit.hue)))
                  : cross
                    ? (spark ? (Math.random() < 0.55 ? '#fff4fc' : kit.core) : (b.color || kit.hue))
                    : seal
                      ? (spark ? (Math.random() < 0.55 ? '#fff8e0' : kit.core) : (b.color || kit.hue))
                      : phoenix
                        ? (spark ? (Math.random() < 0.55 ? '#fff8e8' : kit.core) : (b.color || kit.hue))
                        : (Math.random() < 0.45 ? kit.core : (b.color || kit.hue)),
          angle: a, drag: spark ? 5.5 : 3.6,
          rampHot: kit.core, rampCool: kit.smoke,
        });
      }
    }
    // Crescent hold — brief lateral sheet sprays so arcs read wider than a bolt.
    if (b.charge && id.kind === 'crescent' && load < 0.75 && !light) {
      b._crescentAcc = (b._crescentAcc || 0) + dt * 34;
      while (b._crescentAcc >= 1) {
        b._crescentAcc -= 1;
        const side = Math.random() < 0.5 ? 1 : -1;
        const a = angle + side * (0.9 + Math.random() * 0.5);
        this._add({
          x: b.x + Math.cos(a) * (4 + Math.random() * 10),
          y: b.y + Math.sin(a) * (4 + Math.random() * 10),
          vx: Math.cos(a) * (40 + Math.random() * 50),
          vy: Math.sin(a) * (40 + Math.random() * 50),
          size: 3 + Math.random() * 8,
          type: Math.random() < 0.55 ? 1 : 0,
          age: 0, life: 0.1 + Math.random() * 0.12,
          color: Math.random() < 0.4 ? kit.core : (b.color || kit.hue),
          angle: a, drag: 5.8,
          rampHot: kit.core, rampCool: kit.smoke,
        });
      }
    }
    // Returning axe — brief tumble blade sprays (≠ seeker orbit, ≠ forward bolt chips).
    // dens/side/trail emit untouched; this is silhouette spray only.
    if (b.charge && id.kind === 'axe' && load < 0.75 && !light) {
      b._axeAcc = (b._axeAcc || 0) + dt * 30;
      while (b._axeAcc >= 1) {
        b._axeAcc -= 1;
        const side = Math.random() < 0.5 ? 1 : -1;
        const a = angle + side * (0.75 + Math.random() * 0.55);
        this._add({
          x: b.x + Math.cos(a) * (3 + Math.random() * 8),
          y: b.y + Math.sin(a) * (3 + Math.random() * 8),
          vx: Math.cos(a) * (35 + Math.random() * 45),
          vy: Math.sin(a) * (35 + Math.random() * 45),
          size: 4 + Math.random() * 9,
          type: Math.random() < 0.5 ? 1 : 0,
          age: 0, life: 0.1 + Math.random() * 0.12,
          color: Math.random() < 0.55 ? '#fff0f4' : (Math.random() < 0.5 ? kit.core : (b.color || kit.hue)),
          angle: a, drag: 5.4,
          rampHot: kit.core, rampCool: kit.smoke,
        });
      }
    }
    // Artillery hold — ash drip under breech shells (cream tip → ash cool cadence).
    // dens/side/emit untouched; silhouette ash only.
    if (b.charge && id.kind === 'arty' && load < 0.8 && !light) {
      b._artyAcc = (b._artyAcc || 0) + dt * 28;
      while (b._artyAcc >= 1) {
        b._artyAcc -= 1;
        this._add({
          x: b.x + (Math.random() - 0.5) * 8,
          y: b.y - 4 - Math.random() * 10,
          vx: (Math.random() - 0.5) * 20,
          vy: -30 - Math.random() * 40,
          size: 4 + Math.random() * 9,
          type: Math.random() < 0.55 ? 2 : 0,
          age: 0, life: 0.2 + Math.random() * 0.18,
          color: Math.random() < 0.45 ? '#fff8e8' : kit.smoke,
          angle: -Math.PI / 2, drag: 2.4,
          rampHot: kit.core, rampCool: kit.smoke,
        });
      }
    }
    // Railspike — sparse velocity-aligned needles (no continuous laser ribbon).
    if (id.kind === 'spike' && load < 0.82 && !light) {
      b._spikeAcc = (b._spikeAcc || 0) + dt * 11;
      while (b._spikeAcc >= 1) {
        b._spikeAcc -= 1;
        const back = 8 + Math.random() * 34;
        this._add({
          x: b.x - Math.cos(angle) * back,
          y: b.y - Math.sin(angle) * back,
          vx: Math.cos(angle) * (90 + Math.random() * 60),
          vy: Math.sin(angle) * (90 + Math.random() * 60),
          size: 1.6 + Math.random() * 4,
          type: 1, age: 0, life: 0.05 + Math.random() * 0.07,
          color: Math.random() < 0.55 ? kit.core : (b.color || kit.hue),
          angle, drag: 7.8,
          rampHot: kit.core, rampCool: kit.smoke,
        });
      }
    }
    // HMG hold — brief lateral brass grit chips (≠ aligned lance needles).
    if (b.charge && id.kind === 'hmg' && load < 0.8 && !light) {
      b._hmgAcc = (b._hmgAcc || 0) + dt * 40;
      while (b._hmgAcc >= 1) {
        b._hmgAcc -= 1;
        const side = Math.random() < 0.5 ? 1 : -1;
        const a = angle + side * (0.35 + Math.random() * 0.45);
        this._add({
          x: b.x + Math.cos(a) * (2 + Math.random() * 6),
          y: b.y + Math.sin(a) * (2 + Math.random() * 6),
          vx: Math.cos(a) * (55 + Math.random() * 70),
          vy: Math.sin(a) * (55 + Math.random() * 70),
          size: 2 + Math.random() * 5,
          type: Math.random() < 0.65 ? 1 : 0,
          age: 0, life: 0.07 + Math.random() * 0.09,
          color: Math.random() < 0.4 ? kit.core : (b.color || kit.hue),
          angle: a, drag: 5.6,
          rampHot: kit.core, rampCool: kit.smoke,
        });
      }
    }
  }

  /** The only continuous basic laser: GPU body plus P-scaled flowing sparks. */
  _renderEmilyLaser(b, angle, len, time, light) {
    const tier = b.r < 4 ? 1 : b.r < 5.5 ? 2 : b.r < 7.5 ? 3 : b.r < 10 ? 4 : 5;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const nx = -dy, ny = dx;
    this.put(b.x - dx * len * .5, b.y - dy * len * .5, angle,
      len, b.r * 4.2, 14, time + b.phase, .94, b.color);
    const count = light ? tier + 1 : 3 + tier * 2;
    for (let i = 0; i < count && this.count < this.limit - 16; i++) {
      const travel = (i / count + time * (1.35 + tier * .17) + b.phase * .12) % 1;
      const back = (1 - travel) * len;
      const outer = i % 3 === 0;
      const side = Math.sin(i * 6.8 + time * 11 + b.phase) * b.r
        * (outer ? 1.3 + tier * .18 : .5 + tier * .1);
      this.put(b.x - dx * back + nx * side, b.y - dy * back + ny * side,
        angle, outer ? 4 + tier * 1.4 : 5 + tier * 2.2,
        outer ? 4 + tier * 1.4 : 2 + tier * .7,
        outer ? 3 : 7, time + i * .13,
        (.4 + .36 * Math.sin(Math.PI * travel)) * (light ? .7 : 1),
        i % 3 === 0 ? '#f0ffff' : b.glow);
    }
  }

  render(bullets, time, player, bombVfx) {
    if (!this.active) return;
    const dt = Math.max(0, Math.min(0.05, time - this.lastTime));
    this.lastTime = time;
    this.clock = time;
    this.count = 0;
    const light = prefersLightFx();
    bombVfx?.drawGpu(this, time);

    for (const b of bullets) {
      if (!b.alive || !b.friendly || b.delay > 0) continue;
      // Native ordinary-shot textures own their silhouette; do not cover them with a GPU orb.
      if (b.nativeKey) continue;
      // These six C skills have their own Canvas silhouettes. The generic GPU
      // head was covering the marker, lightning branches, coffin and cross.
      if (b.special && (b.style === 'cyclopsbeam' || b.style === 'commandmissile'
        || b.style === 'teslacoil' || b.style === 'coffinmissile'
        || b.style === 'plasmacross' || b.style === 'busterbeam')) continue;
      if (!KIT[b.style]) continue;
      // Constantia's classic shot is drawn as a crisp canvas bullet, not a particle cloud.
      if (b.style === 'tracer') continue;
      const angle = Math.atan2(b.vy, b.vx);
      if (b.age < 0.09 && !b._vfxMuzzle) {
        b._vfxMuzzle = true;
        this.burst(b.x, b.y, b.color, angle, b.pierce || b.special, false, b.style);
      }
      this._emitTrail(b, angle, dt, light);

      const kit = kitOf(b.style);
      const id = holdIdentity(b.style);
      // The ward already scales its radius by level; avoid scaling it twice on the GPU path.
      const boost = b.style === 'sunseal' ? 1
        : b.special ? ([1, 1, 1.25, 1.65][b.specialLevel] || 1) : b.pierce ? 1.35 : 1;
      const r = Math.max(b.r, 3) * boost;
      const plasma = isPlasmaStyle(b.style);
      const beam = isBeamStyle(b);
      const fire = b.style === 'foxflame' || b.style === 'sunbird' || b.style === 'flameward';

      // Soft head cluster — hold identities stretch/widen differently (still soft sprites).
      const wardHead = b.style === 'coffinwall' || b.style === 'coffinshield';
      // Crescent blade plate — short forward / tall lateral (≠ kit.stretch laser ribbon).
      const crescentHead = b.style === 'plasmaslash';
      // Thunder cloud volume — wide weather plate (≠ flight-aligned seeker-orb head).
      const cloudHead = b.style === 'jupiterorb';
      // EMP pulse ring — near-circular discharge plate (≠ weather oval, ≠ fat seeker orb).
      const empHead = b.style === 'empfield';
      // Phoenix wing-fan volume — wide rising sheet (≠ flight-aligned seeker-dart head).
      const fanHead = b.style === 'sunbird';
      // Returning axe — tumble blade plate (≠ flight-aligned seeker chip).
      const axeHead = b.style === 'dragonaxe';
      // Artillery breech shell — chunky casing mass (≠ flight-aligned horizontal laser bolt).
      const shellHead = b.style === 'shell';
      // HMG caliber slug — short fat tracer mass (≠ elongated violet laser dart).
      const hmgHead = b.style === 'coffinround';
      // Tesla search bolt — thin elongated spark tip (≠ fat cyan seeker orb).
      const boltHead = b.style === 'lightning';
      // Xenox split core — tall fragment plate (≠ round seeker orb, ≠ continuous rail laser).
      const xenoxHead = b.style === 'xenoxcore';
      // RIP coffin missile — tall casket lid plate (≠ violet seeker bolt, ≠ HMG short slug).
      const coffinHead = b.style === 'coffinmissile';
      // Winchester lock round — short brass slug + collar mass (≠ gold seeker bolt, ≠ lance needle).
      const lockHead = b.style === 'lockround';
      // Fragarach command marker — near-round designation plate (≠ parked orange bolt, ≠ breech shell).
      const commandHead = b.style === 'commandmissile';
      // Trollsberd cross-cut — compact cut plate (≠ magenta flying bolt, ≠ crescent tall blade).
      const crossHead = b.style === 'plasmacross';
      // Yatagarasu purification seal — near-round seal plate (≠ filled fire orb, ≠ phoenix wing fan).
      const sealHead = b.style === 'sunseal';
      // LRL basic slash-wave — wide travelling crest plate (≠ rose laser dart, ≠ axe tumble, ≠ crescent).
      const cleaveHead = b.style === 'cleave';
      // Winchester ballistic tracer — thin needle tip (≠ gold laser dart, ≠ lance shaft, ≠ lock collar).
      const tracerHead = b.style === 'tracer';
      let headMul = beam ? 2.2 : plasma ? 2.8 : (b.style === 'foxflame' ? 1.92 : fire ? 2.65 : 2.1);
      if (wardHead) headMul = b.charge ? 2.7 : 2.35;
      else if (crescentHead) headMul = b.charge ? 2.55 : 2.2;
      else if (cloudHead) headMul = b.charge ? 3.05 : 2.7;
      else if (empHead) headMul = 2.45;
      else if (fanHead) headMul = b.charge ? 2.95 : 2.7;
      else if (axeHead) headMul = b.charge ? 2.85 : 2.5;
      else if (shellHead) headMul = b.charge ? 2.7 : 2.4;
      else if (hmgHead) headMul = b.charge ? 1.95 : 1.82;
      else if (boltHead) headMul = 2.05;
      else if (xenoxHead) headMul = 2.25;
      else if (coffinHead) headMul = 2.35;
      else if (lockHead) headMul = 1.95;
      else if (commandHead) headMul = 2.35;
      else if (crossHead) headMul = 2.28;
      else if (sealHead) headMul = 2.40;
      else if (cleaveHead) headMul = 2.20;
      else if (tracerHead) headMul = 1.78;
      else if (b.charge) {
        if (id.kind === 'axe') headMul = 2.95;
        else if (id.kind === 'fan') headMul = 2.85;
        else if (id.kind === 'spike') headMul = 1.42;
        else if (id.kind === 'lance') headMul = 1.72;
        else if (id.kind === 'hmg') headMul = 1.95;
        else if (id.kind === 'arty') headMul = 2.45;
        else if (id.kind === 'cloud') headMul = 3.05;
      }
      const head = r * headMul;
      // Ward: tall clear-zone plate (narrow X / tall Y) — ≠ horizontal bolt head.
      // Crescent: tall slash plate (short X / tall Y) — kit.stretch stays for trail language only.
      // Storm: wide field plate (kit.stretch dens number untouched).
      // EMP: near-round pulse plate (kit.stretch dens number untouched).
      // Phoenix: wide rising wing plate (kit.stretch dens number untouched).
      // Axe: chunky tumble plate (kit.stretch dens number untouched).
      // Shell: fat breech casing (kit.stretch dens number untouched).
      // HMG: short caliber slug (kit.stretch dens number untouched).
      // Lightning: thin elongated spark (kit.stretch dens number untouched).
      // Xenox: tall split fragment plate (kit.stretch dens number untouched).
      // RIP coffin: tall casket lid plate (kit.stretch dens number untouched).
      // Winchester lock: short brass slug + collar (kit.stretch dens number untouched).
      // Command marker: near-round designation plate (kit.stretch dens number untouched).
      // Cross-cut: compact cut plate (kit.stretch dens number untouched).
      // Purification seal: near-round seal plate (kit.stretch dens number untouched).
      // Slash-wave: wide travelling crest plate (kit.stretch dens number untouched).
      // Tracer: thin ballistic needle (kit.stretch dens number untouched — head override only).
      const stretchW = wardHead ? 0.62
        : crescentHead ? 0.58
        : cloudHead ? 1.22
        : empHead ? 1.06
        : fanHead ? 1.28
        : axeHead ? 0.78
        : shellHead ? 0.92
        : hmgHead ? 0.68
        : boltHead ? 1.48
        : xenoxHead ? 0.74
        : coffinHead ? 0.66
        : lockHead ? 0.82
        : commandHead ? 1.02
        : crossHead ? 0.88
        : sealHead ? 1.04
        : cleaveHead ? 1.12
        : tracerHead ? 1.32
        : kit.stretch * (
          id.kind === 'spike' ? 1.28
            : id.kind === 'lance' ? 1.22
              : id.kind === 'hmg' ? 0.88 : 1
        );
      const stretchH = wardHead ? 1.72
        : crescentHead ? 1.92
          : cloudHead ? 0.82
            : empHead ? 1.04
              : fanHead ? 1.18
                : axeHead ? 1.38
                  : shellHead ? 1.18
                    : hmgHead ? 0.74
                      : boltHead ? 0.48
                        : xenoxHead ? 1.28
                          : coffinHead ? 1.45
                            : lockHead ? 0.88
                              : commandHead ? 1.08
                                : crossHead ? 0.96
                                  : sealHead ? 1.06
                                    : cleaveHead ? 1.22
                                      : tracerHead ? 0.42
                                    : id.kind === 'spike' ? 0.48
                                      : id.kind === 'lance' ? 0.62
                                        : id.kind === 'hmg' ? 0.86
                                          : id.kind === 'fan' ? 1.28 : 1;
      // Lance tip = streak chip (≠ soft blob that fattens into a laser pillar).
      const lanceHead = b.style === 'sightbeam';
      // Axe head spins with age — tumble cleave mass, not a locked seeker dart.
      const axeSpin = axeHead ? (b.age * 9.5 + (b.phase || 0)) : 0;
      // RIP coffin keeps upright lid plate (≠ flight-aligned violet seeker dart).
      // Winchester lock keeps near-upright collar mass (≠ flight-aligned gold seeker dart).
      // Command marker keeps upright designation plate (≠ flight-aligned parked bolt).
      // Cross-cut keeps near-upright cut plate (≠ flight-aligned magenta bolt / laser dart).
      // Purification seal keeps upright seal plate (≠ flight-aligned fire-orb / seeker blob).
      // Slash-wave keeps upright crest plate (≠ flight-aligned rose laser dart / seeker bolt).
      // Tracer stays flight-aligned thin needle (≠ upright collar, ≠ continuous lance ribbon).
      const headAng = (wardHead || cloudHead || empHead || fanHead || shellHead || coffinHead || lockHead || commandHead || crossHead || sealHead || cleaveHead) ? 0 : (axeHead ? axeSpin : angle);
      this.put(
        b.x, b.y, headAng,
        head * 1.55 * stretchW, head * 1.55 * stretchH,
        plasma ? 4 : (lanceHead || tracerHead ? 1 : 0), b.age, 0.55, b.color || kit.hue,
      );
      this.put(
        b.x, b.y, headAng,
        head * 0.7 * (crescentHead ? 0.55 : cloudHead ? 1.05 : empHead ? 0.92 : fanHead ? 1.12 : axeHead ? 0.72 : shellHead ? 0.85 : hmgHead ? 0.78 : boltHead ? 0.55 : xenoxHead ? 0.68 : coffinHead ? 0.62 : lockHead ? 0.78 : commandHead ? 0.88 : crossHead ? 0.82 : sealHead ? 0.90 : cleaveHead ? 0.78 : tracerHead ? 0.58 : 1),
        head * (wardHead ? 0.95 : crescentHead ? 1.15 : cloudHead ? 0.72 : empHead ? 0.88 : fanHead ? 0.88 : axeHead ? 1.05 : shellHead ? 0.95 : hmgHead ? 0.72 : boltHead ? 0.42 : xenoxHead ? 1.05 : coffinHead ? 1.12 : lockHead ? 0.82 : commandHead ? 0.92 : crossHead ? 0.90 : sealHead ? 0.92 : cleaveHead ? 1.08 : tracerHead ? 0.38 : 0.7),
        3, b.age, 0.95, kit.core,
      );
      if (sealHead && b.clearRadius > 0) {
        // Type-8 annulus sits at normalized radius .68: draw it at the exact clear boundary.
        const diameter = b.clearRadius * 2 / 0.68;
        this.put(b.x, b.y, 0, diameter, diameter, 8, b.age, 0.48, kit.hue);
      }
      // Skip behind-body fill for ward + overwatch lance + crescent blade + thunder cloud
      // + EMP pulse + phoenix wing-fan + returning axe + breech shell + HMG caliber slug + tesla bolt
      // + xenox split core + RIP coffin casket + Winchester lock slug + Fragarach command marker
      // + Trollsberd cross-cut + Yatagarasu purification seal + LRL slash-wave crest
      // + Winchester ballistic tracer needle
      // (was reading as continuous laser column / ribbon / missile wake / horizontal bolt / seeker wake).
      if (!light && !wardHead && !lanceHead && !crescentHead && !cloudHead && !empHead && !fanHead && !axeHead && !shellHead && !hmgHead && !boltHead && !xenoxHead && !coffinHead && !lockHead && !commandHead && !crossHead && !sealHead && !cleaveHead && !tracerHead) {
        const trailType = plasma ? 4 : (fire || id.kind === 'arty' ? 2 : 0);
        this.put(
          b.x - Math.cos(angle) * r * 0.8,
          b.y - Math.sin(angle) * r * 0.8,
          angle, head * 1.1 * stretchW, head * 0.85 * stretchH, trailType, b.age, 0.28, kit.smoke,
        );
      }
      // Beam / chain body = dense soft motes along the shaft (particle stream, not a thick stroke).
      if (beam || b.style === 'chainarc') {
        const spd = Math.hypot(b.vx, b.vy) || 1;
        const len = b.beamLength > 0
          ? Math.min(b.beamLength, 30 + b.age * spd)
          : (b.style === 'chainarc'
            ? Math.min(220, Math.hypot((b.chainOriginX ?? b.x) - b.x, (b.chainOriginY ?? b.y) - b.y) || 80)
            : Math.min(360, 30 + b.age * spd));
        if (player?.charKey === 'emily' && b.style === 'railbeam' && !b.special && !b.charge) {
          this._renderEmilyLaser(b, angle, len, time, light);
        }
        if (lanceHead) {
          // Overwatch lance — sparse gold needle chips along drop shaft
          // (≠ Emily continuous ribbon / dense laser pillar). dens/side/emit untouched.
          const steps = light ? 2 : 4;
          for (let s = 1; s <= steps && this.count < this.limit - 2; s++) {
            const t = s / (steps + 0.85);
            const px = b.x - Math.cos(angle) * len * t;
            const py = b.y - Math.sin(angle) * len * t;
            const sz = head * (0.58 - t * 0.22);
            this.put(
              px, py, angle,
              sz * kit.stretch * 0.95, sz * 0.32, 1,
              b.age + t, (1 - t) * 0.52, b.color || kit.hue,
            );
            if (!light) {
              this.put(px, py, angle, sz * 0.26, sz * 0.14, 3, b.age + t, 0.7, kit.core);
            }
          }
        } else {
          const steps = light ? 4 : (b.style === 'chainarc' ? 6 : 8);
          const ox = b.style === 'chainarc' ? (b.chainOriginX ?? b.x) : b.x - Math.cos(angle) * len;
          const oy = b.style === 'chainarc' ? (b.chainOriginY ?? b.y) : b.y - Math.sin(angle) * len;
          for (let s = 1; s <= steps && this.count < this.limit - 2; s++) {
            const t = s / steps;
            const px = b.style === 'chainarc'
              ? b.x + (ox - b.x) * t
              : b.x - Math.cos(angle) * len * t;
            const py = b.style === 'chainarc'
              ? b.y + (oy - b.y) * t
              : b.y - Math.sin(angle) * len * t;
            const sz = head * (1.1 - t * 0.55);
            this.put(px, py, angle, sz * kit.stretch, sz * 0.7, plasma ? 4 : 1, b.age + t, (1 - t) * 0.5, b.color || kit.hue);
          }
        }
      }
    }

    // Simulate + draw transient particles (trails, hits, muzzle).
    let write = 0;
    const parts = this.particles;
    const xMin = -80;
    const xMax = W + 80;
    const yMin = -80;
    const yMax = H + 80;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.delay > 0) {
        // Staged emitters (slam): wait unseen, then start their life.
        p.delay -= dt;
        parts[write++] = p;
        continue;
      }
      p.age += dt;
      if (p.age >= p.life) continue;
      const drag = p.drag || 5.5;
      if (p.grav) p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Exponential velocity damping — sparks settle as short streaks, smoke lingers soft
      p.vx *= Math.exp(-dt * drag);
      p.vy *= Math.exp(-dt * drag);
      // Off-playfield motes never read on the 960×540 field — free transient slots.
      if (p.x < xMin || p.x > xMax || p.y < yMin || p.y > yMax) continue;
      const k = p.age / p.life;
      const fade = (1 - k) * (1 - k * 0.35);
      const grow = p.grow != null ? 1 + k * p.grow
        : p.type === 2 ? 1 + k * 0.95 : (p.type === 1 ? 1 - k * 0.15 : 1 - k * 0.35);
      const spd = Math.hypot(p.vx, p.vy);
      // Align streaks to velocity so motion reads as sparks, not floating disks
      const ang = (p.type === 1 && spd > 12)
        ? Math.atan2(p.vy, p.vx)
        : (p.angle || 0);
      // Tip-forward velocity stretch — soft quads only (no hard needle geometry).
      const stretch = p.type === 1 ? (1.48 + Math.min(2.55, spd * 0.015)) : 1;
      const w = p.size * grow * (p.type === 1 ? 1.22 * stretch : 1);
      const h = p.size * grow * (p.type === 1 ? Math.max(0.24, 0.55 / stretch) : 1) * (p.hMul || 1);
      // Color ramp over life: tip-hot → kit mid → cool/glow (matches canvas trail language).
      let col = p.color;
      if (p.rampHot && p.rampCool) {
        if (k < 0.18) col = p.rampHot;
        else if (k > 0.78) col = p.rampCool;
        else if (k > 0.58) col = p.rampCool;
        else col = p.color;
      }
      this.put(p.x, p.y, ang, w, h, p.type, k, fade, col);
      // Brief tip-forward white core on young fast streaks (soft disk; no dens/emit churn).
      if (p.type === 1 && spd > 40 && k < 0.55 && fade > 0.4 && this.count < this.limit - 4) {
        this.put(p.x, p.y, ang, w * 0.42, Math.max(1.2, h * 0.55), 3, k, fade * 0.55, p.rampHot || '#fffef8');
      }
      parts[write++] = p;
    }
    parts.length = write;

    // Hold-FIRE: front muzzle only — uses HOLD identity (not basic autofire style).
    if (player?.alive && player.charge > 0.15) {
      const k = player.charge;
      const style = holdStyleOf(player);
      const kit = kitOf(style);
      const id = holdIdentity(style);
      const c = player.meta.shot.color || kit.hue;
      const cx = player.x + 30;
      const cy = player.y;
      const plasma = isPlasmaStyle(style) || id.kind === 'cloud';
      const headW = id.kind === 'crescent' ? (22 + k * 34)
        : (id.kind === 'fan' ? (20 + k * 28)
          : (id.kind === 'spike' ? (7 + k * 10)
            : (id.kind === 'lance' ? (9 + k * 14)
              : (id.kind === 'hmg' ? (11 + k * 16)
                : (id.kind === 'axe' ? (16 + k * 24) : (14 + k * 22))))));
      const headH = id.kind === 'crescent' ? 0.52
        : (id.kind === 'spike' ? 0.36
          : (id.kind === 'lance' ? 0.48
            : (id.kind === 'hmg' ? 0.88
              : (id.kind === 'fan' ? 1.22
                : (id.kind === 'axe' ? 1.12 : 1)))));
      this.put(cx, cy, 0, headW, headW * headH, plasma ? 4 : 0, time, k * 0.4, c);
      this.put(cx, cy, 0, 7 + k * 10, 7 + k * 10, 3, time, k * 0.7, kit.core);
      const emitRate = (light ? 26 : 56) * (0.4 + k)
        * (id.kind === 'hmg' ? 1.72
          : id.kind === 'spike' ? 0.62
            : id.kind === 'lance' ? 0.88
              : id.kind === 'cloud' ? 1.28
                : id.kind === 'fan' ? 1.28
                  : id.kind === 'crescent' ? 1.24
                    : id.kind === 'arty' ? 0.82 : 1);
      player._holdAcc = (player._holdAcc || 0) + dt * emitRate;
      while (player._holdAcc >= 1) {
        player._holdAcc -= 1;
        const cone = id.kind === 'fan' ? 2.08
          : (id.kind === 'crescent' ? 2.42
            : (id.kind === 'axe' ? 0.92
              : (id.kind === 'spike' ? 0.12
                : (id.kind === 'lance' ? 0.18
                  : (id.kind === 'hmg' ? 0.58
                    : (id.kind === 'arty' ? 1.08 : 0.7))))));
        const a = (Math.random() - 0.5) * cone;
        const streak = Math.random() < id.streak;
        const smokeChip = !plasma && Math.random() < id.smoke * 0.9;
        // Fine grit vs brighter chip — same emitRate; size/life/drag only (no dens churn).
        const fine = !smokeChip && (streak ? Math.random() < 0.58 : Math.random() < 0.45);
        const sp = ((id.kind === 'axe' ? 28 : 45)
          + Math.random() * (id.kind === 'spike' ? 145 : id.kind === 'lance' ? 110 : id.kind === 'hmg' ? 82 : 85) * k)
          * (fine && streak ? 1.12 : 1);
        const kindMul = id.kind === 'axe' ? 1.42
          : id.kind === 'lance' ? 0.78
            : id.kind === 'fan' ? 1.26
              : id.kind === 'crescent' ? 0.86 : 1;
        const size = (smokeChip
          ? (3.2 + Math.random() * 5 * k)
          : streak
            ? (fine ? (1.1 + Math.random() * 2.8 * k) : (2.2 + Math.random() * 5.2 * k))
            : (fine ? (1.6 + Math.random() * 3.2 * k) : (2.8 + Math.random() * 5.5 * k)))
          * kindMul;
        this._add({
          x: cx + (Math.random() - 0.5) * (id.kind === 'crescent' ? 14 : id.kind === 'hmg' ? 8 : 6),
          y: cy + (Math.random() - 0.5) * (id.kind === 'fan' ? 12 : id.kind === 'crescent' ? 6 : id.kind === 'hmg' ? 8 : 6),
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - id.rise * 0.35,
          size,
          type: plasma ? (streak ? 1 : 4) : (smokeChip ? 2 : (streak ? 1 : 0)),
          age: 0,
          life: id.kind === 'hmg' ? (fine ? 0.04 : 0.05) + Math.random() * (fine ? 0.06 : 0.08)
            : (id.kind === 'arty' ? (fine ? 0.1 : 0.14) + Math.random() * (fine ? 0.14 : 0.2)
              : (fine ? 0.07 : 0.1) + Math.random() * (fine ? 0.12 : 0.16)),
          color: (fine || Math.random() < 0.35) ? kit.core : c,
          angle: a,
          drag: (smokeChip ? 3.2 : (streak ? (fine ? 7.2 : 5.8) : (fine ? 5.6 : 4.4))) * id.drag,
          rampHot: kit.core, rampCool: kit.smoke,
        });
      }
    }

    if (this.count === 0) {
      if (this._gpuEmpty) return;
      this._gpuEmpty = true;
      this.geometry.instanceCount = 0;
      this.placement.needsUpdate = this.effect.needsUpdate = this.tint.needsUpdate = true;
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this._gpuEmpty = false;
    this.geometry.instanceCount = this.count;
    this.placement.needsUpdate = this.effect.needsUpdate = this.tint.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.active = false;
    this.disposed = true;
    this.particles.length = 0;
    if (this.renderer) {
      const el = this.renderer.domElement;
      el.removeEventListener('webglcontextlost', this.onLost);
      el.removeEventListener('webglcontextrestored', this.onRestored);
      el.remove();
      this.renderer.dispose();
    }
    this.geometry?.dispose();
    this.material?.dispose();
  }
}
