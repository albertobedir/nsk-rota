"use server";

import prisma from "@/lib/prisma/instance";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;

export async function POST(request: NextRequest) {
   try {
      const refreshToken = request.cookies.get("refreshToken")?.value;

      if (!refreshToken) {
         return NextResponse.json(
            { message: "Refresh token bulunamadı" },
            { status: 401 }
         );
      }

      let decoded: { id: string; email: string };
      try {
         decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as {
            id: string;
            email: string;
         };
      } catch {
         return NextResponse.json(
            { message: "Geçersiz refresh token" },
            { status: 401 }
         );
      }

      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user) {
         return NextResponse.json(
            { message: "User bulunamadı" },
            { status: 404 }
         );
      }

      const newAccessToken = jwt.sign(
         { id: user.id, email: user.email },
         ACCESS_TOKEN_SECRET,
         { expiresIn: "1h" }
      );

      const newRefreshToken = jwt.sign(
         { id: user.id, email: user.email },
         REFRESH_TOKEN_SECRET,
         { expiresIn: "7d" }
      );

      const res = NextResponse.json({
         message: "Token yenilendi",
         user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
         },
      });

      res.cookies.set("access_token", newAccessToken, {
         httpOnly: true,
         secure: process.env.NODE_ENV === "production",
         path: "/",
         maxAge: 60 * 60, // 1h
         sameSite: "lax",
      });

      res.cookies.set("refresh_token", newRefreshToken, {
         httpOnly: true,
         secure: process.env.NODE_ENV === "production",
         path: "/",
         maxAge: 60 * 60 * 24 * 7, // 7d
         sameSite: "lax",
      });

      return res;
   } catch (err) {
      console.error("Refresh Token Error:", err);
      return NextResponse.json(
         { message: "Internal server error" },
         { status: 500 }
      );
   }
}
