const COLOR_MAP: Record<string, { text: string; dot: string }> = {
  aws:   { text: 'text-indigo-500 dark:text-indigo-400', dot: 'bg-indigo-500 dark:bg-indigo-400' },
  gcp:   { text: 'text-sky-500 dark:text-sky-400',       dot: 'bg-sky-500 dark:bg-sky-400' },
  oci:   { text: 'text-amber-500 dark:text-amber-400',   dot: 'bg-amber-500 dark:bg-amber-400' },
  azure: { text: 'text-red-500 dark:text-red-400',       dot: 'bg-red-500 dark:bg-red-400' },
}

const FALLBACK = { text: 'text-slate-500 dark:text-slate-400', dot: 'bg-slate-400 dark:bg-slate-500' }

export function providerTextClass(provider: string): string {
  return (COLOR_MAP[provider.toLowerCase()] ?? FALLBACK).text
}

export function providerDotClass(provider: string): string {
  return (COLOR_MAP[provider.toLowerCase()] ?? FALLBACK).dot
}
