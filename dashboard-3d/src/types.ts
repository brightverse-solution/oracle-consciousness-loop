/**
 * Core types for the 3D Knowledge Map visualization.
 *
 * These describe the spatial layout produced by any clustering/embedding
 * pipeline.  The component itself is rendering-only — it never fetches data.
 */

/** A single document positioned in 3-D space. */
export interface MapDocument {
  id: string;
  /** Arbitrary category string used for coloring (e.g. "article", "note"). */
  type: string;
  /** Display label — typically a file path or title. */
  sourceFile: string;
  /** Tags / keywords shown in the tooltip. */
  concepts: string[];
  /** Optional chunk IDs when the document was split for search. */
  chunkIds?: string[];
  /** Optional grouping key (e.g. repository name). */
  project: string | null;
  /** 3-D coordinates produced by your layout algorithm. */
  x: number;
  y: number;
  z: number;
  /** Which cluster this document belongs to. */
  clusterId: string;
  /** Orbital mechanics — distance from cluster center. */
  orbitRadius: number;
  /** Angular speed of the orbit animation. */
  orbitSpeed: number;
  /** Starting phase angle (radians). */
  orbitPhase: number;
  /** Tilt of the orbital plane (radians). */
  orbitTilt: number;
  /** null = planet (orbits cluster star), string = moon (orbits that planet). */
  parentId: string | null;
  /** How many moons orbit this document (0 for moons themselves). */
  moonCount: number;
  /** Unix-ms timestamp, used for "age" effects.  null = unknown. */
  createdAt: number | null;
  /** Byte-size of the original content — drives "mass" scaling. */
  contentLength: number;
}

/** Metadata for one cluster (rendered as a glowing star at its center). */
export interface ClusterMeta {
  id: string;
  /** Human-readable label shown above the star. */
  label: string;
  /** Number of documents in this cluster. */
  docCount: number;
  /** Center coordinates. */
  cx: number;
  cy: number;
  cz: number;
  /** Bounding radius (used for zoom level). */
  radius: number;
  /** Top concepts for this cluster. */
  concepts: string[];
  /** Optional: the document id used as the "star" representative. */
  starDocId: string | null;
}

/** A nebula cloud connecting two overlapping clusters. */
export interface NebulaMeta {
  id: string;
  clusterA: string;
  clusterB: string;
  /** Center of the cloud. */
  cx: number;
  cy: number;
  cz: number;
  /** 0-1 strength controlling density and opacity. */
  strength: number;
  /** Hex color string, e.g. "#a78bfa". */
  color: string;
}

/** Aggregate statistics shown in the sidebar. */
export interface Stats {
  total: number;
  by_type?: Record<string, number>;
  last_indexed?: string;
  is_stale?: boolean;
  vector?: {
    enabled: boolean;
    count: number;
    collection: string;
  };
}
