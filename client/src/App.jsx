import { useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function App() {
  const [report, setReport] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')

  const chartData = useMemo(() => {
    if (!report) {
      return []
    }

    return [
      {
        name: 'Transparent Spending',
        value: report.totals.transparentSpending,
      },
      {
        name: 'Hidden Fees',
        value: report.totals.hiddenFees,
      },
    ]
  }, [report])

  const onDrop = async (acceptedFiles) => {
    if (!acceptedFiles.length) {
      return
    }

    setError('')
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('statement', acceptedFiles[0])

      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed')
      }

      setReport(data)
    } catch (uploadError) {
      setError(uploadError.message)
      setReport(null)
    } finally {
      setIsUploading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/pdf': ['.pdf'],
    },
    multiple: false,
  })

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] px-4 py-8 text-zinc-100 sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-emerald-500/15 blur-[120px]" />

      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="mx-auto mb-8 max-w-7xl"
      >
        <p className="mb-3 text-xs uppercase tracking-[0.24em] text-zinc-400">
          Invisible Fee Tracker
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
          Spot hidden banking fees before they silently stack up.
        </h1>
        <p className="mt-4 max-w-3xl text-sm text-zinc-400 sm:text-base">
          Your statement is analyzed in memory. We do not store account numbers,
          card numbers, addresses, or personally identifiable transaction details.
        </p>
      </motion.header>

      <main className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-12">
        <motion.section
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          className="glass-panel lg:col-span-4"
        >
          <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-400">
            Upload Statement
          </h2>
          <div
            {...getRootProps()}
            className={`mt-4 rounded-2xl border border-dashed p-6 text-center transition ${
              isDragActive
                ? 'border-cyan-300/70 bg-cyan-400/10'
                : 'border-zinc-700/80 bg-zinc-900/40'
            }`}
          >
            <input {...getInputProps()} />
            <p className="text-sm text-zinc-300">
              Drag and drop CSV/PDF here, or click to upload.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Supported formats: .csv, .pdf | Max size: 10MB
            </p>
          </div>

          <div className="mt-4 rounded-2xl bg-zinc-900/50 p-4 text-sm text-zinc-400">
            <p className="text-zinc-200">Detection logic includes:</p>
            <p className="mt-2">
              Convenience Fee, Service Charge, Surcharge, Processing Fee,
              Maintenance, and recurring micro-debits.
            </p>
          </div>

          {isUploading && (
            <p className="mt-4 text-sm text-cyan-300">Analyzing statement...</p>
          )}
          {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.14 }}
          className="glass-panel lg:col-span-8"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Recoverable Fees
              </p>
              <p className="mt-3 text-3xl font-semibold text-cyan-300 drop-shadow-[0_0_18px_rgba(56,189,248,0.45)]">
                ${report ? report.totals.recoverableFees.toFixed(2) : '0.00'}
              </p>
            </article>
            <article className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Flagged Transactions
              </p>
              <p className="mt-3 text-3xl font-semibold text-zinc-100">
                {report ? report.totals.flaggedTransactions : 0}
              </p>
            </article>
            <article className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Hidden Fees
              </p>
              <p className="mt-3 text-3xl font-semibold text-rose-300">
                ${report ? report.totals.hiddenFees.toFixed(2) : '0.00'}
              </p>
            </article>
            <article className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Transactions Scanned
              </p>
              <p className="mt-3 text-3xl font-semibold text-zinc-100">
                {report ? report.totals.scannedTransactions : 0}
              </p>
            </article>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
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
                          fill={
                            entry.name === 'Hidden Fees' ? '#f43f5e' : '#38bdf8'
                          }
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
                  <LineChart data={report?.monthlyTrend || []}>
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
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
          className="glass-panel lg:col-span-12"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Wall of Shame
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(report?.wallOfShame || []).length === 0 && (
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 text-sm text-zinc-400">
                Upload a statement to reveal fee-heavy merchants.
              </div>
            )}
            {(report?.wallOfShame || []).map((entry, index) => (
              <motion.article
                key={`${entry.merchant}-${index}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * index }}
                className="rounded-xl border border-zinc-800/80 bg-zinc-900/55 p-4"
              >
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Merchant
                </p>
                <p className="mt-1 text-lg font-medium capitalize text-zinc-100">
                  {entry.merchant}
                </p>
                <p className="mt-2 text-sm text-rose-300">
                  Hidden Fees: ${entry.total.toFixed(2)}
                </p>
              </motion.article>
            ))}
          </div>
        </motion.section>
      </main>
    </div>
  )
}

export default App
