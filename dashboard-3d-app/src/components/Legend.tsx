interface OracleMeta {
  id: string;
  name: string;
  emoji: string;
  role: string;
  color: string;
}

export default function Legend({ oracleMeta }: { oracleMeta: OracleMeta[] }) {
  return (
    <aside
      style={{
        position: "fixed",
        top: 16,
        left: 16,
        background: "rgba(22, 33, 62, 0.85)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(45, 91, 227, 0.3)",
        borderRadius: 10,
        padding: 14,
        color: "#e8e8f0",
        fontFamily: "Sarabun, sans-serif",
        fontSize: 13,
        maxWidth: 240,
        zIndex: 10,
      }}
    >
      <h3 style={{ margin: "0 0 10px", fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "#a0a0b8" }}>
        Workshop Family
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {oracleMeta.map((o) => (
          <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>{o.emoji}</span>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                background: o.color,
                borderRadius: "50%",
                boxShadow: `0 0 6px ${o.color}`,
              }}
            />
            <span style={{ fontWeight: 600 }}>{o.name}</span>
            <span style={{ color: "#a0a0b8", fontSize: 11 }}>· {o.role}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
