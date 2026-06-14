# BOE API Exploration — Key Findings

## Corpus Size
- **12,307 norms** total in consolidated legislation
- ~2,387 repealed (`vigencia_agotada=S`), ~9,920 in force (`N`)

## API Endpoints

| Endpoint | Returns | Format | Use Case |
|----------|---------|--------|----------|
| `/api/legislacion-consolidada?limit=N&offset=N` | List of norms (basic metadata) | JSON/XML | Get all IDs + vigencia_agotada |
| `/api/legislacion-consolidada/id/{id}` | Full norm (metadata + analisis + full legal text) | XML only | Too heavy (~480KB/norm) |
| `/api/legislacion-consolidada/id/{id}/metadatos` | Metadata only (no analisis) | JSON/XML | estatus_derogacion field |
| `/api/legislacion-consolidada/id/{id}/analisis` | **Relationships only** | XML only | **Key endpoint** ~2-10KB/norm |

## Key Fields

### From list endpoint (no per-norm call needed):
- `identificador`: e.g. "BOE-A-1992-26318"
- `titulo`: full title
- `vigencia_agotada`: "S" = repealed/expired, "N" = in force
- `rango`: type (Ley, Real Decreto, etc.)
- `fecha_disposicion`, `fecha_publicacion`
- `url_eli`, `url_html_consolidada`

### From `/analisis` endpoint:
- `anteriores`: norms THIS norm references (cites, amends, repeals)
- `posteriores`: norms that reference THIS norm (modified by, repealed by)
- Each reference has: `id_norma`, `relacion` (code + text), `texto` (description)

## Relationship Codes (observed)

| Code | Text (anteriores) | Text (posteriores) | Meaning |
|------|-------------------|--------------------|---------|
| 210 | DEROGA | SE DEROGA | Repeals |
| 270 | MODIFICA | SE MODIFICA | Amends/modifies |
| 330 | CITA | - | Cites (NOT bidirectional!) |
| 407 | AÑADE | SE AÑADE | Adds provisions |
| 440 | DE CONFORMIDAD con | SE DICTA DE CONFORMIDAD | In accordance with |
| 470 | - | SE DECLARA | Declared (constitutional) |
| 490 | - | SE DESARROLLA | Developed/implemented |
| 201 | - | CORRECCIÓN de errores | Errata correction |
| 230 | - | SE DEJA SIN EFECTO | Left without effect |
| 245 | - | SE SUSTITUYE | Replaced |
| 530 | - | Cuestión | Constitutional question |

## Critical Design Insight: Bidirectionality

- **DEROGA/MODIFICA are bidirectional**: If A repeals B, B's `posteriores` lists A, AND A's `anteriores` lists B
- **CITA is NOT bidirectional**: If A cites B, B's `posteriores` does NOT list A
- **Implication for Briefings 3 & 4**: Must scan ALL norms' `anteriores` to find who cites repealed norms. Cannot rely on `posteriores` of the target norm.

## Ingestion Strategy

### Phase 1: Bulk list (2 requests, ~20s each)
```
GET /api/legislacion-consolidada?limit=10000&offset=0    → 10000 norms
GET /api/legislacion-consolidada?limit=10000&offset=10000 → 2307 norms
```
This gives us: all IDs, titles, vigencia_agotada, rango, dates

### Phase 2: Analisis fetch (12,307 requests)
```
GET /api/legislacion-consolidada/id/{id}/analisis  → ~2-10KB each
```
- Sequential: ~23 minutes (0.11s/request)
- Async (10 concurrent): ~2-3 minutes
- Total data: ~50-100MB XML

### Phase 3 (optional): Metadatos for partial-repeal nuances
Only needed if vigencia_agotada != estatus_derogacion for some norms.
From sampling: they appear to be the same. Skip unless needed.

## Ley 30/1992 (Briefing 4 target)
- Identifier: `BOE-A-1992-26318`
- Status: Repealed (`estatus_derogacion=S`, `vigencia_agotada=S`)
- Its `posteriores` shows 42 entries (mostly SE MODIFICA, SE DEROGA)
- But the blast radius (who CITES it) requires scanning all norms' `anteriores` for references to this ID

## Rate Limiting
- No observed rate limiting at 5 req/s
- No API key required
- Need to test at higher concurrency (10-20 req/s)
