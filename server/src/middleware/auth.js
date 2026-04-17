const jwt = require('jsonwebtoken')
const { findUserById } = require('../utils/authStore')

function getJwtSecret() {
  const secret = process.env.AUTH_JWT_SECRET

  if (secret) {
    return secret
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_JWT_SECRET is required in production.')
  }

  return 'envy-dev-secret-change-me'
}

function signAuthToken(userId) {
  return jwt.sign(
    { sub: String(userId), typ: 'access' },
    getJwtSecret(),
    { expiresIn: process.env.AUTH_JWT_EXPIRES_IN || '7d' }
  )
}

function extractBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') {
    return null
  }

  const [scheme, token] = headerValue.split(' ')

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
}

function toPublicUser(user) {
  return {
    id: String(user.id || user._id),
    name: user.name,
    email: user.email,
  }
}

async function requireAuth(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization)

    if (!token) {
      res.status(401)
      throw new Error('Authentication required. Please sign in.')
    }

    const payload = jwt.verify(token, getJwtSecret())
    const user = await findUserById(payload.sub)

    if (!user) {
      res.status(401)
      throw new Error('Session is invalid or expired. Please sign in again.')
    }

    req.auth = {
      userId: String(user.id || user._id),
      user: toPublicUser(user),
    }

    return next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      res.status(401)
      return next(new Error('Session is invalid or expired. Please sign in again.'))
    }

    return next(error)
  }
}

module.exports = {
  requireAuth,
  signAuthToken,
  toPublicUser,
}
