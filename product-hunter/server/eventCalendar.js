const DAY = 86400000;

function nthWeekday(year, monthIndex, weekday, nth) {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const delta = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, monthIndex, 1 + delta + (nth - 1) * 7));
}

function lastWeekday(year, monthIndex, weekday) {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  const delta = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, monthIndex, last.getUTCDate() - delta));
}

const FIXED_EVENTS = [
  { id:"halloween", name:"Halloween", emoji:"🎃", month:9, day:31, leadDays:60, regions:["Global","US","UK","CA","AU","DE","FR"], categories:["costumes","decor","party","pets","beauty","home"], keywords:["halloween","spooky","pumpkin","costume","party","decor","gift"] },
  { id:"christmas", name:"Christmas", emoji:"🎄", month:11, day:25, leadDays:90, regions:["Global","US","UK","CA","AU","DE","FR","Gulf"], categories:["gifts","decor","toys","pets","home","beauty","fashion"], keywords:["christmas","holiday","gift","stocking","festive","decor","winter"] },
  { id:"new-year", name:"New Year", emoji:"✨", month:0, day:1, leadDays:45, regions:["Global","US","UK","CA","AU","DE","FR","Gulf"], categories:["fitness","organization","beauty","wellness","party"], keywords:["new year","resolution","fitness","planner","party","wellness"] },
  { id:"valentines", name:"Valentine's Day", emoji:"❤️", month:1, day:14, leadDays:60, regions:["Global","US","UK","CA","AU","DE","FR","Gulf"], categories:["gifts","jewelry","beauty","home","couples","pets"], keywords:["valentine","love","couple","gift","romantic","heart"] },
  { id:"back-to-school", name:"Back to School", emoji:"🎒", month:7, day:15, leadDays:75, regions:["Global","US","UK","CA","AU","DE","FR"], categories:["school","organization","electronics","bags","stationery","kids"], keywords:["school","student","study","desk","backpack","organizer"] },
];

function dynamicEvents(year) {
  const thanksgiving = nthWeekday(year, 10, 4, 4);
  const blackFriday = new Date(thanksgiving.getTime() + DAY);
  const cyberMonday = new Date(thanksgiving.getTime() + 4 * DAY);
  const mothersDay = nthWeekday(year, 4, 0, 2);
  const fathersDay = nthWeekday(year, 5, 0, 3);
  const laborDay = nthWeekday(year, 8, 1, 1);
  return [
    { id:"black-friday", name:"Black Friday", emoji:"🛍️", date:blackFriday, leadDays:75, regions:["Global","US","UK","CA","AU","DE","FR"], categories:["electronics","home","beauty","fashion","gifts","fitness"], keywords:["black friday","deal","discount","gift","viral","bundle"] },
    { id:"cyber-monday", name:"Cyber Monday", emoji:"💻", date:cyberMonday, leadDays:70, regions:["Global","US","UK","CA","AU","DE","FR"], categories:["electronics","gadgets","home","beauty","fashion"], keywords:["cyber monday","deal","online","gadget","gift","bundle"] },
    { id:"mothers-day", name:"Mother's Day", emoji:"💐", date:mothersDay, leadDays:60, regions:["US","CA","Global"], categories:["gifts","beauty","home","jewelry","wellness"], keywords:["mother","mom","gift","beauty","self care","home"] },
    { id:"fathers-day", name:"Father's Day", emoji:"🎁", date:fathersDay, leadDays:60, regions:["US","UK","CA","Global"], categories:["gifts","tools","fitness","outdoors","gadgets"], keywords:["father","dad","gift","tool","outdoor","gadget"] },
    { id:"labor-day", name:"Labor Day", emoji:"🏷️", date:laborDay, leadDays:35, regions:["US"], categories:["home","outdoors","fashion","fitness"], keywords:["labor day","sale","outdoor","home","deal"] },
  ];
}

function normalizeRegion(region) {
  const v = String(region || "Global").trim();
  return v || "Global";
}

function fixedDateForYear(event, year) {
  return new Date(Date.UTC(year, event.month, event.day));
}

function nextEventDate(event, now) {
  const year = now.getUTCFullYear();
  if (event.date) return event.date;
  let date = fixedDateForYear(event, year);
  if (date.getTime() < now.getTime() - DAY) date = fixedDateForYear(event, year + 1);
  return date;
}

