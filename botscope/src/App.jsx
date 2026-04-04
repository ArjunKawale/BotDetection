import { useState } from "react";

const API_BASE = "http://localhost:8000";

// ── Circular probability gauge ────────────────────────────────────────────────
function CircularGauge({ value, size = 92 }) {
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * Math.min(Math.max(value, 0), 1);
  const pct = Math.round(value * 100);
  const color = value >= 0.65 ? "#e24b4a" : value >= 0.35 ? "#EF9F27" : "#1D9E75";

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#252d3d" strokeWidth="7" />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth="7"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.9s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1 }}>
        <span style={{ fontSize: "16px", fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>
          {pct}%
        </span>
        <span style={{ fontSize: "9px", color: "#4a5568", fontFamily: "'JetBrains Mono', monospace", marginTop: "2px", letterSpacing: "0.06em" }}>
          BOT
        </span>
      </div>
    </div>
  );
}

// ── Verdict pill ──────────────────────────────────────────────────────────────
function Verdict({ isBot, label }) {
  const c = isBot ? "#e24b4a" : "#1D9E75";
  return (
    <span style={{
      display: "inline-block", padding: "3px 11px", borderRadius: "999px",
      fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em",
      color: c, background: `${c}18`, border: `1px solid ${c}44`,
      fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase"
    }}>
      {isBot ? (label || "Bot Detected") : "Human"}
    </span>
  );
}

// ── Tag chip ──────────────────────────────────────────────────────────────────
function Tag({ label, color = "#7F77DD" }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: "4px",
      fontSize: "11px", fontWeight: 600, letterSpacing: "0.04em",
      fontFamily: "'JetBrains Mono', monospace",
      color, background: `${color}18`, border: `1px solid ${color}40`
    }}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

// ── Analysis card ─────────────────────────────────────────────────────────────
function AnalysisCard({ title, subtitle, modelType, icon, botProbability, isBot, renderDetails }) {
  return (
    <div style={{
      background: "#181d2a", border: "1px solid #252d3d", borderRadius: "14px",
      padding: "22px", display: "flex", flexDirection: "column", gap: "18px"
    }}>
      {/* Header */}
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        <div style={{
          width: "38px", height: "38px", borderRadius: "9px", background: "#252d3d",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "17px", flexShrink: 0
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#e8eaf0", lineHeight: 1.3 }}>{title}</div>
          <div style={{ fontSize: "11px", color: "#6b7a99", marginTop: "4px", lineHeight: 1.5 }}>{subtitle}</div>
        </div>
        <span style={{
          fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#4a5568",
          background: "#252d3d", borderRadius: "4px", padding: "3px 7px", flexShrink: 0
        }}>
          {modelType}
        </span>
      </div>

      {/* Gauge row */}
      <div style={{ display: "flex", alignItems: "center", gap: "18px", padding: "2px 0" }}>
        <CircularGauge value={botProbability} />
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <Verdict isBot={isBot} />
          <div style={{ fontSize: "12px", color: "#6b7a99" }}>
            <span style={{ color: "#c8d0e7", fontFamily: "'JetBrains Mono', monospace", fontSize: "14px" }}>
              {(botProbability * 100).toFixed(1)}%
            </span>
            {" "}probability of automation
          </div>
        </div>
      </div>

      {/* Details */}
      <div style={{ borderTop: "1px solid #252d3d", paddingTop: "14px" }}>
        {renderDetails()}
      </div>
    </div>
  );
}

// ── Loading spinner ───────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "64px 0" }}>
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r="22" fill="none" stroke="#252d3d" strokeWidth="4" />
        <circle cx="26" cy="26" r="22" fill="none" stroke="#EF9F27" strokeWidth="4"
          strokeDasharray="34.6 103.7" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate"
            from="0 26 26" to="360 26 26" dur="0.85s" repeatCount="indefinite" />
        </circle>
      </svg>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", color: "#6b7a99" }}>
        Scraping &amp; analyzing Reddit data…
      </div>
      <div style={{ fontSize: "11px", color: "#4a5568" }}>This may take 30–60 seconds</div>
    </div>
  );
}

