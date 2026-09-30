import moment from "moment";
import { describe, expect, it } from "vitest";
import { getTimeRangeDisplay } from "./logs_utils";

// startTime built relative to "now"; getTimeRangeDisplay computes now() internally.
const ago = (amount: number, unit: moment.unitOfTime.DurationConstructor) =>
  moment().subtract(amount, unit).toISOString();

// 纯模块测试：用 zh-CN 文案表 stub t，与 messages/zh-CN.json 的 logs 命名空间保持一致
const ZH_LABELS: Record<string, string> = {
  lastMinute: "最近 1 分钟",
  last15Minutes: "最近 15 分钟",
  lastHour: "最近 1 小时",
  last4Hours: "最近 4 小时",
  last24Hours: "最近 24 小时",
  last7Days: "最近 7 天",
};
const stubT = (key: string) => ZH_LABELS[key] ?? key;

describe("getTimeRangeDisplay", () => {
  it("labels a ~1-minute window as '最近 1 分钟'", () => {
    expect(getTimeRangeDisplay(stubT, false, ago(1, "minutes"), "")).toBe("最近 1 分钟");
  });

  it("labels a ~10-minute window as '最近 15 分钟'", () => {
    expect(getTimeRangeDisplay(stubT, false, ago(10, "minutes"), "")).toBe("最近 15 分钟");
  });

  it("labels a ~30-minute window as '最近 1 小时'", () => {
    expect(getTimeRangeDisplay(stubT, false, ago(30, "minutes"), "")).toBe("最近 1 小时");
  });

  it("labels a ~2-hour window as '最近 4 小时'", () => {
    expect(getTimeRangeDisplay(stubT, false, ago(2, "hours"), "")).toBe("最近 4 小时");
  });

  it("labels a ~10-hour window as '最近 24 小时'", () => {
    expect(getTimeRangeDisplay(stubT, false, ago(10, "hours"), "")).toBe("最近 24 小时");
  });

  it("labels a ~3-day window as '最近 7 天'", () => {
    expect(getTimeRangeDisplay(stubT, false, ago(3, "days"), "")).toBe("最近 7 天");
  });

  it("falls back to a 'M月D日 - M月D日' range beyond 7 days", () => {
    const label = getTimeRangeDisplay(stubT, false, ago(30, "days"), "");
    expect(label).toMatch(/^\d{1,2}月\d{1,2}日 - \d{1,2}月\d{1,2}日$/);
  });

  it("renders an explicit start - end range when isCustomDate is true", () => {
    const start = "2025-01-02T03:04:00Z";
    const end = "2025-01-05T06:07:00Z";
    const expected = `${moment(start).format("M月D日 HH:mm")} - ${moment(end).format("M月D日 HH:mm")}`;
    expect(getTimeRangeDisplay(stubT, true, start, end)).toBe(expected);
  });
});
