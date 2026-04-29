import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";

const geistSans = localFont({
  src: "../node_modules/geist/dist/fonts/geist-sans/Geist-Regular.woff2",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "../node_modules/geist/dist/fonts/geist-mono/GeistMono-Regular.woff2",
  variable: "--font-geist-mono",
});

const jetbrainsMono = localFont({
  src: "../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "bong",
  description: "catch bongs on your friends",
  openGraph: {
    title: "bong",
    description: "catch bongs on your friends",
    url: "https://catchbong.com",
    siteName: "bong",
    images: [{ url: "https://catchbong.com/catch-bong-logo.png" }],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-mono", jetbrainsMono.variable)}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
