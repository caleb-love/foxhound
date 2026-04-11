import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/search',
    component: ComponentCreator('/search', '822'),
    exact: true
  },
  {
    path: '/',
    component: ComponentCreator('/', '5f7'),
    routes: [
      {
        path: '/',
        component: ComponentCreator('/', 'f2f'),
        routes: [
          {
            path: '/',
            component: ComponentCreator('/', 'a07'),
            routes: [
              {
                path: '/ci-cd/quality-gate-action',
                component: ComponentCreator('/ci-cd/quality-gate-action', '6da'),
                exact: true,
                sidebar: "cicdSidebar"
              },
              {
                path: '/evaluation-cookbook',
                component: ComponentCreator('/evaluation-cookbook', '0e7'),
                exact: true,
                sidebar: "cookbookSidebar"
              },
              {
                path: '/evaluation-cookbook/ci-quality-gates',
                component: ComponentCreator('/evaluation-cookbook/ci-quality-gates', '199'),
                exact: true,
                sidebar: "cookbookSidebar"
              },
              {
                path: '/evaluation-cookbook/dataset-curation',
                component: ComponentCreator('/evaluation-cookbook/dataset-curation', '0e3'),
                exact: true,
                sidebar: "cookbookSidebar"
              },
              {
                path: '/evaluation-cookbook/llm-as-a-judge',
                component: ComponentCreator('/evaluation-cookbook/llm-as-a-judge', '133'),
                exact: true,
                sidebar: "cookbookSidebar"
              },
              {
                path: '/evaluation-cookbook/manual-scoring',
                component: ComponentCreator('/evaluation-cookbook/manual-scoring', '8c0'),
                exact: true,
                sidebar: "cookbookSidebar"
              },
              {
                path: '/getting-started/first-trace',
                component: ComponentCreator('/getting-started/first-trace', 'edf'),
                exact: true,
                sidebar: "gettingStartedSidebar"
              },
              {
                path: '/getting-started/installation',
                component: ComponentCreator('/getting-started/installation', 'c05'),
                exact: true,
                sidebar: "gettingStartedSidebar"
              },
              {
                path: '/getting-started/quickstart',
                component: ComponentCreator('/getting-started/quickstart', 'bdc'),
                exact: true,
                sidebar: "gettingStartedSidebar"
              },
              {
                path: '/integrations/bedrock-agentcore',
                component: ComponentCreator('/integrations/bedrock-agentcore', '559'),
                exact: true,
                sidebar: "integrationsSidebar"
              },
              {
                path: '/integrations/crewai',
                component: ComponentCreator('/integrations/crewai', '96d'),
                exact: true,
                sidebar: "integrationsSidebar"
              },
              {
                path: '/integrations/google-adk',
                component: ComponentCreator('/integrations/google-adk', 'e86'),
                exact: true,
                sidebar: "integrationsSidebar"
              },
              {
                path: '/integrations/langgraph',
                component: ComponentCreator('/integrations/langgraph', '9d9'),
                exact: true,
                sidebar: "integrationsSidebar"
              },
              {
                path: '/integrations/mastra',
                component: ComponentCreator('/integrations/mastra', 'cf2'),
                exact: true,
                sidebar: "integrationsSidebar"
              },
              {
                path: '/integrations/opentelemetry-bridge',
                component: ComponentCreator('/integrations/opentelemetry-bridge', '8e7'),
                exact: true,
                sidebar: "integrationsSidebar"
              },
              {
                path: '/integrations/pydantic-ai',
                component: ComponentCreator('/integrations/pydantic-ai', '791'),
                exact: true,
                sidebar: "integrationsSidebar"
              },
              {
                path: '/mcp-server/setup',
                component: ComponentCreator('/mcp-server/setup', '357'),
                exact: true,
                sidebar: "mcpServerSidebar"
              },
              {
                path: '/mcp-server/tool-reference',
                component: ComponentCreator('/mcp-server/tool-reference', '2f6'),
                exact: true,
                sidebar: "mcpServerSidebar"
              },
              {
                path: '/sdk/python',
                component: ComponentCreator('/sdk/python', 'f48'),
                exact: true,
                sidebar: "sdkSidebar"
              },
              {
                path: '/sdk/typescript',
                component: ComponentCreator('/sdk/typescript', 'e26'),
                exact: true,
                sidebar: "sdkSidebar"
              },
              {
                path: '/',
                component: ComponentCreator('/', 'c48'),
                exact: true
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
