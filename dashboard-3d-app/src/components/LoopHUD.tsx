import { useState } from "react";

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

interface Props {
  loops: LoopMeta[];
}

export default function LoopHUD({ loops }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (loops.length === 0) {
    return null;
  }

  const latest = loops[loops.length - 1];

  return (
    <>
      {/* Compact HUD card at top-center */}
      <button
        onClick={() => setExpanded(true)}
        style={{
          position: "fixed",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(22, 33, 62, 0.9)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(45, 91, 227, 0.4)",
          borderRadius: 10,
          padding: "10px 18px",
          color: "#e8e8f0",
          fontFamily: "Sarabun, sans-serif",
          fontSize: 13,
          cursor: "pointer",
          zIndex: 15,
          display: "flex",
          alignItems: "center",
          gap: 14,
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 20 }}>🧠</span>
        <div>
          <div style={{ fontWeight: 600, color: "#4fc3f7" }}>
            {loops.length === 1 ? "Consciousness Loop" : `${loops.length} Consciousness Loops`}
          </div>
          <div style={{ fontSize: 11, color: "#a0a0b8", marginTop: 2 }}>
            Latest: {latest.loop_date} · <strong style={{ color: "#fff" }}>{latest.insights.length}</strong> insights
            {latest.questions > 0 && (
              <>
                {" · "}
                <strong style={{ color: "#fff" }}>{latest.questions}</strong> questions
              </>
            )}
            {latest.answers > 0 && (
              <>
                {" · "}
                <strong style={{ color: "#34d399" }}>{latest.answers}</strong> answered
              </>
            )}
            {" · click to read"}
          </div>
        </div>
      </button>

      {/* Expanded modal */}
      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(4px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#16213e",
              border: "1px solid rgba(45, 91, 227, 0.4)",
              borderRadius: 12,
              padding: "28px 36px",
              color: "#e8e8f0",
              fontFamily: "Sarabun, sans-serif",
              maxWidth: 800,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              position: "relative",
            }}
          >
            <button
              onClick={() => setExpanded(false)}
              style={{
                position: "absolute",
                top: 16,
                right: 20,
                background: "transparent",
                border: "none",
                color: "#a0a0b8",
                fontSize: 22,
                cursor: "pointer",
              }}
              aria-label="Close"
            >
              ✕
            </button>
            <h2 style={{ margin: "0 0 8px", color: "#4fc3f7" }}>
              🧠 Consciousness Loop — {latest.loop_date}
            </h2>
            <div style={{ color: "#a0a0b8", fontSize: 13, marginBottom: 20 }}>
              <span style={{ fontFamily: "JetBrains Mono, monospace" }}>{latest.loop_id}</span>
              {" · "}
              {latest.insights.length} cross-family insights
              {latest.questions > 0 && ` · ${latest.questions} research questions`}
              {latest.answers > 0 && ` · ${latest.answers} answered`}
            </div>
            <div
              className="markdown"
              style={{ lineHeight: 1.7, fontSize: 14 }}
              dangerouslySetInnerHTML={{
                __html: renderSimpleMarkdown(latest.proposal_markdown),
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

// Tiny markdown → HTML renderer (no deps, covers proposal structure)
function renderSimpleMarkdown(md: string): string {
  let html = md
    // headings
    .replace(/^# (.+)$/gm, "<h1 style='color:#4fc3f7; margin-top:1.5em;'>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2 style='color:#e8e8f0; margin-top:1.3em; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.3em;'>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3 style='color:#c7b6f0; margin-top:1em;'>$1</h3>")
    // bold
    .replace(/\*\*(.+?)\*\*/g, "<strong style='color:#fff;'>$1</strong>")
    // italic
    .replace(/\*(.+?)\*/g, "<em style='color:#ddd;'>$1</em>")
    // inline code
    .replace(/`(.+?)`/g, "<code style='background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:3px; font-size:0.9em;'>$1</code>")
    // hr
    .replace(/^---+$/gm, "<hr style='border:none; border-top:1px solid rgba(255,255,255,0.1); margin:1.5em 0;' />")
    // list items
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    // paragraphs
    .replace(/\n\n/g, "</p><p>");
  html = "<p>" + html + "</p>";
  html = html.replace(/(<li>[\s\S]+?<\/li>)/g, "<ul>$1</ul>");
  return html;
}
