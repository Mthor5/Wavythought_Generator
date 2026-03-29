import { normalizeLoops, polygonArea } from "./geometry.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const CLOSE_DISTANCE_EPSILON = 1e-3;

function getRawBounds(loops) {
  if (!loops.length) {
    return { width: 0, height: 0 };
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

  return {
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

function parsePointsAttribute(value) {
  return value
    .trim()
    .split(/[\s,]+/)
    .reduce((points, token, index, tokens) => {
      if (index % 2 === 0 && tokens[index + 1] !== undefined) {
        points.push({
          x: Number(token),
          y: Number(tokens[index + 1]),
        });
      }
      return points;
    }, []);
}

function sampleSvgPath(pathElement, sampleCount) {
  const totalLength = pathElement.getTotalLength();
  const points = [];
  for (let step = 0; step < sampleCount; step += 1) {
    const point = pathElement.getPointAtLength((step / sampleCount) * totalLength);
    points.push({ x: point.x, y: point.y });
  }
  return points;
}

function isClosedSvgPath(pathElement) {
  const d = pathElement.getAttribute("d") || "";
  if (/[zZ]/.test(d)) {
    return true;
  }

  const totalLength = pathElement.getTotalLength();
  const start = pathElement.getPointAtLength(0);
  const end = pathElement.getPointAtLength(totalLength);
  return distanceBetween(start, end) <= CLOSE_DISTANCE_EPSILON;
}

function sampleCircle(cx, cy, rx, ry, sampleCount) {
  const points = [];
  for (let step = 0; step < sampleCount; step += 1) {
    const angle = (step / sampleCount) * Math.PI * 2;
    points.push({
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
    });
  }
  return points;
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function closeLoop(points, tolerance = CLOSE_DISTANCE_EPSILON) {
  if (points.length < 3) {
    return null;
  }

  const closed = points.map((point) => ({ x: point.x, y: point.y }));
  const first = closed[0];
  const last = closed[closed.length - 1];

  if (distanceBetween(first, last) <= tolerance) {
    closed[closed.length - 1] = { ...first };
  }

  return closed;
}

function maybeClosedLoop(points, explicitClosed = false, tolerance = CLOSE_DISTANCE_EPSILON) {
  if (points.length < 3) {
    return null;
  }

  const first = points[0];
  const last = points[points.length - 1];
  if (explicitClosed || distanceBetween(first, last) <= tolerance) {
    return closeLoop(points, tolerance);
  }

  return null;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resampleClosedLoop(points, sampleCount) {
  if (points.length < 3 || sampleCount <= 3) {
    return points;
  }

  const edges = [];
  let perimeter = 0;
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const length = distanceBetween(start, end);
    edges.push({ start, end, length, offset: perimeter });
    perimeter += length;
  }

  if (perimeter <= CLOSE_DISTANCE_EPSILON) {
    return points;
  }

  const samples = [];
  for (let step = 0; step < sampleCount; step += 1) {
    const target = (perimeter * step) / sampleCount;
    const edge =
      edges.find((candidate) => target <= candidate.offset + candidate.length) ||
      edges[edges.length - 1];
    const localDistance = target - edge.offset;
    const t = edge.length <= CLOSE_DISTANCE_EPSILON ? 0 : localDistance / edge.length;
    samples.push({
      x: edge.start.x + (edge.end.x - edge.start.x) * t,
      y: edge.start.y + (edge.end.y - edge.start.y) * t,
    });
  }

  return samples;
}

function resampleLoops(loops, sampleCount) {
  if (!sampleCount || sampleCount <= 3) {
    return loops;
  }
  return loops.map((loop) => resampleClosedLoop(loop, sampleCount));
}

function getLoopFrame(loop) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  loop.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(maxX - minX, CLOSE_DISTANCE_EPSILON),
    height: Math.max(maxY - minY, CLOSE_DISTANCE_EPSILON),
    cx: (minX + maxX) * 0.5,
    cy: (minY + maxY) * 0.5,
  };
}

function getAverageLoopDistance(left, right) {
  let totalDistance = 0;
  for (let index = 0; index < left.length; index += 1) {
    totalDistance += distanceBetween(left[index], right[index]);
  }
  return totalDistance / Math.max(left.length, 1);
}

function getBestAlignedLoopDistance(leftLoop, rightLoop) {
  const sampleCount = 36;
  const left = resampleClosedLoop(leftLoop, sampleCount);
  const right = resampleClosedLoop(rightLoop, sampleCount);
  const reversed = right.slice().reverse();
  let best = Infinity;

  for (let offset = 0; offset < sampleCount; offset += 1) {
    const shifted = right.map((_, index) => right[(index + offset) % sampleCount]);
    const shiftedReversed = reversed.map((_, index) => reversed[(index + offset) % sampleCount]);
    best = Math.min(
      best,
      getAverageLoopDistance(left, shifted),
      getAverageLoopDistance(left, shiftedReversed),
    );
  }

  return best;
}

function dedupeLoopsWithinTolerance(loops, tolerance) {
  const unique = [];

  loops.forEach((loop) => {
    const loopFrame = getLoopFrame(loop);
    const loopArea = Math.abs(polygonArea(loop));
    const duplicate = unique.some((candidate) => {
      const candidateFrame = getLoopFrame(candidate);
      const candidateArea = Math.abs(polygonArea(candidate));
      const centroidDistance = Math.hypot(loopFrame.cx - candidateFrame.cx, loopFrame.cy - candidateFrame.cy);
      const sizeDelta = Math.max(
        Math.abs(loopFrame.width - candidateFrame.width),
        Math.abs(loopFrame.height - candidateFrame.height),
      );
      const areaDeltaRatio =
        Math.abs(loopArea - candidateArea) / Math.max(loopArea, candidateArea, CLOSE_DISTANCE_EPSILON);

      if (centroidDistance > tolerance || sizeDelta > tolerance || areaDeltaRatio > 0.08) {
        return false;
      }

      return getBestAlignedLoopDistance(loop, candidate) <= tolerance;
    });

    if (!duplicate) {
      unique.push(loop);
    }
  });

  return unique;
}

function smoothClosedLoop(points, iterations) {
  let current = points.map((point) => ({ ...point }));
  const passCount = Math.max(0, Math.round(Number(iterations) || 0));

  for (let pass = 0; pass < passCount; pass += 1) {
    if (current.length < 3) {
      return current;
    }

    current = current.map((point, index) => {
      const previous = current[(index - 1 + current.length) % current.length];
      const next = current[(index + 1) % current.length];
      return {
        x: previous.x * 0.25 + point.x * 0.5 + next.x * 0.25,
        y: previous.y * 0.25 + point.y * 0.5 + next.y * 0.25,
      };
    });
  }

  return current;
}

function distanceToLine(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= CLOSE_DISTANCE_EPSILON) {
    return distanceBetween(point, start);
  }

  const area = Math.abs(dx * (start.y - point.y) - (start.x - point.x) * dy);
  return area / Math.sqrt(lengthSquared);
}

function simplifyOpenPolyline(points, tolerance) {
  if (points.length <= 2 || tolerance <= 0) {
    return points.slice();
  }

  let maxDistance = 0;
  let splitIndex = -1;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = distanceToLine(points[index], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = index;
    }
  }

  if (maxDistance <= tolerance || splitIndex === -1) {
    return [points[0], points[points.length - 1]];
  }

  const left = simplifyOpenPolyline(points.slice(0, splitIndex + 1), tolerance);
  const right = simplifyOpenPolyline(points.slice(splitIndex), tolerance);
  return left.slice(0, -1).concat(right);
}

