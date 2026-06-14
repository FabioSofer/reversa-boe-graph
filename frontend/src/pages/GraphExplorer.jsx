import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import * as d3 from 'd3'
import { api } from '../api'

export default function GraphExplorer() {
  const { normId } = useParams()
  const navigate = useNavigate()
  const svgRef = useRef()
  const [graphData, setGraphData] = useState(null)
  const [selectedNorm, setSelectedNorm] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [centerId, setCenterId] = useState(normId || 'BOE-A-1992-26318')

  // Load graph data
  useEffect(() => {
    api(`/api/graph/neighborhood/${centerId}`).then(setGraphData)
    api(`/api/graph/norm/${centerId}`).then(d => setSelectedNorm(d.norm))
  }, [centerId])

  // Update centerId when route changes
  useEffect(() => {
    if (normId && normId !== centerId) setCenterId(normId)
  }, [normId])

  // D3 force simulation
  useEffect(() => {
    if (!graphData || !svgRef.current) return

    const { nodes, links } = graphData
    if (nodes.length === 0) return

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

    // Color scale for relationship types
    const relColors = {
      MODIFICA: '#f59e0b',
      DEROGA: '#ef4444',
      CITA: '#8b5cf6',
      ANADE: '#10b981',
      CONFORMIDAD: '#6b7280',
      OTRA_RELACION: '#475569',
    }

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(20))

    // Links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => relColors[d.type] || '#475569')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1.5)

    // Nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => d.id === centerId ? 12 : 7)
      .attr('fill', d => {
        if (d.id === centerId) return '#6366f1'
        return d.vigente ? '#22c55e' : '#ef4444'
      })
      .attr('stroke', d => d.id === centerId ? '#fff' : 'none')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        navigate(`/graph/${d.id}`)
      })
      .call(d3.drag()
        .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null })
      )

    // Labels for center node and immediate neighbors
    const label = g.append('g')
      .selectAll('text')
      .data(nodes.filter(d => d.id === centerId))
      .join('text')
      .text(d => d.titulo?.substring(0, 50) + '...')
      .attr('font-size', 10)
      .attr('fill', '#e2e8f0')
      .attr('dx', 15)
      .attr('dy', 4)

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'fixed bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white pointer-events-none opacity-0 max-w-xs z-50')
      .style('transition', 'opacity 0.15s')

    node.on('mouseenter', (event, d) => {
      tooltip
        .style('opacity', 1)
        .style('left', event.pageX + 10 + 'px')
        .style('top', event.pageY - 10 + 'px')
        .html(`<strong>${d.id}</strong><br/>${d.titulo?.substring(0, 100)}<br/><span class="${d.vigente ? 'text-green-400' : 'text-red-400'}">${d.vigente ? 'Vigente' : 'Derogada'}</span>`)
    }).on('mouseleave', () => tooltip.style('opacity', 0))

    // Tick
    simulation.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
      node.attr('cx', d => d.x).attr('cy', d => d.y)
      label.attr('x', d => d.x).attr('y', d => d.y)
    })

    // Initial zoom to fit
    setTimeout(() => {
      const bounds = g.node().getBBox()
      const scale = Math.min(width / bounds.width, height / bounds.height) * 0.8
      const tx = width / 2 - (bounds.x + bounds.width / 2) * scale
      const ty = height / 2 - (bounds.y + bounds.height / 2) * scale
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
    }, 1000)

    return () => { tooltip.remove(); simulation.stop() }
  }, [graphData, centerId])

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
        <Link to="/" className="text-slate-400 hover:text-white">← Informes</Link>
        <form onSubmit={handleSearch} className="flex-1 max-w-md flex gap-2">
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar norma..."
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button type="submit" className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded">Ir</button>
        </form>

        {/* Legend */}
        <div className="flex gap-4 text-xs text-slate-400">
          <span><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1"></span>Vigente</span>
          <span><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1"></span>Derogada</span>
          <span><span className="inline-block w-3 h-3 rounded-full bg-indigo-500 mr-1"></span>Centro</span>
        </div>
      </div>

      {/* Search results dropdown */}
      {searchResults && (
        <div className="absolute top-16 left-20 z-50 bg-slate-800 border border-slate-700 rounded-lg w-96 max-h-60 overflow-y-auto">
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

      {/* Main content: graph + sidebar */}
      <div className="flex-1 flex">
        {/* Graph */}
        <svg ref={svgRef} className="flex-1 bg-slate-950" />

        {/* Sidebar */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 p-4 overflow-y-auto">
          {selectedNorm ? (
            <>
              <h3 className="text-white font-semibold text-sm mb-2">{selectedNorm.titulo}</h3>
              <div className="space-y-2 text-xs text-slate-400">
                <p><span className="text-slate-500">ID:</span> {selectedNorm.id}</p>
                <p><span className="text-slate-500">Rango:</span> {selectedNorm.rango}</p>
                <p><span className="text-slate-500">Publicación:</span> {selectedNorm.fecha_publicacion}</p>
                <p>
                  <span className="text-slate-500">Estado: </span>
                  <span className={selectedNorm.vigente ? 'text-green-400' : 'text-red-400'}>
                    {selectedNorm.vigente ? 'Vigente' : 'Derogada'}
                  </span>
                </p>
                {selectedNorm.url_eli && (
                  <a href={selectedNorm.url_eli} target="_blank" rel="noopener noreferrer"
                    className="text-indigo-400 hover:underline block mt-2">
                    Ver en BOE →
                  </a>
                )}
              </div>
              {graphData && (
                <div className="mt-4">
                  <p className="text-slate-500 text-xs mb-2">
                    {graphData.nodes.length} nodos · {graphData.links.length} conexiones
                  </p>
                  {/* Relationship type breakdown */}
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
            </>
          ) : (
            <p className="text-slate-500 text-sm">Selecciona una norma para ver sus detalles</p>
          )}
        </div>
      </div>
    </div>
  )
}
