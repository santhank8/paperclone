// Handles the small Xero custom-connection client used by Officely V1 revenue sync.
import { Buffer } from "node:buffer";
import type { OfficelyXeroCashReceiptRecord, OfficelyXeroInvoiceRecord } from "@paperclipai/virtual-org-connectors";
import { unprocessable } from "../errors.js";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_ACCOUNTING_API_URL = "https://api.xero.com/api.xro/2.0";
const XERO_API_TIMEOUT_MS = 15_000;
const XERO_DEFAULT_LOOKBACK_DAYS = 180;
const XERO_MAX_PAGES = 10;
const XERO_PAGE_SIZE = 100;

type JsonRecord = Record<string, unknown>;

type XeroContact = {
  ContactID?: unknown;
  Name?: unknown;
  EmailAddress?: unknown;
};

type XeroInvoice = {
  InvoiceID?: unknown;
  Type?: unknown;
  Status?: unknown;
  Reference?: unknown;
  DateString?: unknown;
  Date?: unknown;
  DueDateString?: unknown;
  DueDate?: unknown;
  FullyPaidOnDate?: unknown;
  Total?: unknown;
  CurrencyCode?: unknown;
  LineItems?: unknown;
  Contact?: XeroContact | null;
};

type XeroBankTransaction = {
  BankTransactionID?: unknown;
  Type?: unknown;
  DateString?: unknown;
  Date?: unknown;
  Total?: unknown;
  CurrencyCode?: unknown;
  Reference?: unknown;
  Contact?: XeroContact | null;
  BankAccount?: {
    Name?: unknown;
  } | null;
  LineItems?: unknown;
};

type XeroPayment = {
  Date?: unknown;
  Reference?: unknown;
  Invoice?: {
    InvoiceID?: unknown;
  } | null;
  Account?: {
    Name?: unknown;
  } | null;
};

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length === 0) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  const text = asString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractEmailDomain(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain.length > 0 ? domain : null;
}

function normalizeText(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function isStripeMarker(value: string | null) {
  const normalized = normalizeText(value);
  return normalized.includes("stripe");
}

function isLikelyManualMarker(value: string | null) {
  const normalized = normalizeText(value);
  return (
    normalized.includes("manual") ||
    normalized.includes("bank transfer") ||
    normalized.includes("bank") ||
    normalized.includes("wire") ||
    normalized.includes("direct credit") ||
    normalized.includes("eft")
  );
}

function inferBillingPeriodMonths(values: Array<string | null>) {
  const normalized = values
    .map((value) => normalizeText(value))
    .filter((value) => value.length > 0)
    .join(" ");

  if (!normalized) return 1;
  if (
    normalized.includes("annual") ||
    normalized.includes("annually") ||
    normalized.includes("yearly") ||
    normalized.includes("per year") ||
    normalized.includes("per annum") ||
    normalized.includes("12 month") ||
    normalized.includes("12-month") ||
    normalized.includes("12 months")
  ) {
    return 12;
  }
  if (
    normalized.includes("quarterly") ||
    normalized.includes("quarter ") ||
    normalized.includes("per quarter") ||
    normalized.includes("3 month") ||
    normalized.includes("3-month") ||
    normalized.includes("3 months")
  ) {
    return 3;
  }
  return 1;
}

function getLineItemDescriptions(lineItems: unknown) {
  if (!Array.isArray(lineItems)) return [];
  return lineItems
    .filter(isRecord)
    .map((item) => asString(item.Description))
    .filter((value): value is string => Boolean(value));
}

function classifyCashReceiptSource(values: Array<string | null>) {
  const normalized = values
    .map((value) => normalizeText(value))
    .filter((value) => value.length > 0)
    .join(" ");

  if (!normalized) return "other" as const;
  if (
    normalized.includes("stripe usd") ||
    normalized.includes("stripe sales") ||
    normalized.includes("stripe clearing") ||
    normalized.includes("stripe payout") ||
    normalized.includes("stripe")
  ) {
    return "stripe" as const;
  }
  if (
    normalized.includes("manual") ||
    normalized.includes("bank transfer") ||
    normalized.includes("wire") ||
    normalized.includes("direct credit") ||
    normalized.includes("eft")
  ) {
    return "manual" as const;
  }
  return "other" as const;
}

async function readResponseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function fetchWithTimeout(input: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), XERO_API_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw unprocessable("Xero took too long to respond. Try again in a moment.");
    }
    throw unprocessable("Xero could not be reached. Check the connection and try again.");
  } finally {
    clearTimeout(timeout);
  }
}

