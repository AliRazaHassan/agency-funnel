import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

const nativeFetch = window.fetch.bind(window);
let requestSeq = 0;

function isTrackedApi(input) {
  const raw = typeof input === "string" ? input : input?.url || "";
  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin &&
      url.pathname.startsWith("/api/") &&
      !["/api/concierge"].includes(url.pathname);
  } catch {
    return false;
  }
}

window.fetch = async (...args) => {
  const [input, init = {}] = args;
  if (!isTrackedApi(input)) return nativeFetch(...args);

  const raw = typeof input === "string" ? input : input?.url || "";
  const url = new URL(raw, window.location.origin);
  const id = ++requestSeq;
  window.dispatchEvent(new CustomEvent("ph:request-progress", {
    detail: { phase: "start", id, url: url.pathname, method: init?.method || "GET" },
  }));

  try {
    const response = await nativeFetch(...args);
    window.dispatchEvent(new CustomEvent("ph:request-progress", {
      detail: { phase: "end", id, url: url.pathname, ok: response.ok, status: response.status },
    }));
    return response;
  } catch (error) {
    window.dispatchEvent(new CustomEvent("ph:request-progress", {
      detail: { phase: "end", id, url: url.pathname, ok: false, networkError: true },
    }));
    throw error;
  }
};

createRoot(document.getElementById("root")).render(<App />);
