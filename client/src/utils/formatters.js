export function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value || 0)
}

export function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`
}

export function formatDate(dateString) {
  if (!dateString) return 'N/A'
  try {
    const d = new Date(dateString)
    if (Number.isNaN(d.getTime())) return dateString
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateString
  }
}

export function getRiskLevelClass(level) {
  const norm = String(level || '').toUpperCase()
  if (norm === 'HIGH') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }
  if (norm === 'MEDIUM') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

export function getCategoryBadgeClass(category) {
  const cat = String(category || '').toUpperCase()
  switch (cat) {
    case 'FOOD':
      return 'border-orange-200 bg-orange-50 text-orange-700'
    case 'SHOPPING':
      return 'border-purple-200 bg-purple-50 text-purple-700'
    case 'TRANSPORT':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'ENTERTAINMENT':
      return 'border-pink-200 bg-pink-50 text-pink-700'
    case 'UTILITIES':
      return 'border-yellow-200 bg-yellow-50 text-yellow-800'
    case 'SUBSCRIPTION':
      return 'border-indigo-200 bg-indigo-50 text-indigo-700'
    case 'INSURANCE':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'BANKING':
      return 'border-rose-200 bg-rose-50 text-rose-700'
    case 'HEALTHCARE':
      return 'border-teal-200 bg-teal-50 text-teal-700'
    case 'TRAVEL':
      return 'border-cyan-200 bg-cyan-50 text-cyan-700'
    case 'TRANSFER':
      return 'border-slate-200 bg-slate-100 text-slate-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600'
  }
}

export function getClassificationBadgeClass(classification) {
  const norm = String(classification || '').toUpperCase()
  switch (norm) {
    case 'BANK_FEE':
      return 'border-rose-200 bg-rose-50 text-rose-700'
    case 'LIKELY_SUBSCRIPTION':
      return 'border-indigo-200 bg-indigo-50 text-indigo-700'
    case 'RECURRING_PAYMENT':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'MICRO_DEBIT':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'UNUSUAL_TRANSACTION':
      return 'border-purple-200 bg-purple-50 text-purple-700'
    case 'POTENTIAL_HIDDEN_CHARGE':
      return 'border-red-200 bg-red-50 text-red-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600'
  }
}
