import { Layers, Music, FolderKanban } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { BANK_IDS } from '@/types';
import { cn } from '@/utils/cn';
import { AudioLibrary } from '@/features/library/AudioLibrary';
import { ProjectBrowser } from '@/features/projects/ProjectBrowser';

const tabs = [
  { id: 'banks' as const, label: 'Banks', icon: Layers },
  { id: 'library' as const, label: 'Library', icon: Music },
  { id: 'projects' as const, label: 'Projects', icon: FolderKanban },
];

export function LeftSidebar() {
  const leftPanel = useUIStore((s) => s.leftPanel);
  const setLeftPanel = useUIStore((s) => s.setLeftPanel);
  const activeBankId = useProjectStore((s) => s.project.activeBankId);
  const setActiveBank = useProjectStore((s) => s.setActiveBank);

  return (
    <aside className="glass w-64 shrink-0 flex flex-col border-r border-white/6 overflow-hidden">
      <div className="flex border-b border-white/6">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setLeftPanel(id)}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors',
              leftPanel === id ? 'text-accent bg-accent/5' : 'text-muted hover:text-text',
            )}
            aria-selected={leftPanel === id}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {leftPanel === 'banks' && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider px-1 mb-3">
              Performance Banks
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {BANK_IDS.map((bankId) => (
                <button
                  key={bankId}
                  onClick={() => setActiveBank(bankId)}
                  className={cn(
                    'hardware-btn rounded-lg py-3 text-sm font-bold transition-all',
                    activeBankId === bankId
                      ? 'text-accent border-accent/40 shadow-[0_0_16px_rgba(0,229,255,0.15)]'
                      : 'text-muted hover:text-text',
                  )}
                  aria-pressed={activeBankId === bankId}
                >
                  Bank {bankId}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted/60 px-1 mt-4 leading-relaxed">
              Switch banks to access different pad layouts. Each bank holds 16 independent pads.
            </p>
          </div>
        )}

        {leftPanel === 'library' && <AudioLibrary />}
        {leftPanel === 'projects' && <ProjectBrowser />}
      </div>
    </aside>
  );
}
