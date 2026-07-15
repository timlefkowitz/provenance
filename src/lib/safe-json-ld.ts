/**
 * Serialize a JSON-LD object for safe inline embedding via
 * `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ... }} />`.
 *
 * CASA 5.1.7 / stored XSS guard: `JSON.stringify` does not escape `<`, `>`, or `&`.
 * Our JSON-LD payloads routinely include user-controlled strings (artwork titles,
 * descriptions, artist bios, exhibition names, blog content, ...). Without escaping,
 * a value like `</script><script>alert(1)</script>` closes the JSON-LD script tag
 * early and injects an executable sibling script — a classic script-injection XSS.
 *
 * Escaping the HTML-sensitive characters as unicode escapes keeps the JSON valid
 * (JSON strings support \uXXXX escapes) while making it impossible for the
 * serialized output to contain a literal `</script>`, `<script>`, or `&amp;`-style
 * entity sequence.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
