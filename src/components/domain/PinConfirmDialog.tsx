'use client';

// ═══════════════════════════════════════════════════════════
// PinConfirmDialog
//
// Modal that prompts the admin for their treasury PIN before
// a sensitive action proceeds. Submits via just-in-time model
// — the PIN is passed to the parent `onConfirm` callback and
// combined with the action payload at the API layer.
//
// Uses input-otp (already in package.json) for a polished
// numeric PIN entry experience.
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import { ShieldCheck, Loader2, KeyRound } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { OTPInput, OTPInputContext } from 'input-otp';
import React from 'react';

interface PinConfirmDialogProps {
    /** Controls dialog open state */
    open: boolean;
    /** Called when the dialog closes (cancel or after confirm) */
    onOpenChange: (open: boolean) => void;
    /**
     * Called with the entered PIN when the admin confirms.
     * Should return a promise; the dialog shows a loading state while pending.
     * Reject or return false to indicate failure — dialog stays open.
     */
    onConfirm: (pin: string) => Promise<void>;
    /** Title shown in the dialog header */
    title?: string;
    /** Description / action summary shown beneath the title */
    description?: string;
}

const PIN_LENGTH = 6;

export function PinConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    title = 'Confirm with Treasury PIN',
    description = 'Enter your 6-digit treasury PIN to authorize this operation.',
}: PinConfirmDialogProps) {
    const [pin, setPin] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleOpenChange = (nextOpen: boolean) => {
        if (isSubmitting) return; // prevent close while in flight
        if (!nextOpen) {
            setPin('');
            setError(null);
        }
        onOpenChange(nextOpen);
    };

    const handleComplete = async (value: string) => {
        setError(null);
        setIsSubmitting(true);
        try {
            await onConfirm(value);
            // Success — parent is responsible for closing dialog
            setPin('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Incorrect PIN. Please try again.');
            setPin('');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm p-0 overflow-hidden rounded-3xl border-0">
                <DialogHeader className="sr-only">
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center gap-6 p-8">
                    {/* Icon */}
                    <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-navy-900/10">
                        <ShieldCheck className="w-7 h-7 text-navy-900" />
                    </div>

                    {/* Heading */}
                    <div className="text-center space-y-1">
                        <h2 className="text-navy-900 font-extrabold text-lg">{title}</h2>
                        <p className="text-slate-500 text-sm">{description}</p>
                    </div>

                    {/* PIN input */}
                    <OTPInput
                        id="treasury-pin-input"
                        maxLength={PIN_LENGTH}
                        value={pin}
                        onChange={setPin}
                        onComplete={handleComplete}
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

                    {/* Error */}
                    {error && (
                        <p className="text-red-600 text-sm font-medium text-center">{error}</p>
                    )}

                    {/* Status indicator */}
                    {isSubmitting && (
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Verifying…
                        </div>
                    )}

                    {/* PIN setup hint */}
                    <p className="text-slate-400 text-xs text-center flex items-center gap-1">
                        <KeyRound className="w-3 h-3" />
                        PIN set in Security Settings
                    </p>

                    {/* Cancel */}
                    <button
                        type="button"
                        id="pin-dialog-cancel-btn"
                        onClick={() => handleOpenChange(false)}
                        disabled={isSubmitting}
                        className="text-slate-500 text-sm hover:text-navy-900 transition-colors disabled:opacity-40"
                    >
                        Cancel
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Individual PIN slot ──────────────────────────────────

function PinSlot({ slot }: { slot: { char: string | null; isActive: boolean; hasFakeCaret: boolean } }) {
    return (
        <div
            className={[
                'w-11 h-14 flex items-center justify-center rounded-xl border-2 text-xl font-bold text-navy-900 transition-all select-none',
                slot.isActive
                    ? 'border-navy-900 bg-navy-900/5 shadow-sm'
                    : 'border-slate-200 bg-white',
            ].join(' ')}
        >
            {slot.hasFakeCaret ? (
                <span className="w-0.5 h-5 bg-navy-900 animate-pulse rounded-full" />
            ) : (
                slot.char ? '●' : null
            )}
        </div>
    );
}
