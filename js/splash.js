// ── splash.js ─────────────────────────────────────────────────────────────────
// Full-screen entry splash: a spinning 3D globe with land/ocean continents and
// planes flying continent-to-continent along tracer-marked arcs, the Waypoint
// AI wordmark, and a single "Start new chat" button. Clicking the button
// grows a color-matched circle over the globe until it blocks out the whole
// screen, then reveals the main app underneath.

import { CONTINENTS, HUBS } from './globe-coastlines.js';

const GROW_MS = 800;
const FADE_MS = 350;
const GROW_MS_REDUCED = 120;
const FADE_MS_REDUCED = 100;

// Named distinctly from interactive.js's motionAllowed() — that one also
// gates on (hover: hover)/(pointer: fine) because it guards hover-only
// effects. The splash's globe/transition should still play on touch
// devices, so it only needs the reduced-motion check, not the hover check.
function reducedMotionPreferred() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ── GLOBE ────────────────────────────────────────────────────────────────────
const OCEAN_COLOR = '#204c65';
const LAND_COLOR = '#5b8c46';
const LAND_OUTLINE = 'rgba(233,225,205,0.35)';

const ARC_RADIUS = 1.46;
const ARC_BULGE = 0.32;
const TRACER_SEGMENTS = 48;

// A bare "r,g,b" triplet rather than a #hex/rgba() string, since dotTexture()
// splices it into rgba(...) at three different alpha values for its gradient.
const DOT_COLOR = '255,210,63';
const DOT_DURATION_MS = 700;
const DOT_MAX_SCALE = 0.16;

function equirectXY(lon, lat, w, h) {
  return [(lon + 180) / 360 * w, (90 - lat) / 180 * h];
}

