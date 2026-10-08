import * as THREE from 'three';

// Arbres lointains en « imposteurs » : chaque modèle d'arbre (et les gros rochers) est
// photographié une fois au chargement dans un atlas, puis dessiné au loin comme un simple
// panneau tourné vers la caméra. Des dizaines de milliers d'arbres pour quelques appels de
// dessin : les forêts restent visibles jusqu'à l'horizon sans coût notable, même sur téléphone.
// Les arbres proches restent de vrais modèles 3D (Vegetation) ; la frontière entre les deux
// est calculée avec le même point de référence, sans trou ni doublon.

const TILE = 900;           // regroupement spatial (un maillage par case, écarté hors champ)
const CELL_W = 96, CELL_H = 160;

// teinte d'ensemble selon le rendu du modèle proche (neige, automne, jungle, marais)
const TINTS = {
  base: [1, 1, 1, 0], pt: [1, 1, 1, 0], hw: [1, 1, 1, 0], snow: [0.95, 1.0, 1.05, 0.5], autumn: [1.25, 0.72, 0.42, 0],
  jungle: [0.78, 1.1, 0.78, 0], swamp: [0.82, 0.88, 0.66, 0], red: [1.25, 0.82, 0.62, 0], dark: [0.75, 0.72, 0.85, 0], moss: [0.85, 1.0, 0.8, 0],
};

export class FarTrees {
  constructor(renderer, scene, assets, items, { near = 150, far = 1100 } = {}) {
    this.renderer = renderer; this.scene = scene; this.assets = assets; this.items = items;
    this.uniforms = {
      uAtlas: { value: null }, uFocus: { value: new THREE.Vector2(1e9, 1e9) }, uNear: { value: near }, uFar: { value: far },
      uLight: { value: new THREE.Color(1, 1, 1) },
      fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 1000 }, fogDensity: { value: 0 },
    };
    this.names = [...new Set(items.map((it) => it.name))];
    const cols = Math.max(1, Math.min(16, this.names.length)), rows = Math.ceil(this.names.length / cols);
    this.layout = { cols, rows };
    this.rt = new THREE.WebGLRenderTarget(cols * CELL_W, rows * CELL_H, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
    this.uniforms.uAtlas.value = this.rt.texture;
    this.boxes = new Map();
    this.bake();
    this.build();
  }

