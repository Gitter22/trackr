import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn/ui class helper: merges Tailwind classes, later ones win. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
