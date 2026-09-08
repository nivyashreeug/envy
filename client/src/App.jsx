import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'

import FinancialOverview from './components/FinancialOverview.jsx'
import RiskOverview from './components/RiskOverview.jsx'
import RecurringPayments from './components/RecurringPayments.jsx'
import CategoryBreakdown from './components/CategoryBreakdown.jsx'
import TransactionTable from './components/TransactionTable.jsx'
import TransactionDetailsModal from './components/TransactionDetailsModal.jsx'
import FinancialInsights from './components/FinancialInsights.jsx'
import PotentialSavings from './components/PotentialSavings.jsx'
import { formatCurrency, formatPercent } from './utils/formatters.js'

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
  const [selectedTransaction, setSelectedTransaction] = useState(null)

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

  const filteredSpendingByMerchant = useMemo(() => {
    return report?.spendingByMerchant || []
  }, [report?.spendingByMerchant])

  const filteredWallOfShame = useMemo(() => {
    return report?.wallOfShame || []
  }, [report?.wallOfShame])

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

  const severityClass = (severity) => {
    if (severity === 'high') {
      return 'bg-rose-50 text-rose-700 border-rose-200'
    }

    if (severity === 'medium') {
      return 'bg-amber-50 text-amber-800 border-amber-200'
    }

    return 'bg-blue-50 text-blue-700 border-blue-200'
  }

  const heatmapLevelClass = (level) => {
    if (level >= 4) {
      return 'bg-rose-200 border-rose-300'
    }

    if (level === 3) {
      return 'bg-rose-100 border-rose-200'
    }

    if (level === 2) {
      return 'bg-amber-100 border-amber-200'
    }

    if (level === 1) {
      return 'bg-sky-100 border-sky-200'
    }

    return 'bg-slate-100 border-slate-200'
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
    setSelectedTransaction(null)
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
        throw new Error(data.error || 'Analysis failed. Please check file format.')
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
        : 'Unsupported file format. Please upload a CSV or PDF file.'

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
    disabled: isUploading,
  })

  // Unauthenticated Landing Page
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-7 lg:px-12">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-8 lg:grid-cols-12">
          <MotionHeader
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-7"
          >
            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-blue-700">
              Envy Financial Intelligence
            </span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
              Track hidden fees with precision intelligence.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 leading-relaxed">
              Sign in or register to upload bank statements, review explainable fee patterns, audit recurring subscriptions, and uncover potential savings.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Private by design</p>
                <p className="mt-1.5 text-sm text-slate-700">Statement files are processed in memory only.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Explainable Scores</p>
                <p className="mt-1.5 text-sm text-slate-700">Deterministic risk scoring and structured reasons for every flagged item.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Recurring & Savings</p>
                <p className="mt-1.5 text-sm text-slate-700">Automatic multi-cadence stream mapping and savings estimation.</p>
              </div>
            </div>
          </MotionHeader>

          <MotionSection
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md lg:col-span-5"
          >
            <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login')
                  setAuthError('')
                  setAuthSuccess('')
                }}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                  authMode === 'login'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register')
                  setAuthError('')
                  setAuthSuccess('')
                }}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                  authMode === 'register'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Register
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Full Name
                  </span>
                  <input
                    value={authForm.name}
                    onChange={(event) => setAuthForm((previous) => ({ ...previous, name: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    placeholder="Enter your name"
                  />
                </label>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Email Address
                </span>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm((previous) => ({ ...previous, email: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  placeholder="name@company.com"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Password
                </span>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm((previous) => ({ ...previous, password: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  placeholder="Enter your password"
                />
              </label>

              {authError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                  {authError}
                </div>
              )}
              {authSuccess && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                  {authSuccess}
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 shadow-xs"
              >
                {authMode === 'login' ? 'Sign In to Envy' : 'Create Account'}
              </button>

              <p className="text-xs leading-5 text-slate-500 text-center">
                {authMode === 'login'
                  ? 'Sign in to access your statement intelligence dashboard.'
                  : 'Register a secure account. Passwords are encrypted server-side.'}
              </p>
            </form>
          </MotionSection>
        </div>
      </div>
    )
  }

  // Authenticated Main Dashboard
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-7 lg:px-12">
      {/* Top Header */}
      <MotionHeader
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto mb-6 flex max-w-7xl items-center justify-between gap-4 border-b border-slate-200 bg-white p-4 rounded-2xl shadow-xs"
      >
        <div>
          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-blue-700">
            Envy Intelligence
          </span>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Financial Intelligence & Fee Audit
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-block text-xs font-medium text-slate-500">
            Signed in as <strong className="text-slate-900">{currentUser.email}</strong>
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </MotionHeader>

      <main className="mx-auto max-w-7xl space-y-6">
        {/* Upload & Statement Overview Section */}
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Uploader Card */}
          <MotionSection
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="white-card bg-white lg:col-span-4"
          >
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Upload Statement
            </h2>
            <div
              {...getRootProps()}
              className={`mt-3.5 rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer ${
                isDragActive
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-slate-300 bg-slate-50/70 hover:border-slate-400 hover:bg-slate-50'
              } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <input {...getInputProps()} />
              {isUploading ? (
                <div className="flex flex-col items-center justify-center py-2">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  <p className="mt-2 text-xs font-bold text-blue-700">
                    Running Financial Intelligence Engine...
                  </p>
                </div>
              ) : (
                <>
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    Drag & drop bank statement (CSV/PDF) or click to browse
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Supported: .csv, .pdf | Max size: 10MB
                  </p>
                </>
              )}
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
              <p className="font-bold text-slate-800">Detection Capabilities:</p>
              <p className="mt-1 leading-relaxed text-slate-500">
                Identifies bank service charges, ATM surcharges, multi-cadence recurring streams, subscription tags, micro-debits, and statistical outlier risk scoring.
              </p>
            </div>
          </MotionSection>

          {/* Top-Level Financial Overview Card */}
          <div className="lg:col-span-8">
            <FinancialOverview
              totals={report?.totals}
              recurringPayments={report?.recurringPayments}
            />
          </div>
        </div>

        {/* Phase 2 Intelligence: Risk Overview & Potential Savings Grid */}
        {report && (
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            <div className="lg:col-span-7">
              <RiskOverview
                riskSummary={report.riskSummary}
                onSelectTransaction={setSelectedTransaction}
              />
            </div>
            <div className="lg:col-span-5">
              <PotentialSavings potentialSavings={report.potentialSavings} />
            </div>
          </div>
        )}

        {/* Financial Insights Highlights */}
        {report && (
          <FinancialInsights
            insights={report.insights}
            categories={report.categories}
            recurringPayments={report.recurringPayments}
            anomalies={report.anomalies}
            totals={report.totals}
          />
        )}

        {/* Recurring Payments & Category Breakdown Grid */}
        {report && (
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            <div className="lg:col-span-6">
              <RecurringPayments recurringPayments={report.recurringPayments} />
            </div>
            <div className="lg:col-span-6">
              <CategoryBreakdown categories={report.categories} />
            </div>
          </div>
        )}

        {/* Core Charts (Transparent vs Hidden & Monthly Trend) */}
        {report && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Suspense
              fallback={
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-xs text-slate-500">
                  Loading charts...
                </div>
              }
            >
              <ReportCharts
                chartData={chartData}
                monthlyTrend={report?.monthlyTrend || []}
              />
            </Suspense>
          </div>
        )}

        {/* Interactive Transaction Intelligence Table */}
        {report && (
          <TransactionTable
            transactions={report.transactionInsights}
            onSelectTransaction={setSelectedTransaction}
          />
        )}

        {/* Suspicious Activity Anomaly Filter Signals */}
        {report && (
          <MotionSection
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="white-card bg-white"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Anomaly Filter & Heatmap
                </p>
                <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                  Suspicious Activity Signals ({suspiciousActivities.length})
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 font-semibold text-rose-700">
                  Spikes: {anomalies.unusualSpikeMerchantCount || 0}
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-800">
                  Micro-debits: {anomalies.repeatedMicroDebitMerchants || 0}
                </span>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-semibold text-blue-700">
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
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
                    activeAnomalyFilter === option.key
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {option.label} ({option.count})
                </button>
              ))}
              {activeAnomalyFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setActiveAnomalyFilter('all')}
                  className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-200 transition"
                >
                  Clear Filter
                </button>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSuspiciousActivities.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 sm:col-span-3">
                  No suspicious activity matching this filter.
                </div>
              ) : (
                filteredSuspiciousActivities.map((activity, index) => (
                  <div
                    key={`${activity.type}-${activity.merchant || activity.date || index}`}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold capitalize text-slate-900 truncate">
                        {activity.merchant || activity.date || 'System signal'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveAnomalyFilter(activity.type)}
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${severityClass(
                          activity.severity
                        )}`}
                      >
                        {activity.badge}
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-600">{activity.message}</p>
                    <p className="mt-2 text-[11px] font-medium text-slate-500">
                      Amount: {formatCurrency(activity.amount || 0)} | {activity.count || 0} occurrences
                    </p>
                  </div>
                ))
              )}
            </div>
          </MotionSection>
        )}

        {/* Hidden Fee Timeline Heatmap */}
        {report && (
          <MotionSection
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="white-card bg-white"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Fee Timeline Heatmap
                </p>
                <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                  Daily Fee Concentration
                </h2>
              </div>
              <p className="text-xs font-medium text-slate-500">
                {report?.timeline?.calendarStart && report?.timeline?.calendarEnd
                  ? `${report.timeline.calendarStart} to ${report.timeline.calendarEnd}`
                  : 'Timeline Calendar'}
              </p>
            </div>

            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500 font-medium">
              <span>Lower</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <span
                  key={`legend-${level}`}
                  className={`h-3 w-3 rounded-xs border ${heatmapLevelClass(level)}`}
                />
              ))}
              <span>Higher</span>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {timelineByMonth.map((monthBlock) => (
                <article
                  key={monthBlock.month}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <p className="text-sm font-bold text-slate-900">{monthBlock.monthLabel}</p>
                  <div className="mt-3 grid grid-cols-7 gap-1.5">
                    {monthBlock.days.map((day, index) => (
                      <div
                        key={day.date}
                        className={`h-7 rounded-md border ${heatmapLevelClass(day.level)} ${
                          day.isHeavy ? 'ring-2 ring-rose-400' : ''
                        } ${day.isRelevant ? 'opacity-100' : 'opacity-30'}`}
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
        )}

        {/* Spending Breakdown & Wall of Shame */}
        {report && (
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            {/* Spending by Merchant */}
            <div className="white-card bg-white lg:col-span-7">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Top Merchant Spend
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-slate-900">Spending by Merchant</h2>
              <div className="mt-4 space-y-3">
                {filteredSpendingByMerchant.map((entry) => (
                  <div
                    key={entry.merchant}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <p className="font-bold capitalize text-slate-900">{entry.merchant}</p>
                      <p className="font-extrabold text-slate-900">{formatCurrency(entry.total)}</p>
                    </div>
                    <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${Math.min(entry.share || 0, 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500">{entry.share}% of total spend</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Wall of Shame */}
            <div className="white-card bg-white lg:col-span-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">
                Fee Offenders
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-slate-900">Wall of Shame</h2>
              <div className="mt-4 space-y-2.5">
                {filteredWallOfShame.length === 0 ? (
                  <p className="text-xs text-slate-500">No hidden fee offenders detected.</p>
                ) : (
                  filteredWallOfShame.map((entry, index) => (
                    <div
                      key={`${entry.merchant}-${index}`}
                      className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs"
                    >
                      <p className="font-bold capitalize text-slate-900">{entry.merchant}</p>
                      <span className="font-extrabold text-rose-700">{formatCurrency(entry.total)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <TransactionDetailsModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </div>
  )
}

export default App
