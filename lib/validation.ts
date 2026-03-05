import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const projectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200),
  description: z.string().max(2000).optional().default(""),
});

export const taskSchema = z.object({
  title: z.string().min(1, "Task title is required").max(300),
  description: z.string().max(5000).optional().default(""),
  status: z.enum(["todo", "in-progress", "review", "done"]).optional().default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  assignees: z.array(z.string()).optional().default([]),
  dueDate: z.string().datetime().optional().nullable(),
});

export const taskUpdateSchema = taskSchema.partial();

export const commentSchema = z.object({
  text: z.string().min(1, "Comment text is required").max(2000),
});

export const assignSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export const addMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
});
