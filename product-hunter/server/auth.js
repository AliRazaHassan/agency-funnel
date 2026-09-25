import crypto from "node:crypto";

function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function sign(exp, secret) {
  return crypto.createHmac("sha256", secret).update(String(exp)).digest("hex");
}

function makeToken(secret, ttlMs = 1000 * 60 * 60 * 24 * 7) {
  const exp = Date.now() + ttlMs;
  return `${exp}.${sign(exp, secret)}`;
}

function verifyToken(token, secret) {
  if (!token || !secret) return false;
  const [expStr, sig] = String(token).split(".");
  const exp = Number(expStr);
  if (!exp || !sig) return false;
  if (Date.now() > exp) return false;
  const expected = sign(exp, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function createAuth({ password, secret }) {
  const enabled = Boolean(password);
  const sessionSecret = secret || password || "dev-insecure-secret";

  function readSession(req) {
    const cookies = parseCookies(req.headers.cookie || "");
    return verifyToken(cookies.ph_session, sessionSecret);
  }

  function setSessionCookie(res) {
    const token = makeToken(sessionSecret);
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader(
      "Set-Cookie",
      `ph_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${secure}`
    );
  }

  function clearSessionCookie(res) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader(
      "Set-Cookie",
      `ph_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
    );
  }

  function middleware(req, res, next) {
    if (!enabled) return next();
    if (req.path === "/api/health" || req.path === "/api/auth/status" || req.path === "/api/auth/login") {
      return next();
    }
    if (req.path.startsWith("/api/") && !readSession(req)) {
      return res.status(401).json({ error: "Unauthorized", needLogin: true });
    }
    return next();
  }

  return {
    enabled,
    readSession,
    setSessionCookie,
    clearSessionCookie,
    middleware,
    login(passwordAttempt) {
      if (!enabled) return true;
      const a = Buffer.from(String(passwordAttempt || ""));
      const b = Buffer.from(String(password));
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    },
  };
}
