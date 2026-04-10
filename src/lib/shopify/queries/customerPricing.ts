export const GET_CUSTOMER_PRICING_METAOBJECTS = `
  query GetCustomerPricing($first: Int!, $after: String) {
    metaobjects(type: "customer_pricing", first: $first, after: $after) {
      edges {
        node {
          id
          handle
          fields {
            key
            value
            reference {
              ... on Customer {
                id
                email
              }
              ... on Product {
                id
                title
              }
            }
          }
          updatedAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
