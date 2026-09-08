const { FEE_KEYWORDS, detectBankFeeReason } = require('./feeKeywords')
const {
  CATEGORIES,
  CLASSIFICATIONS,
  normalizeMerchant,
  categorizeTransaction,
} = require('./transactionClassifier')
const { detectRecurringPayments } = require('./recurringDetector')
const { detectSpendingAnomalies, getStats } = require('./anomalyDetector')
const { calculateRiskAndExplanation } = require('./riskScorer')
const { calculatePotentialSavings } = require('./savingsEstimator')

function toMonthKey(rawDate) {
  const date = new Date(rawDate)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function toDateKey(rawDate) {
  const date = new Date(rawDate)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString().slice(0, 10)
}

function buildHiddenTimeline(hiddenTransactions) {
  const dailyTotalsMap = (hiddenTransactions || []).reduce((acc, txn) => {
    const dayKey = toDateKey(txn.date)

    if (!dayKey) {
      return acc
    }

    if (!acc[dayKey]) {
      acc[dayKey] = { date: dayKey, total: 0, count: 0, microDebitCount: 0 }
    }

    const debitAmount = Math.abs(txn.amount || 0)
    acc[dayKey].total += debitAmount
    acc[dayKey].count += 1

    if (debitAmount <= 5) {
      acc[dayKey].microDebitCount += 1
    }

    return acc
  }, {})

  const feeDays = Object.values(dailyTotalsMap)
    .map((entry) => ({
      ...entry,
      total: Number(entry.total.toFixed(2)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (!feeDays.length) {
    return {
      dailyHiddenFees: [],
      calendarStart: null,
      calendarEnd: null,
      maxDailyHiddenFee: 0,
      heavyFeeDays: [],
    }
  }

  const { avg, stdDev } = getStats(feeDays.map((entry) => entry.total))
  const heavyThreshold = avg + stdDev
  const maxDailyHiddenFee = Math.max(...feeDays.map((entry) => entry.total))
  const lookup = feeDays.reduce((acc, entry) => {
    acc[entry.date] = entry
    return acc
  }, {})

  const start = new Date(`${feeDays[0].date}T00:00:00.000Z`)
  const end = new Date(`${feeDays[feeDays.length - 1].date}T00:00:00.000Z`)
  const dailyHiddenFees = []

  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const dateKey = cursor.toISOString().slice(0, 10)
    const data = lookup[dateKey] || { total: 0, count: 0, microDebitCount: 0 }

    dailyHiddenFees.push({
      date: dateKey,
      month: dateKey.slice(0, 7),
      day: cursor.getUTCDate(),
      weekday: cursor.getUTCDay(),
      total: data.total,
      count: data.count,
      microDebitCount: data.microDebitCount,
      level:
        maxDailyHiddenFee > 0
          ? Math.min(4, Math.ceil((data.total / maxDailyHiddenFee) * 4))
          : 0,
      isHeavy: data.total > 0 && data.total >= heavyThreshold,
    })
  }

  const heavyFeeDays = dailyHiddenFees
    .filter((entry) => entry.isHeavy)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  return {
    dailyHiddenFees,
    calendarStart: feeDays[0].date,
    calendarEnd: feeDays[feeDays.length - 1].date,
    maxDailyHiddenFee: Number(maxDailyHiddenFee.toFixed(2)),
    heavyFeeDays,
  }
}

function isKeywordMatch(description) {
  if (!description || typeof description !== 'string') return false
  const text = description.toLowerCase()
  return FEE_KEYWORDS.some((keyword) => text.includes(keyword))
}

function analyzeTransactions(transactions) {
  const safeTransactions = Array.isArray(transactions) ? transactions : []

  // 1. Run Recurring Payment and Subscription Intelligence
  const { recurringPayments, recurringLookup } = detectRecurringPayments(safeTransactions)

  // 2. Run Spending Anomaly and Micro-Debit Intelligence
  const { stats: datasetStats, anomalousTransactionIds, microDebitMap } =
    detectSpendingAnomalies(safeTransactions)

  // 3. Count basic merchant frequency for legacy compatibility
  const recurringCountMap = new Map()
  for (const txn of safeTransactions) {
    if (!txn || typeof txn.amount !== 'number' || txn.amount >= 0) {
      continue
    }

    const merchantKey = normalizeMerchant(txn.description)
    if (merchantKey && merchantKey !== 'unknown') {
      recurringCountMap.set(merchantKey, (recurringCountMap.get(merchantKey) || 0) + 1)
    }
  }

  const hidden = []
  const transparent = []
  const transactionInsights = []

  for (const txn of safeTransactions) {
    if (!txn) continue

    const debitAmount = txn.amount < 0 ? Math.abs(txn.amount) : 0
    const merchantKey = normalizeMerchant(txn.description)
    const category = categorizeTransaction(txn.description, merchantKey)
    const bankFeeReason = detectBankFeeReason(txn.description)
    const isAnomalous = anomalousTransactionIds.has(txn.id)
    const microDebitInfo = microDebitMap.get((txn.description || '').toLowerCase().trim()) || null
    const recurringInfo = recurringLookup.get(merchantKey) || null

    const looksRecurringMicroDebit =
      txn.amount < 0 && debitAmount <= 5 && (recurringCountMap.get(merchantKey) || 0) >= 3

    const isHidden =
      txn.amount < 0 &&
      (isKeywordMatch(txn.description) || Boolean(bankFeeReason) || looksRecurringMicroDebit)

    if (isHidden) {
      hidden.push(txn)
    } else {
      transparent.push(txn)
    }

    // Generate deterministic risk score, confidence, classification, and structured explanation
    const riskAnalysis = calculateRiskAndExplanation({
      transaction: txn,
      normalizedMerchant: merchantKey,
      category,
      bankFeeReason,
      recurringInfo,
      isStatisticalAnomaly: isAnomalous,
      microDebitInfo,
      totalTransactionsCount: safeTransactions.length,
      datasetStats,
    })

    transactionInsights.push({
      id: txn.id,
      date: txn.date,
      description: txn.description,
      normalizedMerchant: merchantKey,
      amount: txn.amount,
      category,
      classification: riskAnalysis.classification,
      riskScore: riskAnalysis.riskScore,
      riskLevel: riskAnalysis.riskLevel,
      confidence: riskAnalysis.confidence,
      reasons: riskAnalysis.reasons,
      recurringInfo: recurringInfo
        ? {
            frequency: recurringInfo.frequency,
            occurrences: recurringInfo.occurrences,
            averageAmount: recurringInfo.averageAmount,
            estimatedMonthlyCost: recurringInfo.estimatedMonthlyCost,
            subscriptionStatus: recurringInfo.subscriptionStatus,
          }
        : null,
      microDebitInfo: microDebitInfo
        ? {
            count: microDebitInfo.count,
            totalAmount: Number(microDebitInfo.totalAmount.toFixed(2)),
          }
        : null,
      isFee: Boolean(bankFeeReason || isKeywordMatch(txn.description)),
      isMicroDebit: Boolean(debitAmount > 0 && debitAmount <= 5),
    })
  }

  // Legacy Totals
  const hiddenFees = hidden.reduce((sum, txn) => sum + Math.abs(txn.amount || 0), 0)
  const totalSpent = safeTransactions
    .filter((txn) => txn && txn.amount < 0)
    .reduce((sum, txn) => sum + Math.abs(txn.amount || 0), 0)
  const transparentSpending = transparent
    .filter((txn) => txn && txn.amount < 0)
    .reduce((sum, txn) => sum + Math.abs(txn.amount || 0), 0)

  // Legacy Hidden Merchant Stats
  const hiddenMerchantTotals = hidden.reduce((acc, txn) => {
    const key = normalizeMerchant(txn.description) || 'unknown merchant'

    if (!acc[key]) {
      acc[key] = { merchant: key, total: 0, count: 0 }
    }

    acc[key].total += Math.abs(txn.amount || 0)
    acc[key].count += 1
    return acc
  }, {})

  const hiddenMerchantStats = Object.values(hiddenMerchantTotals)
    .map((entry) => ({
      merchant: entry.merchant,
      total: Number(entry.total.toFixed(2)),
      count: entry.count,
      share: hiddenFees > 0 ? Number(((entry.total / hiddenFees) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // Legacy Spending by Merchant
  const spendingTotals = safeTransactions
    .filter((txn) => txn && txn.amount < 0)
    .reduce((acc, txn) => {
      const key = normalizeMerchant(txn.description) || 'unknown merchant'
      acc[key] = (acc[key] || 0) + Math.abs(txn.amount || 0)
      return acc
    }, {})

  const spendingByMerchant = Object.entries(spendingTotals)
    .map(([merchant, total]) => ({
      merchant,
      total: Number(total.toFixed(2)),
      share: totalSpent > 0 ? Number(((total / totalSpent) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // Legacy Wall of Shame
  const merchantTotals = hidden.reduce((acc, txn) => {
    const key = normalizeMerchant(txn.description) || 'unknown merchant'
    acc[key] = (acc[key] || 0) + Math.abs(txn.amount || 0)
    return acc
  }, {})

  const byMerchant = Object.entries(merchantTotals)
    .map(([merchant, total]) => ({
      merchant,
      total: Number(total.toFixed(2)),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  // Legacy Monthly Trend
  const monthTotals = hidden.reduce((acc, txn) => {
    const month = toMonthKey(txn.date)
    acc[month] = (acc[month] || 0) + Math.abs(txn.amount || 0)
    return acc
  }, {})

  const monthlyTrend = Object.entries(monthTotals)
    .map(([month, total]) => ({ month, total: Number(total.toFixed(2)) }))
    .sort((a, b) => a.month.localeCompare(b.month))

  const topFeeSource = hiddenMerchantStats[0] || null
  const repeatOffenderMerchants = hiddenMerchantStats.filter((entry) => entry.count >= 2)
  const timeline = buildHiddenTimeline(hidden)

  const merchantTotalsStats = hiddenMerchantStats.map((entry) => entry.total)
  const merchantStats = getStats(merchantTotalsStats)
  const unusualSpikeMerchants = hiddenMerchantStats.filter(
    (entry) => entry.total >= merchantStats.avg + merchantStats.stdDev && entry.total >= 10
  )

  const microDebitMerchantMap = hidden.reduce((acc, txn) => {
    const debitAmount = Math.abs(txn.amount || 0)
    if (debitAmount > 5) {
      return acc
    }

    const key = normalizeMerchant(txn.description) || 'unknown merchant'
    if (!acc[key]) {
      acc[key] = { merchant: key, count: 0, total: 0 }
    }

    acc[key].count += 1
    acc[key].total += debitAmount
    return acc
  }, {})

  const repeatedMicroDebitMerchants = Object.values(microDebitMerchantMap)
    .filter((entry) => entry.count >= 3)
    .map((entry) => ({
      merchant: entry.merchant,
      count: entry.count,
      total: Number(entry.total.toFixed(2)),
    }))
    .sort((a, b) => b.count - a.count)

  const newMerchants = hiddenMerchantStats.filter((entry) => entry.count === 1)

  const suspiciousActivities = [
    ...unusualSpikeMerchants.map((entry) => ({
      type: 'unusual-spike',
      badge: 'Unusual Spike',
      severity: 'high',
      merchant: entry.merchant,
      amount: entry.total,
      count: entry.count,
      message: `${entry.merchant} has an unusually high hidden-fee total (${entry.share}% share).`,
    })),
    ...repeatedMicroDebitMerchants.map((entry) => ({
      type: 'repeated-micro-debit',
      badge: 'Repeated Micro-Debits',
      severity: 'medium',
      merchant: entry.merchant,
      amount: entry.total,
      count: entry.count,
      message: `${entry.merchant} triggered ${entry.count} micro-debits, suggesting a recurring fee pattern.`,
    })),
    ...newMerchants.slice(0, 6).map((entry) => ({
      type: 'new-merchant',
      badge: 'New Merchant',
      severity: 'low',
      merchant: entry.merchant,
      amount: entry.total,
      count: entry.count,
      message: `${entry.merchant} appears as a new hidden-fee source in this statement.`,
    })),
    ...timeline.heavyFeeDays.map((entry) => ({
      type: 'daily-spike',
      badge: 'Fee-Heavy Day',
      severity: 'high',
      merchant: null,
      amount: entry.total,
      count: entry.count,
      date: entry.date,
      message: `${entry.date} saw a hidden-fee spike with ${entry.count} flagged transactions.`,
    })),
  ]

  const merchantBadgeMap = new Map()
  const severityRank = { low: 1, medium: 2, high: 3 }

  for (const activity of suspiciousActivities) {
    if (!activity.merchant) {
      continue
    }

    const previous = merchantBadgeMap.get(activity.merchant)
    if (!previous || severityRank[activity.severity] > severityRank[previous.severity]) {
      merchantBadgeMap.set(activity.merchant, {
        merchant: activity.merchant,
        badge: activity.badge,
        severity: activity.severity,
      })
    }
  }

  // Category Breakdown Aggregation
  const categoryTotals = safeTransactions
    .filter((txn) => txn && txn.amount < 0)
    .reduce((acc, txn) => {
      const cat = categorizeTransaction(txn.description, normalizeMerchant(txn.description))
      if (!acc[cat]) {
        acc[cat] = { category: cat, total: 0, count: 0 }
      }
      acc[cat].total += Math.abs(txn.amount || 0)
      acc[cat].count += 1
      return acc
    }, {})

  const categories = Object.values(categoryTotals)
    .map((entry) => ({
      category: entry.category,
      total: Number(entry.total.toFixed(2)),
      count: entry.count,
      share: totalSpent > 0 ? Number(((entry.total / totalSpent) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // Subscriptions Filter
  const subscriptions = recurringPayments.filter(
    (rp) =>
      rp.subscriptionStatus === 'likely_subscription' ||
      rp.subscriptionStatus === 'possible_subscription'
  )

  // Risk Summary
  const riskScores = transactionInsights.map((t) => t.riskScore)
  const lowRiskCount = transactionInsights.filter((t) => t.riskLevel === 'LOW').length
  const mediumRiskCount = transactionInsights.filter((t) => t.riskLevel === 'MEDIUM').length
  const highRiskCount = transactionInsights.filter((t) => t.riskLevel === 'HIGH').length
  const avgRiskScore =
    riskScores.length > 0
      ? Number((riskScores.reduce((sum, s) => sum + s, 0) / riskScores.length).toFixed(1))
      : 0

  let overallRiskLevel = 'LOW'
  if (highRiskCount > 0 || avgRiskScore >= 50) {
    overallRiskLevel = 'HIGH'
  } else if (mediumRiskCount > 0 || avgRiskScore >= 25) {
    overallRiskLevel = 'MEDIUM'
  }

  const riskSummary = {
    averageRiskScore: avgRiskScore,
    overallRiskLevel,
    lowCount: lowRiskCount,
    mediumCount: mediumRiskCount,
    highCount: highRiskCount,
    highestRiskTransactions: [...transactionInsights]
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5),
  }

  // Potential Savings Estimation
  const potentialSavings = calculatePotentialSavings({
    transactions: safeTransactions,
    transactionInsights,
  })

  return {
    // 100% Backward Compatible Core Fields
    totals: {
      totalSpent: Number(totalSpent.toFixed(2)),
      recoverableFees: Number(hiddenFees.toFixed(2)),
      hiddenFees: Number(hiddenFees.toFixed(2)),
      transparentSpending: Number(transparentSpending.toFixed(2)),
      flaggedTransactions: hidden.length,
      scannedTransactions: safeTransactions.length,
    },
    spendingByMerchant,
    wallOfShame: byMerchant,
    monthlyTrend,
    insights: {
      topFeeSource,
      averageHiddenFeePerTransaction:
        hidden.length > 0 ? Number((hiddenFees / hidden.length).toFixed(2)) : 0,
      repeatOffenderMerchants: repeatOffenderMerchants.length,
      repeatOffenderMerchantList: repeatOffenderMerchants.slice(0, 3),
      feeConcentrationPercentage: topFeeSource?.share || 0,
    },
    anomalies: {
      suspiciousActivities: suspiciousActivities.slice(0, 12),
      suspiciousMerchants: Array.from(merchantBadgeMap.values()),
      unusualSpikeMerchantCount: unusualSpikeMerchants.length,
      repeatedMicroDebitMerchants: repeatedMicroDebitMerchants.length,
      newMerchantCount: newMerchants.length,
      heavyFeeDays: timeline.heavyFeeDays.length,
    },
    timeline: {
      dailyHiddenFees: timeline.dailyHiddenFees,
      calendarStart: timeline.calendarStart,
      calendarEnd: timeline.calendarEnd,
      maxDailyHiddenFee: timeline.maxDailyHiddenFee,
    },

    // Phase 2 Financial Intelligence Fields (Additive)
    transactionInsights,
    recurringPayments,
    subscriptions,
    categories,
    riskSummary,
    potentialSavings,
  }
}

module.exports = {
  analyzeTransactions,
  normalizeMerchant,
  toMonthKey,
  toDateKey,
  buildHiddenTimeline,
}
