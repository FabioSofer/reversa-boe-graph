# Future Graph Insights

Powerful queries enabled by the knowledge graph that could extend the platform.

## Implemented

### Legislative Decay Timeline
Amendments per decade — shows the statute book complexity is accelerating, not stabilizing.

## Candidates

### Orphan Chains (depth 2+)
In-force norms citing repealed norms that themselves cite other repealed norms. Shows compounding legislative debt.
```cypher
MATCH (alive:Norm)-[:CITA]->(dead1:Norm)-[:CITA]->(dead2:Norm)
WHERE alive.vigente = true AND dead1.vigente = false AND dead2.vigente = false
RETURN count(DISTINCT alive)
```

### Single Points of Failure
Norms with the highest in-degree from live law. The "load-bearing walls" — if repealed, the most live norms would break.
```cypher
MATCH (dependent:Norm)-[:CITA|CONFORMIDAD]->(foundation:Norm)
WHERE dependent.vigente = true AND foundation.vigente = true
RETURN foundation.titulo, count(dependent) AS dependents
ORDER BY dependents DESC LIMIT 10
```

### Isolated Clusters
Groups of norms that only reference each other with no connections to the broader corpus. Candidates for consolidation into a single act.

### Silent Repeals
Norms repealed without updating their dependents — cases where the repealing law didn't also modify the norms that cite the repealed one. Shows incomplete legislative hygiene beyond Ley 30/1992.
