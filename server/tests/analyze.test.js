const path = require('path')
const request = require('supertest')
process.env.NODE_ENV = 'test'
const { createApp } = require('../src/app')

describe('Invisible Fee Tracker API', () => {
  const app = createApp()

  it('returns health status', async () => {
    const response = await request(app).get('/api/health')

    expect(response.statusCode).toBe(200)
    expect(response.body.status).toBe('ok')
  })

  it('analyzes CSV statement and flags hidden fees', async () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'sample-statement.csv')

    const response = await request(app)
      .post('/api/analyze')
      .attach('statement', fixturePath)

    expect(response.statusCode).toBe(200)
    expect(response.body.totals.hiddenFees).toBeGreaterThan(0)
    expect(response.body.totals.flaggedTransactions).toBeGreaterThan(0)
    expect(Array.isArray(response.body.wallOfShame)).toBe(true)
  })

  it('rejects unsupported file types', async () => {
    const response = await request(app)
      .post('/api/analyze')
      .attach('statement', Buffer.from('hello'), 'invalid.txt')

    expect(response.statusCode).toBe(400)
    expect(response.body.error).toMatch(/Unsupported file format/i)
  })
})
