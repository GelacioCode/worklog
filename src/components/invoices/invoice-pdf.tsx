// React-PDF invoice template. Server-rendered via @react-pdf/renderer.
// Uses built-in Helvetica (no font registration needed for MVP).

import {
  Document,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"
import type { Invoice, InvoiceItem } from "@/lib/db/schema"
import type { ResolvedSettings } from "@/lib/db/queries/settings"
import { formatMoney } from "@/lib/money"

type PdfClient = {
  name: string
  companyName: string | null
  contactPerson: string | null
  email: string | null
}

export type InvoicePdfProps = {
  invoice: Invoice
  items: InvoiceItem[]
  client: PdfClient
  settings: ResolvedSettings
  // Data URL (e.g. "data:image/png;base64,…") so react-pdf can embed without
  // making a network call from the worker.
  logoDataUrl?: string | null
}

const accent = "#8a46dc" // violet brand color
const ink = "#1a1a19"
const muted = "#6b6b67"
const subtle = "#9a9a95"
const border = "#ececea"
const surface2 = "#f5f5f4"

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: ink,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoSquare: {
    width: 32,
    height: 32,
    backgroundColor: accent,
    borderRadius: 6,
    color: "#fff",
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    textAlign: "center",
    paddingTop: 8,
  },
  logoImage: {
    width: 40,
    height: 40,
    objectFit: "contain",
  },
  bizName: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  bizMeta: { color: muted, fontSize: 9, marginTop: 2 },
  invoiceMeta: { textAlign: "right" },
  invoiceTitle: {
    fontSize: 9,
    color: subtle,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  invoiceNumber: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
  },
  invoiceDates: { color: muted, fontSize: 9, marginTop: 4 },

  band: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  bandLabel: {
    fontSize: 9,
    color: subtle,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  bandValue: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  bandSub: { color: muted, fontSize: 9, marginTop: 1 },

  itemsHeader: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: surface2,
    fontSize: 8.5,
    color: subtle,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 18,
  },
  colDesc: { flex: 1, paddingRight: 6 },
  colQty: { width: 48, textAlign: "right" },
  colPrice: { width: 80, textAlign: "right" },
  colAmt: { width: 84, textAlign: "right" },

  itemRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: border,
    fontSize: 10,
  },
  itemDesc: { fontFamily: "Helvetica-Bold" },
  itemSub: { color: subtle, fontSize: 8.5, marginTop: 1 },

  totals: {
    marginTop: 16,
    marginLeft: "auto",
    width: 260,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    fontSize: 10,
  },
  totalRowMuted: { color: muted },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: border,
  },
  grandLabel: {
    fontSize: 9,
    color: subtle,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    paddingTop: 5,
  },
  grandValue: { fontSize: 16, fontFamily: "Helvetica-Bold" },

  notes: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: border,
  },
  notesLabel: {
    fontSize: 9,
    color: subtle,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  notesText: {
    fontFamily: "Helvetica-Oblique",
    color: muted,
    fontSize: 9.5,
  },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    color: subtle,
    fontSize: 8,
  },
})

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function unitLabel(unit: string, workLogId: string | null) {
  if (unit === "hours") return "Hourly"
  return workLogId ? "Work log" : "Manual"
}

