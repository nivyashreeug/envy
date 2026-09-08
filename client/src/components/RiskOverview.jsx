import { formatCurrency, getRiskLevelClass } from '../utils/formatters'

function RiskOverview({ riskSummary, onSelectTransaction }) {
  const lowCount = riskSummary?.lowCount || 0
  const mediumCount = riskSummary?.mediumCount || 0
  const highCount = riskSummary?.highCount || 0
  const avgRiskScore = riskSummary?.averageRiskScore ?? 0
  const overallRiskLevel = riskSummary?.overallRiskLevel || 'LOW'
  const highestRiskTxns = riskSummary?.highestRiskTransactions || []

  return (
    <section className="white-card bg-white" aria-label="Risk Overview">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Risk & Anomaly Engine
          </p>
          <h2 className="mt-0.5 text-lg font-bold text-slate-900">Risk Distribution & Audit Scores</h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Overall Level:</span>
          <span
            className={`rounded-full border px-3 py-0.5 text-xs font-bold uppercase tracking-wider ${getRiskLevelClass(
              overallRiskLevel
            )}`}
          >
            {overallRiskLevel} RISK
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-700">
            Avg Score: <strong className="text-slate-900">{avgRiskScore}</strong>/100
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {/* High Risk Count */}
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
              High Risk
            </span>
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-rose-700">{highCount}</p>
          <p className="mt-1 text-xs text-rose-600">Score 70–100 (Fees, large spikes, penalties)</p>
        </div>

        {/* Medium Risk Count */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Medium Risk
            </span>
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-amber-800">{mediumCount}</p>
          <p className="mt-1 text-xs text-amber-700">Score 40–69 (Micro-debits, recurring fees)</p>
        </div>

        {/* Low Risk Count */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Low Risk
            </span>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-emerald-700">{lowCount}</p>
          <p className="mt-1 text-xs text-emerald-600">Score 0–39 (Standard verified spending)</p>
        </div>
      </div>

      {highestRiskTxns.length > 0 && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Priority Risk Items for Inspection
          </p>
          <div className="mt-3 divide-y divide-slate-200">
            {highestRiskTxns.map((txn) => (
              <div
                key={txn.id}
                onClick={() => onSelectTransaction && onSelectTransaction(txn)}
                className="group flex flex-wrap items-center justify-between gap-3 py-2.5 cursor-pointer hover:bg-white px-2 rounded-lg transition"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-xs font-bold ${getRiskLevelClass(
                      txn.riskLevel
                    )}`}
                  >
                    {txn.riskScore}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition">
                      {txn.description}
                    </p>
                    <p className="text-xs text-slate-500">
                      {txn.reasons?.[0] || 'Flagged for risk review'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(Math.abs(txn.amount))}</p>
                  <p className="text-[11px] font-semibold text-blue-600 group-hover:underline">View details →</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export default RiskOverview
