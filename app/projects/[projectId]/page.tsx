"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useApi, useProjectPresence, useTaskEvents, PresenceUser } from "@/lib/socket-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, Plus, Users, Pencil, Trash2, X, Send, MessageSquare, UserPlus, ChevronDown, Clock, Flag, AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";

interface Member { _id: string; name: string; email: string; }
interface Comment { _id: string; user: Member; text: string; createdAt: string; }
interface Task {
  _id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignees: Member[];
  comments: Comment[];
  dueDate?: string;
  createdAt: string;
}
interface Project {
  _id: string;
  name: string;
  description: string;
  owner: Member;
  members: Member[];
}

const STATUS_COLS = [
  { key: "todo", label: "To Do", color: "bg-slate-400", headerColor: "border-t-slate-400", colBg: "bg-[#F4F5F7]", badgeBg: "bg-slate-100 text-slate-600" },
  { key: "in-progress", label: "In Progress", color: "bg-blue-500", headerColor: "border-t-blue-500", colBg: "bg-[#EAF2FF]", badgeBg: "bg-blue-100 text-blue-700" },
  { key: "review", label: "Review", color: "bg-violet-500", headerColor: "border-t-violet-500", colBg: "bg-[#F3F0FF]", badgeBg: "bg-violet-100 text-violet-700" },
  { key: "done", label: "Done", color: "bg-emerald-500", headerColor: "border-t-emerald-500", colBg: "bg-[#E3FCEF]", badgeBg: "bg-emerald-100 text-emerald-700" },
];

const PRIORITY_VARIANT: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
  low: "secondary",
  medium: "outline",
  high: "default",
  urgent: "destructive",
};

const PRIORITY_COLOR: Record<string, string> = {
  low: "text-slate-400",
  medium: "text-blue-400",
  high: "text-orange-400",
  urgent: "text-red-500",
};