export function InvoicePdf({
  invoice,
  items,
  client,
  settings,
  logoDataUrl,
}: InvoicePdfProps) {
  const periodLabel =
    invoice.periodStart && invoice.periodEnd
      ? `${fmtDate(invoice.periodStart)} – ${fmtDate(invoice.periodEnd)}`
      : "—"

  return (
    <Document
      title={invoice.invoiceNumber}
      author={settings.businessName}
      subject={`Invoice ${invoice.invoiceNumber} · ${client.name}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Header band */}
        <View style={styles.header}>
          <View style={styles.brand}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.logoImage} />
            ) : (
              <Text style={styles.logoSquare}>
                {settings.businessName.slice(0, 1).toUpperCase() || "W"}
              </Text>
            )}
            <View>
              <Text style={styles.bizName}>{settings.businessName}</Text>
              {settings.businessEmail !== "" && (
                <Text style={styles.bizMeta}>{settings.businessEmail}</Text>
              )}
              {settings.businessAddress !== "" && (
                <Text style={styles.bizMeta}>{settings.businessAddress}</Text>
              )}
              {settings.taxId !== "" && (
                <Text style={styles.bizMeta}>Tax ID: {settings.taxId}</Text>
              )}
            </View>
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.invoiceTitle}>Invoice</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
            <Text style={styles.invoiceDates}>
              Issued {fmtDate(invoice.issuedDate)}
            </Text>
            <Text style={styles.invoiceDates}>Due {fmtDate(invoice.dueDate)}</Text>
            <Text style={[styles.invoiceDates, { textTransform: "uppercase" }]}>
              {String(invoice.status)}
            </Text>
          </View>
        </View>

        {/* Bill-to / period band */}
        <View style={styles.band}>
          <View>
            <Text style={styles.bandLabel}>Bill to</Text>
            <Text style={styles.bandValue}>{client.name}</Text>
            {client.companyName && (
              <Text style={styles.bandSub}>{client.companyName}</Text>
            )}
            {client.contactPerson && (
              <Text style={styles.bandSub}>Attn: {client.contactPerson}</Text>
            )}
            {client.email && <Text style={styles.bandSub}>{client.email}</Text>}
          </View>
          <View>
            <Text style={styles.bandLabel}>Period</Text>
            <Text style={styles.bandValue}>{periodLabel}</Text>
            <Text style={styles.bandSub}>Currency: {invoice.currency}</Text>
          </View>
        </View>

        {/* Line items */}
        <View style={styles.itemsHeader}>
          <Text style={styles.colDesc}>Description</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colPrice}>Unit price</Text>
          <Text style={styles.colAmt}>Amount ({invoice.currency})</Text>
        </View>

        {items.length === 0 ? (
          <View
            style={{
              paddingVertical: 16,
              alignItems: "center",
            }}
          >
            <Text style={{ color: subtle }}>No line items</Text>
          </View>
        ) : (
          items.map((item) => {
            const qtyLabel = `${Number(item.quantity).toFixed(2)}${
              item.unit === "hours" ? "h" : ""
            }`
            return (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.colDesc}>
                  <Text style={styles.itemDesc}>{item.description}</Text>
                  <Text style={styles.itemSub}>
                    {unitLabel(item.unit, item.workLogId)}
                  </Text>
                </View>
                <Text style={styles.colQty}>{qtyLabel}</Text>
                <Text style={styles.colPrice}>
                  {formatMoney(item.unitPriceCents, invoice.currency)}
                </Text>
                <Text style={styles.colAmt}>
                  {formatMoney(item.amountCents, invoice.currency)}
                </Text>
              </View>
            )
          })
        )}

        {/* Totals stack */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{formatMoney(invoice.subtotalCents, invoice.currency)}</Text>
          </View>
          {invoice.discountCents > 0 && (
            <View style={[styles.totalRow, styles.totalRowMuted]}>
              <Text>Discount</Text>
              <Text>−{formatMoney(invoice.discountCents, invoice.currency)}</Text>
            </View>
          )}
          {invoice.taxCents > 0 && (
            <View style={[styles.totalRow, styles.totalRowMuted]}>
              <Text>Tax</Text>
              <Text>+{formatMoney(invoice.taxCents, invoice.currency)}</Text>
            </View>
          )}
          {invoice.expensesCents > 0 && (
            <View style={[styles.totalRow, styles.totalRowMuted]}>
              <Text>Expenses</Text>
              <Text>+{formatMoney(invoice.expensesCents, invoice.currency)}</Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandValue}>
              {formatMoney(invoice.totalCents, invoice.currency)}
            </Text>
          </View>
          {invoice.amountPaidCents > 0 && (
            <>
              <View style={[styles.totalRow, styles.totalRowMuted, { marginTop: 6 }]}>
                <Text>Paid</Text>
                <Text>
                  −{formatMoney(invoice.amountPaidCents, invoice.currency)}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text>Outstanding</Text>
                <Text>
                  {formatMoney(
                    invoice.totalCents - invoice.amountPaidCents,
                    invoice.currency,
                  )}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Generated by Worklog</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}
