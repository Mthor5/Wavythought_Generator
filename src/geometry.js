const EPSILON = 1e-6;

export function buildRoundedRectLoop(width, height, radius, segments) {
  const clampedRadius = Math.min(radius, width * 0.5, height * 0.5);
  const cornerSegments = Math.max(4, Math.floor(segments / 4));
  const points = [];
  const corners = [
    { cx: width * 0.5 - clampedRadius, cy: height * 0.5 - clampedRadius, start: 0 },
    { cx: -width * 0.5 + clampedRadius, cy: height * 0.5 - clampedRadius, start: Math.PI * 0.5 },
    { cx: -width * 0.5 + clampedRadius, cy: -height * 0.5 + clampedRadius, start: Math.PI },
    { cx: width * 0.5 - clampedRadius, cy: -height * 0.5 + clampedRadius, start: Math.PI * 1.5 },
  ];

  corners.forEach((corner, cornerIndex) => {
    for (let step = 0; step < cornerSegments; step += 1) {
      const t = step / cornerSegments;
      const angle = corner.start + t * Math.PI * 0.5;
      points.push({
        x: corner.cx + Math.cos(angle) * clampedRadius,
        y: corner.cy + Math.sin(angle) * clampedRadius,
      });
    }

    if (cornerIndex === corners.length - 1) {
      points.push({
        x: width * 0.5,
        y: height * 0.5 - clampedRadius,
      });
    }
  });

  return points;
}

export function createEllipseLoop(cx, cy, rx, ry, segments) {
  const points = [];
  for (let step = 0; step < segments; step += 1) {
    const angle = (step / segments) * Math.PI * 2;
    points.push({
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
    });
  }
  return points;
}

export function polygonArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return area * 0.5;
}

export function sortLoopsForSurface(loops) {
  if (!loops.length) {
    return [];
  }

  const cloned = loops.map((loop) => loop.slice());
  cloned.sort((left, right) => Math.abs(polygonArea(right)) - Math.abs(polygonArea(left)));
  return cloned;
}

export function normalizeLoops(rawLoops) {
  const loops = sortLoopsForSurface(rawLoops).filter((loop) => loop.length >= 3);
  if (!loops.length) {
    return [];
  }

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

  const width = Math.max(maxX - minX, EPSILON);
  const height = Math.max(maxY - minY, EPSILON);
  const scale = 2 / Math.max(width, height);
  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;

  return loops.map((loop) =>
    loop.map((point) => ({
      x: (point.x - cx) * scale,
      y: (point.y - cy) * scale,
    })),
  );
}

export function getLoopBounds(loops) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  loops.forEach((loop) => {
    loop.points.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(maxX - minX, EPSILON),
    height: Math.max(maxY - minY, EPSILON),
  };
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index];
    const prior = polygon[previous];
    const intersects =
      current.y > point.y !== prior.y > point.y &&
      point.x <
        ((prior.x - current.x) * (point.y - current.y)) / ((prior.y - current.y) || EPSILON) + current.x;

    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

export function distanceToSegment(point, segmentStart, segmentEnd) {
  const dx = segmentEnd.x - segmentStart.x;
  const dy = segmentEnd.y - segmentStart.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < EPSILON) {
    return Math.hypot(point.x - segmentStart.x, point.y - segmentStart.y);
  }

  const t = clamp(
    ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) / lengthSquared,
    0,
    1,
  );

  const projection = {
    x: segmentStart.x + dx * t,
    y: segmentStart.y + dy * t,
  };

  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

