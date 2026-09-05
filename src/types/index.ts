export type BankId = 'A' | 'B' | 'C' | 'D';

export type AudioAssetType = 'song' | 'sample' | 'stem' | 'loop' | 'sound-effect';

export type PadColor =
  | '#00E5FF'
  | '#2EEB8B'
  | '#FF5555'
  | '#FFC857'
  | '#A855F7'
  | '#FF6B9D'
  | '#4ADE80'
  | '#60A5FA';

export interface AudioAsset {
  id: string;
  name: string;
  type: AudioAssetType;
  fileName: string;
  mimeType: string;
  duration: number;
  size: number;
  createdAt: number;
}

export interface CustomChop {
  id: string;
  startRatio: number; // 0–1
  endRatio: number;   // 0–1
  name?: string;
}

export interface PadConfig {
  id: string;
  name: string;
  color: PadColor;
  volume: number;
  pan?: number; // -1 (Left) to 1 (Right), 0 = Center
  tune?: number; // -12 to +12 semitones
  cutoff?: number; // 20 to 20000 Hz lowpass cutoff
  loop?: boolean; // Deprecated - all pads one-shot
  exclusive: boolean;
  muted: boolean;
  solo: boolean;
  shortcut: string;
  assetId: string | null;
  // Waveform trim points (normalized 0–1)
  startOffset?: number;
  endOffset?: number;
  // Chop group — pads in the same chop group choke each other
  chopGroupId?: string | null;
}

export interface Bank {
  id: BankId;
  name: string;
  pads: PadConfig[];
}

export type MPCMode = 'MAIN' | 'PAD_EDIT' | 'MIXER' | 'STEP_EDIT' | 'SAMPLER' | '16_LEVELS' | 'CHOP';

export type SliderTarget = 'VOLUME' | 'TUNE' | 'FILTER' | 'REVERB';

export type QuantizeValue = 'OFF' | '1/32' | '1/16' | '1/8' | '1/4';

export interface StepSequence {
  padId: string;
  steps: boolean[]; // 16 steps
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  masterVolume: number;
  bpm: number;
  swing: number; // 50 to 75
  activeBankId: BankId;
  banks: Bank[];
  sequences: StepSequence[];
  libraryAssetIds: string[];
  // New MPC workflow fields
  metronomeOn: boolean;
  quantize: QuantizeValue;
}

export type PlaybackState = 'idle' | 'playing' | 'paused';

export interface ActivePlayback {
  padId: string;
  sourceId: string;
  startedAt: number;
  state: PlaybackState;
}

export interface VUMeterData {
  padId: string;
  level: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
}

export const DEFAULT_KEYBOARD_MAP: string[][] = [
  ['Q', 'W', 'E', 'R'],
  ['A', 'S', 'D', 'F'],
  ['Z', 'X', 'C', 'V'],
  ['1', '2', '3', '4'],
];

export const BANK_IDS: BankId[] = ['A', 'B', 'C', 'D'];

export const PAD_COLORS: PadColor[] = [
  '#00E5FF',
  '#2EEB8B',
  '#FF5555',
  '#FFC857',
  '#A855F7',
  '#FF6B9D',
  '#4ADE80',
  '#60A5FA',
];

export const SUPPORTED_AUDIO_FORMATS = ['.wav', '.mp3', '.ogg', '.flac', '.aac', '.webm', '.m4a'];

export const GRID_SIZE = 4;
