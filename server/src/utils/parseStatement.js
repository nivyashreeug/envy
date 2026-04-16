const { parse } = require('csv-parse/sync')

const DATE_KEYS = ['date', 'transaction date', 'posted date', 'posting date']
const DESC_KEYS = ['description', 'merchant', 'details', 'narrative', 'memo']
const AMOUNT_KEYS = ['amount', 'debit', 'withdrawal', 'value']

function normalizeAmount(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const cleaned = String(value || '')
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')

  if (!cleaned) {
    return 0
  }

  if (/^\(.*\)$/.test(cleaned)) {
    const inner = cleaned.slice(1, -1)
    const parsed = Number.parseFloat(inner)
    return Number.isFinite(parsed) ? -Math.abs(parsed) : 0
  }

  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function findKey(record, keys) {
  const normalized = Object.keys(record).reduce((acc, key) => {
    acc[key.toLowerCase().trim()] = key
    return acc
  }, {})

  for (const key of keys) {
    if (normalized[key]) {
      return normalized[key]
    }
  }

  return null
}

function parseCsvStatement(buffer) {
  const csvText = buffer.toString('utf-8')
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  })

  return rows.map((row, index) => {
    const dateKey = findKey(row, DATE_KEYS)
    const descKey = findKey(row, DESC_KEYS)
    const amountKey = findKey(row, AMOUNT_KEYS)

    return {
      id: `txn_${index + 1}`,
      date: String(dateKey ? row[dateKey] : ''),
      description: String(descKey ? row[descKey] : '').trim(),
      amount: normalizeAmount(amountKey ? row[amountKey] : 0),
    }
  })
}

function parsePdfLine(line, index) {
  const compact = line.trim().replace(/\s{2,}/g, ' ')
  if (!compact) {
    return null
  }

  const dateMatch = compact.match(/\b(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/)
  const amountMatches = compact.match(/-?\$?\d+[\d,]*\.\d{2}/g)

  if (!dateMatch || !amountMatches || amountMatches.length === 0) {
    return null
  }

  const amountToken = amountMatches[amountMatches.length - 1]
  const amount = normalizeAmount(amountToken)
  const description = compact
    .replace(dateMatch[0], '')
    .replace(amountToken, '')
    .trim()

  return {
    id: `txn_pdf_${index + 1}`,
    date: dateMatch[0],
    description,
    amount,
  }
}

async function parsePdfStatement(buffer) {
  const pdfParse = require('pdf-parse')
  const { text } = await pdfParse(buffer)
  const lines = text.split(/\r?\n/)

  return lines
    .map((line, index) => parsePdfLine(line, index))
    .filter((row) => row && row.description)
}

async function parseStatementFile(file) {
  const ext = (file.originalname.split('.').pop() || '').toLowerCase()

  if (ext === 'csv') {
    return parseCsvStatement(file.buffer)
  }

  if (ext === 'pdf') {
    return parsePdfStatement(file.buffer)
  }

  throw new Error('Unsupported file format. Please upload CSV or PDF.')
}

module.exports = { parseStatementFile }
