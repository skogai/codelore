import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

/**
 * All documentation lives under ~/.codelore (next to .claude, .gemini, ...).
 * Layout convention, enforced entirely by this module:
 *
 *   ~/.codelore/
 *     INDEX.md                     <- list of registered projects
 *     <project>/
 *       .meta.json                 <- source of truth for name/description
 *       INDEX.md                   <- categories of the project
 *       <category>/                <- e.g. angular, dotnet, sql
 *         .meta.json
 *         INDEX.md                 <- chapters of the category
 *         <chapter>/               <- e.g. pages, components
 *           .meta.json
 *           INDEX.md               <- topics of the chapter
 *           <topic>/               <- e.g. grid-page
 *             .meta.json
 *             internal.md          <- how the code works
 *             usage.md             <- how to use it
 *
 * INDEX.md files are always regenerated from the .meta.json files + directory
 * scan, so they can never drift from reality.
 */

export const ROOT = process.env.CODELORE_ROOT ?? path.join(os.homedir(), ".codelore");

export type DocKind = "internal" | "usage";

const META_FILE = ".meta.json";
const INDEX_FILE = "INDEX.md";
const STUB_BODY = "_Not documented yet._";

interface Meta {
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------

export function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error(`"${name}" cannot be turned into a valid name (letters/digits required).`);
  return slug;
}

const now = (): string => new Date().toISOString();
const today = (): string => now().slice(0, 10);

export async function ensureRoot(): Promise<void> {
  await fs.mkdir(ROOT, { recursive: true });
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export function projectDir(project: string): string {
  return path.join(ROOT, slugify(project));
}

export function categoryDir(project: string, category: string): string {
  return path.join(projectDir(project), slugify(category));
}

export function chapterDir(project: string, category: string, chapter: string): string {
  return path.join(categoryDir(project, category), slugify(chapter));
}

export function topicDir(project: string, category: string, chapter: string, topic: string): string {
  return path.join(chapterDir(project, category, chapter), slugify(topic));
}

export function docPath(project: string, category: string, chapter: string, topic: string, kind: DocKind): string {
  return path.join(topicDir(project, category, chapter, topic), `${kind}.md`);
}

// ---------------------------------------------------------------------------
// Meta files
// ---------------------------------------------------------------------------

async function readMeta(dir: string): Promise<Meta | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(dir, META_FILE), "utf8")) as Meta;
  } catch {
    return null;
  }
}

async function writeMeta(dir: string, meta: Meta): Promise<void> {
  await fs.writeFile(path.join(dir, META_FILE), JSON.stringify(meta, null, 2) + "\n", "utf8");
}

async function upsertMeta(dir: string, name: string, description: string): Promise<"created" | "updated"> {
  const existing = await readMeta(dir);
  if (existing) {
    if (description) existing.description = description;
    existing.updatedAt = now();
    await writeMeta(dir, existing);
    return "updated";
  }
  await fs.mkdir(dir, { recursive: true });
  await writeMeta(dir, { name, description, createdAt: now(), updatedAt: now() });
  return "created";
}

async function requireProject(project: string): Promise<Meta> {
  const meta = await readMeta(projectDir(project));
  if (!meta) {
    const known = await listDirs(ROOT);
    throw new Error(
      `Project "${slugify(project)}" is not registered. ` +
        `Known projects: ${known.join(", ") || "(none)"}. Use register_project first.`,
    );
  }
  return meta;
}

/** Auto-creates any missing ancestor levels, returning a note per level created. */
async function ensureAncestors(project: string, category: string, chapter?: string): Promise<string[]> {
  const notes: string[] = [];
  if (!(await readMeta(categoryDir(project, category)))) {
    await upsertMeta(categoryDir(project, category), slugify(category), "");
    notes.push(
      `Category "${slugify(category)}" did not exist and was auto-created without a description — call define_category to describe it.`,
    );
  }
  if (chapter !== undefined && !(await readMeta(chapterDir(project, category, chapter)))) {
    await upsertMeta(chapterDir(project, category, chapter), slugify(chapter), "");
    notes.push(
      `Chapter "${slugify(chapter)}" did not exist and was auto-created without a description — call define_chapter to describe it.`,
    );
  }
  return notes;
}

