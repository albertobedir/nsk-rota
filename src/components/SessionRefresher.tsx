"use client";

import { useEffect } from "react";
import { auth } from "@/lib/axios/auth";
import useSessionStore from "@/store/session-store";
import { useCallback } from "react";

export default function SessionRefresher() {
  useEffect(() => {
    // Always try to refresh session and also load customer tags + pricing tiers
    (async () => {
      try {
        await auth.getSession();
        console.debug("SessionRefresher: session refreshed");
      } catch (e) {
        console.debug("SessionRefresher: failed to refresh session", e);
      }

      try {
        // fetch customer tags (storefront token)
        const tResp = await fetch(`/api/shopify/customer-tags`);
        const tjson = await tResp.json();
        if (tjson?.ok && Array.isArray(tjson.tags) && tjson.tags.length > 0) {
          useSessionStore.getState().setCustomerTags(tjson.tags || []);
        } else {
          // fallback: try admin-based lookup using server cookie customer_id
          try {
            const aResp = await fetch(`/api/shopify/customer-tags-admin`);
            const ajson = await aResp.json();
            if (ajson?.ok && Array.isArray(ajson.tags)) {
              useSessionStore.getState().setCustomerTags(ajson.tags || []);
            }
          } catch (e2) {
            console.debug("SessionRefresher: admin fallback failed", e2);
          }
        }
      } catch (e) {
        console.debug("SessionRefresher: failed to fetch customer tags", e);
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
    })();
  }, []);

  return null;
}
