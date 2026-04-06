/**
 * Centralized pricing calculation logic
 * Ensures customer pricing takes priority over tier discounts
 */

export interface PriceCalculationInput {
  originalPrice: number;
  tierDiscountPercentage: number | null;
  customerPrice: number | null;
}

export interface PriceCalculationOutput {
  hasCustomerPrice: boolean;
  hasTierDiscount: boolean;
  displayPrice: number; // what to show to user (bold/main)
  strikethroughPrice: number | null; // original price if discount exists
}

/**
 * Calculate product price with proper priority:
 * 1. Customer pricing (if exists) - NO tier discount applied
 * 2. Tier discount (if no customer pricing)
 * 3. Original price (if no customer pricing or tier discount)
 */
export function calculateProductPrice(
  input: PriceCalculationInput,
): PriceCalculationOutput {
  const { originalPrice, tierDiscountPercentage, customerPrice } = input;

  // Priority 1: Customer pricing takes priority - NO tier discount applied to it
  if (
    customerPrice !== null &&
    customerPrice !== undefined &&
    customerPrice > 0
  ) {
    return {
      hasCustomerPrice: true,
      hasTierDiscount: false,
      displayPrice: customerPrice,
      strikethroughPrice: originalPrice, // show original price as strikethrough
    };
  }

  // Priority 2: Apply tier discount if exists and no customer pricing
  if (
    tierDiscountPercentage !== null &&
    tierDiscountPercentage !== undefined &&
    tierDiscountPercentage > 0
  ) {
    const discountedPrice = Number(
      (originalPrice * (1 - tierDiscountPercentage / 100)).toFixed(2),
    );
    return {
      hasCustomerPrice: false,
      hasTierDiscount: true,
      displayPrice: discountedPrice,
      strikethroughPrice: originalPrice, // show original price as strikethrough
    };
  }

  // Priority 3: No discount - show original price
  return {
    hasCustomerPrice: false,
    hasTierDiscount: false,
    displayPrice: originalPrice,
    strikethroughPrice: null,
  };
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
