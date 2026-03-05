import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Task from "@/models/Task";
import { getAuthUser } from "@/lib/auth";
import { handleApiError, AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) throw new AppError("Unauthorized", 401);

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    if (!q || q.trim().length === 0) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }

    const results = await Task.find({ $text: { $search: q } }, { score: { $meta: "textScore" } })
      .populate("assignees", "name email avatar")
      .populate("project", "name")
      .sort({ score: { $meta: "textScore" } })
      .limit(50);

    return NextResponse.json({ results });
  } catch (error) {
    return handleApiError(error);
  }
}
