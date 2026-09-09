import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js';

const PARTICLE_GEOMETRY = new THREE.IcosahedronGeometry(0.075, 0);

export function createEffectManager(scene, { profile, reducedMotion = false, fxLayer = null, onCameraKick = () => {} } = {}) {
  const root = new THREE.Group();
  root.name = 'transient-effects';
  scene.add(root);
  const particles = [];
  const maxParticles = Math.max(24, (profile?.effectParticles || 24) * 4);

  function removeParticle(particle) {
    root.remove(particle.mesh);
    particle.mesh.material.dispose();
    const index = particles.indexOf(particle);
    if (index >= 0) particles.splice(index, 1);
  }

  function burst(position, color = 0x8fffe1, intensity = 1) {
    if (reducedMotion) return;
    const count = Math.min(profile?.effectParticles || 24, Math.max(6, Math.round(10 * intensity)));
    for (let i = 0; i < count && particles.length < maxParticles; i += 1) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.Mesh(PARTICLE_GEOMETRY, material);
      mesh.position.copy(position);
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.55;
      const speed = (1.8 + Math.random() * 3.2) * intensity;
      const velocity = new THREE.Vector3(Math.cos(angle) * speed, (Math.random() - 0.25) * speed, Math.sin(angle) * speed);
      root.add(mesh);
      particles.push({ mesh, velocity, age: 0, life: 0.45 + Math.random() * 0.45 });
    }
  }

  function popText(text, kind = 'score') {
    if (!fxLayer || !text) return;
    const element = document.createElement('div');
    element.className = `float-text ${kind}`;
    element.textContent = text;
    fxLayer.appendChild(element);
    requestAnimationFrame(() => element.classList.add('show'));
    setTimeout(() => element.remove(), reducedMotion ? 500 : 1100);
  }

  function food(position, points = 20, color = 0x8fffe1) {
    burst(position, color, 0.7);
    popText(`+${Math.max(1, Math.round(points))}`, 'score');
  }

  function eat(position, points = 100, color = 0x66efff) {
    burst(position, color, 1.75);
    popText(`DEVOUR +${Math.max(1, Math.round(points))}`, 'eat');
    onCameraKick(reducedMotion ? 0 : 0.7);
  }

  function growth(position) {
    burst(position, 0xb9ffe9, 1.1);
    popText('GROWTH!', 'growth');
  }

  function respawn() {
    document.body.classList.remove('respawn-flash');
    void document.body.offsetWidth;
    document.body.classList.add('respawn-flash');
    setTimeout(() => document.body.classList.remove('respawn-flash'), 520);
  }

  function danger(active) {
    document.body.classList.toggle('danger-nearby', Boolean(active));
  }

  function update(delta) {
    const dt = Math.min(0.05, Math.max(0, delta || 0));
    for (const particle of [...particles]) {
      particle.age += dt;
      if (particle.age >= particle.life) {
        removeParticle(particle);
        continue;
      }
      particle.velocity.multiplyScalar(0.965);
      particle.velocity.y += 0.34 * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      const t = 1 - particle.age / particle.life;
      particle.mesh.material.opacity = t * 0.9;
      particle.mesh.scale.setScalar(0.6 + t * 1.4);
    }
  }

  function dispose() {
    for (const particle of [...particles]) removeParticle(particle);
    scene.remove(root);
  }

  return { burst, food, eat, growth, respawn, danger, popText, update, dispose };
}
