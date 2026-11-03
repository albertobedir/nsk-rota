import { connectDB } from "@/lib/mongoose/instance";
import ShippingPackage from "@/schemas/mongoose/shipping-package";

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

const BUILTIN_PACKAGES: CatalogPackage[] = [
  {
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
];

function normalizePackageName(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function matchesCode(pkg: { code: string; name: string }, code: string) {
  const needle = normalizePackageName(code);
  return (
    pkg.code.trim() === code.trim() ||
    pkg.name.trim() === code.trim() ||
    normalizePackageName(pkg.code) === needle ||
    normalizePackageName(pkg.name) === needle
  );
}

async function persistBuiltinCatalog() {
  try {
    await connectDB();
    await Promise.all(
      BUILTIN_PACKAGES.map((pkg) =>
        ShippingPackage.updateOne(
          { code: pkg.code },
          { $setOnInsert: pkg },
          { upsert: true },
        ),
      ),
    );
  } catch (err) {
    console.warn("Kutu kataloğu Mongo'ya yazılamadı:", err);
  }
}

export async function resolveCatalogPackage(
  packageCode: string,
): Promise<CatalogPackage> {
  const code = String(packageCode ?? "").trim();
  if (!code) {
    throw new PackageCodeError("PackageCode boş olamaz");
  }

  const builtin = BUILTIN_PACKAGES.find((pkg) => matchesCode(pkg, code));
  if (builtin) {
    void persistBuiltinCatalog();
    return builtin;
  }

  try {
    await persistBuiltinCatalog();
    const docs = await ShippingPackage.find({}).lean();
    const found = docs.find((pkg) => matchesCode(pkg, code));
    if (found) {
      return {
        code: found.code,
        name: found.name,
        type: found.type,
        length: found.length,
        width: found.width,
        height: found.height,
        dimensionUnit: found.dimensionUnit,
        emptyWeight: found.emptyWeight ?? null,
        weightUnit: found.weightUnit ?? null,
      };
    }
    const known = [
      ...BUILTIN_PACKAGES.map((pkg) => pkg.code),
      ...docs.map((pkg) => pkg.code),
    ]
      .filter((value, index, all) => all.indexOf(value) === index)
      .join(", ");
    throw new PackageCodeError(
      `PackageCode "${code}" kutu kataloğunda yok. Kayıtlı kodlar: ${known}`,
    );
  } catch (err) {
    if (err instanceof PackageCodeError) throw err;
    throw new PackageCodeError(
      `PackageCode "${code}" kutu kataloğunda yok. Kayıtlı kodlar: ${BUILTIN_PACKAGES.map((pkg) => pkg.code).join(", ")}`,
    );
  }
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
