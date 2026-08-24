import { createHash, createSign, randomUUID } from "node:crypto";

type CPayResult = {
  reference?: string;
  transactionId?: string;
  status?: string;
  channel?: string;
  message?: string;
  checkoutUrl?: string;
  linkReference?: string;
};

export type CPayCommunicationResult = {
  messageReference?: string;
  externalReference?: string | null;
  purpose?: string;
  channel?: string;
  provider?: string | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CPayIdentityResult = {
  requestReference?: string;
  subjectNameMasked?: string | null;
  subjectMsisdnMasked?: string | null;
  identityNumberMask?: string | null;
  status?: string;
  providerReference?: string | null;
  requestedBy?: string | null;
};

const MAX_CPAY_RESPONSE_BYTES = 64 * 1024;

function parseCpayObject(text: string): Record<string, unknown> {
  if (new TextEncoder().encode(text).byteLength > MAX_CPAY_RESPONSE_BYTES) throw new Error("CPAY_RESPONSE_TOO_LARGE");
  if (!text) return {};
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("CPAY_INVALID_JSON"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("CPAY_INVALID_SHAPE");
  return parsed as Record<string, unknown>;
}

function safeCpayError(status: number) {
  if (status === 401 || status === 403) return "CPay v2 authentication or merchant signing was rejected.";
  if (status === 404) return "CPay could not find the requested transaction.";
  if (status === 409) return "CPay reported a transaction conflict. NOLI will preserve the existing transaction reference.";
  if (status === 429) return "CPay is temporarily busy. Try again shortly.";
  if (status >= 500) return "CPay is temporarily unavailable. No new payment action should be repeated until the transaction state is checked.";
  return "CPay could not process this request.";
}

function config() {
  const env = process.env as unknown as Record<string, string | undefined>;
  const baseUrl = env.CPAY_API_BASE_URL?.replace(/\/$/, "");
  const merchantNumber = env.CPAY_MERCHANT_NUMBER?.trim() || env.CPAY_API_ADDITIONAL_FIELD_2?.trim();
  const privateKeyPem = env.CPAY_SIGNING_KEY_PEM?.replace(/\\n/g, "\n").trim();
  if (!baseUrl || !merchantNumber || !privateKeyPem) {
    throw new Error("CPay private API v2 signing is not fully configured for this application.");
  }
  return { baseUrl, merchantNumber, privateKeyPem };
}

export function isCpayPrivateApiConfigured(env: Record<string, string | undefined> = process.env as unknown as Record<string, string | undefined>) {
  return Boolean(
    env.CPAY_API_BASE_URL?.trim()
    && (env.CPAY_MERCHANT_NUMBER?.trim() || env.CPAY_API_ADDITIONAL_FIELD_2?.trim())
    && env.CPAY_SIGNING_KEY_PEM?.trim()
  );
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function canonicalizeCpayV2Request(input: {
  method: string;
  path: string;
  canonicalQuery?: string;
  timestamp: string;
  nonce: string;
  body?: string;
}) {
  return [
    input.method.trim().toUpperCase(),
    input.path.trim(),
    (input.canonicalQuery ?? "").trim(),
    input.timestamp.trim(),
    input.nonce.trim(),
    sha256Hex((input.body ?? "").trim()),
  ].join("\n");
}

function signedV2Headers(input: { method: string; requestPath: string; body: string; privateKeyPem: string; merchantNumber: string }) {
  const parsed = new URL(input.requestPath, "https://cpay.invalid");
  const timestamp = new Date().toISOString();
  const nonce = randomUUID();
  const canonical = canonicalizeCpayV2Request({
    method: input.method,
    path: parsed.pathname,
    canonicalQuery: parsed.search.startsWith("?") ? parsed.search.slice(1) : parsed.search,
    timestamp,
    nonce,
    body: input.body,
  });
  const signer = createSign("RSA-SHA256");
  signer.update(canonical, "utf8");
  signer.end();
  const signature = signer.sign(input.privateKeyPem, "base64");
  return {
    "X-CPay-Merchant-Number": input.merchantNumber,
    "X-CPay-Signature-Version": "v2",
    "X-CPay-Timestamp": timestamp,
    "X-CPay-Nonce": nonce,
    "X-CPay-Signature": signature,
  };
}

async function cpayFetch<T extends Record<string, unknown> = CPayResult>(path: string, init: RequestInit = {}): Promise<T> {
  const { baseUrl, merchantNumber, privateKeyPem } = config();
  const method = String(init.method ?? "GET").toUpperCase();
  const body = init.body == null ? "" : typeof init.body === "string" ? init.body : (() => { throw new Error("CPay v2 requests must use an exact string body for signing."); })();
  const signatureHeaders = signedV2Headers({ method, requestPath: path, body, privateKeyPem, merchantNumber });
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(12_000),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...signatureHeaders,
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    console.warn("CPay request unavailable", { path: new URL(path, "https://cpay.invalid").pathname, errorType: error instanceof Error ? error.name : "unknown" });
    throw new Error("CPay is temporarily unavailable. The transaction state has not been assumed or changed.");
  }
  const text = await response.text();
  let payload: Record<string, unknown>;
  try {
    payload = parseCpayObject(text);
  } catch (error) {
    console.warn("CPay response could not be safely interpreted", { path: new URL(path, "https://cpay.invalid").pathname, status: response.status, reason: error instanceof Error ? error.message : "unknown" });
    throw new Error("CPay returned an unexpected response. The transaction state has not been assumed or changed.");
  }
  if (!response.ok) {
    console.warn("CPay request rejected", { path: new URL(path, "https://cpay.invalid").pathname, status: response.status });
    throw new Error(safeCpayError(response.status));
  }
  return payload as T;
}

export function isPaymentSuccessful(status?: string | null) {
  return ["SUCCESS", "SUCCEEDED", "COMPLETED", "PAID"].includes(String(status ?? "").toUpperCase());
}

export function isPaymentFailed(status?: string | null) {
  return ["FAILED", "DECLINED", "CANCELLED", "CANCELED", "REJECTED", "EXPIRED"].includes(String(status ?? "").toUpperCase());
}

export async function collectVendingPayment(input: {
  rentalReference: string;
  amount: number;
  payerPhone: string;
  channel?: string;
  callbackUrl: string;
}) {
  const { merchantNumber } = config();
  const reference = `NOLI-${input.rentalReference}-DEP`;
  const body = JSON.stringify({
    merchantNumber,
    channel: input.channel || "MOBILE_MONEY",
    country: "UG",
    currency: "UGX",
    amount: String(input.amount),
    reference,
    description: `NOLI Vendaz refundable deposit for ${input.rentalReference}`,
    callbackUrl: input.callbackUrl,
    payer: { type: "MSISDN", value: input.payerPhone },
  });
  const result = await cpayFetch("/api/v2/native/payments/collect", {
    method: "POST",
    headers: { "X-CPay-Idempotency-Key": reference },
    body,
  });
  return { ...result, reference: result.reference || reference };
}

export async function createHostedCardCheckout(input: {
  rentalReference: string;
  amount: number;
  callbackUrl: string;
}) {
  const { merchantNumber } = config();
  const reference = `NOLI-${input.rentalReference}-CARD`;
  const body = JSON.stringify({
    merchantNumber,
    amount: String(input.amount),
    currency: "UGX",
    country: "UG",
    reference,
    description: `NOLI Vendaz refundable deposit for ${input.rentalReference}`,
    callbackUrl: input.callbackUrl,
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  });
  const result = await cpayFetch("/api/v2/payment-links", {
    method: "POST",
    headers: { "X-CPay-Idempotency-Key": reference },
    body,
  });
  if (!result.checkoutUrl) throw new Error("CPay did not return a secure checkout URL.");
  return { ...result, reference: result.linkReference || reference };
}

export async function getPaymentStatus(reference: string) {
  const { merchantNumber } = config();
  return cpayFetch(`/api/v2/payments/${encodeURIComponent(reference)}?merchantNumber=${encodeURIComponent(merchantNumber)}`, { method: "GET" });
}

export async function refundVendingDeposit(input: {
  rentalReference: string;
  amount: number;
  refundPhone: string;
  callbackUrl: string;
}) {
  const { merchantNumber } = config();
  const reference = `NOLI-${input.rentalReference}-REFUND`;
  const body = JSON.stringify({
    merchantNumber,
    channel: "MOBILE_MONEY",
    country: "UG",
    currency: "UGX",
    amount: String(input.amount),
    reference,
    description: `NOLI Vendaz deposit refund for ${input.rentalReference}`,
    callbackUrl: input.callbackUrl,
    payee: { type: "MSISDN", value: input.refundPhone },
  });
  const result = await cpayFetch("/api/v2/native/payments/payout", {
    method: "POST",
    headers: { "X-CPay-Idempotency-Key": reference },
    body,
  });
  return { ...result, reference: result.reference || reference };
}

export async function sendCpayCommunication(input: {
  recipient: string;
  content: string;
  purpose?: "OTP" | "SECURITY" | "TRANSACTIONAL" | "NOTIFICATION";
  externalReference: string;
  expiresInSeconds?: number;
}) {
  const { merchantNumber } = config();
  const body = JSON.stringify({
    merchantNumber,
    channel: "SMS",
    recipient: input.recipient,
    content: input.content,
    purpose: input.purpose || "TRANSACTIONAL",
    externalReference: input.externalReference,
    expiresInSeconds: input.expiresInSeconds ?? 600,
  });
  return cpayFetch<CPayCommunicationResult>("/api/v2/communication/messages", {
    method: "POST",
    headers: { "X-CPay-Idempotency-Key": input.externalReference },
    body,
  });
}

export async function getCpayCommunicationStatus(reference: string) {
  const { merchantNumber } = config();
  return cpayFetch<CPayCommunicationResult>(
    `/api/v2/communication/messages/${encodeURIComponent(reference)}?merchantNumber=${encodeURIComponent(merchantNumber)}`,
    { method: "GET" }
  );
}

export async function verifyCpayIdentity(input: {
  identityType?: string;
  identityNumber?: string;
  country?: string;
  /** Legacy NIN field retained while CPay providers migrate to the generic identity contract. */
  nin?: string;
  fullName?: string | null;
  msisdn?: string | null;
  consentGranted: boolean;
  requestedBy?: string;
}) {
  const { merchantNumber } = config();
  const identityType = (input.identityType || (input.nin ? "NIN" : "")).trim().toUpperCase();
  const identityNumber = (input.identityNumber || input.nin || "").trim().toUpperCase();
  const body = JSON.stringify({
    merchantNumber,
    identityType,
    identityNumber,
    country: input.country || "UG",
    ...(identityType === "NIN" ? { nin: identityNumber } : {}),
    fullName: input.fullName || undefined,
    msisdn: input.msisdn || undefined,
    consentGranted: input.consentGranted,
    requestedBy: input.requestedBy || "NOLI_VENDAZ",
  });
  return cpayFetch<CPayIdentityResult>("/api/v2/identity/verify", { method: "POST", body });
}

export async function getCpayIdentityStatus(reference: string) {
  const { merchantNumber } = config();
  return cpayFetch<CPayIdentityResult>(
    `/api/v2/identity/requests/${encodeURIComponent(reference)}?merchantNumber=${encodeURIComponent(merchantNumber)}`,
    { method: "GET" }
  );
}
