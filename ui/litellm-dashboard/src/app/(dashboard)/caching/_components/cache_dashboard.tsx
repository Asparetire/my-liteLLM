import type { DateRangePickerValue } from "@/components/shared/date_picker_types";
import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import AdvancedDatePicker from "@/components/shared/advanced_date_picker";
import { BarChart } from "@/components/shared/charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { RefreshCw } from "lucide-react";
import { cachingHealthCheckCall } from "@/components/networking";
import { useCacheActivity, type CacheActivityGroup } from "@/app/(dashboard)/hooks/caching/useCacheActivity";

// Import the new component
import { CacheHealthTab } from "./cache_health";
import CacheSettings from "./cache_settings";
import CoordinationRedisSettings from "./coordination_redis_settings";
import { ErrorDrilldownCard } from "./ErrorDrilldown";

const REQUEST_SERIES = {
  apiRequests: "seriesApiRequests",
  cacheHits: "seriesCacheHits",
  failed: "seriesFailed",
  cachedTokens: "seriesCachedTokens",
  generatedTokens: "seriesGeneratedTokens",
} as const;

const UNKNOWN_CALL_TYPE = "Unknown";

const formatDateWithoutTZ = (date: Date | undefined) => {
  if (!date) return undefined;
  return date.toISOString().split("T")[0];
};

const resolveDrilldownCallType = (selected: string | null, groups: readonly CacheActivityGroup[]): string | null =>
  selected !== null && groups.some((group) => group.call_type === selected && group.failed_requests > 0)
    ? selected
    : null;

function valueFormatterNumbers(number: number) {
  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    notation: "compact",
    compactDisplay: "short",
  });

  return formatter.format(number);
}

interface CachePageProps {
  accessToken: string | null;
  token: string | null;
  userRole: string | null;
  userID: string | null;
  premiumUser: boolean;
}

// Helper function to deep-parse a JSON string if possible

