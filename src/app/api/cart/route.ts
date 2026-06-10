// app/api/cart/route.ts
import { shopifyFetch } from "@/lib/shopify/instance";
import { NextRequest, NextResponse } from "next/server";

// Cart oluştur
const CREATE_CART_MUTATION = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        totalQuantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
          subtotalAmount {
            amount
            currencyCode
          }
        }
        lines(first: 50) {
          edges {
            node {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  price {
                    amount
                    currencyCode
                  }
                  product {
                    id
                    title
                    featuredImage {
                      url
                    }
                  }
                }
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const ADD_TO_CART_MUTATION = `
  mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        checkoutUrl
        totalQuantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
        }
        lines(first: 50) {
          edges {
            node {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  price {
                    amount
                    currencyCode
                  }
                  product {
                    id
                    title
                    featuredImage {
                      url
                    }
                  }
                }
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_CART_MUTATION = `
  mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        id
        totalQuantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
        }
        lines(first: 50) {
          edges {
            node {
              id
              quantity
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const REMOVE_FROM_CART_MUTATION = `
  mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        id
        totalQuantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_CART_QUERY = `
  query getCart($cartId: ID!) {
    cart(id: $cartId) {
      id
      checkoutUrl
      totalQuantity
      cost {
        totalAmount {
          amount
          currencyCode
        }
        subtotalAmount {
          amount
          currencyCode
        }
      }
      lines(first: 50) {
        edges {
          node {
            id
            quantity
            merchandise {
              ... on ProductVariant {
                id
                title
                price {
                  amount
                  currencyCode
                }
                product {
                  id
                  title
                  featuredImage {
                    url
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

// POST - Yeni cart oluştur veya ürün ekle
export async function POST(req: NextRequest) {
  try {
    const { cartId, variantId, quantity = 1, buyerIdentity } = await req.json();

    if (cartId) {
      // Mevcut cart'a ekle
      const data = await shopifyFetch({
        query: ADD_TO_CART_MUTATION,
        variables: {
          cartId,
          lines: [{ merchandiseId: variantId, quantity }],
        },
      });

      return NextResponse.json(data);
    } else {
      // Yeni cart oluştur
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input: any = {
        lines: [{ merchandiseId: variantId, quantity }],
      };

      // B2B customer için buyerIdentity ekle
      if (buyerIdentity) {
        input.buyerIdentity = buyerIdentity;
      }

      const data = await shopifyFetch({
        query: CREATE_CART_MUTATION,
        variables: { input },
      });

      return NextResponse.json(data);
    }
  } catch (error) {
    console.error("Cart API error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// GET - Cart getir
export async function GET(req: NextRequest) {
  try {
    const cartId = req.nextUrl.searchParams.get("cartId");

    if (!cartId) {
      return NextResponse.json({ error: "Cart ID required" }, { status: 400 });
    }

    const data = await shopifyFetch({
      query: GET_CART_QUERY,
      variables: { cartId },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Get cart error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// PUT - Cart güncelle
export async function PUT(req: NextRequest) {
  try {
    const { cartId, lineId, quantity } = await req.json();

    const data = await shopifyFetch({
      query: UPDATE_CART_MUTATION,
      variables: {
        cartId,
        lines: [{ id: lineId, quantity }],
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Update cart error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// DELETE - Cart'tan ürün sil
export async function DELETE(req: NextRequest) {
  try {
    const { cartId, lineIds } = await req.json();

    const data = await shopifyFetch({
      query: REMOVE_FROM_CART_MUTATION,
      variables: { cartId, lineIds },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Remove from cart error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
