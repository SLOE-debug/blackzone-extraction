/** Radial 三角形相对 Ring Source 段序的绕序。 */
export enum RadialWinding {
  Forward = 'forward',
  Reverse = 'reverse',
}

/** 单个环带内两组三角形的稳定写入顺序。 */
export enum RadialTriangleOrder {
  PrimaryFirst = 'primary-first',
  SecondaryFirst = 'secondary-first',
}

/** Radial Emitter 对退化三角形采用的显式策略。 */
export enum RadialDegeneratePolicy {
  Reject = 'reject',
  PreserveFixedTopology = 'preserve-fixed-topology',
}

/** Radial 编译阶段支持的顶层拓扑 Pass。 */
export enum RadialTopologyPassKind {
  SideBands = 'side-bands',
  Fan = 'fan',
  SegmentSequence = 'segment-sequence',
}

/** 按 Ring 外层、Segment 内层的顺序连接一段连续相邻环。 */
export interface RadialSideBandsPass {
  readonly kind: RadialTopologyPassKind.SideBands;
  readonly firstRing: number;
  readonly lastRing: number;
  readonly winding: RadialWinding;
  readonly triangleOrder: RadialTriangleOrder;
}

/** 把指定环连接到一个由 Feature 采样的中心点。 */
export interface RadialFanPass {
  readonly kind: RadialTopologyPassKind.Fan;
  readonly ring: number;
  readonly center: number;
  readonly winding: RadialWinding;
}

/** 每个 Segment 内可交错执行的拓扑操作。 */
export enum RadialSegmentOperationKind {
  SideBand = 'side-band',
  Fan = 'fan',
}

/** 在单个 Segment 内连接两个指定环。 */
export interface RadialSegmentSideBandOperation {
  readonly kind: RadialSegmentOperationKind.SideBand;
  readonly firstRing: number;
  readonly secondRing: number;
  readonly winding: RadialWinding;
  readonly triangleOrder: RadialTriangleOrder;
}

/** 在单个 Segment 内写入一个 Fan 三角形。 */
export interface RadialSegmentFanOperation {
  readonly kind: RadialSegmentOperationKind.Fan;
  readonly ring: number;
  readonly center: number;
  readonly winding: RadialWinding;
}

export type RadialSegmentOperation =
  | RadialSegmentSideBandOperation
  | RadialSegmentFanOperation;

/** 按 Segment 外层、操作内层的顺序保留交错三角形输出。 */
export interface RadialSegmentSequencePass {
  readonly kind: RadialTopologyPassKind.SegmentSequence;
  readonly operations: readonly Readonly<RadialSegmentOperation>[];
}

export type RadialTopologyPass =
  | RadialSideBandsPass
  | RadialFanPass
  | RadialSegmentSequencePass;

/** 编译静态 Radial 拓扑所需的机械配置。 */
export interface RadialTopologyPlanSpec {
  readonly ringCount: number;
  readonly segmentCount: number;
  readonly centerCount: number;
  readonly degeneratePolicy: RadialDegeneratePolicy;
  readonly passes: readonly Readonly<RadialTopologyPass>[];
}

/** Ring/Center 共享采样点到独立三角形的固定索引计划。 */
export interface RadialTopologyPlan {
  readonly ringCount: number;
  readonly segmentCount: number;
  readonly centerCount: number;
  readonly sampleCount: number;
  readonly triangleCount: number;
  readonly degeneratePolicy: RadialDegeneratePolicy;
  /** 每三个值表示一个三角形引用的 Ring 或 Center 采样槽。 */
  readonly triangleSampleIndices: Uint32Array;
}

/** 把有序拓扑 Pass 编译为可重复使用的三角形采样索引。 */
export function compileRadialTopologyPlan(
  spec: Readonly<RadialTopologyPlanSpec>,
): RadialTopologyPlan {
  validatePlanSpec(spec);
  const triangleCount = countTriangles(spec);
  const triangleSampleIndices = new Uint32Array(triangleCount * 3);
  let outputOffset = 0;
  for (const pass of spec.passes) {
    outputOffset = compilePass(spec, pass, triangleSampleIndices, outputOffset);
  }
  if (outputOffset !== triangleSampleIndices.length) {
    throw new Error('Radial Plan 编译后的三角形索引数量与声明不一致。');
  }
  return Object.freeze({
    ringCount: spec.ringCount,
    segmentCount: spec.segmentCount,
    centerCount: spec.centerCount,
    sampleCount: spec.ringCount * spec.segmentCount + spec.centerCount,
    triangleCount,
    degeneratePolicy: spec.degeneratePolicy,
    triangleSampleIndices,
  });
}

