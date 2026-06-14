"""
BOE Consolidated Legislation Ingestion Pipeline.
Fetches all norms + relationships from the BOE open data API
and loads them into Neo4j as a knowledge graph.
"""

import asyncio
import ssl
import certifi
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

import aiohttp
from dotenv import load_dotenv
from neo4j import GraphDatabase
from tqdm import tqdm
import os
import json

load_dotenv()

BASE_URL = "https://www.boe.es/datosabiertos/api/legislacion-consolidada"
CONCURRENCY = 10  # parallel requests to BOE API
BATCH_SIZE = 500  # Neo4j batch write size


@dataclass
class Norm:
    id: str
    titulo: str
    rango: str
    rango_codigo: str
    fecha_disposicion: str
    fecha_publicacion: str
    vigente: bool  # True = in force, False = repealed/expired
    url_eli: str = ""
    url_html: str = ""


@dataclass
class Relationship:
    source_id: str  # norm that has this in its anteriores
    target_id: str  # the referenced norm
    tipo: str       # DEROGA, MODIFICA, CITA, AÑADE, etc.
    codigo: str     # relationship code (210, 270, 330, etc.)
    texto: str = "" # descriptive text


# --- Phase 1: Fetch all norm metadata from list endpoint ---

async def fetch_all_norms(session: aiohttp.ClientSession) -> list[Norm]:
    """Fetch all norms from the paginated list endpoint."""
    norms = []
    for offset in [0, 10000]:
        url = f"{BASE_URL}?limit=10000&offset={offset}"
        async with session.get(url, headers={"Accept": "application/json"}) as resp:
            data = await resp.json()
            for item in data.get("data", []):
                norms.append(Norm(
                    id=item["identificador"],
                    titulo=item["titulo"],
                    rango=item.get("rango", {}).get("texto", ""),
                    rango_codigo=item.get("rango", {}).get("codigo", ""),
                    fecha_disposicion=item.get("fecha_disposicion", ""),
                    fecha_publicacion=item.get("fecha_publicacion", ""),
                    vigente=item.get("vigencia_agotada", "N") == "N",
                    url_eli=item.get("url_eli", ""),
                    url_html=item.get("url_html_consolidada", ""),
                ))
    print(f"Fetched {len(norms)} norms from list endpoint")
    return norms


# --- Phase 2: Fetch analisis (relationships) for each norm ---

def parse_analisis_xml(norm_id: str, xml_text: str) -> list[Relationship]:
    """Parse the analisis XML and extract relationships from anteriores."""
    relationships = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return relationships

    # Only extract 'anteriores' — these are outgoing edges FROM this norm
    # (what this norm cites/amends/repeals)
    for anterior in root.iter("anterior"):
        target_id = anterior.findtext("id_norma", "")
        relacion = anterior.find("relacion")
        if target_id and relacion is not None:
            relationships.append(Relationship(
                source_id=norm_id,
                target_id=target_id,
                tipo=relacion.text or "",
                codigo=relacion.get("codigo", ""),
                texto=anterior.findtext("texto", ""),
            ))

    # Also extract 'posteriores' — incoming edges TO this norm
    # (who modified/repealed/cited this norm)
    for posterior in root.iter("posterior"):
        source_id = posterior.findtext("id_norma", "")
        relacion = posterior.find("relacion")
        if source_id and relacion is not None:
            relationships.append(Relationship(
                source_id=source_id,
                target_id=norm_id,
                tipo=relacion.text or "",
                codigo=relacion.get("codigo", ""),
                texto=posterior.findtext("texto", ""),
            ))

    return relationships


async def fetch_analisis(session: aiohttp.ClientSession, norm_id: str, semaphore: asyncio.Semaphore) -> list[Relationship]:
    """Fetch the analisis endpoint for a single norm."""
    url = f"{BASE_URL}/id/{norm_id}/analisis"
    async with semaphore:
        try:
            async with session.get(url, headers={"Accept": "application/xml"}) as resp:
                if resp.status == 200:
                    text = await resp.text()
                    return parse_analisis_xml(norm_id, text)
                return []
        except Exception:
            return []


async def fetch_all_relationships(session: aiohttp.ClientSession, norm_ids: list[str]) -> list[Relationship]:
    """Fetch analisis for all norms with bounded concurrency."""
    semaphore = asyncio.Semaphore(CONCURRENCY)
    tasks = [fetch_analisis(session, nid, semaphore) for nid in norm_ids]

    all_rels = []
    for coro in tqdm(asyncio.as_completed(tasks), total=len(tasks), desc="Fetching analisis"):
        rels = await coro
        all_rels.extend(rels)

    # Deduplicate (same edge can appear in both source's anteriores and target's posteriores)
    seen = set()
    unique_rels = []
    for r in all_rels:
        key = (r.source_id, r.target_id, r.codigo)
        if key not in seen:
            seen.add(key)
            unique_rels.append(r)

    print(f"Total unique relationships: {len(unique_rels)} (from {len(all_rels)} raw)")
    return unique_rels


# --- Phase 3: Load into Neo4j ---

