import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge conditional class names and resolve Tailwind conflicts.
 * Used by every UI primitive in components/ui.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
