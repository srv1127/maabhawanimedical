import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "sales_summary",
  title: "Sales summary for a date range",
  description:
    "Aggregate sales between two ISO dates (YYYY-MM-DD, inclusive). Returns count, gross, tax, and net total. Omit dates for today.",
  inputSchema: {
    from: z.string().optional().describe("Start date YYYY-MM-DD."),
    to: z.string().optional().describe("End date YYYY-MM-DD."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const today = new Date().toISOString().slice(0, 10);
    const start = (from ?? today) + "T00:00:00Z";
    const end = (to ?? today) + "T23:59:59Z";
    const { data, error } = await supabaseForUser(ctx)
      .from("sales")
      .select("total,tax_total,subtotal")
      .gte("created_at", start)
      .lte("created_at", end);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    const summary = {
      from: from ?? today,
      to: to ?? today,
      count: rows.length,
      subtotal: rows.reduce((a, r) => a + Number(r.subtotal ?? 0), 0),
      tax: rows.reduce((a, r) => a + Number(r.tax_total ?? 0), 0),
      total: rows.reduce((a, r) => a + Number(r.total ?? 0), 0),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
