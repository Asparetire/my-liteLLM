export type Locale = "zh-CN" | "en";

export const LOCALES: readonly Locale[] = ["zh-CN", "en"];

export const DEFAULT_LOCALE: Locale = "zh-CN";

export const LOCALE_STORAGE_KEY = "litellm_locale";

// Labels are shown in their own language so speakers of either locale can find theirs.
export const LOCALE_LABELS: Record<Locale, string> = {
  "zh-CN": "中文（简体）",
  en: "English",
};

export const isLocale = (value: string | null): value is Locale =>
  value !== null && (LOCALES as readonly string[]).includes(value);
