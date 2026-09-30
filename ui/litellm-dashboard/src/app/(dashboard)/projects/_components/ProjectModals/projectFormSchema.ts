import { z } from "zod/v4";

export const ALL_TEAM_MODELS = "all-team-models";

const repeatsEarlierValue = (values: readonly string[], index: number): boolean =>
  values[index] !== "" && values.indexOf(values[index]) !== index;

// Module-level schema for type inference only; the runtime schema comes from
// buildProjectFormSchema so the zod error messages can be translated.
const modelLimitShape = {
  model: z.string(),
  tpm: z.number().optional(),
  rpm: z.number().optional(),
  itpm: z.number().optional(),
  otpm: z.number().optional(),
};

const inferenceShape = {
  project_alias: z.string(),
  // pipe keeps the output type string (null stripped) so ProjectSubmitValues matches the runtime schema.
  team_id: z.string().nullable().pipe(z.string()),
  description: z.string().optional(),
  models: z.array(z.string()),
  max_budget: z.number().nullish(),
  isBlocked: z.boolean(),
  guardrails: z.array(z.string()).optional(),
  modelLimits: z.array(z.object(modelLimitShape)).optional(),
  metadata: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
};

export const projectFormSchema = z.object(inferenceShape);

export type ProjectFormValues = z.input<typeof projectFormSchema>;
export type ProjectSubmitValues = z.output<typeof projectFormSchema>;

export interface ProjectFormSchemaMessages {
  nameRequired: string;
  teamRequired: string;
  missingModel: string;
  missingKey: string;
  missingValue: string;
  duplicateModel: string;
  duplicateKey: string;
}

export const buildProjectFormSchema = (m: ProjectFormSchemaMessages) => {
  const shape = {
    project_alias: z.string().min(1, m.nameRequired),
    team_id: z.string().nullable().pipe(z.string({ error: m.teamRequired }).min(1, m.teamRequired)),
    description: z.string().optional(),
    models: z.array(z.string()),
    max_budget: z.number().nullish(),
    isBlocked: z.boolean(),
    guardrails: z.array(z.string()).optional(),
    modelLimits: z
      .array(
        z.object({
          ...modelLimitShape,
          model: z.string().min(1, m.missingModel),
        }),
      )
      .optional(),
    metadata: z
      .array(
        z.object({
          key: z.string().min(1, m.missingKey),
          value: z.string().min(1, m.missingValue),
        }),
      )
      .optional(),
  };
  return z
    .object(shape)
    .superRefine((values, ctx) => {
      const models = (values.modelLimits ?? []).map((entry) => entry.model);
      models.forEach((_, index) => {
        if (repeatsEarlierValue(models, index)) {
          ctx.addIssue({ code: "custom", message: m.duplicateModel, path: ["modelLimits", index, "model"] });
        }
      });

      const keys = (values.metadata ?? []).map((entry) => entry.key);
      keys.forEach((_, index) => {
        if (repeatsEarlierValue(keys, index)) {
          ctx.addIssue({ code: "custom", message: m.duplicateKey, path: ["metadata", index, "key"] });
        }
      });
    });
};

export const emptyProjectFormValues: ProjectFormValues = {
  project_alias: "",
  team_id: null,
  description: undefined,
  models: [],
  max_budget: undefined,
  isBlocked: false,
  guardrails: undefined,
  modelLimits: undefined,
  metadata: undefined,
};
