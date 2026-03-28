import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { createDefaultState, createSource, assignLoopMetadata } from "./state.js";
import {
  buildExportQuads,
  buildSurfaceGrid,
  getLoopBounds,
  polygonArea,
  sampleHeight,
  toCanvasPoint,
  toWorldPoint,
} from "./geometry.js";
import { importProfile } from "./importers.js";
import { createMaterialMaps } from "./materials.js";
import { exportObjMesh, exportStlMesh, exportSurfaceJson } from "./exporters.js";

const state = createDefaultState();

const elements = {
  workspace: document.querySelector(".workspace"),
  profileCard: document.querySelector(".profile-card"),
  profileCardHeader: document.querySelector(".profile-card-header"),
  profileCanvas: document.getElementById("profileCanvas"),
  surfaceCanvas: document.getElementById("surfaceCanvas"),
  imageImportOptions: document.getElementById("imageImportOptions"),
  imageTracePanel: document.getElementById("imageTracePanel"),
  imageTraceList: document.getElementById("imageTraceList"),
  vectorImportOptions: document.getElementById("vectorImportOptions"),
  profileFileInput: document.getElementById("profileFileInput"),
  importProfileButton: document.getElementById("importProfileButton"),
  profileStatus: document.getElementById("profileStatus"),
  imageThresholdInput: document.getElementById("imageThresholdInput"),
  imageThresholdNumber: document.getElementById("imageThresholdNumber"),
  invertImageInput: document.getElementById("invertImageInput"),
  imageTargetRegionsInput: document.getElementById("imageTargetRegionsInput"),
  retraceImageButton: document.getElementById("retraceImageButton"),
  imageTraceStatus: document.getElementById("imageTraceStatus"),
  svgSamplesInput: document.getElementById("svgSamplesInput"),
  svgSamplesNumber: document.getElementById("svgSamplesNumber"),
  unitsMmButton: document.getElementById("unitsMmButton"),
  unitsInButton: document.getElementById("unitsInButton"),
  importWidthInput: document.getElementById("importWidthInput"),
  importHeightInput: document.getElementById("importHeightInput"),
  aspectLockInput: document.getElementById("aspectLockInput"),
  resolutionInput: document.getElementById("resolutionInput"),
  resolutionNumber: document.getElementById("resolutionNumber"),
  heightScaleInput: document.getElementById("heightScaleInput"),
  heightScaleNumber: document.getElementById("heightScaleNumber"),
  edgeFadeInput: document.getElementById("edgeFadeInput"),
  edgeFadeNumber: document.getElementById("edgeFadeNumber"),
  woodToggleInput: document.getElementById("woodToggleInput"),
  speciesSelect: document.getElementById("speciesSelect"),
  grainScaleInput: document.getElementById("grainScaleInput"),
  grainScaleNumber: document.getElementById("grainScaleNumber"),
  addPointSourceButton: document.getElementById("addPointSourceButton"),
  addCurveSourceButton: document.getElementById("addCurveSourceButton"),
  sourceModeStatus: document.getElementById("sourceModeStatus"),
  sourceList: document.getElementById("sourceList"),
  regionList: document.getElementById("regionList"),
  exportStlButton: document.getElementById("exportStlButton"),
  exportObjButton: document.getElementById("exportObjButton"),
  exportJsonButton: document.getElementById("exportJsonButton"),
  loadSampleButton: document.getElementById("loadSampleButton"),
  dockProfileButton: document.getElementById("dockProfileButton"),
  bboxReadout: document.getElementById("bboxReadout"),
  perspectiveViewButton: document.getElementById("perspectiveViewButton"),
  topViewButton: document.getElementById("topViewButton"),
  resetViewButton: document.getElementById("resetViewButton"),
  toggleHelpersButton: document.getElementById("toggleHelpersButton"),
};

const profileContext = elements.profileCanvas.getContext("2d");
let renderer;
let scene;
let camera;
let controls;
let transformControls;
let surfaceMesh;
let materialMap;
let alphaMap;
let currentSurfaceGrid;
let helperGroup;
let resizeObserver;
let gridGroup;
let helperSprites = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedHelperDescriptor = null;
const profilePanelState = {
  pointerId: null,
  startX: 0,
  startY: 0,
  originLeft: 0,
  originTop: 0,
  docked: true,
};
const profileDragState = {
  active: false,
  mode: null,
  sourceId: null,
  pointIndex: null,
  lastWorldPoint: null,
};
const helperDragState = {
  active: false,
  pointerId: null,
  descriptor: null,
  lastWorldPoint: null,
};

function clampToInput(input, value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return Number(input.value);
  }

  const min = input.min === "" ? -Infinity : Number(input.min);
  const max = input.max === "" ? Infinity : Number(input.max);
  return Math.min(Math.max(numericValue, min), max);
}

function expandPairedBounds(rangeInput, numberInput, value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return;
  }

  const currentMin = rangeInput.min === "" ? numericValue : Number(rangeInput.min);
  const currentMax = rangeInput.max === "" ? numericValue : Number(rangeInput.max);

  if (numericValue < currentMin) {
    rangeInput.min = String(numericValue);
    numberInput.min = String(numericValue);
  }

  if (numericValue > currentMax) {
    rangeInput.max = String(numericValue);
    numberInput.max = String(numericValue);
  }
}

function setPairedValue(rangeInput, numberInput, value, formatter = (nextValue) => nextValue) {
  const nextValue = clampToInput(rangeInput, value);
  const displayValue = formatter(nextValue);
  rangeInput.value = String(nextValue);
  numberInput.value = String(displayValue);
  return nextValue;
}

function resetNumberInputDisplay(rangeInput, numberInput, formatter = (value) => value) {
  numberInput.value = String(formatter(rangeInput.value));
}

function getImportKindForFile(file) {
  const extension = file?.name.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "bmp"].includes(extension)) {
    return "image";
  }
  return "vector";
}

function convertUnitValue(value, fromUnits, toUnits) {
  if (fromUnits === toUnits) {
    return value;
  }
  if (fromUnits === "mm" && toUnits === "in") {
    return value / 25.4;
  }
  if (fromUnits === "in" && toUnits === "mm") {
    return value * 25.4;
  }
  return value;
}

function getAspectRatio(bounds) {
  const width = Number(bounds?.width) || 1;
  const height = Number(bounds?.height) || 1;
  return height === 0 ? 1 : width / height;
}

function getPlainLoopBounds(loops) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  loops.forEach((loop) => {
    loop.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
  });

  return {
    width: Number.isFinite(minX) ? Math.max(maxX - minX, 1e-6) : 1,
    height: Number.isFinite(minY) ? Math.max(maxY - minY, 1e-6) : 1,
  };
}

function scaleImportedLoops(loops, targetWidth, targetHeight) {
  const currentBounds = getPlainLoopBounds(loops);
  const scaleX = targetWidth / currentBounds.width;
  const scaleY = targetHeight / currentBounds.height;

  return loops.map((loop) =>
    loop.map((point) => ({
      x: point.x * scaleX,
      y: point.y * scaleY,
    })),
  );
}

function getTargetImportBounds(nativeBounds) {
  const width = Number(state.importSettings.importWidth);
  const height = Number(state.importSettings.importHeight);

  return {
    width: width > 0 ? width : nativeBounds.width || 1,
    height: height > 0 ? height : nativeBounds.height || 1,
  };
}

function prepareImportedResult(result) {
  const targetBounds = getTargetImportBounds(result.sourceBounds);
  const sourceBounds = getPlainLoopBounds(result.loops);
  const scaleX = targetBounds.width / sourceBounds.width;
  const scaleY = targetBounds.height / sourceBounds.height;
  const scaleLoopSet = (loops) =>
    loops.map((loop) =>
      loop.map((point) => ({
        x: point.x * scaleX,
        y: point.y * scaleY,
      })),
    );

  const scaledLoops = scaleLoopSet(result.loops);
  return {
    loops: scaledLoops,
    traceCandidates: (result.traceCandidates || []).map((candidate) => {
      const scaledPoints = scaleLoopSet([candidate.points])[0];
      return {
        ...candidate,
        points: scaledPoints,
        area: Math.abs(polygonArea(scaledPoints)),
      };
    }),
    sourceBounds: targetBounds,
    nativeSourceBounds: result.sourceBounds,
    importKind: result.importKind,
    sourceUnits: state.importSettings.units,
  };
}

function buildDefaultTraceSelection(candidates) {
  if (!candidates.length) {
    return { modes: {} };
  }

  return {
    modes: Object.fromEntries(
      candidates.map((candidate, index) => [candidate.id, index === 0 ? "surface" : "add"]),
    ),
  };
}

function sanitizeTraceSelection(candidates, selection) {
  const modes = {};
  candidates.forEach((candidate, index) => {
    if (index === 0) {
      modes[candidate.id] = "surface";
      return;
    }
    const requestedMode = selection?.modes?.[candidate.id];
    modes[candidate.id] = ["add", "subtract", "off"].includes(requestedMode) ? requestedMode : "add";
  });

  return { modes };
}

