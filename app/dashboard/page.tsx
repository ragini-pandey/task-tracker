"use client";


import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApi } from "@/lib/socket-client";
import { useAuth } from "../context/AuthContext";

interface Member {
  _id: string;
  name: string;
  email: string;
}

interface Project {
  _id: string;
  name: string;
  description: string;
  owner: Member;
  members: Member[];
  createdAt: string;
}

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { apiFetch } = useApi();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      apiFetch("/api/projects").then((d) => setProjects(d.projects)).catch(console.error);
    }
  }, [user, apiFetch]);

  if (loading || !user) return <div className="flex h-screen items-center justify-center bg-slate-900"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const data = await apiFetch("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      setProjects((prev) => [data.project, ...prev]);
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await apiFetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(data.results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Task Manager</h1>
          <div className="flex items-center gap-4">
            <span className="text-slate-300 text-sm">{user.name}</span>
            <button onClick={logout} className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {/* Global Search */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-2">
            <input
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks across all projects..."
              className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" disabled={searching} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50">
              {searching ? "..." : "Search"}
            </button>
          </div>
        </form>

        {searchResults.length > 0 && (
          <div className="mb-8 bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Search Results ({searchResults.length})</h3>
              <button onClick={() => setSearchResults([])} className="text-slate-400 hover:text-white text-sm">Clear</button>
            </div>
            <div className="space-y-2">
              {searchResults.map((task) => (
                <div
                  key={task._id as string}
                  className="p-3 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-700 transition"
                  onClick={() => router.push(`/projects/${(task.project as Record<string, string>)?._id || task.project}`)}
                >
                  <p className="text-white font-medium">{task.title as string}</p>
                  <p className="text-slate-400 text-sm truncate">{task.description as string}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects Section */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Your Projects</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
          >
            + New Project
          </button>
        </div>

        {/* Create Project Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-white mb-4">Create Project</h3>
              {error && <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-300 text-sm">{error}</div>}
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Name</label>
                  <input
                    value={newName} onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Description</label>
                  <textarea
                    value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">Create</button>
                  <button type="button" onClick={() => { setShowCreate(false); setError(""); }} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 text-lg">No projects yet. Create your first one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project._id}
                onClick={() => router.push(`/projects/${project._id}`)}
                className="bg-slate-800 border border-slate-700 rounded-xl p-5 cursor-pointer hover:border-blue-500/50 hover:bg-slate-800/80 transition group"
              >
                <h3 className="text-white font-semibold text-lg mb-1 group-hover:text-blue-400 transition">{project.name}</h3>
                <p className="text-slate-400 text-sm mb-4 line-clamp-2">{project.description || "No description"}</p>
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {project.members.slice(0, 5).map((m) => (
                      <div key={m._id} className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-slate-800" title={m.name}>
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {project.members.length > 5 && (
                      <div className="w-7 h-7 bg-slate-600 rounded-full flex items-center justify-center text-white text-xs border-2 border-slate-800">
                        +{project.members.length - 5}
                      </div>
                    )}
                  </div>
                  <span className="text-slate-500 text-xs">{new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
