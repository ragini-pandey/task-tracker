"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useApi, useProjectPresence, useTaskEvents, PresenceUser } from "@/lib/socket-client";
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
  { key: "todo", label: "To Do", color: "bg-slate-500" },
  { key: "in-progress", label: "In Progress", color: "bg-yellow-500" },
  { key: "review", label: "Review", color: "bg-purple-500" },
  { key: "done", label: "Done", color: "bg-green-500" },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-slate-400",
  medium: "text-blue-400",
  high: "text-orange-400",
  urgent: "text-red-400",
};

export default function ProjectPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { apiFetch } = useApi();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [error, setError] = useState("");

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

  const loadTasks = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterAssignee) params.set("assignee", filterAssignee);
    params.set("limit", "100");
    try {
      const data = await apiFetch(`/api/projects/${projectId}/tasks?${params}`);
      setTasks(data.tasks);
    } catch (err) {
      console.error(err);
    }
  }, [projectId, filterStatus, filterAssignee, apiFetch]);

  useEffect(() => {
    if (user && projectId) {
      apiFetch(`/api/projects/${projectId}`).then((d) => setProject(d.project)).catch(() => router.push("/dashboard"));
      loadTasks();
    }
  }, [user, projectId, apiFetch, router, loadTasks]);

  if (loading || !user || !project) {
    return <div className="flex h-screen items-center justify-center bg-slate-900"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  }

  const tasksByStatus = STATUS_COLS.reduce((acc, col) => {
    acc[col.key] = tasks.filter((t) => t.status === col.key);
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 shrink-0">
        <div className="max-w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/dashboard")} className="text-slate-400 hover:text-white transition">&larr; Back</button>
            <div>
              <h1 className="text-xl font-bold text-white">{project.name}</h1>
              <p className="text-slate-400 text-sm">{project.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Online Users */}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-slate-300 text-sm">{onlineUsers.length} online</span>
              <div className="flex -space-x-1.5">
                {onlineUsers.slice(0, 5).map((u) => (
                  <div key={u.userId} className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-slate-800" title={u.name || u.userId}>
                    {(u.name || "?").charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setShowMemberModal(true)} className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition">
              Members ({project.members.length})
            </button>
            <button onClick={() => setShowCreateTask(true)} className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
              + Add Task
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="px-6 py-3 bg-slate-800/50 border-b border-slate-700/50 flex gap-4 shrink-0">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm border border-slate-600 focus:outline-none">
          <option value="">All Statuses</option>
          {STATUS_COLS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm border border-slate-600 focus:outline-none">
          <option value="">All Assignees</option>
          {project.members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
        </select>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 min-w-max h-full">
          {STATUS_COLS.map((col) => (
            <div key={col.key} className="w-80 flex flex-col">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`w-3 h-3 rounded-full ${col.color}`} />
                <h3 className="text-sm font-semibold text-slate-300">{col.label}</h3>
                <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">{tasksByStatus[col.key]?.length || 0}</span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto">
                {(tasksByStatus[col.key] || []).map((task) => (
                  <TaskCard key={task._id} task={task} onClick={() => setSelectedTask(task)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Task Modal */}
      {showCreateTask && (
        <CreateTaskModal
          projectId={projectId}
          members={project.members}
          onClose={() => setShowCreateTask(false)}
          onCreated={(task) => { setTasks((p) => [task, ...p]); setShowCreateTask(false); }}
          apiFetch={apiFetch}
        />
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          projectId={projectId}
          members={project.members}
          currentUserId={user._id}
          onClose={() => setSelectedTask(null)}
          onUpdated={(t) => { setTasks((p) => p.map((x) => x._id === t._id ? t : x)); setSelectedTask(t); }}
          onDeleted={(id) => { setTasks((p) => p.filter((x) => x._id !== id)); setSelectedTask(null); }}
          apiFetch={apiFetch}
        />
      )}

      {/* Members Modal */}
      {showMemberModal && (
        <MembersModal
          project={project}
          onClose={() => setShowMemberModal(false)}
          onUpdated={(p) => setProject(p)}
          apiFetch={apiFetch}
          error={error}
          setError={setError}
        />
      )}
    </div>
  );
}

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  return (
    <div onClick={onClick} className="bg-slate-800 border border-slate-700 rounded-lg p-3 cursor-pointer hover:border-blue-500/50 transition">
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
        {task.dueDate && <span className="text-xs text-slate-500">{new Date(task.dueDate).toLocaleDateString()}</span>}
      </div>
      <h4 className="text-white font-medium text-sm mb-1">{task.title}</h4>
      {task.description && <p className="text-slate-400 text-xs line-clamp-2 mb-2">{task.description}</p>}
      <div className="flex items-center justify-between">
        <div className="flex -space-x-1">
          {task.assignees.slice(0, 3).map((a) => (
            <div key={a._id} className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px] font-medium border border-slate-800" title={a.name}>
              {a.name.charAt(0)}
            </div>
          ))}
        </div>
        {task.comments.length > 0 && <span className="text-xs text-slate-500">{task.comments.length} comments</span>}
      </div>
    </div>
  );
}

function CreateTaskModal({ projectId, members, onClose, onCreated, apiFetch }: {
  projectId: string; members: Member[]; onClose: () => void;
  onCreated: (task: Task) => void;
  apiFetch: (url: string, opts?: RequestInit) => Promise<Record<string, unknown>>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const data = await apiFetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify({ title, description, status, priority, assignees }),
      });
      onCreated(data.task as Task);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-white mb-4">Create Task</h3>
        {error && <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-300 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none">
                {STATUS_COLS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Assignees</label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {members.map((m) => (
                <label key={m._id} className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={assignees.includes(m._id)} onChange={(e) => setAssignees(e.target.checked ? [...assignees, m._id] : assignees.filter((x) => x !== m._id))} className="rounded" />
                  {m.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">Create Task</button>
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskDetailModal({ task, projectId, members, currentUserId, onClose, onUpdated, onDeleted, apiFetch }: {
  task: Task; projectId: string; members: Member[]; currentUserId: string;
  onClose: () => void; onUpdated: (t: Task) => void; onDeleted: (id: string) => void;
  apiFetch: (url: string, opts?: RequestInit) => Promise<Record<string, unknown>>;
}) {
  const [commentText, setCommentText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(task.description);
  const [editStatus, setEditStatus] = useState(task.status);
  const [editPriority, setEditPriority] = useState(task.priority);

  useEffect(() => {
    setEditTitle(task.title);
    setEditDesc(task.description);
    setEditStatus(task.status);
    setEditPriority(task.priority);
  }, [task]);

  const handleUpdate = async () => {
    try {
      const data = await apiFetch(`/api/projects/${projectId}/tasks/${task._id}`, {
        method: "PUT",
        body: JSON.stringify({ title: editTitle, description: editDesc, status: editStatus, priority: editPriority }),
      });
      onUpdated(data.task as Task);
      setEditing(false);
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this task?")) return;
    try {
      await apiFetch(`/api/projects/${projectId}/tasks/${task._id}`, { method: "DELETE" });
      onDeleted(task._id);
    } catch { /* ignore */ }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const data = await apiFetch(`/api/projects/${projectId}/tasks/${task._id}/comments`, {
        method: "POST",
        body: JSON.stringify({ text: commentText }),
      });
      onUpdated(data.task as Task);
      setCommentText("");
    } catch { /* ignore */ }
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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            {editing ? (
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-xl font-bold text-white bg-slate-700 border border-slate-600 rounded px-2 py-1 flex-1 mr-2" />
            ) : (
              <h3 className="text-xl font-bold text-white flex-1">{task.title}</h3>
            )}
            <div className="flex gap-2">
              {!editing && <button onClick={() => setEditing(true)} className="text-sm px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg">Edit</button>}
              <button onClick={handleDelete} className="text-sm px-3 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg">Delete</button>
              <button onClick={onClose} className="text-sm px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg">&times;</button>
            </div>
          </div>

          {editing ? (
            <div className="space-y-3 mb-4">
              <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white">
                  {STATUS_COLS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={handleUpdate} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Save</button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <p className="text-slate-300 mb-3">{task.description || "No description"}</p>
              <div className="flex gap-3">
                <span className={`text-xs font-medium px-2 py-1 rounded ${PRIORITY_COLORS[task.priority]} bg-slate-700`}>{task.priority}</span>
                <span className="text-xs font-medium px-2 py-1 rounded text-slate-300 bg-slate-700">{STATUS_COLS.find((s) => s.key === task.status)?.label}</span>
              </div>
            </div>
          )}

          {/* Assignees */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Assignees</h4>
            <div className="flex flex-wrap gap-2">
              {task.assignees.map((a) => (
                <span key={a._id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-300 text-xs rounded-full">
                  {a.name}
                  <button onClick={() => handleUnassign(a._id)} className="hover:text-red-400">&times;</button>
                </span>
              ))}
              {members.filter((m) => !task.assignees.some((a) => a._id === m._id)).map((m) => (
                <button key={m._id} onClick={() => handleAssign(m._id)} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs rounded-full transition">
                  + {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Comments ({task.comments.length})</h4>
            <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
              {task.comments.map((c) => (
                <div key={c._id} className="p-3 bg-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{c.user?.name || "Unknown"}</span>
                    <span className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-300 text-sm">{c.text}</p>
                </div>
              ))}
              {task.comments.length === 0 && <p className="text-slate-500 text-sm">No comments yet</p>}
            </div>
            <form onSubmit={handleComment} className="flex gap-2">
              <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment..." className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition">Send</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function MembersModal({ project, onClose, onUpdated, apiFetch, error, setError }: {
  project: Project; onClose: () => void; onUpdated: (p: Project) => void;
  apiFetch: (url: string, opts?: RequestInit) => Promise<Record<string, unknown>>;
  error: string; setError: (s: string) => void;
}) {
  const [email, setEmail] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const data = await apiFetch(`/api/projects/${project._id}/members`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      onUpdated(data.project as Project);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Project Members</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
        </div>

        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {project.members.map((m) => (
            <div key={m._id} className="flex items-center gap-3 p-2 bg-slate-700/50 rounded-lg">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {m.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white text-sm font-medium">{m.name}</p>
                <p className="text-slate-400 text-xs">{m.email}</p>
              </div>
              {m._id === project.owner._id && <span className="ml-auto text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">Owner</span>}
            </div>
          ))}
        </div>

        {error && <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-300 text-sm">{error}</div>}

        <form onSubmit={handleAdd} className="flex gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Add member by email..." type="email" required className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition">Add</button>
        </form>
      </div>
    </div>
  );
}
