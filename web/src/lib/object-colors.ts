// Object color utility for consistent coloring across all components
export function generateObjectColor(globalId: number): string {
  // Use golden angle for good color distribution
  const hue = (globalId * 137.508) % 360;
  const saturation = 70 + ((globalId * 23) % 30); // 70-100% saturation
  const lightness = 45 + ((globalId * 17) % 20); // 45-65% lightness
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function generateObjectColors(globalIds: number[]): Map<number, string> {
  const colorMap = new Map<number, string>();
  globalIds.forEach((id) => {
    colorMap.set(id, generateObjectColor(id));
  });
  return colorMap;
}

// Get all unique global IDs from detection data
export function getUniqueGlobalIds(detectionData: any[]): number[] {
  return Array.from(
    new Set(
      detectionData
        .map((d) => d.global_id)
        .filter((id) => typeof id === 'number')
    )
  ).sort((a, b) => a - b);
}
