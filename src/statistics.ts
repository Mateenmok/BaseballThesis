export type RelationshipObservation = {
  x: number
  y: number
  weight: number
}

export type WeightedLinearRegression = {
  intercept: number
  slope: number
  slopeStandardError: number
  slopeConfidenceInterval: readonly [number, number]
  pValue: number
  degreesOfFreedom: number
}

export type RelationshipAnalysis = {
  n: number
  pearson: number | null
  spearman: number | null
  regression: WeightedLinearRegression | null
}

const VARIANCE_EPSILON = 1e-15
const LANCZOS_COEFFICIENTS = [
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
] as const

function finiteObservations(observations: readonly RelationshipObservation[]) {
  return observations.filter(({ x, y, weight }) =>
    Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(weight) && weight > 0)
}

export function calculatePearson(observations: readonly Pick<RelationshipObservation, 'x' | 'y'>[]) {
  const valid = observations.filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))
  if (valid.length < 2) return null

  const meanX = valid.reduce((sum, { x }) => sum + x, 0) / valid.length
  const meanY = valid.reduce((sum, { y }) => sum + y, 0) / valid.length
  let covariance = 0
  let varianceX = 0
  let varianceY = 0

  valid.forEach(({ x, y }) => {
    const centeredX = x - meanX
    const centeredY = y - meanY
    covariance += centeredX * centeredY
    varianceX += centeredX * centeredX
    varianceY += centeredY * centeredY
  })

  if (varianceX <= VARIANCE_EPSILON || varianceY <= VARIANCE_EPSILON) return null
  return covariance / Math.sqrt(varianceX * varianceY)
}

function averageRanks(values: readonly number[]) {
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value)
  const ranks = new Array<number>(values.length)

  for (let start = 0; start < sorted.length;) {
    let end = start + 1
    while (end < sorted.length && sorted[end].value === sorted[start].value) end += 1
    const averageRank = (start + 1 + end) / 2
    for (let index = start; index < end; index += 1) ranks[sorted[index].index] = averageRank
    start = end
  }

  return ranks
}

export function calculateSpearman(observations: readonly Pick<RelationshipObservation, 'x' | 'y'>[]) {
  const valid = observations.filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))
  if (valid.length < 2) return null
  const xRanks = averageRanks(valid.map(({ x }) => x))
  const yRanks = averageRanks(valid.map(({ y }) => y))
  return calculatePearson(xRanks.map((x, index) => ({ x, y: yRanks[index] })))
}

function logGamma(value: number): number {
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value)
  const adjusted = value - 1
  let series = 0.99999999999980993
  LANCZOS_COEFFICIENTS.forEach((coefficient, index) => {
    series += coefficient / (adjusted + index + 1)
  })
  const shifted = adjusted + LANCZOS_COEFFICIENTS.length - 0.5
  return 0.5 * Math.log(2 * Math.PI) + (adjusted + 0.5) * Math.log(shifted) - shifted + Math.log(series)
}

function betaContinuedFraction(x: number, a: number, b: number) {
  const maximumIterations = 200
  const epsilon = 3e-14
  const floor = 1e-300
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - qab * x / qap
  if (Math.abs(d) < floor) d = floor
  d = 1 / d
  let result = d

  for (let iteration = 1; iteration <= maximumIterations; iteration += 1) {
    const doubled = 2 * iteration
    let numerator = iteration * (b - iteration) * x / ((qam + doubled) * (a + doubled))
    d = 1 + numerator * d
    if (Math.abs(d) < floor) d = floor
    c = 1 + numerator / c
    if (Math.abs(c) < floor) c = floor
    d = 1 / d
    result *= d * c

    numerator = -(a + iteration) * (qab + iteration) * x / ((a + doubled) * (qap + doubled))
    d = 1 + numerator * d
    if (Math.abs(d) < floor) d = floor
    c = 1 + numerator / c
    if (Math.abs(c) < floor) c = floor
    d = 1 / d
    const delta = d * c
    result *= delta
    if (Math.abs(delta - 1) < epsilon) break
  }

  return result
}

function regularizedIncompleteBeta(x: number, a: number, b: number) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const coefficient = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x),
  )
  return x < (a + 1) / (a + b + 2)
    ? coefficient * betaContinuedFraction(x, a, b) / a
    : 1 - coefficient * betaContinuedFraction(1 - x, b, a) / b
}

function twoSidedStudentTPValue(tStatistic: number, degreesOfFreedom: number) {
  if (!Number.isFinite(tStatistic)) return 0
  const x = degreesOfFreedom / (degreesOfFreedom + tStatistic * tStatistic)
  return regularizedIncompleteBeta(x, degreesOfFreedom / 2, 0.5)
}

function studentTCritical95(degreesOfFreedom: number) {
  let lower = 0
  let upper = 16
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const midpoint = (lower + upper) / 2
    if (twoSidedStudentTPValue(midpoint, degreesOfFreedom) > 0.05) lower = midpoint
    else upper = midpoint
  }
  return (lower + upper) / 2
}

export function fitWeightedLinearRegression(observations: readonly RelationshipObservation[]) {
  const valid = finiteObservations(observations)
  if (valid.length < 3) return null

  const sumWeight = valid.reduce((sum, { weight }) => sum + weight, 0)
  const meanX = valid.reduce((sum, { x, weight }) => sum + weight * x, 0) / sumWeight
  const meanY = valid.reduce((sum, { y, weight }) => sum + weight * y, 0) / sumWeight
  const weightedVarianceX = valid.reduce((sum, { x, weight }) => sum + weight * (x - meanX) ** 2, 0)
  if (weightedVarianceX <= VARIANCE_EPSILON) return null

  const weightedCovariance = valid.reduce(
    (sum, { x, y, weight }) => sum + weight * (x - meanX) * (y - meanY),
    0,
  )
  const slope = weightedCovariance / weightedVarianceX
  const intercept = meanY - slope * meanX
  const degreesOfFreedom = valid.length - 2
  const weightedResidualSumSquares = valid.reduce((sum, { x, y, weight }) => {
    const residual = y - (intercept + slope * x)
    return sum + weight * residual * residual
  }, 0)
  const residualVariance = weightedResidualSumSquares / degreesOfFreedom
  const slopeStandardError = Math.sqrt(residualVariance / weightedVarianceX)
  const tStatistic = slopeStandardError === 0
    ? (slope === 0 ? 0 : Number.POSITIVE_INFINITY)
    : slope / slopeStandardError
  const pValue = slopeStandardError === 0 && slope === 0
    ? 1
    : twoSidedStudentTPValue(Math.abs(tStatistic), degreesOfFreedom)
  const criticalValue = studentTCritical95(degreesOfFreedom)

  return {
    intercept,
    slope,
    slopeStandardError,
    slopeConfidenceInterval: [
      slope - criticalValue * slopeStandardError,
      slope + criticalValue * slopeStandardError,
    ],
    pValue,
    degreesOfFreedom,
  } satisfies WeightedLinearRegression
}

export function analyzeRelationship(observations: readonly RelationshipObservation[]): RelationshipAnalysis {
  const valid = finiteObservations(observations)
  return {
    n: valid.length,
    pearson: calculatePearson(valid),
    spearman: calculateSpearman(valid),
    regression: fitWeightedLinearRegression(valid),
  }
}