// Draws a land/ocean map for the globe's base sphere from real coastline
// data — avoids needing an image asset for a static, no-build-step site.
// Each ring is drawn three times, offset a full map-width left/right, so
// landmasses that cross the antimeridian (like Afro-Eurasia's Siberian
// edge) wrap correctly instead of leaving a seam artifact.
function earthTexture(THREE) {
  const w = 1024;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = OCEAN_COLOR;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = LAND_COLOR;
  ctx.strokeStyle = LAND_OUTLINE;
  ctx.lineWidth = 1;
  CONTINENTS.forEach((points) => {
    const xy = points.map(([lon, lat]) => equirectXY(lon, lat, w, h));
    [-w, 0, w].forEach((offsetX) => {
      ctx.beginPath();
      xy.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x + offsetX, y); else ctx.lineTo(x + offsetX, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  });

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Draws a "✈" glyph to an offscreen canvas for use as a billboard sprite
// texture — avoids needing an image asset for a static, no-build-step site.
function planeTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = '46px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f0ede6';
  ctx.fillText('✈', 32, 34);
  return new THREE.CanvasTexture(c);
}

// A soft-edged yellow dot used for the takeoff/landing pop flash.
function dotTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, `rgba(${DOT_COLOR},1)`);
  grad.addColorStop(0.55, `rgba(${DOT_COLOR},0.8)`);
  grad.addColorStop(1, `rgba(${DOT_COLOR},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(16, 16, 16, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

// Standard lat/lon → sphere position, using the same convention as the
// equirectangular UV mapping THREE.SphereGeometry expects, so flight paths
// line up with the continents drawn onto earthTexture().
function latLonToVector3(THREE, lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Spherical-linear-interpolates between two surface points and lifts the
// midpoint outward, so the path arcs above the globe instead of cutting
// through it — the classic "flight route" curve.
function arcPoint(THREE, fromV, toV, t, radius, bulge) {
  const v = fromV.clone().normalize();
  const w = toV.clone().normalize();
  const omega = Math.acos(THREE.MathUtils.clamp(v.dot(w), -1, 1));
  let point;
  if (omega < 1e-6) {
    point = v.clone();
  } else {
    const s = Math.sin(omega);
    point = v.clone().multiplyScalar(Math.sin((1 - t) * omega) / s)
      .add(w.clone().multiplyScalar(Math.sin(t * omega) / s));
  }
  const lift = Math.sin(t * Math.PI) * bulge;
  return point.normalize().multiplyScalar(radius + lift);
}

// A pool of brief "pop" flashes marking hub arrivals/departures. Since
// planes chain journeys (each arrival becomes the next departure), a single
// flash at the shared hub point serves as both the landing mark for the
// finishing leg and the takeoff mark for the one starting right after.
// Unlike createPlane(), this manages a variable-size pool of short-lived
// sprites rather than one persistent object, so it exposes spawn()/update(now)
// instead of createPlane's single-object { sprite, tracer, update() } shape.
function createDotPool(THREE, texture, globeGroup) {
  const active = [];

  return {
    spawn(position) {
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(position);
      sprite.scale.set(0, 0, 1);
      globeGroup.add(sprite);
      active.push({ sprite, material, start: performance.now() });
    },
    update(now) {
      for (let i = active.length - 1; i >= 0; i--) {
        const dot = active[i];
        const t = (now - dot.start) / DOT_DURATION_MS;
        if (t >= 1) {
          globeGroup.remove(dot.sprite);
          dot.material.dispose();
          active.splice(i, 1);
          continue;
        }
        const envelope = Math.sin(t * Math.PI); // 0 → 1 → 0: pop in, fade out
        const scale = DOT_MAX_SCALE * envelope;
        dot.sprite.scale.set(scale, scale, 1);
        dot.material.opacity = envelope;
      }
    },
    dispose() {
      active.forEach((dot) => {
        globeGroup.remove(dot.sprite);
        dot.material.dispose();
      });
      active.length = 0;
    }
  };
}

function pickHub(excludeName) {
  let h;
  do { h = HUBS[Math.floor(Math.random() * HUBS.length)]; } while (h.name === excludeName);
  return h;
}

function buildJourney(THREE, fromHub, toHub) {
  const fromV = latLonToVector3(THREE, fromHub.lat, fromHub.lon, ARC_RADIUS);
  const toV = latLonToVector3(THREE, toHub.lat, toHub.lon, ARC_RADIUS);
  return { fromHub, toHub, fromV, toV };
}

// A plane sprite + its trailing tracer line, flying continent-to-continent.
// Each arrival becomes the next departure, so it reads as an ongoing route
// network rather than random hops. Returns a dispose-handle object mirroring
// the shape loadGlobe() itself returns, so the two compose the same way.
function createPlane(THREE, texture, globeGroup, camera, startHub, spawnDot) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(0.22, 0.22, 1);
  globeGroup.add(sprite);

  const tracerMaterial = new THREE.LineBasicMaterial({ color: 0xc8b87a, transparent: true, opacity: 0.55 });
  const tracer = new THREE.Line(new THREE.BufferGeometry(), tracerMaterial);
  tracer.frustumCulled = false;
  globeGroup.add(tracer);

  let journey = buildJourney(THREE, startHub, pickHub(startHub.name));
  let progress = Math.random(); // stagger so all planes don't launch in sync
  const speed = 0.0007 + Math.random() * 0.0004;

  function setTracerGeometry() {
    const positions = new Float32Array((TRACER_SEGMENTS + 1) * 3);
    for (let i = 0; i <= TRACER_SEGMENTS; i++) {
      const p = arcPoint(THREE, journey.fromV, journey.toV, i / TRACER_SEGMENTS, ARC_RADIUS, ARC_BULGE);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }
    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    newGeometry.setDrawRange(0, 0);
    tracer.geometry.dispose();
    tracer.geometry = newGeometry;
  }
  setTracerGeometry();

  return {
    sprite, tracer,
    update() {
      progress += speed;
      if (progress >= 1) {
        progress = 0;
        spawnDot(journey.toV); // old journey's arrival point — read before journey is reassigned below
        journey = buildJourney(THREE, journey.toHub, pickHub(journey.toHub.name));
        setTracerGeometry();
      }

      const pos = arcPoint(THREE, journey.fromV, journey.toV, progress, ARC_RADIUS, ARC_BULGE);
      sprite.position.copy(pos);

      const revealed = Math.min(TRACER_SEGMENTS, Math.floor(progress * TRACER_SEGMENTS) + 1);
      tracer.geometry.setDrawRange(0, revealed);

      // Orient the sprite to face its direction of travel in screen space
      // (a sprite's own rotation is the only part of it that isn't
      // auto-billboarded to the camera, so this needs an explicit angle).
      // The "✈" glyph's own nose already points along rotation=0 (screen
      // +X, i.e. "right"), so no extra offset is needed here.
      const ahead = arcPoint(THREE, journey.fromV, journey.toV, Math.min(1, progress + 0.01), ARC_RADIUS, ARC_BULGE);
      const p1 = globeGroup.localToWorld(pos.clone()).project(camera);
      const p2 = globeGroup.localToWorld(ahead.clone()).project(camera);
      sprite.material.rotation = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    },
    dispose() {
      sprite.material.dispose();
      tracer.geometry.dispose();
      tracerMaterial.dispose();
    }
  };
}

async function loadGlobe(canvas) {
  const THREE = await import('three');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 6.5;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  const globeTexture = earthTexture(THREE);
  const globeGeometry = new THREE.SphereGeometry(1.4, 48, 48);
  const globeMaterial = new THREE.MeshStandardMaterial({ map: globeTexture, roughness: 0.65, metalness: 0.05 });
  globeGroup.add(new THREE.Mesh(globeGeometry, globeMaterial));

  const wireGeometry = new THREE.SphereGeometry(1.42, 24, 16);
  const wireMaterial = new THREE.MeshBasicMaterial({ color: 0xc8b87a, wireframe: true, transparent: true, opacity: 0.22 });
  globeGroup.add(new THREE.Mesh(wireGeometry, wireMaterial));

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.PointLight(0xc8b87a, 1.4, 20);
  key.position.set(3, 2, 4);
  scene.add(key);

  const dotTex = dotTexture(THREE);
  const dotPool = createDotPool(THREE, dotTex, globeGroup);

  const planeTex = planeTexture(THREE);
  const planes = [0, 1, 2].map(() => createPlane(THREE, planeTex, globeGroup, camera, pickHub(), dotPool.spawn));

  const reduced = reducedMotionPreferred();
  let frameId = null;

  function render() {
    if (!reduced) {
      globeGroup.rotation.y += 0.0022;
      planes.forEach((p) => p.update());
      dotPool.update(performance.now());
      frameId = requestAnimationFrame(render);
    }
    renderer.render(scene, camera);
  }
  render();

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  return {
    dispose() {
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      planes.forEach((p) => p.dispose());
      planeTex.dispose();
      dotPool.dispose();
      dotTex.dispose();
      globeGeometry.dispose();
      globeMaterial.dispose();
      globeTexture.dispose();
      wireGeometry.dispose();
      wireMaterial.dispose();
      renderer.dispose();
    }
  };
}

// ── SPLASH TRANSITION ───────────────────────────────────────────────────────
function initSplash() {
  const splash = document.getElementById('splash');
  const startBtn = document.getElementById('splashStartBtn');
  const blockout = document.getElementById('splashBlockout');
  const canvas = document.getElementById('splashCanvas');
  if (!splash || !startBtn || !blockout || !canvas) return;

  let globeHandle = null;
  let dismissed = false;
  loadGlobe(canvas).then((handle) => {
    // import('three') is a real network fetch that can resolve after the
    // user has already clicked through and the splash is gone. In that
    // case dispose immediately instead of storing — otherwise the renderer,
    // its requestAnimationFrame loop, and the resize listener leak for the
    // rest of the page's lifetime with nothing left to ever clean them up.
    if (dismissed) { handle.dispose(); return; }
    globeHandle = handle;
  }).catch((err) => {
    // Three.js failed to load (offline, blocked CDN, no WebGL, etc). The
    // canvas just stays empty over the splash's dark background — the
    // button below still works, so the user is never blocked from entering.
    console.error('[Waypoint] splash globe failed to load:', err);
  });

  startBtn.addEventListener('click', () => {
    startBtn.disabled = true;
    splash.classList.add('splash-leaving');

    const reduced = reducedMotionPreferred();
    const growMs = reduced ? GROW_MS_REDUCED : GROW_MS;
    const fadeMs = reduced ? FADE_MS_REDUCED : FADE_MS;

    setTimeout(() => {
      // The blockout circle is fully grown and opaque at this point, so
      // revealing the app underneath here causes no visible pop or flash.
      document.body.classList.remove('pre-start');

      blockout.classList.add('splash-blockout-fadeout');
      setTimeout(() => {
        dismissed = true;
        splash.remove();
        if (globeHandle) globeHandle.dispose();
      }, fadeMs);
    }, growMs);
  });
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────
export { initSplash };
