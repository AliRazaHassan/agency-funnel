const DAY = 86400000;

const EVENT_DEFS = [
  { id: "black-friday", name: "Black Friday / Cyber Monday", month: 10, dayRule: "fourth-thursday-plus-1", leadDays: 55, regions: ["Global","US","UK","CA","AU","DE","FR"], themes: ["giftable gadgets","home upgrades","beauty tools","fitness accessories","pet gifts","tech accessories"], tags: ["gift","deal","bundle","holiday"] },
  { id: "christmas", name: "Christmas", month: 11, day: 25, leadDays: 75, regions: ["Global","US","UK","CA","AU","DE","FR"], themes: ["personalized gifts","stocking stuffers","pet gifts","home decor","kids gifts","beauty gifts","kitchen gifts"], tags: ["gift","christmas","holiday","winter"] },
  { id: "new-year", name: "New Year", month: 0, day: 1, leadDays: 45, regions: ["Global"], themes: ["fitness","organization","wellness","productivity","journaling","meal prep"], tags: ["resolution","fitness","organization"] },
  { id: "valentines", name: "Valentine's Day", month: 1, day: 14, leadDays: 45, regions: ["Global"], themes: ["couples gifts","jewelry accessories","self-care gifts","personalized gifts","date-night products"], tags: ["gift","couples","romance"] },
  { id: "mothers-day", name: "Mother's Day", month: 4, dayRule: "second-sunday", leadDays: 50, regions: ["US","CA","AU","Global"], themes: ["self-care","home gifts","garden gifts","kitchen gifts","personalized gifts"], tags: ["gift","mother","home"] },
  { id: "fathers-day", name: "Father's Day", month: 5, dayRule: "third-sunday", leadDays: 45, regions: ["US","UK","CA","Global"], themes: ["tools accessories","outdoor gear","car accessories","fitness gifts","desk gadgets"], tags: ["gift","father","outdoor"] },
  { id: "halloween", name: "Halloween", month: 9, day: 31, leadDays: 55, regions: ["US","UK","CA","Global"], themes: ["costume accessories","party decor","pet costumes","lighting","novelty gifts"], tags: ["halloween","party","costume","decor"] },
  { id: "back-to-school", name: "Back to School", month: 7, day: 15, leadDays: 65, regions: ["Global","US","UK","CA"], themes: ["desk organization","lunch accessories","study tools","backpack accessories","dorm organization"], tags: ["school","student","organization"] },
  { id: "summer-travel", name: "Summer Travel", month: 5, day: 1, leadDays: 70, regions: ["Global"], themes: ["travel organizers","portable accessories","outdoor products","hydration","car travel"], tags: ["travel","summer","outdoor"] },
  { id: "ramadan-eid", name: "Ramadan / Eid", fixedFallback: "2027-02-08", leadDays: 55, regions: ["Global","Gulf"], themes: ["home decor","gift sets","modest lifestyle accessories","kitchen serving","family gifts"], tags: ["ramadan","eid","gift","home"] },
  { id: "easter", name: "Easter", fixedFallback: "2027-03-28", leadDays: 40, regions: ["Global","US","UK","CA","AU"], themes: ["family crafts","spring decor","kids gifts","garden accessories","baking accessories"], tags: ["easter","spring","gift"] }
];

function nthWeekday(year, month, weekday, nth) {
  const d = new Date(Date.UTC(year, month, 1));
  const delta = (weekday - d.getUTCDay() + 7) % 7;
  d.setUTCDate(1 + delta + (nth - 1) * 7);
  return d;
}

function dateForEvent(def, year) {
  if (def.fixedFallback) {
    const base = new Date(def.fixedFallback + "T00:00:00Z");
    if (base.getUTCFullYear() === year) return base;
    const shifted = new Date(base);
    shifted.setUTCFullYear(year);
    return shifted;
  }
  if (def.dayRule === "second-sunday") return nthWeekday(year, def.month, 0, 2);
  if (def.dayRule === "third-sunday") return nthWeekday(year, def.month, 0, 3);
  if (def.dayRule === "fourth-thursday-plus-1") {
    const thanksgiving = nthWeekday(year, 10, 4, 4);
    return new Date(thanksgiving.getTime() + DAY);
  }
  return new Date(Date.UTC(year, def.month, def.day));
}

function nextOccurrence(def, now = new Date()) {
  const year = now.getUTCFullYear();
  let date = dateForEvent(def, year);
  if (date.getTime() < now.getTime() - DAY) date = dateForEvent(def, year + 1);
  return date;
}

