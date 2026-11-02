interface Env {
  DB: D1Database;
  TRAKT_CLIENT_ID: string;
  TRAKT_REDIRECT_URI: string;
  APP_ORIGIN: string;
  INITIAL_SYNC_PAGES?: string;
}
const TRAKT = "https://api.trakt.tv";
const enc = new TextEncoder();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders() });
}
function corsHeaders() {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}
function b64url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function randomToken(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}
async function sha256(value: string) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))));
}
async function traktFetch(path: string, env: Env, token?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("trakt-api-version", "2");
  headers.set("trakt-api-key", env.TRAKT_CLIENT_ID);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${TRAKT}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Trakt ${res.status}: ${body.slice(0, 500)}`);
  }
  return res;
}
async function getToken(env: Env) {
  const row = await env.DB.prepare("SELECT * FROM oauth_tokens WHERE id=1").first<any>();
  if (!row) throw new Error("Trakt account is not connected");
  if (Number(row.expires_at) > Math.floor(Date.now() / 1000) + 300) return row.access_token;
  const res = await fetch(`${TRAKT}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      refresh_token: row.refresh_token,
      client_id: env.TRAKT_CLIENT_ID,
      redirect_uri: env.TRAKT_REDIRECT_URI,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  const token = await res.json<any>();
  await env.DB.prepare(`UPDATE oauth_tokens SET access_token=?, refresh_token=?, expires_at=?, token_type=?, scope=?, updated_at=CURRENT_TIMESTAMP WHERE id=1`)
    .bind(token.access_token, token.refresh_token, Math.floor(Date.now()/1000) + token.expires_in, token.token_type ?? "bearer", token.scope ?? null).run();
  return token.access_token as string;
}
async function syncHistory(env: Env) {
  const token = await getToken(env);
  const configuredPages = Math.max(1, Math.min(100, Number(env.INITIAL_SYNC_PAGES ?? "5")));
  let inserted = 0;
  let pagesRead = 0;
  for (let page = 1; page <= configuredPages; page++) {
    const res = await traktFetch(`/sync/history?limit=100&page=${page}&extended=full`, env, token);
    const rows = await res.json<any[]>();
    pagesRead++;
    if (!rows.length) break;
    for (const item of rows) {
      const movie = item.movie;
      const show = item.show;
      const episode = item.episode;
      const mediaType = movie ? "movie" : "episode";
      const media = movie ?? episode;
      const title = movie?.title ?? episode?.title ?? "Unknown";
      const traktId = Number(media?.ids?.trakt);
      const showId = show?.ids?.trakt ? Number(show.ids.trakt) : null;
      if (!Number.isFinite(Number(item.id)) || !Number.isFinite(traktId)) continue;
      const runtime = movie?.runtime ?? episode?.runtime ?? null;
      const displayTitle = movie ? title : `${show?.title ?? "Unknown show"} — ${title}`;
      await env.DB.prepare(`
        INSERT INTO watch_events
        (event_id, media_type, trakt_id, show_trakt_id, title, show_title, year, season, episode, watched_at, runtime_minutes, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(event_id) DO UPDATE SET
          watched_at=excluded.watched_at, runtime_minutes=excluded.runtime_minutes,
          raw_json=excluded.raw_json, synced_at=CURRENT_TIMESTAMP
      `).bind(
        Number(item.id), mediaType, traktId, showId, displayTitle,
        show?.title ?? null, movie?.year ?? show?.year ?? null,
        episode?.season ?? null, episode?.number ?? null,
        item.watched_at, runtime, JSON.stringify(item)
      ).run();
      if (movie) {
        await env.DB.prepare(`
          INSERT INTO titles (trakt_id, media_type, title, year, runtime_minutes, genres_json, people_json)
          VALUES (?, 'movie', ?, ?, ?, ?, ?)
          ON CONFLICT(trakt_id, media_type) DO UPDATE SET title=excluded.title, year=excluded.year,
          runtime_minutes=COALESCE(excluded.runtime_minutes, titles.runtime_minutes),
          genres_json=excluded.genres_json, people_json=excluded.people_json, updated_at=CURRENT_TIMESTAMP
        `).bind(traktId, movie.title, movie.year ?? null, runtime, JSON.stringify(movie.genres ?? []),
          JSON.stringify(movie.people ?? [])).run();
      } else if (show) {
        await env.DB.prepare(`
          INSERT INTO titles (trakt_id, media_type, title, year, runtime_minutes, genres_json, people_json)
          VALUES (?, 'show', ?, ?, ?, ?, ?)
          ON CONFLICT(trakt_id, media_type) DO UPDATE SET title=excluded.title, year=excluded.year,
          runtime_minutes=COALESCE(excluded.runtime_minutes, titles.runtime_minutes),
          genres_json=excluded.genres_json, people_json=excluded.people_json, updated_at=CURRENT_TIMESTAMP
        `).bind(showId, show.title, show.year ?? null, null, JSON.stringify(show.genres ?? []),
          JSON.stringify(show.people ?? [])).run();
      }
      inserted++;
    }
    if (rows.length < 100) break;
  }
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE sync_state SET last_sync_at=?, last_error=NULL WHERE id=1").bind(now).run();
  return { inserted, pagesRead, syncedAt: now };
}
async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  if (url.pathname === "/api/health") return json({ ok: true, service: "my-watch-report-api" });

  if (url.pathname === "/api/auth/start") {
    const state = randomToken();
    const verifier = randomToken(48);
    const challenge = await sha256(verifier);
    await env.DB.prepare("INSERT INTO oauth_states (state, code_verifier, created_at) VALUES (?, ?, ?)")
      .bind(state, verifier, Math.floor(Date.now()/1000)).run();
    const authorize = new URL("https://trakt.tv/oauth/authorize");
    authorize.search = new URLSearchParams({
      response_type: "code", client_id: env.TRAKT_CLIENT_ID,
      redirect_uri: env.TRAKT_REDIRECT_URI, state,
      code_challenge: challenge, code_challenge_method: "S256",
    }).toString();
    return Response.redirect(authorize.toString(), 302);
  }

  if (url.pathname === "/api/auth/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return new Response("Missing OAuth code/state", { status: 400 });
    const saved = await env.DB.prepare("SELECT code_verifier FROM oauth_states WHERE state=?").bind(state).first<any>();
    if (!saved) return new Response("Invalid or expired OAuth state", { status: 400 });
    await env.DB.prepare("DELETE FROM oauth_states WHERE state=?").bind(state).run();
    const res = await fetch(`${TRAKT}/oauth/token`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code, client_id: env.TRAKT_CLIENT_ID, redirect_uri: env.TRAKT_REDIRECT_URI,
        grant_type: "authorization_code", code_verifier: saved.code_verifier,
      }),
    });
    if (!res.ok) return new Response(`Trakt token exchange failed: ${await res.text()}`, { status: 502 });
    const token = await res.json<any>();
    await env.DB.prepare(`
      INSERT INTO oauth_tokens (id, access_token, refresh_token, expires_at, token_type, scope)
      VALUES (1, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET access_token=excluded.access_token, refresh_token=excluded.refresh_token,
      expires_at=excluded.expires_at, token_type=excluded.token_type, scope=excluded.scope, updated_at=CURRENT_TIMESTAMP
    `).bind(token.access_token, token.refresh_token, Math.floor(Date.now()/1000)+token.expires_in,
      token.token_type ?? "bearer", token.scope ?? null).run();
    return Response.redirect(`${env.APP_ORIGIN}/?connected=1`, 302);
  }

  if (url.pathname === "/api/status") {
    const token = await env.DB.prepare("SELECT expires_at FROM oauth_tokens WHERE id=1").first<any>();
    const state = await env.DB.prepare("SELECT last_sync_at, last_error FROM sync_state WHERE id=1").first<any>();
    return json({ connected: !!token, tokenExpiresAt: token?.expires_at ?? null, ...state });
  }

  if (url.pathname === "/api/sync" && request.method === "POST") {
    try { return json(await syncHistory(env)); }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await env.DB.prepare("UPDATE sync_state SET last_error=? WHERE id=1").bind(message).run();
      return json({ error: message }, 500);
    }
  }

  if (url.pathname === "/api/summary") {
    const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());
    const start = `${year}-01-01T00:00:00.000Z`;
    const end = `${year+1}-01-01T00:00:00.000Z`;
    const totals = await env.DB.prepare(`
      SELECT COUNT(*) AS plays,
      COUNT(DISTINCT CASE WHEN media_type='movie' THEN trakt_id END) AS movies,
      COUNT(DISTINCT CASE WHEN media_type='episode' THEN show_trakt_id END) AS shows,
      COALESCE(SUM(runtime_minutes),0) AS minutes,
      COUNT(*) - COUNT(DISTINCT media_type || ':' || trakt_id) AS rewatches
      FROM watch_events WHERE watched_at >= ? AND watched_at < ?
    `).bind(start, end).first();
    const monthly = await env.DB.prepare(`
      SELECT strftime('%m', watched_at) AS month, COUNT(*) AS plays,
      COALESCE(SUM(runtime_minutes),0) AS minutes
      FROM watch_events WHERE watched_at >= ? AND watched_at < ?
      GROUP BY month ORDER BY month
    `).bind(start, end).all();
    const genres = await env.DB.prepare(`
      SELECT value AS genre, COUNT(*) AS count FROM watch_events w
      JOIN titles t ON t.trakt_id=CASE WHEN w.media_type='movie' THEN w.trakt_id ELSE w.show_trakt_id END
        AND t.media_type=CASE WHEN w.media_type='movie' THEN 'movie' ELSE 'show' END,
      json_each(t.genres_json) GROUP BY value ORDER BY count DESC LIMIT 12
    `).all();
    const recent = await env.DB.prepare("SELECT * FROM watch_events ORDER BY watched_at DESC LIMIT 8").all();
    return json({ year, totals, monthly: monthly.results, genres: genres.results, recent: recent.results });
  }

  if (url.pathname === "/api/history") {
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 50)));
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
    const rows = await env.DB.prepare("SELECT * FROM watch_events ORDER BY watched_at DESC LIMIT ? OFFSET ?").bind(limit, offset).all();
    return json(rows.results);
  }
  return json({ error: "Not found" }, 404);
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try { return await route(request, env); }
    catch (e) { return json({ error: e instanceof Error ? e.message : String(e) }, 500); }
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(syncHistory(env).catch(async (e) => {
      const message = e instanceof Error ? e.message : String(e);
      await env.DB.prepare("UPDATE sync_state SET last_error=? WHERE id=1").bind(message).run();
    }));
  },
};
