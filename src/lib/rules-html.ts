const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "div",
  "span",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
]);

export type RulePoint = {
  title: string;
  description: string;
};

/** Bersihkan HTML peraturan — hanya tag format dasar. */
export function sanitizeRulesHtml(input: string): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";

  let html = raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");

  html = html.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (full, tag: string) => {
    const name = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return "";
    if (full.startsWith("</")) return `</${name}>`;
    if (name === "br") return "<br />";

    const align = full.match(
      /text-align\s*:\s*(left|right|center|justify)/i
    )?.[1];
    if (name === "div" || name === "p" || name === "span" || name === "li") {
      return align
        ? `<${name} style="text-align:${align.toLowerCase()}">`
        : `<${name}>`;
    }
    return `<${name}>`;
  });

  return html.trim();
}

export function isBlankRulesHtml(html: string): boolean {
  const text = sanitizeRulesHtml(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length === 0;
}

export function parseRulePoints(value: unknown): RulePoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const title = String(row.title ?? "").trim();
      const description = String(row.description ?? "").trim();
      if (!title && !description) return null;
      return { title, description };
    })
    .filter((p): p is RulePoint => p != null);
}

/** Konversi data lama (deskripsi teks + poin) ke HTML. */
export function legacyRuleToHtml(
  description: string,
  points: RulePoint[]
): string {
  const parts: string[] = [];
  const desc = description.trim();
  if (desc && !/<\/?[a-z][\s\S]*>/i.test(desc)) {
    parts.push(
      ...desc.split(/\n+/).map((line) => `<p>${escapeText(line)}</p>`)
    );
  } else if (desc) {
    parts.push(desc);
  }
  if (points.length > 0) {
    const items = points
      .map((p) => {
        const title = p.title.trim();
        const body = p.description.trim();
        const inner = [
          title && `<strong>${escapeText(title)}</strong>`,
          body && escapeText(body),
        ]
          .filter(Boolean)
          .join("<br />");
        return `<li>${inner || "&nbsp;"}</li>`;
      })
      .join("");
    parts.push(`<ol>${items}</ol>`);
  }
  return parts.join("") || "<p></p>";
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
