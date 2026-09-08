const FEE_KEYWORDS = [
  'convenience fee',
  'service charge',
  'surcharge',
  'processing fee',
  'maintenance',
  'maintenance fee',
  'atm fee',
  'atm charge',
  'atm surcharge',
  'overdraft fee',
  'overdraft charge',
  'wire fee',
  'wire transfer fee',
  'foreign transaction fee',
  'late payment fee',
  'late fee',
  'card annual fee',
  'annual card fee',
  'membership fee',
  'insufficient funds fee',
  'nsf fee',
  'account fee',
  'monthly service fee',
  'minimum balance fee',
  'inactivity fee',
  'paper statement fee',
  'return fee',
]

const BANK_FEE_PATTERNS = [
  { pattern: /\b(overdraft|od fee|od charge|nsf)\b/i, reason: 'Overdraft / NSF fee detected' },
  { pattern: /\b(atm fee|atm charge|atm surcharge|out of network atm)\b/i, reason: 'ATM service surcharge detected' },
  { pattern: /\b(wire fee|wire transfer fee|remittance fee)\b/i, reason: 'Wire transfer processing fee' },
  { pattern: /\b(maintenance fee|monthly service fee|account maintenance|service charge)\b/i, reason: 'Account service or maintenance charge' },
  { pattern: /\b(late fee|late payment fee|late charge)\b/i, reason: 'Late payment penalty fee' },
  { pattern: /\b(foreign transaction fee|fx fee|cross border fee|intl fee)\b/i, reason: 'Foreign currency or cross-border transaction fee' },
  { pattern: /\b(convenience fee|processing fee|surcharge)\b/i, reason: 'Convenience or payment processing surcharge' },
  { pattern: /\b(minimum balance|low balance fee|inactivity fee|dormancy fee)\b/i, reason: 'Minimum balance or dormancy penalty' },
]

function detectBankFeeReason(description) {
  if (!description || typeof description !== 'string') {
    return null
  }

  const text = description.toLowerCase()

  for (const item of BANK_FEE_PATTERNS) {
    if (item.pattern.test(text)) {
      return item.reason
    }
  }

  if (FEE_KEYWORDS.some((kw) => text.includes(kw))) {
    return 'Bank service fee / charge detected in transaction description'
  }

  return null
}

module.exports = {
  FEE_KEYWORDS,
  BANK_FEE_PATTERNS,
  detectBankFeeReason,
}
