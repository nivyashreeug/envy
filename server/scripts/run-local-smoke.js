const { spawn } = require('child_process')

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

async function main() {
  const env = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'test',
    PORT: process.env.PORT || '5000',
    AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET || 'local-smoke-secret',
    CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:5173',
  }

  const serverProcess = spawn('npm', ['--prefix', 'server', 'start'], {
    stdio: 'inherit',
    shell: true,
    env,
  })

  const cleanup = () => {
    if (!serverProcess.killed) {
      serverProcess.kill('SIGTERM')
    }
  }

  process.on('SIGINT', () => {
    cleanup()
    process.exit(1)
  })

  process.on('SIGTERM', () => {
    cleanup()
    process.exit(1)
  })

  try {
    await run('node', ['server/scripts/smoke-test.js'], {
      env: {
        ...env,
        SMOKE_API_BASE_URL: process.env.SMOKE_API_BASE_URL || 'http://localhost:5000',
      },
    })

    console.log('Local smoke run passed')
  } finally {
    cleanup()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
