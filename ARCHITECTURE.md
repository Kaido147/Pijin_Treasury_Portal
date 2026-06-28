# Pijin Treasury Portal: Architecture & Developer Onboarding Guide

Welcome to the **Pijin Treasury Portal**. This document is a comprehensive technical overview and onboarding guide for engineers taking over the Next.js/TypeScript codebase. It describes the portal's role within the broader Pijin zero-data payment ecosystem, outlines its system architecture, breaks down its core routes and components, details its data sources, and provides setup guidelines for local development.

---

## 1. Project Overview & Purpose

**Pijin** is a zero-data cellular transport layer for decentralized finance (DeFi). It enables unbanked and offline users in infrastructure-limited regions (such as remote or rural municipalities in the Philippines) to send secure, peer-to-peer (P2P) payments using basic GSM cellular networks (SMS) instead of expensive mobile broadband data plans (4G/5G/WiFi).

The **Treasury Portal** is the back-office command center. It is a secure administrative dashboard built parallel to the mobile app and is intended strictly for authorized network administrators. Its primary objectives are:

*   **Liquidity Compliance & Monitoring:** Track stablecoin custody (specifically the Philippine Peso stablecoin, **PHPC**), manage agent registries on Stellar Testnet and Mainnet, and monitor liquidity pools.
*   **Treasury Balancing:** Monitor the master administrator wallet (`ADMIN_ADDRESS`) to ensure that on-chain protocol tolls are collected correctly (each offline transaction programmatically routes a flat **₱0.50** toll to the treasury wallet to fund backend operations) and that the network's native **XLM** gas pools are funded to sponsor transactions.
*   **Gateway Oversight:** Register, whitelist, and monitor the health of authorized Android SMS gateway devices routing the analog SMS payloads to the blockchain.

---

## 2. System Architecture & The "Whole System" Connection

The Treasury Portal does **not** communicate directly with the offline mobile app. Instead, it operates parallel to the user client, acting as an administrative observer and coordinator by reading contract state from the Stellar network and querying API telemetry from the relayer backend.

### Text-Based System Architecture

```
+------------------------------------------------------------------------------------------------+
|                                      PIJIN CELLULAR ECOSYSTEM                                  |
+------------------------------------------------------------------------------------------------+
                                                                                                  
   [ Offline User Phone ] ----( GSM/SMS Text )----> [ Android Textbee Gateway ]                  
             |                                                |                                   
             | (Payload QR)                                   | (HTTP POST Webhook / HMAC Signature)
             v                                                v                                   
   [ Bystander/Merchant ] ---( SMS Broadcast Relay )---------> [ Vercel Next.js Relayer ]         
                                                                      |                           
                                                                      | (Meta-Transaction Payload)
                                                                      v                           
                                                          [ Soroban Smart Contract ]              
                                                               (spend_offline)                    
                                                                      |                           
                                                                      | (On-Chain Settlement)     
                                                                      v                           
                                                           [ Stellar Blockchain ]                 
                                                                      ^                           
                                                                      |                           
+---------------------------------------------------------------------|--------------------------+
|                                     TREASURY DASHBOARD              |                          |
+---------------------------------------------------------------------|--------------------------+
|                                                                     |                          |
|    +--------------------+                     +---------------------|--------------------+     |
|    |   Freighter Auth   |                     |              Stellar RPC                 |     |
|    |  (Admin Wallet)    |                     |   (Listening to State & Ledger Activity) |     |
|    +---------+----------+                     +------------------^-----------------------+     |
|              |                                                   |                             |
|              +------------------------> [ Treasury Dashboard UI ]+                             |
|                                                   |                                            |
|                                                   | (Polling for Node Health Logs)             |
|                                                   v                                            |
|                                       +----------------------------+                           |
|                                       | Vercel Webhook Router API  |                           |
|                                       +----------------------------+                           |
+------------------------------------------------------------------------------------------------+
```

### The Transaction Relay & Settlement Data Flow

1.  **Analog Ingress (Offline Mobile App):**
    The offline user enters a transaction in the Pijin mobile app. The application signs the payment instructions using their local keypair and formats a compressed base64 payload containing:
    *   `Token ID` (1-char code identifying the stablecoin, e.g., `1` for PHPC).
    *   `Sender ID` & `Receiver ID` (6-character alphanumeric shortcodes mapping to Stellar public keys).
    *   `Amount` (Fixed-point integer in cents).
    *   `Nonce` (8-digit timestamp).
    *   `Signature` (64-byte Ed25519 cryptographic signature of the transaction content).

    If the user has cellular load, they send the text directly. If they have zero load, they display a "Payload QR" code to a bystander or sari-sari store owner with cellular credit, who broadcasts the text message on their behalf ("dumb-pipe routing").

2.  **Analog-to-Digital Ingress Gateway:**
    A physical Android device running **Textbee** receives the SMS message. It automatically packages the raw SMS body and forwards it to the Next.js Vercel Relayer endpoint via an HTTP POST webhook.

3.  **Relayer Authentication:**
    The Vercel Relayer authenticates the incoming webhook payload by verifying the `X-Pijin-Signature` HTTP header, which contains a SHA-256 HMAC hash. This ensures that only whitelisted, physical Android SMS gateway devices can submit payloads.

