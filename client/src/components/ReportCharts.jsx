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

function ReportCharts({ chartData, monthlyTrend }) {
  return (
    <>
      <article className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-500">
          Transparent vs Hidden
        </p>
        <div className="h-64">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={3}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.name === 'Hidden Fees' ? '#f43f5e' : '#38bdf8'}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#0f0f0f',
                  border: '1px solid #27272a',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-500">
          Monthly Trend
        </p>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={monthlyTrend}>
              <XAxis dataKey="month" stroke="#71717a" tick={{ fontSize: 12 }} />
              <YAxis stroke="#71717a" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: '#0f0f0f',
                  border: '1px solid #27272a',
                }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#22d3ee"
                strokeWidth={3}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>
    </>
  )
}

export default ReportCharts
