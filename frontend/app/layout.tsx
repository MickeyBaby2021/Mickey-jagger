import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mickey Jagger - AI Avatar Platform',
  description: 'Real-time AI avatar call platform for live communication, streaming, and content creation',
  keywords: ['AI', 'avatar', 'real-time', 'face-tracking', 'webcam', 'video-call'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
