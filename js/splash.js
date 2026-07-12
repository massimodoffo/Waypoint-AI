// ── splash.js ─────────────────────────────────────────────────────────────────
// Full-screen entry splash: a spinning 3D globe with a real NASA-derived
// Earth photograph (day map + specular ocean glint + normal-mapped terrain +
// a drifting cloud layer) under a wireframe "AI overlay" grid, tracer routes
// lying flat against the surface continent-to-continent and landing on
// ripple markers, the Waypoint AI wordmark, and a single "Explore" button.
// Clicking it grows a color-matched circle over the globe until it blocks
// out the whole screen, then reveals the main app underneath.

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

// Slow enough that a route's ~15-25s flight reads as unhurried against the
// backdrop, rather than the globe spinning fast enough to compete with the
// tracer animations for attention.
const GLOBE_ROTATION_SPEED = 0.0022 * 0.85;

const TRACER_SEGMENTS = 48;

// How many routes animate at once. Higher than the visual minimum needed at
// any single instant so that, with routes starting at staggered random
// progress and taking ~15-25s each, there's essentially always at least one
// visible mid-flight rather than occasional gaps between landings.
const TRACER_COUNT = 5;

// How many routes degradeQuality() leaves running on a slow device. Kept
// above 1 so the FPS-based fallback (see below) doesn't compound its own
// sphere/pixelRatio cuts with an equally abrupt drop from 5 routes to a
// single one in the same frame.
const DEGRADED_TRACER_COUNT = 2;

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
// degradeQuality() drops to a coarser sphere, DEGRADED_TRACER_COUNT routes,
// and pixelRatio 1. The globe can run for as long as the splash sits on
// screen (there's no auto-dismiss), so a slow device isn't just a one-off
// stutter.
const FPS_WARMUP_FRAMES = 30;
const FPS_SAMPLE_FRAMES = 40;
const LOW_FPS_THRESHOLD = 24;

// Where takeoff/landing markers sit — just above the wireframe sphere
// (1.42) so the flat dot and the ripple ring don't z-fight with it. Tracer
// routes now use this same radius for their entire length (see
// createTracer), lying flat against the globe rather than arcing above it,
// so a route visibly touches down on its landing marker instead of
// hovering above it.
const MARKER_RADIUS = 1.425;

// Color is a bare "r,g,b" triplet rather than a #hex/rgba() string, since
// rippleTexture() splices it into rgba(...) at several alpha values for its
// gradient. The takeoff mark matches the tracer line's own accent blue so it
// reads as "the trail just started here"; the landing mark stays yellow and
// gets a second, larger ripple ring since it's the more attention-grabbing of
// the two events. Shaped to match createMarkerPool's spawn(position, {...})
// config, aside from ringTexture, which is merged in at the call site since
// textures are created once in loadGlobe() rather than duplicated per mark.
const TAKEOFF_MARK = { color: '91,143,255', duration: 550, dotRadius: 0.05, ringCount: 1, ringMaxScale: 0.4 };
const LANDING_MARK = { color: '255,210,63', duration: 900, dotRadius: 0.065, ringCount: 2, ringMaxScale: 0.55 };

function equirectXY(lon, lat, w, h) {
  return [(lon + 180) / 360 * w, (90 - lat) / 180 * h];
}

// Draws a flat, stylized land/ocean map from real coastline data. This is
// the globe's *placeholder* texture now — painted instantly with no network
// round-trip so the globe never renders blank while loadRealEarthTextures()
// (below) streams in the actual NASA-derived photograph in the background,
// and the fallback if that fetch fails (offline, blocked CDN). Each ring is
// drawn three times, offset a full map-width left/right, so landmasses that
// cross the antimeridian (like Afro-Eurasia's Siberian edge) wrap correctly
// instead of leaving a seam artifact.
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

