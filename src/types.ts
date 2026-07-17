/** The two perspectives every topic is documented from. */
export type DocKind = "internal" | "usage";

/** Contents of a `.meta.json` file — the source of truth for name/description at every level. */
export interface Meta {
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}
