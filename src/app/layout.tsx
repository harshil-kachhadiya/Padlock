import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { KeyProvider } from "@/lib/keyContext";
import { ThemeProvider } from "@/lib/themeContext";
import { SettingsProvider, SettingsSync } from "@/lib/settingsContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Padlock",
  description: "Zero-knowledge encrypted password manager",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>
          <KeyProvider>
            <SettingsProvider>
              <SettingsSync>{children}</SettingsSync>
            </SettingsProvider>
          </KeyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
