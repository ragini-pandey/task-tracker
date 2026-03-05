import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Task from "@/models/Task";
import Project from "@/models/Project";
import { getAuthUser } from "@/lib/auth";
import { commentSchema } from "@/lib/validation";
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
    const { text } = commentSchema.parse(body);

    const project = await Project.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);
    if (!project.members.some((m) => m.toString() === auth.userId))
      throw new AppError("Access denied", 403);

    const task = await Task.findOne({ _id: taskId, project: projectId });
    if (!task) throw new AppError("Task not found", 404);

    task.comments.push({ user: auth.userId, text } as unknown as import("@/models/Task").IComment);
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
