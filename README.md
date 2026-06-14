# Reversa AI — Legislative Knowledge Graph

Turn Spain's statute book (BOE consolidated legislation) into a navigable knowledge graph that answers the four questions the Council of Ministers needs.

## Architecture

```
BOE API (boe.es/datosabiertos)
    ↓ async ingestion (Python/aiohttp)
Neo4j AuraDB (graph storage)
    ↓ Cypher queries
FastAPI backend (briefings + graph API)
    ↓
React + D3.js frontend (interactive graph + briefing dashboards)
```

## Stack

- **Ingestion**: Python 3.12, aiohttp, xml.etree
- **Database**: Neo4j AuraDB Free
- **Backend**: FastAPI
- **Frontend**: React, D3.js (force-directed graph), TailwindCSS
- **Deploy**: Vercel (frontend) + Render (API)

## Project Structure

```
ingestion/     — BOE API scraper + Neo4j loader
api/           — FastAPI serving briefings + graph data
frontend/      — React interactive platform
docs/          — Design doc, notes
```

## Quick Start

```bash
# 1. Set up environment
cd ingestion && pip install -r requirements.txt

# 2. Configure Neo4j (set in .env)
NEO4J_URI=neo4j+s://xxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=xxx

# 3. Ingest
python ingest.py

# 4. Run API
cd ../api && uvicorn main:app --reload

# 5. Run frontend
cd ../frontend && npm run dev
```
