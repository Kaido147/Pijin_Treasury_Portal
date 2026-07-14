import { rpc } from '@stellar/stellar-sdk';
import { requireEnv } from '@/infrastructure/helpers/requireEnv';

export interface SorobanConfig {
    server: rpc.Server;
    serverUrl: string;
    contractId: string;
    networkPassphrase: string;
}

let cachedConfig: SorobanConfig | null = null;

export function getSorobanConfig(): SorobanConfig {
    if (cachedConfig) {
        return cachedConfig;
    }

    const serverUrl = requireEnv('NEXT_PUBLIC_SOROBAN_RPC_URL');
    const contractId = requireEnv('CONTRACT_ID');
    const networkPassphrase = requireEnv('NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE');

    cachedConfig = {
        server: new rpc.Server(serverUrl),
        serverUrl,
        contractId,
        networkPassphrase,
    };

    return cachedConfig;
}

export function defineSorobanConfig() {
    const contractId = requireEnv('CONTRACT_ID');
    const tokenId = requireEnv('TOKEN_ID');
    const horizonUrl = requireEnv('NEXT_PUBLIC_STELLAR_HORIZON_URL');
    const networkPassphrase = requireEnv('NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE');

    return {
        contractId,
        tokenId,
        horizonUrl,
        networkPassphrase,
    };
}