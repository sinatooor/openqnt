/**
 * Lucide icon resolver. Keeps component files free of `any` casts.
 */
import * as LucideIcons from 'lucide-react';
import { Bot, type LucideIcon } from 'lucide-react';

export function resolveIcon(name: string | undefined | null): LucideIcon {
  if (!name) return Bot;
  const mod = LucideIcons as unknown as Record<string, unknown>;
  const maybe = mod[name];
  if (typeof maybe === 'function' || typeof maybe === 'object') {
    return maybe as LucideIcon;
  }
  return Bot;
}
