import { useEffect, useRef, useState } from 'react';
import { Save, FolderOpen, Settings, Loader2 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/Button';
import { audioEngine } from '@/services/audioEngine';

export function TopBar() {
  const projectName = useProjectStore((s) => s.project.name);
  const isSaving = useProjectStore((s) => s.isSaving);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const saveProject = useProjectStore((s) => s.saveProject);
  const setLoadModalOpen = useUIStore((s) => s.setLoadModalOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  
  const masterLevel = useProjectStore((s) => s.masterLevel);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Smooth lerp for analog needle meter
  const [smoothLevel, setSmoothLevel] = useState(0);
  const needleValueRef = useRef(0);

  useEffect(() => {
    let animId: number;
    const updateNeedle = () => {
      const target = masterLevel;
      // Lerp with spring-like response
      needleValueRef.current += (target - needleValueRef.current) * 0.15;
      setSmoothLevel(needleValueRef.current);
      animId = requestAnimationFrame(updateNeedle);
    };
    animId = requestAnimationFrame(updateNeedle);
    return () => cancelAnimationFrame(animId);
  }, [masterLevel]);

  // Oscilloscope canvas loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const bufferLength = 128;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animId = requestAnimationFrame(draw);
      
      const width = canvas.width;
      const height = canvas.height;
      
      ctx.clearRect(0, 0, width, height);

      const analyser = audioEngine.getAnalyser();
      if (analyser) {
        analyser.getByteTimeDomainData(dataArray);
      } else {
        // Fallback: idle noise hum
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = 128 + Math.sin(Date.now() * 0.005 + i * 0.1) * 2 * (Math.random() * 0.5 + 0.5);
        }
      }

      ctx.lineWidth = 1.5;
      
      // Draw Stereo Waveform (Line 1: White/Grey top, Line 2: Blue/Grey bottom)
      ctx.beginPath();
      let sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        // Apply slight stereo spacing shift for visual complexity
        const offset = Math.sin(i * 0.2 + Date.now() * 0.01) * 3 * (masterLevel + 0.05);
        const y = (v * height) / 2 + offset - 4;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }
      ctx.strokeStyle = 'rgba(230, 230, 230, 0.7)';
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
      ctx.stroke();

      // Lower secondary line (Out of phase look)
      ctx.beginPath();
      x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[bufferLength - 1 - i] / 128.0;
        const offset = Math.cos(i * 0.25 + Date.now() * 0.008) * 4 * (masterLevel + 0.05);
        const y = (v * height) / 2 + offset + 4;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }
      ctx.strokeStyle = 'rgba(150, 160, 180, 0.4)';
      ctx.shadowBlur = 0;
      ctx.stroke();
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [masterLevel]);

  // Analog meter angle: -60deg to +60deg
  const needleAngle = (smoothLevel * 100); // map from 0..1 to angle degrees (approx 0 to 80 deg rotation)
  const clampedAngle = Math.min(85, Math.max(-5, needleAngle - 40));

  return (
    <header className="bg-[#0b0b0c] text-white flex items-center justify-between px-6 h-20 shrink-0 border-b border-[#1b1b1c] z-10 select-none">
      {/* Center-Left: Wireframe Diamond & Twin Level Bars */}
      <div className="flex items-center gap-6">
        {/* Wireframe Diamond */}
        <div className="relative w-10 h-10 flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 100 100" className="animate-[spin_8s_linear_infinite]">
            <polygon
              points="50,5 95,50 50,95 5,50"
              fill="none"
              stroke="rgba(255,255,255,0.7)"
              strokeWidth="2.5"
            />
            <line x1="50" y1="5" x2="50" y2="95" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            <line x1="5" y1="50" x2="95" y2="50" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            <polygon
              points="50,20 80,50 50,80 20,50"
              fill="none"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1.5"
            />
          </svg>
        </div>

        {/* Twin Vertical VU Meters */}
        <div className="flex gap-1 h-9 sm:h-12 bg-black/40 p-1 sm:p-1.5 rounded border border-white/5">
          {[0, 1].map((ch) => (
            <div key={ch} className="w-1.5 h-full bg-neutral-900 rounded-sm overflow-hidden flex flex-col justify-end">
              <div
                className="w-full bg-gradient-to-t from-emerald-500 via-yellow-500 to-red-500 transition-all duration-75"
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
      <div className="flex items-center gap-2 sm:gap-6">
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
          <Button variant="ghost" size="sm" onClick={() => void saveProject()} className="hover:text-red-500 text-neutral-400 font-mono text-xs px-2 py-1">
            <Save size={13} className="sm:mr-1" />
            <span className="hidden sm:inline">SAVE</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setLoadModalOpen(true)} className="hover:text-red-500 text-neutral-400 font-mono text-xs px-2 py-1">
            <FolderOpen size={13} className="sm:mr-1" />
            <span className="hidden sm:inline">LOAD</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} className="hover:text-red-500 text-neutral-400 px-2 py-1">
            <Settings size={14} />
          </Button>
        </div>
      </div>
    </header>
  );
}
