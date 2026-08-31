import { useEffect, useRef, useState } from 'react';
import { Save, FolderOpen, Settings, Loader2, Music } from 'lucide-react';
import { toast } from 'sonner';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/Button';
import { audioEngine } from '@/services/audioEngine';
import { getActiveBank } from '@/utils';

export function TopBar() {
  const project = useProjectStore((s) => s.project);
  const projectName = project.name;
  const isSaving = useProjectStore((s) => s.isSaving);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const saveProject = useProjectStore((s) => s.saveProject);
  const uploadFiles = useProjectStore((s) => s.uploadFiles);
  const assignAssetToPad = useProjectStore((s) => s.assignAssetToPad);
  const selectedPadId = useProjectStore((s) => s.selectedPadId);
  const setLoadModalOpen = useUIStore((s) => s.setLoadModalOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  
  const masterLevel = useProjectStore((s) => s.masterLevel);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  
  // Smooth lerp for analog needle meter
  const [smoothLevel, setSmoothLevel] = useState(0);
  const needleValueRef = useRef(0);

  const handleImportBeat = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const uploaded = await uploadFiles(files);
      if (uploaded.length > 0) {
        const bank = getActiveBank(project);
        const targetPadId = selectedPadId || bank.pads[0].id;
        assignAssetToPad(targetPadId, uploaded[0].id);
        toast.success(`Loaded "${uploaded[0].name}" onto Pad!`);
      }
    } catch (err) {
      console.error('Import failed:', err);
      toast.error('Failed to import beat');
    }
  };

  useEffect(() => {
    let animId: number;
    const updateNeedle = () => {
      const target = masterLevel;
      needleValueRef.current += (target - needleValueRef.current) * 0.25;
      setSmoothLevel(needleValueRef.current);
      animId = requestAnimationFrame(updateNeedle);
    };
    animId = requestAnimationFrame(updateNeedle);
    return () => cancelAnimationFrame(animId);
  }, [masterLevel]);

  // Canvas Oscilloscope visualizer loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const draw = () => {
      const analyser = audioEngine.getAnalyser();
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = 'rgba(10, 10, 12, 0.25)';
      ctx.fillRect(0, 0, width, height);

      if (!analyser) {
        // Draw flat line when no audio playing
        ctx.beginPath();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        animId = requestAnimationFrame(draw);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const timeData = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(timeData);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ff4500';
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = timeData[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  const clampedAngle = -45 + Math.min(1, smoothLevel * 1.6) * 90;

  return (
    <header className="glass h-16 border-b border-white/6 px-3 sm:px-6 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Left: Master Stereo VU Peak Indicators */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* LED Peak Bars */}
        <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded border border-white/5">
          {[0, 1].map((ch) => (
            <div key={ch} className="w-1.5 h-7 bg-neutral-900 rounded-sm overflow-hidden flex flex-col-reverse">
              <div
                className="w-full bg-gradient-to-t from-emerald-500 via-yellow-400 to-red-500 transition-all duration-75"
                style={{ height: `${Math.min(100, masterLevel * 140 * (ch === 0 ? 0.95 : 1.05))}%` }}
              />
            </div>
          ))}
        </div>

        {/* Oscilloscope Canvas (Hidden on small mobile screens) */}
        <div className="hidden md:block w-[240px] lg:w-[450px] h-12 bg-black/40 rounded border border-white/5 overflow-hidden relative">
          <canvas ref={canvasRef} width="450" height="48" className="w-full h-full opacity-90" />
        </div>
      </div>

      {/* Center Project Name Editor */}
      <div className="hidden sm:flex flex-col items-center">
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="bg-transparent text-center text-xs font-mono uppercase tracking-widest border-b border-transparent hover:border-white/10 focus:border-red-500/50 outline-none px-2 py-0.5 max-w-[160px] lg:max-w-[200px] transition-colors text-neutral-400 focus:text-white"
          aria-label="Project name"
        />
        <span className="text-[8px] sm:text-[9px] text-neutral-600 font-mono tracking-wider mt-0.5">MPC PRODUCTION STUDIO</span>
      </div>

      {/* Right: Analog Needle VU Meter & Actions */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Analog Needle VU Meter (Hidden on mobile) */}
        <div className="hidden sm:flex relative w-20 sm:w-24 h-12 sm:h-14 bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden flex-col items-center justify-end p-1 shadow-inner">
          {/* Radial Arc scale */}
          <svg width="80" height="40" viewBox="0 0 80 40" className="absolute top-1.5 opacity-60">
            <path
              d="M 10 35 A 35 35 0 0 1 70 35"
              fill="none"
              stroke="#888"
              strokeWidth="2.5"
              strokeDasharray="2,2"
            />
            {/* Red clipping zone */}
            <path d="M 52 13 A 35 35 0 0 1 70 35" fill="none" stroke="#ef4444" strokeWidth="3" />
            <text x="40" y="32" fontSize="7" fill="#666" textAnchor="middle" fontFamily="monospace">VU</text>
          </svg>
          
          {/* The Needle */}
          <div
            className="absolute w-[2px] h-[32px] bg-red-500 origin-bottom transition-transform duration-75 ease-out shadow-[0_0_4px_red]"
            style={{
              bottom: '4px',
              left: 'calc(50% - 1px)',
              transform: `rotate(${clampedAngle}deg)`,
            }}
          />
          {/* Pivot point cap */}
          <div className="w-3.5 h-3.5 rounded-full bg-neutral-800 border border-neutral-700 z-10 mb-[-6px]" />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {isSaving && (
            <span className="text-[10px] font-mono text-neutral-500 hidden sm:flex items-center gap-1.5 mr-1">
              <Loader2 size={10} className="animate-spin text-red-500" />
              AUTO
            </span>
          )}

          {/* Import Beat Button */}
          <Button
            variant="accent"
            size="sm"
            onClick={() => importInputRef.current?.click()}
            className="bg-[#00E5FF]/20 hover:bg-[#00E5FF]/30 text-[#00E5FF] border border-[#00E5FF]/40 font-mono text-xs px-2.5 py-1 flex items-center gap-1 cursor-pointer touch-manipulation"
          >
            <Music size={13} />
            <span className="hidden sm:inline font-bold">ADD BEAT</span>
          </Button>

          <input
            ref={importInputRef}
            type="file"
            multiple
            accept="audio/*,.wav,.mp3,.ogg,.flac,.aac,.m4a,.webm"
            className="hidden"
            onChange={(e) => void handleImportBeat(e.target.files)}
          />

          <Button variant="ghost" size="sm" onClick={() => void saveProject()} className="hover:text-red-500 text-neutral-400 font-mono text-xs px-2 py-1">
            <Save size={13} className="sm:mr-1" />
            <span className="hidden sm:inline">SAVE</span>
          </Button>

          <Button variant="ghost" size="sm" onClick={() => setLoadModalOpen(true)} className="hover:text-red-500 text-neutral-400 font-mono text-xs px-2 py-1">
            <FolderOpen size={13} className="sm:mr-1" />
            <span className="hidden sm:inline">LOAD</span>
          </Button>

          <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} className="hover:text-red-500 text-neutral-400 p-1.5">
            <Settings size={14} />
          </Button>
        </div>
      </div>
    </header>
  );
}