function buildTraceLoopsFromSelection(candidates, selection) {
  const modes = sanitizeTraceSelection(candidates, selection).modes;
  return candidates
    .map((candidate, index) => {
      const mode = modes[candidate.id] || (index === 0 ? "surface" : "add");
      if (mode === "off") {
        return null;
      }

      if (mode === "subtract") {
        return {
          id: candidate.id,
          label: candidate.label,
          role: "perimeterSubtract",
          surfaceMode: "subtract",
          traceMode: "subtract",
          points: candidate.points,
        };
      }

      return {
        id: candidate.id,
        label: index === 0 ? "Outer Profile" : candidate.label,
        role: index === 0 ? "outer" : "perimeterAdd",
        surfaceMode: "add",
        traceMode: mode,
        points: candidate.points,
        species: "walnut",
      };
    })
    .filter(Boolean);
}

function formatAreaReadout(areaValue) {
  const units = state.meta.sourceUnits || state.importSettings.units || "mm";
  return `${areaValue.toFixed(2)} ${units}^2`;
}

function syncImageTraceStatus() {
  const activeImportKind = state.meta.pendingImportKind || state.meta.importKind;
  if (activeImportKind !== "image") {
    elements.imageTraceStatus.textContent = "Adjust image trace settings, then retrace.";
    return;
  }

  if (state.meta.pendingImportFile) {
    const targetLabel =
      state.importSettings.imageTargetRegions > 0
        ? `Target ${state.importSettings.imageTargetRegions} regions. `
        : "";
    elements.imageTraceStatus.textContent = `${targetLabel}Selected ${state.meta.pendingImportFile.name}. Click Import Selected File.`;
    return;
  }

  const regionCount = state.meta.imageTraceCandidates?.length || 0;
  const targetLabel =
    state.importSettings.imageTargetRegions > 0
      ? `Target ${state.importSettings.imageTargetRegions} regions. `
      : "";
  const dirtyLabel = state.meta.imageTraceDirty ? "Settings changed. Click Retrace Image." : "";
  elements.imageTraceStatus.textContent = `${targetLabel}Detected ${regionCount} traced regions. ${dirtyLabel}`.trim();
}

function updateImportOptionsVisibility() {
  const activeImportKind = state.meta.pendingImportKind || state.meta.importKind;
  const isImage = activeImportKind === "image";
  elements.imageImportOptions.classList.toggle("is-hidden", !isImage);
  elements.imageTracePanel.classList.toggle(
    "is-hidden",
    activeImportKind !== "image" || !state.meta.imageTraceCandidates?.length || !!state.meta.pendingImportFile,
  );
  elements.vectorImportOptions.classList.toggle("is-hidden", isImage);
}

function queueImageRetrace(reasonLabel) {
  state.meta.imageTraceDirty = true;
  state.ui.status = `${reasonLabel}. Click Retrace Image to update the trace.`;
  syncStatus();
  syncImageTraceStatus();
}

function formatBoundsReadout() {
  const bounds = state.meta.sourceBounds || { width: 0, height: 0 };
  const units = state.meta.sourceUnits || state.importSettings.units || "mm";
  const width = Number(bounds.width || 0).toFixed(2);
  const height = Number(bounds.height || 0).toFixed(2);
  return `BBox ${width} x ${height} ${units}`;
}

function resizeCanvasToDisplaySize(canvas, useDevicePixels = true) {
  const ratio = useDevicePixels ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
}

function syncCanvasSizes() {
  const profileChanged = resizeCanvasToDisplaySize(elements.profileCanvas);
  if (renderer) {
    const width = elements.surfaceCanvas.clientWidth;
    const height = elements.surfaceCanvas.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }
  if (profileChanged) {
    renderProfileCanvas();
  }
}

function isCompactLayout() {
  return window.innerWidth <= 1180;
}

function setProfileCardPosition(left, top) {
  const margin = 16;
  const workspaceWidth = elements.workspace.clientWidth;
  const workspaceHeight = elements.workspace.clientHeight;
  const cardWidth = elements.profileCard.offsetWidth;
  const cardHeight = elements.profileCard.offsetHeight;
  const clampedLeft = Math.min(Math.max(left, margin), Math.max(margin, workspaceWidth - cardWidth - margin));
  const clampedTop = Math.min(Math.max(top, margin), Math.max(margin, workspaceHeight - cardHeight - margin));
  elements.profileCard.style.left = `${clampedLeft}px`;
  elements.profileCard.style.top = `${clampedTop}px`;
  elements.profileCard.style.right = "auto";
}

function dockProfileCard() {
  if (isCompactLayout()) {
    elements.profileCard.style.left = "";
    elements.profileCard.style.top = "";
    elements.profileCard.style.right = "";
    profilePanelState.docked = true;
    return;
  }

  profilePanelState.docked = true;
  const margin = 16;
  const left = elements.workspace.clientWidth - elements.profileCard.offsetWidth - margin;
  setProfileCardPosition(left, margin);
}

function clampFloatingProfileCard() {
  if (isCompactLayout()) {
    dockProfileCard();
    return;
  }

  if (profilePanelState.docked) {
    dockProfileCard();
    return;
  }

  const left = Number.parseFloat(elements.profileCard.style.left || "16");
  const top = Number.parseFloat(elements.profileCard.style.top || "16");
  setProfileCardPosition(left, top);
}

function initFloatingProfileCard() {
  dockProfileCard();

  elements.profileCardHeader.addEventListener("pointerdown", (event) => {
    if (isCompactLayout() || event.target.closest("button")) {
      return;
    }

    profilePanelState.pointerId = event.pointerId;
    profilePanelState.startX = event.clientX;
    profilePanelState.startY = event.clientY;
    profilePanelState.originLeft = Number.parseFloat(elements.profileCard.style.left || "16");
    profilePanelState.originTop = Number.parseFloat(elements.profileCard.style.top || "16");
    profilePanelState.docked = false;
    elements.profileCard.classList.add("is-dragging");
    elements.profileCardHeader.setPointerCapture(event.pointerId);
  });

  elements.profileCardHeader.addEventListener("pointermove", (event) => {
    if (profilePanelState.pointerId !== event.pointerId || isCompactLayout()) {
      return;
    }

    const dx = event.clientX - profilePanelState.startX;
    const dy = event.clientY - profilePanelState.startY;
    setProfileCardPosition(profilePanelState.originLeft + dx, profilePanelState.originTop + dy);
  });

  const releaseDrag = (event) => {
    if (profilePanelState.pointerId !== event.pointerId) {
      return;
    }
    profilePanelState.pointerId = null;
    elements.profileCard.classList.remove("is-dragging");
    if (elements.profileCardHeader.hasPointerCapture(event.pointerId)) {
      elements.profileCardHeader.releasePointerCapture(event.pointerId);
    }
  };

  elements.profileCardHeader.addEventListener("pointerup", releaseDrag);
  elements.profileCardHeader.addEventListener("pointercancel", releaseDrag);
  elements.dockProfileButton.addEventListener("click", dockProfileCard);

  resizeObserver = new ResizeObserver(() => {
    syncCanvasSizes();
    clampFloatingProfileCard();
  });
  resizeObserver.observe(elements.profileCard);
  resizeObserver.observe(elements.surfaceCanvas);
}

