/** Shared accent + surface resolution for all site templates. */

export function resolveAccent(key: string): string {
  const map: Record<string, string> = {
    wine: '#4A2F25',
    slate: '#3D4B5C',
    forest: '#2D4A3E',
    sand: '#8B7355',
    midnight: '#1A1A2E',
    rose: '#8B4558',
  };
  return map[key] ?? '#4A2F25';
}

export function resolveSurface(key: string | null): { bg: string; ink: string } {
  const map: Record<string, { bg: string; ink: string }> = {
    parchment: { bg: '#F5F1E8', ink: '#111111' },
    cream: { bg: '#FAF7F0', ink: '#1A1A1A' },
    white: { bg: '#FFFFFF', ink: '#111111' },
    slate: { bg: '#F1F4F7', ink: '#0F1419' },
    charcoal: { bg: '#1A1A1A', ink: '#F5F5F5' },
    ink: { bg: '#0F0F12', ink: '#F0EBE0' },
  };
  return map[key ?? 'white'] ?? map.white;
}

export function isDarkSurface(key: string | null): boolean {
  return ['charcoal', 'ink'].includes(key ?? '');
}

export function borderColor(surfaceKey: string | null): string {
  return isDarkSurface(surfaceKey) ? '#333' : '#e4e4e4';
}

export function mutedText(surfaceKey: string | null): string {
  return isDarkSurface(surfaceKey) ? 'rgba(255,255,255,0.6)' : '#888';
}