function simplifyClosedLoop(points, tolerance) {
  if (points.length <= 3 || tolerance <= 0) {
    return points.slice();
  }

  const centroid = points.reduce(
    (accumulator, point) => ({
      x: accumulator.x + point.x / points.length,
      y: accumulator.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
  let anchorIndex = 0;
  let bestDistance = -Infinity;
  points.forEach((point, index) => {
    const distance = distanceBetween(point, centroid);
    if (distance > bestDistance) {
      bestDistance = distance;
      anchorIndex = index;
    }
  });

  const rotated = points.slice(anchorIndex).concat(points.slice(0, anchorIndex));
  const opened = rotated.concat([{ ...rotated[0] }]);
  const simplified = simplifyOpenPolyline(opened, tolerance).slice(0, -1);
  return simplified.length >= 3 ? simplified : points.slice();
}

function getSvgLoops(text, sampleCount) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "image/svg+xml");
  const svgRoot = document.getElementById("svgMeasureRoot");
  svgRoot.innerHTML = "";

  const loops = [];
  const candidates = doc.querySelectorAll("path, polygon, polyline, rect, circle, ellipse");

  candidates.forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (tag === "path") {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", element.getAttribute("d") || "");
      svgRoot.append(path);
      const sampled = maybeClosedLoop(sampleSvgPath(path, sampleCount), isClosedSvgPath(path));
      if (sampled) {
        loops.push(sampled);
      }
      path.remove();
      return;
    }

    if (tag === "polygon" || tag === "polyline") {
      const points = parsePointsAttribute(element.getAttribute("points") || "");
      const closed = maybeClosedLoop(points, tag === "polygon");
      if (closed) {
        loops.push(closed);
      }
      return;
    }

    if (tag === "rect") {
      const x = Number(element.getAttribute("x") || "0");
      const y = Number(element.getAttribute("y") || "0");
      const width = Number(element.getAttribute("width") || "0");
      const height = Number(element.getAttribute("height") || "0");
      loops.push([
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ]);
      return;
    }

    if (tag === "circle") {
      const cx = Number(element.getAttribute("cx") || "0");
      const cy = Number(element.getAttribute("cy") || "0");
      const r = Number(element.getAttribute("r") || "0");
      loops.push(sampleCircle(cx, cy, r, r, sampleCount));
      return;
    }

    if (tag === "ellipse") {
      const cx = Number(element.getAttribute("cx") || "0");
      const cy = Number(element.getAttribute("cy") || "0");
      const rx = Number(element.getAttribute("rx") || "0");
      const ry = Number(element.getAttribute("ry") || "0");
      loops.push(sampleCircle(cx, cy, rx, ry, sampleCount));
    }
  });

  return {
    loops: normalizeLoops(resampleLoops(loops, sampleCount)),
    importKind: "vector",
    sourceBounds: getRawBounds(loops),
    sourceUnits: null,
  };
}

