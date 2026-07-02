// ── splash.js ─────────────────────────────────────────────────────────────────
// Full-screen entry splash: a spinning 3D globe with land/ocean continents,
// tracer routes arcing continent-to-continent and landing on ripple markers,
// the Waypoint AI wordmark, and a single "Explore" button. Clicking it grows
// a color-matched circle over the globe until it blocks out the whole screen,
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

const ARC_BULGE = 0.32;
const TRACER_SEGMENTS = 48;

// Half-width, in world units, of the tracer ribbon on either side of its
// centerline — ~4-5px on a typical desktop viewport (globe radius 1.4 maps
// to roughly 270px there), scaling down naturally on smaller screens since
// it's sized in world units rather than fixed pixels. Enough to read clearly
// against the dark splash background without turning into a bold band.
const TRACER_HALF_WIDTH = 0.01;

// FPS-based degrade: WebGL support doesn't mean the device can drive this
// scene smoothly (Three.js failing to load is the only case handled before
// this). FPS_WARMUP_FRAMES skips the first stretch of frames — texture
// upload and JIT warmup make early frames unreliable — then one rolling
// FPS_SAMPLE_FRAMES-frame sample is checked; if it's under LOW_FPS_THRESHOLD,
// degradeQuality() drops to a coarser sphere, a single route, and pixelRatio
// 1. The globe can run for as long as the splash sits on screen (there's no
// auto-dismiss), so a slow device isn't just a one-off stutter.
const FPS_WARMUP_FRAMES = 30;
const FPS_SAMPLE_FRAMES = 40;
const LOW_FPS_THRESHOLD = 24;

// Where takeoff/landing markers sit — just above the wireframe sphere
// (1.42) so the flat dot and the ripple ring don't z-fight with it. Tracer
// routes now use this same radius as their start/end baseline (see
// createTracer) so a route visibly touches down on its landing marker
// instead of hovering above it.
const MARKER_RADIUS = 1.425;

