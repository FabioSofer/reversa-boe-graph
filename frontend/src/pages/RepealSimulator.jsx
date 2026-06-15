import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useLang } from '../i18n'

export default function RepealSimulator() {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const { lang } = useLang()

  const handleSearch = async (e) => {
    e.preventDefault()
    if (query.length < 2) return
    const data = await api(`/api/search?q=${encodeURIComponent(query)}&limit=8`)
    setSearchResults(data.results)
  }

  const simulate = async (normId) => {
    setSearchResults(null)
    setLoading(true)
    const data = await api(`/api/bonus/repeal-simulator/${normId}`)
    setResult(data)
    setLoading(false)
  }

  const title = lang === 'es' ? '🔬 Simulador de Derogación' : '🔬 Repeal Simulator'
  const subtitle = lang === 'es'
    ? '¿Qué se rompería si derogamos esta norma?'
    : 'What would break if this norm were repealed?'
  const placeholder = lang === 'es' ? 'Buscar una norma para simular...' : 'Search a norm to simulate...'
  const impactLabel = lang === 'es' ? 'normas vigentes dependen de esta ley' : 'in-force norms depend on this law'
  const wouldBreak = lang === 'es' ? 'Se verían afectadas:' : 'Would be affected:'

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <Link to="/" className="text-slate-400 hover:text-white text-sm">← {lang === 'es' ? 'Informes' : 'Briefings'}</Link>

      <h1 className="text-3xl font-bold text-white mt-4 mb-2">{title}</h1>
      <p className="text-slate-400 mb-6">{subtitle}</p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button type="submit" className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">
          {lang === 'es' ? 'Buscar' : 'Search'}
        </button>
      </form>

      {searchResults && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg max-h-60 overflow-y-auto mb-6">
          {searchResults.map(r => (
            <button
              key={r.id}
              onClick={() => simulate(r.id)}
              className="block w-full text-left px-4 py-2 hover:bg-slate-700 border-b border-slate-700/50 last:border-0"
            >
              <div className="text-sm text-white truncate">{r.titulo}</div>
              <div className="text-xs text-slate-500">{r.id}</div>
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-slate-400">Calculating impact...</p>}

      {result && (
        <div className="mt-4">
          <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl mb-4">
            <p className="text-sm text-slate-400 mb-1">{result.target.titulo}</p>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-red-400">{result.impact_count}</span>
              <span className="text-slate-400">{impactLabel}</span>
            </div>
          </div>

          {result.impact_count > 0 && (
            <div>
              <p className="text-slate-400 text-sm mb-2">{wouldBreak}</p>
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {result.dependents.map(d => (
                  <div key={d.id} className="flex items-center gap-2 text-sm">
                    <Link to={`/graph/${d.id}`} className="text-slate-200 hover:text-white truncate">
                      {d.titulo}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link to={`/graph/${result.target.id}`} className="inline-block mt-4 text-indigo-400 hover:underline text-sm">
            {lang === 'es' ? 'Ver en el grafo →' : 'View in graph →'}
          </Link>
        </div>
      )}
    </div>
  )
}
