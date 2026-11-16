import { toast } from "sonner";

export const REQUESTED_PRODUCTS_KEY = "requested_products";

export function markProductRequested(term: string) {
  const code = String(term ?? "").trim();
  if (!code) return;
  try {
    const list: string[] = JSON.parse(
      localStorage.getItem(REQUESTED_PRODUCTS_KEY) ?? "[]",
    );
    if (!list.map((s) => s.toLowerCase()).includes(code.toLowerCase())) {
      list.push(code);
      localStorage.setItem(REQUESTED_PRODUCTS_KEY, JSON.stringify(list));
    }
  } catch {
    /* ignore */
  }
}

export async function submitProductRequest(payload: Record<string, unknown>) {
  const toastId = toast.loading("Sending request...");
  try {
    const resp = await fetch("/api/requests/product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      toast.error("Failed to submit request", { id: toastId });
      return false;
    }
    toast.success("Request submitted", { id: toastId });
    return true;
  } catch (e) {
    console.error(e);
    toast.error("Failed to submit request", { id: toastId });
    return false;
  }
}
