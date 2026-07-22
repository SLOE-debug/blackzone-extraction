/** 参与统一平面拥挤约束的怪物群体连续 SoA 视图。 */
export interface PlanarCrowdPopulation {
  readonly populationId: number;
  readonly count: number;
  readonly lifecycle: Uint8Array;
  readonly previousX: Float32Array;
  readonly previousY: Float32Array;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly radius: Float32Array;
  readonly inverseMass: Float32Array;
}

/** 校验 Crowd 视图的稳定标识、容量与逐实体数据流。 */
export function validatePlanarCrowdPopulation(
  population: Readonly<PlanarCrowdPopulation>,
): void {
  if (!Number.isSafeInteger(population.populationId) || population.populationId < 0
    || !Number.isSafeInteger(population.count) || population.count <= 0
    || population.lifecycle.length !== population.count
    || population.previousX.length !== population.count
    || population.previousY.length !== population.count
    || population.x.length !== population.count
    || population.y.length !== population.count
    || population.radius.length !== population.count
    || population.inverseMass.length !== population.count) {
    throw new Error('平面 Crowd 群体标识或 SoA 容量无效。');
  }
  for (let index = 0; index < population.count; index++) {
    if (!Number.isFinite(population.radius[index]) || (population.radius[index] ?? 0) <= 0
      || !Number.isFinite(population.inverseMass[index])
      || (population.inverseMass[index] ?? 0) <= 0) {
      throw new Error('平面 Crowd 半径与逆质量必须是有限正数。');
    }
  }
}
