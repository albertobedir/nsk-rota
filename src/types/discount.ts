export interface CartItem {
  productId: string; // gid://shopify/Product/123
  variantId: string; // gid://shopify/ProductVariant/456
  collectionIds: string[]; // ürünün dahil olduğu koleksiyonlar
  quantity: number;
  price: number;
}

export interface DiscountValidateRequest {
  code: string;
  cartTotal: number;
  cartItems: CartItem[];
  shippingCost?: number;
  userTier?: string;
  tierDiscount?: number;
  customerId?: string;
}

export type DiscountValidateResponse =
  | {
      valid: true;
      code: string;
      discountType: "BASIC" | "FREE_SHIPPING" | "BXGY";
      codeValue: number;
      codeValueType: "PERCENTAGE" | "FIXED_AMOUNT";
      stackingType: "COMPOUND" | "ADDITIVE" | "MAX";
      tierDiscount: number;
      // Uygulanan indirimler
      cartDiscount: number; // sepet indirimi tutarı
      shippingDiscount: number; // kargo indirimi tutarı
      bxgyDiscount: number; // BXGY indirimi tutarı
      totalDiscount: number; // toplam indirim tutarı
      finalCartTotal: number; // indirimli sepet
      finalShipping: number; // indirimli kargo
      finalTotal: number; // genel toplam
      totalDiscountPercent: number;
      /** Item-level'da uygulanacak tek discount % — checkout API bunu kullanır */
      resolvedDiscountPercent: number;
      // BXGY için
      bxgyEligibleItems?: CartItem[];
    }
  | { valid: false; reason: string };
