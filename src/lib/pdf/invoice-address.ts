export type InvoiceAddress = {
  name?: string;
  company?: string;
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

export function isSupplierCompanyName(value: unknown): boolean {
  return /rota\s*north\s*america/i.test(clean(value));
}

export function isSupplierAddress(addr: InvoiceAddress): boolean {
  if (!addr) return false;
  const street = [addr.address1, addr.address2].map(clean).join(" ").toLowerCase();
  const company = clean(addr.company).toLowerCase();
  const blob = `${street} ${clean(addr.city)} ${clean(addr.zip)}`.toLowerCase();
  return (
    isSupplierCompanyName(company) ||
    street.includes("martingale") ||
    blob.includes("10 n martingale")
  );
}

export function normalizeInvoiceAddress(addr: any): InvoiceAddress {
  if (!addr || typeof addr !== "object") return null;

  const name = clean(
    addr.name ||
      [addr.firstName || addr.first_name, addr.lastName || addr.last_name]
        .filter(Boolean)
        .join(" "),
  );
  const company = clean(addr.company || addr.companyName);
  const address1 = clean(
    addr.address1 || addr.addressLine1 || addr.line1 || addr.street,
  );
  const address2 = clean(
    addr.address2 || addr.addressLine2 || addr.line2,
  );
  const city = clean(addr.city);
  const zip = clean(addr.zip || addr.zipCode || addr.postalCode);
  const province = clean(
    addr.province ||
      addr.provinceCode ||
      addr.province_code ||
      addr.zoneCode ||
      addr.state,
  );
  const country = clean(
    addr.country || addr.country_name || addr.countryName,
  );
  const countryCode = clean(
    addr.country_code || addr.countryCode || addr.countryCodeV2,
  );

  if (!name && !company && !address1 && !city && !zip) return null;

  return {
    name: name || undefined,
    company: company || undefined,
    address1: address1 || undefined,
    address2: address2 || undefined,
    city: city || undefined,
    zip: zip || undefined,
    province: province || undefined,
    country: country || undefined,
    countryCode: countryCode || undefined,
  };
}

export function withCustomerCompany(
  addr: InvoiceAddress,
  companyName?: string | null,
): InvoiceAddress {
  if (!addr && !companyName) return null;
  const company = [addr?.company, companyName].find(
    (value) => value && !isSupplierCompanyName(value),
  );
  const next = {
    ...(addr || {}),
    company: company || undefined,
  };
  return normalizeInvoiceAddress(next);
}

export function firstCustomerAddress(
  ...candidates: unknown[]
): InvoiceAddress {
  for (const candidate of candidates) {
    const addr = normalizeInvoiceAddress(candidate);
    if (!addr) continue;
    if (isSupplierAddress(addr)) continue;
    if (!addr.address1 && !addr.city && !addr.company) continue;
    return addr;
  }
  return null;
}

export function formatInvoiceAddressLines(addr: InvoiceAddress): string[] {
  if (!addr) return ["-"];

  const company = isSupplierCompanyName(addr.company) ? "" : clean(addr.company);
  const name = clean(addr.name);
  const street = [addr.address1, addr.address2].map(clean).filter(Boolean).join(", ");
  const cityLine = [clean(addr.city), expandUsState(addr.province || ""), clean(addr.zip)]
    .filter(Boolean)
    .join(" ");
  const country = expandCountry(addr.country || "", addr.countryCode || "");

  const lines = [company || name, street, cityLine, country].filter(Boolean);
  return lines.length ? lines : ["-"];
}
