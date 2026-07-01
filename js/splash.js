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
const OCEAN_COLOR = '#1c4258';
const LAND_COLOR = '#4f7a3d';
const LAND_OUTLINE = 'rgba(233,225,205,0.35)';

// Real coastlines, simplified (Douglas-Peucker) from Natural Earth 1:110m
// land data (world-atlas's land-110m.json, via topojson-client) down to
// ~1000 points total — accurate silhouettes rather than hand-drawn blobs.
// Afro-Eurasia and the Americas are single connected landmasses, matching
// how they actually look from space; Antarctica is included. A handful of
// large, recognizable islands are kept (Greenland, Madagascar, Japan, etc);
// small/obscure islands (e.g. the Canadian Arctic archipelago) are dropped
// to keep the globe readable at this texture size. [lon, lat] pairs.
const CONTINENTS = [
  [ // Afro-Eurasia (n=341)
    [-180,68.96],[-174.34,66.34],[-174.57,67.06],[-171.86,66.91],[-169.9,65.98],[-172.53,65.44],
    [-172.95,64.25],[-179.88,65.87],[-180,64.98],[179.99,64.97],[177.41,64.61],[179.23,62.3],
    [173.68,61.65],[170.33,59.88],[168.9,60.57],[163.54,59.87],[162.02,58.24],[163.19,57.62],
    [162.12,54.85],[160.37,54.35],[160.02,53.2],[158.53,52.96],[156.79,51.01],[155.43,55.38],
    [155.92,56.77],[163.67,61.14],[164.47,62.55],[160.12,60.55],[159.3,61.77],[156.72,61.43],
    [154.22,59.76],[155.04,59.15],[142.2,59.04],[135.13,54.73],[138.16,53.75],[139.9,54.19],
    [141.38,52.24],[140.06,48.45],[138.22,46.31],[134.87,43.4],[132.28,43.28],[127.53,39.76],
    [129.46,36.78],[129.09,35.08],[126.49,34.39],[126.12,36.73],[126.86,36.89],[124.71,38.11],
    [125.32,39.55],[121.05,38.9],[122.17,40.42],[121.64,40.95],[118.04,39.2],[117.53,38.74],
    [118.91,37.45],[122.36,37.46],[119.15,34.91],[121.91,31.69],[121.68,28.23],[118.66,24.55],
    [115.89,22.78],[110.79,21.4],[110.44,20.34],[108.52,21.72],[105.88,19.75],[109.33,13.43],
    [109.2,11.67],[105.16,8.6],[105.08,9.92],[100.1,13.41],[99.22,9.24],[102.96,5.53],
    [104.23,1.29],[101.39,2.76],[100.09,6.46],[98.5,8.38],[98.34,7.79],[98.77,11.44],
    [97.16,16.93],[95.37,15.71],[94.19,16.04],[94.33,18.21],[91.42,22.77],[86.98,21.5],
    [86.5,20.15],[80.33,15.9],[79.86,10.36],[77.54,7.97],[73.53,15.99],[72.63,21.36],
    [70.47,20.88],[66.37,25.42],[57.4,25.74],[56.97,26.97],[54.72,26.48],[51.52,27.87],
    [50.11,30.15],[47.98,29.98],[50.81,24.75],[51.59,25.8],[51.8,24.02],[54.01,24.12],
    [56.36,26.4],[56.85,24.24],[59.81,22.31],[57.7,18.95],[55.27,17.23],[48.68,14],
    [43.48,12.64],[42.65,16.78],[39.14,21.29],[38.49,23.69],[34.63,28.06],[34.92,29.5],
    [33.92,27.65],[32.42,29.85],[35.53,23.1],[36.87,22],[37.48,18.61],[43.32,12.39],
    [42.72,11.74],[44.61,10.44],[51.11,12.02],[51.05,10.64],[47.74,4.22],[40.26,-2.57],
    [39.2,-4.68],[38.8,-6.48],[40.48,-10.77],[40.78,-14.69],[39.45,-16.72],[34.79,-19.78],
    [35.46,-24.12],[32.57,-25.73],[32.2,-28.75],[28.22,-32.77],[19.61,-34.82],[18.24,-33.87],
    [18.22,-31.66],[15.21,-27.09],[14.26,-22.11],[11.8,-18.07],[13.69,-10.73],[11.91,-5.04],
    [8.8,-1.11],[9.41,3.73],[8.5,4.77],[5.9,4.26],[4.33,6.27],[-1.96,4.71],
    [-9.01,4.83],[-12.43,7.26],[-16.61,12.17],[-17.62,14.73],[-16.15,18.11],[-16.97,21.89],
    [-14.44,26.25],[-9.56,29.93],[-9.3,32.57],[-5.93,35.76],[-2.17,35.17],[1.47,36.61],
    [9.51,37.35],[11.1,36.9],[10.34,33.79],[19.09,30.27],[20.13,32.24],[21.54,32.84],
    [28.91,30.87],[30.98,31.56],[33.77,30.97],[36,34.65],[36.16,36.65],[27.64,36.66],
    [26.17,39.46],[29.24,41.22],[33.51,42.02],[38.35,40.95],[41.7,41.96],[36.68,45.24],
    [39.12,47.26],[34.96,46.27],[36.33,45.11],[33.88,44.36],[32.45,45.33],[33.3,46.08],
    [30.75,46.58],[27.68,42.58],[28.81,41.06],[22.63,40.26],[24.04,37.65],[23.11,37.92],
    [23.15,36.42],[22.49,36.41],[19.41,40.25],[19.54,41.72],[13.14,45.74],[12.33,45.38],
    [12.59,44.09],[18.48,40.17],[16.87,40.44],[17.05,38.9],[16.1,37.99],[15.41,40.05],
    [8.89,44.37],[6.53,43.13],[3.1,43.07],[3.04,41.89],[0.81,41.01],[0.11,38.74],
    [-2.15,36.67],[-5.38,35.95],[-6.52,36.94],[-8.9,36.87],[-9.39,43.03],[-1.38,44.02],
    [-1.19,46.01],[-4.59,48.68],[-1.62,48.64],[-1.94,49.78],[1.34,50.13],[4.71,53.09],
    [8.12,53.53],[8.8,54.02],[8.54,57.11],[10.58,57.73],[10.91,56.46],[9.65,55.47],
    [10.94,54.01],[19.66,54.43],[21.27,55.19],[21.58,57.41],[24.12,57.03],[24.43,58.38],
    [23.34,59.19],[29.12,60.03],[22.87,59.85],[21.32,60.72],[21.54,63.19],[25.4,65.11],
    [23.9,66.01],[22.18,65.72],[21.37,64.41],[17.85,62.75],[17.12,61.34],[18.79,60.08],
    [16.83,58.72],[15.88,56.1],[12.94,55.36],[10.36,59.47],[8.38,58.31],[5.66,58.59],
    [4.99,61.97],[5.91,62.62],[19.18,69.82],[24.55,71.03],[28.16,71.19],[31.29,70.45],
    [30,70.19],[31.1,69.56],[36.51,69.06],[41.06,67.46],[41.13,66.79],[38.38,66],
    [33.18,66.63],[34.81,65.9],[34.94,64.41],[37.01,63.85],[36.52,64.78],[37.18,65.14],
    [39.59,64.52],[40.44,64.76],[39.76,65.5],[42.09,66.48],[43.95,66.07],[44.53,66.76],
    [43.45,68.57],[46.25,68.25],[46.82,67.69],[45.56,67.01],[46.35,66.67],[53.72,68.86],
    [54.47,68.81],[53.49,68.2],[58.8,68.88],[59.94,68.28],[61.08,68.94],[60.03,69.52],
    [60.55,69.85],[68.51,68.09],[69.18,68.62],[66.93,69.45],[66.7,71.03],[69.19,72.84],
    [72.59,72.78],[71.85,71.41],[72.79,70.39],[72.56,69.02],[73.67,68.41],[71.28,66.32],
    [72.42,66.17],[75.05,67.76],[74.94,68.99],[73.6,69.63],[74.4,70.63],[73.1,71.45],
    [74.89,72.12],[74.66,72.83],[75.68,72.3],[75.29,71.34],[76.36,71.15],[75.9,71.87],
    [77.58,72.27],[81.5,71.75],[80.51,73.65],[86.82,73.94],[86.01,74.46],[87.17,75.12],
    [100.76,76.43],[104.35,77.7],[107.24,76.48],[114.13,75.85],[109.4,74.18],[123.2,72.97],
    [123.26,73.74],[126.98,73.57],[131.29,70.79],[132.25,71.84],[139.87,71.49],[139.15,72.42],
    [140.47,72.85],[149.5,72.2],[152.97,70.84],[159,70.87],[160.94,69.44],[167.84,69.58],
    [169.58,68.69],[170.82,69.01],[170.45,70.1],[178.6,69.4],[-180,68.96],
  ],
  [ // Americas (n=226)
    [-90.55,69.5],[-90.55,68.47],[-89.21,69.26],[-87.35,67.2],[-85.52,69.88],[-82.62,69.66],
    [-81.28,69.16],[-81.96,68.13],[-81.26,67.6],[-83.35,66.41],[-85.77,66.56],[-87.32,64.78],
    [-93.16,62.02],[-94.68,58.95],[-93.21,58.78],[-92.3,57.09],[-82.27,55.15],[-82.13,53.28],
    [-79.91,51.21],[-78.6,52.56],[-79.83,54.67],[-76.54,56.53],[-78.52,58.81],[-77.34,59.85],
    [-78.11,62.32],[-73.84,62.44],[-69.59,61.06],[-69.29,58.96],[-67.65,58.21],[-64.58,60.34],
    [-61.4,56.97],[-61.8,56.34],[-57.33,54.63],[-55.68,52.15],[-60.03,50.24],[-66.4,50.23],
    [-71.11,46.82],[-65.05,49.23],[-64.17,48.74],[-65.12,48.07],[-64.47,46.24],[-61.52,45.88],
    [-60.52,47.01],[-59.8,45.92],[-65.36,43.55],[-66.16,44.47],[-64.42,45.29],[-67.14,45.14],
    [-70.69,43.03],[-69.96,41.64],[-73.71,40.93],[-71.94,40.93],[-73.95,40.75],[-74.91,38.94],
    [-75.53,39.5],[-75.06,38.4],[-75.94,37.22],[-76.35,39.15],[-76.33,38.08],[-76.96,38.23],
    [-75.73,35.55],[-81.34,31.44],[-80.38,25.21],[-81.71,25.87],[-84.1,30.09],[-89.18,30.32],
    [-89.22,29.29],[-90.15,29.12],[-93.85,29.71],[-96.59,28.31],[-97.87,22.44],[-96.29,19.32],
    [-94.43,18.14],[-92.04,18.71],[-90.77,19.28],[-90.28,21],[-87.05,21.54],[-88.93,15.89],
    [-83.41,15.27],[-83.81,11.1],[-81.44,8.79],[-79.57,9.61],[-76.84,8.64],[-74.91,11.08],
    [-71.75,12.44],[-71.14,12.11],[-71.95,11.42],[-71.7,9.07],[-71.4,10.97],[-69.94,12.16],
    [-68.19,10.56],[-61.88,10.72],[-62.39,9.95],[-57.15,5.97],[-53.96,5.76],[-51.32,4.2],
    [-49.97,1.74],[-50.39,-0.08],[-48.62,-0.23],[-48.58,-1.24],[-47.82,-0.58],[-44.91,-1.55],
    [-44.58,-2.69],[-39.98,-2.87],[-35.6,-5.15],[-34.73,-7.34],[-35.13,-9],[-38.67,-13.06],
    [-39.27,-17.87],[-40.95,-21.94],[-47.65,-24.89],[-48.89,-28.67],[-53.81,-34.4],[-56.22,-34.86],
    [-58.43,-33.91],[-56.79,-36.9],[-59.23,-38.72],[-62.34,-38.83],[-62.75,-41.03],[-65.12,-41.06],
    [-64.98,-42.06],[-63.46,-42.56],[-65.18,-43.49],[-65.57,-45.04],[-67.29,-45.55],[-67.58,-46.3],
    [-65.64,-47.24],[-65.99,-48.13],[-69.14,-50.73],[-68.15,-52.35],[-70.84,-52.9],[-71.01,-53.83],
    [-74.95,-52.26],[-75.61,-48.67],[-74.13,-46.94],[-75.65,-46.65],[-74.35,-44.1],[-73.24,-44.45],
    [-72.72,-42.38],[-74.33,-43.23],[-73.22,-39.26],[-73.59,-37.16],[-71.44,-32.42],[-70.16,-19.76],
    [-71.46,-17.36],[-76.01,-14.65],[-79.76,-7.19],[-81.25,-6.14],[-81.41,-4.74],[-79.77,-2.66],
    [-80.97,-2.25],[-80.93,-1.06],[-77.13,3.85],[-78.18,8.32],[-79.56,8.93],[-80.89,7.22],
    [-85.66,9.93],[-87.49,13.3],[-91.23,13.93],[-94.69,16.2],[-96.56,15.65],[-103.5,18.29],
    [-105.49,19.95],[-106.03,22.77],[-112.23,28.96],[-113.15,31.17],[-114.78,31.8],[-114.67,30.16],
    [-109.41,23.36],[-110.03,22.82],[-112.18,24.74],[-112.3,26.01],[-115.06,27.72],[-114.16,28.57],
    [-117.29,33.05],[-120.62,34.61],[-124.4,40.31],[-123.9,45.52],[-124.69,48.18],[-122.59,47.1],
    [-122.84,49],[-127.44,50.83],[-127.85,52.33],[-134.08,58.12],[-147.11,60.89],[-151.71,59.16],
    [-150.62,61.28],[-158.43,55.99],[-164.79,54.4],[-157.72,57.57],[-157.04,58.92],[-161.97,58.67],
    [-161.87,59.63],[-163.82,59.8],[-166.12,61.5],[-164.56,63.15],[-160.77,63.77],[-161.52,64.4],
    [-160.78,64.79],[-164.96,64.45],[-168.11,65.67],[-164.47,66.58],[-161.68,66.12],[-166.76,68.36],
    [-156.58,71.36],[-136.5,68.9],[-128.14,70.48],[-125.75,69.48],[-121.47,69.8],[-113.9,68.4],
    [-115.3,67.9],[-108.88,67.38],[-107.79,67.89],[-108.81,68.31],[-108.17,68.65],[-106.15,68.8],
    [-101.45,67.65],[-97.67,68.58],[-96.12,68.24],[-96.13,67.29],[-94.23,69.07],[-96.47,70.09],
    [-95.21,71.92],[-91.52,70.19],[-92.41,69.7],[-90.55,69.5],
  ],
  [ // Antarctica (n=97)
    [-180,-84.71],[-169.95,-83.88],[-158.07,-85.37],[-143.11,-85.04],[-153.59,-83.69],[-152.86,-82.04],
    [-156.84,-81.1],[-150.65,-81.34],[-146.42,-80.34],[-155.33,-79.06],[-158.05,-78.03],[-158.36,-76.89],
    [-151.33,-77.4],[-146.11,-76.48],[-146.2,-75.38],[-144.91,-75.2],[-113.94,-73.72],[-107.56,-75.18],
    [-100.12,-74.87],[-102.55,-74.11],[-103.68,-72.62],[-96.34,-73.62],[-90.09,-73.32],[-89.23,-72.56],
    [-76.22,-73.97],[-68.94,-73.01],[-67.14,-72.05],[-68.54,-69.72],[-67.25,-66.88],[-57.81,-63.27],
    [-57.22,-63.53],[-62.51,-65.09],[-62.12,-66.19],[-65.67,-67.95],[-61.81,-70.72],[-60.83,-73.7],
    [-70.6,-76.64],[-77.24,-76.71],[-73.65,-77.91],[-77.92,-78.38],[-78.03,-79.18],[-58.22,-83.22],
    [-49.76,-81.73],[-42.81,-82.08],[-28.55,-80.34],[-29.68,-79.26],[-35.64,-79.46],[-35.78,-78.34],
    [-17.52,-75.13],[-15.7,-74.5],[-16.46,-73.87],[-15.45,-73.15],[-10.29,-71.26],[-7.42,-71.7],
    [-6.87,-70.93],[-0.23,-71.64],[7.74,-69.89],[10.82,-70.83],[13.42,-69.97],[27.09,-70.46],
    [33.87,-68.5],[38.65,-69.78],[54.54,-65.82],[61.43,-67.95],[68.89,-67.93],[69.67,-69.23],
    [67.81,-70.3],[69.06,-70.68],[67.95,-71.85],[69.87,-72.26],[73.86,-69.88],[87.99,-66.21],
    [89.67,-67.15],[95.78,-67.39],[99.72,-67.25],[102.83,-65.56],[106.18,-66.94],[113.6,-65.88],
    [119.83,-67.27],[134.76,-66.21],[135.07,-65.31],[137.46,-66.96],[145.49,-66.91],[148.84,-68.39],
    [154.28,-68.56],[161.57,-70.58],[171.21,-71.7],[169.29,-73.66],[166.09,-74.38],[163.57,-76.24],
    [164.74,-78.18],[167,-78.75],[161.77,-79.16],[159.79,-80.95],[169.41,-83.83],[178.28,-84.47],
    [-180,-84.71],
  ],
  [ // Australia (n=71)
    [143.56,-13.76],[143.92,-14.55],[144.56,-14.17],[145.37,-14.99],[146.39,-18.96],[148.85,-20.39],
    [149.68,-22.34],[150.73,-22.4],[150.9,-23.46],[153.14,-26.07],[153.57,-28.11],[153.09,-30.92],
    [150.33,-35.67],[150,-37.43],[146.32,-39.04],[144.88,-38.42],[145.03,-37.9],[143.61,-38.81],
    [140.64,-38.02],[139.58,-36.14],[138.12,-35.61],[138.21,-34.39],[136.83,-35.26],[137.89,-33.64],
    [137.81,-32.9],[135.99,-34.89],[135.21,-34.48],[134.27,-32.62],[131.33,-31.5],[126.15,-32.22],
    [124.22,-32.96],[123.66,-33.89],[119.89,-33.98],[118.03,-35.06],[116.62,-35.03],[115.03,-34.2],
    [115.71,-33.26],[115.69,-31.61],[113.34,-26.12],[113.78,-26.55],[113.44,-25.62],[114.23,-26.3],
    [113.39,-24.38],[114.15,-21.76],[114.22,-22.52],[116.71,-20.7],[120.86,-19.68],[123.01,-16.41],
    [123.43,-17.27],[123.86,-17.07],[123.5,-16.6],[123.82,-16.11],[124.26,-16.33],[125.69,-14.23],
    [127.07,-13.82],[128.36,-14.87],[129.62,-14.97],[129.41,-14.42],[130.62,-12.54],[132.58,-12.11],
    [131.82,-11.27],[135.3,-12.25],[136.49,-11.86],[136.95,-12.35],[135.96,-13.32],[135.5,-15],
    [140.22,-17.71],[141.27,-16.39],[141.69,-12.41],[142.52,-10.67],[143.56,-13.76],
  ],
  [ // Greenland (n=74)
    [-27.1,83.52],[-20.85,82.73],[-31.9,82.2],[-22.07,81.73],[-23.17,81.15],[-15.77,81.91],
    [-12.21,81.29],[-20.05,80.18],[-17.73,80.13],[-19.7,78.75],[-19.67,77.64],[-18.47,76.98],
    [-21.68,76.63],[-19.83,76.1],[-19.6,75.25],[-20.67,75.16],[-19.37,74.3],[-21.59,74.22],
    [-20.44,73.82],[-20.76,73.46],[-23.57,73.31],[-22.3,72.18],[-24.79,72.33],[-22.13,71.47],
    [-21.75,70.66],[-23.54,70.47],[-25.54,71.43],[-25.2,70.75],[-26.36,70.23],[-22.35,70.13],
    [-27.75,68.47],[-31.78,68.12],[-34.2,66.68],[-39.81,65.46],[-40.67,64.84],[-41.19,63.48],
    [-42.82,62.68],[-42.42,61.9],[-43.38,60.1],[-48.26,60.86],[-51.63,63.63],[-52.28,65.18],
    [-53.66,66.1],[-53.3,66.84],[-53.97,67.19],[-52.98,68.36],[-51.48,68.73],[-50.87,69.93],
    [-53.46,69.28],[-54.68,69.61],[-54.36,70.82],[-51.39,70.57],[-55.83,71.66],[-54.72,72.59],
    [-58.59,75.52],[-61.27,76.1],[-68.5,76.06],[-71.4,77.01],[-66.76,77.38],[-73.3,78.04],
    [-73.16,78.43],[-65.71,79.4],[-65.32,79.76],[-68.02,80.12],[-62.24,81.32],[-62.65,81.77],
    [-57.21,82.19],[-53.04,81.89],[-50.39,82.44],[-44.52,81.66],[-46.9,82.2],[-46.76,82.63],
    [-38.62,83.55],[-27.1,83.52],
  ],
  [ // New Guinea (n=47)
    [134.14,-1.15],[134.42,-2.77],[135.46,-3.37],[136.29,-2.31],[137.44,-1.7],[138.33,-1.7],
    [144.58,-3.86],[145.83,-4.88],[145.98,-5.47],[147.65,-6.08],[147.89,-6.61],[146.97,-6.72],
    [147.19,-7.39],[148.09,-8.04],[148.73,-9.11],[149.31,-9.07],[149.27,-9.51],[150.8,-10.29],
    [150.69,-10.58],[147.91,-10.13],[146.05,-8.07],[144.74,-7.63],[143.29,-8.25],[143.41,-8.98],
    [142.63,-9.33],[141.03,-9.12],[140.14,-8.3],[139.13,-8.1],[138.88,-8.38],[137.61,-8.41],
    [138.04,-7.6],[138.67,-7.32],[137.93,-5.39],[135.17,-4.46],[133.66,-3.54],[132.98,-4.11],
    [132.75,-3.31],[131.99,-2.82],[133.78,-2.48],[133.7,-2.21],[132.23,-2.21],[131.84,-1.62],
    [130.94,-1.43],[130.52,-0.94],[132.38,-0.37],[133.98,-0.78],[134.14,-1.15],
  ],
  [ // Borneo (n=33)
    [117.87,1.83],[119,0.9],[117.81,0.78],[117.48,0.1],[117.52,-0.8],[116.56,-1.49],
    [116.15,-4.01],[116,-3.66],[114.86,-4.11],[114.47,-3.5],[113.26,-3.12],[112.07,-3.48],
    [111.7,-3],[110.22,-2.93],[110.07,-1.59],[109.09,-0.46],[109.07,1.34],[109.66,2.01],
    [110.4,1.66],[111.17,1.85],[111.37,2.7],[113,3.1],[116.73,6.92],[117.13,6.93],
    [117.69,5.99],[119.18,5.41],[119.11,5.02],[118.44,4.97],[118.62,4.48],[117.88,4.14],
    [117.31,3.24],[118.05,2.29],[117.87,1.83],
  ],
  [ // Madagascar (n=20)
    [50.06,-13.56],[50.38,-15.71],[50.2,-16],[49.86,-15.41],[49.67,-15.71],[49.78,-16.87],
    [47.1,-24.94],[45.41,-25.6],[44.04,-24.99],[43.25,-22.06],[44.38,-20.07],[43.96,-17.41],
    [44.45,-16.22],[46.31,-15.78],[47.71,-14.59],[48,-14.09],[47.87,-13.66],[48.29,-13.78],
    [49.2,-12.04],[50.06,-13.56],
  ],
  [ // Sumatra (n=18)
    [105.82,-5.85],[104.71,-5.87],[102.58,-4.22],[100.14,-0.65],[99.26,0.18],[98.6,1.82],
    [95.38,4.97],[95.29,5.48],[97.48,5.25],[100.64,2.1],[101.66,2.08],[103.84,0.1],
    [103.44,-0.71],[104.37,-1.08],[104.89,-2.34],[105.62,-2.43],[106.11,-3.06],[105.82,-5.85],
  ],
  [ // Great Britain (n=40)
    [-3,58.63],[-4.07,57.55],[-1.96,57.68],[-2.22,56.87],[-3.12,55.97],[-2.09,55.91],
    [-1.11,54.62],[-0.43,54.46],[0.47,52.93],[1.68,52.74],[1.56,52.1],[1.05,51.81],
    [1.45,51.29],[0.55,50.77],[-2.49,50.5],[-2.96,50.7],[-3.62,50.23],[-4.54,50.34],
    [-5.24,49.96],[-5.78,50.16],[-4.31,51.21],[-3.41,51.43],[-4.98,51.59],[-5.27,51.99],
    [-4.22,52.3],[-4.77,52.84],[-4.58,53.5],[-3.09,53.4],[-2.95,53.98],[-3.63,54.61],
    [-4.84,54.79],[-5.08,55.06],[-4.72,55.51],[-5.05,55.78],[-5.59,55.31],[-5.65,56.27],
    [-6.15,56.78],[-5.79,57.82],[-5.01,58.63],[-3,58.63],
  ],
  [ // Japan (n=32)
    [140.98,37.14],[140.6,36.34],[140.77,35.84],[140.25,35.14],[138.97,34.67],[137.22,34.61],
    [135.79,33.46],[135.12,33.85],[135.08,34.6],[130.99,33.89],[132,33.15],[131.33,31.45],
    [130.69,31.03],[130.2,31.42],[130.45,32.32],[129.82,32.61],[129.41,33.3],[130.36,33.6],
    [132.62,35.43],[134.61,35.73],[135.68,35.53],[136.72,37.3],[137.39,36.83],[139.43,38.22],
    [140.05,39.44],[139.88,40.56],[140.31,41.2],[141.37,41.38],[141.92,39.99],[141.88,39.18],
    [140.96,38.17],[140.98,37.14],
  ],
  [ // Iceland (n=18)
    [-14.51,66.46],[-14.74,65.81],[-13.61,65.13],[-14.91,64.36],[-18.66,63.5],[-22.76,63.96],
    [-21.78,64.4],[-23.96,64.89],[-22.19,65.08],[-22.23,65.38],[-24.33,65.61],[-23.65,66.26],
    [-22.13,66.41],[-20.58,65.73],[-19.06,66.28],[-17.8,65.99],[-16.17,66.53],[-14.51,66.46],
  ],
];

// Continent-center hub points used as flight endpoints. Every hub sits on
// the real landmass data above (verified with marker spheres at each point,
// from both the front and the 180°-rotated back of the globe).
const HUBS = [
  { name: 'na', lat: 40, lon: -100 },   // North America
  { name: 'sa', lat: -15, lon: -60 },   // South America
  { name: 'af', lat: 5, lon: 20 },      // Africa
  { name: 'eu', lat: 48, lon: 15 },     // Europe
  { name: 'as', lat: 35, lon: 100 },    // Asia
  { name: 'au', lat: -25, lon: 135 },   // Australia
];

const ARC_RADIUS = 1.46;
const ARC_BULGE = 0.32;
const TRACER_SEGMENTS = 48;

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
      // The "✈" glyph's own nose already points along rotation=0 (screen
      // +X, i.e. "right") — verified by rendering it at rotation 0/90/180/
      // 270° next to a reference arrow, so no extra offset is needed here.
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
