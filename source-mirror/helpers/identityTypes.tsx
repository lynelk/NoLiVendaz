export type IdentityDocumentType = "NIN" | "PASSPORT" | "REFUGEE_ID" | "ALIEN_ID" | "DRIVER_LICENCE";

export type IdentityTypeDefinition = {
  type: IdentityDocumentType;
  label: string;
  shortLabel: string;
  country: string;
  minLength: number;
  maxLength: number;
  placeholder: string;
  description: string;
};

export const identityTypeDefinitions: IdentityTypeDefinition[] = [
  {
    type: "NIN",
    label: "National Identification Number (NIN)",
    shortLabel: "National ID",
    country: "UG",
    minLength: 14,
    maxLength: 14,
    placeholder: "14-character NIN",
    description: "Uganda National Identification Number.",
  },
  {
    type: "PASSPORT",
    label: "Passport",
    shortLabel: "Passport",
    country: "UG",
    minLength: 6,
    maxLength: 12,
    placeholder: "Passport number",
    description: "Passport number using letters and numbers as printed on the document.",
  },
  {
    type: "REFUGEE_ID",
    label: "Refugee identification",
    shortLabel: "Refugee ID",
    country: "UG",
    minLength: 6,
    maxLength: 20,
    placeholder: "Refugee ID number",
    description: "Refugee identification number issued or recognized for the customer.",
  },
  {
    type: "ALIEN_ID",
    label: "Alien / foreign national identification",
    shortLabel: "Alien ID",
    country: "UG",
    minLength: 6,
    maxLength: 20,
    placeholder: "Alien ID number",
    description: "Foreign-national or alien identification number recognized for the customer.",
  },
  {
    type: "DRIVER_LICENCE",
    label: "Driver's licence",
    shortLabel: "Driver's licence",
    country: "UG",
    minLength: 5,
    maxLength: 20,
    placeholder: "Licence number",
    description: "Driver's licence number as printed on the document.",
  },
];

export function getIdentityTypeDefinition(type: IdentityDocumentType) {
  return identityTypeDefinitions.find((definition) => definition.type === type) ?? identityTypeDefinitions[0];
}

export function validateIdentityDocument(type: IdentityDocumentType, value: string, country = "UG") {
  const definition = getIdentityTypeDefinition(type);
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  let formatValid = false;

  if (type === "NIN") formatValid = /^[A-Z0-9]{14}$/.test(normalized);
  else if (type === "PASSPORT") formatValid = /^[A-Z0-9]{6,12}$/.test(normalized);
  else formatValid = /^[A-Z0-9][A-Z0-9\-/]{4,19}$/.test(normalized);

  if (normalized.length < definition.minLength || normalized.length > definition.maxLength) formatValid = false;

  return {
    type,
    country: country.trim().toUpperCase() || definition.country,
    normalized,
    formatValid,
    message: formatValid
      ? `${definition.shortLabel} format accepted for verification.`
      : `Enter a valid ${definition.label.toLowerCase()} between ${definition.minLength} and ${definition.maxLength} characters using only the characters printed on the document.`,
  };
}
