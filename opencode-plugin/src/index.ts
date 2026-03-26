import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";
import { runOneshot } from "../../devglobe-core/src/oneshot";
import { langFromPath } from "../../devglobe-core/src/language";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../devglobe-core/src/constants";

const z = tool.schema;

const DEVGLOBE_DIR = join(homedir(), ".devglobe");
const API_KEY_PATH = join(DEVGLOBE_DIR, "api_key");
const CONFIG_PATH = join(DEVGLOBE_DIR, "config.json");

function getConfig(): { shareRepo?: boolean; anonymousMode?: boolean } {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function extractFilePath(toolName: string, args: any, title: string, metadata: any): string | null {
  if (metadata?.filediff?.file) return metadata.filediff.file;
  if (metadata?.filepath) return metadata.filepath;
  if (metadata?.filePath) return metadata.filePath;
  if (args?.file_path) return args.file_path;
  if (args?.filePath) return args.filePath;
  if (args?.path) return args.path;
  if (toolName === "read" && title) return title;

  if (metadata?.results) {
    for (const r of metadata.results) {
      if (r.filediff?.file) return r.filediff.file;
    }
  }

  return null;
}

export const DevGlobePlugin: Plugin = async (ctx) => {
  async function heartbeat(filePath: string | null, force: boolean): Promise<void> {
    const language = filePath ? langFromPath(filePath) ?? undefined : undefined;

    await runOneshot({
      file_path: filePath ?? undefined,
      cwd: ctx.directory,
      editor: "opencode",
      language,
      force,
    });
  }

  return {
    tool: {
      devglobe_setup: tool({
        description: "Configure DevGlobe with an API key. Get your key at https://devglobe.xyz — sign in, then open your profile settings.",
        args: {
          api_key: z.string().describe("Your DevGlobe API key"),
        },
        async execute(args) {
          if (!args.api_key?.trim()) return "Error: API key is required.";

          mkdirSync(DEVGLOBE_DIR, { recursive: true });
          writeFileSync(API_KEY_PATH, args.api_key.trim());

          if (!existsSync(CONFIG_PATH)) {
            writeFileSync(CONFIG_PATH, JSON.stringify({ anonymousMode: true, shareRepo: false }, null, 2));
          }

          return `DevGlobe configured! API key saved to ${API_KEY_PATH}. Config at ${CONFIG_PATH}. Heartbeats will be sent automatically while you code.`;
        },
      }),

      devglobe_anonymous: tool({
        description: "Toggle DevGlobe anonymous mode. When enabled, your location is snapped to a random city in your country instead of your exact IP location.",
        args: {
          enabled: z.boolean().describe("true to enable anonymous mode, false to disable"),
        },
        async execute(args) {
          mkdirSync(DEVGLOBE_DIR, { recursive: true });
          const config = getConfig();
          config.anonymousMode = args.enabled;
          writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
          return `Anonymous mode ${args.enabled ? "enabled" : "disabled"}.`;
        },
      }),

      devglobe_share_repo: tool({
        description: "Toggle DevGlobe repo sharing. When enabled, your current repository name is visible on the globe.",
        args: {
          enabled: z.boolean().describe("true to share repo name, false to hide it"),
        },
        async execute(args) {
          mkdirSync(DEVGLOBE_DIR, { recursive: true });
          const config = getConfig();
          config.shareRepo = args.enabled;
          writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
          return `Repo sharing ${args.enabled ? "enabled" : "disabled"}.`;
        },
      }),

      devglobe_status: tool({
        description: "Set a status message on your DevGlobe profile, visible on the globe next to your avatar.",
        args: {
          message: z.string().describe("Status message (max 100 characters)"),
        },
        async execute(args) {
          let apiKey: string | null = null;
          try { apiKey = readFileSync(API_KEY_PATH, "utf-8").trim(); } catch {}
          if (!apiKey) return "Error: No API key configured. Run devglobe_setup first.";

          const body = JSON.stringify({ p_key: apiKey, p_message: args.message });
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 15_000);
          try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_status_message`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
              body,
              signal: controller.signal,
            });
            if (!res.ok) return `Error: HTTP ${res.status}`;
            return `Status updated: "${args.message}"`;
          } catch (err) {
            return `Error: ${err instanceof Error ? err.message : "unknown"}`;
          } finally {
            clearTimeout(timer);
          }
        },
      }),

      devglobe_check: tool({
        description: "Check DevGlobe installation status — API key, config, and connection.",
        args: {},
        async execute() {
          const lines: string[] = ["=== DevGlobe Status ==="];

          let apiKey: string | null = null;
          try { apiKey = readFileSync(API_KEY_PATH, "utf-8").trim(); } catch {}
          lines.push(`API key: ${apiKey ? apiKey.substring(0, 15) + "... OK" : "NOT SET"}`);

          try {
            const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
            lines.push(`Anonymous mode: ${config.anonymousMode !== false ? "on" : "off"}`);
            lines.push(`Share repo: ${config.shareRepo === true ? "on" : "off"}`);
          } catch {
            lines.push("Config: NOT SET");
          }

          lines.push(`Editor: opencode`);

          return lines.join("\n");
        },
      }),
    },

    "tool.execute.after": async (input, output) => {
      const filePath = extractFilePath(input.tool, input.args, output.title, output.metadata);
      heartbeat(filePath, false);
    },

    event: async ({ event }) => {
      if (event.type === "file.edited") {
        const filePath = (event.properties as any)?.file ?? null;
        heartbeat(filePath, false);
      }
      if (event.type === "session.idle" || event.type === "session.deleted") {
        await heartbeat(null, true);
      }
    },
  };
};

export default DevGlobePlugin;
