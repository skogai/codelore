import * as fs from "node:fs/promises";
import * as path from "node:path";
import MiniSearch from "minisearch";
import { ROOT } from "./config.js";
import type { DocKind } from "./types.js";
import { listDirs } from "./utils.js";
import { slugify } from "./paths.js";
import { readMeta, requireProject } from "./meta.js";
import { STUB_BODY, extractBody } from "./markdown.js";

/**
 * Lightweight full-text search over all doc bodies, powered by MiniSearch
 * (pure JS, in-memory, BM25-style ranking with fuzzy + prefix matching).
 * The corpus is small — docs are re-indexed on every call, no persisted index.
 */

interface SearchableDoc {
  id: string;
  project: string;
  category: string;
  chapter: string;
  topic: string;
  kind: DocKind;
  description: string;
  body: string;
}

/** Walks the whole tree (or one project) and loads every non-stub doc body. */
async function collectDocs(project?: string): Promise<SearchableDoc[]> {
  const docs: SearchableDoc[] = [];
  const projects = project ? [slugify(project)] : await listDirs(ROOT);
  for (const p of projects) {
    for (const c of await listDirs(path.join(ROOT, p))) {
      for (const ch of await listDirs(path.join(ROOT, p, c))) {
        for (const t of await listDirs(path.join(ROOT, p, c, ch))) {
          const tMeta = await readMeta(path.join(ROOT, p, c, ch, t));
          for (const kind of ["internal", "usage"] as DocKind[]) {
            let body: string;
            try {
              body = extractBody(await fs.readFile(path.join(ROOT, p, c, ch, t, `${kind}.md`), "utf8"));
            } catch {
              continue;
            }
            if (!body.trim() || body.trim() === STUB_BODY) continue;
            docs.push({
              id: `${p}/${c}/${ch}/${t}#${kind}`,
              project: p,
              category: c,
              chapter: ch,
              topic: t,
              kind,
              description: tMeta?.description ?? "",
              body,
            });
          }
        }
      }
    }
  }
  return docs;
}

/** Extracts a short snippet around the first occurrence of a matched term. */
function makeSnippet(body: string, terms: string[]): string {
  const flat = body.replace(/\s+/g, " ");
  const lower = flat.toLowerCase();
  let hit = -1;
  for (const term of terms) {
    const i = lower.indexOf(term.toLowerCase());
    if (i !== -1 && (hit === -1 || i < hit)) hit = i;
  }
  if (hit === -1) return flat.slice(0, 160) + (flat.length > 160 ? "…" : "");
  const start = Math.max(0, hit - 60);
  const end = Math.min(flat.length, hit + 120);
  return (start > 0 ? "…" : "") + flat.slice(start, end) + (end < flat.length ? "…" : "");
}

export async function searchDocs(query: string, project?: string, limit = 8): Promise<string> {
  if (project) await requireProject(project);
  const docs = await collectDocs(project);
  if (docs.length === 0) {
    return project
      ? `Project "${slugify(project)}" has no filled-in docs to search yet.`
      : "No filled-in docs to search yet. Use write_doc to create documentation first.";
  }

  const mini = new MiniSearch<SearchableDoc>({
    fields: ["topic", "description", "body"],
    storeFields: ["project", "category", "chapter", "topic", "kind", "description", "body"],
    searchOptions: {
      boost: { topic: 3, description: 2 },
      fuzzy: 0.2,
      prefix: true,
    },
  });
  mini.addAll(docs);

  const results = mini.search(query).slice(0, limit);
  if (results.length === 0) {
    return `No docs matched "${query}"${project ? ` in project "${slugify(project)}"` : ""}. Try broader terms or get_project_map.`;
  }

  let md = `Top ${results.length} match(es) for "${query}" (searched ${docs.length} docs):\n\n`;
  for (const r of results) {
    md += `- **${r.project}/${r.category}/${r.chapter}/${r.topic}** (${r.kind}, score ${r.score.toFixed(1)})`;
    if (r.description) md += ` — ${r.description}`;
    md += `\n  > ${makeSnippet(r.body as string, r.queryTerms)}\n`;
  }
  md += `\nRead a full doc with read_doc(project, category, chapter, topic, kind).\n`;
  return md;
}
