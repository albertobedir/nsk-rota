/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma/instance";
import { shopifyFetch } from "@/lib/shopify/instance";
import { createCart, getCart } from "@/lib/shopify/cart";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email ve şifre gereklidir." },
        { status: 400 }
      );
    }

    const loginQuery = `
      mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
        customerAccessTokenCreate(input: $input) {
          customerAccessToken {
            accessToken
            expiresAt
          }
          customerUserErrors {
            code
            field
            message
          }
        }
      }
    `;
    const variables = { input: { email, password } };
    const response = await shopifyFetch({ query: loginQuery, variables });

    const payload = response.data.customerAccessTokenCreate;
    const shopifyToken = payload.customerAccessToken;

    if (!shopifyToken) {
      const err = payload.customerUserErrors[0] ?? {
        message: "Authentication failed.",
      };
      return NextResponse.json({ message: err.message }, { status: 401 });
    }

    // Shopify customer bilgilerini al
    const customerQuery = `
      query getCustomer($customerAccessToken: String!) {
        customer(customerAccessToken: $customerAccessToken) {
          id
          email
          firstName
          lastName
        }
      }
    `;
    const customerResponse = await shopifyFetch({
      query: customerQuery,
      variables: { customerAccessToken: shopifyToken.accessToken },
    });

    const shopifyCustomer = customerResponse.data.customer;
    if (!shopifyCustomer) {
      return NextResponse.json(
        { message: "Customer found but data unavailable." },
        { status: 404 }
      );
    }

    let user = await prisma.user.findUnique({
      where: { email: shopifyCustomer.email },
    });
    const hashedPassword = await bcrypt.hash(password, 10);

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: shopifyCustomer.email,
          firstName: shopifyCustomer.firstName ?? "",
          lastName: shopifyCustomer.lastName ?? "",
          password: hashedPassword,
          role: "user",
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email },
      ACCESS_TOKEN_SECRET,
      { expiresIn: "1h" }
    );
    const refreshToken = jwt.sign(
      { id: user.id, email: user.email },
      REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    const res = NextResponse.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });

    res.cookies.set("access_token", accessToken, {
      httpOnly: true,
      secure: false,
      path: "/",
      maxAge: 60 * 60,
      sameSite: "lax",
    });

    res.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: false,

      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
    });

    res.cookies.set("shopifyAccessToken", shopifyToken.accessToken, {
      httpOnly: true,
      secure: false,

      path: "/",
      maxAge: 60 * 60 * 24 * 30, // örn: 30 gün
      sameSite: "lax",
    });

    // Store Shopify customer GID so middleware/proxy can run user-scoped sync
    res.cookies.set("customer_id", shopifyCustomer.id, {
      httpOnly: true,
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });

    // Ensure the user has a Shopify cart: reuse existing or create a new one
    try {
      const existingCartCookie = request.cookies.get("shopifyCartId");
      const existingCartId = existingCartCookie?.value;

      let cartObj: any = null;

      if (existingCartId) {
        try {
          cartObj = await getCart(existingCartId);
        } catch (e) {
          cartObj = null;
        }
      }

      if (!cartObj) {
        // createCart returns the GraphQL payload (cartCreate)
        const created = await createCart();
        // created.cart should contain the cart object
        const newCart = created?.cart ?? null;
        if (newCart?.id) {
          res.cookies.set("shopifyCartId", newCart.id, {
            httpOnly: true,
            secure: false,
            path: "/",
            maxAge: 60 * 60 * 24 * 30,
            sameSite: "lax",
          });
        }
      }
    } catch (e) {
      // non-fatal: continue login even if cart check/create fails
      console.warn("Cart check/create failed:", e);
    }

    return res;
  } catch (err) {
    console.error("Login Error:", err);
    return NextResponse.json(
      {
        message: "Bir hata oluştu.",
        details: err instanceof Error ? err.message : JSON.stringify(err),
      },
      { status: 500 }
    );
  }
}
