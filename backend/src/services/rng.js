import crypto from 'crypto';
import { connection } from './snapshot.js';

/**
 * Commit-reveal fairness:
 *  1. commit()  -> generate a secret serverSeed, publish sha256(serverSeed).
 *                  This happens BEFORE the entropy blockhash exists.
 *  2. resolve() -> capture a fresh Solana blockhash (public, unpredictable
 *                  at commit time), derive the winning ticket, reveal the seed.
 *
 * Verify off-chain:
 *   sha256(serverSeed) === commitment
 *   ticket = HMAC_SHA256(serverSeed, blockhash) mod totalTickets
 * Neither side can grind the result: the server can't choose the blockhash,
 * the public can't know the seed.
 */

export function commit() {
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const commitment = crypto.createHash('sha256').update(serverSeed).digest('hex');
  return { serverSeed, commitment };
}

export async function getEntropyBlockhash() {
  const { blockhash } = await connection.getLatestBlockhash('finalized');
  return blockhash;
}

export function deriveTicket(serverSeed, blockhash, totalTickets) {
  if (totalTickets <= 0) return 0;
  const hmac = crypto.createHmac('sha256', serverSeed).update(blockhash).digest();
  // Use the full 32 bytes as a big integer, mod totalTickets.
  const big = BigInt('0x' + hmac.toString('hex'));
  return Number(big % BigInt(totalTickets));
}

export function verify({ serverSeed, commitment, blockhash, totalTickets, winningTicket }) {
  const recomputedCommit = crypto.createHash('sha256').update(serverSeed).digest('hex');
  const recomputedTicket = deriveTicket(serverSeed, blockhash, totalTickets);
  return recomputedCommit === commitment && recomputedTicket === winningTicket;
}
