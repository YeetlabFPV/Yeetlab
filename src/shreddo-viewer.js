import {
  AmbientLight, Box3, CanvasTexture, Color, DirectionalLight, EdgesGeometry, Group, HemisphereLight,
  LineBasicMaterial, LineSegments, LinearMipmapLinearFilter, PerspectiveCamera, RepeatWrapping, PCFSoftShadowMap, Scene,
  Spherical, Vector3, WebGLRenderer, MathUtils, NeutralToneMapping,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { heroPresets, studioParts } from './shreddo-colours.js';
import { MeshoptDecoder as wasmDecoder } from 'meshoptimizer/decoder';
import { MeshoptDecoder as jsDecoder } from './vendor/meshopt_decoder_reference.js';

let MeshoptDecoder = jsDecoder;
try {
  if (wasmDecoder.supported) {
    await wasmDecoder.ready;
    MeshoptDecoder = wasmDecoder;
  }
} catch {
  // The production Content Security Policy can deny WebAssembly compilation.
}

const modelUrl = new URL('./shreddo.glb', import.meta.url);
// The rear braces echo the canopy colour. The camera inserts echo the shoes.
const filamentPalettes = heroPresets.map(([, first, second]) => [new Color(first), new Color(second)]);
const filamentZone = Object.fromEntries(studioParts.flatMap(part => part.groups.map(group => [group, part.zone])));
filamentZone.softLock = 1;
const colorPeriod = 3500;
const fadeDuration = 320;
const aspect = 4 / 3;
const clamp = (value) => MathUtils.clamp(value, 0, 1);

// Disassembly follows the build guide in reverse. Travel is in STEP millimetres.
// Each row defines the scroll interval and the final offset in world coordinates.
const movements = {
  topScrew: [0, .32, 0, 100, 0],
  horn: [.06, .44, -7, 66, 0],
  pad: [.06, .44, 0, 64, 0],
  top: [.12, .53, 0, 45, 0],
  rearTop: [.12, .53, 13, 51, 0],
  bottomScrew: [0, .4, 0, -65, 0],
  standoff: [.3, .73, 0, 17, 15],
  rearSide: [.24, .70, 24, 14, 29],
  rearBottom: [.25, .72, 28, -21, 0],
  cage: [.25, .73, -41, 5, 0],
  cameraSide: [.35, .79, -31, 2, 30],
  bumper: [.31, .77, -27, -26, 0],
  stackNut: [.26, .67, 0, 39, 0],
  stackScrew: [.31, .72, 0, -56, 0],
  armNut: [.3, .68, 0, 28, 0],
  armBolt: [.18, .62, 0, -48, 0],
  mid: [.31, .73, 0, 21, 0],
  bottom: [.32, .76, 0, -37, 0],
  upperLock: [.45, .83, 0, 7, 0],
  softLock: [.49, .90, 0, -10, 0],
  lowerLock: [.53, .94, 0, -23, 0],
  arm: [.55, 1, 41, 0, 49],
  armProtector: [.55, 1, 41, 0, 49],
  guard: [.55, 1, 54, -8, 65],
};

function carbonWeave(renderer) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 64;
  const context = tile.getContext('2d');
  const image = context.createImageData(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const column = Math.floor(x / 16);
      const row = Math.floor(y / 16);
      const over = ((column + row) % 4) < 2;
      const across = over ? x : y;
      const curve = Math.sin(Math.PI * ((across % 16) + .5) / 16);
      const filaments = Math.cos(across * Math.PI / 2);
      const shade = 77 + 108 * curve + 12 * filaments + (over ? 42 : 0);
      image.data.set([shade, shade, shade, 255], (y * 64 + x) * 4);
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new CanvasTexture(tile);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function addLighting(scene) {
  scene.add(new AmbientLight(0xf3edff, .38));
  scene.add(new HemisphereLight(0xf1f1ff, 0x514857, .78));
  const lights = [
    [0xf3f5ff, 2.7, -170, 300, 180],
    [0xe6d3ff, 2.8, 130, 220, -200],
    [0xdfeaff, 1.6, 100, 60, 200],
  ];
  for (const [color, intensity, x, y, z] of lights) {
    const light = new DirectionalLight(color, intensity);
    light.position.set(x, y, z);
    if (x < 0) {
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      Object.assign(light.shadow.camera, { left: -230, right: 230, top: 230, bottom: -230, far: 750 });
      light.shadow.camera.updateProjectionMatrix();
      light.shadow.normalBias = .2;
      light.shadow.bias = -.00012;
    }
    scene.add(light);
  }
}

// Subtle FDM layer sheen. Filter out subpixel layers to avoid shimmer on scroll.
function addPrintLayers(shader) {
  shader.vertexShader = 'varying float layerHeight;\n' + shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\nlayerHeight = (mat3(modelMatrix) * position).y;',
  );
  shader.fragmentShader = 'varying float layerHeight;\n' + shader.fragmentShader.replace(
    '#include <roughnessmap_fragment>',
    `#include <roughnessmap_fragment>
     float layer = layerHeight / 0.24;
     float detail = 1.0 - smoothstep(0.18, 0.5, fwidth(layer));
     roughnessFactor += 0.065 * detail * sin(6.2831853 * layer);`,
  );
}

// Draw crease and boundary edges only. Smooth curved faces keep their shading.
function styleSurface(mesh, weave) {
  mesh.castShadow = mesh.receiveShadow = true;
  const surface = mesh.material;
  const carbon = surface.name === 'Carbon twill';
  const tpu = surface.name === 'Violet TPU';
  if (!carbon && !tpu) return;

  if (carbon) {
    surface.map = weave;
    surface.color.set('#515155');
    surface.roughnessMap = weave;
    surface.roughness = .78;
  } else {
    surface.roughness = .6;
    surface.onBeforeCompile = addPrintLayers;
  }
  surface.polygonOffset = true;
  surface.polygonOffsetFactor = 1;
  surface.polygonOffsetUnits = 1;
  const ink = new LineBasicMaterial({
    color: carbon ? 0xb7c0d0 : 0x21172c,
    transparent: true,
    opacity: carbon ? .32 : .29,
    depthWrite: false,
    toneMapped: false,
  });
  const contours = new LineSegments(new EdgesGeometry(mesh.geometry, 28), ink);
  contours.renderOrder = 1;
  mesh.add(contours);
}

function measureParts(model, camera, weave) {
  const point = new Vector3();
  const parts = [];
  model.updateMatrixWorld(true);
  for (const node of model.children) {
    const { center, group } = node.userData;
    if (!group) continue;
    const bounds = new Box3();
    node.traverse((mesh) => {
      if (!mesh.isMesh) return;
      styleSurface(mesh, weave);
      const vertices = mesh.geometry.attributes.position;
      for (let index = 0; index < vertices.count; index++) {
        point.fromBufferAttribute(vertices, index).applyMatrix4(mesh.matrixWorld);
        bounds.expandByPoint(point.applyMatrix4(camera.matrixWorldInverse));
      }
    });
    const [start, end, x, y, z] = movements[group];
    const isArmOrGuard = group === 'arm' || group === 'armProtector' || group === 'guard';
    const offset = new Vector3(x * (isArmOrGuard ? Math.sign(center[0]) : 1), y, z * Math.sign(center[2]));
    // The far arm lines up behind the plates in this view. Fan it farther to
    // the rear so the tip, guard and root stay visible in the exploded view.
    if (isArmOrGuard && center[0] > 0 && center[2] < 0) {
      offset.x += 96;
      offset.z += 21;
    }
    parts.push({ node, start, end, offset, bounds, origin: node.position.clone() });
  }
  return parts;
}

function createRenderer() {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = NeutralToneMapping;
  return renderer;
}

export async function mountShreddo({ section, stage, media, header, signal }) {
  const renderer = createRenderer();
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new Scene();
  const camera = new PerspectiveCamera(25, 1, 1, 4000);
  const cameraPosition = new Vector3(-325, 245, 405);
  const cameraDirection = cameraPosition.clone().normalize();
  camera.position.copy(cameraPosition);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const cameraAxes = camera.matrixWorldInverse.clone();
  const worldAxes = camera.matrixWorld.clone().setPosition(0, 0, 0);
  addLighting(scene);
  const weave = carbonWeave(renderer);
  const modelRoot = new Group();
  scene.add(modelRoot);

  let frame = 0;
  let colorTimer;
  let observer;
  let released = false;
  let render;
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };
  function release() {
    if (released) return;
    released = true;
    cancelAnimationFrame(frame);
    clearTimeout(colorTimer);
    document.removeEventListener('visibilitychange', schedule);
    observer?.disconnect();
    window.removeEventListener('scroll', schedule);
    renderer.domElement.removeEventListener('webglcontextlost', release);
    renderer.domElement.remove();
    section.classList.remove('has-shreddo-model');
    section.removeAttribute('data-exploded');
    modelRoot.traverse((mesh) => {
      if (!mesh.isMesh && !mesh.isLineSegments) return;
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    scene.traverse(object => object.shadow?.dispose());
    weave.dispose();
    renderer.dispose();
  }

  try {
    const { scene: model } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(modelUrl.href);
    modelRoot.add(model);
    if (signal.aborted) {
      release();
      return;
    }
    // The STEP conversion gives every TPU piece the same material. Split that
    // shared material once so each zone can change colour independently.
    const tpuMaterials = [];
    for (const node of model.children) {
      const zone = filamentZone[node.userData.group];
      if (zone === undefined) continue;
      node.traverse(mesh => {
        if (mesh.material?.name !== 'Violet TPU') return;
        tpuMaterials[zone] ??= zone === 0 ? mesh.material : mesh.material.clone();
        mesh.material = tpuMaterials[zone];
        mesh.material.color.copy(filamentPalettes[0][zone]);
      });
    }
    const parts = measureParts(model, camera, weave);
    if (parts.length !== 69) throw new Error('Incomplete Shreddo assembly');

    const colorStarted = performance.now();
    const bounds = new Box3();
    const offset = new Vector3();
    const projectedOffset = new Vector3();
    const shifted = new Box3();
    const target = new Vector3();
    const projectedOrigin = new Vector3().applyMatrix4(cameraAxes);
    const mobileTravel = new Vector3(.79, .85, .79);
    let lastWidth = 0;
    let lastHeight = 0;

    render = () => {
      frame = 0;
      clearTimeout(colorTimer);
      const view = media.getBoundingClientRect();
      if (document.hidden || view.bottom <= 0 || view.top >= innerHeight) return;
      const width = media.clientWidth;
      const height = media.clientHeight;
      if (!width || !height) return;
      if (width !== lastWidth || height !== lastHeight) {
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2, 1600 / width));
        renderer.setSize(width, height, false);
        lastWidth = width;
        lastHeight = height;
      }
      const travel = Math.max(1, section.offsetHeight - stage.offsetHeight);
      const scroll = clamp((header.offsetHeight - section.getBoundingClientRect().top) / travel);
      const progress = clamp((scroll - .13) / .78);
      section.toggleAttribute('data-exploded', progress === 1);
      const narrow = window.innerWidth <= 620;
      const protectorLift = 38 * MathUtils.smoothstep(progress, .43, .78);
      bounds.makeEmpty();
      for (const part of parts) {
        const amount = MathUtils.smoothstep(progress, part.start, part.end);
        offset.copy(part.offset).multiplyScalar(amount);
        // Lift each clip off its arm before the arms finish spreading.
        if (part.node.userData.group === 'armProtector') offset.y += protectorLift;
        if (narrow) offset.multiply(mobileTravel);
        part.node.position.copy(part.origin).add(offset);
        projectedOffset.copy(offset).applyMatrix4(cameraAxes).sub(projectedOrigin);
        bounds.union(shifted.copy(part.bounds).translate(projectedOffset));
      }

      bounds.getCenter(target);
      target.z = 0;
      const halfWidth = (bounds.max.x - bounds.min.x) / 2;
      const halfHeight = (bounds.max.y - bounds.min.y) / 2;
      const actualAspect = width / height;
      const vertical = Math.max(halfWidth / aspect, halfHeight, halfWidth / actualAspect)
        * MathUtils.lerp(1.08, narrow ? 1.19 : 1.14, progress);
      const nearDepth = bounds.max.z - projectedOrigin.z;
      const distance = vertical / Math.tan(MathUtils.degToRad(camera.fov / 2)) + nearDepth * .65;
      camera.position.copy(target.applyMatrix4(worldAxes)).addScaledVector(cameraDirection, distance);
      camera.aspect = actualAspect;
      camera.updateProjectionMatrix();
      const elapsed = performance.now() - colorStarted;
      const slot = Math.floor(elapsed / colorPeriod) % filamentPalettes.length;
      const phase = elapsed % colorPeriod;
      const blend = MathUtils.smoothstep(phase, colorPeriod - fadeDuration, colorPeriod);
      const next = (slot + 1) % filamentPalettes.length;
      tpuMaterials.forEach((material, zone) => {
        material.color.lerpColors(filamentPalettes[slot][zone], filamentPalettes[next][zone], blend);
      });
      renderer.render(scene, camera);
      if (phase >= colorPeriod - fadeDuration) schedule();
      else colorTimer = setTimeout(schedule, colorPeriod - fadeDuration - phase);
    };

    section.classList.add('has-shreddo-model');
    media.append(renderer.domElement);
    render();
    observer = new ResizeObserver(schedule);
    observer.observe(header);
    observer.observe(media);
    observer.observe(stage);
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    renderer.domElement.addEventListener('webglcontextlost', release);
    return release;
  } catch (error) {
    release();
    throw error;
  }

}