function parseDxfPairs(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  const pairs = [];
  for (let index = 0; index < lines.length - 1; index += 2) {
    pairs.push({
      code: lines[index].trim(),
      value: lines[index + 1].trim(),
    });
  }
  return pairs;
}

function collectEntityPairs(pairs, startIndex) {
  const entityPairs = [];
  let index = startIndex + 1;
  while (index < pairs.length && pairs[index].code !== "0") {
    entityPairs.push(pairs[index]);
    index += 1;
  }
  return { entityPairs, nextIndex: index };
}

function getFirstValue(entityPairs, code, fallback = "") {
  const pair = entityPairs.find((entry) => entry.code === code);
  return pair ? pair.value : fallback;
}

function getAllValues(entityPairs, code) {
  return entityPairs
    .filter((entry) => entry.code === code)
    .map((entry) => entry.value);
}

function buildDxfEllipse(entityPairs, sampleCount = 96) {
  const cx = numberValue(getFirstValue(entityPairs, "10"));
  const cy = numberValue(getFirstValue(entityPairs, "20"));
  const majorX = numberValue(getFirstValue(entityPairs, "11"));
  const majorY = numberValue(getFirstValue(entityPairs, "21"));
  const ratio = numberValue(getFirstValue(entityPairs, "40"), 1);
  const start = numberValue(getFirstValue(entityPairs, "41"), 0);
  const end = numberValue(getFirstValue(entityPairs, "42"), Math.PI * 2);

  const majorLength = Math.hypot(majorX, majorY);
  if (majorLength <= CLOSE_DISTANCE_EPSILON) {
    return null;
  }

  const ux = majorX / majorLength;
  const uy = majorY / majorLength;
  const vx = -uy;
  const vy = ux;
  const minorLength = majorLength * ratio;
  const points = [];

  for (let step = 0; step < sampleCount; step += 1) {
    const t = start + ((end - start) * step) / sampleCount;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    points.push({
      x: cx + ux * majorLength * cos + vx * minorLength * sin,
      y: cy + uy * majorLength * cos + vy * minorLength * sin,
    });
  }

  return maybeClosedLoop(points, Math.abs(end - start) >= Math.PI * 1.99);
}

function buildDxfSpline(entityPairs, sampleCount = 96) {
  const xs = getAllValues(entityPairs, "10").map((value) => numberValue(value));
  const ys = getAllValues(entityPairs, "20").map((value) => numberValue(value));
  const fitXs = getAllValues(entityPairs, "11").map((value) => numberValue(value));
  const fitYs = getAllValues(entityPairs, "21").map((value) => numberValue(value));
  const knots = getAllValues(entityPairs, "40").map((value) => numberValue(value));
  const weights = getAllValues(entityPairs, "41").map((value) => numberValue(value, 1));
  const degree = Math.max(1, Math.round(numberValue(getFirstValue(entityPairs, "71"), 3)));
  const flags = numberValue(getFirstValue(entityPairs, "70"), 0);
  const explicitClosed = (flags & 1) === 1;
  const periodic = (flags & 2) === 2;
  const controlCount = Math.min(xs.length, ys.length);
  const fitCount = Math.min(fitXs.length, fitYs.length);
  const controlPoints = [];

  for (let index = 0; index < controlCount; index += 1) {
    controlPoints.push({ x: xs[index], y: ys[index], w: weights[index] ?? 1 });
  }

  if (controlPoints.length >= degree + 1 && knots.length >= controlPoints.length + degree + 1) {
    const basis = (controlIndex, basisDegree, parameter) => {
      if (basisDegree === 0) {
        const start = knots[controlIndex];
        const end = knots[controlIndex + 1];
        const isLastSpan =
          parameter === knots[knots.length - 1] &&
          controlIndex === controlPoints.length - 1 &&
          parameter >= start &&
          parameter <= end;
        return (parameter >= start && parameter < end) || isLastSpan ? 1 : 0;
      }

      const leftDenominator = knots[controlIndex + basisDegree] - knots[controlIndex];
      const rightDenominator = knots[controlIndex + basisDegree + 1] - knots[controlIndex + 1];
      const leftTerm =
        leftDenominator <= CLOSE_DISTANCE_EPSILON
          ? 0
          : ((parameter - knots[controlIndex]) / leftDenominator) * basis(controlIndex, basisDegree - 1, parameter);
      const rightTerm =
        rightDenominator <= CLOSE_DISTANCE_EPSILON
          ? 0
          : ((knots[controlIndex + basisDegree + 1] - parameter) / rightDenominator) *
            basis(controlIndex + 1, basisDegree - 1, parameter);
      return leftTerm + rightTerm;
    };

    const startParameter = knots[degree];
    const endParameter = knots[knots.length - degree - 1];
    if (endParameter - startParameter > CLOSE_DISTANCE_EPSILON) {
      const points = [];
      const sampleSteps = Math.max(48, sampleCount);
      for (let step = 0; step < sampleSteps; step += 1) {
        const t = step / sampleSteps;
        const parameter = startParameter + (endParameter - startParameter) * t;
        let numeratorX = 0;
        let numeratorY = 0;
        let denominator = 0;

        for (let controlIndex = 0; controlIndex < controlPoints.length; controlIndex += 1) {
          const basisValue = basis(controlIndex, degree, parameter) * controlPoints[controlIndex].w;
          numeratorX += basisValue * controlPoints[controlIndex].x;
          numeratorY += basisValue * controlPoints[controlIndex].y;
          denominator += basisValue;
        }

        if (Math.abs(denominator) > CLOSE_DISTANCE_EPSILON) {
          points.push({
            x: numeratorX / denominator,
            y: numeratorY / denominator,
          });
        }
      }

      return maybeClosedLoop(points, explicitClosed || periodic);
    }
  }

  const fitPoints = [];
  for (let index = 0; index < fitCount; index += 1) {
    fitPoints.push({ x: fitXs[index], y: fitYs[index] });
  }

  if (fitPoints.length >= 3) {
    return maybeClosedLoop(fitPoints, explicitClosed || periodic);
  }

  return maybeClosedLoop(
    controlPoints.map((point) => ({ x: point.x, y: point.y })),
    explicitClosed || periodic,
  );
}

