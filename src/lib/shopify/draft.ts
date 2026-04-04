// shopify/draft-orders.ts

import { shopifyAdminFetch } from "./instance";

// Types
export interface DraftOrderLineItem {
  variantId?: string;
  productId?: string;
  title?: string; // Custom item için
  quantity: number;
  originalUnitPrice?: string; // Custom price için
  appliedDiscount?: {
    value: number;
    valueType: "PERCENTAGE" | "FIXED_AMOUNT";
    description?: string;
  };
  taxable?: boolean;
  requiresShipping?: boolean;
}

export interface DraftOrderInput {
  customerId?: string;
  email?: string;
  phone?: string;
  lineItems: DraftOrderLineItem[];
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    province?: string;
    country: string;
    zip: string;
    phone?: string;
  };
  billingAddress?: {
    firstName?: string;
    lastName?: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    province?: string;
    country: string;
    zip: string;
    phone?: string;
  };
  note?: string;
  tags?: string[];
  taxExempt?: boolean;
  appliedDiscount?: {
    code?: string;
    value: number;
    valueType: "PERCENTAGE" | "FIXED_AMOUNT";
    description?: string;
    title?: string;
  };
  shippingLine?: {
    price: string;
    title: string;
  };
  customAttributes?: Array<{
    key: string;
    value: string;
  }>;
  useCustomerDefaultAddress?: boolean;
}

