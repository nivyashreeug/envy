const path = require('path')
const request = require('supertest')
process.env.NODE_ENV = 'test'
const { createApp } = require('../src/app')

describe('Envy API', () => {
  const app = createApp()

  async function registerAndGetToken() {
    const uniqueEmail = `test_${Date.now()}_${Math.random().toString(36).slice(2)}@envy.dev`

    const response = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: uniqueEmail,
      password: 'StrongPass123!',
    })

    expect(response.statusCode).toBe(201)
    expect(response.body.token).toBeTruthy()

    return response.body.token
  }

  it('returns health status', async () => {
    const response = await request(app).get('/api/health')

    expect(response.statusCode).toBe(200)
    expect(response.body.status).toBe('ok')
  })

  it('returns API status on /api/status', async () => {
    const response = await request(app).get('/api/status')

    expect(response.statusCode).toBe(200)
    expect(response.body.status).toBe('ok')
    expect(response.body.message).toBe('Envy API is running')
  })

  it('analyzes CSV statement and flags hidden fees', async () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'sample-statement.csv')
    const token = await registerAndGetToken()

    const response = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${token}`)
      .attach('statement', fixturePath)

    expect(response.statusCode).toBe(200)
    expect(response.body.totals.hiddenFees).toBeGreaterThan(0)
    expect(response.body.totals.flaggedTransactions).toBeGreaterThan(0)
    expect(Array.isArray(response.body.wallOfShame)).toBe(true)
    expect(response.body.insights.topFeeSource).toBeTruthy()
    expect(response.body.insights.averageHiddenFeePerTransaction).toBeGreaterThan(0)
    expect(response.body.insights.feeConcentrationPercentage).toBeGreaterThan(0)
    expect(Array.isArray(response.body.anomalies.suspiciousActivities)).toBe(true)
    expect(Array.isArray(response.body.anomalies.suspiciousMerchants)).toBe(true)
    expect(Array.isArray(response.body.timeline.dailyHiddenFees)).toBe(true)
    expect(response.body.timeline.calendarStart).toBeTruthy()
    expect(response.body.timeline.calendarEnd).toBeTruthy()

    // Phase 2 Financial Intelligence fields
    expect(Array.isArray(response.body.transactionInsights)).toBe(true)
    expect(response.body.transactionInsights.length).toBeGreaterThan(0)
    expect(response.body.transactionInsights[0]).toHaveProperty('classification')
    expect(response.body.transactionInsights[0]).toHaveProperty('riskScore')
    expect(response.body.transactionInsights[0]).toHaveProperty('confidence')
    expect(response.body.transactionInsights[0]).toHaveProperty('reasons')
    expect(Array.isArray(response.body.categories)).toBe(true)
    expect(Array.isArray(response.body.recurringPayments)).toBe(true)
    expect(response.body.riskSummary).toHaveProperty('averageRiskScore')
    expect(response.body.potentialSavings).toHaveProperty('monthlyEstimate')
    expect(response.body.potentialSavings).toHaveProperty('disclaimer')
  })

  it('rejects unsupported file types', async () => {
    const token = await registerAndGetToken()

    const response = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${token}`)
      .attach('statement', Buffer.from('hello'), 'invalid.txt')

    expect(response.statusCode).toBe(400)
    expect(response.body.error).toMatch(/Unsupported file format/i)
  })

  it('rejects analyze requests without auth token', async () => {
    const response = await request(app).post('/api/analyze')

    expect(response.statusCode).toBe(401)
    expect(response.body.error).toMatch(/Authentication required/i)
  })

  it('supports login for registered users', async () => {
    const email = `login_${Date.now()}@envy.dev`
    const password = 'StrongPass123!'

    await request(app).post('/api/auth/register').send({
      name: 'Login User',
      email,
      password,
    })

    const loginResponse = await request(app).post('/api/auth/login').send({
      email,
      password,
    })

    expect(loginResponse.statusCode).toBe(200)
    expect(loginResponse.body.token).toBeTruthy()
    expect(loginResponse.body.user.email).toBe(email)
  })

  it('rejects registration with invalid email or short password', async () => {
    const invalidEmailRes = await request(app).post('/api/auth/register').send({
      name: 'Bad Email User',
      email: 'not-an-email',
      password: 'StrongPass123!',
    })
    expect(invalidEmailRes.statusCode).toBe(400)
    expect(invalidEmailRes.body.error).toMatch(/valid email/i)

    const shortPassRes = await request(app).post('/api/auth/register').send({
      name: 'Short Pass User',
      email: `valid_${Date.now()}@envy.dev`,
      password: '123',
    })
    expect(shortPassRes.statusCode).toBe(400)
    expect(shortPassRes.body.error).toMatch(/at least 8 characters/i)
  })

  it('rejects access to /api/auth/me without token or with tampered token', async () => {
    const noTokenRes = await request(app).get('/api/auth/me')
    expect(noTokenRes.statusCode).toBe(401)
    expect(noTokenRes.body.error).toMatch(/Authentication required/i)

    const badTokenRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.tampered.token')
    expect(badTokenRes.statusCode).toBe(401)
    expect(badTokenRes.body.error).toMatch(/Session is invalid or expired/i)
  })

  it('returns current user on /api/auth/me with valid token', async () => {
    const email = `me_${Date.now()}@envy.dev`
    const registerRes = await request(app).post('/api/auth/register').send({
      name: 'Me User',
      email,
      password: 'StrongPass123!',
    })
    const token = registerRes.body.token

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(meRes.statusCode).toBe(200)
    expect(meRes.body.user.email).toBe(email)
    expect(meRes.body.user.name).toBe('Me User')
  })

  it('rejects empty file upload on /api/analyze', async () => {
    const token = await registerAndGetToken()
    const emptyRes = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${token}`)
      .attach('statement', Buffer.from(''), 'empty.csv')

    expect(emptyRes.statusCode).toBe(400)
    expect(emptyRes.body.error).toMatch(/No transactions found/i)
  })

  describe('Production static serving', () => {
    let originalEnv
    let prodApp

    beforeAll(() => {
      originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      prodApp = createApp()
    })

    afterAll(() => {
      process.env.NODE_ENV = originalEnv
    })

    it('serves React index.html at GET / in production', async () => {
      const response = await request(prodApp).get('/')
      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toMatch(/html/)
      expect(response.text).toContain('id="root"')
    })

    it('serves React index.html at SPA fallback route in production', async () => {
      const response = await request(prodApp).get('/dashboard')
      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toMatch(/html/)
      expect(response.text).toContain('id="root"')
    })

    it('preserves /api/health in production', async () => {
      const response = await request(prodApp).get('/api/health')
      expect(response.statusCode).toBe(200)
      expect(response.body.status).toBe('ok')
    })
  })
})