function getDxfLoops(text, sampleCount) {
  const pairs = parseDxfPairs(text);
  const loops = [];
  let index = 0;

  while (index < pairs.length) {
    const pair = pairs[index];
    if (pair.code === "0" && pair.value === "LWPOLYLINE") {
      const points = [];
      let closed = false;
      index += 1;

      while (index < pairs.length && !(pairs[index].code === "0" && pairs[index].value !== "VERTEX")) {
        if (pairs[index].code === "70") {
          closed = (Number(pairs[index].value) & 1) === 1;
        }
        if (pairs[index].code === "10") {
          const x = Number(pairs[index].value);
          const yPair = pairs[index + 1];
          points.push({ x, y: Number(yPair?.value || "0") });
        }
        index += 1;
      }

      const closedLoop = maybeClosedLoop(points, closed);
      if (closedLoop) {
        loops.push(closedLoop);
      }
      continue;
    }

    if (pair.code === "0" && pair.value === "POLYLINE") {
      const points = [];
      let closed = false;
      index += 1;

      while (index < pairs.length && !(pairs[index].code === "0" && pairs[index].value === "SEQEND")) {
        if (pairs[index].code === "70") {
          closed = (Number(pairs[index].value) & 1) === 1;
        }
        if (pairs[index].code === "0" && pairs[index].value === "VERTEX") {
          let x = 0;
          let y = 0;
          index += 1;
          while (index < pairs.length && pairs[index].code !== "0") {
            if (pairs[index].code === "10") {
              x = Number(pairs[index].value);
            }
            if (pairs[index].code === "20") {
              y = Number(pairs[index].value);
            }
            index += 1;
          }
          points.push({ x, y });
          continue;
        }
        index += 1;
      }

      const closedLoop = maybeClosedLoop(points, closed);
      if (closedLoop) {
        loops.push(closedLoop);
      }
      index += 1;
      continue;
    }

    if (pair.code === "0" && pair.value === "CIRCLE") {
      const { entityPairs, nextIndex } = collectEntityPairs(pairs, index);
      const cx = numberValue(getFirstValue(entityPairs, "10"));
      const cy = numberValue(getFirstValue(entityPairs, "20"));
      const radius = numberValue(getFirstValue(entityPairs, "40"));
      if (radius > CLOSE_DISTANCE_EPSILON) {
        loops.push(sampleCircle(cx, cy, radius, radius, 96));
      }
      index = nextIndex;
      continue;
    }

    if (pair.code === "0" && pair.value === "ELLIPSE") {
      const { entityPairs, nextIndex } = collectEntityPairs(pairs, index);
      const ellipse = buildDxfEllipse(entityPairs);
      if (ellipse) {
        loops.push(ellipse);
      }
      index = nextIndex;
      continue;
    }

    if (pair.code === "0" && pair.value === "SPLINE") {
      const { entityPairs, nextIndex } = collectEntityPairs(pairs, index);
      const spline = buildDxfSpline(entityPairs, sampleCount);
      if (spline) {
        loops.push(spline);
      }
      index = nextIndex;
      continue;
    }

    index += 1;
  }

  return {
    loops: normalizeLoops(resampleLoops(loops, sampleCount)),
    importKind: "vector",
    sourceBounds: getRawBounds(loops),
    sourceUnits: null,
  };
}

