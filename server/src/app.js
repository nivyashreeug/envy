const express = require('express')
const cors = require('cors')
const multer = require('multer')
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const helmet = require('helmet')
const compression = require('compression')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const { RedisStore } = require('rate-limit-redis')
const Redis = require('ioredis')
const path = require('path')
const fs = require('fs')
const FeeReport = require('./models/FeeReport')
const { createUser, findUserByEmail } = require('./utils/authStore')
const { requireAuth, signAuthToken, toPublicUser } = require('./middleware/auth')
const { parseStatementFile } = require('./utils/parseStatement')
const { analyzeTransactions } = require('./utils/analyzeFees')
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler')

const TEN_MB = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['csv', 'pdf'])
const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'text/plain',
  'application/csv',
  'text/x-csv',
  'application/x-csv',
  'text/comma-separated-values',
  'text/x-comma-separated-values',
  'application/pdf',
  'application/x-pdf',
  'application/acrobat',
  'applications/vnd.pdf',
  'text/pdf',
  'application/octet-stream',
])
const MIN_PASSWORD_LENGTH = 8
const MAX_STRING_LENGTH = 254
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= MAX_STRING_LENGTH && EMAIL_REGEX.test(email)
}

function getAllowedOrigins() {
  const origins = process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN || 'http://localhost:5173'
  return origins
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function isLocalDevOrigin(origin) {
  if (!origin || process.env.NODE_ENV === 'production') {
    return false
  }

  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
}

function getRateLimitConfig(customOptions = {}) {
  const isTest = process.env.NODE_ENV === 'test'
  const config = {
    windowMs: customOptions.windowMs || 15 * 60 * 1000,
    max: isTest ? 10000 : Number(customOptions.max || process.env.RATE_LIMIT_MAX || 120),
    standardHeaders: true,
    legacyHeaders: false,
    ...customOptions,
  }

  if (isTest || !process.env.REDIS_URL) {
    return config
  }

  try {
    const redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    })

    config.store = new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
    })
  } catch (error) {
    console.warn('Redis rate limit store unavailable. Falling back to in-memory limiter.')
  }

  return config
}

const authLimiter = rateLimit(
  getRateLimitConfig({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),
    message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
  })
)

const analyzeLimiter = rateLimit(
  getRateLimitConfig({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.ANALYZE_RATE_LIMIT_MAX || 60),
    message: { error: 'Upload rate limit exceeded. Please try again later.' },
  })
)

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: TEN_MB },
  fileFilter: (req, file, callback) => {
    const extension = (file.originalname.split('.').pop() || '').toLowerCase()
    const mime = (file.mimetype || '').toLowerCase()

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return callback(new Error('Unsupported file format. Please upload CSV or PDF.'))
    }

    if (mime && !ALLOWED_MIME_TYPES.has(mime) && !mime.includes('csv') && !mime.includes('pdf')) {
      return callback(new Error('Invalid file type. Only CSV and PDF files are allowed.'))
    }

    return callback(null, true)
  },
})

function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(compression())
  app.use(rateLimit(getRateLimitConfig()))

  app.use(
    cors({
      origin: (origin, callback) => {
        const allowedOrigins = getAllowedOrigins()

        if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
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

  app.get('/', (req, res) => {
    res.json({
      status: 'ok',
      message: 'Envy API is running',
      routes: ['/api/health', '/api/auth/register', '/api/auth/login', '/api/analyze'],
    })
  })

  app.get('/api', (req, res) => {
    res.json({
      status: 'ok',
      message: 'Use GET /api/health, POST /api/auth/register, POST /api/auth/login, or POST /api/analyze',
    })
  })

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      message: 'Envy API is live',
      uptime: Math.round(process.uptime()),
    })
  })

  app.post('/api/auth/register', authLimiter, async (req, res, next) => {
    try {
      const name = String(req.body?.name || '').trim()
      const email = String(req.body?.email || '').trim().toLowerCase()
      const password = String(req.body?.password || '').trim()

      if (!name || !email || !password) {
        res.status(400)
        throw new Error('Name, email, and password are required.')
      }

      if (!isValidEmail(email)) {
        res.status(400)
        throw new Error('Please provide a valid email address.')
      }

      if (password.length < MIN_PASSWORD_LENGTH) {
        res.status(400)
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      }

      const passwordHash = await bcrypt.hash(password, 12)
      const user = await createUser({ name, email, passwordHash })
      const token = signAuthToken(user.id || user._id)

      return res.status(201).json({
        token,
        user: toPublicUser(user),
      })
    } catch (error) {
      if (error.code === 'DUPLICATE_EMAIL') {
        res.status(409)
      } else if (/Authentication store unavailable/i.test(error.message || '')) {
        res.status(503)
      }

      return next(error)
    }
  })

  app.post('/api/auth/login', authLimiter, async (req, res, next) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase()
      const password = String(req.body?.password || '').trim()

      if (!email || !password) {
        res.status(400)
        throw new Error('Email and password are required.')
      }

      const user = await findUserByEmail(email)

      if (!user) {
        res.status(401)
        throw new Error('Invalid email or password.')
      }

      const passwordMatches = await bcrypt.compare(password, user.passwordHash)

      if (!passwordMatches) {
        res.status(401)
        throw new Error('Invalid email or password.')
      }

      const token = signAuthToken(user.id || user._id)
      return res.json({
        token,
        user: toPublicUser(user),
      })
    } catch (error) {
      if (/Authentication store unavailable/i.test(error.message || '')) {
        res.status(503)
      }

      return next(error)
    }
  })

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: req.auth.user })
  })

  app.post('/api/analyze', analyzeLimiter, requireAuth, upload.single('statement'), async (req, res, next) => {
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
          insights: report.insights,
          anomalies: report.anomalies,
          timeline: report.timeline,
          categories: report.categories,
          recurringPayments: report.recurringPayments,
          subscriptions: report.subscriptions,
          riskSummary: report.riskSummary,
          potentialSavings: report.potentialSavings,
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
