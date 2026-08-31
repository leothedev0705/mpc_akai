import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { getActiveBank } from '@/utils';
import { audioEngine } from '@/services/audioEngine';
import { dbService } from '@/services/storageService';

export function SampleRecorderModal() {
  const open = useUIStore((s) => s.sampleRecordModalOpen);
  const setOpen = useUIStore((s) => s.setSampleRecordModalOpen);
  const project = useProjectStore((s) => s.project);
  const selectedPadId = useProjectStore((s) => s.selectedPadId);
  const assignAssetToPad = useProjectStore((s) => s.assignAssetToPad);
  const updatePad = useProjectStore((s) => s.updatePad);

  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [sampleName, setSampleName] = useState('My Live Sample');
  const [targetPadId, setTargetPadId] = useState<string>('');
  const [recordSeconds, setRecordSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const bank = getActiveBank(project);

  useEffect(() => {
    if (open) {
      setTargetPadId(selectedPadId || (bank.pads[0]?.id ?? ''));
      setSampleName('Mic Sample ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setRecordedBlob(null);
      setRecordedUrl(null);
      setIsRecording(false);
      setRecordSeconds(0);
    } else {
      stopRecordingCleanup();
    }
  }, [open, selectedPadId]);

  const stopRecordingCleanup = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : (MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : ''));
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const actualMime = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordSeconds(0);

      timerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      toast.error('Microphone access denied or not available');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handlePlayPreview = async () => {
    if (!recordedUrl) return;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    const audio = new Audio(recordedUrl);
    previewAudioRef.current = audio;
    setIsPlayingPreview(true);
    try {
      await audio.play();
    } catch (e) {
      console.warn('Preview play error:', e);
      setIsPlayingPreview(false);
    }
    audio.onended = () => setIsPlayingPreview(false);
    audio.onerror = () => setIsPlayingPreview(false);
  };

  const handleSaveAndAssign = async () => {
    if (!recordedBlob || !targetPadId) return;

    try {
      const mimeType = recordedBlob.type || 'audio/webm';
      const ext = mimeType.includes('mp4') ? '.mp4' : mimeType.includes('ogg') ? '.ogg' : '.webm';
      const cleanName = sampleName.trim() || 'Recorded Sample';
      const file = new File([recordedBlob], cleanName + ext, {
        type: mimeType,
      });

      const meta = await dbService.saveAsset(file);
      const arrayBuffer = await recordedBlob.arrayBuffer();
      const buffer = await audioEngine.decodeAndCache(meta.id, arrayBuffer);
      meta.duration = buffer.duration;
      await dbService.updateAssetMeta(meta);

      useProjectStore.setState((s) => ({
        assets: [meta, ...s.assets],
        project: {
          ...s.project,
          libraryAssetIds: [meta.id, ...s.project.libraryAssetIds],
          updatedAt: Date.now(),
        },
      }));

      assignAssetToPad(targetPadId, meta.id);
      updatePad(targetPadId, { name: cleanName, assetId: meta.id });

      toast.success('Assigned "' + cleanName + '" to Pad');
      setOpen(false);
    } catch (err) {
      console.error('Failed to save recorded sample:', err);
      toast.error('Failed to save recorded sample');
    }
  };

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="MPC SAMPLER • LIVE RECORDING">
      <div className="space-y-5 text-neutral-300">
        <div className="bg-black/60 border border-neutral-800 rounded-xl p-6 flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-neutral-700'}`} />
            <span className="font-mono text-xs uppercase tracking-widest text-neutral-400">
              {isRecording ? `RECORDING IN PROGRESS (${recordSeconds}s)` : (recordedBlob ? 'SAMPLE READY' : 'SAMPLER STANDBY')}
            </span>
          </div>

          <div className="flex gap-4">
            {!isRecording ? (
              <Button
                variant="accent"
                onClick={startRecording}
                className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3 flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <Mic size={18} />
                START RECORDING
              </Button>
            ) : (
              <Button
                variant="danger"
                onClick={stopRecording}
                className="bg-neutral-800 hover:bg-neutral-700 text-red-400 font-bold px-6 py-3 flex items-center gap-2 border border-red-800 cursor-pointer"
              >
                <Square size={18} />
                STOP RECORDING
              </Button>
            )}

            {recordedUrl && !isRecording && (
              <Button
                variant="ghost"
                onClick={handlePlayPreview}
                className="border border-neutral-700 hover:text-white px-5 py-3 flex items-center gap-2 cursor-pointer"
              >
                <Play size={18} />
                {isPlayingPreview ? 'PLAYING...' : 'PREVIEW'}
              </Button>
            )}
          </div>
        </div>

        {recordedBlob && (
          <div className="space-y-4 bg-neutral-900/50 p-4 rounded-xl border border-neutral-800">
            <div>
              <label className="text-xs font-mono text-neutral-400 block mb-1">SAMPLE NAME</label>
              <input
                type="text"
                value={sampleName}
                onChange={(e) => setSampleName(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-mono text-neutral-400 block mb-1">ASSIGN TO PAD (BANK {bank.id})</label>
              <select
                value={targetPadId}
                onChange={(e) => setTargetPadId(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
              >
                {bank.pads.map((p, i) => (
                  <option key={p.id} value={p.id}>
                    Pad {i + 1}: {p.name} [{p.shortcut || ' '}]
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="accent"
              onClick={handleSaveAndAssign}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check size={16} />
              SAVE & ASSIGN TO PAD
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
          <AlertCircle size={13} className="shrink-0" />
          <span>Samples are processed at 48kHz interactive Web Audio rate and saved locally.</span>
        </div>
      </div>
    </Modal>
  );
}
