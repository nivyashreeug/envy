const mongoose = require('mongoose')
const User = require('../models/User')

const testUsersByEmail = new Map()
let testUserSequence = 1

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function sanitizeUser(user) {
  if (!user) {
    return null
  }

  return {
    id: String(user.id || user._id),
    name: user.name,
    email: normalizeEmail(user.email),
    passwordHash: user.passwordHash,
  }
}

function isDatabaseAvailable() {
  return mongoose.connection.readyState === 1
}

function canUseInMemoryStore() {
  return process.env.NODE_ENV !== 'production'
}

async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email)

  if (isDatabaseAvailable()) {
    const user = await User.findOne({ email: normalizedEmail }).lean()
    return sanitizeUser(user)
  }

  if (canUseInMemoryStore()) {
    return testUsersByEmail.get(normalizedEmail) || null
  }

  throw new Error('Authentication store unavailable. Connect MongoDB before signing in.')
}

async function findUserById(id) {
  if (!id) {
    return null
  }

  if (isDatabaseAvailable()) {
    const user = await User.findById(id).lean()
    return sanitizeUser(user)
  }

  if (canUseInMemoryStore()) {
    for (const user of testUsersByEmail.values()) {
      if (user.id === String(id)) {
        return user
      }
    }
    return null
  }

  throw new Error('Authentication store unavailable. Connect MongoDB before validating sessions.')
}

async function createUser({ name, email, passwordHash }) {
  const normalizedEmail = normalizeEmail(email)

  if (isDatabaseAvailable()) {
    const existing = await User.findOne({ email: normalizedEmail }).lean()
    if (existing) {
      const error = new Error('Account already exists for this email.')
      error.code = 'DUPLICATE_EMAIL'
      throw error
    }

    const created = await User.create({
      name: String(name || '').trim(),
      email: normalizedEmail,
      passwordHash,
    })

    return sanitizeUser(created)
  }

  if (canUseInMemoryStore()) {
    if (testUsersByEmail.has(normalizedEmail)) {
      const error = new Error('Account already exists for this email.')
      error.code = 'DUPLICATE_EMAIL'
      throw error
    }

    const created = {
      id: `local_${testUserSequence++}`,
      name: String(name || '').trim(),
      email: normalizedEmail,
      passwordHash,
    }

    testUsersByEmail.set(normalizedEmail, created)
    return created
  }

  throw new Error('Authentication store unavailable. Connect MongoDB before registering users.')
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
}
