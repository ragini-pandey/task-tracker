import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { AppError, handleApiError } from "@/lib/errors";
import { loginSchema } from "@/lib/validation";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const data = loginSchema.parse(body);

    const user = await User.findOne({ email: data.email });
    if (!user) throw new AppError("Invalid email or password", 401);

    const isMatch = await user.comparePassword(data.password);
    if (!isMatch) throw new AppError("Invalid email or password", 401);

    const token = signToken({ userId: user._id.toString(), email: user.email });

    const resp = NextResponse.json({ user: user.toJSON(), token });
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
