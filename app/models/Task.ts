import mongoose, { Schema, Document, Model } from "mongoose";

export interface IComment {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

export type TaskStatus = "todo" | "in-progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface ITask extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  project: mongoose.Types.ObjectId;
  assignees: mongoose.Types.ObjectId[];
  comments: IComment[];
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["todo", "in-progress", "review", "done"],
      default: "todo",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    assignees: [{ type: Schema.Types.ObjectId, ref: "User" }],
    comments: [CommentSchema],
    dueDate: { type: Date },
  },
  { timestamps: true, collection: "tasks" }
);

// Compound indexes for dashboard performance
TaskSchema.index({ project: 1, status: 1 });
TaskSchema.index({ project: 1, createdAt: -1 });
TaskSchema.index({ project: 1, assignees: 1 });
TaskSchema.index({ title: "text", description: "text", "comments.text": "text" });

const Task: Model<ITask> = mongoose.models.Task || mongoose.model<ITask>("Task", TaskSchema);
export default Task;
