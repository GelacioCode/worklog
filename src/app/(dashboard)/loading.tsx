export default function DashboardRouteLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="skeleton h-7 w-40" />
          <div className="skeleton h-4 w-72 mt-2" />
        </div>
        <div className="skeleton h-8 w-32" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-7 w-32 mt-3" />
            <div className="skeleton h-3 w-28 mt-2" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-7 w-7 rounded-lg" />
            </div>
            <div className="skeleton h-44 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
