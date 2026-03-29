import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createDefaultState, createSource, assignLoopMetadata } from "./state.js";
import {
  buildExportQuads,
  buildSurfaceGrid,
  getLoopBounds,
  pointInPolygon,
  polygonArea,
  sampleHeight,
  sampleCurveSourcePolyline,
  toCanvasPoint,
  toWorldPoint,
} from "./geometry.js";
import { importProfile, previewImageTrace } from "./importers.js";
import { createMaterialMaps, speciesPresets } from "./materials.js";
import { exportObjMesh, exportStlMesh, exportSurfaceJson } from "./exporters.js";

const state = createDefaultState();
const SURFACE_PLANE_OFFSET = 0.05;
const HANDLE_COLORS = {
  point: { fill: "#f0a34b", stroke: "#7b3c10", emissive: "#a65012" },
  curve: { fill: "#59a8ff", stroke: "#1a4b80", emissive: "#1b4e84" },
  center: { fill: "#8dd06b", stroke: "#2f5d17", emissive: "#2f5d17" },
  selected: { fill: "#f4db5b", stroke: "#8c6d00", emissive: "#8c6d00" },
};

const elements = {
  appShell: document.querySelector(".app-shell"),
  workspace: document.querySelector(".workspace"),
  body: document.body,
  sidebar: document.querySelector(".sidebar"),
  sidebarSplitter: document.getElementById("sidebarSplitter"),
  profileCard: document.querySelector(".profile-card"),
  profileCardHeader: document.querySelector(".profile-card-header"),
  surfaceCardHeader: document.querySelector(".surface-card .card-header"),
  profileCanvas: document.getElementById("profileCanvas"),
  surfaceCanvas: document.getElementById("surfaceCanvas"),
  imageImportOptions: document.getElementById("imageImportOptions"),
  imageTracePanel: document.getElementById("imageTracePanel"),
  imageTraceList: document.getElementById("imageTraceList"),
  applyTraceRegionsButton: document.getElementById("applyTraceRegionsButton"),
  finalizeTraceButton: document.getElementById("finalizeTraceButton"),
  importSizingControls: document.getElementById("importSizingControls"),
  vectorImportOptions: document.getElementById("vectorImportOptions"),
  profileDropZone: document.getElementById("profileDropZone"),
  profileDropZoneLabel: document.getElementById("profileDropZoneLabel"),
  profileFileInput: document.getElementById("profileFileInput"),
  saveProjectButton: document.getElementById("saveProjectButton"),
  openProjectButton: document.getElementById("openProjectButton"),
  openProjectInput: document.getElementById("openProjectInput"),
  projectFileSummary: document.getElementById("projectFileSummary"),
  projectUnitsSummary: document.getElementById("projectUnitsSummary"),
  projectBoundsSummary: document.getElementById("projectBoundsSummary"),
  projectRegionSummary: document.getElementById("projectRegionSummary"),
  projectSourceSummary: document.getElementById("projectSourceSummary"),
  importProfileButton: document.getElementById("importProfileButton"),
  profileStatus: document.getElementById("profileStatus"),
  tracePresetLogoButton: document.getElementById("tracePresetLogoButton"),
  tracePresetLineArtButton: document.getElementById("tracePresetLineArtButton"),
  tracePresetPhotoButton: document.getElementById("tracePresetPhotoButton"),
  imageThresholdInput: document.getElementById("imageThresholdInput"),
  imageThresholdNumber: document.getElementById("imageThresholdNumber"),
  imageImportModeThresholdButton: document.getElementById("imageImportModeThresholdButton"),
  imageImportModeSegmentationButton: document.getElementById("imageImportModeSegmentationButton"),
  thresholdMethodSettings: document.getElementById("thresholdMethodSettings"),
  segmentationMethodSettings: document.getElementById("segmentationMethodSettings"),
  imageAdvancedControls: document.getElementById("imageAdvancedControls"),
  toggleImageAdvancedButton: document.getElementById("toggleImageAdvancedButton"),
  invertImageInput: document.getElementById("invertImageInput"),
  imageColorSamplesInput: document.getElementById("imageColorSamplesInput"),
  imageColorSamplesNumber: document.getElementById("imageColorSamplesNumber"),
  imagePhotoPrepInput: document.getElementById("imagePhotoPrepInput"),
  imageUpscaleOffButton: document.getElementById("imageUpscaleOffButton"),
  imageUpscale2xButton: document.getElementById("imageUpscale2xButton"),
  imageUpscale4xButton: document.getElementById("imageUpscale4xButton"),
  imageFlattenShadingInput: document.getElementById("imageFlattenShadingInput"),
  imageFlattenStrengthInput: document.getElementById("imageFlattenStrengthInput"),
  imageFlattenStrengthNumber: document.getElementById("imageFlattenStrengthNumber"),
  imageColorToleranceInput: document.getElementById("imageColorToleranceInput"),
  imageColorToleranceNumber: document.getElementById("imageColorToleranceNumber"),
  imageMinRegionAreaInput: document.getElementById("imageMinRegionAreaInput"),
  imageMinRegionAreaNumber: document.getElementById("imageMinRegionAreaNumber"),
  imageCornerSmoothingInput: document.getElementById("imageCornerSmoothingInput"),
  imageCornerSmoothingNumber: document.getElementById("imageCornerSmoothingNumber"),
  imagePathSimplificationInput: document.getElementById("imagePathSimplificationInput"),
  imagePathSimplificationNumber: document.getElementById("imagePathSimplificationNumber"),
  retraceImageButton: document.getElementById("retraceImageButton"),
  imageTraceStatus: document.getElementById("imageTraceStatus"),
  imageColorPreviewCard: document.getElementById("imageColorPreviewCard"),
  imageThresholdPreviewCard: document.getElementById("imageThresholdPreviewCard"),
  imageColorPreviewCanvas: document.getElementById("imageColorPreviewCanvas"),
  imageThresholdPreviewCanvas: document.getElementById("imageThresholdPreviewCanvas"),
  imagePreviewPrimaryLabel: document.getElementById("imagePreviewPrimaryLabel"),
  imagePreviewSecondaryLabel: document.getElementById("imagePreviewSecondaryLabel"),
  imagePreviewStatus: document.getElementById("imagePreviewStatus"),
  imagePreviewModal: document.getElementById("imagePreviewModal"),
  closeImagePreviewModalButton: document.getElementById("closeImagePreviewModalButton"),
  modalImageImportModeThresholdButton: document.getElementById("modalImageImportModeThresholdButton"),
  modalImageImportModeSegmentationButton: document.getElementById("modalImageImportModeSegmentationButton"),
  modalTracePresetLogoButton: document.getElementById("modalTracePresetLogoButton"),
  modalTracePresetLineArtButton: document.getElementById("modalTracePresetLineArtButton"),
  modalTracePresetPhotoButton: document.getElementById("modalTracePresetPhotoButton"),
  modalThresholdMethodSettings: document.getElementById("modalThresholdMethodSettings"),
  modalSegmentationMethodSettings: document.getElementById("modalSegmentationMethodSettings"),
  modalImageAdvancedControls: document.getElementById("modalImageAdvancedControls"),
  modalToggleImageAdvancedButton: document.getElementById("modalToggleImageAdvancedButton"),
  modalImageThresholdInput: document.getElementById("modalImageThresholdInput"),
  modalImageThresholdNumber: document.getElementById("modalImageThresholdNumber"),
  modalImageColorToleranceInput: document.getElementById("modalImageColorToleranceInput"),
  modalImageColorToleranceNumber: document.getElementById("modalImageColorToleranceNumber"),
  modalImageColorSamplesInput: document.getElementById("modalImageColorSamplesInput"),
  modalImageColorSamplesNumber: document.getElementById("modalImageColorSamplesNumber"),
  modalImagePhotoPrepInput: document.getElementById("modalImagePhotoPrepInput"),
  modalImageUpscaleOffButton: document.getElementById("modalImageUpscaleOffButton"),
  modalImageUpscale2xButton: document.getElementById("modalImageUpscale2xButton"),
  modalImageUpscale4xButton: document.getElementById("modalImageUpscale4xButton"),
  modalImageFlattenShadingInput: document.getElementById("modalImageFlattenShadingInput"),
  modalImageFlattenStrengthInput: document.getElementById("modalImageFlattenStrengthInput"),
  modalImageFlattenStrengthNumber: document.getElementById("modalImageFlattenStrengthNumber"),
  modalImageMinRegionAreaInput: document.getElementById("modalImageMinRegionAreaInput"),
  modalImageMinRegionAreaNumber: document.getElementById("modalImageMinRegionAreaNumber"),
  modalImageCornerSmoothingInput: document.getElementById("modalImageCornerSmoothingInput"),
  modalImageCornerSmoothingNumber: document.getElementById("modalImageCornerSmoothingNumber"),
  modalImagePathSimplificationInput: document.getElementById("modalImagePathSimplificationInput"),
  modalImagePathSimplificationNumber: document.getElementById("modalImagePathSimplificationNumber"),
  modalInvertImageInput: document.getElementById("modalInvertImageInput"),
  modalRetraceImageButton: document.getElementById("modalRetraceImageButton"),
  modalImageColorPreviewCanvas: document.getElementById("modalImageColorPreviewCanvas"),
  modalImageThresholdPreviewCanvas: document.getElementById("modalImageThresholdPreviewCanvas"),
  modalImagePreviewPrimaryLabel: document.getElementById("modalImagePreviewPrimaryLabel"),
  modalImagePreviewSecondaryLabel: document.getElementById("modalImagePreviewSecondaryLabel"),
  modalImagePreviewStatus: document.getElementById("modalImagePreviewStatus"),
  modalImageTraceStatus: document.getElementById("modalImageTraceStatus"),
  svgSamplesInput: document.getElementById("svgSamplesInput"),
  svgSamplesNumber: document.getElementById("svgSamplesNumber"),
  unitsMmButton: document.getElementById("unitsMmButton"),
  unitsInButton: document.getElementById("unitsInButton"),
  importWidthInput: document.getElementById("importWidthInput"),
  importHeightInput: document.getElementById("importHeightInput"),
  aspectLockInput: document.getElementById("aspectLockInput"),
  resolutionInput: document.getElementById("resolutionInput"),
  resolutionNumber: document.getElementById("resolutionNumber"),
  previewQualityLowButton: document.getElementById("previewQualityLowButton"),
  previewQualityMediumButton: document.getElementById("previewQualityMediumButton"),
  previewQualityHighButton: document.getElementById("previewQualityHighButton"),
  heightScaleInput: document.getElementById("heightScaleInput"),
  heightScaleNumber: document.getElementById("heightScaleNumber"),
  edgeFadeControl: document.getElementById("edgeFadeControl"),
  edgeFadeEnabledInput: document.getElementById("edgeFadeEnabledInput"),
  edgeFadeInput: document.getElementById("edgeFadeInput"),
  edgeFadeNumber: document.getElementById("edgeFadeNumber"),
  internalEdgeFadeControl: document.getElementById("internalEdgeFadeControl"),
  internalEdgeFadeEnabledInput: document.getElementById("internalEdgeFadeEnabledInput"),
  internalEdgeFadeInput: document.getElementById("internalEdgeFadeInput"),
  internalEdgeFadeNumber: document.getElementById("internalEdgeFadeNumber"),
  showSurfaceResolutionInput: document.getElementById("showSurfaceResolutionInput"),
  woodToggleInput: document.getElementById("woodToggleInput"),
  grainScaleInput: document.getElementById("grainScaleInput"),
  grainScaleNumber: document.getElementById("grainScaleNumber"),
  grainNoiseInput: document.getElementById("grainNoiseInput"),
  grainNoiseNumber: document.getElementById("grainNoiseNumber"),
  grainLayerSizeInput: document.getElementById("grainLayerSizeInput"),
  grainLayerSizeNumber: document.getElementById("grainLayerSizeNumber"),
  grainAxisXButton: document.getElementById("grainAxisXButton"),
  grainAxisYButton: document.getElementById("grainAxisYButton"),
  grainAxisZButton: document.getElementById("grainAxisZButton"),
  renderPresetStudioButton: document.getElementById("renderPresetStudioButton"),
  renderPresetWarmButton: document.getElementById("renderPresetWarmButton"),
  renderPresetCoolButton: document.getElementById("renderPresetCoolButton"),
  renderPresetDramaticButton: document.getElementById("renderPresetDramaticButton"),
  renderDetailSelect: document.getElementById("renderDetailSelect"),
  renderWidthInput: document.getElementById("renderWidthInput"),
  renderHeightInput: document.getElementById("renderHeightInput"),
  renderLockAspectInput: document.getElementById("renderLockAspectInput"),
  renderPreviewInput: document.getElementById("renderPreviewInput"),
  renderBackgroundSelect: document.getElementById("renderBackgroundSelect"),
  renderStillButton: document.getElementById("renderStillButton"),
  renderStatus: document.getElementById("renderStatus"),
  themeLightButton: document.getElementById("themeLightButton"),
  themeDarkButton: document.getElementById("themeDarkButton"),
  addPointSourceButton: document.getElementById("addPointSourceButton"),
  addCurveSourceButton: document.getElementById("addCurveSourceButton"),
  sourceModeStatus: document.getElementById("sourceModeStatus"),
  sharedWaveSettingsPanel: document.getElementById("sharedWaveSettingsPanel"),
  sharedWaveSettingsStatus: document.getElementById("sharedWaveSettingsStatus"),
  sharedAmplitudeInput: document.getElementById("sharedAmplitudeInput"),
  sharedAmplitudeNumber: document.getElementById("sharedAmplitudeNumber"),
  sharedFrequencyInput: document.getElementById("sharedFrequencyInput"),
  sharedFrequencyNumber: document.getElementById("sharedFrequencyNumber"),
  sharedPhaseInput: document.getElementById("sharedPhaseInput"),
  sharedPhaseNumber: document.getElementById("sharedPhaseNumber"),
  sharedDecayInput: document.getElementById("sharedDecayInput"),
  sharedDecayNumber: document.getElementById("sharedDecayNumber"),
  sharedReachInput: document.getElementById("sharedReachInput"),
  sharedReachNumber: document.getElementById("sharedReachNumber"),
  sharedContinuationSelect: document.getElementById("sharedContinuationSelect"),
  sharedOperationSelect: document.getElementById("sharedOperationSelect"),
  normalizeWavesInput: document.getElementById("normalizeWavesInput"),
  waveSelectionSummary: document.getElementById("waveSelectionSummary"),
  clearWaveSelectionButton: document.getElementById("clearWaveSelectionButton"),
  regionWaveSourceList: document.getElementById("regionWaveSourceList"),
  sourceList: document.getElementById("sourceList"),
  regionList: document.getElementById("regionList"),
  exportStlButton: document.getElementById("exportStlButton"),
  exportObjButton: document.getElementById("exportObjButton"),
  exportJsonButton: document.getElementById("exportJsonButton"),
  exportUnitsStatus: document.getElementById("exportUnitsStatus"),
  loadSampleButton: document.getElementById("loadSampleButton"),
  dockProfileButton: document.getElementById("dockProfileButton"),
  bboxReadout: document.getElementById("bboxReadout"),
  previewUnitsMmButton: document.getElementById("previewUnitsMmButton"),
  previewUnitsInButton: document.getElementById("previewUnitsInButton"),
  perspectiveViewButton: document.getElementById("perspectiveViewButton"),
  topViewButton: document.getElementById("topViewButton"),
  resetViewButton: document.getElementById("resetViewButton"),
  zoomExtentsButton: document.getElementById("zoomExtentsButton"),
  toggleHelpersButton: document.getElementById("toggleHelpersButton"),
};

