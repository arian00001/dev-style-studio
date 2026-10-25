import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { secrets } from "base44:runtime";
import { requireUser } from "@/lib/auth-middleware";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    root_cause: { type: "string" },
    fixable: { type: "boolean" },
    patches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
          reason: { type: "string" },
        },
        required: ["path", "content", "reason"],
      },
    },
  },
  required: ["summary", "root_cause", "fixable", "patches"],
};

export const diagnoseBuild = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      logs: z.string().min(20).max(60000),
      projectType: z.string().max(20),
      attempt: z.number().int().min(1).max(10),
      files: z
        .array(z.object({ path: z.string().max(400), content: z.string().max(60000) }))
        .max(6),
      tree: z.array(z.string().max(400)).max(500),
    }),
  )
  .handler(async ({ data }) => {
    const key = secrets.get("GEMINI_API_KEY");
    if (!key) throw Object.assign(new Error("Gemini API key is not configured on the server yet."), { status: 400 });

    const fileText = data.files
      .map((f) => `--- FILE: ${f.path} ---\n${f.content}`)
      .join("\n\n");

    const prompt = `You are fixing a failed ${data.projectType} CI build (fix attempt ${data.attempt}).
Return ONLY changes that are strictly required to make the build pass.

Rules:
- Change as few files as possible. Never rewrite the whole project.
- The "content" field must be the COMPLETE new content of that file, ready to commit.
- Only touch files that appear in the provided file list or the repository tree.
- If the log does not contain enough information to fix the build, set fixable to false and return no patches.
- Never claim the build will pass; describe the cause factually.

BUILD LOG (tail):
${data.logs.slice(-40000)}

REPOSITORY FILES (truncated list):
${data.tree.slice(0, 400).join("\n")}

RELEVANT FILE CONTENTS:
${fileText || "(none supplied)"}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.15,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Gemini request failed (${response.status}). ${detail.slice(0, 240)}`);
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Gemini returned a response that could not be read as a patch set.");
    }

    const allowed = new Set([...data.files.map((f) => f.path), ...data.tree]);
    const patches = (parsed.patches || [])
      .filter((p) => typeof p?.path === "string" && typeof p?.content === "string")
      .filter((p) => allowed.has(p.path))
      .slice(0, 8)
      .map((p) => ({ path: p.path, content: p.content, reason: p.reason || "" }));

    return {
      summary: parsed.summary || "No summary returned.",
      root_cause: parsed.root_cause || "",
      fixable: Boolean(parsed.fixable) && patches.length > 0,
      patches,
    };
  });