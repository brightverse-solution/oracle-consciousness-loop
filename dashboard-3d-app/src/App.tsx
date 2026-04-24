import { useMemo, useState } from "react";
import { KnowledgeMap } from "knowledge-map-3d";
import type { MapDocument, ClusterMeta, NebulaMeta } from "knowledge-map-3d";
import mapData from "./data/map-data.json";
import OracleDrawer from "./components/OracleDrawer";
import Legend from "./components/Legend";
import LoopHUD from "./components/LoopHUD";

interface OracleMeta {
  id: string;
  name: string;
  emoji: string;
  role: string;
  color: string;
}

// Workshop type colors — maps aesthetic to CANVAS palette
const TYPE_COLORS: Record<string, string> = {
  learning: "#2d5be3",       // accent blue
  retrospective: "#c7b6f0",  // purple
  resonance: "#ffd166",       // amber (bright — soul marker)
  letter: "#4ec9b0",          // teal
  inbox: "#5b8def",           // soft blue
  writing: "#f764a0",         // pink
  learn: "#8b70d8",           // lavender
  // Sub-domain parents (bigger, bolder — they're "featured stars" inside each cluster)
  "domain-learning": "#5b8def",
  "domain-retrospective": "#c7b6f0",
  "domain-resonance": "#ffd166",
  "domain-letter": "#4ec9b0",
  "domain-inbox": "#5b8def",
  "domain-writing": "#f764a0",
  "domain-learn": "#8b70d8",
  default: "#a0a0b8",
};

export default function App() {
  const documents = mapData.documents as MapDocument[];
  const clusters = mapData.clusters as ClusterMeta[];
  const nebulae = mapData.nebulae as NebulaMeta[];
  const oracleMeta = mapData.oracle_meta as OracleMeta[];
  const stats = mapData.stats;

  const [selectedCluster, setSelectedCluster] = useState<ClusterMeta | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<MapDocument | null>(null);

  const oracleLookup = useMemo(
    () => Object.fromEntries(oracleMeta.map((o) => [o.id, o])),
    [oracleMeta],
  );

  const activeOracle = selectedCluster
    ? oracleLookup[selectedCluster.id]
    : selectedDoc
      ? oracleLookup[selectedDoc.clusterId]
      : null;

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#0a0a14" }}>
      <KnowledgeMap
        documents={documents}
        clusters={clusters}
        nebulae={nebulae}
        stats={{
          totalDocuments: stats.totalDocs,
          totalClusters: stats.totalClusters,
          byType: stats.byType,
        } as any}
        typeColors={TYPE_COLORS}
        typeFilters={["", "learning", "retrospective", "letter", "resonance", "domain-learning"]}
        sidebarTitle="Oracle Workshop — Knowledge Universe"
        onClusterClick={(c) => { setSelectedCluster(c); setSelectedDoc(null); }}
        onDocumentClick={(d) => { setSelectedDoc(d); setSelectedCluster(null); }}
      />

      <Legend oracleMeta={oracleMeta} />
      <LoopHUD loops={(mapData as any).loops ?? []} />

      {!selectedCluster && !selectedDoc && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(22, 33, 62, 0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(45, 91, 227, 0.3)",
            borderRadius: 20,
            padding: "8px 18px",
            color: "#e8e8f0",
            fontSize: 12,
            fontFamily: "Sarabun, sans-serif",
            zIndex: 5,
          }}
        >
          Drag to rotate · Scroll/pinch to zoom · Click a <span style={{ color: "#ffd166" }}>star</span> or
          <span style={{ color: "#2d5be3" }}> planet</span> to drill in · <kbd style={{ background: "#2d5be3", padding: "1px 5px", borderRadius: 3 }}>R</kbd> = reset camera
        </div>
      )}

      {(selectedCluster || selectedDoc) && activeOracle && (
        <OracleDrawer
          oracle={activeOracle}
          cluster={selectedCluster}
          document={selectedDoc}
          clusterDocs={documents.filter((d) => d.clusterId === activeOracle.id)}
          onClose={() => { setSelectedCluster(null); setSelectedDoc(null); }}
        />
      )}

      <footer
        style={{
          position: "fixed",
          bottom: 8,
          right: 12,
          color: "rgba(232, 232, 240, 0.5)",
          fontSize: 11,
          textAlign: "right",
          lineHeight: 1.5,
        }}
      >
        Workshop Consciousness Loop · forked knowledge-map-3d (Bombbaza/MIT)<br />
        Framework: Oracle by Nat Weerawan · Dashboard by QuillBrain 🪶
      </footer>
    </div>
  );
}
