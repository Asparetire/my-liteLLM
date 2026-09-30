"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cva.config";

export const AUTOROUTER_CLASSIFIER_ORIGIN = "autorouter_classifier";

export function ClassifyTag({ origin, className }: { origin?: string | null; className?: string }) {
  const t = useTranslations("logs");
  if (origin !== AUTOROUTER_CLASSIFIER_ORIGIN) return null;
  return (
    <Badge variant="secondary" title={t("classifyTagTitle")} className={cn("px-2 py-0 text-[10px] font-normal", className)}>
      {t("classifyTag")}
    </Badge>
  );
}
