export interface FileNode {
  name: string;
  is_dir: boolean;
  children: FileNode[];
}

export interface FlatNode {
  node: FileNode;
  depth: number;
  expanded: boolean;
  id: string;
}

export interface MenuItem {
  label: string;
  action: () => void;
}

export interface Note {
  id: number;
  pitch: number;    // MIDI number, FL octave convention (60 = C5)
  start: number;    // step index within the pattern (0..patternLength-1)
  length: number;   // in 16th-note steps, >= 1
  velocity: number; // 0..1
}

export interface ChannelData {
  id: number;
  samplePath: string | null;
  sampleFolder: string | null; // relative path to a multisample instrument folder; mutually exclusive with samplePath
  muted: boolean;
  pan: number;
  volume: number;
  mixerTrack: number;
  steps: boolean[];
  notes: Note[];
}

// Payload carried by FileExplorer's `filedrop` custom event.
export type FileDropDetail =
  | { kind: 'file'; path: string }
  | { kind: 'folder'; path: string; files: string[] };

export interface PatternData {
  id: number;
  name: string;
  color: string;
  lengthBeats: number; // decimals allowed (e.g. for unquantized vocal/mp3 clips)
}

export interface Placement {
  id: number;
  patternId: number;
  trackId: number;
  startBeat: number;
}
