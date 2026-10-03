import { useEffect, useState } from "react";
import { api } from "./api.js";

export function SeasonalRadar({ region = "Global", onSearch }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api(`/api/events/upcoming?region=${encodeURIComponent(region)}&days=210`);
        if (alive) setEvents(data.events || []);
      } catch (e) {
        if (alive) setError(e.message || "Could not load seasonal radar");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [region]);

  return (
    <section className="seasonal-radar">
      <div className="section-head">
        <div>
          <div className="hero-kicker">SEASONAL OPPORTUNITY RADAR</div>
          <h2>Upcoming events worth researching now</h2>
          <p>Product Hunter opens the selling window before the event, not when demand is already late.</p>
        </div>
      </div>
      {loading ? <p className="muted">Scanning upcoming commercial events…</p> : null}
      {error ? <div className="error">{error}</div> : null}
      <div className="seasonal-grid">
        {events.slice(0, 6).map((event) => (
          <article className={`seasonal-card ${event.sellingWindowOpen ? "hot" : ""}`} key={event.id}>
            <div className="seasonal-card-top">
              <span className="event-score">{event.opportunityScore}</span>
              <span className={event.sellingWindowOpen ? "window-open" : "window-soon"}>
                {event.sellingWindowOpen ? "SELLING WINDOW OPEN" : "PLAN AHEAD"}
              </span>
            </div>
            <h3>{event.name}</h3>
            <p className="event-date">{event.date} · {event.daysAway} days away</p>
            <p className="muted">Start testing around <strong>{event.recommendedStartDate}</strong></p>
            <div className="event-themes">
              {(event.themes || []).slice(0, 4).map((theme) => <span key={theme}>{theme}</span>)}
            </div>
            <button className="btn" type="button" onClick={() => onSearch?.(event)}>
              Research {event.name}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
