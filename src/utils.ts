import * as fs from "node:fs/promises";
import { ROOT } from "./config.js";

export const now = (): string => new Date().toISOString();
export const today = (): string => now().slice(0, 10);

export async function ensureRoot(): Promise<void> {
  await fs.mkdir(ROOT, { recursive: true });
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function listDirs(dir: string): Promise<string[]> {
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
