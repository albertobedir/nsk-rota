import { connectDB } from "@/lib/mongoose/instance";
import ShippingPackage, {
  IShippingPackage,
} from "@/schemas/mongoose/shipping-package";

export type CatalogPackage = {
  code: string;
  name: string;
  type: string;
  length: number;
  width: number;
  height: number;
  dimensionUnit: string;
  emptyWeight: number | null;
  weightUnit: string | null;
};

export type SavedPackageResult = {
  code: string;
  name: string;
  saved: true;
  shopifyAssigned: false;
  dimensions: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
};

export class PackageCodeError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PackageCodeError";
    this.status = status;
  }
}

function normalizePackageName(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function toCatalog(doc: IShippingPackage): CatalogPackage {
  return {
    code: doc.code,
    name: doc.name,
    type: doc.type,
    length: doc.length,
    width: doc.width,
    height: doc.height,
    dimensionUnit: doc.dimensionUnit,
    emptyWeight: doc.emptyWeight ?? null,
    weightUnit: doc.weightUnit ?? null,
  };
}

export async function ensureShippingPackageCatalog() {
  await connectDB();
  await ShippingPackage.updateOne(
    { code: "Pack001" },
    {
      $setOnInsert: {
        code: "Pack001",
        name: "Pack001",
        type: "box",
        length: 15,
        width: 12,
        height: 7,
        dimensionUnit: "cm",
        emptyWeight: null,
        weightUnit: null,
      },
    },
    { upsert: true },
  );
}

export async function resolveCatalogPackage(
  packageCode: string,
): Promise<CatalogPackage> {
  const code = String(packageCode ?? "").trim();
  if (!code) {
    throw new PackageCodeError("PackageCode boş olamaz");
  }

  await ensureShippingPackageCatalog();
  const needle = normalizePackageName(code);
  const docs = await ShippingPackage.find({}).lean();
  const found = docs.find(
    (pkg) =>
      pkg.code.trim() === code ||
      pkg.name.trim() === code ||
      normalizePackageName(pkg.code) === needle ||
      normalizePackageName(pkg.name) === needle,
  );

  if (!found) {
    const known = docs.map((pkg) => pkg.code).join(", ") || "(katalog boş)";
    throw new PackageCodeError(
      `PackageCode "${code}" kutu kataloğunda yok. Kayıtlı kodlar: ${known}`,
    );
  }

  return toCatalog(found as IShippingPackage);
}

export function packageMetafields(pkg: CatalogPackage) {
  return [
    {
      namespace: "custom",
      key: "package_code",
      type: "single_line_text_field",
      value: pkg.code,
    },
    {
      namespace: "custom",
      key: "package_info",
      type: "json",
      value: JSON.stringify({
        code: pkg.code,
        name: pkg.name,
        type: pkg.type,
        length: pkg.length,
        width: pkg.width,
        height: pkg.height,
        dimensionUnit: pkg.dimensionUnit,
        emptyWeight: pkg.emptyWeight,
        weightUnit: pkg.weightUnit,
      }),
    },
  ];
}

export function savedPackageResult(pkg: CatalogPackage): SavedPackageResult {
  return {
    code: pkg.code,
    name: pkg.name,
    saved: true,
    shopifyAssigned: false,
    dimensions: {
      length: pkg.length,
      width: pkg.width,
      height: pkg.height,
      unit: pkg.dimensionUnit,
    },
  };
}
