import React from "react";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RedisTypeSelectorProps {
  redisType: string;
  redisTypeDescriptions: Readonly<Record<string, string>>;
  onTypeChange: (type: string) => void;
}

const REDIS_TYPE_LABELS: Readonly<Record<string, string>> = {
  node: "redisTypeNode",
  cluster: "redisTypeCluster",
  sentinel: "redisTypeSentinel",
  semantic: "redisTypeSemantic",
};

const RedisTypeSelector: React.FC<RedisTypeSelectorProps> = ({ redisType, redisTypeDescriptions, onTypeChange }) => {
  const t = useTranslations("caching");
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{t("redisTypeLabel")}</label>
      <Select value={redisType} onValueChange={(value) => value !== null && onTypeChange(value)}>
        <SelectTrigger className="w-full">
          <SelectValue>{t(REDIS_TYPE_LABELS[redisType] ?? redisType)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(REDIS_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {t(label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {t(redisTypeDescriptions[redisType] ?? "redisTypeFallback")}
      </p>
    </div>
  );
};

export default RedisTypeSelector;
