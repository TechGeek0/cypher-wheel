import {
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createBurnInstruction,
  getAccount,
} from '@solana/spl-token';
import { config } from '../config.js';
import { connection } from './snapshot.js';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const JUP_QUOTE = 'https://quote-api.jup.ag/v6/quote';
const JUP_SWAP = 'https://quote-api.jup.ag/v6/swap';

/** Spendable SOL in the pool wallet, in SOL (leaves a small rent/fee buffer). */
export async function getPoolBalanceSol() {
  const lamports = await connection.getBalance(config.loadPoolWallet().publicKey, 'confirmed');
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Buy TOKEN with `solAmount` SOL via Jupiter, then optionally burn the proceeds.
 * Returns a structured result describing what happened (or would happen in DRY_RUN).
 */
export async function executeBuyback(solAmount) {
  const result = {
    mode: config.buybackMode,
    solSpent: solAmount,
    dryRun: config.dryRun,
    swapSig: null,
    burnSig: null,
    tokensBought: null,
  };

  if (solAmount <= 0) {
    result.skipped = 'no SOL allocated';
    return result;
  }

  const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
  const wallet = config.loadPoolWallet();

  // 1) Quote
  const quoteUrl =
    `${JUP_QUOTE}?inputMint=${SOL_MINT}&outputMint=${config.tokenMint.toBase58()}` +
    `&amount=${lamports}&slippageBps=300`;
  const quote = await (await fetch(quoteUrl)).json();
  if (!quote || quote.error || !quote.outAmount) {
    throw new Error(`Jupiter quote failed: ${quote?.error || 'no route'}`);
  }
  result.tokensBought = Number(quote.outAmount);

  if (config.dryRun) {
    result.note = 'DRY_RUN: no swap or burn broadcast';
    return result;
  }

  // 2) Swap
  const swapResp = await (
    await fetch(JUP_SWAP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: wallet.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
      }),
    })
  ).json();

  if (!swapResp.swapTransaction) {
    throw new Error(`Jupiter swap build failed: ${swapResp?.error || 'unknown'}`);
  }

  const tx = VersionedTransaction.deserialize(
    Buffer.from(swapResp.swapTransaction, 'base64')
  );
  tx.sign([wallet]);
  result.swapSig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  await connection.confirmTransaction(result.swapSig, 'confirmed');

  // 3) Burn (optional)
  if (config.buybackMode === 'burn') {
    result.burnSig = await burnAll(wallet);
  }

  return result;
}

async function burnAll(wallet) {
  const ata = await getAssociatedTokenAddress(config.tokenMint, wallet.publicKey);
  const acc = await getAccount(connection, ata).catch(() => null);
  if (!acc || acc.amount === 0n) return null;

  const ix = createBurnInstruction(ata, config.tokenMint, wallet.publicKey, acc.amount);
  const tx = new Transaction().add(ix);
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;
  tx.sign(wallet);
  const sig = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

/** Send `solAmount` SOL from the pool wallet to the winner. */
export async function payout(winnerAddress, solAmount) {
  if (config.dryRun) {
    return { dryRun: true, sig: null, solPaid: solAmount, to: winnerAddress };
  }
  const wallet = config.loadPoolWallet();
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: new PublicKey(winnerAddress),
      lamports: Math.floor(solAmount * LAMPORTS_PER_SOL),
    })
  );
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;
  tx.sign(wallet);
  const sig = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
  await connection.confirmTransaction(sig, 'confirmed');
  return { dryRun: false, sig, solPaid: solAmount, to: winnerAddress };
}
