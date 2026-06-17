"use client";

import { useTransfer } from "@/hooks/useTransfer";
import { TransferForm } from "@/components/domain/TransferForm";

export default function FundNodePage() {
  const { formState, txHash, submitTransfer, resetTransfer } = useTransfer();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-navy-900 font-extrabold text-2xl">Fund Agent Node</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Send XLM directly to a gateway node address on Stellar Testnet
        </p>
      </div>

      <TransferForm
        formState={formState}
        txHash={txHash}
        onSubmit={submitTransfer}
        onReset={resetTransfer}
      />
    </div>
  );
}
