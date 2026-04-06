// Handles the small Stripe reader used by Officely V1 billing-event sync.
import { Buffer } from "node:buffer";
import type { OfficelyStripeEventRecord } from "@paperclipai/virtual-org-connectors";
import { unprocessable } from "../errors.js";

const STRIPE_API_BASE_URL = "https://api.stripe.com/v1";
const STRIPE_API_TIMEOUT_MS = 15_000;
const STRIPE_DEFAULT_LOOKBACK_DAYS = 30;
const STRIPE_MAX_PAGES = 10;
const STRIPE_PAGE_SIZE = 100;
const STRIPE_EVENT_TYPES = [
  "invoice.paid",
  "invoice.payment_failed",
  "charge.refunded",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function asUnixTimestamp(value: unknown): string | null {
  const timestamp = asNumber(value);
  if (timestamp === null) return null;
  const parsed = new Date(timestamp * 1000);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function extractEmailDomain(email: string | null) {
  if (!email) return null;
  const atIndex = email.lastIndexOf("@");
  if (atIndex < 0) return null;
  const domain = email.slice(atIndex + 1).trim().toLowerCase();
  return domain.length > 0 ? domain : null;
}

function centsToUnitAmount(value: unknown) {
  const amount = asNumber(value);
  return amount === null ? null : amount / 100;
}

function validateStripeSecretKey(secretKey: string) {
  const normalized = secretKey.trim();
  if (!normalized.startsWith("sk_") && !normalized.startsWith("rk_")) {
    throw unprocessable("Stripe needs a secret key that starts with sk_ or rk_.");
  }
  return normalized;
}

function normalizeCompanyName(value: unknown) {
  return asString(value);
}

function getNestedRecord(parent: JsonRecord, key: string) {
  const value = parent[key];
  return isRecord(value) ? value : null;
}

function getNestedArray(parent: JsonRecord, key: string) {
  const value = parent[key];
  return Array.isArray(value) ? value : [];
}

function getObjectCustomerId(object: JsonRecord) {
  const customer = object.customer;
  if (typeof customer === "string") return asString(customer);
  if (isRecord(customer)) return asString(customer.id);
  return null;
}

function getObjectCompanyName(object: JsonRecord) {
  const customerName = asString(object.customer_name);
  if (customerName) return customerName;

  const billingDetails = getNestedRecord(object, "billing_details");
  const billingName = billingDetails ? asString(billingDetails.name) : null;
  if (billingName) return billingName;

  const metadata = getNestedRecord(object, "metadata");
  return metadata ? normalizeCompanyName(metadata.company_name) : null;
}

function getObjectEmailDomain(object: JsonRecord) {
  const customerEmail = asString(object.customer_email);
  if (customerEmail) return extractEmailDomain(customerEmail);

  const billingDetails = getNestedRecord(object, "billing_details");
  const billingEmail = billingDetails ? asString(billingDetails.email) : null;
  if (billingEmail) return extractEmailDomain(billingEmail);

  return null;
}

function getCurrentPlanName(subscription: JsonRecord) {
  const items = getNestedRecord(subscription, "items");
  const firstItem = items ? getNestedArray(items, "data")[0] : null;
  const firstItemRecord = isRecord(firstItem) ? firstItem : null;
  const price = firstItemRecord ? getNestedRecord(firstItemRecord, "price") : null;
  const plan = firstItemRecord ? getNestedRecord(firstItemRecord, "plan") : null;

  return (
    asString(price?.nickname) ??
    asString(plan?.nickname) ??
    asString(price?.id) ??
    asString(plan?.id) ??
    null
  );
}

function getSubscriptionAmount(record: JsonRecord | null) {
  if (!record) return null;

  const items = getNestedRecord(record, "items");
  const itemRecords = items
    ? getNestedArray(items, "data").filter(isRecord)
    : [];
  if (itemRecords.length > 0) {
    const total = itemRecords.reduce((sum, item) => {
      const price = getNestedRecord(item, "price");
      const plan = getNestedRecord(item, "plan");
      const quantity = asNumber(item.quantity) ?? 1;
      const unitAmount = asNumber(price?.unit_amount) ?? asNumber(plan?.amount);
      return sum + ((unitAmount ?? 0) * quantity);
    }, 0);
    return total > 0 ? total : null;
  }

  const plan = getNestedRecord(record, "plan");
  const amount = asNumber(plan?.amount);
  return amount;
}

function mapStripeEventRecord(event: JsonRecord): OfficelyStripeEventRecord | null {
  const eventId = asString(event.id);
  const eventType = asString(event.type);
  const occurredAt = asUnixTimestamp(event.created);
  const data = getNestedRecord(event, "data");
  const object = data ? getNestedRecord(data, "object") : null;

  if (!eventId || !eventType || !occurredAt || !object) return null;

  if (eventType === "invoice.payment_failed") {
    const customerId = getObjectCustomerId(object);
    if (!customerId) return null;
    return {
      eventId,
      customerId,
      companyName: getObjectCompanyName(object),
      primaryEmailDomain: getObjectEmailDomain(object),
      eventType: "payment_failed",
      occurredAt,
      amount: centsToUnitAmount(object.amount_due),
      planName: getCurrentPlanName(object),
    };
  }

  if (eventType === "invoice.paid") {
    const customerId = getObjectCustomerId(object);
    if (!customerId) return null;
    return {
      eventId,
      customerId,
      companyName: getObjectCompanyName(object),
      primaryEmailDomain: getObjectEmailDomain(object),
      eventType: "payment_succeeded",
      occurredAt,
      amount: centsToUnitAmount(object.amount_paid ?? object.amount_due),
      planName: getCurrentPlanName(object),
    };
  }

  if (eventType === "charge.refunded") {
    const customerId = getObjectCustomerId(object);
    if (!customerId) return null;
    return {
      eventId,
      customerId,
      companyName: getObjectCompanyName(object),
      primaryEmailDomain: getObjectEmailDomain(object),
      eventType: "refund",
      occurredAt,
      amount: centsToUnitAmount(object.amount_refunded ?? object.amount),
      planName: null,
    };
  }

  if (eventType === "customer.subscription.deleted") {
    const customerId = getObjectCustomerId(object);
    if (!customerId) return null;
    return {
      eventId,
      customerId,
      companyName: getObjectCompanyName(object),
      primaryEmailDomain: getObjectEmailDomain(object),
      eventType: "cancellation",
      occurredAt,
      amount: centsToUnitAmount(getSubscriptionAmount(object)),
      planName: getCurrentPlanName(object),
    };
  }

  if (eventType === "customer.subscription.updated") {
    const customerId = getObjectCustomerId(object);
    if (!customerId) return null;

    const previousAttributes = data ? getNestedRecord(data, "previous_attributes") : null;
    const currentAmount = getSubscriptionAmount(object);
    const previousAmount = getSubscriptionAmount(previousAttributes);
    if (currentAmount === null || previousAmount === null || currentAmount === previousAmount) {
      return null;
    }

    return {
      eventId,
      customerId,
      companyName: getObjectCompanyName(object),
      primaryEmailDomain: getObjectEmailDomain(object),
      eventType: currentAmount > previousAmount ? "upgrade" : "downgrade",
      occurredAt,
      amount: centsToUnitAmount(currentAmount),
      planName: getCurrentPlanName(object),
    };
  }

  return null;
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
  const timeout = setTimeout(() => controller.abort(), STRIPE_API_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw unprocessable("Stripe took too long to respond. Try again in a moment.");
    }
    throw unprocessable("Stripe could not be reached. Check the key and try again.");
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchStripeEvents(input: { secretKey: string; lookbackDays: number }) {
  const startedAfter = Math.floor(Date.now() / 1000) - input.lookbackDays * 24 * 60 * 60;
  const auth = Buffer.from(`${input.secretKey}:`).toString("base64");
  const items: JsonRecord[] = [];
  let startingAfter: string | null = null;

  for (let page = 1; page <= STRIPE_MAX_PAGES; page += 1) {
    const url = new URL(`${STRIPE_API_BASE_URL}/events`);
    url.searchParams.set("limit", String(STRIPE_PAGE_SIZE));
    url.searchParams.set("created[gte]", String(startedAfter));
    if (startingAfter) {
      url.searchParams.set("starting_after", startingAfter);
    }
    for (const type of STRIPE_EVENT_TYPES) {
      url.searchParams.append("types[]", type);
    }

    const response = await fetchWithTimeout(url.toString(), {
      method: "GET",
      headers: {
        authorization: `Basic ${auth}`,
        accept: "application/json",
      },
    });
    const body = await readResponseBody(response);

    if (!response.ok) {
      const message =
        isRecord(body) && isRecord(body.error) && typeof body.error.message === "string"
          ? body.error.message
          : "Stripe rejected the secret key.";
      throw unprocessable(`${message} Check the Stripe key and try again.`);
    }

    if (!isRecord(body) || !Array.isArray(body.data)) {
      throw unprocessable("Stripe did not return a valid event list.");
    }

    const pageItems = body.data.filter(isRecord);
    items.push(...pageItems);

    const lastItem = pageItems[pageItems.length - 1];
    startingAfter = lastItem ? asString(lastItem.id) : null;
    if (body.has_more !== true || !startingAfter) break;
  }

  return items;
}

export async function loadOfficelyStripeEvents(input: {
  secretKey: string;
  lookbackDays?: number;
}) {
  const secretKey = validateStripeSecretKey(input.secretKey);
  const lookbackDays = Math.min(Math.max(Math.round(input.lookbackDays ?? STRIPE_DEFAULT_LOOKBACK_DAYS), 1), STRIPE_DEFAULT_LOOKBACK_DAYS);
  const rawEvents = await fetchStripeEvents({ secretKey, lookbackDays });
  const events = rawEvents
    .map((event) => mapStripeEventRecord(event))
    .filter((event): event is OfficelyStripeEventRecord => Boolean(event));

  return { events };
}