function formatSpeciesName(name) {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function preserveLoopSpecies(nextLoops) {
  return nextLoops.map((loop, index) => ({
    ...loop,
    species: state.loops[index]?.species || loop.species,
  }));
}

function applyImageTraceSelection() {
  const selection = sanitizeTraceSelection(
    state.meta.imageTraceCandidates,
    state.meta.imageTraceSelection,
  );
  state.meta.imageTraceSelection = selection;
  state.loops = buildTraceLoopsFromSelection(state.meta.imageTraceCandidates, selection);
}

function applyImportedResult(result, fileName) {
  state.meta.importName = fileName;
  state.meta.importKind = result.importKind;
  state.meta.sourceBounds = result.sourceBounds;
  state.meta.nativeSourceBounds = result.nativeSourceBounds || result.sourceBounds;
  state.meta.sourceUnits = result.sourceUnits;
  state.meta.imageTraceCandidates = result.traceCandidates || [];
  state.meta.imageTraceDirty = false;

  if (result.importKind === "image" && state.meta.imageTraceCandidates.length) {
    const selection = sanitizeTraceSelection(
      state.meta.imageTraceCandidates,
      Object.keys(state.meta.imageTraceSelection?.modes || {}).length
        ? state.meta.imageTraceSelection
        : buildDefaultTraceSelection(state.meta.imageTraceCandidates),
    );
    state.meta.imageTraceSelection = selection;
    applyImageTraceSelection();
    return;
  }

  state.meta.imageTraceSelection = {
    modes: {},
  };
  state.loops = preserveLoopSpecies(assignLoopMetadata(result.loops));
}

async function refreshImportedProfile(reasonLabel = "Updated import settings") {
  const file = state.meta.importedFile;
  if (!file) {
    return;
  }

  const requestId = state.meta.importRequestId + 1;
  state.meta.importRequestId = requestId;
  state.ui.status = `${reasonLabel} for ${file.name}...`;
  syncStatus();

  try {
    const importedBase = await importProfile(file, state.importSettings);
    if (requestId !== state.meta.importRequestId) {
      return;
    }
    if (!importedBase.loops.length) {
      throw new Error("No closed loops were found with the current import settings.");
    }

    const imported = prepareImportedResult(importedBase);
    applyImportedResult(imported, file.name);
    state.ui.status = `${reasonLabel} for ${file.name}. ${Math.max(imported.loops.length - 1, 0)} inner loop(s) detected.`;
    syncView();
  } catch (error) {
    if (requestId !== state.meta.importRequestId) {
      return;
    }
    state.ui.status = error instanceof Error ? error.message : "Import refresh failed.";
    syncStatus();
  }
}

function populateSpeciesSelects() {
  const options = state.meta.speciesList
    .map((name) => `<option value="${name}">${formatSpeciesName(name)}</option>`)
    .join("");
  elements.speciesSelect.innerHTML = options;
  elements.speciesSelect.value = state.surface.species;
}

function toScenePoint(point, height = 0) {
  return new THREE.Vector3(point.x, point.y, height);
}

function getGroundedSurfaceHeight(point) {
  const baseHeight = sampleHeight(state, point);
  const groundOffset = currentSurfaceGrid ? -currentSurfaceGrid.minHeight : 0;
  return baseHeight + groundOffset;
}

function toSurfaceScenePoint(point, offset = 0.012) {
  return toScenePoint(point, getGroundedSurfaceHeight(point) + offset);
}

function buildSurfaceCurvePreviewPoints(startPoint, endPoint, steps = 32, offset = 0.008) {
  const points = [];

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const point = {
      x: THREE.MathUtils.lerp(startPoint.x, endPoint.x, t),
      y: THREE.MathUtils.lerp(startPoint.y, endPoint.y, t),
    };
    points.push(toSurfaceScenePoint(point, offset));
  }

  return points;
}

