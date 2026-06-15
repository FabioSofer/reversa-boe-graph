import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useLang } from '../i18n'

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const navigate = useNavigate()
  const { t } = useLang()

  const handleSearch = async (e) => {
    e.preventDefault()
    if (query.length < 2) return
    const data = await api(`/api/search?q=${encodeURIComponent(query)}&limit=10`)
    setResults(data.results)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button type="submit" className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition">
          {t.search}
        </button>
      </form>
      {results && (
        <div className="mt-3 bg-slate-800 border border-slate-700 rounded-lg max-h-60 overflow-y-auto">
          {results.length === 0 && <p className="p-3 text-slate-500">Sin resultados</p>}
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => { navigate(`/graph/${r.id}`); setResults(null) }}
              className="block w-full text-left px-4 py-2 hover:bg-slate-700 border-b border-slate-700/50 last:border-0"
            >
              <div className="text-sm text-white truncate">{r.titulo}</div>
              <div className="text-xs text-slate-500 flex gap-3">
                <span>{r.rango}</span>
                <span className={r.vigente ? 'text-green-500' : 'text-red-500'}>
                  {r.vigente ? t.vigente : t.derogada}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
