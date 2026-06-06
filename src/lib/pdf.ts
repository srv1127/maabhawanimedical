import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { inr, fmtDateTime } from "./format";

export type InvoiceData = {
  invoice_no: string;
  created_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  doctor_name?: string | null;
  payment_method: string;
  subtotal: number; discount: number; tax: number; total: number;
  items: Array<{ name: string; batch?: string | null; qty: number; mrp: number; unit_price: number; gst_percent: number; line_total: number; }>;
};

export function generateInvoicePDF(d: InvoiceData) {
  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const w = doc.internal.pageSize.getWidth();

  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text("PharmaCore", 30, 40);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("Tax Invoice", 30, 56);

  doc.setFontSize(9);
  doc.text(`Invoice: ${d.invoice_no}`, w - 30, 40, { align: "right" });
  doc.text(`Date: ${fmtDateTime(d.created_at)}`, w - 30, 54, { align: "right" });
  doc.text(`Payment: ${d.payment_method.toUpperCase()}`, w - 30, 68, { align: "right" });

  doc.setDrawColor(200); doc.line(30, 82, w - 30, 82);

  doc.setFontSize(9);
  doc.text(`Bill to: ${d.customer_name ?? "Walk-in"}`, 30, 98);
  if (d.customer_phone) doc.text(`Phone: ${d.customer_phone}`, 30, 112);
  if (d.doctor_name) doc.text(`Doctor: ${d.doctor_name}`, 30, 126);

  autoTable(doc, {
    startY: 140,
    head: [["#", "Item", "Batch", "Qty", "Rate", "GST%", "Amount"]],
    body: d.items.map((it, i) => [i + 1, it.name, it.batch ?? "-", it.qty, inr(it.unit_price), `${it.gst_percent}%`, inr(it.line_total)]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [40, 100, 110] },
    margin: { left: 30, right: 30 },
  });

  const y = (doc as any).lastAutoTable.finalY + 14;
  const rx = w - 30;
  doc.setFontSize(9);
  doc.text(`Subtotal: ${inr(d.subtotal)}`, rx, y, { align: "right" });
  doc.text(`Discount: ${inr(d.discount)}`, rx, y + 14, { align: "right" });
  doc.text(`GST: ${inr(d.tax)}`, rx, y + 28, { align: "right" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(`Total: ${inr(d.total)}`, rx, y + 46, { align: "right" });

  doc.setFontSize(7); doc.setFont("helvetica", "italic");
  doc.text("Thank you for your purchase. Goods once sold cannot be returned.", w / 2, doc.internal.pageSize.getHeight() - 20, { align: "center" });

  doc.save(`${d.invoice_no}.pdf`);
}
