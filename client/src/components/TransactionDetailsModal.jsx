import { useEffect } from 'react'
import {
  formatCurrency,
  formatDate,
  getRiskLevelClass,
  getCategoryBadgeClass,
  getClassificationBadgeClass,
} from '../utils/formatters'

function TransactionDetailsModal({ transaction, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!transaction) return null

  const absAmount = Math.abs(transaction.amount || 0)
  const isCredit = (transaction.amount || 0) > 0
  const reasons = transaction.reasons || []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <span
              className={`rounded-md border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${getClassificationBadgeClass(
                transaction.classification
              )}`}
            >
              {transaction.classification || 'NORMAL_EXPENSE'}
            </span>
            <h3 id="modal-title" className="mt-2 text-xl font-extrabold text-slate-900">
              {transaction.description || 'Transaction Details'}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Posting Date: {formatDate(transaction.date)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-full border border-slate-200 bg-slate-100 p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Amount & Key Metrics */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Amount</p>
            <p className={`mt-1 text-lg font-extrabold ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>
              {isCredit ? '+' : '-'}{formatCurrency(absAmount)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Risk Score</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`rounded-md border px-2 py-0.5 text-xs font-bold ${getRiskLevelClass(
                  transaction.riskLevel
                )}`}
              >
                {transaction.riskScore ?? 0}/100
              </span>
              <span className="text-[11px] uppercase font-bold text-slate-700">
                {transaction.riskLevel || 'LOW'}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-1 col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Confidence</p>
            <p className="mt-1 text-lg font-extrabold text-blue-700">
              {transaction.confidence ?? 50}%
            </p>
          </div>
        </div>

        {/* Category & Merchant Metadata */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Category:</span>
          <span
            className={`rounded-md border px-2.5 py-0.5 font-bold uppercase ${getCategoryBadgeClass(
              transaction.category
            )}`}
          >
            {transaction.category || 'OTHER'}
          </span>

          <span className="text-slate-500 font-medium ml-2">Normalized:</span>
          <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-slate-700 font-mono">
            {transaction.normalizedMerchant || 'unknown'}
          </span>
        </div>

        {/* Why Flagged / Structured Reasons */}
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-700">
            Why Flagged / Intelligence Signals
          </p>

          <div className="mt-2.5 space-y-2">
            {reasons.length === 0 ? (
              <p className="text-xs text-slate-500">No special anomaly signals detected.</p>
            ) : (
              reasons.map((reason, index) => (
                <div key={index} className="flex items-start gap-2 text-xs text-slate-800">
                  <span className="text-blue-600 shrink-0 font-bold">✓</span>
                  <span>{reason}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recurring Info if present */}
        {transaction.recurringInfo && (
          <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 flex items-center justify-between">
            <span>
              Recurring cadence:{' '}
              <strong className="uppercase">{transaction.recurringInfo.frequency}</strong> (
              {transaction.recurringInfo.occurrences}x detected)
            </span>
            <span className="font-semibold">Est: {formatCurrency(transaction.recurringInfo.estimatedMonthlyCost)}/mo</span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default TransactionDetailsModal
