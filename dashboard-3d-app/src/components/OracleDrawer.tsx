import type { MapDocument, ClusterMeta } from "knowledge-map-3d";

interface OracleMeta {
  id: string;
  name: string;
  emoji: string;
  role: string;
  color: string;
}

interface Props {
  oracle: OracleMeta;
  cluster: ClusterMeta | null;
  document: MapDocument | null;
  clusterDocs: MapDocument[];
  onClose: () => void;
}

export default function OracleDrawer({
  oracle,
  cluster,
  document,
  clusterDocs,
  onClose,
}: Props) {
  const repoUrl = `https://github.com/brightverse-solution/${oracle.id}-oracle`;

  const typeCounts = clusterDocs.reduce<Record<string, number>>((acc, d) => {
    acc[d.type] = (acc[d.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        top: 80,
        width: 360,
        maxHeight: "calc(100vh - 100px)",
        background: "rgba(22, 33, 62, 0.92)",
        backdropFilter: "blur(10px)",
        border: `1px solid ${oracle.color}`,
        borderRadius: 12,
        padding: 18,
        color: "#e8e8f0",
        fontFamily: "Sarabun, sans-serif",
        overflowY: "auto",
        zIndex: 20,
        boxShadow: `0 4px 30px ${oracle.color}44`,
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          background: "transparent",
          border: "none",
          color: "#a0a0b8",
          fontSize: 18,
          cursor: "pointer",
          padding: 4,
        }}
        aria-label="Close"
      >
        ✕
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 42, lineHeight: 1 }}>{oracle.emoji}</div>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: oracle.color }}>{oracle.name}</h2>
          <div style={{ color: "#a0a0b8", fontSize: 13 }}>{oracle.role}</div>
        </div>
      </div>

      {document ? (
        <>
          <h4 style={{ margin: "14px 0 6px", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a0a0b8" }}>
            Selected document
          </h4>
          <div style={{ background: "rgba(255,255,255,0.04)", padding: 10, borderRadius: 6, fontSize: 13 }}>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, wordBreak: "break-all" }}>
              {document.sourceFile}
            </div>
            <div style={{ color: "#a0a0b8", fontSize: 11, marginTop: 4 }}>
              type: <span style={{ color: oracle.color }}>{document.type}</span>
              {" · "}
              size: {Math.round(document.contentLength / 1024)} KB
              {document.createdAt && (
                <>
                  {" · "}
                  mod: {new Date(document.createdAt).toISOString().slice(0, 10)}
                </>
              )}
            </div>
            {document.concepts.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {document.concepts.map((c) => (
                  <span
                    key={c}
                    style={{
                      fontSize: 10,
                      background: "rgba(45, 91, 227, 0.2)",
                      border: `1px solid ${oracle.color}55`,
                      padding: "2px 7px",
                      borderRadius: 10,
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      ) : cluster ? (
        <>
          <h4 style={{ margin: "14px 0 6px", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a0a0b8" }}>
            Cluster overview
          </h4>
          <div style={{ fontSize: 13, color: "#e8e8f0", marginBottom: 12 }}>
            <div>Total documents: <strong>{clusterDocs.length}</strong></div>
          </div>

          <h4 style={{ margin: "14px 0 6px", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a0a0b8" }}>
            By type
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            {Object.entries(typeCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <div key={type} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#e8e8f0" }}>{type}</span>
                  <span style={{ color: oracle.color, fontFamily: "JetBrains Mono, monospace" }}>{count}</span>
                </div>
              ))}
          </div>
        </>
      ) : null}

      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          fontSize: 12,
        }}
      >
        <a
          href={repoUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: oracle.color, textDecoration: "none" }}
        >
          → Open {oracle.id}-oracle on GitHub
        </a>
      </div>
    </div>
  );
}
