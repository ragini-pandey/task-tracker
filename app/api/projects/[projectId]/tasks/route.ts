import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Task from "@/models/Task";
import Project from "@/models/Project";
import { getAuthUser } from "@/lib/auth";
import { taskSchema } from "@/lib/validation";
import { handleApiError, AppError } from "@/lib/errors";
import { emitTaskCreated } from "@/lib/socket";

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) throw new AppError("Unauthorized", 401);

    await dbConnect();
    const { projectId } = await params;

    const project = await Project.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);
    if (!project.members.some((m) => m.toString() === auth.userId))
      throw new AppError("Access denied", 403);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const assignee = searchParams.get("assignee");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const search = searchParams.get("search");

    // Build filter
    const filter: Record<string, unknown> = { project: projectId };
    if (status) filter.status = status;
    if (assignee) filter.assignees = assignee;
    if (cursor) filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    if (search) filter.$text = { $search: search };

    const tasks = await Task.find(filter)
      .populate("assignees", "name email avatar")
      .populate("comments.user", "name email avatar")
      .sort({ _id: -1 })
      .limit(limit + 1);

    const hasMore = tasks.length > limit;
    const results = hasMore ? tasks.slice(0, limit) : tasks;
    const nextCursor = hasMore ? results[results.length - 1]._id.toString() : null;

    return NextResponse.json({ tasks: results, nextCursor, hasMore });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) throw new AppError("Unauthorized", 401);

    await dbConnect();
    const { projectId } = await params;

    const project = await Project.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);
    if (!project.members.some((m) => m.toString() === auth.userId))
      throw new AppError("Access denied", 403);

    const body = await req.json();
    const data = taskSchema.parse(body);

    const { dueDate, ...rest } = data;
    const taskData: Record<string, unknown> = { ...rest, project: projectId };
    if (dueDate) taskData.dueDate = new Date(dueDate);
    const task = await Task.create(taskData);
    const populated = await task.populate([
      { path: "assignees", select: "name email avatar" },
      { path: "comments.user", select: "name email avatar" },
    ]);

    emitTaskCreated(projectId, populated.toJSON());
    return NextResponse.json({ task: populated }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
