const { parse: parseCsv } = require('csv-parse/sync')

const DATE_REGEX = /\b(\d{1,4}[/-]\d{1,2}[/-]\d{1,4})\b/
const AMOUNT_REGEX = /-?\(?[₹$]?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?/g

function cleanLine(line) {
  return line.replace(/\s{2,}/g, ' ').trim()
}

function normalizeAmount(token) {
  if (!token) {
    return 0
  }

  const trimmed = token.trim()
  const isNegative = /^-/.test(trimmed) || /^\(.*\)$/.test(trimmed)
  const numeric = trimmed.replace(/[₹$,()]/g, '').replace(/^-/, '')
  const value = Number.parseFloat(numeric)

  if (Number.isNaN(value)) {
    return 0
  }

  return isNegative ? -Math.abs(value) : value
}

function normalizeDateToken(token) {
  if (!token) {
    return token
  }

  const parts = token.split(/[/-]/).map((part) => part.trim())

  if (parts.length !== 3) {
    return token
  }

  const [first, second, third] = parts

  if (first.length === 4) {
    return `${first}-${second.padStart(2, '0')}-${third.padStart(2, '0')}`
  }

  if (third.length === 4) {
    const day = first.padStart(2, '0')
    const month = second.padStart(2, '0')
    return `${third}-${month}-${day}`
  }

  return token
}

function isValidTransaction(line) {
  return DATE_REGEX.test(line) && AMOUNT_REGEX.test(line)
}

function inferSignedAmountFromLine(line, amount) {
  const hasExplicitCredit = /\b(cr|credit|refund|reversal|deposit|salary|interest)\b/i.test(line)
  const hasExplicitDebit =
    /\b(dr|debit|withdrawal|purchase|charge|fee|payment|upi|pos|atm)\b/i.test(line)

  if (hasExplicitCredit && !hasExplicitDebit) {
    return Math.abs(amount)
  }

  if (hasExplicitDebit) {
    return -Math.abs(amount)
  }

  // Most statement transaction lines are debits when no sign marker is present.
  if (amount >= 0) {
    return -Math.abs(amount)
  }

  return amount
}

function extractTransaction(line, index) {
  const dateMatch = line.match(DATE_REGEX)
  const amounts = line.match(AMOUNT_REGEX)

  if (!dateMatch || !amounts) return null

  const amountToken = amounts[amounts.length - 1]
  let amount = inferSignedAmountFromLine(line, normalizeAmount(amountToken))

  if (/cr/i.test(line)) amount = Math.abs(amount)
  if (/dr/i.test(line)) amount = -Math.abs(amount)

  const description = line
    .replace(dateMatch[0], '')
    .replace(amountToken, '')
    .replace(/\b(?:cr|dr)\b/gi, '')
    .trim()

  if (!description || description.length < 3) return null

  return {
    id: `txn_pdf_${index + 1}`,
    date: normalizeDateToken(dateMatch[0]),
    description,
    amount,
  }
}

function toTransaction(record, index) {
  const normalizedRecord = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key.toLowerCase().trim(), value])
  )

  const rawDate = normalizedRecord.date || normalizedRecord['transaction date'] || normalizedRecord['posting date']
  const rawDescription = normalizedRecord.description || normalizedRecord.details || normalizedRecord.merchant || normalizedRecord.payee
  const rawAmount = normalizedRecord.amount || normalizedRecord.debit || normalizedRecord.credit

  if (!rawDate || !rawDescription || rawAmount === undefined || rawAmount === null || rawAmount === '') {
    return null
  }

  let amount = normalizeAmount(String(rawAmount))

  if (normalizedRecord.debit && !normalizedRecord.credit) {
    amount = -Math.abs(amount)
  }

  if (normalizedRecord.credit && !normalizedRecord.debit) {
    amount = Math.abs(amount)
  }

  return {
    id: `txn_csv_${index + 1}`,
    date: normalizeDateToken(String(rawDate).trim()),
    description: String(rawDescription).trim(),
    amount,
  }
}

async function parseCsvStatement(buffer) {
  const text = buffer.toString('utf8')

  if (!text.trim()) {
    return []
  }

  const records = parseCsv(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  })

  return records.map(toTransaction).filter(Boolean)
}

async function parsePdfStatement(buffer) {
  try {
    const pdfParseModule = require('pdf-parse')
    let data

    // pdf-parse v2 exposes a class API via { PDFParse }.
    if (typeof pdfParseModule.PDFParse === 'function') {
      const parser = new pdfParseModule.PDFParse({ data: buffer })

      try {
        data = await parser.getText()
      } finally {
        if (typeof parser.destroy === 'function') {
          await parser.destroy()
        }
      }
    } else {
      // Backward compatibility for pdf-parse v1 function export.
      const pdfParser =
        typeof pdfParseModule === 'function' ? pdfParseModule : pdfParseModule.default

      if (typeof pdfParser !== 'function') {
        throw new Error('pdf-parse parser API not available')
      }

      data = await pdfParser(buffer)
    }

    if (!data.text) {
      throw new Error('Empty PDF')
    }

    const lines = data.text.split('\n').map(cleanLine).filter(Boolean)
    const mergedLines = []
    let pendingLine = ''

    for (const line of lines) {
      if (DATE_REGEX.test(line)) {
        if (pendingLine) {
          mergedLines.push(pendingLine)
        }
        pendingLine = line
      } else {
        pendingLine = pendingLine ? `${pendingLine} ${line}` : line
      }
    }

    if (pendingLine) {
      mergedLines.push(pendingLine)
    }

    return mergedLines.filter(isValidTransaction).map((line, index) => extractTransaction(line, index)).filter(Boolean)
  } catch (err) {
    console.error('PDF parsing failed:', err.message)
    throw new Error(`PDF parsing failed: ${err.message}`)
  }
}

async function parseStatementFile(file) {
  if (!file || !file.buffer) {
    throw new Error('No statement file provided')
  }

  const extension = (file.originalname || '').split('.').pop().toLowerCase()
  const mimetype = (file.mimetype || '').toLowerCase()

  if (extension === 'csv' || mimetype.includes('csv')) {
    return parseCsvStatement(file.buffer)
  }

  if (extension === 'pdf' || mimetype.includes('pdf')) {
    return parsePdfStatement(file.buffer)
  }

  throw new Error('Unsupported file format. Please upload CSV or PDF.')
}

module.exports = {
  parseStatementFile,
  parseCsvStatement,
  parsePdfStatement,
  normalizeAmount,
}
