import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const ReportCharts = lazy(() => import('./components/ReportCharts.jsx'))
const AUTH_STORAGE_KEY = 'envy-auth-user'
const ANOMALY_FILTER_QUERY_KEY = 'signal'
const VALID_ANOMALY_FILTERS = new Set([
  'all',
  'unusual-spike',
  'repeated-micro-debit',
  'new-merchant',
  'daily-spike',
])

function getInitialAnomalyFilter() {
  if (typeof window === 'undefined') {
    return 'all'
  }

  const urlParams = new URLSearchParams(window.location.search)
  const requestedFilter = urlParams.get(ANOMALY_FILTER_QUERY_KEY) || 'all'

  return VALID_ANOMALY_FILTERS.has(requestedFilter) ? requestedFilter : 'all'
}

function App() {
  const MotionHeader = motion.header
  const MotionSection = motion.section
  const MotionArticle = motion.article

  const [currentUser, setCurrentUser] = useState(null)
  const [authToken, setAuthToken] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [report, setReport] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [activeAnomalyFilter, setActiveAnomalyFilter] = useState(getInitialAnomalyFilter)

  useEffect(() => {
    const storedSession = window.localStorage.getItem(AUTH_STORAGE_KEY)

    if (!storedSession) {
      return
    }

    try {
      const parsedSession = JSON.parse(storedSession)

      if (!parsedSession?.token || !parsedSession?.user) {
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
        return
      }

      setAuthToken(parsedSession.token)
      setCurrentUser(parsedSession.user)
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const nextUrl = new URL(window.location.href)

    if (activeAnomalyFilter === 'all') {
      nextUrl.searchParams.delete(ANOMALY_FILTER_QUERY_KEY)
    } else {
      nextUrl.searchParams.set(ANOMALY_FILTER_QUERY_KEY, activeAnomalyFilter)
    }

    const normalizedUrl = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
    window.history.replaceState({}, '', normalizedUrl)
  }, [activeAnomalyFilter])

  const totalSpent = report?.totals?.totalSpent || 0
  const topMerchant = report?.spendingByMerchant?.[0] || null
  const insights = report?.insights || {}
  const anomalies = report?.anomalies || {}
  const suspiciousActivities = useMemo(
    () => anomalies.suspiciousActivities || [],
    [anomalies.suspiciousActivities]
  )
  const timelineDays = useMemo(
    () => report?.timeline?.dailyHiddenFees || [],
    [report?.timeline?.dailyHiddenFees]
  )

  const filteredSuspiciousActivities = useMemo(
    () =>
      activeAnomalyFilter === 'all'
        ? suspiciousActivities
        : suspiciousActivities.filter((activity) => activity.type === activeAnomalyFilter),
    [activeAnomalyFilter, suspiciousActivities]
  )

  const suspiciousFilterOptions = useMemo(() => {
    const counts = suspiciousActivities.reduce((acc, activity) => {
      acc[activity.type] = (acc[activity.type] || 0) + 1
      return acc
    }, {})

    return [
      { key: 'all', label: 'All Signals', count: suspiciousActivities.length },
      { key: 'unusual-spike', label: 'Unusual Spikes', count: counts['unusual-spike'] || 0 },
      {
        key: 'repeated-micro-debit',
        label: 'Micro-Debits',
        count: counts['repeated-micro-debit'] || 0,
      },
      { key: 'new-merchant', label: 'New Merchants', count: counts['new-merchant'] || 0 },
      { key: 'daily-spike', label: 'Fee-Heavy Days', count: counts['daily-spike'] || 0 },
    ]
  }, [suspiciousActivities])

  const suspiciousMerchantMap = useMemo(() => {
    const severityRank = { low: 1, medium: 2, high: 3 }

    return suspiciousActivities.reduce((acc, activity) => {
      if (!activity.merchant) {
        return acc
      }

      const current = acc[activity.merchant]
      if (!current || severityRank[activity.severity] > severityRank[current.severity]) {
        acc[activity.merchant] = {
          merchant: activity.merchant,
          badge: activity.badge,
          severity: activity.severity,
          type: activity.type,
        }
      }

      return acc
    }, {})
  }, [suspiciousActivities])

  const filteredSuspiciousMerchantMap = useMemo(
    () =>
      Object.values(suspiciousMerchantMap).reduce((acc, entry) => {
        if (activeAnomalyFilter === 'all' || entry.type === activeAnomalyFilter) {
          acc[entry.merchant] = entry
        }
        return acc
      }, {}),
    [activeAnomalyFilter, suspiciousMerchantMap]
  )

  const filteredSpendingByMerchant = useMemo(() => {
    const merchants = report?.spendingByMerchant || []

    if (activeAnomalyFilter === 'all') {
      return merchants
    }

    return merchants.filter((entry) => filteredSuspiciousMerchantMap[entry.merchant])
  }, [activeAnomalyFilter, filteredSuspiciousMerchantMap, report?.spendingByMerchant])

  const filteredWallOfShame = useMemo(() => {
    const merchants = report?.wallOfShame || []

    if (activeAnomalyFilter === 'all') {
      return merchants
    }

    return merchants.filter((entry) => filteredSuspiciousMerchantMap[entry.merchant])
  }, [activeAnomalyFilter, filteredSuspiciousMerchantMap, report?.wallOfShame])

  const timelineDaysForView = useMemo(() => {
    return timelineDays.map((day) => {
      let isRelevant = true

      if (activeAnomalyFilter === 'daily-spike') {
        isRelevant = Boolean(day.isHeavy)
      } else if (activeAnomalyFilter === 'repeated-micro-debit') {
        isRelevant = day.microDebitCount > 0
      } else if (activeAnomalyFilter === 'unusual-spike' || activeAnomalyFilter === 'new-merchant') {
        isRelevant = day.total > 0
      }

      return { ...day, isRelevant }
    })
  }, [activeAnomalyFilter, timelineDays])

  const timelineByMonth = useMemo(() => {
    if (!timelineDaysForView.length) {
      return []
    }

    const grouped = timelineDaysForView.reduce((acc, day) => {
      if (!acc[day.month]) {
        acc[day.month] = []
      }
      acc[day.month].push(day)
      return acc
    }, {})

    return Object.entries(grouped)
      .map(([month, days]) => {
        const [year, monthNumber] = month.split('-').map(Number)
        const monthLabel = new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleString(
          'en-US',
          {
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
          }
        )

        return {
          month,
          monthLabel,
          days: days.sort((a, b) => a.date.localeCompare(b.date)),
        }
      })
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [timelineDaysForView])

  const activeFilterLabel = useMemo(
    () =>
      suspiciousFilterOptions.find((option) => option.key === activeAnomalyFilter)?.label ||
      'All Signals',
    [activeAnomalyFilter, suspiciousFilterOptions]
  )

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value || 0)

  const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`

  const severityClass = (severity) => {
    if (severity === 'high') {
      return 'bg-rose-500/20 text-rose-200 border-rose-300/40'
    }

    if (severity === 'medium') {
      return 'bg-amber-500/20 text-amber-200 border-amber-300/40'
    }

    return 'bg-cyan-500/20 text-cyan-100 border-cyan-300/40'
  }

  const heatmapLevelClass = (level) => {
    if (level >= 4) {
      return 'bg-rose-300/80 border-rose-100/60'
    }

    if (level === 3) {
      return 'bg-rose-300/60 border-rose-100/40'
    }

    if (level === 2) {
      return 'bg-amber-300/45 border-amber-100/40'
    }

    if (level === 1) {
      return 'bg-cyan-300/35 border-cyan-100/35'
    }

    return 'bg-slate-900/40 border-white/10'
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthError('')
    setAuthSuccess('')

    const email = authForm.email.trim().toLowerCase()
    const password = authForm.password.trim()
    const name = authForm.name.trim()

    if (!email || !password) {
      setAuthError('Email and password are required.')
      return
    }

    if (authMode === 'register' && !name) {
      setAuthError('Name is required for registration.')
      return
    }

    try {
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login'
      const payload =
        authMode === 'register'
          ? { name, email, password }
          : { email, password }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed.')
      }

      const session = { token: data.token, user: data.user }
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
      setAuthToken(data.token)
      setCurrentUser(data.user)
      setAuthSuccess(authMode === 'register' ? 'Account created. You are now signed in.' : 'Welcome back.')
      setAuthForm({ name: '', email: '', password: '' })
    } catch (authRequestError) {
      setAuthError(authRequestError.message)
    }
  }

  const handleSignOut = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    setAuthToken('')
    setCurrentUser(null)
    setReport(null)
    setError('')
    setIsUploading(false)
    setAuthError('')
    setAuthSuccess('')
    setActiveAnomalyFilter('all')
  }

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
      setError('No supported file selected. Please upload a CSV or PDF file.')
      return
    }

    setError('')
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('statement', acceptedFiles[0])

      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      })

      const data = await response.json()

      if (response.status === 401) {
        handleSignOut()
        throw new Error('Session expired. Please sign in again.')
      }

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed')
      }

      setReport(data)
      setActiveAnomalyFilter('all')
    } catch (uploadError) {
      setError(uploadError.message)
      setReport(null)
    } finally {
      setIsUploading(false)
    }
  }

  const onDropRejected = (fileRejections) => {
    if (!fileRejections.length) {
      setError('File rejected. Please upload a CSV or PDF file under 10MB.')
      return
    }

    const [{ errors }] = fileRejections
    const message =
      errors?.[0]?.code === 'file-too-large'
        ? 'File is too large. Maximum size is 10MB.'
        : 'Unsupported file. Please upload a CSV or PDF file.'

    setError(message)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
      'text/plain': ['.csv'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  })

  if (!currentUser) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-(--bg-deep) px-4 py-8 text-slate-100 sm:px-7 lg:px-12">
        <div className="pointer-events-none absolute -top-24 left-0 h-72 w-72 rounded-full bg-(--accent-cyan)/20 blur-[130px]" />
        <div className="pointer-events-none absolute right-0 top-1/3 h-80 w-80 rounded-full bg-(--accent-amber)/20 blur-[150px]" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-emerald-400/10 blur-[130px]" />

        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-6 lg:grid-cols-12">
          <MotionHeader
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7"
          >
            <p className="inline-flex rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-300">
              Envy
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
              Track hidden fees with a sharper home page.
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-slate-300/90 sm:text-base">
              Sign in or register to upload statements, review fee patterns, and see where money slips away.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Private by design</p>
                <p className="mt-2 text-sm text-slate-200">Statement files are analyzed in memory only.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Fast insights</p>
                <p className="mt-2 text-sm text-slate-200">Spot fee concentration, repeat offenders, and monthly trends.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">One place</p>
                <p className="mt-2 text-sm text-slate-200">Login, register, and analyze from a single dashboard.</p>
              </div>
            </div>
          </MotionHeader>

          <MotionSection
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="glass-panel lg:col-span-5"
          >
            <div className="flex rounded-2xl border border-white/10 bg-slate-950/45 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login')
                  setAuthError('')
                  setAuthSuccess('')
                }}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  authMode === 'login'
                    ? 'bg-white text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register')
                  setAuthError('')
                  setAuthSuccess('')
                }}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  authMode === 'register'
                    ? 'bg-white text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Register
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Full name</span>
                  <input
                    value={authForm.name}
                    onChange={(event) => setAuthForm((previous) => ({ ...previous, name: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-(--accent-cyan)"
                    placeholder="Enter your name"
                  />
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Email</span>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm((previous) => ({ ...previous, email: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-(--accent-cyan)"
                  placeholder="name@company.com"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Password</span>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm((previous) => ({ ...previous, password: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-(--accent-cyan)"
                  placeholder="Enter your password"
                />
              </label>

              {authError && <p className="text-sm text-rose-300">{authError}</p>}
              {authSuccess && <p className="text-sm text-emerald-300">{authSuccess}</p>}

              <button
                type="submit"
                className="w-full rounded-2xl bg-linear-to-r from-(--accent-cyan) to-(--accent-amber) px-4 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-95"
              >
                {authMode === 'login' ? 'Login to Envy' : 'Create Account'}
              </button>

              <p className="text-xs leading-5 text-slate-400">
                {authMode === 'login'
                  ? 'Sign in with your Envy account to analyze statements.'
                  : 'Register a secure account. Passwords are hashed server-side.'}
              </p>
            </form>
          </MotionSection>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-(--bg-deep) px-4 py-8 text-slate-100 sm:px-7 lg:px-12">
      <div className="pointer-events-none absolute -top-24 left-0 h-72 w-72 rounded-full bg-(--accent-cyan)/20 blur-[130px]" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-80 w-80 rounded-full bg-(--accent-amber)/20 blur-[150px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-emerald-400/10 blur-[130px]" />

      <MotionHeader
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mx-auto mb-7 flex max-w-7xl items-center justify-between gap-4"
      >
        <div>
          <p className="inline-flex rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-300">
            Envy
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Professional fee intelligence for your statement spend.
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-300/90 sm:text-base">
            Your statement is analyzed in memory. We do not store account numbers,
            card numbers, addresses, or personally identifiable transaction details.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:bg-white/10"
        >
          Sign out
        </button>
      </MotionHeader>

      <main className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-12">
        {activeAnomalyFilter !== 'all' && (
          <section className="glass-panel lg:col-span-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-200">
                Active suspicious filter: <span className="font-semibold text-white">{activeFilterLabel}</span>
              </p>
              <button
                type="button"
                onClick={() => setActiveAnomalyFilter('all')}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-slate-100 transition hover:border-white/45"
              >
                Clear Filter
              </button>
            </div>
          </section>
        )}

        <MotionSection
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          className="glass-panel lg:col-span-4"
        >
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
            Upload Statement
          </h2>
          <div
            {...getRootProps()}
            className={`mt-4 rounded-2xl border border-dashed p-6 text-center transition-all duration-300 ${
              isDragActive
                    ? 'border-(--accent-cyan)/90 bg-(--accent-cyan)/10'
                : 'border-slate-600/80 bg-slate-900/35 hover:border-slate-400/70'
            }`}
          >
            <input {...getInputProps()} />
            <p className="text-sm text-slate-100">
              Drag and drop CSV/PDF here, or click to upload.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Supported formats: .csv, .pdf | Max size: 10MB
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/45 p-4 text-sm text-slate-300">
            <p className="font-medium text-slate-100">Detection logic includes:</p>
            <p className="mt-2">
              Convenience Fee, Service Charge, Surcharge, Processing Fee,
              Maintenance, and recurring micro-debits.
            </p>
          </div>

          {isUploading && (
            <p className="mt-4 text-sm text-(--accent-cyan)">Analyzing statement...</p>
          )}
          {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Statement Spend</p>
            <p className="mt-2 text-3xl font-semibold text-white">{formatCurrency(totalSpent)}</p>
            <p className="mt-2 text-xs text-slate-400">
              {topMerchant
                ? `Highest spend at ${topMerchant.merchant} (${formatCurrency(topMerchant.total)}).`
                : 'Upload a statement to view spending insights.'}
            </p>
          </div>
        </MotionSection>

        <MotionSection
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.14 }}
          className="glass-panel lg:col-span-8"
        >
          <div className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-950/50 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Executive Summary</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-xl border border-white/10 bg-slate-900/55 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Spent</p>
                <p className="mt-3 text-2xl font-semibold text-white">{formatCurrency(totalSpent)}</p>
              </article>
              <article className="rounded-xl border border-white/10 bg-slate-900/55 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Recoverable Fees</p>
                <p className="mt-3 text-2xl font-semibold text-(--accent-cyan)">
                  {formatCurrency(report ? report.totals.recoverableFees : 0)}
                </p>
              </article>
              <article className="rounded-xl border border-white/10 bg-slate-900/55 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Hidden Fees</p>
                <p className="mt-3 text-2xl font-semibold text-rose-300">
                  {formatCurrency(report ? report.totals.hiddenFees : 0)}
                </p>
              </article>
              <article className="rounded-xl border border-white/10 bg-slate-900/55 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Transactions Scanned</p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {report ? report.totals.scannedTransactions : 0}
                </p>
              </article>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <Suspense
              fallback={
                <div className="xl:col-span-2 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
                  Loading charts...
                </div>
              }
            >
              <ReportCharts chartData={chartData} monthlyTrend={report?.monthlyTrend || []} />
            </Suspense>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Richer Insights</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-xl border border-white/10 bg-slate-900/55 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Top Fee Source</p>
                <p className="mt-3 text-lg font-semibold capitalize text-white">
                  {insights.topFeeSource?.merchant || 'No data yet'}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {formatCurrency(insights.topFeeSource?.total || 0)} across{' '}
                  {insights.topFeeSource?.count || 0} fee transactions
                </p>
              </article>
              <article className="rounded-xl border border-white/10 bg-slate-900/55 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Avg Hidden Fee / Transaction
                </p>
                <p className="mt-3 text-2xl font-semibold text-(--accent-cyan)">
                  {formatCurrency(insights.averageHiddenFeePerTransaction || 0)}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Based on {report?.totals?.flaggedTransactions || 0} flagged transactions
                </p>
              </article>
              <article className="rounded-xl border border-white/10 bg-slate-900/55 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Repeat Offenders
                </p>
                <p className="mt-3 text-2xl font-semibold text-amber-300">
                  {insights.repeatOffenderMerchants || 0}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Merchants hit 2+ times in the same statement
                </p>
              </article>
              <article className="rounded-xl border border-white/10 bg-slate-900/55 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Fee Concentration
                </p>
                <p className="mt-3 text-2xl font-semibold text-rose-300">
                  {formatPercent(insights.feeConcentrationPercentage || 0)}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Share of hidden fees coming from the largest source
                </p>
              </article>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/45 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Repeat Offender Merchants
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {(insights.repeatOffenderMerchantList || []).length === 0 && (
                  <div className="rounded-lg border border-white/10 bg-slate-950/35 p-3 text-sm text-slate-300 sm:col-span-3">
                    No merchant appeared enough times to be flagged as a repeat offender yet.
                  </div>
                )}
                {(insights.repeatOffenderMerchantList || []).map((entry) => (
                  <div key={entry.merchant} className="rounded-lg border border-white/10 bg-slate-950/35 p-3">
                    <p className="text-sm font-medium capitalize text-white">{entry.merchant}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {entry.count} transactions | {formatCurrency(entry.total)} |{' '}
                      {formatPercent(entry.share)} of hidden fees
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Suspicious Activity</p>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full border border-rose-300/40 bg-rose-500/15 px-2.5 py-1 text-rose-200">
                  Spikes: {anomalies.unusualSpikeMerchantCount || 0}
                </span>
                <span className="rounded-full border border-amber-300/40 bg-amber-500/15 px-2.5 py-1 text-amber-200">
                  Micro-debits: {anomalies.repeatedMicroDebitMerchants || 0}
                </span>
                <span className="rounded-full border border-cyan-300/40 bg-cyan-500/15 px-2.5 py-1 text-cyan-100">
                  New merchants: {anomalies.newMerchantCount || 0}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {suspiciousFilterOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setActiveAnomalyFilter(option.key)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] transition ${
                    activeAnomalyFilter === option.key
                      ? 'border-white/50 bg-white/20 text-white'
                      : 'border-white/20 bg-white/5 text-slate-300 hover:border-white/35'
                  }`}
                >
                  {option.label} ({option.count})
                </button>
              ))}
              {activeAnomalyFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setActiveAnomalyFilter('all')}
                  className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-slate-100 transition hover:border-white/45"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="mt-4 grid gap-3">
              {filteredSuspiciousActivities.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-300">
                  No suspicious activity matches this filter.
                </div>
              )}

              {filteredSuspiciousActivities.map((activity, index) => (
                <div
                  key={`${activity.type}-${activity.merchant || activity.date || index}`}
                  className="rounded-xl border border-white/10 bg-slate-900/45 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium capitalize text-slate-100">
                      {activity.merchant || activity.date || 'System signal'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveAnomalyFilter(activity.type)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] ${severityClass(
                        activity.severity
                      )}`}
                    >
                      {activity.badge}
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{activity.message}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    Amount: {formatCurrency(activity.amount || 0)} | Transactions:{' '}
                    {activity.count || 0}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </MotionSection>

        <MotionSection
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.18 }}
          className="glass-panel lg:col-span-12"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Hidden Fee Timeline Heatmap
            </p>
            <p className="text-xs text-slate-400">
              {report?.timeline?.calendarStart && report?.timeline?.calendarEnd
                ? `${report.timeline.calendarStart} to ${report.timeline.calendarEnd}`
                : 'Upload a statement to generate a timeline'}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span>Lower</span>
            {[1, 2, 3, 4].map((level) => (
              <span
                key={`legend-${level}`}
                className={`h-3 w-3 rounded-sm border ${heatmapLevelClass(level)}`}
              />
            ))}
            <span>Higher</span>
          </div>

          {timelineByMonth.length === 0 && (
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-300">
              No timeline yet. Upload a statement to see fee-heavy days.
            </div>
          )}

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {timelineByMonth.map((monthBlock) => (
              <article
                key={monthBlock.month}
                className="rounded-xl border border-white/10 bg-slate-900/45 p-4"
              >
                <p className="text-sm font-medium text-slate-100">{monthBlock.monthLabel}</p>
                <div className="mt-3 grid grid-cols-7 gap-1.5">
                  {monthBlock.days.map((day, index) => (
                    <div
                      key={day.date}
                      className={`h-8 rounded-md border ${heatmapLevelClass(day.level)} ${
                        day.isHeavy ? 'ring-1 ring-rose-300/60' : ''
                      } ${day.isRelevant ? 'opacity-100' : 'opacity-20'}`}
                      style={index === 0 ? { gridColumnStart: day.weekday + 1 } : undefined}
                      title={`${day.date} | ${formatCurrency(day.total)} | ${day.count} flagged`}
                    >
                      <span className="sr-only">{day.date}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </MotionSection>

        <MotionSection
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
          className="glass-panel lg:col-span-7"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Spending Breakdown
          </p>
          <div className="mt-4 space-y-3">
            {filteredSpendingByMerchant.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-300">
                {activeAnomalyFilter === 'all'
                  ? 'Upload a statement to view where your money is spent.'
                  : 'No merchants match the active suspicious activity filter.'}
              </div>
            )}
            {filteredSpendingByMerchant.map((entry) => (
              <div
                key={entry.merchant}
                className="rounded-xl border border-white/10 bg-slate-900/45 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium capitalize text-slate-100">{entry.merchant}</p>
                    {filteredSuspiciousMerchantMap[entry.merchant] && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveAnomalyFilter(filteredSuspiciousMerchantMap[entry.merchant].type)
                        }
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${severityClass(
                          filteredSuspiciousMerchantMap[entry.merchant].severity
                        )}`}
                      >
                        {filteredSuspiciousMerchantMap[entry.merchant].badge}
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-slate-200">{formatCurrency(entry.total)}</p>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-700/60">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-(--accent-cyan) to-(--accent-amber)"
                    style={{ width: `${Math.min(entry.share || 0, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-400">{entry.share}% of total spend</p>
              </div>
            ))}
          </div>
        </MotionSection>

        <MotionSection
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.26 }}
          className="glass-panel lg:col-span-5"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Wall of Shame
          </p>
          <div className="mt-4 grid gap-3">
            {filteredWallOfShame.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-300">
                {activeAnomalyFilter === 'all'
                  ? 'Upload a statement to reveal fee-heavy merchants.'
                  : 'No wall-of-shame merchants match the active filter.'}
              </div>
            )}
            {filteredWallOfShame.map((entry, index) => (
              <MotionArticle
                key={`${entry.merchant}-${index}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * index }}
                className="rounded-xl border border-white/10 bg-slate-900/55 p-4"
              >
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  Merchant
                </p>
                <p className="mt-1 text-lg font-medium capitalize text-white">
                  {entry.merchant}
                </p>
                {filteredSuspiciousMerchantMap[entry.merchant] && (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveAnomalyFilter(filteredSuspiciousMerchantMap[entry.merchant].type)
                    }
                    className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${severityClass(
                      filteredSuspiciousMerchantMap[entry.merchant].severity
                    )}`}
                  >
                    {filteredSuspiciousMerchantMap[entry.merchant].badge}
                  </button>
                )}
                <p className="mt-2 text-sm text-rose-300">
                  Hidden Fees: {formatCurrency(entry.total)}
                </p>
              </MotionArticle>
            ))}
          </div>
        </MotionSection>
      </main>
    </div>
  )
}

export default App
