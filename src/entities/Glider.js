import * as THREE from 'three';

// Paravoile procédurale (toile + suspentes) déployée pendant le vol plané.
export function createGlider(color = '#e8c15a', accent = '#8b5cf6') {
  const g = new THREE.Group();
  const W = 5.2, D = 1.7, segX = 24, segZ = 6;
  const geo = new THREE.PlaneGeometry(W, D, segX, segZ);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c1 = new THREE.Color(color), c2 = new THREE.Color(accent), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const u = x / (W / 2);
    // voûte : arc + léger profil d'aile
    pos.setXYZ(i, x, -u * u * 0.9, y);
    const stripe = Math.floor((u + 1) * 4) % 2 === 0;
    tmp.copy(stripe ? c1 : c2);
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.75, flatShading: true }));
  cloth.position.y = 3.6;
  cloth.castShadow = true;
  g.add(cloth);
  const lineMat = new THREE.LineBasicMaterial({ color: '#3a2f25', transparent: true, opacity: 0.7 });
  const pts = [];
  for (const sx of [-1, 1]) {
    for (const k of [0.25, 0.6, 0.95]) {
      const x = sx * (W / 2) * k;
      pts.push(new THREE.Vector3(sx * 0.25, 1.6, 0), new THREE.Vector3(x, 3.6 - k * k * 0.9, 0));
    }
  }
  const lg = new THREE.BufferGeometry().setFromPoints(pts);
  g.add(new THREE.LineSegments(lg, lineMat));
  g.visible = false;
  g.userData.cloth = cloth;
  return g;
}