function createHandleTexture(fillStyle, strokeStyle, shape = "circle") {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = fillStyle;
  context.strokeStyle = strokeStyle;
  context.lineWidth = 6;

  if (shape === "square") {
    context.beginPath();
    context.roundRect(12, 12, 40, 40, 10);
    context.fill();
    context.stroke();
  } else {
    context.beginPath();
    context.arc(32, 32, 18, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function addHandleSprite(parent, texture, pixelSize) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  sprite.renderOrder = 20;
  sprite.userData.screenPixelSize = pixelSize;
  parent.add(sprite);
  helperSprites.push(sprite);
}

function updateHelperSpriteScales() {
  if (!camera || !renderer || !helperSprites.length) {
    return;
  }

  const viewportHeight = Math.max(renderer.domElement.clientHeight, 1);
  const fovRadians = THREE.MathUtils.degToRad(camera.fov);

  helperSprites.forEach((sprite) => {
    const worldPosition = new THREE.Vector3();
    sprite.getWorldPosition(worldPosition);
    const distance = camera.position.distanceTo(worldPosition);
    const worldHeight = 2 * Math.tan(fovRadians * 0.5) * distance;
    const worldPerPixel = worldHeight / viewportHeight;
    const size = Math.max(worldPerPixel * sprite.userData.screenPixelSize, 0.03);
    sprite.scale.set(size, size, 1);
  });
}

function updateStateFromSceneHandle(object) {
  const descriptor = object.userData?.descriptor;
  if (!descriptor) {
    return;
  }

  const source = state.sources.find((item) => item.id === descriptor.sourceId);
  if (!source) {
    return;
  }

  if (descriptor.kind === "curveCenter") {
    const previous = object.userData.lastPosition || object.position.clone();
    const dx = object.position.x - previous.x;
    const dy = object.position.y - previous.y;
    source.points = source.points.map((point) => ({
      x: point.x + dx,
      y: point.y + dy,
    }));
    object.userData.lastPosition = object.position.clone();
    return;
  }

  const pointIndex = descriptor.pointIndex ?? 0;
  source.points[pointIndex] = {
    x: object.position.x,
    y: object.position.y,
  };
}

function attachHelperByDescriptor(descriptor) {
  if (!transformControls || !descriptor || !helperGroup) {
    return;
  }

  const match = helperGroup.children.find((child) => {
    const current = child.userData?.descriptor;
    return (
      current &&
      current.sourceId === descriptor.sourceId &&
      current.kind === descriptor.kind &&
      current.pointIndex === descriptor.pointIndex
    );
  });

  if (match) {
    transformControls.attach(match);
    selectedHelperDescriptor = descriptor;
  } else {
    transformControls.detach();
    selectedHelperDescriptor = null;
  }
}

function update3DHelperObjects() {
  if (!helperGroup) {
    return;
  }

  helperGroup.clear();
  helperSprites = [];
  if (!state.ui.show3DHelpers) {
    transformControls.detach();
    return;
  }

  const bounds = currentSurfaceGrid?.bounds || { width: 1, height: 1 };
  const maxDimension = Math.max(bounds.width, bounds.height, 1);
  const worldPerUnit = getWorldUnitsPerSourceUnit();
  const targetHandleSize = state.meta.sourceUnits === "in" ? 0.125 : 2;
  const physicalRadius = targetHandleSize * worldPerUnit;
  const visibleRadius = maxDimension > 10 ? maxDimension * 0.0135 : maxDimension * 0.038;
  const pointRadius = THREE.MathUtils.clamp(
    Math.max(physicalRadius, visibleRadius),
    0.075,
    maxDimension > 10 ? 4.5 : 0.16,
  );
  const centerSize = pointRadius * 1.5;
  const lineOffset = Math.max(pointRadius * 0.18, 0.014);
  const handleOffset = Math.max(pointRadius * 0.24, 0.018);

  transformControls.size = Math.max(0.9, pointRadius * 0.75);

  const pointMaterial = new THREE.MeshStandardMaterial({
    color: "#f0a34b",
    emissive: "#a65012",
    emissiveIntensity: 1.2,
    roughness: 0.42,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const curveMaterial = new THREE.MeshStandardMaterial({
    color: "#59a8ff",
    emissive: "#1b4e84",
    emissiveIntensity: 1.1,
    roughness: 0.38,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const centerMaterial = new THREE.MeshStandardMaterial({
    color: "#8dd06b",
    emissive: "#2f5d17",
    emissiveIntensity: 1.15,
    roughness: 0.4,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const lineMaterial = new THREE.LineBasicMaterial({
    color: "#7c4a18",
    transparent: true,
    opacity: 0.96,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const sphereGeometry = new THREE.SphereGeometry(pointRadius, 20, 20);
  const boxGeometry = new THREE.BoxGeometry(centerSize, centerSize, centerSize);
  const pointTexture = createHandleTexture("#f0a34b", "#7b3c10");
  const curveTexture = createHandleTexture("#59a8ff", "#1a4b80");
  const centerTexture = createHandleTexture("#8dd06b", "#2f5d17", "square");

  state.sources.forEach((source) => {
    if (source.type === "point") {
      const mesh = new THREE.Mesh(sphereGeometry, pointMaterial);
      mesh.position.copy(toSurfaceScenePoint(source.points[0], handleOffset));
      mesh.userData.descriptor = { sourceId: source.id, kind: "pointHandle", pointIndex: 0 };
      mesh.renderOrder = 12;
      addHandleSprite(mesh, pointTexture, 24);
      helperGroup.add(mesh);
      return;
    }

    const start = toSurfaceScenePoint(source.points[0], handleOffset);
    const end = toSurfaceScenePoint(source.points[1], handleOffset);
    const curvePreviewPoints = buildSurfaceCurvePreviewPoints(
      source.points[0],
      source.points[1],
      32,
      lineOffset,
    );
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curvePreviewPoints),
      lineMaterial,
    );
    line.userData.descriptor = { sourceId: source.id, kind: "curveCenter" };
    line.renderOrder = 11;
    helperGroup.add(line);

    [start, end].forEach((position, pointIndex) => {
      const mesh = new THREE.Mesh(sphereGeometry, curveMaterial);
      mesh.position.copy(position);
      mesh.userData.descriptor = { sourceId: source.id, kind: "curvePoint", pointIndex };
      mesh.renderOrder = 12;
      addHandleSprite(mesh, curveTexture, 24);
      helperGroup.add(mesh);
    });

    const center = new THREE.Mesh(boxGeometry, centerMaterial);
    center.position.copy(
      toSurfaceScenePoint(
        {
          x: (source.points[0].x + source.points[1].x) * 0.5,
          y: (source.points[0].y + source.points[1].y) * 0.5,
        },
        handleOffset * 1.15,
      ),
    );
    center.userData.descriptor = { sourceId: source.id, kind: "curveCenter" };
    center.userData.lastPosition = center.position.clone();
    center.renderOrder = 13;
    addHandleSprite(center, centerTexture, 28);
    helperGroup.add(center);
  });

  if (selectedHelperDescriptor) {
    attachHelperByDescriptor(selectedHelperDescriptor);
  }
}

function getSurfaceFrame() {
  const bounds = currentSurfaceGrid?.bounds || {
    minX: -0.5,
    maxX: 0.5,
    minY: -0.5,
    maxY: 0.5,
    width: 1,
    height: 1,
  };
  const groundedHeight = Math.max(
    0.08,
    (currentSurfaceGrid?.maxHeight ?? 0) - (currentSurfaceGrid?.minHeight ?? 0),
  );

  return {
    centerX: bounds.minX + bounds.width * 0.5,
    centerY: bounds.minY + bounds.height * 0.5,
    width: bounds.width,
    height: bounds.height,
    groundedHeight,
    targetZ: groundedHeight * 0.35,
  };
}

function setPerspectiveView() {
  const frame = getSurfaceFrame();
  camera.up.set(0, 0, 1);
  controls.target.set(frame.centerX, frame.centerY, frame.targetZ);
  camera.position.set(
    frame.centerX + frame.width * 0.74,
    frame.centerY - frame.height * 1.05,
    frame.groundedHeight * 2.3 + Math.max(frame.width, frame.height) * 0.35 + 0.35,
  );
  camera.lookAt(frame.centerX, frame.centerY, frame.targetZ);
}

function setTopView() {
  const frame = getSurfaceFrame();
  camera.up.set(0, 1, 0);
  controls.target.set(frame.centerX, frame.centerY, 0);
  camera.position.set(
    frame.centerX,
    frame.centerY,
    Math.max(frame.width, frame.height) * 1.8 + frame.groundedHeight + 0.8,
  );
  camera.lookAt(frame.centerX, frame.centerY, 0);
}

function resetSurfaceView() {
  setPerspectiveView();
  controls.update();
}

function buildSurfaceMaterial(colorMapTexture, alphaMapTexture) {
  const material = new THREE.MeshStandardMaterial({
    map: colorMapTexture,
    alphaMap: alphaMapTexture,
    transparent: true,
    alphaTest: 0.3,
    side: THREE.DoubleSide,
    roughness: state.surface.woodEnabled ? 0.78 : 0.92,
    metalness: 0.02,
  });

  if (!state.surface.woodEnabled) {
    return material;
  }

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGrainScale = { value: state.surface.grainScale };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vLocalPosition;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvLocalPosition = position;",
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vLocalPosition;
uniform float uGrainScale;
`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
vec3 baseTone = diffuseColor.rgb;
float ringScale = max(0.35, uGrainScale);
vec2 ringPoint = vec2(vLocalPosition.x * 2.2, vLocalPosition.y * 7.0);
float warpedRadius = length(ringPoint)
  + sin(vLocalPosition.z * 7.0 * ringScale + vLocalPosition.x * 3.4) * 0.12
  + sin(vLocalPosition.z * 14.0 * ringScale - vLocalPosition.y * 11.0) * 0.04;
float rings = 0.5 + 0.5 * sin(warpedRadius * 28.0 * ringScale);
float pores = 0.5 + 0.5 * sin(vLocalPosition.z * 56.0 * ringScale + vLocalPosition.x * 9.0);
float cathedrals = 0.5 + 0.5 * sin(vLocalPosition.z * 6.0 * ringScale + sin(vLocalPosition.x * 8.0) * 1.5);
float grainMask = smoothstep(0.16, 0.86, rings);
vec3 lightTone = mix(baseTone, vec3(1.0), 0.18);
vec3 darkTone = mix(baseTone, vec3(0.09, 0.07, 0.05), 0.42);
vec3 ringTone = mix(darkTone, lightTone, grainMask);
ringTone *= mix(0.92, 1.08, pores * 0.22 + cathedrals * 0.18);
diffuseColor.rgb = mix(baseTone, ringTone, 0.86);
`,
      );
  };

  material.customProgramCacheKey = () => `wood-cylinder-${state.surface.grainScale.toFixed(2)}`;
  return material;
}

function getWorldUnitsPerSourceUnit() {
  const sourceBounds = state.meta.sourceBounds || { width: 0, height: 0 };
  const worldBounds = currentSurfaceGrid?.bounds;
  if (!worldBounds) {
    return 1;
  }

  if (sourceBounds.width > 0) {
    return worldBounds.width / sourceBounds.width;
  }
  if (sourceBounds.height > 0) {
    return worldBounds.height / sourceBounds.height;
  }
  return 1;
}

function buildGridLinePositions(extentX, extentY, spacing) {
  const positions = [];
  const halfStepsX = Math.floor(extentX / spacing);
  const halfStepsY = Math.floor(extentY / spacing);

  for (let step = -halfStepsX; step <= halfStepsX; step += 1) {
    const x = step * spacing;
    positions.push(x, -extentY, 0, x, extentY, 0);
  }

  for (let step = -halfStepsY; step <= halfStepsY; step += 1) {
    const y = step * spacing;
    positions.push(-extentX, y, 0, extentX, y, 0);
  }

  return positions;
}

function updateSceneGrid() {
  if (!gridGroup || !currentSurfaceGrid) {
    return;
  }

  gridGroup.clear();
  const unitMode = state.meta.sourceUnits === "in" ? "in" : "mm";
  const majorUnitStep = unitMode === "in" ? 1 : 10;
  const minorUnitStep = unitMode === "in" ? 0.25 : 1;
  const worldPerUnit = getWorldUnitsPerSourceUnit();
  const majorSpacing = majorUnitStep * worldPerUnit;
  const minorSpacing = minorUnitStep * worldPerUnit;

  if (!(majorSpacing > 0) || !(minorSpacing > 0)) {
    return;
  }

  const bounds = currentSurfaceGrid.bounds;
  const extentX = Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)) + majorSpacing * 2;
  const extentY = Math.max(Math.abs(bounds.minY), Math.abs(bounds.maxY)) + majorSpacing * 2;

  const minorPositions = buildGridLinePositions(extentX, extentY, minorSpacing);
  const majorPositions = buildGridLinePositions(extentX, extentY, majorSpacing);

  if (minorPositions.length / 6 <= 900) {
    const minorGeometry = new THREE.BufferGeometry();
    minorGeometry.setAttribute("position", new THREE.Float32BufferAttribute(minorPositions, 3));
    const minorLines = new THREE.LineSegments(
      minorGeometry,
      new THREE.LineBasicMaterial({ color: "#d8c9b7", transparent: true, opacity: 0.48 }),
    );
    gridGroup.add(minorLines);
  }

  const majorGeometry = new THREE.BufferGeometry();
  majorGeometry.setAttribute("position", new THREE.Float32BufferAttribute(majorPositions, 3));
  const majorLines = new THREE.LineSegments(
    majorGeometry,
    new THREE.LineBasicMaterial({ color: "#b79f88", transparent: true, opacity: 0.82 }),
  );
  gridGroup.add(majorLines);

  const axisGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-extentX, 0, 0),
    new THREE.Vector3(extentX, 0, 0),
    new THREE.Vector3(0, -extentY, 0),
    new THREE.Vector3(0, extentY, 0),
  ]);
  const axisLines = new THREE.LineSegments(
    axisGeometry,
    new THREE.LineBasicMaterial({ color: "#8d7558", transparent: true, opacity: 0.95 }),
  );
  gridGroup.add(axisLines);

  gridGroup.position.z = -0.002;
}

function initThree() {
  raycaster.params.Line.threshold = 0.06;

  renderer = new THREE.WebGLRenderer({
    canvas: elements.surfaceCanvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(elements.surfaceCanvas.clientWidth, elements.surfaceCanvas.clientHeight, false);

  scene = new THREE.Scene();
  scene.background = new THREE.Color("#efe8dd");

  camera = new THREE.PerspectiveCamera(
    42,
    elements.surfaceCanvas.clientWidth / elements.surfaceCanvas.clientHeight,
    0.01,
    5000,
  );
  camera.up.set(0, 0, 1);
  camera.position.set(0.9, -1.15, 1.5);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0.04);

  scene.add(new THREE.AmbientLight("#fff7ee", 1.4));

  const keyLight = new THREE.DirectionalLight("#fff4e7", 1.6);
  keyLight.position.set(2.1, -1.8, 2.6);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight("#c9d8ff", 0.45);
  rimLight.position.set(-1.4, 1.3, 1.2);
  scene.add(rimLight);

  gridGroup = new THREE.Group();
  scene.add(gridGroup);

  helperGroup = new THREE.Group();
  scene.add(helperGroup);

  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setMode("translate");
  transformControls.showZ = false;
  transformControls.addEventListener("dragging-changed", (event) => {
    controls.enabled = !event.value;
    if (!event.value && selectedHelperDescriptor) {
      syncView();
    }
  });
  transformControls.addEventListener("objectChange", () => {
    if (!transformControls.object) {
      return;
    }
    updateStateFromSceneHandle(transformControls.object);
    renderProfileCanvas();
    updateThreeSurface();
  });
  scene.add(transformControls);

  const animate = () => {
    controls.update();
    updateHelperSpriteScales();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
}

function updateThreeSurface() {
  if (surfaceMesh) {
    scene.remove(surfaceMesh);
    surfaceMesh.geometry.dispose();
    surfaceMesh.material.dispose();
  }
  if (materialMap) {
    materialMap.dispose();
  }
  if (alphaMap) {
    alphaMap.dispose();
  }

  currentSurfaceGrid = buildSurfaceGrid(state);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(currentSurfaceGrid.positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(currentSurfaceGrid.uvs, 2));
  geometry.setIndex(currentSurfaceGrid.indices);
  geometry.computeVertexNormals();

  const { colorCanvas, alphaCanvas } = createMaterialMaps(state);
  materialMap = new THREE.CanvasTexture(colorCanvas);
  materialMap.colorSpace = THREE.SRGBColorSpace;
  materialMap.anisotropy = 4;
  materialMap.needsUpdate = true;

  alphaMap = new THREE.CanvasTexture(alphaCanvas);
  alphaMap.needsUpdate = true;

  const material = buildSurfaceMaterial(materialMap, alphaMap);

  surfaceMesh = new THREE.Mesh(geometry, material);
  surfaceMesh.position.z = -currentSurfaceGrid.minHeight;
  scene.add(surfaceMesh);
  update3DHelperObjects();
  updateSceneGrid();
}

function drawLoop(context, loop, bounds, width, height) {
  context.beginPath();
  loop.points.forEach((point, index) => {
    const canvasPoint = toCanvasPoint(point, bounds, width, height);
    if (index === 0) {
      context.moveTo(canvasPoint.x, canvasPoint.y);
    } else {
      context.lineTo(canvasPoint.x, canvasPoint.y);
    }
  });
  context.closePath();
}

function renderProfileCanvas() {
  const width = elements.profileCanvas.width;
  const height = elements.profileCanvas.height;
  profileContext.clearRect(0, 0, width, height);

  const gradient = profileContext.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(255,255,255,0.82)");
  gradient.addColorStop(1, "rgba(235,221,207,0.9)");
  profileContext.fillStyle = gradient;
  profileContext.fillRect(0, 0, width, height);

  const bounds = getLoopBounds(state.loops);

  state.loops
    .filter((loop) => loop.role === "outer" || loop.surfaceMode === "add")
    .forEach((loop, index) => {
      drawLoop(profileContext, loop, bounds, width, height);
      profileContext.fillStyle = index === 0 ? "rgba(105, 87, 63, 0.06)" : "rgba(126, 101, 70, 0.08)";
      profileContext.fill();
      profileContext.strokeStyle = "#5b4128";
      profileContext.lineWidth = 2.2;
      profileContext.stroke();
    });

  state.loops
    .filter((loop) => loop.surfaceMode === "subtract")
    .forEach((loop) => {
      drawLoop(profileContext, loop, bounds, width, height);
      profileContext.fillStyle = "rgba(158, 63, 49, 0.12)";
      profileContext.fill();
      profileContext.strokeStyle = "rgba(154, 63, 49, 0.88)";
      profileContext.lineWidth = 1.8;
      profileContext.setLineDash([8, 5]);
      profileContext.stroke();
      profileContext.setLineDash([]);
    });

  state.loops
    .filter((loop) => loop.role === "inner")
    .forEach((loop) => {
      drawLoop(profileContext, loop, bounds, width, height);
      profileContext.fillStyle = "rgba(187, 157, 122, 0.18)";
      profileContext.fill();
      profileContext.strokeStyle = "rgba(65, 44, 26, 0.72)";
      profileContext.lineWidth = 1.6;
      profileContext.stroke();
    });

  state.sources.forEach((source) => {
    profileContext.strokeStyle = source.operation === "subtract" ? "#9a3f31" : "#6f5639";
    profileContext.fillStyle = source.operation === "multiply" ? "#6d4d8f" : "#b47b45";
    profileContext.lineWidth = 2;

    if (source.type === "point") {
      const point = toCanvasPoint(source.points[0], bounds, width, height);
      profileContext.beginPath();
      profileContext.arc(point.x, point.y, 7, 0, Math.PI * 2);
      profileContext.fill();
      profileContext.stroke();
    } else {
      profileContext.beginPath();
      source.points.forEach((point, index) => {
        const canvasPoint = toCanvasPoint(point, bounds, width, height);
        if (index === 0) {
          profileContext.moveTo(canvasPoint.x, canvasPoint.y);
        } else {
          profileContext.lineTo(canvasPoint.x, canvasPoint.y);
        }
      });
      profileContext.stroke();
      source.points.forEach((point) => {
        const canvasPoint = toCanvasPoint(point, bounds, width, height);
        profileContext.beginPath();
        profileContext.arc(canvasPoint.x, canvasPoint.y, 5, 0, Math.PI * 2);
        profileContext.fill();
      });
    }
  });

  if (state.ui.pendingCurveStart) {
    const pending = toCanvasPoint(state.ui.pendingCurveStart, bounds, width, height);
    profileContext.fillStyle = "#1f5d62";
    profileContext.beginPath();
    profileContext.arc(pending.x, pending.y, 6, 0, Math.PI * 2);
    profileContext.fill();
  }
}

function distanceToCanvasSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-6) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.min(
    1,
    Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  const projection = { x: start.x + dx * t, y: start.y + dy * t };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

function pick2DSourceHandle(canvasPoint) {
  const bounds = getLoopBounds(state.loops);
  let best = null;

  state.sources.forEach((source) => {
    source.points.forEach((point, pointIndex) => {
      const screenPoint = toCanvasPoint(point, bounds, elements.profileCanvas.width, elements.profileCanvas.height);
      const distance = Math.hypot(canvasPoint.x - screenPoint.x, canvasPoint.y - screenPoint.y);
      if (!best || distance < best.distance) {
        best = {
          distance,
          sourceId: source.id,
          mode: source.type === "curve" ? "point" : "point",
          pointIndex,
        };
      }
    });

    if (source.type === "curve") {
      const start = toCanvasPoint(source.points[0], bounds, elements.profileCanvas.width, elements.profileCanvas.height);
      const end = toCanvasPoint(source.points[1], bounds, elements.profileCanvas.width, elements.profileCanvas.height);
      const distance = distanceToCanvasSegment(canvasPoint, start, end);
      if ((!best || distance < best.distance) && distance <= 12) {
        best = {
          distance,
          sourceId: source.id,
          mode: "curve",
          pointIndex: null,
        };
      }
    }
  });

  return best && best.distance <= 14 ? best : null;
}

function getCanvasPointer(event) {
  const rect = elements.profileCanvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * elements.profileCanvas.width,
    y: ((event.clientY - rect.top) / rect.height) * elements.profileCanvas.height,
  };
}

function handleProfilePointerDown(event) {
  if (state.ui.placementMode || event.button !== 0) {
    return;
  }

  const canvasPoint = getCanvasPointer(event);
  const hit = pick2DSourceHandle(canvasPoint);
  if (!hit) {
    return;
  }

  const bounds = getLoopBounds(state.loops);
  profileDragState.active = true;
  profileDragState.mode = hit.mode;
  profileDragState.sourceId = hit.sourceId;
  profileDragState.pointIndex = hit.pointIndex;
  profileDragState.lastWorldPoint = toWorldPoint(
    canvasPoint,
    bounds,
    elements.profileCanvas.width,
    elements.profileCanvas.height,
  );
  elements.profileCanvas.setPointerCapture(event.pointerId);
}

function handleProfilePointerMove(event) {
  if (!profileDragState.active) {
    return;
  }

  const bounds = getLoopBounds(state.loops);
  const canvasPoint = getCanvasPointer(event);
  const worldPoint = toWorldPoint(
    canvasPoint,
    bounds,
    elements.profileCanvas.width,
    elements.profileCanvas.height,
  );
  const source = state.sources.find((item) => item.id === profileDragState.sourceId);
  if (!source) {
    return;
  }

  if (profileDragState.mode === "curve") {
    const dx = worldPoint.x - profileDragState.lastWorldPoint.x;
    const dy = worldPoint.y - profileDragState.lastWorldPoint.y;
    source.points = source.points.map((point) => ({
      x: point.x + dx,
      y: point.y + dy,
    }));
  } else if (profileDragState.pointIndex !== null) {
    source.points[profileDragState.pointIndex] = worldPoint;
  }

  profileDragState.lastWorldPoint = worldPoint;
  renderProfileCanvas();
  updateThreeSurface();
}

function clearProfileDrag(event) {
  if (!profileDragState.active) {
    return;
  }
  profileDragState.active = false;
  profileDragState.mode = null;
  profileDragState.sourceId = null;
  profileDragState.pointIndex = null;
  profileDragState.lastWorldPoint = null;
  if (event && elements.profileCanvas.hasPointerCapture(event.pointerId)) {
    elements.profileCanvas.releasePointerCapture(event.pointerId);
  }
}

function pick3DHelper(event) {
  if (!state.ui.show3DHelpers || !helperGroup) {
    return null;
  }

  const rect = elements.surfaceCanvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(helperGroup.children, false);
  return hits.find((hit) => hit.object.userData?.descriptor)?.object || null;
}

function getSurfacePlanePoint(event) {
  const rect = elements.surfaceCanvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const intersection = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, intersection)) {
    return null;
  }

  return { x: intersection.x, y: intersection.y };
}

