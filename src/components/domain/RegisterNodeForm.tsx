'use client';

import { useState, useEffect, useRef } from 'react';
import { Server, CheckCircle2, Loader2, ChevronDown, Info, RefreshCw, PlusCircle, X } from 'lucide-react';
import type { RegionCode, GatewayNode, Region } from '@/core/types';
import type { RegistryTxState } from '@/hooks/useGatewayNodes';

// ─── Phase-aware submit label ────────────────────────────

function getSubmitLabel(
  txState: RegistryTxState | undefined,
  isReactivationMode: boolean
): string {
  if (!txState || txState.status === 'IDLE' || txState.status === 'FAILED') {
    return isReactivationMode ? 'Re-authorize Gateway Node' : 'Register Node';
  }
  switch (txState.status) {
    case 'VALIDATING_CLIENT':  return 'Validating…';
     case 'BROADCASTING':
      return txState.broadcastPhase === 2
        ? 'Transmitting Core XDR…'
        : 'Generating Ledger Blueprint…';
    case 'AWAITING_SIGNATURE': return 'Sign in Wallet…';
    case 'ON_CHAIN_MINING':    return 'Confirming on Soroban Staging…';
    case 'SUCCESS':            return 'Clearance Fully Granted';
    default:
      return isReactivationMode ? 'Re-authorize Gateway Node' : 'Register Node';
  }
}

// ─── Slug normalizer ─────────────────────────────────────
// "SEA 01" → "SEA-01", "sea 01" → "SEA-01"

function normalizeSlug(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '-');
}

interface RegisterNodeFormProps {
  onSubmit: (data: { name: string; address: string; region: RegionCode }) => void;
  isSubmitting: boolean;
  isSuccess: boolean;
  txState?: RegistryTxState;
  revokedNodes?: GatewayNode[];
  prefillAddress?: string;
  /** Called when the user explicitly cancels — wired by the parent Dialog's onOpenChange. */
  onCancel?: () => void;
}

