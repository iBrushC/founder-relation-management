/**
 * Client-safe CSV parsing + column→field pattern detection for the contact
 * importer. Imports are deliberately manual (people confirm the mapping), so this
 * only needs to (a) turn arbitrary CSV text into a header + rows grid and (b)
 * guess an initial column→field mapping the user can then correct.
 *
 * Kept dependency-free and free of any server-only imports so the import dialog
 * (a client component) can parse files in the browser.
 */

/** The contact fields a CSV column can be mapped onto (mirrors `Connection`). */
export type ImportFieldKey =
  | "name"
  | "role"
  | "company"
  | "email"
  | "phone"
  | "linkedin"
  | "location"
  | "note";

export type ImportField = {
  key: ImportFieldKey;
  label: string;
  /** Header spellings that auto-map to this field (matched after normalizing). */
  aliases: string[];
};

/**
 * Target fields, in display order. `name` is first because it's the only
 * required one — a row with no name is skipped on import.
 */
export const IMPORT_FIELDS: readonly ImportField[] = [
  {
    key: "name",
    label: "Name",
    aliases: ["name", "fullname", "contact", "contactname", "person", "who"],
  },
  {
    key: "role",
    label: "Role",
    aliases: ["role", "title", "jobtitle", "position", "job"],
  },
  {
    key: "company",
    label: "Company",
    aliases: [
      "company",
      "organization",
      "organisation",
      "org",
      "employer",
      "business",
      "firm",
      "startup",
    ],
  },
  {
    key: "email",
    label: "Email",
    aliases: ["email", "emailaddress", "mail"],
  },
  {
    key: "phone",
    label: "Phone",
    aliases: [
      "phone",
      "phonenumber",
      "mobile",
      "cell",
      "cellphone",
      "tel",
      "telephone",
      "contactnumber",
    ],
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    aliases: ["linkedin", "linkedinurl", "linkedinprofile", "li"],
  },
  {
    key: "location",
    label: "Location",
    aliases: ["location", "city", "address", "region", "place", "basedin", "geo"],
  },
  {
    key: "note",
    label: "Notes",
    aliases: [
      "note",
      "notes",
      "comment",
      "comments",
      "description",
      "about",
      "bio",
      "remarks",
    ],
  },
] as const;

/** Lowercase and strip everything but letters/digits, so "E-mail " ≈ "email". */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Guess which field a column header maps to, or null if nothing looks close.
 * An exact (normalized) alias match wins outright; otherwise the longest
 * substring overlap decides, so "Company Name" maps to Company (7 chars) rather
 * than Name (4). Anything shorter than 4 chars is ignored to avoid noise.
 */
export function detectField(header: string): ImportFieldKey | null {
  const h = normalize(header);
  if (!h) return null;

  let best: { key: ImportFieldKey; score: number } | null = null;
  for (const field of IMPORT_FIELDS) {
    for (const alias of field.aliases) {
      const a = normalize(alias);
      if (!a) continue;
      if (a === h) return field.key; // exact match — take it
      const overlaps = h.includes(a) || a.includes(h);
      if (overlaps && a.length >= 4) {
        const score = Math.min(a.length, h.length);
        if (!best || score > best.score) best = { key: field.key, score };
      }
    }
  }
  return best?.key ?? null;
}

export type ParsedCsv = {
  /** Trimmed header cells from the first non-empty row. */
  headers: string[];
  /** Data rows (header excluded); each is a list of cell strings. */
  rows: string[][];
};

/** Pick the delimiter that appears most on the first line (`,` `;` tab or `|`). */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

/**
 * Parse CSV text into headers + rows. Handles quoted fields (including embedded
 * delimiters, newlines, and `""` escapes), CRLF or LF line endings, a leading
 * BOM, and a delimiter sniffed from the first line. Fully-empty rows are dropped.
 */
export function parseCsv(text: string): ParsedCsv {
  // Strip a UTF-8 BOM if present so the first header isn't polluted.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delim = detectDelimiter(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === delim) {
      endField();
      i += 1;
      continue;
    }
    if (c === "\r") {
      i += 1;
      continue;
    }
    if (c === "\n") {
      endRow();
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  // Flush the final field/row if the file didn't end with a newline.
  if (field.length > 0 || row.length > 0) endRow();

  // Drop rows that are entirely blank (trailing newlines, spacer rows).
  const cleaned = rows.filter((r) => r.some((v) => v.trim() !== ""));
  if (cleaned.length === 0) return { headers: [], rows: [] };

  const [headers, ...body] = cleaned;
  return { headers: headers.map((h) => h.trim()), rows: body };
}
