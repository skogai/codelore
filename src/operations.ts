import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ROOT } from "./config.js";
import type { DocKind } from "./types.js";
import { ensureRoot, exists, listDirs } from "./utils.js";
import { slugify, projectDir, categoryDir, chapterDir, topicDir, docPath } from "./paths.js";
import { readMeta, upsertMeta, requireProject, ensureAncestors } from "./meta.js";
import { STUB_BODY, renderDoc, extractBody, docStatus, ensureDocStub } from "./markdown.js";
import { regenRootIndex, regenProjectIndex, regenIndexes } from "./indexes.js";

/** The public operations behind the MCP tools. Each returns markdown for the LLM. */

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
