import { generateKeyPairSync } from "node:crypto";
import {
  canonicalizeCpayV2Request,
  collectVendingPayment,
  createHostedCardCheckout,
  getCpayIdentityCapabilities,
  isPaymentFailed,
  isPaymentSuccessful,
  refundVendingDeposit,
  sendCpayCommunication,
  verifyCpayIdentity,
  sha256Hex,
} from "./cpayClient";

describe("cpayClient", () => {
  const env = process.env as unknown as Record<string, string | undefined>;
  const keyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKey = keyPair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  beforeEach(() => {
    env.CPAY_API_BASE_URL = "https://cpay.example";
    env.CPAY_MERCHANT_NUMBER = "NOLI001";
    env.CPAY_SIGNING_KEY_PEM = privateKey;
  });

  afterEach(() => {
    delete env.CPAY_API_BASE_URL;
    delete env.CPAY_MERCHANT_NUMBER;
    delete env.CPAY_SIGNING_KEY_PEM;
  });

  it("classifies authoritative payment states", () => {
    expect(isPaymentSuccessful("SUCCESS")).toBeTrue();
    expect(isPaymentSuccessful("pending")).toBeFalse();
    expect(isPaymentFailed("DECLINED")).toBeTrue();
  });

  it("builds the documented CPay v2 canonical string", () => {
    const canonical = canonicalizeCpayV2Request({
      method: "get",
      path: "/api/v2/balances",
      canonicalQuery: "merchantNumber=123",
      timestamp: "2026-07-03T08:00:00Z",
      nonce: "nonce-1",
      body: "",
    });
    expect(canonical).toBe([
      "GET",
      "/api/v2/balances",
      "merchantNumber=123",
      "2026-07-03T08:00:00Z",
      "nonce-1",
      sha256Hex(""),
    ].join("\n"));
  });

  it("collects with CPay v2 merchant and RSA-signature headers plus idempotency", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").and.resolveTo(new Response(JSON.stringify({ reference: "CP-1", status: "PENDING" }), { status: 202 }));
    await collectVendingPayment({ rentalReference: "VR-1", amount: 20000, payerPhone: "+256700000001", callbackUrl: "https://noli.example/callback" });
    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    expect(url).toBe("https://cpay.example/api/v2/native/payments/collect");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-CPay-Idempotency-Key"]).toBe("NOLI-VR-1-DEP");
    expect(headers["X-CPay-Merchant-Number"]).toBe("NOLI001");
    expect(headers["X-CPay-Signature-Version"]).toBe("v2");
    expect(headers["X-CPay-Timestamp"]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(headers["X-CPay-Nonce"]).toBeTruthy();
    expect(headers["X-CPay-Signature"]).toBeTruthy();
    expect(headers["X-CPay-Signature"]).not.toBe("test-signature");
    const body = JSON.parse(String(init.body));
    expect(body.payer.value).toBe("+256700000001");
    expect(body.amount).toBe("20000");
  });

  it("creates hosted card checkout without receiving PAN or CVV", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").and.resolveTo(new Response(JSON.stringify({ linkReference: "PL-1", checkoutUrl: "https://pay.example/token", status: "ACTIVE" }), { status: 201 }));
    const result = await createHostedCardCheckout({ rentalReference: "VR-2", amount: 40000, callbackUrl: "https://noli.example/callback" });
    expect(result.checkoutUrl).toBe("https://pay.example/token");
    const body = JSON.parse(String((fetchSpy.calls.mostRecent().args[1] as RequestInit).body));
    expect(body.cardNumber).toBeUndefined();
    expect(body.cvv).toBeUndefined();
  });

  it("routes refunds to the explicitly supplied registered phone", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").and.resolveTo(new Response(JSON.stringify({ reference: "RF-1", status: "PENDING" }), { status: 202 }));
    await refundVendingDeposit({ rentalReference: "VR-3", amount: 17500, refundPhone: "+256700000099", callbackUrl: "https://noli.example/callback" });
    const body = JSON.parse(String((fetchSpy.calls.mostRecent().args[1] as RequestInit).body));
    expect(body.payee.value).toBe("+256700000099");
  });

  it("enqueues OTP SMS through CPay Communications with merchant signing and idempotency", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").and.resolveTo(new Response(JSON.stringify({ messageReference: "COM-1", status: "RECEIVED" }), { status: 202 }));
    const result = await sendCpayCommunication({
      recipient: "+256700000001",
      content: "Verification code 123456",
      purpose: "OTP",
      externalReference: "NOLI-OTP-1",
      expiresInSeconds: 600,
    });
    expect(result.messageReference).toBe("COM-1");
    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    expect(url).toBe("https://cpay.example/api/v2/communication/messages");
    expect((init.headers as Record<string, string>)["X-CPay-Idempotency-Key"]).toBe("NOLI-OTP-1");
    const body = JSON.parse(String(init.body));
    expect(body.channel).toBe("SMS");
    expect(body.merchantNumber).toBe("NOLI001");
    expect(body.recipient).toBe("+256700000001");
  });

  it("submits identity verification through CPay Identity with explicit consent", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").and.resolveTo(new Response(JSON.stringify({ requestReference: "IDV-1", status: "VERIFIED" }), { status: 200 }));
    const result = await verifyCpayIdentity({
      nin: "CF123456789012",
      fullName: "Test Customer",
      msisdn: "+256700000001",
      consentGranted: true,
    });
    expect(result.status).toBe("VERIFIED");
    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    expect(url).toBe("https://cpay.example/api/v2/identity/verify");
    const body = JSON.parse(String(init.body));
    expect(body.merchantNumber).toBe("NOLI001");
    expect(body.consentGranted).toBeTrue();
    expect(body.requestedBy).toBe("NOLI_VENDAZ");
  });

  it("reads merchant identity-provider capabilities through the signed CPay v2 contract", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").and.resolveTo(new Response(JSON.stringify({
      merchantNumber: "NOLI001",
      providers: [{
        providerCode: "GNUGRID",
        supportsSync: true,
        supportsAsync: false,
        supportedIdentityTypes: ["NIN"],
        supportedCountries: ["UG"],
      }],
    }), { status: 200 }));
    const result = await getCpayIdentityCapabilities();
    expect(result.providers?.[0]?.supportedIdentityTypes).toEqual(["NIN"]);
    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    expect(url).toBe("https://cpay.example/api/v2/identity/capabilities?merchantNumber=NOLI001");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-CPay-Merchant-Number"]).toBe("NOLI001");
    expect(headers["X-CPay-Signature-Version"]).toBe("v2");
    expect(headers["X-CPay-Signature"]).toBeTruthy();
  });

  it("does not leak raw CPay server errors to callers", async () => {
    spyOn(globalThis, "fetch").and.resolveTo(new Response(JSON.stringify({ message: "database password=secret internal stack" }), { status: 503 }));
    await expectAsync(collectVendingPayment({ rentalReference: "VR-4", amount: 20000, payerPhone: "+256700000001", callbackUrl: "https://noli.example/callback" }))
      .toBeRejectedWithError(/temporarily unavailable/i);
  });

  it("rejects malformed successful CPay responses instead of assuming transaction state", async () => {
    spyOn(globalThis, "fetch").and.resolveTo(new Response("not-json", { status: 200 }));
    await expectAsync(collectVendingPayment({ rentalReference: "VR-5", amount: 20000, payerPhone: "+256700000001", callbackUrl: "https://noli.example/callback" }))
      .toBeRejectedWithError(/unexpected response/i);
  });
});
