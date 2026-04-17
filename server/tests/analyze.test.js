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
})
