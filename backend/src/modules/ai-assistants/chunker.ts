export function chunkText(text: string, chunkSize = 900, overlap = 180): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  if (normalized.length <= chunkSize) {
    return [normalized];
  }

  const chunks: string[] = [];
  const safeOverlap = Math.max(0, Math.min(overlap, chunkSize - 1));
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + chunkSize);

    if (end < normalized.length) {
      const searchWindow = normalized.slice(Math.max(start, end - 120), Math.min(normalized.length, end + 120));
      const offset = Math.max(start, end - 120);
      const paragraphBreak = searchWindow.lastIndexOf('\n\n');
      const sentenceBreak = searchWindow.lastIndexOf('. ');
      const chosenBreak = paragraphBreak !== -1 ? paragraphBreak : sentenceBreak;

      if (chosenBreak !== -1) {
        end = offset + chosenBreak + (paragraphBreak !== -1 ? 0 : 1);
      }
    }

    if (end <= start) {
      end = Math.min(normalized.length, start + chunkSize);
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(start + 1, end - safeOverlap);
  }

  return chunks;
}
