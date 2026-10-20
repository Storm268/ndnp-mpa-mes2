import type { Metadata, Viewport } from 'next'
import PWARegister from '@/components/PWARegister'
import OfflineBar from '@/components/offline/OfflineBar'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'



export const metadata: Metadata = {
  title: 'NDNP MPA-MES',
  description: 'Marine Protected Area Management & Ecological System — National Designated Natural Park',
  robots: { index: false, follow: false },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NDNP MPA-MES',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png',   sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#00bcd4',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable"          content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title"            content="NDNP MPA-MES" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name"       content="NDNP MPA-MES" />
        <meta name="msapplication-TileColor" content="#020b14" />
        <meta name="msapplication-TileImage" content="/icons/icon-192.png" />
      </head>
      <body style={{ fontFamily: 'var(--font-jakarta), system-ui, sans-serif' }}>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="default"
          enableSystem={false}
          themes={['light', 'dark', 'default']}
        >
          <OfflineBar />
          {children}
          {/* Register service worker + Background Sync listener */}
          <PWARegister />
        </ThemeProvider>
      </body>
    </html>
  )
}