function applyDirectHelperDrag(worldPoint) {
  const descriptor = helperDragState.descriptor;
  if (!descriptor || !worldPoint) {
    return;
  }

  const source = state.sources.find((item) => item.id === descriptor.sourceId);
  if (!source) {
    return;
  }

  if (descriptor.kind === "curveCenter") {
    const previous = helperDragState.lastWorldPoint || worldPoint;
    const dx = worldPoint.x - previous.x;
    const dy = worldPoint.y - previous.y;
    source.points = source.points.map((point) => ({
      x: point.x + dx,
      y: point.y + dy,
    }));
  } else {
    const pointIndex = descriptor.pointIndex ?? 0;
    source.points[pointIndex] = { x: worldPoint.x, y: worldPoint.y };
  }

  helperDragState.lastWorldPoint = worldPoint;
  renderProfileCanvas();
  updateThreeSurface();
}

function handleSurfacePointerDown(event) {
  const picked = pick3DHelper(event);
  if (!picked) {
    return;
  }

  selectedHelperDescriptor = picked.userData.descriptor;
  attachHelperByDescriptor(selectedHelperDescriptor);
  helperDragState.active = true;
  helperDragState.pointerId = event.pointerId;
  helperDragState.descriptor = selectedHelperDescriptor;
  helperDragState.lastWorldPoint = getSurfacePlanePoint(event);
  controls.enabled = false;
  elements.surfaceCanvas.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function handleSurfacePointerMove(event) {
  if (!helperDragState.active || event.pointerId !== helperDragState.pointerId) {
    return;
  }

  const worldPoint = getSurfacePlanePoint(event);
  if (!worldPoint) {
    return;
  }

  applyDirectHelperDrag(worldPoint);
  event.preventDefault();
}

function clearSurfaceDrag(event) {
  if (event && helperDragState.pointerId !== null && event.pointerId !== helperDragState.pointerId) {
    return;
  }

  helperDragState.active = false;
  helperDragState.pointerId = null;
  helperDragState.descriptor = null;
  helperDragState.lastWorldPoint = null;
  controls.enabled = true;

  if (
    event &&
    elements.surfaceCanvas.hasPointerCapture(event.pointerId)
  ) {
    elements.surfaceCanvas.releasePointerCapture(event.pointerId);
  }
}

function renderRangeControl(source, field, label, min, max, step) {
  const value = Number(source[field]);
  const effectiveMin = Number.isFinite(value) ? Math.min(min, value) : min;
  const effectiveMax = Number.isFinite(value) ? Math.max(max, value) : max;

  return `
    <label class="control">
      <span>${label}</span>
      <div class="value-control">
        <input
          type="range"
          min="${effectiveMin}"
          max="${effectiveMax}"
          step="${step}"
          value="${source[field]}"
          data-source-id="${source.id}"
          data-field="${field}"
        />
        <input
          type="number"
          min="${effectiveMin}"
          max="${effectiveMax}"
          step="${step}"
          value="${source[field]}"
          data-source-id="${source.id}"
          data-field="${field}"
        />
      </div>
    </label>
  `;
}

function handleSourceInput(event) {
  const { sourceId, field } = event.target.dataset;
  const source = state.sources.find((item) => item.id === sourceId);
  if (!source) {
    return;
  }

  if (event.target.type === "range" || event.target.type === "number") {
    const control = event.target.closest(".value-control");
    if (control) {
      const rangeInput = control.querySelector('input[type="range"]');
      const numberInput = control.querySelector('input[type="number"]');
      if (rangeInput && numberInput) {
        if (event.target.type === "number" && event.type !== "change") {
          return;
        }
        if (event.target.type === "number") {
          expandPairedBounds(rangeInput, numberInput, event.target.value);
        }
        const nextValue = setPairedValue(rangeInput, numberInput, event.target.value, (value) =>
          Number(value).toFixed(3),
        );
        source[field] = nextValue;
      } else {
        source[field] = clampToInput(event.target, event.target.value);
      }
    } else {
      source[field] = clampToInput(event.target, event.target.value);
    }
  } else {
    source[field] = event.target.value;
  }

  syncStatus();
  renderProfileCanvas();
  updateThreeSurface();
}

function renderSourceList() {
  elements.sourceList.innerHTML = "";
  state.sources.forEach((source) => {
    const card = document.createElement("article");
    card.className = "source-card";
    card.innerHTML = `
      <header>
        <div>
          <h3>${source.label}</h3>
          <p>${source.type === "point" ? "Radial wave source" : "Distance-to-curve wave source"}</p>
        </div>
        <button data-action="remove-source" data-source-id="${source.id}" class="ghost-button">Remove</button>
      </header>
      <div class="inline-grid">
        ${renderRangeControl(source, "amplitude", "Amplitude", 0, 2, 0.01)}
        ${renderRangeControl(source, "frequency", "Frequency", 0.002, 0.12, 0.001)}
        ${renderRangeControl(source, "phase", "Phase", 0, 6.28, 0.01)}
        ${renderRangeControl(source, "decay", "Decay", 0, 0.08, 0.001)}
        ${renderRangeControl(source, "reach", "Reach", 5, 200, 1)}
        <label class="control">
          <span>Continuation</span>
          <select data-source-id="${source.id}" data-field="continuation">
            ${["damped", "sustain", "clipped"]
              .map((value) => `<option value="${value}" ${source.continuation === value ? "selected" : ""}>${value}</option>`)
              .join("")}
          </select>
        </label>
        <label class="control">
          <span>Combine</span>
          <select data-source-id="${source.id}" data-field="operation">
            ${["add", "subtract", "multiply"]
              .map((value) => `<option value="${value}" ${source.operation === value ? "selected" : ""}>${value}</option>`)
              .join("")}
          </select>
        </label>
      </div>
    `;
    elements.sourceList.append(card);

    card.querySelectorAll('input[type="range"]').forEach((input) => {
      input.addEventListener("input", handleSourceInput);
    });
    card.querySelectorAll('input[type="number"]').forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        handleSourceInput({ target: input, type: "change" });
      });
      input.addEventListener("blur", () => {
        const control = input.closest(".value-control");
        const rangeInput = control?.querySelector('input[type="range"]');
        if (rangeInput) {
          resetNumberInputDisplay(rangeInput, input, (value) => Number(value).toFixed(3));
        }
      });
    });
    card.querySelectorAll("select").forEach((input) => {
      input.addEventListener("change", handleSourceInput);
    });
    card.querySelector("button").addEventListener("click", () => {
      state.sources = state.sources.filter((item) => item.id !== source.id);
      state.ui.status = `Removed ${source.label}.`;
      syncView();
    });
  });
}

