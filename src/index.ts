#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as store from "./storage.js";

const server = new McpServer({
  name: "codelore",
  version: "0.2.0",
});

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

async function run(fn: () => Promise<string>): Promise<ToolResult> {
  try {
    return { content: [{ type: "text", text: await fn() }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
  }
}

const kindSchema = z.enum(["internal", "usage"]);

server.registerTool(
  "list_projects",
  {
    title: "List documented projects",
    description:
      "List every project that has CodeLore documentation, with a one-line description each. " +
      "Start here when you don't know which project the user means.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => run(() => store.listProjects()),
);

server.registerTool(
  "register_project",
  {
    title: "Register a project",
    description:
      "Register a project so it can hold documentation. Safe to call again to update the description.",
    inputSchema: {
      name: z.string().describe("Project name, e.g. 'cap'. Will be slugified (lowercase, dashes)."),
      description: z.string().describe("One-line summary of what the project is."),
    },
  },
  async ({ name, description }) => run(() => store.registerProject(name, description)),
);

server.registerTool(
  "define_category",
  {
    title: "Define a category",
    description:
      "Create or update a top-level category inside a project — usually a technology (e.g. angular, dotnet, sql). " +
      "Categories contain chapters. " +
      "The description is what future readers use to decide whether to look inside, so make it informative.",
    inputSchema: {
      project: z.string().describe("Registered project name."),
      category: z.string().describe("Category name, e.g. 'angular'."),
      description: z.string().describe("One-line summary of what this category covers."),
    },
  },
  async ({ project, category, description }) => run(() => store.defineCategory(project, category, description)),
);

server.registerTool(
  "define_chapter",
  {
    title: "Define a chapter",
    description:
      "Create or update a chapter inside a category — a functional area grouping related topics " +
      "(e.g. angular/pages, angular/components). Chapters contain topics; the docs themselves live on topics.",
    inputSchema: {
      project: z.string().describe("Registered project name."),
      category: z.string().describe("Parent category, e.g. 'angular'."),
      chapter: z.string().describe("Chapter name, e.g. 'pages'."),
      description: z.string().describe("One-line summary of what this chapter covers."),
    },
  },
  async ({ project, category, chapter, description }) =>
    run(() => store.defineChapter(project, category, chapter, description)),
);

server.registerTool(
  "define_topic",
  {
    title: "Define a topic",
    description:
      "Create or update a topic inside a chapter — the unit of documentation, usually one component/service/concept " +
      "(e.g. angular/pages/grid-page). Automatically creates empty internal.md and usage.md files following the " +
      "CodeLore convention; fill them with write_doc.",
    inputSchema: {
      project: z.string().describe("Registered project name."),
      category: z.string().describe("Parent category, e.g. 'angular'."),
      chapter: z.string().describe("Parent chapter, e.g. 'pages'."),
      topic: z.string().describe("Topic name, e.g. 'grid-page'."),
      description: z.string().describe("One-line summary of what this topic covers."),
    },
  },
  async ({ project, category, chapter, topic, description }) =>
    run(() => store.defineTopic(project, category, chapter, topic, description)),
);

server.registerTool(
  "get_project_map",
  {
    title: "Get project map (summary)",
    description:
      "THE entry point for reading documentation. Returns the full table of contents of a project in one call: " +
      "every category, its chapters, and their topics, each with a description — plus whether every topic's " +
      "internal/usage docs are filled in. Use this summary to decide exactly which doc to fetch with read_doc — " +
      "never read everything.",
    inputSchema: {
      project: z.string().describe("Registered project name."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ project }) => run(() => store.getProjectMap(project)),
);

server.registerTool(
  "write_doc",
  {
    title: "Write documentation",
    description:
      "Write the internal (how the code works) or usage (how to use it) doc of a topic. " +
      "Provide only the markdown body — CodeLore adds the standard frontmatter, title, and updated date. " +
      "Use mode 'append' to add to an existing doc instead of replacing it. " +
      "For 'usage' docs, prefer concrete examples (inputs, outputs, code snippets).",
    inputSchema: {
      project: z.string().describe("Registered project name."),
      category: z.string().describe("Category, e.g. 'angular'."),
      chapter: z.string().describe("Chapter, e.g. 'pages'."),
      topic: z.string().describe("Topic, e.g. 'grid-page'."),
      kind: kindSchema.describe("'internal' = how the code works; 'usage' = how to use it."),
      content: z.string().describe("Markdown body only. Do not include frontmatter or a top-level title."),
      mode: z
        .enum(["replace", "append"])
        .default("replace")
        .describe("'replace' overwrites the body (default); 'append' adds below the existing body."),
    },
  },
  async ({ project, category, chapter, topic, kind, content, mode }) =>
    run(() => store.writeDoc(project, category, chapter, topic, kind, content, mode)),
);

server.registerTool(
  "read_doc",
  {
    title: "Read documentation",
    description:
      "Read exactly one topic's internal doc, usage doc, or both. " +
      "Call get_project_map first to know what exists — then fetch only what you need.",
    inputSchema: {
      project: z.string().describe("Registered project name."),
      category: z.string().describe("Category, e.g. 'angular'."),
      chapter: z.string().describe("Chapter, e.g. 'pages'."),
      topic: z.string().describe("Topic, e.g. 'grid-page'."),
      kind: z
        .union([kindSchema, z.literal("both")])
        .describe("'internal', 'usage', or 'both'."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ project, category, chapter, topic, kind }) =>
    run(() => store.readDoc(project, category, chapter, topic, kind)),
);

async function main(): Promise<void> {
  await store.ensureRoot();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`codelore MCP server running on stdio (root: ${store.ROOT})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
