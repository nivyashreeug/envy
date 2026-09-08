import {
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts'
import { formatCurrency } from '../utils/formatters'

function ReportCharts({ chartData = [], monthlyTrend = [] }) {
  const hasChartData = chartData.some((d) => (d.value || 0) > 0)
  const hasMonthlyTrend = monthlyTrend.length > 0

  return (
    <>
      {/* Transparent vs Hidden Fees Pie Chart */}
      <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Transparent vs Hidden
          </p>
          <p className="mt-0.5 text-sm font-bold text-slate-900">Spend Integrity Ratio</p>
        </div>

        <div className="h-60 mt-3 flex items-center justify-center">
          {!hasChartData ? (
            <p className="text-xs text-slate-500">Upload a statement to visualize fee ratios.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={4}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.name === 'Hidden Fees' ? '#e11d48' : '#0284c7'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [formatCurrency(value), '']}
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    color: '#0f172a',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {hasChartData && (
          <div className="mt-2 flex items-center justify-center gap-4 text-xs font-medium text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-600" />
              Transparent Spend
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
              Hidden Fees
            </span>
          </div>
        )}
      </article>

      {/* Monthly Trend Line Chart */}
      <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Monthly Fee Trajectory
          </p>
          <p className="mt-0.5 text-sm font-bold text-slate-900">Fee Trend Over Time</p>
        </div>

        <div className="h-60 mt-3 flex items-center justify-center">
          {!hasMonthlyTrend ? (
            <p className="text-xs text-slate-500">No monthly fee trend data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => `₹${v}`}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value), 'Fees']}
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    color: '#0f172a',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#0284c7"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#0284c7' }}
                  activeDot={{ r: 6, fill: '#d97706' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {hasMonthlyTrend && (
          <div className="mt-2 text-center text-xs text-slate-500">
            Total fee trajectory across billing cycles
          </div>
        )}
      </article>
    </>
  )
}

export default ReportCharts
