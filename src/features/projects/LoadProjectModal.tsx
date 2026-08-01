import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { dbService } from '@/services/storageService';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

export function LoadProjectModal() {
  const open = useUIStore((s) => s.loadModalOpen);
  const setLoadModalOpen = useUIStore((s) => s.setLoadModalOpen);
  const currentId = useProjectStore((s) => s.project.id);
  const loadProject = useProjectStore((s) => s.loadProject);
  const newProject = useProjectStore((s) => s.newProject);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; updatedAt: number }>>([]);

  useEffect(() => {
    if (open) {
      void dbService.listProjects().then(setProjects);
    }
  }, [open]);

  const handleLoad = async (id: string) => {
    const ok = await loadProject(id);
    if (ok) {
      toast.success('Project loaded');
      setLoadModalOpen(false);
    } else {
      toast.error('Failed to load project');
    }
  };

  return (
    <Modal open={open} onClose={() => setLoadModalOpen(false)} title="Load Project">
      <div className="space-y-4">
        <Button
          variant="accent"
          className="w-full"
          onClick={() => {
            newProject();
            toast.success('New project created');
            setLoadModalOpen(false);
          }}
        >
          Create New Project
        </Button>

        {projects.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">No saved projects found</p>
        ) : (
          <ul className="space-y-2">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => void handleLoad(p.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg transition-colors hardware-btn',
                    p.id === currentId && 'border-accent/30',
                  )}
                >
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted mt-0.5">
                    Last saved {new Date(p.updatedAt).toLocaleString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
