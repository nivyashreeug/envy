import { formatCurrency } from '../utils/formatters'

function FinancialOverview({ totals, recurringPayments }) {
  const totalSpent = totals?.totalSpent || 0
  const hiddenFees = totals?.hiddenFees || 0
  const recoverableFees = totals?.recoverableFees || 0
  const flaggedCount = totals?.flaggedTransactions || 0
  const scannedCount = totals?.scannedTransactions || 0

  const totalRecurringMonthly = (recurringPayments || []).reduce(
    (sum, item) => sum + (item.estimatedMonthlyCost || 0),
    0
  )

  return (
    <section className="white-card bg-white" aria-label="Financial Overview">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Financial Overview
          </p>
          <h2 className="mt-0.5 text-lg font-bold text-slate-900">Statement Health & Metrics</h2>
        </div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          {scannedCount} Transactions Analyzed
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Spending */}
        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Spending</p>
            <span className="text-xs text-slate-400">Statement Debit</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">{formatCurrency(totalSpent)}</p>
          <p className="mt-1 text-xs text-slate-500">
            Across {scannedCount} parsed statement records
          </p>
        </article>

        {/* Detected Fees */}
        <article className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 transition hover:shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Detected Fees</p>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-800">
              Recoverable
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-rose-600">{formatCurrency(hiddenFees)}</p>
          <p className="mt-1 text-xs text-rose-700/80">
            {flaggedCount} charges flagged for audit
          </p>
        </article>

        {/* Recurring Spending */}
        <article className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 transition hover:shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Recurring Total</p>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-800">
              Monthly Est.
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-blue-700">
            {formatCurrency(totalRecurringMonthly)}
            <span className="text-xs font-normal text-slate-500">/mo</span>
          </p>
          <p className="mt-1 text-xs text-blue-700/80">
            {recurringPayments?.length || 0} active recurring streams
          </p>
        </article>

        {/* Flagged Transactions */}
        <article className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 transition hover:shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Flagged Charges</p>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
              Audit
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-amber-700">{flaggedCount}</p>
          <p className="mt-1 text-xs text-amber-800/80">
            {totalSpent > 0 ? ((hiddenFees / totalSpent) * 100).toFixed(1) : 0}% of statement spend
          </p>
        </article>
      </div>
    </section>
  )
}

export default FinancialOverview