// ---------------------------------------------------------------------------
// Doc files (internal.md / usage.md)
// ---------------------------------------------------------------------------

function kindTitle(kind: DocKind): string {
  return kind === "internal" ? "Internal: how it works" : "Usage: how to use it";
}

function renderDoc(
  project: string,
  category: string,
  chapter: string,
  topic: string,
  kind: DocKind,
  body: string,
): string {
  return [
    "---",
    `project: ${slugify(project)}`,
    `category: ${slugify(category)}`,
    `chapter: ${slugify(chapter)}`,
    `topic: ${slugify(topic)}`,
    `kind: ${kind}`,
    `updated: ${today()}`,
    "---",
    "",
    `# ${slugify(topic)} — ${kindTitle(kind)}`,
    "",
    body.trim(),
    "",
  ].join("\n");
}

/** Strips frontmatter and the generated H1, returning only the authored body. */
function extractBody(raw: string): string {
  let text = raw;
  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end !== -1) {
      const afterFence = text.indexOf("\n", end + 1);
      text = afterFence === -1 ? "" : text.slice(afterFence + 1);
    }
  }
  const lines = text.replace(/^\s+/, "").split("\n");
  if (lines[0]?.startsWith("# ")) {
    lines.shift();
    while (lines.length && lines[0].trim() === "") lines.shift();
  }
  return lines.join("\n").trimEnd();
}

async function docStatus(
  project: string,
  category: string,
  chapter: string,
  topic: string,
  kind: DocKind,
): Promise<string> {
  try {
    const raw = await fs.readFile(docPath(project, category, chapter, topic, kind), "utf8");
    const body = extractBody(raw);
    return body.trim() === STUB_BODY || body.trim() === "" ? "empty" : `~${body.length} chars`;
  } catch {
    return "missing";
  }
}

async function ensureDocStub(
  project: string,
  category: string,
  chapter: string,
  topic: string,
  kind: DocKind,
): Promise<void> {
  const fp = docPath(project, category, chapter, topic, kind);
  if (!(await exists(fp))) {
    await fs.writeFile(fp, renderDoc(project, category, chapter, topic, kind, STUB_BODY), "utf8");
  }
}

// ---------------------------------------------------------------------------
// INDEX.md regeneration
// ---------------------------------------------------------------------------

async function regenRootIndex(): Promise<void> {
  await ensureRoot();
  const projects = await listDirs(ROOT);
  let md =
    "# CodeLore — Documented Projects\n\n" +
    "Maintained by the CodeLore MCP server. Call `get_project_map(project)` for a project's " +
    "categories/chapters/topics, then `read_doc(...)` to read exactly the doc you need.\n\n";
  if (projects.length === 0) md += "_No projects registered yet._\n";
  for (const slug of projects) {
    const meta = await readMeta(path.join(ROOT, slug));
    md += `- **${slug}** — ${meta?.description || "(no description)"}\n`;
  }
  await fs.writeFile(path.join(ROOT, INDEX_FILE), md, "utf8");
}

async function regenProjectIndex(project: string): Promise<void> {
  const dir = projectDir(project);
  if (!(await exists(dir))) return;
  const meta = await readMeta(dir);
  const categories = await listDirs(dir);
  let md = `# ${slugify(project)}\n\n${meta?.description || "(no description)"}\n\n## Categories\n\n`;
  if (categories.length === 0) md += "_No categories defined yet._\n";
  for (const c of categories) {
    const cMeta = await readMeta(categoryDir(project, c));
    const chapters = await listDirs(categoryDir(project, c));
    md += `- **${c}** — ${cMeta?.description || "(no description)"}`;
    md += chapters.length ? ` _(chapters: ${chapters.join(", ")})_\n` : " _(no chapters yet)_\n";
  }
  await fs.writeFile(path.join(dir, INDEX_FILE), md, "utf8");
}