// 1. Draft Order Oluştur
export async function createDraftOrder(input: DraftOrderInput) {
  const mutation = `
    mutation draftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          name
          status
          invoiceUrl
          invoiceSentAt
          createdAt
          updatedAt
          totalPrice
          subtotalPrice
          totalTax
          totalShippingPrice
          currencyCode
          taxExempt
          taxesIncluded
          email
          phone
          note2
          tags
          customer {
            id
            email
            firstName
            lastName
          }
          shippingAddress {
            firstName
            lastName
            company
            address1
            address2
            city
            province
            country
            zip
            phone
          }
          billingAddress {
            firstName
            lastName
            company
            address1
            address2
            city
            province
            country
            zip
            phone
          }
          lineItems(first: 100) {
            edges {
              node {
                id
                title
                quantity
                originalUnitPrice
                discountedUnitPrice
                appliedDiscount {
                  value
                  valueType
                  description
                }
                variant {
                  id
                  title
                  sku
                }
                product {
                  id
                  title
                }
                taxable
                requiresShipping
              }
            }
          }
          appliedDiscount {
            value
            valueType
            description
          }
          customAttributes {
            key
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = { input };
  const response = await shopifyAdminFetch({ query: mutation, variables });
  return response.data?.draftOrderCreate;
}

// 2. Draft Order Güncelle
export async function updateDraftOrder(
  id: string,
  input: Partial<DraftOrderInput>,
) {
  const mutation = `
    mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
      draftOrderUpdate(id: $id, input: $input) {
        draftOrder {
          id
          name
          status
          totalPrice
          lineItems(first: 100) {
            edges {
              node {
                id
                title
                quantity
                originalUnitPrice
                discountedUnitPrice
                appliedDiscount {
                  value
                  valueType
                  description
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

  const variables = { id, input };
  const response = await shopifyAdminFetch({ query: mutation, variables });
  return response.data?.draftOrderUpdate;
}

// 3. Draft Order'ı Tamamla (Order'a Çevir)
export async function completeDraftOrder(id: string, paymentPending = false) {
  const mutation = `
    mutation draftOrderComplete($id: ID!, $paymentPending: Boolean) {
      draftOrderComplete(id: $id, paymentPending: $paymentPending) {
        draftOrder {
          id
          status
          order {
            id
            name
            displayFinancialStatus
            displayFulfillmentStatus
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            createdAt
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = { id, paymentPending };
  const response = await shopifyAdminFetch({ query: mutation, variables });
  return response.data?.draftOrderComplete;
}

// 4. Draft Order Sil
export async function deleteDraftOrder(id: string) {
  const mutation = `
    mutation draftOrderDelete($input: DraftOrderDeleteInput!) {
      draftOrderDelete(input: $input) {
        deletedId
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: { id },
  };
  const response = await shopifyAdminFetch({ query: mutation, variables });
  return response.data?.draftOrderDelete;
}

// 5. Draft Order Invoice Gönder
export async function sendDraftOrderInvoice(
  id: string,
  email?: {
    to?: string;
    from?: string;
    subject?: string;
    customMessage?: string;
    bcc?: string[];
  },
) {
  const mutation = `
    mutation draftOrderInvoiceSend($id: ID!, $email: EmailInput) {
      draftOrderInvoiceSend(id: $id, email: $email) {
        draftOrder {
          id
          invoiceSentAt
          invoiceUrl
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = { id, email };
  const response = await shopifyAdminFetch({ query: mutation, variables });
  return response.data?.draftOrderInvoiceSend;
}

// 6. Draft Order'ı ID ile Getir
export async function getDraftOrder(id: string) {
  const query = `
    query getDraftOrder($id: ID!) {
      draftOrder(id: $id) {
        id
        name
        status
        invoiceUrl
        totalPrice
        subtotalPrice
        totalTax
        email
        phone
        note2
        tags
        createdAt
        updatedAt
        customer {
          id
          email
          firstName
          lastName
        }
        lineItems(first: 100) {
          edges {
            node {
              id
              title
              quantity
              originalUnitPrice
              discountedUnitPrice
              variant {
                id
                title
                sku
              }
            }
          }
        }
        shippingAddress {
          firstName
          lastName
          company
          address1
          city
          province
          country
          zip
        }
      }
    }
  `;

  const variables = { id };
  const response = await shopifyAdminFetch({ query, variables });
  return response.data?.draftOrder;
}

// 7. Tüm Draft Order'ları Listele
export async function listDraftOrders(first = 50, query?: string) {
  const queryGql = `
    query listDraftOrders($first: Int!, $query: String) {
      draftOrders(first: $first, query: $query) {
        edges {
          node {
            id
            name
            status
            totalPrice
            email
            createdAt
            customer {
              id
              email
              firstName
              lastName
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const variables = { first, query };
  const response = await shopifyAdminFetch({ query: queryGql, variables });
  return response.data?.draftOrders;
}

// 8. Draft Order Hesapla (Fiyat Preview)
export async function calculateDraftOrder(input: DraftOrderInput) {
  const mutation = `
    mutation draftOrderCalculate($input: DraftOrderInput!) {
      draftOrderCalculate(input: $input) {
        calculatedDraftOrder {
          totalPrice
          subtotalPrice
          totalTax
          totalShippingPrice
          lineItems {
            title
            quantity
            originalUnitPrice
            discountedUnitPrice
            totalDiscount
          }
          appliedDiscount {
            value
            valueType
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = { input };
  const response = await shopifyAdminFetch({ query: mutation, variables });

  console.log(
    "[calculateDraftOrder raw response]",
    JSON.stringify(response, null, 2),
  );

  return response.data?.draftOrderCalculate;
}

// 9. Discount Code Detayını Getir
export async function getDiscountByCode(code: string) {
  const query = `
    query getDiscount($query: String!) {
      codeDiscountNodes(first: 1, query: $query) {
        edges {
          node {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                status
                minimumRequirement {
                  ... on DiscountMinimumSubtotal {
                    greaterThanOrEqualToSubtotal {
                      amount
                      currencyCode
                    }
                  }
                  ... on DiscountMinimumQuantity {
                    greaterThanOrEqualToQuantity
                  }
                }
                customerGets {
                  value {
                    ... on DiscountPercentage {
                      percentage
                    }
                    ... on DiscountAmount {
                      amount {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
                usageLimit
                appliesOncePerCustomer
              }
              ... on DiscountCodeFreeShipping {
                title
                status
                minimumRequirement {
                  ... on DiscountMinimumSubtotal {
                    greaterThanOrEqualToSubtotal {
                      amount
                      currencyCode
                    }
                  }
                  ... on DiscountMinimumQuantity {
                    greaterThanOrEqualToQuantity
                  }
                }
              }
              ... on DiscountCodeBxgy {
                title
                status
              }
            }
          }
        }
      }
    }
  `;

  const response = await shopifyAdminFetch({
    query,
    variables: { query: `code:${code}` },
  });

  const node = response.data?.codeDiscountNodes?.edges?.[0]?.node?.codeDiscount;
  return node ?? null;
}
