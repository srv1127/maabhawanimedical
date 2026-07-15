import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_expiring_medicines",
  title: "List medicines expiring soon",
  description: "Return medicines whose expiry date falls within the next `days` days (default 90).",
  inputSchema: {
    days: z.number().int().min(1).max(365).optional().describe("Days ahead to look. Default 90."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const d = days ?? 90;
    const cutoff = new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabaseForUser(ctx)
      .from("medicines")
      .select("id,name,batch_no,expiry_date,quantity,mrp")
      .not("expiry_date", "is", null)
      .gte("expiry_date", today)
      .lte("expiry_date", cutoff)
      .order("expiry_date", { ascending: true })
      .limit(200);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { days: d, medicines: data ?? [] },
    };
  },
});
