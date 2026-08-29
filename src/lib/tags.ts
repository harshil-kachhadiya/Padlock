export function parseTagsInput(text: string): string[] {
  return [...new Set(text.split(",").map((t) => t.trim()).filter(Boolean))];
}

export function formatTags(tags: string[]): string {
  return tags.join(", ");
}
