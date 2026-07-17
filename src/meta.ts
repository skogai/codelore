import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ROOT } from "./config.js";
import type { Meta } from "./types.js";
import { now, listDirs } from "./utils.js";
import { slugify, projectDir, categoryDir, chapterDir } from "./paths.js";

const META_FILE = ".meta.json";

export async function readMeta(dir: string): Promise<Meta | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(dir, META_FILE), "utf8")) as Meta;
  } catch {
    return null;
  }
}

async function writeMeta(dir: string, meta: Meta): Promise<void> {
  await fs.writeFile(path.join(dir, META_FILE), JSON.stringify(meta, null, 2) + "\n", "utf8");
}

export async function upsertMeta(dir: string, name: string, description: string): Promise<"created" | "updated"> {
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

export async function requireProject(project: string): Promise<Meta> {
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
export async function ensureAncestors(project: string, category: string, chapter?: string): Promise<string[]> {
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
