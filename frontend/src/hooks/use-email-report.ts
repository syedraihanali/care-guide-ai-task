import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { plural } from '@/lib/format'

/** Emails a report of all active alerts. Without SMTP the backend uses an Ethereal test inbox and returns a preview link. */
export function useEmailReport() {
  return useMutation({
    mutationFn: api.emailReport,
    onSuccess: (result) => {
      const description = `${plural(result.alerts, 'active alert')} sent to ${result.to}.`
      const { previewUrl } = result
      toast.success('Report emailed', {
        description: previewUrl ? `${description} It went to a test inbox, so open the preview to read it.` : description,
        action: previewUrl
          ? { label: 'Open preview', onClick: () => window.open(previewUrl, '_blank', 'noopener,noreferrer') }
          : undefined,
        duration: previewUrl ? 15_000 : undefined,
      })
    },
    onError: (error) => {
      toast.error("Couldn't send the report", { description: error.message })
    },
  })
}
