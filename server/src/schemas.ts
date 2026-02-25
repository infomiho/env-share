import * as v from "valibot";

export const DevicePollSchema = v.object({
  device_code: v.string(),
});

export const PublicKeySchema = v.object({
  publicKey: v.string(),
});

export const CreateProjectSchema = v.object({
  name: v.pipe(v.string(), v.nonEmpty()),
  encryptedProjectKey: v.string(),
});

export const AddMemberSchema = v.object({
  username: v.pipe(v.string(), v.nonEmpty()),
  encryptedProjectKey: v.optional(v.string()),
});

export const ResolvePendingSchema = v.object({
  members: v.array(
    v.object({
      username: v.string(),
      encryptedProjectKey: v.string(),
    }),
  ),
});

export const UploadFileSchema = v.object({
  encryptedContent: v.string(),
});