// Spherical-linear-interpolates between two surface points at a constant
// radius, so the resulting path lies flat against the globe — a great-circle
// route arc rather than one that lifts above the surface.
function arcPoint(THREE, fromV, toV, t, radius) {
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
  return point.normalize().multiplyScalar(radius);
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

// ── STARFIELD ────────────────────────────────────────────────────────────────
// 1200 points reads as a full sky at this camera distance without enough
// overdraw to show up in the FPS budget degradeQuality() already accounts
// for (a single Points draw call stays cheap regardless of count in the
// low thousands — this wasn't tuned against a hard perf ceiling, just
// against "looks sparse" at the low end and "looks like static/noise" at
// the high end). The 14-32 shell sits well outside the globe (radius 1.4)
// and the camera's own travel range (CAMERA_INTRO_START_Z 10.5 down to
// CAMERA_REST_Z 6.5, both defined below), so the camera can never end up
// inside the shell or clip through it.
const STAR_COUNT = 1200;
const STAR_MIN_RADIUS = 14;
const STAR_MAX_RADIUS = 32;

// A soft circular sprite (radial gradient, no hard edge) shared by every star
// point — canvas-generated like earthTexture()/rippleTexture() above, so this
// file keeps its "no external image assets" approach instead of mixing in a
// texture file for one more effect.
function starSpriteTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

// A distant, non-rotating field of points scattered on a spherical shell well
// outside the globe/tracer geometry (radius 14-32 vs. the globe's 1.4).
// Added straight to `scene` rather than `globeGroup` so it reads as a fixed
// backdrop the globe spins in front of, not part of the globe itself — a
// single Points draw call, cheap enough that it isn't wired into
// degradeQuality() below.
function createStarfield(THREE, scene) {
  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    // Uniform point on a sphere shell: pick a uniformly-distributed direction
    // via spherical angles (theta around the pole, phi from an inverse-CDF
    // cosine sample so points don't bunch at the poles), then a random
    // radius within the shell's thickness.
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    const r = STAR_MIN_RADIUS + Math.random() * (STAR_MAX_RADIUS - STAR_MIN_RADIUS);
    const idx = i * 3;
    positions[idx] = r * Math.sin(phi) * Math.cos(theta);
    positions[idx + 1] = r * Math.cos(phi);
    positions[idx + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const texture = starSpriteTexture(THREE);
  const material = new THREE.PointsMaterial({
    size: 0.09, map: texture, transparent: true, depthWrite: false,
    opacity: 0.75, sizeAttenuation: true
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  return {
    dispose() {
      scene.remove(points);
      geometry.dispose();
      material.dispose();
      texture.dispose();
    }
  };
}

// ── ATMOSPHERE GLOW ─────────────────────────────────────────────────────────
// A soft, additive-blended halo around the globe's silhouette — a billboarded
// sprite (Three.js auto-orients it to face the camera, so no per-frame
// orientation work is needed) rather than a custom shader, matching this
// file's existing canvas-texture-over-GLSL approach used for the ripple
// marks above.
// The gradient's inner stop (radius 60 of 128, i.e. ~47% in) leaves the
// globe itself (radius 1.4, well inside the sprite's footprint — see scale
// below) untouched by the glow; it only starts past the globe's own edge.
// The 0.7 stop is where the glow peaks (alpha 0.16 — low, so it reads as
// atmosphere rather than a colored ring) before fading back to transparent
// at the sprite's own edge, so there's no hard cutoff visible. Sprite scale
// 4.2 (diameter, world units) against the globe's 1.4 radius / 2.8 diameter
// leaves roughly a 0.7-unit halo beyond the surface on every side — visible
// without dominating the frame at the camera's resting distance.
function createAtmosphere(THREE, scene, colorTriplet) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 60, 128, 128, 128);
  grad.addColorStop(0, `rgba(${colorTriplet},0)`);
  grad.addColorStop(0.7, `rgba(${colorTriplet},0.16)`);
  grad.addColorStop(1, `rgba(${colorTriplet},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(c);

  const material = new THREE.SpriteMaterial({
    map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4.2, 4.2, 1);
  scene.add(sprite);

  return {
    dispose() {
      scene.remove(sprite);
      material.dispose();
      texture.dispose();
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
    color: 0x5b8fff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false
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
  // Backs the position BufferAttribute — kept as a closure reference (rather
  // than only living inside the attribute) so the per-frame tip update below
  // can write directly into it instead of rebuilding the whole geometry.
  let positions = null;

  // Computes the ribbon's left/right offset vertices at parameter t and
  // writes them into `positions` at sample slot i (each slot holds one
  // left/right pair = 6 floats). Shared by the full-path bake in
  // setTracerGeometry() and by the per-frame leading-edge update in
  // update(), so both use identical offset math.
  function writeRibbonPoint(i, t) {
    const p = arcPoint(THREE, journey.fromV, journey.toV, t, MARKER_RADIUS);
    // Offset sideways along the tangent-plane binormal (tangent × radial
    // normal) rather than billboarding to the camera — this keeps the
    // ribbon correctly aligned with the arc as the globe rotates under a
    // static camera, since it's computed in the same rotating local space
    // as the geometry itself.
    const ahead = arcPoint(THREE, journey.fromV, journey.toV, Math.min(1, t + 0.01), MARKER_RADIUS);
    const tangent = ahead.clone().sub(p).normalize();
    const side = tangent.clone().cross(p.clone().normalize()).normalize().multiplyScalar(TRACER_HALF_WIDTH);
    const left = p.clone().sub(side);
    const right = p.clone().add(side);
    const idx = i * 6;
    positions[idx] = left.x; positions[idx + 1] = left.y; positions[idx + 2] = left.z;
    positions[idx + 3] = right.x; positions[idx + 4] = right.y; positions[idx + 5] = right.z;
  }

  // Tracks the last segment boundary crossed, so update() can tell when the
  // live tip has just become a fully-passed point (see the re-snap below).
  // Reset alongside `positions` on every rebuild since a fresh journey's
  // sample points are all freshly baked exact, with no live tip yet.
  let lastRevealedSegment = -1;

  function setTracerGeometry() {
    positions = new Float32Array((TRACER_SEGMENTS + 1) * 2 * 3);
    for (let i = 0; i <= TRACER_SEGMENTS; i++) {
      writeRibbonPoint(i, i / TRACER_SEGMENTS);
    }
    lastRevealedSegment = -1;
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

      // Every fully-passed sample point stays at its baked position from
      // setTracerGeometry(); only the leading edge (the point just past the
      // last fully-revealed segment) is rewritten every frame, at the exact
      // continuous `progress` value rather than the nearest baked sample —
      // this is what makes the ribbon grow smoothly instead of popping
      // forward in whole 1/TRACER_SEGMENTS steps.
      const revealedSegment = Math.min(TRACER_SEGMENTS - 1, Math.floor(progress * TRACER_SEGMENTS));
      if (revealedSegment > lastRevealedSegment) {
        // `speed` is always well under one segment's width, so at most one
        // boundary is crossed per frame: the point that was the live tip a
        // moment ago is now fully passed, but was last written at whatever
        // continuous `progress` it held right before crossing — snap it back
        // to its exact baked t = revealedSegment/TRACER_SEGMENTS position so
        // it doesn't sit a fraction of a frame short forever.
        writeRibbonPoint(revealedSegment, revealedSegment / TRACER_SEGMENTS);
        lastRevealedSegment = revealedSegment;
      }
      writeRibbonPoint(revealedSegment + 1, progress);
      tracer.geometry.attributes.position.needsUpdate = true;
      tracer.geometry.setDrawRange(0, (revealedSegment + 1) * 6);
    },
    dispose() {
      globeGroup.remove(tracer);
      tracer.geometry.dispose();
      tracerMaterial.dispose();
    }
  };
}

// ── CAMERA & PARALLAX ───────────────────────────────────────────────────────
// Camera opens from further back and settles into its resting distance over
// CAMERA_INTRO_MS — an arrival shot rather than the scene just appearing
// already framed. CAMERA_REST_Z (6.5) is the original always-been-static
// distance this scene used before the intro was added; CAMERA_INTRO_START_Z
// pulls back an extra ~60% of that so the settle is visible without the
// globe reading as tiny at the start. PARALLAX_MAX bounds how far the
// resting camera drifts toward the pointer afterward (in the same world
// units as CAMERA_REST_Z) — 0.35 against a 6.5-unit viewing distance keeps
// the drift subtle enough to read as "alive" rather than disorienting.
// PARALLAX_SMOOTHING is a per-frame lerp factor (toward the pointer target,
// not a duration) — 0.05 settles in roughly a third of a second at 60fps.
const CAMERA_REST_Z = 6.5;
const CAMERA_INTRO_START_Z = 10.5;
const CAMERA_INTRO_MS = 2200;
const PARALLAX_MAX = 0.35;
const PARALLAX_SMOOTHING = 0.05;

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// Official three.js example assets — NASA Blue Marble-derived day map,
// ocean specular mask, terrain normal map, and a cloud layer. Hosted on
// three.js's own domain (same trust boundary as the "three" package itself,
// already loaded from unpkg via the import map in index.html) rather than a
// bundled file, matching this project's existing "CDN asset, degrade
// gracefully if it doesn't load" posture (see the Leaflet-vendoring and
// Google-Maps-embed-key comments elsewhere in this codebase for the same
// trade-off made the other way, where the asset was vendored instead).
const EARTH_DAY_MAP_URL = 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg';
const EARTH_SPECULAR_MAP_URL = 'https://threejs.org/examples/textures/planets/earth_specular_2048.jpg';
const EARTH_NORMAL_MAP_URL = 'https://threejs.org/examples/textures/planets/earth_normal_2048.jpg';
const EARTH_CLOUDS_MAP_URL = 'https://threejs.org/examples/textures/planets/earth_clouds_1024.png';
const EARTH_TEXTURE_TIMEOUT_MS = 8000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('texture load timed out')), ms))
  ]);
}

// Streams in the real Earth photograph set in the background — never awaited
// by loadGlobe() itself, so the splash's first frame always paints instantly
// with the procedural earthTexture() placeholder above rather than blocking
// on a multi-hundred-KB image fetch. Returns null (rather than throwing) on
// any failure so the caller's .then() has one shape to handle either way.
async function loadRealEarthTextures(THREE) {
  const loader = new THREE.TextureLoader();
  try {
    const [day, specular, normal, clouds] = await withTimeout(
      Promise.all([
        loader.loadAsync(EARTH_DAY_MAP_URL),
        loader.loadAsync(EARTH_SPECULAR_MAP_URL),
        loader.loadAsync(EARTH_NORMAL_MAP_URL),
        loader.loadAsync(EARTH_CLOUDS_MAP_URL)
      ]),
      EARTH_TEXTURE_TIMEOUT_MS
    );
    day.colorSpace = THREE.SRGBColorSpace;
    return { day, specular, normal, clouds };
  } catch (err) {
    console.error('[Waypoint] real Earth textures failed to load, keeping stylized placeholder:', err);
    return null;
  }
}

async function loadGlobe(canvas) {
  const THREE = await import('three');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = CAMERA_REST_Z;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  const globeTexture = earthTexture(THREE);
  // Reassigned by degradeQuality() to a coarser geometry — dispose() below
  // always disposes whatever these currently point to. MeshPhongMaterial
  // (not MeshStandardMaterial) specifically so the real ocean specular map
  // loaded in below has something to plug into — Standard's PBR roughness/
  // metalness workflow has no specularMap slot.
  let globeGeometry = new THREE.SphereGeometry(1.4, 48, 48);
  const globeMaterial = new THREE.MeshPhongMaterial({ map: globeTexture, shininess: 12, specular: 0x223344 });
  const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
  globeGroup.add(globeMesh);

  let wireGeometry = new THREE.SphereGeometry(1.42, 24, 16);
  const wireMaterial = new THREE.MeshBasicMaterial({ color: 0x5b8fff, wireframe: true, transparent: true, opacity: 0.22 });
  const wireMesh = new THREE.Mesh(wireGeometry, wireMaterial);
  globeGroup.add(wireMesh);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.PointLight(0x5b8fff, 1.4, 20);
  key.position.set(3, 2, 4);
  scene.add(key);

  // Populated once loadRealEarthTextures() resolves (see below the render
  // loop) — kept as outer-scope handles so degradeQuality() can drop the
  // cloud layer's overdraw on slow devices and dispose() can always clean up
  // whatever's currently live, whether or not the real textures ever arrived.
  let cloudMesh = null;
  let cloudGeometry = null;
  let cloudMaterial = null;
  let realTextures = null;
  let disposed = false;

  const starfield = createStarfield(THREE, scene);
  const atmosphere = createAtmosphere(THREE, scene, '91,143,255');

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

  const tracers = Array.from({ length: TRACER_COUNT }, () => createTracer(THREE, globeGroup, pickHub(), spawnMarkers));

  // Fire-and-forget: never awaited here, so the globe above has already
  // painted its first frame with the instant placeholder texture by the
  // time this resolves (or times out / fails) a beat later.
  loadRealEarthTextures(THREE).then((textures) => {
    if (disposed || !textures) return;
    realTextures = textures;
    globeMaterial.map = textures.day;
    globeMaterial.specularMap = textures.specular;
    globeMaterial.normalMap = textures.normal;
    globeMaterial.normalScale.set(0.85, 0.85);
    globeMaterial.needsUpdate = true;

    // Slightly larger than the globe (1.4) but still under the wireframe
    // overlay (1.42), so the layering reads front-to-back as: photograph →
    // drifting clouds → AI wireframe grid → tracers/markers.
    cloudGeometry = new THREE.SphereGeometry(1.41, 48, 48);
    cloudMaterial = new THREE.MeshStandardMaterial({
      map: textures.clouds, transparent: true, opacity: 0.55, depthWrite: false, roughness: 1
    });
    cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    globeGroup.add(cloudMesh);
  });

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
    while (tracers.length > DEGRADED_TRACER_COUNT) tracers.pop().dispose();
    globeGeometry.dispose();
    globeGeometry = new THREE.SphereGeometry(1.4, 24, 24);
    globeMesh.geometry = globeGeometry;
    wireGeometry.dispose();
    wireGeometry = new THREE.SphereGeometry(1.42, 16, 10);
    wireMesh.geometry = wireGeometry;
    // The cloud layer is a second full-sphere overdraw pass (transparent,
    // on top of the already-lit globe) — the single most expensive part of
    // the real-texture upgrade, so it's the first thing degradeQuality()
    // sheds. The photo/specular/normal maps stay; they cost no more render
    // time than the flat placeholder texture they replaced.
    if (cloudMesh) {
      globeGroup.remove(cloudMesh);
      cloudGeometry.dispose();
      cloudMaterial.dispose();
      if (realTextures && realTextures.clouds) { realTextures.clouds.dispose(); realTextures.clouds = null; }
      cloudMesh = null;
      cloudGeometry = null;
      cloudMaterial = null;
    }
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

  // Pointer-driven parallax target, in normalized [-1,1] viewport space
  // scaled by PARALLAX_MAX — smoothed toward in render() rather than applied
  // directly, so a fast mouse move reads as a gentle drift, not a jump.
  // Restricted to actual mouse input (pointerType check) since a touch
  // pointermove is usually a scroll/drag gesture, not a "look around" intent.
  let parallaxTargetX = 0;
  let parallaxTargetY = 0;
  let parallaxX = 0;
  let parallaxY = 0;
  function onPointerMove(e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    parallaxTargetX = ((e.clientX / window.innerWidth) * 2 - 1) * PARALLAX_MAX;
    parallaxTargetY = ((e.clientY / window.innerHeight) * 2 - 1) * PARALLAX_MAX;
  }
  if (!reduced) window.addEventListener('pointermove', onPointerMove);

  const introStart = performance.now();

  function render() {
    if (!reduced) {
      const now = performance.now();
      globeGroup.rotation.y += GLOBE_ROTATION_SPEED;
      // Clouds are a child of globeGroup (so they inherit its base spin) but
      // drift a further 15% on top of that — real weather doesn't co-rotate
      // exactly with the land beneath it, and the mismatch is what reads as
      // "alive" rather than a texture painted onto the same rigid sphere.
      if (cloudMesh) cloudMesh.rotation.y += GLOBE_ROTATION_SPEED * 0.15;
      tracers.forEach((t) => t.update());
      markerPool.update(now);
      maybeDegrade(now);

      const introT = Math.min((now - introStart) / CAMERA_INTRO_MS, 1);
      const introZ = CAMERA_INTRO_START_Z + (CAMERA_REST_Z - CAMERA_INTRO_START_Z) * easeOutCubic(introT);
      parallaxX += (parallaxTargetX - parallaxX) * PARALLAX_SMOOTHING;
      parallaxY += (parallaxTargetY - parallaxY) * PARALLAX_SMOOTHING;
      camera.position.x = parallaxX;
      camera.position.y = -parallaxY;
      camera.position.z = introZ;
      camera.lookAt(0, 0, 0);

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
      // Set first: guards the loadRealEarthTextures().then() continuation
      // above, which can still be in flight (or resolve just after) if the
      // user clicks through before the ~image fetches finish — same
      // dismissed-before-load race initSplash() already handles for the
      // globe handle itself.
      disposed = true;
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      tracers.forEach((t) => t.dispose());
      markerPool.dispose();
      starfield.dispose();
      atmosphere.dispose();
      dotGeometry.dispose();
      ringGeometry.dispose();
      takeoffRingTex.dispose();
      landingRingTex.dispose();
      globeGeometry.dispose();
      globeMaterial.dispose();
      globeTexture.dispose();
      if (realTextures) {
        realTextures.day.dispose();
        realTextures.specular.dispose();
        realTextures.normal.dispose();
        if (realTextures.clouds) realTextures.clouds.dispose();
      }
      if (cloudMesh) {
        globeGroup.remove(cloudMesh);
        cloudGeometry.dispose();
        cloudMaterial.dispose();
      }
      wireGeometry.dispose();
      wireMaterial.dispose();
      renderer.dispose();
    }
  };
}

// Pulls the button a few pixels toward the cursor within its own bounds —
// the single primary CTA of the whole cinematic entry, so it's the one
// control on this screen that earns a "magnetic" hover treatment. Restricted
// to fine-pointer/hover-capable devices (same gate interactive.js's
// motionAllowed() uses, redefined locally rather than imported since
// splash.js already keeps its own reducedMotionPreferred() separate from
// interactive.js's motionAllowed() — see that function's comment above; the
// pointer-offset-from-center math below duplicates applyTilt()'s in
// interactive.js for the same reason — these two files intentionally don't
// import from each other, each staying a self-contained entry point).
// MAX_PULL is kept small (8px against a ~150px-wide pill button) so the
// effect reads as "responsive to the cursor," not as the button chasing it.
//
// btn.style.transform is set inline here, which — same hazard documented on
// interactive.js's applyTilt()/resetTilt() — fully overrides the CSS
// :hover/:active transforms rather than composing with them. apply() bakes
// the CSS states' own offsets (hover lift, press scale) directly into the
// same inline string instead of leaving them to the stylesheet, so the two
// don't fight; pointerleave AND the click handler below (which disables the
// button) both reset the inline value so CSS regains control once this
// effect isn't actively driving the transform.
function initMagneticButton(btn) {
  if (reducedMotionPreferred() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return null;
  const MAX_PULL = 8;
  let pullX = 0;
  let pullY = 0;
  let pressed = false;

  function apply() {
    const scale = pressed ? 0.96 : 1;
    const lift = pressed ? -1 : -2;
    btn.style.transform = `translate(${pullX}px, ${pullY + lift}px) scale(${scale})`;
  }
  function onMove(e) {
    const rect = btn.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    pullX = Math.max(-1, Math.min(1, dx)) * MAX_PULL;
    pullY = Math.max(-1, Math.min(1, dy)) * MAX_PULL;
    apply();
  }
  function reset() { pressed = false; pullX = 0; pullY = 0; btn.style.transform = ''; }
  function onDown() { pressed = true; apply(); }
  function onUp() { pressed = false; apply(); }

  btn.addEventListener('pointermove', onMove);
  btn.addEventListener('pointerleave', reset);
  btn.addEventListener('pointerdown', onDown);
  btn.addEventListener('pointerup', onUp);

  return { reset };
}

// ── SPLASH TRANSITION ───────────────────────────────────────────────────────
function initSplash() {
  const splash = document.getElementById('splash');
  const startBtn = document.getElementById('splashStartBtn');
  const blockout = document.getElementById('splashBlockout');
  const canvas = document.getElementById('splashCanvas');
  if (!splash || !startBtn || !blockout || !canvas) return;

  const magneticBtn = initMagneticButton(startBtn);

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
    // Disabled elements stop dispatching pointer events, so pointerleave
    // (which would normally reset the magnetic pull) never fires if the
    // click landed while the cursor was off-center over the button —
    // reset explicitly or the inline transform is stuck offset for the
    // remainder of the leave transition.
    if (magneticBtn) magneticBtn.reset();
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
