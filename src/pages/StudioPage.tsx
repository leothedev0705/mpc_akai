import { Loader2 } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { LeftSidebar } from '@/components/layout/LeftSidebar';
import { RightSidebar } from '@/components/layout/RightSidebar';
import { MpcConsole } from '@/components/layout/MpcConsole';
import { WaveformDisplay } from '@/components/waveform/WaveformDisplay';
import { LoadProjectModal } from '@/features/projects/LoadProjectModal';
import { SettingsModal } from '@/features/settings/SettingsModal';
import { InfoModal } from '@/features/settings/InfoModal';
import { SampleRecorderModal } from '@/features/sampler/SampleRecorderModal';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';

export function StudioPage() {
  const isLoading = useProjectStore((s) => s.isLoading);
  const selectedPadId = useProjectStore((s) => s.selectedPadId);
  const rightSidebarOpen = useUIStore((s) => s.rightSidebarOpen);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 bg-[#060608]">
        <Loader2 size={32} className="text-red-500 animate-spin" />
        <p className="text-sm font-mono text-neutral-400">LOADING WEB MPC...</p>
      </div>
    );
  }

  return (
    <>
      <TopBar />
      <div className="flex flex-1 overflow-hidden bg-[#060608]">
        {/* Left rack panel (library & browser) */}
        <LeftSidebar />
        
        {/* Center workspace containing the skeuomorphic MPC console */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-y-auto relative bg-[#0d0d0f] flex items-center justify-center">
            <MpcConsole />
          </div>
          
          {/* Display waveform editor only when pad is selected */}
          {selectedPadId && (
            <footer className="bg-[#121214] shrink-0 border-t border-white/5 shadow-md">
              <WaveformDisplay />
            </footer>
          )}
        </main>
        
        {/* Right rack panel (pad settings faders) */}
        {rightSidebarOpen && <RightSidebar />}
      </div>
      <LoadProjectModal />
      <SettingsModal />
      <InfoModal />
      <SampleRecorderModal />
    </>
  );
}