// Color is a bare "r,g,b" triplet rather than a #hex/rgba() string, since
// rippleTexture() splices it into rgba(...) at several alpha values for its
// gradient. The takeoff mark matches the tracer line's own gold so it reads
// as "the trail just started here"; the landing mark stays yellow and gets
// a second, larger ripple ring since it's the more attention-grabbing of
// the two events. Shaped to match createMarkerPool's spawn(position, {...})
// config, aside from ringTexture, which is merged in at the call site since
// textures are created once in loadGlobe() rather than duplicated per mark.
const TAKEOFF_MARK = { color: '200,184,122', duration: 550, dotRadius: 0.05, ringCount: 1, ringMaxScale: 0.4 };
const LANDING_MARK = { color: '255,210,63', duration: 900, dotRadius: 0.065, ringCount: 2, ringMaxScale: 0.55 };

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
// before settling — a springy "pop" rather than a linear grow. Used below,
// in createMarkerPool's update(), for the dot popping onto the surface.
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// A pool of brief takeoff/landing marks: a flat circular dot lying flush
// against the globe surface, plus one or more expanding-and-fading ripple
// rings around it — the classic look of a droplet hitting water. Since
// routes chain journeys (each arrival becomes the next departure), both a
// takeoff mark and a landing mark spawn at the same shared hub point.
// Unlike createTracer(), this manages a variable-size pool of short-lived
// objects rather than one persistent one, so it exposes spawn()/update(now)
// instead of createTracer's single-object { tracer, update() } shape. It
// also takes two shared geometries (dotGeometry, ringGeometry), all built
// once in loadGlobe() and reused across every spawn.
function createMarkerPool(THREE, globeGroup, dotGeometry, ringGeometry) {
  const active = [];
  const FORWARD = new THREE.Vector3(0, 0, 1);

  return {
    spawn(position, { color, duration, dotRadius, ringCount, ringMaxScale, ringTexture }) {
      const normal = position.clone().normalize();
      // Both the dot and the rings are flat discs whose face should lie in
      // the plane tangent to the sphere at this point, so they share the
      // same orientation: their shared local "faces +Z" default rotated to
      // face along the surface normal.
      const surfaceQuat = new THREE.Quaternion().setFromUnitVectors(FORWARD, normal);
      const colorNum = parseInt(color.split(',').map((c) => Number(c).toString(16).padStart(2, '0')).join(''), 16);
      const offset = normal.clone().multiplyScalar(0.003); // clears the surface, avoids z-fighting

      const dotMaterial = new THREE.MeshStandardMaterial({
        color: colorNum, emissive: colorNum, emissiveIntensity: 0.45,
        roughness: 0.4, metalness: 0.25, transparent: true
      });
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      dot.quaternion.copy(surfaceQuat);
      dot.position.copy(position).add(offset);
      dot.scale.set(0.001, 0.001, 1);
      globeGroup.add(dot);

      const rings = [];
      for (let i = 0; i < ringCount; i++) {
        const ringMaterial = new THREE.MeshBasicMaterial({
          map: ringTexture, transparent: true, depthWrite: false, side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.quaternion.copy(surfaceQuat);
        ring.position.copy(position).add(offset);
        ring.scale.set(0.001, 0.001, 1);
        globeGroup.add(ring);
        rings.push({ mesh: ring, material: ringMaterial, delayMs: i * 180 });
      }

      active.push({ dot, dotMaterial, dotRadius, rings, ringMaxScale, duration, start: performance.now() });
    },
    update(now) {
      for (let i = active.length - 1; i >= 0; i--) {
        const mark = active[i];
        const t = (now - mark.start) / mark.duration;
        if (t >= 1) {
          globeGroup.remove(mark.dot);
          mark.dotMaterial.dispose();
          mark.rings.forEach((ring) => { globeGroup.remove(ring.mesh); ring.material.dispose(); });
          active.splice(i, 1);
          continue;
        }

        // Dot: pops to full size over the first 30% of the duration, holds,
        // then fades out over the last 35%. dotGeometry is a shared
        // unit-radius circle, so dotRadius scales it to size here rather
        // than being baked into the (shared, reused) geometry itself.
        const riseT = easeOutBack(Math.min(t / 0.3, 1));
        const dotScale = Math.max(0, riseT) * mark.dotRadius;
        mark.dot.scale.set(dotScale, dotScale, 1);
        mark.dotMaterial.opacity = t < 0.65 ? 1 : Math.max(0, 1 - (t - 0.65) / 0.35);

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
        globeGroup.remove(mark.dot);
        mark.dotMaterial.dispose();
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

// fromV/toV only encode direction here — arcPoint() re-normalizes them and
// scales by its own radius argument, so the magnitude passed in is discarded.
function buildJourney(THREE, fromHub, toHub) {
  const fromV = latLonToVector3(THREE, fromHub.lat, fromHub.lon, 1);
  const toV = latLonToVector3(THREE, toHub.lat, toHub.lon, 1);
  return { fromHub, toHub, fromV, toV };
}

// A flat ribbon mesh tracing a route continent-to-continent, revealed
// progressively as it "flies" and landing on a ripple marker at each hub.
// Each arrival becomes the next departure, so it reads as an ongoing route
// network rather than random hops. Returns a dispose-handle object mirroring
// the shape loadGlobe() itself returns, so the two compose the same way.
function createTracer(THREE, globeGroup, startHub, spawnMarkers) {
  const tracerMaterial = new THREE.MeshBasicMaterial({
    color: 0xc8b87a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false
  });
  const tracer = new THREE.Mesh(new THREE.BufferGeometry(), tracerMaterial);
  tracer.frustumCulled = false;
  globeGroup.add(tracer);

  // Triangle connectivity is identical for every journey (same sample
  // count each time) — built once here and reused across setTracerGeometry
  // calls, which only need to rebuild vertex positions.
  const indices = new Uint16Array(TRACER_SEGMENTS * 6);
  for (let i = 0; i < TRACER_SEGMENTS; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.set([a, b, c, b, d, c], i * 6);
  }

  let journey = buildJourney(THREE, startHub, pickHub(startHub.name));
  let progress = Math.random(); // stagger so all routes don't launch in sync
  const speed = 0.0007 + Math.random() * 0.0004;

  function setTracerGeometry() {
    const positions = new Float32Array((TRACER_SEGMENTS + 1) * 2 * 3);
    for (let i = 0; i <= TRACER_SEGMENTS; i++) {
      const t = i / TRACER_SEGMENTS;
      const p = arcPoint(THREE, journey.fromV, journey.toV, t, MARKER_RADIUS, ARC_BULGE);
      // Offset sideways along the tangent-plane binormal (tangent × radial
      // normal) rather than billboarding to the camera — this keeps the
      // ribbon correctly aligned with the arc as the globe rotates under a
      // static camera, since it's computed in the same rotating local space
      // as the geometry itself.
      const ahead = arcPoint(THREE, journey.fromV, journey.toV, Math.min(1, t + 0.01), MARKER_RADIUS, ARC_BULGE);
      const tangent = ahead.clone().sub(p).normalize();
      const side = tangent.clone().cross(p.clone().normalize()).normalize().multiplyScalar(TRACER_HALF_WIDTH);
      const left = p.clone().sub(side);
      const right = p.clone().add(side);
      const idx = i * 6;
      positions[idx] = left.x; positions[idx + 1] = left.y; positions[idx + 2] = left.z;
      positions[idx + 3] = right.x; positions[idx + 4] = right.y; positions[idx + 5] = right.z;
    }
    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    newGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
    newGeometry.setDrawRange(0, 0);
    tracer.geometry.dispose();
    tracer.geometry = newGeometry;
  }
  setTracerGeometry();

  return {
    tracer,
    update() {
      progress += speed;
      if (progress >= 1) {
        progress = 0;
        spawnMarkers(latLonToVector3(THREE, journey.toHub.lat, journey.toHub.lon, MARKER_RADIUS));
        journey = buildJourney(THREE, journey.toHub, pickHub(journey.toHub.name));
        setTracerGeometry();
      }

      const revealedPoints = Math.min(TRACER_SEGMENTS, Math.floor(progress * TRACER_SEGMENTS) + 1);
      const revealedSegments = Math.max(0, revealedPoints - 1);
      tracer.geometry.setDrawRange(0, revealedSegments * 6);
    },
    dispose() {
      globeGroup.remove(tracer);
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
  // Reassigned by degradeQuality() to a coarser geometry — dispose() below
  // always disposes whatever these currently point to.
  let globeGeometry = new THREE.SphereGeometry(1.4, 48, 48);
  const globeMaterial = new THREE.MeshStandardMaterial({ map: globeTexture, roughness: 0.65, metalness: 0.05 });
  const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
  globeGroup.add(globeMesh);

  let wireGeometry = new THREE.SphereGeometry(1.42, 24, 16);
  const wireMaterial = new THREE.MeshBasicMaterial({ color: 0xc8b87a, wireframe: true, transparent: true, opacity: 0.22 });
  const wireMesh = new THREE.Mesh(wireGeometry, wireMaterial);
  globeGroup.add(wireMesh);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.PointLight(0xc8b87a, 1.4, 20);
  key.position.set(3, 2, 4);
  scene.add(key);

  // Unit-radius flat circle shared by every dot — per-spawn size comes from
  // scaling it, not from separate geometries.
  const dotGeometry = new THREE.CircleGeometry(1, 24);
  const ringGeometry = new THREE.PlaneGeometry(1, 1);

  const takeoffRingTex = rippleTexture(THREE, TAKEOFF_MARK.color);
  const landingRingTex = rippleTexture(THREE, LANDING_MARK.color);
  const markerPool = createMarkerPool(THREE, globeGroup, dotGeometry, ringGeometry);
  function spawnMarkers(position) {
    markerPool.spawn(position, { ...TAKEOFF_MARK, ringTexture: takeoffRingTex });
    markerPool.spawn(position, { ...LANDING_MARK, ringTexture: landingRingTex });
  }

  const tracers = [0, 1, 2].map(() => createTracer(THREE, globeGroup, pickHub(), spawnMarkers));

  const reduced = reducedMotionPreferred();
  let frameId = null;

  // WebGL working doesn't mean it's working smoothly — this is the fallback
  // for a slow device, distinct from the try/catch in initSplash() that
  // handles WebGL/network being absent entirely.
  let degraded = false;
  let framesSeen = 0;
  let sampleStart = 0;
  let framesSinceSampleStart = 0;

  function degradeQuality() {
    degraded = true;
    renderer.setPixelRatio(1);
    while (tracers.length > 1) tracers.pop().dispose();
    globeGeometry.dispose();
    globeGeometry = new THREE.SphereGeometry(1.4, 24, 24);
    globeMesh.geometry = globeGeometry;
    wireGeometry.dispose();
    wireGeometry = new THREE.SphereGeometry(1.42, 16, 10);
    wireMesh.geometry = wireGeometry;
  }

  function maybeDegrade(now) {
    if (degraded) return;
    framesSeen++;
    if (framesSeen <= FPS_WARMUP_FRAMES) { sampleStart = now; framesSinceSampleStart = 0; return; }
    framesSinceSampleStart++;
    if (framesSinceSampleStart < FPS_SAMPLE_FRAMES) return;
    const fps = (framesSinceSampleStart / (now - sampleStart)) * 1000;
    if (fps < LOW_FPS_THRESHOLD) degradeQuality();
    sampleStart = now;
    framesSinceSampleStart = 0;
  }

  // rAF is paused (or heavily throttled) while the tab is hidden, so a sample
  // window straddling a backgrounding stretch would divide a real frame count
  // by a wall-clock gap of minutes — reading as near-zero fps and permanently
  // degrading a perfectly capable device. Restart the warmup on return instead
  // of letting stale sampleStart/framesSinceSampleStart feed that calculation.
  function onVisibilityChange() {
    if (!document.hidden) {
      framesSeen = 0;
      framesSinceSampleStart = 0;
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  function render() {
    if (!reduced) {
      const now = performance.now();
      globeGroup.rotation.y += 0.0022;
      tracers.forEach((t) => t.update());
      markerPool.update(now);
      maybeDegrade(now);
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
      document.removeEventListener('visibilitychange', onVisibilityChange);
      tracers.forEach((t) => t.dispose());
      markerPool.dispose();
      dotGeometry.dispose();
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
        // splash.remove() drops whatever had focus (the button, for keyboard
        // users who activated it via Enter/Space) back to <body> with no
        // visible indicator. Hand focus to the <main> landmark instead of
        // leaving it stranded.
        const main = document.querySelector('main');
        if (main) main.focus({ preventScroll: true });
      }, fadeMs);
    }, growMs);
  });
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────
export { initSplash };
