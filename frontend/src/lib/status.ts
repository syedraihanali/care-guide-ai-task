import { CircleCheckIcon, OctagonAlertIcon, TriangleAlertIcon, type LucideIcon } from 'lucide-react'
import type { CheckSeverity } from '@/types'

interface StatusStyle {
  label: string
  /** Each status has its own icon shape, so it never depends on colour alone. */
  icon: LucideIcon
  iconClass: string
  /** Tinted panel, for the status banner. */
  surfaceClass: string
  /** Left edge of an alert card. */
  edgeClass: string
}

export const STATUS: Record<CheckSeverity, StatusStyle> = {
  healthy: {
    label: 'Healthy',
    icon: CircleCheckIcon,
    iconClass: 'text-healthy',
    surfaceClass: 'border-healthy/30 bg-healthy/[0.06]',
    edgeClass: 'border-l-healthy',
  },
  warning: {
    label: 'Warning',
    icon: TriangleAlertIcon,
    iconClass: 'text-warning',
    surfaceClass: 'border-warning/40 bg-warning/[0.08]',
    edgeClass: 'border-l-warning',
  },
  critical: {
    label: 'Critical',
    icon: OctagonAlertIcon,
    iconClass: 'text-critical',
    surfaceClass: 'border-critical/30 bg-critical/[0.06]',
    edgeClass: 'border-l-critical',
  },
}
