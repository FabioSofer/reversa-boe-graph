import { createContext, useContext, useState } from 'react'

const strings = {
  es: {
    title: '🏛️ El Boletín como Grafo de Conocimiento',
    subtitle: 'Los cuatro informes que el Consejo de Ministros necesita para simplificar el ordenamiento jurídico',
    norms: 'Normas',
    inForce: 'Vigentes',
    repealed: 'Derogadas',
    relationships: 'Relaciones',
    searchPlaceholder: 'Buscar normas... (ej: impuesto, educación, medio ambiente)',
    search: 'Buscar',
    exploreGraph: '🔍 Explorar el grafo interactivo →',
    briefing1Title: 'Diagnóstico: las leyes más ilegibles',
    briefing2Title: 'Causa raíz: los ómnibus legislativos',
    briefing3Title: 'La podredumbre: derecho vivo sobre ley muerta',
    briefing4Title: 'El bisturí: radio de impacto de la Ley 30/1992',
    timesAmended: 'veces modificada',
    normsModified: 'normas modificadas',
    liveLawCitesDead: 'del derecho vigente cita leyes ya derogadas',
    citingDead: 'normas vigentes',
    deadCited: 'normas derogadas',
    topGhosts: 'Top leyes fantasma:',
    stillCite: 'normas vigentes aún citan la Ley 30/1992',
    viewImpactGraph: 'Ver grafo de impacto →',
    andMore: 'y {n} más',
    // Graph explorer
    back: '← Informes',
    searchNorm: 'Buscar norma...',
    go: 'Ir',
    vigente: 'Vigente',
    derogada: 'Derogada',
    center: 'Centro',
    previous: '← Anterior',
    exploreRelations: '🔍 Explorar relaciones de esta norma',
    viewBOE: 'Ver texto completo en BOE →',
    clickNode: 'Haz clic en un nodo para ver sus detalles.',
    dragHint: 'Scroll para zoom. Arrastra el fondo para mover.',
    nodes: 'nodos',
    connections: 'conexiones',
    id: 'ID',
    status: 'Estado',
  },
  en: {
    title: '🏛️ The Gazette as a Knowledge Graph',
    subtitle: 'The four briefings the Council of Ministers needs to simplify the statute book',
    norms: 'Norms',
    inForce: 'In Force',
    repealed: 'Repealed',
    relationships: 'Relationships',
    searchPlaceholder: 'Search norms... (e.g.: tax, education, environment)',
    search: 'Search',
    exploreGraph: '🔍 Explore the interactive graph →',
    briefing1Title: 'Diagnosis: the most unreadable laws',
    briefing2Title: 'Root cause: the omnibus offenders',
    briefing3Title: 'The rot: live law resting on dead ground',
    briefing4Title: 'The scalpel: blast radius of Ley 30/1992',
    timesAmended: 'times amended',
    normsModified: 'norms modified',
    liveLawCitesDead: 'of live law cites repealed norms',
    citingDead: 'in-force norms',
    deadCited: 'repealed norms',
    topGhosts: 'Top ghost laws:',
    stillCite: 'in-force norms still cite Ley 30/1992',
    viewImpactGraph: 'View impact graph →',
    andMore: 'and {n} more',
    // Graph explorer
    back: '← Briefings',
    searchNorm: 'Search norm...',
    go: 'Go',
    vigente: 'In Force',
    derogada: 'Repealed',
    center: 'Center',
    previous: '← Back',
    exploreRelations: '🔍 Explore this norm\'s relationships',
    viewBOE: 'View full text on BOE →',
    clickNode: 'Click a node to view its details.',
    dragHint: 'Scroll to zoom. Drag background to pan.',
    nodes: 'nodes',
    connections: 'connections',
    id: 'ID',
    status: 'Status',
  },
}

const LangContext = createContext()

export function LangProvider({ children }) {
  const [lang, setLang] = useState('es')
  const t = strings[lang]
  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}

export function LangToggle() {
  const { lang, setLang } = useLang()
  return (
    <select
      value={lang}
      onChange={e => setLang(e.target.value)}
      className="fixed top-4 right-4 z-50 px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-300 cursor-pointer focus:outline-none focus:border-indigo-500"
    >
      <option value="es">🇪🇸 Español</option>
      <option value="en">🇬🇧 English</option>
    </select>
  )
}
