import { CostEstimateResponse } from "../types";
import { formatNumberWithCommas } from "@/utils/dataUtils";
import { MultiModelResult } from "./types";

type Translator = (key: string, values?: Record<string, string | number>) => string;

const formatCostForExport = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "-";
  if (value === 0) return "$0.00";
  if (value < 0.01) return `$${value.toFixed(6)}`;
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${formatNumberWithCommas(value, 2)}`;
};

const formatRequestsForExport = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "-";
  return formatNumberWithCommas(value, 0);
};

const generateModelSection = (result: CostEstimateResponse, t: Translator): string => {
  return `
    <div class="model-section">
      <h3>${result.model} ${result.provider ? `<span class="provider">(${result.provider})</span>` : ""}</h3>

      <div class="meta">
        <p><strong>${t("inputTokensPerRequest")}:</strong> ${formatRequestsForExport(result.input_tokens)}</p>
        <p><strong>${t("outputTokensPerRequest")}:</strong> ${formatRequestsForExport(result.output_tokens)}</p>
        ${result.num_requests_per_day ? `<p><strong>${t("requestsPerDay")}:</strong> ${formatRequestsForExport(result.num_requests_per_day)}</p>` : ""}
        ${result.num_requests_per_month ? `<p><strong>${t("requestsPerMonth")}:</strong> ${formatRequestsForExport(result.num_requests_per_month)}</p>` : ""}
      </div>

      <table>
        <tr>
          <th>${t("costType")}</th>
          <th>${t("colPerRequest")}</th>
          ${result.daily_cost !== null ? `<th>${t("dailyLabel")}</th>` : ""}
          ${result.monthly_cost !== null ? `<th>${t("monthlyLabel")}</th>` : ""}
        </tr>
        <tr>
          <td>${t("inputCostLabel")}</td>
          <td class="cost-value">${formatCostForExport(result.input_cost_per_request)}</td>
          ${result.daily_cost !== null ? `<td class="cost-value">${formatCostForExport(result.daily_input_cost)}</td>` : ""}
          ${result.monthly_cost !== null ? `<td class="cost-value">${formatCostForExport(result.monthly_input_cost)}</td>` : ""}
        </tr>
        <tr>
          <td>${t("outputCostLabel")}</td>
          <td class="cost-value">${formatCostForExport(result.output_cost_per_request)}</td>
          ${result.daily_cost !== null ? `<td class="cost-value">${formatCostForExport(result.daily_output_cost)}</td>` : ""}
          ${result.monthly_cost !== null ? `<td class="cost-value">${formatCostForExport(result.monthly_output_cost)}</td>` : ""}
        </tr>
        <tr>
          <td>${t("marginFeeLabel")}</td>
          <td class="cost-value">${formatCostForExport(result.margin_cost_per_request)}</td>
          ${result.daily_cost !== null ? `<td class="cost-value">${formatCostForExport(result.daily_margin_cost)}</td>` : ""}
          ${result.monthly_cost !== null ? `<td class="cost-value">${formatCostForExport(result.monthly_margin_cost)}</td>` : ""}
        </tr>
        <tr class="total-row">
          <td>${t("totalLabel")}</td>
          <td class="cost-value">${formatCostForExport(result.cost_per_request)}</td>
          ${result.daily_cost !== null ? `<td class="cost-value">${formatCostForExport(result.daily_cost)}</td>` : ""}
          ${result.monthly_cost !== null ? `<td class="cost-value">${formatCostForExport(result.monthly_cost)}</td>` : ""}
        </tr>
      </table>
    </div>
  `;
};

export const exportMultiToPDF = (multiResult: MultiModelResult, t: Translator): void => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert(t("allowPopupsAlert"));
    return;
  }

  const validEntries = multiResult.entries.filter((e) => e.result !== null);
  const modelCount = validEntries.length;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${t("multiReportTitle")}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 40px;
          max-width: 900px;
          margin: 0 auto;
          color: #333;
        }
        h1 {
          color: #1a1a1a;
          border-bottom: 2px solid #1890ff;
          padding-bottom: 10px;
          margin-bottom: 30px;
        }
        h2 {
          color: #444;
          margin-top: 30px;
          margin-bottom: 15px;
        }
        h3 {
          color: #555;
          margin-top: 25px;
          margin-bottom: 10px;
          padding-bottom: 5px;
          border-bottom: 1px solid #eee;
        }
        .provider {
          font-weight: normal;
          color: #1890ff;
          font-size: 14px;
        }
        .meta {
          background: #f5f5f5;
          padding: 12px 15px;
          border-radius: 8px;
          margin-bottom: 15px;
          font-size: 13px;
        }
        .meta p {
          margin: 4px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th, td {
          padding: 10px 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        th {
          background: #f8f9fa;
          font-weight: 600;
          font-size: 13px;
        }
        .cost-value {
          font-family: monospace;
          font-size: 13px;
        }
        .total-row {
          font-weight: bold;
          background: #e6f7ff;
        }
        .summary-box {
          background: linear-gradient(135deg, #e6f7ff 0%, #f9f0ff 100%);
          border: 1px solid #91d5ff;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 30px;
        }
        .summary-box h2 {
          margin-top: 0;
          color: #1890ff;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-top: 15px;
        }
        .summary-item {
          text-align: center;
        }
        .summary-item .label {
          font-size: 12px;
          color: #666;
          margin-bottom: 5px;
        }
        .summary-item .value {
          font-size: 20px;
          font-weight: bold;
          font-family: monospace;
        }
        .summary-item .value.blue { color: #1890ff; }
        .summary-item .value.green { color: #52c41a; }
        .summary-item .value.purple { color: #722ed1; }
        .model-section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          font-size: 12px;
          color: #666;
        }
        @media print {
          body { padding: 20px; }
          .model-section { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <h1>${t("reportTitle")}</h1>
      <p style="color: #666; margin-top: -20px; margin-bottom: 30px;">${t("modelsConfigured", { count: modelCount })}</p>

      <div class="summary-box">
        <h2>${t("combinedTotals")}</h2>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="label">${t("totalPerRequestLabel")}</div>
            <div class="value blue">${formatCostForExport(multiResult.totals.cost_per_request)}</div>
          </div>
          <div class="summary-item">
            <div class="label">${t("totalDaily")}</div>
            <div class="value green">${formatCostForExport(multiResult.totals.daily_cost)}</div>
          </div>
          <div class="summary-item">
            <div class="label">${t("totalMonthly")}</div>
            <div class="value purple">${formatCostForExport(multiResult.totals.monthly_cost)}</div>
          </div>
        </div>
        ${
          multiResult.totals.margin_per_request > 0
            ? `
        <div class="summary-grid" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
          <div class="summary-item">
            <div class="label">${t("marginPerRequest")}</div>
            <div class="value" style="color: #faad14;">${formatCostForExport(multiResult.totals.margin_per_request)}</div>
          </div>
          <div class="summary-item">
            <div class="label">${t("dailyMargin")}</div>
            <div class="value" style="color: #faad14;">${formatCostForExport(multiResult.totals.daily_margin)}</div>
          </div>
          <div class="summary-item">
            <div class="label">${t("monthlyMargin")}</div>
            <div class="value" style="color: #faad14;">${formatCostForExport(multiResult.totals.monthly_margin)}</div>
          </div>
        </div>
        `
            : ""
        }
      </div>

      <h2>${t("modelBreakdown")}</h2>
      ${validEntries.map((e) => generateModelSection(e.result!, t)).join("")}

      <div class="footer">
        <p>${t("generatedBy", { date: new Date().toLocaleString() })}</p>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
};

export const exportMultiToCSV = (multiResult: MultiModelResult, t: Translator): void => {
  const validEntries = multiResult.entries.filter((e) => e.result !== null);

  const rows: string[][] = [[t("csvReportTitle")], [t("generatedLabel"), new Date().toLocaleString()], [""]];

  // Summary section
  rows.push(
    [t("combinedTotals")],
    [t("totalPerRequestLabel"), multiResult.totals.cost_per_request.toString()],
    [t("totalDaily"), multiResult.totals.daily_cost?.toString() || "-"],
    [t("totalMonthly"), multiResult.totals.monthly_cost?.toString() || "-"],
    [t("marginPerRequest"), multiResult.totals.margin_per_request.toString()],
    [t("dailyMargin"), multiResult.totals.daily_margin?.toString() || "-"],
    [t("monthlyMargin"), multiResult.totals.monthly_margin?.toString() || "-"],
    [""],
  );

  // Summary table header
  rows.push([
    t("colModel"),
    t("csvProvider"),
    t("colInputTokens"),
    t("colOutputTokens"),
    t("colRequestsDay"),
    t("colRequestsMonth"),
    t("csvCostPerRequest"),
    t("csvDailyCost"),
    t("csvMonthlyCost"),
    t("csvInputCostReq"),
    t("csvOutputCostReq"),
    t("csvMarginReq"),
  ]);

  // Add each model's data
  for (const entry of validEntries) {
    const r = entry.result!;
    rows.push([
      r.model,
      r.provider || "-",
      r.input_tokens.toString(),
      r.output_tokens.toString(),
      r.num_requests_per_day?.toString() || "-",
      r.num_requests_per_month?.toString() || "-",
      r.cost_per_request.toString(),
      r.daily_cost?.toString() || "-",
      r.monthly_cost?.toString() || "-",
      r.input_cost_per_request.toString(),
      r.output_cost_per_request.toString(),
      r.margin_cost_per_request.toString(),
    ]);
  }

  const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cost_estimate_multi_model_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
