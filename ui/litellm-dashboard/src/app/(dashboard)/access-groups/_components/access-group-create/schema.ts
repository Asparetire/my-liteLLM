import { z } from "zod/v4";

// Module-level shape for type inference only; the runtime schema comes from
// buildAccessGroupCreateSchema so the zod error message can be translated.
const accessGroupCreateShape = {
  name: z.string(),
  description: z.string(),
  modelIds: z.array(z.string()),
  mcpServerIds: z.array(z.string()),
  agentIds: z.array(z.string()),
};

const accessGroupCreateSchema = z.object(accessGroupCreateShape);

const buildAccessGroupCreateSchema = (messages: { nameRequired: string }) => {
  const shape = {
    ...accessGroupCreateShape,
    name: z.string().refine((value) => value.trim() !== "", messages.nameRequired),
  };
  return z.object(shape);
};

type AccessGroupCreateFormValues = z.output<typeof accessGroupCreateSchema>;

export { accessGroupCreateSchema, buildAccessGroupCreateSchema };
export type { AccessGroupCreateFormValues };
