# knowledge-map-3d

A standalone 3D knowledge visualization component built with React and Three.js.

![Demo](assets/demo.gif)

Renders documents as orbiting planets/moons around cluster stars, with nebula particle clouds between overlapping domains. Features bloom post-processing, Kepler elliptical orbits, search highlighting, star-birth/supernova effects, hand tracking camera control, and optional ambient audio.

## Install

```bash
npm install knowledge-map-3d three react react-dom
```

## Usage

```tsx
import { KnowledgeMap } from 'knowledge-map-3d';
import type { MapDocument, ClusterMeta, NebulaMeta } from 'knowledge-map-3d';

function App() {
  const documents: MapDocument[] = [/* your data */];
  const clusters: ClusterMeta[] = [/* your data */];
  const nebulae: NebulaMeta[] = [/* your data */];

  return (
    <KnowledgeMap
      documents={documents}
      clusters={clusters}
      nebulae={nebulae}
      onDocumentClick={(doc) => console.log('Clicked:', doc.sourceFile)}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `documents` | `MapDocument[]` | required | Documents to render as planets/moons |
| `clusters` | `ClusterMeta[]` | required | Cluster stars with center coordinates |
| `nebulae` | `NebulaMeta[]` | required | Nebula clouds between clusters |
| `stats` | `Stats` | `null` | Aggregate stats for the sidebar |
| `onDocumentClick` | `(doc) => void` | - | Callback when a document is clicked |
| `onClusterClick` | `(cluster) => void` | - | Callback when a cluster star is clicked |
| `highlightIds` | `Set<string>` | - | Document IDs to highlight (search) |
| `embedded` | `boolean` | `false` | Hide sidebar, legend, zoom controls |
| `typeColors` | `Record<string,string>` | built-in | Color mapping for document types |
| `typeFilters` | `string[]` | `['','principle','learning','retro']` | Sidebar filter buttons |
| `onTypeFilterChange` | `(filter) => void` | - | Called when filter changes |
| `sidebarTitle` | `string` | `'Knowledge Universe'` | Title in the sidebar |
| `ambientAudioSrc` | `string` | - | URL for background music |
| `className` | `string` | - | CSS class on root container |
| `heightMode` | `'full'\|'auto'\|'embed'` | `'full'` | Height behavior |

## Data Model

Each **document** needs 3D coordinates (`x`, `y`, `z`), a `clusterId`, and orbital parameters (`orbitRadius`, `orbitSpeed`, `orbitPhase`, `orbitTilt`). Set `parentId` to another document's `id` to make it orbit that document as a moon.

Each **cluster** defines a star at `(cx, cy, cz)` with a bounding `radius` and a human-readable `label`.

Each **nebula** connects two clusters (`clusterA`, `clusterB`) with a `strength` (0-1) and a hex `color`.

Your embedding/clustering pipeline produces these; the component only renders them.

## CSS Custom Properties

The styles use CSS custom properties you can override:

```css
:root {
  --km3d-text-primary:   #e8e8f0;
  --km3d-text-secondary: #a0a0b8;
  --km3d-text-muted:     #666680;
  --km3d-accent:         #60a5fa;
  --km3d-bg-card:        #0d0d18;
  --km3d-border:         rgba(255,255,255,0.08);
}
```

## Features

- Three.js scene with UnrealBloomPass post-processing
- Kepler elliptical orbits with per-document eccentricity
- Cluster center stars with pulsing animation
- Orbital ring visualization
- Nebula particle clouds (multi-center density, organic shape)
- Dock-style magnification on mouse proximity
- Search highlighting (matched nodes glow, others fade)
- Star-birth effect (dust collapse to ignition)
- Supernova effect (physics-based multi-phase with GW rings)
- Hand tracking camera control via MediaPipe
- Damped spring camera tweening
- Optional ambient audio with fade-in
- Sidebar with type filters, stats, and cluster navigation
- Embeddable mode with postMessage API
- Respects `prefers-reduced-motion`

## Credits

Built by **Bungkee Oracle** — an AI Artisan serving an AI engineer.

Originally developed as the knowledge visualization layer for the [Bungkee Oracle](https://github.com/AstralOrbital) ecosystem, extracted as a standalone module for the community.

> *"Forge the future. Conduct the symphony. Be the nexus where AI meets human."*

## License

MIT
