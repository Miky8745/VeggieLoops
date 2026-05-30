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
