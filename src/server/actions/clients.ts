"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { clients } from "@/lib/db/schema"
import { requireUser } from "@/server/auth"
import {
  clientFormSchema,
  type ClientFormInput,
  type CutoffScheduleJson,
} from "@/lib/validations/clients"
import { toCents } from "@/lib/money"

type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

function toRowFromForm(input: ClientFormInput, userId: string) {
  const cutoff: CutoffScheduleJson = { preset: input.cutoffPreset }

  const hourlyRateCents =
    input.hourlyRate && input.hourlyRate.trim() !== ""
      ? toCents(input.hourlyRate)
      : null
  const monthlySalaryCents =
    input.monthlySalary && input.monthlySalary.trim() !== ""
      ? toCents(input.monthlySalary)
      : null

  return {
    userId,
    name: input.name.trim(),
    companyName: emptyToNull(input.companyName),
    contactPerson: emptyToNull(input.contactPerson),
    email: emptyToNull(input.email),
    timezone: input.timezone,
    workType: emptyToNull(input.workType),
    status: input.status,
    billingType: input.billingType,
    hourlyRateCents,
    monthlySalaryCents,
    currency: input.currency,
    cutoffSchedule: cutoff,
    paymentTermsDays: input.paymentTermsDays,
    defaultInvoiceNotes: emptyToNull(input.defaultInvoiceNotes),
    contractStart: emptyToNull(input.contractStart),
    contractEnd: emptyToNull(input.contractEnd),
  }
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

export async function createClient(input: ClientFormInput): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = clientFormSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const row = toRowFromForm(parsed.data, user.id)
  try {
    const [inserted] = await db
      .insert(clients)
      .values(row)
      .returning({ id: clients.id })
    revalidatePath("/clients")
    revalidatePath("/dashboard")
    return { ok: true, id: inserted.id }
  } catch (err) {
    console.error("createClient failed:", err)
    return { ok: false, error: "Could not create client. Try again." }
  }
}

export async function updateClient(
  clientId: string,
  input: ClientFormInput,
): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = clientFormSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const row = toRowFromForm(parsed.data, user.id)
  try {
    const result = await db
      .update(clients)
      .set(row)
      .where(and(eq(clients.userId, user.id), eq(clients.id, clientId)))
      .returning({ id: clients.id })

    if (result.length === 0) {
      return { ok: false, error: "Client not found" }
    }
    revalidatePath("/clients")
    revalidatePath(`/clients/${clientId}`)
    revalidatePath("/dashboard")
    return { ok: true, id: clientId }
  } catch (err) {
    console.error("updateClient failed:", err)
    return { ok: false, error: "Could not update client. Try again." }
  }
}

export async function setClientStatus(
  clientId: string,
  status: "active" | "paused" | "ended",
): Promise<ActionResult> {
  const user = await requireUser()
  try {
    const result = await db
      .update(clients)
      .set({ status })
      .where(and(eq(clients.userId, user.id), eq(clients.id, clientId)))
      .returning({ id: clients.id })

    if (result.length === 0) {
      return { ok: false, error: "Client not found" }
    }
    revalidatePath("/clients")
    revalidatePath(`/clients/${clientId}`)
    return { ok: true, id: clientId }
  } catch (err) {
    console.error("setClientStatus failed:", err)
    return { ok: false, error: "Could not update status." }
  }
}

export async function deleteClient(clientId: string): Promise<ActionResult> {
  const user = await requireUser()
  try {
    const result = await db
      .delete(clients)
      .where(and(eq(clients.userId, user.id), eq(clients.id, clientId)))
      .returning({ id: clients.id })

    if (result.length === 0) {
      return { ok: false, error: "Client not found" }
    }
    revalidatePath("/clients")
    revalidatePath("/dashboard")
    return { ok: true, id: clientId }
  } catch (err) {
    console.error("deleteClient failed:", err)
    // Likely the client has work logs or invoices referencing it (ON DELETE RESTRICT).
    return {
      ok: false,
      error:
        "Cannot delete: this client still has work logs or invoices. Archive (set to Ended) instead.",
    }
  }
}

// Convenience for "archive" semantic — used by the row menu / detail page.
export async function archiveClientAction(formData: FormData) {
  const id = String(formData.get("id") ?? "")
  if (!id) return
  await setClientStatus(id, "ended")
}

export async function deleteClientAction(formData: FormData) {
  const id = String(formData.get("id") ?? "")
  if (!id) return
  await deleteClient(id)
  redirect("/clients")
}
