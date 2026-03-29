import { buildRoundedRectLoop, createEllipseLoop } from "./geometry.js";
import { speciesPresets } from "./materials.js";

let nextId = 1;

function makeId(prefix) {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

function createSampleLoops() {
  const outer = buildRoundedRectLoop(150, 150, 18, 72);
  const innerA = createEllipseLoop(-35, -4, 24, 18, 42);
  const innerB = createEllipseLoop(32, 16, 20, 14, 38);

  return [
    {
      id: makeId("loop"),
      label: "Outer Profile",
      role: "outer",
      points: outer,
      species: "walnut",
    },
    {
      id: makeId("loop"),
      label: "Region 1",
      role: "inner",
      points: innerA,
      species: "oak",
    },
    {
      id: makeId("loop"),
      label: "Region 2",
      role: "inner",
      points: innerB,
      species: "ash",
    },
  ];
}

function createDefaultSources() {
  return [
    {
      id: makeId("source"),
      type: "point",
      label: "Point Source 1",
      operation: "add",
      amplitude: 1.1,
      frequency: 0.018,
      phase: 0,
      decay: 0.018,
      reach: 92,
      continuation: "damped",
      points: [{ x: -38, y: 18 }],
    },
    {
      id: makeId("source"),
      type: "curve",
      label: "Curve Source 1",
      operation: "add",
      amplitude: 0.72,
      frequency: 0.026,
      phase: 0.5,
      decay: 0.01,
      reach: 110,
      continuation: "sustain",
      points: [
        { x: -12, y: -28 },
        { x: 42, y: 30 },
      ],
    },
  ];
}

function getSampleBounds() {
  return {
    width: 150,
    height: 150,
  };
}

export function createDefaultState() {
  return {
    loops: createSampleLoops(),
    sources: createDefaultSources(),
    importSettings: {
      imageImportMode: "threshold",
      imageThreshold: 140,
      invertImage: false,
      imageColorSamples: 8,
      imageColorTolerance: 24,
      imageMinRegionArea: 0.12,
      imageCornerSmoothing: 1,
      imagePathSimplification: 0.6,
      curveSamples: 96,
      units: "mm",
      importWidth: 150,
      importHeight: 150,
      aspectLocked: true,
    },
    surface: {
      resolution: 120,
      heightScale: 7.5,
      edgeFade: 12,
      internalEdgeFade: 6,
      edgeFadeAll: false,
      normalizeCombinedHeight: false,
      showResolutionEdges: false,
      woodEnabled: false,
      species: "walnut",
      grainScale: 12,
      grainNoise: 1.35,
      grainLayerSize: 4,
      grainAxis: "y",
    },
    render: {
      preset: "studio",
      detailMultiplier: 1.5,
      outputWidth: 2400,
      outputHeight: 1350,
      lockAspect: true,
      previewInViewport: false,
      background: "theme",
    },
    ui: {
      placementMode: null,
      pendingCurvePoints: [],
      selectedSourceId: null,
      selectedWaveSourceIds: [],
      status: "Using the default sample profile until you import a file.",
      renderStatus: "Uses the current camera view and exports a high-resolution still.",
      show3DHelpers: true,
      theme: "light",
      followSystemTheme: true,
      imagePreviewModalOpen: false,
    },
    meta: {
      importName: "Sample profile",
      speciesList: Object.keys(speciesPresets),
      importedFile: null,
      pendingImportFile: null,
      pendingImportKind: null,
      importRequestId: 0,
      importKind: "vector",
      sourceBounds: getSampleBounds(),
      nativeSourceBounds: getSampleBounds(),
      sourceUnits: "mm",
      imageTraceCandidates: [],
      imageTraceSelection: {
        modes: {},
      },
      imageTraceDraftSelection: {
        modes: {},
      },
      hoveredTraceId: null,
      imageTraceDirty: false,
      imageTraceRevision: 0,
      imageTracePreview: null,
      imageTracePreviewRequestId: 0,
      imageTraceAppliedSettings: {
        mode: "threshold",
        threshold: 140,
        invert: false,
        colorSamples: 8,
        colorTolerance: 24,
        minRegionArea: 0.12,
        cornerSmoothing: 1,
        pathSimplification: 0.6,
      },
      waveNormalizationFactor: 1,
    },
  };
}

export function createSource(type, pointSet, count) {
  return {
    id: makeId("source"),
    type,
    label: `${type === "point" ? "Point Source" : "Curve Source"} ${count}`,
    operation: "add",
    amplitude: 0.8,
    frequency: type === "point" ? 0.02 : 0.026,
    phase: 0,
    decay: 0.014,
    reach: 80,
    continuation: "damped",
    points: pointSet,
  };
}

export function assignLoopMetadata(rawLoops) {
  if (!rawLoops.length) {
    return createSampleLoops();
  }

  const palette = ["oak", "ash", "maple", "cherry", "padauk", "purpleheart"];
  return rawLoops.map((loop, index) => ({
    id: makeId("loop"),
    label: index === 0 ? "Outer Profile" : `Region ${index}`,
    role: index === 0 ? "outer" : "inner",
    points: loop,
    species: index === 0 ? "walnut" : palette[(index - 1) % palette.length],
  }));
}
