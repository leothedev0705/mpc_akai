import { Modal } from '@/components/ui/Modal';
import { useUIStore } from '@/stores/uiStore';
import { Sparkles, Music, Keyboard, Mic, Sliders } from 'lucide-react';

export function InfoModal() {
  const open = useUIStore((s) => s.infoModalOpen);
  const setInfoModalOpen = useUIStore((s) => s.setInfoModalOpen);

  return (
    <Modal open={open} onClose={() => setInfoModalOpen(false)} title="AKAI MPC2000XL • PRODUCTION CENTER">
      <div className="space-y-6 text-neutral-300">
        {/* Banner */}
        <div className="bg-gradient-to-r from-red-950/60 to-orange-950/40 p-4 rounded-xl border border-red-800/40 flex items-start gap-3">
          <Sparkles className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="text-sm font-bold text-white tracking-wide">FATHER STRETCH MY HANDS • TS EDITION</h4>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              Interactive Web MPC soundboard tribute inspired by the legendary Pastor T.L. Barrett gospel sample, 
              Mike Dean synthesizer swells, and Metro Boomin 130 BPM beats.
            </p>
          </div>
        </div>

        {/* Keyboard layout guide */}
        <div>
          <h4 className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Keyboard size={14} className="text-red-500" />
            Quick Keyboard Trigger Map
          </h4>
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
            <div className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg">
              <span className="text-red-400 font-bold block text-sm">[A]</span>
              <span className="text-[10px] text-neutral-400">Vocal 1</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg">
              <span className="text-red-400 font-bold block text-sm">[S]</span>
              <span className="text-[10px] text-neutral-400">Vocal 2</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg">
              <span className="text-red-400 font-bold block text-sm">[D]</span>
              <span className="text-[10px] text-neutral-400">Vocal 3</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg">
              <span className="text-red-400 font-bold block text-sm">[F]</span>
              <span className="text-[10px] text-neutral-400">Vocal 4</span>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg">
              <span className="text-red-400 font-bold block text-sm">[G]</span>
              <span className="text-[10px] text-neutral-400">FAAAATHER</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg">
              <span className="text-red-400 font-bold block text-sm">[H]</span>
              <span className="text-[10px] text-neutral-400">Bad To Us</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg">
              <span className="text-red-400 font-bold block text-sm">[J]</span>
              <span className="text-[10px] text-neutral-400">See This Coat</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg">
              <span className="text-red-400 font-bold block text-sm">[K]</span>
              <span className="text-[10px] text-neutral-400">Lord (Fast)</span>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg">
              <span className="text-red-400 font-bold block text-sm">[Z]</span>
              <span className="text-[10px] text-neutral-400">Beat Loop</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg">
              <span className="text-red-400 font-bold block text-sm">[X]</span>
              <span className="text-[10px] text-neutral-400">Intro Synth</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg">
              <span className="text-red-400 font-bold block text-sm">[C]</span>
              <span className="text-[10px] text-neutral-400">Guitar</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg">
              <span className="text-red-400 font-bold block text-sm">[V]</span>
              <span className="text-[10px] text-neutral-400">Lord (Long)</span>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg">
              <span className="text-red-400 font-bold block text-sm">[B]</span>
              <span className="text-[10px] text-neutral-400">808 Sub Drop</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg">
              <span className="text-red-400 font-bold block text-sm">[N]</span>
              <span className="text-[10px] text-neutral-400">STOP ALL</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg">
              <span className="text-red-400 font-bold block text-sm">[M]</span>
              <span className="text-[10px] text-neutral-400">Camera Click</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg">
              <span className="text-red-400 font-bold block text-sm">[SPACE]</span>
              <span className="text-[10px] text-neutral-400">Info Screen</span>
            </div>
          </div>
        </div>

        {/* Feature instructions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-neutral-900/60 p-3 rounded-lg border border-neutral-800 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-neutral-200 font-bold">
              <Music size={14} className="text-orange-400" />
              Custom Samples
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Drag and drop WAV, MP3, FLAC, or OGG files onto any pad or manage them in the Library tab.
            </p>
          </div>

          <div className="bg-neutral-900/60 p-3 rounded-lg border border-neutral-800 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-neutral-200 font-bold">
              <Mic size={14} className="text-red-400" />
              Microphone Sampling
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Press [REC] or button 4 (SAMPLING) to record live audio from your microphone directly into a pad.
            </p>
          </div>

          <div className="bg-neutral-900/60 p-3 rounded-lg border border-neutral-800 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-neutral-200 font-bold">
              <Sliders size={14} className="text-emerald-400" />
              Hardware Controls
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Use the Rotary Jog Wheel, Note Variation Slider, and D-Pad Arrow keys to mix and control playback.
            </p>
          </div>
        </div>

        <div className="text-center pt-2">
          <button
            onClick={() => setInfoModalOpen(false)}
            className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold transition-all shadow-md active:translate-y-[1px] cursor-pointer"
          >
            LET'S MAKE BEATS
          </button>
        </div>
      </div>
    </Modal>
  );
}

