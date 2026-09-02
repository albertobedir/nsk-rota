/* eslint-disable @typescript-eslint/no-explicit-any */

export type StatusTone = "success" | "warning" | "info" | "danger" | "neutral";

export type OrderTracking = {
  company: string | null;
  number: string | null;
  url: string | null;
  shipmentKey: string;
  shipmentLabel: string;
  shipmentTone: StatusTone;
  createdAt: string | null;
};

export type StatusBadgeInfo = {
  label: string;
  tone: StatusTone;
};

export type OrderStatusInfo = {
  cancelled: boolean;
  cancelReason: string | null;
  paymentKey: string;
  paymentLabel: string;
  paymentTone: StatusTone;
  paymentWarning: StatusBadgeInfo | null;
  unpaid: boolean;
  shipmentKey: string;
  shipmentLabel: string;
  shipmentTone: StatusTone;
  trackings: OrderTracking[];
};

function firstString(...vals: unknown[]): string {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s && s !== "null" && s !== "undefined") return s;
  }
  return "";
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseOrderTags(order: any): string[] {
  const raw = order?.tags ?? order?.raw?.tags;
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

export function isOrderCancelled(order: any): boolean {
  return Boolean(
    order?.cancelledAt ||
      order?.raw?.cancelled_at ||
      order?.raw?.cancelledAt ||
      order?.cancelReason ||
      order?.raw?.cancel_reason,
  );
}

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Pending",
  authorized: "Authorized",
  expiring: "Expiring",
  expired: "Expired",
  due: "Due",
  paid: "Paid",
  partially_paid: "Partially paid",
  voided: "Voided",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  unpaid: "Unpaid",
};

const SHIPMENT_LABELS: Record<string, string> = {
  unfulfilled: "Unfulfilled",
  in_progress: "In progress",
  pending_fulfillment: "In progress",
  open: "In progress",
  pending: "In progress",
  on_hold: "On hold",
  scheduled: "Scheduled",
  partially_fulfilled: "Partially fulfilled",
  partial: "Partially fulfilled",
  fulfilled: "Fulfilled",
  restocked: "Fulfillment not required",
  fulfillment_not_required: "Fulfillment not required",
  request_declined: "On hold",
  // Carrier / tracking-level statuses
  label_printed: "Label Printed",
  label_purchased: "Label Purchased",
  confirmed: "Confirmed",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  attempted_delivery: "Attempted Delivery",
  ready_for_pickup: "Ready for Pickup",
  picked_up: "Picked Up",
  delivered: "Delivered",
  shipped: "Shipped",
  failure: "Delivery Failed",
  delayed: "Delayed",
  not_delivered: "Not Delivered",
};

const PAYMENT_TONES: Record<string, StatusTone> = {
  paid: "success",
  pending: "warning",
  authorized: "info",
  expiring: "warning",
  due: "danger",
  expired: "danger",
  partially_paid: "warning",
  refunded: "neutral",
  partially_refunded: "neutral",
  voided: "danger",
  unpaid: "warning",
};

const SHIPMENT_TONES: Record<string, StatusTone> = {
  fulfilled: "success",
  delivered: "success",
  shipped: "success",
  picked_up: "success",
  in_progress: "info",
  pending_fulfillment: "info",
  in_transit: "info",
  out_for_delivery: "info",
  confirmed: "info",
  ready_for_pickup: "info",
  scheduled: "info",
  unfulfilled: "neutral",
  fulfillment_not_required: "neutral",
  restocked: "neutral",
  pending: "warning",
  open: "warning",
  partially_fulfilled: "warning",
  partial: "warning",
  on_hold: "warning",
  attempted_delivery: "warning",
  delayed: "warning",
  failure: "danger",
  not_delivered: "danger",
  request_declined: "danger",
};

const UNPAID_KEYS = new Set([
  "pending",
  "authorized",
  "expired",
  "partially_paid",
  "due",
  "expiring",
  "unpaid",
]);

export function formatCancelReason(reason?: string | null): string | null {
  if (!reason) return null;
  const map: Record<string, string> = {
    customer: "Customer request",
    fraud: "Fraud",
    inventory: "Inventory",
    declined: "Payment declined",
    other: "Other",
  };
  const key = reason.toLowerCase();
  return map[key] || reason;
}

export function formatStatusLabel(
  key: string,
  labels: Record<string, string>,
): string {
  if (!key) return "-";
  return labels[key] || titleCase(key);
}

export function getShipmentTone(key: string): StatusTone {
  return SHIPMENT_TONES[key] || "neutral";
}

