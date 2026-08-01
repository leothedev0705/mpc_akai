import React, { useState, useRef, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { getActiveBank } from '@/utils';
import { PadGrid } from '@/components/pads/PadGrid';
import { cn } from '@/utils/cn';

export function MpcConsole() {
  const project = useProjectStore((s) => s.project);
  const activeBankId = project.activeBankId;
  const setActiveBank = useProjectStore((s) => s.setActiveBank);
  const selectedPadId = useProjectStore((s) => s.selectedPadId);
  const masterVolume = project.masterVolume;
  const setMasterVolume = useProjectStore((s) => s.setMasterVolume);
  const playingPadIds = useProjectStore((s) => s.playingPadIds);

  const stopAll = useProjectStore((s) => s.stopAll);
  const triggerPad = useProjectStore((s) => s.triggerPad);

  // Jog wheel rotation state
  const [jogRotation, setJogRotation] = useState(0);
  const jogRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const prevAngleRef = useRef(0);

  // Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isOverdubbing, setIsOverdubbing] = useState(false);

  // F-buttons toggles / dummy feedback
  const [activeFButton, setActiveFButton] = useState<number | null>(null);

  // Locate the active pad & asset details for the LCD Screen
  const bank = getActiveBank(project);
  const activePad = useMemo(
    () => bank.pads.find((p) => p.id === selectedPadId),
    [bank.pads, selectedPadId]
  );
  
  // Find currently playing pad names
  const playingPadName = useMemo(() => {
    if (playingPadIds.size === 0) return null;
    const playingId = Array.from(playingPadIds)[0];
    for (const b of project.banks) {
      const p = b.pads.find((pad) => pad.id === playingId);
      if (p) return p.name;
    }
    return null;
  }, [playingPadIds, project.banks]);

  // Handle Dragging Jog Wheel
  const handleJogPointerDown = (e: React.PointerEvent) => {
    if (!jogRef.current) return;
    isDraggingRef.current = true;
    jogRef.current.setPointerCapture(e.pointerId);
    
    const rect = jogRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    prevAngleRef.current = angle;
  };

  const handleJogPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !jogRef.current) return;
    
    const rect = jogRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    
    let diff = angle - prevAngleRef.current;
    // Normalize wrapping
    if (diff > Math.PI) diff -= 2 * Math.PI;
    if (diff < -Math.PI) diff += 2 * Math.PI;

    const angleDeg = (diff * 180) / Math.PI;
    setJogRotation((prev) => prev + angleDeg);
    prevAngleRef.current = angle;

    // Jog wheel interaction: cycle through pads or tweak volume
    if (Math.abs(angleDeg) > 4) {
      if (activePad) {
        // Change volume of selected pad
        const volDiff = angleDeg > 0 ? 0.05 : -0.05;
        const newVol = Math.max(0, Math.min(1, activePad.volume + volDiff));
        useProjectStore.getState().updatePad(activePad.id, { volume: newVol });
      }
    }
  };

  const handleJogPointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    if (jogRef.current) {
      try {
        jogRef.current.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleTransportClick = (type: 'rec' | 'overdub' | 'stop' | 'play' | 'playstart') => {
    if (type === 'stop') {
      stopAll();
      setIsPlaying(false);
      setIsRecording(false);
      setIsOverdubbing(false);
    } else if (type === 'play' || type === 'playstart') {
      setIsPlaying(true);
      // Trigger first playing pad if any has asset and nothing is playing
      const firstPadWithAsset = bank.pads.find(p => p.assetId);
      if (firstPadWithAsset && playingPadIds.size === 0) {
        void triggerPad(firstPadWithAsset.id);
      }
    } else if (type === 'rec') {
      setIsRecording(prev => !prev);
      setIsPlaying(true);
    } else if (type === 'overdub') {
      setIsOverdubbing(prev => !prev);
      setIsPlaying(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#121214] overflow-y-auto select-none">
      {/* Outer MPC 2000XL Chassis */}
      <div className="relative w-full max-w-[1050px] bg-gradient-to-b from-[#404044] via-[#2f2f32] to-[#252528] rounded-2xl border-4 border-[#1b1b1c] shadow-[0_25px_60px_rgba(0,0,0,0.85),inset_0_2px_4px_rgba(255,255,255,0.15)] p-8 flex flex-col lg:flex-row gap-8">
        
        {/* Decorative Screw details */}
        <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-neutral-600 border border-neutral-800 flex items-center justify-center shadow-inner text-[6px] font-bold text-neutral-800">x</div>
        <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-neutral-600 border border-neutral-800 flex items-center justify-center shadow-inner text-[6px] font-bold text-neutral-800">x</div>
        <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-neutral-600 border border-neutral-800 flex items-center justify-center shadow-inner text-[6px] font-bold text-neutral-800">x</div>
        <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-neutral-600 border border-neutral-800 flex items-center justify-center shadow-inner text-[6px] font-bold text-neutral-800">x</div>

        {/* LEFT PANEL: LCD, Function Buttons, Jog Dial, Note Slider, Transport */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          
          {/* LCD Screen Container */}
          <div className="relative mb-6">
            {/* Vintage AKAI Brand stamp */}
            <div className="flex items-baseline gap-2 mb-2 text-neutral-400 font-mono tracking-widest text-[10px] font-bold">
              <span className="text-sm font-extrabold text-neutral-200">AKAI</span> professional
            </div>

            {/* Glowing Red Backlit LCD Display */}
            <div className="w-full bg-[#3d0303] border-4 border-neutral-900 rounded-lg p-4 font-lcd tracking-wide shadow-[0_0_15px_rgba(230,10,10,0.15),inset_0_2px_6px_black] text-[#ff3a3a]">
              <div className="text-xl uppercase flex justify-between">
                <span>{playingPadName ? `PLAY: ${playingPadName}` : (activePad ? activePad.name : 'FATHER')}</span>
                <span className="text-[12px] font-mono tracking-normal text-red-700 animate-pulse">POWERED BY Growthr</span>
              </div>
              <div className="text-lg opacity-90 h-6 truncate font-mono text-sm tracking-tight text-red-500">
                {activePad ? `SHORTCUT: "${activePad.shortcut.toUpperCase()}" | VOL: ${Math.round(activePad.volume*100)}%` : 'TS FEAT. TRAVIS SCOTT'}
              </div>
              <div className="text-base flex justify-between font-mono text-[11px] opacity-75 mt-1 border-t border-red-950 pt-1">
                <span>PAD BANK: {activeBankId} | BPM: 130</span>
                <span>OCTAVE: C3</span>
              </div>
            </div>

            {/* F1 - F6 Soft-Buttons under LCD */}
            <div className="grid grid-cols-6 gap-2.5 mt-2.5 px-2">
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  onClick={() => setActiveFButton(num === activeFButton ? null : num)}
                  className={cn(
                    "h-6 rounded bg-gradient-to-b from-[#4a4a4f] to-[#2f2f32] border border-neutral-950 text-[9px] font-bold text-neutral-400 shadow-sm active:translate-y-[1px] active:shadow-inner hover:text-white transition-all duration-75",
                    activeFButton === num && "from-[#ff4500] to-[#b33000] text-white border-red-950 shadow-[0_0_8px_rgba(255,69,0,0.5)]"
                  )}
                >
                  F{num}
                </button>
              ))}
            </div>
          </div>

          {/* Controls Cluster: Function Buttons, Jog Dial, Note Slider */}
          <div className="grid grid-cols-12 gap-4 flex-1 items-start mt-2">
            
            {/* Columns 1-4: Function keys grid */}
            <div className="col-span-4 grid grid-cols-3 gap-2 bg-black/10 p-2 rounded-lg border border-white/5">
              {[
                { label: '7', sub: 'OTHER' }, { label: '8', sub: 'MIDI' }, { label: '9', sub: 'SYNC' },
                { label: '4', sub: 'SAMPLING' }, { label: '5', sub: 'STEP EDIT' }, { label: '6', sub: 'MIXER' },
                { label: '1', sub: 'MAIN SCREEN' }, { label: '2', sub: 'DRUM' }, { label: '3', sub: 'PROGRAM' },
                { label: 'SHIFT', sub: 'NOTE VAR', isSpecial: true }, { label: '0', sub: 'HELP' }, { label: 'ENT', sub: 'UNDO' }
              ].map((btn, idx) => (
                <button
                  key={idx}
                  className={cn(
                    "flex flex-col items-center justify-center p-1 min-h-[40px] rounded border border-neutral-950 bg-gradient-to-b from-[#3a3a3e] to-[#252528] active:translate-y-[1px] shadow-sm hover:from-[#404044] hover:to-[#2b2b2e]",
                    btn.isSpecial && "from-[#ff6200]/20 to-[#ff6200]/5 border-orange-950/50"
                  )}
                >
                  <span className="text-[10px] font-bold text-neutral-200">{btn.label}</span>
                  <span className="text-[6px] font-mono text-neutral-500 uppercase tracking-tight">{btn.sub}</span>
                </button>
              ))}
            </div>

            {/* Column 5: Note Variation Slider */}
            <div className="col-span-3 flex flex-col items-center justify-between h-full py-2 bg-black/10 rounded-lg border border-white/5 min-h-[170px]">
              <span className="text-[7px] text-neutral-500 font-mono tracking-widest uppercase">NOTE VARIATION</span>
              
              <div className="relative flex-1 w-full flex items-center justify-center py-2">
                {/* Scale markings */}
                <div className="absolute left-3 top-2 bottom-2 flex flex-col justify-between text-[6px] font-mono text-neutral-600">
                  <span>MAX</span>
                  <span>- 0</span>
                  <span>- 12</span>
                  <span>- 24</span>
                  <span>MIN</span>
                </div>
                
                {/* Fader track */}
                <div className="h-full w-[4px] bg-[#151516] rounded-full border border-neutral-800 relative">
                  {/* Slider Knob */}
                  <div
                    className="absolute left-[-8px] w-5 h-8 bg-gradient-to-b from-[#ececed] via-[#9da2a6] to-[#6a6d70] border border-neutral-800 rounded-sm cursor-pointer shadow-md hover:brightness-110 active:brightness-95 flex flex-col items-center justify-center gap-0.5"
                    style={{ bottom: `${masterVolume * 80}%` }}
                    onPointerDown={(e) => {
                      const track = e.currentTarget.parentElement;
                      if (!track) return;
                      const rect = track.getBoundingClientRect();
                      
                      const moveHandler = (moveEvent: PointerEvent) => {
                        const y = Math.max(0, Math.min(1, 1 - (moveEvent.clientY - rect.top) / rect.height));
                        setMasterVolume(y);
                      };
                      
                      const upHandler = () => {
                        window.removeEventListener('pointermove', moveHandler);
                        window.removeEventListener('pointerup', upHandler);
                      };

                      window.addEventListener('pointermove', moveHandler);
                      window.addEventListener('pointerup', upHandler);
                    }}
                  >
                    {/* Horizontal grip notch */}
                    <div className="w-full h-[2px] bg-neutral-900 opacity-60" />
                  </div>
                </div>
              </div>

              <span className="text-[7px] text-neutral-400 font-mono tracking-widest">VOLUME</span>
            </div>

            {/* Columns 6-12: Big Jog Wheel & Cursor section */}
            <div className="col-span-5 flex flex-col items-center justify-center">
              {/* OPEN WINDOW / PREV STEP */}
              <div className="flex gap-4 mb-3">
                <button className="px-3 py-1.5 rounded bg-red-600 border border-red-800 active:translate-y-[1px] shadow-sm hover:brightness-110 flex flex-col items-center">
                  <span className="text-[8px] font-bold text-white">OPEN WINDOW</span>
                </button>
                <button className="px-3 py-1.5 rounded bg-gradient-to-b from-[#3a3a3e] to-[#252528] border border-neutral-950 active:translate-y-[1px] shadow-sm hover:brightness-110 flex flex-col items-center">
                  <span className="text-[8px] font-bold text-neutral-300">PREV STEP</span>
                </button>
              </div>

              {/* Rotary Jog Dial */}
              <div
                ref={jogRef}
                className="relative w-28 h-28 rounded-full bg-gradient-to-b from-[#1b1b1c] via-[#2f2f32] to-[#121213] border-4 border-neutral-900 shadow-[0_6px_16px_rgba(0,0,0,0.6),inset_0_2px_4px_rgba(255,255,255,0.1)] flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
                style={{ transform: `rotate(${jogRotation}deg)` }}
                onPointerDown={handleJogPointerDown}
                onPointerMove={handleJogPointerMove}
                onPointerUp={handleJogPointerUp}
              >
                {/* Outer ring texture */}
                <div className="absolute inset-2 rounded-full border border-neutral-800/40 opacity-40 animate-[spin_100s_linear_infinite]" />
                
                {/* Finger Indent Pit */}
                <div className="absolute top-3 w-5 h-5 rounded-full bg-[#151516] border border-neutral-800 shadow-inner flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
                </div>

                {/* Center cap */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-t from-[#252528] to-[#3a3a3e] border border-neutral-800 shadow-md flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-neutral-900 opacity-60" />
                </div>
              </div>

              {/* D-Pad / Locator keys */}
              <div className="mt-4 flex flex-col items-center gap-1">
                {/* Up Button */}
                <button className="w-8 h-6 bg-gradient-to-b from-[#3a3a3e] to-[#252528] border border-neutral-950 rounded flex items-center justify-center active:translate-y-[0.5px]">
                  <span className="text-[7px] text-neutral-300 font-bold">▲</span>
                </button>
                <div className="flex gap-4">
                  {/* Left Button */}
                  <button className="w-8 h-6 bg-gradient-to-b from-[#3a3a3e] to-[#252528] border border-neutral-950 rounded flex items-center justify-center active:translate-y-[0.5px]">
                    <span className="text-[7px] text-neutral-300 font-bold">◀</span>
                  </button>
                  {/* Center Cursor button */}
                  <div className="w-8 h-6 flex items-center justify-center">
                    <span className="text-[6px] font-mono text-neutral-500 uppercase">CURSOR</span>
                  </div>
                  {/* Right Button */}
                  <button className="w-8 h-6 bg-gradient-to-b from-[#3a3a3e] to-[#252528] border border-neutral-950 rounded flex items-center justify-center active:translate-y-[0.5px]">
                    <span className="text-[7px] text-neutral-300 font-bold">▶</span>
                  </button>
                </div>
                {/* Down Button */}
                <button className="w-8 h-6 bg-gradient-to-b from-[#3a3a3e] to-[#252528] border border-neutral-950 rounded flex items-center justify-center active:translate-y-[0.5px]">
                  <span className="text-[7px] text-neutral-300 font-bold">▼</span>
                </button>
              </div>

            </div>
          </div>

          {/* Bottom Left: Transport Keys Panel */}
          <div className="flex gap-2.5 mt-6 border-t border-white/5 pt-4">
            {[
              { type: 'rec', label: 'REC', isRed: true, led: isRecording },
              { type: 'overdub', label: 'OVER DUB', isRed: true, led: isOverdubbing },
              { type: 'stop', label: 'STOP', isRed: false },
              { type: 'play', label: 'PLAY', isRed: false, led: isPlaying && !isRecording && !isOverdubbing },
              { type: 'playstart', label: 'PLAY START', isRed: false }
            ].map((btn) => (
              <button
                key={btn.type}
                onClick={() => handleTransportClick(btn.type as any)}
                className={cn(
                  "relative flex-1 py-3 rounded-lg border-2 text-[10px] font-extrabold shadow-md active:translate-y-[1px] active:shadow-inner transition-all flex flex-col items-center justify-center gap-1",
                  btn.isRed 
                    ? "bg-[#250808] hover:bg-[#350d0d] border-red-950 text-red-500 active:border-red-900" 
                    : "bg-gradient-to-b from-[#3e3e42] to-[#252528] hover:brightness-110 border-neutral-950 text-neutral-300"
                )}
              >
                {/* LED Indicator dot */}
                {btn.led !== undefined && (
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full absolute top-1.5",
                      btn.led 
                        ? (btn.isRed ? "bg-red-500 shadow-[0_0_8px_red]" : "bg-green-500 shadow-[0_0_8px_#2eeb8b]")
                        : "bg-neutral-800"
                    )}
                  />
                )}
                <span className={btn.led !== undefined ? "mt-1.5" : ""}>{btn.label}</span>
              </button>
            ))}
          </div>

        </div>

        {/* RIGHT PANEL: Pad Bank selection, MPC logo, Volume dials, the Pad Grid */}
        <div className="w-full lg:w-[480px] flex flex-col justify-between">
          
          {/* Top Panel: logo, dials, pad banks */}
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
            
            {/* PAD BANK selection buttons */}
            <div className="flex flex-col gap-1">
              <span className="text-[7px] text-neutral-400 font-mono tracking-wider">PAD BANK</span>
              <div className="flex gap-1.5">
                {(['A', 'B', 'C', 'D'] as const).map((bankId) => (
                  <div key={bankId} className="flex flex-col items-center gap-1">
                    {/* Tiny Orange LED above the button */}
                    <div
                      className={cn(
                        "w-1.5 h-1.5 rounded-full transition-all duration-150",
                        activeBankId === bankId ? "bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,1)]" : "bg-neutral-850"
                      )}
                    />
                    <button
                      onClick={() => setActiveBank(bankId)}
                      className={cn(
                        "w-8 h-6 rounded text-[10px] font-bold transition-all border border-neutral-950 flex items-center justify-center active:translate-y-[0.5px]",
                        activeBankId === bankId
                          ? "bg-gradient-to-b from-[#ff8c00] to-[#cc7000] text-white shadow-inner"
                          : "bg-gradient-to-b from-[#3a3a3e] to-[#252528] text-neutral-400 hover:text-white"
                      )}
                    >
                      {bankId}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Dials: REC GAIN, MAIN VOLUME */}
            <div className="flex gap-4">
              {[
                { name: 'REC GAIN', val: 0.4 },
                { name: 'MAIN VOLUME', val: masterVolume, setVal: setMasterVolume }
              ].map((dial, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <span className="text-[7px] text-neutral-400 font-mono mb-1">{dial.name}</span>
                  
                  {/* Rotary Dial Knob SVG */}
                  <div 
                    className="relative w-10 h-10 rounded-full bg-gradient-to-b from-[#2e2e30] to-[#121213] border-2 border-neutral-900 shadow-md cursor-ns-resize flex items-center justify-center"
                    onPointerDown={(e) => {
                      if (!dial.setVal) return;
                      const startY = e.clientY;
                      const startVal = dial.val;
                      
                      const moveHandler = (moveEvent: PointerEvent) => {
                        const deltaY = startY - moveEvent.clientY;
                        const newVal = Math.max(0, Math.min(1, startVal + deltaY * 0.005));
                        dial.setVal?.(newVal);
                      };

                      const upHandler = () => {
                        window.removeEventListener('pointermove', moveHandler);
                        window.removeEventListener('pointerup', upHandler);
                      };

                      window.addEventListener('pointermove', moveHandler);
                      window.addEventListener('pointerup', upHandler);
                    }}
                  >
                    {/* Center indicator line */}
                    <div 
                      className="w-[2px] h-4 bg-neutral-400 rounded-full origin-bottom absolute top-1"
                      style={{ transform: `rotate(${(dial.val * 270) - 135}deg)` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* MPC 2000XL Logo details */}
            <div className="text-right flex flex-col select-none">
              <span className="text-sm font-extrabold tracking-tighter text-red-500 font-mono">MPC2000XL</span>
              <span className="text-[6px] text-neutral-400 font-mono uppercase tracking-widest">MIDI PRODUCTION CENTER</span>
            </div>

          </div>

          {/* Center: The Pad Grid */}
          <div className="bg-[#18181a] border-4 border-neutral-950 p-4 rounded-xl shadow-inner relative flex-1 flex items-center justify-center">
            {/* Accent divider line detail */}
            <div className="absolute inset-y-0 left-[-2px] w-[4px] bg-[#0c0c0d] rounded-full pointer-events-none" />
            <PadGrid />
          </div>

        </div>

      </div>
    </div>
  );
}
