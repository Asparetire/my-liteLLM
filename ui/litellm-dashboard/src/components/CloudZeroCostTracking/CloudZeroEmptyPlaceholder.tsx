import { Button } from "@/components/ui/button";
import { Inbox } from "lucide-react";
import { useTranslations } from "next-intl";

interface CloudZeroEmptyPlaceholderProps {
  startCreation: () => void;
}

export default function CloudZeroEmptyPlaceholder({ startCreation }: CloudZeroEmptyPlaceholderProps) {
  const t = useTranslations("cloudZero");
  return (
    <div className="mx-auto mt-8 max-w-2xl rounded-lg border border-dashed border-border bg-card p-12 text-center">
      <div className="flex flex-col items-center gap-2">
        <Inbox className="size-10 text-muted-foreground" aria-hidden />
        <h4 className="text-base font-semibold">{t("emptyTitle")}</h4>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{t("emptyDesc")}</p>
        <Button size="lg" onClick={startCreation} className="mt-4">
          {t("addIntegration")}
        </Button>
      </div>
    </div>
  );
}