  // photographie de chaque modèle, vu de face, éclairage neutre et lumineux
  bake() {
    const r = this.renderer, { cols } = this.layout;
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight('#ffffff', 1.25));
    const key = new THREE.DirectionalLight('#fff6e6', 2.2); key.position.set(0.5, 1, 1.2); scene.add(key);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
    const prev = { rt: r.getRenderTarget(), tm: r.toneMapping, cc: r.getClearColor(new THREE.Color()), ca: r.getClearAlpha(), st: r.getScissorTest() };
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, true);
    r.toneMapping = THREE.NoToneMapping;
    this.names.forEach((name, i) => {
      const g = this.assets.propGeometry(name);
      if (!g) return;
      const mesh = new THREE.Mesh(g.geometry, g.material);
      const b = g.box, size = b.getSize(new THREE.Vector3());
      const w = Math.max(size.x, size.z) * 1.04, h = size.y * 1.02;
      this.boxes.set(name, { w, h, y0: b.min.y, i });
      // vue de face, sans perspective : caméra orthographique cadrée sur la boîte du modèle
      const cx = (b.min.x + b.max.x) / 2;
      cam.left = cx - w / 2; cam.right = cx + w / 2; cam.bottom = b.min.y; cam.top = b.min.y + h;
      cam.near = 0.01; cam.far = size.z + 100;
      cam.position.set(0, 0, b.max.z + 50); cam.rotation.set(0, 0, 0);
      cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      const x = (i % cols) * CELL_W, y = Math.floor(i / cols) * CELL_H;
      this.rt.viewport.set(x, y, CELL_W, CELL_H); this.rt.scissor.set(x, y, CELL_W, CELL_H); this.rt.scissorTest = true;
      r.setRenderTarget(this.rt);
      scene.add(mesh);
      r.render(scene, cam);
      scene.remove(mesh);
    });
    this.rt.viewport.set(0, 0, this.rt.width, this.rt.height); this.rt.scissor.set(0, 0, this.rt.width, this.rt.height); this.rt.scissorTest = false;
    r.setRenderTarget(prev.rt);
    r.toneMapping = prev.tm;
    r.setClearColor(prev.cc, prev.ca);
  }

  build() {
    const { cols, rows } = this.layout;
    const quad = new THREE.PlaneGeometry(1, 1, 1, 1); quad.translate(0, 0.5, 0);
    const tiles = new Map();
    for (const it of this.items) {
      const bx = this.boxes.get(it.name);
      if (!bx) continue;
      const k = Math.floor(it.x / TILE) + ',' + Math.floor(it.z / TILE);
      if (!tiles.has(k)) tiles.set(k, []);
      tiles.get(k).push([it, bx]);
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, fog: true,
      vertexShader: /* glsl */`
        attribute vec3 iPos; attribute vec2 iSize; attribute vec4 iCell; attribute vec4 iTint;
        uniform vec2 uFocus; uniform float uNear; uniform float uFar;
        varying vec2 vUv; varying vec4 vTint; varying float vH;
        #include <fog_pars_vertex>
        void main() {
          float d = distance(iPos.xz, uFocus);
          float vis = step(uNear, d) * step(d, uFar);
          vec3 toCam = cameraPosition - iPos; toCam.y = 0.0;
          toCam = normalize(toCam + vec3(1e-4, 0.0, 0.0));
          vec3 right = vec3(toCam.z, 0.0, -toCam.x);
          vec3 p = iPos + right * position.x * iSize.x + vec3(0.0, position.y * iSize.y, 0.0);
          p = mix(iPos, p, vis);
          vUv = iCell.xy + uv * iCell.zw;
          vTint = iTint; vH = uv.y;
          vec4 mvPosition = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uAtlas; uniform vec3 uLight;
        varying vec2 vUv; varying vec4 vTint; varying float vH;
        #include <fog_pars_fragment>
        void main() {
          vec4 c = texture2D(uAtlas, vUv);
          if (c.a < 0.42) discard;
          vec3 col = c.rgb / max(c.a, 0.01) * vTint.rgb;
          col = mix(col, vec3(0.9, 0.94, 1.0) * max(max(col.r, col.g), col.b) * 1.1, vTint.a * smoothstep(0.25, 0.9, vH));
          gl_FragColor = vec4(col * uLight, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.material = mat;
    this.meshes = [];
    const cw = 1 / cols, ch = 1 / rows;
    for (const list of tiles.values()) {
      const n = list.length;
      const pos = new Float32Array(n * 3), size = new Float32Array(n * 2), cell = new Float32Array(n * 4), tint = new Float32Array(n * 4);
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = -Infinity, minY = Infinity;
      list.forEach(([it, bx], j) => {
        const sy = it.sy ?? 1;
        pos[j * 3] = it.x; pos[j * 3 + 1] = it.y + bx.y0 * it.s * sy; pos[j * 3 + 2] = it.z;
        size[j * 2] = bx.w * it.s; size[j * 2 + 1] = bx.h * it.s * sy;
        cell[j * 4] = (bx.i % cols) * cw; cell[j * 4 + 1] = Math.floor(bx.i / cols) * ch; cell[j * 4 + 2] = cw; cell[j * 4 + 3] = ch;
        const t = TINTS[it.look] || TINTS.base, v = 0.9 + ((it.x * 12.9898 + it.z * 78.233) % 1 + 1) % 1 * 0.2;
        tint[j * 4] = t[0] * v; tint[j * 4 + 1] = t[1] * v; tint[j * 4 + 2] = t[2] * v; tint[j * 4 + 3] = t[3];
        minX = Math.min(minX, it.x); maxX = Math.max(maxX, it.x); minZ = Math.min(minZ, it.z); maxZ = Math.max(maxZ, it.z);
        minY = Math.min(minY, it.y); maxY = Math.max(maxY, it.y + bx.h * it.s * sy);
      });
      const geo = new THREE.InstancedBufferGeometry();
      geo.index = quad.index; geo.setAttribute('position', quad.attributes.position); geo.setAttribute('uv', quad.attributes.uv);
      geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
      geo.setAttribute('iSize', new THREE.InstancedBufferAttribute(size, 2));
      geo.setAttribute('iCell', new THREE.InstancedBufferAttribute(cell, 4));
      geo.setAttribute('iTint', new THREE.InstancedBufferAttribute(tint, 4));
      geo.instanceCount = n;
      const c = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
      geo.boundingSphere = new THREE.Sphere(c, Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2 + 30);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'farTrees';
      mesh.castShadow = false; mesh.receiveShadow = false;
      mesh.userData.center = c; mesh.userData.radius = geo.boundingSphere.radius;
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
    this.count = this.items.length;
  }

  // frontière proche/lointain : même point que le dernier tri des arbres proches
  setFocus(x, z, near) { this.uniforms.uFocus.value.set(x, z); if (near !== undefined) this.uniforms.uNear.value = near; }
  setFar(far) { this.uniforms.uFar.value = far; }

  update(sky, scene, camera) {
    const u = this.uniforms;
    // lumière du jour : l'atlas est photographié en plein jour, on l'assombrit la nuit
    const s = sky?.state;
    if (s) {
      const k = 0.42 + (1 - s.night) * 0.5;
      u.uLight.value.setRGB(k * (1 - s.night * 0.25), k * (1 - s.night * 0.15), k);
    }
    if (scene?.fog) { u.fogColor.value.copy(scene.fog.color); u.fogNear.value = scene.fog.near ?? 1; u.fogFar.value = scene.fog.far ?? 1000; u.fogDensity.value = scene.fog.density ?? 0; }
    // cases entièrement hors de portée : pas d'appel de dessin
    if (camera) {
      const f = u.uFocus.value, far = u.uFar.value, near = u.uNear.value;
      for (const m of this.meshes) {
        const c = m.userData.center, d = Math.hypot(c.x - f.x, c.z - f.y);
        m.visible = d - m.userData.radius < far && d + m.userData.radius > near;
      }
    }
  }

  dispose() { for (const m of this.meshes) { m.removeFromParent(); m.geometry.dispose(); } this.material?.dispose(); this.rt.dispose(); }
}
