'use client';
import React from 'react';
import { useDynamicContext, DynamicWidget } from '@dynamic-labs/sdk-react-core';
import {
  Connection, PublicKey, SystemProgram, Transaction, ComputeBudgetProgram
} from '@solana/web3.js';

/* --- inlined helpers --- */
function getConnection() {
  const url = process.env.NEXT_PUBLIC_RPC || 'https://api.devnet.solana.com';
  return new Connection(url, 'confirmed');
}
async function getSolBalance(pubkey: PublicKey) {
  const conn = getConnection();
  const lamports = await conn.getBalance(pubkey, 'confirmed');
  return lamports / 1e9;
}
type SolanaSigner = {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction> | Transaction;
};
async function sendSolTx(signer: SolanaSigner, to: string, lamports: number) {
  const conn = getConnection();
  const toPk = new PublicKey(to);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();

  const priorityIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }); // optional
  const transferIx = SystemProgram.transfer({ fromPubkey: signer.publicKey, toPubkey: toPk, lamports });

  const tx = new Transaction({ feePayer: signer.publicKey, blockhash, lastValidBlockHeight })
    .add(priorityIx, transferIx);

  const signed = await signer.signTransaction(tx);
  const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false });
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  return sig;
}
/* --- end helpers --- */

export default function WalletPanel() {
  const { primaryWallet } = useDynamicContext();

  // Only proceed if the primary wallet is Solana
  const isSolana =
    (primaryWallet as any)?.chain === 'SOL' ||
    typeof (primaryWallet as any)?.address === 'string'; // basic guard

  // Map Dynamic primaryWallet -> signer
  const signer: SolanaSigner | null = React.useMemo(() => {
    const w: any = primaryWallet;
    if (!w) return null;
    try {
      const addr = w.address || w.publicKey || w.publicAddress;
      const pub = new PublicKey(addr);
      const signTransaction = async (tx: Transaction) => {
        if (typeof w.signTransaction === 'function') return await w.signTransaction(tx);
        if (w.connector?.walletAdapter?.signTransaction) {
          return await w.connector.walletAdapter.signTransaction(tx);
        }
        if (typeof w.getSigner === 'function') {
          const sg = await w.getSigner();
          if (sg?.signTransaction) return await sg.signTransaction(tx);
        }
        throw new Error('No signTransaction available from Dynamic primaryWallet');
      };
      return { publicKey: pub, signTransaction };
    } catch {
      return null;
    }
  }, [primaryWallet]);

  const [balance, setBalance] = React.useState<string>('-');
  const [toAddr, setToAddr] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [txSig, setTxSig] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      if (!signer) { setBalance('-'); return; }
      const sol = await getSolBalance(signer.publicKey);
      setBalance(sol.toFixed(6));
    })();
  }, [signer]);

  const doSend = async () => {
    if (!signer) return alert('Connect a Solana wallet');
    try {
      setLoading(true);
      setTxSig(null);
      const value = parseFloat(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error('Enter a valid amount');
      const lamports = Math.round(value * 1e9);
      const sig = await sendSolTx(signer, toAddr.trim(), lamports);
      setTxSig(sig);
      const sol = await getSolBalance(signer.publicKey);
      setBalance(sol.toFixed(6));
    } catch (e: any) {
      alert(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const cluster = (process.env.NEXT_PUBLIC_RPC || '').includes('devnet') ? 'devnet' : 'mainnet';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Login / connect UI */}
      <DynamicWidget />

      {/* Only show panel if we have a Solana primary wallet */}
      {signer && isSolana && (
        <div style={{ display: 'grid', gap: 8, border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontWeight: 600 }}>Primary Solana wallet</label>
            <code style={{ fontSize: 12 }}>
              {signer.publicKey.toBase58().slice(0, 6)}…{signer.publicKey.toBase58().slice(-6)}
            </code>
          </div>

          <div>Balance: <b>{balance}</b> SOL</div>

          <div style={{ display: 'grid', gap: 8 }}>
            <input
              placeholder="Recipient (Solana address)"
              value={toAddr}
              onChange={e => setToAddr(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
            />
            <input
              placeholder="Amount in SOL (e.g. 0.01)"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
            />
            <button onClick={doSend} disabled={loading || !toAddr || !amount} style={{ padding: 12, borderRadius: 10, background: '#111', color: 'white' }}>
              {loading ? 'Sending…' : 'Send SOL'}
            </button>
          </div>

          {txSig && (
            <div style={{ fontSize: 14 }}>
              Sent! Tx:{' '}
              <a href={`https://explorer.solana.com/tx/${txSig}?cluster=${cluster}`} target="_blank" rel="noreferrer">
                {txSig.slice(0, 8)}…
              </a>
            </div>
          )}
        </div>
      )}

      {/* If primaryWallet exists but isn't Solana, show a hint */}
      {primaryWallet && !signer && (
        <div style={{ padding: 12, borderRadius: 8, background: '#fffbe6', border: '1px solid #ffe58f' }}>
          Your current primary wallet isn’t Solana. Switch to a Solana wallet in the Dynamic widget.
        </div>
      )}
    </div>
  );
}