function buildPalette(imageData, maxColors) {
  const { data, width, height } = imageData;
  const paletteLimit = Math.max(1, Math.round(Number(maxColors) || 8));
  const bins = new Map();

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3];
    if (alpha <= 24) {
      continue;
    }

    const red = data[offset] >> 3;
    const green = data[offset + 1] >> 3;
    const blue = data[offset + 2] >> 3;
    const key = `${red},${green},${blue}`;
    const current = bins.get(key) || { count: 0, red: 0, green: 0, blue: 0 };
    current.count += 1;
    current.red += data[offset];
    current.green += data[offset + 1];
    current.blue += data[offset + 2];
    bins.set(key, current);
  }

  const palette = [...bins.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, paletteLimit)
    .map((entry) => ({
      r: Math.round(entry.red / entry.count),
      g: Math.round(entry.green / entry.count),
      b: Math.round(entry.blue / entry.count),
    }));

  return palette.length ? palette : [{ r: 0, g: 0, b: 0 }];
}

function findNearestPaletteColor(red, green, blue, palette) {
  let best = palette[0];
  let bestIndex = 0;
  let bestDistance = Infinity;

  palette.forEach((candidate, index) => {
    const distance =
      (candidate.r - red) * (candidate.r - red) +
      (candidate.g - green) * (candidate.g - green) +
      (candidate.b - blue) * (candidate.b - blue);
    if (distance < bestDistance) {
      best = candidate;
      bestIndex = index;
      bestDistance = distance;
    }
  });

  return { color: best, index: bestIndex };
}

function quantizeImageData(imageData, colorSamples) {
  const { data, width, height } = imageData;
  const quantizedData = new Uint8ClampedArray(data.length);
  const palette = buildPalette(imageData, colorSamples);
  const colorIndexMap = new Int16Array(width * height).fill(-1);
  const usedColors = new Set();

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3];
    quantizedData[offset + 3] = alpha;

    if (alpha <= 24) {
      continue;
    }

    const nearest = findNearestPaletteColor(data[offset], data[offset + 1], data[offset + 2], palette);
    quantizedData[offset] = nearest.color.r;
    quantizedData[offset + 1] = nearest.color.g;
    quantizedData[offset + 2] = nearest.color.b;
    colorIndexMap[index] = nearest.index;
    usedColors.add(`${nearest.color.r},${nearest.color.g},${nearest.color.b}`);
  }

  return {
    quantizedData,
    colorIndexMap,
    palette,
    sampledColorCount: usedColors.size,
    targetColorCount: Math.max(1, Math.round(Number(colorSamples) || 8)),
  };
}

function blurScalarField(values, width, height, radius) {
  if (radius <= 0) {
    return Float32Array.from(values);
  }

  const horizontal = new Float32Array(values.length);
  const blurred = new Float32Array(values.length);

  for (let y = 0; y < height; y += 1) {
    const prefix = new Float32Array(width + 1);
    for (let x = 0; x < width; x += 1) {
      prefix[x + 1] = prefix[x] + values[y * width + x];
    }
    for (let x = 0; x < width; x += 1) {
      const start = Math.max(0, x - radius);
      const end = Math.min(width - 1, x + radius);
      horizontal[y * width + x] = (prefix[end + 1] - prefix[start]) / (end - start + 1);
    }
  }

  for (let x = 0; x < width; x += 1) {
    const prefix = new Float32Array(height + 1);
    for (let y = 0; y < height; y += 1) {
      prefix[y + 1] = prefix[y] + horizontal[y * width + x];
    }
    for (let y = 0; y < height; y += 1) {
      const start = Math.max(0, y - radius);
      const end = Math.min(height - 1, y + radius);
      blurred[y * width + x] = (prefix[end + 1] - prefix[start]) / (end - start + 1);
    }
  }

  return blurred;
}

function flattenImageShading(imageData, strength) {
  const { data, width, height } = imageData;
  const normalizedStrength = Math.min(1, Math.max(0, Number(strength) || 0));
  if (normalizedStrength <= 0) {
    return imageData;
  }

  const luminance = new Float32Array(width * height);
  let opaqueCount = 0;
  let globalLuminance = 0;

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3];
    if (alpha <= 24) {
      continue;
    }
    const value = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
    luminance[index] = value;
    globalLuminance += value;
    opaqueCount += 1;
  }

  if (!opaqueCount) {
    return imageData;
  }

  globalLuminance /= opaqueCount;
  const blurRadius = Math.max(1, Math.round(2 + normalizedStrength * 6));
  const localLuminance = blurScalarField(luminance, width, height, blurRadius);
  const flattenedData = new Uint8ClampedArray(data.length);

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3];
    flattenedData[offset + 3] = alpha;

    if (alpha <= 24) {
      continue;
    }

    const localValue = Math.max(localLuminance[index], 1);
    const targetGain = Math.min(2.6, Math.max(0.38, globalLuminance / localValue));
    const gain = 1 + (targetGain - 1) * normalizedStrength;
    flattenedData[offset] = Math.min(255, Math.max(0, Math.round(data[offset] * gain)));
    flattenedData[offset + 1] = Math.min(255, Math.max(0, Math.round(data[offset + 1] * gain)));
    flattenedData[offset + 2] = Math.min(255, Math.max(0, Math.round(data[offset + 2] * gain)));
  }

  return new ImageData(flattenedData, width, height);
}