function phase(daysUntil, leadDays) {
  if (daysUntil < 0) return "LIVE";
  if (daysUntil <= 14) return "NOW";
  if (daysUntil <= 45) return "HOT";
  if (daysUntil <= leadDays) return "PREP";
  return "EARLY";
}

export function getUpcomingCommerceEvents({ regionFocus = "Global", now = new Date(), horizonDays = 240 } = {}) {
  const region = normalizeRegion(regionFocus);
  const years = [now.getUTCFullYear(), now.getUTCFullYear() + 1];
  const all = [
    ...FIXED_EVENTS,
    ...years.flatMap((year) => dynamicEvents(year)),
  ];

  const dedup = new Map();
  for (const event of all) {
    const date = nextEventDate(event, now);
    const key = event.id;
    const current = dedup.get(key);
    if (!current || date < current.date) dedup.set(key, { ...event, date });
  }

  return [...dedup.values()]
    .map((event) => {
      const daysUntil = Math.ceil((event.date.getTime() - now.getTime()) / DAY);
      const regionMatch = event.regions.includes("Global") || region === "Global" || event.regions.includes(region);
      const opportunityWindow = Math.max(0, event.leadDays - Math.max(0, daysUntil));
      return {
        id: event.id,
        name: event.name,
        emoji: event.emoji,
        date: event.date.toISOString(),
        daysUntil,
        leadDays: event.leadDays,
        phase: phase(daysUntil, event.leadDays),
        regionMatch,
        categories: event.categories,
        keywords: event.keywords,
        searchHint: `${event.name} products, gifts, ${event.categories.slice(0,4).join(", ")}`,
        opportunityScore: Math.max(0, Math.min(100,
          Math.round((regionMatch ? 20 : 5) + (daysUntil <= event.leadDays ? 60 : 25) + Math.min(20, opportunityWindow / 3))
        )),
      };
    })
    .filter((event) => event.daysUntil >= -2 && event.daysUntil <= horizonDays)
    .sort((a,b) => a.daysUntil - b.daysUntil);
}

export function resolveEventFocus(eventFocus, { regionFocus = "Global", now = new Date() } = {}) {
  const events = getUpcomingCommerceEvents({ regionFocus, now });
  if (!events.length) return null;
  if (!eventFocus || eventFocus === "auto") {
    return events.find((e) => e.regionMatch && e.daysUntil <= e.leadDays) || events.find((e)=>e.regionMatch) || events[0];
  }
  return events.find((e) => e.id === eventFocus) || null;
}

export function buildEventResearchContext(event) {
  if (!event) return "";
  return [
    `Seasonal/event focus: ${event.name}`,
    `Event date: ${event.date.slice(0,10)} (${event.daysUntil} days away)`,
    `Phase: ${event.phase}`,
    `Prioritize products that can be sourced, advertised and delivered before the event.`,
    `Relevant categories: ${event.categories.join(", ")}`,
    `Keywords/angles: ${event.keywords.join(", ")}`,
    `Do not force every product to be seasonal; include evergreen products with a credible event angle.`,
  ].join("\n");
}

export function eventFitForProduct(product = {}, event = null) {
  if (!event) return null;
  const hay = [
    product.title,
    product.category,
    product.problemSolved,
    product.hook,
    ...(product.pdpBullets || []),
  ].filter(Boolean).join(" ").toLowerCase();
  const hits = event.keywords.filter((k) => hay.includes(String(k).toLowerCase()));
  const categoryHits = event.categories.filter((k) => hay.includes(String(k).toLowerCase()));
  const relevance = Math.min(100, 35 + hits.length * 16 + categoryHits.length * 12 + (event.phase === "HOT" || event.phase === "NOW" ? 12 : 0));
  return {
    eventId: event.id,
    eventName: event.name,
    eventDate: event.date,
    daysUntil: event.daysUntil,
    phase: event.phase,
    score: Math.round(relevance),
    reason: hits.length || categoryHits.length
      ? `Matches ${[...hits, ...categoryHits].slice(0,4).join(", ")} for ${event.name}`
      : `Evergreen candidate evaluated for ${event.name} timing`,
  };
}
