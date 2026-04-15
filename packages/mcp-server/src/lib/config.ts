export function getConfig(): { endpoint: string; apiKey: string } {
  const apiKey = process.env["FOXHOUND_API_KEY"];
  const endpoint = process.env["FOXHOUND_ENDPOINT"] ?? "http://localhost:3001";

  if (!apiKey) {
    console.error("Error: FOXHOUND_API_KEY environment variable is required.");
    console.error("Set it in your environment or MCP client config.");
    process.exit(1);
  }

  return { endpoint, apiKey };
}