export default function ProjectPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { apiFetch } = useApi();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState("");
  const [projectError, setProjectError] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [error, setError] = useState("");
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [dropError, setDropError] = useState<{ col: string; msg: string } | null>(null);

  // Real-time presence
  const onlineUsers: PresenceUser[] = useProjectPresence(token, projectId, user?.name);

  // Real-time task events
  useTaskEvents(token, projectId, {
    onTaskCreated: useCallback((task: Record<string, unknown>) => {
      setTasks((prev) => {
        if (prev.some((t) => t._id === (task as unknown as Task)._id)) return prev;
        return [task as unknown as Task, ...prev];
      });
    }, []),
    onTaskUpdated: useCallback((task: Record<string, unknown>) => {
      const updated = task as unknown as Task;
      setTasks((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
      setSelectedTask((prev) => (prev && prev._id === updated._id ? updated : prev));
    }, []),
    onTaskDeleted: useCallback((taskId: string) => {
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
      setSelectedTask((prev) => (prev && prev._id === taskId ? null : prev));
    }, []),
  });

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  const handleDrop = useCallback(async (colKey: string) => {
    if (!dragTaskId) return;
    const task = tasks.find((t) => t._id === dragTaskId);
    if (!task || task.status === colKey) { setDragTaskId(null); setDragOverCol(null); return; }
    // Optimistic update
    setTasks((prev) => prev.map((t) => t._id === dragTaskId ? { ...t, status: colKey } : t));
    const prevStatus = task.status;
    setDragTaskId(null);
    setDragOverCol(null);
    setDropError(null);
    try {
      const data = await apiFetch(`/api/projects/${projectId}/tasks/${dragTaskId}`, {
        method: "PUT",
        body: JSON.stringify({ title: task.title, description: task.description, status: colKey, priority: task.priority }),
      });
      setTasks((prev) => prev.map((t) => t._id === (data.task as Task)._id ? data.task as Task : t));
    } catch (err) {
      // Revert on failure
      setTasks((prev) => prev.map((t) => t._id === task._id ? { ...t, status: prevStatus } : t));
      setDropError({ col: prevStatus, msg: err instanceof Error ? err.message : "Failed to move task" });
      setTimeout(() => setDropError(null), 4000);
    }
  }, [dragTaskId, tasks, projectId, apiFetch]);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError("");
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterAssignee) params.set("assignee", filterAssignee);
    params.set("limit", "100");
    try {
      const data = await apiFetch(`/api/projects/${projectId}/tasks?${params}`);
      setTasks(data.tasks);
    } catch (err) {
      setTasksError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setTasksLoading(false);
    }
  }, [projectId, filterStatus, filterAssignee, apiFetch]);

  useEffect(() => {
    if (user && projectId) {
      setProjectError("");
      apiFetch(`/api/projects/${projectId}`)
        .then((d) => setProject(d.project as Project))
        .catch((err) => setProjectError(err instanceof Error ? err.message : "Project not found or access denied"));
      loadTasks();
    }
  }, [user, projectId, apiFetch, router, loadTasks]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F5F7]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (projectError) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F5F7]">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
            <WifiOff className="h-7 w-7 text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-1">Project unavailable</h2>
            <p className="text-sm text-slate-500">{projectError}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Button>
            <Button onClick={() => {
              setProjectError("");
              apiFetch(`/api/projects/${projectId}`)
                .then((d) => setProject(d.project as Project))
                .catch((err) => setProjectError(err instanceof Error ? err.message : "Project not found"));
            }}>
              <RefreshCw className="h-4 w-4 mr-1" /> Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F5F7]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500 font-medium">Loading project...</p>
        </div>
      </div>
    );
  }

  const tasksByStatus = STATUS_COLS.reduce((acc, col) => {
    acc[col.key] = tasks.filter((t) => t.status === col.key);
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <div className="h-screen bg-[#F4F5F7] flex flex-col overflow-hidden">
      {/* Jira-style Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm shrink-0">
        <div className="flex items-center justify-between gap-4 px-4 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="shrink-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center shrink-0">
                <span className="text-white text-[10px] font-bold uppercase">{project.name.charAt(0)}</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-slate-800 truncate leading-tight">{project.name}</h1>
                {project.description && <p className="text-slate-400 text-[11px] truncate leading-tight">{project.description}</p>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onlineUsers.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-200">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[11px] font-medium text-green-700">{onlineUsers.length} online</span>
                <div className="flex -space-x-1.5">
                  {onlineUsers.slice(0, 4).map((u) => (
                    <Avatar key={u.userId} className="h-5 w-5 border-2 border-white">
                      <AvatarFallback className="text-[9px] bg-green-600 text-white">{(u.name || "?").charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowMemberModal(true)} className="border-slate-200 text-slate-600 hover:bg-slate-50">
              <Users className="h-4 w-4 mr-1" /> Members
              <span className="ml-1 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full font-medium">{project.members.length}</span>
            </Button>
            <Button size="sm" onClick={() => setShowCreateTask(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-1" /> Create
            </Button>
          </div>
        </div>
      </header>

      {/* Board sub-header */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-4 shrink-0">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Board</span>
        <div className="w-px h-4 bg-slate-200" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Filter by:</span>
          <div className="relative">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="appearance-none pl-3 pr-7 py-1 bg-slate-50 text-slate-700 rounded text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
              <option value="">All Statuses</option>
              {STATUS_COLS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
          </div>
          <div className="relative">
            <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="appearance-none pl-3 pr-7 py-1 bg-slate-50 text-slate-700 rounded text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
              <option value="">All Assignees</option>
              {project.members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
          </div>
          {(filterStatus || filterAssignee) && (
            <button onClick={() => { setFilterStatus(""); setFilterAssignee(""); }} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors font-medium">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
        {(tasksError || dropError) && (
          <div className="ml-auto flex items-center gap-2">
            {tasksError && (
              <>
                <span className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {tasksError}
                </span>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-blue-600 hover:bg-blue-50" onClick={loadTasks}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Retry
                </Button>
              </>
            )}
            {dropError && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Move reverted: {dropError.msg}</span>
                <button onClick={() => setDropError(null)} className="ml-1 hover:opacity-70"><X className="h-3 w-3" /></button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-width Kanban Board */}
      <div className="flex-1 overflow-hidden min-h-0">
        {tasksLoading && tasks.length === 0 ? (
          /* Initial full-board skeleton */
          <div className="grid grid-cols-4 gap-0 h-full divide-x divide-slate-200">
            {STATUS_COLS.map((col) => (
              <div key={col.key} className={`flex flex-col ${col.colBg} p-4 gap-3`}>
                <div className="flex items-center gap-2 pb-2 border-b-2 border-t-4 border-transparent rounded-t px-1" style={{ borderTopColor: col.color.replace("bg-", "") }}>
                  <div className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
                  <div className="h-4 w-6 rounded-full bg-slate-200 animate-pulse ml-auto" />
                </div>
                {[0, 1, 2].map((i) => <TaskSkeleton key={i} />)}
              </div>
            ))}
          </div>
        ) : tasksError && tasks.length === 0 ? (
          /* Full-board error state */
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-semibold text-slate-800 mb-1">Failed to load tasks</h3>
              <p className="text-sm text-slate-500 max-w-xs">{tasksError}</p>
            </div>
            <Button onClick={loadTasks} className="bg-blue-600 hover:bg-blue-700 text-white">
              <RefreshCw className="h-4 w-4 mr-1.5" /> Try Again
            </Button>
          </div>
        ) : (
          /* Full-width 4-column board */
          <div className="grid grid-cols-4 h-full divide-x divide-slate-200">
            {STATUS_COLS.map((col) => (
              <div
                key={col.key}
                className={`flex flex-col overflow-hidden transition-colors duration-150 ${col.colBg} ${
                  dragOverCol === col.key ? "ring-2 ring-inset ring-blue-400 bg-blue-50/60" : ""
                }`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCol(col.key); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                onDrop={(e) => { e.preventDefault(); handleDrop(col.key); }}
              >
                {/* Column header */}
                <div className={`shrink-0 border-t-[3px] ${col.headerColor} bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-2`}>
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">{col.label}</h3>
                  <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full ${col.badgeBg}`}>
                    {tasksLoading ? "…" : tasksByStatus[col.key]?.length || 0}
                  </span>
                </div>
                {/* Task list */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {tasksLoading ? (
                    [0, 1].map((i) => <TaskSkeleton key={i} />)
                  ) : (
                    <>
                      {(tasksByStatus[col.key] || []).map((task) => (
                        <TaskCard
                          key={task._id}
                          task={task}
                          onClick={() => setSelectedTask(task)}
                          isDragging={dragTaskId === task._id}
                          onDragStart={() => setDragTaskId(task._id)}
                          onDragEnd={() => { setDragTaskId(null); setDragOverCol(null); }}
                        />
                      ))}
                      {(tasksByStatus[col.key] || []).length === 0 && (
                        <div className={`rounded-lg border-2 border-dashed border-slate-300/60 h-24 flex flex-col items-center justify-center gap-1 transition-colors ${
                          dragOverCol === col.key ? "border-blue-400 bg-blue-50" : ""
                        }`}>
                          <p className="text-[11px] text-slate-400 font-medium">No issues</p>
                          <p className="text-[10px] text-slate-300">Drop here or create one</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {/* Column footer: quick-add button */}
                <div className="shrink-0 px-3 pb-3">
                  <button
                    onClick={() => setShowCreateTask(true)}
                    className="w-full flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 hover:bg-blue-50 px-2 py-1.5 rounded-md transition-colors border border-dashed border-slate-200 hover:border-blue-300"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create issue
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        projectId={projectId}
        members={project.members}
        onCreated={(task) => { setTasks((p) => [task, ...p]); setShowCreateTask(false); }}
        apiFetch={apiFetch}
      />

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        projectId={projectId}
        members={project.members}
        currentUserId={user._id}
        onClose={() => setSelectedTask(null)}
        onUpdated={(t) => { setTasks((p) => p.map((x) => x._id === t._id ? t : x)); setSelectedTask(t); }}
        onDeleted={(id) => { setTasks((p) => p.filter((x) => x._id !== id)); setSelectedTask(null); }}
        apiFetch={apiFetch}
      />

      {/* Members Dialog */}
      <MembersDialog
        open={showMemberModal}
        onOpenChange={setShowMemberModal}
        project={project}
        onUpdated={(p) => setProject(p)}
        apiFetch={apiFetch}
        error={error}
        setError={setError}
      />
    </div>
  );
}

function TaskSkeleton() {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2.5 animate-pulse shadow-sm">
      <div className="h-3.5 bg-slate-100 rounded w-5/6" />
      <div className="h-3 bg-slate-100 rounded w-3/4" />
      <div className="flex items-center justify-between pt-1.5">
        <div className="flex gap-1">
          <div className="h-4 w-12 rounded-full bg-slate-100" />
          <div className="h-4 w-10 rounded-full bg-slate-100" />
        </div>
        <div className="h-5 w-5 rounded-full bg-slate-100" />
      </div>
    </div>
  );
}

function TaskCard({ task, onClick, isDragging, onDragStart, onDragEnd }: {
  task: Task;
  onClick: () => void;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const isOverdue = task.dueDate && task.status !== "done" && new Date(task.dueDate) < new Date();
  const uniqueAssignees = [...new Map(task.assignees.map((a) => [a._id, a])).values()];
  return (
    <Card
      className={`hover:border-blue-400 hover:shadow-md transition-all select-none border bg-white shadow-sm rounded-md ${
        isDragging ? "opacity-30 ring-2 ring-blue-500 cursor-grabbing scale-95" : "cursor-grab active:cursor-grabbing"
      } ${isOverdue ? "border-l-4 border-l-red-400" : "border-slate-200"}`}
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart?.(); }}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <CardContent className="p-3 gap-0">
        <h4 className="font-medium text-[13px] mb-2 text-slate-800 leading-snug">{task.title}</h4>
        {task.description && <p className="text-slate-400 text-[11px] line-clamp-2 mb-2.5 leading-relaxed">{task.description}</p>}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${
            task.priority === "urgent" ? "bg-red-100 text-red-700" :
            task.priority === "high" ? "bg-orange-100 text-orange-700" :
            task.priority === "medium" ? "bg-blue-100 text-blue-700" :
            "bg-slate-100 text-slate-500"
          }`}>
            <Flag className="h-2.5 w-2.5" />{task.priority}
          </span>
          {task.dueDate && (
            <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium ${
              isOverdue ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-400"
            }`}>
              <Clock className="h-2.5 w-2.5" />
              {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {uniqueAssignees.slice(0, 3).map((a) => (
              <Avatar key={a._id} className="h-5 w-5 border-2 border-white">
                <AvatarFallback className="text-[9px] bg-blue-600 text-white">{a.name.charAt(0)}</AvatarFallback>
              </Avatar>
            ))}
            {uniqueAssignees.length > 3 && (
              <Avatar className="h-5 w-5 border-2 border-white">
                <AvatarFallback className="text-[9px] bg-slate-300 text-slate-600">+{uniqueAssignees.length - 3}</AvatarFallback>
              </Avatar>
            )}
          </div>
          {task.comments.length > 0 && (
            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" /> {task.comments.length}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateTaskDialog({ open, onOpenChange, projectId, members, onCreated, apiFetch }: {
  open: boolean; onOpenChange: (open: boolean) => void;
  projectId: string; members: Member[];
  onCreated: (task: Task) => void;
  apiFetch: (url: string, opts?: RequestInit) => Promise<Record<string, unknown>>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await apiFetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify({ title, description, status, priority, assignees }),
      });
      onCreated(data.task as Task);
      setTitle(""); setDescription(""); setStatus("todo"); setPriority("medium"); setAssignees([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Create New Task
          </DialogTitle>
          <DialogDescription className="sr-only">Fill in the task details to create a new task.</DialogDescription>
        </DialogHeader>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Task Title</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea id="task-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add more details..." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="relative">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2 bg-background text-foreground rounded-lg text-sm border border-input focus:outline-none focus:ring-2 focus:ring-ring">
                  {STATUS_COLS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <div className="relative">
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2 bg-background text-foreground rounded-lg text-sm border border-input focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
          </div>
          {members.length > 0 && (
            <div className="space-y-2">
              <Label>Assignees</Label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto rounded-lg border border-input p-2">
                {members.map((m) => (
                  <label key={m._id} className="flex items-center gap-2.5 text-sm text-foreground p-1.5 rounded-md hover:bg-accent cursor-pointer transition-colors">
                    <input type="checkbox" checked={assignees.includes(m._id)} onChange={(e) => setAssignees(e.target.checked ? [...assignees, m._id] : assignees.filter((x) => x !== m._id))} className="rounded accent-primary" />
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[9px] bg-primary/20">{m.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {m.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              {submitting ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailDialog({ task, projectId, members, currentUserId, onClose, onUpdated, onDeleted, apiFetch }: {
  task: Task | null; projectId: string; members: Member[]; currentUserId: string;
  onClose: () => void; onUpdated: (t: Task) => void; onDeleted: (id: string) => void;
  apiFetch: (url: string, opts?: RequestInit) => Promise<Record<string, unknown>>;
}) {
  const [commentText, setCommentText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDesc(task.description);
      setEditStatus(task.status);
      setEditPriority(task.priority);
      setEditing(false);
      setActionError("");
    }
  }, [task]);

  if (!task) return null;

  const handleUpdate = async () => {
    setSaving(true);
    setActionError("");
    try {
      const data = await apiFetch(`/api/projects/${projectId}/tasks/${task._id}`, {
        method: "PUT",
        body: JSON.stringify({ title: editTitle, description: editDesc, status: editStatus, priority: editPriority }),
      });
      onUpdated(data.task as Task);
      setEditing(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this task?")) return;
    setDeleting(true);
    setActionError("");
    try {
      await apiFetch(`/api/projects/${projectId}/tasks/${task._id}`, { method: "DELETE" });
      onDeleted(task._id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete task");
      setDeleting(false);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setCommenting(true);
    try {
      const data = await apiFetch(`/api/projects/${projectId}/tasks/${task._id}/comments`, {
        method: "POST",
        body: JSON.stringify({ text: commentText }),
      });
      onUpdated(data.task as Task);
      setCommentText("");
    } catch { /* ignore */ } finally {
      setCommenting(false);
    }
  };

  const handleAssign = async (userId: string) => {
    try {
      const data = await apiFetch(`/api/projects/${projectId}/tasks/${task._id}/assign`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      onUpdated(data.task as Task);
    } catch { /* ignore */ }
  };

  const handleUnassign = async (userId: string) => {
    try {
      const data = await apiFetch(`/api/projects/${projectId}/tasks/${task._id}/assign`, {
        method: "DELETE",
        body: JSON.stringify({ userId }),
      });
      onUpdated(data.task as Task);
    } catch { /* ignore */ }
  };

  const statusLabel = STATUS_COLS.find((s) => s.key === task.status);
  return (
    <Dialog open={!!task} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            {editing ? (
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="font-bold flex-1" />
            ) : (
              <DialogTitle className="text-lg flex-1 leading-snug">{task.title}</DialogTitle>
            )}
            <div className="flex gap-2 shrink-0">
              {!editing && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
          <DialogDescription className="sr-only">View and manage task details, assignees, and comments.</DialogDescription>
        </DialogHeader>

        {actionError && (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-sm">{actionError}</AlertDescription>
          </Alert>
        )}

        {editing ? (
          <div className="space-y-3">
            <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Task description..." rows={3} />
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2 bg-background text-foreground rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {STATUS_COLS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="relative">
                <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2 bg-background text-foreground rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleUpdate} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm leading-relaxed">{task.description || "No description provided."}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={PRIORITY_VARIANT[task.priority] || "secondary"} className="capitalize">
                <Flag className="h-3 w-3 mr-1" />{task.priority}
              </Badge>
              {statusLabel && (
                <Badge variant="outline" className="gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${statusLabel.color}`} />
                  {statusLabel.label}
                </Badge>
              )}
              {task.dueDate && (
                <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(task.dueDate).toLocaleDateString()}
                </Badge>
              )}
            </div>
          </div>
        )}

        <Separator />

        {/* Assignees */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2.5 flex items-center gap-1.5">
            <Users className="h-4 w-4 text-muted-foreground" /> Assignees
          </h4>
          <div className="flex flex-wrap gap-2">
            {task.assignees.map((a) => (
              <div key={a._id} className="flex items-center gap-1.5 bg-secondary text-secondary-foreground rounded-full px-2.5 py-1 text-xs font-medium">
                <Avatar className="h-4 w-4">
                  <AvatarFallback className="text-[8px] bg-primary/20">{a.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                {a.name}
                <button onClick={() => handleUnassign(a._id)} className="ml-0.5 hover:text-destructive transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {members.filter((m) => !task.assignees.some((a) => a._id === m._id)).map((m) => (
              <Button key={m._id} variant="outline" size="sm" className="h-7 text-xs rounded-full" onClick={() => handleAssign(m._id)}>
                <UserPlus className="h-3 w-3 mr-1" /> {m.name}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Comments */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            Comments
            {task.comments.length > 0 && <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{task.comments.length}</span>}
          </h4>
          <div className="space-y-2 mb-3 max-h-56 overflow-y-auto">
            {task.comments.map((c) => (
              <div key={c._id} className="p-3 bg-muted/60 rounded-xl border border-border/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[9px] bg-primary/20">{(c.user?.name || "?").charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-semibold text-foreground">{c.user?.name || "Unknown"}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed pl-7">{c.text}</p>
              </div>
            ))}
            {task.comments.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground/60">
                <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-30" />
                No comments yet
              </div>
            )}
          </div>
          <form onSubmit={handleComment} className="flex gap-2">
            <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment..." className="flex-1" />
            <Button type="submit" size="sm" disabled={!commentText.trim() || commenting}>
              {commenting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MembersDialog({ open, onOpenChange, project, onUpdated, apiFetch, error, setError }: {
  open: boolean; onOpenChange: (open: boolean) => void;
  project: Project; onUpdated: (p: Project) => void;
  apiFetch: (url: string, opts?: RequestInit) => Promise<Record<string, unknown>>;
  error: string; setError: (s: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setAdding(true);
    try {
      const data = await apiFetch(`/api/projects/${project._id}/members`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      onUpdated(data.project as Project);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setError(""); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Project Members
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-1">{project.members.length}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">View and manage project members.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {project.members.map((m) => (
            <div key={m._id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/50 border border-border/40">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-sm bg-primary/15 text-primary font-semibold">{m.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                <p className="text-xs text-muted-foreground truncate">{m.email}</p>
              </div>
              {m._id === project.owner._id && (
                <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/5 shrink-0">Owner</Badge>
              )}
            </div>
          ))}
        </div>

        <Separator />

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        <div className="space-y-2">
          <Label htmlFor="member-email">Add by email</Label>
          <form onSubmit={handleAdd} className="flex gap-2">
            <Input id="member-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@example.com" type="email" required className="flex-1" />
            <Button type="submit" size="sm" disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <UserPlus className="h-4 w-4 mr-1" />}
              {adding ? "Inviting..." : "Invite"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
