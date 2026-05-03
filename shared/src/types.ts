// Shared TypeScript types between backend and frontend.
// Do NOT import server-only modules here (Prisma, bcrypt, etc.).

// ==================== Roles ====================

export type UserRole = 'ADMIN' | 'COIFFEUSE' | 'CLIENT';

// ==================== API Response envelope ====================

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// ==================== Auth ====================

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  nom?: string;
  prenom?: string;
  mustChangePassword?: boolean;
  isMfaEnabled?: boolean;
  mfaMethod?: string | null;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: AuthUser;
}

// ==================== Rendez-vous ====================

export type RendezVousStatut = 'EN_ATTENTE' | 'CONFIRME' | 'ANNULE' | 'TERMINE';

export interface RendezVousSummary {
  id: string;
  dateHeure: string; // ISO 8601
  statut: RendezVousStatut;
  dureeMinutes: number;
  prixTotal: number;
  services: { id: string; nom: string; prixHT: number }[];
  coiffeuse?: { id: string; nom: string; prenom: string };
}

// ==================== Services & Produits ====================

export interface ServiceSummary {
  id: string;
  nom: string;
  description?: string;
  dureeMinutes: number;
  prixHT: number;
  categorie?: string;
}

export interface ProduitSummary {
  id: string;
  nom: string;
  description?: string;
  prixHT: number;
  stock: number;
  seuilAlerte?: number | null;
  imageUrl?: string | null;
}

// ==================== Push Notifications ====================

export interface PushTokenPayload {
  token: string;
  platform: 'web' | 'android' | 'ios' | 'desktop';
  deviceInfo?: Record<string, unknown>;
}

// ==================== Notifications ====================

export interface NotificationPayload {
  title: string;
  body: string;
  imageUrl?: string;
  url?: string;
  data?: Record<string, string>;
}
