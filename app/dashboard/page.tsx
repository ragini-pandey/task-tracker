"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/socket-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Search, LogOut, X, FolderKanban, Calendar, AlertCircle, RefreshCw } from "lucide-react";
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
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>([]);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError("");
    try {
      const d = await apiFetch("/api/projects");
      setProjects(d.projects as Project[]);
    } catch {
      setProjectsError("Failed to load projects. Please try again.");
    } finally {
      setProjectsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (user) loadProjects();
  }, [user, loadProjects]);

  if (loading || !user) return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const data = await apiFetch("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      setProjects((prev) => [data.project as Project, ...prev]);
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError("");
    setSearchResults([]);
    try {
      const data = await apiFetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const results = data.results as Record<string, unknown>[];
      setSearchResults(results);
      if (results.length === 0) setSearchError("No results found for your query.");
    } catch {
      setSearchError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-md px-6 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Task Manager</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground hidden sm:block">{user.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4 mr-1.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {/* Global Search */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-2 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setSearchError(""); }}
                placeholder="Search tasks across all projects..."
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={searching} size="default">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>
          {searchError && !searching && (
            <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
              {searchError}
            </p>
          )}
        </form>

        {searchResults.length > 0 && (
          <Card className="mb-8 border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4 text-primary" />
                  Search Results
                  <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{searchResults.length}</span>
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSearchResults([])} className="h-7 w-7 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {searchResults.map((task) => (
                <div
                  key={task._id as string}
                  className="p-3 rounded-lg cursor-pointer hover:bg-accent transition-colors group"
                  onClick={() => router.push(`/projects/${(task.project as Record<string, string>)?._id || task.project}`)}
                >
                  <p className="font-medium text-foreground group-hover:text-primary transition-colors">{task.title as string}</p>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{task.description as string}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Projects Section */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Your Projects</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Create Project Dialog */}
        <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) setError(""); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-primary" />
                Create New Project
              </DialogTitle>
              <DialogDescription className="sr-only">Fill in the project name and description to create a new project.</DialogDescription>
            </DialogHeader>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name</Label>
                <Input id="project-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My awesome project" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea id="project-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What is this project about?" rows={3} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setError(""); }} disabled={creating}>Cancel</Button>
                <Button type="submit" disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  {creating ? "Creating..." : "Create Project"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Projects Grid */}
        {projectsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card py-6 animate-pulse">
                <div className="px-6 pb-2">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded-md w-3/4 mb-2" />
                      <div className="h-3 bg-muted rounded-md w-full mb-1" />
                      <div className="h-3 bg-muted rounded-md w-2/3" />
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-muted shrink-0" />
                  </div>
                </div>
                <div className="px-6">
                  <div className="h-px bg-muted mb-3" />
                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-1">
                      {[0,1,2].map(j => <div key={j} className="h-6 w-6 rounded-full bg-muted border-2 border-card" />)}
                    </div>
                    <div className="h-3 w-20 rounded-md bg-muted" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : projectsError ? (
          <div className="text-center py-20 border-2 border-dashed border-destructive/20 rounded-xl">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <p className="text-foreground font-semibold text-lg mb-1">Failed to load projects</p>
            <p className="text-muted-foreground text-sm mb-5">{projectsError}</p>
            <Button variant="outline" onClick={loadProjects} disabled={projectsLoading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-border rounded-xl">
            <FolderKanban className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground text-lg font-medium">No projects yet</p>
            <p className="text-muted-foreground/70 text-sm mt-1 mb-4">Create your first project to get started</p>
            <Button onClick={() => setShowCreate(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((project) => (
              <Card
                key={project._id}
                className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 group overflow-hidden"
                onClick={() => router.push(`/projects/${project._id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base group-hover:text-primary transition-colors truncate">{project.name}</CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">{project.description || "No description"}</CardDescription>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FolderKanban className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Separator className="mb-3" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {project.members.slice(0, 4).map((m) => (
                          <Avatar key={m._id} className="h-6 w-6 border-2 border-background ring-0">
                            <AvatarFallback className="text-[10px] bg-primary/80 text-primary-foreground">{m.name.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                        ))}
                        {project.members.length > 4 && (
                          <Avatar className="h-6 w-6 border-2 border-background">
                            <AvatarFallback className="text-[10px]">+{project.members.length - 4}</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{project.members.length} member{project.members.length !== 1 ? "s" : ""}</span>
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
