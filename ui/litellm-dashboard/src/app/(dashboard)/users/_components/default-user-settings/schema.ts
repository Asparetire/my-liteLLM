import { z } from "zod/v4";

export interface DefaultUserSettingsMessages {
  selectTeam: string;
  teamAlreadyListed: string;
  nonNegativeNumber: string;
}

const isBlank = (value: string): boolean => value.trim() === "";

const amountOrEmpty = (message: string) =>
  z.string().refine(
    (value) => isBlank(value) || (Number.isFinite(Number(value)) && Number(value) >= 0),
    message,
  );

const defaultTeamRowSchema = (messages: DefaultUserSettingsMessages) =>
  z.object({
    team_id: z
      .string()
      .nullable()
      .pipe(z.string({ error: messages.selectTeam }).min(1, messages.selectTeam)),
    max_budget_in_team: amountOrEmpty(messages.nonNegativeNumber),
    user_role: z.enum(["user", "admin"]),
  });

export type DefaultTeamRowValues = z.input<ReturnType<typeof defaultTeamRowSchema>>;

export const EMPTY_TEAM_ROW: DefaultTeamRowValues = { team_id: null, max_budget_in_team: "", user_role: "user" };

export const buildDefaultUserSettingsSchema = (messages: DefaultUserSettingsMessages) =>
  z
    .object({
      user_role: z.string(),
      max_budget: amountOrEmpty(messages.nonNegativeNumber),
      budget_duration: z.string(),
      models: z.array(z.string()),
      teams: z.array(defaultTeamRowSchema(messages)),
    })
    .superRefine((values, ctx) => {
      const repeatedRows = values.teams.flatMap((team, index) =>
        team.team_id !== "" && values.teams.findIndex((other) => other.team_id === team.team_id) < index
          ? [index]
          : [],
      );

      repeatedRows.forEach((index) =>
        ctx.addIssue({
          code: "custom",
          message: messages.teamAlreadyListed,
          path: ["teams", index, "team_id"],
        }),
      );
    });

export type DefaultUserSettingsFormValues = z.input<ReturnType<typeof buildDefaultUserSettingsSchema>>;
export type DefaultUserSettingsSubmitValues = z.output<ReturnType<typeof buildDefaultUserSettingsSchema>>;