/** 计算全部 Pass 的精确三角形数量。 */
function countTriangles(spec: Readonly<RadialTopologyPlanSpec>): number {
  let triangleCount = 0;
  for (const pass of spec.passes) {
    switch (pass.kind) {
      case RadialTopologyPassKind.SideBands:
        validateSideBandRange(spec, pass.firstRing, pass.lastRing);
        triangleCount += (pass.lastRing - pass.firstRing) * spec.segmentCount * 2;
        break;
      case RadialTopologyPassKind.Fan:
        validateFan(spec, pass.ring, pass.center);
        triangleCount += spec.segmentCount;
        break;
      case RadialTopologyPassKind.SegmentSequence:
        if (pass.operations.length <= 0) {
          throw new Error('Radial Segment Sequence 至少需要一个拓扑操作。');
        }
        for (const operation of pass.operations) {
          validateSegmentOperation(spec, operation);
          triangleCount += operation.kind === RadialSegmentOperationKind.SideBand
            ? spec.segmentCount * 2
            : spec.segmentCount;
        }
        break;
      default:
        throw new Error(`未知的 Radial Topology Pass：${String(pass)}`);
    }
  }
  if (!Number.isSafeInteger(triangleCount) || triangleCount <= 0) {
    throw new Error('Radial Plan 必须生成安全范围内的正数三角形。');
  }
  return triangleCount;
}

/** 按 Pass 声明的循环嵌套顺序写入三角形索引。 */
function compilePass(
  spec: Readonly<RadialTopologyPlanSpec>,
  pass: Readonly<RadialTopologyPass>,
  output: Uint32Array,
  outputOffset: number,
): number {
  switch (pass.kind) {
    case RadialTopologyPassKind.SideBands:
      for (let ring = pass.firstRing; ring < pass.lastRing; ring++) {
        for (let segment = 0; segment < spec.segmentCount; segment++) {
          outputOffset = writeSideBand(
            spec, output, outputOffset, ring, ring + 1, segment,
            pass.winding, pass.triangleOrder,
          );
        }
      }
      return outputOffset;
    case RadialTopologyPassKind.Fan:
      for (let segment = 0; segment < spec.segmentCount; segment++) {
        outputOffset = writeFan(
          spec, output, outputOffset, pass.ring, pass.center, segment, pass.winding,
        );
      }
      return outputOffset;
    case RadialTopologyPassKind.SegmentSequence:
      for (let segment = 0; segment < spec.segmentCount; segment++) {
        for (const operation of pass.operations) {
          if (operation.kind === RadialSegmentOperationKind.SideBand) {
            outputOffset = writeSideBand(
              spec, output, outputOffset,
              operation.firstRing, operation.secondRing, segment,
              operation.winding, operation.triangleOrder,
            );
          } else {
            outputOffset = writeFan(
              spec, output, outputOffset,
              operation.ring, operation.center, segment, operation.winding,
            );
          }
        }
      }
      return outputOffset;
  }
}

/** 写入当前 Segment 的两个环带三角形。 */
function writeSideBand(
  spec: Readonly<RadialTopologyPlanSpec>,
  output: Uint32Array,
  outputOffset: number,
  firstRing: number,
  secondRing: number,
  segment: number,
  winding: RadialWinding,
  triangleOrder: RadialTriangleOrder,
): number {
  const next = (segment + 1) % spec.segmentCount;
  const a = ringSampleIndex(spec, firstRing, segment);
  const b = ringSampleIndex(spec, secondRing, segment);
  const c = ringSampleIndex(spec, secondRing, next);
  const d = ringSampleIndex(spec, firstRing, next);
  if (triangleOrder === RadialTriangleOrder.PrimaryFirst) {
    outputOffset = writeTriangle(output, outputOffset, a, b, c, winding);
    return writeTriangle(output, outputOffset, a, c, d, winding);
  }
  if (triangleOrder === RadialTriangleOrder.SecondaryFirst) {
    outputOffset = writeTriangle(output, outputOffset, a, c, d, winding);
    return writeTriangle(output, outputOffset, a, b, c, winding);
  }
  throw new Error(`未知的 Radial 三角形顺序：${String(triangleOrder)}`);
}