export function getUpcomingEvents({ region = "Global", days = 240, now = new Date() } = {}) {
  const horizon = now.getTime() + days * DAY;
  return EVENT_DEFS
    .map((def) => {
      const date = nextOccurrence(def, now);
      const daysAway = Math.max(0, Math.ceil((date.getTime() - now.getTime()) / DAY));
      const sellingWindowOpen = daysAway <= def.leadDays;
      const urgency = sellingWindowOpen ? Math.max(40, Math.min(100, Math.round(100 - (daysAway / Math.max(1, def.leadDays)) * 45))) : Math.max(15, 55 - Math.round((daysAway - def.leadDays) / 3));
      return {
        ...def,
        date: date.toISOString().slice(0, 10),
        daysAway,
        sellingWindowOpen,
        opportunityScore: urgency,
        recommendedStartDate: new Date(date.getTime() - def.leadDays * DAY).toISOString().slice(0, 10)
      };
    })
    .filter((e) => e.date && new Date(e.date + "T00:00:00Z").getTime() <= horizon)
    .filter((e) => e.regions.includes("Global") || region === "Global" || e.regions.includes(region))
    .sort((a, b) => a.daysAway - b.daysAway);
}

export function buildSeasonalContext(region = "Global", now = new Date()) {
  const events = getUpcomingEvents({ region, days: 180, now }).slice(0, 5);
  return {
    generatedAt: now.toISOString(),
    region,
    events,
    prompt: events.map((e) => `${e.name} in ${e.daysAway} days; themes: ${e.themes.join(", ")}`).join("\n")
  };
}

export function seasonalOpportunitySeeds(region = "Global", now = new Date()) {
  return getUpcomingEvents({ region, days: 150, now })
    .filter((e) => e.sellingWindowOpen || e.daysAway <= e.leadDays + 30)
    .slice(0, 4)
    .map((e, i) => ({
      id: `seasonal-${e.id}-${i}`,
      niche: `${e.name} · ${e.themes[0]}`,
      audience: `Shoppers preparing for ${e.name}`,
      demandDrivers: [`Upcoming ${e.name}`, "gift intent", "time-bound purchase urgency", "social creative potential"],
      sellWhere: { primary: "Shopify turnkey store", geos: region === "Global" ? ["US","UK","CA"] : [region], secondaryChannels: ["TikTok Shop","Meta Ads","Google Shopping"] },
      whyNow: `${e.name} is ${e.daysAway} days away. Recommended product-testing window starts around ${e.recommendedStartDate}.`,
      scores: { demand: Math.min(92, 58 + Math.round(e.opportunityScore * 0.34)), competition: 58, gap: 70 },
      estAovUsd: 39,
      estContributionUsd: 20,
      marketing: {
        persona: `Gift shoppers and event planners for ${e.name}`,
        hook: `Get ${e.name}-ready before the best products get crowded`,
        adAngles: ["giftable problem-solver","limited seasonal window","bundle & gifting angle"],
        offer: `${e.name} bundle with fast-shipping positioning`,
        landingPromise: `Curated ${e.name} products with clear delivery expectations`,
        objections: [{q:"Will it arrive in time?",a:"Only advertise SKUs after supplier delivery windows are verified."}]
      },
      riskFlags: ["Seasonal demand — verify shipping cutoff and inventory before scaling"],
      isServiceOffer: false,
      regionTags: [region, "Global"],
      seasonalEvent: e
    }));
}

export function scoreSeasonalFit(product = {}, opportunity = {}, now = new Date()) {
  const event = opportunity.seasonalEvent;
  if (!event) return null;
  const hay = `${product.title || ""} ${product.category || ""} ${product.problemSolved || ""}`.toLowerCase();
  const themeTokens = [...event.themes, ...event.tags].flatMap((x) => String(x).toLowerCase().split(/[^a-z0-9]+/)).filter((x) => x.length > 3);
  const matches = [...new Set(themeTokens.filter((t) => hay.includes(t)))];
  const genericGift = /gift|decor|organizer|portable|kit|set|accessor|toy|light|beauty|kitchen|pet|travel/i.test(hay);
  const fit = Math.min(100, 45 + matches.length * 12 + (genericGift ? 14 : 0) + Math.round(event.opportunityScore * 0.2));
  return {
    eventId: event.id,
    eventName: event.name,
    eventDate: event.date,
    daysAway: event.daysAway,
    recommendedStartDate: event.recommendedStartDate,
    score: fit,
    matchedThemes: matches.slice(0, 6),
    note: `Seasonal fit for ${event.name}; verify inventory and delivery cutoff before ads.`
  };
}
