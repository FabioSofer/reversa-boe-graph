import { Link } from 'react-router-dom'
import { useLang } from '../i18n'

const colors = {
  amber: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', badge: 'bg-amber-500', text: 'text-amber-400' },
  red: { border: 'border-red-500/30', bg: 'bg-red-500/10', badge: 'bg-red-500', text: 'text-red-400' },
  purple: { border: 'border-purple-500/30', bg: 'bg-purple-500/10', badge: 'bg-purple-500', text: 'text-purple-400' },
  blue: { border: 'border-blue-500/30', bg: 'bg-blue-500/10', badge: 'bg-blue-500', text: 'text-blue-400' },
}

export default function BriefingCard({ num, data, color }) {
  const c = colors[color]
  const { t } = useLang()

  const titles = { 1: t.briefing1Title, 2: t.briefing2Title, 3: t.briefing3Title, 4: t.briefing4Title }

  if (num === 3) return <Briefing3Card data={data} c={c} t={t} title={titles[3]} />
  if (num === 4) return <Briefing4Card data={data} c={c} t={t} title={titles[4]} />

  const items = data.data || []
  const metric = num === 1 ? 'amendments' : 'modified_count'
  const unit = num === 1 ? t.timesAmended : t.normsModified

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-6`}>
      <div className="flex items-center gap-3 mb-4">
        <span className={`${c.badge} text-white text-xs font-bold px-2 py-1 rounded`}>0{num}</span>
        <h2 className="text-lg font-semibold text-white">{titles[num]}</h2>
      </div>
      <ul className="space-y-3">
        {items.map(item => (
          <li key={item.id} className="flex items-start gap-3">
            <span className={`${c.text} font-bold text-lg min-w-[2rem]`}>{item[metric]}</span>
            <div className="flex-1 min-w-0">
              <Link to={`/graph/${item.id}`} className="text-slate-200 hover:text-white text-sm leading-tight block truncate">
                {item.titulo}
              </Link>
              <span className="text-slate-500 text-xs">{unit}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Briefing3Card({ data, c, t, title }) {
  const { stats, top_ghosts } = data
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-6`}>
      <div className="flex items-center gap-3 mb-4">
        <span className={`${c.badge} text-white text-xs font-bold px-2 py-1 rounded`}>03</span>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {stats && (
        <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
          <span className={`text-3xl font-bold ${c.text}`}>{stats.percentage}%</span>
          <span className="text-slate-400 ml-2">{t.liveLawCitesDead}</span>
          <div className="text-slate-500 text-xs mt-1">
            {stats.citing_dead} {t.citingDead} → {stats.ghosts} {t.deadCited}
          </div>
        </div>
      )}
      <p className="text-slate-400 text-xs mb-2 uppercase tracking-wide">{t.topGhosts}</p>
      <ul className="space-y-2">
        {(top_ghosts || []).map(item => (
          <li key={item.id} className="flex items-start gap-3">
            <span className={`${c.text} font-bold min-w-[2.5rem]`}>{item.cited_by_count}</span>
            <Link to={`/graph/${item.id}`} className="text-slate-200 hover:text-white text-sm truncate">
              {item.titulo}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Briefing4Card({ data, c, t, title }) {
  const items = data.data || []
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-6`}>
      <div className="flex items-center gap-3 mb-4">
        <span className={`${c.badge} text-white text-xs font-bold px-2 py-1 rounded`}>04</span>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
        <span className={`text-3xl font-bold ${c.text}`}>{data.count}</span>
        <span className="text-slate-400 ml-2">{t.stillCite}</span>
      </div>
      <Link to="/graph/BOE-A-1992-26318" className={`${c.text} text-sm hover:underline`}>
        {t.viewImpactGraph}
      </Link>
      <div className="mt-3 max-h-40 overflow-y-auto space-y-1">
        {items.slice(0, 15).map(item => (
          <div key={item.id} className="text-slate-400 text-xs truncate">• {item.titulo}</div>
        ))}
        {items.length > 15 && <div className="text-slate-500 text-xs">... {t.andMore.replace('{n}', items.length - 15)}</div>}
      </div>
    </div>
  )
}
