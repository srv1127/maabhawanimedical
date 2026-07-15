import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMedicines from "./tools/list-medicines";
import lowStock from "./tools/low-stock";
import expiring from "./tools/expiring";
import recentSales from "./tools/recent-sales";
import salesSummary from "./tools/sales-summary";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "maa-bhawani-medical",
  title: "Maa Bhawani Medical",
  version: "0.1.0",
  instructions:
    "Tools for the Maa Bhawani Medical pharmacy inventory & billing app. Search medicines, check low stock and expiring items, and review sales. All calls run as the signed-in staff user under the app's row-level security.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMedicines, lowStock, expiring, recentSales, salesSummary],
});
