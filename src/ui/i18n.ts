import en from './en.json' with { type: 'json' }

const strings: Record<string, string> = en

export function t(key: string, params: Record<string, string | number> = {}): string {
  return (strings[key] ?? key).replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => String(params[name] ?? match))
}
