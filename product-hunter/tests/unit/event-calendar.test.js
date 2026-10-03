import test from "node:test";
import assert from "node:assert/strict";
import { getUpcomingCommerceEvents, resolveEventFocus, eventFitForProduct } from "../../server/eventCalendar.js";

test("event calendar surfaces Christmas and Black Friday before Q4 peak", () => {
  const now = new Date("2026-10-03T00:00:00Z");
  const events = getUpcomingCommerceEvents({ regionFocus:"US", now, horizonDays:120 });
  const ids = events.map((e)=>e.id);
  assert.ok(ids.includes("halloween"));
  assert.ok(ids.includes("black-friday"));
  assert.ok(ids.includes("christmas"));
  const christmas = events.find((e)=>e.id==="christmas");
  assert.equal(christmas.daysUntil,83);
  assert.ok(["PREP","HOT"].includes(christmas.phase));
});

test("auto event focus selects a commerce event inside its prep window", () => {
  const now = new Date("2026-10-03T00:00:00Z");
  const active = resolveEventFocus("auto", { regionFocus:"US", now });
  assert.ok(active);
  assert.ok(active.daysUntil <= active.leadDays);
});

test("event fit rewards relevant Christmas products", () => {
  const now = new Date("2026-10-03T00:00:00Z");
  const christmas = resolveEventFocus("christmas", { regionFocus:"US", now });
  const fit = eventFitForProduct({
    title:"Christmas Gift Storage Organizer",
    category:"Gifts",
    problemSolved:"Holiday gift organization",
    hook:"A useful Christmas gift",
  }, christmas);
  assert.equal(fit.eventName,"Christmas");
  assert.ok(fit.score >= 70);
});
