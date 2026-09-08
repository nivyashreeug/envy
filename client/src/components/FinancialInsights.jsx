import { formatCurrency, formatPercent } from '../utils/formatters'

function FinancialInsights({ insights, categories, recurringPayments, anomalies, totals }) {
  const topFee = insights?.topFeeSource || null
  const topCategory = categories?.[0] || null
  const topRecurring = recurringPayments?.[0] || null
  const feeConcentration = insights?.feeConcentrationPercentage || 0
  const totalSpent = totals?.totalSpent || 0

  const hasData = totalSpent > 0 || (totals?.scannedTransactions || 0) > 0

  return (
    <section className="white-card bg-white" aria-label="Financial Insights">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Intelligence Highlights
          </p>
          <h2 className="mt-0.5 text-lg font-bold text-slate-900">Automated Financial Insights</h2>
        </div>
      </div>

      {!hasData ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
          Not enough transaction data to generate financial insights.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Largest Fee Source */}
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Largest Fee Source</p>
            {topFee ? (
              <>
                <p className="mt-2 text-lg font-bold capitalize text-slate-900 truncate">
                  {topFee.merchant}
                </p>
                <p className="mt-1 text-xs text-rose-600 font-bold">
                  {formatCurrency(topFee.total)} ({formatPercent(topFee.share)} of fees)
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Triggered across {topFee.count} fee charges
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No fee sources identified.</p>
            )}
          </article>

          {/* Top Spending Category */}
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Top Spend Category</p>
            {topCategory ? (
              <>
                <p className="mt-2 text-lg font-bold uppercase text-blue-700 truncate">
                  {topCategory.category}
                </p>
                <p className="mt-1 text-xs text-slate-900 font-bold">
                  {formatCurrency(topCategory.total)} ({formatPercent(topCategory.share)})
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {topCategory.count} transactions in this category
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                Not enough transaction data to generate category insight.
              </p>
            )}
          </article>

          {/* Highest Recurring Commitment */}
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Highest Recurring</p>
            {topRecurring ? (
              <>
                <p className="mt-2 text-lg font-bold capitalize text-slate-900 truncate">
                  {topRecurring.merchant}
                </p>
                <p className="mt-1 text-xs text-blue-700 font-bold">
                  {formatCurrency(topRecurring.estimatedMonthlyCost)}/mo ({topRecurring.frequency})
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {formatCurrency(topRecurring.estimatedAnnualCost)} annual projection
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No recurring streams detected.</p>
            )}
          </article>

          {/* Fee Concentration */}
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Fee Concentration</p>
            {feeConcentration > 0 ? (
              <>
                <p className="mt-2 text-2xl font-extrabold text-amber-700">
                  {formatPercent(feeConcentration)}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Of total fees originate from the single top offender
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                Fees are distributed or zero.
              </p>
            )}
          </article>
        </div>
      )}
    </section>
  )
}

export default FinancialInsights