def load_into_neo4j(norms: list[Norm], relationships: list[Relationship]):
    """Batch-load norms and relationships into Neo4j."""
    uri = os.getenv("NEO4J_URI")
    user = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD")

    if not uri or not password:
        print("ERROR: Set NEO4J_URI and NEO4J_PASSWORD in .env")
        return

    driver = GraphDatabase.driver(uri, auth=(user, password))

    with driver.session() as session:
        # Create constraints/indexes
        session.run("CREATE CONSTRAINT norm_id IF NOT EXISTS FOR (n:Norm) REQUIRE n.id IS UNIQUE")
        session.run("CREATE INDEX norm_vigente IF NOT EXISTS FOR (n:Norm) ON (n.vigente)")

        # Batch insert norms
        print(f"Loading {len(norms)} norms...")
        for i in range(0, len(norms), BATCH_SIZE):
            batch = norms[i:i+BATCH_SIZE]
            session.run("""
                UNWIND $norms AS n
                MERGE (norm:Norm {id: n.id})
                SET norm.titulo = n.titulo,
                    norm.rango = n.rango,
                    norm.rango_codigo = n.rango_codigo,
                    norm.fecha_disposicion = n.fecha_disposicion,
                    norm.fecha_publicacion = n.fecha_publicacion,
                    norm.vigente = n.vigente,
                    norm.url_eli = n.url_eli,
                    norm.url_html = n.url_html
            """, norms=[vars(n) for n in batch])

        # Batch insert relationships
        print(f"Loading {len(relationships)} relationships...")
        # Group by tipo for cleaner edge types
        tipo_map = {
            "210": "DEROGA",
            "270": "MODIFICA",
            "330": "CITA",
            "407": "ANADE",
            "440": "CONFORMIDAD",
            "201": "CORRECCION",
            "230": "SIN_EFECTO",
            "245": "SUSTITUYE",
            "470": "DECLARA",
            "490": "DESARROLLA",
            "530": "CUESTION",
        }

        for i in range(0, len(relationships), BATCH_SIZE):
            batch = relationships[i:i+BATCH_SIZE]
            session.run("""
                UNWIND $rels AS r
                MATCH (source:Norm {id: r.source_id})
                MATCH (target:Norm {id: r.target_id})
                CALL apoc.merge.relationship(source, r.rel_type, {codigo: r.codigo}, {texto: r.texto}, target, {}) YIELD rel
                RETURN count(rel)
            """, rels=[{
                "source_id": r.source_id,
                "target_id": r.target_id,
                "rel_type": tipo_map.get(r.codigo, "OTRA_RELACION"),
                "codigo": r.codigo,
                "texto": r.texto,
            } for r in batch])

    driver.close()
    print("Done loading into Neo4j!")


# --- Alternative: Load without APOC (AuraDB free might not have it) ---

def load_into_neo4j_simple(norms: list[Norm], relationships: list[Relationship]):
    """Batch-load using only standard Cypher (no APOC dependency)."""
    uri = os.getenv("NEO4J_URI")
    user = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD")

    if not uri or not password:
        print("ERROR: Set NEO4J_URI and NEO4J_PASSWORD in .env")
        return

    driver = GraphDatabase.driver(uri, auth=(user, password))

    with driver.session() as session:
        session.run("CREATE CONSTRAINT norm_id IF NOT EXISTS FOR (n:Norm) REQUIRE n.id IS UNIQUE")

        # Load norms
        print(f"Loading {len(norms)} norms...")
        for i in tqdm(range(0, len(norms), BATCH_SIZE)):
            batch = norms[i:i+BATCH_SIZE]
            session.run("""
                UNWIND $norms AS n
                MERGE (norm:Norm {id: n.id})
                SET norm += n
            """, norms=[vars(n) for n in batch])

        # Load relationships grouped by type (standard Cypher can't use dynamic rel types)
        tipo_map = {
            "210": "DEROGA", "270": "MODIFICA", "330": "CITA",
            "407": "ANADE", "440": "CONFORMIDAD", "201": "CORRECCION",
            "230": "SIN_EFECTO", "245": "SUSTITUYE", "470": "DECLARA",
            "490": "DESARROLLA", "530": "CUESTION",
        }

        # Group rels by type
        from collections import defaultdict
        by_type = defaultdict(list)
        for r in relationships:
            rel_type = tipo_map.get(r.codigo, "OTRA_RELACION")
            by_type[rel_type].append(r)

        print(f"Loading {len(relationships)} relationships across {len(by_type)} types...")
        for rel_type, rels in by_type.items():
            print(f"  {rel_type}: {len(rels)} edges")
            for i in range(0, len(rels), BATCH_SIZE):
                batch = rels[i:i+BATCH_SIZE]
                # Dynamic relationship types require individual queries per type
                query = f"""
                    UNWIND $rels AS r
                    MATCH (source:Norm {{id: r.source_id}})
                    MATCH (target:Norm {{id: r.target_id}})
                    MERGE (source)-[rel:{rel_type}]->(target)
                    SET rel.texto = r.texto
                """
                session.run(query, rels=[{
                    "source_id": r.source_id,
                    "target_id": r.target_id,
                    "texto": r.texto,
                } for r in batch])

    driver.close()
    print("Done!")


# --- Optional: Save to JSON for debugging/backup ---

def save_to_json(norms: list[Norm], relationships: list[Relationship]):
    """Save ingested data to JSON files for inspection."""
    out_dir = Path(__file__).parent / "data"
    out_dir.mkdir(exist_ok=True)

    with open(out_dir / "norms.json", "w") as f:
        json.dump([vars(n) for n in norms], f, ensure_ascii=False, indent=2)

    with open(out_dir / "relationships.json", "w") as f:
        json.dump([vars(r) for r in relationships], f, ensure_ascii=False, indent=2)

    print(f"Saved to {out_dir}/")


# --- Main ---

async def main():
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    connector = aiohttp.TCPConnector(ssl=ssl_ctx)

    async with aiohttp.ClientSession(connector=connector) as session:
        # Phase 1: Get all norm metadata
        norms = await fetch_all_norms(session)

        # Phase 2: Get all relationships
        norm_ids = [n.id for n in norms]
        relationships = await fetch_all_relationships(session, norm_ids)

    # Save JSON backup
    save_to_json(norms, relationships)

    # Phase 3: Load into Neo4j
    load_into_neo4j_simple(norms, relationships)


if __name__ == "__main__":
    asyncio.run(main())