function blurRgbaImageData(imageData, radius) {
  const { data, width, height } = imageData;
  if (radius <= 0) {
    return imageData;
  }

  const channels = [0, 1, 2].map((channel) => {
    const values = new Float32Array(width * height);
    for (let index = 0; index < width * height; index += 1) {
      values[index] = data[index * 4 + channel];
    }
    return blurScalarField(values, width, height, radius);
  });

  const blurredData = new Uint8ClampedArray(data.length);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    blurredData[offset] = Math.round(channels[0][index]);
    blurredData[offset + 1] = Math.round(channels[1][index]);
    blurredData[offset + 2] = Math.round(channels[2][index]);
    blurredData[offset + 3] = data[offset + 3];
  }

  return new ImageData(blurredData, width, height);
}

function preparePhotoImageData(imageData) {
  const { data, width, height } = imageData;
  const blurred = blurRgbaImageData(imageData, 2);
  const prepared = new Uint8ClampedArray(data.length);

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3];
    prepared[offset + 3] = alpha;
    if (alpha <= 24) {
      continue;
    }

    const red = blurred.data[offset] / 255;
    const green = blurred.data[offset + 1] / 255;
    const blue = blurred.data[offset + 2] / 255;
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
    const contrast = 1.18;
    const contrastLift = (value) => Math.min(1, Math.max(0, (value - 0.5) * contrast + 0.5));
    const saturatedRed = luminance + (red - luminance) * 1.15;
    const saturatedGreen = luminance + (green - luminance) * 1.15;
    const saturatedBlue = luminance + (blue - luminance) * 1.15;

    prepared[offset] = Math.round(contrastLift(saturatedRed) * 255);
    prepared[offset + 1] = Math.round(contrastLift(saturatedGreen) * 255);
    prepared[offset + 2] = Math.round(contrastLift(saturatedBlue) * 255);
  }

  return new ImageData(prepared, width, height);
}

function prepareImageDataForTrace(imageData, settings) {
  let prepared = imageData;
  if (settings.imagePhotoPrep) {
    prepared = preparePhotoImageData(prepared);
  }
  if (settings.imageFlattenShading) {
    prepared = flattenImageShading(prepared, settings.imageFlattenStrength);
  }
  return prepared;
}

function buildRgbaPreview(width, height, colorProvider) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const color = colorProvider(index);
    rgba[offset] = color.r;
    rgba[offset + 1] = color.g;
    rgba[offset + 2] = color.b;
    rgba[offset + 3] = color.a ?? 255;
  }
  return rgba;
}

function buildThresholdMaskFromQuantized(imageData, quantizedData, threshold, invert) {
  const { data, width, height } = imageData;
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3];
    const luminance =
      quantizedData[offset] * 0.299 + quantizedData[offset + 1] * 0.587 + quantizedData[offset + 2] * 0.114;
    const solid = alpha > 24 && (invert ? luminance > threshold : luminance < threshold);
    mask[index] = solid ? 1 : 0;
  }
  return { mask, width, height };
}

function buildMask(imageData, threshold, invert, colorSamples = 8) {
  const { quantizedData, colorIndexMap, palette, sampledColorCount, targetColorCount } = quantizeImageData(
    imageData,
    colorSamples,
  );
  const { mask, width, height } = buildThresholdMaskFromQuantized(imageData, quantizedData, threshold, invert);
  return { mask, width, height, quantizedData, colorIndexMap, palette, sampledColorCount, targetColorCount };
}

function buildMergedPaletteGroups(palette, tolerance) {
  const groups = [];
  const toleranceSquared = tolerance * tolerance;

  palette.forEach((color, paletteIndex) => {
    const group = groups.find((candidate) => {
      const dr = candidate.r - color.r;
      const dg = candidate.g - color.g;
      const db = candidate.b - color.b;
      return dr * dr + dg * dg + db * db <= toleranceSquared;
    });

    if (group) {
      group.members.push(paletteIndex);
      group.r = (group.r * (group.members.length - 1) + color.r) / group.members.length;
      group.g = (group.g * (group.members.length - 1) + color.g) / group.members.length;
      group.b = (group.b * (group.members.length - 1) + color.b) / group.members.length;
      return;
    }

    groups.push({ members: [paletteIndex], r: color.r, g: color.g, b: color.b });
  });

  return groups.map((group) => ({
    members: group.members,
    color: {
      r: Math.round(group.r),
      g: Math.round(group.g),
      b: Math.round(group.b),
      a: 255,
    },
  }));
}

function buildSegmentationData(imageData, colorSamples, colorTolerance) {
  const { width, height } = imageData;
  const quantized = quantizeImageData(imageData, colorSamples);
  const groups = buildMergedPaletteGroups(quantized.palette, Math.max(0, Number(colorTolerance) || 0));
  const paletteToGroup = new Int16Array(quantized.palette.length).fill(-1);
  groups.forEach((group, groupIndex) => {
    group.members.forEach((paletteIndex) => {
      paletteToGroup[paletteIndex] = groupIndex;
    });
  });

  const groupIndexMap = new Int16Array(width * height).fill(-1);
  for (let index = 0; index < width * height; index += 1) {
    const paletteIndex = quantized.colorIndexMap[index];
    if (paletteIndex >= 0) {
      groupIndexMap[index] = paletteToGroup[paletteIndex];
    }
  }

  const segmentedData = buildRgbaPreview(width, height, (index) => {
    const groupIndex = groupIndexMap[index];
    return groupIndex >= 0 ? groups[groupIndex].color : { r: 245, g: 241, b: 234, a: 0 };
  });

  return {
    ...quantized,
    groups,
    groupIndexMap,
    segmentedData,
    mergedColorCount: groups.length,
  };
}

