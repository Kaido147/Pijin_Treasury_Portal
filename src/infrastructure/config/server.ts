// ═══════════════════════════════════════════════════════════
// Pijin Treasury — Server Configurations
//
// Defines our core infrastructure servers that are monitored
// on the Gateway Operations page.
// ═══════════════════════════════════════════════════════════

export interface InfrastructureServer {
    id: string;
    name: string;
    type: 'backend' | 'sms_gateway' | 'relayer';
    healthUrl: string;
    region: string;
    /** Only applicable for servers that hold an XLM balance (e.g., Gas Payer) */
    stellarPublicKey?: string;
}

export const INFRASTRUCTURE_SERVERS: InfrastructureServer[] = [

];
