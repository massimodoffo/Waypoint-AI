// ── splash.js ─────────────────────────────────────────────────────────────────
// Full-screen entry splash: a spinning 3D globe with land/ocean continents,
// planes flying continent-to-continent along tracer-marked arcs, the
// Waypoint AI wordmark, and a single "Explore" button. Clicking it grows a
// color-matched circle over the globe until it blocks out the whole screen,
// then reveals the main app underneath.

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

// Where takeoff/landing markers sit — just above the wireframe sphere
// (1.42) so the pin's base and the ripple ring don't z-fight with it, but
// well below flight altitude (ARC_RADIUS 1.46) so they read as sitting on
// the map rather than floating at cruising height.
const MARKER_RADIUS = 1.425;

// Color is a bare "r,g,b" triplet rather than a #hex/rgba() string, since
// rippleTexture() splices it into rgba(...) at several alpha values for its
// gradient. The takeoff mark matches the tracer line's own gold so it reads
// as "the trail just started here"; the landing mark stays yellow and gets
// a second, larger ripple ring since it's the more attention-grabbing of
// the two events. Shaped to match createMarkerPool's spawn(position, {...})
// config directly.
const TAKEOFF_MARK = { color: '200,184,122', duration: 550, pinHeight: 0.07, ringCount: 1, ringMaxScale: 0.4 };
const LANDING_MARK = { color: '255,210,63', duration: 900, pinHeight: 0.09, ringCount: 2, ringMaxScale: 0.55 };

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