export function distanceToPolyline(point, polyline, closed = false) {
  if (polyline.length === 1) {
    return Math.hypot(point.x - polyline[0].x, point.y - polyline[0].y);
  }

  let distance = Infinity;
  const lastIndex = closed ? polyline.length : polyline.length - 1;
  for (let index = 0; index < lastIndex; index += 1) {
    const start = polyline[index];
    const end = polyline[(index + 1) % polyline.length];
    distance = Math.min(distance, distanceToSegment(point, start, end));
  }
  return distance;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function smoothstep(edge0, edge1, value) {
  if (Math.abs(edge1 - edge0) < EPSILON) {
    return value >= edge1 ? 1 : 0;
  }
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function sampleCatmullRomPoint(points, segmentIndex, t) {
  const p0 = points[Math.max(0, segmentIndex - 1)];
  const p1 = points[segmentIndex];
  const p2 = points[Math.min(points.length - 1, segmentIndex + 1)];
  const p3 = points[Math.min(points.length - 1, segmentIndex + 2)];
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x:
      0.5 *
      ((2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      ((2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

export function sampleCurveSourcePolyline(points, sampleCount = 48) {
  if (points.length <= 2) {
    return points.slice();
  }

  const segmentCount = points.length - 1;
  const stepsPerSegment = Math.max(6, Math.round(sampleCount / segmentCount));
  const samples = [points[0]];

  for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
    for (let step = 1; step <= stepsPerSegment; step += 1) {
      const t = step / stepsPerSegment;
      samples.push(sampleCatmullRomPoint(points, segmentIndex, t));
    }
  }

  return samples;
}

function sampleSourceValue(source, point) {
  const distance =
    source.type === "point"
      ? Math.hypot(point.x - source.points[0].x, point.y - source.points[0].y)
      : distanceToPolyline(point, sampleCurveSourcePolyline(source.points), false);

  const phase = distance * source.frequency * Math.PI * 2 + source.phase;
  const rawWave = Math.sin(phase) * source.amplitude;
  const reachMask = source.reach > 0 ? 1 - smoothstep(source.reach * 0.88, source.reach, distance) : 1;

  let continuationMask = 1;
  if (source.continuation === "damped") {
    continuationMask = Math.exp(-distance * Math.max(source.decay, 0));
  } else if (source.continuation === "sustain") {
    continuationMask = 1 / (1 + distance * Math.max(source.decay, 0) * 0.25);
  } else if (source.continuation === "clipped") {
    continuationMask = distance <= source.reach ? 1 : 0;
  }

  return rawWave * reachMask * continuationMask;
}

function combineValues(accumulator, contribution, operation) {
  if (operation === "subtract") {
    return accumulator - contribution;
  }
  if (operation === "multiply") {
    return accumulator === 0 ? contribution : accumulator * (1 + contribution);
  }
  return accumulator + contribution;
}

function getAdditiveSurfaceLoops(state) {
  return state.loops.filter((loop) => loop.role === "outer" || loop.surfaceMode === "add");
}

function getExteriorAdditiveSurfaceLoops(state) {
  return state.loops.filter(
    (loop) => loop.role === "outer" || (loop.surfaceMode === "add" && loop.role !== "inner"),
  );
}

function getSubtractiveSurfaceLoops(state) {
  return state.loops.filter((loop) => loop.surfaceMode === "subtract");
}

function getInteriorBreakLoops(state) {
  return state.loops.filter((loop) => loop.role === "inner");
}

function pointInsideAdditiveSurface(state, point) {
  return getExteriorAdditiveSurfaceLoops(state).some((loop) => pointInPolygon(point, loop.points));
}

function pointInsideSurface(state, point) {
  const additiveLoops = getAdditiveSurfaceLoops(state);
  if (!additiveLoops.length) {
    return false;
  }

  const insideAdditive = additiveLoops.some((loop) => pointInPolygon(point, loop.points));
  if (!insideAdditive) {
    return false;
  }

  return !getSubtractiveSurfaceLoops(state).some((loop) => pointInPolygon(point, loop.points));
}

function distanceToSurfaceBoundary(state, point) {
  const boundaryDistances = [
    ...getAdditiveSurfaceLoops(state),
    ...getSubtractiveSurfaceLoops(state),
    ...getInteriorBreakLoops(state),
  ].map((loop) => distanceToPolyline(point, loop.points, true));

  return boundaryDistances.length ? Math.min(...boundaryDistances) : 0;
}

function distanceToExteriorBoundary(state, point) {
  const exteriorLoops = [
    ...getExteriorAdditiveSurfaceLoops(state),
    ...getSubtractiveSurfaceLoops(state).filter(
      (loop) => !loop.points.every((candidatePoint) => pointInsideAdditiveSurface(state, candidatePoint)),
    ),
  ];
  const boundaryDistances = exteriorLoops
    .map((loop) => distanceToPolyline(point, loop.points, true));

  return boundaryDistances.length ? Math.min(...boundaryDistances) : 0;
}

export function sampleHeight(state, point) {
  if (!pointInsideSurface(state, point)) {
    return 0;
  }

  let accumulated = 0;
  state.sources.forEach((source) => {
    accumulated = combineValues(accumulated, sampleSourceValue(source, point), source.operation);
  });

  const edgeDistance = state.surface.edgeFadeAll
    ? distanceToSurfaceBoundary(state, point)
    : distanceToExteriorBoundary(state, point);
  const edgeMask =
    state.surface.edgeFade > 0
      ? smoothstep(0, state.surface.edgeFade, edgeDistance)
      : 1;

  return accumulated * state.surface.heightScale * edgeMask;
}

export function buildSurfaceGrid(state) {
  const bounds = getLoopBounds(state.loops);
  const aspect = bounds.width / bounds.height;
  const columns = Math.max(18, Math.round(state.surface.resolution * aspect));
  const rows = Math.max(18, state.surface.resolution);
  const positions = [];
  const uvs = [];
  const indices = [];
  const vertices = [];
  let minHeight = Infinity;
  let maxHeight = -Infinity;

  for (let yIndex = 0; yIndex <= rows; yIndex += 1) {
    const v = yIndex / rows;
    const y = bounds.minY + bounds.height * v;
    for (let xIndex = 0; xIndex <= columns; xIndex += 1) {
      const u = xIndex / columns;
      const x = bounds.minX + bounds.width * u;
      const point = { x, y };
      const inside = pointInsideSurface(state, point);
      const height = inside ? sampleHeight(state, point) : 0;
      positions.push(x, y, height);
      uvs.push(u, v);
      vertices.push({ x, y, z: height, inside });
      minHeight = Math.min(minHeight, height);
      maxHeight = Math.max(maxHeight, height);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + 1;
      const c = a + columns + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  return {
    bounds,
    columns,
    rows,
    positions,
    uvs,
    indices,
    vertices,
    minHeight: Number.isFinite(minHeight) ? minHeight : 0,
    maxHeight: Number.isFinite(maxHeight) ? maxHeight : 0,
  };
}

export function buildExportQuads(state, surfaceGrid) {
  const quads = [];
  const { columns, rows, vertices } = surfaceGrid;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + 1;
      const c = a + columns + 1;
      const d = c + 1;
      const v0 = vertices[a];
      const v1 = vertices[b];
      const v2 = vertices[d];
      const v3 = vertices[c];
      if (v0.inside && v1.inside && v2.inside && v3.inside) {
        quads.push([a, b, d, c]);
      }
    }
  }

  return {
    vertices,
    quads,
    bounds: surfaceGrid.bounds,
    meta: {
      sourceCount: state.sources.length,
      regionCount: state.loops.filter((loop) => loop.role === "inner").length,
    },
  };
}

export function toCanvasPoint(point, bounds, width, height, padding = 36) {
  const scale = Math.min(
    (width - padding * 2) / bounds.width,
    (height - padding * 2) / bounds.height,
  );
  const offsetX = (width - bounds.width * scale) * 0.5;
  const offsetY = (height - bounds.height * scale) * 0.5;

  return {
    x: offsetX + (point.x - bounds.minX) * scale,
    y: height - (offsetY + (point.y - bounds.minY) * scale),
  };
}

export function toWorldPoint(point, bounds, width, height, padding = 36) {
  const scale = Math.min(
    (width - padding * 2) / bounds.width,
    (height - padding * 2) / bounds.height,
  );
  const offsetX = (width - bounds.width * scale) * 0.5;
  const offsetY = (height - bounds.height * scale) * 0.5;

  return {
    x: bounds.minX + (point.x - offsetX) / scale,
    y: bounds.minY + (height - point.y - offsetY) / scale,
  };
}