function renderRegionList() {
  const innerLoops = state.loops.filter((loop) => loop.role === "inner");
  if (!innerLoops.length) {
    elements.regionList.innerHTML = '<p class="status-text">No interior color-break regions detected.</p>';
    return;
  }

  elements.regionList.innerHTML = "";
  innerLoops.forEach((loop) => {
    const card = document.createElement("article");
    card.className = "region-card";
    card.innerHTML = `
      <header>
        <div>
          <h3>${loop.label}</h3>
          <p>Interior material break</p>
        </div>
      </header>
      <label class="control">
        <span>Species</span>
        <select data-loop-id="${loop.id}">
          ${state.meta.speciesList
            .map((name) => `<option value="${name}" ${loop.species === name ? "selected" : ""}>${formatSpeciesName(name)}</option>`)
            .join("")}
        </select>
      </label>
    `;
    card.querySelector("select").addEventListener("change", (event) => {
      loop.species = event.target.value;
      syncView();
    });
    elements.regionList.append(card);
  });
}

function renderImageTraceList() {
  if (!state.meta.imageTraceCandidates?.length) {
    elements.imageTraceList.innerHTML = "";
    return;
  }

  const selection = sanitizeTraceSelection(
    state.meta.imageTraceCandidates,
    state.meta.imageTraceSelection,
  );
  state.meta.imageTraceSelection = selection;
  const rows = state.meta.imageTraceCandidates
    .map((candidate, index) => {
      const mode = selection.modes[candidate.id] || (index === 0 ? "surface" : "add");
      return `
        <div class="trace-row">
          <span class="trace-row-label">
            <strong>${candidate.label}${index === 0 ? " - Surface" : ""}</strong>
            <span>${index === 0 ? "Largest traced region" : "Perimeter region"}</span>
          </span>
          ${
            index === 0
              ? '<span class="trace-row-mode">Surface</span>'
              : `
                <select class="trace-mode-select" data-trace-id="${candidate.id}">
                  <option value="add" ${mode === "add" ? "selected" : ""}>Add</option>
                  <option value="subtract" ${mode === "subtract" ? "selected" : ""}>Subtract</option>
                  <option value="off" ${mode === "off" ? "selected" : ""}>Ignore</option>
                </select>
              `
          }
          <span class="trace-row-area">${formatAreaReadout(candidate.area)}</span>
        </div>
      `;
    })
    .join("");

  elements.imageTraceList.innerHTML = `<article class="trace-card trace-list-card">${rows}</article>`;

  elements.imageTraceList.querySelectorAll(".trace-mode-select").forEach((select) => {
    select.addEventListener("change", (event) => {
      state.meta.imageTraceSelection = sanitizeTraceSelection(state.meta.imageTraceCandidates, {
        modes: {
          ...state.meta.imageTraceSelection.modes,
          [event.target.dataset.traceId]: event.target.value,
        },
      });
      applyImageTraceSelection();
      syncView();
    });
  });
}

