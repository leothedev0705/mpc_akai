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

export interface PadConfig {
  id: string;
  name: string;
  color: PadColor;
  volume: number;
  loop: boolean;
  exclusive: boolean;
  muted: boolean;
  solo: boolean;
  shortcut: string;
  assetId: string | null;
}

export interface Bank {
  id: BankId;
  name: string;
  pads: PadConfig[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  masterVolume: number;
  activeBankId: BankId;
  banks: Bank[];
  libraryAssetIds: string[];
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

export const SUPPORTED_AUDIO_FORMATS = ['.wav', '.mp3', '.ogg', '.flac'];

export const GRID_SIZE = 4;