4.  **Transaction Resolution & Meta-Transaction Assembly:**
    The Vercel Relayer parses the compressed string, resolves the 6-character ShortIDs into complete Stellar public keys, and constructs a Soroban smart contract invocation envelope. The Relayer signs this envelope as the **Fee Sponsor**, paying the native XLM gas fees required to execute the transaction.

5.  **Smart Contract Execution (`spend_offline`):**
    The transaction invokes `spend_offline` on the deployed Soroban contract. The contract:
    *   Verifies the Ed25519 cryptographic signature of the transaction entirely on-chain.
    *   Validates the gateway's whitelist status and the nonce sequence to prevent replay attacks.
    *   Executes an atomic **2-way distribution split**: transfers the core payment to the receiver and programmatically routes a flat ₱0.50 infrastructure toll directly to the Pijin Treasury Wallet.
    *   Emits an event, prompting the relayer to dispatch confirmation SMS receipts to both parties.

6.  **Dashboard Observability:**
    The Treasury Portal queries the network parallel to this flow, polling Vercel endpoints to verify gateway performance and utilizing Stellar Horizon and Soroban RPC connections to monitor contract states, ledger updates, and balance states.

---

## 3. Core Pages & Feature Breakdown

The portal uses the Next.js App Router. The dashboard pages reside within the `src/app/(dashboard)` layout group, ensuring shared navigational states and layout structures (via `DashboardShell.tsx`).

### Route 1: Command Center (`/command-center`)
The core dashboard interface providing administrators with a high-level operational overview of the network:
*   **Freighter Authentication Flow:** 
    Administrators authenticate via the browser-extension wallet Freighter. Clicking "Connect Wallet" triggers `useStellarWallet()`, which interacts with `@stellar/freighter-api`. It verifies that the user is connected to **Stellar Testnet** (enforcing a safety gate to prevent mainnet transactions during testing). Once authorized, it retrieves the public key and utilizes `Horizon.Server` (`https://horizon-testnet.stellar.org`) to load the wallet's current native XLM balances.
*   **Balance Monitoring:** 
    Renders the administrator wallet's balance in XLM and its converted Philippine Peso (PHP) value, computed via the static `XLM_TO_PHP_RATE` (defined in `src/core/constants/index.ts`).
*   **KPI Metrics & Network Health:** 
    Exposes statistics regarding active gateway nodes, cumulative distributed assets, pending queue metrics, and average settlement latencies.

### Route 2: Fund Agent Node (`/fund-node`)
The dashboard interface used to distribute digital liquidity to local cash-in agents:
*   **Liquidity Out-Ramp:** 
    Administrators input the agent's public key (or choose from whitelisted locations via quick-fill buttons) and enter an XLM amount.
*   **Transaction Lifecycle:** 
    Uses the `useTransfer()` hook to handle form validations. On submission, the application calls the wallet adapter (`freighterAdapter`) to sign and broadcast the payment envelope to the Stellar Testnet. The screen updates in real-time, showing the transaction lifecycle (idle, submitting, success, error) and providing a clickable link to the transaction block on Stellar Explorer upon completion.

### Route 3: Gateway Operations (`/gateway-ops`)
The registration and monitoring center for cellular network nodes:
*   **Gateway Whitelisting:** 
    To protect the Vercel Relayer's gas reserve from spam, only registered Android phone numbers are allowed to relay transactions. Administrators use this page to invoke a whitelist registry on the Soroban smart contract by submitting a gateway name, region, and its target Stellar public key/address.
*   **Telemetry Grid:** 
    Lists whitelisted gateway nodes, tracking their physical status (`active`, `syncing`, `offline`), current system uptimes, and native XLM balances.

### Route 4: Transaction Ledger (`/ledger`)
A transparent, audit-ready record of all transactional history processed by the Soroban smart contract:
*   **Live Stream Toggle:** 
    Allows admins to toggle "Live" stream mode on or off. In "Live" mode, the dashboard polls the blockchain at a periodic interval (set by `LEDGER_POLL_INTERVAL_MS` in constants) and appends new transactions to the top of the grid.
*   **Filtering & Summary Cards:** 
    Features quick-filter tabs to screen transactions by their execution state (`Confirmed`, `Pending`, `Failed`). Displays volume summary cards deriving count totals from the transaction array.

---

## 4. Data Sources & The Health Monitor

The dashboard UI relies on abstractions provided by custom React Hooks (`src/hooks`) and infrastructure clients (`src/infrastructure`). This separation of concerns guarantees that mock data generators can be hot-swapped for live RPC endpoints without modifying visual components.

### Gateway API Health Bar
*   **UI Location:** `NetworkHealthPanel.tsx` -> "Gateway API" service metric.
*   **Data Acquisition:** Polled from the Vercel Relayer API status endpoints.
*   **Operational Detail:** The status endpoint verifies connectivity and authorization parameters between the physical Android Textbee device and the webhook route. If the Vercel backend receives regular, authenticated payloads (checked using HMAC header handshakes) from Textbee devices, the API status reports `operational`. If payloads drop off or fail signature checks, it defaults to `degraded` or `down`.

