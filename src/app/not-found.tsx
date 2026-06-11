import Link from "next/link"
import { Search } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div
          className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-4"
          style={{ background: "var(--surface-2)" }}
        >
          <Search size={20} className="text-subtle" />
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight">Not found</h1>
        <p className="text-[13.5px] text-muted mt-1">
          The page you&apos;re looking for doesn&apos;t exist, or it belongs to a
          different account.
        </p>
        <Link href="/dashboard" className="btn btn-primary mt-5 mx-auto">
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