export function getPaymentTone(key: string): StatusTone {
  return PAYMENT_TONES[key] || "neutral";
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function paymentSchedules(order: any): any[] {
  const raw = order?.raw || {};
  const terms =
    order?.paymentTerms ||
    raw.payment_terms ||
    raw.paymentTerms ||
    null;
  const schedules =
    terms?.paymentSchedules ||
    terms?.payment_schedules ||
    order?.paymentSchedules ||
    [];
  return Array.isArray(schedules)
    ? schedules
    : Array.isArray(schedules?.nodes)
      ? schedules.nodes
      : Array.isArray(schedules?.edges)
        ? schedules.edges.map((e: any) => e?.node).filter(Boolean)
        : [];
}

function isPaymentDue(order: any, paymentKey: string): boolean {
  if (!UNPAID_KEYS.has(paymentKey) && paymentKey !== "authorized") return false;
  if (["paid", "refunded", "partially_refunded", "voided"].includes(paymentKey)) {
    return false;
  }

  const now = Date.now();
  return paymentSchedules(order).some((schedule) => {
    if (schedule?.completedAt || schedule?.completed_at) return false;
    const dueAt = parseDate(schedule?.dueAt || schedule?.due_at);
    return Boolean(dueAt && dueAt.getTime() <= now);
  });
}

function authorizationExpiresAt(order: any): Date | null {
  const raw = order?.raw || {};
  const transactions: any[] = Array.isArray(raw.transactions)
    ? raw.transactions
    : Array.isArray(order?.transactions)
      ? order.transactions
      : Array.isArray(raw.transactions?.nodes)
        ? raw.transactions.nodes
        : Array.isArray(raw.transactions?.edges)
          ? raw.transactions.edges.map((e: any) => e?.node).filter(Boolean)
          : Array.isArray(order?.transactions?.edges)
            ? order.transactions.edges.map((e: any) => e?.node).filter(Boolean)
            : [];

  for (const tx of transactions) {
    const kind = String(tx?.kind || "").toLowerCase();
    const status = String(tx?.status || "").toLowerCase();
    if (kind !== "authorization") continue;
    if (status && status !== "success") continue;
    const expires = parseDate(
      tx?.authorizationExpiresAt ||
        tx?.authorization_expires_at ||
        tx?.expiresAt ||
        tx?.expires_at,
    );
    if (expires) return expires;
  }
  return null;
}

function isAuthorizationExpiring(order: any, paymentKey: string): boolean {
  if (paymentKey !== "authorized") return false;
  const expires = authorizationExpiresAt(order);
  if (!expires) return false;
  const msLeft = expires.getTime() - Date.now();
  const twoDays = 2 * 24 * 60 * 60 * 1000;
  return msLeft > 0 && msLeft <= twoDays;
}

export function getFinancialStatusKey(order: any): string {
  const stored = normalizeKey(
    firstString(
      order?.financialStatus,
      order?.raw?.financial_status,
      order?.displayFinancialStatus,
      order?.raw?.displayFinancialStatus,
    ),
  );

  if (isPaymentDue(order, stored || "pending")) return "due";
  return stored;
}

function fulfillmentRecords(order: any): any[] {
  const raw = order?.raw || {};
  if (Array.isArray(raw.fulfillments)) return raw.fulfillments;
  if (Array.isArray(order?.fulfillments)) return order.fulfillments;
  if (Array.isArray(raw.fulfillments?.nodes)) return raw.fulfillments.nodes;
  if (Array.isArray(raw.fulfillments?.edges)) {
    return raw.fulfillments.edges.map((e: any) => e?.node).filter(Boolean);
  }
  return [];
}

function fulfillmentShipmentKey(f: any): string {
  const key = normalizeKey(
    firstString(
      f?.shipment_status,
      f?.shipmentStatus,
      f?.displayStatus,
      f?.status === "success" || f?.status === "SUCCESS" ? "in_transit" : f?.status,
    ),
  );
  if (key === "success") return "in_transit";
  return key;
}

export function extractOrderTrackings(order: any): OrderTracking[] {
  const fulfillments = fulfillmentRecords(order);
  const rows: OrderTracking[] = fulfillments.flatMap((f: any) => {
    const hasTracking = Boolean(
      f?.tracking_number ||
        (Array.isArray(f?.tracking_numbers) &&
          f.tracking_numbers.some(Boolean)) ||
        (Array.isArray(f?.trackingInfo) && f.trackingInfo.length > 0),
    );
    const shipmentKey =
      fulfillmentShipmentKey(f) || (hasTracking ? "in_transit" : "");
    const createdAt =
      firstString(
        f?.deliveredAt,
        f?.delivered_at,
        f?.inTransitAt,
        f?.updated_at,
        f?.created_at,
        f?.createdAt,
      ) || null;
    const shipmentLabel = formatStatusLabel(shipmentKey, SHIPMENT_LABELS);
    const shipmentTone = getShipmentTone(shipmentKey);

    if (Array.isArray(f?.trackingInfo) && f.trackingInfo.length > 0) {
      return f.trackingInfo.map((t: any) => ({
        company: t.company || f.trackingCompany || f.tracking_company || null,
        number: t.number || null,
        url: t.url || null,
        shipmentKey,
        shipmentLabel,
        shipmentTone,
        createdAt,
      }));
    }

    const numbers = (
      Array.isArray(f?.tracking_numbers) && f.tracking_numbers.length
        ? f.tracking_numbers
        : [f?.tracking_number]
    ).filter(Boolean);
    const urls = Array.isArray(f?.tracking_urls)
      ? f.tracking_urls
      : [f?.tracking_url];

    if (numbers.length === 0) return [];

    return numbers.map((number: string, i: number) => ({
      company: f.tracking_company || f.trackingCompany || null,
      number,
      url: urls[i] || f.tracking_url || f.trackingUrl || null,
      shipmentKey,
      shipmentLabel,
      shipmentTone,
      createdAt,
    }));
  });

  if (rows.length > 0) return rows;

  const fallbackNumber = firstString(
    order?.trackingNumber,
    order?.tracking,
    order?.raw?.trackingNumber,
  );
  if (!fallbackNumber) return [];

  const shipmentKey = getOrderFulfillmentKey(order);
  return [
    {
      company: firstString(order?.trackingCompany, order?.warehouse) || null,
      number: fallbackNumber,
      url: firstString(order?.trackingUrl) || null,
      shipmentKey,
      shipmentLabel: formatStatusLabel(shipmentKey, SHIPMENT_LABELS),
      shipmentTone: getShipmentTone(shipmentKey),
      createdAt: null,
    },
  ];
}

function getOrderFulfillmentKey(order: any): string {
  const cancelled = isOrderCancelled(order);
  const paymentKey = normalizeKey(
    firstString(
      order?.financialStatus,
      order?.raw?.financial_status,
      order?.displayFinancialStatus,
      order?.raw?.displayFinancialStatus,
    ),
  );
  const fulfillment = normalizeKey(
    firstString(
      order?.fulfillmentStatus,
      order?.displayFulfillmentStatus,
      order?.raw?.fulfillment_status,
      order?.raw?.displayFulfillmentStatus,
    ),
  );

  const mapped =
    fulfillment === "partial"
      ? "partially_fulfilled"
      : fulfillment === "pending_fulfillment" ||
          fulfillment === "open" ||
          fulfillment === "pending"
        ? "in_progress"
        : fulfillment === "restocked"
          ? "fulfillment_not_required"
          : fulfillment;

  const notRequired =
    mapped === "fulfillment_not_required" ||
    ((cancelled || paymentKey === "refunded") &&
      (!mapped || mapped === "unfulfilled"));

  if (notRequired) return "fulfillment_not_required";
  if (!mapped) return "unfulfilled";
  return mapped;
}

export function getShipmentStatusKey(order: any): string {
  return getOrderFulfillmentKey(order);
}

export function getOrderStatusInfo(order: any): OrderStatusInfo {
  const cancelled = isOrderCancelled(order);
  const paymentKey = getFinancialStatusKey(order);
  const trackings = extractOrderTrackings(order);
  const shipmentKey = getOrderFulfillmentKey(order);
  const expiring = isAuthorizationExpiring(order, paymentKey);

  return {
    cancelled,
    cancelReason: formatCancelReason(
      firstString(order?.cancelReason, order?.raw?.cancel_reason) || null,
    ),
    paymentKey,
    paymentLabel: formatStatusLabel(paymentKey, PAYMENT_LABELS),
    paymentTone: PAYMENT_TONES[paymentKey] || "neutral",
    paymentWarning: expiring
      ? { label: "Expiring", tone: "warning" }
      : null,
    unpaid: UNPAID_KEYS.has(paymentKey),
    shipmentKey,
    shipmentLabel: formatStatusLabel(shipmentKey, SHIPMENT_LABELS),
    shipmentTone: SHIPMENT_TONES[shipmentKey] || "neutral",
    trackings,
  };
}

export function formatOrderStatus(order: any): string {
  const info = getOrderStatusInfo(order);
  const parts = [
    info.cancelled ? "Cancelled" : "",
    info.paymentLabel,
    info.paymentWarning?.label || "",
    info.shipmentLabel,
  ].filter((part) => part && part !== "-");
  return parts.length ? parts.join(" · ") : "-";
}

export function isPaymentComplete(paymentKey: string): boolean {
  return ["paid", "partially_refunded", "refunded"].includes(paymentKey);
}

export function isUnpaid(paymentKey: string): boolean {
  return UNPAID_KEYS.has(paymentKey);
}

export function canCollectPayment(info: OrderStatusInfo): boolean {
  if (info.cancelled) return false;
  return ["pending", "due", "expired", "partially_paid"].includes(
    info.paymentKey,
  );
}

export function isShipped(shipmentKey: string): boolean {
  return [
    "fulfilled",
    "partially_fulfilled",
    "partial",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "confirmed",
    "ready_for_pickup",
    "picked_up",
    "attempted_delivery",
    "shipped",
  ].includes(shipmentKey);
}

export function isDelivered(shipmentKey: string): boolean {
  return shipmentKey === "delivered" || shipmentKey === "picked_up";
}