// A soft annular band — transparent center, bright ring, fading to
// transparent at the edge — used for the takeoff/landing ripple, in the
// given "r,g,b" color triplet. Growing a flat quad mapped with this while
// fading its opacity reads as a ring expanding outward and dissipating,
// like a water ripple.
function rippleTexture(THREE, colorTriplet) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${colorTriplet},0)`);
  grad.addColorStop(0.55, `rgba(${colorTriplet},0)`);
  grad.addColorStop(0.68, `rgba(${colorTriplet},0.9)`);
  grad.addColorStop(0.82, `rgba(${colorTriplet},0.35)`);
  grad.addColorStop(1, `rgba(${colorTriplet},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
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

// Robert Penner's easeOutBack: eases 0→1, overshooting slightly past 1
// before settling — a springy "pop" rather than a linear rise. Used below,
// in createMarkerPool's update(), for the pin rising out of the surface.
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// A pool of brief takeoff/landing marks: a small 3D pin (cylinder) standing
// on the globe surface, plus one or more expanding-and-fading ripple rings
// lying flat against the surface around its base — the classic look of a
// droplet hitting water. Since planes chain journeys (each arrival becomes
// the next departure), both a takeoff mark and a landing mark spawn at the
// same shared hub point. Unlike createPlane(), this manages a variable-size
// pool of short-lived objects rather than one persistent one, so it exposes
// spawn()/update(now) instead of createPlane's single-object
// { sprite, tracer, update() } shape.
function createMarkerPool(THREE, globeGroup, pinGeometry, ringGeometry) {
  const active = [];
  const UP = new THREE.Vector3(0, 1, 0);
  const FORWARD = new THREE.Vector3(0, 0, 1);

  return {
    spawn(position, { color, duration, pinHeight, ringCount, ringMaxScale, ringTexture }) {
      const normal = position.clone().normalize();
      const surfaceQuat = new THREE.Quaternion().setFromUnitVectors(UP, normal);
      const ringQuat = new THREE.Quaternion().setFromUnitVectors(FORWARD, normal);
      const colorNum = parseInt(color.split(',').map((c) => Number(c).toString(16).padStart(2, '0')).join(''), 16);

      const pinMaterial = new THREE.MeshStandardMaterial({
        color: colorNum, emissive: colorNum, emissiveIntensity: 0.45,
        roughness: 0.4, metalness: 0.25, transparent: true
      });
      const pin = new THREE.Mesh(pinGeometry, pinMaterial);
      pin.quaternion.copy(surfaceQuat);
      pin.position.copy(position);
      pin.scale.set(1, 0, 1);
      globeGroup.add(pin);

      const rings = [];
      const ringOffset = normal.clone().multiplyScalar(0.003); // clears the pin/surface, avoids z-fighting
      for (let i = 0; i < ringCount; i++) {
        const ringMaterial = new THREE.MeshBasicMaterial({
          map: ringTexture, transparent: true, depthWrite: false, side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.quaternion.copy(ringQuat);
        ring.position.copy(position).add(ringOffset);
        ring.scale.set(0.001, 0.001, 1);
        globeGroup.add(ring);
        rings.push({ mesh: ring, material: ringMaterial, delayMs: i * 180 });
      }

      active.push({ pin, pinMaterial, pinHeight, rings, ringMaxScale, duration, start: performance.now() });
    },
    update(now) {
      for (let i = active.length - 1; i >= 0; i--) {
        const mark = active[i];
        const t = (now - mark.start) / mark.duration;
        if (t >= 1) {
          globeGroup.remove(mark.pin);
          mark.pinMaterial.dispose();
          mark.rings.forEach((ring) => { globeGroup.remove(ring.mesh); ring.material.dispose(); });
          active.splice(i, 1);
          continue;
        }

        // Pin: springs up to full height over the first 30% of the
        // duration, holds, then fades out over the last 35%. pinGeometry is
        // a shared unit-height cylinder, so pinHeight scales it to size here
        // rather than being baked into the (shared, reused) geometry itself.
        const riseT = easeOutBack(Math.min(t / 0.3, 1));
        mark.pin.scale.set(1, Math.max(0, riseT) * mark.pinHeight, 1);
        mark.pinMaterial.opacity = t < 0.65 ? 1 : Math.max(0, 1 - (t - 0.65) / 0.35);

        // Ripple rings: each starts on its own delay, then expands
        // outward while fading — the ring itself carries the "impact".
        mark.rings.forEach((ring) => {
          const elapsedMs = now - mark.start - ring.delayMs;
          if (elapsedMs < 0) { ring.mesh.visible = false; return; }
          ring.mesh.visible = true;
          const rt = Math.min(elapsedMs / (mark.duration - ring.delayMs), 1);
          const scale = 0.06 + mark.ringMaxScale * rt;
          ring.mesh.scale.set(scale, scale, 1);
          ring.material.opacity = Math.max(0, 1 - rt);
        });
      }
    },
    dispose() {
      active.forEach((mark) => {
        globeGroup.remove(mark.pin);
        mark.pinMaterial.dispose();
        mark.rings.forEach((ring) => { globeGroup.remove(ring.mesh); ring.material.dispose(); });
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
function createPlane(THREE, texture, globeGroup, camera, startHub, spawnMarkers) {
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
        // Marker sits on the surface (MARKER_RADIUS), not at flight
        // altitude (ARC_RADIUS) — recomputed from the old journey's arrival
        // hub, read before journey is reassigned below.
        spawnMarkers(latLonToVector3(THREE, journey.toHub.lat, journey.toHub.lon, MARKER_RADIUS));
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

  // Unit-height cylinder (base at y=0, not centered) shared by every pin —
  // per-spawn height comes from scaling it, not from separate geometries.
  const pinGeometry = new THREE.CylinderGeometry(0.018, 0.024, 1, 10);
  pinGeometry.translate(0, 0.5, 0);
  const ringGeometry = new THREE.PlaneGeometry(1, 1);

  const takeoffRingTex = rippleTexture(THREE, TAKEOFF_MARK.color);
  const landingRingTex = rippleTexture(THREE, LANDING_MARK.color);
  const markerPool = createMarkerPool(THREE, globeGroup, pinGeometry, ringGeometry);
  function spawnMarkers(position) {
    markerPool.spawn(position, { ...TAKEOFF_MARK, ringTexture: takeoffRingTex });
    markerPool.spawn(position, { ...LANDING_MARK, ringTexture: landingRingTex });
  }

  const planeTex = planeTexture(THREE);
  const planes = [0, 1, 2].map(() => createPlane(THREE, planeTex, globeGroup, camera, pickHub(), spawnMarkers));

  const reduced = reducedMotionPreferred();
  let frameId = null;

  function render() {
    if (!reduced) {
      globeGroup.rotation.y += 0.0022;
      planes.forEach((p) => p.update());
      markerPool.update(performance.now());
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
      markerPool.dispose();
      pinGeometry.dispose();
      ringGeometry.dispose();
      takeoffRingTex.dispose();
      landingRingTex.dispose();
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