/** 写入当前 Segment 的单个 Fan 三角形。 */
function writeFan(
  spec: Readonly<RadialTopologyPlanSpec>,
  output: Uint32Array,
  outputOffset: number,
  ring: number,
  center: number,
  segment: number,
  winding: RadialWinding,
): number {
  const centerSample = spec.ringCount * spec.segmentCount + center;
  const current = ringSampleIndex(spec, ring, segment);
  const next = ringSampleIndex(spec, ring, (segment + 1) % spec.segmentCount);
  return writeTriangle(output, outputOffset, centerSample, current, next, winding);
}

/** 按显式绕序写入三个采样槽。 */
function writeTriangle(
  output: Uint32Array,
  outputOffset: number,
  a: number,
  b: number,
  c: number,
  winding: RadialWinding,
): number {
  output[outputOffset] = a;
  if (winding === RadialWinding.Forward) {
    output[outputOffset + 1] = b;
    output[outputOffset + 2] = c;
  } else if (winding === RadialWinding.Reverse) {
    output[outputOffset + 1] = c;
    output[outputOffset + 2] = b;
  } else {
    throw new Error(`未知的 Radial 绕序：${String(winding)}`);
  }
  return outputOffset + 3;
}

function ringSampleIndex(
  spec: Readonly<RadialTopologyPlanSpec>,
  ring: number,
  segment: number,
): number {
  return ring * spec.segmentCount + segment;
}

function validatePlanSpec(spec: Readonly<RadialTopologyPlanSpec>): void {
  if (!Number.isInteger(spec.ringCount) || spec.ringCount <= 0
    || !Number.isInteger(spec.segmentCount) || spec.segmentCount < 3
    || !Number.isInteger(spec.centerCount) || spec.centerCount < 0) {
    throw new Error('Radial Plan 需要正数环、至少三个 Segment 和非负中心点数量。');
  }
  const sampleCount = spec.ringCount * spec.segmentCount + spec.centerCount;
  if (!Number.isSafeInteger(sampleCount) || sampleCount > 0xffffffff) {
    throw new Error('Radial Plan 采样容量超出安全范围。');
  }
  if (spec.passes.length <= 0) {
    throw new Error('Radial Plan 至少需要一个拓扑 Pass。');
  }
}

function validateSideBandRange(
  spec: Readonly<RadialTopologyPlanSpec>,
  firstRing: number,
  lastRing: number,
): void {
  if (!Number.isInteger(firstRing) || !Number.isInteger(lastRing)
    || firstRing < 0 || lastRing >= spec.ringCount || firstRing >= lastRing) {
    throw new Error('Radial Side Bands 的连续环范围无效。');
  }
}

function validateFan(
  spec: Readonly<RadialTopologyPlanSpec>,
  ring: number,
  center: number,
): void {
  if (!Number.isInteger(ring) || ring < 0 || ring >= spec.ringCount
    || !Number.isInteger(center) || center < 0 || center >= spec.centerCount) {
    throw new Error('Radial Fan 的环或中心点索引无效。');
  }
}

function validateSegmentOperation(
  spec: Readonly<RadialTopologyPlanSpec>,
  operation: Readonly<RadialSegmentOperation>,
): void {
  if (operation.kind === RadialSegmentOperationKind.SideBand) {
    if (!Number.isInteger(operation.firstRing)
      || !Number.isInteger(operation.secondRing)
      || operation.firstRing < 0 || operation.firstRing >= spec.ringCount
      || operation.secondRing < 0 || operation.secondRing >= spec.ringCount
      || operation.firstRing === operation.secondRing) {
      throw new Error('Radial Segment Side Band 的环索引无效。');
    }
    return;
  }
  if (operation.kind === RadialSegmentOperationKind.Fan) {
    validateFan(spec, operation.ring, operation.center);
    return;
  }
  throw new Error(`未知的 Radial Segment 操作：${String(operation)}`);
}
