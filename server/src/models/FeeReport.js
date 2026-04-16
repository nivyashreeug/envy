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
  },
  { minimize: true }
)

module.exports = mongoose.model('FeeReport', feeReportSchema)