export async function createStudioViewer(viewport) {
  const renderer = createRenderer();
  let model;
  try {
    ({scene: model} = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(modelUrl.href));
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  const scene = new Scene();
  addLighting(scene);
  scene.add(model);
  const weave = carbonWeave(renderer);
  const materials = new Map();
  const groups = new Map(studioParts.flatMap(part => part.groups.map(group => [group, part])));
  for (const node of model.children) {
    const part = groups.get(node.userData.group);
    node.traverse(mesh => {
      if (!mesh.isMesh) return;
      if (part) {
        if (!materials.has(part.id)) materials.set(part.id, mesh.material.clone());
        mesh.material = materials.get(part.id);
        mesh.material.color.copy(filamentPalettes[0][part.zone]);
      } else if (node.userData.group === 'softLock') {
        mesh.material.color.copy(filamentPalettes[0][1]);
      }
      styleSurface(mesh, weave);
    });
  }

  const stockParts = {
    horn: model.children.filter(node => node.userData.group === 'horn'),
    shoes: model.children.filter(node => node.userData.group === 'guard'),
  };
  let alternatives;
  async function loadAlternatives() {
    const url = new URL('./studio-variants.glb', modelUrl);
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const { scene: variants } = await loader.loadAsync(url.href);
    const replacements = {};
    for (const node of [...variants.children]) {
      const slot = node.userData.slot;
      const assembly = new Group();
      node.traverse(mesh => {
        if (!mesh.isMesh) return;
        mesh.material = materials.get(slot);
        styleSurface(mesh, weave);
      });
      assembly.add(node);
      if (slot === 'shoes') {
        // The supplied shoe is in frame coordinates. Reflect the
        // complete node (including its quantisation transform) at each arm.
        for (const [x, z] of [[-1, 1], [1, -1], [-1, -1]]) {
          const mirror = new Group();
          mirror.scale.set(x, 1, z);
          mirror.add(node.clone());
          assembly.add(mirror);
        }
      }
      assembly.visible = false;
      replacements[slot] = assembly;
    }
    if (!replacements.horn || !replacements.shoes) throw new Error('Incomplete studio variants');
    model.add(replacements.horn, replacements.shoes);
    return replacements;
  }

  const camera = new PerspectiveCamera(25, 1, 1, 4000);
  camera.position.set(-325, 265, 405);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Shreddo 5 model. Drag or use the arrow keys to rotate.');
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 16, 0);
  controls.enablePan = false;
  const initialDistance = camera.position.distanceTo(controls.target);
  controls.minDistance = 160;
  controls.maxDistance = 1000;
  controls.update();
  controls.saveState();
  const draw = () => renderer.render(scene, camera);
  controls.addEventListener('change', draw);
  canvas.addEventListener('keydown', event => {
    const step = Math.PI / 12;
    const angles = {ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step]};
    const delta = angles[event.key];
    if (!delta) return;
    event.preventDefault();
    const offset = camera.position.clone().sub(controls.target);
    const orbit = new Spherical().setFromVector3(offset);
    orbit.theta += delta[0];
    orbit.phi = MathUtils.clamp(orbit.phi - delta[1], .01, Math.PI - .01);
    camera.position.copy(controls.target).add(offset.setFromSpherical(orbit));
    controls.update();
  });
  function resize() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const aspect = width / height;
    const halfHeight = Math.max(96, 128 / aspect);
    camera.aspect = aspect;
    camera.fov = MathUtils.radToDeg(2 * Math.atan(halfHeight / initialDistance));
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2, 1700 / width));
    renderer.setSize(width, height, false);
    draw();
  }
  viewport.append(canvas);
  new ResizeObserver(resize).observe(viewport);
  resize();
  return {
    setColours(colours) {
      for (const [id, colour] of Object.entries(colours)) materials.get(id).color.set(colour);
      draw();
    },
    async setHardware(configuration) {
      if (Object.values(configuration).some(Boolean) || alternatives) {
        alternatives ??= loadAlternatives().catch(error => {
          alternatives = undefined;
          throw error;
        });
        const replacements = await alternatives;
        for (const [slot, alternative] of Object.entries(configuration)) {
          for (const part of stockParts[slot]) part.visible = !alternative;
          replacements[slot].visible = alternative;
        }
      }
      draw();
    },
    captureView() {
      draw();
      const image = document.createElement('canvas');
      image.width = 160;
      image.height = Math.round(160 * canvas.height / canvas.width);
      image.getContext('2d').drawImage(canvas, 0, 0, image.width, image.height);
      return { image: image.toDataURL('image/webp'), position: camera.position.toArray(), zoom: camera.zoom };
    },
    restoreView(view) {
      camera.position.fromArray(view.position);
      camera.zoom = view.zoom;
      camera.updateProjectionMatrix();
      controls.update();
      draw();
    },
    resetView() { controls.reset(); },
  };
}
