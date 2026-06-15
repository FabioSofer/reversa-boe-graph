import { useEffect, useState } from 'react'
import { api } from '../api'
import { useLang } from '../i18n'

export default function DecayChart() {
  const [data, setData] = useState(null)
  const { lang } = useLang()

  useEffect(() => {
    api('/api/bonus/decay-timeline').then(d => setData(d.data))
  }, [])

  if (!data) return null

  const max = Math.max(...data.map(d => d.amendments))
  const title = lang === 'es'
    ? 'Decadencia legislativa: modificaciones por década'
    : 'Legislative decay: amendments per decade'
  const subtitle = lang === 'es'
    ? 'El ordenamiento jurídico se complica exponencialmente'
    : 'The statute book is getting exponentially more complex'

  return (
    <div className="mt-8 rounded-xl border border-slate-700/30 bg-slate-800/30 p-6">
      <h2 className="text-lg font-semibold text-white mb-1">{title}</h2>
      <p className="text-slate-400 text-sm mb-4">{subtitle}</p>
      <div className="flex items-end gap-2 h-40">
        {data.map(d => (
          <div key={d.decade} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs text-slate-400">{d.amendments.toLocaleString()}</span>
            <div
              className="w-full bg-amber-500/80 rounded-t transition-all"
              style={{ height: `${(d.amendments / max) * 100}%`, minHeight: '2px' }}
            />
            <span className="text-xs text-slate-500">{d.decade}s</span>
          </div>
        ))}
      </div>
    </div>
  )
}
