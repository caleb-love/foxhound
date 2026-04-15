import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "Foxhound Docs",
  tagline: "Compliance-grade observability for AI agent fleets",
  favicon: "img/favicon.ico",

  url: "https://docs.foxhound.caleb-love.com",
  baseUrl: "/",

  organizationName: "caleb-love",
  projectName: "foxhound",

  onBrokenLinks: "warn",

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/caleb-love/foxhound/tree/main/docs-site/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      {
        hashed: true,
        language: ["en"],
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
        docsRouteBasePath: "/",
      },
    ],
  ],

  themeConfig: {
    image: "img/foxhound-social.png",
    navbar: {
      title: "Foxhound",
      logo: {
        alt: "Foxhound Logo",
        src: "img/logo.png",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "gettingStartedSidebar",
          position: "left",
          label: "Getting Started",
        },
        {
          type: "docSidebar",
          sidebarId: "sdkSidebar",
          position: "left",
          label: "SDK Reference",
        },
        {
          type: "docSidebar",
          sidebarId: "integrationsSidebar",
          position: "left",
          label: "Integrations",
        },
        {
          type: "docSidebar",
          sidebarId: "mcpServerSidebar",
          position: "left",
          label: "MCP Server",
        },
        {
          type: "docSidebar",
          sidebarId: "cicdSidebar",
          position: "left",
          label: "CI/CD",
        },
        {
          type: "docSidebar",
          sidebarId: "cookbookSidebar",
          position: "left",
          label: "Cookbook",
        },
        {
          href: "https://github.com/caleb-love/foxhound",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Getting Started", to: "/getting-started/installation" },
            { label: "SDK Reference", to: "/sdk/typescript" },
            { label: "MCP Server", to: "/mcp-server/setup" },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/caleb-love/foxhound",
            },
            {
              label: "Issues",
              href: "https://github.com/caleb-love/foxhound/issues",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "foxhound.dev",
              href: "https://foxhound.dev",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Foxhound. All rights reserved. Public reference repo only.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "json", "python", "typescript", "yaml"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
