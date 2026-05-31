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

export interface ChannelData {
  id: number;
  samplePath: string | null;
  muted: boolean;
  pan: number;
  volume: number;
  mixerTrack: number;
  steps: boolean[];
}