async function regenCategoryIndex(project: string, category: string): Promise<void> {
  const dir = categoryDir(project, category);
  if (!(await exists(dir))) return;
  const meta = await readMeta(dir);
  const chapters = await listDirs(dir);
  let md = `# ${slugify(project)} / ${slugify(category)}\n\n${meta?.description || "(no description)"}\n\n## Chapters\n\n`;
  if (chapters.length === 0) md += "_No chapters defined yet._\n";
  for (const ch of chapters) {
    const chMeta = await readMeta(chapterDir(project, category, ch));
    const topics = await listDirs(chapterDir(project, category, ch));
    md += `- **${ch}** — ${chMeta?.description || "(no description)"}`;
    md += topics.length ? ` _(topics: ${topics.join(", ")})_\n` : " _(no topics yet)_\n";
  }
  await fs.writeFile(path.join(dir, INDEX_FILE), md, "utf8");
}

async function regenChapterIndex(project: string, category: string, chapter: string): Promise<void> {
  const dir = chapterDir(project, category, chapter);
  if (!(await exists(dir))) return;
  const meta = await readMeta(dir);
  const topics = await listDirs(dir);
  let md = `# ${slugify(project)} / ${slugify(category)} / ${slugify(chapter)}\n\n${meta?.description || "(no description)"}\n\n## Topics\n\n`;
  if (topics.length === 0) md += "_No topics defined yet._\n";
  for (const t of topics) {
    const tMeta = await readMeta(topicDir(project, category, chapter, t));
    const internal = await docStatus(project, category, chapter, t, "internal");
    const usage = await docStatus(project, category, chapter, t, "usage");
    md += `- **${t}** — ${tMeta?.description || "(no description)"} _(internal: ${internal}, usage: ${usage})_\n`;
  }
  await fs.writeFile(path.join(dir, INDEX_FILE), md, "utf8");
}

async function regenIndexes(project: string, category?: string, chapter?: string): Promise<void> {
  await regenProjectIndex(project);
  if (category !== undefined) await regenCategoryIndex(project, category);
  if (category !== undefined && chapter !== undefined) await regenChapterIndex(project, category, chapter);
}

// ---------------------------------------------------------------------------
// Public operations (used by the MCP tools)
// ---------------------------------------------------------------------------

export async function registerProject(name: string, description: string): Promise<string> {
  await ensureRoot();
  const slug = slugify(name);
  const result = await upsertMeta(projectDir(name), slug, description);
  await regenRootIndex();
  await regenProjectIndex(slug);
  return (
    `Project "${slug}" ${result}. ` +
    `Next: define categories with define_category, chapters with define_chapter, topics with define_topic, ` +
    `then fill them with write_doc.`
  );
}

export async function listProjects(): Promise<string> {
  await ensureRoot();
  const projects = await listDirs(ROOT);
  if (projects.length === 0) {
    return "No projects registered yet. Use register_project(name, description) to create one.";
  }
  let md = "Registered projects (use get_project_map for categories/chapters/topics):\n\n";
  for (const slug of projects) {
    const meta = await readMeta(path.join(ROOT, slug));
    md += `- **${slug}** — ${meta?.description || "(no description)"}\n`;
  }
  return md;
}

export async function defineCategory(project: string, category: string, description: string): Promise<string> {
  await requireProject(project);
  const slug = slugify(category);
  const result = await upsertMeta(categoryDir(project, category), slug, description);
  await regenIndexes(project, category);
  return `Category "${slugify(project)}/${slug}" ${result}. Add chapters with define_chapter.`;
}

export async function defineChapter(
  project: string,
  category: string,
  chapter: string,
  description: string,
): Promise<string> {
  await requireProject(project);
  const notes = await ensureAncestors(project, category);
  const slug = slugify(chapter);
  const result = await upsertMeta(chapterDir(project, category, chapter), slug, description);
  await regenIndexes(project, category, chapter);
  const base = `Chapter "${slugify(project)}/${slugify(category)}/${slug}" ${result}. Add topics with define_topic.`;
  return [base, ...notes].join("\n");
}

