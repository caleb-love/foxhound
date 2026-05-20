import type { PromptTemplate, TemplateVars } from "./types.js";

/**
 * Render a Mustache-style template against vars. Substitutes `{{key}}` with
 * `vars[key]`. Unknown keys are preserved literally so missing data is visible
 * to downstream consumers (LLM, debugging UI) rather than silently dropped.
 *
 * Non-string values are JSON-stringified. Strings pass through unchanged.
 */
export function renderTemplate(template: PromptTemplate, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) {
      return `{{${key}}}`;
    }
    const value = vars[key];
    if (value === undefined) return `{{${key}}}`;
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}
