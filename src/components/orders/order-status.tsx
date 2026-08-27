"use client";

import { cn } from "@/lib/utils";
import {
  isDelivered,
  isPaymentComplete,
  isShipped,
  type OrderStatusInfo,
  type StatusTone,
} from "@/lib/orders/status";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  info: "bg-sky-100 text-sky-800",
  danger: "bg-red-100 text-red-700",
  neutral: "bg-slate-100 text-slate-700",
};

export function StatusBadge({
  label,
  tone,
  className,
}: {
  label: string;
  tone: StatusTone;
  className?: string;
}) {
  if (!label || label === "-") return <span className="text-slate-500">-</span>;

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function OrderStatusBadges({
  info,
  stacked = false,
}: {
  info: OrderStatusInfo;
  stacked?: boolean;
}) {
  if (info.cancelled) {
    return (
      <div className={cn("flex flex-wrap gap-1.5", stacked && "flex-col items-start")}>
        <StatusBadge label="Cancelled" tone="danger" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", stacked && "flex-col items-start")}>
      <StatusBadge label={info.paymentLabel} tone={info.paymentTone} />
      <StatusBadge label={info.shipmentLabel} tone={info.shipmentTone} />
    </div>
  );
}

export function OrderProgress({ info }: { info: OrderStatusInfo }) {
  if (info.cancelled) return null;

  const steps = [
    { key: "ordered", label: "Ordered", done: true },
    {
      key: "paid",
      label: info.paymentKey === "pending" ? "Paid" : info.paymentLabel,
      done: isPaymentComplete(info.paymentKey),
    },
    {
      key: "shipped",
      label: "Shipped",
      done: isShipped(info.shipmentKey),
    },
    {
      key: "delivered",
      label: "Delivered",
      done: isDelivered(info.shipmentKey),
    },
  ];

  const currentIndex = steps.reduce(
    (acc, step, index) => (step.done ? index : acc),
    0,
  );

  return (
    <div className="mb-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="mb-3 text-sm font-semibold text-slate-700">
        Order & shipment progress
      </div>
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {steps.map((step, index) => {
          const active = index === currentIndex && !steps[steps.length - 1].done;
          return (
            <li key={step.key} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  step.done
                    ? "bg-emerald-600 text-white"
                    : active
                      ? "bg-amber-500 text-white"
                      : "bg-slate-200 text-slate-500",
                )}
              >
                {step.done ? "✓" : index + 1}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  step.done
                    ? "text-emerald-800"
                    : active
                      ? "text-amber-800"
                      : "text-slate-500",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
