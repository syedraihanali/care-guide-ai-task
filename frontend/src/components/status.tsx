import { Badge } from '@/components/ui/badge'
import { STATUS } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { CheckSeverity } from '@/types'

export function StatusIcon({ severity, className }: { severity: CheckSeverity; className?: string }) {
  const { icon: Icon, iconClass } = STATUS[severity]
  return <Icon aria-hidden className={cn('size-4 shrink-0', iconClass, className)} />
}

export function SeverityBadge({ severity }: { severity: CheckSeverity }) {
  return (
    <Badge variant="outline" className="pl-1.5">
      <StatusIcon severity={severity} />
      {STATUS[severity].label}
    </Badge>
  )
}
