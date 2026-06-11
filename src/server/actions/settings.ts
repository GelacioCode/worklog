"use server"

import { revalidatePath } from "next/cache"
import { eq, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { settings } from "@/lib/db/schema"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/server/auth"
import {
  settingsFormSchema,
  type SettingsFormInput,
  LOGO_ALLOWED_TYPES,
  LOGO_MAX_BYTES,
} from "@/lib/validations/settings"

type ActionResult = { ok: true } | { ok: false; error: string }

const LOGO_BUCKET = "business-logos"

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

function extFor(mime: string): string | null {
  switch (mime) {
    case "image/png":
      return "png"
    case "image/jpeg":
      return "jpg"
    case "image/webp":
      return "webp"
    case "image/svg+xml":
      return "svg"
    default:
      return null
  }
}

export async function saveSettings(
  input: SettingsFormInput,
): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = settingsFormSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const data = parsed.data

  const row = {
    userId: user.id,
    baseCurrency: data.baseCurrency,
    invoiceNumberFormat: data.invoiceNumberFormat,
    defaultPaymentTerms: data.defaultPaymentTerms,
    businessName: emptyToNull(data.businessName),
    businessAddress: emptyToNull(data.businessAddress),
    businessEmail: emptyToNull(data.businessEmail),
    taxId: emptyToNull(data.taxId),
    defaultInvoiceNotes: emptyToNull(data.defaultInvoiceNotes),
  }

  try {
    await db
      .insert(settings)
      .values(row)
      .onConflictDoUpdate({
        target: settings.userId,
        set: {
          baseCurrency: row.baseCurrency,
          invoiceNumberFormat: row.invoiceNumberFormat,
          defaultPaymentTerms: row.defaultPaymentTerms,
          businessName: row.businessName,
          businessAddress: row.businessAddress,
          businessEmail: row.businessEmail,
          taxId: row.taxId,
          defaultInvoiceNotes: row.defaultInvoiceNotes,
          updatedAt: sql`now()`,
        },
      })

    revalidatePath("/settings")
    revalidatePath("/dashboard")
    return { ok: true }
  } catch (err) {
    console.error("saveSettings failed:", err)
    return { ok: false, error: "Could not save settings. Try again." }
  }
}

/**
 * Upload a logo image. Uses the user-scoped Supabase client so storage RLS
 * enforces the `{userId}/...` folder rule.
 */
export async function uploadLogo(formData: FormData): Promise<ActionResult> {
  const user = await requireUser()
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pick an image to upload." }
  }
  if (!(LOGO_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "Use PNG, JPG, WebP, or SVG." }
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, error: "Logo must be under 1 MB." }
  }
  const ext = extFor(file.type)
  if (!ext) return { ok: false, error: "Unsupported image format." }

  // Deterministic filename so re-uploading replaces in-place. Per-user folder
  // matches the storage RLS policy: `{userId}/logo.{ext}`.
  const path = `${user.id}/logo.${ext}`

  try {
    const supabase = await createClient()
    const buffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      })
    if (uploadError) {
      console.error("Storage upload failed:", uploadError)
      return { ok: false, error: "Upload failed: " + uploadError.message }
    }

    // Clean up any other logo extensions the user previously had so we don't
    // leave orphans (PNG → JPG → WebP transitions).
    const { data: existing } = await supabase.storage.from(LOGO_BUCKET).list(user.id)
    if (existing) {
      const stale = existing
        .filter((f) => f.name !== `logo.${ext}` && f.name.startsWith("logo."))
        .map((f) => `${user.id}/${f.name}`)
      if (stale.length > 0) {
        await supabase.storage.from(LOGO_BUCKET).remove(stale)
      }
    }

    // Record the new path. UPSERT so missing settings row gets created.
    await db
      .insert(settings)
      .values({
        userId: user.id,
        logoStoragePath: path,
        baseCurrency: "USD",
        invoiceNumberFormat: "INV-####",
        defaultPaymentTerms: 7,
      })
      .onConflictDoUpdate({
        target: settings.userId,
        set: { logoStoragePath: path, updatedAt: sql`now()` },
      })

    revalidatePath("/settings")
    return { ok: true }
  } catch (err) {
    console.error("uploadLogo failed:", err)
    return { ok: false, error: "Could not upload logo. Try again." }
  }
}

export async function removeLogo(): Promise<ActionResult> {
  const user = await requireUser()
  try {
    const supabase = await createClient()
    // Remove every file in the user's folder (covers all extension variations).
    const { data: existing } = await supabase.storage.from(LOGO_BUCKET).list(user.id)
    if (existing && existing.length > 0) {
      await supabase.storage
        .from(LOGO_BUCKET)
        .remove(existing.map((f) => `${user.id}/${f.name}`))
    }
    await db
      .update(settings)
      .set({ logoStoragePath: null, updatedAt: sql`now()` })
      .where(eq(settings.userId, user.id))

    revalidatePath("/settings")
    return { ok: true }
  } catch (err) {
    console.error("removeLogo failed:", err)
    return { ok: false, error: "Could not remove logo." }
  }
}
