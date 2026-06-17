'use client';

import { useState } from 'react';
import { Server, CheckCircle2, Loader2 } from 'lucide-react';

interface RegisterNodeFormProps {
  onSubmit: (data: { name: string; address: string; region: string }) => void;
  isSubmitting: boolean;
  isSuccess: boolean;
}

export function RegisterNodeForm({
  onSubmit,
  isSubmitting,
  isSuccess,
}: RegisterNodeFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    region: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  // Reset local fields when the success state auto-dismisses
  const handleReset = () => {
    setFormData({ name: '', address: '', region: '' });
  };

  // After success auto-dismisses, reset form fields
  if (!isSuccess && !isSubmitting && formData.name && !formData.address) {
    // intentionally empty — handled by parent
  }

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-card-lg">
      {/* Header */}
      <div className="px-7 py-5 border-b border-surface-raised">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-navy-900 to-navy-700">
            <Server className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-navy-900 font-bold">
              Register New Gateway Node
            </div>
            <div className="text-slate-500 text-xs">
              Add a new agent node to the network
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
          <p className="text-navy-900 font-bold">Node Registered!</p>
          <p className="text-slate-500 text-[0.85rem]">
            Beginning sync process…
          </p>
        </div>
      ) : (
        /* Form */
        <form
          id="register-node-form"
          onSubmit={handleSubmit}
          className="px-7 py-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
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
                className="w-full px-4 py-2.5 rounded-xl border-[1.5px] border-border-default bg-slate-50 text-sm text-navy-900 outline-none transition-all focus:border-navy-700 focus:bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-navy-900 text-[0.78rem] font-bold block">
                Region
              </label>
              <input
                id="node-region-input"
                value={formData.region}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, region: e.target.value }))
                }
                placeholder="SEA-05"
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 rounded-xl border-[1.5px] border-border-default bg-slate-50 text-sm text-navy-900 outline-none transition-all focus:border-navy-700 focus:bg-white"
              />
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
              className="w-full px-4 py-2.5 rounded-xl border-[1.5px] border-border-default bg-slate-50 text-[0.78rem] font-mono text-navy-900 outline-none transition-all focus:border-navy-700 focus:bg-white"
            />
          </div>

          <button
            id="submit-node-btn"
            type="submit"
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-navy-900 text-white font-bold transition-all shadow-btn disabled:opacity-60 disabled:cursor-not-allowed hover:bg-navy-700"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Server className="w-4 h-4" />
            )}
            {isSubmitting ? 'Registering…' : 'Register Node'}
          </button>
        </form>
      )}
    </div>
  );
}
