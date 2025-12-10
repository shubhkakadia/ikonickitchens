import { z } from "zod";

export const clientSchema = z.object({
  client_type: z.string().min(1, "Client type is required"),
  client_name: z.string().min(1, "Client name is required"),
  client_address: z.string().nullish(),
  client_phone: z.string().nullish(),
  client_email: z.email().nullish(),
  client_website: z.url().nullish(),
  client_notes: z.string().nullish(),
});

// user schema
// module access schema
// employee schema
// media schema
// contact schema
// project schema
// lot schema
// stage schema
// stage employee schema
// lot tab schema
// lot file schema
// quote schema
// material selection schema
// material selection version schema
// material selection version area schema
// material selection version area item schema
// item schema
// sheet schema
// handle schema
// hardware schema
// accessory schema
// edging tape schema
// supplier schema
// supplier statement schema
// supplier file schema
// materials to order schema
// materials to order item schema
// purchase order schema
// purchase order item schema
// stock transaction schema
// log schema

export type Client = z.infer<typeof clientSchema>;
