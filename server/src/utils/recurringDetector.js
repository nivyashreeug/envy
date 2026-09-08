const { normalizeMerchant, categorizeTransaction, CATEGORIES } = require('./transactionClassifier')

const MIN_RECURRING_OCCURRENCES = 2
const FREQUENCY_WINDOWS = {
  WEEKLY: { min: 5, max: 9, center: 7, monthlyMultiplier: 52 / 12, annualMultiplier: 52 },
  BIWEEKLY: { min: 11, max: 17, center: 14, monthlyMultiplier: 26 / 12, annualMultiplier: 26 },
  MONTHLY: { min: 24, max: 35, center: 30, monthlyMultiplier: 1, annualMultiplier: 12 },
  QUARTERLY: { min: 75, max: 105, center: 90, monthlyMultiplier: 1 / 3, annualMultiplier: 4 },
  ANNUAL: { min: 330, max: 400, center: 365, monthlyMultiplier: 1 / 12, annualMultiplier: 1 },
}

const SUBSCRIPTION_KEYWORDS = [
  'netflix', 'spotify', 'hulu', 'disney', 'prime video', 'youtube', 'apple music',
  'github', 'aws', 'notion', 'figma', 'adobe', 'chatgpt', 'openai', 'icloud',
  'dropbox', 'slack', 'zoom', 'canva', 'linkedin', 'substack', 'patreon',
  'gym', 'membership', 'subscription', 'monthly plan', 'saas', 'cloud'
]

const NON_SUBSCRIPTION_CATEGORIES = new Set([
  CATEGORIES.INSURANCE,
  CATEGORIES.UTILITIES,
  CATEGORIES.HEALTHCARE,
  CATEGORIES.TRANSFER,
])

function parseTimestamp(rawDate) {
  if (!rawDate) return null
  const parsed = new Date(rawDate)
  const time = parsed.getTime()
  return Number.isNaN(time) ? null : time
}

function calculateAverage(numbers) {
  if (!numbers.length) return 0
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length
}

function calculateVariance(numbers, avg) {
  if (numbers.length <= 1) return 0
  const mean = avg !== undefined ? avg : calculateAverage(numbers)
  return numbers.reduce((sum, n) => sum + (n - mean) ** 2, 0) / numbers.length
}

function estimateFrequency(intervals) {
  if (!intervals.length) {
    return { frequency: 'UNKNOWN', avgInterval: 0, intervalVariance: 0 }
  }

  const avgInterval = calculateAverage(intervals)
  const intervalVariance = calculateVariance(intervals, avgInterval)

  for (const [name, config] of Object.entries(FREQUENCY_WINDOWS)) {
    if (avgInterval >= config.min && avgInterval <= config.max) {
      return {
        frequency: name,
        avgInterval: Number(avgInterval.toFixed(1)),
        intervalVariance: Number(intervalVariance.toFixed(1)),
      }
    }
  }

  return {
    frequency: 'IRREGULAR',
    avgInterval: Number(avgInterval.toFixed(1)),
    intervalVariance: Number(intervalVariance.toFixed(1)),
  }
}

function calculateRecurrenceConfidence(occurrenceCount, intervalData, amountData) {
  let score = 30 // Base score for >= 2 occurrences

  // Occurrence quantity signal
  if (occurrenceCount >= 6) score += 30
  else if (occurrenceCount >= 4) score += 20
  else if (occurrenceCount >= 3) score += 10

  // Interval consistency signal
  if (intervalData.frequency !== 'IRREGULAR' && intervalData.frequency !== 'UNKNOWN') {
    score += 25
    if (intervalData.intervalVariance <= 9) {
      score += 10
    }
  } else if (intervalData.frequency === 'IRREGULAR') {
    score -= 15
  }

  // Amount consistency signal
  const amountVariationPct =
    amountData.avgAmount > 0
      ? ((amountData.maxAmount - amountData.minAmount) / amountData.avgAmount) * 100
      : 0

  if (amountVariationPct <= 2) {
    score += 20
  } else if (amountVariationPct <= 10) {
    score += 10
  } else if (amountVariationPct > 30) {
    score -= 15
  }

  return Math.min(100, Math.max(10, Math.round(score)))
}

