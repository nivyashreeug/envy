function calculatePotentialSavings({ transactions, transactionInsights }) {
  const contributingTransactions = []
  let directFeeSavings = 0
  let microDebitFeeSavings = 0

  for (const insight of transactionInsights || []) {
    const amount = Math.abs(insight.amount || 0)

    if (insight.classification === 'BANK_FEE' || insight.isFee) {
      directFeeSavings += amount
      contributingTransactions.push({
        id: insight.id,
        merchant: insight.normalizedMerchant || insight.description,
        amount: Number(amount.toFixed(2)),
        type: 'BANK_FEE',
        reason: insight.reasons?.[0] || 'Direct bank fee or surcharge',
      })
    } else if (
      insight.classification === 'MICRO_DEBIT' &&
      insight.microDebitInfo?.count >= 3
    ) {
      microDebitFeeSavings += amount
      contributingTransactions.push({
        id: insight.id,
        merchant: insight.normalizedMerchant || insight.description,
        amount: Number(amount.toFixed(2)),
        type: 'MICRO_DEBIT',
        reason: 'Repeated micro-debit fee pattern',
      })
    }
  }

  // Deduplicate contributing transactions by ID
  const uniqueContributors = []
  const seenIds = new Set()
  for (const item of contributingTransactions) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id)
      uniqueContributors.push(item)
    }
  }

  const totalIdentified = directFeeSavings + microDebitFeeSavings

  // If statement covers multiple months or less, calculate monthly estimate
  const monthlyEstimate = Number(totalIdentified.toFixed(2))
  const annualEstimate = Number((monthlyEstimate * 12).toFixed(2))

  return {
    monthlyEstimate,
    annualEstimate,
    contributingCount: uniqueContributors.length,
    contributingTransactions: uniqueContributors.slice(0, 15),
    disclaimer:
      'Estimated potential savings are calculated from identified bank fees, surcharges, and recurring fee patterns. This is an automated estimate for informational purposes only.',
  }
}

module.exports = {
  calculatePotentialSavings,
}
