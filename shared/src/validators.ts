import { z } from 'zod';

// ==================== Auth — OTP Registration ====================

export const RequestOtpSchema = z.object({
  email: z.string().email('Adresse email invalide').max(255).toLowerCase().trim(),
});

export const VerifyOtpSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  code: z.string().length(6, 'Le code doit comporter 6 chiffres').regex(/^\d{6}$/, 'Le code doit être numérique'),
});

export const PasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, '12 caractères minimum')
      .regex(/[A-Z]/, 'Une majuscule requise')
      .regex(/[a-z]/, 'Une minuscule requise')
      .regex(/[0-9]/, 'Un chiffre requis')
      .regex(/[^A-Za-z0-9]/, 'Un caractère spécial requis'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export const CompleteRegistrationSchema = z
  .object({
    password: z
      .string()
      .min(12, '12 caractères minimum')
      .regex(/[A-Z]/, 'Une majuscule requise')
      .regex(/[a-z]/, 'Une minuscule requise')
      .regex(/[0-9]/, 'Un chiffre requis')
      .regex(/[^A-Za-z0-9]/, 'Un caractère spécial requis'),
    confirmPassword: z.string(),
    nom: z.string().trim().min(1, 'Nom requis').max(100),
    prenom: z.string().trim().min(1, 'Prénom requis').max(100),
    telephone: z.string().optional(),
    dateNaissance: z.string().datetime().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

// ==================== Auth — Login ====================

export const LoginSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

// ==================== Push Notifications ====================

export const RegisterPushTokenSchema = z.object({
  token: z.string().min(1, 'Token FCM requis'),
  platform: z.enum(['web', 'android', 'ios', 'desktop'], {
    errorMap: () => ({ message: 'Plateforme invalide' }),
  }),
  deviceInfo: z.record(z.unknown()).optional(),
});

// ==================== Rendez-vous ====================

export const CreateRendezVousSchema = z.object({
  coiffeuseId: z.string().uuid('ID coiffeuse invalide'),
  serviceIds: z.array(z.string().uuid()).min(1, 'Au moins un service requis'),
  dateHeure: z.string().datetime('Date/heure invalide'),
  notes: z.string().max(500).optional(),
});

// ==================== GDPR / Consents ====================

export const UpdateConsentsSchema = z.object({
  pushNotifications: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
});

// ==================== Type exports ====================

export type RequestOtpInput = z.infer<typeof RequestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type CompleteRegistrationInput = z.infer<typeof CompleteRegistrationSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterPushTokenInput = z.infer<typeof RegisterPushTokenSchema>;
export type CreateRendezVousInput = z.infer<typeof CreateRendezVousSchema>;
export type UpdateConsentsInput = z.infer<typeof UpdateConsentsSchema>;
