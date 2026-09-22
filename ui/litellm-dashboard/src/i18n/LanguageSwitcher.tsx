"use client";

import { Globe } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { isLocale, LOCALES, LOCALE_LABELS } from "./config";
import { useLocaleState } from "./LocaleProvider";

interface LanguageSwitcherProps {
  collapsed?: boolean;
}

export default function LanguageSwitcher({ collapsed = false }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocaleState();

  if (collapsed) {
    return null;
  }

  return (
    <Select
      items={LOCALES.map((value) => ({ label: LOCALE_LABELS[value], value }))}
      value={locale}
      onValueChange={(value: string | null) => {
        if (isLocale(value)) {
          setLocale(value);
        }
      }}
    >
      <SelectTrigger className="h-8 w-full text-xs" aria-label="切换语言 / Switch language">
        <Globe className="size-3.5 shrink-0 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((value) => (
          <SelectItem key={value} value={value}>
            {LOCALE_LABELS[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
