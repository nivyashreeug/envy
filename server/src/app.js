const express = require('express')
const cors = require('cors')
const multer = require('multer')
const mongoose = require('mongoose')
const helmet = require('helmet')
const compression = require('compression')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const path = require('path')
const fs = require('fs')
const FeeReport = require('./models/FeeReport')
const { parseStatementFile } = require('./utils/parseStatement')
const { analyzeTransactions } = require('./utils/analyzeFees')
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler')

const TEN_MB = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['csv', 'pdf'])

function getAllowedOrigins() {
  const origins = process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN || 'http://localhost:5173'
  return origins
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: TEN_MB },
  fileFilter: (req, file, callback) => {
    const extension = (file.originalname.split('.').pop() || '').toLowerCase()

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return callback(new Error('Unsupported file format. Please upload CSV or PDF.'))
    }

    return callback(null, true)
  },
})

function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(compression())
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: Number(process.env.RATE_LIMIT_MAX || 120),
      standardHeaders: true,
      legacyHeaders: false,
    })
  )

  app.use(
    cors({
      origin: (origin, callback) => {
        const allowedOrigins = getAllowedOrigins()

        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true)
        }

        return callback(new Error('Origin is not allowed by CORS'))
      },
    })
  )

  app.use(express.json({ limit: '1mb' }))

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
  }

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      message: 'Invisible Fee Tracker API is live',
      uptime: Math.round(process.uptime()),
    })
  })

  app.post('/api/analyze', upload.single('statement'), async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400)
        throw new Error('Please upload a CSV or PDF statement.')
      }

      const transactions = await parseStatementFile(req.file)

      if (!transactions.length) {
        res.status(400)
        throw new Error('No transactions found in the uploaded file.')
      }

      const report = analyzeTransactions(transactions)

      // Persist only aggregate analytics; never store raw transactions or account identifiers.
      if (mongoose.connection.readyState === 1) {
        const ext = (req.file.originalname.split('.').pop() || '').toLowerCase()
        await FeeReport.create({
          fileType: ext === 'pdf' ? 'pdf' : 'csv',
          totals: report.totals,
          wallOfShame: report.wallOfShame,
          monthlyTrend: report.monthlyTrend,
        })
      }

      return res.json(report)
    } catch (error) {
      return next(error)
    }
  })

  const clientDistPath = path.resolve(__dirname, '../../client/dist')
  if (process.env.NODE_ENV === 'production' && fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath))

    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDistPath, 'index.html'))
    })
  }

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

module.exports = { createApp }
