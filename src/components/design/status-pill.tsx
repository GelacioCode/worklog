import { cn } from "@/lib/utils"

type Status =
  | "unbilled"
  | "billed"
  | "paid"
  | "draft"
  | "sent"
  | "partial"
  | "overdue"
  | "cancelled"

const LABELS: Record<Status, string> = {
  unbilled: "Unbilled",
  billed: "Billed",
  paid: "Paid",
  draft: "Draft",
  sent: "Sent",
  partial: "Partial",
  overdue: "Overdue",
  cancelled: "Cancelled",
}

const CLASSES: Record<Status, string> = {
  unbilled: "pill-unbilled",
  billed: "pill-billed",
  paid: "pill-paid",
  draft: "pill-draft",
  sent: "pill-sent",
  partial: "pill-partial",
  overdue: "pill-overdue",
  cancelled: "pill-draft",
}

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  return <span className={cn("pill", CLASSES[status], className)}>{LABELS[status]}</span>
}

export type { Status as PillStatus }
