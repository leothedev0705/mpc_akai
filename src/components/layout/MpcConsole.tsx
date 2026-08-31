import React, { useState, useRef, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
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
  const bpm = project.bpm || 130;
  const setBpm = useProjectStore((s) => s.setBpm);
  const swing = project.swing || 54;
  const setSwing = useProjectStore((s) => s.setSwing);

  const mpcMode = useProjectStore((s) => s.mpcMode);
  const setMpcMode = useProjectStore((s) => s.setMpcMode);
  const sliderTarget = useProjectStore((s) => s.sliderTarget);
  const setSliderTarget = useProjectStore((s) => s.setSliderTarget);
  const is16Levels = useProjectStore((s) => s.is16Levels);
  const toggle16Levels = useProjectStore((s) => s.toggle16Levels);
  const currentStep = useProjectStore((s) => s.currentStep);
  const isPlayingSequencer = useProjectStore((s) => s.isPlayingSequencer);
  const startSequencer = useProjectStore((s) => s.startSequencer);
  const stopSequencer = useProjectStore((s) => s.stopSequencer);
  const toggleStep = useProjectStore((s) => s.toggleStep);

  const stopAll = useProjectStore((s) => s.stopAll);
  const triggerPad = useProjectStore((s) => s.triggerPad);
  const updatePad = useProjectStore((s) => s.updatePad);
  const selectPad = useProjectStore((s) => s.selectPad);

  const setInfoModalOpen = useUIStore((s) => s.setInfoModalOpen);
  const setSampleRecordModalOpen = useUIStore((s) => s.setSampleRecordModalOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const setWaveformPadId = useUIStore((s) => s.setWaveformPadId);

  // Jog wheel rotation state
  const [jogRotation, setJogRotation] = useState(0);
  const jogRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const prevAngleRef = useRef(0);

  // Playback states
  const [isOverdubbing, setIsOverdubbing] = useState(false);
  const [activeFButton, setActiveFButton] = useState<number | null>(null);

  // Locate the active pad & asset details for the LCD Screen
  const bank = getActiveBank(project);
  const activePad = useMemo(
    () => bank.pads.find((p) => p.id === selectedPadId) || bank.pads[0],
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

  // Selected Pad Sequencer steps
  const activePadSeq = useMemo(() => {
    return project.sequences?.find((s) => s.padId === activePad?.id)?.steps || new Array(16).fill(false);
  }, [project.sequences, activePad]);

  // Handle D-Pad Navigation
  const handleDPadMove = (direction: 'up' | 'down' | 'left' | 'right' | 'center') => {
    const currentIndex = selectedPadId
      ? bank.pads.findIndex((p) => p.id === selectedPadId)
      : 0;
    
    if (direction === 'center') {
      if (activePad) void triggerPad(activePad.id);
      return;
    }

    let newIndex = currentIndex;
    if (direction === 'up') newIndex = currentIndex >= 4 ? currentIndex - 4 : currentIndex;
    if (direction === 'down') newIndex = currentIndex < 12 ? currentIndex + 4 : currentIndex;
    if (direction === 'left') newIndex = currentIndex % 4 > 0 ? currentIndex - 1 : currentIndex;
    if (direction === 'right') newIndex = currentIndex % 4 < 3 ? currentIndex + 1 : currentIndex;

    if (bank.pads[newIndex]) {
      selectPad(bank.pads[newIndex].id);
    }
  };

  // Handle Function Button Clicks (1-9, SHIFT, 0, ENT)
  const handleFunctionKey = (action: string) => {
    switch (action) {
      case 'MAIN SCREEN':
        setMpcMode('MAIN');
        break;
      case 'DRUM':
        setActiveBank('A');
        break;
      case 'PROGRAM':
        setActiveBank('B');
        break;
      case 'SAMPLING':
        setMpcMode('SAMPLER');
        setSampleRecordModalOpen(true);
        break;
      case 'STEP EDIT':
        setMpcMode('STEP_EDIT');
        break;
      case 'MIXER':
        setMpcMode('MIXER');
        break;
      case 'OTHER':
        setActiveBank('C');
        break;
      case 'MIDI':
        setActiveBank('D');
        break;
      case 'SYNC': {
        if (isPlayingSequencer) {
          stopSequencer();
        } else {
          startSequencer();
        }
        break;
      }
      case 'NOTE VAR':
      case 'SHIFT':
        toggle16Levels();
        break;
      case 'HELP':
        setInfoModalOpen(true);
        break;
      case 'UNDO':
        stopAll();
        break;
      default:
        break;
    }
  };

  // Handle Soft-buttons F1-F6 dynamically by MPC Screen Mode
  const handleFButtonClick = (num: number) => {
    setActiveFButton(num);
    setTimeout(() => setActiveFButton(null), 300);

    if (num === 6) {
      setInfoModalOpen(true);
      return;
    }

    if (mpcMode === 'MAIN') {
      switch (num) {
        case 1: setMpcMode('MAIN'); break;
        case 2: toggle16Levels(); break;
        case 3: setMpcMode('MIXER'); break;
        case 4: setMpcMode('STEP_EDIT'); break;
        case 5: setMpcMode('SAMPLER'); setSampleRecordModalOpen(true); break;
      }
    } else if (mpcMode === '16_LEVELS') {
      switch (num) {
        case 1: toggle16Levels(); break;
        case 2: setSliderTarget('TUNE'); break;
        case 3: setSliderTarget('VOLUME'); break;
        case 4: if (activePad) updatePad(activePad.id, { tune: (activePad.tune ?? 0) - 1 }); break;
        case 5: if (activePad) updatePad(activePad.id, { tune: (activePad.tune ?? 0) + 1 }); break;
      }
    } else if (mpcMode === 'MIXER') {
      switch (num) {
        case 1: setMpcMode('MAIN'); break;
        case 2: if (activePad) updatePad(activePad.id, { pan: (activePad.pan ?? 0) === 0 ? -0.5 : (activePad.pan ?? 0) < 0 ? 0.5 : 0 }); break;
        case 3: setSliderTarget('TUNE'); break;
        case 4: setSliderTarget('FILTER'); break;
        case 5: if (activePad) updatePad(activePad.id, { muted: !activePad.muted }); break;
      }
    } else if (mpcMode === 'STEP_EDIT') {
      switch (num) {
        case 1: setMpcMode('MAIN'); break;
        case 2: isPlayingSequencer ? stopSequencer() : startSequencer(); break;
        case 3: setSwing(swing === 54 ? 62 : swing === 62 ? 71 : 54); break;
        case 4: if (activePad) useProjectStore.setState(s => ({ project: { ...s.project, sequences: s.project.sequences.filter(sq => sq.padId !== activePad.id) } })); break;
        case 5: setBpm(bpm >= 160 ? 120 : bpm + 5); break;
      }
    } else if (mpcMode === 'SAMPLER') {
      switch (num) {
        case 1: setMpcMode('MAIN'); break;
        case 2: setSampleRecordModalOpen(true); break;
        case 3: stopAll(); break;
        case 4: setWaveformPadId(activePad?.id || null); break;
        case 5: setSampleRecordModalOpen(true); break;
      }
    }
  };

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
    if (diff > Math.PI) diff -= 2 * Math.PI;
    if (diff < -Math.PI) diff += 2 * Math.PI;

    const angleDeg = (diff * 180) / Math.PI;
    setJogRotation((prev) => prev + angleDeg);
    prevAngleRef.current = angle;

    // Jog wheel interaction: adjust parameter based on active screen mode
    if (Math.abs(angleDeg) > 5) {
      const step = angleDeg > 0 ? 1 : -1;
      if (mpcMode === 'STEP_EDIT' || mpcMode === 'MAIN') {
        setBpm(bpm + step);
      } else if (mpcMode === '16_LEVELS' && activePad) {
        updatePad(activePad.id, { tune: Math.max(-12, Math.min(12, (activePad.tune ?? 0) + step)) });
      } else if (mpcMode === 'MIXER' && activePad) {
        updatePad(activePad.id, { volume: Math.max(0, Math.min(1, activePad.volume + (step * 0.05))) });
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
      stopSequencer();
      setIsOverdubbing(false);
    } else if (type === 'play' || type === 'playstart') {
      startSequencer();
    } else if (type === 'rec') {
      setSampleRecordModalOpen(true);
    } else if (type === 'overdub') {
      setIsOverdubbing(prev => !prev);
      startSequencer();
    }
  };

  // Get current Note Variation slider value based on target
  const sliderCurrentValue = useMemo(() => {
    if (!activePad) return masterVolume;
    if (sliderTarget === 'VOLUME') return activePad.volume;
    if (sliderTarget === 'TUNE') return ((activePad.tune ?? 0) + 12) / 24; // 0 to 1
    if (sliderTarget === 'FILTER') return (activePad.cutoff ?? 20000) / 20000;
    return masterVolume;
  }, [activePad, sliderTarget, masterVolume]);

  const handleSliderChange = (normalizedVal: number) => {
    if (sliderTarget === 'VOLUME') {
      if (activePad) updatePad(activePad.id, { volume: normalizedVal });
      else setMasterVolume(normalizedVal);
    } else if (sliderTarget === 'TUNE' && activePad) {
      const semitones = Math.round((normalizedVal * 24) - 12);
      updatePad(activePad.id, { tune: semitones });
    } else if (sliderTarget === 'FILTER' && activePad) {
      const cutoffHz = Math.round(Math.max(200, normalizedVal * 20000));
      updatePad(activePad.id, { cutoff: cutoffHz });
    }
  };

  // Get soft-key labels dynamically
  const softLabels = useMemo(() => {
    switch (mpcMode) {
      case '16_LEVELS': return ['EXIT', 'PITCH', 'VOL', '-1st', '+1st', 'INFO'];
      case 'MIXER': return ['MAIN', 'PAN', 'TUNE', 'FILT', 'MUTE', 'INFO'];
      case 'STEP_EDIT': return ['MAIN', isPlayingSequencer ? 'STOP' : 'PLAY', 'SWG' + swing + '%', 'CLEAR', 'BPM' + bpm, 'INFO'];
      case 'SAMPLER': return ['MAIN', 'REC', 'STOP', 'WAVE', 'ASSIGN', 'INFO'];
      default: return ['MAIN', '16LVL', 'MIXR', 'STEP', 'SMPL', 'INFO'];
    }
  }, [mpcMode, isPlayingSequencer, swing, bpm]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 bg-[#101012] overflow-y-auto select-none">
      {/* Outer MPC 2000XL Chassis */}
      <div className="relative w-full max-w-[1100px] bg-gradient-to-b from-[#38383c] via-[#2a2a2d] to-[#202022] rounded-2xl border-4 border-[#141416] shadow-[0_30px_70px_rgba(0,0,0,0.9),inset_0_2px_4px_rgba(255,255,255,0.12)] p-6 sm:p-8 flex flex-col lg:flex-row gap-6 sm:gap-8">
        
        {/* Corner Chassis Screws */}
        <div className="absolute top-2.5 left-2.5 w-3 h-3 rounded-full bg-neutral-600 border border-neutral-800 flex items-center justify-center shadow-inner text-[6px] font-bold text-neutral-900">+</div>
        <div className="absolute top-2.5 right-2.5 w-3 h-3 rounded-full bg-neutral-600 border border-neutral-800 flex items-center justify-center shadow-inner text-[6px] font-bold text-neutral-900">+</div>
        <div className="absolute bottom-2.5 left-2.5 w-3 h-3 rounded-full bg-neutral-600 border border-neutral-800 flex items-center justify-center shadow-inner text-[6px] font-bold text-neutral-900">+</div>
        <div className="absolute bottom-2.5 right-2.5 w-3 h-3 rounded-full bg-neutral-600 border border-neutral-800 flex items-center justify-center shadow-inner text-[6px] font-bold text-neutral-900">+</div>

        {/* LEFT PANEL: LCD Screen, F-Buttons, Keypad, Slider, Jog Dial, Transport */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          
          {/* LCD Screen Container */}
          <div className="relative mb-5">
            {/* Vintage AKAI Brand stamp */}
            <div className="flex items-baseline justify-between mb-2 text-neutral-400 font-mono tracking-widest text-[10px] font-bold">
              <div>
                <span className="text-sm font-extrabold text-neutral-100">AKAI</span> professional
              </div>
              <span className="text-[9px] text-red-500 font-mono uppercase tracking-wider">
                {is16Levels ? '• 16-LEVELS CHROMATIC ACTIVE •' : (isPlayingSequencer ? '• SEQUENCER RUNNING •' : 'STANDBY')}
              </span>
            </div>

            {/* Glowing Red Backlit Graphic LCD Display */}
            <div className="w-full bg-[#2b0202] border-4 border-neutral-950 rounded-xl p-4 font-mono shadow-[0_0_20px_rgba(255,20,20,0.2),inset_0_3px_8px_black] text-[#ff3b3b] min-h-[140px] flex flex-col justify-between">
              
              {/* LCD Mode 1: MAIN SCREEN */}
              {mpcMode === 'MAIN' && (
                <>
                  <div className="flex justify-between items-center text-xs font-bold border-b border-red-950/80 pb-1">
                    <span className="truncate">SQ: 01-FATHER STRETCH (4/4)</span>
                    <span className="text-red-400">BPM: {bpm} (SWG {swing}%)</span>
                  </div>

                  <div className="py-2 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-white font-bold">
                        {playingPadName ? 'PLAYING: "' + playingPadName + '"' : ('PAD: ' + (activePad ? (activePad.name + ' [' + (activePad.shortcut === ' ' ? 'SPACE' : activePad.shortcut) + ']') : 'PAD 01'))}
                      </span>
                      <span className="text-red-400">BANK: {activeBankId}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-red-300">
                      <span>VOL: {Math.round((activePad?.volume ?? 0.8) * 100)}% | PAN: {(activePad?.pan ?? 0) === 0 ? 'C' : (activePad?.pan ?? 0) < 0 ? 'L' + Math.round(Math.abs(activePad?.pan ?? 0)*100) : 'R' + Math.round((activePad?.pan ?? 0)*100)}</span>
                      <span>TUNE: {(activePad?.tune ?? 0) > 0 ? '+' + activePad?.tune + 'st' : (activePad?.tune ?? 0) + 'st'} | CUTOFF: {(activePad?.cutoff ?? 20000) >= 19500 ? 'OPEN' : Math.round(activePad?.cutoff ?? 20000) + 'Hz'}</span>
                    </div>
                  </div>

                  <div className="text-[9px] flex justify-between pt-1 border-t border-red-950/80 text-red-500 font-bold">
                    <span>16-LEVELS: {is16Levels ? 'ON' : 'OFF'}</span>
                    <span>SLIDER: {sliderTarget}</span>
                    <span>16-BIT / 44.1kHz</span>
                  </div>
                </>
              )}

              {/* LCD Mode 2: 16-LEVELS MODE */}
              {mpcMode === '16_LEVELS' && (
                <>
                  <div className="flex justify-between items-center text-xs font-bold border-b border-red-950/80 pb-1">
                    <span className="text-amber-400">*** 16-LEVELS CHROMATIC KEYBOARD ***</span>
                    <span className="text-white">ROOT: 0 st</span>
                  </div>

                  <div className="py-2 text-[11px] space-y-1">
                    <p className="text-white font-bold truncate">TARGET SAMPLE: "{activePad?.name}"</p>
                    <p className="text-[10px] text-amber-300 font-mono">
                      Pad 01 (-12st) ──► Pad 08 (0st Root) ──► Pad 16 (+12st Octave)
                    </p>
                    <p className="text-[9px] text-red-400 italic">Hit any pad to play melody like a keyboard synthesizer!</p>
                  </div>

                  <div className="text-[9px] flex justify-between pt-1 border-t border-red-950/80 text-red-400 font-bold">
                    <span>PRESS [F1] OR [SHIFT] TO EXIT</span>
                    <span>CHROMATIC 2-OCTAVE SPREAD</span>
                  </div>
                </>
              )}

              {/* LCD Mode 3: PROGRAM MIXER */}
              {mpcMode === 'MIXER' && (
                <>
                  <div className="flex justify-between items-center text-xs font-bold border-b border-red-950/80 pb-1">
                    <span className="text-white">PROGRAM PAD MIXER (BANK {activeBankId})</span>
                    <span className="text-red-400">PAD: {activePad?.name}</span>
                  </div>

                  {/* 16-channel graphic meter bars */}
                  <div className="grid grid-cols-16 gap-1 items-end h-10 py-1">
                    {bank.pads.map((p, idx) => (
                      <div key={p.id} className="flex flex-col items-center h-full justify-end">
                        <div
                          className={cn(
                            "w-full rounded-xs transition-all",
                            p.id === activePad?.id ? "bg-white" : "bg-red-500",
                            p.muted && "opacity-20"
                          )}
                          style={{ height: Math.round(p.volume * 100) + '%' }}
                        />
                        <span className="text-[6px] text-red-400 mt-0.5">{idx + 1}</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-[9px] flex justify-between pt-1 border-t border-red-950/80 text-red-400 font-bold">
                    <span>ACTIVE: {activePad?.name} (VOL {Math.round((activePad?.volume ?? 0.8)*100)}%)</span>
                    <span>PAN: {(activePad?.pan ?? 0) === 0 ? 'CENTER' : (activePad?.pan ?? 0) < 0 ? 'L' + Math.round(Math.abs(activePad?.pan ?? 0)*100) : 'R' + Math.round((activePad?.pan ?? 0)*100)}</span>
                  </div>
                </>
              )}

              {/* LCD Mode 4: 16-STEP SEQUENCER */}
              {mpcMode === 'STEP_EDIT' && (
                <>
                  <div className="flex justify-between items-center text-xs font-bold border-b border-red-950/80 pb-1">
                    <span className="text-white truncate">16-STEP SEQUENCER: "{activePad?.name}"</span>
                    <span className={cn("text-xs font-bold", isPlayingSequencer ? "text-emerald-400 animate-pulse" : "text-red-400")}>
                      {isPlayingSequencer ? 'PLAYING (STEP ' + (currentStep + 1) + ')' : 'STOPPED'}
                    </span>
                  </div>

                  {/* 16 Step visual blocks */}
                  <div className="grid grid-cols-16 gap-1 py-2">
                    {Array.from({ length: 16 }).map((_, stepIdx) => {
                      const isTrig = activePadSeq[stepIdx];
                      const isPlayhead = currentStep === stepIdx;
                      return (
                        <button
                          key={stepIdx}
                          onClick={() => activePad && toggleStep(activePad.id, stepIdx)}
                          className={cn(
                            "h-7 rounded border flex flex-col items-center justify-between p-0.5 cursor-pointer transition-all",
                            isTrig ? "bg-red-500 border-red-400 text-white font-bold" : "bg-red-950/40 border-red-900/60 text-red-600",
                            isPlayhead && "ring-2 ring-white scale-105 bg-white text-black font-extrabold shadow-[0_0_8px_white]"
                          )}
                        >
                          <span className="text-[6px]">{stepIdx + 1}</span>
                          <span className="text-[7px]">{isTrig ? '●' : '·'}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-[9px] flex justify-between pt-1 border-t border-red-950/80 text-red-400 font-bold">
                    <span>CLICK STEPS TO TOGGLE BEAT</span>
                    <span>TEMPO: {bpm} BPM | SWING: {swing}%</span>
                  </div>
                </>
              )}

              {/* LCD Mode 5: SAMPLING RECORDER */}
              {mpcMode === 'SAMPLER' && (
                <>
                  <div className="flex justify-between items-center text-xs font-bold border-b border-red-950/80 pb-1">
                    <span className="text-white">DIRECT MIC & STEREO SAMPLING</span>
                    <span className="text-amber-400">48kHz / 24-BIT</span>
                  </div>

                  <div className="py-2 text-[11px] space-y-1">
                    <p className="text-white">INPUT SOURCE: DEFAULT AUDIO INPUT (MIC / LINE)</p>
                    <p className="text-red-300 text-[10px]">TARGET ASSIGNMENT: BANK {activeBankId} • {activePad?.name}</p>
                    <p className="text-[9px] text-red-500">Press [F2: REC] or Transport [REC] to begin capture</p>
                  </div>

                  <div className="text-[9px] flex justify-between pt-1 border-t border-red-950/80 text-red-400 font-bold">
                    <span>MEMORY: 32MB EXPANDED</span>
                    <span>AUTO-NORMALIZE: ON</span>
                  </div>
                </>
              )}

            </div>

            {/* F1 - F6 Soft-Buttons under LCD */}
            <div className="grid grid-cols-6 gap-2 mt-2 px-1">
              {softLabels.map((lbl, idx) => {
                const num = idx + 1;
                return (
                  <button
                    key={num}
                    onClick={() => handleFButtonClick(num)}
                    className={cn(
                      "h-6 rounded bg-gradient-to-b from-[#444448] to-[#2c2c2f] border border-neutral-950 text-[9px] font-bold text-neutral-300 shadow-sm active:translate-y-[1px] active:shadow-inner hover:text-white transition-all duration-75 cursor-pointer flex flex-col items-center justify-center",
                      activeFButton === num && "from-[#ff4500] to-[#b33000] text-white border-red-950 shadow-[0_0_8px_rgba(255,69,0,0.5)]"
                    )}
                  >
                    <span className="text-[8px] tracking-tight">{lbl}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Controls Cluster: Numeric Keypad, Note Variation Slider, Jog Dial */}
          <div className="grid grid-cols-12 gap-3.5 flex-1 items-start mt-1">
            
            {/* Columns 1-4: Function keys grid (1-9, SHIFT, 0, ENT) */}
            <div className="col-span-4 grid grid-cols-3 gap-1.5 bg-black/20 p-2 rounded-xl border border-white/5 shadow-inner">
              {[
                { label: '7', sub: 'OTHER' }, { label: '8', sub: 'MIDI' }, { label: '9', sub: 'SYNC' },
                { label: '4', sub: 'SAMPLING' }, { label: '5', sub: 'STEP EDIT' }, { label: '6', sub: 'MIXER' },
                { label: '1', sub: 'MAIN' }, { label: '2', sub: 'DRUM' }, { label: '3', sub: 'PROGRAM' },
                { label: 'SHIFT', sub: '16 LVL', isSpecial: true }, { label: '0', sub: 'HELP' }, { label: 'ENT', sub: 'UNDO' }
              ].map((btn, idx) => (
                <button
                  key={idx}
                  onClick={() => handleFunctionKey(btn.sub)}
                  className={cn(
                    "flex flex-col items-center justify-center p-1 min-h-[38px] rounded border border-neutral-950 bg-gradient-to-b from-[#3a3a3e] to-[#252528] active:translate-y-[1px] shadow-sm hover:from-[#444448] hover:to-[#2e2e32] cursor-pointer transition-all",
                    btn.isSpecial && (is16Levels ? "from-amber-600 to-amber-800 text-white border-amber-900 ring-1 ring-amber-400" : "from-[#ff6200]/20 to-[#ff6200]/5 border-orange-950/50")
                  )}
                >
                  <span className="text-[10px] font-bold text-neutral-200">{btn.label}</span>
                  <span className="text-[6px] font-mono text-neutral-400 uppercase tracking-tight">{btn.sub}</span>
                </button>
              ))}
            </div>

            {/* Column 5: Note Variation Slider (Volume / Tune / Filter) */}
            <div className="col-span-3 flex flex-col items-center justify-between h-full py-1.5 px-2 bg-black/20 rounded-xl border border-white/5 shadow-inner min-h-[175px]">
              {/* Slider Target Selector Buttons */}
              <div className="flex gap-1 w-full justify-center">
                {(['VOLUME', 'TUNE', 'FILTER'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSliderTarget(t)}
                    className={cn(
                      "text-[6px] font-mono font-bold px-1 py-0.5 rounded cursor-pointer transition-all",
                      sliderTarget === t ? "bg-red-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-white"
                    )}
                  >
                    {t === 'VOLUME' ? 'VOL' : t === 'TUNE' ? 'TUNE' : 'FILT'}
                  </button>
                ))}
              </div>
              
              <div className="relative flex-1 w-full flex items-center justify-center py-2">
                {/* Scale markings */}
                <div className="absolute left-2 top-2 bottom-2 flex flex-col justify-between text-[6px] font-mono text-neutral-600">
                  <span>MAX</span>
                  <span>- 0</span>
                  <span>- 12</span>
                  <span>- 24</span>
                  <span>MIN</span>
                </div>
                
                {/* Fader track */}
                <div className="h-full w-[4px] bg-[#121214] rounded-full border border-neutral-800 relative">
                  {/* Slider Knob */}
                  <div
                    className="absolute left-[-9px] w-5 h-8 bg-gradient-to-b from-[#ececed] via-[#9da2a6] to-[#6a6d70] border border-neutral-800 rounded-sm cursor-pointer shadow-md hover:brightness-110 active:brightness-95 flex flex-col items-center justify-center gap-0.5"
                    style={{ bottom: (sliderCurrentValue * 80) + '%' }}
                    onPointerDown={(e) => {
                      const track = e.currentTarget.parentElement;
                      if (!track) return;
                      const rect = track.getBoundingClientRect();
                      
                      const moveHandler = (moveEvent: PointerEvent) => {
                        const y = Math.max(0, Math.min(1, 1 - (moveEvent.clientY - rect.top) / rect.height));
                        handleSliderChange(y);
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

              <span className="text-[7px] text-neutral-400 font-mono tracking-widest uppercase">
                {sliderTarget}
              </span>
            </div>

            {/* Columns 6-12: Big Jog Wheel & D-Pad Section */}
            <div className="col-span-5 flex flex-col items-center justify-center">
              {/* OPEN WINDOW / PREV STEP */}
              <div className="flex gap-3 mb-2.5">
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="px-2.5 py-1 rounded bg-red-600 border border-red-800 active:translate-y-[1px] shadow-sm hover:brightness-110 flex flex-col items-center cursor-pointer"
                >
                  <span className="text-[8px] font-bold text-white">OPEN WINDOW</span>
                </button>
                <button
                  onClick={() => handleDPadMove('left')}
                  className="px-2.5 py-1 rounded bg-gradient-to-b from-[#3a3a3e] to-[#252528] border border-neutral-950 active:translate-y-[1px] shadow-sm hover:brightness-110 flex flex-col items-center cursor-pointer"
                >
                  <span className="text-[8px] font-bold text-neutral-300">PREV STEP</span>
                </button>
              </div>

              {/* Rotary Jog Dial */}
              <div
                ref={jogRef}
                className="relative w-26 h-26 rounded-full bg-gradient-to-b from-[#1b1b1c] via-[#2f2f32] to-[#121213] border-4 border-neutral-900 shadow-[0_6px_16px_rgba(0,0,0,0.6),inset_0_2px_4px_rgba(255,255,255,0.1)] flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
                style={{ transform: 'rotate(' + jogRotation + 'deg)' }}
                onPointerDown={handleJogPointerDown}
                onPointerMove={handleJogPointerMove}
                onPointerUp={handleJogPointerUp}
              >
                {/* Finger Indent Pit */}
                <div className="absolute top-2.5 w-4.5 h-4.5 rounded-full bg-[#151516] border border-neutral-800 shadow-inner flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
                </div>

                {/* Center cap */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-t from-[#252528] to-[#3a3a3e] border border-neutral-800 shadow-md flex items-center justify-center">
                  <div className="w-3.5 h-3.5 rounded-full bg-neutral-900 opacity-60" />
                </div>
              </div>

              {/* D-Pad / Locator keys */}
              <div className="mt-3 flex flex-col items-center gap-1">
                <button
                  onClick={() => handleDPadMove('up')}
                  className="w-7 h-5.5 bg-gradient-to-b from-[#3a3a3e] to-[#252528] border border-neutral-950 rounded flex items-center justify-center active:translate-y-[0.5px] cursor-pointer hover:text-white text-neutral-300 text-[7px] font-bold"
                >
                  ▲
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDPadMove('left')}
                    className="w-7 h-5.5 bg-gradient-to-b from-[#3a3a3e] to-[#252528] border border-neutral-950 rounded flex items-center justify-center active:translate-y-[0.5px] cursor-pointer hover:text-white text-neutral-300 text-[7px] font-bold"
                  >
                    ◀
                  </button>
                  <button
                    onClick={() => handleDPadMove('center')}
                    className="w-7 h-5.5 flex items-center justify-center cursor-pointer rounded bg-neutral-900 border border-white/5 active:translate-y-[0.5px]"
                  >
                    <span className="text-[6px] font-mono text-neutral-400 uppercase font-bold">CRSR</span>
                  </button>
                  <button
                    onClick={() => handleDPadMove('right')}
                    className="w-7 h-5.5 bg-gradient-to-b from-[#3a3a3e] to-[#252528] border border-neutral-950 rounded flex items-center justify-center active:translate-y-[0.5px] cursor-pointer hover:text-white text-neutral-300 text-[7px] font-bold"
                  >
                    ▶
                  </button>
                </div>
                <button
                  onClick={() => handleDPadMove('down')}
                  className="w-7 h-5.5 bg-gradient-to-b from-[#3a3a3e] to-[#252528] border border-neutral-950 rounded flex items-center justify-center active:translate-y-[0.5px] cursor-pointer hover:text-white text-neutral-300 text-[7px] font-bold"
                >
                  ▼
                </button>
              </div>

            </div>
          </div>

          {/* Bottom Left: Transport Keys Panel */}
          <div className="flex gap-2.5 mt-5 border-t border-white/5 pt-3.5">
            {[
              { type: 'rec', label: 'REC', isRed: true, led: false },
              { type: 'overdub', label: 'OVER DUB', isRed: true, led: isOverdubbing },
              { type: 'stop', label: 'STOP', isRed: false },
              { type: 'play', label: 'PLAY', isRed: false, led: isPlayingSequencer },
              { type: 'playstart', label: 'PLAY START', isRed: false }
            ].map((btn) => (
              <button
                key={btn.type}
                onClick={() => handleTransportClick(btn.type as any)}
                className={cn(
                  "flex-1 h-9 rounded flex flex-col items-center justify-center border border-neutral-950 font-mono text-[9px] font-bold shadow-md active:translate-y-[1px] cursor-pointer transition-all",
                  btn.isRed
                    ? "bg-gradient-to-b from-red-600 to-red-800 text-white hover:brightness-110"
                    : "bg-gradient-to-b from-[#3a3a3e] to-[#252528] text-neutral-200 hover:text-white hover:brightness-110"
                )}
              >
                {btn.led !== undefined && (
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full mb-0.5",
                      btn.led ? (btn.isRed ? "bg-red-400 shadow-[0_0_6px_red]" : "bg-emerald-400 shadow-[0_0_6px_#10b981]") : "bg-neutral-800"
                    )}
                  />
                )}
                <span>{btn.label}</span>
              </button>
            ))}
          </div>

        </div>

        {/* RIGHT PANEL: Pad Bank selection, MPC logo, Volume dials, the Pad Grid */}
        <div className="w-full lg:w-[500px] shrink-0 flex flex-col justify-between">
          
          {/* Top Panel: logo, dials, pad banks */}
          <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-3">
            
            {/* PAD BANK selection buttons */}
            <div className="flex flex-col gap-1">
              <span className="text-[7px] text-neutral-400 font-mono tracking-wider">PAD BANK</span>
              <div className="flex gap-1.5">
                {(['A', 'B', 'C', 'D'] as const).map((bankId) => (
                  <div key={bankId} className="flex flex-col items-center gap-1">
                    {/* Orange LED above the button */}
                    <div
                      className={cn(
                        "w-1.5 h-1.5 rounded-full transition-all duration-150",
                        activeBankId === bankId ? "bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,1)]" : "bg-neutral-800"
                      )}
                    />
                    <button
                      onClick={() => setActiveBank(bankId)}
                      className={cn(
                        "w-8 h-6 rounded text-[10px] font-bold transition-all border border-neutral-950 flex items-center justify-center active:translate-y-[0.5px] cursor-pointer",
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
                  
                  {/* Rotary Dial Knob */}
                  <div 
                    className="relative w-9 h-9 rounded-full bg-gradient-to-b from-[#2e2e30] to-[#121213] border-2 border-neutral-900 shadow-md cursor-ns-resize flex items-center justify-center"
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
                    <div 
                      className="w-[2px] h-3.5 bg-neutral-400 rounded-full origin-bottom absolute top-1"
                      style={{ transform: 'rotate(' + ((dial.val * 270) - 135) + 'deg)' }}
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
          <div className="bg-[#18181a] border-4 border-neutral-950 p-2 sm:p-3 rounded-xl shadow-[inset_0_4px_12px_rgba(0,0,0,0.85)] relative flex-1 flex items-center justify-center min-h-[440px] w-full aspect-square">
            {/* Accent divider line detail */}
            <div className="absolute inset-y-0 left-[-2px] w-[4px] bg-[#0c0c0d] rounded-full pointer-events-none" />
            <PadGrid />
          </div>

        </div>

      </div>
    </div>
  );
}
