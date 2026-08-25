function lowerBound(sortedValues, target) {
  let low = 0
  let high = sortedValues.length

  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (sortedValues[middle] < target) low = middle + 1
    else high = middle
  }

  return low
}

function upperBound(sortedValues, target) {
  let low = 0
  let high = sortedValues.length

  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (sortedValues[middle] <= target) low = middle + 1
    else high = middle
  }

  return low
}

export function midrankPercentile(value, sortedReferenceValues) {
  if (!Number.isFinite(value) || sortedReferenceValues.length === 0) return null
  const below = lowerBound(sortedReferenceValues, value)
  const atOrBelow = upperBound(sortedReferenceValues, value)
  const equal = atOrBelow - below
  return ((below + 0.5 * equal) / sortedReferenceValues.length) * 100
}

export function performancePercentile(rawPercentile, direction) {
  if (rawPercentile === null) return null
  return direction === 'lower' ? 100 - rawPercentile : rawPercentile
}
