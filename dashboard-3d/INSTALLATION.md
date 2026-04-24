# Installation Guide — Knowledge Map 3D

A step-by-step guide to integrate the 3D Knowledge Map into your project.

---

## Prerequisites

- **Node.js** >= 18
- **React** >= 18
- **Three.js** >= 0.150
- A package manager: npm, yarn, pnpm, or bun

---

## Step 1: Install

```bash
# npm
npm install knowledge-map-3d three @types/three

# yarn
yarn add knowledge-map-3d three @types/three

# pnpm
pnpm add knowledge-map-3d three @types/three

# bun
bun add knowledge-map-3d three @types/three
```

> `three` and `react` are peer dependencies — you must have them in your project.

---

## Step 2: Prepare Your Data

The component requires 3 data arrays. You produce these from your own embedding/clustering pipeline.

### MapDocument (each knowledge item)

```ts
interface MapDocument {
  id: string;               // Unique identifier
  type: string;              // Category for coloring (e.g. "article", "note", "code")
  sourceFile: string;        // Display name or file path
  concepts: string[];        // Tags/keywords for tooltip
  project: string | null;    // Optional grouping key
  x: number;                 // 3D x-coordinate (from dimensionality reduction)
  y: number;                 // 3D y-coordinate
  z: number;                 // 3D z-coordinate
  clusterId: string;         // Which cluster this belongs to
  orbitRadius: number;       // Distance from cluster center
  orbitSpeed: number;        // Animation speed (try 0.1 - 0.5)
  orbitPhase: number;        // Starting angle in radians (0 - 2π)
  orbitTilt: number;         // Orbital plane tilt in radians
  parentId: string | null;   // null = planet, "doc-id" = moon orbiting that planet
  moonCount: number;         // Number of moons (0 for moons themselves)
  createdAt: number | null;  // Unix timestamp (ms) for age effects
  contentLength: number;     // Byte size — drives visual "mass"
}
```

### ClusterMeta (each cluster star)

```ts
interface ClusterMeta {
  id: string;             // Matches documents' clusterId
  label: string;          // Human-readable name (e.g. "Machine Learning")
  docCount: number;       // Number of documents
  cx: number;             // Center x
  cy: number;             // Center y
  cz: number;             // Center z
  radius: number;         // Bounding radius for zoom
  concepts: string[];     // Top keywords for this cluster
  starDocId: string | null;  // Optional: representative document
}
```

### NebulaMeta (clouds between clusters)

```ts
interface NebulaMeta {
  id: string;
  clusterA: string;       // First cluster ID
  clusterB: string;       // Second cluster ID
  cx: number;             // Cloud center x
  cy: number;             // Cloud center y
  cz: number;             // Cloud center z
  strength: number;       // 0-1 density/opacity
  color: string;          // Hex color (e.g. "#a78bfa")
}
```

---

## Step 3: Basic Integration

```tsx
import { KnowledgeMap } from 'knowledge-map-3d';
import type { MapDocument, ClusterMeta, NebulaMeta } from 'knowledge-map-3d';

function MyApp() {
  // Your data (from API, file, or computed)
  const documents: MapDocument[] = [ /* ... */ ];
  const clusters: ClusterMeta[] = [ /* ... */ ];
  const nebulae: NebulaMeta[] = [ /* ... */ ];

  return (
    <KnowledgeMap
      documents={documents}
      clusters={clusters}
      nebulae={nebulae}
      onDocumentClick={(doc) => {
        console.log('Clicked:', doc.sourceFile);
      }}
    />
  );
}
```

This renders a full-viewport 3D scene with:
- Orbiting document nodes (colored by `type`)
- Cluster center stars with labels
- Nebula particle clouds
- Bloom post-processing
- Mouse interaction (hover, click, zoom)

---

## Step 4: Generating Data (Example Pipeline)

If you don't have a pipeline yet, here's a simple approach:

### 1. Embed your documents

```python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer('all-MiniLM-L6-v2')
texts = ["doc 1 content", "doc 2 content", ...]
embeddings = model.encode(texts)
```

### 2. Reduce to 3D

```python
from sklearn.manifold import TSNE

coords_3d = TSNE(n_components=3, perplexity=15).fit_transform(embeddings)
```

### 3. Cluster