export function RegisterNodeForm({
  onSubmit,
  isSubmitting,
  isSuccess,
  txState,
  revokedNodes = [],
  prefillAddress,
  onCancel: _onCancel,
}: RegisterNodeFormProps) {
  const [formData, setFormData] = useState<{
    name: string;
    address: string;
    region: RegionCode | '';
  }>({
    name: '',
    address: '',
    region: '',
  });

  // ─── Dynamic regions from DB ────────────────────────────
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionsError, setRegionsError] = useState<string | null>(null);

  // ─── Inline "Add New Region" modal state ────────────────
  const [showAddRegion, setShowAddRegion] = useState(false);
  const [newRegionInput, setNewRegionInput] = useState('');
  const [isAddingRegion, setIsAddingRegion] = useState(false);
  const [addRegionError, setAddRegionError] = useState<string | null>(null);
  const newRegionRef = useRef<HTMLInputElement>(null);

  // Reactivation mode: address matches a revoked node exactly
  const isReactivationMode = formData.address.trim().length > 0 &&
    revokedNodes.some(n => n.address === formData.address.trim());

  // ─── Fetch regions on mount ─────────────────────────────
  useEffect(() => {
    fetch('/api/regions')
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load regions');
        return r.json() as Promise<Region[]>;
      })
      .then(setRegions)
      .catch((err: Error) => setRegionsError(err.message));
  }, []);

  // Focus the new-region input when modal opens
  useEffect(() => {
    if (showAddRegion) {
      setTimeout(() => newRegionRef.current?.focus(), 50);
    }
  }, [showAddRegion]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.region) return;
    onSubmit({ ...formData, region: formData.region });
  };

  // Pre-fill address when parent passes a revoked node address
  useEffect(() => {
    if (prefillAddress) {
      setFormData((p) => ({ ...p, address: prefillAddress }));
    }
  }, [prefillAddress]);

  // Reset local fields when the success state triggers
  useEffect(() => {
    if (isSuccess) {
      setFormData({ name: '', address: '', region: '' });
    }
  }, [isSuccess]);

  // ─── Add new region handler ─────────────────────────────
  const handleAddRegion = async () => {

    if (!newRegionInput.trim()) return;

    const slug = normalizeSlug(newRegionInput);
    const name = newRegionInput.trim();

    setIsAddingRegion(true);
    setAddRegionError(null);

    try {
      const res = await fetch('/api/regions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, name }),
      });

      const payload = await res.json() as Region & { error?: string };

      if (!res.ok) {
        setAddRegionError(payload.error ?? 'Failed to add region.');
        return;
      }

      // Append + auto-select the new region
      setRegions((prev) => [...prev, payload]);
      setFormData((p) => ({ ...p, region: payload.slug }));
      setShowAddRegion(false);
      setNewRegionInput('');
    } catch {
      setAddRegionError('Network error. Try again.');
    } finally {
      setIsAddingRegion(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-card-lg">
      {/* Header */}
      <div className="px-4 py-4 lg:px-7 lg:py-5 border-b border-surface-raised">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isReactivationMode ? 'bg-gradient-to-br from-indigo-700 to-indigo-500' : 'bg-gradient-to-br from-navy-900 to-navy-700'}`}>
            {isReactivationMode ? (
              <RefreshCw className="w-4 h-4 text-white" />
            ) : (
              <Server className="w-4 h-4 text-white" />
            )}
          </div>
          <div>
            <div className="text-navy-900 font-bold">
              {isReactivationMode ? 'Re-authorize Gateway Node' : 'Register New Gateway Node'}
            </div>
            <div className="text-slate-500 text-xs">
              {isReactivationMode ? 'Restore a previously revoked node' : 'Add a new agent node to the network'}
            </div>
          </div>
        </div>
      </div>

      {isSuccess ? (
        /* Success state */
        <div className="px-7 py-8 text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 bg-green-100">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-navy-900 font-bold">
            {isReactivationMode ? 'Node Re-authorized!' : 'Node Registered!'}
          </p>
          <p className="text-slate-500 text-[0.85rem]">
            Beginning sync process…
          </p>
        </div>
      ) : (
        /* Form */
        <form
          id="register-node-form"
          onSubmit={handleSubmit}
          className="px-4 py-5 lg:px-7 lg:py-6 space-y-4"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-navy-900 text-[0.78rem] font-bold block">
                Node Name
              </label>
              <input
                id="node-name-input"
                value={formData.name}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Manila Gateway Alpha"
                required
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 rounded-xl border-[1.5px] border-border-default bg-slate-50 text-base lg:text-sm text-navy-900 outline-none transition-all focus:border-navy-700 focus:bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-navy-900 text-[0.78rem] font-bold block">
                Region
              </label>

              {/* Dropdown */}
              <div className="relative">
                <select
                  id="node-region-input"
                  value={formData.region}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'ADD_NEW') {
                      setShowAddRegion(true);
                      return;
                    }
                    setFormData((p) => ({ ...p, region: val }));
                  }}
                  required
                  disabled={isSubmitting || regions.length === 0 && !regionsError}
                  className="w-full appearance-none px-4 py-2.5 pr-10 rounded-xl border-[1.5px] border-border-default bg-slate-50 text-base lg:text-sm text-navy-900 outline-none transition-all focus:border-navy-700 focus:bg-white cursor-pointer disabled:opacity-50"
                >
                  <option value="" disabled>
                    {regionsError ? '⚠ Failed to load regions' : regions.length === 0 ? 'Loading…' : '— Select region —'}
                  </option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.slug}>
                      {r.name}
                    </option>
                  ))}
                  <option value="ADD_NEW">＋ Add new region…</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              {/* Inline Add-Region modal */}
              {showAddRegion && (
                <div className="mt-2 p-3 rounded-xl border border-navy-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-navy-900 text-[0.75rem] font-bold flex items-center gap-1.5">
                      <PlusCircle className="w-3.5 h-3.5" />
                      New Region
                    </span>
                    <button
                      type="button"
                      onClick={() => { setShowAddRegion(false); setNewRegionInput(''); setAddRegionError(null); }}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label="Cancel add region"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      ref={newRegionRef}
                      id="new-region-input"
                      value={newRegionInput}
                      onChange={(e) => setNewRegionInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddRegion(); } }}
                      placeholder='e.g. "SEA 06" or "Davao"'
                      disabled={isAddingRegion}
                      className="flex-1 px-3 py-1.5 rounded-lg border-[1.5px] border-border-default bg-white text-sm text-navy-900 outline-none focus:border-navy-700"
                    />
                    <button
                      id="confirm-add-region-btn"
                      type="button"
                      onClick={handleAddRegion}
                      disabled={isAddingRegion || !newRegionInput.trim()}
                      className="px-3 py-1.5 rounded-lg bg-navy-900 text-white text-sm font-semibold disabled:opacity-50 hover:bg-navy-700 transition-colors flex items-center gap-1.5"
                    >
                      {isAddingRegion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Add
                    </button>
                  </div>
                  {addRegionError && (
                    <p className="text-red-600 text-[0.72rem]">{addRegionError}</p>
                  )}
                  <p className="text-slate-400 text-[0.7rem]">
                    Slug auto-generated: <span className="font-mono text-navy-700">{newRegionInput ? normalizeSlug(newRegionInput) : '—'}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-navy-900 text-[0.78rem] font-bold block">
              Stellar Address
            </label>
            <input
              id="node-address-input"
              value={formData.address}
              onChange={(e) =>
                setFormData((p) => ({ ...p, address: e.target.value }))
              }
              placeholder="G… (56-character Stellar public key)"
              required
              disabled={isSubmitting}
              className={`w-full px-4 py-2.5 rounded-xl border-[1.5px] bg-slate-50 text-base lg:text-[0.78rem] font-mono text-navy-900 outline-none transition-all focus:bg-white ${isReactivationMode ? 'border-indigo-400 focus:border-indigo-600' : 'border-border-default focus:border-navy-700'}`}
            />
          </div>

          {/* Reactivation mode banner */}
          {isReactivationMode && (
            <div className="flex gap-3 items-start px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-200">
              <Info className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
              <p className="text-indigo-700 text-[0.78rem] leading-relaxed">
                <span className="font-bold">Existing Node Signature Profile Detected.</span>{' '}
                Submitting this action will re-execute the on-chain Soroban registry handshake
                and restore this gateway&apos;s active status in the whitelist.
              </p>
            </div>
          )}

          <button
            id="submit-node-btn"
            type="submit"
            disabled={isSubmitting}
            className={`flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-white font-bold transition-all shadow-btn disabled:opacity-60 disabled:cursor-not-allowed ${isReactivationMode ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-navy-900 hover:bg-navy-700'}`}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isReactivationMode ? (
              <RefreshCw className="w-4 h-4" />
            ) : (
              <Server className="w-4 h-4" />
            )}
            {getSubmitLabel(txState, isReactivationMode)}
          </button>
        </form>
      )}
    </div>
  );
}
