import { formatCurrency } from '../utils/formatters'

function PotentialSavings({ potentialSavings }) {
  const monthly = potentialSavings?.monthlyEstimate || 0
  const annual = potentialSavings?.annualEstimate || 0
  const count = potentialSavings?.contributingCount || 0
  const contributors = potentialSavings?.contributingTransactions || []
  const disclaimer =
    potentialSavings?.disclaimer ||
    'Estimated potential savings are calculated from identified bank fees, surcharges, and recurring fee patterns. This is an automated estimate for informational purposes only.'

  if (monthly <= 0 && count === 0) {
    return (
      <section className="white-card bg-white" aria-label="Potential Savings">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">
              Savings Projection
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900">Estimated Potential Savings</h2>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
          No unnecessary bank fees or recoverable surcharge patterns were identified in this statement.
        </div>
      </section>
    )
  }

  return (
    <section className="white-card bg-white" aria-label="Potential Savings">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">
            Savings Projection
          </p>
          <h2 className="mt-0.5 text-lg font-bold text-slate-900">Estimated Potential Savings</h2>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-700">
          {count} Opportunities
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
            Estimated Monthly Savings
          </p>
          <p className="mt-2 text-2xl font-extrabold text-emerald-700">
            {formatCurrency(monthly)}
            <span className="text-xs font-normal text-slate-500"> / month</span>
          </p>
          <p className="mt-1 text-xs text-emerald-800/80">
            Eliminating avoidable bank fees & surcharges
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Estimated Annualized Impact
          </p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">
            {formatCurrency(annual)}
            <span className="text-xs font-normal text-slate-500"> / year</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Projected 12-month value retained
          </p>
        </div>
      </div>

      {contributors.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600 mb-3">
            Contributing Fee Charges
          </p>
          <div className="space-y-2">
            {contributors.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-semibold text-slate-900 capitalize">{item.merchant}</p>
                  <p className="text-[11px] text-slate-500">{item.reason}</p>
                </div>
                <span className="font-bold text-rose-600">
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-4 text-slate-400 italic">
        * {disclaimer}
      </p>
    </section>
  )
}

export default PotentialSavings