function syncStatus() {
  elements.profileStatus.textContent = state.ui.status;
  elements.sourceModeStatus.textContent =
    state.ui.placementMode === "point"
      ? "Click anywhere inside the profile to place a point wave source."
      : state.ui.placementMode === "curve"
        ? state.ui.pendingCurveStart
          ? "Click a second time to finish the curve source."
          : "Click the first point of the curve source."
        : "Click Add Point or Add Curve, then place the source in the 2D view.";
}

function syncView() {
  elements.imageThresholdInput.value = String(state.importSettings.imageThreshold);
  elements.imageThresholdNumber.value = String(state.importSettings.imageThreshold);
  elements.invertImageInput.checked = state.importSettings.invertImage;
  elements.imageTargetRegionsInput.value = String(state.importSettings.imageTargetRegions);
  elements.svgSamplesInput.value = String(state.importSettings.curveSamples);
  elements.svgSamplesNumber.value = String(state.importSettings.curveSamples);
  elements.unitsMmButton.classList.toggle("is-active", state.importSettings.units === "mm");
  elements.unitsInButton.classList.toggle("is-active", state.importSettings.units === "in");
  elements.importWidthInput.value = Number(state.importSettings.importWidth).toFixed(3);
  elements.importHeightInput.value = Number(state.importSettings.importHeight).toFixed(3);
  elements.aspectLockInput.checked = state.importSettings.aspectLocked;
  elements.importProfileButton.disabled = !state.meta.pendingImportFile;
  elements.importProfileButton.textContent = state.meta.pendingImportFile
    ? `Import ${state.meta.pendingImportFile.name}`
    : "Import Selected File";
  elements.resolutionInput.value = String(state.surface.resolution);
  elements.resolutionNumber.value = String(state.surface.resolution);
  elements.heightScaleInput.value = String(state.surface.heightScale);
  elements.heightScaleNumber.value = String(state.surface.heightScale);
  elements.edgeFadeInput.value = String(state.surface.edgeFade);
  elements.edgeFadeNumber.value = String(state.surface.edgeFade);
  elements.woodToggleInput.checked = state.surface.woodEnabled;
  elements.speciesSelect.value = state.surface.species;
  elements.grainScaleInput.value = String(state.surface.grainScale);
  elements.grainScaleNumber.value = String(state.surface.grainScale);

  updateImportOptionsVisibility();
  elements.bboxReadout.textContent = formatBoundsReadout();
  elements.toggleHelpersButton.textContent = state.ui.show3DHelpers ? "Hide Guides" : "Show Guides";
  syncImageTraceStatus();
  renderImageTraceList();
  renderSourceList();
  renderRegionList();
  syncStatus();
  syncCanvasSizes();
  renderProfileCanvas();
  updateThreeSurface();
}

function updateSurfaceSetting(key, value) {
  state.surface[key] = value;
  syncView();
}

function bindPairedControl(rangeInput, numberInput, onChange, formatter = (value) => value) {
  const applyValue = (rawValue, expandBounds = false) => {
    if (expandBounds) {
      expandPairedBounds(rangeInput, numberInput, rawValue);
    }
    const nextValue = setPairedValue(rangeInput, numberInput, rawValue, formatter);
    onChange(nextValue);
  };

  rangeInput.addEventListener("input", (event) => {
    applyValue(event.target.value);
  });

  numberInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    applyValue(event.target.value, true);
  });

  numberInput.addEventListener("blur", () => {
    resetNumberInputDisplay(rangeInput, numberInput, formatter);
  });
}

function updateImportSize(axis, rawValue) {
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    syncView();
    return;
  }

  const aspectRatio = getAspectRatio(state.meta.nativeSourceBounds || state.meta.sourceBounds);
  if (axis === "width") {
    state.importSettings.importWidth = numericValue;
    if (state.importSettings.aspectLocked) {
      state.importSettings.importHeight = numericValue / aspectRatio;
    }
  } else {
    state.importSettings.importHeight = numericValue;
    if (state.importSettings.aspectLocked) {
      state.importSettings.importWidth = numericValue * aspectRatio;
    }
  }

  if (state.meta.pendingImportFile) {
    state.ui.status = `Updated import size for ${state.meta.pendingImportFile.name}. Click Import Selected File.`;
    syncView();
    return;
  }

  if (state.meta.importedFile) {
    refreshImportedProfile("Updated import size");
    return;
  }

  syncView();
}

function setImportUnits(nextUnits) {
  if (state.importSettings.units === nextUnits) {
    return;
  }

  const previousUnits = state.importSettings.units;
  state.importSettings.units = nextUnits;
  state.importSettings.importWidth = convertUnitValue(
    state.importSettings.importWidth,
    previousUnits,
    nextUnits,
  );
  state.importSettings.importHeight = convertUnitValue(
    state.importSettings.importHeight,
    previousUnits,
    nextUnits,
  );
  state.meta.sourceUnits = nextUnits;

  if (state.meta.pendingImportFile) {
    state.ui.status = `Updated import units for ${state.meta.pendingImportFile.name}. Click Import Selected File.`;
    syncView();
    return;
  }

  if (state.meta.importedFile) {
    refreshImportedProfile("Updated import units");
    return;
  }

  syncView();
}

function resetToSample() {
  const fresh = createDefaultState();
  state.loops = fresh.loops;
  state.sources = fresh.sources;
  state.surface = fresh.surface;
  state.ui = fresh.ui;
  state.meta.importName = fresh.meta.importName;
  state.meta.importedFile = null;
  state.meta.pendingImportFile = null;
  state.meta.pendingImportKind = null;
  state.meta.importRequestId = 0;
  state.meta.importKind = fresh.meta.importKind;
  state.meta.sourceBounds = fresh.meta.sourceBounds;
  state.meta.nativeSourceBounds = fresh.meta.nativeSourceBounds;
  state.meta.sourceUnits = fresh.meta.sourceUnits;
  state.meta.imageTraceCandidates = fresh.meta.imageTraceCandidates;
  state.meta.imageTraceSelection = fresh.meta.imageTraceSelection;
  state.meta.imageTraceDirty = fresh.meta.imageTraceDirty;
  state.importSettings.imageThreshold = fresh.importSettings.imageThreshold;
  state.importSettings.invertImage = fresh.importSettings.invertImage;
  state.importSettings.imageTargetRegions = fresh.importSettings.imageTargetRegions;
  state.importSettings.curveSamples = fresh.importSettings.curveSamples;
  state.importSettings.units = fresh.importSettings.units;
  state.importSettings.importWidth = fresh.importSettings.importWidth;
  state.importSettings.importHeight = fresh.importSettings.importHeight;
  state.importSettings.aspectLocked = fresh.importSettings.aspectLocked;
  state.ui.status = "Loaded the bundled sample profile.";
  elements.profileFileInput.value = "";
  populateSpeciesSelects();
  syncView();
  resetSurfaceView();
}

async function handleImport(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  state.meta.pendingImportFile = file;
  state.meta.pendingImportKind = getImportKindForFile(file);
  state.ui.status = `Selected ${file.name}. Adjust import settings, then click Import Selected File.`;
  syncView();
}

async function importPendingFile() {
  const file = state.meta.pendingImportFile;
  if (!file) {
    state.ui.status = "Choose a file first.";
    syncStatus();
    return;
  }

  try {
    state.ui.status = `Importing ${file.name}...`;
    syncStatus();
    const importedBase = await importProfile(file, state.importSettings);
    if (!importedBase.loops.length) {
      throw new Error("No closed loops were found in that file.");
    }

    if (importedBase.importKind === "image") {
      const aspectRatio = getAspectRatio(importedBase.sourceBounds);
      const defaultLongSide = state.importSettings.units === "in" ? 6 : 150;
      if ((importedBase.sourceBounds.width || 0) >= (importedBase.sourceBounds.height || 0)) {
        state.importSettings.importWidth = defaultLongSide;
        state.importSettings.importHeight = defaultLongSide / aspectRatio;
      } else {
        state.importSettings.importHeight = defaultLongSide;
        state.importSettings.importWidth = defaultLongSide * aspectRatio;
      }
    } else {
      state.importSettings.importWidth = importedBase.sourceBounds.width || 1;
      state.importSettings.importHeight = importedBase.sourceBounds.height || 1;
    }
    state.importSettings.aspectLocked = true;

    const imported = prepareImportedResult(importedBase);

    state.meta.importedFile = file;
    state.meta.pendingImportFile = null;
    state.meta.pendingImportKind = null;
    applyImportedResult(imported, file.name);
    state.ui.status = `Imported ${file.name}. Largest loop is driving the surface; ${Math.max(imported.loops.length - 1, 0)} inner loop(s) are used as color regions.`;
    syncView();
    resetSurfaceView();
  } catch (error) {
    state.ui.status = error instanceof Error ? error.message : "Import failed.";
    syncStatus();
  }
}

