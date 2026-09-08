import { formatCurrency } from '../utils/formatters'

function RecurringPayments({ recurringPayments }) {
  const items = recurringPayments || []

  const getSubscriptionBadge = (status) => {
    if (status === 'likely_subscription') {
      return {
        label: 'Likely Subscription',
        className: 'border-indigo-200 bg-indigo-50 text-indigo-700',
      }
    }
    if (status === 'possible_subscription') {
      return {
        label: 'Possible Subscription',
        className: 'border-purple-200 bg-purple-50 text-purple-700',
      }
    }
    return {
      label: 'Recurring Bill',
      className: 'border-slate-200 bg-slate-100 text-slate-700',
    }
  }

  return (
    <section className="white-card bg-white" aria-label="Recurring Payments & Subscriptions">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Cadence & Commitments
          </p>
          <h2 className="mt-0.5 text-lg font-bold text-slate-900">Recurring Payments & Subscriptions</h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-700">
          {items.length} streams detected
        </span>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-800">No recurring payments detected</p>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Transactions with regular billing intervals and consistent amounts will automatically be mapped here.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((entry, index) => {
            const subBadge = getSubscriptionBadge(entry.subscriptionStatus)
            return (
              <div
                key={`${entry.merchant}-${index}`}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:shadow-xs"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-base font-bold capitalize text-slate-900">{entry.merchant}</p>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${subBadge.className}`}
                    >
                      {subBadge.label}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 uppercase">
                      {entry.frequency}
                    </span>
                    <span className="text-xs text-slate-500">
                      {entry.occurrences} occurrences
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 text-xs">
                    <div>
                      <p className="text-slate-500">Avg Amount</p>
                      <p className="font-bold text-slate-900 mt-0.5">
                        {formatCurrency(entry.averageAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Monthly Est.</p>
                      <p className="font-bold text-blue-700 mt-0.5">
                        {formatCurrency(entry.estimatedMonthlyCost)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 border-t border-slate-200 pt-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500">Annual Est: </span>
                    <span className="font-semibold text-slate-800">
                      {formatCurrency(entry.estimatedAnnualCost)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">Confidence:</span>
                    <span className="font-bold text-emerald-700">
                      {entry.confidence}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default RecurringPayments
