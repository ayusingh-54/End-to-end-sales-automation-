// Minimal Handlebars-style renderer: {{var}} only, with HTML-escape by default
// and {{{var}}} for raw. Supports nested keys via dot notation.

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c] ?? c);
}

function lookup(vars: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let cur: unknown = vars;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return '';
    }
  }
  if (cur === null || cur === undefined) return '';
  return String(cur);
}

export interface RenderResult {
  subject: string;
  text: string;
  missing: string[];
}

export function renderTemplate(
  template: { subject: string; body_md: string; variables?: string[] },
  vars: Record<string, unknown>,
): RenderResult {
  const seen = new Set<string>();
  const replacer = (raw: boolean) => (_: string, key: string) => {
    seen.add(key.trim());
    const v = lookup(vars, key.trim());
    return raw ? v : escapeHtml(v);
  };
  const subject = template.subject.replace(/\{\{\{?\s*([\w.]+)\s*\}?\}\}/g, replacer(true));
  const text = template.body_md
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, replacer(true))
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, replacer(false));

  const declared = template.variables ?? [];
  const missing = declared.filter(
    (v) => !(v in vars) || vars[v] === null || vars[v] === undefined || vars[v] === '',
  );
  return { subject, text, missing };
}
