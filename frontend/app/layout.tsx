import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NexusFlow Orchestrator",
  description:
    "Enterprise-grade multi-tenant Agentic AI Orchestration Interface for ASEAN SMEs. Real-time multi-agent workflow management with Human-in-the-Loop gating.",
  keywords: ["AI orchestration", "LangGraph", "HITL", "ASEAN", "SME", "workflow automation"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-100`}
      >
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
