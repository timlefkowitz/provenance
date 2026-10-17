/**
 * Plain-text version of a short markdown description, for line-clamped cards,
 * meta descriptions and JSON-LD. Not a full parser — covers what the markdown
 * toolbar produces (emphasis, headings, lists, quotes, links).
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) -> text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
    .replace(/^\s{0,3}>\s?/gm, '') // blockquotes
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '') // list markers
    .replace(/(\*\*|__)(.+?)\1/g, '$2') // bold
    .replace(/(\*|_)(.+?)\1/g, '$2') // italic
    .replace(/~~(.+?)~~/g, '$1') // strikethrough
    .replace(/`([^`]*)`/g, '$1') // inline code
    .replace(/\n{2,}/g, '\n')
    .trim();
}
