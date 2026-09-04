import { generateInvoicePdf, InvoicePdfError } from "@/lib/pdf/generate-invoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const customerId = url.searchParams.get("customerId");

    const { buffer, filename } = await generateInvoicePdf({
      orderId: id || "",
      customerId,
    });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  } catch (err: unknown) {
    const status = err instanceof InvoicePdfError ? err.status : 500;
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
