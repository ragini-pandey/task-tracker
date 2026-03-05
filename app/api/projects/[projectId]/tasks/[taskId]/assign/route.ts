import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Task from "@/models/Task";
import Project from "@/models/Project";
import { getAuthUser } from "@/lib/auth";
import { assignSchema } from "@/lib/validation";
import { handleApiError, AppError } from "@/lib/errors";
import { emitTaskUpdated } from "@/lib/socket";

type Params = { params: Promise<{ projectId: string; taskId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) throw new AppError("Unauthorized", 401);

    await dbConnect();
    const { projectId, taskId } = await params;
    const body = await req.json();
    const { userId } = assignSchema.parse(body);

    const project = await Project.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);
    if (!project.members.some((m) => m.toString() === auth.userId))
      throw new AppError("Access denied", 403);
    if (!project.members.some((m) => m.toString() === userId))
      throw new AppError("User is not a project member", 400);

    const task = await Task.findOne({ _id: taskId, project: projectId });
    if (!task) throw new AppError("Task not found", 404);

    if (task.assignees.some((a) => a.toString() === userId)) {
      throw new AppError("User already assigned", 400);
    }

    task.assignees.push(userId as unknown as import("mongoose").Types.ObjectId);
    await task.save();

    const populated = await task.populate([
      { path: "assignees", select: "name email avatar" },
      { path: "comments.user", select: "name email avatar" },
    ]);

    emitTaskUpdated(projectId, populated.toJSON());
    return NextResponse.json({ task: populated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) throw new AppError("Unauthorized", 401);

    await dbConnect();
    const { projectId, taskId } = await params;
    const body = await req.json();
    const { userId } = assignSchema.parse(body);

    const project = await Project.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);
    if (!project.members.some((m) => m.toString() === auth.userId))
      throw new AppError("Access denied", 403);

    const task = await Task.findOne({ _id: taskId, project: projectId });
    if (!task) throw new AppError("Task not found", 404);

    task.assignees = task.assignees.filter((a) => a.toString() !== userId);
    await task.save();

    const populated = await task.populate([
      { path: "assignees", select: "name email avatar" },
      { path: "comments.user", select: "name email avatar" },
    ]);

    emitTaskUpdated(projectId, populated.toJSON());
    return NextResponse.json({ task: populated });
  } catch (error) {
    return handleApiError(error);
  }
}
