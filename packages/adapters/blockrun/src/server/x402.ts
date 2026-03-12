/**
 * x402 v2 payment signing for BlockRun API.
 *
 * Implements EIP-712 TransferWithAuthorization for USDC on Base.
 * The flow:
 *   1. First request → 402 with Payment-Required header (base64 JSON)
 *   2. Parse payment requirements (amount, payTo, asset, network)
 *   3. Sign EIP-712 typed data with wallet private key
 *   4. Build payment payload, base64-encode it
 *   5. Retry request with PAYMENT-SIGNATURE header
 */

import { createWalletClient, http, isAddress, type Hex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

// USDC contract addresses
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

// Expected network identifiers per environment
const EXPECTED_NETWORK: Record<string, string> = {
  mainnet: "eip155:8453",
  testnet: "eip155:84532",
};

// EIP-712 domain for USDC TransferWithAuthorization
const USDC_DOMAIN = {
  name: "USD Coin",
  version: "2",
} as const;

// EIP-712 types for TransferWithAuthorization
const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

interface PaymentRequirements {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: { name?: string; version?: string };
  resource?: unknown;
}

interface X402PaymentPayload {
  x402Version: number;
  resource: unknown;
  accepted: PaymentRequirements;
  payload: {
    signature: string;
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: string;
    };
  };
  extensions: Record<string, unknown>;
}

function parsePaymentRequired(headerValue: string): PaymentRequirements {
  const decoded = JSON.parse(
    Buffer.from(headerValue, "base64").toString("utf-8"),
  );

  // x402 v2 wraps payment methods in { x402Version, accepts: [...], resource }
  // x402 v1 is a bare array or single object
  let accepted: Record<string, unknown> | undefined;
  let resource: unknown = undefined;

  if (decoded && typeof decoded === "object" && !Array.isArray(decoded) && decoded.accepts) {
    // v2 envelope
    const accepts = decoded.accepts as unknown[];
    accepted = accepts[0] as Record<string, unknown> | undefined;
    resource = decoded.resource;
  } else if (Array.isArray(decoded)) {
    // v1 array
    accepted = decoded[0] as Record<string, unknown> | undefined;
  } else {
    // v1 single object
    accepted = decoded as Record<string, unknown>;
  }

  if (!accepted) {
    throw new Error("No accepted payment methods in Payment-Required header");
  }

  return {
    scheme: (accepted.scheme as string) ?? "exact",
    network: (accepted.network as string) ?? "eip155:8453",
    amount: String(accepted.maxAmountRequired ?? accepted.amount ?? "0"),
    asset: (accepted.asset as string) ?? USDC_BASE,
    payTo: (accepted.payTo as string) ?? "",
    maxTimeoutSeconds: (accepted.maxTimeoutSeconds as number) ?? 300,
    extra: accepted.extra as { name?: string; version?: string },
    resource,
  };
}

function randomNonce(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ("0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")) as Hex;
}

export async function signX402Payment(
  paymentRequiredHeader: string,
  privateKey: string,
  network: "mainnet" | "testnet",
  maxPaymentUsd: number = 1.0,
): Promise<string> {
  const requirements = parsePaymentRequired(paymentRequiredHeader);

  // Validate payment amount cap (USDC has 6 decimals: $1.00 = 1_000_000 units)
  const maxAmountUnits = BigInt(Math.floor(maxPaymentUsd * 1_000_000));
  const requestedAmount = BigInt(requirements.amount);
  if (requestedAmount > maxAmountUnits) {
    throw new Error(
      `Payment amount ${requirements.amount} exceeds cap of ${maxAmountUnits} ` +
        `(maxPaymentUsd=${maxPaymentUsd}). Refusing to sign.`,
    );
  }

  // Validate payTo is a valid Ethereum address
  if (!isAddress(requirements.payTo)) {
    throw new Error(
      `Invalid payTo address: "${requirements.payTo}". Must be a valid Ethereum address.`,
    );
  }

  // Validate network matches expected environment
  const expectedNetwork = EXPECTED_NETWORK[network];
  if (expectedNetwork && requirements.network !== expectedNetwork) {
    throw new Error(
      `Network mismatch: payment requires "${requirements.network}" but adapter ` +
        `is configured for "${network}" (expected "${expectedNetwork}").`,
    );
  }

  const chain = network === "testnet" ? baseSepolia : base;
  const usdcAddress =
    network === "testnet" ? USDC_BASE_SEPOLIA : USDC_BASE;

  const account = privateKeyToAccount(privateKey as Hex);
  const client = createWalletClient({
    account,
    chain,
    transport: http(),
  });

  const now = Math.floor(Date.now() / 1000);
  const validAfter = BigInt(now - 600);
  const validBefore = BigInt(
    now + (requirements.maxTimeoutSeconds || 300),
  );
  const nonce = randomNonce();

  const authorization = {
    from: account.address as Address,
    to: requirements.payTo as Address,
    value: BigInt(requirements.amount),
    validAfter,
    validBefore,
    nonce,
  };

  const signature = await client.signTypedData({
    domain: {
      ...USDC_DOMAIN,
      chainId: chain.id,
      verifyingContract: usdcAddress,
    },
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: "TransferWithAuthorization",
    message: authorization,
  });

  const payload: X402PaymentPayload = {
    x402Version: 2,
    resource: requirements.resource ?? {},
    accepted: requirements,
    payload: {
      signature,
      authorization: {
        from: account.address,
        to: requirements.payTo,
        value: requirements.amount,
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    },
    extensions: {},
  };

  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Derive wallet address from private key without making network calls.
 */
export function getWalletAddress(privateKey: string): string {
  const account = privateKeyToAccount(privateKey as Hex);
  return account.address;
}
