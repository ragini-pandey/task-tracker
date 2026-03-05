import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { getAuthUser } from "@/lib/auth";
import { handleApiError, AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) throw new AppError("Unauthorized", 401);

    await dbConnect();
    const user = await User.findById(auth.userId).select("-password");
    if (!user) throw new AppError("User not found", 404);

    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
