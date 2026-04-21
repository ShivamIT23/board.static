import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getContrastColor(hex: string): string {
  if (!hex || hex === "transparent") return "inherit"
  
  // Remove hash if present
  const color = hex.startsWith("#") ? hex.slice(1) : hex
  
  // Handle 3-digit hex
  let r, g, b
  if (color.length === 3) {
    r = parseInt(color[0] + color[0], 16)
    g = parseInt(color[1] + color[1], 16)
    b = parseInt(color[2] + color[2], 16)
  } else {
    r = parseInt(color.slice(0, 2), 16)
    g = parseInt(color.slice(2, 4), 16)
    b = parseInt(color.slice(4, 6), 16)
  }
  
  // Using relative luminance formula
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luma > 0.5 ? "#000000" : "#FFFFFF"
}
