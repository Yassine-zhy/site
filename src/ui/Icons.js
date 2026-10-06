import * as THREE from 'three';

// "Photographie" les modèles 3D (armes, reliques, portraits) pour en faire des icônes.
export class Icons {
  constructor(renderer, assets) {
    this.renderer = renderer;
    this.assets = assets;
    this.cache = new Map();
    this.size = 128;
    this.rt = new THREE.WebGLRenderTarget(this.size, this.size, { samples: 4 });
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    const key = new THREE.DirectionalLight('#fff4dc', 3.2); key.position.set(2, 3, 4);
    const rim = new THREE.DirectionalLight('#9db4ff', 1.8); rim.position.set(-3, 1, -2);
    this.scene.add(key, rim, new THREE.AmbientLight('#ffffff', 0.9));
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = this.size;
    this.pixels = new Uint8Array(this.size * this.size * 4);
  }

  shoot(obj, { rotY = -0.6, rotX = 0.25, rotZ = 0.6, zoom = 1, offsetY = 0 } = {}) {
    const r = this.renderer.renderer;
    const holder = new THREE.Group();
    holder.add(obj);
    obj.rotation.set(rotX, rotY, rotZ);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    obj.position.sub(c);
    const radius = Math.max(s.x, s.y, s.z) * 0.62 / zoom;
    this.cam.position.set(0, offsetY, radius / Math.tan(THREE.MathUtils.degToRad(15)));
    this.cam.lookAt(0, offsetY, 0);
    this.scene.add(holder);
    const prevRT = r.getRenderTarget();
    const prevTM = r.toneMapping;
    const prevClear = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(this.scene, this.cam);
    r.readRenderTargetPixels(this.rt, 0, 0, this.size, this.size, this.pixels);
    r.setRenderTarget(prevRT);
    r.toneMapping = prevTM;
    r.setClearColor(prevClear, prevAlpha);
    this.scene.remove(holder);
    const g = this.canvas.getContext('2d');
    const img = g.createImageData(this.size, this.size);
    const S = this.size;
    for (let y = 0; y < S; y++) {
      const src = (S - 1 - y) * S * 4, dst = y * S * 4;
      for (let x = 0; x < S * 4; x += 4) {
        const a = this.pixels[src + x + 3];
        // conversion linéaire -> sRGB approximative
        img.data[dst + x] = Math.pow(this.pixels[src + x] / 255, 1 / 2.2) * 255;
        img.data[dst + x + 1] = Math.pow(this.pixels[src + x + 1] / 255, 1 / 2.2) * 255;
        img.data[dst + x + 2] = Math.pow(this.pixels[src + x + 2] / 255, 1 / 2.2) * 255;
        img.data[dst + x + 3] = a;
      }
    }
    g.putImageData(img, 0, 0);
    return this.canvas.toDataURL('image/png');
  }

  item(model) {
    if (!model) return '';
    if (this.cache.has(model)) return this.cache.get(model);
    let url = '';
    try { url = this.shoot(this.assets.prop(model)); } catch (e) { console.warn('icône', model, e); }
    this.cache.set(model, url);
    return url;
  }

  portrait(modelName) {
    const k = 'portrait:' + modelName;
    if (this.cache.has(k)) return this.cache.get(k);
    let url = '';
    try {
      const obj = this.assets.character(modelName);
      obj.traverse((o) => { if (o.isMesh && o.parent && /handslot/.test(o.parent.name)) o.visible = false; });
      // cadrage serré sur la tête
      const holder = new THREE.Group(); holder.add(obj);
      obj.rotation.y = -0.35;
      holder.updateMatrixWorld(true);
      const r = this.renderer.renderer;
      this.cam.position.set(0.15, 1.95, 2.6); this.cam.lookAt(0, 1.75, 0);
      this.scene.add(holder);
      const prevRT = r.getRenderTarget();
      r.setRenderTarget(this.rt); r.setClearColor(0x000000, 0); r.clear(); r.render(this.scene, this.cam);
      r.readRenderTargetPixels(this.rt, 0, 0, this.size, this.size, this.pixels);
      r.setRenderTarget(prevRT);
      this.scene.remove(holder);
      const g = this.canvas.getContext('2d');
      const img = g.createImageData(this.size, this.size);
      const S = this.size;
      for (let y = 0; y < S; y++) for (let x = 0; x < S * 4; x += 4) {
        const src = (S - 1 - y) * S * 4 + x, dst = y * S * 4 + x;
        for (let k2 = 0; k2 < 3; k2++) img.data[dst + k2] = Math.pow(this.pixels[src + k2] / 255, 1 / 2.2) * 255;
        img.data[dst + 3] = this.pixels[src + 3];
      }
      g.putImageData(img, 0, 0);
      url = this.canvas.toDataURL('image/png');
    } catch (e) { console.warn('portrait', e); }
    this.cache.set(k, url);
    return url;
  }
}
