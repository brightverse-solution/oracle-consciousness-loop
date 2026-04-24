#!/usr/bin/env bun
/**
 * Build-time data generator for 3D knowledge map.
 * Reads all 9 Oracle vaults → generates documents/clusters/nebulae JSON.
 *
 * Run: bun run build-map-data
 */

import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

// ─── Configuration ─────────────────────────────────────────────────────────────

const VAULT_ROOT = "/Users/p4lmnpk/ghq/github.com/brightverse-solution";

const ORACLES = [
  { id: "quill-brain", name: "QuillBrain", emoji: "🪶", role: "Scribe · Parent", color: "#c7b6f0", angle: 0 },
  { id: "forge",       name: "FORGE",      emoji: "⚒️", role: "Backend Dev",      color: "#ff8b42", angle: (2 * Math.PI * 1) / 9 },
  { id: "prism",       name: "PRISM",      emoji: "🎨", role: "Frontend Dev",     color: "#f764a0", angle: (2 * Math.PI * 2) / 9 },
  { id: "canvas",      name: "CANVAS",     emoji: "🖌️", role: "UI/UX Design",     color: "#8b70d8", angle: (2 * Math.PI * 3) / 9 },
  { id: "anvil",       name: "ANVIL",      emoji: "⚙️", role: "DevOps",           color: "#5b8def", angle: (2 * Math.PI * 4) / 9 },
  { id: "inkwell",     name: "INKWELL",    emoji: "📝", role: "Docs/Writing",     color: "#4ec9b0", angle: (2 * Math.PI * 5) / 9 },
  { id: "ward",        name: "WARD",       emoji: "🛡️", role: "Security/QA",      color: "#6fba5b", angle: (2 * Math.PI * 6) / 9 },
  { id: "herald",      name: "HERALD",     emoji: "📣", role: "Marketing",        color: "#e3c15b", angle: (2 * Math.PI * 7) / 9 },
  { id: "lens",        name: "LENS",       emoji: "🔍", role: "Research",         color: "#4fc3f7", angle: (2 * Math.PI * 8) / 9 },
];

const CLUSTER_RADIUS = 40;
const DOC_SCATTER = 8;

// ─── Types (matching knowledge-map-3d library) ────────────────────────────────

interface MapDocument {
  id: string;
  type: string;
  sourceFile: string;
  concepts: string[];
  project: string | null;
  x: number; y: number; z: number;
  clusterId: string;
  orbitRadius: number;
  orbitSpeed: number;
  orbitPhase: number;
  orbitTilt: number;
  parentId: string | null;
  moonCount: number;
  createdAt: number | null;
  contentLength: number;
}

interface ClusterMeta {
  id: string;
  label: string;
  docCount: number;
  cx: number; cy: number; cz: number;
  radius: number;
  concepts: string[];
}

interface NebulaMeta {
  id: string;
  clusterA: string;
  clusterB: string;
  strength: number;
  color: string;
}

// ─── Loop integration (Part B) ────────────────────────────────────────────────

interface LoopInsight {
  loop_id: string;
  loop_date: string;
  insight_number: number;
  title: string;
  body_excerpt: string;
  oracles_involved: string[];
}

interface LoopMeta {
  loop_id: string;
  loop_date: string;
  proposal_path: string;
  proposal_markdown: string;
  insights: LoopInsight[];
  questions: number;
  answers: number;
}

const QB_OUTBOX = join(VAULT_ROOT, "quill-brain-oracle", "ψ", "outbox");
const ORACLE_NAME_PATTERN = /\b(QuillBrain|FORGE|PRISM|CANVAS|ANVIL|INKWELL|WARD|HERALD|LENS)\b/gi;

const LOOP_COLORS = [
  "#4fc3f7", // loop 1 — cyan
  "#a78bfa", // loop 2 — violet
  "#34d399", // loop 3 — emerald
  "#fbbf24", // loop 4 — amber
  "#f472b6", // loop 5 — pink
];