// ── Overall score banner ──────────────────────────────────────────────────────
function OverallVerdict({ fa, username }) {
  const scores = [
    fa.ideology?.bot_probability ?? 0,
    fa.ai_authenticity?.ai_probability ?? 0,
    fa.frequency?.bot_probability ?? 0,
    fa.rhythm?.bot_probability ?? 0,
  ];
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const isBotOverall = avg >= 0.5;
  const color = avg >= 0.65 ? "#e24b4a" : avg >= 0.35 ? "#EF9F27" : "#1D9E75";

  return (
    <div style={{
      background: "#181d2a", border: `1px solid ${color}44`,
      borderRadius: "12px", padding: "16px 20px",
      display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px",
      flexWrap: "wrap"
    }}>
      <div>
        <div style={{ fontSize: "11px", color: "#6b7a99", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Analysis for
        </div>
        <div style={{ fontSize: "18px", fontWeight: 700, color: "#EF9F27", fontFamily: "'JetBrains Mono', monospace", marginTop: "2px" }}>
          u/{username}
        </div>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "11px", color: "#6b7a99" }}>Average bot score</div>
          <div style={{ fontSize: "22px", fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>
            {Math.round(avg * 100)}%
          </div>
        </div>
        <div style={{
          padding: "6px 16px", borderRadius: "8px", fontWeight: 700,
          fontSize: "13px", letterSpacing: "0.04em",
          color, background: `${color}18`, border: `1px solid ${color}44`
        }}>
          {isBotOverall ? "Likely Bot" : "Likely Human"}
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function analyze() {
    const u = username.trim();
    if (!u) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/process-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const fa = result?.full_analysis;

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#e8eaf0", fontFamily: "'Syne', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f1117; }
        ::placeholder { color: #4a5568; }
        input:focus { outline: none; }
        button:hover:not(:disabled) { opacity: 0.88; }
        button:active:not(:disabled) { transform: scale(0.98); }
      `}</style>

      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid #1e2333", padding: "14px 32px",
        display: "flex", alignItems: "center", gap: "10px",
        background: "rgba(15,17,23,0.9)", position: "sticky", top: 0, zIndex: 10
      }}>
        <div style={{
          width: "30px", height: "30px", borderRadius: "7px", background: "#EF9F27",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "15px", fontWeight: 700, color: "#0f1117"
        }}>B</div>
        <span style={{ fontWeight: 700, fontSize: "16px", letterSpacing: "-0.02em" }}>BotScope</span>
        <span style={{
          marginLeft: "auto", fontSize: "11px", color: "#4a5568",
          fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em"
        }}>Reddit Bot Detector v1.0</span>
      </nav>

      <main style={{ maxWidth: "880px", margin: "0 auto", padding: "52px 24px 80px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: "44px" }}>
          <h1 style={{ fontSize: "38px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: "12px" }}>
            Is this Reddit account a bot?
          </h1>
          <p style={{ color: "#6b7a99", fontSize: "15px", lineHeight: 1.6, maxWidth: "500px", margin: "0 auto" }}>
            Four independent models — two LLMs and two XGBoost classifiers — analyze
            content, style, frequency, and timing to detect automation.
          </p>
        </div>

        {/* Search */}
        <div style={{
          display: "flex", gap: "8px", marginBottom: "52px",
          background: "#181d2a", border: "1px solid #252d3d",
          borderRadius: "12px", padding: "8px"
        }}>
          <span style={{
            padding: "10px 2px 10px 12px", color: "#EF9F27",
            fontFamily: "'JetBrains Mono', monospace", fontSize: "15px", fontWeight: 700
          }}>u/</span>
          <input
            type="text"
            placeholder="enter reddit username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === "Enter" && analyze()}
            style={{
              flex: 1, background: "transparent", border: "none",
              color: "#e8eaf0", fontSize: "15px", fontFamily: "'JetBrains Mono', monospace"
            }}
          />
          <button
            onClick={analyze}
            disabled={loading || !username.trim()}
            style={{
              background: loading ? "#252d3d" : "#EF9F27",
              color: loading ? "#6b7a99" : "#0f1117",
              border: "none", borderRadius: "8px", padding: "10px 24px",
              fontSize: "14px", fontWeight: 700, cursor: loading ? "default" : "pointer",
              transition: "all 0.2s", letterSpacing: "0.02em", flexShrink: 0
            }}
          >
            {loading ? "Analyzing…" : "Analyze →"}
          </button>
        </div>

        {/* Loading */}
        {loading && <Spinner />}

        {/* Error */}
        {error && (
          <div style={{
            background: "rgba(226,75,74,0.07)", border: "1px solid rgba(226,75,74,0.3)",
            borderRadius: "10px", padding: "16px 20px", color: "#e24b4a",
            fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", lineHeight: 1.6
          }}>
            <strong>Pipeline Error</strong><br />
            {error}
          </div>
        )}

        {/* Results */}
        {result && fa && (
          <div>
            <OverallVerdict fa={fa} username={result.username} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "16px" }}>

              {/* 1 — Ideology / Content */}
              {fa.ideology && (
                <AnalysisCard
                  title="Content & Ideology Analysis"
                  subtitle="LLM scans the full posting history for repeated narratives, propaganda, spam, or mechanical message structures."
                  modelType="LLM"
                  icon="🧠"
                  botProbability={fa.ideology.bot_probability ?? 0}
                  isBot={(fa.ideology.bot_probability ?? 0) >= 0.5 || fa.ideology.account_type === "likely_bot"}
                  renderDetails={() => (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <Tag label={fa.ideology.content_classification} color="#7F77DD" />
                        <Tag label={fa.ideology.account_type} color={fa.ideology.account_type === "human_user" ? "#1D9E75" : "#e24b4a"} />
                        {fa.ideology.bot_type && fa.ideology.bot_type !== "unknown_bot" && (
                          <Tag label={fa.ideology.bot_type} color="#e24b4a" />
                        )}
                      </div>

                      {fa.ideology.pattern_detected && fa.ideology.pattern_description && (
                        <div style={{
                          background: "#0f1117", borderRadius: "8px", padding: "10px 12px",
                          border: "1px solid #252d3d"
                        }}>
                          <div style={{ fontSize: "10px", color: "#4a5568", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "5px" }}>
                            Pattern Detected
                          </div>
                          <p style={{ fontSize: "12px", color: "#8892a4", lineHeight: 1.65 }}>
                            {fa.ideology.pattern_description}
                          </p>
                        </div>
                      )}

                      {fa.ideology.key_indicators?.length > 0 && (
                        <div>
                          <div style={{ fontSize: "10px", color: "#4a5568", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "7px" }}>
                            Key Indicators
                          </div>
                          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "5px" }}>
                            {fa.ideology.key_indicators.map((ind, i) => (
                              <li key={i} style={{ fontSize: "12px", color: "#8892a4", display: "flex", gap: "8px", lineHeight: 1.5 }}>
                                <span style={{ color: "#EF9F27", flexShrink: 0, marginTop: "1px" }}>›</span>
                                {ind}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                />
              )}

              {/* 2 — AI-Generated Text */}
              {fa.ai_authenticity && (
                <AnalysisCard
                  title="AI-Generated Text Detection"
                  subtitle="LLM checks recent posts for ChatGPT/Claude hallmarks: robotic tone, unnatural vocabulary, structured phrasing."
                  modelType="LLM"
                  icon="🤖"
                  botProbability={fa.ai_authenticity.ai_probability ?? 0}
                  isBot={fa.ai_authenticity.is_ai_generated}
                  renderDetails={() => (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{
                        background: "#0f1117", borderRadius: "8px", padding: "10px 12px",
                        border: "1px solid #252d3d"
                      }}>
                        <div style={{ fontSize: "10px", color: "#4a5568", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "5px" }}>
                          Reasoning
                        </div>
                        <p style={{ fontSize: "12px", color: "#8892a4", lineHeight: 1.65 }}>
                          {fa.ai_authenticity.reasoning}
                        </p>
                      </div>
                      <div style={{ fontSize: "11px", color: "#4a5568", lineHeight: 1.6 }}>
                        Evaluated against signals like transitional phrase overuse ("Furthermore", "In conclusion"),
                        unnatural vocabulary ("delve", "tapestry"), and suspiciously perfect grammar.
                      </div>
                    </div>
                  )}
                />
              )}

              {/* 3 — Posting Frequency */}
              {fa.frequency && (
                <AnalysisCard
                  title="Unusual Posting Frequency"
                  subtitle="XGBoost classifier trained on posting_frequency_days. Bots post at rates far outside human norms."
                  modelType="XGBoost"
                  icon="📊"
                  botProbability={fa.frequency.bot_probability ?? 0}
                  isBot={fa.frequency.is_bot}
                  renderDetails={() => (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ fontSize: "12px", color: "#8892a4", lineHeight: 1.65 }}>
                        Measures the average number of posts made per day across the account's history.
                        The model was trained to distinguish the high-cadence mechanical output of bots from
                        normal human posting behavior.
                      </div>
                      <div style={{
                        padding: "8px 12px", borderRadius: "7px", fontSize: "12px",
                        fontFamily: "'JetBrains Mono', monospace",
                        color: fa.frequency.is_bot ? "#e24b4a" : "#1D9E75",
                        background: fa.frequency.is_bot ? "rgba(226,75,74,0.07)" : "rgba(29,158,117,0.07)",
                        border: `1px solid ${fa.frequency.is_bot ? "rgba(226,75,74,0.25)" : "rgba(29,158,117,0.25)"}`
                      }}>
                        {fa.frequency.is_bot
                          ? "⚠ Frequency anomaly detected — posting rate exceeds human norms"
                          : "✓ Posting rate falls within expected human range"}
                      </div>
                    </div>
                  )}
                />
              )}

              {/* 4 — Posting Rhythm */}
              {fa.rhythm && (
                <AnalysisCard
                  title="Unusual Posting Rhythm"
                  subtitle="XGBoost classifier using gap variance, top-of-hour clustering, and sleep pattern features to catch mechanical timing."
                  modelType="XGBoost"
                  icon="⏱"
                  botProbability={fa.rhythm.bot_probability ?? 0}
                  isBot={fa.rhythm.is_bot}
                  renderDetails={() => (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ fontSize: "12px", color: "#8892a4", lineHeight: 1.65 }}>
                        Bots often post in clockwork patterns. This model looks for top-of-hour clustering,
                        low gap variance (posts arriving at precise intervals), and the absence of normal sleep
                        windows that all humans exhibit.
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                        {[
                          { label: "Gap Variance", desc: "Irregular vs mechanical" },
                          { label: "Hour Clustering", desc: "Posts per clock hour" },
                          { label: "Sleep Windows", desc: "Expected idle periods" },
                        ].map(f => (
                          <div key={f.label} style={{
                            background: "#0f1117", borderRadius: "7px",
                            padding: "8px 10px", border: "1px solid #252d3d"
                          }}>
                            <div style={{ fontSize: "10px", fontWeight: 600, color: "#c8d0e7", marginBottom: "3px" }}>{f.label}</div>
                            <div style={{ fontSize: "10px", color: "#4a5568" }}>{f.desc}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{
                        padding: "8px 12px", borderRadius: "7px", fontSize: "12px",
                        fontFamily: "'JetBrains Mono', monospace",
                        color: fa.rhythm.is_bot ? "#e24b4a" : "#1D9E75",
                        background: fa.rhythm.is_bot ? "rgba(226,75,74,0.07)" : "rgba(29,158,117,0.07)",
                        border: `1px solid ${fa.rhythm.is_bot ? "rgba(226,75,74,0.25)" : "rgba(29,158,117,0.25)"}`
                      }}>
                        {fa.rhythm.is_bot
                          ? "⚠ Mechanical rhythm detected — timing patterns are non-human"
                          : "✓ Timing patterns appear organic and human-like"}
                      </div>
                    </div>
                  )}
                />
              )}

            </div>

            {/* Footer note */}
            <div style={{
              marginTop: "28px", padding: "14px 18px", borderRadius: "10px",
              background: "#181d2a", border: "1px solid #252d3d",
              fontSize: "11px", color: "#4a5568", lineHeight: 1.7,
              fontFamily: "'JetBrains Mono', monospace"
            }}>
              Raw data cached at: <span style={{ color: "#6b7a99" }}>{result.file_created}</span>
              {" · "}Run individual model endpoints to reanalyze without re-scraping.
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !result && !error && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "16px" }}>
              {["LLM Content", "LLM AI-Text", "XGB Frequency", "XGB Rhythm"].map(m => (
                <span key={m} style={{
                  fontSize: "11px", fontFamily: "'JetBrains Mono', monospace",
                  color: "#4a5568", background: "#181d2a", border: "1px solid #252d3d",
                  borderRadius: "5px", padding: "4px 8px"
                }}>{m}</span>
              ))}
            </div>
            <p style={{ color: "#4a5568", fontSize: "13px" }}>Enter a Reddit username above to run all four models.</p>
          </div>
        )}

      </main>
    </div>
  );
}