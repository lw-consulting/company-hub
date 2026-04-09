import { z } from 'zod';

const roles = ['super_admin', 'admin', 'hr', 'manager', 'editor', 'user'] as const;

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(roles).default('user'),
  department: z.string().max(100).optional(),
  position: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  supervisorId: z.string().uuid().nullable().optional(),
  vacationDaysPerYear: z.number().int().min(0).max(365).default(25),
  weeklyTargetHours: z.number().min(0).max(168).default(40),
  timeEditsRequireApproval: z.boolean().optional(),
});

export const updateUserSchema = createUserSchema
  .partial()
  .omit({ password: true })
  .extend({
    isActive: z.boolean().optional(),
  });

export const updateModulePermissionsSchema = z.object({
  modules: z.array(
    z.object({
      moduleId: z.string(),
      isEnabled: z.boolean(),
    })
  ),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateModulePermissionsInput = z.infer<typeof updateModulePermissionsSchema>;
