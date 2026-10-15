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
   * Anonymous sign-in (reusing a saved session), then games, game_stats and the player's own likes.
   * Returns { games, stats, ownLikes } with stats as Map<id, { reportsPortrait, reportsLandscape, likes }>
   * and ownLikes as Set<id>, or null on error or timeout.
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
   * Inserts and deletes the player's own report and like rows until they match PlayLog.
   * getBrokenMarks() returns [{ id, orientation }], getLikedIds() returns ids. They are read after the
   * server rows arrive, so a tap during sync is not undone. Errors are swallowed; the next start retries.
   * @created Claude (claude-opus-5-5) — 2026-10-07
   */
  async sync(getBrokenMarks, getLikedIds) {
    if (!this.#client) return;
    await Promise.all([
      this.#syncTable("reports", ["game_id", "orientation"], () =>
        getBrokenMarks().map((m) => ({ game_id: m.id, orientation: m.orientation })),
      ),
      this.#syncTable("likes", ["game_id"], () => getLikedIds().map((id) => ({ game_id: id }))),
    ]);
  }

  /** Inserts or deletes the player's report row for one orientation. Not awaited by callers. @created Claude (claude-opus-5-5) — 2026-10-07 */
  setReported(id, orientation, isReported) {
    this.#sendOne("reports", { game_id: id, orientation }, isReported);
  }

  /** Inserts or deletes the player's like row. Not awaited by callers. @created Claude (claude-opus-5-5) — 2026-10-07 */
  setLiked(id, isLiked) {
    this.#sendOne("likes", { game_id: id }, isLiked);
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-07 */
  #sendOne(table, row, isOn) {
    if (!this.#client || !this.#gameIds.has(row.game_id)) return;
    this.#send(table, row, isOn).catch((err) => console.warn(`${table} row not sent (${err.message})`));
  }

  /** Makes the player's rows in table match getWanted(); skips games the table does not list. @created Claude (claude-opus-5-5) — 2026-10-07 */
  async #syncTable(table, columns, getWanted) {
    const key = (row) => columns.map((c) => row[c]).join(" ");
    try {
      const { data, error } = await this.#client.from(table).select(columns.join(", ")).eq("player_id", this.#playerId);
      if (error) throw error;
      const wantedByKey = new Map(getWanted().filter((row) => this.#gameIds.has(row.game_id)).map((row) => [key(row), row]));
      const existing = new Set(data.map(key));
      await Promise.all([
        ...[...wantedByKey].filter(([k]) => !existing.has(k)).map(([, row]) => this.#send(table, row, true)),
        ...data.filter((row) => !wantedByKey.has(key(row))).map((row) => this.#send(table, row, false)),
      ]);
    } catch (err) {
      console.warn(`${table} sync failed (${err.message})`);
    }
  }

  /**
   * Inserts (ignoring an existing copy) or deletes one of the player's rows. Quick on/off sends are not
   * ordered; a pair arriving reversed leaves the server one step behind until the next sync().
   * @created Claude (claude-opus-5-5) — 2026-10-07
   */
  async #send(table, row, isOn) {
    const own = { ...row, player_id: this.#playerId };
    const { error } = isOn
      ? await this.#client.from(table).upsert(own, { onConflict: Object.keys(own).join(","), ignoreDuplicates: true })
      : await this.#client.from(table).delete().match(own);
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

    const [gamesRes, statsRes, likesRes] = await Promise.all([
      client.from("games").select("id, source, title, author, embed_url, page_url, cover_image, width, height, status"),
      client.from("game_stats").select("*"),
      client.from("likes").select("game_id").eq("player_id", user.id),
    ]);
    for (const res of [gamesRes, statsRes, likesRes]) if (res.error) throw res.error;

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
      ownLikes: new Set(likesRes.data.map((row) => row.game_id)),
    };
  }
}