function addSourceFromCanvas(event) {
  if (!state.ui.placementMode) {
    return;
  }

  const rect = elements.profileCanvas.getBoundingClientRect();
  const canvasPoint = {
    x: ((event.clientX - rect.left) / rect.width) * elements.profileCanvas.width,
    y: ((event.clientY - rect.top) / rect.height) * elements.profileCanvas.height,
  };
  const worldPoint = toWorldPoint(
    canvasPoint,
    getLoopBounds(state.loops),
    elements.profileCanvas.width,
    elements.profileCanvas.height,
  );

  if (state.ui.placementMode === "point") {
    const pointCount = state.sources.filter((source) => source.type === "point").length + 1;
    state.sources.push(createSource("point", [worldPoint], pointCount));
    state.ui.placementMode = null;
    state.ui.status = "Added a point wave source.";
    syncView();
    return;
  }

  if (!state.ui.pendingCurveStart) {
    state.ui.pendingCurveStart = worldPoint;
    syncView();
    return;
  }

  const curveCount = state.sources.filter((source) => source.type === "curve").length + 1;
  state.sources.push(createSource("curve", [state.ui.pendingCurveStart, worldPoint], curveCount));
  state.ui.pendingCurveStart = null;
  state.ui.placementMode = null;
  state.ui.status = "Added a curve wave source.";
  syncView();
}

function wireEvents() {
  elements.profileFileInput.addEventListener("change", handleImport);
  elements.importProfileButton.addEventListener("click", importPendingFile);
  elements.loadSampleButton.addEventListener("click", resetToSample);

  bindPairedControl(elements.imageThresholdInput, elements.imageThresholdNumber, (value) => {
    state.importSettings.imageThreshold = Number(value);
    if (state.meta.pendingImportFile && state.meta.pendingImportKind === "image") {
      state.ui.status = `Updated image trace settings for ${state.meta.pendingImportFile.name}. Click Import Selected File.`;
      syncStatus();
      syncImageTraceStatus();
      return;
    }
    if (state.meta.importedFile && state.meta.importKind === "image") {
      queueImageRetrace("Updated image threshold");
      return;
    }
    syncView();
  });
  elements.invertImageInput.addEventListener("change", (event) => {
    state.importSettings.invertImage = event.target.checked;
    if (state.meta.pendingImportFile && state.meta.pendingImportKind === "image") {
      state.ui.status = `Updated image trace settings for ${state.meta.pendingImportFile.name}. Click Import Selected File.`;
      syncStatus();
      syncImageTraceStatus();
      return;
    }
    if (state.meta.importedFile && state.meta.importKind === "image") {
      queueImageRetrace("Updated image trace");
      return;
    }
    syncView();
  });
  elements.imageTargetRegionsInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    state.importSettings.imageTargetRegions = Math.max(0, Math.round(Number(event.target.value) || 0));
    if (state.meta.pendingImportFile && state.meta.pendingImportKind === "image") {
      state.ui.status = `Updated image trace settings for ${state.meta.pendingImportFile.name}. Click Import Selected File.`;
      syncStatus();
      syncImageTraceStatus();
      syncView();
      return;
    }
    if (state.meta.importedFile && state.meta.importKind === "image") {
      queueImageRetrace("Updated target regions");
      syncView();
      return;
    }
    syncView();
  });
  elements.imageTargetRegionsInput.addEventListener("blur", () => {
    elements.imageTargetRegionsInput.value = String(state.importSettings.imageTargetRegions);
  });
  elements.retraceImageButton.addEventListener("click", () => {
    if (!state.meta.importedFile || state.meta.importKind !== "image") {
      return;
    }
    refreshImportedProfile("Retraced image");
  });
  bindPairedControl(elements.svgSamplesInput, elements.svgSamplesNumber, (value) => {
    state.importSettings.curveSamples = Number(value);
    if (state.meta.pendingImportFile && state.meta.pendingImportKind === "vector") {
      state.ui.status = `Updated vector import settings for ${state.meta.pendingImportFile.name}. Click Import Selected File.`;
      syncStatus();
      return;
    }
    refreshImportedProfile("Updated curve sampling");
  });
  elements.unitsMmButton.addEventListener("click", () => setImportUnits("mm"));
  elements.unitsInButton.addEventListener("click", () => setImportUnits("in"));
  elements.importWidthInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    updateImportSize("width", event.target.value);
  });
  elements.importWidthInput.addEventListener("blur", () => {
    elements.importWidthInput.value = Number(state.importSettings.importWidth).toFixed(3);
  });
  elements.importHeightInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    updateImportSize("height", event.target.value);
  });
  elements.importHeightInput.addEventListener("blur", () => {
    elements.importHeightInput.value = Number(state.importSettings.importHeight).toFixed(3);
  });
  elements.aspectLockInput.addEventListener("change", (event) => {
    state.importSettings.aspectLocked = event.target.checked;
    if (state.importSettings.aspectLocked) {
      updateImportSize("width", state.importSettings.importWidth);
      return;
    }
    syncView();
  });

  bindPairedControl(elements.resolutionInput, elements.resolutionNumber, (value) => {
    updateSurfaceSetting("resolution", Number(value));
  });
  bindPairedControl(elements.heightScaleInput, elements.heightScaleNumber, (value) => {
    updateSurfaceSetting("heightScale", Number(value));
  }, (value) => Number(value).toFixed(2));
  bindPairedControl(elements.edgeFadeInput, elements.edgeFadeNumber, (value) => {
    updateSurfaceSetting("edgeFade", Number(value));
  }, (value) => Number(value).toFixed(2));
  elements.woodToggleInput.addEventListener("change", (event) => {
    updateSurfaceSetting("woodEnabled", event.target.checked);
  });
  elements.speciesSelect.addEventListener("change", (event) => {
    updateSurfaceSetting("species", event.target.value);
  });
  bindPairedControl(elements.grainScaleInput, elements.grainScaleNumber, (value) => {
    updateSurfaceSetting("grainScale", Number(value));
  }, (value) => Number(value).toFixed(2));

  elements.addPointSourceButton.addEventListener("click", () => {
    state.ui.placementMode = "point";
    state.ui.pendingCurveStart = null;
    state.ui.status = "Placing a new point source.";
    syncStatus();
  });

  elements.addCurveSourceButton.addEventListener("click", () => {
    state.ui.placementMode = "curve";
    state.ui.pendingCurveStart = null;
    state.ui.status = "Placing a new curve source.";
    syncStatus();
  });

  elements.profileCanvas.addEventListener("click", addSourceFromCanvas);
  elements.profileCanvas.addEventListener("pointerdown", handleProfilePointerDown);
  elements.profileCanvas.addEventListener("pointermove", handleProfilePointerMove);
  elements.profileCanvas.addEventListener("pointerup", clearProfileDrag);
  elements.profileCanvas.addEventListener("pointercancel", clearProfileDrag);
  elements.surfaceCanvas.addEventListener("pointerdown", handleSurfacePointerDown);
  elements.surfaceCanvas.addEventListener("pointermove", handleSurfacePointerMove);
  elements.surfaceCanvas.addEventListener("pointerup", clearSurfaceDrag);
  elements.surfaceCanvas.addEventListener("pointercancel", clearSurfaceDrag);

  elements.perspectiveViewButton.addEventListener("click", setPerspectiveView);
  elements.topViewButton.addEventListener("click", setTopView);
  elements.resetViewButton.addEventListener("click", resetSurfaceView);
  elements.toggleHelpersButton.addEventListener("click", () => {
    state.ui.show3DHelpers = !state.ui.show3DHelpers;
    syncView();
  });

  elements.exportStlButton.addEventListener("click", () => {
    exportStlMesh(buildExportQuads(state, currentSurfaceGrid));
  });
  elements.exportObjButton.addEventListener("click", () => {
    exportObjMesh(buildExportQuads(state, currentSurfaceGrid));
  });
  elements.exportJsonButton.addEventListener("click", () => {
    exportSurfaceJson(buildExportQuads(state, currentSurfaceGrid), state);
  });

  window.addEventListener("resize", () => {
    syncCanvasSizes();
    clampFloatingProfileCard();
  });
}

populateSpeciesSelects();
initThree();
initFloatingProfileCard();
wireEvents();
syncView();
resetSurfaceView();
