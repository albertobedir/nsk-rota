/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { createDraftOrder } from "@/lib/shopify/draft";
import prisma from "@/lib/prisma/instance";

type IncomingLine = {
  merchandiseId?: string;
  productId?: string;
  quantity?: number;
  originalUnitPrice?: number | string;
  originalUntieredPrice?: number | string;
  title?: string;
  customPrice?: number | string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      lineItems,
      email,
      phone,
      shippingAddress,
      customerId,
      userTier,
      discountPercentage,
      discountCode,
      creditRemaining,
      customerAccessToken,
    } = body;

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { message: "No items provided" },
        { status: 400 },
      );
    }

    const lines = lineItems as IncomingLine[];
    const discount = Number(discountPercentage ?? 0);

    const normalizeShopifyId = (id: string) =>
      id.includes("/") ? id.split("/").pop()! : id;

    // ✅ DEBUG: Log incoming values
    console.log("[CHECKOUT REQUEST]", {
      customerId,
      userTier,
      discountPercentage,
      discountCode,
      customerAccessToken: customerAccessToken
        ? customerAccessToken.substring(0, 20) + "..."
        : "NONE",
      lineItemsCount: lineItems.length,
      firstItem: lineItems[0],
    });

    // ===== STEP 1: Validate discount code FIRST =====
    let resolvedDiscount = Number(discountPercentage ?? 0); // Start with tier discount
    let validatedDiscount: any = null; // Store validated discount info for later use

    if (discountCode?.trim()) {
      try {
        // Calculate cart total — orijinal untiered fiyat üzerinden
        const cartTotal = lines.reduce((sum, li) => {
          const qty = Number(li.quantity || 1);
          const price =
            Number(li.originalUntieredPrice ?? li.originalUnitPrice ?? 0) || 0;
          return sum + price * qty;
        }, 0);

        // Build cartItems for validation — appliesToProducts kontrolü için
        const cartItemsForValidation = lines.map((li) => ({
          productId: li.productId ?? "",
          variantId: li.merchandiseId ?? "",
          collectionIds: [],
          quantity: Number(li.quantity || 1),
          price:
            Number(li.originalUntieredPrice ?? li.originalUnitPrice ?? 0) || 0,
        }));

        // Call validate endpoint
        const validateUrl = new URL(
          "/api/discount/validate",
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        );

        console.log(
          `[DISCOUNT CODE] Validating code="${discountCode}" for cart=${cartTotal.toFixed(2)}`,
        );

        const validateRes = await fetch(validateUrl.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: discountCode.trim(),
            cartTotal,
            cartItems: cartItemsForValidation,
            userTier: userTier || "NO_TIER",
            tierDiscount: resolvedDiscount,
            customerId,
          }),
        });

        const validated = await validateRes.json();

        // 👇 DEBUG: Log raw response ve valid check
        console.log(
          "[VALIDATE RAW RESPONSE]",
          JSON.stringify(validated, null, 2),
        );
        console.log("[VALIDATE VALID CHECK]", validated.valid);

        if (validated.valid) {
          // Store validated for later use (shippingLine, etc)
          validatedDiscount = validated;

          // ===== COMPOUND DISCOUNT CALCULATION =====
          // Tier zaten frontend'de uygulanmış, ama Shopify orijinal fiyata uygulaması için
          // tier + code'u compound olarak hesapla
          if (
            validated.discountType === "BASIC" &&
            validated.codeValueType === "PERCENTAGE"
          ) {
            // Compound: tier_multiplier × code_multiplier
            // Örn: tier %10 = 0.9, code %40 = 0.6 → combined 0.54 → 46% off
            const tierMult = 1 - Number(discountPercentage ?? 0) / 100;
            const codeMult = 1 - validated.codeValue / 100;
            const combinedMult = tierMult * codeMult;
            resolvedDiscount = (1 - combinedMult) * 100;
            console.log(
              `[COMPOUND DISCOUNT] tierMult=${tierMult} codeMult=${codeMult} combined=${resolvedDiscount.toFixed(2)}%`,
            );
          } else if (validated.codeValueType === "FIXED_AMOUNT") {
            // Fixed amount: item'a tier apply ama order-level'a fixed amount
            resolvedDiscount = Number(discountPercentage ?? 0);
            console.log(
              `[FIXED AMOUNT] using tier only for items: ${resolvedDiscount}%`,
            );
          } else {
            // Fallback
            resolvedDiscount =
              validated.resolvedDiscountPercent ??
              ((lineItems.reduce((sum: number, li: any) => {
                const qty = Number(li.quantity || 1);
                const price =
                  Number(
                    li.originalUntieredPrice ?? li.originalUnitPrice ?? 0,
                  ) || 0;
                return sum + price * qty;
              }, 0) -
                (validated.finalTotal - validated.finalShipping)) /
                lineItems.reduce((sum: number, li: any) => {
                  const qty = Number(li.quantity || 1);
                  const price =
                    Number(
                      li.originalUntieredPrice ?? li.originalUnitPrice ?? 0,
                    ) || 0;
                  return sum + price * qty;
                }, 0)) *
                100;
            console.log(
              `[FALLBACK DISCOUNT] resolvedDiscount=${resolvedDiscount.toFixed(2)}%`,
            );
          }

          resolvedDiscount = Math.round(resolvedDiscount * 100) / 100;

          console.log(
            `[DISCOUNT RESOLVED] code=${discountCode} type=${validated.discountType} resolvedDiscount=${resolvedDiscount.toFixed(2)}%`,
          );
        } else {
          console.warn(
            `[DISCOUNT INVALID] code=${discountCode} reason=${validated.reason}`,
          );
          // On error, continue with tier discount only
          resolvedDiscount = Number(discountPercentage ?? 0);
        }
      } catch (e) {
        console.warn("[DISCOUNT VALIDATE] request failed:", e);
        // On error, continue with tier discount only
        resolvedDiscount = Number(discountPercentage ?? 0);
      }
    }

    // ===== STEP 2: Fetch customer pricing =====
    const customerPricingMap: Record<string, number> = {};
    if (customerId) {
      for (const li of lines) {
        const productGid = li.productId ?? "";
        if (!productGid) continue;
        try {
          const cp = await prisma.customerPricing.findFirst({
            where: {
              customerId: String(customerId),
              productShopifyId: String(productGid),
            },
          });
          if (cp) {
            const variantKey = li.merchandiseId ?? productGid;
            customerPricingMap[variantKey] = Number(cp.price);
          }
        } catch {}
      }
    }
    console.log("[CUSTOMER PRICING MAP]", customerPricingMap);

    // ===== STEP 3: Credit check AFTER discount is resolved =====
    if (customerId && creditRemaining != null) {
      const remaining = Number(creditRemaining);

      const computedTotal = lines.reduce((sum, li) => {
        const qty = Number(li.quantity || 1);
        const price = Number(li.originalUnitPrice ?? 0) || 0;
        const discounted =
          resolvedDiscount > 0 ? price * (1 - resolvedDiscount / 100) : price;
        return sum + discounted * qty;
      }, 0);

      console.log(
        `[CREDIT CHECK] computedTotal=${computedTotal.toFixed(2)}, creditRemaining=${remaining}`,
      );

      if (computedTotal > remaining) {
        return NextResponse.json(
          { message: "Insufficient credit" },
          { status: 402 },
        );
      }
    }

    // Get user's tier and discount percentage from request
    console.log(
      `[TIER] customerId=${customerId} userTier=${userTier} resolvedDiscount=${resolvedDiscount}%`,
    );

    // ===== customerId is already in Shopify GID format from frontend =====
    // Format: gid://shopify/Customer/123456 or undefined
    console.log(`[SHOPIFY GID] Using customerId: ${customerId}`);

    // Determine if discount is FIXED_AMOUNT type
    const tierOnly = Number(discountPercentage ?? 0); // sadece tier %
    const isFixedAmount = validatedDiscount?.codeValueType === "FIXED_AMOUNT";

    const items = lines.map((li) => {
      const qty = Number(li.quantity || 1);
      const originalPrice =
        Number(li.originalUntieredPrice ?? li.originalUnitPrice ?? 0) || 0;

      const baseItem: any = {
        quantity: qty,
        taxable: true,
        requiresShipping: true,
      };

      if (li.merchandiseId) baseItem.variantId = li.merchandiseId;
      else if (li.productId) baseItem.productId = li.productId;

      console.log(
        `\n[ITEM PROCESSING START] id=${baseItem.variantId} qty=${qty} originalPrice=${originalPrice}`,
      );

      // Determine which price to use
      let customPrice: number | undefined;
      const explicit = li.customPrice;

      if (explicit != null) {
        customPrice = Number(explicit);
        console.log(`[ITEM] EXPLICIT price found: customPrice=${customPrice}`);
      } else {
        const itemKey = li.merchandiseId ?? li.productId ?? "";
        const cpPrice = customerPricingMap[itemKey];

        if (cpPrice != null && originalPrice > 0) {
          // Customer pricing base
          let finalPrice = cpPrice;
          let discountDesc = "";

          // Discount code varsa customer price üstüne uygula
          if (
            validatedDiscount &&
            !isFixedAmount &&
            resolvedDiscount > tierOnly
          ) {
            // Sadece code kısmını al: compound'dan tier'ı çıkar
            const codeMult = 1 - validatedDiscount.codeValue / 100;
            finalPrice = cpPrice * codeMult;
            discountDesc = `Customer Pricing + Code - ${(
              (1 - finalPrice / originalPrice) *
              100
            ).toFixed(2)}% off`;
            console.log(
              `[CUSTOMER PRICING + CODE] cpPrice=${cpPrice} × (1 - ${validatedDiscount.codeValue}%) = ${finalPrice}, total discount=${(
                ((originalPrice - finalPrice) / originalPrice) *
                100
              ).toFixed(2)}%`,
            );
          } else {
            discountDesc = `Customer Pricing - ${(
              ((originalPrice - cpPrice) / originalPrice) *
              100
            ).toFixed(2)}% off`;
            console.log(
              `[CUSTOMER PRICING ONLY] ${originalPrice} → ${cpPrice} (${(
                ((originalPrice - cpPrice) / originalPrice) *
                100
              ).toFixed(2)}% off)`,
            );
          }

          const totalDiscountPct =
            ((originalPrice - finalPrice) / originalPrice) * 100;
          customPrice = finalPrice;
          baseItem.appliedDiscount = {
            value: Math.round(totalDiscountPct * 100) / 100,
            valueType: "PERCENTAGE",
            description: discountDesc,
          };
        } else if (resolvedDiscount > 0 && originalPrice > 0) {
          customPrice = originalPrice * (1 - resolvedDiscount / 100);
          if (customPrice < originalPrice) {
            if (isFixedAmount) {
              if (tierOnly > 0) {
                baseItem.appliedDiscount = {
                  value: Math.round(tierOnly * 100) / 100,
                  valueType: "PERCENTAGE",
                  description: `B2B Tier - ${tierOnly.toFixed(2)}% off`,
                };
              }
            } else {
              baseItem.appliedDiscount = {
                value: Math.round(resolvedDiscount * 100) / 100,
                valueType: "PERCENTAGE",
                description: `B2B Tier & Discount Code - ${resolvedDiscount.toFixed(2)}% off`,
              };
            }
          }
        }
      }

      console.log(
        `[ITEM PROCESSING END] final baseItem:`,
        JSON.stringify(baseItem, null, 2),
      );
      return baseItem;
    });

    // 👇 DEBUG: Validated discount info
    console.log("[VALIDATED DISCOUNT DEBUG]", {
      codeValueType: validatedDiscount?.codeValueType,
      codeValue: validatedDiscount?.codeValue,
      discountType: validatedDiscount?.discountType,
      isFixedAmount: validatedDiscount?.codeValueType === "FIXED_AMOUNT",
    });

    // Spread yerine explicit assign
    const orderDiscount =
      validatedDiscount?.codeValueType === "FIXED_AMOUNT"
        ? {
            value: Math.round(validatedDiscount.codeValue * 100) / 100,
            valueType: "FIXED_AMOUNT" as const,
            description: `Discount Code: ${discountCode}`,
          }
        : undefined;

    const shippingLine =
      validatedDiscount?.discountType === "FREE_SHIPPING"
        ? {
            title: `Free Shipping (${discountCode})`,
            price: "0.00",
          }
        : undefined;

    const input = {
      customerId: customerId ?? undefined, // Already in GID format: gid://shopify/Customer/123
      email: email ?? undefined,
      phone: phone ?? undefined,
      lineItems: items,
      shippingAddress: shippingAddress ?? undefined,
      tags: ["b2b", "custom-pricing"],
      note: customerId
        ? `B2B Order - Custom pricing for ${customerId}`
        : undefined,
      appliedDiscount: orderDiscount,
      shippingLine: shippingLine,
    };

    // ✅ LOG 2: Shopify'a gönderilen tam input
    console.log("[DRAFT ORDER INPUT]", JSON.stringify(input, null, 2));

    const created = await createDraftOrder(input);

    // ✅ LOG 3: Shopify'dan dönen response
    console.log("[DRAFT ORDER RESPONSE]", JSON.stringify(created, null, 2));

    // 👇 DEBUG: Check for errors
    console.log("[DRAFT CREATED RAW]", JSON.stringify(created, null, 2));
    console.log("[INVOICE URL CHECK]", created?.draftOrder?.invoiceUrl);

    // 🛒 DEBUG: Token ve checkout bilgisi
    console.log("🛒 CHECKOUT TOKEN DEBUG", {
      customerAccessToken: customerAccessToken
        ? customerAccessToken.substring(0, 20) + "..."
        : "NONE PROVIDED",
      customerId: customerId,
      invoiceUrl: created?.draftOrder?.invoiceUrl,
    });

    if (created?.userErrors?.length > 0) {
      console.error("[DRAFT USER ERRORS]", created.userErrors);
      return NextResponse.json(
        { message: created.userErrors[0].message },
        { status: 400 },
      );
    }

    if (!created?.draftOrder?.id) {
      console.error("[DRAFT FAILED] No draft order ID returned", created);
      return NextResponse.json(
        {
          message: "Failed to create draft order - no ID returned from Shopify",
        },
        { status: 400 },
      );
    }

    // ===== Track discount usage if order was created successfully =====
    if (created?.draftOrder?.id && discountCode?.trim()) {
      try {
        // Find discount record
        const discountRec = await prisma.discountCode.findUnique({
          where: { code: discountCode.trim().toUpperCase() },
        });

        if (discountRec) {
          // Increment usedCount
          await prisma.discountCode.update({
            where: { id: discountRec.id },
            data: { usedCount: { increment: 1 } },
          });

          // Record DiscountUsage for appliesOncePerCustomer tracking
          if (discountRec.appliesOncePerCustomer && customerId) {
            await prisma.discountUsage.upsert({
              where: {
                discountId_customerId: {
                  discountId: discountRec.id,
                  customerId: customerId,
                },
              },
              update: { usedAt: new Date() },
              create: {
                discountId: discountRec.id,
                customerId: customerId,
              },
            });
          }

          console.log(
            `[DISCOUNT TRACKING] code=${discountCode} usedCount incremented, appliesOncePerCustomer=${discountRec.appliesOncePerCustomer}`,
          );
        }
      } catch (e) {
        console.warn(`[DISCOUNT TRACKING] Failed:`, e);
      }
    }

    // Enable discount codes in Shopify checkout
    const draftId = created?.draftOrder?.id;
    if (draftId) {
      try {
        const numericId = String(draftId).split("/").pop();
        const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN!;
        const shopifyToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!;

        await fetch(
          `https://${shopifyDomain}/admin/api/2025-01/draft_orders/${numericId}.json`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": shopifyToken,
            },
            body: JSON.stringify({
              draft_order: {
                id: numericId,
                "allow_discount_codes_in_checkout?": true,
              },
            }),
          },
        );
        console.log(
          "[DRAFT UPDATE] allow_discount_codes_in_checkout enabled for draft",
          numericId,
        );
      } catch (e) {
        console.warn("[DRAFT UPDATE] failed to enable discount codes:", e);
      }
    }

    return NextResponse.json({
      created,
      // Debug: token bilgisi dön
      _debug: {
        customerAccessToken: customerAccessToken
          ? customerAccessToken.substring(0, 20) + "..."
          : "NONE",
        customerId: customerId,
      },
    });
  } catch (err) {
    console.error("/api/cart/checkout error:", err);
    return NextResponse.json(
      { message: "Error creating draft" },
      { status: 500 },
    );
  }
}
