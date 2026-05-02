/**
 * Split outbound text for Telegram (4096 limit); prefer newlines then spaces to avoid ugly breaks.
 */
export function chunkTextForTelegram(text: string, max: number): string[] {
  if (!text) return [];
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let rest = text;
  let guard = 0;
  while (rest.length > 0 && guard++ < 5000) {
    if (rest.length <= max) {
      parts.push(rest);
      break;
    }
    const take = rest.slice(0, max);
    let cut = take.length;
    const nl = take.lastIndexOf('\n');
    if (nl >= Math.floor(max * 0.45)) cut = nl + 1;
    else {
      const sp = take.lastIndexOf(' ');
      if (sp >= Math.floor(max * 0.35)) cut = sp + 1;
    }
    const chunk = rest.slice(0, cut).trimEnd();
    if (!chunk.length) {
      parts.push(rest.slice(0, max));
      rest = rest.slice(max).trimStart();
      continue;
    }
    parts.push(chunk);
    rest = rest.slice(cut).trimStart();
  }
  return parts;
}
