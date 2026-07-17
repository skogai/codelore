import * as fs from "node:fs/promises";
import type { DocKind } from "./types.js";
import { today, exists } from "./utils.js";
import { slugify, docPath } from "./paths.js";

export const STUB_BODY = "_Not documented yet._";

function kindTitle(kind: DocKind): string {
  return kind === "internal" ? "Internal: how it works" : "Usage: how to use it";
}

export function renderDoc(
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
export function extractBody(raw: string): string {
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

export async function docStatus(
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

export async function ensureDocStub(
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
