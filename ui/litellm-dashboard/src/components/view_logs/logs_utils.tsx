import moment from "moment";

type Translator = (key: string, values?: Record<string, string | number>) => string;

// Add this function to format the time range display
export const getTimeRangeDisplay = (t: Translator, isCustomDate: boolean, startTime: string, endTime: string) => {
  if (isCustomDate) {
    return `${moment(startTime).format("M月D日 HH:mm")} - ${moment(endTime).format("M月D日 HH:mm")}`;
  }

  const now = moment();
  const start = moment(startTime);
  const diffMinutes = now.diff(start, "minutes");

  // Use exact ranges to prevent drift
  if (diffMinutes >= 0 && diffMinutes < 2) return t("lastMinute");
  if (diffMinutes >= 2 && diffMinutes < 16) return t("last15Minutes");
  if (diffMinutes >= 16 && diffMinutes < 61) return t("lastHour");

  const diffHours = now.diff(start, "hours");
  if (diffHours >= 1 && diffHours < 5) return t("last4Hours");
  if (diffHours >= 5 && diffHours < 25) return t("last24Hours");
  if (diffHours >= 25 && diffHours < 169) return t("last7Days");
  return `${start.format("M月D日")} - ${now.format("M月D日")}`;
};
