import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import { getAuthUser } from "@/lib/auth";
import { projectSchema } from "@/lib/validation";
import { handleApiError, AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) throw new AppError("Unauthorized", 401);

    await dbConnect();
    const projects = await Project.find({
      $or: [{ owner: auth.userId }, { members: auth.userId }],
    })
      .populate("owner", "name email avatar")
      .populate("members", "name email avatar")
      .sort({ updatedAt: -1 });

    return NextResponse.json({ projects });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) throw new AppError("Unauthorized", 401);

    await dbConnect();
    const body = await req.json();
    const data = projectSchema.parse(body);

    const project = await Project.create({
      ...data,
      owner: auth.userId,
      members: [auth.userId],
    });

    const populated = await project.populate([
      { path: "owner", select: "name email avatar" },
      { path: "members", select: "name email avatar" },
    ]);

    return NextResponse.json({ project: populated }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