const CacheDashboard: React.FC<CachePageProps> = ({ accessToken, token, userRole, userID, premiumUser }) => {
  const t = useTranslations("caching");
  const anchor1 = useComboboxAnchor();
  const anchor2 = useComboboxAnchor();
  const [selectedApiKeys, setSelectedApiKeys] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [errorDrilldownCallType, setErrorDrilldownCallType] = useState<string | null>(null);

  const [dateValue, setDateValue] = useState<DateRangePickerValue>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });

  const [lastRefreshed, setLastRefreshed] = useState("");
  const [healthCheckResponse, setHealthCheckResponse] = useState<any>("");

  const { data: activity, refetch } = useCacheActivity({
    startDate: formatDateWithoutTZ(dateValue.from),
    endDate: formatDateWithoutTZ(dateValue.to),
    keyAliases: selectedApiKeys,
    models: selectedModels,
  });

  useEffect(() => {
    setLastRefreshed(new Date().toLocaleString());
  }, []);

  const uniqueApiKeys = activity?.filter_options.key_aliases ?? [];
  const uniqueModels = activity?.filter_options.models ?? [];
  const chartData = (activity?.groups ?? []).map((group: CacheActivityGroup) => ({
    name: group.call_type,
    [t(REQUEST_SERIES.apiRequests)]: group.api_requests,
    [t(REQUEST_SERIES.cacheHits)]: group.cache_hits,
    [t(REQUEST_SERIES.failed)]: group.failed_requests,
    [t(REQUEST_SERIES.cachedTokens)]: group.cached_completion_tokens,
    [t(REQUEST_SERIES.generatedTokens)]: group.generated_completion_tokens,
  }));
  const hasUnknownGroup = (activity?.groups ?? []).some((group) => group.call_type === UNKNOWN_CALL_TYPE);
  const activeDrilldownCallType = resolveDrilldownCallType(errorDrilldownCallType, activity?.groups ?? []);

  const handleRefreshClick = () => {
    refetch();
    setLastRefreshed(new Date().toLocaleString());
  };

  const runCachingHealthCheck = async () => {
    try {
      toast.info(t("toastHealthCheckRunning"));
      setHealthCheckResponse("");
      const response = await cachingHealthCheckCall(accessToken !== null ? accessToken : "");
      setHealthCheckResponse(response);
    } catch (error: any) {
      console.error("Error running health check:", error);
      let errorData;
      if (error && error.message) {
        try {
          // Parse the error message which may contain a nested error layer.
          let parsedData = JSON.parse(error.message);
          // If the parsed object is wrapped (e.g. { error: { ... } }), unwrap it.
          if (parsedData.error) {
            parsedData = parsedData.error;
          }
          errorData = parsedData;
        } catch (e) {
          errorData = { message: error.message };
        }
      } else {
        errorData = { message: t("unknownError") };
      }
      setHealthCheckResponse({ error: errorData });
    }
  };

  const totals = activity?.totals;
  const hasRequests = totals != null && totals.api_requests + totals.cache_hits + totals.failed_requests > 0;
  const statCards = [
    { label: t("statCacheHitRatio"), value: `${hasRequests ? totals.cache_hit_ratio.toFixed(2) : "0"}%` },
    { label: t("seriesCacheHits"), value: valueFormatterNumbers(totals?.cache_hits ?? 0) },
    { label: t("seriesCachedTokens"), value: valueFormatterNumbers(totals?.cached_completion_tokens ?? 0) },
  ];

  return (
    <Tabs defaultValue="analytics" className="mt-2 mb-8 w-full gap-2 p-8">
      <div className="mt-2 flex w-full items-center justify-between border-b">
        <TabsList variant="line" className="h-auto rounded-none p-0">
          <TabsTrigger value="analytics" className="flex-none rounded-none px-4 py-2">
            {t("tabAnalytics")}
          </TabsTrigger>
          <TabsTrigger value="health" className="flex-none rounded-none px-4 py-2">
            {t("tabHealth")}
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex-none rounded-none px-4 py-2">
            {t("tabSettings")}
          </TabsTrigger>
          <TabsTrigger value="coordination" className="flex-none rounded-none px-4 py-2">
            {t("tabCoordination")}
          </TabsTrigger>
        </TabsList>

        <div className="flex items-center space-x-2">
          {lastRefreshed && <p className="text-sm text-muted-foreground">{t("lastRefreshed", { time: lastRefreshed })}</p>}
          <Button variant="outline" size="icon-sm" onClick={handleRefreshClick} aria-label={t("refresh")}>
            <RefreshCw />
          </Button>
        </div>
      </div>

      <TabsContent value="analytics" keepMounted>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("descIntro")}
              <a
                href="https://docs.litellm.ai/docs/proxy/caching"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {t("descLinkResponseCache")}
              </a>{" "}
              {t("descMid")}
              <a
                href="https://docs.litellm.ai/docs/completion/prompt_caching"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {t("descLinkPromptCaching")}
              </a>{" "}
              {t("descTail")}
            </p>

            <div className="mt-4 grid grid-cols-1 items-center gap-4 md:grid-cols-[1fr_1fr_auto]">
              <Combobox
                multiple
                items={uniqueApiKeys}
                value={selectedApiKeys}
                onValueChange={(keys: string[]) => setSelectedApiKeys(keys)}
              >
                <ComboboxChips render={<div ref={anchor1} />}>
                  <ComboboxValue>
                    {(keys: string[]) =>
                      keys.map((key) => (
                        <ComboboxChip key={key} aria-label={key}>
                          {key}
                        </ComboboxChip>
                      ))
                    }
                  </ComboboxValue>
                  <ComboboxChipsInput placeholder={t("selectVirtualKeys")} />
                </ComboboxChips>
                <ComboboxContent anchor={anchor1}>
                  <ComboboxEmpty>{t("noVirtualKeysFound")}</ComboboxEmpty>
                  <ComboboxList>
                    {(key: string) => (
                      <ComboboxItem key={key} value={key}>
                        {key}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>

              <Combobox
                multiple
                items={uniqueModels}
                value={selectedModels}
                onValueChange={(models: string[]) => setSelectedModels(models)}
              >
                <ComboboxChips render={<div ref={anchor2} />}>
                  <ComboboxValue>
                    {(models: string[]) =>
                      models.map((model) => (
                        <ComboboxChip key={model} aria-label={model}>
                          {model}
                        </ComboboxChip>
                      ))
                    }
                  </ComboboxValue>
                  <ComboboxChipsInput placeholder={t("selectModels")} />
                </ComboboxChips>
                <ComboboxContent anchor={anchor2}>
                  <ComboboxEmpty>{t("noModelsFound")}</ComboboxEmpty>
                  <ComboboxList>
                    {(model: string) => (
                      <ComboboxItem key={model} value={model}>
                        {model}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>

              <AdvancedDatePicker
                value={dateValue}
                onValueChange={(value) => {
                  setDateValue(value);
                }}
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {statCards.map((stat) => (
                <Card key={stat.label}>
                  <CardContent>
                    <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                    <div className="mt-2 flex items-baseline space-x-2.5">
                      <p className="text-3xl font-semibold">{stat.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base font-semibold">{t("chartHitsVsRequests")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t("drilldownHint")}</p>
                {hasUnknownGroup && <p className="mt-1 text-sm text-muted-foreground">{t("unknownCallTypeNote")}</p>}
                <BarChart
                  data={chartData}
                  stack={true}
                  index="name"
                  valueFormatter={valueFormatterNumbers}
                  categories={[t(REQUEST_SERIES.apiRequests), t(REQUEST_SERIES.cacheHits), t(REQUEST_SERIES.failed)]}
                  colors={["sky", "teal", "red"]}
                  yAxisWidth={48}
                  className="mt-2"
                  onValueChange={(item) => {
                    if (item.categoryClicked === t(REQUEST_SERIES.failed)) setErrorDrilldownCallType(item.name);
                  }}
                />
              </CardContent>
            </Card>

            {activeDrilldownCallType !== null && (
              <ErrorDrilldownCard
                callType={activeDrilldownCallType}
                buckets={activity?.error_breakdown ?? []}
                valueFormatter={valueFormatterNumbers}
                onClose={() => setErrorDrilldownCallType(null)}
              />
            )}

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base font-semibold">{t("chartTokensComparison")}</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={chartData}
                  stack={true}
                  index="name"
                  valueFormatter={valueFormatterNumbers}
                  categories={[t(REQUEST_SERIES.generatedTokens), t(REQUEST_SERIES.cachedTokens)]}
                  colors={["sky", "teal"]}
                  yAxisWidth={48}
                />
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="health" keepMounted>
        <CacheHealthTab
          accessToken={accessToken}
          healthCheckResponse={healthCheckResponse}
          runCachingHealthCheck={runCachingHealthCheck}
        />
      </TabsContent>

      <TabsContent value="settings" keepMounted>
        <CacheSettings accessToken={accessToken} userRole={userRole} userID={userID} />
      </TabsContent>

      <TabsContent value="coordination" keepMounted>
        <CoordinationRedisSettings />
      </TabsContent>
    </Tabs>
  );
};

export default CacheDashboard;
