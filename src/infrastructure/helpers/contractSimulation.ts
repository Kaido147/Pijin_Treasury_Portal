import { rpc, TransactionBuilder, Contract, xdr, Transaction } from '@stellar/stellar-sdk';

// Interface of Soroban Transaction
export interface BuildSorobanTxParams {
    server: rpc.Server;
    walletPublicKey: string;
    networkPassphrase: string;
    contractId: string;
    method: string;
    args: xdr.ScVal[];
    fee?: string;
    timeoutSecs?: number;
}

// Custom error class to bubble up simulation details safely
export class SimulationError extends Error {
    public details: string;
    public events: xdr.DiagnosticEvent[] | undefined;

    constructor(details: string, events?: xdr.DiagnosticEvent[]) {
        super('Contract simulation failed');
        this.name = 'SimulationError';
        this.details = details;
        this.events = events;
    }
}

export async function buildAndAssembleTransaction(params: BuildSorobanTxParams): Promise<Transaction> {
    const {
        server,
        walletPublicKey,
        networkPassphrase,
        contractId,
        method,
        args,
        fee = '100',
        timeoutSecs = 30,
    } = params;

    const sourceAccount = await server.getAccount(walletPublicKey);

    const tx = new TransactionBuilder(sourceAccount, { fee, networkPassphrase })
        .addOperation(new Contract(contractId).call(method, ...args))
        .setTimeout(timeoutSecs)
        .build();

    const simulation = await server.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(simulation)) {
        throw new SimulationError(
            simulation.error || 'Unknown simulation error',
            simulation.events
        );
    }

    // Returns the unsigned envelope containing the required auth footprint
    return rpc.assembleTransaction(tx, simulation).build();
}