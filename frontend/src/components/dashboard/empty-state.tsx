import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  iconClassName?: string
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, iconClassName, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
      <Icon aria-hidden className={cn('size-6 text-muted-foreground', iconClassName)} />
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
