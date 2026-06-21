import { config } from '../config.js';
import { takeSnapshot } from './snapshot.js';
import { buildTickets, entryForTicket } from './tickets.js';
import { commit, getEntropyBlockhash, deriveTicket } from './rng.js';
import { getPoolBalanceSol, executeBuyback, payout } from './buyback.js';
import { saveRound } from '../store.js';

let running = false;

/**
 * Full round:
 *  commit seed -> snapshot holders -> build tickets -> capture blockhash ->
 *  derive winner -> buyback+burn a cut -> pay the winner the rest -> persist.
 */
export async function runRound() {
  if (running) return { error: 'round already in progress' };
  running = true;
  const startedAt = Date.now();

  try {
    // 1. Commit (before entropy exists)
    const { serverSeed, commitment } = commit();

    // 2. Snapshot + tickets
    const snap = await takeSnapshot();
    const { totalTickets, entries, mode } = buildTickets(snap.holders);

    if (totalTickets === 0) {
      const round = {
        id: startedAt,
        startedAt,
        status: 'no_eligible_holders',
        commitment,
        serverSeed,
        eligibleHolders: snap.eligibleHolders,
      };
      saveRound(round);
      return round;
    }

    // 3. Pool + buyback cut
    const poolSol = await getPoolBalanceSol();
    const reserve = 0.01; // keep for fees/rent
    const distributable = Math.max(0, poolSol - reserve);
    const buybackSol = +(distributable * (config.buybackPercent / 100)).toFixed(6);
    const prizeSol = +(distributable - buybackSol).toFixed(6);

    // 4. Entropy + winner
    const blockhash = await getEntropyBlockhash();
    const winningTicket = deriveTicket(serverSeed, blockhash, totalTickets);
    const winnerEntry = entryForTicket(entries, winningTicket);

    // 5. Buyback + burn
    let buyback = null;
    try {
      buyback = await executeBuyback(buybackSol);
    } catch (e) {
      buyback = { error: e.message, solSpent: buybackSol };
    }

    // 6. Payout
    let payoutResult = null;
    try {
      payoutResult = await payout(winnerEntry.owner, prizeSol);
    } catch (e) {
      payoutResult = { error: e.message, solPaid: prizeSol, to: winnerEntry.owner };
    }

    const round = {
      id: startedAt,
      startedAt,
      finishedAt: Date.now(),
      status: 'complete',
      dryRun: config.dryRun,
      weighting: mode,
      // fairness proof
      commitment,
      serverSeed,
      blockhash,
      totalTickets,
      winningTicket,
      // result
      winner: winnerEntry.owner,
      winnerBalance: winnerEntry.balance,
      winnerOdds: winnerEntry.odds,
      // economics
      poolSol,
      buybackSol,
      prizeSol,
      buyback,
      payout: payoutResult,
      // context
      eligibleHolders: snap.eligibleHolders,
      totalHolders: snap.totalHolders,
      // top entries for the leaderboard (trim to keep file small)
      topEntries: entries
        .slice()
        .sort((a, b) => b.tickets - a.tickets)
        .slice(0, 25)
        .map((e) => ({ owner: e.owner, balance: e.balance, tickets: e.tickets, odds: e.odds })),
    };

    saveRound(round);
    return round;
  } finally {
    running = false;
  }
}

export function isRunning() {
  return running;
}
