// [CN-FORK] REQ-06: budget limits are token counts, which are integers.
// The legacy 2-decimal rounding existed for USD amounts; integer rounding now covers
// max_budget as well as the rate-limit fields, which were always integral.
const INTEGER_FIELDS: ReadonlySet<string> = new Set(["tpm_limit", "rpm_limit", "max_budget"]);

export const applyBudgetPrecision = <TValues extends Record<string, unknown>>(formValues: TValues): TValues =>
  Object.fromEntries(
    Object.entries(formValues).map(([key, value]) => [
      key,
      INTEGER_FIELDS.has(key) && typeof value === "number" && Number.isFinite(value) ? Math.round(value) : value,
    ]),
  ) as TValues;
