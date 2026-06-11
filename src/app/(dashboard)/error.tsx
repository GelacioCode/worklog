"use client"

import Link from "next/link"
import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Dashboard route error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center text-center px-6 py-20">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
        style={{
          background: "rgb(254 226 226 / .55)",
          color: "#a32525",
          boxShadow: "inset 0 0 0 1px rgb(254 202 202)",
        }}
      >
        <AlertTriangle size={22} />
      </div>
      <h1 className="text-[18px] font-semibold">Something broke</h1>
      <p className="text-[13px] text-muted mt-1 max-w-md">
        {error.message ||
          "An unexpected error occurred while loading this page. Refresh to try again, or go back to the dashboard."}
      </p>
      {error.digest && (
        <p className="text-[11px] text-subtle mt-2 font-mono">ref: {error.digest}</p>
      )}
      <div className="flex items-center gap-2 mt-5">
        <button type="button" onClick={reset} className="btn btn-primary">
          <RefreshCw size={13} /> Try again
        </button>
        <Link href="/dashboard" className="btn btn-ghost">
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
