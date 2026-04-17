const fs = require('fs/promises')
const path = require('path')

async function assertOk(response, label) {
  if (response.ok) {
    return response
  }

  let errorBody = ''

  try {
    errorBody = await response.text()
  } catch {
    errorBody = '<no response body>'
  }

  throw new Error(`${label} failed (${response.status}): ${errorBody}`)
}

async function waitForApi(baseUrl, timeoutMs = 30000) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) {
        return
      }
    } catch {
      // Ignore transient startup errors while waiting for the API.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error(`API did not become healthy within ${timeoutMs / 1000} seconds.`)
}

async function runSmokeTest() {
  const baseUrl = process.env.SMOKE_API_BASE_URL || 'http://localhost:5000'

  await waitForApi(baseUrl)

  const healthResponse = await fetch(`${baseUrl}/api/health`)
  await assertOk(healthResponse, 'Health check')

  const uniqueEmail = `smoke_${Date.now()}@envy.dev`
  const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Smoke User',
      email: uniqueEmail,
      password: 'SmokePass123!',
    }),
  })

  await assertOk(registerResponse, 'Register')
  const registerData = await registerResponse.json()

  const fixturePath = path.resolve(__dirname, '../tests/fixtures/sample-statement.csv')
  const fixtureBuffer = await fs.readFile(fixturePath)
  const formData = new FormData()
  formData.append(
    'statement',
    new Blob([fixtureBuffer], { type: 'text/csv' }),
    'sample-statement.csv'
  )

  const analyzeResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${registerData.token}`,
    },
    body: formData,
  })

  await assertOk(analyzeResponse, 'Analyze')
  const analyzeData = await analyzeResponse.json()

  if (!analyzeData?.totals?.hiddenFees && analyzeData?.totals?.hiddenFees !== 0) {
    throw new Error('Analyze response missing totals.hiddenFees')
  }

  console.log('Smoke test passed')
}

runSmokeTest().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
