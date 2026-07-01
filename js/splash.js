// ── splash.js ─────────────────────────────────────────────────────────────────
// Full-screen entry splash: a spinning 3D globe with land/ocean continents and
// planes flying continent-to-continent along tracer-marked arcs, the Waypoint
// AI wordmark, and a single "Start new chat" button. Clicking the button
// grows a color-matched circle over the globe until it blocks out the whole
// screen, then reveals the main app underneath.

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
const OCEAN_COLOR = '#15171b';
const LAND_COLOR = '#8a7048';
const LAND_OUTLINE = 'rgba(200,184,122,0.5)';

// Simplified, hand-drawn continent silhouettes as [lon, lat] point lists on
// an equirectangular projection — not geographically precise, just enough to
// read as continents on a stylized globe. Antarctica is omitted.
const CONTINENTS = [
  [ // North America
    [-160,68], [-140,70], [-95,72], [-75,68], [-60,50], [-55,45], [-65,25],
    [-80,20], [-95,18], [-105,20], [-115,30], [-125,40], [-124,48], [-130,55], [-145,60],
  ],
  [ // South America
    [-80,10], [-77,5], [-70,-5], [-70,-18], [-72,-30], [-70,-40], [-68,-50],
    [-65,-55], [-58,-52], [-53,-35], [-48,-20], [-40,-10], [-38,0], [-50,8], [-60,10], [-70,12],
  ],
  [ // Africa
    [-17,15], [-10,30], [0,35], [10,37], [20,33], [32,31], [35,20], [43,12],
    [51,10], [48,0], [42,-10], [40,-20], [35,-30], [28,-34], [20,-35], [15,-28], [12,-18], [10,-5], [8,5], [0,8], [-10,10],
  ],
  [ // Europe
    [-9,38], [-5,43], [0,44], [5,43], [10,45], [15,42], [20,40], [25,38],
    [28,42], [30,45], [28,50], [20,54], [15,55], [10,58], [5,58], [0,60], [-5,60], [-8,55], [-10,50], [-9,45],
  ],
  [ // Asia
    [28,42], [35,45], [45,42], [55,45], [60,55], [70,55], [80,50], [95,50],
    [110,50], [120,45], [130,42], [140,45], [142,50], [135,55], [120,60], [100,65], [80,70], [60,72], [45,68], [35,60], [26,48],
    [70,15], [80,10], [95,10], [105,8], [110,20], [100,25], [90,22], [75,18], [70,15],
  ],
  [ // Australia
    [114,-22], [114,-34], [120,-34], [130,-32], [140,-38], [150,-37],
    [153,-28], [153,-20], [145,-15], [135,-12], [125,-13],
  ],
];

// Rough continent-center hubs used as flight endpoints, roughly matching the
// silhouettes above so planes fly between visible landmasses.
const HUBS = [
  { name: 'na', lat: 40, lon: -95 },
  { name: 'sa', lat: -15, lon: -60 },
  { name: 'af', lat: 5, lon: 20 },
  { name: 'eu', lat: 48, lon: 12 },
  { name: 'as', lat: 35, lon: 100 },
  { name: 'au', lat: -25, lon: 135 },
];

const ARC_RADIUS = 1.46;
const ARC_BULGE = 0.32;
const TRACER_SEGMENTS = 48;

function equirectXY(lon, lat, w, h) {
  return [(lon + 180) / 360 * w, (90 - lat) / 180 * h];
}

// Draws a stylized land/ocean map for the globe's base sphere — avoids
// needing an image asset for a static, no-build-step site.
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
  ctx.lineWidth = 2;
  CONTINENTS.forEach((points) => {
    ctx.beginPath();
    points.forEach(([lon, lat], i) => {
      const [x, y] = equirectXY(lon, lat, w, h);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
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

// Standard lat/lon → sphere position, using the same convention as the
// equirectangular UV mapping THREE.SphereGeometry expects, so flight paths
// line up with the continents drawn onto earthTexture(). Verified visually
// (marker spheres placed at every HUBS entry all land on their intended
// continent, including after rotating the globe 180° to check the far side).
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
function createPlane(THREE, texture, globeGroup, camera, startHub) {
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
      const ahead = arcPoint(THREE, journey.fromV, journey.toV, Math.min(1, progress + 0.01), ARC_RADIUS, ARC_BULGE);
      const p1 = globeGroup.localToWorld(pos.clone()).project(camera);
      const p2 = globeGroup.localToWorld(ahead.clone()).project(camera);
      sprite.material.rotation = Math.atan2(p2.y - p1.y, p2.x - p1.x) - Math.PI / 2;
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

  const planeTex = planeTexture(THREE);
  const planes = [0, 1, 2].map(() => createPlane(THREE, planeTex, globeGroup, camera, pickHub()));

  const reduced = reducedMotionPreferred();
  let frameId = null;

  function render() {
    if (!reduced) {
      globeGroup.rotation.y += 0.0022;
      planes.forEach((p) => p.update());
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
