const mongoose = require('mongoose')

const feeReportSchema = new mongoose.Schema(
  {
    generatedAt: { type: Date, default: Date.now },
    fileType: { type: String, enum: ['csv', 'pdf'], required: true },
    totals: {
      recoverableFees: Number,
      hiddenFees: Number,
      transparentSpending: Number,
      flaggedTransactions: Number,
      scannedTransactions: Number,
    },
    wallOfShame: [
      {
        merchant: String,
        total: Number,
      },
    ],
    monthlyTrend: [
      {
        month: String,
        total: Number,
      },
    ],
    insights: {
      topFeeSource: {
        merchant: String,
        total: Number,
        count: Number,
        share: Number,
      },
      averageHiddenFeePerTransaction: Number,
      repeatOffenderMerchants: Number,
      repeatOffenderMerchantList: [
        {
          merchant: String,
          total: Number,
          count: Number,
          share: Number,
        },
      ],
      feeConcentrationPercentage: Number,
    },
    anomalies: {
      suspiciousActivities: [
        {
          type: String,
          badge: String,
          severity: String,
          merchant: String,
          amount: Number,
          count: Number,
          date: String,
          message: String,
        },
      ],
      suspiciousMerchants: [
        {
          merchant: String,
          badge: String,
          severity: String,
        },
      ],
      unusualSpikeMerchantCount: Number,
      repeatedMicroDebitMerchants: Number,
      newMerchantCount: Number,
      heavyFeeDays: Number,
    },
    timeline: {
      dailyHiddenFees: [
        {
          date: String,
          month: String,
          day: Number,
          weekday: Number,
          total: Number,
          count: Number,
          microDebitCount: Number,
          level: Number,
          isHeavy: Boolean,
        },
      ],
      calendarStart: String,
      calendarEnd: String,
      maxDailyHiddenFee: Number,
    },
  },
  { minimize: true }
)

module.exports = mongoose.model('FeeReport', feeReportSchema)
