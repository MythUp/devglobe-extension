import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";
import { runOneshot } from "../../devglobe-core/src/oneshot";
import { langFromPath } from "../../devglobe-core/src/language";
import { setApiKey, loadConfig, configPath } from "../../devglobe-core/src/config";
import { sendStatus } from "../../devglobe-core/src/heartbeat";

const z = tool.schema;

const PLUGIN_VERSION = "2.0.0";

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
      file: filePath ?? undefined,
      cwd: ctx.directory,
      editor: "opencode",
      language,
      pluginVersion: PLUGIN_VERSION,
      force,
    });
  }

  return {
    tool: {
      devglobe_setup: tool({
        description: "Configure DevGlobe with an API key. Get your key at https://devglobe.xyz/dashboard/settings.",
        args: {
          api_key: z.string().describe("Your DevGlobe API key"),
        },
        async execute(args) {
          if (!args.api_key?.trim()) return "Error: API key is required.";
          setApiKey(args.api_key.trim());
          return `DevGlobe configured! API key saved to ${configPath()}. Heartbeats will be sent automatically while you code.`;
        },
      }),

      devglobe_status: tool({
        description: "Set a status message on your DevGlobe profile, visible on the globe next to your avatar.",
        args: {
          message: z.string().describe("Status message (max 100 characters)"),
        },
        async execute(args) {
          const cfg = loadConfig();
          if (!cfg.apiKey) return "Error: No API key configured. Run devglobe_setup first.";

          try {
            await sendStatus(cfg.apiKey, args.message);
            return `Status updated: "${args.message}"`;
          } catch (err) {
            return `Error: ${err instanceof Error ? err.message : "unknown"}`;
          }
        },
      }),

      devglobe_check: tool({
        description: "Check DevGlobe installation status — API key and config.",
        args: {},
        async execute() {
          const cfg = loadConfig();
          const lines: string[] = ["=== DevGlobe Status ==="];
          lines.push(`Config: ${configPath()}`);
          lines.push(`API key: ${cfg.apiKey ? cfg.apiKey.substring(0, 15) + "... OK" : "NOT SET"}`);
          lines.push(`Debug logging: ${cfg.debug ? "on" : "off"}`);
          lines.push(`Privacy:`);
          lines.push(`  hide_file_names = ${cfg.privacy.hideFileNames}`);
          lines.push(`  hide_branch_names = ${cfg.privacy.hideBranchNames}`);
          lines.push(`  hide_project_names = ${cfg.privacy.hideProjectNames}`);
          lines.push(`Editor: opencode`);
          lines.push(``);
          lines.push(`Visibility settings (anonymous mode, repo sharing on the live globe, profile mode) are managed at https://devglobe.xyz/dashboard/settings`);
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
