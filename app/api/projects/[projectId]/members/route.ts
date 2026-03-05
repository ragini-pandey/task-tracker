import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import User from "@/models/User";
import { getAuthUser } from "@/lib/auth";
import { AppError, handleApiError } from "@/lib/errors";
import { addMemberSchema } from "@/lib/validation";

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) throw new AppError("Unauthorized", 401);

    await dbConnect();
    const { projectId } = await params;
    const body = await req.json();
    const { email } = addMemberSchema.parse(body);

    const project = await Project.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);

    const isMember = project.members.some((m) => m.toString() === auth.userId);
    if (!isMember) throw new AppError("Access denied", 403);

    const userToAdd = await User.findOne({ email });
    if (!userToAdd) throw new AppError("User not found with that email", 404);

    if (project.members.some((m) => m.toString() === userToAdd._id.toString())) {
      throw new AppError("User is already a member", 400);
    }

    project.members.push(userToAdd._id);
    await project.save();

    const populated = await project.populate([
      { path: "owner", select: "name email avatar" },
      { path: "members", select: "name email avatar" },
    ]);

    return NextResponse.json({ project: populated });
  } catch (error) {
    return handleApiError(error);
  }
}
