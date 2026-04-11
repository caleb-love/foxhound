import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  gettingStartedSidebar: [
    {
      type: "category",
      label: "Getting Started",
      collapsed: false,
      items: [
        "getting-started/installation",
        "getting-started/quickstart",
        "getting-started/first-trace",
      ],
    },
  ],

  sdkSidebar: [
    {
      type: "category",
      label: "SDK Reference",
      collapsed: false,
      items: ["sdk/typescript", "sdk/python"],
    },
  ],

  integrationsSidebar: [
    {
      type: "category",
      label: "Integrations",
      collapsed: false,
      items: [
        "integrations/langgraph",
        "integrations/crewai",
        "integrations/mastra",
        "integrations/pydantic-ai",
        "integrations/bedrock-agentcore",
        "integrations/google-adk",
        "integrations/opentelemetry-bridge",
      ],
    },
  ],

  mcpServerSidebar: [
    {
      type: "category",
      label: "MCP Server",
      collapsed: false,
      items: ["mcp-server/setup", "mcp-server/tool-reference"],
    },
  ],

  cicdSidebar: [
    {
      type: "category",
      label: "CI/CD",
      collapsed: false,
      items: ["ci-cd/quality-gate-action"],
    },
  ],

  cookbookSidebar: [
    {
      type: "category",
      label: "Evaluation Cookbook",
      collapsed: false,
      items: [
        "evaluation-cookbook/index",
        "evaluation-cookbook/manual-scoring",
        "evaluation-cookbook/llm-as-a-judge",
        "evaluation-cookbook/dataset-curation",
        "evaluation-cookbook/ci-quality-gates",
      ],
    },
  ],
};

export default sidebars;