function floodLargestComponent(binary) {
  const { mask, width, height } = binary;
  const visited = new Uint8Array(mask.length);
  let best = [];

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) {
      continue;
    }

    const queue = [start];
    const component = [];
    visited[start] = 1;

    while (queue.length) {
      const current = queue.pop();
      component.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];

      neighbors.forEach(([nx, ny]) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          return;
        }
        const next = ny * width + nx;
        if (mask[next] && !visited[next]) {
          visited[next] = 1;
          queue.push(next);
        }
      });
    }

    if (component.length > best.length) {
      best = component;
    }
  }

  const filtered = new Uint8Array(mask.length);
  best.forEach((index) => {
    filtered[index] = 1;
  });
  return { mask: filtered, width, height };
}

function marchingSquares(binary) {
  const { mask, width, height } = binary;
  const segments = [];
  const lookup = {
    1: [[[0, 0.5], [0.5, 1]]],
    2: [[[0.5, 1], [1, 0.5]]],
    3: [[[0, 0.5], [1, 0.5]]],
    4: [[[1, 0.5], [0.5, 0]]],
    5: [
      [[0, 0.5], [0.5, 0]],
      [[0.5, 1], [1, 0.5]],
    ],
    6: [[[0.5, 1], [0.5, 0]]],
    7: [[[0, 0.5], [0.5, 0]]],
    8: [[[0.5, 0], [0, 0.5]]],
    9: [[[0.5, 1], [0.5, 0]]],
    10: [
      [[0.5, 0], [1, 0.5]],
      [[0, 0.5], [0.5, 1]],
    ],
    11: [[[1, 0.5], [0.5, 0]]],
    12: [[[1, 0.5], [0, 0.5]]],
    13: [[[0.5, 1], [1, 0.5]]],
    14: [[[0, 0.5], [0.5, 1]]],
  };

  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const tl = mask[y * width + x];
      const tr = mask[y * width + x + 1];
      const br = mask[(y + 1) * width + x + 1];
      const bl = mask[(y + 1) * width + x];
      const key = tl * 8 + tr * 4 + br * 2 + bl;
      const cellSegments = lookup[key];
      if (!cellSegments) {
        continue;
      }

      cellSegments.forEach((segment) => {
        segments.push(
          segment.map(([sx, sy]) => ({
            x: x + sx,
            y: y + sy,
          })),
        );
      });
    }
  }

  return segments;
}

