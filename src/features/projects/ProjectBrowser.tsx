import { useEffect, useState } from 'react';
import { Plus, FolderOpen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProjectStore } from '@/stores/projectStore';
import { dbService } from '@/services/storageService';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

interface ProjectEntry {
  id: string;
  name: string;
  updatedAt: number;
}

export function ProjectBrowser() {
  const currentId = useProjectStore((s) => s.project.id);
  const loadProject = useProjectStore((s) => s.loadProject);
  const newProject = useProjectStore((s) => s.newProject);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);

  const refresh = async () => {
    const list = await dbService.listProjects();
    setProjects(list);
  };

  useEffect(() => {
    void refresh();
  }, [currentId]);

  const handleLoad = async (id: string) => {
    const ok = await loadProject(id);
    if (ok) toast.success('Project loaded');
    else toast.error('Failed to load project');
  };

  const handleDelete = async (id: string, name: string) => {
    await dbService.deleteProject(id);
    toast.success(`Deleted "${name}"`);
    void refresh();
  };

  return (
    <div className="space-y-3">
      <Button
        variant="accent"
        size="sm"
        className="w-full"
        onClick={() => {
          newProject();
          toast.success('New project created');
        }}
      >
        <Plus size={14} />
        New Project
      </Button>

      {projects.length === 0 ? (
        <p className="text-xs text-muted text-center py-4">No saved projects</p>
      ) : (
        <ul className="space-y-1">
          {projects.map((p) => (
            <li
              key={p.id}
              className={cn(
                'group flex items-center gap-2 p-2 rounded-lg transition-colors',
                p.id === currentId ? 'bg-accent/10 border border-accent/20' : 'hover:bg-white/5',
              )}
            >
              <FolderOpen size={14} className="text-muted shrink-0" />
              <button
                className="flex-1 min-w-0 text-left"
                onClick={() => void handleLoad(p.id)}
              >
                <p className="text-xs font-medium truncate">{p.name}</p>
                <p className="text-[10px] text-muted">
                  {new Date(p.updatedAt).toLocaleDateString()}
                </p>
              </button>
              <button
                onClick={() => void handleDelete(p.id, p.name)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-danger/20 text-muted hover:text-danger transition-all"
                aria-label={`Delete ${p.name}`}
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
