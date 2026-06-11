// Re-exports lucide-react under the prototype's icon names so JSX from the
// design package translates 1:1.
import {
  LayoutDashboard,
  NotebookText,
  ReceiptText,
  Users,
  FolderKanban,
  CheckCheck,
  KeyRound,
  BarChart3,
  Settings as SettingsIcon,
  Plus,
  Search,
  Bell,
  Filter,
  Calendar,
  List as ListIcon,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  X,
  MoreHorizontal,
  GripVertical,
  Clock,
  TrendingUp,
  TrendingDown,
  Wallet,
  Star,
  Sun,
  Moon,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Inbox,
  Download,
  Tag,
  Command,
  Zap,
  Check,
  type LucideProps,
} from "lucide-react"

function Logo(props: LucideProps) {
  const { size = 16, ...rest } = props
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="M8 12.5l2.8 2.8L16 9.5" />
    </svg>
  )
}

export const Icons = {
  Logo,
  Dashboard: LayoutDashboard,
  Logs: NotebookText,
  Invoice: ReceiptText,
  Users: Users,
  Folder: FolderKanban,
  Check: Check,
  Checks: CheckCheck,
  Lock: KeyRound,
  Chart: BarChart3,
  Settings: SettingsIcon,
  Plus: Plus,
  Search: Search,
  Bell: Bell,
  Filter: Filter,
  Calendar: Calendar,
  List: ListIcon,
  Chevron: ChevronRight,
  ChevronDown: ChevronDown,
  ChevronLeft: ChevronLeft,
  X: X,
  More: MoreHorizontal,
  Drag: GripVertical,
  Clock: Clock,
  TrendUp: TrendingUp,
  TrendDown: TrendingDown,
  Money: Wallet,
  Spark: Star,
  Sun: Sun,
  Moon: Moon,
  AlertCircle: AlertCircle,
  Sparkle: Sparkles,
  Arrow: ArrowRight,
  Inbox: Inbox,
  Download: Download,
  Tag: Tag,
  Command: Command,
  Zap: Zap,
}

export type IconName = keyof typeof Icons
