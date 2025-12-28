import { shopifyFetch } from "./instance";

// Types
export interface CartLine {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    product: {
      title: string;
      handle: string;
    };
  };
  cost: {
    totalAmount: {
      amount: string;
      currencyCode: string;
    };
  };
}

export interface Cart {
  id: string;
  checkoutUrl: string;
  lines: {
    edges: Array<{
      node: CartLine;
    }>;
  };
  cost: {
    totalAmount: {
      amount: string;
      currencyCode: string;
    };
    subtotalAmount: {
      amount: string;
      currencyCode: string;
    };
  };
  totalQuantity: number;
}

// Fragment for reusable cart fields
const CART_FRAGMENT = `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    lines(first: 100) {
      edges {
        node {
          id
          quantity
          merchandise {
            ... on ProductVariant {
              id
              title
              priceV2 {
                amount
                currencyCode
              }
              product {
                id
                title
                handle
                featuredImage {
                  url
                  altText
                }
              }
            }
          }
          cost {
            totalAmount {
              amount
              currencyCode
            }
          }
        }
      }
    }
    cost {
      totalAmount {
        amount
        currencyCode
      }
      subtotalAmount {
        amount
        currencyCode
      }
      totalTaxAmount {
        amount
        currencyCode
      }
    }
    attributes {
      key
      value
    }
  }
`;

// 1. Create Cart
export async function createCart(
  lines?: Array<{ merchandiseId: string; quantity: number }>
) {
  const mutation = `
    ${CART_FRAGMENT}
    mutation CreateCart($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      lines: lines || [],
    },
  };

  const response = await shopifyFetch({ query: mutation, variables });
  return response.data.cartCreate;
}

// 2. Add Lines to Cart
export async function addCartLines(
  cartId: string,
  lines: Array<{ merchandiseId: string; quantity: number }>
) {
  const mutation = `
    ${CART_FRAGMENT}
    mutation AddCartLines($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    cartId,
    lines,
  };

  const response = await shopifyFetch({ query: mutation, variables });
  return response.data.cartLinesAdd;
}

// 3. Update Cart Lines
export async function updateCartLines(
  cartId: string,
  lines: Array<{ id: string; quantity: number }>
) {
  const mutation = `
    ${CART_FRAGMENT}
    mutation UpdateCartLines($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    cartId,
    lines,
  };

  const response = await shopifyFetch({ query: mutation, variables });
  return response.data.cartLinesUpdate;
}

// 4. Remove Lines from Cart
export async function removeCartLines(cartId: string, lineIds: string[]) {
  const mutation = `
    ${CART_FRAGMENT}
    mutation RemoveCartLines($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    cartId,
    lineIds,
  };

  const response = await shopifyFetch({ query: mutation, variables });
  return response.data.cartLinesRemove;
}

// 5. Get Cart by ID
export async function getCart(cartId: string) {
  const query = `
    ${CART_FRAGMENT}
    query GetCart($cartId: ID!) {
      cart(id: $cartId) {
        ...CartFields
      }
    }
  `;

  const variables = { cartId };

  const response = await shopifyFetch({ query, variables });
  return response.data.cart;
}

// 6. Update Cart Attributes (custom metadata)
export async function updateCartAttributes(
  cartId: string,
  attributes: Array<{ key: string; value: string }>
) {
  const mutation = `
    ${CART_FRAGMENT}
    mutation UpdateCartAttributes($cartId: ID!, $attributes: [AttributeInput!]!) {
      cartAttributesUpdate(cartId: $cartId, attributes: $attributes) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    cartId,
    attributes,
  };

  const response = await shopifyFetch({ query: mutation, variables });
  return response.data.cartAttributesUpdate;
}

// 7. Update Cart Buyer Identity (for customer-specific pricing)
export async function updateCartBuyerIdentity(
  cartId: string,
  buyerIdentity: {
    email?: string;
    phone?: string;
    customerAccessToken?: string;
    countryCode?: string;
  }
) {
  const mutation = `
    ${CART_FRAGMENT}
    mutation UpdateCartBuyerIdentity($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
      cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    cartId,
    buyerIdentity,
  };

  const response = await shopifyFetch({ query: mutation, variables });
  return response.data.cartBuyerIdentityUpdate;
}

// 8. Apply Discount Code
export async function applyDiscountCode(
  cartId: string,
  discountCodes: string[]
) {
  const mutation = `
    ${CART_FRAGMENT}
    mutation ApplyDiscountCode($cartId: ID!, $discountCodes: [String!]!) {
      cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
        cart {
          ...CartFields
          discountCodes {
            code
            applicable
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    cartId,
    discountCodes,
  };

  const response = await shopifyFetch({ query: mutation, variables });
  return response.data.cartDiscountCodesUpdate;
}

// 9. Update Cart Note
export async function updateCartNote(cartId: string, note: string) {
  const mutation = `
    ${CART_FRAGMENT}
    mutation UpdateCartNote($cartId: ID!, $note: String!) {
      cartNoteUpdate(cartId: $cartId, note: $note) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    cartId,
    note,
  };

  const response = await shopifyFetch({ query: mutation, variables });
  return response.data.cartNoteUpdate;
}

// Helper: Add single item to cart
export async function addItemToCart(
  cartId: string,
  merchandiseId: string,
  quantity: number = 1
) {
  return addCartLines(cartId, [{ merchandiseId, quantity }]);
}

// Helper: Remove single item from cart
export async function removeItemFromCart(cartId: string, lineId: string) {
  return removeCartLines(cartId, [lineId]);
}

// Helper: Update single item quantity
export async function updateItemQuantity(
  cartId: string,
  lineId: string,
  quantity: number
) {
  return updateCartLines(cartId, [{ id: lineId, quantity }]);
}

// Helper: Clear entire cart
export async function clearCart(cartId: string) {
  const cart = await getCart(cartId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineIds = cart.lines.edges.map((edge: any) => edge.node.id);

  if (lineIds.length > 0) {
    return removeCartLines(cartId, lineIds);
  }

  return cart;
}

// // 1. Yeni sepet oluştur
// const { cart } = await createCart();
// const cartId = cart.id;

// // 2. Ürün ekle (variant ID gerekli)
// await addItemToCart(cartId, "gid://shopify/ProductVariant/123456", 2);

// // 3. Birden fazla ürün ekle
// await addCartLines(cartId, [
//   { merchandiseId: "gid://shopify/ProductVariant/111", quantity: 1 },
//   { merchandiseId: "gid://shopify/ProductVariant/222", quantity: 3 },
// ]);

// // 4. Ürün miktarını güncelle
// await updateItemQuantity(cartId, lineId, 5);

// // 5. Ürün çıkar
// await removeItemFromCart(cartId, lineId);

// // 6. Sepeti temizle
// await clearCart(cartId);

// // 7. İndirim kodu uygula
// await applyDiscountCode(cartId, ["SUMMER2024"]);

// // 8. Müşteri bilgisi ekle (customer-specific pricing için)
// await updateCartBuyerIdentity(cartId, {
//   customerAccessToken: "token_here",
//   email: "customer@example.com",
// });

// // 9. Sepet notu ekle
// await updateCartNote(cartId, "Lütfen hızlı gönderim yapın");

// // 10. Sepeti getir
// const cart = await getCart(cartId);
// console.log(cart.checkoutUrl); // Checkout URL'i
