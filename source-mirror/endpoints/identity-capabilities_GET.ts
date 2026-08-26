import superjson from "superjson";
import { getServerUserSession } from "../helpers/getServerUserSession";
import { getCpayIdentityCapabilities, isCpayPrivateApiConfigured } from "../helpers/cpayClient";
import type { IdentityDocumentType } from "../helpers/identityTypes";
import type { IdentityProviderCapability, OutputType } from "./identity-capabilities_GET.schema";

const supportedTypes = new Set<IdentityDocumentType>(["NIN", "PASSPORT", "REFUGEE_ID", "ALIEN_ID", "DRIVER_LICENCE"]);

function cleanList(value: unknown, kind: "type" | "country") {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toUpperCase())
    .filter((item) => kind === "type" ? supportedTypes.has(item as IdentityDocumentType) : /^[A-Z]{2}$/.test(item))
  )].slice(0, 100);
}

export async function handle(request: Request) {
  const noStore = { "Cache-Control": "private, no-store, max-age=0" };
  try {
    await getServerUserSession(request);
    if (!isCpayPrivateApiConfigured()) {
      return new Response(superjson.stringify({ configured: false, providers: [] } satisfies OutputType), { headers: noStore });
    }
    const result = await getCpayIdentityCapabilities();
    const providers: IdentityProviderCapability[] = Array.isArray(result.providers)
      ? result.providers.slice(0, 50).map((provider) => ({
          providerCode: String(provider?.providerCode ?? "").trim().slice(0, 80),
          supportsSync: provider?.supportsSync === true,
          supportsAsync: provider?.supportsAsync === true,
          supportedIdentityTypes: cleanList(provider?.supportedIdentityTypes, "type"),
          supportedCountries: cleanList(provider?.supportedCountries, "country"),
        })).filter((provider) => provider.providerCode)
      : [];
    return new Response(superjson.stringify({ configured: true, providers } satisfies OutputType), { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to check identity-verification coverage";
    return new Response(superjson.stringify({ error: message }), { status: message.toLowerCase().includes("auth") ? 401 : 503, headers: noStore });
  }
}
