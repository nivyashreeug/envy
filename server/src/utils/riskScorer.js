const { detectBankFeeReason, FEE_KEYWORDS } = require('./feeKeywords')
const { CLASSIFICATIONS } = require('./transactionClassifier')

function calculateRiskAndExplanation({
  transaction,
  normalizedMerchant,
  category,
  bankFeeReason,
  recurringInfo,
  isStatisticalAnomaly,
  microDebitInfo,
  totalTransactionsCount,
  datasetStats,
}) {
  const reasons = []
  let riskScore = 0
  let evidencePoints = 0

  const absAmount = Math.abs(transaction.amount || 0)
  const isDebit = (transaction.amount || 0) < 0

  // 1. Bank Fee Signal
  if (bankFeeReason) {
    riskScore += 45
    evidencePoints += 40
    reasons.push(`Bank fee pattern identified: ${bankFeeReason}`)
  } else {
    const descLower = (transaction.description || '').toLowerCase()
    const matchedKw = FEE_KEYWORDS.find((kw) => descLower.includes(kw))
    if (matchedKw) {
      riskScore += 35
      evidencePoints += 30
      reasons.push(`Description contains fee keyword '${matchedKw}'`)
    }
  }

  // 2. Micro-Debit Signal
  if (microDebitInfo && microDebitInfo.count >= 2 && absAmount <= 5.0 && isDebit) {
    if (microDebitInfo.count >= 3) {
      riskScore += 25
      evidencePoints += 25
      reasons.push(
        `Repeated micro-debit pattern: merchant appeared ${microDebitInfo.count} times with amounts under $5.00`
      )
    } else {
      riskScore += 15
      evidencePoints += 15
      reasons.push(`Small debit under $5.00 with ${microDebitInfo.count} occurrences`)
    }
  }

  // 3. Recurring & Subscription Signal
  if (recurringInfo) {
    evidencePoints += Math.round((recurringInfo.confidence || 50) * 0.4)

    if (recurringInfo.subscriptionStatus === 'likely_subscription') {
      riskScore += 10
      reasons.push(
        `Likely active subscription: ${recurringInfo.occurrences} occurrences with ${recurringInfo.frequency.toLowerCase()} cadence`
      )
    } else if (recurringInfo.frequency !== 'IRREGULAR' && recurringInfo.frequency !== 'UNKNOWN') {
      reasons.push(
        `Recurring ${recurringInfo.frequency.toLowerCase()} payment pattern across ${recurringInfo.occurrences} transactions`
      )
    }

    if (recurringInfo.amountVariation <= 1.0 && recurringInfo.occurrences >= 3) {
      reasons.push(`Fixed-amount consistency across billing cycles (variation: $${recurringInfo.amountVariation})`)
    }
  }

  // 4. Statistical Spending Anomaly Signal
  if (isStatisticalAnomaly && datasetStats && datasetStats.avg > 0) {
    const multiplier = absAmount / datasetStats.avg
    if (multiplier >= 3) {
      riskScore += 40
      evidencePoints += 30
      reasons.push(
        `Unusually large transaction ($${absAmount.toFixed(2)}) is ${multiplier.toFixed(1)}x higher than average spending ($${datasetStats.avg.toFixed(2)})`
      )
    } else {
      riskScore += 25
      evidencePoints += 20
      reasons.push(
        `Unusually large transaction ($${absAmount.toFixed(2)}) compared to average spending ($${datasetStats.avg.toFixed(2)})`
      )
    }
  }

  // 5. Positive credit / transfer sanity
  if (!isDebit) {
    riskScore = Math.max(0, riskScore - 30)
    reasons.push('Transaction is an income / credit or deposit')
  }

  // Base confidence calculation from sample size and evidence
  let confidence = 20 // Default baseline

  if (totalTransactionsCount >= 10) confidence += 20
  else if (totalTransactionsCount >= 4) confidence += 10

  confidence += evidencePoints

  if (reasons.length === 0) {
    reasons.push('Standard everyday transaction with no anomalous or fee-like indicators')
    confidence = Math.min(60, confidence)
  }

  // Clamping
  const clampedRiskScore = Math.min(100, Math.max(0, Math.round(riskScore)))
  const clampedConfidence = Math.min(100, Math.max(10, Math.round(confidence)))

  let riskLevel = 'LOW'
  if (clampedRiskScore >= 70) {
    riskLevel = 'HIGH'
  } else if (clampedRiskScore >= 40) {
    riskLevel = 'MEDIUM'
  }

  // Determine primary classification
  let classification = CLASSIFICATIONS.NORMAL_EXPENSE

  if (bankFeeReason || (reasons.some((r) => r.includes('fee keyword')) && isDebit)) {
    classification = CLASSIFICATIONS.BANK_FEE
  } else if (recurringInfo?.subscriptionStatus === 'likely_subscription') {
    classification = CLASSIFICATIONS.LIKELY_SUBSCRIPTION
  } else if (recurringInfo && recurringInfo.occurrences >= 2) {
    classification = CLASSIFICATIONS.RECURRING_PAYMENT
  } else if (microDebitInfo?.count >= 3 && absAmount <= 5.0 && isDebit) {
    classification = CLASSIFICATIONS.MICRO_DEBIT
  } else if (isStatisticalAnomaly) {
    classification = CLASSIFICATIONS.UNUSUAL_TRANSACTION
  } else if (clampedRiskScore >= 40) {
    classification = CLASSIFICATIONS.POTENTIAL_HIDDEN_CHARGE
  }

  return {
    riskScore: clampedRiskScore,
    riskLevel,
    confidence: clampedConfidence,
    classification,
    reasons,
  }
}

module.exports = {
  calculateRiskAndExplanation,
}
