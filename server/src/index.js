require('dotenv').config()
const mongoose = require('mongoose')
const { createApp } = require('./app')

const port = Number(process.env.PORT || 5000)
const app = createApp()

if (process.env.NODE_ENV === 'production' && !process.env.AUTH_JWT_SECRET) {
  throw new Error('AUTH_JWT_SECRET is required in production.')
}

if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log('Connected to MongoDB')
    })
    .catch((error) => {
      console.error('MongoDB connection failed:', error.message)
    })
}

app.listen(port, () => {
  console.log(`Envy API running on port ${port}`)
})
