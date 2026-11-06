/**
 * Which messages have only just arrived.
 *
 * An emoji in a message plays once when its message is new — sent from here, or
 * arrived over the socket — and then never again. So "new" has to be a fact
 * about the message rather than about where it happens to be on screen: a rule
 * that played whenever a row came into view would set a whole thread moving
 * every time somebody scrolled it.
 *
 * **A message arrives once.** A row on screen is drawn twice — once as the
 * optimistic bubble under its `client_id`, once as the server's copy under its
 * own id, and the two are the same message. Both names are kept and the first
 * moment wins, so the second arrival is not a second celebration.
 *
 * **And it stops being new after a few seconds.** That is what bounds the
 * memory: a busy thread would otherwise hold every id it had ever seen for the
 * life of the tab.
 */

/** How long a message counts as new, in milliseconds. */
export const ARRIVAL_MS = 3000;

/** The most names remembered before the oldest are dropped. */
const LIMIT = 400;

/** Anything with the two names a message can be known by. */
export interface Named {
  id: string;
  client_id?: string | null;
}

export class Arrivals {
  private readonly at = new Map<string, number>();

  constructor(private readonly life = ARRIVAL_MS) {}

  /**
   * Record that this message has just arrived.
   *
   * The first moment is the one kept: the same message reaches a client twice
   * and only the first of those is an arrival.
   */
  mark(message: Named, now = Date.now()): void {
    for (const name of names(message)) {
      if (!this.at.has(name)) this.at.set(name, now);
    }
    if (this.at.size > LIMIT) this.sweep(now);
  }

  /** When this message arrived, or undefined if it is not new any more. */
  of(message: Named, now = Date.now()): number | undefined {
    for (const name of names(message)) {
      const at = this.at.get(name);
      if (at === undefined) continue;
      return now - at <= this.life ? at : undefined;
    }
    return undefined;
  }

  private sweep(now: number): void {
    for (const [name, at] of this.at) {
      if (now - at > this.life) this.at.delete(name);
    }
    // A hundred messages landing inside one window would leave the map at its
    // limit with nothing old in it to drop. Emptying it is the cheap answer and
    // the worst it costs is one thread's worth of emoji not celebrating.
    if (this.at.size > LIMIT) this.at.clear();
  }
}

function names(message: Named): string[] {
  return [message.id, message.client_id].filter((one): one is string => Boolean(one));
}
