# Design Document — BOE Legislative Knowledge Graph

## Schema

```
(:Norm {
  id,              -- "BOE-A-1992-26318"
  titulo,          -- Full legal title
  rango,           -- "Ley", "Real Decreto", etc.
  vigente,         -- boolean (in-force vs repealed)
  fecha_disposicion,
  fecha_publicacion,
  url_eli,         -- European Legislation Identifier
  url_html         -- Link to consolidated text on boe.es
})

[:MODIFICA]    -- A amends B
[:DEROGA]      -- A repeals B
[:CITA]        -- A cites B (not bidirectional in source)
[:ANADE]       -- A adds provisions to B
[:CONFORMIDAD] -- A issued in accordance with B
[:DESARROLLA]  -- A develops/implements B
[:OTRA_RELACION] -- Other (corrections, suspensions, etc.)
```

Norms are nodes. Relationships are typed directed edges extracted from the BOE `analisis` block. Each norm's `anteriores` gives outgoing edges (what it references); `posteriores` gives incoming edges (who references it).

## Key Design Decision: Why a Graph DB

The four briefings are fundamentally graph traversal questions — degree counting, path existence, and neighborhood expansion. Cypher expresses them in 3-5 lines each vs. multi-table self-joins in SQL. Neo4j also provides a free hosted tier (AuraDB) that handles our 12K-node corpus without infrastructure management.

## Why Not Just SQL

At 12,307 norms and 32K relationships, SQLite would work. I chose Neo4j because:
1. The queries read as natural graph questions (not awkward self-joins)
2. The graph visualization story is coherent end-to-end (graph DB → graph viz)
3. It's the tool you'd actually use at scale when the corpus grows

## Ingestion Pipeline

```
BOE list API (2 requests) → 12,307 norm metadata
    ↓
/id/{id}/analisis endpoint (async, 10 concurrent) → 78K raw relationships
    ↓
Deduplicate (bidirectional MODIFICA/DEROGA appear in both norms) → 32K unique edges
    ↓
Batch MERGE into Neo4j (500 norms/batch, typed relationships)
```

Critical insight: the `/analisis` endpoint returns only relationships (~5KB) vs. the full norm endpoint (~480KB with legal text). This makes ingestion feasible in ~5 minutes instead of hours.

CITA relationships are NOT bidirectional in the API — if A cites B, B's `posteriores` does not list A. This means Briefings 3 and 4 require scanning all norms' outgoing edges, not just the target's incoming edges.

## Architecture

```
[BOE API] → [Python/aiohttp ingestion] → [Neo4j AuraDB]
                                                ↓
                                          [FastAPI backend]
                                                ↓
                                          [React + D3.js frontend]
```

Single Render deployment: `uvicorn` serves both the API (`/api/*`) and the static React build. No CORS, no multi-service coordination.

## What I Chose Not to Build

- **Full-text search with Elasticsearch**: `toLower(n.titulo) CONTAINS` is fast enough at 12K norms (~60ms). Not worth the infra.
- **Incremental ingestion**: The corpus updates infrequently. Full re-ingestion in 5 minutes is simpler than change detection.
- **Authentication**: This is a read-only analytical tool for a government briefing. No user accounts needed.
- **Custom NLP for relationship extraction**: The BOE API already provides structured `analisis` data. Parsing legal text would add noise, not signal.

## Trade-offs Accepted

| Decision | Upside | Downside |
|----------|--------|----------|
| AuraDB Free tier | Zero ops, instant setup | 200K node limit, cold starts after inactivity |
| Single-process deploy | Simple, no CORS | Can't scale API independently |
| Client-side D3 rendering | Interactive, no server load | Large graphs (300+ nodes) can be slow |
| No caching | Always-fresh data | Each page load hits Neo4j (~100ms, acceptable) |
