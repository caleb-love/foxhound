import type { Command } from "commander";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import chalk from "chalk";

interface DetectedFramework {
  name: string;
  integration: string;
  language: "python" | "typescript";
}

function detectFramework(cwd: string): DetectedFramework | null {
  // Check Python frameworks
  const pyFiles = ["requirements.txt", "pyproject.toml", "Pipfile"];
  for (const f of pyFiles) {
    const path = join(cwd, f);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf-8");

    if (content.includes("langgraph")) {
      return { name: "LangGraph", integration: "langgraph", language: "python" };
    }
    if (content.includes("crewai")) {
      return { name: "CrewAI", integration: "crewai", language: "python" };
    }
    if (content.includes("autogen")) {
      return { name: "AutoGen", integration: "autogen", language: "python" };
    }
    if (content.includes("openai-agents") || content.includes("openai_agents")) {
      return { name: "OpenAI Agents", integration: "openai_agents", language: "python" };
    }
    if (content.includes("anthropic")) {
      return { name: "Claude Agent SDK", integration: "claude_agent", language: "python" };
    }
  }

  // Check TypeScript/Node frameworks
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = readFileSync(pkgPath, "utf-8");
    if (pkg.includes("@anthropic-ai/sdk")) {
      return { name: "Claude Agent SDK", integration: "claude-agent", language: "typescript" };
    }
  }

  return null;
}

function pythonSnippet(framework: DetectedFramework, _apiKey: string, endpoint: string): string {
  const base = `import os
from foxhound import FoxhoundClient

fox = FoxhoundClient(
    api_key=os.environ["FOXHOUND_API_KEY"],
    endpoint="${endpoint}",
)`;

  if (framework.integration === "langgraph") {
    return `${base}

from foxhound.integrations.langgraph import FoxhoundLangGraphHandler

# Add to your LangGraph app:
handler = FoxhoundLangGraphHandler(fox)
# app.invoke(inputs, config={"callbacks": [handler]})
`;
  }
  if (framework.integration === "crewai") {
    return `${base}

from foxhound.integrations.crewai import FoxhoundCrewHandler

# Add to your CrewAI crew:
handler = FoxhoundCrewHandler(fox)
# crew = Crew(..., callbacks=[handler])
`;
  }

  return `${base}

# Start a trace:
# with fox.start_trace(agent_id="my-agent") as trace:
#     with trace.start_span("my-step", kind="agent_step") as span:
#         span.set_attribute("input", "hello")
`;
}

function typescriptSnippet(
  framework: DetectedFramework,
  _apiKey: string,
  endpoint: string,
): string {
  const base = `import { FoxhoundClient } from "@foxhound-ai/sdk";

const fox = new FoxhoundClient({
  apiKey: process.env.FOXHOUND_API_KEY!,
  endpoint: "${endpoint}",
});`;

  if (framework.integration === "claude-agent") {
    return `${base}

import { withFoxhound } from "@foxhound-ai/sdk/integrations/claude-agent";

// Wrap your agent's tools:
// const tracedTools = withFoxhound(fox, tools);
`;
  }

  return `${base}

// Start a trace:
// const trace = fox.startTrace("my-agent");
// const span = trace.startSpan("my-step", "agent_step");
// span.end();
// await trace.flush();
`;
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize Foxhound in the current project")
    .option("--api-key <key>", "API key (or set FOXHOUND_API_KEY)")
    .option("--endpoint <url>", "API endpoint", "https://api.foxhound.caleb-love.com")
    .action(async (opts: { apiKey?: string; endpoint: string }) => {
      const cwd = resolve(".");
      console.log(chalk.bold("Foxhound Init\n"));

      // 1. Detect framework
      const framework = detectFramework(cwd);
      if (framework) {
        console.log(`Detected: ${chalk.cyan(framework.name)} (${framework.language})\n`);
      } else {
        console.log("No known framework detected. Generating generic setup.\n");
      }

      // 2. Get API key
      let apiKey = opts.apiKey ?? process.env["FOXHOUND_API_KEY"] ?? "";
      if (!apiKey) {
        const rl = createInterface({ input: stdin, output: stdout });
        console.log("Get your API key at https://app.foxhound.caleb-love.com/settings/api-keys\n");
        apiKey = await rl.question("API key: ");
        rl.close();
      }
      if (!apiKey) {
        console.error(chalk.red("No API key provided. Aborting."));
        process.exit(1);
      }

      // 3. Generate snippet
      const detected = framework ?? {
        name: "Generic",
        integration: "generic",
        language: "python" as const,
      };
      const snippet =
        detected.language === "python"
          ? pythonSnippet(detected, apiKey, opts.endpoint)
          : typescriptSnippet(detected, apiKey, opts.endpoint);

      // 4. Write snippet file
      const ext = detected.language === "python" ? "py" : "ts";
      const filename = `foxhound_setup.${ext}`;
      const filepath = join(cwd, filename);

      if (existsSync(filepath)) {
        console.log(chalk.yellow(`${filename} already exists — printing snippet instead:\n`));
        console.log(snippet);
      } else {
        writeFileSync(filepath, snippet);
        console.log(`Created ${chalk.green(filename)}\n`);
        console.log(snippet);
      }

      console.log(chalk.dim("─".repeat(60)));
      console.log(`\nNext steps:`);
      console.log(`  1. Set your API key: ${chalk.cyan("export FOXHOUND_API_KEY=<your_api_key>")}`);
      console.log(`  2. Import ${chalk.cyan(filename)} in your agent code and run it.`);
      console.log(
        "Your first trace should appear at https://app.foxhound.caleb-love.com within seconds.\n",
      );
    });
}
