export function formatSampleName(path: string | null): string {
  if (!path) return 'Drop sample';
  const base = path.split('/').pop() ?? path;
  const noExt = base.replace(/\.[^.]+$/, '');
  return noExt
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
