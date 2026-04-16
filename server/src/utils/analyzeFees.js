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
  const transparentSpending = transparent
    .filter((txn) => txn.amount < 0)
    .reduce((sum, txn) => sum + Math.abs(txn.amount), 0)

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

  return {
    totals: {
      recoverableFees: Number(hiddenFees.toFixed(2)),
      hiddenFees: Number(hiddenFees.toFixed(2)),
      transparentSpending: Number(transparentSpending.toFixed(2)),
      flaggedTransactions: hidden.length,
      scannedTransactions: transactions.length,
    },
    wallOfShame: byMerchant,
    monthlyTrend,
  }
}

module.exports = { analyzeTransactions }
