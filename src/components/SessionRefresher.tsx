"use client";

import { useEffect, useCallback } from "react";
import { auth } from "@/lib/axios/auth";
import useSessionStore from "@/store/session-store";
import { invalidatePricingTiersCache } from "@/components/single-prod-cart";

export default function SessionRefresher() {
  const refresh = useCallback(async () => {
    // The DB is the authoritative source for tier/tags (kept in sync by webhook).
    // getSession reads from DB and sets customerTags + tierTag in the store.
    // We must NOT re-fetch tags from Shopify storefront afterwards because
    // Shopify's cached tags may be stale and would overwrite the correct DB values.
    let sessionHasUser = false;
    const prevTierTag = useSessionStore.getState().tierTag;
    try {
      const sessionData = await auth.getSession();
      sessionHasUser = !!sessionData?.user;
      // If tierTag changed, bust the pricing tiers cache so cards re-fetch
      // with the new tier discount immediately on next render.
      const newTierTag = useSessionStore.getState().tierTag;
      if (newTierTag !== prevTierTag) {
        invalidatePricingTiersCache();
      }
      console.debug("SessionRefresher: session refreshed");
    } catch (e) {
      console.debug("SessionRefresher: failed to refresh session", e);
    }

    // Only fetch Shopify tags as a fallback when there is no DB user
    // (e.g. user authenticated via Shopify storefront but not yet in our DB)
    if (!sessionHasUser) {
      try {
        const tResp = await fetch(`/api/shopify/customer-tags`);
        const tjson = await tResp.json();
        if (tjson?.ok && Array.isArray(tjson.tags)) {
          useSessionStore.getState().setCustomerTags(tjson.tags);
        } else {
          try {
            const aResp = await fetch(`/api/shopify/customer-tags-admin`);
            const ajson = await aResp.json();
            if (ajson?.ok && Array.isArray(ajson.tags)) {
              useSessionStore.getState().setCustomerTags(ajson.tags);
            }
          } catch (e2) {
            console.debug("SessionRefresher: admin fallback failed", e2);
          }
        }
      } catch (e) {
        console.debug("SessionRefresher: failed to fetch customer tags", e);
      }
    }

    try {
      // fetch pricing tiers (cache)
      const pResp = await fetch(`/api/shopify/pricing-tiers`);
      const pjson = await pResp.json();
      if (pjson?.ok)
        useSessionStore.getState().setPricingTiers(pjson.results || []);
    } catch (e) {
      console.debug("SessionRefresher: failed to fetch pricing tiers", e);
    }
  }, []);

  useEffect(() => {
    // Run immediately on mount
    refresh();

    // Re-run when the user returns to the tab (picks up webhook-driven DB changes)
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Also poll every 60 seconds so active sessions stay in sync
    const interval = setInterval(refresh, 60_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
    };
  }, [refresh]);

  return null;
}
