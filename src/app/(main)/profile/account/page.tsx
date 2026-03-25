"use client";
import { Card } from "@/components/ui/card";
import useSessionStore from "@/store/session-store";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const user = useSessionStore((s) => s.user);
  const router = useRouter();
  const clearSession = useSessionStore((s) => s.clearSession);

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Logout failed: ${response.status}`);
      }

      localStorage.clear();
      clearSession();
      router.push("/auth/login");
    } catch (e) {
      console.error("Logout failed:", e);
      clearSession();
      router.push("/auth/login");
    }
  };

  return (
    <div className="space-y-4 px-2 sm:px-0">
      <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Profile</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Account
            </h1>
            <div
              role="alert"
              className="mt-3 w-full flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white"
            >
              Important: To update your information, please contact a moderator.
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Account Information
          </h2>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <div>
              <div className="text-xs text-slate-500">Name</div>
              <div className="font-medium">
                {user
                  ? `${user.firstName ?? user.name ?? "-"} ${
                      user.lastName ?? ""
                    }`
                  : "-"}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Email</div>
              <div className="font-medium">{user?.email ?? "-"}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Phone</div>
              <div className="font-medium">{user?.phone ?? "-"}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Customer Code</div>
              <div className="font-medium">{user?.customerCode ?? "-"}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Delivery Terms</div>
              <div className="font-medium">{user?.deliveryTerms ?? "-"}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Payment Terms</div>
              <div className="font-medium">{user?.paymentTerms ?? "-"}</div>
            </div>
          </div>

          {/* Logout Button */}
          <div className="mt-6 pt-4 border-t border-slate-200">
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-red-600 hover:text-red-700 hover:underline transition-colors"
            >
              Logout
            </button>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-slate-900">Addresses</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            {/* Try common address fields if present on user object */}
            <div>
              <div className="text-xs text-slate-500">Billing Address</div>
              <div className="font-medium wrap-break-word">
                {user?.billingAddress?.line1 ?? user?.addressLine1 ?? "-"}
              </div>
              <div className="text-sm text-slate-500">
                {user?.billingAddress?.city ?? user?.city ?? ""}
                {user?.billingAddress?.zip
                  ? `, ${user?.billingAddress?.zip}`
                  : ""}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Shipping Address</div>
              <div className="font-medium wrap-break-word">
                {user?.shippingAddress?.line1 ?? user?.addressLine2 ?? "-"}
              </div>
              <div className="text-sm text-slate-500">
                {user?.shippingAddress?.city ?? user?.city ?? ""}
                {user?.shippingAddress?.zip
                  ? `, ${user?.shippingAddress?.zip}`
                  : ""}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
