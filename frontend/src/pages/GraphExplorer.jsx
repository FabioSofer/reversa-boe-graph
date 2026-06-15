import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import * as d3 from 'd3'
import { api } from '../api'
import { useLang } from '../i18n'

export default function GraphExplorer() {
  const { normId } = useParams()
  const navigate = useNavigate()
  const svgRef = useRef()
  const d3Refs = useRef({ zoom: null, g: null, node: null, simulation: null })
  const { t } = useLang()
  const [graphData, setGraphData] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [centerId, setCenterId] = useState(normId || 'BOE-A-2015-10565')
  const [history, setHistory] = useState([])

  // Redirect bare /graph to include the default ID
  useEffect(() => {
    if (!normId) navigate('/graph/BOE-A-2015-10565', { replace: true })
  }, [])

  // Load graph data
  useEffect(() => {
    const id = centerId
    api(`/api/graph/neighborhood/${id}`).then(data => {
      // Cap at 150 nodes for readability
      if (data.nodes.length > 150) {
        const nodeIds = new Set(data.nodes.slice(0, 150).map(n => n.id))
        data.nodes = data.nodes.filter(n => nodeIds.has(n.id))
        data.links = data.links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target))
      }
      setGraphData(data)
    })
    setSelectedNode(null)
  }, [centerId])

  // Update centerId when route changes
  useEffect(() => {
    if (normId !== centerId) setCenterId(normId || null)
  }, [normId])

  // D3 force simulation
  useEffect(() => {
    if (!graphData || !svgRef.current) return

    const { nodes, links } = graphData
    if (nodes.length === 0) return

    const currentCenterId = centerId
    const svg = d3.select(svgRef.current)
    const width = svg.node().getBoundingClientRect().width
    const height = svg.node().getBoundingClientRect().height

    svg.selectAll('*').remove()

    const g = svg.append('g')

    // Zoom
    const zoom = d3.zoom()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => g.attr('transform', event.transform))
    svg.call(zoom)

    const relColors = {
      MODIFICA: '#f59e0b',
      DEROGA: '#ef4444',
      CITA: '#8b5cf6',
      ANADE: '#10b981',
      CONFORMIDAD: '#60a5fa',
      DESARROLLA: '#14b8a6',
      OTRA_RELACION: '#94a3b8',
    }

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(25))

    // Links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => relColors[d.type] || '#94a3b8')
      .attr('stroke-opacity', 0.7)
      .attr('stroke-width', 1.5)

    // Nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => d.id === currentCenterId ? 14 : 8)
      .attr('fill', d => {
        if (d.id === currentCenterId) return '#6366f1'
        return d.vigente ? '#22c55e' : '#ef4444'
      })
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        // Just select — show in sidebar
        setSelectedNode(d)
        // Highlight selected
        node.attr('stroke', n => n.id === d.id ? '#fff' : '#0f172a')
          .attr('stroke-width', n => n.id === d.id ? 3 : 1.5)
      })

    // Labels: short ID on all nodes (e.g. "1992-26318"), full title on center
    const getShortLabel = (d) => {
      // BOE-A-1992-26318 → "1992-26318"
      const parts = d.id.match(/(\d{4})-(\d+)$/)
      return parts ? `${parts[1]}-${parts[2]}` : d.id.slice(-8)
    }

    g.append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text(d => d.id === currentCenterId ? d.titulo?.substring(0, 40) + '...' : getShortLabel(d))
      .attr('font-size', d => d.id === currentCenterId ? 10 : 7)
      .attr('fill', d => d.id === currentCenterId ? '#e2e8f0' : '#94a3b8')
      .attr('dx', d => d.id === currentCenterId ? 18 : 11)
      .attr('dy', 3)
      .style('pointer-events', 'none')

    // Tooltip on hover
    const tooltip = d3.select('body').append('div')
      .attr('class', 'fixed bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white pointer-events-none opacity-0 max-w-xs z-50')
      .style('transition', 'opacity 0.15s')

    node.on('mouseenter', (event, d) => {
      tooltip.style('opacity', 1)
        .style('left', event.pageX + 12 + 'px')
        .style('top', event.pageY - 10 + 'px')
        .html(`<strong>${d.id}</strong><br/>${d.titulo?.substring(0, 80)}`)
    }).on('mouseleave', () => tooltip.style('opacity', 0))

    // Store refs for external access (sidebar clicks)
    d3Refs.current = { zoom, g, node, simulation }

    simulation.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
      node.attr('cx', d => d.x).attr('cy', d => d.y)
      g.selectAll('text').attr('x', d => d.x).attr('y', d => d.y)
    })

    // Zoom to fit after stabilization
    setTimeout(() => {
      const bounds = g.node().getBBox()
      if (bounds.width === 0) return
      const scale = Math.min(width / bounds.width, height / bounds.height) * 0.75
      const tx = width / 2 - (bounds.x + bounds.width / 2) * scale
      const ty = height / 2 - (bounds.y + bounds.height / 2) * scale
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
    }, 800)

    return () => { tooltip.remove(); simulation.stop() }
  }, [graphData, centerId])

  // Pan camera + highlight when a DIFFERENT node is selected
  const prevSelectedId = useRef(null)
  useEffect(() => {
    if (!selectedNode || !d3Refs.current.node || !svgRef.current) return
    const { zoom, node } = d3Refs.current
    const svg = d3.select(svgRef.current)

    // Highlight
    node.attr('stroke', n => n.id === selectedNode.id ? '#fff' : '#0f172a')
      .attr('stroke-width', n => n.id === selectedNode.id ? 3 : 1.5)

    // Only pan if we selected a different node (not just toggling _showRels)
    if (selectedNode.id !== prevSelectedId.current) {
      const target = node.data().find(n => n.id === selectedNode.id)
      if (target && target.x != null) {
        const width = svg.node().getBoundingClientRect().width
        const height = svg.node().getBoundingClientRect().height
        const scale = 1.5
        const tx = width / 2 - target.x * scale
        const ty = height / 2 - target.y * scale
        svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
      }
      prevSelectedId.current = selectedNode.id
    }
  }, [selectedNode])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (searchQuery.length < 2) return
    const data = await api(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=8`)
    setSearchResults(data.results)
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-4 p-4 bg-slate-900 border-b border-slate-800">
        <Link to="/" className="text-slate-400 hover:text-white text-sm">{t.back}</Link>
        <form onSubmit={handleSearch} className="flex-1 max-w-md flex gap-2">
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t.searchNorm}
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button type="submit" className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded">{t.go}</button>
        </form>
        <div className="flex gap-3 text-xs text-slate-400">
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 mr-1"></span>{t.vigente}</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1"></span>{t.derogada}</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500 mr-1"></span>{t.center}</span>
          <span className="text-slate-600">|</span>
          <span><span className="inline-block w-3 h-0.5 bg-amber-500 mr-1 align-middle"></span>Modifica</span>
          <span><span className="inline-block w-3 h-0.5 bg-red-500 mr-1 align-middle"></span>Deroga</span>
          <span><span className="inline-block w-3 h-0.5 bg-purple-500 mr-1 align-middle"></span>Cita</span>
          <span><span className="inline-block w-3 h-0.5 bg-emerald-500 mr-1 align-middle"></span>Añade</span>
          <span><span className="inline-block w-3 h-0.5 bg-blue-400 mr-1 align-middle"></span>Conformidad</span>
          <span><span className="inline-block w-3 h-0.5 bg-teal-500 mr-1 align-middle"></span>Desarrolla</span>
          <span><span className="inline-block w-3 h-0.5 bg-slate-400 mr-1 align-middle"></span>Otra</span>
        </div>
      </div>

      {/* Search results dropdown */}
      {searchResults && (
        <div className="absolute top-16 left-20 z-50 bg-slate-800 border border-slate-700 rounded-lg w-96 max-h-60 overflow-y-auto shadow-xl">
          {searchResults.map(r => (
            <button
              key={r.id}
              onClick={() => { navigate(`/graph/${r.id}`); setSearchResults(null); setSearchQuery('') }}
              className="block w-full text-left px-4 py-2 hover:bg-slate-700 border-b border-slate-700/50 last:border-0"
            >
              <div className="text-sm text-white truncate">{r.titulo}</div>
              <div className="text-xs text-slate-500">{r.id}</div>
            </button>
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex">
        <svg ref={svgRef} className="flex-1 bg-slate-950" />

        {/* Sidebar */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 p-4 overflow-y-auto">
          {history.length > 0 && (
            <button
              onClick={() => { const prev = history[history.length - 1]; setHistory(h => h.slice(0, -1)); navigate(prev ? `/graph/${prev}` : '/graph') }}
              className="mb-3 text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              {t.previous}
            </button>
          )}
          {selectedNode ? (
            <>
              <h3 className="text-white font-semibold text-sm mb-3 leading-tight">{selectedNode.titulo}</h3>
              <div className="space-y-2 text-xs text-slate-400">
                <p><span className="text-slate-500">{t.id}:</span> {selectedNode.id}</p>
                <p>
                  <span className="text-slate-500">{t.status}: </span>
                  <span className={selectedNode.vigente ? 'text-green-400' : 'text-red-400'}>
                    {selectedNode.vigente ? t.vigente : t.derogada}
                  </span>
                </p>
              </div>

              <button
                onClick={() => { setHistory(h => [...h, centerId]); navigate(`/graph/${selectedNode.id}`) }}
                className="mt-4 w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded transition"
              >
                {t.exploreRelations}
              </button>

              <a
                href={`https://www.boe.es/buscar/act.php?id=${selectedNode.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-2 text-center text-xs text-indigo-400 hover:underline"
              >
                {t.viewBOE}
              </a>

              {/* Relationships table */}
              {graphData && (() => {
                const outgoing = graphData.links.filter(l => (l.source.id || l.source) === selectedNode.id)
                const incoming = graphData.links.filter(l => (l.target.id || l.target) === selectedNode.id)
                const nodeMap = Object.fromEntries(graphData.nodes.map(n => [n.id, n]))
                const grouped = {}
                outgoing.forEach(l => {
                  const key = l.type + ' →'
                  if (!grouped[key]) grouped[key] = []
                  const targetId = l.target.id || l.target
                  grouped[key].push(nodeMap[targetId])
                })
                incoming.forEach(l => {
                  const key = '← ' + l.type
                  if (!grouped[key]) grouped[key] = []
                  const sourceId = l.source.id || l.source
                  grouped[key].push(nodeMap[sourceId])
                })
                if (Object.keys(grouped).length === 0) return null
                return (
                  <div className="mt-4 pt-3 border-t border-slate-800">
                    <button onClick={() => setSelectedNode({...selectedNode, _showRels: !selectedNode._showRels})} className="text-slate-500 text-xs uppercase tracking-wide mb-2 hover:text-slate-300 w-full text-left">
                      {selectedNode._showRels ? '▾' : '▸'} {t.connections} ({graphData.links.filter(l => (l.source.id || l.source) === selectedNode.id || (l.target.id || l.target) === selectedNode.id).length})
                    </button>
                    {selectedNode._showRels && Object.entries(grouped).map(([type, norms]) => (
                      <div key={type} className="mb-3">
                        <p className="text-xs font-medium text-slate-400 mb-1">{type} <span className="text-slate-600">({norms.length})</span></p>
                        <div className="space-y-1 pl-2 border-l border-slate-800">
                          {norms.filter(Boolean).slice(0, 10).map(n => (
                            <button
                              key={n.id}
                              onClick={() => setSelectedNode(n)}
                              className="block text-left text-xs text-slate-300 hover:text-white truncate w-full"
                            >
                              <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${n.vigente ? 'bg-green-500' : 'bg-red-500'}`}></span>
                              {n.titulo?.substring(0, 60)}
                            </button>
                          ))}
                          {norms.length > 10 && <p className="text-xs text-slate-600">+{norms.length - 10} más</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </>
          ) : (
            <div className="text-slate-500 text-sm">
              <p className="mb-2">{t.clickNode}</p>
              <p className="text-xs">{t.dragHint}</p>
            </div>
          )}

          {/* Graph stats */}
          {graphData && (
            <div className="mt-6 pt-4 border-t border-slate-800">
              <p className="text-slate-500 text-xs mb-2">
                {graphData.nodes.length} {t.nodes} · {graphData.links.length} {t.connections}
              </p>
              <div className="space-y-1">
                {Object.entries(
                  graphData.links.reduce((acc, l) => { acc[l.type] = (acc[l.type] || 0) + 1; return acc }, {})
                ).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                  <div key={type} className="flex justify-between text-xs">
                    <span className="text-slate-400">{type}</span>
                    <span className="text-slate-500">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
