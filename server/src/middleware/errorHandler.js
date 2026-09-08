function notFoundHandler(req, res, next) {
  res.status(404)
  next(new Error('Route not found'))
}

function errorHandler(err, req, res, next) {
  const clientError =
    err.name === 'MulterError' ||
    err.name === 'ValidationError' ||
    /Unsupported file format/i.test(err.message || '') ||
    /Origin is not allowed by CORS/i.test(err.message || '') ||
    /Authentication required/i.test(err.message || '') ||
    /Invalid email or password/i.test(err.message || '') ||
    /Please upload/i.test(err.message || '') ||
    /No transactions found/i.test(err.message || '') ||
    /Email and password are required/i.test(err.message || '') ||
    /Name, email, and password are required/i.test(err.message || '') ||
    /Password must be at least/i.test(err.message || '') ||
    /valid email/i.test(err.message || '')

  if (clientError && res.statusCode < 400) {
    res.status(400)
  }

  const statusCode = res.statusCode >= 400 ? res.statusCode : 500
  const isProduction = process.env.NODE_ENV === 'production'

  const message =
    statusCode < 500 || !isProduction
      ? err.message || 'An error occurred'
      : 'Internal server error. Please try again later.'

  res.status(statusCode).json({
    error: message,
    ...(!isProduction && { stack: err.stack }),
  })
}

module.exports = {
  notFoundHandler,
  errorHandler,
}
