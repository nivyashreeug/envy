const { detectBankFeeReason } = require('./feeKeywords')

const CATEGORIES = {
  FOOD: 'FOOD',
  SHOPPING: 'SHOPPING',
  TRANSPORT: 'TRANSPORT',
  ENTERTAINMENT: 'ENTERTAINMENT',
  UTILITIES: 'UTILITIES',
  SUBSCRIPTION: 'SUBSCRIPTION',
  INSURANCE: 'INSURANCE',
  BANKING: 'BANKING',
  HEALTHCARE: 'HEALTHCARE',
  TRAVEL: 'TRAVEL',
  TRANSFER: 'TRANSFER',
  OTHER: 'OTHER',
}

const CATEGORY_PATTERNS = [
  {
    category: CATEGORIES.INSURANCE,
    regex: /\b(insurance|lic\b|geico|progressive|state\s*farm|allstate|metlife|prudential|star\s*health|hdfc\s*ergo|unitedhealthcare|aetna|cigna|policy\s*premium|auto\s*insurance|life\s*insurance|health\s*insurance)\b/i,
  },
  {
    category: CATEGORIES.UTILITIES,
    regex: /\b(electricity|electric|water\s*bill|gas\s*utility|internet|broadband|wifi|verizon|at&t|t-mobile|vodafone|airtel|jio|comcast|spectrum|conedison|pge\b|utility|power\s*corp|sewer|trash\s*collection)\b/i,
  },
  {
    category: CATEGORIES.ENTERTAINMENT,
    regex: /\b(netflix|spotify|hulu|disney\+?|hbo|paramount|prime\s*video|youtube|steam|playstation|psn|xbox|nintendo|ticketmaster|cinema|movie|amc|theatre|theater|gaming|twitch|audible|hotstar)\b/i,
  },
  {
    category: CATEGORIES.SUBSCRIPTION,
    regex: /\b(github|aws|amazon\s*web\s*services|google\s*cloud|azure|notion|figma|adobe|creative\s*cloud|chatgpt|openai|icloud|dropbox|canva|slack|zoom|medium|linkedin\s*premium|substack|patreon|new\s*york\s*times|wsj|gym\s*membership|planet\s*fitness|equinox)\b/i,
  },
  {
    category: CATEGORIES.FOOD,
    regex: /\b(swiggy|zomato|starbucks|mcdonald|chipotle|uber\s*eats|doordash|grubhub|dunkin|domino|pizza|burger\s*king|kfc|subway|taco\s*bell|cafe|coffee|restaurant|bistro|diner|bakery|grocer|grocery|supermarket|whole\s*foods|trader\s*joe|safeway|kroger|instacart|costco\s*whse)\b/i,
  },
  {
    category: CATEGORIES.TRANSPORT,
    regex: /\b(uber(?!\s*eats)|lyft|ola\b|gas\s*station|petrol|fuel|shell|chevron|bp\s*station|exxon|mobil|texaco|parking|toll|ezpass|fastag|transit|metro|subway\s*station|train|bus\s*fare|amtrak|taxi|cab)\b/i,
  },
  {
    category: CATEGORIES.TRAVEL,
    regex: /\b(airline|delta\s*air|united\s*air|american\s*air|emirates|indigo|british\s*airways|southwest|air\s*india|hotel|motel|resort|airbnb|booking\.com|expedia|agoda|marriott|hilton|hyatt|hostel|flight)\b/i,
  },
  {
    category: CATEGORIES.HEALTHCARE,
    regex: /\b(pharmacy|chemist|cvs|walgreens|hospital|clinic|doctor|dental|dentist|physician|optical|optometry|optometrist|labcorp|quest\s*diagnostics|apollo\s*pharmacy|medication|urgent\s*care)\b/i,
  },
  {
    category: CATEGORIES.SHOPPING,
    regex: /\b(amazon(?!\s*web)|flipkart|walmart|target|ebay|zara|h&m|best\s*buy|apple\s*store|nike|adidas|myntra|ikea|home\s*depot|lowes|costco|clothing|apparel|retail|mall|store|boutique)\b/i,
  },
  {
    category: CATEGORIES.TRANSFER,
    regex: /\b(transfer|zelle|venmo|paypal|cash\s*app|upi(?:\/|\s)|p2p|wire\s*transfer|direct\s*deposit|neft|rtgs|imps|ach\s*transfer)\b/i,
  },
  {
    category: CATEGORIES.BANKING,
    regex: /\b(bank|atm|fee|charge|surcharge|maintenance|interest|overdraft|service\s*charge|card\s*fee|chase|citi|wells\s*fargo|bank\s*of\s*america|hdfc|sbi|icici|axis|loan|emi|mortgage)\b/i,
  },
]

function normalizeMerchant(description) {
  if (!description || typeof description !== 'string') {
    return 'unknown'
  }

  const cleaned = description
    .toLowerCase()
    .replace(/^(pos|upi|ach|dr|cr|neft|rtgs|imps|chk|card|txn)\s*[-:/]?\s*/i, '')
    .replace(/\b\d{3,}\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned || 'unknown'
}

function categorizeTransaction(description, merchantName) {
  const text = `${description || ''} ${merchantName || ''}`.trim()

  if (!text) {
    return CATEGORIES.OTHER
  }

  for (const { category, regex } of CATEGORY_PATTERNS) {
    if (regex.test(text)) {
      return category
    }
  }

  return CATEGORIES.OTHER
}

const CLASSIFICATIONS = {
  BANK_FEE: 'BANK_FEE',
  LIKELY_SUBSCRIPTION: 'LIKELY_SUBSCRIPTION',
  RECURRING_PAYMENT: 'RECURRING_PAYMENT',
  MICRO_DEBIT: 'MICRO_DEBIT',
  UNUSUAL_TRANSACTION: 'UNUSUAL_TRANSACTION',
  POTENTIAL_HIDDEN_CHARGE: 'POTENTIAL_HIDDEN_CHARGE',
  NORMAL_EXPENSE: 'NORMAL_EXPENSE',
}

module.exports = {
  CATEGORIES,
  CATEGORY_PATTERNS,
  CLASSIFICATIONS,
  normalizeMerchant,
  categorizeTransaction,
}
