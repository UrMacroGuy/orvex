import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import AuthInitializer from "@/components/AuthInitializer";

export const metadata: Metadata = {
  title: "Orvex | Premium Financial Intelligence Workstation",
  description: "Bloomberg Terminal meets Perplexity. Multi-model AI financial analysis and research.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-black text-slate-200 min-h-screen font-[ui-sans-serif]">
        <Providers>
          <AuthInitializer>
            <main className="relative z-10">{children}</main>
          </AuthInitializer>
        </Providers>
        <div className="fixed inset-0 bg-black -z-10" />
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/20 via-black to-black -z-10" />
        <div className="fixed -top-40 -right-40 w-80 h-80 bg-sky-500/10 blur-[128px] rounded-full -z-10" />
        <div className="fixed bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent -z-10" />
      </body>
    </html>
  );
}
