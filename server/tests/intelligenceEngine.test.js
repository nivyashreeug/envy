const { analyzeTransactions } = require('../src/utils/analyzeFees')
const {
  categorizeTransaction,
  normalizeMerchant,
  CATEGORIES,
  CLASSIFICATIONS,
} = require('../src/utils/transactionClassifier')
const {
  detectRecurringPayments,
  estimateFrequency,
  calculateRecurrenceConfidence,
} = require('../src/utils/recurringDetector')
const { detectSpendingAnomalies, getStats } = require('../src/utils/anomalyDetector')
const { calculateRiskAndExplanation } = require('../src/utils/riskScorer')
const { calculatePotentialSavings } = require('../src/utils/savingsEstimator')

describe('Financial Intelligence Engine', () => {
  // Test 1: Normal transaction
  describe('1. Normal Transaction', () => {
    it('classifies normal grocery purchases as NORMAL_EXPENSE with LOW risk', () => {
      const transactions = [
        { id: '1', date: '2026-03-01', description: 'Whole Foods Market', amount: -45.5 },
      ]
      const report = analyzeTransactions(transactions)
      const insight = report.transactionInsights[0]

      expect(insight.category).toBe(CATEGORIES.FOOD)
      expect(insight.classification).toBe(CLASSIFICATIONS.NORMAL_EXPENSE)
      expect(insight.riskScore).toBeLessThan(40)
      expect(insight.riskLevel).toBe('LOW')
      expect(insight.reasons.length).toBeGreaterThan(0)
    })
  })

  // Test 2: Bank fee
  describe('2. Bank Fee Detection', () => {
    it('detects ATM fee, service charge, and overdraft fees with explainable reason', () => {
      const transactions = [
        { id: '1', date: '2026-03-02', description: 'Out of Network ATM Fee', amount: -3.5 },
        { id: '2', date: '2026-03-05', description: 'Monthly Account Service Charge', amount: -12.0 },
        { id: '3', date: '2026-03-10', description: 'Overdraft Fee', amount: -35.0 },
      ]
      const report = analyzeTransactions(transactions)

      for (const insight of report.transactionInsights) {
        expect(insight.classification).toBe(CLASSIFICATIONS.BANK_FEE)
        expect(insight.isFee).toBe(true)
        expect(insight.riskScore).toBeGreaterThanOrEqual(40)
        expect(insight.reasons.some((r) => r.toLowerCase().includes('fee') || r.toLowerCase().includes('charge'))).toBe(true)
      }
    })
  })

  // Test 3: Recurring transaction (weekly, monthly, quarterly)
  describe('3. Recurring Transaction Detection', () => {
    it('detects monthly recurring intervals accurately', () => {
      const transactions = [
        { id: '1', date: '2026-01-05', description: 'Co-Working Space', amount: -150.0 },
        { id: '2', date: '2026-02-05', description: 'Co-Working Space', amount: -150.0 },
        { id: '3', date: '2026-03-05', description: 'Co-Working Space', amount: -150.0 },
      ]
      const report = analyzeTransactions(transactions)

      expect(report.recurringPayments.length).toBe(1)
      const rec = report.recurringPayments[0]
      expect(rec.frequency).toBe('MONTHLY')
      expect(rec.occurrences).toBe(3)
      expect(rec.averageAmount).toBe(150.0)
      expect(rec.estimatedMonthlyCost).toBe(150.0)
      expect(rec.estimatedAnnualCost).toBe(1800.0)
      expect(rec.confidence).toBeGreaterThanOrEqual(60)
    })

    it('detects weekly recurring cadence', () => {
      const intervals = [7, 7, 7]
      const freq = estimateFrequency(intervals)
      expect(freq.frequency).toBe('WEEKLY')
      expect(freq.avgInterval).toBe(7.0)
    })

    it('detects quarterly recurring cadence', () => {
      const intervals = [91, 89]
      const freq = estimateFrequency(intervals)
      expect(freq.frequency).toBe('QUARTERLY')
    })
  })

  // Test 4: Non-recurring transaction
  describe('4. Non-recurring Transaction', () => {
    it('does not flag single one-off transactions as recurring', () => {
      const transactions = [
        { id: '1', date: '2026-03-01', description: 'Hardware Store Purchase', amount: -89.99 },
        { id: '2', date: '2026-03-04', description: 'Pharmacy Prescription', amount: -22.5 },
      ]
      const report = analyzeTransactions(transactions)

      expect(report.recurringPayments).toHaveLength(0)
      expect(report.subscriptions).toHaveLength(0)
      expect(report.transactionInsights[0].recurringInfo).toBeNull()
    })
  })

  // Test 5: Likely subscription
  describe('5. Likely Subscription Detection', () => {
    it('classifies recurring streaming and cloud services as LIKELY_SUBSCRIPTION', () => {
      const transactions = [
        { id: '1', date: '2026-01-15', description: 'Netflix Subscription', amount: -15.99 },
        { id: '2', date: '2026-02-15', description: 'Netflix Subscription', amount: -15.99 },
        { id: '3', date: '2026-03-15', description: 'Netflix Subscription', amount: -15.99 },
      ]
      const report = analyzeTransactions(transactions)

      expect(report.subscriptions.length).toBe(1)
      expect(report.subscriptions[0].subscriptionStatus).toBe('likely_subscription')
      const insight = report.transactionInsights[0]
      expect(insight.classification).toBe(CLASSIFICATIONS.LIKELY_SUBSCRIPTION)
      expect(insight.category).toBe(CATEGORIES.ENTERTAINMENT)
    })
  })

  // Test 6: Insurance recurring payment not classified as subscription
  describe('6. Insurance Discrimination', () => {
    it('classifies recurring insurance payments as RECURRING_PAYMENT with not_subscription status', () => {
      const transactions = [
        { id: '1', date: '2026-01-01', description: 'Geico Auto Insurance Policy', amount: -110.0 },
        { id: '2', date: '2026-02-01', description: 'Geico Auto Insurance Policy', amount: -110.0 },
        { id: '3', date: '2026-03-01', description: 'Geico Auto Insurance Policy', amount: -110.0 },
      ]
      const report = analyzeTransactions(transactions)

      expect(report.recurringPayments.length).toBe(1)
      expect(report.recurringPayments[0].subscriptionStatus).toBe('not_subscription')
      expect(report.subscriptions.length).toBe(0) // Should NOT be in subscriptions
      expect(report.transactionInsights[0].category).toBe(CATEGORIES.INSURANCE)
    })
  })

  // Test 7: Micro-debit repeated detection
  describe('7. Micro-Debit Detection', () => {
    it('identifies repeated small debits under $5.00 with merchant consistency', () => {
      const transactions = [
        { id: '1', date: '2026-03-01', description: 'Micro Service Fee', amount: -1.5 },
        { id: '2', date: '2026-03-05', description: 'Micro Service Fee', amount: -1.5 },
        { id: '3', date: '2026-03-10', description: 'Micro Service Fee', amount: -1.5 },
      ]
      const report = analyzeTransactions(transactions)

      for (const insight of report.transactionInsights) {
        expect(insight.isMicroDebit).toBe(true)
        expect(insight.microDebitInfo.count).toBe(3)
        expect(insight.microDebitInfo.totalAmount).toBe(4.5)
      }
    })
  })

  // Test 8: Unusual transaction detection
  describe('8. Unusual Transaction / Anomaly Detection', () => {
    it('flags statistical outliers when dataset has sufficient history', () => {
      const transactions = [
        { id: '1', date: '2026-03-01', description: 'Coffee', amount: -4.5 },
        { id: '2', date: '2026-03-02', description: 'Lunch', amount: -12.0 },
        { id: '3', date: '2026-03-03', description: 'Snack', amount: -6.0 },
        { id: '4', date: '2026-03-04', description: 'Groceries', amount: -18.0 },
        { id: '5', date: '2026-03-05', description: 'Coffee', amount: -5.0 },
        { id: '6', date: '2026-03-06', description: 'High End Electronics Store', amount: -850.0 },
      ]
      const report = analyzeTransactions(transactions)
      const outlier = report.transactionInsights.find((t) => t.id === '6')

      expect(outlier).toBeDefined()
      expect(outlier.riskScore).toBeGreaterThanOrEqual(40)
      expect(outlier.reasons.some((r) => r.includes('Unusually large'))).toBe(true)
    })
  })

  // Test 9: Risk score boundaries
  describe('9. Risk Score Boundaries and Levels', () => {
    it('strictly clamps risk score between 0 and 100 with valid risk levels', () => {
      const highRiskTxn = {
        transaction: { id: '1', date: '2026-03-01', description: 'Overdraft Fee Penalty', amount: -500 },
        normalizedMerchant: 'penalty',
        category: CATEGORIES.BANKING,
        bankFeeReason: 'Overdraft / NSF fee detected',
        recurringInfo: { confidence: 90, subscriptionStatus: 'likely_subscription', occurrences: 10, frequency: 'MONTHLY', amountVariation: 0 },
        isStatisticalAnomaly: true,
        microDebitInfo: { count: 5 },
        totalTransactionsCount: 20,
        datasetStats: { avg: 20 },
      }
      const result = calculateRiskAndExplanation(highRiskTxn)

      expect(result.riskScore).toBeGreaterThanOrEqual(0)
      expect(result.riskScore).toBeLessThanOrEqual(100)
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.riskLevel)
    })
  })

  // Test 10: Confidence calculation
  describe('10. Confidence Score Calculation', () => {
    it('assigns higher confidence when supporting evidence and transaction history are strong', () => {
      const lowEvidence = calculateRiskAndExplanation({
        transaction: { id: '1', date: '2026-03-01', description: 'Corner Store', amount: -10 },
        normalizedMerchant: 'corner store',
        category: CATEGORIES.OTHER,
        bankFeeReason: null,
        recurringInfo: null,
        isStatisticalAnomaly: false,
        microDebitInfo: null,
        totalTransactionsCount: 1,
        datasetStats: { avg: 10 },
      })

      const highEvidence = calculateRiskAndExplanation({
        transaction: { id: '2', date: '2026-03-01', description: 'Overdraft Charge', amount: -35 },
        normalizedMerchant: 'overdraft charge',
        category: CATEGORIES.BANKING,
        bankFeeReason: 'Overdraft / NSF fee detected',
        recurringInfo: { confidence: 95, subscriptionStatus: 'likely_subscription', occurrences: 6, frequency: 'MONTHLY', amountVariation: 0 },
        isStatisticalAnomaly: false,
        microDebitInfo: null,
        totalTransactionsCount: 15,
        datasetStats: { avg: 30 },
      })

      expect(highEvidence.confidence).toBeGreaterThan(lowEvidence.confidence)
      expect(highEvidence.confidence).toBeLessThanOrEqual(100)
    })
  })

  // Test 11: Structured reasons generation
  describe('11. Structured Reasoning', () => {
    it('provides factual, non-empty reasons explaining the classification', () => {
      const transactions = [
        { id: '1', date: '2026-03-01', description: 'Monthly Maintenance Service Charge', amount: -15.0 },
      ]
      const report = analyzeTransactions(transactions)
      const insight = report.transactionInsights[0]

      expect(Array.isArray(insight.reasons)).toBe(true)
      expect(insight.reasons.length).toBeGreaterThan(0)
      expect(typeof insight.reasons[0]).toBe('string')
    })
  })

  // Test 12: Empty dataset
  describe('12. Empty Dataset Handling', () => {
    it('handles empty transaction lists without throwing exceptions', () => {
      const report = analyzeTransactions([])

      expect(report.totals.scannedTransactions).toBe(0)
      expect(report.totals.totalSpent).toBe(0)
      expect(report.transactionInsights).toEqual([])
      expect(report.recurringPayments).toEqual([])
      expect(report.subscriptions).toEqual([])
      expect(report.categories).toEqual([])
      expect(report.potentialSavings.monthlyEstimate).toBe(0)
    })
  })

  // Test 13: Very small dataset
  describe('13. Very Small Dataset Handling', () => {
    it('safely evaluates 1-2 transactions without false anomaly alerts', () => {
      const transactions = [
        { id: '1', date: '2026-03-01', description: 'Book Purchase', amount: -25.0 },
        { id: '2', date: '2026-03-02', description: 'Lunch', amount: -15.0 },
      ]
      const report = analyzeTransactions(transactions)

      expect(report.totals.scannedTransactions).toBe(2)
      for (const insight of report.transactionInsights) {
        expect(insight.classification).not.toBe(CLASSIFICATIONS.UNUSUAL_TRANSACTION)
      }
    })
  })

  // Test 14: Missing merchant / description
  describe('14. Missing / Malformed Merchant and Description', () => {
    it('gracefully handles missing or empty descriptions', () => {
      const transactions = [
        { id: '1', date: '2026-03-01', description: '', amount: -10.0 },
        { id: '2', date: '2026-03-02', description: null, amount: -20.0 },
      ]
      const report = analyzeTransactions(transactions)

      expect(report.transactionInsights[0].category).toBe(CATEGORIES.OTHER)
      expect(report.transactionInsights[1].category).toBe(CATEGORIES.OTHER)
      expect(report.transactionInsights[0].normalizedMerchant).toBe('unknown')
    })
  })

  // Test 15: Different transaction amounts
  describe('15. Varying Amounts in Recurrence', () => {
    it('computes min, max, avg, and variation accurately', () => {
      const transactions = [
        { id: '1', date: '2026-01-10', description: 'Cloud Provider', amount: -40.0 },
        { id: '2', date: '2026-02-10', description: 'Cloud Provider', amount: -50.0 },
        { id: '3', date: '2026-03-10', description: 'Cloud Provider', amount: -60.0 },
      ]
      const report = analyzeTransactions(transactions)

      expect(report.recurringPayments.length).toBe(1)
      const rec = report.recurringPayments[0]
      expect(rec.minimumAmount).toBe(40.0)
      expect(rec.maximumAmount).toBe(60.0)
      expect(rec.averageAmount).toBe(50.0)
      expect(rec.amountVariation).toBe(20.0)
    })
  })

  // Test 16: Irregular recurring intervals
  describe('16. Irregular Intervals', () => {
    it('classifies sporadic transactions as IRREGULAR frequency', () => {
      const intervals = [3, 45, 120]
      const freq = estimateFrequency(intervals)
      expect(freq.frequency).toBe('IRREGULAR')
    })
  })

  // Test 17: Duplicate transactions
  describe('17. Duplicate Transactions', () => {
    it('handles identical dates and amounts safely without crashes', () => {
      const transactions = [
        { id: '1', date: '2026-03-01', description: 'Coffee Shop', amount: -4.5 },
        { id: '2', date: '2026-03-01', description: 'Coffee Shop', amount: -4.5 },
      ]
      const report = analyzeTransactions(transactions)

      expect(report.totals.scannedTransactions).toBe(2)
      expect(report.totals.totalSpent).toBe(9.0)
    })
  })

  // Test 18: Malformed / Invalid transaction data
  describe('18. Malformed Transaction Data', () => {
    it('safely handles non-array inputs, undefined fields, and non-numeric amounts', () => {
      expect(() => analyzeTransactions(null)).not.toThrow()
      expect(() => analyzeTransactions(undefined)).not.toThrow()
      expect(() =>
        analyzeTransactions([
          { id: '1', date: 'invalid-date', description: 'Invalid', amount: 'not-a-number' },
        ])
      ).not.toThrow()
    })
  })

  // Test 19: Categories Breakdown
  describe('19. Category Distribution Aggregation', () => {
    it('groups spending across standard categories and calculates share percentage', () => {
      const transactions = [
        { id: '1', date: '2026-03-01', description: 'Uber Ride', amount: -20.0 },
        { id: '2', date: '2026-03-02', description: 'Starbucks Coffee', amount: -5.0 },
        { id: '3', date: '2026-03-03', description: 'Amazon Shopping', amount: -75.0 },
      ]
      const report = analyzeTransactions(transactions)

      expect(report.categories.length).toBeGreaterThanOrEqual(3)
      const totalShare = report.categories.reduce((sum, c) => sum + c.share, 0)
      expect(Math.round(totalShare)).toBe(100)
    })
  })

  // Test 20: Potential Savings
  describe('20. Potential Savings Calculation', () => {
    it('aggregates direct fees and micro-debits with transparent disclaimers', () => {
      const transactions = [
        { id: '1', date: '2026-03-01', description: 'Late Payment Fee', amount: -25.0 },
        { id: '2', date: '2026-03-05', description: 'Service Charge', amount: -5.0 },
      ]
      const report = analyzeTransactions(transactions)

      expect(report.potentialSavings.monthlyEstimate).toBe(30.0)
      expect(report.potentialSavings.annualEstimate).toBe(360.0)
      expect(report.potentialSavings.contributingCount).toBe(2)
      expect(report.potentialSavings.disclaimer).toBeTruthy()
    })
  })
})
