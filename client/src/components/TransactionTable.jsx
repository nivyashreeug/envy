import { useState, useMemo } from 'react'
import {
  formatCurrency,
  formatDate,
  getRiskLevelClass,
  getCategoryBadgeClass,
  getClassificationBadgeClass,
} from '../utils/formatters'

function TransactionTable({ transactions, onSelectTransaction }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [selectedRisk, setSelectedRisk] = useState('ALL')
  const [selectedClassification, setSelectedClassification] = useState('ALL')
  const [sortField, setSortField] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const items = transactions || []

  const categoriesList = useMemo(() => {
    const set = new Set(items.map((t) => t.category).filter(Boolean))
    return ['ALL', ...Array.from(set).sort()]
  }, [items])

  const classificationsList = useMemo(() => {
    const set = new Set(items.map((t) => t.classification).filter(Boolean))
    return ['ALL', ...Array.from(set).sort()]
  }, [items])

  const filteredItems = useMemo(() => {
    return items
      .filter((t) => {
        if (searchTerm) {
          const q = searchTerm.toLowerCase()
          const desc = (t.description || '').toLowerCase()
          const merch = (t.normalizedMerchant || '').toLowerCase()
          if (!desc.includes(q) && !merch.includes(q)) return false
        }
        if (selectedCategory !== 'ALL' && t.category !== selectedCategory) {
          return false
        }
        if (selectedRisk !== 'ALL' && t.riskLevel !== selectedRisk) {
          return false
        }
        if (
          selectedClassification !== 'ALL' &&
          t.classification !== selectedClassification
        ) {
          return false
        }
        return true
      })
      .sort((a, b) => {
        let valA = a[sortField]
        let valB = b[sortField]

        if (sortField === 'amount') {
          valA = Math.abs(a.amount || 0)
          valB = Math.abs(b.amount || 0)
        } else if (sortField === 'riskScore') {
          valA = a.riskScore || 0
          valB = b.riskScore || 0
        } else if (sortField === 'date') {
          valA = new Date(a.date || 0).getTime()
          valB = new Date(b.date || 0).getTime()
        }

        if (sortOrder === 'asc') {
          return valA > valB ? 1 : -1
        }
        return valA < valB ? 1 : -1
      })
  }, [
    items,
    searchTerm,
    selectedCategory,
    selectedRisk,
    selectedClassification,
    sortField,
    sortOrder,
  ])

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1
  const currentPage = Math.min(page, totalPages)
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
    setPage(1)
  }

  return (
    <section className="white-card bg-white" aria-label="Transaction Intelligence Table">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Audit Ledger
          </p>
          <h2 className="mt-0.5 text-lg font-bold text-slate-900">Transaction Intelligence Table</h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-700">
          Showing {filteredItems.length} of {items.length} records
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Search */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
            Search
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(1)
            }}
            placeholder="Search merchant or description..."
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Category Filter */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
            Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
          >
            {categoriesList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Risk Filter */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
            Risk Level
          </label>
          <select
            value={selectedRisk}
            onChange={(e) => {
              setSelectedRisk(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="HIGH">High Risk (70-100)</option>
            <option value="MEDIUM">Medium Risk (40-69)</option>
            <option value="LOW">Low Risk (0-39)</option>
          </select>
        </div>

        {/* Classification Filter */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
            Classification
          </label>
          <select
            value={selectedClassification}
            onChange={(e) => {
              setSelectedClassification(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
          >
            {classificationsList.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table for Desktop / Tablets */}
      <div className="mt-4 hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-800">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <tr>
              <th
                onClick={() => handleSort('date')}
                className="py-3 px-3 cursor-pointer hover:text-slate-900"
              >
                Date {sortField === 'date' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="py-3 px-3">Description</th>
              <th className="py-3 px-3">Category</th>
              <th className="py-3 px-3">Classification</th>
              <th
                onClick={() => handleSort('amount')}
                className="py-3 px-3 text-right cursor-pointer hover:text-slate-900"
              >
                Amount {sortField === 'amount' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th
                onClick={() => handleSort('riskScore')}
                className="py-3 px-3 text-center cursor-pointer hover:text-slate-900"
              >
                Risk Score {sortField === 'riskScore' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  No transactions match the selected filters.
                </td>
              </tr>
            ) : (
              paginatedItems.map((txn) => {
                const absAmount = Math.abs(txn.amount || 0)
                const isCredit = (txn.amount || 0) > 0
                return (
                  <tr
                    key={txn.id}
                    onClick={() => onSelectTransaction && onSelectTransaction(txn)}
                    className="hover:bg-slate-50 cursor-pointer transition"
                  >
                    <td className="py-3 px-3 font-mono text-slate-500">
                      {formatDate(txn.date)}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-900 truncate max-w-xs">{txn.description}</p>
                      {txn.reasons?.[0] && (
                        <p className="text-[11px] text-slate-500 truncate max-w-xs">
                          {txn.reasons[0]}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${getCategoryBadgeClass(
                          txn.category
                        )}`}
                      >
                        {txn.category || 'OTHER'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${getClassificationBadgeClass(
                          txn.classification
                        )}`}
                      >
                        {txn.classification || 'NORMAL_EXPENSE'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold">
                      <span className={isCredit ? 'text-emerald-600' : 'text-slate-900'}>
                        {isCredit ? '+' : '-'}{formatCurrency(absAmount)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-xs font-bold ${getRiskLevelClass(
                          txn.riskLevel
                        )}`}
                      >
                        {txn.riskScore ?? 0}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Card View for Mobile */}
      <div className="mt-4 md:hidden space-y-3">
        {paginatedItems.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">
            No transactions match the selected filters.
          </p>
        ) : (
          paginatedItems.map((txn) => {
            const absAmount = Math.abs(txn.amount || 0)
            const isCredit = (txn.amount || 0) > 0
            return (
              <div
                key={txn.id}
                onClick={() => onSelectTransaction && onSelectTransaction(txn)}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 hover:border-slate-300 transition cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{txn.description}</p>
                    <p className="text-[11px] text-slate-500">{formatDate(txn.date)}</p>
                  </div>
                  <span className={`text-sm font-extrabold ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {isCredit ? '+' : '-'}{formatCurrency(absAmount)}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span
                    className={`rounded-md border px-2 py-0.5 font-bold uppercase ${getCategoryBadgeClass(
                      txn.category
                    )}`}
                  >
                    {txn.category || 'OTHER'}
                  </span>
                  <span
                    className={`rounded-md border px-2 py-0.5 font-bold uppercase ${getClassificationBadgeClass(
                      txn.classification
                    )}`}
                  >
                    {txn.classification}
                  </span>
                  <span
                    className={`rounded-md border px-2 py-0.5 font-bold uppercase ${getRiskLevelClass(
                      txn.riskLevel
                    )}`}
                  >
                    Risk: {txn.riskScore}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-600">
          <p>
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export default TransactionTable
