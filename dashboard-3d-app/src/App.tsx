import { useMemo, useState } from "react";
import { KnowledgeMap } from "knowledge-map-3d";
import type { MapDocument, ClusterMeta, NebulaMeta } from "knowledge-map-3d";
import mapData from "./data/map-data.json";
import OracleDrawer from "./components/OracleDrawer";
import Legend from "./components/Legend";

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
  resonance: "#ffd166",       // amber
  letter: "#4ec9b0",          // teal
  inbox: "#5b8def",           // soft blue
  writing: "#f764a0",         // pink
  learn: "#8b70d8",           // lavender
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
        typeFilters={["", "learning", "retrospective", "letter", "resonance"]}
        sidebarTitle="Oracle Workshop — Knowledge Universe"
        onClusterClick={(c) => { setSelectedCluster(c); setSelectedDoc(null); }}
        onDocumentClick={(d) => { setSelectedDoc(d); setSelectedCluster(null); }}
      />

      <Legend oracleMeta={oracleMeta} />

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
