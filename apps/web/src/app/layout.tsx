import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Clone — AI Employee Operating System",
  description: "Create AI employees, connect their tools, and let them work. Clone is the operating system for AI employees.",
  keywords: ["AI employees", "AI team", "AI company", "workflow automation", "AI agents"],
  openGraph: {
    title: "Clone — AI Employee Operating System",
    description: "Build a digital team with roles, memory, permissions, and real application access.",
    type: "website",
  },
};

import { AuthProvider } from "@/lib/auth-context";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