### Network Latency & Live Ledger
*   **UI Location:** `StatCard.tsx` (Avg Latency card) & `LedgerPage.tsx`
*   **Data Acquisition:** Acquired by polling or streaming from Stellar RPC servers.
*   **Operational Detail:** 
    *   The health monitor polls the Soroban/Horizon RPC endpoints (e.g. `https://soroban-testnet.stellar.org`) and measures the round-trip response time (RTT) for state queries.
    *   If RTT spikes beyond 500ms, the system flags the network health status as `degraded` or `down`, alerting the administrator to potential queue blockages or delays in on-chain transaction settlement.
    *   The Transaction Ledger streams records by setting up an RPC listener or calling `Horizon.Server.transactions().forAccount(ADMIN_ADDRESS).stream(...)` using the `stellar-sdk`.

### Smart Contract State
*   **UI Location:** `useGatewayNodes.ts`, `useStellarWallet.ts`
*   **Data Acquisition:** Fetched directly from the deployed Soroban `spend_offline` contract using `stellar-sdk`.
*   **Operational Detail:**
    *   **User Balances:** The dashboard queries contract storage by calling the read-only contract method `deposit` or querying balance records under `DataKey::Vault(UserAddress, TokenAddress)`.
    *   **Gateway Registry:** The whitelist status of incoming gateway devices is read directly from the contract state.
    *   To issue writes (e.g., adding a gateway or executing a transfer), the dashboard builds a Stellar transaction containing a `HostFunction::InvokeContract` operation, prompts the Freighter extension to sign the transaction envelope, and submits it to the Soroban RPC.

---

## 5. Developer Handover Notes

Follow these steps to set up the development environment, review configuration variables, and extend the dashboard.

### Local Development Setup

1.  **Clone and Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Start the Local Dev Server:**
    ```bash
    npm run dev
    ```
    This launches the application on [http://localhost:3000](http://localhost:3000).

3.  **Run Quality Checks:**
    *   Build production bundle: `npm run build`
    *   Lint check: `npm run lint`

### Required Environment Variables

Create a `.env.local` file in the root directory. Configure the following environment variables for connecting to the Stellar Network and the Relayer:

```env
# Stellar & Soroban Network Configurations
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# Soroban Smart Contract IDs
NEXT_PUBLIC_SPEND_OFFLINE_CONTRACT_ID=CD...   # Deployed contract address

# Stablecoin Asset Configurations (PHPC)
NEXT_PUBLIC_PHPC_ASSET_CODE=PHPC
NEXT_PUBLIC_PHPC_ISSUER_ADDRESS=GA...         # Anchor issuer account key

# Treasury Admin Addresses
NEXT_PUBLIC_TREASURY_ADDRESS=GBRMB7MFPND5JLXDTUKJBWWKUVCLMKNM3MJ2QGJCYZLBM6OBG6HRWKN

# Relayer Backend API Credentials (HMAC Security)
NEXT_PUBLIC_VERCEL_RELAYER_URL=https://pijin-relayer.vercel.app
VERCEL_RELAYER_HMAC_SECRET=your_sha256_hmac_secret_key
```

### Best Practices for Code Extension

1.  **Follow the Folder Structure (Clean Separation of Concerns):**
    Maintain the established directory layout:
    *   `src/core/`: Centralized interfaces (`types/`), navigation/network mappings (`constants/`), and validation rules (`utils/`).
    *   `src/infrastructure/`: Low-level data clients. Put raw Stellar SDK calls, RPC simulations, and Horizon queries here.
    *   `src/hooks/`: UI-to-API state bridges. Always write custom hooks (e.g., `useNetworkHealth`) to feed data into your components. This isolates React components from direct dependency on blockchain client engines.
    *   `src/components/domain/`: Component patterns specific to Pijin logic (e.g., `TransferForm.tsx`, `GatewayNodeCard.tsx`).
    *   `src/components/ui/`: Dumb, reusable, highly styling-flexible components (e.g., buttons, inputs, modals).

2.  **Maintain pure Tailwind CSS v4 Styles:**
    *   **No Inline Styles:** Do not write inline styles like `style={{ padding: 12 }}`. Use Tailwind's spacing and layout utilities (`p-3`, `gap-4`).
    *   **Colors & Tokens:** Utilize the custom semantic theme variables defined in `src/app/globals.css` (e.g., `bg-navy-900`, `text-navy-900`, `shadow-card`, `border-border-default`).
    *   **Typography:** The application loads Google Fonts (Nunito for standard copy, JetBrains Mono for ledger elements, transactional balances, and hashes). Apply `font-sans` or `font-mono` accordingly.

3.  **UI State Handling & Accessibility:**
    *   Use Radix UI primitives inside `src/components/ui` to guarantee layout compatibility, focus states, and keyboard accessibility.
    *   Provide skeleton views (use `SkeletonCard.tsx`) or spinners when hooks report loading states.
    *   Provide feedback for errors or successful actions using the centralized `sonner` toast notifier (e.g., `toast.error(message)` or `toast.success(message)`).
