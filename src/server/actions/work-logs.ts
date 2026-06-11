"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { workLogs } from "@/lib/db/schema"
import { requireUser } from "@/server/auth"
import { assertClientOwned } from "@/lib/db/queries/work-logs"
import {
  quickAddSchema,
  workLogFormSchema,
  type QuickAddInput,
  type WorkLogFormInput,
} from "@/lib/validations/work-logs"

type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

export async function quickAddWorkLog(input: QuickAddInput): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = quickAddSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const data = parsed.data

  try {
    await assertClientOwned(user.id, data.clientId)
  } catch {
    return { ok: false, error: "Client not found" }
  }

  try {
    const [inserted] = await db
      .insert(workLogs)
      .values({
        userId: user.id,
        clientId: data.clientId,
        title: data.title,
        workDate: data.workDate,
        durationMinutes: Math.round(data.hours * 60),
        tag: emptyToNull(data.tag),
        billable: data.billable,
      })
      .returning({ id: workLogs.id })

    revalidatePath("/work-logs")
    revalidatePath("/dashboard")
    return { ok: true, id: inserted.id }
  } catch (err) {
    console.error("quickAddWorkLog failed:", err)
    return { ok: false, error: "Could not save log. Try again." }
  }
}

export async function updateWorkLog(
  workLogId: string,
  input: WorkLogFormInput,
): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = workLogFormSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const data = parsed.data

  try {
    await assertClientOwned(user.id, data.clientId)
  } catch {
    return { ok: false, error: "Client not found" }
  }

  try {
    const result = await db
      .update(workLogs)
      .set({
        clientId: data.clientId,
        title: data.title,
        description: emptyToNull(data.description),
        notes: emptyToNull(data.notes),
        workDate: data.workDate,
        durationMinutes: Math.round(data.hours * 60),
        tag: emptyToNull(data.tag),
        billable: data.billable,
      })
      .where(and(eq(workLogs.userId, user.id), eq(workLogs.id, workLogId)))
      .returning({ id: workLogs.id, invoiceStatus: workLogs.invoiceStatus })

    if (result.length === 0) {
      return { ok: false, error: "Log not found" }
    }
    if (result[0].invoiceStatus !== "unbilled") {
      // Allow editing but warn? For MVP, only unbilled are editable from the sheet UI.
      // Server still permits it for flexibility.
    }
    revalidatePath("/work-logs")
    revalidatePath("/dashboard")
    return { ok: true, id: workLogId }
  } catch (err) {
    console.error("updateWorkLog failed:", err)
    return { ok: false, error: "Could not update log. Try again." }
  }
}

export async function deleteWorkLog(workLogId: string): Promise<ActionResult> {
  const user = await requireUser()
  try {
    const existing = await db
      .select({ status: workLogs.invoiceStatus })
      .from(workLogs)
      .where(and(eq(workLogs.userId, user.id), eq(workLogs.id, workLogId)))
      .limit(1)

    if (existing.length === 0) {
      return { ok: false, error: "Log not found" }
    }
    if (existing[0].status !== "unbilled") {
      return {
        ok: false,
        error: "Already attached to an invoice. Delete the invoice first, or just edit the log.",
      }
    }

    await db
      .delete(workLogs)
      .where(and(eq(workLogs.userId, user.id), eq(workLogs.id, workLogId)))

    revalidatePath("/work-logs")
    revalidatePath("/dashboard")
    return { ok: true, id: workLogId }
  } catch (err) {
    console.error("deleteWorkLog failed:", err)
    return { ok: false, error: "Could not delete log. Try again." }
  }
}
