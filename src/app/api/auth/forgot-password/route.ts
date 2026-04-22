import { NextRequest, NextResponse } from "next/server";
import { shopifyFetch } from "@/lib/shopify/instance";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    console.log("📧 Forgot password request for:", email);

    if (!email) {
      return NextResponse.json(
        { message: "Email is required." },
        { status: 400 },
      );
    }

    // Use Shopify's native recovery flow
    // Shopify will send a password reset email to the customer
    const mutation = `
      mutation customerRecover($email: String!) {
        customerRecover(email: $email) {
          customerUserErrors {
            code
            field
            message
          }
        }
      }
    `;

    console.log("🔄 Calling Shopify customerRecover for:", email);

    const response = await shopifyFetch({
      query: mutation,
      variables: { email },
    });

    console.log("📥 Shopify response:", JSON.stringify(response, null, 2));

    const errors = response?.data?.customerRecover?.customerUserErrors;
    if (errors && errors.length > 0) {
      console.error("❌ Shopify errors:", errors);
    } else {
      console.log("✅ Shopify recovery email sent");
    }

    // Security: Return same message regardless of success
    // (prevent email enumeration)
    return NextResponse.json({
      message:
        "If this email exists in our system, a password reset link has been sent.",
    });
  } catch (err) {
    console.error("❌ Forgot password error:", err);
    return NextResponse.json(
      { message: "An error occurred. Please try again later." },
      { status: 500 },
    );
  }
}
