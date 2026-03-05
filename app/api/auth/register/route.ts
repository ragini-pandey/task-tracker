import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { signToken } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const data = registerSchema.parse(body);

    const existing = await User.findOne({ email: data.email });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const user = await User.create(data);
    const token = signToken({ userId: user._id.toString(), email: user.email });

    const resp = NextResponse.json({ user: user.toJSON(), token }, { status: 201 });
    resp.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return resp;
  } catch (error) {
    return handleApiError(error);
  }
}