async function requestClientCredentialsToken(input: { clientId: string; clientSecret: string }) {
  const authorization = Buffer.from(`${input.clientId}:${input.clientSecret}`).toString("base64");
  const response = await fetchWithTimeout(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: `Basic ${authorization}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
  });

  const body = await readResponseBody(response);
  if (!response.ok) {
    const description =
      isRecord(body) && typeof body.error_description === "string"
        ? body.error_description
        : "Xero rejected the custom connection credentials.";
    throw unprocessable(`${description} Check the Xero client ID and client secret.`);
  }

  if (!isRecord(body) || typeof body.access_token !== "string" || body.access_token.length === 0) {
    throw unprocessable("Xero did not return an access token.");
  }

  return body.access_token;
}

async function fetchPagedCollection<T>(input: {
  accessToken: string;
  path: string;
  collectionKey: string;
  ifModifiedSince: Date;
  includePageSize?: boolean;
}) {
  const items: T[] = [];

  for (let page = 1; page <= XERO_MAX_PAGES; page += 1) {
    const url = new URL(`${XERO_ACCOUNTING_API_URL}/${input.path}`);
    url.searchParams.set("page", String(page));
    if (input.includePageSize) {
      url.searchParams.set("pageSize", String(XERO_PAGE_SIZE));
    }

    const response = await fetchWithTimeout(url.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        accept: "application/json",
        "if-modified-since": input.ifModifiedSince.toUTCString(),
      },
    });
    const body = await readResponseBody(response);

    if (!response.ok) {
      throw unprocessable("Xero accepted the credentials but would not return accounting data.");
    }

    const collection = isRecord(body) ? body[input.collectionKey] : null;
    const pageItems = Array.isArray(collection) ? (collection.filter(isRecord) as T[]) : [];
    items.push(...pageItems);

    if (pageItems.length === 0) break;
    if (input.includePageSize && pageItems.length < XERO_PAGE_SIZE) break;
  }

  return items;
}

function buildPaymentMap(payments: XeroPayment[]) {
  const byInvoiceId = new Map<string, XeroPayment[]>();

  for (const payment of payments) {
    const invoiceId = asString(payment.Invoice?.InvoiceID);
    if (!invoiceId) continue;
    const existing = byInvoiceId.get(invoiceId) ?? [];
    existing.push(payment);
    byInvoiceId.set(invoiceId, existing);
  }

  return byInvoiceId;
}

function mapInvoiceRecord(invoice: XeroInvoice, payments: XeroPayment[]): OfficelyXeroInvoiceRecord | null {
  const invoiceId = asString(invoice.InvoiceID);
  const contactId = asString(invoice.Contact?.ContactID);
  const amount = asNumber(invoice.Total);
  const status = asString(invoice.Status);
  const type = asString(invoice.Type);

  if (!invoiceId || !contactId || amount === null || !status) {
    return null;
  }

  if (type && type !== "ACCREC") {
    return null;
  }

  const paymentMethods = [...new Set(
    payments
      .map((payment) => {
        const accountName = asString(payment.Account?.Name);
        const reference = asString(payment.Reference);
        return [accountName, reference].filter(Boolean).join(" / ");
      })
      .filter((value) => value.length > 0),
  )];
  const joinedPaymentMethod = paymentMethods.length > 0 ? paymentMethods.join(", ") : null;
  const hasStripeMarker = paymentMethods.some((value) => isStripeMarker(value));
  const hasManualMarker = paymentMethods.some((value) => isLikelyManualMarker(value));
  const hasAnyPayment = payments.length > 0;
  const paidDate =
    payments
      .map((payment) => asIsoDate(payment.Date))
      .filter((value): value is string => value !== null)
      .sort()
      .at(-1) ??
    asIsoDate(invoice.FullyPaidOnDate);
  const lineItemDescriptions = getLineItemDescriptions(invoice.LineItems);
  const billingPeriodMonths = inferBillingPeriodMonths([
    asString(invoice.Reference),
    ...lineItemDescriptions,
  ]);

  return {
    invoiceId,
    contactId,
    companyName: asString(invoice.Contact?.Name),
    primaryEmailDomain: extractEmailDomain(asString(invoice.Contact?.EmailAddress)),
    invoiceDate: asIsoDate(invoice.DateString ?? invoice.Date),
    dueDate: asIsoDate(invoice.DueDateString ?? invoice.DueDate),
    paidDate,
    amount,
    currency: asString(invoice.CurrencyCode) ?? "USD",
    status,
    paymentMethod: joinedPaymentMethod,
    manualPayment: hasStripeMarker ? false : hasManualMarker || hasAnyPayment ? true : null,
    billingPeriodMonths,
    monthlyRecurringAmount: amount / billingPeriodMonths,
  };
}

function mapCashReceiptRecord(transaction: XeroBankTransaction): OfficelyXeroCashReceiptRecord | null {
  const transactionId = asString(transaction.BankTransactionID);
  const transactionType = normalizeText(asString(transaction.Type));
  const amount = asNumber(transaction.Total);
  const receivedAt = asIsoDate(transaction.DateString ?? transaction.Date);

  if (!transactionId || !receivedAt || amount === null) {
    return null;
  }

  if (!transactionType.includes("receive")) {
    return null;
  }

  const bankAccountName = asString(transaction.BankAccount?.Name);
  const reference = asString(transaction.Reference);
  const lineItemDescriptions = getLineItemDescriptions(transaction.LineItems);
  const source = classifyCashReceiptSource([
    bankAccountName,
    reference,
    ...lineItemDescriptions,
  ]);

  return {
    transactionId,
    companyName: asString(transaction.Contact?.Name),
    receivedAt,
    amount,
    currency: asString(transaction.CurrencyCode) ?? "USD",
    bankAccountName,
    reference,
    source,
  };
}

export interface OfficelyXeroPreview {
  invoices: OfficelyXeroInvoiceRecord[];
  cashReceipts: OfficelyXeroCashReceiptRecord[];
  sampleCompanies: string[];
  manualPaymentCount: number;
}

export async function loadOfficelyXeroInvoices(input: {
  clientId: string;
  clientSecret: string;
  lookbackDays?: number;
}) {
  const lookbackDays =
    typeof input.lookbackDays === "number" && Number.isFinite(input.lookbackDays) && input.lookbackDays > 0
      ? Math.floor(input.lookbackDays)
      : XERO_DEFAULT_LOOKBACK_DAYS;
  const ifModifiedSince = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const accessToken = await requestClientCredentialsToken(input);
  const [rawInvoices, rawPayments, rawBankTransactions] = await Promise.all([
    fetchPagedCollection<XeroInvoice>({
      accessToken,
      path: "Invoices",
      collectionKey: "Invoices",
      ifModifiedSince,
    }),
    fetchPagedCollection<XeroPayment>({
      accessToken,
      path: "Payments",
      collectionKey: "Payments",
      ifModifiedSince,
      includePageSize: true,
    }),
    fetchPagedCollection<XeroBankTransaction>({
      accessToken,
      path: "BankTransactions",
      collectionKey: "BankTransactions",
      ifModifiedSince,
      includePageSize: true,
    }),
  ]);
  const paymentMap = buildPaymentMap(rawPayments);
  const invoices = rawInvoices
    .map((invoice) => mapInvoiceRecord(invoice, paymentMap.get(asString(invoice.InvoiceID) ?? "") ?? []))
    .filter((invoice): invoice is OfficelyXeroInvoiceRecord => invoice !== null);
  const cashReceipts = rawBankTransactions
    .map((transaction) => mapCashReceiptRecord(transaction))
    .filter((transaction): transaction is OfficelyXeroCashReceiptRecord => transaction !== null);
  const sampleCompanies = [...new Set(
    [...invoices, ...cashReceipts].map((record) => record.companyName?.trim()).filter((value): value is string => Boolean(value)),
  )].slice(0, 3);
  const manualPaymentCount = invoices.filter((invoice) => invoice.manualPayment === true).length;

  return {
    invoices,
    cashReceipts,
    sampleCompanies,
    manualPaymentCount,
  } satisfies OfficelyXeroPreview;
}
