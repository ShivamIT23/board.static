"use client"

import * as React from "react"
import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

export default function ThemeToggle({ cn, iconSize }: { cn?: string; iconSize?: number }) {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={`h-9 w-9 rounded-full border border-zinc-700 bg-zinc-800 ${cn}`} />
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      className={`h-9 w-9 rounded-full border border-border bg-card flex items-center justify-center cursor-pointer hover:bg-muted transition-colors ${cn}`}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title="Toggle theme"
    >
      {isDark ? (
        <SunIcon size={iconSize || 20} className="text-amber-400" />
      ) : (
        <MoonIcon size={iconSize || 20} className="text-indigo-600" />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
