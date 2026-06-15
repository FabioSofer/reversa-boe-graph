# Reversa AI — El BOE como Grafo de Conocimiento

**Live demo**: [reversa-boe-graph.onrender.com](https://reversa-boe-graph.onrender.com)

Turn Spain's statute book (12,307 consolidated norms from the BOE) into a navigable knowledge graph that answers the four questions the Council of Ministers needs to begin legislative simplification.

## The Four Briefings

| # | Question | Answer |
|---|----------|--------|
| 01 | **Which laws are most unreadable?** | Ley del IVA and IRPF — 71 amendments each |
| 02 | **Who made the mess?** | Ley 62/2003 — a single omnibus act that modified 75 other laws |
| 03 | **How much law rests on dead ground?** | 8.3% of live law cites at least one repealed norm |
| 04 | **Blast radius of Ley 30/1992?** | 231 in-force norms still cite it directly |

All results are live Cypher queries against 12,307 real norms and 31,735 relationships in Neo4j — not hardcoded data.

## Platform Features

- **Dashboard** with the 4 briefing cards, corpus stats, and search
- **Interactive graph explorer** — D3.js force-directed visualization with zoom, search, and click-to-inspect
- **Relationship browser** — click any node to see its connections grouped by type (Modifica, Deroga, Cita, Añade, Conformidad, Desarrolla)
- **Repeal simulator** — search any norm and see how many laws would break if it were repealed, with red glow highlighting dependents on the graph
- **Legislative decay timeline** — bar chart showing amendments per decade (exponential growth)
- **Orphan chain detection** — identifies norms citing dead law that itself cites more dead law (2+ levels deep)
- **Bilingual** — full ES/EN toggle
- **Navigable** — in-app back navigation, URL-based routing per norm, edge tooltips

## Architecture

```
BOE Public API (boe.es/datosabiertos)
    ↓  async ingestion (Python 3.12 / aiohttp, 10 concurrent)
Neo4j AuraDB Free (12,307 nodes, 31,735 edges)
    ↓  Cypher queries (<200ms per briefing)
FastAPI backend (10 endpoints)
    ↓
React + D3.js + TailwindCSS frontend
    ↓
Single Render deployment (API + static frontend, same origin)
```

## Key Technical Decisions

1. **Used `/id/{id}/analisis` endpoint** (~5KB) instead of the full norm endpoint (~480KB). Made ingestion feasible in 5 minutes instead of hours.
2. **Discovered CITA is not bidirectional** in the BOE API. Briefings 3-4 required scanning all norms' outgoing edges — can't rely on the target norm's incoming references.
3. **Neo4j over SQLite** — the 4 briefings are graph traversals (degree counts, path existence). Cypher expresses them in 3-5 lines vs. awkward self-joins.
4. **Repeal simulator with visual blast radius** — hover the impact count to see dependent nodes glow red on the graph. Makes legislative risk tangible.

## Project Structure

```
ingestion/       — Async BOE scraper + Neo4j batch loader
api/             — FastAPI: 4 briefing endpoints + graph exploration + search
frontend/        — React + D3.js interactive platform
docs/            — 1-page design doc (schema, decisions, trade-offs)
server.py        — Unified production server (API + static frontend)
render.yaml      — Render deployment config
```

## Running Locally

```bash
# Install Python deps
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Configure Neo4j credentials
cp ingestion/.env.example ingestion/.env
# Edit with your AuraDB credentials

# Ingest (only needed once, ~5 min)
cd ingestion && python ingest.py && cd ..

# Run production server
cd frontend && npm install && npm run build && cd ..
python -m uvicorn server:app --port 8001
# Open http://localhost:8001
```

## Design Doc

See [docs/design-doc.md](docs/design-doc.md) for schema, ingestion pipeline details, and architectural trade-offs.
