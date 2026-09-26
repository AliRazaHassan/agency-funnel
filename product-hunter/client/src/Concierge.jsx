import { useMemo, useState } from "react";
import { api } from "./api.js";

export function Concierge({ product, products = [] }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Ask me what the stats mean, why a product looks strong, or what risk to validate next." },
  ]);

  const radarSummary = useMemo(() => ({
    total: products.length,
    strong: products.filter((p) => p.winnerDecision?.verdict === "STRONG_CANDIDATE").length,
    validate: products.filter((p) => p.winnerDecision?.verdict === "VALIDATE").length,
    avoid: products.filter((p) => p.winnerDecision?.verdict === "AVOID").length,
  }), [products]);

  async function ask(text) {
    const q = String(text || question).trim();
    if (!q || busy) return;
    setQuestion("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const data = await api("/api/concierge", {
        method: "POST",
        body: { question: q, context: { product, radarSummary } },
      });
      setMessages((m) => [...m, { role: "assistant", text: data.answer, mode: data.mode, chips: data.chips || [] }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: e.message || "I couldn't read the stats right now." }]);
    } finally {
      setBusy(false);
    }
  }

  const starters = product
    ? ["Why is this winning?", "What are the risks?", "Explain the stats"]
    : ["What makes a strong candidate?", "How should I read confidence?", "What should I validate first?"];

  return (
    <>
      <button className="concierge-fab" type="button" onClick={() => setOpen((v) => !v)}>
        <span>AI</span><b>Concierge</b>
      </button>
      {open ? (
        <aside className="concierge-panel">
          <div className="concierge-head">
            <div>
              <strong>Product Hunter Concierge</strong>
              <span>{product ? product.title : "Radar guide"}</span>
            </div>
            <button className="ghost" type="button" onClick={() => setOpen(false)}>×</button>
          </div>
          {product ? (
            <div className="concierge-snapshot">
              <div><b>{product.trendScore ?? "—"}</b><span>Trend</span></div>
              <div><b>{product.winnerDecision?.score ?? "—"}</b><span>Winner</span></div>
              <div><b>{product.marginPct ?? "—"}%</b><span>Margin</span></div>
              <div><b>{product.dataConfidence || "LOW"}</b><span>Confidence</span></div>
            </div>
          ) : null}
          <div className="concierge-messages">
            {messages.slice(-8).map((m, i) => (
              <div key={i} className={`concierge-msg ${m.role}`}>
                <p>{m.text}</p>
                {m.mode ? <small>{m.mode === "ai" ? "AI explanation" : "Stats explanation"}</small> : null}
              </div>
            ))}
            {busy ? <div className="concierge-msg assistant"><p>Reading the evidence…</p></div> : null}
          </div>
          <div className="concierge-chips">
            {starters.map((s) => <button key={s} type="button" onClick={() => ask(s)}>{s}</button>)}
          </div>
          <form className="concierge-input" onSubmit={(e) => { e.preventDefault(); ask(); }}>
            <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about this product…" />
            <button className="btn" type="submit" disabled={busy || !question.trim()}>Ask</button>
          </form>
          <p className="concierge-note">Explains evidence; it does not guarantee sales or profit.</p>
        </aside>
      ) : null}
    </>
  );
}
