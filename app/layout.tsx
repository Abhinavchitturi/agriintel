import type { Metadata, Viewport } from "next"
import { Inter, Outfit } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
})

export const metadata: Metadata = {
  title: "AgriIntel | AI-Powered Agricultural Intelligence",
  description: "Advanced AI assistant for modern farming. Get real-time crop advice, weather insights, soil analysis, and yield optimization powered by Groq's ultra-fast inference.",
  keywords: ["agriculture", "farming", "AI", "crop advice", "weather", "soil analysis", "yield optimization", "precision farming"],
  authors: [{ name: "AgriIntel Team" }],
  creator: "AgriIntel",
  publisher: "AgriIntel",
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://agriintel.ai",
    title: "AgriIntel | AI-Powered Agricultural Intelligence",
    description: "Advanced AI assistant for modern farming. Get real-time crop advice, weather insights, soil analysis, and yield optimization.",
    siteName: "AgriIntel",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgriIntel | AI-Powered Agricultural Intelligence",
    description: "Advanced AI assistant for modern farming.",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${outfit.variable}`}>
      <head>
        <link rel="preconnect" href="https://api.groq.com" />
        <link rel="dns-prefetch" href="https://api.groq.com" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}