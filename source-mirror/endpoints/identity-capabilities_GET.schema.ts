import superjson from "superjson";

export type IdentityProviderCapability = {
  providerCode: string;
  supportsSync: boolean;
  supportsAsync: boolean;
  supportedIdentityTypes: string[];
  supportedCountries: string[];
};

export type OutputType = {
  configured: boolean;
  providers: IdentityProviderCapability[];
};

export async function getIdentityCapabilities(init?: RequestInit): Promise<OutputType> {
  const response = await fetch("/_api/identity-capabilities", { method: "GET", ...init });
  if (!response.ok) throw new Error("Unable to check identity-verification coverage.");
  return superjson.parse<OutputType>(await response.text());
}
