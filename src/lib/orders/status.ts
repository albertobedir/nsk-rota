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

export type OrderStatusInfo = {
  cancelled: boolean;
  cancelReason: string | null;
  paymentKey: string;
  paymentLabel: string;
  paymentTone: StatusTone;
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
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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
  const financial = String(
    order?.financialStatus || order?.raw?.financial_status || "",
  ).toLowerCase();

  return Boolean(
    order?.cancelledAt ||
      order?.raw?.cancelled_at ||
      order?.raw?.cancelledAt ||
      order?.cancelReason ||
      order?.raw?.cancel_reason ||
      financial === "voided",
  );
}

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Pending",
  authorized: "Authorized",
  partially_paid: "Partially Paid",
  paid: "Paid",
  partially_refunded: "Partially Refunded",
  refunded: "Refunded",
  voided: "Voided",
  expired: "Expired",
};

const SHIPMENT_LABELS: Record<string, string> = {
  unfulfilled: "Unfulfilled",
  pending: "Pending Shipment",
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
  fulfilled: "Shipped",
  partial: "Partially Shipped",
  partially_fulfilled: "Partially Shipped",
  failure: "Delivery Failed",
  delayed: "Delayed",
  not_delivered: "Not Delivered",
  restocked: "Restocked",
  on_hold: "On Hold",
  scheduled: "Scheduled",
  in_progress: "In Progress",
};

const PAYMENT_TONES: Record<string, StatusTone> = {
  paid: "success",
  pending: "warning",
  authorized: "info",
  partially_paid: "warning",
  refunded: "neutral",
  partially_refunded: "neutral",
  voided: "danger",
  expired: "danger",
};

const SHIPMENT_TONES: Record<string, StatusTone> = {
  delivered: "success",
  shipped: "success",
  fulfilled: "success",
  picked_up: "success",
  in_transit: "info",
  out_for_delivery: "info",
  confirmed: "info",
  ready_for_pickup: "info",
  unfulfilled: "neutral",
  pending: "warning",
  partial: "warning",
  partially_fulfilled: "warning",
  attempted_delivery: "warning",
  delayed: "warning",
  failure: "danger",
  not_delivered: "danger",
  restocked: "neutral",
  on_hold: "warning",
};

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

export function getFinancialStatusKey(order: any): string {
  return normalizeKey(
    firstString(
      order?.paymentKey,
      order?.financialStatus,
      order?.raw?.financial_status,
      order?.raw?.displayFinancialStatus,
    ),
  );
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
      f?.status === "success" || f?.status === "SUCCESS" ? "shipped" : f?.status,
    ),
  );
  if (key === "success" || key === "fulfilled") return "shipped";
  return key;
}

export function extractOrderTrackings(order: any): OrderTracking[] {
  const fulfillments = fulfillmentRecords(order);
  const rows: OrderTracking[] = fulfillments.flatMap((f: any) => {
    const hasTracking = Boolean(
      f?.tracking_number ||
        (Array.isArray(f?.tracking_numbers) && f.tracking_numbers.some(Boolean)) ||
        (Array.isArray(f?.trackingInfo) && f.trackingInfo.length > 0),
    );
    const shipmentKey =
      fulfillmentShipmentKey(f) || (hasTracking ? "shipped" : "");
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

  const shipmentKey = getShipmentStatusKeyFromOrder(order, []);
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

const SHIPMENT_PRIORITY = [
  "delivered",
  "out_for_delivery",
  "in_transit",
  "attempted_delivery",
  "ready_for_pickup",
  "picked_up",
  "confirmed",
  "failure",
  "delayed",
  "not_delivered",
  "label_printed",
  "label_purchased",
  "shipped",
  "fulfilled",
  "partial",
  "partially_fulfilled",
];

function getShipmentStatusKeyFromOrder(
  order: any,
  trackings: OrderTracking[],
): string {
  const trackingKeys = trackings
    .map((t) => t.shipmentKey)
    .filter(Boolean)
    .map(normalizeKey);

  for (const key of SHIPMENT_PRIORITY) {
    if (trackingKeys.includes(key)) return key === "fulfilled" ? "shipped" : key;
  }

  const fulfillment = normalizeKey(
    firstString(
      order?.shipmentKey,
      order?.fulfillmentStatus,
      order?.raw?.fulfillment_status,
      order?.raw?.displayFulfillmentStatus,
    ),
  );

  if (fulfillment === "fulfilled" || fulfillment === "success") return "shipped";
  if (fulfillment === "null") return trackings.length ? "shipped" : "unfulfilled";
  if (!fulfillment) return trackings.length ? "shipped" : "unfulfilled";
  return fulfillment;
}

export function getShipmentStatusKey(order: any): string {
  return getShipmentStatusKeyFromOrder(order, extractOrderTrackings(order));
}

export function getOrderStatusInfo(order: any): OrderStatusInfo {
  const cancelled = isOrderCancelled(order);
  const paymentKey = getFinancialStatusKey(order);
  const trackings = extractOrderTrackings(order);
  const shipmentKey = getShipmentStatusKeyFromOrder(order, trackings);

  return {
    cancelled,
    cancelReason: formatCancelReason(
      firstString(order?.cancelReason, order?.raw?.cancel_reason) || null,
    ),
    paymentKey,
    paymentLabel: formatStatusLabel(paymentKey, PAYMENT_LABELS),
    paymentTone: PAYMENT_TONES[paymentKey] || "neutral",
    shipmentKey,
    shipmentLabel: formatStatusLabel(shipmentKey, SHIPMENT_LABELS),
    shipmentTone: SHIPMENT_TONES[shipmentKey] || "neutral",
    trackings,
  };
}

export function formatOrderStatus(order: any): string {
  if (isOrderCancelled(order)) return "Cancelled";

  const info = getOrderStatusInfo(order);
  const parts = [info.paymentLabel, info.shipmentLabel].filter(
    (part) => part && part !== "-",
  );
  return parts.length ? parts.join(" · ") : "-";
}

export function isPaymentComplete(paymentKey: string): boolean {
  return ["paid", "partially_paid", "partially_refunded", "refunded"].includes(
    paymentKey,
  );
}

export function isShipped(shipmentKey: string): boolean {
  return [
    "shipped",
    "fulfilled",
    "partial",
    "partially_fulfilled",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "confirmed",
    "ready_for_pickup",
    "picked_up",
    "attempted_delivery",
  ].includes(shipmentKey);
}

export function isDelivered(shipmentKey: string): boolean {
  return shipmentKey === "delivered" || shipmentKey === "picked_up";
}