const profileContext = elements.profileCanvas.getContext("2d");
let renderer;
let scene;
let camera;
let controls;
let transformControls;
let surfaceMesh;
let surfaceWireframe;
let materialMap;
let alphaMap;
let currentSurfaceGrid;
let helperGroup;
let traceHighlightGroup;
let resizeObserver;
let gridGroup;
let helperSprites = [];
let liveAmbientLight;
let liveKeyLight;
let liveFillLight;
let liveRimLight;
let liveLightTarget;
let livePmremGenerator;
let liveEnvironmentScene;
let liveEnvironmentTarget;
let liveShadowCatcher;
const systemThemeMedia = window.matchMedia("(prefers-color-scheme: dark)");
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedHelperDescriptor = null;
const profilePanelState = {
  pointerId: null,
  startX: 0,
  startY: 0,
  originLeft: 0,
  originTop: 0,
  originWidth: 0,
  originHeight: 0,
  resizeHandle: null,
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

function getCurveCenterPoint(points) {
  if (!points.length) {
    return { x: 0, y: 0 };
  }

  return points.reduce(
    (accumulator, point) => ({
      x: accumulator.x + point.x / points.length,
      y: accumulator.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
}

function descriptorsMatch(left, right) {
  return Boolean(
    left &&
      right &&
      left.sourceId === right.sourceId &&
      left.kind === right.kind &&
      (left.pointIndex ?? null) === (right.pointIndex ?? null),
  );
}

function isSelectedDescriptor(descriptor) {
  return descriptorsMatch(selectedHelperDescriptor, descriptor);
}

function setSelectedHelperDescriptor(descriptor) {
  selectedHelperDescriptor = descriptor ? { ...descriptor } : null;
  renderProfileCanvas();
  update3DHelperObjects();
}

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

function stageImportFile(file) {
  if (!file) {
    return;
  }

  state.meta.pendingImportFile = file;
  state.meta.pendingImportKind = getImportKindForFile(file);
  state.ui.status = `Selected ${file.name}. Adjust import settings, then click Import Selected File.`;
  syncView();
  refreshImageTracePreview(file);
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

function getPreviewUnits() {
  return state.ui.previewUnits || "mm";
}

function convertSourceValueToPreviewUnits(value) {
  return convertUnitValue(value, state.meta.sourceUnits || "mm", getPreviewUnits());
}

function convertSourceAreaToPreviewUnits(areaValue) {
  const linear = convertUnitValue(1, state.meta.sourceUnits || "mm", getPreviewUnits());
  return areaValue * linear * linear;
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
  const previousSpeciesById = new Map(
    state.loops
      .filter((loop) => loop.id)
      .map((loop) => [loop.id, loop.species]),
  );
  const interiorPalette = ["oak", "ash", "maple", "cherry", "padauk", "purpleheart"];
  const surfaceCandidate = candidates[0];

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

      const isInteriorRegion =
        index > 0 &&
        surfaceCandidate &&
        pointInPolygon(getLoopCentroid(candidate.points), surfaceCandidate.points);

      return {
        id: candidate.id,
        label: index === 0 ? "Outer Profile" : candidate.label,
        role: index === 0 ? "outer" : isInteriorRegion ? "inner" : "perimeterAdd",
        surfaceMode: "add",
        traceMode: mode,
        points: candidate.points,
        species:
          previousSpeciesById.get(candidate.id) ||
          (index === 0 ? "walnut" : interiorPalette[(index - 1) % interiorPalette.length]),
      };
    })
    .filter(Boolean);
}

function traceSelectionsMatch(candidates, leftSelection, rightSelection) {
  const left = sanitizeTraceSelection(candidates, leftSelection).modes;
  const right = sanitizeTraceSelection(candidates, rightSelection).modes;
  return candidates.every((candidate) => left[candidate.id] === right[candidate.id]);
}

function getLoopCentroid(points) {
  const total = points.reduce(
    (accumulator, point) => ({
      x: accumulator.x + point.x,
      y: accumulator.y + point.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / Math.max(points.length, 1),
    y: total.y / Math.max(points.length, 1),
  };
}

function formatAreaReadout(areaValue) {
  const units = getPreviewUnits();
  return `${convertSourceAreaToPreviewUnits(areaValue).toFixed(2)} ${units}^2`;
}

function syncImageTraceStatus() {
  const activeImportKind = state.meta.pendingImportKind || state.meta.importKind;
  if (activeImportKind !== "image") {
    elements.imageTraceStatus.textContent = "Adjust image trace settings, then retrace.";
    elements.modalImageTraceStatus.textContent = "Adjust image trace settings, then retrace.";
    return;
  }

  if (state.meta.pendingImportFile) {
    const message = `Selected ${state.meta.pendingImportFile.name}. Click Import Selected File.`;
    elements.imageTraceStatus.textContent = message;
    elements.modalImageTraceStatus.textContent = message;
    return;
  }

  const regionCount = state.meta.imageTraceCandidates?.length || 0;
  const applied = state.meta.imageTraceAppliedSettings;
  const preview = state.meta.imageTracePreview;
  const previewLabel = preview
    ? `Preview ${preview.sampledColorCount}/${preview.targetColorCount} colors. `
    : "";
  const modeLabel =
    applied.mode === "segmentation"
      ? `Last retrace v${state.meta.imageTraceRevision}: color regions, colors ${applied.colorSamples}, photo prep ${applied.photoPrep ? "on" : "off"}, upscale ${applied.upscaleBeforeTrace > 1 ? `${applied.upscaleBeforeTrace}x` : "off"}, flatten ${applied.flattenShading ? applied.flattenStrength : "off"}, tolerance ${applied.colorTolerance}, min area ${applied.minRegionArea}%, smoothing ${applied.cornerSmoothing}, simplify ${applied.pathSimplification}.`
      : `Last retrace v${state.meta.imageTraceRevision}: threshold ${applied.threshold}, ${applied.invert ? "inverted" : "normal"}, colors ${applied.colorSamples}, photo prep ${applied.photoPrep ? "on" : "off"}, upscale ${applied.upscaleBeforeTrace > 1 ? `${applied.upscaleBeforeTrace}x` : "off"}, flatten ${applied.flattenShading ? applied.flattenStrength : "off"}, min area ${applied.minRegionArea}%, smoothing ${applied.cornerSmoothing}, simplify ${applied.pathSimplification}.`;
  const dirtyLabel = state.meta.imageTraceDirty ? "Settings changed. Click Retrace Image." : "";
  const pendingLabel = traceSelectionsMatch(
    state.meta.imageTraceCandidates,
    state.meta.imageTraceSelection,
    state.meta.imageTraceDraftSelection,
  )
    ? ""
    : "Region changes pending. Click Apply Regions.";
  const message = `${previewLabel}Detected ${regionCount} traced regions. ${modeLabel} ${dirtyLabel} ${pendingLabel}`.trim();
  elements.imageTraceStatus.textContent = message;
  elements.modalImageTraceStatus.textContent = message;
}

function updateImportOptionsVisibility() {
  const activeImportKind = state.meta.pendingImportKind || state.meta.importKind;
  const isImage = activeImportKind === "image";
  if (!isImage && state.ui.imagePreviewModalOpen) {
    setImagePreviewModalOpen(false);
  }
  elements.imageImportOptions.classList.toggle("is-hidden", !isImage);
  elements.imageTracePanel.classList.toggle(
    "is-hidden",
    activeImportKind !== "image" || !state.meta.imageTraceCandidates?.length || !!state.meta.pendingImportFile,
  );
  elements.vectorImportOptions.classList.toggle("is-hidden", isImage);
  const segmentationMode = state.importSettings.imageImportMode === "segmentation";
  elements.imageImportModeThresholdButton.classList.toggle("is-active", !segmentationMode);
  elements.imageImportModeSegmentationButton.classList.toggle("is-active", segmentationMode);
  elements.modalImageImportModeThresholdButton.classList.toggle("is-active", !segmentationMode);
  elements.modalImageImportModeSegmentationButton.classList.toggle("is-active", segmentationMode);
  elements.thresholdMethodSettings.classList.toggle("is-hidden", segmentationMode);
  elements.invertImageInput.closest(".control")?.classList.toggle("is-hidden", segmentationMode);
  elements.segmentationMethodSettings.classList.toggle("is-hidden", !segmentationMode);
  elements.modalThresholdMethodSettings.classList.toggle("is-hidden", segmentationMode);
  elements.modalInvertImageInput.closest(".control")?.classList.toggle("is-hidden", segmentationMode);
  elements.modalSegmentationMethodSettings.classList.toggle("is-hidden", !segmentationMode);
}

function getPreferredTheme() {
  return systemThemeMedia.matches ? "dark" : "light";
}

function getViewportBackgroundColor() {
  const preset = getRenderPresetConfig();
  const backgroundColor =
    state.render.previewInViewport && state.render.background !== "transparent"
      ? getRenderBackgroundColor(preset)
      : state.ui.theme === "dark"
        ? "#1b1a20"
        : "#fdfcfc";
  return backgroundColor;
}

function getSurfaceShadowMetrics(surfaceGrid = currentSurfaceGrid) {
  const bounds = surfaceGrid?.bounds || {
    minX: -0.5,
    maxX: 0.5,
    minY: -0.5,
    maxY: 0.5,
    width: 1,
    height: 1,
  };
  const minHeight = Number(surfaceGrid?.minHeight) || 0;
  const maxHeight = Number(surfaceGrid?.maxHeight) || 0;
  const depth = Math.max(maxHeight - minHeight, 0.01);
  const centerZ = SURFACE_PLANE_OFFSET + depth * 0.5;
  const maxDimension = Math.max(bounds.width || 1, bounds.height || 1, depth || 1);
  return {
    centerX: bounds.minX + bounds.width * 0.5,
    centerY: bounds.minY + bounds.height * 0.5,
    centerZ,
    width: Math.max(bounds.width || 1, 1),
    height: Math.max(bounds.height || 1, 1),
    depth,
    maxDimension,
  };
}

function positionDirectionalLight(light, targetObject, presetPosition, surfaceGrid = currentSurfaceGrid) {
  if (!light || !targetObject) {
    return;
  }

  const metrics = getSurfaceShadowMetrics(surfaceGrid);
  const direction = new THREE.Vector3(...presetPosition);
  if (direction.lengthSq() < 1e-6) {
    direction.set(1, -1, 2);
  }
  direction.normalize();

  const distance = Math.max(metrics.maxDimension * 1.45, 18);
  targetObject.position.set(metrics.centerX, metrics.centerY, metrics.centerZ);
  targetObject.updateMatrixWorld();
  light.position.set(
    metrics.centerX + direction.x * distance,
    metrics.centerY + direction.y * distance,
    metrics.centerZ + Math.max(direction.z * distance, metrics.depth * 2 + 6),
  );
  light.target = targetObject;
}

function applyViewportRenderLook() {
  if (
    !scene ||
    !renderer ||
    !liveAmbientLight ||
    !liveKeyLight ||
    !liveFillLight ||
    !liveRimLight ||
    !liveLightTarget
  ) {
    return;
  }

  const previewEnabled = state.render.previewInViewport;
  const preset = getRenderPresetConfig();

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = previewEnabled ? preset.exposure : 1;

  const backgroundColor = getViewportBackgroundColor();
  scene.background = backgroundColor ? new THREE.Color(backgroundColor) : null;

  if (previewEnabled) {
    liveAmbientLight.color.set(preset.ambientColor);
    liveAmbientLight.intensity = preset.ambientIntensity;
    liveKeyLight.color.set(preset.keyColor);
    liveKeyLight.intensity = preset.keyIntensity;
    positionDirectionalLight(liveKeyLight, liveLightTarget, preset.keyPosition);
    configureDirectionalShadow(liveKeyLight, preset.shadowStrength, 2048);
    liveFillLight.color.set(preset.fillColor);
    liveFillLight.intensity = preset.fillIntensity;
    positionDirectionalLight(liveFillLight, liveLightTarget, preset.fillPosition);
    liveFillLight.castShadow = false;
    liveRimLight.color.set(preset.rimColor);
    liveRimLight.intensity = preset.rimIntensity;
    positionDirectionalLight(liveRimLight, liveLightTarget, preset.rimPosition);
    liveRimLight.castShadow = false;
    scene.environment = liveEnvironmentTarget?.texture || null;
  } else {
    liveAmbientLight.color.set("#fff7ee");
    liveAmbientLight.intensity = 1.4;
    liveKeyLight.color.set("#fff4e7");
    liveKeyLight.intensity = 2.1;
    positionDirectionalLight(liveKeyLight, liveLightTarget, [2.1, -1.8, 2.6]);
    configureDirectionalShadow(liveKeyLight, 0.9, 2048);
    liveFillLight.color.set("#f7dcc8");
    liveFillLight.intensity = 0.12;
    positionDirectionalLight(liveFillLight, liveLightTarget, [-1.5, 1.6, 1.1]);
    liveFillLight.castShadow = false;
    liveRimLight.color.set("#c9d8ff");
    liveRimLight.intensity = 0.36;
    positionDirectionalLight(liveRimLight, liveLightTarget, [-1.4, 1.3, 1.2]);
    liveRimLight.castShadow = false;
    scene.environment = null;
  }

  if (liveShadowCatcher) {
    liveShadowCatcher.visible = previewEnabled;
    liveShadowCatcher.material.opacity = previewEnabled ? 0.28 : 0;
  }
}

function syncTheme() {
  if (state.ui.followSystemTheme) {
    state.ui.theme = getPreferredTheme();
  }
  const dark = state.ui.theme === "dark";
  elements.body.classList.toggle("lights-off", dark);
  elements.themeLightButton.classList.toggle("is-active", !dark);
  elements.themeDarkButton.classList.toggle("is-active", dark);
  applyViewportRenderLook();
}

function setImagePreviewModalOpen(isOpen) {
  state.ui.imagePreviewModalOpen = isOpen;
  elements.imagePreviewModal.classList.toggle("is-hidden", !isOpen);
  elements.imagePreviewModal.setAttribute("aria-hidden", isOpen ? "false" : "true");
}

function queueImageRetrace(reasonLabel) {
  state.meta.imageTraceDirty = true;
  state.ui.status = `${reasonLabel}. Click Retrace Image to update the trace.`;
  syncStatus();
  syncImageTraceStatus();
}

function clearImageTracePreview() {
  state.meta.imageTracePreview = null;
  [
    elements.imageColorPreviewCanvas,
    elements.imageThresholdPreviewCanvas,
    elements.modalImageColorPreviewCanvas,
    elements.modalImageThresholdPreviewCanvas,
  ].forEach((canvas) => {
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
  });
  elements.imagePreviewStatus.textContent = "Preview appears here for image imports.";
  elements.modalImagePreviewStatus.textContent = "Preview appears here for image imports.";
  elements.imagePreviewPrimaryLabel.textContent = "Color sample preview";
  elements.imagePreviewSecondaryLabel.textContent = "Threshold mask";
  elements.modalImagePreviewPrimaryLabel.textContent = "Color sample preview";
  elements.modalImagePreviewSecondaryLabel.textContent = "Threshold mask";
}

function drawPreviewPixels(canvas, width, height, pixels) {
  const context = canvas.getContext("2d");
  canvas.width = width;
  canvas.height = height;
  const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height);
  context.putImageData(imageData, 0, 0);
}

function renderImageTracePreview() {
  const activeImportKind = state.meta.pendingImportKind || state.meta.importKind;
  if (activeImportKind !== "image") {
    clearImageTracePreview();
    return;
  }

  const preview = state.meta.imageTracePreview;
  if (!preview) {
    clearImageTracePreview();
    return;
  }

  drawPreviewPixels(
    elements.imageColorPreviewCanvas,
    preview.width,
    preview.height,
    preview.primaryPreviewData,
  );
  drawPreviewPixels(
    elements.imageThresholdPreviewCanvas,
    preview.width,
    preview.height,
    preview.secondaryPreviewData,
  );
  drawPreviewPixels(
    elements.modalImageColorPreviewCanvas,
    preview.width,
    preview.height,
    preview.primaryPreviewData,
  );
  drawPreviewPixels(
    elements.modalImageThresholdPreviewCanvas,
    preview.width,
    preview.height,
    preview.secondaryPreviewData,
  );

  elements.imagePreviewPrimaryLabel.textContent = preview.primaryLabel || "Color sample preview";
  elements.imagePreviewSecondaryLabel.textContent = preview.secondaryLabel || "Threshold mask";
  elements.modalImagePreviewPrimaryLabel.textContent = preview.primaryLabel || "Color sample preview";
  elements.modalImagePreviewSecondaryLabel.textContent = preview.secondaryLabel || "Threshold mask";

  const previewMessage =
    `${preview.mode === "segmentation" ? "Color segmentation" : "Threshold trace"} preview uses ${preview.sampledColorCount}/${preview.targetColorCount} colors and currently traces ${preview.tracedRegionCount} region${preview.tracedRegionCount === 1 ? "" : "s"}.`;
  elements.imagePreviewStatus.textContent = previewMessage;
  elements.modalImagePreviewStatus.textContent = previewMessage;
}

async function refreshImageTracePreview(file = state.meta.pendingImportFile || state.meta.importedFile) {
  const activeImportKind = state.meta.pendingImportKind || state.meta.importKind;
  if (!file || activeImportKind !== "image") {
    clearImageTracePreview();
    return;
  }

  const requestId = state.meta.imageTracePreviewRequestId + 1;
  state.meta.imageTracePreviewRequestId = requestId;

  try {
    const preview = await previewImageTrace(file, state.importSettings);
    if (requestId !== state.meta.imageTracePreviewRequestId) {
      return;
    }
    state.meta.imageTracePreview = preview;
    renderImageTracePreview();
    syncImageTraceStatus();
  } catch {
    if (requestId !== state.meta.imageTracePreviewRequestId) {
      return;
    }
    clearImageTracePreview();
  }
}

function setImageImportMode(mode) {
  if (!["threshold", "segmentation"].includes(mode)) {
    return;
  }
  state.importSettings.imageImportMode = mode;
  if (state.meta.pendingImportFile && state.meta.pendingImportKind === "image") {
    state.ui.status = `Updated image import settings for ${state.meta.pendingImportFile.name}. Click Import Selected File.`;
    syncStatus();
    syncView();
    refreshImageTracePreview();
    return;
  }
  if (state.meta.importedFile && state.meta.importKind === "image") {
    queueImageRetrace("Updated image import method");
    syncView();
    refreshImageTracePreview();
    return;
  }
  syncView();
}

function toggleImageAdvanced() {
  state.ui.imageAdvancedOpen = !state.ui.imageAdvancedOpen;
  syncView();
}

function applyTracePreset(preset) {
  const presets = {
    logo: {
      imageImportMode: "threshold",
      imageThreshold: 150,
      invertImage: false,
      imageColorSamples: 6,
      imagePhotoPrep: false,
      imageUpscaleBeforeTrace: 1,
      imageFlattenShading: false,
      imageFlattenStrength: 0.65,
      imageColorTolerance: 20,
      imageMinRegionArea: 0.1,
      imageCornerSmoothing: 1,
      imagePathSimplification: 0.7,
    },
    lineart: {
      imageImportMode: "threshold",
      imageThreshold: 128,
      invertImage: false,
      imageColorSamples: 4,
      imagePhotoPrep: false,
      imageUpscaleBeforeTrace: 2,
      imageFlattenShading: false,
      imageFlattenStrength: 0.65,
      imageColorTolerance: 18,
      imageMinRegionArea: 0.06,
      imageCornerSmoothing: 1,
      imagePathSimplification: 0.5,
    },
    photo: {
      imageImportMode: "segmentation",
      imageThreshold: 140,
      invertImage: false,
      imageColorSamples: 12,
      imagePhotoPrep: true,
      imageUpscaleBeforeTrace: 2,
      imageFlattenShading: true,
      imageFlattenStrength: 0.8,
      imageColorTolerance: 30,
      imageMinRegionArea: 0.2,
      imageCornerSmoothing: 2,
      imagePathSimplification: 1,
    },
  };

  Object.assign(state.importSettings, presets[preset]);
  handleImageTraceSettingChange(`Applied ${preset === "lineart" ? "line art" : preset} trace preset`);
}

function formatBoundsReadout() {
  const bounds = state.meta.sourceBounds || { width: 0, height: 0 };
  const units = getPreviewUnits();
  const worldPerSourceUnit = getWorldUnitsPerSourceUnit();
  const sourceHeight =
    worldPerSourceUnit > 0
      ? ((currentSurfaceGrid?.maxHeight ?? 0) - (currentSurfaceGrid?.minHeight ?? 0)) / worldPerSourceUnit
      : 0;
  const length = Number(convertSourceValueToPreviewUnits(bounds.width || 0)).toFixed(2);
  const width = Number(convertSourceValueToPreviewUnits(bounds.height || 0)).toFixed(2);
  const height = Number(convertSourceValueToPreviewUnits(sourceHeight)).toFixed(2);
  return `BBox ${length} x ${width} x ${height} ${units}`;
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
  if (state.render.lockAspect) {
    syncRenderAspectFromWidth();
    elements.renderWidthInput.value = String(state.render.outputWidth);
    elements.renderHeightInput.value = String(state.render.outputHeight);
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

function setProfileCardRect(left, top, width, height) {
  const margin = 16;
  const minWidth = 280;
  const minHeight = 220;
  const workspaceWidth = elements.workspace.clientWidth;
  const workspaceHeight = elements.workspace.clientHeight;
  const maxWidth = Math.max(minWidth, workspaceWidth - margin * 2);
  const maxHeight = Math.max(minHeight, workspaceHeight - margin * 2);

  let nextWidth = Math.min(Math.max(width, minWidth), maxWidth);
  let nextHeight = Math.min(Math.max(height, minHeight), maxHeight);
  let nextLeft = left;
  let nextTop = top;

  if (nextLeft < margin) {
    if (left !== nextLeft) {
      nextWidth = Math.min(maxWidth, nextWidth - (margin - nextLeft));
    }
    nextLeft = margin;
  }
  if (nextTop < margin) {
    if (top !== nextTop) {
      nextHeight = Math.min(maxHeight, nextHeight - (margin - nextTop));
    }
    nextTop = margin;
  }

  if (nextLeft + nextWidth > workspaceWidth - margin) {
    if (left !== nextLeft) {
      nextWidth = Math.max(minWidth, workspaceWidth - margin - nextLeft);
    } else {
      nextLeft = workspaceWidth - margin - nextWidth;
    }
  }
  if (nextTop + nextHeight > workspaceHeight - margin) {
    if (top !== nextTop) {
      nextHeight = Math.max(minHeight, workspaceHeight - margin - nextTop);
    } else {
      nextTop = workspaceHeight - margin - nextHeight;
    }
  }

  elements.profileCard.style.width = `${nextWidth}px`;
  elements.profileCard.style.height = `${nextHeight}px`;
  setProfileCardPosition(nextLeft, nextTop);
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
  const margin = 32;
  const left = elements.workspace.clientWidth - elements.profileCard.offsetWidth - margin;
  const headerHeight = elements.surfaceCardHeader?.offsetHeight || 0;
  const top = headerHeight + 54;
  setProfileCardPosition(left, top);
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
  setProfileCardRect(left, top, elements.profileCard.offsetWidth, elements.profileCard.offsetHeight);
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
    profilePanelState.originWidth = elements.profileCard.offsetWidth;
    profilePanelState.originHeight = elements.profileCard.offsetHeight;
    profilePanelState.resizeHandle = null;
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

  elements.profileCard.querySelectorAll("[data-resize-handle]").forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      if (isCompactLayout()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      profilePanelState.pointerId = event.pointerId;
      profilePanelState.startX = event.clientX;
      profilePanelState.startY = event.clientY;
      profilePanelState.originLeft = Number.parseFloat(elements.profileCard.style.left || "16");
      profilePanelState.originTop = Number.parseFloat(elements.profileCard.style.top || "16");
      profilePanelState.originWidth = elements.profileCard.offsetWidth;
      profilePanelState.originHeight = elements.profileCard.offsetHeight;
      profilePanelState.resizeHandle = handle.dataset.resizeHandle;
      profilePanelState.docked = false;
      elements.profileCard.classList.add("is-resizing");
      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener("pointermove", (event) => {
      if (profilePanelState.pointerId !== event.pointerId || isCompactLayout() || !profilePanelState.resizeHandle) {
        return;
      }

      const dx = event.clientX - profilePanelState.startX;
      const dy = event.clientY - profilePanelState.startY;
      let left = profilePanelState.originLeft;
      let top = profilePanelState.originTop;
      let width = profilePanelState.originWidth;
      let height = profilePanelState.originHeight;

      if (profilePanelState.resizeHandle.includes("e")) {
        width = profilePanelState.originWidth + dx;
      }
      if (profilePanelState.resizeHandle.includes("s")) {
        height = profilePanelState.originHeight + dy;
      }
      if (profilePanelState.resizeHandle.includes("w")) {
        left = profilePanelState.originLeft + dx;
        width = profilePanelState.originWidth - dx;
      }
      if (profilePanelState.resizeHandle.includes("n")) {
        top = profilePanelState.originTop + dy;
        height = profilePanelState.originHeight - dy;
      }

      setProfileCardRect(left, top, width, height);
    });
  });

  const releaseDrag = (event) => {
    if (profilePanelState.pointerId !== event.pointerId) {
      return;
    }
    profilePanelState.pointerId = null;
    profilePanelState.resizeHandle = null;
    elements.profileCard.classList.remove("is-dragging");
    elements.profileCard.classList.remove("is-resizing");
    if (elements.profileCardHeader.hasPointerCapture(event.pointerId)) {
      elements.profileCardHeader.releasePointerCapture(event.pointerId);
    }
    elements.profileCard.querySelectorAll("[data-resize-handle]").forEach((handle) => {
      if (handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
    });
  };

  elements.profileCardHeader.addEventListener("pointerup", releaseDrag);
  elements.profileCardHeader.addEventListener("pointercancel", releaseDrag);
  elements.profileCard.querySelectorAll("[data-resize-handle]").forEach((handle) => {
    handle.addEventListener("pointerup", releaseDrag);
    handle.addEventListener("pointercancel", releaseDrag);
  });
  elements.dockProfileButton.addEventListener("click", dockProfileCard);

  resizeObserver = new ResizeObserver(() => {
    syncCanvasSizes();
    clampFloatingProfileCard();
  });
  resizeObserver.observe(elements.profileCard);
  resizeObserver.observe(elements.surfaceCanvas);
}

function applySidebarWidth() {
  if (!elements.appShell) {
    return;
  }
  if (window.innerWidth <= 1100) {
    elements.appShell.style.removeProperty("--sidebar-width");
    return;
  }
  const minWidth = 360;
  const splitterWidth = 14;
  const minWorkspaceWidth = 520;
  const maxWidth = Math.max(minWidth, window.innerWidth - minWorkspaceWidth - splitterWidth - 48);
  const nextWidth = Math.min(Math.max(Number(state.ui.sidebarWidth) || 430, minWidth), maxWidth);
  state.ui.sidebarWidth = nextWidth;
  elements.appShell.style.setProperty("--sidebar-width", `${nextWidth}px`);
}

function initSidebarSplitter() {
  if (!elements.sidebarSplitter || !elements.appShell) {
    return;
  }

  applySidebarWidth();

  const splitterState = {
    active: false,
    pointerId: null,
  };

  const release = (event) => {
    if (!splitterState.active || splitterState.pointerId !== event.pointerId) {
      return;
    }
    splitterState.active = false;
    splitterState.pointerId = null;
    elements.sidebarSplitter.classList.remove("is-dragging");
    if (elements.sidebarSplitter.hasPointerCapture(event.pointerId)) {
      elements.sidebarSplitter.releasePointerCapture(event.pointerId);
    }
  };

  elements.sidebarSplitter.addEventListener("pointerdown", (event) => {
    if (window.innerWidth <= 1100) {
      return;
    }
    splitterState.active = true;
    splitterState.pointerId = event.pointerId;
    elements.sidebarSplitter.classList.add("is-dragging");
    elements.sidebarSplitter.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  elements.sidebarSplitter.addEventListener("pointermove", (event) => {
    if (!splitterState.active || splitterState.pointerId !== event.pointerId) {
      return;
    }
    const shellRect = elements.appShell.getBoundingClientRect();
    const minWidth = 360;
    const splitterWidth = 14;
    const minWorkspaceWidth = 520;
    const maxWidth = Math.max(minWidth, shellRect.width - minWorkspaceWidth - splitterWidth);
    state.ui.sidebarWidth = Math.min(Math.max(event.clientX - shellRect.left, minWidth), maxWidth);
    applySidebarWidth();
  });

  elements.sidebarSplitter.addEventListener("pointerup", release);
  elements.sidebarSplitter.addEventListener("pointercancel", release);
  window.addEventListener("resize", applySidebarWidth);
}

function initCollapsiblePanels() {
  document.querySelectorAll(".sidebar .panel").forEach((panel) => {
    const heading = panel.querySelector(".panel-heading");
    if (!heading || heading.querySelector(".panel-toggle")) {
      return;
    }

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "ghost-button panel-toggle";
    const title = heading.querySelector("h2")?.textContent?.trim();
    if (title === "Theme") {
      return;
    }
    const shouldStartCollapsed =
      title === "Surface Mesh Resolution" ||
      title === "Wood Grain Preview" ||
      title === "Render View" ||
      title === "Export";
    if (shouldStartCollapsed) {
      panel.classList.add("is-collapsed");
    }
    toggleButton.textContent = shouldStartCollapsed ? "+" : "-";
    toggleButton.addEventListener("click", () => {
      const collapsed = panel.classList.toggle("is-collapsed");
      toggleButton.textContent = collapsed ? "+" : "-";
    });
    heading.append(toggleButton);
  });
}

function formatSpeciesName(name) {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatSpeciesShortName(name) {
  const map = {
    walnut: "Wal",
    oak: "Oak",
    ash: "Ash",
    maple: "Map",
    cherry: "Che",
    padauk: "Pad",
    purpleheart: "Pur",
    redoak: "Red",
  };
  return map[name] || formatSpeciesName(name).slice(0, 3);
}

function preserveLoopSpecies(nextLoops) {
  return nextLoops.map((loop, index) => ({
    ...loop,
    species: state.loops[index]?.species || loop.species,
  }));
}

function createRegionWaveSource(loop) {
  const source = createSource(
    "curve",
    loop.points.map((point) => ({ ...point })),
    state.sources.filter((item) => item.type === "region").length + 1,
  );
  source.type = "region";
  source.label = `${loop.label} Wave`;
  source.regionLoopId = loop.id;
  source.amplitude = 0.55;
  source.frequency = 0.03;
  source.decay = 0.018;
  source.reach = 120;
  source.continuation = "sustain";
  return source;
}

function duplicateManualSource(source) {
  const pointSet = source.points.map((point) => ({
    x: point.x + (source.type === "point" ? 8 : 10),
    y: point.y + (source.type === "point" ? -8 : -10),
  }));
  const duplicateCount =
    state.sources.filter((item) => item.type === source.type).length + 1;
  const duplicate = createSource(source.type, pointSet, duplicateCount);
  duplicate.label = `${source.label} Copy`;
  duplicate.operation = source.operation;
  duplicate.amplitude = source.amplitude;
  duplicate.frequency = source.frequency;
  duplicate.phase = source.phase;
  duplicate.decay = source.decay;
  duplicate.reach = source.reach;
  duplicate.continuation = source.continuation;
  return duplicate;
}

function syncRegionWaveSourcesToLoops() {
  state.sources = state.sources.filter((source) => {
    if (source.type !== "region") {
      return true;
    }
    const loop = state.loops.find((item) => item.id === source.regionLoopId && item.role === "inner");
    if (!loop) {
      return false;
    }
    source.points = loop.points.map((point) => ({ ...point }));
    source.label = `${loop.label} Wave`;
    return true;
  });
}

function syncSelectedWaveSourceIds() {
  const validIds = new Set(state.sources.map((source) => source.id));
  state.ui.selectedWaveSourceIds = state.ui.selectedWaveSourceIds.filter((id) => validIds.has(id));
}

function getSelectedWaveSources() {
  syncSelectedWaveSourceIds();
  return state.sources.filter((source) => state.ui.selectedWaveSourceIds.includes(source.id));
}

function isSourceLocked(source) {
  return Boolean(source?.locked);
}

function isSourceHidden(source) {
  return Boolean(source?.hidden);
}

function getPrimarySelectedWaveSource() {
  return getSelectedWaveSources()[0] || null;
}

function isWaveSourceSelected(sourceId) {
  return state.ui.selectedWaveSourceIds.includes(sourceId);
}

function toggleWaveSourceSelection(sourceId, selected) {
  const next = new Set(state.ui.selectedWaveSourceIds);
  if (selected) {
    next.add(sourceId);
  } else {
    next.delete(sourceId);
  }
  state.ui.selectedWaveSourceIds = [...next];
}

function applySharedWaveSetting(field, value) {
  getSelectedWaveSources().forEach((source) => {
    source[field] = value;
  });
  syncStatus();
  syncView();
}

function syncSharedWaveSettingsPanel() {
  const primary = getPrimarySelectedWaveSource();
  const selectedCount = getSelectedWaveSources().length;
  const hasSelection = Boolean(primary);
  elements.sharedWaveSettingsPanel.classList.toggle("is-idle", !hasSelection);
  [
    elements.sharedAmplitudeInput,
    elements.sharedAmplitudeNumber,
    elements.sharedFrequencyInput,
    elements.sharedFrequencyNumber,
    elements.sharedPhaseInput,
    elements.sharedPhaseNumber,
    elements.sharedDecayInput,
    elements.sharedDecayNumber,
    elements.sharedReachInput,
    elements.sharedReachNumber,
    elements.sharedContinuationSelect,
    elements.sharedOperationSelect,
  ].forEach((control) => {
    control.disabled = !hasSelection;
  });
  if (!hasSelection) {
    elements.sharedWaveSettingsStatus.textContent = "Select a wave source to edit its settings.";
    return;
  }

  elements.sharedWaveSettingsStatus.textContent =
    selectedCount === 1
      ? `Editing ${primary.label}.`
      : `Editing ${selectedCount} selected wave sources from ${primary.label}.`;

  setPairedValue(elements.sharedAmplitudeInput, elements.sharedAmplitudeNumber, primary.amplitude, (value) =>
    Number(value).toFixed(3),
  );
  setPairedValue(elements.sharedFrequencyInput, elements.sharedFrequencyNumber, primary.frequency, (value) =>
    Number(value).toFixed(3),
  );
  setPairedValue(elements.sharedPhaseInput, elements.sharedPhaseNumber, primary.phase, (value) =>
    Number(value).toFixed(3),
  );
  setPairedValue(elements.sharedDecayInput, elements.sharedDecayNumber, primary.decay, (value) =>
    Number(value).toFixed(3),
  );
  setPairedValue(elements.sharedReachInput, elements.sharedReachNumber, primary.reach, (value) =>
    Number(value).toFixed(3),
  );
  elements.sharedContinuationSelect.value = primary.continuation;
  elements.sharedOperationSelect.value = primary.operation;
}

function applyImageTraceSelection(selection = state.meta.imageTraceSelection) {
  const normalizedSelection = sanitizeTraceSelection(
    state.meta.imageTraceCandidates,
    selection,
  );
  state.meta.imageTraceSelection = normalizedSelection;
  state.loops = buildTraceLoopsFromSelection(state.meta.imageTraceCandidates, normalizedSelection);
}

function finalizeTraceSelection() {
  state.meta.imageTraceCandidates = [];
  state.meta.imageTraceSelection = { modes: {} };
  state.meta.imageTraceDraftSelection = { modes: {} };
  state.meta.hoveredTraceId = null;
  state.meta.hoveredLoopId = null;
  state.meta.imageTraceDirty = false;
  state.meta.imageTracePreview = null;
  state.meta.importKind = "vector";
  state.ui.status = "Finalized traced regions into editable profile loops.";
  syncView();
}

function applyImportedResult(result, fileName) {
  state.meta.importName = fileName;
  state.meta.importKind = result.importKind;
  state.meta.sourceBounds = result.sourceBounds;
  state.meta.nativeSourceBounds = result.nativeSourceBounds || result.sourceBounds;
  state.meta.sourceUnits = result.sourceUnits;
  state.meta.imageTraceCandidates = result.traceCandidates || [];
  state.meta.imageTraceDirty = false;
  state.meta.imageTracePreview = result.tracePreview || null;
  if (result.importKind === "image") {
    state.meta.imageTraceRevision += 1;
    state.meta.imageTraceAppliedSettings = {
      mode: state.importSettings.imageImportMode,
      threshold: state.importSettings.imageThreshold,
      invert: state.importSettings.invertImage,
      colorSamples: state.importSettings.imageColorSamples,
      photoPrep: state.importSettings.imagePhotoPrep,
      upscaleBeforeTrace: state.importSettings.imageUpscaleBeforeTrace,
      flattenShading: state.importSettings.imageFlattenShading,
      flattenStrength: state.importSettings.imageFlattenStrength,
      colorTolerance: state.importSettings.imageColorTolerance,
      minRegionArea: state.importSettings.imageMinRegionArea,
      cornerSmoothing: state.importSettings.imageCornerSmoothing,
      pathSimplification: state.importSettings.imagePathSimplification,
    };
  }

  if (result.importKind === "image" && state.meta.imageTraceCandidates.length) {
    const selection = sanitizeTraceSelection(
      state.meta.imageTraceCandidates,
      Object.keys(state.meta.imageTraceSelection?.modes || {}).length
        ? state.meta.imageTraceSelection
        : buildDefaultTraceSelection(state.meta.imageTraceCandidates),
    );
    state.meta.imageTraceSelection = selection;
    state.meta.imageTraceDraftSelection = selection;
    state.meta.hoveredTraceId = null;
    applyImageTraceSelection();
    return;
  }

  state.meta.imageTraceSelection = {
    modes: {},
  };
  state.meta.imageTraceDraftSelection = {
    modes: {},
  };
  state.meta.hoveredTraceId = null;
  state.meta.hoveredLoopId = null;
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
    const imageMethodLabel =
      state.importSettings.imageImportMode === "segmentation"
        ? `Color regions mode detected ${state.meta.imageTraceCandidates.length} regions from ${state.importSettings.imageColorSamples} sampled colors at tolerance ${state.importSettings.imageColorTolerance}.`
        : `Threshold mode detected ${state.meta.imageTraceCandidates.length} regions at threshold ${state.importSettings.imageThreshold}.`;
    state.ui.status =
      imported.importKind === "image"
        ? `${reasonLabel} for ${file.name}. Trace v${state.meta.imageTraceRevision}. ${imageMethodLabel}`
        : `${reasonLabel} for ${file.name}. ${Math.max(imported.loops.length - 1, 0)} inner loop(s) detected.`;
    syncView();
  } catch (error) {
    if (requestId !== state.meta.importRequestId) {
      return;
    }
    state.ui.status = error instanceof Error ? error.message : "Import refresh failed.";
    syncStatus();
  }
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

  const source = state.sources.find((item) => item.id === descriptor.sourceId);
  if (!source || isSourceLocked(source) || isSourceHidden(source)) {
    transformControls.detach();
    selectedHelperDescriptor = null;
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
  const worldPerUnit = getWorldUnitsPerPreviewUnit();
  const targetHandleSize = getPreviewUnits() === "in" ? 0.125 : 2;
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
    color: HANDLE_COLORS.point.fill,
    emissive: HANDLE_COLORS.point.emissive,
    emissiveIntensity: 1.2,
    roughness: 0.42,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const curveMaterial = new THREE.MeshStandardMaterial({
    color: HANDLE_COLORS.curve.fill,
    emissive: HANDLE_COLORS.curve.emissive,
    emissiveIntensity: 1.1,
    roughness: 0.38,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const centerMaterial = new THREE.MeshStandardMaterial({
    color: HANDLE_COLORS.center.fill,
    emissive: HANDLE_COLORS.center.emissive,
    emissiveIntensity: 1.15,
    roughness: 0.4,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const selectedMaterial = new THREE.MeshStandardMaterial({
    color: HANDLE_COLORS.selected.fill,
    emissive: HANDLE_COLORS.selected.emissive,
    emissiveIntensity: 1.2,
    roughness: 0.35,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const lineMaterial = new THREE.LineBasicMaterial({
    color: HANDLE_COLORS.curve.fill,
    transparent: true,
    opacity: 0.96,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const selectedLineMaterial = new THREE.LineBasicMaterial({
    color: HANDLE_COLORS.selected.fill,
    transparent: true,
    opacity: 0.96,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const sphereGeometry = new THREE.SphereGeometry(pointRadius, 20, 20);
  const boxGeometry = new THREE.BoxGeometry(centerSize, centerSize, centerSize);
  const pointTexture = createHandleTexture(HANDLE_COLORS.point.fill, HANDLE_COLORS.point.stroke);
  const curveTexture = createHandleTexture(HANDLE_COLORS.curve.fill, HANDLE_COLORS.curve.stroke);
  const centerTexture = createHandleTexture(HANDLE_COLORS.center.fill, HANDLE_COLORS.center.stroke, "square");
  const selectedCircleTexture = createHandleTexture(HANDLE_COLORS.selected.fill, HANDLE_COLORS.selected.stroke);
  const selectedSquareTexture = createHandleTexture(HANDLE_COLORS.selected.fill, HANDLE_COLORS.selected.stroke, "square");

  state.sources.forEach((source) => {
    if (isSourceHidden(source)) {
      return;
    }
    if (source.type === "point") {
      const descriptor = { sourceId: source.id, kind: "pointHandle", pointIndex: 0 };
      const selected = isSelectedDescriptor(descriptor);
      const mesh = new THREE.Mesh(sphereGeometry, selected ? selectedMaterial : pointMaterial);
      mesh.position.copy(toSurfaceScenePoint(source.points[0], handleOffset));
      mesh.userData.descriptor = descriptor;
      mesh.renderOrder = 12;
      addHandleSprite(mesh, selected ? selectedCircleTexture : pointTexture, 24);
      helperGroup.add(mesh);
      return;
    }

    if (source.type === "region") {
      const regionPreviewPoints = sampleCurveSourcePolyline(source.points, 72)
        .map((point) => toSurfaceScenePoint(point, lineOffset));
      if (regionPreviewPoints.length) {
        regionPreviewPoints.push(regionPreviewPoints[0].clone());
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(regionPreviewPoints),
        lineMaterial,
      );
      line.renderOrder = 11;
      helperGroup.add(line);
      return;
    }

    const controlPoints = source.points.map((point) => toSurfaceScenePoint(point, handleOffset));
    const curvePreviewPoints = sampleCurveSourcePolyline(source.points, 56)
      .map((point) => toSurfaceScenePoint(point, lineOffset));
    const curveDescriptor = { sourceId: source.id, kind: "curveCenter" };
    const curveSelected = isSelectedDescriptor(curveDescriptor);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curvePreviewPoints),
      curveSelected ? selectedLineMaterial : lineMaterial,
    );
    line.userData.descriptor = curveDescriptor;
    line.renderOrder = 11;
    helperGroup.add(line);

    controlPoints.forEach((position, pointIndex) => {
      const descriptor = { sourceId: source.id, kind: "curvePoint", pointIndex };
      const selected = isSelectedDescriptor(descriptor);
      const mesh = new THREE.Mesh(sphereGeometry, selected ? selectedMaterial : curveMaterial);
      mesh.position.copy(position);
      mesh.userData.descriptor = descriptor;
      mesh.renderOrder = 12;
      addHandleSprite(mesh, selected ? selectedCircleTexture : curveTexture, 24);
      helperGroup.add(mesh);
    });

    const centerPoint = getCurveCenterPoint(source.points);
    const center = new THREE.Mesh(boxGeometry, curveSelected ? selectedMaterial : centerMaterial);
    center.position.copy(
      toSurfaceScenePoint(centerPoint, handleOffset * 1.15),
    );
    center.userData.descriptor = curveDescriptor;
    center.userData.lastPosition = center.position.clone();
    center.renderOrder = 13;
    addHandleSprite(center, curveSelected ? selectedSquareTexture : centerTexture, 28);
    helperGroup.add(center);
  });

  if (selectedHelperDescriptor) {
    attachHelperByDescriptor(selectedHelperDescriptor);
  }
}

function updateTraceHighlightObjects() {
  if (!traceHighlightGroup) {
    return;
  }

  traceHighlightGroup.clear();
  let points = null;
  if (state.meta.hoveredTraceId && state.meta.imageTraceCandidates?.length) {
    const candidate = state.meta.imageTraceCandidates.find((item) => item.id === state.meta.hoveredTraceId);
    points = candidate?.points || null;
  } else if (state.meta.hoveredLoopId) {
    const loop = state.loops.find((item) => item.id === state.meta.hoveredLoopId);
    points = loop?.points || null;
  }

  if (!points?.length) {
    return;
  }

  const highlightPoints = points.map((point) =>
    toSurfaceScenePoint(point, Math.max(getWorldUnitsPerSourceUnit() * 0.8, 0.03)),
  );
  if (!highlightPoints.length) {
    return;
  }
  highlightPoints.push(highlightPoints[0].clone());

  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(highlightPoints),
    new THREE.LineBasicMaterial({
      color: "#3fb6ff",
      transparent: true,
      opacity: 0.98,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  line.renderOrder = 25;
  traceHighlightGroup.add(line);
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

function zoomExtentsSurfaceView() {
  const frame = getSurfaceFrame();
  const center = new THREE.Vector3(frame.centerX, frame.centerY, frame.targetZ);
  const currentDirection = new THREE.Vector3()
    .subVectors(camera.position, controls.target)
    .normalize();
  if (!Number.isFinite(currentDirection.lengthSq()) || currentDirection.lengthSq() === 0) {
    currentDirection.set(0.54, -0.68, 0.5).normalize();
  }

  const radius = Math.max(frame.width, frame.height, frame.groundedHeight) * 0.5;
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov * 0.5) * camera.aspect);
  const fitFov = Math.min(verticalFov, horizontalFov);
  const distance = Math.max(radius / Math.tan(fitFov * 0.5) + radius * 0.45, 0.5);

  camera.up.set(0, 0, 1);
  controls.target.copy(center);
  camera.position.copy(center).add(currentDirection.multiplyScalar(distance));
  camera.lookAt(center);
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
    shader.uniforms.uGrainNoise = { value: state.surface.grainNoise };
    shader.uniforms.uGrainLayerSize = { value: state.surface.grainLayerSize };
    shader.uniforms.uWorldPerSourceUnit = { value: Math.max(getWorldUnitsPerSourceUnit(), 1e-4) };
    shader.uniforms.uSourceWidth = { value: Math.max(state.meta.sourceBounds?.width || 1, 1) };
    shader.uniforms.uSourceHeight = { value: Math.max(state.meta.sourceBounds?.height || 1, 1) };
    shader.uniforms.uGrainAxis = {
      value:
        state.surface.grainAxis === "x"
          ? 0
          : state.surface.grainAxis === "y"
            ? 1
            : 2,
    };

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
uniform float uGrainNoise;
uniform float uGrainLayerSize;
uniform float uWorldPerSourceUnit;
uniform float uSourceWidth;
uniform float uSourceHeight;
uniform int uGrainAxis;
`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
vec3 baseTone = diffuseColor.rgb;
float grainScale = clamp(uGrainScale, 0.2, 20.0);
float grainNoise = clamp(uGrainNoise, 0.0, 3.0);
float grainLayerSize = clamp(uGrainLayerSize, 0.15, 8.0);
float sourceScale = max(uWorldPerSourceUnit, 0.0001);
vec3 sourcePos = vLocalPosition / sourceScale;
vec2 boardPos = sourcePos.xy;
vec2 halfSize = vec2(max(uSourceWidth, 1.0), max(uSourceHeight, 1.0)) * 0.5;
vec2 logCenter = vec2(-halfSize.x * 0.35, -halfSize.y * 1.15);
vec2 ringVector = (boardPos - logCenter) * vec2(1.0, 0.62);
float fiberCoord = sourcePos.y;
float crossCoord = sourcePos.x;

if (uGrainAxis == 0) {
  boardPos = vec2(sourcePos.y, sourcePos.z);
  halfSize = vec2(max(uSourceHeight, 1.0), max(uSourceWidth, 1.0)) * 0.5;
  logCenter = vec2(-halfSize.x * 1.1, 0.0);
  ringVector = (boardPos - logCenter) * vec2(0.75, 1.0);
  fiberCoord = sourcePos.x;
  crossCoord = sourcePos.y;
} else if (uGrainAxis == 1) {
  boardPos = vec2(sourcePos.x, sourcePos.z);
  halfSize = vec2(max(uSourceWidth, 1.0), max(uSourceHeight, 1.0)) * 0.5;
  logCenter = vec2(0.0, -halfSize.y * 1.1);
  ringVector = (boardPos - logCenter) * vec2(1.0, 0.75);
  fiberCoord = sourcePos.y;
  crossCoord = sourcePos.x;
}

float ringSpacing = max(1.25, 14.0 / grainScale);
float longWave = sin(boardPos.x * 0.035 + boardPos.y * 0.012) * (1.6 * grainNoise);
float shortWave = sin(boardPos.y * 0.075 - boardPos.x * 0.024) * (0.85 * grainNoise);
float flutter = sin(boardPos.x * 0.11 + sin(boardPos.y * 0.06) * 1.7) * (0.55 * grainNoise);
float crackle = sin(boardPos.x * 0.19 - boardPos.y * 0.14 + sin(boardPos.y * 0.08) * 2.4) * (0.28 * grainNoise * grainNoise);
float radial = length(ringVector) + longWave + shortWave + flutter + crackle;
float layerNoiseA = sin(radial * 0.11 + boardPos.x * 0.045 + boardPos.y * 0.018);
float layerNoiseB = sin(radial * 0.047 - boardPos.y * 0.053 + boardPos.x * 0.021);
float layerVariance = (layerNoiseA * 0.65 + layerNoiseB * 0.35) * grainLayerSize * 0.45;
float rings = 0.5 + 0.5 * sin((radial / ringSpacing) * 6.28318530718);

float fibers = 0.5 + 0.5 * sin(fiberCoord * 0.16 * grainScale + sin(crossCoord * 0.03) * (1.8 + grainNoise * 2.2));
float pores = 0.5 + 0.5 * sin(crossCoord * 0.055 + boardPos.y * 0.022 * grainScale + grainNoise * 0.8);
float bandCenter = 0.5 + layerVariance * 0.18;
float bandWidth = max(0.06, 0.32 - abs(layerVariance) * 0.11 - grainNoise * 0.035);
float grainMask = smoothstep(bandCenter - bandWidth, bandCenter + bandWidth, rings);

vec3 lightTone = mix(baseTone, vec3(1.0), 0.12);
vec3 darkTone = mix(baseTone, vec3(0.08, 0.06, 0.04), 0.34);
vec3 ringTone = mix(darkTone, lightTone, grainMask);
ringTone *= mix(0.9, 1.1, fibers * 0.22 + pores * 0.16 + grainNoise * 0.08);
diffuseColor.rgb = mix(baseTone, ringTone, clamp(0.64 + grainNoise * 0.08, 0.0, 0.92));
`,
      );
  };

  material.customProgramCacheKey = () =>
    `wood-cylinder-${state.surface.grainAxis}-${state.surface.grainScale.toFixed(2)}-${state.surface.grainNoise.toFixed(2)}-${state.surface.grainLayerSize.toFixed(2)}`;
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

function getWorldUnitsPerPreviewUnit() {
  const previewUnits = getPreviewUnits();
  const sourceUnits = state.meta.sourceUnits || "mm";
  const sourceUnitsPerPreviewUnit = convertUnitValue(1, previewUnits, sourceUnits);
  return sourceUnitsPerPreviewUnit * getWorldUnitsPerSourceUnit();
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
  const unitMode = getPreviewUnits() === "in" ? "in" : "mm";
  const majorUnitStep = unitMode === "in" ? 1 : 10;
  const minorUnitStep = unitMode === "in" ? 0.25 : 1;
  const worldPerUnit = getWorldUnitsPerPreviewUnit();
  const majorSpacing = majorUnitStep * worldPerUnit;
  const minorSpacing = minorUnitStep * worldPerUnit;

  if (!(majorSpacing > 0) || !(minorSpacing > 0)) {
    return;
  }

  const bounds = currentSurfaceGrid.bounds;
  const extentX = Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)) + majorSpacing * 2;
  const extentY = Math.max(Math.abs(bounds.minY), Math.abs(bounds.maxY)) + majorSpacing * 2;
  const dark = state.ui.theme === "dark";

  const minorPositions = buildGridLinePositions(extentX, extentY, minorSpacing);
  const majorPositions = buildGridLinePositions(extentX, extentY, majorSpacing);

  if (minorPositions.length / 6 <= 900) {
    const minorGeometry = new THREE.BufferGeometry();
    minorGeometry.setAttribute("position", new THREE.Float32BufferAttribute(minorPositions, 3));
    const minorLines = new THREE.LineSegments(
      minorGeometry,
      new THREE.LineBasicMaterial({
        color: dark ? "#4c4454" : "#d8c9b7",
        transparent: true,
        opacity: dark ? 0.34 : 0.48,
      }),
    );
    gridGroup.add(minorLines);
  }

  const majorGeometry = new THREE.BufferGeometry();
  majorGeometry.setAttribute("position", new THREE.Float32BufferAttribute(majorPositions, 3));
  const majorLines = new THREE.LineSegments(
    majorGeometry,
    new THREE.LineBasicMaterial({
      color: dark ? "#7a6d87" : "#b79f88",
      transparent: true,
      opacity: dark ? 0.62 : 0.82,
    }),
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
    new THREE.LineBasicMaterial({
      color: dark ? "#ff7bd5" : "#8d7558",
      transparent: true,
      opacity: dark ? 0.8 : 0.95,
    }),
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
  applyPreviewQuality();
  renderer.setSize(elements.surfaceCanvas.clientWidth, elements.surfaceCanvas.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color("#efe8dd");

  liveLightTarget = new THREE.Object3D();
  scene.add(liveLightTarget);

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
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.target.set(0, 0, 0.04);
  renderer.domElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  liveAmbientLight = new THREE.AmbientLight("#fff7ee", 1.4);
  scene.add(liveAmbientLight);

  liveKeyLight = new THREE.DirectionalLight("#fff4e7", 1.6);
  liveKeyLight.position.set(2.1, -1.8, 2.6);
  configureDirectionalShadow(liveKeyLight, 0.9, 2048);
  scene.add(liveKeyLight);

  liveFillLight = new THREE.DirectionalLight("#f7dcc8", 0.18);
  liveFillLight.position.set(-1.5, 1.6, 1.1);
  scene.add(liveFillLight);

  liveRimLight = new THREE.DirectionalLight("#c9d8ff", 0.45);
  liveRimLight.position.set(-1.4, 1.3, 1.2);
  scene.add(liveRimLight);

  liveShadowCatcher = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShadowMaterial({ color: "#000000", opacity: 0.28 }),
  );
  liveShadowCatcher.visible = false;
  liveShadowCatcher.receiveShadow = true;
  liveShadowCatcher.position.z = 0;
  scene.add(liveShadowCatcher);

  livePmremGenerator = new THREE.PMREMGenerator(renderer);
  liveEnvironmentScene = new RoomEnvironment();
  liveEnvironmentTarget = livePmremGenerator.fromScene(liveEnvironmentScene, 0.03);

  gridGroup = new THREE.Group();
  scene.add(gridGroup);

  traceHighlightGroup = new THREE.Group();
  scene.add(traceHighlightGroup);

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
  applyViewportRenderLook();
}

function updateThreeSurface() {
  if (surfaceMesh) {
    scene.remove(surfaceMesh);
    surfaceMesh.geometry.dispose();
    surfaceMesh.material.dispose();
  }
  if (surfaceWireframe) {
    scene.remove(surfaceWireframe);
    surfaceWireframe.geometry.dispose();
    surfaceWireframe.material.dispose();
    surfaceWireframe = null;
  }
  if (materialMap) {
    materialMap.dispose();
  }
  if (alphaMap) {
    alphaMap.dispose();
  }

  currentSurfaceGrid = buildSurfaceGrid(state);
  state.meta.waveNormalizationFactor = currentSurfaceGrid.normalizationFactor || 1;
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
  surfaceMesh.position.z = -currentSurfaceGrid.minHeight + SURFACE_PLANE_OFFSET;
  surfaceMesh.castShadow = true;
  surfaceMesh.receiveShadow = true;
  scene.add(surfaceMesh);

  if (liveShadowCatcher) {
    const metrics = getSurfaceShadowMetrics(currentSurfaceGrid);
    liveShadowCatcher.scale.set(metrics.width + 40, metrics.height + 40, 1);
    liveShadowCatcher.position.set(metrics.centerX, metrics.centerY, 0);
  }

  if (state.surface.showResolutionEdges) {
    const wireframeGeometry = new THREE.WireframeGeometry(geometry);
    const wireframeMaterial = new THREE.LineBasicMaterial({
      color: "#5d4a38",
      transparent: true,
      opacity: 0.42,
      depthTest: true,
      depthWrite: false,
    });
    surfaceWireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    surfaceWireframe.position.z = surfaceMesh.position.z + 0.0015;
    scene.add(surfaceWireframe);
  }

  update3DHelperObjects();
  updateTraceHighlightObjects();
  updateSceneGrid();
  applyViewportRenderLook();
  elements.bboxReadout.textContent = formatBoundsReadout();
}

function getRenderPresetConfig() {
  switch (state.render.preset) {
    case "warm":
      return {
        exposure: 1.08,
        ambientColor: "#fff0de",
        ambientIntensity: 1.08,
        keyColor: "#ffd09a",
        keyIntensity: 2.95,
        keyPosition: [2.4, -1.8, 3.1],
        fillColor: "#a8c8ff",
        fillIntensity: 0.5,
        fillPosition: [-2.0, 1.9, 1.8],
        rimColor: "#ffddb4",
        rimIntensity: 0.5,
        rimPosition: [-1.4, -2.2, 2.2],
        backgroundLight: "#f4eadf",
        backgroundDark: "#18141a",
        shadowStrength: 1.05,
      };
    case "cool":
      return {
        exposure: 0.98,
        ambientColor: "#ecf1ff",
        ambientIntensity: 1.02,
        keyColor: "#c8ddff",
        keyIntensity: 2.85,
        keyPosition: [2.2, -1.7, 3.0],
        fillColor: "#ffd3a8",
        fillIntensity: 0.46,
        fillPosition: [-1.9, 2.0, 1.7],
        rimColor: "#dbe5ff",
        rimIntensity: 0.58,
        rimPosition: [-1.4, -2.2, 2.3],
        backgroundLight: "#e8eef7",
        backgroundDark: "#101722",
        shadowStrength: 1.08,
      };
    case "dramatic":
      return {
        exposure: 0.92,
        ambientColor: "#f6f0ff",
        ambientIntensity: 0.74,
        keyColor: "#ffd3a6",
        keyIntensity: 3.35,
        keyPosition: [3.1, -1.25, 3.5],
        fillColor: "#90b0ff",
        fillIntensity: 0.56,
        fillPosition: [-2.4, 2.4, 1.7],
        rimColor: "#f0cfff",
        rimIntensity: 0.78,
        rimPosition: [-1.3, -2.6, 2.8],
        backgroundLight: "#ece6e0",
        backgroundDark: "#100d14",
        shadowStrength: 1.32,
      };
    default:
      return {
        exposure: 1.02,
        ambientColor: "#fff7ee",
        ambientIntensity: 1.18,
        keyColor: "#fff1e0",
        keyIntensity: 2.4,
        keyPosition: [2.2, -1.8, 2.9],
        fillColor: "#d7e3ff",
        fillIntensity: 0.42,
        fillPosition: [-1.8, 1.8, 1.7],
        rimColor: "#ffe0ed",
        rimIntensity: 0.38,
        rimPosition: [-1.1, -2.2, 2.3],
        backgroundLight: "#f1ebe4",
        backgroundDark: "#16131a",
        shadowStrength: 0.95,
      };
  }
}

function getRenderBackgroundColor(preset) {
  switch (state.render.background) {
    case "light":
      return "#f5efe8";
    case "dark":
      return "#131018";
    case "transparent":
      return null;
    default:
      return state.ui.theme === "dark" ? preset.backgroundDark : preset.backgroundLight;
  }
}

function configureDirectionalShadow(light, strength = 1, mapSize = 2048, surfaceGrid = currentSurfaceGrid) {
  const metrics = getSurfaceShadowMetrics(surfaceGrid);
  const halfExtent = Math.max(metrics.width, metrics.height) * 0.85 + metrics.depth * 2.5 + 10;
  light.castShadow = true;
  light.shadow.mapSize.set(mapSize, mapSize);
  light.shadow.bias = -0.00018 * strength;
  light.shadow.normalBias = 0.02 * strength;
  light.shadow.radius = 2 + strength * 1.5;
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = Math.max(metrics.maxDimension * 5.5, 180);
  light.shadow.camera.left = -halfExtent;
  light.shadow.camera.right = halfExtent;
  light.shadow.camera.top = halfExtent;
  light.shadow.camera.bottom = -halfExtent;
  light.shadow.camera.updateProjectionMatrix();
}

function buildStillRenderState() {
  const detailMultiplier = Math.max(1, Number(state.render.detailMultiplier) || 1);
  const renderState = {
    ...state,
    surface: {
      ...state.surface,
      resolution: Math.min(320, Math.max(32, Math.round(state.surface.resolution * detailMultiplier))),
    },
    meta: {
      ...state.meta,
      waveNormalizationFactor: 1,
    },
  };

  const renderGrid = buildSurfaceGrid(renderState);
  renderState.meta.waveNormalizationFactor = renderGrid.normalizationFactor || 1;
  return { renderState, renderGrid };
}

function disposeRenderScene(renderScene, disposableResources) {
  renderScene.traverse((object) => {
    if (object.geometry) {
      object.geometry.dispose();
    }
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material?.dispose?.());
      } else {
        object.material.dispose?.();
      }
    }
  });

  disposableResources.forEach((resource) => resource?.dispose?.());
}

function downloadDataUrl(filename, dataUrl) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function renderStillImage() {
  if (!camera || !currentSurfaceGrid) {
    state.ui.renderStatus = "Nothing to render yet.";
    syncRenderStatus();
    return;
  }

  const width = Math.max(512, Math.round(Number(state.render.outputWidth) || 2400));
  const height = Math.max(512, Math.round(Number(state.render.outputHeight) || 1350));
  state.ui.renderStatus = `Rendering ${width} x ${height} PNG...`;
  syncRenderStatus();

  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  let renderRenderer;
  let renderScene;
  let environmentScene;
  let disposableResources = [];

  try {
    const renderCanvas = document.createElement("canvas");
    renderRenderer = new THREE.WebGLRenderer({
      canvas: renderCanvas,
      antialias: true,
      alpha: state.render.background === "transparent",
      preserveDrawingBuffer: true,
    });
    renderRenderer.setPixelRatio(1);
    renderRenderer.setSize(width, height, false);
    renderRenderer.outputColorSpace = THREE.SRGBColorSpace;
    renderRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderRenderer.shadowMap.enabled = true;
    renderRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const preset = getRenderPresetConfig();
    renderRenderer.toneMappingExposure = preset.exposure;

    renderScene = new THREE.Scene();
    const backgroundColor = getRenderBackgroundColor(preset);
    renderScene.background = backgroundColor ? new THREE.Color(backgroundColor) : null;

    const renderLightTarget = new THREE.Object3D();
    renderScene.add(renderLightTarget);

    const pmremGenerator = new THREE.PMREMGenerator(renderRenderer);
    environmentScene = new RoomEnvironment();
    const environmentTarget = pmremGenerator.fromScene(environmentScene, 0.03);
    renderScene.environment = environmentTarget.texture;
    disposableResources = [environmentTarget, pmremGenerator];

    renderScene.add(new THREE.AmbientLight(preset.ambientColor, preset.ambientIntensity));

    const { renderState, renderGrid } = buildStillRenderState();

    const keyLight = new THREE.DirectionalLight(preset.keyColor, preset.keyIntensity);
    positionDirectionalLight(keyLight, renderLightTarget, preset.keyPosition, renderGrid);
    configureDirectionalShadow(keyLight, preset.shadowStrength, 4096, renderGrid);
    renderScene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(preset.fillColor, preset.fillIntensity);
    positionDirectionalLight(fillLight, renderLightTarget, preset.fillPosition, renderGrid);
    fillLight.castShadow = false;
    renderScene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(preset.rimColor, preset.rimIntensity);
    positionDirectionalLight(rimLight, renderLightTarget, preset.rimPosition, renderGrid);
    rimLight.castShadow = false;
    renderScene.add(rimLight);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(renderGrid.positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(renderGrid.uvs, 2));
    geometry.setIndex(renderGrid.indices);
    geometry.computeVertexNormals();

    const { colorCanvas, alphaCanvas } = createMaterialMaps(renderState);
    const renderColorMap = new THREE.CanvasTexture(colorCanvas);
    renderColorMap.colorSpace = THREE.SRGBColorSpace;
    renderColorMap.anisotropy = 8;
    renderColorMap.needsUpdate = true;

    const renderAlphaMap = new THREE.CanvasTexture(alphaCanvas);
    renderAlphaMap.needsUpdate = true;
    disposableResources.push(renderColorMap, renderAlphaMap);

    const mesh = new THREE.Mesh(geometry, buildSurfaceMaterial(renderColorMap, renderAlphaMap));
    mesh.position.z = -renderGrid.minHeight + SURFACE_PLANE_OFFSET;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    renderScene.add(mesh);

    const shadowMetrics = getSurfaceShadowMetrics(renderGrid);
    const shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(shadowMetrics.width + 40, shadowMetrics.height + 40),
      new THREE.ShadowMaterial({ color: "#000000", opacity: 0.32 }),
    );
    shadowCatcher.position.set(shadowMetrics.centerX, shadowMetrics.centerY, 0);
    shadowCatcher.receiveShadow = true;
    renderScene.add(shadowCatcher);

    const renderCamera = camera.clone();
    renderCamera.aspect = width / Math.max(height, 1);
    renderCamera.updateProjectionMatrix();

    renderRenderer.render(renderScene, renderCamera);

    const presetLabel = state.render.preset[0].toUpperCase() + state.render.preset.slice(1);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dataUrl = renderRenderer.domElement.toDataURL("image/png");
    downloadDataUrl(`wavythought-render-${state.render.preset}-${timestamp}.png`, dataUrl);

    state.ui.renderStatus = `Rendered ${width} x ${height} PNG with the ${presetLabel} preset.`;
  } catch (error) {
    state.ui.renderStatus = error instanceof Error ? `Render failed: ${error.message}` : "Render failed.";
  } finally {
    environmentScene?.dispose?.();
    if (renderScene) {
      disposeRenderScene(renderScene, disposableResources);
    } else {
      disposableResources.forEach((resource) => resource?.dispose?.());
    }
    renderRenderer?.dispose?.();
    syncRenderStatus();
  }
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

  if (state.meta.hoveredTraceId && state.meta.imageTraceCandidates?.length) {
    const candidate = state.meta.imageTraceCandidates.find((item) => item.id === state.meta.hoveredTraceId);
    if (candidate) {
      drawLoop(profileContext, { points: candidate.points }, bounds, width, height);
      profileContext.fillStyle = "rgba(63, 182, 255, 0.12)";
      profileContext.fill();
      profileContext.strokeStyle = "#3fb6ff";
      profileContext.lineWidth = 3;
      profileContext.stroke();
    }
  }

  if (state.meta.hoveredLoopId) {
    const hoveredLoop = state.loops.find((loop) => loop.id === state.meta.hoveredLoopId);
    if (hoveredLoop) {
      drawLoop(profileContext, hoveredLoop, bounds, width, height);
      profileContext.fillStyle = "rgba(63, 182, 255, 0.12)";
      profileContext.fill();
      profileContext.strokeStyle = "#3fb6ff";
      profileContext.lineWidth = 3;
      profileContext.stroke();
    }
  }

  state.sources.forEach((source) => {
    if (source.type === "point") {
      const descriptor = { sourceId: source.id, kind: "pointHandle", pointIndex: 0 };
      const colors = isSelectedDescriptor(descriptor) ? HANDLE_COLORS.selected : HANDLE_COLORS.point;
      const point = toCanvasPoint(source.points[0], bounds, width, height);
      profileContext.beginPath();
      profileContext.arc(point.x, point.y, 7, 0, Math.PI * 2);
      profileContext.fillStyle = colors.fill;
      profileContext.strokeStyle = colors.stroke;
      profileContext.lineWidth = 2;
      profileContext.fill();
      profileContext.stroke();
    } else if (source.type === "curve") {
      const curveDescriptor = { sourceId: source.id, kind: "curveCenter" };
      const curveColors = isSelectedDescriptor(curveDescriptor) ? HANDLE_COLORS.selected : HANDLE_COLORS.curve;
      const curvePreviewPoints = sampleCurveSourcePolyline(source.points, 56);
      profileContext.strokeStyle = curveColors.fill;
      profileContext.lineWidth = isSelectedDescriptor(curveDescriptor) ? 3 : 2.2;
      profileContext.beginPath();
      curvePreviewPoints.forEach((point, index) => {
        const canvasPoint = toCanvasPoint(point, bounds, width, height);
        if (index === 0) {
          profileContext.moveTo(canvasPoint.x, canvasPoint.y);
        } else {
          profileContext.lineTo(canvasPoint.x, canvasPoint.y);
        }
      });
      profileContext.stroke();
      source.points.forEach((point, pointIndex) => {
        const descriptor = { sourceId: source.id, kind: "curvePoint", pointIndex };
        const colors = isSelectedDescriptor(descriptor) ? HANDLE_COLORS.selected : HANDLE_COLORS.curve;
        const canvasPoint = toCanvasPoint(point, bounds, width, height);
        profileContext.beginPath();
        profileContext.arc(canvasPoint.x, canvasPoint.y, 5, 0, Math.PI * 2);
        profileContext.fillStyle = colors.fill;
        profileContext.strokeStyle = colors.stroke;
        profileContext.lineWidth = 1.8;
        profileContext.fill();
        profileContext.stroke();
      });

      const centerPoint = toCanvasPoint(getCurveCenterPoint(source.points), bounds, width, height);
      const centerColors = isSelectedDescriptor(curveDescriptor) ? HANDLE_COLORS.selected : HANDLE_COLORS.center;
      profileContext.beginPath();
      profileContext.roundRect(centerPoint.x - 5, centerPoint.y - 5, 10, 10, 3);
      profileContext.fillStyle = centerColors.fill;
      profileContext.strokeStyle = centerColors.stroke;
      profileContext.lineWidth = 1.8;
      profileContext.fill();
      profileContext.stroke();
    }
    else {
      const regionPreviewPoints = sampleCurveSourcePolyline(source.points, 72);
      profileContext.strokeStyle = HANDLE_COLORS.curve.fill;
      profileContext.lineWidth = 2.2;
      profileContext.beginPath();
      regionPreviewPoints.forEach((point, index) => {
        const canvasPoint = toCanvasPoint(point, bounds, width, height);
        if (index === 0) {
          profileContext.moveTo(canvasPoint.x, canvasPoint.y);
        } else {
          profileContext.lineTo(canvasPoint.x, canvasPoint.y);
        }
      });
      if (regionPreviewPoints.length) {
        const start = toCanvasPoint(regionPreviewPoints[0], bounds, width, height);
        profileContext.lineTo(start.x, start.y);
      }
      profileContext.setLineDash([10, 6]);
      profileContext.stroke();
      profileContext.setLineDash([]);
    }
  });

  if (state.ui.pendingCurvePoints.length) {
    const pendingPreview = sampleCurveSourcePolyline(state.ui.pendingCurvePoints, 40);
    profileContext.strokeStyle = HANDLE_COLORS.curve.fill;
    profileContext.lineWidth = 2;
    profileContext.beginPath();
    pendingPreview.forEach((point, index) => {
      const canvasPoint = toCanvasPoint(point, bounds, width, height);
      if (index === 0) {
        profileContext.moveTo(canvasPoint.x, canvasPoint.y);
      } else {
        profileContext.lineTo(canvasPoint.x, canvasPoint.y);
      }
    });
    profileContext.stroke();

    profileContext.fillStyle = HANDLE_COLORS.curve.fill;
    profileContext.strokeStyle = HANDLE_COLORS.curve.stroke;
    state.ui.pendingCurvePoints.forEach((point) => {
      const pending = toCanvasPoint(point, bounds, width, height);
      profileContext.beginPath();
      profileContext.arc(pending.x, pending.y, 6, 0, Math.PI * 2);
      profileContext.fill();
      profileContext.stroke();
    });
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
    if (source.type === "region" || isSourceHidden(source) || isSourceLocked(source)) {
      return;
    }
    source.points.forEach((point, pointIndex) => {
      const screenPoint = toCanvasPoint(point, bounds, elements.profileCanvas.width, elements.profileCanvas.height);
      const distance = Math.hypot(canvasPoint.x - screenPoint.x, canvasPoint.y - screenPoint.y);
      if (!best || distance < best.distance) {
        best = {
          distance,
          sourceId: source.id,
          kind: source.type === "curve" ? "curvePoint" : "pointHandle",
          mode: "point",
          pointIndex,
        };
      }
    });

    if (source.type === "curve") {
      const centerPoint = toCanvasPoint(
        getCurveCenterPoint(source.points),
        bounds,
        elements.profileCanvas.width,
        elements.profileCanvas.height,
      );
      const centerDistance = Math.max(
        Math.abs(canvasPoint.x - centerPoint.x),
        Math.abs(canvasPoint.y - centerPoint.y),
      );
      if ((!best || centerDistance < best.distance) && centerDistance <= 10) {
        best = {
          distance: centerDistance,
          sourceId: source.id,
          kind: "curveCenter",
          mode: "curve",
          pointIndex: null,
        };
      }

      const curvePreviewPoints = sampleCurveSourcePolyline(source.points, 56)
        .map((point) =>
          toCanvasPoint(point, bounds, elements.profileCanvas.width, elements.profileCanvas.height),
        );
      for (let index = 0; index < curvePreviewPoints.length - 1; index += 1) {
        const distance = distanceToCanvasSegment(canvasPoint, curvePreviewPoints[index], curvePreviewPoints[index + 1]);
        if ((!best || distance < best.distance) && distance <= 12) {
          best = {
            distance,
            sourceId: source.id,
            kind: "curveCenter",
            mode: "curve",
            pointIndex: null,
          };
        }
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
  setSelectedHelperDescriptor({
    sourceId: hit.sourceId,
    kind: hit.kind,
    pointIndex: hit.pointIndex,
  });
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

  const descriptor = picked.userData?.descriptor;
  const source = state.sources.find((item) => item.id === descriptor?.sourceId);
  if (!source || isSourceLocked(source)) {
    return;
  }

  setSelectedHelperDescriptor(descriptor);
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

function renderRegionWaveSourceList() {
  const innerLoops = state.loops.filter((loop) => loop.role === "inner");
  if (!innerLoops.length) {
    elements.regionWaveSourceList.innerHTML = '<p class="status-text">No interior regions available for region wave sources.</p>';
    return;
  }

  elements.regionWaveSourceList.innerHTML = "";
  const enabledRows = [];
  const availableRows = [];

  innerLoops.forEach((loop) => {
    const source = state.sources.find((item) => item.type === "region" && item.regionLoopId === loop.id);
    const row = document.createElement("div");
    row.className = "wave-source-row";
    row.innerHTML = `
      <label class="checkbox-control wave-source-primary">
        <input
          type="checkbox"
          data-action="toggle-region-wave"
          data-loop-id="${loop.id}"
          ${source ? "checked" : ""}
        />
        <span>${loop.label}</span>
      </label>
      <span class="wave-source-row-meta">${
        source
          ? [isWaveSourceSelected(source.id) ? "Selected" : "Enabled", source.locked ? "Locked" : null, source.hidden ? "Hidden" : null]
              .filter(Boolean)
              .join(" / ")
          : "Off"
      }</span>
    `;

    row.querySelector('[data-action="toggle-region-wave"]').addEventListener("change", (event) => {
      const isEnabled = event.target.checked;
      const existingIndex = state.sources.findIndex(
        (item) => item.type === "region" && item.regionLoopId === loop.id,
      );
      if (!isEnabled && existingIndex >= 0) {
        const removed = state.sources[existingIndex];
        state.sources.splice(existingIndex, 1);
        toggleWaveSourceSelection(removed.id, false);
        state.ui.status = `Removed ${removed.label}.`;
      } else if (isEnabled && existingIndex < 0) {
        const nextSource = createRegionWaveSource(loop);
        state.sources.push(nextSource);
        toggleWaveSourceSelection(nextSource.id, true);
        state.ui.status = `Added ${loop.label} as a wave source.`;
      } else if (isEnabled && existingIndex >= 0) {
        toggleWaveSourceSelection(state.sources[existingIndex].id, true);
        state.ui.status = `Selected ${loop.label} for shared wave settings.`;
      }
      syncView();
    });

    if (source) {
      enabledRows.push(row);
    } else {
      availableRows.push(row);
    }
  });

  if (enabledRows.length) {
    const enabledCard = document.createElement("article");
    enabledCard.className = "source-card compact-wave-card";
    enabledCard.innerHTML = `
      <header>
        <div>
          <h3>Enabled Region Waves</h3>
          <p>These interior regions are active wave sources.</p>
        </div>
        <button class="ghost-button compact-action-button" type="button" data-action="unselect-all-region-waves">Unselect All</button>
      </header>
      <div class="compact-wave-list"></div>
    `;
    const enabledList = enabledCard.querySelector(".compact-wave-list");
    enabledRows.forEach((row) => enabledList.append(row));
    enabledList.querySelectorAll(".wave-source-row").forEach((row) => {
      const loopId = row.querySelector('[data-action="toggle-region-wave"]')?.dataset.loopId;
      const source = state.sources.find((item) => item.type === "region" && item.regionLoopId === loopId);
      if (!source) {
        return;
      }
      const meta = row.querySelector(".wave-source-row-meta");
      meta.outerHTML = `
        <div class="wave-source-row-actions">
        <label class="checkbox-control wave-source-secondary">
          <input type="checkbox" data-action="select-region-wave-source" data-source-id="${source.id}" ${isWaveSourceSelected(source.id) ? "checked" : ""} />
          <span>Edit</span>
        </label>
        <button class="ghost-button compact-action-button" type="button" data-action="toggle-hide-region" data-source-id="${source.id}">${source.hidden ? "Show" : "Hide"}</button>
        <button class="ghost-button compact-action-button" type="button" data-action="toggle-lock-region" data-source-id="${source.id}">${source.locked ? "Unlock" : "Lock"}</button>
        </div>
      `;
      const actions = row.querySelector(".wave-source-row-actions");

      actions.querySelector('[data-action="select-region-wave-source"]').addEventListener("change", (event) => {
        toggleWaveSourceSelection(source.id, event.target.checked);
        syncWaveUiOnly();
      });
      actions.querySelector('[data-action="toggle-hide-region"]').addEventListener("click", () => {
        source.hidden = !source.hidden;
        state.ui.status = `${source.hidden ? "Hid" : "Showed"} ${source.label} guides.`;
        syncWaveUiOnly();
      });
      actions.querySelector('[data-action="toggle-lock-region"]').addEventListener("click", () => {
        source.locked = !source.locked;
        state.ui.status = `${source.locked ? "Locked" : "Unlocked"} ${source.label}.`;
        syncWaveUiOnly();
      });
    });
    enabledCard.querySelector('[data-action="unselect-all-region-waves"]').addEventListener("click", () => {
      const regionSources = innerLoops
        .map((loop) => state.sources.find((item) => item.type === "region" && item.regionLoopId === loop.id))
        .filter((item) => item && isWaveSourceSelected(item.id));
      regionSources.forEach((sourceItem) => {
        toggleWaveSourceSelection(sourceItem.id, false);
      });
      state.ui.status = "Unselected all region wave sources.";
      syncWaveUiOnly();
    });
    elements.regionWaveSourceList.append(enabledCard);
  }

  if (availableRows.length) {
    const listCard = document.createElement("article");
    listCard.className = "source-card compact-wave-card";
    listCard.innerHTML = `
      <header>
        <div>
          <h3>Region Wave Sources</h3>
          <p>Enable interior regions here.</p>
        </div>
        <button class="ghost-button compact-action-button" type="button" data-action="enable-all-region-waves">Enable All</button>
      </header>
      <div class="compact-wave-list"></div>
    `;
    const list = listCard.querySelector(".compact-wave-list");
    availableRows.forEach((row) => list.append(row));
    listCard.querySelector('[data-action="enable-all-region-waves"]').addEventListener("click", () => {
      innerLoops.forEach((loop) => {
        const existingSource = state.sources.find((item) => item.type === "region" && item.regionLoopId === loop.id);
        if (!existingSource) {
          const nextSource = createRegionWaveSource(loop);
          state.sources.push(nextSource);
          toggleWaveSourceSelection(nextSource.id, true);
        }
      });
      state.ui.status = "Enabled all region wave sources.";
      syncView();
    });
    elements.regionWaveSourceList.append(listCard);
  }
}

function renderSourceList() {
  elements.sourceList.innerHTML = "";
  const groupedSources = [
    {
      type: "point",
      title: "Point Wave Sources",
      description: "Radial wave sources.",
      sources: state.sources.filter((source) => source.type === "point"),
    },
    {
      type: "curve",
      title: "Curve Wave Sources",
      description: "Distance-to-curve wave sources.",
      sources: state.sources.filter((source) => source.type === "curve"),
    },
  ];

  if (!groupedSources.some((group) => group.sources.length)) {
    elements.sourceList.innerHTML = '<p class="status-text">No point or curve wave sources yet.</p>';
    return;
  }

  groupedSources.forEach((group) => {
    if (!group.sources.length) {
      return;
    }

    const allSelected = group.sources.every((source) => isWaveSourceSelected(source.id));

    const card = document.createElement("article");
    card.className = "source-card compact-wave-card";
    card.innerHTML = `
      <header>
        <div>
          <h3>${group.title}</h3>
          <p>${group.description}</p>
        </div>
        <button class="ghost-button compact-action-button" type="button" data-action="select-all-group">
          ${allSelected ? "Deselect All" : "Select All"}
        </button>
      </header>
      <div class="compact-wave-list"></div>
    `;

    const list = card.querySelector(".compact-wave-list");
    group.sources.forEach((source) => {
      const row = document.createElement("div");
      row.className = "wave-source-row wave-source-row-manual";
      row.innerHTML = `
        <div class="wave-source-primary wave-source-label-only">
          <span>${source.label}</span>
        </div>
        <div class="wave-source-row-actions">
          <label class="checkbox-control wave-source-secondary">
            <input
              type="checkbox"
              data-action="select-wave-source"
              data-source-id="${source.id}"
              ${isWaveSourceSelected(source.id) ? "checked" : ""}
            />
            <span>Edit</span>
          </label>
          <button data-action="duplicate-source" data-source-id="${source.id}" class="ghost-button compact-action-button" type="button">Duplicate</button>
          <button data-action="toggle-hide-source" data-source-id="${source.id}" class="ghost-button compact-action-button" type="button">${source.hidden ? "Show" : "Hide"}</button>
          <button data-action="toggle-lock-source" data-source-id="${source.id}" class="ghost-button compact-action-button" type="button">${source.locked ? "Unlock" : "Lock"}</button>
          <button data-action="remove-source" data-source-id="${source.id}" class="ghost-button" type="button">Remove</button>
        </div>
      `;

      row.querySelector('[data-action="select-wave-source"]').addEventListener("change", (event) => {
        toggleWaveSourceSelection(event.target.dataset.sourceId, event.target.checked);
        syncWaveUiOnly();
      });
      row.querySelector('[data-action="duplicate-source"]').addEventListener("click", () => {
        const duplicate = duplicateManualSource(source);
        state.sources.push(duplicate);
        toggleWaveSourceSelection(duplicate.id, true);
        state.ui.status = `Duplicated ${source.label}.`;
        syncView();
      });
      row.querySelector('[data-action="toggle-hide-source"]').addEventListener("click", () => {
        source.hidden = !source.hidden;
        state.ui.status = `${source.hidden ? "Hid" : "Showed"} ${source.label} guides.`;
        syncWaveUiOnly();
      });
      row.querySelector('[data-action="toggle-lock-source"]').addEventListener("click", () => {
        source.locked = !source.locked;
        state.ui.status = `${source.locked ? "Locked" : "Unlocked"} ${source.label}.`;
        syncWaveUiOnly();
      });
      row.querySelector('[data-action="remove-source"]').addEventListener("click", () => {
        toggleWaveSourceSelection(source.id, false);
        state.sources = state.sources.filter((item) => item.id !== source.id);
        state.ui.status = `Removed ${source.label}.`;
        syncView();
      });
      list.append(row);
    });

    card.querySelector('[data-action="select-all-group"]').addEventListener("click", () => {
      const nextSelected = !group.sources.every((source) => isWaveSourceSelected(source.id));
      group.sources.forEach((source) => {
        toggleWaveSourceSelection(source.id, nextSelected);
      });
      state.ui.status = `${nextSelected ? "Selected" : "Deselected"} all ${group.type} wave sources.`;
      syncWaveUiOnly();
    });

    elements.sourceList.append(card);
  });
}

function renderRegionList() {
  const innerLoops = state.loops.filter((loop) => loop.role === "inner");
  elements.regionList.innerHTML = "";
  const scrollWrap = document.createElement("div");
  scrollWrap.className = "region-species-scroll-wrap";
  scrollWrap.addEventListener(
    "wheel",
    (event) => {
      const hasHorizontalOverflow = scrollWrap.scrollWidth > scrollWrap.clientWidth;
      if (!hasHorizontalOverflow) {
        return;
      }
      if (Math.abs(event.deltaY) < Math.abs(event.deltaX) && event.deltaX === 0) {
        return;
      }
      scrollWrap.scrollLeft += event.deltaY + event.deltaX;
      event.preventDefault();
    },
    { passive: false },
  );
  const table = document.createElement("div");
  table.className = "region-species-table";

  const header = document.createElement("div");
  header.className = "region-species-table-head";
  header.innerHTML = `
    <div class="region-species-head-label">Region</div>
    <div class="region-species-head-options">
      ${state.meta.speciesList
        .map((speciesName) => {
          const palette = speciesPresets[speciesName] || speciesPresets.walnut;
          return `
            <div class="region-species-head-item" title="${formatSpeciesName(speciesName)}">
              <span
                class="region-species-swatch"
                style="--species-color: ${palette.base}; --species-contrast: ${palette.light};"
              ></span>
              <span>${formatSpeciesShortName(speciesName)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
  table.append(header);

  const baseRow = document.createElement("div");
  baseRow.className = "region-species-row region-species-row-base";
  baseRow.innerHTML = `
    <div class="region-species-row-info">
      <strong>Base Surface</strong>
      <span>Outer surface wood species</span>
    </div>
    <div class="region-species-row-options">
      ${state.meta.speciesList
        .map((speciesName) => {
          const palette = speciesPresets[speciesName] || speciesPresets.walnut;
          return `
            <button
              class="region-species-choice ${state.surface.species === speciesName ? "is-active" : ""}"
              type="button"
              data-surface-species="${speciesName}"
              aria-label="Assign base surface to ${formatSpeciesName(speciesName)}"
              title="${formatSpeciesName(speciesName)}"
              style="--species-color: ${palette.base}; --species-contrast: ${palette.light};"
            >
              <span class="region-species-choice-box"></span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
  baseRow.querySelectorAll(".region-species-choice").forEach((choice) => {
    choice.addEventListener("click", () => {
      const speciesName = choice.dataset.surfaceSpecies;
      if (!speciesName || state.surface.species === speciesName) {
        return;
      }
      updateSurfaceSetting("species", speciesName);
    });
  });
  table.append(baseRow);

  if (!innerLoops.length) {
    const empty = document.createElement("p");
    empty.className = "status-text";
    empty.textContent = "No interior color-break regions detected.";
    table.append(empty);
    scrollWrap.append(table);
    elements.regionList.append(scrollWrap);
    return;
  }

  innerLoops.forEach((loop) => {
    const row = document.createElement("div");
    row.className = "region-species-row";
    row.innerHTML = `
      <div class="region-species-row-info">
        <strong>${loop.label}</strong>
        <span>${formatAreaReadout(Math.abs(polygonArea(loop.points)))}</span>
      </div>
      <div class="region-species-row-options">
        ${state.meta.speciesList
          .map((speciesName) => {
            const palette = speciesPresets[speciesName] || speciesPresets.walnut;
            return `
              <button
                class="region-species-choice ${loop.species === speciesName ? "is-active" : ""}"
                type="button"
                data-loop-id="${loop.id}"
                data-species="${speciesName}"
                aria-label="Assign ${loop.label} to ${formatSpeciesName(speciesName)}"
                title="${formatSpeciesName(speciesName)}"
                style="--species-color: ${palette.base}; --species-contrast: ${palette.light};"
              >
                <span class="region-species-choice-box"></span>
              </button>
            `;
          })
          .join("")}
      </div>
    `;

    row.addEventListener("mouseenter", () => {
      state.meta.hoveredLoopId = loop.id;
      renderProfileCanvas();
      updateTraceHighlightObjects();
    });
    row.addEventListener("mouseleave", () => {
      if (state.meta.hoveredLoopId !== loop.id) {
        return;
      }
      state.meta.hoveredLoopId = null;
      renderProfileCanvas();
      updateTraceHighlightObjects();
    });

    row.querySelectorAll(".region-species-choice").forEach((choice) => {
      choice.addEventListener("click", () => {
        const speciesName = choice.dataset.species;
        if (!speciesName || loop.species === speciesName) {
          return;
        }
        loop.species = speciesName;
        state.ui.status = `${loop.label} assigned to ${formatSpeciesName(speciesName)}.`;
        syncView();
      });
    });

    table.append(row);
  });

  scrollWrap.append(table);
  elements.regionList.append(scrollWrap);
}

function renderImageTraceList() {
  if (!state.meta.imageTraceCandidates?.length) {
    elements.imageTraceList.innerHTML = "";
    elements.applyTraceRegionsButton.disabled = true;
    return;
  }

  const selection = sanitizeTraceSelection(
    state.meta.imageTraceCandidates,
    state.meta.imageTraceDraftSelection,
  );
  state.meta.imageTraceDraftSelection = selection;
  const rows = state.meta.imageTraceCandidates
    .map((candidate, index) => {
      const mode = selection.modes[candidate.id] || (index === 0 ? "surface" : "add");
      return `
        <div class="trace-row" data-trace-id="${candidate.id}">
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
  elements.applyTraceRegionsButton.disabled = traceSelectionsMatch(
    state.meta.imageTraceCandidates,
    state.meta.imageTraceSelection,
    state.meta.imageTraceDraftSelection,
  );

  elements.imageTraceList.querySelectorAll(".trace-mode-select").forEach((select) => {
    select.addEventListener("change", (event) => {
      state.meta.imageTraceDraftSelection = sanitizeTraceSelection(state.meta.imageTraceCandidates, {
        modes: {
          ...state.meta.imageTraceDraftSelection.modes,
          [event.target.dataset.traceId]: event.target.value,
        },
      });
      state.ui.status = "Trace region changes pending. Click Apply Regions.";
      syncStatus();
      renderImageTraceList();
      syncImageTraceStatus();
    });
  });

  elements.imageTraceList.querySelectorAll(".trace-row").forEach((row) => {
    row.addEventListener("mouseenter", () => {
      state.meta.hoveredTraceId = row.dataset.traceId;
      renderProfileCanvas();
      updateTraceHighlightObjects();
    });
    row.addEventListener("mouseleave", () => {
      if (state.meta.hoveredTraceId !== row.dataset.traceId) {
        return;
      }
      state.meta.hoveredTraceId = null;
      renderProfileCanvas();
      updateTraceHighlightObjects();
    });
  });
}

function syncStatus() {
  elements.profileStatus.textContent = state.ui.status;
  elements.sourceModeStatus.textContent =
    state.ui.placementMode === "point"
      ? "Click anywhere inside the profile to place a point wave source."
      : state.ui.placementMode === "curve"
        ? state.ui.pendingCurvePoints.length
          ? `Click to add curve points. Press Enter to finish (${state.ui.pendingCurvePoints.length} point${state.ui.pendingCurvePoints.length === 1 ? "" : "s"}).`
          : "Click to add the first curve point. Press Enter when the spline is complete."
        : "Click Add Point or Add Curve, then place the source in the 2D view.";
}

function getSurfaceAspectRatio() {
  const width = elements.surfaceCanvas.clientWidth || elements.surfaceCanvas.width || 16;
  const height = elements.surfaceCanvas.clientHeight || elements.surfaceCanvas.height || 9;
  return width / Math.max(height, 1);
}

function syncRenderAspectFromWidth() {
  const width = Math.max(512, Math.round(Number(state.render.outputWidth) || 512));
  const aspect = getSurfaceAspectRatio();
  state.render.outputWidth = width;
  state.render.outputHeight = Math.max(512, Math.round(width / Math.max(aspect, 1e-4)));
}

function syncRenderAspectFromHeight() {
  const height = Math.max(512, Math.round(Number(state.render.outputHeight) || 512));
  const aspect = getSurfaceAspectRatio();
  state.render.outputHeight = height;
  state.render.outputWidth = Math.max(512, Math.round(height * aspect));
}

function syncRenderStatus() {
  elements.renderStatus.textContent = state.ui.renderStatus;
}

function syncInactiveControlState(element, active) {
  if (!element) {
    return;
  }
  element.classList.toggle("is-inactive", !active);
}

function getVisibleImageTraceControlsActive() {
  return Boolean(
    state.meta.pendingImportFile ||
    (state.meta.importedFile && state.meta.importKind === "image"),
  );
}

function syncProjectSummary() {
  elements.projectFileSummary.textContent = `File: ${state.meta.importName || "Untitled"}`;
  elements.projectUnitsSummary.textContent = `Working units: ${getPreviewUnits()} | Source units: ${state.meta.sourceUnits || "mm"}`;
  elements.projectBoundsSummary.textContent = formatBoundsReadout().replace("BBox ", "BBox: ");
  elements.projectRegionSummary.textContent = `Interior regions: ${state.loops.filter((loop) => loop.role === "inner").length}`;
  elements.projectSourceSummary.textContent = `Wave sources: ${state.sources.length}`;
}

function syncExportSummary() {
  const units = getPreviewUnits();
  elements.exportUnitsStatus.textContent = `Exported values follow the current preview units: ${units}.`;
}

function syncWaveSelectionSummary() {
  const selectedSources = getSelectedWaveSources();
  if (!selectedSources.length) {
    elements.waveSelectionSummary.textContent = "Select a wave source to edit its settings.";
    elements.clearWaveSelectionButton.disabled = true;
    return;
  }

  elements.clearWaveSelectionButton.disabled = false;
  if (selectedSources.length === 1) {
    elements.waveSelectionSummary.textContent = `Editing ${selectedSources[0].label}.`;
    return;
  }

  elements.waveSelectionSummary.textContent = `Editing ${selectedSources.length} wave sources.`;
}

function applyPreviewQuality() {
  if (!renderer) {
    return;
  }
  const qualityCap =
    state.ui.previewQuality === "low"
      ? 1
      : state.ui.previewQuality === "high"
        ? 2
        : 1.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, qualityCap));
  renderer.setSize(elements.surfaceCanvas.clientWidth, elements.surfaceCanvas.clientHeight, false);
}

function syncWaveUiOnly() {
  syncWaveSelectionSummary();
  syncSharedWaveSettingsPanel();
  renderRegionWaveSourceList();
  renderSourceList();
  syncStatus();
  renderProfileCanvas();
  update3DHelperObjects();
}

function syncView() {
  applySidebarWidth();
  const hasPendingImportFile = Boolean(state.meta.pendingImportFile);
  const imageControlsActive = getVisibleImageTraceControlsActive();
  elements.svgSamplesInput.value = String(state.importSettings.curveSamples);
  elements.svgSamplesNumber.value = String(state.importSettings.curveSamples);
  elements.unitsMmButton.classList.toggle("is-active", state.importSettings.units === "mm");
  elements.unitsInButton.classList.toggle("is-active", state.importSettings.units === "in");
  elements.previewUnitsMmButton.classList.toggle("is-active", getPreviewUnits() === "mm");
  elements.previewUnitsInButton.classList.toggle("is-active", getPreviewUnits() === "in");
  elements.importWidthInput.value = Number(state.importSettings.importWidth).toFixed(3);
  elements.importHeightInput.value = Number(state.importSettings.importHeight).toFixed(3);
  elements.aspectLockInput.checked = state.importSettings.aspectLocked;
  elements.profileDropZoneLabel.textContent = state.meta.pendingImportFile
    ? state.meta.pendingImportFile.name
    : "Choose file or drag it here";
  elements.importProfileButton.disabled = !state.meta.pendingImportFile;
  elements.importProfileButton.textContent = state.meta.pendingImportFile
    ? `Import ${state.meta.pendingImportFile.name}`
    : "Import Selected File";
  syncInactiveControlState(elements.imageImportOptions, imageControlsActive);
  syncInactiveControlState(elements.importSizingControls, hasPendingImportFile);
  syncInactiveControlState(elements.vectorImportOptions, hasPendingImportFile);
  elements.resolutionInput.value = String(state.surface.resolution);
  elements.resolutionNumber.value = String(state.surface.resolution);
  elements.previewQualityLowButton.classList.toggle("is-active", state.ui.previewQuality === "low");
  elements.previewQualityMediumButton.classList.toggle("is-active", state.ui.previewQuality === "medium");
  elements.previewQualityHighButton.classList.toggle("is-active", state.ui.previewQuality === "high");
  elements.heightScaleInput.value = String(state.surface.heightScale);
  elements.heightScaleNumber.value = String(state.surface.heightScale);
  elements.edgeFadeEnabledInput.checked = state.surface.edgeFadeEnabled;
  elements.edgeFadeInput.value = String(state.surface.edgeFade);
  elements.edgeFadeNumber.value = String(state.surface.edgeFade);
  elements.internalEdgeFadeEnabledInput.checked = state.surface.internalEdgeFadeEnabled;
  elements.internalEdgeFadeInput.value = String(state.surface.internalEdgeFade);
  elements.internalEdgeFadeNumber.value = String(state.surface.internalEdgeFade);
  elements.normalizeWavesInput.checked = state.surface.normalizeCombinedHeight;
  elements.edgeFadeInput.disabled = !state.surface.edgeFadeEnabled;
  elements.edgeFadeNumber.disabled = !state.surface.edgeFadeEnabled;
  elements.internalEdgeFadeInput.disabled = !state.surface.internalEdgeFadeEnabled;
  elements.internalEdgeFadeNumber.disabled = !state.surface.internalEdgeFadeEnabled;
  syncInactiveControlState(elements.edgeFadeControl, state.surface.edgeFadeEnabled);
  syncInactiveControlState(elements.internalEdgeFadeControl, state.surface.internalEdgeFadeEnabled);
  elements.showSurfaceResolutionInput.checked = state.surface.showResolutionEdges;
  elements.woodToggleInput.checked = state.surface.woodEnabled;
  elements.grainScaleInput.value = String(state.surface.grainScale);
  elements.grainScaleNumber.value = String(state.surface.grainScale);
  elements.grainNoiseInput.value = String(state.surface.grainNoise);
  elements.grainNoiseNumber.value = String(state.surface.grainNoise);
  elements.grainLayerSizeInput.value = String(state.surface.grainLayerSize);
  elements.grainLayerSizeNumber.value = String(state.surface.grainLayerSize);
  elements.grainAxisXButton.classList.toggle("is-active", state.surface.grainAxis === "x");
  elements.grainAxisYButton.classList.toggle("is-active", state.surface.grainAxis === "y");
  elements.grainAxisZButton.classList.toggle("is-active", state.surface.grainAxis === "z");
  elements.renderPresetStudioButton.classList.toggle("is-active", state.render.preset === "studio");
  elements.renderPresetWarmButton.classList.toggle("is-active", state.render.preset === "warm");
  elements.renderPresetCoolButton.classList.toggle("is-active", state.render.preset === "cool");
  elements.renderPresetDramaticButton.classList.toggle("is-active", state.render.preset === "dramatic");
  elements.renderDetailSelect.value = String(state.render.detailMultiplier);
  elements.renderWidthInput.value = String(state.render.outputWidth);
  elements.renderHeightInput.value = String(state.render.outputHeight);
  elements.renderLockAspectInput.checked = state.render.lockAspect;
  elements.renderPreviewInput.checked = state.render.previewInViewport;
  elements.renderBackgroundSelect.value = state.render.background;
  elements.imageAdvancedControls.classList.toggle("is-hidden", !state.ui.imageAdvancedOpen);
  elements.modalImageAdvancedControls.classList.toggle("is-hidden", !state.ui.imageAdvancedOpen);
  elements.toggleImageAdvancedButton.textContent = state.ui.imageAdvancedOpen ? "Hide Advanced" : "Show Advanced";
  elements.modalToggleImageAdvancedButton.textContent = state.ui.imageAdvancedOpen ? "Hide Advanced" : "Show Advanced";

  updateImportOptionsVisibility();
  elements.toggleHelpersButton.textContent = state.ui.show3DHelpers ? "Hide Guides" : "Show Guides";
  syncTheme();
  syncImageTraceControls();
  syncRegionWaveSourcesToLoops();
  syncWaveSelectionSummary();
  syncSharedWaveSettingsPanel();
  renderImageTraceList();
  renderRegionWaveSourceList();
  renderSourceList();
  renderRegionList();
  syncStatus();
  syncRenderStatus();
  syncCanvasSizes();
  renderProfileCanvas();
  updateThreeSurface();
  syncProjectSummary();
  syncExportSummary();
  applyPreviewQuality();
}

function updateSurfaceSetting(key, value) {
  state.surface[key] = value;
  syncView();
}

function updateRenderSetting(key, value) {
  state.render[key] = value;
  syncView();
}

function setRenderPreset(preset) {
  state.render.preset = preset;
  syncView();
}

function updateRenderDimension(axis, rawValue) {
  const numericValue = Math.max(512, Math.round(Number(rawValue) || 0));
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    syncView();
    return;
  }

  if (axis === "width") {
    state.render.outputWidth = numericValue;
    if (state.render.lockAspect) {
      syncRenderAspectFromWidth();
    }
  } else {
    state.render.outputHeight = numericValue;
    if (state.render.lockAspect) {
      syncRenderAspectFromHeight();
    }
  }

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

  if (state.meta.pendingImportFile) {
    state.ui.status = `Updated import units for ${state.meta.pendingImportFile.name}. Click Import Selected File.`;
  }

  syncView();
}

function setPreviewUnits(nextUnits) {
  if (getPreviewUnits() === nextUnits) {
    return;
  }

  state.ui.previewUnits = nextUnits;
  state.ui.status = `Preview units set to ${nextUnits}.`;
  syncView();
}

function downloadJson(filename, payload) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function buildProjectPayload() {
  return {
    format: "wavythought-project-v1",
    savedAt: new Date().toISOString(),
    project: {
      loops: state.loops,
      sources: state.sources,
      importSettings: state.importSettings,
      surface: state.surface,
      render: state.render,
      ui: {
        theme: state.ui.theme,
        followSystemTheme: state.ui.followSystemTheme,
        previewUnits: state.ui.previewUnits,
        previewQuality: state.ui.previewQuality,
        imageAdvancedOpen: state.ui.imageAdvancedOpen,
      },
      meta: {
        importName: state.meta.importName,
        importKind: state.meta.importKind,
        sourceBounds: state.meta.sourceBounds,
        nativeSourceBounds: state.meta.nativeSourceBounds,
        sourceUnits: state.meta.sourceUnits,
      },
    },
  };
}

function loadProjectPayload(payload) {
  if (payload?.format !== "wavythought-project-v1" || !payload.project) {
    throw new Error("Unsupported project file.");
  }

  const fresh = createDefaultState();
  const project = payload.project;
  state.loops = project.loops || fresh.loops;
  state.sources = (project.sources || fresh.sources).map((source) => ({
    locked: false,
    hidden: false,
    ...source,
  }));
  state.importSettings = { ...fresh.importSettings, ...(project.importSettings || {}) };
  state.surface = { ...fresh.surface, ...(project.surface || {}) };
  state.render = { ...fresh.render, ...(project.render || {}) };
  state.ui = {
    ...fresh.ui,
    ...(project.ui || {}),
    selectedSourceId: null,
    selectedWaveSourceIds: [],
    placementMode: null,
    pendingCurvePoints: [],
    status: `Opened ${project.meta?.importName || "project"}.`,
  };
  state.meta.importName = project.meta?.importName || fresh.meta.importName;
  state.meta.importKind = "vector";
  state.meta.sourceBounds = project.meta?.sourceBounds || fresh.meta.sourceBounds;
  state.meta.nativeSourceBounds = project.meta?.nativeSourceBounds || state.meta.sourceBounds;
  state.meta.sourceUnits = project.meta?.sourceUnits || fresh.meta.sourceUnits;
  state.meta.importedFile = null;
  state.meta.pendingImportFile = null;
  state.meta.pendingImportKind = null;
  state.meta.importRequestId = 0;
  state.meta.imageTraceCandidates = [];
  state.meta.imageTraceSelection = { modes: {} };
  state.meta.imageTraceDraftSelection = { modes: {} };
  state.meta.hoveredTraceId = null;
  state.meta.imageTraceDirty = false;
  state.meta.imageTracePreview = null;
  state.meta.imageTraceRevision = 0;
  state.meta.imageTracePreviewRequestId = 0;
  state.meta.imageTraceAppliedSettings = { ...fresh.meta.imageTraceAppliedSettings };
  setSelectedHelperDescriptor(null);
  syncView();
}

function resetToSample() {
  const fresh = createDefaultState();
  state.loops = fresh.loops;
  state.sources = fresh.sources;
  state.surface = fresh.surface;
  state.render = fresh.render;
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
  state.meta.imageTraceDraftSelection = fresh.meta.imageTraceDraftSelection;
  state.meta.hoveredTraceId = fresh.meta.hoveredTraceId;
  state.meta.hoveredLoopId = fresh.meta.hoveredLoopId;
  state.meta.imageTraceDirty = fresh.meta.imageTraceDirty;
  state.meta.imageTraceRevision = fresh.meta.imageTraceRevision;
  state.meta.imageTracePreview = fresh.meta.imageTracePreview;
  state.meta.imageTracePreviewRequestId = fresh.meta.imageTracePreviewRequestId;
  state.meta.imageTraceAppliedSettings = fresh.meta.imageTraceAppliedSettings;
  state.importSettings.imageThreshold = fresh.importSettings.imageThreshold;
  state.importSettings.imageImportMode = fresh.importSettings.imageImportMode;
  state.importSettings.invertImage = fresh.importSettings.invertImage;
  state.importSettings.imageColorTolerance = fresh.importSettings.imageColorTolerance;
  state.importSettings.imageColorSamples = fresh.importSettings.imageColorSamples;
  state.importSettings.imagePhotoPrep = fresh.importSettings.imagePhotoPrep;
  state.importSettings.imageUpscaleBeforeTrace = fresh.importSettings.imageUpscaleBeforeTrace;
  state.importSettings.imageFlattenShading = fresh.importSettings.imageFlattenShading;
  state.importSettings.imageFlattenStrength = fresh.importSettings.imageFlattenStrength;
  state.importSettings.imageMinRegionArea = fresh.importSettings.imageMinRegionArea;
  state.importSettings.imageCornerSmoothing = fresh.importSettings.imageCornerSmoothing;
  state.importSettings.imagePathSimplification = fresh.importSettings.imagePathSimplification;
  state.importSettings.curveSamples = fresh.importSettings.curveSamples;
  state.importSettings.units = fresh.importSettings.units;
  state.importSettings.importWidth = fresh.importSettings.importWidth;
  state.importSettings.importHeight = fresh.importSettings.importHeight;
  state.importSettings.aspectLocked = fresh.importSettings.aspectLocked;
  state.ui.status = "Loaded the bundled sample profile.";
  elements.profileFileInput.value = "";
  state.ui.pendingCurvePoints = [];
  syncView();
  resetSurfaceView();
}

async function handleImport(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }
  stageImportFile(file);
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
    const imageMethodLabel =
      state.importSettings.imageImportMode === "segmentation"
        ? `Color regions mode detected ${state.meta.imageTraceCandidates.length} regions from ${state.importSettings.imageColorSamples} sampled colors at tolerance ${state.importSettings.imageColorTolerance}.`
        : `Threshold mode detected ${state.meta.imageTraceCandidates.length} regions at threshold ${state.importSettings.imageThreshold}.`;
    state.ui.status =
      imported.importKind === "image"
        ? `Imported ${file.name}. Trace v${state.meta.imageTraceRevision}. ${imageMethodLabel}`
        : `Imported ${file.name}. Largest loop is driving the surface; ${Math.max(imported.loops.length - 1, 0)} inner loop(s) are used as color regions.`;
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

  state.ui.pendingCurvePoints = [...state.ui.pendingCurvePoints, worldPoint];
  state.ui.status = `Added curve point ${state.ui.pendingCurvePoints.length}. Press Enter to finish the spline.`;
  syncView();
}

function finalizePendingCurveSource() {
  if (state.ui.placementMode !== "curve" || state.ui.pendingCurvePoints.length < 2) {
    return;
  }

  const curveCount = state.sources.filter((source) => source.type === "curve").length + 1;
  state.sources.push(createSource("curve", state.ui.pendingCurvePoints, curveCount));
  state.ui.pendingCurvePoints = [];
  state.ui.placementMode = null;
  state.ui.status = "Added a spline curve wave source.";
  syncView();
}

function syncImageTraceControls() {
  const presetMatches = {
    logo:
      state.importSettings.imageImportMode === "threshold" &&
      state.importSettings.imageThreshold === 150 &&
      state.importSettings.imageColorSamples === 6 &&
      !state.importSettings.imagePhotoPrep,
    lineart:
      state.importSettings.imageImportMode === "threshold" &&
      state.importSettings.imageThreshold === 128 &&
      state.importSettings.imageUpscaleBeforeTrace === 2 &&
      state.importSettings.imagePathSimplification === 0.5,
    photo:
      state.importSettings.imageImportMode === "segmentation" &&
      state.importSettings.imagePhotoPrep &&
      state.importSettings.imageFlattenShading,
  };
  elements.tracePresetLogoButton.classList.toggle("is-active", presetMatches.logo);
  elements.tracePresetLineArtButton.classList.toggle("is-active", presetMatches.lineart);
  elements.tracePresetPhotoButton.classList.toggle("is-active", presetMatches.photo);
  elements.modalTracePresetLogoButton.classList.toggle("is-active", presetMatches.logo);
  elements.modalTracePresetLineArtButton.classList.toggle("is-active", presetMatches.lineart);
  elements.modalTracePresetPhotoButton.classList.toggle("is-active", presetMatches.photo);
  elements.imageThresholdInput.value = String(state.importSettings.imageThreshold);
  elements.imageThresholdNumber.value = String(state.importSettings.imageThreshold);
  elements.modalImageThresholdInput.value = String(state.importSettings.imageThreshold);
  elements.modalImageThresholdNumber.value = String(state.importSettings.imageThreshold);
  elements.invertImageInput.checked = state.importSettings.invertImage;
  elements.modalInvertImageInput.checked = state.importSettings.invertImage;
  elements.imageColorToleranceInput.value = String(state.importSettings.imageColorTolerance);
  elements.imageColorToleranceNumber.value = String(state.importSettings.imageColorTolerance);
  elements.modalImageColorToleranceInput.value = String(state.importSettings.imageColorTolerance);
  elements.modalImageColorToleranceNumber.value = String(state.importSettings.imageColorTolerance);
  elements.imageColorSamplesInput.value = String(state.importSettings.imageColorSamples);
  elements.imageColorSamplesNumber.value = String(state.importSettings.imageColorSamples);
  elements.modalImageColorSamplesInput.value = String(state.importSettings.imageColorSamples);
  elements.modalImageColorSamplesNumber.value = String(state.importSettings.imageColorSamples);
  elements.imagePhotoPrepInput.checked = state.importSettings.imagePhotoPrep;
  elements.modalImagePhotoPrepInput.checked = state.importSettings.imagePhotoPrep;
  const upscaleMultiplier = Number(state.importSettings.imageUpscaleBeforeTrace) || 1;
  elements.imageUpscaleOffButton.classList.toggle("is-active", upscaleMultiplier === 1);
  elements.imageUpscale2xButton.classList.toggle("is-active", upscaleMultiplier === 2);
  elements.imageUpscale4xButton.classList.toggle("is-active", upscaleMultiplier === 4);
  elements.modalImageUpscaleOffButton.classList.toggle("is-active", upscaleMultiplier === 1);
  elements.modalImageUpscale2xButton.classList.toggle("is-active", upscaleMultiplier === 2);
  elements.modalImageUpscale4xButton.classList.toggle("is-active", upscaleMultiplier === 4);
  elements.imageFlattenShadingInput.checked = state.importSettings.imageFlattenShading;
  elements.modalImageFlattenShadingInput.checked = state.importSettings.imageFlattenShading;
  elements.imageFlattenStrengthInput.value = String(state.importSettings.imageFlattenStrength);
  elements.imageFlattenStrengthNumber.value = String(state.importSettings.imageFlattenStrength);
  elements.modalImageFlattenStrengthInput.value = String(state.importSettings.imageFlattenStrength);
  elements.modalImageFlattenStrengthNumber.value = String(state.importSettings.imageFlattenStrength);
  elements.imageFlattenStrengthInput.disabled = !state.importSettings.imageFlattenShading;
  elements.imageFlattenStrengthNumber.disabled = !state.importSettings.imageFlattenShading;
  elements.modalImageFlattenStrengthInput.disabled = !state.importSettings.imageFlattenShading;
  elements.modalImageFlattenStrengthNumber.disabled = !state.importSettings.imageFlattenShading;
  elements.imageMinRegionAreaInput.value = String(state.importSettings.imageMinRegionArea);
  elements.imageMinRegionAreaNumber.value = String(state.importSettings.imageMinRegionArea);
  elements.modalImageMinRegionAreaInput.value = String(state.importSettings.imageMinRegionArea);
  elements.modalImageMinRegionAreaNumber.value = String(state.importSettings.imageMinRegionArea);
  elements.imageCornerSmoothingInput.value = String(state.importSettings.imageCornerSmoothing);
  elements.imageCornerSmoothingNumber.value = String(state.importSettings.imageCornerSmoothing);
  elements.modalImageCornerSmoothingInput.value = String(state.importSettings.imageCornerSmoothing);
  elements.modalImageCornerSmoothingNumber.value = String(state.importSettings.imageCornerSmoothing);
  elements.imagePathSimplificationInput.value = String(state.importSettings.imagePathSimplification);
  elements.imagePathSimplificationNumber.value = String(state.importSettings.imagePathSimplification);
  elements.modalImagePathSimplificationInput.value = String(state.importSettings.imagePathSimplification);
  elements.modalImagePathSimplificationNumber.value = String(state.importSettings.imagePathSimplification);
  elements.retraceImageButton.disabled = !(state.meta.importedFile && state.meta.importKind === "image");
  elements.retraceImageButton.textContent = state.meta.imageTraceDirty ? "Retrace Image*" : "Retrace Image";
  elements.modalRetraceImageButton.disabled = !(state.meta.importedFile && state.meta.importKind === "image");
  elements.modalRetraceImageButton.textContent = state.meta.imageTraceDirty ? "Retrace Image*" : "Retrace Image";
  elements.finalizeTraceButton.disabled = !state.meta.imageTraceCandidates?.length;
  elements.toggleImageAdvancedButton.textContent = state.ui.imageAdvancedOpen ? "Hide Advanced" : "Show Advanced";
  elements.modalToggleImageAdvancedButton.textContent = state.ui.imageAdvancedOpen ? "Hide Advanced" : "Show Advanced";
  setImagePreviewModalOpen(state.ui.imagePreviewModalOpen);
  updateImportOptionsVisibility();
  syncImageTraceStatus();
  renderImageTracePreview();
}

function handleImageTraceSettingChange(reasonLabel) {
  if (state.meta.pendingImportFile && state.meta.pendingImportKind === "image") {
    state.ui.status = `Updated image trace settings for ${state.meta.pendingImportFile.name}. Click Import Selected File.`;
    syncImageTraceControls();
    syncStatus();
    refreshImageTracePreview();
    return;
  }
  if (state.meta.importedFile && state.meta.importKind === "image") {
    queueImageRetrace(reasonLabel);
    syncImageTraceControls();
    refreshImageTracePreview();
    return;
  }
  syncView();
}

function wireEvents() {
  elements.profileFileInput.addEventListener("change", handleImport);
  elements.profileDropZone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    elements.profileDropZone.classList.add("is-dragging");
  });
  elements.profileDropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.profileDropZone.classList.add("is-dragging");
  });
  elements.profileDropZone.addEventListener("dragleave", (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    elements.profileDropZone.classList.remove("is-dragging");
  });
  elements.profileDropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.profileDropZone.classList.remove("is-dragging");
    const [file] = event.dataTransfer?.files || [];
    if (!file) {
      return;
    }
    stageImportFile(file);
  });
  elements.importProfileButton.addEventListener("click", importPendingFile);
  elements.loadSampleButton.addEventListener("click", resetToSample);
  elements.saveProjectButton.addEventListener("click", () => {
    const safeName = (state.meta.importName || "wavythought-project").replace(/[^a-z0-9-_]+/gi, "-");
    downloadJson(`${safeName}.project.json`, buildProjectPayload());
  });
  elements.openProjectButton.addEventListener("click", () => {
    elements.openProjectInput.click();
  });
  elements.openProjectInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const payload = JSON.parse(await file.text());
      loadProjectPayload(payload);
    } catch (error) {
      state.ui.status = error instanceof Error ? error.message : "Failed to open project file.";
      syncStatus();
    } finally {
      elements.openProjectInput.value = "";
    }
  });
  elements.themeLightButton.addEventListener("click", () => {
    state.ui.theme = "light";
    state.ui.followSystemTheme = false;
    syncView();
  });
  elements.themeDarkButton.addEventListener("click", () => {
    state.ui.theme = "dark";
    state.ui.followSystemTheme = false;
    syncView();
  });
  elements.imageImportModeThresholdButton.addEventListener("click", () => {
    setImageImportMode("threshold");
  });
  elements.imageImportModeSegmentationButton.addEventListener("click", () => {
    setImageImportMode("segmentation");
  });
  elements.tracePresetLogoButton.addEventListener("click", () => applyTracePreset("logo"));
  elements.tracePresetLineArtButton.addEventListener("click", () => applyTracePreset("lineart"));
  elements.tracePresetPhotoButton.addEventListener("click", () => applyTracePreset("photo"));
  elements.toggleImageAdvancedButton.addEventListener("click", toggleImageAdvanced);
  elements.modalImageImportModeThresholdButton.addEventListener("click", () => {
    setImageImportMode("threshold");
  });
  elements.modalImageImportModeSegmentationButton.addEventListener("click", () => {
    setImageImportMode("segmentation");
  });
  elements.modalTracePresetLogoButton.addEventListener("click", () => applyTracePreset("logo"));
  elements.modalTracePresetLineArtButton.addEventListener("click", () => applyTracePreset("lineart"));
  elements.modalTracePresetPhotoButton.addEventListener("click", () => applyTracePreset("photo"));
  elements.modalToggleImageAdvancedButton.addEventListener("click", toggleImageAdvanced);
  [elements.imageColorPreviewCard, elements.imageThresholdPreviewCard].forEach((trigger) => {
    trigger.addEventListener("click", () => {
      if ((state.meta.pendingImportKind || state.meta.importKind) !== "image") {
        return;
      }
      setImagePreviewModalOpen(true);
    });
  });
  elements.closeImagePreviewModalButton.addEventListener("click", () => {
    setImagePreviewModalOpen(false);
  });
  elements.imagePreviewModal.addEventListener("click", (event) => {
    if (event.target === elements.imagePreviewModal) {
      setImagePreviewModalOpen(false);
    }
  });
  bindPairedControl(elements.sharedAmplitudeInput, elements.sharedAmplitudeNumber, (value) => {
    applySharedWaveSetting("amplitude", Number(value));
  });
  bindPairedControl(elements.sharedFrequencyInput, elements.sharedFrequencyNumber, (value) => {
    applySharedWaveSetting("frequency", Number(value));
  });
  bindPairedControl(elements.sharedPhaseInput, elements.sharedPhaseNumber, (value) => {
    applySharedWaveSetting("phase", Number(value));
  });
  bindPairedControl(elements.sharedDecayInput, elements.sharedDecayNumber, (value) => {
    applySharedWaveSetting("decay", Number(value));
  });
  bindPairedControl(elements.sharedReachInput, elements.sharedReachNumber, (value) => {
    applySharedWaveSetting("reach", Number(value));
  });
  elements.sharedContinuationSelect.addEventListener("change", (event) => {
    applySharedWaveSetting("continuation", event.target.value);
  });
  elements.sharedOperationSelect.addEventListener("change", (event) => {
    applySharedWaveSetting("operation", event.target.value);
  });
  elements.normalizeWavesInput.addEventListener("change", (event) => {
    updateSurfaceSetting("normalizeCombinedHeight", event.target.checked);
  });
  elements.clearWaveSelectionButton.addEventListener("click", () => {
    state.ui.selectedWaveSourceIds = [];
    setSelectedHelperDescriptor(null);
    state.ui.status = "Cleared wave source selection.";
    syncWaveUiOnly();
  });

  const applyImageThreshold = (value) => {
    state.importSettings.imageThreshold = Number(value);
    handleImageTraceSettingChange("Updated image threshold");
  };
  bindPairedControl(elements.imageThresholdInput, elements.imageThresholdNumber, applyImageThreshold);
  bindPairedControl(elements.modalImageThresholdInput, elements.modalImageThresholdNumber, applyImageThreshold);

  const applyColorTolerance = (value) => {
    state.importSettings.imageColorTolerance = Math.max(0, Math.round(Number(value) || 0));
    handleImageTraceSettingChange("Updated color merge tolerance");
  };
  bindPairedControl(elements.imageColorToleranceInput, elements.imageColorToleranceNumber, applyColorTolerance);
  bindPairedControl(elements.modalImageColorToleranceInput, elements.modalImageColorToleranceNumber, applyColorTolerance);

  const applyColorSamples = (value) => {
    state.importSettings.imageColorSamples = Math.max(1, Math.round(Number(value) || 1));
    handleImageTraceSettingChange("Updated image color samples");
  };
  bindPairedControl(elements.imageColorSamplesInput, elements.imageColorSamplesNumber, applyColorSamples);
  bindPairedControl(elements.modalImageColorSamplesInput, elements.modalImageColorSamplesNumber, applyColorSamples);

  const applyPhotoPrep = (checked) => {
    state.importSettings.imagePhotoPrep = checked;
    handleImageTraceSettingChange("Updated photo trace prep");
  };
  elements.imagePhotoPrepInput.addEventListener("change", (event) => {
    applyPhotoPrep(event.target.checked);
  });
  elements.modalImagePhotoPrepInput.addEventListener("change", (event) => {
    applyPhotoPrep(event.target.checked);
  });

  const applyUpscaleBeforeTrace = (multiplier) => {
    state.importSettings.imageUpscaleBeforeTrace = multiplier;
    handleImageTraceSettingChange("Updated trace upscale");
  };
  [elements.imageUpscaleOffButton, elements.modalImageUpscaleOffButton].forEach((button) => {
    button.addEventListener("click", () => {
      applyUpscaleBeforeTrace(1);
    });
  });
  [elements.imageUpscale2xButton, elements.modalImageUpscale2xButton].forEach((button) => {
    button.addEventListener("click", () => {
      applyUpscaleBeforeTrace(2);
    });
  });
  [elements.imageUpscale4xButton, elements.modalImageUpscale4xButton].forEach((button) => {
    button.addEventListener("click", () => {
      applyUpscaleBeforeTrace(4);
    });
  });

  const applyFlattenStrength = (value) => {
    state.importSettings.imageFlattenStrength = Math.min(1, Math.max(0, Number(value) || 0));
    handleImageTraceSettingChange("Updated flatten shading strength");
  };
  bindPairedControl(elements.imageFlattenStrengthInput, elements.imageFlattenStrengthNumber, applyFlattenStrength);
  bindPairedControl(
    elements.modalImageFlattenStrengthInput,
    elements.modalImageFlattenStrengthNumber,
    applyFlattenStrength,
  );

  const applyFlattenShading = (checked) => {
    state.importSettings.imageFlattenShading = checked;
    handleImageTraceSettingChange("Updated flatten shading");
  };
  elements.imageFlattenShadingInput.addEventListener("change", (event) => {
    applyFlattenShading(event.target.checked);
  });
  elements.modalImageFlattenShadingInput.addEventListener("change", (event) => {
    applyFlattenShading(event.target.checked);
  });

  const applyMinRegionArea = (value) => {
    state.importSettings.imageMinRegionArea = Math.max(0, Number(value) || 0);
    handleImageTraceSettingChange("Updated minimum region area");
  };
  bindPairedControl(elements.imageMinRegionAreaInput, elements.imageMinRegionAreaNumber, applyMinRegionArea);
  bindPairedControl(elements.modalImageMinRegionAreaInput, elements.modalImageMinRegionAreaNumber, applyMinRegionArea);

  const applyCornerSmoothing = (value) => {
    state.importSettings.imageCornerSmoothing = Math.max(0, Math.round(Number(value) || 0));
    handleImageTraceSettingChange("Updated corner smoothing");
  };
  bindPairedControl(elements.imageCornerSmoothingInput, elements.imageCornerSmoothingNumber, applyCornerSmoothing);
  bindPairedControl(elements.modalImageCornerSmoothingInput, elements.modalImageCornerSmoothingNumber, applyCornerSmoothing);

  const applyPathSimplification = (value) => {
    state.importSettings.imagePathSimplification = Math.max(0, Number(value) || 0);
    handleImageTraceSettingChange("Updated path simplification");
  };
  bindPairedControl(elements.imagePathSimplificationInput, elements.imagePathSimplificationNumber, applyPathSimplification);
  bindPairedControl(
    elements.modalImagePathSimplificationInput,
    elements.modalImagePathSimplificationNumber,
    applyPathSimplification,
  );

  const applyInvertImage = (checked) => {
    state.importSettings.invertImage = checked;
    handleImageTraceSettingChange("Updated image trace");
  };
  elements.invertImageInput.addEventListener("change", (event) => {
    applyInvertImage(event.target.checked);
  });
  elements.modalInvertImageInput.addEventListener("change", (event) => {
    applyInvertImage(event.target.checked);
  });
  elements.retraceImageButton.addEventListener("click", () => {
    if (!state.meta.importedFile || state.meta.importKind !== "image") {
      return;
    }
    refreshImportedProfile("Retraced image");
  });
  elements.modalRetraceImageButton.addEventListener("click", () => {
    if (!state.meta.importedFile || state.meta.importKind !== "image") {
      return;
    }
    refreshImportedProfile("Retraced image");
  });
  elements.applyTraceRegionsButton.addEventListener("click", () => {
    if (!state.meta.imageTraceCandidates?.length) {
      return;
    }
    applyImageTraceSelection(state.meta.imageTraceDraftSelection);
    state.ui.status = "Applied trace region changes.";
    syncView();
  });
  elements.finalizeTraceButton.addEventListener("click", () => {
    if (!state.meta.imageTraceCandidates?.length) {
      return;
    }
    finalizeTraceSelection();
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
  elements.previewUnitsMmButton.addEventListener("click", () => setPreviewUnits("mm"));
  elements.previewUnitsInButton.addEventListener("click", () => setPreviewUnits("in"));
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
  elements.previewQualityLowButton.addEventListener("click", () => {
    state.ui.previewQuality = "low";
    syncView();
  });
  elements.previewQualityMediumButton.addEventListener("click", () => {
    state.ui.previewQuality = "medium";
    syncView();
  });
  elements.previewQualityHighButton.addEventListener("click", () => {
    state.ui.previewQuality = "high";
    syncView();
  });
  bindPairedControl(elements.heightScaleInput, elements.heightScaleNumber, (value) => {
    updateSurfaceSetting("heightScale", Number(value));
  }, (value) => Number(value).toFixed(2));
  bindPairedControl(elements.edgeFadeInput, elements.edgeFadeNumber, (value) => {
    updateSurfaceSetting("edgeFade", Number(value));
  }, (value) => Number(value).toFixed(2));
  bindPairedControl(elements.internalEdgeFadeInput, elements.internalEdgeFadeNumber, (value) => {
    updateSurfaceSetting("internalEdgeFade", Number(value));
  }, (value) => Number(value).toFixed(2));
  elements.edgeFadeEnabledInput.addEventListener("change", (event) => {
    updateSurfaceSetting("edgeFadeEnabled", event.target.checked);
  });
  elements.internalEdgeFadeEnabledInput.addEventListener("change", (event) => {
    updateSurfaceSetting("internalEdgeFadeEnabled", event.target.checked);
  });
  elements.showSurfaceResolutionInput.addEventListener("change", (event) => {
    updateSurfaceSetting("showResolutionEdges", event.target.checked);
  });
  elements.woodToggleInput.addEventListener("change", (event) => {
    updateSurfaceSetting("woodEnabled", event.target.checked);
  });
  bindPairedControl(elements.grainScaleInput, elements.grainScaleNumber, (value) => {
    updateSurfaceSetting("grainScale", Number(value));
  }, (value) => Number(value).toFixed(2));
  bindPairedControl(elements.grainNoiseInput, elements.grainNoiseNumber, (value) => {
    updateSurfaceSetting("grainNoise", Number(value));
  }, (value) => Number(value).toFixed(2));
  bindPairedControl(elements.grainLayerSizeInput, elements.grainLayerSizeNumber, (value) => {
    updateSurfaceSetting("grainLayerSize", Number(value));
  }, (value) => Number(value).toFixed(2));
  elements.grainAxisXButton.addEventListener("click", () => {
    updateSurfaceSetting("grainAxis", "x");
  });
  elements.grainAxisYButton.addEventListener("click", () => {
    updateSurfaceSetting("grainAxis", "y");
  });
  elements.grainAxisZButton.addEventListener("click", () => {
    updateSurfaceSetting("grainAxis", "z");
  });
  elements.renderPresetStudioButton.addEventListener("click", () => {
    setRenderPreset("studio");
  });
  elements.renderPresetWarmButton.addEventListener("click", () => {
    setRenderPreset("warm");
  });
  elements.renderPresetCoolButton.addEventListener("click", () => {
    setRenderPreset("cool");
  });
  elements.renderPresetDramaticButton.addEventListener("click", () => {
    setRenderPreset("dramatic");
  });
  elements.renderDetailSelect.addEventListener("change", (event) => {
    updateRenderSetting("detailMultiplier", Number(event.target.value));
  });
  elements.renderBackgroundSelect.addEventListener("change", (event) => {
    updateRenderSetting("background", event.target.value);
  });
  elements.renderLockAspectInput.addEventListener("change", (event) => {
    state.render.lockAspect = event.target.checked;
    if (state.render.lockAspect) {
      syncRenderAspectFromWidth();
    }
    syncView();
  });
  elements.renderPreviewInput.addEventListener("change", (event) => {
    updateRenderSetting("previewInViewport", event.target.checked);
  });
  elements.renderWidthInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    updateRenderDimension("width", event.target.value);
  });
  elements.renderWidthInput.addEventListener("blur", () => {
    elements.renderWidthInput.value = String(state.render.outputWidth);
  });
  elements.renderHeightInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    updateRenderDimension("height", event.target.value);
  });
  elements.renderHeightInput.addEventListener("blur", () => {
    elements.renderHeightInput.value = String(state.render.outputHeight);
  });
  elements.renderStillButton.addEventListener("click", () => {
    renderStillImage();
  });

  elements.addPointSourceButton.addEventListener("click", () => {
    state.ui.placementMode = "point";
    state.ui.pendingCurvePoints = [];
    state.ui.status = "Placing a new point source.";
    syncStatus();
  });

  elements.addCurveSourceButton.addEventListener("click", () => {
    state.ui.placementMode = "curve";
    state.ui.pendingCurvePoints = [];
    state.ui.status = "Placing a new spline curve source.";
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
  elements.zoomExtentsButton.addEventListener("click", zoomExtentsSurfaceView);
  elements.toggleHelpersButton.addEventListener("click", () => {
    state.ui.show3DHelpers = !state.ui.show3DHelpers;
    syncView();
  });

  elements.exportStlButton.addEventListener("click", () => {
    exportStlMesh(buildExportQuads(state, currentSurfaceGrid), state);
  });
  elements.exportObjButton.addEventListener("click", () => {
    exportObjMesh(buildExportQuads(state, currentSurfaceGrid), state);
  });
  elements.exportJsonButton.addEventListener("click", () => {
    exportSurfaceJson(buildExportQuads(state, currentSurfaceGrid), state);
  });

  window.addEventListener("resize", () => {
    syncCanvasSizes();
    clampFloatingProfileCard();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.ui.imagePreviewModalOpen) {
      setImagePreviewModalOpen(false);
      return;
    }
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    if (["input", "select", "textarea", "button"].includes(activeTag)) {
      return;
    }
    if (event.key === "Enter") {
      finalizePendingCurveSource();
      return;
    }
    if (event.key === "Escape" && state.ui.placementMode === "curve") {
      state.ui.pendingCurvePoints = [];
      state.ui.placementMode = null;
      state.ui.status = "Cancelled curve source placement.";
      syncView();
    }
  });
}

state.ui.theme = getPreferredTheme();
initThree();
initFloatingProfileCard();
initSidebarSplitter();
initCollapsiblePanels();
wireEvents();
systemThemeMedia.addEventListener("change", () => {
  if (state.ui.followSystemTheme) {
    syncView();
  }
});
syncView();
resetSurfaceView();
