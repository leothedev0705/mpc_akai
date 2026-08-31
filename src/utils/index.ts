import {
  BANK_IDS,
  DEFAULT_KEYBOARD_MAP,
  GRID_SIZE,
  type Bank,
  type BankId,
  type PadColor,
  type PadConfig,
  type Project,
} from '@/types';

export function generateId(): string {
  return crypto.randomUUID();
}

export function createDefaultPad(index: number, bankId: BankId = 'A'): PadConfig {
  const row = Math.floor(index / GRID_SIZE);
  const col = index % GRID_SIZE;
  const shortcut = DEFAULT_KEYBOARD_MAP[row]?.[col] ?? '';

  const padNumber = String(index + 1).padStart(2, '0');
  const name = `PAD ${padNumber}`;
  const assetId: string | null = null;
  const loop = false;

  const defaultKeys = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ' '];
  const shortcutKey = bankId === 'A' ? (defaultKeys[index] ?? shortcut) : shortcut;

  return {
    id: generateId(),
    name,
    color: '#FF5555' as PadColor,
    volume: 1,
    loop,
    exclusive: false,
    muted: false,
    solo: false,
    shortcut: shortcutKey,
    assetId,
  };
}

export function createDefaultBank(bankId: BankId): Bank {
  return {
    id: bankId,
    name: `Bank ${bankId}`,
    pads: Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => createDefaultPad(i, bankId)),
  };
}

export function createDefaultProject(name = 'Untitled Project'): Project {
  const now = Date.now();
  return {
    id: generateId(),
    name,
    createdAt: now,
    updatedAt: now,
    masterVolume: 0.85,
    bpm: 130,
    swing: 54,
    activeBankId: 'A',
    banks: BANK_IDS.map(createDefaultBank),
    sequences: [],
    libraryAssetIds: [],
    metronomeOn: false,
    quantize: '1/16',
  };
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : '';
}

export function isSupportedAudioFile(fileName: string): boolean {
  const ext = getFileExtension(fileName);
  return ['.wav', '.mp3', '.ogg', '.flac', '.aac', '.webm', '.m4a'].includes(ext);
}

export function inferAssetType(fileName: string): 'song' | 'sample' | 'stem' | 'loop' | 'sound-effect' {
  const lower = fileName.toLowerCase();
  if (lower.includes('stem')) return 'stem';
  if (lower.includes('loop')) return 'loop';
  if (lower.includes('sfx') || lower.includes('fx')) return 'sound-effect';
  if (lower.includes('sample')) return 'sample';
  return 'song';
}

export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function getActiveBank(project: Project): Bank {
  return project.banks.find((b) => b.id === project.activeBankId) ?? project.banks[0];
}

export function getPadById(project: Project, padId: string): PadConfig | undefined {
  for (const bank of project.banks) {
    const pad = bank.pads.find((p) => p.id === padId);
    if (pad) return pad;
  }
  return undefined;
}

export function updatePadInProject(
  project: Project,
  padId: string,
  updater: (pad: PadConfig) => PadConfig,
): Project {
  return {
    ...project,
    updatedAt: Date.now(),
    banks: project.banks.map((bank) => ({
      ...bank,
      pads: bank.pads.map((pad) => (pad.id === padId ? updater(pad) : pad)),
    })),
  };
}
