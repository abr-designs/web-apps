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
  #client = null; // null when url is empty or connect() failed
  #playerId = null;

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
