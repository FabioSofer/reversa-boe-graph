"""
Reversa AI — Legislative Knowledge Graph API.
Serves the 4 Council briefings and graph data for visualization.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from neo4j import GraphDatabase
from dotenv import load_dotenv
import os

# Load from ingestion/.env locally, or from direct env vars on Render
_env_path = os.path.join(os.path.dirname(__file__), "..", "ingestion", ".env")
if os.path.exists(_env_path):
    load_dotenv(_env_path)

driver = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global driver
    driver = GraphDatabase.driver(
        os.getenv("NEO4J_URI"),
        auth=(os.getenv("NEO4J_USER"), os.getenv("NEO4J_PASSWORD")),
    )
    yield
    driver.close()


app = FastAPI(title="Reversa AI — BOE Knowledge Graph", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def query(cypher: str, **params):
    with driver.session() as session:
        return [dict(r) for r in session.run(cypher, **params)]


# --- Briefing 1: Most amended norms ---

@app.get("/api/briefings/1")
def briefing_most_amended(limit: int = 5):
    """Top N norms most amended by other norms (most unreadable)."""
    results = query("""
        MATCH (n:Norm)<-[r:MODIFICA]-(other)
        RETURN n.id AS id, n.titulo AS titulo, n.rango AS rango,
               n.url_eli AS url_eli, count(r) AS amendments
        ORDER BY amendments DESC LIMIT $limit
    """, limit=limit)
    return {"briefing": 1, "title": "Diagnosis: the most unreadable laws", "data": results}


# --- Briefing 2: Omnibus offenders ---

@app.get("/api/briefings/2")
def briefing_omnibus(limit: int = 5):
    """Top N norms that amend the most other norms."""
    results = query("""
        MATCH (n:Norm)-[r:MODIFICA|ANADE]->(other)
        RETURN n.id AS id, n.titulo AS titulo, n.rango AS rango,
               n.url_eli AS url_eli, count(DISTINCT other) AS modified_count
        ORDER BY modified_count DESC LIMIT $limit
    """, limit=limit)
    return {"briefing": 2, "title": "Root cause: the omnibus offenders", "data": results}


# --- Briefing 3: Dead law dependency ---

@app.get("/api/briefings/3")
def briefing_rot(limit: int = 5):
    """% of in-force norms citing repealed norms + top ghost laws."""
    stats = query("""
        MATCH (alive:Norm)-[:CITA]->(dead:Norm)
        WHERE alive.vigente = true AND dead.vigente = false
        WITH count(DISTINCT alive) AS citing_dead, count(DISTINCT dead) AS ghosts
        MATCH (total:Norm) WHERE total.vigente = true
        WITH citing_dead, ghosts, count(total) AS total_alive
        RETURN citing_dead, ghosts, total_alive,
               round(toFloat(citing_dead) / total_alive * 1000) / 10 AS percentage
    """)
    top_ghosts = query("""
        MATCH (alive:Norm)-[:CITA]->(dead:Norm)
        WHERE alive.vigente = true AND dead.vigente = false
        RETURN dead.id AS id, dead.titulo AS titulo, dead.url_eli AS url_eli,
               count(alive) AS cited_by_count
        ORDER BY cited_by_count DESC LIMIT $limit
    """, limit=limit)
    return {
        "briefing": 3,
        "title": "The rot: live law resting on dead ground",
        "stats": stats[0] if stats else {},
        "top_ghosts": top_ghosts,
    }


# --- Briefing 4: Ley 30/1992 blast radius ---

@app.get("/api/briefings/4")
def briefing_blast_radius():
    """All in-force norms still citing Ley 30/1992."""
    results = query("""
        MATCH (n:Norm)-[:CITA]->(target:Norm {id: "BOE-A-1992-26318"})
        WHERE n.vigente = true
        RETURN n.id AS id, n.titulo AS titulo, n.rango AS rango,
               n.fecha_publicacion AS fecha_publicacion, n.url_eli AS url_eli
        ORDER BY n.fecha_publicacion
    """)
    return {
        "briefing": 4,
        "title": "The scalpel: blast radius of Ley 30/1992",
        "target": {"id": "BOE-A-1992-26318", "titulo": "Ley 30/1992, de 26 de noviembre, de Régimen Jurídico de las Administraciones Públicas y del Procedimiento Administrativo Común"},
        "count": len(results),
        "data": results,
    }


# --- Graph exploration endpoints ---

@app.get("/api/graph/norm/{norm_id}")
def get_norm(norm_id: str):
    """Get a norm and its direct relationships."""
    norm = query("""
        MATCH (n:Norm {id: $id})
        RETURN n.id AS id, n.titulo AS titulo, n.rango AS rango,
               n.vigente AS vigente, n.fecha_publicacion AS fecha_publicacion,
               n.url_eli AS url_eli, n.url_html AS url_html
    """, id=norm_id)
    if not norm:
        return {"error": "Norm not found"}

    edges = query("""
        MATCH (n:Norm {id: $id})-[r]->(target:Norm)
        RETURN n.id AS source, target.id AS target, target.titulo AS target_titulo,
               target.vigente AS target_vigente, type(r) AS rel_type
        UNION
        MATCH (source:Norm)-[r]->(n:Norm {id: $id})
        RETURN source.id AS source, n.id AS target, source.titulo AS source_titulo,
               source.vigente AS source_vigente, type(r) AS rel_type
    """, id=norm_id)

    return {"norm": norm[0], "edges": edges}


@app.get("/api/graph/neighborhood/{norm_id}")
def get_neighborhood(norm_id: str, depth: int = 1):
    """Get the neighborhood graph around a norm (for D3 visualization)."""
    results = query("""
        MATCH path = (center:Norm {id: $id})-[*1..""" + str(min(depth, 2)) + """]-(neighbor:Norm)
        WITH center, neighbor, relationships(path) AS rels
        UNWIND rels AS r
        WITH DISTINCT startNode(r) AS src, endNode(r) AS tgt, type(r) AS rel_type
        RETURN src.id AS source, src.titulo AS source_titulo, src.vigente AS source_vigente,
               tgt.id AS target, tgt.titulo AS target_titulo, tgt.vigente AS target_vigente,
               rel_type
    """, id=norm_id)

    # Build nodes and links for D3
    nodes = {}
    links = []
    for r in results:
        nodes[r["source"]] = {"id": r["source"], "titulo": r["source_titulo"], "vigente": r["source_vigente"]}
        nodes[r["target"]] = {"id": r["target"], "titulo": r["target_titulo"], "vigente": r["target_vigente"]}
        links.append({"source": r["source"], "target": r["target"], "type": r["rel_type"]})

    return {"nodes": list(nodes.values()), "links": links}


@app.get("/api/search")
def search_norms(q: str = Query(..., min_length=2), limit: int = 20):
    """Search norms by title text."""
    results = query("""
        MATCH (n:Norm)
        WHERE toLower(n.titulo) CONTAINS toLower($q)
        RETURN n.id AS id, n.titulo AS titulo, n.rango AS rango,
               n.vigente AS vigente, n.url_eli AS url_eli
        LIMIT $limit
    """, q=q, limit=limit)
    return {"query": q, "count": len(results), "results": results}


@app.get("/api/stats")
def stats():
    """Overall corpus statistics."""
    result = query("""
        MATCH (n:Norm)
        WITH count(n) AS total,
             sum(CASE WHEN n.vigente = true THEN 1 ELSE 0 END) AS vigente,
             sum(CASE WHEN n.vigente = false THEN 1 ELSE 0 END) AS repealed
        MATCH ()-[r]->()
        WITH total, vigente, repealed, count(r) AS relationships
        RETURN total, vigente, repealed, relationships
    """)
    return result[0] if result else {}
