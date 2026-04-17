const { FEE_KEYWORDS } = require('./feeKeywords')

function normalizeMerchant(description) {
  return description
    .toLowerCase()
    .replace(/\d{3,}/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

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

function getStats(values) {
  if (!values.length) {
    return { avg: 0, stdDev: 0 }
  }

  const avg = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length

  return { avg, stdDev: Math.sqrt(variance) }
}

function buildHiddenTimeline(hiddenTransactions) {
  const dailyTotalsMap = hiddenTransactions.reduce((acc, txn) => {
    const dayKey = toDateKey(txn.date)

    if (!dayKey) {
      return acc
    }

    if (!acc[dayKey]) {
      acc[dayKey] = { date: dayKey, total: 0, count: 0, microDebitCount: 0 }
    }

    const debitAmount = Math.abs(txn.amount)
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
  const text = description.toLowerCase()
  return FEE_KEYWORDS.some((keyword) => text.includes(keyword))
}

function analyzeTransactions(transactions) {
  const recurringMap = new Map()

  for (const txn of transactions) {
    if (txn.amount >= 0) {
      continue
    }

    const merchantKey = normalizeMerchant(txn.description)
    if (!merchantKey) {
      continue
    }

    recurringMap.set(merchantKey, (recurringMap.get(merchantKey) || 0) + 1)
  }

  const hidden = []
  const transparent = []

  for (const txn of transactions) {
    const debitAmount = txn.amount < 0 ? Math.abs(txn.amount) : 0
    const merchantKey = normalizeMerchant(txn.description)

    const looksRecurringMicroDebit =
      txn.amount < 0 && debitAmount <= 5 && (recurringMap.get(merchantKey) || 0) >= 3

    const isHidden =
      txn.amount < 0 && (isKeywordMatch(txn.description) || looksRecurringMicroDebit)

    if (isHidden) {
      hidden.push(txn)
    } else {
      transparent.push(txn)
    }
  }

  const hiddenFees = hidden.reduce((sum, txn) => sum + Math.abs(txn.amount), 0)
  const totalSpent = transactions
    .filter((txn) => txn.amount < 0)
    .reduce((sum, txn) => sum + Math.abs(txn.amount), 0)
  const transparentSpending = transparent
    .filter((txn) => txn.amount < 0)
    .reduce((sum, txn) => sum + Math.abs(txn.amount), 0)

  const hiddenMerchantTotals = hidden.reduce((acc, txn) => {
    const key = normalizeMerchant(txn.description) || 'unknown merchant'

    if (!acc[key]) {
      acc[key] = { merchant: key, total: 0, count: 0 }
    }

    acc[key].total += Math.abs(txn.amount)
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

  const spendingTotals = transactions
    .filter((txn) => txn.amount < 0)
    .reduce((acc, txn) => {
      const key = normalizeMerchant(txn.description) || 'unknown merchant'
      acc[key] = (acc[key] || 0) + Math.abs(txn.amount)
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

  const merchantTotals = hidden.reduce((acc, txn) => {
    const key = normalizeMerchant(txn.description) || 'unknown merchant'
    acc[key] = (acc[key] || 0) + Math.abs(txn.amount)
    return acc
  }, {})

  const byMerchant = Object.entries(merchantTotals)
    .map(([merchant, total]) => ({
      merchant,
      total: Number(total.toFixed(2)),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  const monthTotals = hidden.reduce((acc, txn) => {
    const month = toMonthKey(txn.date)
    acc[month] = (acc[month] || 0) + Math.abs(txn.amount)
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
    const debitAmount = Math.abs(txn.amount)
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

  return {
    totals: {
      totalSpent: Number(totalSpent.toFixed(2)),
      recoverableFees: Number(hiddenFees.toFixed(2)),
      hiddenFees: Number(hiddenFees.toFixed(2)),
      transparentSpending: Number(transparentSpending.toFixed(2)),
      flaggedTransactions: hidden.length,
      scannedTransactions: transactions.length,
    },
    spendingByMerchant,
    wallOfShame: byMerchant,
    monthlyTrend,
    insights: {
      topFeeSource,
      averageHiddenFeePerTransaction: hidden.length > 0 ? Number((hiddenFees / hidden.length).toFixed(2)) : 0,
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
  }
}

module.exports = { analyzeTransactions }
