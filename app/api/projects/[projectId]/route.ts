import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import { getAuthUser } from "@/lib/auth";
import { projectSchema } from "@/lib/validation";
import { handleApiError, AppError } from "@/lib/errors";

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) throw new AppError("Unauthorized", 401);

    await dbConnect();
    const { projectId } = await params;
    const project = await Project.findById(projectId)
      .populate("owner", "name email avatar")
      .populate("members", "name email avatar");

    if (!project) throw new AppError("Project not found", 404);

    const isMember = project.members.some((m) => m._id.toString() === auth.userId);
    if (!isMember) throw new AppError("Access denied", 403);

    return NextResponse.json({ project });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) throw new AppError("Unauthorized", 401);

    await dbConnect();
    const { projectId } = await params;
    const project = await Project.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);
    if (project.owner.toString() !== auth.userId) throw new AppError("Only project owner can update", 403);

    const body = await req.json();
    const data = projectSchema.parse(body);

    Object.assign(project, data);
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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) throw new AppError("Unauthorized", 401);

    await dbConnect();
    const { projectId } = await params;
    const project = await Project.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);
    if (project.owner.toString() !== auth.userId) throw new AppError("Only project owner can delete", 403);

    await project.deleteOne();
    return NextResponse.json({ message: "Project deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
