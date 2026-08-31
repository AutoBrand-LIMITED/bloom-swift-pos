const escapeHtml = (value: string): string => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

/** Safely render the limited Markdown supported by message cards. */
export const renderSafeMarkdown = (content: string): string => escapeHtml(content)
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/\*(.+?)\*/g, "<em>$1</em>")
  .replace(/~~(.+?)~~/g, "<del>$1</del>")
  .replace(/\r?\n/g, "<br />");
