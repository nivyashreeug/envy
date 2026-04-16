function notFoundHandler(req, res, next) {
  res.status(404)
  next(new Error('Route not found'))
}

function errorHandler(err, req, res, next) {
  const clientError =
    err.name === 'MulterError' ||
    /Unsupported file format/i.test(err.message || '') ||
    /Origin is not allowed by CORS/i.test(err.message || '')

  if (clientError && res.statusCode < 400) {
    res.status(400)
  }

  const statusCode = res.statusCode >= 400 ? res.statusCode : 500

  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  })
}

module.exports = {
  notFoundHandler,
  errorHandler,
}
