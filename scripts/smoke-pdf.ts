// Smoke test for the InvoicePdf renderer.
// Creates a test invoice in memory (no DB write), renders it via renderToBuffer,
// verifies the output is a valid PDF (starts with %PDF-), and writes it to disk
// for manual inspection.
//
// Run with: tsx scripts/smoke-pdf.ts
import { writeFileSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"
import { renderToBuffer } from "@react-pdf/renderer"
import { InvoicePdf } from "../src/components/invoices/invoice-pdf"
import type { Invoice, InvoiceItem } from "../src/lib/db/schema"
import type { ResolvedSettings } from "../src/lib/db/queries/settings"

const settings: ResolvedSettings = {
  userId: "00000000-0000-0000-0000-000000000000",
  baseCurrency: "USD",
  invoiceNumberFormat: "INV-####",
  defaultPaymentTerms: 7,
  businessName: "Worklog Studio",
  businessAddress: "Quezon City, Philippines",
  businessEmail: "hello@worklog.app",
  taxId: "PH-001-234-567",
  logoStoragePath: null,
  defaultInvoiceNotes: "",
  updatedAt: new Date(),
}

const invoice: Invoice = {
  id: "11111111-1111-1111-1111-111111111111",
  userId: "00000000-0000-0000-0000-000000000000",
  clientId: "22222222-2222-2222-2222-222222222222",
  invoiceNumber: "INV-0042",
  status: "sent",
  periodStart: "2026-05-01",
  periodEnd: "2026-05-15",
  issuedDate: "2026-05-16",
  dueDate: "2026-05-23",
  currency: "USD",
  subtotalCents: 22500,
  discountCents: 2250,
  taxCents: 2430,
  expensesCents: 2500,
  totalCents: 25180,
  amountPaidCents: 0,
  notes: "Bank: BPI · Account: 1234 · Wise email: hello@worklog.app",
  rateSnapshotCents: 5000,
  pdfStoragePath: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const items: InvoiceItem[] = [
  {
    id: "a1",
    userId: invoice.userId,
    invoiceId: invoice.id,
    workLogId: "log-1",
    description: "Build sign-up flow",
    quantity: "2.00",
    unit: "hours",
    unitPriceCents: 5000,
    amountCents: 10000,
    createdAt: new Date(),
  },
  {
    id: "a2",
    userId: invoice.userId,
    invoiceId: invoice.id,
    workLogId: "log-2",
    description: "Pair with backend on API contracts",
    quantity: "1.50",
    unit: "hours",
    unitPriceCents: 5000,
    amountCents: 7500,
    createdAt: new Date(),
  },
  {
    id: "a3",
    userId: invoice.userId,
    invoiceId: invoice.id,
    workLogId: "log-3",
    description: "Bug fix: validation regressions",
    quantity: "1.00",
    unit: "hours",
    unitPriceCents: 5000,
    amountCents: 5000,
    createdAt: new Date(),
  },
  {
    id: "a4",
    userId: invoice.userId,
    invoiceId: invoice.id,
    workLogId: null,
    description: "Hosting reimbursement",
    quantity: "1.00",
    unit: "flat",
    unitPriceCents: 2500,
    amountCents: 2500,
    createdAt: new Date(),
  },
]

const client = {
  name: "Acme Corp",
  companyName: "Acme Corporation Pty Ltd",
  contactPerson: "Jane Doe",
  email: "billing@acme.com",
}

async function main() {
  console.log("▸ Rendering test invoice to PDF (no logo, fallback letter tile)…")
  const buffer = await renderToBuffer(
    InvoicePdf({ invoice, items, client, settings }),
  )

  const isPdf = buffer.subarray(0, 4).toString("ascii") === "%PDF"
  console.log(`  bytes: ${buffer.length.toLocaleString()}`)
  console.log(`  starts with %PDF: ${isPdf}`)
  if (!isPdf) {
    console.error("✗ Output doesn't start with %PDF magic — render is broken")
    process.exit(1)
  }

  const outDir = resolve(process.cwd(), "tmp")
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, "smoke-invoice.pdf")
  writeFileSync(outPath, buffer)
  console.log(`\n✓ PDF written: ${outPath}`)
  console.log("  Open it in your browser to eyeball the layout.")
}

main().catch((err) => {
  console.error("\n✗ PDF smoke test failed:", err)
  process.exit(1)
})
