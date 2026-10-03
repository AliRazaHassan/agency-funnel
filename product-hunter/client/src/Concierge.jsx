import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";

const STAT_SELECTOR = [
  ".metric",
  ".score-quads > div",
  ".platform-signals > span",
  ".unit-strip > div",
  ".radar-kpis > div",
  ".winner-pill",
  ".lifecycle-line",
  ".bar-row",
  ".win-badge",
  ".rank-pill",
  ".vol-row",
  ".source-option",
  ".confidence",
  ".lifecycle",
].join(",");

function cleanStatText(el) {
  return String(el?.innerText || el?.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

export function Concierge({ product, products = [], onAction }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState(null);
  const [menu, setMenu] = useState(null);
  const [messages, setMessages] = useState([]);
  const inputRef = useRef(null);

  const radarSummary = useMemo(() => ({
    total: products.length,
    strong: products.filter((p) => p.winnerDecision?.verdict === "STRONG_CANDIDATE").length,
    validate: products.filter((p) => p.winnerDecision?.verdict === "VALIDATE").length,
    avoid: products.filter((p) => p.winnerDecision?.verdict === "AVOID").length,
  }), [products]);

  const activeProduct = focus?.product || product || null;

  useEffect(() => {
    function onContextMenu(e) {
      const target = e.target?.closest?.(STAT_SELECTOR);
      if (!target) return;
      e.preventDefault();

      const card = target.closest("[data-ai-product-id]");
      const productId = card?.dataset?.aiProductId;
      const contextualProduct = productId
        ? products.find((p) => String(p.id) === String(productId)) || product
        : product;

      const rect = target.getBoundingClientRect();
      const x = Math.min(e.clientX, window.innerWidth - 230);
      const y = Math.min(e.clientY, window.innerHeight - 170);

      setMenu({
        x: Math.max(8, x),
        y: Math.max(8, y),
        label: cleanStatText(target) || "Selected stat",
        product: contextualProduct || null,
        elementLabel: target.getAttribute("aria-label") || target.dataset?.aiLabel || "",
        rect: { top: rect.top, left: rect.left },
      });
    }

    function dismiss(e) {
      if (!e.target?.closest?.(".ai-context-menu")) setMenu(null);
    }

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [product, products]);

  async function ask(text, chosenFocus = focus) {
    const q = String(text || question).trim();
    if (!q || busy) return;
    const currentProduct = chosenFocus?.product || activeProduct;
    const selectedStat = chosenFocus?.label || null;
    setQuestion("");
    setOpen(true);
    setMessages((m) => [...m, { role: "user", text: q, stat: selectedStat }]);
    setBusy(true);
    try {
      const data = await api("/api/concierge", {
        method: "POST",
        body: {
          question: q,
          context: {
            product: currentProduct,
            selectedStat,
            radarSummary,
          },
        },
      });
      setMessages((m) => [...m, {
        role: "assistant",
        text: data.answer,
        mode: data.mode,
        chips: data.chips || [],
      }]);
      if (data.action) onAction?.(data.action, currentProduct);
    } catch (e) {
      setMessages((m) => [...m, {
        role: "assistant",
        text: e.message || "I couldn't read this stat right now.",
      }]);
    } finally {
      setBusy(false);
    }
  }

  function askFromMenu(prompt) {
    const nextFocus = { label: menu.label, product: menu.product };
    setFocus(nextFocus);
    setMenu(null);
    setOpen(true);
    ask(prompt, nextFocus);
  }

  function openAssistant() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const starters = activeProduct
    ? ["Why is this product strong?", "Validate this product", "Show top picks"]
    : ["Show top picks", "Show my watchlist", "Find upcoming event products"];

  return (
    <>
      <button className="concierge-fab" type="button" onClick={openAssistant} aria-label="Open AI analyst">
        <span>AI</span>
        <b>Ask analyst</b>
      </button>

      {menu ? (
        <div className="ai-context-menu" style={{ left: menu.x, top: menu.y }} role="menu">
          <div className="ai-context-title">
            <span>AI</span>
            <div><b>Ask about this</b><small>{menu.label}</small></div>
          </div>
          <button type="button" onClick={() => askFromMenu("Explain this stat in simple terms and tell me what it means for this product.")}>
            Explain this number
          </button>
          <button type="button" onClick={() => askFromMenu("Is this stat good or risky? Compare it with the other available evidence.")}>
            Is this good or risky?
          </button>
          <button type="button" onClick={() => askFromMenu("What should I do next based on this stat? Give me one practical validation step.")}>
            What should I do next?
          </button>
        </div>
      ) : null}

      {open ? (
        <aside className="concierge-panel">
          <div className="concierge-head">
            <div className="concierge-brand">
              <span className="concierge-orb">AI</span>
              <div>
                <strong>Product Analyst</strong>
                <span>{activeProduct ? activeProduct.title : "Context-aware research assistant"}</span>
              </div>
            </div>
            <button className="concierge-close" type="button" onClick={() => setOpen(false)} aria-label="Close AI analyst">×</button>
          </div>

          {focus?.label ? (
            <div className="concierge-focus">
              <small>Analyzing selected stat</small>
              <b>{focus.label}</b>
            </div>
          ) : activeProduct ? (
            <div className="concierge-snapshot">
              <div><b>{activeProduct.trendScore ?? "—"}</b><span>Trend</span></div>
              <div><b>{activeProduct.winnerDecision?.score ?? "—"}</b><span>Winner</span></div>
              <div><b>{activeProduct.marginPct ?? "—"}%</b><span>Margin</span></div>
              <div><b>{activeProduct.dataConfidence || "LOW"}</b><span>Confidence</span></div>
            </div>
          ) : null}

          <div className="concierge-messages">
            {!messages.length ? (
              <div className="concierge-empty">
                <strong>Ask the data — or tell Product Hunter what to do.</strong>
                <p>Try “show top picks”, “show my watchlist”, “validate this product”, or “find upcoming event products”.</p>
              </div>
            ) : null}
            {messages.slice(-10).map((m, i) => (
              <div key={i} className={`concierge-msg ${m.role}`}>
                {m.stat ? <small>About: {m.stat}</small> : null}
                <p>{m.text}</p>
                {m.mode ? <em>{m.mode === "ai" ? "AI analysis" : "Rules analysis"}</em> : null}
              </div>
            ))}
            {busy ? (
              <div className="concierge-thinking">
                <span className="thinking-cloud">☁</span><i></i><i></i><i></i><span>AI is thinking…</span>
              </div>
            ) : null}
          </div>

          <div className="concierge-chips">
            {starters.map((s) => <button key={s} type="button" onClick={() => ask(s)}>{s}</button>)}
          </div>

          <form className="concierge-input" onSubmit={(e) => { e.preventDefault(); ask(); }}>
            <input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={focus?.label ? "Ask a follow-up about this stat…" : "Ask about the product or evidence…"}
            />
            <button className="btn" type="submit" disabled={busy || !question.trim()}>Ask</button>
          </form>
          <p className="concierge-note">Uses the product's current evidence. It does not guarantee sales or profit.</p>
        </aside>
      ) : null}
    </>
  );
}
