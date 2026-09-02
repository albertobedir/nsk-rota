import { shopifyAdminFetch } from "./instance";

export async function updateOrderNote(orderId: string, note: string) {
  const mutation = `
    mutation orderUpdate($input: OrderInput!) {
      orderUpdate(input: $input) {
        order {
          id
          note
          poNumber
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await shopifyAdminFetch({
    query: mutation,
    variables: { input: { id: orderId, note } },
  });

  return response.data?.orderUpdate;
}