export async function defineTopic(
  project: string,
  category: string,
  chapter: string,
  topic: string,
  description: string,
): Promise<string> {
  await requireProject(project);
  const notes = await ensureAncestors(project, category, chapter);
  const slug = slugify(topic);
  const result = await upsertMeta(topicDir(project, category, chapter, topic), slug, description);
  await ensureDocStub(project, category, chapter, topic, "internal");
  await ensureDocStub(project, category, chapter, topic, "usage");
  await regenIndexes(project, category, chapter);
  const base =
    `Topic "${slugify(project)}/${slugify(category)}/${slugify(chapter)}/${slug}" ${result} ` +
    `with empty internal.md and usage.md. Fill them with write_doc.`;
  return [base, ...notes].join("\n");
}

export async function getProjectMap(project: string): Promise<string> {
  const meta = await requireProject(project);
  const pSlug = slugify(project);
  let md = `# ${pSlug}\n\n${meta.description || "(no description)"}\n\n`;
  const categories = await listDirs(projectDir(project));
  if (categories.length === 0) md += "_No categories defined yet._\n";
  for (const c of categories) {
    const cMeta = await readMeta(categoryDir(project, c));
    md += `## ${c} — ${cMeta?.description || "(no description)"}\n\n`;
    const chapters = await listDirs(categoryDir(project, c));
    if (chapters.length === 0) md += "_No chapters yet._\n\n";
    for (const ch of chapters) {
      const chMeta = await readMeta(chapterDir(project, c, ch));
      md += `- **${ch}** — ${chMeta?.description || "(no description)"}\n`;
      const topics = await listDirs(chapterDir(project, c, ch));
      if (topics.length === 0) md += `  - _No topics yet._\n`;
      for (const t of topics) {
        const tMeta = await readMeta(topicDir(project, c, ch, t));
        const internal = await docStatus(project, c, ch, t, "internal");
        const usage = await docStatus(project, c, ch, t, "usage");
        md += `  - **${t}** — ${tMeta?.description || "(no description)"} _(internal: ${internal}, usage: ${usage})_\n`;
      }
    }
    md += "\n";
  }
  md += "Read a specific doc with read_doc(project, category, chapter, topic, kind).\n";
  return md;
}

export async function writeDoc(
  project: string,
  category: string,
  chapter: string,
  topic: string,
  kind: DocKind,
  content: string,
  mode: "replace" | "append",
): Promise<string> {
  await requireProject(project);
  const notes = await ensureAncestors(project, category, chapter);
  if (!(await readMeta(topicDir(project, category, chapter, topic)))) {
    await upsertMeta(topicDir(project, category, chapter, topic), slugify(topic), "");
    notes.push(
      `Topic "${slugify(topic)}" was auto-created without a description — call define_topic to describe it.`,
    );
  }

  let body = content.trim();
  const fp = docPath(project, category, chapter, topic, kind);
  if (mode === "append" && (await exists(fp))) {
    const previous = extractBody(await fs.readFile(fp, "utf8"));
    if (previous.trim() && previous.trim() !== STUB_BODY) {
      body = `${previous}\n\n${body}`;
    }
  }
  await fs.writeFile(fp, renderDoc(project, category, chapter, topic, kind, body), "utf8");
  await ensureDocStub(project, category, chapter, topic, kind === "internal" ? "usage" : "internal");
  await regenIndexes(project, category, chapter);

  const base =
    `Wrote ${kind}.md for ${slugify(project)}/${slugify(category)}/${slugify(chapter)}/${slugify(topic)} ` +
    `(${mode}, ~${body.length} chars).`;
  return [base, ...notes].join("\n");
}

export async function readDoc(
  project: string,
  category: string,
  chapter: string,
  topic: string,
  kind: DocKind | "both",
): Promise<string> {
  await requireProject(project);
  const kinds: DocKind[] = kind === "both" ? ["internal", "usage"] : [kind];
  const parts: string[] = [];
  for (const k of kinds) {
    const fp = docPath(project, category, chapter, topic, k);
    try {
      parts.push(await fs.readFile(fp, "utf8"));
    } catch {
      throw new Error(
        `No ${k}.md at ${slugify(project)}/${slugify(category)}/${slugify(chapter)}/${slugify(topic)}. ` +
          `Call get_project_map("${slugify(project)}") to see what exists.`,
      );
    }
  }
  return parts.join("\n\n---\n\n");
}