function determineSubscriptionStatus(merchantName, category, recurringGroup) {
  if (NON_SUBSCRIPTION_CATEGORIES.has(category)) {
    return 'not_subscription'
  }

  const text = `${merchantName || ''} ${category || ''}`.toLowerCase()
  const hasSubscriptionKeyword = SUBSCRIPTION_KEYWORDS.some((kw) => text.includes(kw))

  if (
    category === CATEGORIES.ENTERTAINMENT ||
    category === CATEGORIES.SUBSCRIPTION ||
    hasSubscriptionKeyword
  ) {
    return 'likely_subscription'
  }

  if (
    recurringGroup.frequency === 'MONTHLY' &&
    recurringGroup.confidence >= 60 &&
    category !== CATEGORIES.BANKING &&
    category !== CATEGORIES.TRANSPORT &&
    category !== CATEGORIES.FOOD
  ) {
    return 'possible_subscription'
  }

  return 'not_subscription'
}

function detectRecurringPayments(transactions) {
  const debits = (transactions || []).filter((txn) => txn && typeof txn.amount === 'number' && txn.amount < 0)

  // Group by normalized merchant
  const groups = new Map()

  for (const txn of debits) {
    const merchant = normalizeMerchant(txn.description)
    if (!merchant || merchant === 'unknown') {
      continue
    }

    if (!groups.has(merchant)) {
      groups.set(merchant, [])
    }
    groups.get(merchant).push(txn)
  }

  const recurringPayments = []
  const recurringLookup = new Map() // merchant -> recurringDetails

  for (const [merchant, txns] of groups.entries()) {
    if (txns.length < MIN_RECURRING_OCCURRENCES) {
      continue
    }

    // Sort chronologically
    const datedTxns = txns
      .map((t) => ({ txn: t, timestamp: parseTimestamp(t.date) }))
      .filter((t) => t.timestamp !== null)
      .sort((a, b) => a.timestamp - b.timestamp)

    const amounts = txns.map((t) => Math.abs(t.amount))
    const minAmount = Math.min(...amounts)
    const maxAmount = Math.max(...amounts)
    const avgAmount = calculateAverage(amounts)
    const amountVariance = calculateVariance(amounts, avgAmount)
    const amountVariation = Number((maxAmount - minAmount).toFixed(2))

    // Calculate intervals between consecutive transactions in days
    const intervals = []
    for (let i = 1; i < datedTxns.length; i++) {
      const diffMs = datedTxns[i].timestamp - datedTxns[i - 1].timestamp
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays >= 0) {
        intervals.push(diffDays)
      }
    }

    const intervalData = estimateFrequency(intervals)
    const amountData = { minAmount, maxAmount, avgAmount, amountVariance, amountVariation }
    const confidence = calculateRecurrenceConfidence(txns.length, intervalData, amountData)

    const windowConfig = FREQUENCY_WINDOWS[intervalData.frequency] || {
      monthlyMultiplier: 1,
      annualMultiplier: 12,
    }
    const estimatedMonthlyCost = Number((avgAmount * windowConfig.monthlyMultiplier).toFixed(2))
    const estimatedAnnualCost = Number((avgAmount * windowConfig.annualMultiplier).toFixed(2))

    const sampleCategory = categorizeTransaction(txns[0].description, merchant)
    const recurringGroup = {
      merchant,
      occurrences: txns.length,
      averageAmount: Number(avgAmount.toFixed(2)),
      minimumAmount: Number(minAmount.toFixed(2)),
      maximumAmount: Number(maxAmount.toFixed(2)),
      amountVariation,
      frequency: intervalData.frequency,
      averageInterval: intervalData.avgInterval,
      estimatedMonthlyCost,
      estimatedAnnualCost,
      confidence,
      category: sampleCategory,
      transactionIds: txns.map((t) => t.id),
    }

    recurringGroup.subscriptionStatus = determineSubscriptionStatus(
      merchant,
      sampleCategory,
      recurringGroup
    )

    recurringPayments.push(recurringGroup)
    recurringLookup.set(merchant, recurringGroup)
  }

  // Sort by estimated monthly cost descending
  recurringPayments.sort((a, b) => b.estimatedMonthlyCost - a.estimatedMonthlyCost)

  return {
    recurringPayments,
    recurringLookup,
  }
}

module.exports = {
  detectRecurringPayments,
  determineSubscriptionStatus,
  calculateRecurrenceConfidence,
  estimateFrequency,
  MIN_RECURRING_OCCURRENCES,
  FREQUENCY_WINDOWS,
}
