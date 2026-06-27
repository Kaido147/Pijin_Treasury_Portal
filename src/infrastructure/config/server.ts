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
    {
        id: 'node-backend-001',
        name: 'Next.js Backend (Gas Payer)',
        type: 'backend',
        healthUrl: process.env.BACKEND_URL || '',
        region: 'Global',
        stellarPublicKey: process.env.RELAYER_PUBLIC_KEY || '',
    },
    {
        id: 'node-textbee-001',
        name: 'Textbee SMS Server',
        type: 'sms_gateway',
        // send-sms is POST-only; ping the API root for liveness instead
        healthUrl: process.env.TEXTBEE_HEALTH_URL || '',
        region: 'Global',
    },
];
