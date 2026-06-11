// GET /api/invoices/[id]/pdf — streams a PDF for the requested invoice.
// Auth-scoped: only the owning user can fetch their own PDF.

import { NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { clients } from "@/lib/db/schema"
import { getInvoiceById } from "@/lib/db/queries/invoices"
import { getSettings } from "@/lib/db/queries/settings"
import { requireUser } from "@/server/auth"
import { createClient } from "@/lib/supabase/server"
import { InvoicePdf } from "@/components/invoices/invoice-pdf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LOGO_BUCKET = "business-logos"

function mimeFromPath(path: string): string {
  const ext = path.toLowerCase().split(".").pop()
  switch (ext) {
    case "png":
      return "image/png"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "webp":
      return "image/webp"
    case "svg":
      return "image/svg+xml"
    default:
      return "application/octet-stream"
  }
}

async function loadLogoDataUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  // react-pdf doesn't render SVG via <Image>; fall back to the letter placeholder.
  if (path.toLowerCase().endsWith(".svg")) return null
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.storage.from(LOGO_BUCKET).download(path)
    if (error || !data) return null
    const buf = Buffer.from(await data.arrayBuffer())
    const mime = mimeFromPath(path)
    return `data:${mime};base64,${buf.toString("base64")}`
  } catch (err) {
    console.error("loadLogoDataUrl failed:", err)
    return null
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const user = await requireUser()
  const url = new URL(req.url)
  const asAttachment = url.searchParams.get("download") === "1"

  const invoice = await getInvoiceById(user.id, id)
  if (!invoice) {
    return new NextResponse("Not found", { status: 404 })
  }

  const [clientRow] = await db
    .select({
      name: clients.name,
      companyName: clients.companyName,
      contactPerson: clients.contactPerson,
      email: clients.email,
    })
    .from(clients)
    .where(and(eq(clients.userId, user.id), eq(clients.id, invoice.clientId)))
    .limit(1)

  if (!clientRow) {
    return new NextResponse("Client not found", { status: 404 })
  }

  const settings = await getSettings(user.id)
  const logoDataUrl = await loadLogoDataUrl(settings.logoStoragePath)

  const buffer = await renderToBuffer(
    InvoicePdf({
      invoice,
      items: invoice.items,
      client: clientRow,
      settings,
      logoDataUrl,
    }),
  )

  const disposition = asAttachment ? "attachment" : "inline"

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