```python
from sklearn.cluster import KMeans

kmeans = KMeans(n_clusters=5).fit(coords_3d)
labels = kmeans.labels_
centers = kmeans.cluster_centers_
```

### 4. Build JSON

```python
import json, math, random

documents = []
for i, (text, coord, label) in enumerate(zip(texts, coords_3d, labels)):
    documents.append({
        "id": f"doc-{i}",
        "type": "article",
        "sourceFile": f"document-{i}.md",
        "concepts": [],
        "project": None,
        "x": float(coord[0]),
        "y": float(coord[1]),
        "z": float(coord[2]),
        "clusterId": f"cluster-{label}",
        "orbitRadius": random.uniform(2, 8),
        "orbitSpeed": random.uniform(0.1, 0.4),
        "orbitPhase": random.uniform(0, 2 * math.pi),
        "orbitTilt": random.uniform(-0.3, 0.3),
        "parentId": None,
        "moonCount": 0,
        "createdAt": None,
        "contentLength": len(text),
    })

clusters = []
for label_id in range(5):
    center = centers[label_id]
    mask = labels == label_id
    clusters.append({
        "id": f"cluster-{label_id}",
        "label": f"Topic {label_id}",
        "docCount": int(mask.sum()),
        "cx": float(center[0]),
        "cy": float(center[1]),
        "cz": float(center[2]),
        "radius": float(np.max(np.linalg.norm(coords_3d[mask] - center, axis=1))),
        "concepts": [],
        "starDocId": None,
    })

# Save
with open("map-data.json", "w") as f:
    json.dump({"documents": documents, "clusters": clusters, "nebulae": []}, f)
```

Then load this JSON in your React app and pass to `<KnowledgeMap />`.

---

## Step 5: Customization

### Custom Colors by Type

```tsx
<KnowledgeMap
  documents={docs}
  clusters={clusters}
  nebulae={nebulae}
  typeColors={{
    article: '#60a5fa',
    note: '#a78bfa',
    code: '#34d399',
    tutorial: '#fbbf24',
  }}
/>
```

### Embedded Mode (no sidebar)

```tsx
<KnowledgeMap
  documents={docs}
  clusters={clusters}
  nebulae={nebulae}
  embedded={true}
  heightMode="embed"
/>
```

### Search Highlighting

```tsx
const matchedIds = new Set(['doc-1', 'doc-5', 'doc-12']);

<KnowledgeMap
  documents={docs}
  clusters={clusters}
  nebulae={nebulae}
  highlightIds={matchedIds}
/>
```

### Override CSS Theme

```css
:root {
  --km3d-text-primary: #ffffff;
  --km3d-text-secondary: #cccccc;
  --km3d-accent: #ff6b6b;
  --km3d-bg-card: #1a1a2e;
  --km3d-border: rgba(255,255,255,0.1);
}
```

---

## Troubleshooting

### "Module not found: three/examples/jsm/..."

Make sure you have `three` >= 0.150 installed:
```bash
npm ls three
```

### Black screen / no rendering

- Check browser console for WebGL errors
- Ensure your data arrays are not empty
- Verify coordinates are reasonable numbers (not NaN/Infinity)

### Performance issues

- Reduce document count (component handles 500+ well, 2000+ may need optimization)
- Disable bloom: the component respects `prefers-reduced-motion`
- Use `embedded` mode to hide sidebar/legend

---

## Architecture

```
Browser loads <KnowledgeMap />
  │
  ├── Three.js Scene
  │     ├── 2000 background stars (random)
  │     ├── Cluster center stars (pulsing, glowing)
  │     ├── Orbital rings per cluster
  │     ├── Document spheres (Kepler orbits)
  │     ├── Moon spheres (orbiting parent docs)
  │     ├── Nebula particle clouds
  │     └── EffectComposer + UnrealBloomPass
  │
  ├── Camera
  │     ├── Mouse drag → orbit
  │     ├── Scroll → zoom
  │     ├── Click cluster → fly-to animation
  │     └── Hand tracking → gesture zoom (optional)
  │
  ├── Interaction
  │     ├── Hover → dock magnification + label
  │     ├── Click → onDocumentClick callback
  │     └── Search → highlight matching, fade others
  │
  └── Sidebar
        ├── Stats display
        ├── Type filters
        └── Cluster navigation
```

---

## Credits

Built by **Bungkee Oracle** — an AI Artisan serving an AI engineer.

## License

MIT
