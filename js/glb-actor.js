/**
 * glTF SD actor — Unity/Puppet2D export (tools/export_sd_glb.py) playback.
 * Renders via shared Three.js offscreen canvas, blits into the 2D game ctx.
 *
 * IMPORTANT: Do not bake scale/offset into the shared root that holds both
 * bones and skinned meshes — Three.js skinning uses bone.matrixWorld and
 * would double-apply that transform. Frame with the orthographic camera instead.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const RT = 768;

let shared = null;
const actorRoots = new Set();

function getShared() {
  if (shared) return shared;
  const canvas = document.createElement('canvas');
  canvas.width = RT;
  canvas.height = RT;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.setSize(RT, RT, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.sortObjects = true;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  camera.position.set(0, 0, 20);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 1.4));

  shared = { canvas, renderer, scene, camera, loader: new GLTFLoader(), frame: null };
  return shared;
}

function applyMeshSettings(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const order = obj.userData?.sortingOrder
      ?? obj.parent?.userData?.sortingOrder
      ?? 0;
    obj.renderOrder = order;
    obj.frustumCulled = false;

    const srcMats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const mapped = srcMats.map((m) => {
      if (!m) return m;
      const map = m.map || null;
      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
        map.magFilter = THREE.LinearFilter;
        map.minFilter = THREE.LinearMipmapLinearFilter;
        map.generateMipmaps = true;
        map.needsUpdate = true;
      }
      return new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        alphaTest: 0.12,
        fog: false,
      });
    });
    obj.material = mapped.length === 1 ? mapped[0] : mapped;

    if (obj.isSkinnedMesh) {
      // Front hair / ears GPU-skin still mis-binds and stacks over the face.
      // Tails/skirt/sleeves stay; bangs fall back to sprite Hair_Base.
      const n = obj.name || '';
      if (/Hair_[FLR]_Skinned|Ear_[LR]_Skinned/i.test(n)) {
        obj.visible = false;
      }
      obj.boundingBox = new THREE.Box3(
        new THREE.Vector3(-5, -5, -5),
        new THREE.Vector3(5, 5, 5),
      );
      obj.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8);
    }
  });
}

/** Compute camera frame from sprite meshes (Unity units). Shared by all clones. */
function computeFrame(root) {
  root.updateMatrixWorld(true);
  const hidden = [];
  root.traverse((obj) => {
    if (obj.isSkinnedMesh) {
      hidden.push(obj);
      obj.visible = false;
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  for (const obj of hidden) obj.visible = true;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  if (![...size.toArray(), ...center.toArray()].every(Number.isFinite) || size.length() < 1e-6) {
    center.set(0, 4.5, 0);
    size.set(5, 8, 1);
  }
  const extent = Math.max(size.x, size.y) * 0.55;
  return {
    center: center.clone(),
    extent,
    left: center.x - extent,
    right: center.x + extent,
    top: center.y + extent,
    bottom: center.y - extent,
  };
}

function applyFrame(camera, frame) {
  camera.left = frame.left;
  camera.right = frame.right;
  camera.top = frame.top;
  camera.bottom = frame.bottom;
  camera.position.set(frame.center.x, frame.center.y, 20);
  camera.lookAt(frame.center.x, frame.center.y, 0);
  camera.updateProjectionMatrix();
}

export async function loadGlbCharacter(url) {
  const sharedState = getShared();
  const gltf = await sharedState.loader.loadAsync(url);
  applyMeshSettings(gltf.scene);
  sharedState.frame = computeFrame(gltf.scene);
  applyFrame(sharedState.camera, sharedState.frame);

  const sceneExtras = gltf.parser?.json?.scenes?.[0]?.extras || {};
  const clips = {};
  for (const clip of gltf.animations) clips[clip.name] = clip;
  if (clips.skill1 && !clips.attack) clips.attack = clips.skill1;

  return {
    scene: gltf.scene,
    clips,
    meta: sceneExtras,
    hitTime: sceneExtras.clips?.skill1?.hitTime ?? 0.5,
    frame: sharedState.frame,
  };
}

export class GlbAnimator {
  constructor(template, { attackMax = 0.55 } = {}) {
    const { scene } = getShared();
    this.root = cloneSkinned(template.scene);
    applyMeshSettings(this.root);
    this.root.visible = false;
    scene.add(this.root);
    actorRoots.add(this.root);

    this.clips = template.clips;
    this.hitTime = template.hitTime;
    this.attackMax = attackMax;
    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = {};
    for (const [name, clip] of Object.entries(this.clips)) {
      const action = this.mixer.clipAction(clip);
      action.enabled = true;
      this.actions[name] = action;
    }
    if (this.actions.skill1 && !this.actions.attack) {
      this.actions.attack = this.actions.skill1;
    }
    this.state = 'idle';
    this.locked = false;
    this._attackTimer = 0;
    this._current = null;
    this.onFinished = null;
    this._play('idle', { loop: true, fade: 0 });
  }

  _play(name, { loop = true, fade = 0.08 } = {}) {
    const key = name === 'attack'
      ? (this.actions.attack ? 'attack' : 'skill1')
      : name;
    const next = this.actions[key] || this.actions.idle;
    if (!next) return;
    if (this._current && this._current !== next) {
      this._current.fadeOut(fade);
    }
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    if (fade > 0) next.fadeIn(fade);
    else next.play();
    if (fade > 0) next.play();
    this._current = next;
    this.state = name;
  }

  play(state, { lock = false, restart = true } = {}) {
    if (this.locked && this.state === 'die') return;
    if (this.locked && state !== 'die') return;
    if (this.state === state && !restart && !lock) return;

    if (state === 'attack') {
      this.locked = true;
      this._attackTimer = Math.min(this.attackMax, this.hitTime || this.attackMax);
      this._play('attack', { loop: false, fade: 0.04 });
      return;
    }
    if (state === 'die') {
      this.locked = true;
      this._play(this.actions.die ? 'die' : 'idle', { loop: false });
      return;
    }
    this.locked = !!lock;
    this._play(state, { loop: true });
  }

  update(dt) {
    this.mixer.update(dt);
    if (this.locked && this.state === 'attack') {
      this._attackTimer -= dt;
      if (this._attackTimer <= 0) {
        const finished = 'attack';
        this.locked = false;
        this._play('idle', { loop: true });
        if (this.onFinished) this.onFinished(finished);
      }
    }
  }

  draw(ctx, x, y, size, opts = {}) {
    const { renderer, scene, camera, canvas, frame } = getShared();
    if (frame) applyFrame(camera, frame);
    for (const r of actorRoots) r.visible = false;
    this.root.visible = true;
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    this.root.visible = false;

    const s = size || 96;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (opts.flash) ctx.globalAlpha = 0.55;
    if (opts.flipX) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.drawImage(canvas, -s / 2, -s / 2, s, s);
    } else {
      ctx.drawImage(canvas, x - s / 2, y - s / 2, s, s);
    }
    ctx.restore();
  }

  snapshotDataUrl() {
    const { renderer, scene, camera, canvas, frame } = getShared();
    if (frame) applyFrame(camera, frame);
    for (const r of actorRoots) r.visible = false;
    this.root.visible = true;
    this.mixer.update(0);
    renderer.clear();
    renderer.render(scene, camera);
    this.root.visible = false;
    return canvas.toDataURL('image/png');
  }

  dispose() {
    const { scene } = getShared();
    actorRoots.delete(this.root);
    scene.remove(this.root);
    this.mixer.stopAllAction();
  }
}
