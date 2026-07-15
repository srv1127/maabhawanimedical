import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_medicines",
  title: "List / search medicines",
  description:
    "Search the pharmacy inventory. Optional query matches name, generic name, or barcode. Returns up to `limit` medicines with stock, MRP, and sell price.",
  inputSchema: {
    query: z.string().optional().describe("Optional search text matched against name/generic/barcode."),
    limit: z.number().int().min(1).max(100).optional().describe("Max results (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("medicines")
      .select("id,name,generic_name,barcode,batch_no,expiry_date,quantity,mrp,sell_price,purchase_price,gst_rate,location")
      .limit(limit ?? 25);
    if (query && query.trim()) {
      const term = `%${query.trim()}%`;
      q = q.or(`name.ilike.${term},generic_name.ilike.${term},barcode.ilike.${term}`);
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { medicines: data ?? [] },
    };
  },
});
