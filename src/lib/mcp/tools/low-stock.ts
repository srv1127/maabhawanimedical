import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_low_stock",
  title: "List low-stock medicines",
  description: "Return medicines whose current quantity is at or below the given threshold (default 10).",
  inputSchema: {
    threshold: z.number().int().min(0).max(1000).optional().describe("Stock threshold. Default 10."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ threshold }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const t = threshold ?? 10;
    const { data, error } = await supabaseForUser(ctx)
      .from("medicines")
      .select("id,name,generic_name,quantity,mrp,sell_price,expiry_date,batch_no")
      .lte("quantity", t)
      .order("quantity", { ascending: true })
      .limit(100);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { threshold: t, medicines: data ?? [] },
    };
  },
});
