/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma/instance";
import { shopifyAdminFetch } from "@/lib/shopify/instance";
import type {
  DiscountValidateRequest,
  DiscountValidateResponse,
  CartItem,
} from "@/types/discount";

function getEligibleItems(
  cartItems: CartItem[],
  appliesToAll: boolean,
  appliesToProducts: string[],
  appliesToCollections: string[],
): CartItem[] {
  if (appliesToAll) return cartItems;

  // Normalize both sides to GID format for comparison
  const normalizeToGid = (id: string): string => {
    if (id.startsWith("gid://")) return id;
    // If numeric ID, wrap in GID format
    return `gid://shopify/Product/${id}`;
  };

  const normalizedAppliesToProducts = appliesToProducts.map(normalizeToGid);

  return cartItems.filter((item) => {
    const normalizedProductId = normalizeToGid(item.productId);
    const productMatch =
      normalizedAppliesToProducts.includes(normalizedProductId);
    const collectionMatch = item.collectionIds.some((cid) =>
      appliesToCollections.includes(cid),
    );

    // 👇 DEBUG: Log matching for each item
    if (!productMatch && !collectionMatch) {
      console.log(
        `[ELIGIBLE FILTER] Product ${item.productId} (normalized: ${normalizedProductId}) NOT matched`,
        {
          normalizedAppliesToProducts,
        },
      );
    } else {
      console.log(
        `[ELIGIBLE FILTER] Product ${item.productId} (normalized: ${normalizedProductId}) MATCHED (product=${productMatch}, collection=${collectionMatch})`,
      );
    }

    if (productMatch) return true;
    if (collectionMatch) return true;
    return false;
  });
}

function getEligibleCartSubtotal(eligibleItems: CartItem[]): number {
  return eligibleItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
}

/** BXGY: Buy side check */
function checkBxgyBuySide(
  cartItems: CartItem[],
  discount: any,
): { eligible: boolean; reason?: string } {
  // Buy side product check
  const buyItems = discount.buyAnyProduct
    ? cartItems
    : cartItems.filter((item) => {
        if (discount.buyProductIds?.includes(item.productId)) return true;
        if (
          item.collectionIds.some((cid) =>
            discount.buyCollectionIds?.includes(cid),
          )
        )
          return true;
        return false;
      });

  if (buyItems.length === 0) {
    return {
      eligible: false,
      reason: "Your cart does not contain required products for this discount",
    };
  }

  const buySubtotal = getEligibleCartSubtotal(buyItems);

  // Purchase amount condition
  if (discount.buyPurchaseAmount != null) {
    if (buySubtotal < discount.buyPurchaseAmount) {
      return {
        eligible: false,
        reason: `You need to buy products worth ${discount.buyPurchaseAmount.toFixed(2)} for this discount (Your total: ${buySubtotal.toFixed(2)})`,
      };
    }
  }

  // Quantity condition
  if (discount.buyQuantity != null) {
    const totalQty = buyItems.reduce(
      (sum: number, item: CartItem) => sum + item.quantity,
      0,
    );
    if (totalQty < discount.buyQuantity) {
      return {
        eligible: false,
        reason: `You need to buy at least ${discount.buyQuantity} items for this discount (Your total: ${totalQty})`,
      };
    }
  }

  return { eligible: true };
}

