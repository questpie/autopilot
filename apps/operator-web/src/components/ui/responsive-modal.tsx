import * as React from 'react'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

const ResponsiveModalContext = React.createContext<{ isMobile: boolean } | null>(null)

function useResponsiveModalContext() {
	const context = React.useContext(ResponsiveModalContext)
	if (!context) {
		throw new Error('ResponsiveModal components must be used inside <ResponsiveModal>.')
	}
	return context
}

function ResponsiveModal({ children, ...props }: React.ComponentProps<typeof Dialog>) {
	const isMobile = useIsMobile()
	const Root = isMobile ? Sheet : Dialog

	return (
		<ResponsiveModalContext.Provider value={{ isMobile }}>
			<Root {...props}>{children}</Root>
		</ResponsiveModalContext.Provider>
	)
}

interface ResponsiveModalContentProps {
	children: React.ReactNode
	className?: string
	desktopClassName?: string
	mobileClassName?: string
	mobileSide?: 'top' | 'right' | 'bottom' | 'left'
	showCloseButton?: boolean
}

function ResponsiveModalContent({
	children,
	className,
	desktopClassName,
	mobileClassName,
	mobileSide = 'bottom',
	showCloseButton = true,
}: ResponsiveModalContentProps) {
	const { isMobile } = useResponsiveModalContext()

	if (isMobile) {
		return (
			<SheetContent
				side={mobileSide}
				showCloseButton={showCloseButton}
				className={cn(className, mobileClassName)}
			>
				{children}
			</SheetContent>
		)
	}

	return (
		<DialogContent showCloseButton={showCloseButton} className={cn(className, desktopClassName)}>
			{children}
		</DialogContent>
	)
}

function ResponsiveModalHeader({ children, className, ...props }: React.ComponentProps<'div'>) {
	const { isMobile } = useResponsiveModalContext()
	const Comp = isMobile ? SheetHeader : DialogHeader
	return (
		<Comp className={className} {...props}>
			{children}
		</Comp>
	)
}

function ResponsiveModalFooter({ children, className, ...props }: React.ComponentProps<'div'>) {
	const { isMobile } = useResponsiveModalContext()
	const Comp = isMobile ? SheetFooter : DialogFooter
	return (
		<Comp className={className} {...props}>
			{children}
		</Comp>
	)
}

function ResponsiveModalTitle({ className, ...props }: React.ComponentProps<typeof DialogTitle>) {
	const { isMobile } = useResponsiveModalContext()
	if (isMobile) return <SheetTitle className={className} {...props} />
	return <DialogTitle className={className} {...props} />
}

function ResponsiveModalDescription({ className, ...props }: React.ComponentProps<typeof DialogDescription>) {
	const { isMobile } = useResponsiveModalContext()
	if (isMobile) return <SheetDescription className={className} {...props} />
	return <DialogDescription className={className} {...props} />
}

export {
	ResponsiveModal,
	ResponsiveModalContent,
	ResponsiveModalHeader,
	ResponsiveModalFooter,
	ResponsiveModalTitle,
	ResponsiveModalDescription,
}
