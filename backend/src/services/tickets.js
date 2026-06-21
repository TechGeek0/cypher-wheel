import { config } from '../config.js';

// Tiered ladder: [minBalance, tickets]. Tune to taste.
const TIERS = [
  [1_000_000, 50],
  [100_000, 15],
  [10_000, 5],
  [1_000, 1],
];

function ticketsFor(balance, mode) {
  switch (mode) {
    case 'linear':
      return balance;
    case 'tiered': {
      for (const [min, t] of TIERS) if (balance >= min) return t;
      return 0;
    }
    case 'sqrt':
    default:
      return Math.sqrt(balance);
  }
}

/**
 * Turns holders into weighted entries with cumulative ranges for selection.
 * Returns { totalTickets, entries: [{ owner, balance, tickets, start, end, odds }] }
 * where a winning number n in [0, totalTickets) lands in exactly one [start, end).
 */
export function buildTickets(holders) {
  const mode = config.weighting;
  let cursor = 0;
  const entries = [];

  for (const h of holders) {
    const tickets = ticketsFor(h.balance, mode);
    if (tickets <= 0) continue;
    entries.push({
      owner: h.owner,
      balance: h.balance,
      tickets,
      start: cursor,
      end: cursor + tickets,
    });
    cursor += tickets;
  }

  const totalTickets = cursor;
  for (const e of entries) {
    e.odds = totalTickets > 0 ? e.tickets / totalTickets : 0;
  }

  return { totalTickets, entries, mode };
}

/** Find the entry whose [start, end) contains `ticket`. */
export function entryForTicket(entries, ticket) {
  // entries are sorted by start; linear scan is fine for typical holder counts.
  for (const e of entries) {
    if (ticket >= e.start && ticket < e.end) return e;
  }
  return entries[entries.length - 1] || null;
}
