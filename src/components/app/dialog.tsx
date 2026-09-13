'use client'

import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { button } from './styles'

/**
 * Atlassian-style modal dialog. Controlled: pass `open` and `onOpenChange`.
 * Modals stay centred, so they scale from the middle (not from the trigger).
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 'md',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  footer: React.ReactNode
  width?: 'sm' | 'md'
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="modal-backdrop fixed inset-0 z-50 bg-[#091E427D] transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <BaseDialog.Popup
          className={`fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-4rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-popover shadow-[0_8px_12px_rgba(9,30,66,0.15),0_0_1px_rgba(9,30,66,0.31)] outline-none transition-[opacity,transform] duration-200 ease-out data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0 ${width === 'sm' ? 'max-w-md' : 'max-w-xl'}`}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-6">
            <BaseDialog.Title className="text-xl leading-7 font-semibold text-foreground">{title}</BaseDialog.Title>
            <BaseDialog.Close aria-label="Close" className={`${button.icon} -mt-0.5 -mr-2`}>
              <X className="size-4" />
            </BaseDialog.Close>
          </div>
          <div className="overflow-y-auto px-6 pt-2 pb-2">
            {description && <BaseDialog.Description className="text-sm text-muted-foreground">{description}</BaseDialog.Description>}
            {children}
          </div>
          <div className="flex justify-end gap-2 px-6 pt-4 pb-6">{footer}</div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}
