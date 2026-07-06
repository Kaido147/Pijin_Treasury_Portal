'use client';

import { useState } from 'react';
import { Send, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import type { TransferFormState } from '@/core/types';
import { QUICK_FILL_ADDRESSES, QUICK_AMOUNTS } from '@/core/constants';
import { validateStellarAddress, cn } from '@/core/utils';

interface TransferFormProps {
  formState: TransferFormState;
  txHash: string;
  onSubmit: (data: {
    address: string;
    amount: string;
    memo: string;
  }) => void;
  onReset: () => void;
  prefilledAddress?: string;
}

export function TransferForm({
  formState,
  txHash,
  onSubmit,
  onReset,
  prefilledAddress
}: TransferFormProps) {
  const [address, setAddress] = useState(prefilledAddress ?? '');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [addressError, setAddressError] = useState('');

  const isSubmitting = formState === 'submitting';
  const isDisabled = !address || !amount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateStellarAddress(address);
    if (err) {
      setAddressError(err);
      return;
    }
    if (!amount || parseFloat(amount) <= 0) return;
    onSubmit({ address, amount, memo });
  };

  const handleReset = () => {
    setAddress('');
    setAmount('');
    setMemo('');
    setAddressError('');
    onReset();
  };

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-card-lg">
      {/* Card header */}
      <div className="px-8 py-5 border-b border-surface-raised">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gradient-to-br from-navy-900 to-navy-700">
            <Send className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-navy-900 font-bold">XLM Transfer</div>
            <div className="text-slate-500 text-xs">
              Stellar Testnet · Multi-Wallet
            </div>
          </div>
        </div>
      </div>

      {formState === 'success' ? (
        /* ── Success state ────────────────────────────── */
        <div className="px-8 py-10 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 bg-green-100">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-navy-900 font-extrabold text-xl mb-2">
            Transaction Confirmed
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            {parseFloat(amount || '0').toLocaleString()} XLM successfully sent
            to the agent node.
          </p>

          {/* TX Hash */}
          <div className="rounded-2xl p-4 mb-6 text-left bg-surface">
            <div className="text-slate-500 text-[0.7rem] font-bold uppercase tracking-[0.08em] mb-2">
              Transaction Hash
            </div>
            <div className="font-mono text-[0.72rem] text-navy-700 break-all leading-relaxed">
              {txHash}
            </div>
          </div>

          <button
            id="send-another-btn"
            onClick={handleReset}
            className="w-full py-3.5 rounded-2xl bg-navy-900 text-white font-bold transition-all shadow-btn hover:bg-navy-700"
          >
            Send Another Transfer
          </button>
        </div>
      ) : (
        /* ── Form ─────────────────────────────────────── */
        <form
          id="xlm-transfer-form"
          onSubmit={handleSubmit}
          className="px-8 py-7 space-y-5"
        >
          {/* Destination address */}
          <div className="space-y-2">
            <label className="text-navy-900 text-[0.8rem] font-bold block">
              Destination Stellar Address
            </label>
            <input
              id="destination-address-input"
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setAddressError('');
              }}
              placeholder="GABC…XYZ (56 characters)"
              disabled={isSubmitting || !!prefilledAddress}
              className={cn(
                'w-full px-4 py-3 rounded-xl border-[1.5px] font-mono text-[0.78rem] text-navy-900 outline-none transition-all',
                prefilledAddress
                  ? 'border-border-default bg-slate-100 text-slate-500 cursor-not-allowed'
                  : addressError
                  ? 'border-red-600 bg-slate-50'
                  : 'border-border-default bg-slate-50 focus:border-navy-700 focus:bg-white',
              )}
            />
            {addressError && (
              <div className="flex items-center gap-1.5 text-red-600 text-xs">
                <AlertCircle className="w-3.5 h-3.5" />
                {addressError}
              </div>
            )}

            {prefilledAddress && (
            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
              <span className="px-2 py-0.5 rounded-lg bg-surface-raised font-mono text-[0.65rem]">
                Auto-filled · read-only
              </span>
            </div>
          )}

            {/* Quick-fill */}
            {!prefilledAddress && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {QUICK_FILL_ADDRESSES.map((addr) => (
                <button
                  key={addr}
                  type="button"
                  onClick={() => {
                    setAddress(addr);
                    setAddressError('');
                  }}
                  disabled={isSubmitting}
                  className="px-3 py-2 rounded-lg bg-surface-raised text-slate-500 font-mono text-xs lg:px-2 lg:py-1 lg:text-[0.65rem] transition-all hover:bg-navy-900 hover:text-white"
                >
                  {addr.slice(0, 8)}…{addr.slice(-4)}
                </button>
              ))}
              <span className="text-slate-400 text-[0.68rem] self-center">
                Quick-fill node addresses
              </span>
            </div>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-navy-900 text-[0.8rem] font-bold block">
              Amount (XLM)
            </label>
            <div className="relative">
              <input
                id="xlm-amount-input"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={isSubmitting}
                className="w-full px-4 py-3 rounded-xl border-[1.5px] border-border-default bg-slate-50 font-mono text-base text-navy-900 outline-none transition-all pr-16 focus:border-navy-700 focus:bg-white"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-lg bg-surface-raised text-slate-500 text-xs font-bold">
                XLM
              </div>
            </div>
            {/* Quick amounts */}
            <div className="flex gap-2">
              {QUICK_AMOUNTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(v)}
                  disabled={isSubmitting}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm lg:px-3 lg:py-1 lg:text-xs font-semibold transition-all',
                    amount === v
                      ? 'bg-navy-900 text-white'
                      : 'bg-surface-raised text-slate-500 hover:bg-navy-900 hover:text-white',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Memo */}
          <div className="space-y-2">
            <label className="text-navy-900 text-[0.8rem] font-bold block">
              Memo{' '}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              id="transfer-memo-input"
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Node ID or reference"
              disabled={isSubmitting}
              className="w-full px-4 py-3 rounded-xl border-[1.5px] border-border-default bg-slate-50 text-[0.9rem] text-navy-900 outline-none transition-all focus:border-navy-700 focus:bg-white"
            />
          </div>

          {/* Summary */}
          {address && amount && (
            <div className="rounded-2xl p-4 bg-surface">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-[0.08em] mb-3">
                Transfer Summary
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 text-[0.82rem]">Amount</span>
                  <span className="font-mono text-[0.82rem] text-navy-900 font-semibold">
                    {parseFloat(amount || '0').toLocaleString()} XLM
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 text-[0.82rem]">
                    Network Fee
                  </span>
                  <span className="font-mono text-[0.82rem] text-navy-900 font-semibold">
                    0.00001 XLM
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border-default">
                  <span className="text-navy-900 text-[0.82rem] font-bold">
                    Total Deducted
                  </span>
                  <span className="font-mono text-[0.82rem] text-navy-900 font-bold">
                    {(parseFloat(amount || '0') + 0.00001).toLocaleString()} XLM
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            id="submit-transfer-btn"
            type="submit"
            disabled={isSubmitting || isDisabled}
            className={cn(
              'w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold transition-all',
              isDisabled
                ? 'bg-surface-raised text-slate-400 cursor-not-allowed'
                : 'bg-navy-900 text-white shadow-btn hover:bg-navy-700 disabled:opacity-60 disabled:cursor-not-allowed',
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing & Broadcasting…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Transfer
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
