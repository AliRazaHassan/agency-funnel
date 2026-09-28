/**
 * Client-ready research brief (Markdown / HTML).
 */

function money(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `$${Math.round(Number(n) * 100) / 100}`;
}

export function buildClientBrief({ scout, selectedOpp, hunt, selectedProducts } = {}) {
  const opp = selectedOpp || scout?.opportunities?.[0] || null;
  const products = selectedProducts?.length
    ? selectedProducts
    : (hunt?.products || []).filter((p) => p.isTopPick).slice(0, 10);
  const ruleGate = hunt?.winningSummary;
  const winner = hunt?.winnerSummary;

  const lines = [];
  lines.push(`# Signal Desk · Client Research Brief`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push(`## Niche recommendation`);
  if (opp) {
    lines.push(`**${opp.niche}**`);
    lines.push("");
    lines.push(`- Audience: ${opp.audience || "—"}`);
    lines.push(`- Sell on: ${opp.sellWhere?.primary || "Shopify"} · ${(opp.sellWhere?.geos || []).join(", ")}`);
    lines.push(`- Est. AOV: ${money(opp.estAovUsd)} · Est. contribution: ${money(opp.estContributionUsd)}`);
    lines.push(`- Planning orders / mo: ${opp.projectedMonthlyOrders?.base ?? "—"}`);
    lines.push(`- Rank score: ${opp.rankScore ?? "—"}`);
    lines.push("");
    lines.push(`### Why now`);
    lines.push(opp.whyNow || "—");
    lines.push("");
    lines.push(`### Marketing hook`);
    lines.push(`> ${opp.marketing?.hook || "—"}`);
    lines.push("");
    lines.push(`**Offer:** ${opp.marketing?.offer || "—"}`);
    lines.push("");
    if (opp.marketing?.adAngles?.length) {
      lines.push(`### Ad angles`);
      for (const a of opp.marketing.adAngles) lines.push(`- ${a}`);
      lines.push("");
    }
  } else {
    lines.push("_No opportunity selected._");
    lines.push("");
  }

  lines.push(`## Product shortlist`);
  if (winner) {
    lines.push(`Evidence shortlist: **${winner.topPicks ?? 0} Top Picks** · ${winner.strong ?? 0} strong · ${winner.validate ?? 0} validate · ${winner.avoid ?? 0} avoid (of ${winner.total ?? 0})`);
    lines.push("");
  }
  if (ruleGate) {
    lines.push(`Deterministic rule gate: ${ruleGate.pass} pass · ${ruleGate.watch} watch · ${ruleGate.fail} fail. Rule gate is not a proven-winner claim.`);
    lines.push("");
  }
  if (products?.length) {
    lines.push(`| # | Evidence verdict | Product | Buy | Sell | Margin | Problem |`);
    lines.push(`|---|---------|---------|-----|------|--------|---------|`);
    products.forEach((p, i) => {
      lines.push(
        `| ${p.rank || i + 1} | ${p.isTopPick ? `Top Pick #${p.winnerRank} · ` : ""}${p.winnerDecision?.verdict || "VALIDATE"} | ${String(p.title || "").replace(/\|/g, "/")} | ${money(p.estCostUsd)} | ${money(p.estSellPriceUsd)} | ${p.marginPct ?? "—"}% | ${String(p.problemSolved || "").replace(/\|/g, "/")} |`
      );
    });
    lines.push("");
  } else {
    lines.push("_No products selected — run Hunt and pick SKUs._");
    lines.push("");
  }

  lines.push(`## Data honesty`);
  lines.push(`- Demand / interest: public-interest signals + ESTIMATED industry planning models; not live marketplace GMV`);
  lines.push(`- TikTok / Meta: trending creatives board + research links (not shop GMV)`);
  lines.push(`- Amazon units: only if manual paste / Keepa snapshot matched`);
  lines.push(`- Supplier costs: catalog estimates until verified on AutoDS/CJ/AliExpress`);
  lines.push("");
  lines.push(`## Next steps`);
  lines.push(`1. Verify top SKUs on supplier + Amazon`);
  lines.push(`2. Import Matrixify CSV into Shopify`);
  lines.push(`3. Launch creative tests with the hooks above`);
  lines.push("");
  lines.push(`— Signal Desk`);

  const markdown = lines.join("\n");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Signal Desk Brief</title>
<style>
body{font-family:Georgia,serif;max-width:820px;margin:2rem auto;padding:0 1rem;color:#122;line-height:1.5}
h1,h2,h3{font-family:system-ui,sans-serif}
table{border-collapse:collapse;width:100%;font-size:14px}
td,th{border:1px solid #ccd;padding:.4rem .5rem;text-align:left}
blockquote{border-left:3px solid #2a6;margin:0;padding:.2rem .8rem;color:#345}
</style></head><body>
${markdown
  .replace(/^# (.*)$/gm, "<h1>$1</h1>")
  .replace(/^## (.*)$/gm, "<h2>$1</h2>")
  .replace(/^### (.*)$/gm, "<h3>$1</h3>")
  .replace(/^\> (.*)$/gm, "<blockquote>$1</blockquote>")
  .replace(/^\*\*(.*)\*\*$/gm, "<p><strong>$1</strong></p>")
  .replace(/^\- (.*)$/gm, "<li>$1</li>")
  .replace(/\n\n/g, "<br/><br/>")}
</body></html>`;

  return { markdown, html, title: opp?.niche || "Signal Desk Brief" };
}
