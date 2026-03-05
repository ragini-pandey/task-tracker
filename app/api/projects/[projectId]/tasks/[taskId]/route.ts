import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Task from "@/models/Task";
import Project from "@/models/Project";
import { getAuthUser } from "@/lib/auth";
import { taskUpdateSchema } from "@/lib/validation";
import { handleApiError, AppError } from "@/lib/errors";
import { emitTaskUpdated, emitTaskDeleted } from "@/lib/socket";

type Params = { params: Promise<{ projectId: string; taskId: string }> };

async function verifyAccess(req: NextRequest, params: Params["params"]) {
  const auth = await getAuthUser(req);
  if (!auth) throw new AppError("Unauthorized", 401);

  await dbConnect();
  const { projectId, taskId } = await params;

  const project = await Project.findById(projectId);
  if (!project) throw new AppError("Project not found", 404);
  if (!project.members.some((m) => m.toString() === auth.userId))
    throw new AppError("Access denied", 403);

  const task = await Task.findOne({ _id: taskId, project: projectId });
  if (!task) throw new AppError("Task not found", 404);

  return { auth, task, projectId };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { task } = await verifyAccess(req, params);
    const populated = await task.populate([
      { path: "assignees", select: "name email avatar" },
      { path: "comments.user", select: "name email avatar" },
    ]);
    return NextResponse.json({ task: populated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { task, projectId } = await verifyAccess(req, params);
    const body = await req.json();
    const data = taskUpdateSchema.parse(body);

    Object.assign(task, data);
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
    const { task, projectId } = await verifyAccess(req, params);
    const taskId = task._id.toString();
    await task.deleteOne();
    emitTaskDeleted(projectId, taskId);
    return NextResponse.json({ message: "Task deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
