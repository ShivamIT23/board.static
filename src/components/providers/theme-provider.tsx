"use client"

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes"

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    const text = args
      .map((a) => {
        if (typeof a === "string") return a;
        if (a && typeof a === "object") {
          try {
            return JSON.stringify(a);
          } catch {
            return "";
          }
        }
        return "";
      })
      .join(" ");

    if (
      text.includes("Encountered a script tag") ||
      text.includes("Unknown DataChannel error") ||
      text.includes("DataChannel error on")
    ) {
      return;
    }
    orig.apply(console, args);
  };
}

export function ThemeProvider({ 
  children,
  ...props
}: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props} enableColorScheme={false}>
      {children}
    </NextThemesProvider>
  )
}
