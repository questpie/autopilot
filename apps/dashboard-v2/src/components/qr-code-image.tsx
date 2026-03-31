import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

interface QrCodeImageProps {
	value: string
	size?: number
	alt?: string
}

export function QrCodeImage({ value, size = 180, alt = 'QR code' }: QrCodeImageProps) {
	const [src, setSrc] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false

		void QRCode.toDataURL(value, {
			width: size,
			margin: 1,
		}).then((dataUrl) => {
			if (!cancelled) setSrc(dataUrl)
		})

		return () => {
			cancelled = true
		}
	}, [size, value])

	if (!src) {
		return <div className="size-[180px] animate-pulse border border-border bg-muted/40" />
	}

	return <img src={src} alt={alt} width={size} height={size} className="block" />
}
