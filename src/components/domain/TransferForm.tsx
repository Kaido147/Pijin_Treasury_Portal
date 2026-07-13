'use client';

import { useState, useEffect } from 'react';
import { Send, CheckCircle2, Loader2, AlertCircle, ShieldCheck, KeyRound, ArrowLeft } from 'lucide-react';
import type { TransferFormState } from '@/core/types';
import { QUICK_FILL_ADDRESSES, QUICK_AMOUNTS } from '@/core/constants';
import { validateStellarAddress, cn } from '@/core/utils';
import { OTPInput } from 'input-otp';
import React from 'react';

interface TransferFormProps {
  formState: TransferFormState;
  txHash: string;
  transferError: string | null;
  onSubmit: (data: {
    address: string;
    amount: string;
    memo: string;
    pin: string;
  }) => void;
  onReset: () => void;
  prefilledAddress?: string;
}

const PIN_LENGTH = 6;

export function TransferForm({
  formState,
  txHash,
  transferError,
  onSubmit,
  onReset,
  prefilledAddress
}: TransferFormProps) {
  const [address, setAddress] = useState(prefilledAddress ?? '');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [addressError, setAddressError] = useState('');

  // Local step state: 'form' | 'pin'
  const [step, setStep] = useState<'form' | 'pin'>('form');
  const [pin, setPin] = useState('');
  const [localPinError, setLocalPinError] = useState<string | null>(null);

  useEffect(() => {
    if (transferError) {
      setLocalPinError(transferError);
      setPin('');
    } else {
      setLocalPinError(null);
    }
  }, [transferError]);

  const isSubmitting = formState === 'submitting';
  const isFormDisabled = !address || !amount;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateStellarAddress(address);
    if (err) {
      setAddressError(err);
      return;
    }
    if (!amount || parseFloat(amount) <= 0) return;
    setStep('pin');
  };

  const handlePinComplete = (enteredPin: string) => {
    setLocalPinError(null);
    onSubmit({ address, amount, memo, pin: enteredPin });
  };

  const handleReset = () => {
    setAddress(prefilledAddress ?? '');
    setAmount('');
    setMemo('');
    setAddressError('');
    setPin('');
    setLocalPinError(null);
    setStep('form');
    onReset();
  };

  const handleBack = () => {
    setPin('');
    setLocalPinError(null);
    setStep('form');
  };

  // ─── Render States ──────────────────────────────────────────

  // 1. Success State
  if (formState === 'success') {
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
      </div>
    );
  }

  // 2. Submitting / Loading State
  if (isSubmitting) {
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

        <div className="px-8 py-16 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-navy-900 animate-spin mb-4" />
          <h2 className="text-navy-900 font-extrabold text-lg mb-1">
            Signing & Broadcasting
          </h2>
          <p className="text-slate-500 text-sm max-w-xs mx-auto">
            Processing your treasury transfer on the Stellar network...
          </p>
        </div>
      </div>
    );
  }

  // 3. PIN Confirmation Step
  if (step === 'pin') {
    return (
      <div className="bg-white rounded-3xl overflow-hidden shadow-card-lg">
        {/* Card header with Back button */}
        <div className="px-8 py-5 border-b border-surface-raised flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-navy-900 transition-all"
            aria-label="Back to transfer details"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="text-navy-900 font-bold">Confirm Treasury Transfer</div>
            <div className="text-slate-500 text-xs">
              Authorization required
            </div>
          </div>
        </div>

        <div className="px-8 py-7 space-y-6">
          {/* Summary Card */}
          <div className="rounded-2xl p-4 bg-surface space-y-3">
            <div className="text-slate-500 text-[0.7rem] font-bold uppercase tracking-[0.08em] border-b border-border-default pb-2">
              Transfer Summary
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Destination Address</span>
                <span className="font-mono text-navy-900 font-semibold truncate max-w-[200px]" title={address}>
                  {address.slice(0, 8)}…{address.slice(-8)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Amount</span>
                <span className="font-mono text-navy-900 font-bold">
                  {parseFloat(amount || '0').toLocaleString()} XLM
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Network Fee</span>
                <span className="font-mono text-navy-900 font-semibold">
                  0.00001 XLM
                </span>
              </div>
              {memo && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Memo</span>
                  <span className="text-navy-950 font-medium truncate max-w-[200px]">
                    {memo}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-border-default">
                <span className="text-navy-900 font-bold text-sm">
                  Total Deducted
                </span>
                <span className="font-mono text-navy-900 font-extrabold text-sm">
                  {(parseFloat(amount || '0') + 0.00001).toLocaleString()} XLM
                </span>
              </div>
            </div>
          </div>

          {/* Secure verification section */}
          <div className="flex flex-col items-center gap-5 pt-2">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-navy-900/10">
              <ShieldCheck className="w-6 h-6 text-navy-900" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-navy-900 font-bold text-sm">Enter Security PIN</h3>
              <p className="text-slate-500 text-xs">
                Enter your 6-digit treasury PIN to authorize this transfer.
              </p>
            </div>

            {/* PIN input */}
            <OTPInput
              id="treasury-pin-input"
              maxLength={PIN_LENGTH}
              value={pin}
              onChange={setPin}
              onComplete={handlePinComplete}
              disabled={isSubmitting}
              inputMode="numeric"
              pattern="\d*"
              containerClassName="flex items-center gap-2"
              render={({ slots }) => (
                <>
                  {slots.map((slot, idx) => (
                    <PinSlot key={idx} slot={slot} />
                  ))}
                </>
              )}
            />

            {/* Error display */}
            {localPinError && (
              <div className="flex items-center gap-1.5 text-red-600 text-xs font-semibold bg-red-50 px-3 py-1.5 rounded-xl animate-in fade-in duration-200">
                <AlertCircle className="w-3.5 h-3.5" />
                {localPinError}
              </div>
            )}

            {/* PIN setup hint */}
            <p className="text-slate-400 text-[0.68rem] text-center flex items-center gap-1">
              <KeyRound className="w-3 h-3" />
              PIN set in Security Settings
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 4. Default Form Step
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

      <form
        id="xlm-transfer-form"
        onSubmit={handleFormSubmit}
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

        {/* Summary preview */}
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
          disabled={isSubmitting || isFormDisabled}
          className={cn(
            'w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold transition-all',
            isFormDisabled
              ? 'bg-surface-raised text-slate-400 cursor-not-allowed'
              : 'bg-navy-900 text-white shadow-btn hover:bg-navy-700 disabled:opacity-60 disabled:cursor-not-allowed',
          )}
        >
          <Send className="w-4 h-4" />
          Submit Transfer
        </button>
      </form>
    </div>
  );
}

// ── Individual PIN slot ──────────────────────────────────

function PinSlot({ slot }: { slot: { char: string | null; isActive: boolean; hasFakeCaret: boolean } }) {
  return (
    <div
      className={cn(
        'w-11 h-14 flex items-center justify-center rounded-xl border-2 text-xl font-bold text-navy-900 transition-all select-none',
        slot.isActive
          ? 'border-navy-900 bg-navy-900/5 shadow-sm'
          : 'border-slate-200 bg-white',
      )}
    >
      {slot.hasFakeCaret ? (
        <span className="w-0.5 h-5 bg-navy-900 animate-pulse rounded-full" />
      ) : (
        slot.char ? '●' : null
      )}
    </div>
  );
}
