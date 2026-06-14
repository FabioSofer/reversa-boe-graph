import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BriefingCard from './components/BriefingCard'
import SearchBar from './components/SearchBar'
import { api } from './api'

export default function App() {
  const [stats, setStats] = useState(null)
  const [briefings, setBriefings] = useState({})

  useEffect(() => {
    api('/api/stats').then(setStats)
    for (const i of [1, 2, 3, 4]) {
      api(`/api/briefings/${i}`).then(d => setBriefings(prev => ({ ...prev, [i]: d })))
    }
  }, [])

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">
          🏛️ El Boletín como Grafo de Conocimiento
        </h1>
        <p className="text-slate-400 text-lg">
          Los cuatro informes que el Consejo de Ministros necesita para simplificar el ordenamiento jurídico
        </p>
        {stats && (
          <div className="flex justify-center gap-8 mt-6 text-sm">
            <Stat label="Normas" value={stats.total?.toLocaleString()} />
            <Stat label="Vigentes" value={stats.vigente?.toLocaleString()} color="text-green-400" />
            <Stat label="Derogadas" value={stats.repealed?.toLocaleString()} color="text-red-400" />
            <Stat label="Relaciones" value={stats.relationships?.toLocaleString()} color="text-blue-400" />
          </div>
        )}
      </header>

      {/* Search */}
      <SearchBar />

      {/* Briefings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {briefings[1] && <BriefingCard num={1} data={briefings[1]} color="amber" />}
        {briefings[2] && <BriefingCard num={2} data={briefings[2]} color="red" />}
        {briefings[3] && <BriefingCard num={3} data={briefings[3]} color="purple" />}
        {briefings[4] && <BriefingCard num={4} data={briefings[4]} color="blue" />}
      </div>

      {/* Graph link */}
      <div className="text-center mt-10">
        <Link to="/graph" className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition">
          🔍 Explorar el grafo interactivo →
        </Link>
      </div>
    </div>
  )
}

function Stat({ label, value, color = "text-white" }) {
  return (
    <div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-slate-500">{label}</div>
    </div>
  )
}