async function scanLoops(): Promise<LoopMeta[]> {
  const files = await readdir(QB_OUTBOX).catch(() => []);
  const loops: LoopMeta[] = [];
  for (const f of files) {
    if (!f.includes("consciousness-loop-")) continue;
    const path = join(QB_OUTBOX, f);
    const content = await readFile(path, "utf-8");
    const loopIdMatch = f.match(/consciousness-loop-(loop-[0-9TZ:.\-]+)\.md/);
    if (!loopIdMatch) continue;
    const loopId = loopIdMatch[1];
    const dateMatch = f.match(/^(\d{4}-\d{2}-\d{2})/);
    const loopDate = dateMatch ? dateMatch[1] : "";

    const insights = parseInsights(content, loopId, loopDate);
    const questions = (content.match(/\*\*Q\d+\*\*/g) ?? []).length;
    const answers = content.match(/## Q\d+/g)?.length ?? 0;

    loops.push({
      loop_id: loopId,
      loop_date: loopDate,
      proposal_path: path,
      proposal_markdown: content,
      insights,
      questions,
      answers,
    });
  }
  loops.sort((a, b) => a.loop_id.localeCompare(b.loop_id));
  return loops;
}

function parseInsights(markdown: string, loopId: string, loopDate: string): LoopInsight[] {
  const sectionMatch = markdown.match(
    /##\s*2\.?\s*Cross-family insights[\s\S]*?(?=\n##\s+3\.|\n---\s*\n##\s+3|$)/i,
  );
  if (!sectionMatch) return [];
  const section = sectionMatch[0];
  const insightRegex = /###\s+(\d+)\.?\s+(.+?)\n([\s\S]*?)(?=\n###\s+\d+\.|$)/g;
  const insights: LoopInsight[] = [];
  let match: RegExpExecArray | null;
  while ((match = insightRegex.exec(section))) {
    const num = parseInt(match[1], 10);
    const title = match[2].trim();
    const body = match[3].trim();

    const oracles = new Set<string>();
    let m: RegExpExecArray | null;
    const pattern = new RegExp(ORACLE_NAME_PATTERN.source, "gi");
    while ((m = pattern.exec(body + " " + title))) {
      const name = m[1].toLowerCase();
      oracles.add(name === "quillbrain" ? "quill-brain" : name);
    }

    insights.push({
      loop_id: loopId,
      loop_date: loopDate,
      insight_number: num,
      title,
      body_excerpt: body.slice(0, 400),
      oracles_involved: Array.from(oracles),
    });
  }
  return insights;
}

function loopNebulae(loops: LoopMeta[]): NebulaMeta[] {
  // Dedupe: aggregate all insights by (A,B) oracle pair → one nebula per pair
  const pairMap = new Map<string, { a: string; b: string; count: number; color: string }>();

  for (const [i, loop] of loops.entries()) {
    const color = LOOP_COLORS[i % LOOP_COLORS.length];
    for (const insight of loop.insights) {
      const oracles = insight.oracles_involved.filter((o) =>
        ORACLES.some((meta) => meta.id === o),
      );
      for (let a = 0; a < oracles.length; a++) {
        for (let b = a + 1; b < oracles.length; b++) {
          const [x, y] = [oracles[a], oracles[b]].sort();
          const key = `${x}|${y}`;
          const existing = pairMap.get(key);
          if (existing) {
            existing.count += 1;
            // Use latest-loop color (overwrites earlier)
            existing.color = color;
          } else {
            pairMap.set(key, { a: x, b: y, count: 1, color });
          }
        }
      }
    }
  }

  const result: NebulaMeta[] = [];
  let nid = 1000;
  for (const pair of pairMap.values()) {
    result.push({
      id: `loop-nebula-${nid++}`,
      clusterA: pair.a,
      clusterB: pair.b,
      strength: Math.min(0.95, 0.3 + pair.count * 0.15), // 1 insight = 0.45, 5 = 1.0
      color: pair.color,
    });
  }
  return result;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const documents: MapDocument[] = [];
  const clusters: ClusterMeta[] = [];

  for (const oracle of ORACLES) {
    const cx = Math.cos(oracle.angle) * CLUSTER_RADIUS;
    const cy = 0;
    const cz = Math.sin(oracle.angle) * CLUSTER_RADIUS;

    const vaultPath = join(VAULT_ROOT, `${oracle.id}-oracle`, "ψ");
    const docsForCluster = await scanVault(vaultPath, oracle, cx, cy, cz);

    // Part A: create sub-parent documents per type to form sub-clusters within this Oracle
    const docsByType: Record<string, MapDocument[]> = {};
    for (const d of docsForCluster) {
      (docsByType[d.type] ??= []).push(d);
    }

    const subParents: MapDocument[] = [];
    const typeEntries = Object.entries(docsByType).filter(([, docs]) => docs.length > 0);
    typeEntries.forEach(([type, docs], idx) => {
      // Sub-parent position: on a mini-ring around the cluster center
      const subAngle = (2 * Math.PI * idx) / typeEntries.length;
      const subDist = 5; // small radius inside cluster
      const spx = cx + Math.cos(subAngle) * subDist;
      const spy = cy + (idx % 2 === 0 ? 1 : -1) * 1.5;
      const spz = cz + Math.sin(subAngle) * subDist;

      const parentId = `${oracle.id}:sub:${type}`;
      subParents.push({
        id: parentId,
        type: `domain-${type}`,
        sourceFile: type.toUpperCase(),
        concepts: [type, oracle.name],
        project: oracle.id,
        x: spx, y: spy, z: spz,
        clusterId: oracle.id,
        orbitRadius: subDist,
        orbitSpeed: 0.0003,
        orbitPhase: subAngle,
        orbitTilt: 0.1,
        parentId: null,
        moonCount: docs.length,
        createdAt: null,
        contentLength: docs.reduce((s, d) => s + d.contentLength, 0),
      });

      // Reparent each document as moon of its sub-parent
      for (const d of docs) {
        d.parentId = parentId;
        // Closer orbit around sub-parent
        const localOrbit = 1 + (hash(d.id) % 30) / 20; // 1-2.5
        d.orbitRadius = localOrbit;
        d.x = spx + Math.cos(d.orbitPhase) * localOrbit;
        d.y = spy;
        d.z = spz + Math.sin(d.orbitPhase) * localOrbit;
      }
    });

    documents.push(...subParents, ...docsForCluster);

    clusters.push({
      id: oracle.id,
      label: `${oracle.emoji} ${oracle.name}`,
      docCount: docsForCluster.length + subParents.length,
      cx, cy, cz,
      radius: 15,
      concepts: [oracle.role, oracle.name, ...typeEntries.map(([t]) => t.toUpperCase())].slice(0, 6),
    });

    console.log(
      `[build-map] ${oracle.id}: ${docsForCluster.length} docs + ${subParents.length} sub-domains (${typeEntries.map(([t, d]) => `${t}:${d.length}`).join(", ")})`,
    );
  }

  // Static nebulae: cross-oracle letter filename heuristic
  const nebulae: NebulaMeta[] = [];
  let nebulaId = 0;
  for (let i = 0; i < ORACLES.length; i++) {
    for (let j = i + 1; j < ORACLES.length; j++) {
      const oA = ORACLES[i];
      const oB = ORACLES[j];
      const strength = await computeCrossReferenceStrength(oA.id, oB.id, documents);
      if (strength > 0) {
        nebulae.push({
          id: `nebula-${nebulaId++}`,
          clusterA: oA.id,
          clusterB: oB.id,
          strength: Math.min(1, strength / 5),
          color: blendColors(oA.color, oB.color),
        });
      }
    }
  }
  console.log(`[build-map] ${nebulae.length} static nebulae (outbox-letter heuristic)`);

  // Part B: Loop-derived nebulae — parsed from Consciousness Loop proposals
  const loops = await scanLoops();
  const dynamicNebulae = loopNebulae(loops);
  nebulae.push(...dynamicNebulae);
  console.log(
    `[build-map] ${loops.length} loops parsed, ${dynamicNebulae.length} loop-nebulae added`,
  );
  for (const l of loops) {
    console.log(
      `[build-map]   ${l.loop_id}: ${l.insights.length} insights, ${l.questions} Qs, ${l.answers} answers`,
    );
  }

  // Stats
  const typeCount: Record<string, number> = {};
  for (const d of documents) typeCount[d.type] = (typeCount[d.type] ?? 0) + 1;

  const payload = {
    documents,
    clusters,
    nebulae,
    stats: {
      totalDocs: documents.length,
      totalClusters: clusters.length,
      byType: typeCount,
      totalLoops: loops.length,
      totalInsights: loops.reduce((s, l) => s + l.insights.length, 0),
    },
    loops,
    generated_at: new Date().toISOString(),
    oracle_meta: ORACLES,
  };

  const out = join(import.meta.dir, "map-data.json");
  await writeFile(out, JSON.stringify(payload, null, 2));
  console.log(`[build-map] wrote ${out} (${documents.length} docs, ${clusters.length} clusters, ${nebulae.length} nebulae)`);
}

// ─── Vault scanning ───────────────────────────────────────────────────────────

async function scanVault(
  vaultPath: string,
  oracle: (typeof ORACLES)[number],
  cx: number, cy: number, cz: number,
): Promise<MapDocument[]> {
  const docs: MapDocument[] = [];
  const seen = new Set<string>();

  const categories = [
    { subdir: "memory/learnings", type: "learning" },
    { subdir: "memory/retrospectives", type: "retrospective", recursive: true },
    { subdir: "memory/resonance", type: "resonance" },
    { subdir: "outbox", type: "letter" },
    { subdir: "inbox", type: "inbox", recursive: true },
    { subdir: "writing", type: "writing", recursive: true },
    { subdir: "learn", type: "learn", recursive: true },
  ];

  for (const cat of categories) {
    const dir = join(vaultPath, cat.subdir);
    const files = await listMarkdown(dir, cat.recursive ?? false);
    for (const f of files) {
      if (seen.has(f.path)) continue;
      seen.add(f.path);

      // Orbital params (deterministic from path hash so rerenders are stable)
      const h = hash(f.path);
      const orbitRadius = 2 + (h % 100) / 10;   // 2-12
      const orbitSpeed = 0.001 + (h % 20) / 20000; // small
      const orbitPhase = ((h >> 4) % 628) / 100;   // 0-2π
      const orbitTilt = (((h >> 8) % 100) - 50) / 200; // -0.25..0.25

      // Scatter: put planets at random-but-stable positions around cluster center
      const sx = cx + Math.cos(orbitPhase) * orbitRadius;
      const sy = cy + ((h >> 12) % 40 - 20) / 10;
      const sz = cz + Math.sin(orbitPhase) * orbitRadius;

      const concepts = extractConcepts(f.content);

      docs.push({
        id: `${oracle.id}:${basename(f.path)}`,
        type: cat.type,
        sourceFile: basename(f.path),
        concepts,
        project: oracle.id,
        x: sx, y: sy, z: sz,
        clusterId: oracle.id,
        orbitRadius,
        orbitSpeed,
        orbitPhase,
        orbitTilt,
        parentId: null,
        moonCount: 0,
        createdAt: f.mtime.getTime(),
        contentLength: f.size,
      });
    }
  }

  return docs;
}

async function listMarkdown(
  dir: string,
  recursive: boolean,
): Promise<{ path: string; content: string; mtime: Date; size: number }[]> {
  const results: { path: string; content: string; mtime: Date; size: number }[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory() && recursive) {
        results.push(...(await listMarkdown(p, true)));
      } else if (e.isFile() && e.name.endsWith(".md") && e.name !== ".gitkeep") {
        try {
          const s = await stat(p);
          const content = await readFile(p, "utf-8");
          results.push({ path: p, content, mtime: s.mtime, size: s.size });
        } catch {
          // skip
        }
      }
    }
  } catch {
    // dir missing; skip
  }
  return results;
}

