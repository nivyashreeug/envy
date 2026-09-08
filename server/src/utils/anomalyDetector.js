const MICRO_DEBIT_AMOUNT_THRESHOLD = 5.0
const MIN_MICRO_DEBIT_REPEATS = 2

function getStats(values) {
  if (!values || !values.length) {
    return { avg: 0, stdDev: 0, median: 0, count: 0 }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const count = sorted.length
  const avg = sorted.reduce((sum, v) => sum + v, 0) / count
  const variance = sorted.reduce((sum, v) => sum + (v - avg) ** 2, 0) / count
  const stdDev = Math.sqrt(variance)

  const mid = Math.floor(count / 2)
  const median = count % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2

  return { avg, stdDev, median, count }
}

function detectSpendingAnomalies(transactions) {
  const debits = (transactions || []).filter((txn) => txn && typeof txn.amount === 'number' && txn.amount < 0)
  const amounts = debits.map((t) => Math.abs(t.amount))

  if (amounts.length < 3) {
    return {
      stats: getStats(amounts),
      isReliable: false,
      outlierThreshold: 0,
      anomalousTransactionIds: new Set(),
      microDebitMap: new Map(),
    }
  }

  const stats = getStats(amounts)
  // Anomaly threshold: 2 standard deviations above mean, or at least 2.5x median
  const statisticalThreshold = stats.avg + 2 * stats.stdDev
  const medianMultipleThreshold = stats.median > 0 ? stats.median * 3 : statisticalThreshold
  const outlierThreshold = Math.max(statisticalThreshold, medianMultipleThreshold, 15)

  const anomalousTransactionIds = new Set()

  if (amounts.length >= 5) {
    for (const txn of debits) {
      const absAmount = Math.abs(txn.amount)
      if (absAmount >= outlierThreshold && absAmount > stats.avg * 1.8) {
        anomalousTransactionIds.add(txn.id)
      }
    }
  }

  // Detect repeated micro-debits by merchant
  const microDebitMap = new Map() // merchant -> { count, totalAmount, transactionIds }

  for (const txn of debits) {
    const absAmount = Math.abs(txn.amount)
    if (absAmount <= MICRO_DEBIT_AMOUNT_THRESHOLD) {
      const merchant = (txn.description || 'unknown').toLowerCase().trim()
      if (!microDebitMap.has(merchant)) {
        microDebitMap.set(merchant, {
          merchant,
          count: 0,
          totalAmount: 0,
          transactionIds: [],
        })
      }
      const record = microDebitMap.get(merchant)
      record.count += 1
      record.totalAmount += absAmount
      record.transactionIds.push(txn.id)
    }
  }

  return {
    stats,
    isReliable: amounts.length >= 5,
    outlierThreshold: Number(outlierThreshold.toFixed(2)),
    anomalousTransactionIds,
    microDebitMap,
  }
}

module.exports = {
  MICRO_DEBIT_AMOUNT_THRESHOLD,
  MIN_MICRO_DEBIT_REPEATS,
  getStats,
  detectSpendingAnomalies,
}
