import { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts'
import { formatCurrency, formatPercent, getCategoryBadgeClass } from '../utils/formatters'

const CATEGORY_COLORS = [
  '#0284c7', // Sky Blue
  '#d97706', // Amber
  '#e11d48', // Rose
  '#7c3aed', // Purple
  '#2563eb', // Blue
  '#059669', // Emerald
  '#db2777', // Pink
  '#ca8a04', // Yellow
  '#4f46e5', // Indigo
  '#0d9488', // Teal
  '#475569', // Slate
  '#52525b', // Zinc
]

function CategoryBreakdown({ categories }) {
  const data = useMemo(() => {
    return (categories || []).map((cat, idx) => ({
      name: cat.category,
      total: cat.total,
      count: cat.count,
      share: cat.share,
      color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
    }))
  }, [categories])

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const entry = payload[0].payload
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {entry.name}
          </p>
          <p className="mt-1 text-base font-extrabold text-slate-900">
            {formatCurrency(entry.total)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {entry.share}% of spending | {entry.count} transactions
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <section className="white-card bg-white" aria-label="Spending by Category">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Spending Intelligence
          </p>
          <h2 className="mt-0.5 text-lg font-bold text-slate-900">Category Distribution</h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-700">
          {data.length} Categories Mapped
        </span>
      </div>

      {data.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
          Upload a statement to visualize spending by category.
        </div>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-12 items-center">
          {/* Recharts Bar Chart */}
          <div className="lg:col-span-7 h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  tickFormatter={(val) => `₹${val}`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#94a3b8"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  width={90}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category List with Badges */}
          <div className="lg:col-span-5 max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
            {data.map((entry) => (
              <div
                key={entry.name}
                className="flex items-center justify-between py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getCategoryBadgeClass(
                      entry.name
                    )}`}
                  >
                    {entry.name}
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{formatCurrency(entry.total)}</p>
                  <p className="text-[11px] text-slate-500">
                    {formatPercent(entry.share)} ({entry.count} txns)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export default CategoryBreakdown