function extractConcepts(content: string): string[] {
  const fm = content.match(/^---\s*([\s\S]*?)---/);
  if (fm) {
    const tagsMatch = fm[1].match(/tags:\s*\[([^\]]+)\]/);
    if (tagsMatch) {
      return tagsMatch[1]
        .split(",")
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean)
        .slice(0, 8);
    }
    const tags2 = fm[1].match(/tags:\n((?:\s+-\s+.+\n?)+)/);
    if (tags2) {
      return tags2[1]
        .split("\n")
        .map((l) => l.replace(/^\s+-\s+/, "").trim())
        .filter(Boolean)
        .slice(0, 8);
    }
  }
  return [];
}

async function computeCrossReferenceStrength(
  oracleA: string,
  oracleB: string,
  allDocs: MapDocument[],
): Promise<number> {
  // Simple: count outbox letters from A that mention oracle B (or vice versa) in filename.
  const letters = allDocs.filter((d) => d.type === "letter");
  let count = 0;
  for (const l of letters) {
    const fname = l.sourceFile.toLowerCase();
    const owner = l.clusterId;
    const other = owner === oracleA ? oracleB : oracleB === owner ? oracleA : null;
    if (!other) continue;
    if (fname.includes(`to-${other}`) || fname.includes(`from-${other}`)) count += 1;
  }
  return count;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function blendColors(a: string, b: string): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ra = (pa >> 16) & 0xff, ga = (pa >> 8) & 0xff, ba = pa & 0xff;
  const rb = (pb >> 16) & 0xff, gb = (pb >> 8) & 0xff, bb = pb & 0xff;
  const rm = Math.round((ra + rb) / 2);
  const gm = Math.round((ga + gb) / 2);
  const bmix = Math.round((ba + bb) / 2);
  return "#" + ((rm << 16) | (gm << 8) | bmix).toString(16).padStart(6, "0");
}

if (import.meta.main) await main();
