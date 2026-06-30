import { NextResponse } from 'next/server';
import { INFRASTRUCTURE_SERVERS } from '@/infrastructure/config/server';
import { fetchStellarBalance } from '@/infrastructure/stellar/horizon';
import type { GatewayNode, NodeStatus } from '@/core/types';

// Do not cache this route, we want live status every time
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Ping all servers concurrently
    const healthChecks = await Promise.all(
      INFRASTRUCTURE_SERVERS.map(async (server) => {
        let status: NodeStatus = 'offline';
        let uptime = '0%';
        let balance = '0.00';

        // 1. Fetch Health Status
        if (server.healthUrl) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const res = await fetch(server.healthUrl, {
              signal: controller.signal,
              cache: 'no-store',
            });

            clearTimeout(timeoutId);

            if (res.ok) {
              status = 'active';
              uptime = '99.9%';
            }
          } catch (error) {
            console.error(`Health check failed for ${server.name}:`, error);
            status = 'offline';
          }
        }

        // 2. Fetch Stellar Balance if applicable
        if (server.stellarPublicKey) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
          try {
            balance = await fetchStellarBalance(server.stellarPublicKey, controller.signal);
          } catch (error) {
            console.error(`Balance check failed for ${server.name}:`, error);
          } finally {
            clearTimeout(timeoutId);
          }
        } else if (server.type === 'sms_gateway') {
          balance = 'N/A'; // SMS Gateway doesn't hold XLM
        }

        // 3. Map to GatewayNode type expected by the frontend
        const node: GatewayNode = {
          id: server.id,
          name: server.name,
          address: server.stellarPublicKey || 'N/A', // Using address field for pub key
          region: server.region,
          status,
          uptime,
          balance,
        };

        return node;
      })
    );

    return NextResponse.json(healthChecks);
  } catch (error) {
    console.error('Failed to process health checks:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