/** BXGY: Get side indirim tutarını hesapla */
function calcBxgyDiscount(cartItems: CartItem[], discount: any): number {
  // Get side ürünleri bul
  const getItems = discount.getAnyProduct
    ? cartItems
    : cartItems.filter((item) => {
        if (discount.getProductIds?.includes(item.productId)) return true;
        if (
          item.collectionIds.some((cid) =>
            discount.getCollectionIds?.includes(cid),
          )
        )
          return true;
        return false;
      });

  if (getItems.length === 0) return 0;

  // En ucuz ürünleri önce al (getQuantity kadar)
  const getQty = discount.getQuantity ?? 1;
  const sortedItems = [...getItems].sort((a, b) => a.price - b.price);

  let remaining = getQty;
  let discountAmount = 0;

  for (const item of sortedItems) {
    if (remaining <= 0) break;
    const applyQty = Math.min(item.quantity, remaining);
    const itemDiscount =
      discount.valueType === "PERCENTAGE"
        ? item.price * applyQty * (discount.value / 100)
        : Math.min(discount.value, item.price) * applyQty;
    discountAmount += itemDiscount;
    remaining -= applyQty;
  }

  return discountAmount;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<DiscountValidateRequest>;

    const {
      code,
      cartTotal,
      cartItems = [],
      shippingCost = 0,
      userTier,
      tierDiscount: tierPct = 0,
      customerId,
    } = body;

    if (!code || !cartTotal) {
      return NextResponse.json(
        { valid: false, reason: "Missing code or cartTotal" },
        { status: 400 },
      );
    }

    // ===== Normalize cartItems: fill in productId from variantId if missing =====
    const normalizedCartItems = await Promise.all(
      cartItems.map(async (item) => {
        // If productId already has GID format, use it
        if (item.productId?.startsWith("gid://shopify/Product/")) {
          return item;
        }

        // Try to fetch product ID from variant
        if (item.variantId) {
          try {
            const query = `
              query($id: ID!) {
                productVariant(id: $id) {
                  product {
                    id
                  }
                }
              }
            `;
            const res = await shopifyAdminFetch({
              query,
              variables: { id: item.variantId },
            });
            const productGid = res?.data?.productVariant?.product?.id;
            if (productGid) {
              console.log(
                `[CART ITEM NORMALIZED] variant=${item.variantId} → product=${productGid}`,
              );
              return { ...item, productId: productGid };
            }
          } catch (e) {
            console.warn(
              `[CART ITEM NORMALIZE] Failed to fetch product from variant ${item.variantId}:`,
              e,
            );
          }
        }

        // Fallback: keep original productId (may not match if format incompatible)
        return item;
      }),
    );

    // Use normalized items for validation
    const validationItems =
      normalizedCartItems.length > 0 ? normalizedCartItems : cartItems;

    const discount = await prisma.discountCode.findFirst({
      where: { code: code.trim().toUpperCase(), active: true },
    });

    if (!discount) {
      return NextResponse.json({ valid: false, reason: "Code not found" });
    }

    // 👇 DEBUG: Discount verisini logla
    console.log("[DISCOUNT LOADED]", {
      code: discount.code,
      discountType: discount.discountType,
      stackingType: discount.stackingType,
      valueType: discount.valueType,
      value: discount.value,
    });

    const now = new Date();

    // 1. Date range check
    if (discount.startsAt && now < discount.startsAt) {
      return NextResponse.json({
        valid: false,
        reason: `Code is not yet active (starts on ${discount.startsAt.toLocaleDateString("en-US")})`,
      });
    }
    if (discount.endsAt && now > discount.endsAt) {
      return NextResponse.json({
        valid: false,
        reason: `Code has expired (ended on ${discount.endsAt.toLocaleDateString("en-US")})`,
      });
    }

    // 2. Usage limit check
    if (
      discount.usageLimit != null &&
      discount.usedCount >= discount.usageLimit
    ) {
      return NextResponse.json({
        valid: false,
        reason: `Usage limit exceeded (${discount.usageLimit} uses allowed)`,
      });
    }

    // 3. Minimum cart amount check (only for BASIC)
    if (
      discount.discountType === "BASIC" &&
      discount.minimumCartAmount != null &&
      cartTotal < discount.minimumCartAmount
    ) {
      return NextResponse.json({
        valid: false,
        reason: `Minimum cart amount required: ${discount.minimumCartAmount.toFixed(2)} (Your total: ${cartTotal.toFixed(2)})`,
      });
    }

    // 4. Tier restriction check
    if (
      discount.allowedTiers.length > 0 &&
      userTier &&
      !discount.allowedTiers.includes(userTier)
    ) {
      return NextResponse.json({
        valid: false,
        reason: `This code is only valid for ${discount.allowedTiers.join(", ")} tiers`,
      });
    }

    // 5. Customer restriction check
    if (!discount.allCustomers) {
      if (!customerId) {
        return NextResponse.json({
          valid: false,
          reason: "This code is only valid for logged-in users",
        });
      }
      const isAllowed =
        discount.specificCustomers?.includes(customerId) ?? false;
      if (!isAllowed) {
        return NextResponse.json({
          valid: false,
          reason: "This code is not valid for you",
        });
      }
    }

    // 6. appliesOncePerCustomer check
    if (discount.appliesOncePerCustomer && customerId) {
      const existingUsage = await prisma.discountUsage.findUnique({
        where: {
          discountId_customerId: {
            discountId: discount.id,
            customerId: customerId,
          },
        },
      });

      if (existingUsage) {
        return NextResponse.json({
          valid: false,
          reason: "You have already used this code",
        });
      }
    }

    const tier = Number(tierPct ?? 0);
    const codeVal = discount.value ?? 0;
    let cartDiscount = 0;
    let shippingDiscount = 0;
    let bxgyDiscount = 0;

    // ===== FREE_SHIPPING =====
    if (discount.discountType === "FREE_SHIPPING") {
      // Minimum quantity check
      if (discount.minimumQuantity != null) {
        const totalQty = validationItems.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );
        if (totalQty < discount.minimumQuantity) {
          return NextResponse.json({
            valid: false,
            reason: `At least ${discount.minimumQuantity} items are required for free shipping (Your total: ${totalQty})`,
          });
        }
      }

      // Minimum cart amount check
      if (
        discount.minimumCartAmount != null &&
        cartTotal < discount.minimumCartAmount
      ) {
        return NextResponse.json({
          valid: false,
          reason: `Minimum cart amount required for free shipping: ${discount.minimumCartAmount.toFixed(2)} (Your total: ${cartTotal.toFixed(2)})`,
        });
      }

      shippingDiscount = shippingCost;

      const response: DiscountValidateResponse = {
        valid: true,
        code: discount.code,
        discountType: "FREE_SHIPPING",
        codeValue: 100,
        codeValueType: "PERCENTAGE",
        stackingType: discount.stackingType,
        tierDiscount: tier,
        cartDiscount: 0,
        shippingDiscount: Math.round(shippingDiscount * 100) / 100,
        bxgyDiscount: 0,
        totalDiscount: Math.round(shippingDiscount * 100) / 100,
        finalCartTotal: Math.round(cartTotal * 100) / 100,
        finalShipping: 0,
        finalTotal: Math.round(cartTotal * 100) / 100,
        totalDiscountPercent:
          shippingCost > 0
            ? (shippingDiscount / (cartTotal + shippingCost)) * 100
            : 0,
        resolvedDiscountPercent: tier,
      };

      console.log(`[DISCOUNT VALIDATED] code=${code}`, response);
      return NextResponse.json(response);
    }

    // ===== BXGY =====
    if (discount.discountType === "BXGY") {
      // Minimum cart amount check
      if (
        discount.minimumCartAmount != null &&
        cartTotal < discount.minimumCartAmount
      ) {
        return NextResponse.json({
          valid: false,
          reason: `Minimum cart amount required for this discount: ${discount.minimumCartAmount.toFixed(2)} (Your total: ${cartTotal.toFixed(2)})`,
        });
      }

      // Buy side check
      const buySideCheck = checkBxgyBuySide(validationItems, discount);
      if (!buySideCheck.eligible) {
        return NextResponse.json({ valid: false, reason: buySideCheck.reason });
      }

      // Get side indirim hesabı
      bxgyDiscount = calcBxgyDiscount(validationItems, discount);

      // Tier ile combine edilebiliyorsa cart'a da tier uygula
      let tieredCartTotal = cartTotal;
      if (tier > 0 && discount.combinesWithOrderDiscounts) {
        cartDiscount = cartTotal * (tier / 100);
        tieredCartTotal = cartTotal - cartDiscount;
      }

      const totalDiscount = cartDiscount + bxgyDiscount;
      const totalDiscountPercent =
        (totalDiscount / (cartTotal + shippingCost)) * 100;

      const response: DiscountValidateResponse = {
        valid: true,
        code: discount.code,
        discountType: "BXGY",
        codeValue: codeVal,
        codeValueType: discount.valueType,
        stackingType: discount.stackingType,
        tierDiscount: tier,
        cartDiscount: Math.round(cartDiscount * 100) / 100,
        shippingDiscount: 0,
        bxgyDiscount: Math.round(bxgyDiscount * 100) / 100,
        totalDiscount: Math.round((cartDiscount + bxgyDiscount) * 100) / 100,
        finalCartTotal: Math.round(tieredCartTotal * 100) / 100,
        finalShipping: Math.round(shippingCost * 100) / 100,
        finalTotal:
          Math.round((tieredCartTotal + shippingCost - bxgyDiscount) * 100) /
          100,
        totalDiscountPercent: totalDiscountPercent,
        resolvedDiscountPercent: tier,
      };

      console.log(`[DISCOUNT VALIDATED] code=${code}`, response);
      return NextResponse.json(response);
    }

    // ===== BASIC =====
    const eligibleItems = getEligibleItems(
      validationItems,
      discount.appliesToAll,
      discount.appliesToProducts || [],
      discount.appliesToCollections || [],
    );

    // 👇 DEBUG: Log eligible items matching
    console.log("[ELIGIBLE DEBUG]", {
      appliesToAll: discount.appliesToAll,
      appliesToProducts: discount.appliesToProducts,
      cartItemProductIds: validationItems.map((i) => i.productId),
      eligibleCount: eligibleItems.length,
      cartItemsCount: cartItems.length,
    });

    if (eligibleItems.length === 0 && !discount.appliesToAll) {
      return NextResponse.json({
        valid: false,
        reason: "Your cart items are not eligible for this discount",
      });
    }

    const eligibleSubtotal = getEligibleCartSubtotal(eligibleItems);

    // Minimum cart amount check (eligible subtotal basis)
    if (
      discount.minimumCartAmount != null &&
      eligibleSubtotal < discount.minimumCartAmount
    ) {
      return NextResponse.json({
        valid: false,
        reason: `Minimum eligible items amount required: ${discount.minimumCartAmount.toFixed(2)} (Your total: ${eligibleSubtotal.toFixed(2)})`,
      });
    }

    // Calculate discount based on stacking type
    if (discount.stackingType === "COMPOUND") {
      // ⚠️ Frontend zaten tier uygulanmış fiyat gönderiyor, tekrar uygulamayın!
      let discountedAmount = eligibleSubtotal; // $18 (tier sonrası)

      // ❌ REMOVED: if (tier > 0) discountedAmount *= 1 - tier / 100;
      // ^ Çifte indirim yapıyordu

      if (discount.valueType === "PERCENTAGE") {
        discountedAmount *= 1 - codeVal / 100; // Percentage kodu uygula
      } else {
        discountedAmount = Math.max(0, discountedAmount - codeVal); // Fixed amount çıkar
        // $18 - $10 = $8 ✅
      }
      cartDiscount = Math.max(0, eligibleSubtotal - discountedAmount);
      // $18 - $8 = $10 ✅

      // 👇 DEBUG
      console.log("[COMPOUND DEBUG]", {
        discountCode: discount.code,
        discountType: discount.discountType,
        stackingType: discount.stackingType,
        valueType: discount.valueType,
        codeVal,
        eligibleSubtotal,
        discountedAmount,
        cartDiscount,
      });
    } else if (discount.stackingType === "ADDITIVE") {
      let totalPercent = tier;
      let fixedAmount = 0;
      if (discount.valueType === "PERCENTAGE") {
        totalPercent += codeVal;
      } else {
        fixedAmount = codeVal;
      }
      cartDiscount = eligibleSubtotal * (totalPercent / 100) + fixedAmount;
    } else if (discount.stackingType === "MAX") {
      const tierDiscount = eligibleSubtotal * (tier / 100);
      const codeDiscount =
        discount.valueType === "PERCENTAGE"
          ? eligibleSubtotal * (codeVal / 100)
          : codeVal;
      cartDiscount = Math.min(tierDiscount, codeDiscount);
    }

    if (
      discount.combinesWithShippingDiscounts &&
      shippingCost > 0 &&
      discount.valueType === "PERCENTAGE"
    ) {
      shippingDiscount = shippingCost * (codeVal / 100);
    }

    // Calculate totals
    const totalDiscount = cartDiscount + shippingDiscount;
    const totalDiscountPercent =
      (totalDiscount / (cartTotal + shippingCost)) * 100;

    // finalCartTotal hesabında: indirim sepetin tamamından uygulanır
    const finalCartTotal = cartTotal - cartDiscount;
    const finalShippingCost = shippingCost - shippingDiscount;

    const response: DiscountValidateResponse = {
      valid: true,
      code: discount.code,
      discountType: "BASIC",
      codeValue: codeVal,
      codeValueType: discount.valueType,
      stackingType: discount.stackingType,
      tierDiscount: tier,
      cartDiscount: Math.round(cartDiscount * 100) / 100,
      shippingDiscount: Math.round(shippingDiscount * 100) / 100,
      bxgyDiscount: 0,
      totalDiscount: Math.round((cartDiscount + shippingDiscount) * 100) / 100,
      finalCartTotal: Math.round(finalCartTotal * 100) / 100,
      finalShipping: Math.round(finalShippingCost * 100) / 100,
      finalTotal: Math.round((finalCartTotal + finalShippingCost) * 100) / 100,
      totalDiscountPercent: totalDiscountPercent,
      resolvedDiscountPercent: ((cartTotal - finalCartTotal) / cartTotal) * 100,
    };

    console.log(`[DISCOUNT VALIDATED] code=${code}`, response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("[DISCOUNT VALIDATE] Error:", error);
    return NextResponse.json(
      { valid: false, reason: "Validation failed" },
      { status: 500 },
    );
  }
}
