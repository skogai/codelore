import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ROOT } from "./config.js";
import { ensureRoot, exists, listDirs } from "./utils.js";
import { slugify, projectDir, categoryDir, chapterDir, topicDir } from "./paths.js";
import { readMeta } from "./meta.js";
import { docStatus } from "./markdown.js";

/**
 * INDEX.md files are always regenerated from the .meta.json files + directory
 * scan, so they can never drift from reality.
 */

const INDEX_FILE = "INDEX.md";

export async function regenRootIndex(): Promise<void> {
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

export async function regenProjectIndex(project: string): Promise<void> {
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

export async function regenIndexes(project: string, category?: string, chapter?: string): Promise<void> {
  await regenProjectIndex(project);
  if (category !== undefined) await regenCategoryIndex(project, category);
  if (category !== undefined && chapter !== undefined) await regenChapterIndex(project, category, chapter);
}
