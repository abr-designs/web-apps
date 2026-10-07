// Created by Claude (claude-opus-5-5)
// Date: 2026-10-07

const SUPABASE_JS_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/**
 * The only code that talks to Supabase. Signs in anonymously and loads the shared game list and
 * counts. Every failure leaves the store disconnected, so the app keeps running on games.json.
 * The client keeps its session in localStorage under its own sb-... key.
 * @created Claude (claude-opus-5-5) — 2026-10-07
 */
export class SharedStore {
  #url;
  #anonKey;
  #timeoutMs;
  #client = null; // null when url is empty or connect() failed; every send is then a no-op
  #playerId = null;
  #gameIds = new Set(); // rows can only reference games the table has

  /** Empty url turns the store off and the app runs on games.json alone. @created Claude (claude-opus-5-5) — 2026-10-07 */
  constructor(url, anonKey, timeoutMs) {
    this.#url = url;
    this.#anonKey = anonKey;
    this.#timeoutMs = timeoutMs;
  }

  /**
   * Anonymous sign-in (reusing a saved session), then games and game_stats.
   * Returns { games, stats } with stats as Map<id, { reportsPortrait, reportsLandscape, likes }>,
   * or null on error or timeout.
   * @created Claude (claude-opus-5-5) — 2026-10-07
   */
  async connect() {
    if (!this.#url) return null;
    let timer = 0;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out after ${this.#timeoutMs} ms`)), this.#timeoutMs);
    });
    try {
      return await Promise.race([this.#load(), timeout]);
    } catch (err) {
      console.warn(`Shared data unavailable (${err.message}), using games.json`);
      this.#client = null;
      this.#playerId = null;
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Inserts and deletes the player's own report rows until they match brokenMarks ([{ id, orientation }]).
   * Errors are swallowed; the next start retries.
   * @created Claude (claude-opus-5-5) — 2026-10-07
   */
  async sync(brokenMarks) {
    if (!this.#client) return;
    try {
      const { data, error } = await this.#client.from("reports").select("game_id, orientation").eq("player_id", this.#playerId);
      if (error) throw error;
      const key = (id, orientation) => `${orientation} ${id}`;
      const wanted = new Map(brokenMarks.filter((m) => this.#gameIds.has(m.id)).map((m) => [key(m.id, m.orientation), m]));
      const existing = new Set(data.map((row) => key(row.game_id, row.orientation)));
      const sends = [
        ...[...wanted].filter(([k]) => !existing.has(k)).map(([, m]) => this.#sendReport(m.id, m.orientation, true)),
        ...data.filter((row) => !wanted.has(key(row.game_id, row.orientation)))
          .map((row) => this.#sendReport(row.game_id, row.orientation, false)),
      ];
      await Promise.all(sends);
    } catch (err) {
      console.warn(`Report sync failed (${err.message})`);
    }
  }

  /** Inserts or deletes the player's report row for one orientation. Not awaited by callers. @created Claude (claude-opus-5-5) — 2026-10-07 */
  setReported(id, orientation, isReported) {
    if (!this.#client || !this.#gameIds.has(id)) return;
    this.#sendReport(id, orientation, isReported).catch((err) => console.warn(`Report not sent (${err.message})`));
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-07 */
  async #sendReport(id, orientation, isReported) {
    const reports = this.#client.from("reports");
    const { error } = isReported
      ? await reports.upsert(
          { game_id: id, player_id: this.#playerId, orientation },
          { onConflict: "game_id,player_id,orientation", ignoreDuplicates: true },
        )
      : await reports.delete().match({ game_id: id, player_id: this.#playerId, orientation });
    if (error) throw error;
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-07 */
  get isConnected() {
    return this.#playerId !== null;
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-07 */
  async #load() {
    const { createClient } = await import(SUPABASE_JS_URL);
    const client = createClient(this.#url, this.#anonKey);
    const { data: sessionData } = await client.auth.getSession();
    let user = sessionData.session?.user;
    if (!user) {
      const { data, error } = await client.auth.signInAnonymously();
      if (error) throw error;
      user = data.user;
    }

    const [gamesRes, statsRes] = await Promise.all([
      client.from("games").select("id, source, title, author, embed_url, page_url, cover_image, width, height, status"),
      client.from("game_stats").select("*"),
    ]);
    if (gamesRes.error) throw gamesRes.error;
    if (statsRes.error) throw statsRes.error;

    this.#client = client;
    this.#playerId = user.id;
    this.#gameIds = new Set(gamesRes.data.map((row) => row.id));
    return {
      games: gamesRes.data.map((row) => ({
        id: row.id,
        source: row.source,
        title: row.title,
        author: row.author,
        embedUrl: row.embed_url,
        pageUrl: row.page_url,
        coverImage: row.cover_image,
        width: row.width,
        height: row.height,
        status: row.status,
      })),
      stats: new Map(
        statsRes.data.map((row) => [
          row.game_id,
          { reportsPortrait: row.reports_portrait, reportsLandscape: row.reports_landscape, likes: row.likes },
        ]),
      ),
    };
  }
}
