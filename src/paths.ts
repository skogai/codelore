import * as path from "node:path";
import { ROOT } from "./config.js";
import type { DocKind } from "./types.js";

export function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error(`"${name}" cannot be turned into a valid name (letters/digits required).`);
  return slug;
}

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
