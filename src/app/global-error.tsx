"use client";

import { AlertCircle, RefreshCcw } from "lucide-react";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-white dark:bg-black font-sans antialiased flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-red-100 dark:bg-red-900/20 rounded-2xl">
              <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-500" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Critical System Error
          </h1>
          
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">
            A critical error occurred in the application foundation. Please try refreshing the page.
          </p>

          <button
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-xl hover:opacity-90 transition-all active:scale-95"
          >
            <RefreshCcw className="w-5 h-5" />
            Refresh Application
          </button>
        </div>
      </body>
    </html>
  );
}
