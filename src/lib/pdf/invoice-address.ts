export type InvoiceAddress = {
  address1?: string;
  address2?: string;
  city?: string;
  zip?: string;
  province?: string;
  country?: string;
  countryCode?: string;
} | null | undefined;

const US_STATES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function expandUsState(province: string): string {
  const raw = clean(province);
  if (!raw) return "";
  if (raw.length === 2) return US_STATES[raw.toUpperCase()] || raw;
  return raw;
}

function expandCountry(country: string, countryCode: string): string {
  const code = clean(countryCode || country).toUpperCase();
  if (
    code === "US" ||
    code === "USA" ||
    code === "UNITED STATES" ||
    code === "UNITED STATES OF AMERICA"
  ) {
    return "United States";
  }
  return clean(country) || clean(countryCode);
}

export function formatInvoiceAddressLines(
  kind: "billing" | "shipping",
  addr: InvoiceAddress,
): string[] {
  const label = kind === "billing" ? "Billing address" : "Shipping address";
  if (!addr) return [label, "-"];

  const street = [addr.address1, addr.address2].map(clean).filter(Boolean).join(", ");
  const cityLine = [clean(addr.city), expandUsState(addr.province || ""), clean(addr.zip)]
    .filter(Boolean)
    .join(" ");
  const country = expandCountry(addr.country || "", addr.countryCode || "");

  const lines = [label, street, cityLine, country].filter(Boolean);
  return lines.length > 1 ? lines : [label, "-"];
}