function chainSegments(segments) {
  const keyFor = (point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
  const adjacency = new Map();

  segments.forEach(([start, end]) => {
    const startKey = keyFor(start);
    const endKey = keyFor(end);
    if (!adjacency.has(startKey)) {
      adjacency.set(startKey, []);
    }
    if (!adjacency.has(endKey)) {
      adjacency.set(endKey, []);
    }
    adjacency.get(startKey).push(end);
    adjacency.get(endKey).push(start);
  });

  const visitedEdges = new Set();
  const loops = [];

  segments.forEach(([start, end]) => {
    const edgeKey = `${keyFor(start)}>${keyFor(end)}`;
    const reverseKey = `${keyFor(end)}>${keyFor(start)}`;
    if (visitedEdges.has(edgeKey) || visitedEdges.has(reverseKey)) {
      return;
    }

    const loop = [start];
    let current = end;
    let previous = start;
    visitedEdges.add(edgeKey);

    while (current) {
      loop.push(current);
      const currentKey = keyFor(current);
      const options = adjacency.get(currentKey) || [];
      const next = options.find((candidate) => keyFor(candidate) !== keyFor(previous));
      if (!next || keyFor(next) === keyFor(loop[0])) {
        break;
      }
      visitedEdges.add(`${currentKey}>${keyFor(next)}`);
      previous = current;
      current = next;
    }

    if (loop.length >= 8) {
      loops.push(loop);
    }
  });

  return loops;
}

function extractImageLoopsFromMask(binary, canvasHeight, minRegionAreaPixels, smoothingIterations, simplificationTolerance) {
  return chainSegments(marchingSquares(binary))
    .map((loop) =>
      loop.map((point) => ({
        x: point.x,
        y: canvasHeight - point.y,
      })),
    )
    .map((loop) => smoothClosedLoop(loop, smoothingIterations))
    .map((loop) => simplifyClosedLoop(loop, simplificationTolerance))
    .filter((loop) => loop.length >= 3)
    .filter((loop) => Math.abs(polygonArea(loop)) >= minRegionAreaPixels);
}

function finalizeImageLoops(loops, duplicateTolerance) {
  const uniqueLoops = dedupeLoopsWithinTolerance(
    loops.sort((left, right) => Math.abs(polygonArea(right)) - Math.abs(polygonArea(left))),
    duplicateTolerance,
  );
  const normalizedLoops = normalizeLoops(uniqueLoops);
  const traceCandidates = normalizedLoops.map((loop, index) => ({
    id: `trace-${index + 1}`,
    label: `Region ${index + 1}`,
    area: Math.abs(polygonArea(loop)),
    points: loop,
  }));

  return {
    loops: normalizedLoops,
    traceCandidates,
    sourceBounds: getRawBounds(uniqueLoops),
  };
}

function buildImageTraceFromImage(image, settings) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const longestSide = 256;
  const upscaleMultiplier = Math.max(1, Number(settings.imageUpscaleBeforeTrace) || 1);
  const traceScale = settings.imagePhotoPrep ? 1.5 : 1;
  const targetLongestSide = Math.min(1024, Math.round(longestSide * traceScale * upscaleMultiplier));
  const scale = targetLongestSide / Math.max(image.width, image.height);
  canvas.width = Math.max(32, Math.round(image.width * scale));
  canvas.height = Math.max(32, Math.round(image.height * scale));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const sourceImageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const processedImageData = prepareImageDataForTrace(sourceImageData, settings);

  const binary = buildMask(
    processedImageData,
    settings.imageThreshold,
    settings.invertImage,
    settings.imageColorSamples,
  );
  const duplicateTolerance = Math.max(canvas.width, canvas.height) * 0.006;
  const minRegionAreaPercent = Math.max(0, Number(settings.imageMinRegionArea) || 0);
  const minRegionAreaPixels = Math.max((canvas.width * canvas.height * minRegionAreaPercent) / 100, 12);
  const smoothingIterations = Math.max(0, Math.round(Number(settings.imageCornerSmoothing) || 0));
  const simplificationTolerance = Math.max(0, Number(settings.imagePathSimplification) || 0);
  let finalized;
  let primaryPreviewData = binary.quantizedData;
  let secondaryPreviewData = buildRgbaPreview(binary.width, binary.height, (index) => {
    const shade = binary.mask[index] ? 32 : 245;
    return { r: shade, g: shade, b: shade, a: 255 };
  });
  let primaryLabel = settings.imagePhotoPrep
    ? "Photo-prepped color preview"
    : settings.imageFlattenShading
      ? "Flattened color preview"
      : "Color sample preview";
  let secondaryLabel = "Threshold mask";
  let previewMode = "threshold";
  let tracedColorCount = binary.sampledColorCount;

  if (settings.imageImportMode === "segmentation") {
    const segmentation = buildSegmentationData(
      processedImageData,
      settings.imageColorSamples,
      settings.imageColorTolerance,
    );
    const segmentationLoops = segmentation.groups.flatMap((group, groupIndex) => {
      const mask = new Uint8Array(canvas.width * canvas.height);
      segmentation.groupIndexMap.forEach((value, index) => {
        if (value === groupIndex) {
          mask[index] = 1;
        }
      });
      return extractImageLoopsFromMask(
        { mask, width: canvas.width, height: canvas.height },
        canvas.height,
        minRegionAreaPixels,
        smoothingIterations,
        simplificationTolerance,
      );
    });
    finalized = finalizeImageLoops(segmentationLoops, duplicateTolerance);
    primaryPreviewData = segmentation.quantizedData;
    secondaryPreviewData = segmentation.segmentedData;
    primaryLabel = "Sampled colors";
    secondaryLabel = "Merged color regions";
    previewMode = "segmentation";
    tracedColorCount = segmentation.mergedColorCount;
  } else {
    const rawLoops = extractImageLoopsFromMask(
      binary,
      canvas.height,
      minRegionAreaPixels,
      smoothingIterations,
      simplificationTolerance,
    );
    finalized = finalizeImageLoops(rawLoops, duplicateTolerance);
  }

  return {
    loops: finalized.loops,
    traceCandidates: finalized.traceCandidates,
    importKind: "image",
    sourceBounds: finalized.sourceBounds,
    sourceUnits: "px",
    tracePreview: {
      width: canvas.width,
      height: canvas.height,
      mode: previewMode,
      primaryPreviewData,
      secondaryPreviewData,
      primaryLabel,
      secondaryLabel,
      sampledColorCount: tracedColorCount,
      targetColorCount: binary.targetColorCount,
      tracedRegionCount: finalized.traceCandidates.length,
    },
  };
}

export async function previewImageTrace(file, settings) {
  const image = await loadImage(file);
  return buildImageTraceFromImage(image, settings).tracePreview;
}

async function getImageLoops(file, settings) {
  const image = await loadImage(file);
  return buildImageTraceFromImage(image, settings);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve(image);
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      reject(new Error("Unable to load image."));
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

export async function importProfile(file, settings) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "svg") {
    const result = getSvgLoops(await file.text(), settings.curveSamples);
    return { ...result, sourceUnits: settings.units };
  }
  if (extension === "dxf") {
    const result = getDxfLoops(await file.text(), settings.curveSamples);
    return { ...result, sourceUnits: settings.units };
  }
  return getImageLoops(file, settings);
}
