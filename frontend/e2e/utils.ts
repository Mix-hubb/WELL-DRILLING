/** Unique-enough suffix for test data names so repeated local runs never collide. */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
