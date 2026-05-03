import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/responses';
import { AuthRequest } from '../middleware/auth';
import type { Disponibilite, ExceptionDispo } from '../generated/prisma';

type DispoWithExceptions = Disponibilite & { exceptions: ExceptionDispo[] };

// GET /api/coiffeuses
export const getAllCoiffeuses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { specialite, disponible } = req.query;

    const where: { actif: boolean; specialites?: { has: string } } = { actif: true };
    if (specialite) {
      where.specialites = { has: specialite as string };
    }

    const coiffeuses = await prisma.coiffeuse.findMany({
      where,
      include: {
        disponibilites: true,
        portfolioPhotos: { take: 4, orderBy: { dateRealisation: 'desc' } },
        avisRecus: { select: { note: true } },
      },
      orderBy: { nom: 'asc' },
    });

    const result = coiffeuses.map((c) => ({
      ...c,
      noteMoyenne:
        c.avisRecus.length > 0
          ? c.avisRecus.reduce((sum: number, a) => sum + a.note, 0) / c.avisRecus.length
          : null,
      nombreAvis: c.avisRecus.length,
      avisRecus: undefined,
    }));

    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 'Erreur récupération coiffeuses', 500);
  }
};

// GET /api/coiffeuses/:id
export const getCoiffeuse = async (req: Request, res: Response): Promise<void> => {
  try {
    const coiffeuse = await prisma.coiffeuse.findUnique({
      where: { id: req.params.id as string },
      include: {
        disponibilites: { include: { exceptions: true } },
        portfolioPhotos: { orderBy: { dateRealisation: 'desc' } },
        avisRecus: {
          include: { cliente: { select: { prenom: true } } },
          where: { moderationStatut: 'APPROUVE' },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!coiffeuse) {
      sendError(res, 'Coiffeuse non trouvée', 404);
      return;
    }

    sendSuccess(res, coiffeuse);
  } catch (error) {
    sendError(res, 'Erreur serveur', 500);
  }
};

// GET /api/coiffeuses/:id/disponibilites?date=2026-04-09
export const getDisponibilites = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { date } = req.query;

    if (!date) {
      sendError(res, 'Paramètre date requis (YYYY-MM-DD)', 400);
      return;
    }

    const targetDate = new Date(date as string);
    const jourSemaine = targetDate.getDay();

    // 1. Récupérer les disponibilités de base pour ce jour
    const dispo = await prisma.disponibilite.findFirst({
      where: { coiffeuseId: id, jourSemaine },
      include: {
        exceptions: {
          where: { dateException: targetDate },
        },
      },
    }) as DispoWithExceptions | null;

    if (!dispo) {
      sendSuccess(res, { disponible: false, creneaux: [], message: 'Pas de disponibilité ce jour' });
      return;
    }

    // 2. Vérifier les exceptions (congés)
    if (dispo.exceptions.length > 0) {
      const exception = dispo.exceptions[0];
      if (!exception.heureDebutModifiee) {
        sendSuccess(res, { disponible: false, creneaux: [], message: exception.raison || 'Indisponible' });
        return;
      }
    }

    // 3. Récupérer les RDV existants ce jour
    const debutJour = new Date(targetDate);
    debutJour.setHours(0, 0, 0, 0);
    const finJour = new Date(targetDate);
    finJour.setHours(23, 59, 59, 999);

    const rdvExistants = await prisma.rendezVous.findMany({
      where: {
        coiffeuseId: id,
        dateHeure: { gte: debutJour, lte: finJour },
        statut: { notIn: ['ANNULE_CLIENT', 'ANNULE_SALON'] },
      },
      orderBy: { dateHeure: 'asc' },
    });

    // 4. Calculer les créneaux libres (par tranches de 30 min)
    const heureDebut = dispo.exceptions[0]?.heureDebutModifiee || dispo.heureDebut;
    const heureFin = dispo.exceptions[0]?.heureFinModifiee || dispo.heureFin;

    const creneaux: { debut: string; fin: string }[] = [];
    const [hd, md] = heureDebut.split(':').map(Number);
    const [hf, mf] = heureFin.split(':').map(Number);
    const debutMinutes = hd * 60 + md;
    const finMinutes = hf * 60 + mf;

    for (let m = debutMinutes; m < finMinutes; m += 30) {
      const creneauDebut = new Date(targetDate);
      creneauDebut.setHours(Math.floor(m / 60), m % 60, 0, 0);
      const creneauFin = new Date(creneauDebut.getTime() + 30 * 60 * 1000);

      const occupe = rdvExistants.some((rdv) => {
        const rdvDebut = new Date(rdv.dateHeure).getTime();
        const rdvFin = new Date(rdv.dateHeureFin).getTime();
        return creneauDebut.getTime() >= rdvDebut && creneauDebut.getTime() < rdvFin;
      });

      if (!occupe) {
        creneaux.push({ debut: creneauDebut.toISOString(), fin: creneauFin.toISOString() });
      }
    }

    sendSuccess(res, { disponible: true, creneaux });
  } catch (error) {
    console.error('Erreur disponibilités:', error);
    sendError(res, 'Erreur serveur', 500);
  }
};

// PUT /api/coiffeuses/:id (Admin ou propre profil)
export const updateCoiffeuse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Ownership check: COIFFEUSE can only update her own profile
    if (req.user?.role === 'COIFFEUSE') {
      const ownCoiffeuse = await prisma.coiffeuse.findUnique({ where: { userId: req.user!.userId }, select: { id: true } });
      if (!ownCoiffeuse || ownCoiffeuse.id !== req.params.id) {
        sendError(res, 'Accès non autorisé', 403);
        return;
      }
    }

    const { bio, specialites, photoUrl, niveau, actif } = req.body;

    // Only ADMIN can change 'actif' status and 'niveau'
    const data: Record<string, unknown> = {};
    if (bio !== undefined) data.bio = bio;
    if (specialites) data.specialites = specialites;
    if (photoUrl !== undefined) data.photoUrl = photoUrl;
    if (req.user?.role === 'ADMIN') {
      if (niveau) data.niveau = niveau;
      if (actif !== undefined) data.actif = actif;
    }

    const coiffeuse = await prisma.coiffeuse.update({
      where: { id: req.params.id as string },
      data,
    });

    sendSuccess(res, coiffeuse);
  } catch (error) {
    sendError(res, 'Erreur mise à jour coiffeuse', 500);
  }
};

// GET /api/coiffeuses/me — profil de la coiffeuse connectée
export const getMonProfil = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const coiffeuse = await prisma.coiffeuse.findUnique({
      where: { userId: req.user!.userId },
      include: {
        disponibilites: true,
        user: { select: { email: true } },
      },
    });
    if (!coiffeuse) { sendError(res, 'Profil non trouvé', 404); return; }
    sendSuccess(res, coiffeuse);
  } catch (error) {
    sendError(res, 'Erreur récupération profil', 500);
  }
};

// PUT /api/coiffeuses/me/disponibilites — met à jour les disponibilités
export const updateDisponibilites = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const coiffeuse = await prisma.coiffeuse.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!coiffeuse) { sendError(res, 'Coiffeuse non trouvée', 404); return; }

    const { disponibilites } = req.body as {
      disponibilites: { jourSemaine: number; heureDebut: string; heureFin: string; actif: boolean }[];
    };

    if (!Array.isArray(disponibilites)) {
      sendError(res, 'disponibilites doit être un tableau', 400);
      return;
    }

    // Supprimer les anciennes dispos et recréer
    await prisma.$transaction([
      prisma.disponibilite.deleteMany({ where: { coiffeuseId: coiffeuse.id } }),
      prisma.disponibilite.createMany({
        data: disponibilites.map((d) => ({
          coiffeuseId: coiffeuse.id,
          jourSemaine: d.jourSemaine,
          heureDebut: d.heureDebut,
          heureFin: d.heureFin,
        })),
      }),
    ]);

    const updated = await prisma.coiffeuse.findUnique({
      where: { id: coiffeuse.id },
      include: { disponibilites: true },
    });
    sendSuccess(res, updated);
  } catch (error) {
    sendError(res, 'Erreur mise à jour disponibilités', 500);
  }
};

// GET /api/coiffeuses/produits — liste des produits (id, nom, unite) pour saisie matières
export const getProduitsCoiffeuse = async (_req: Request, res: Response): Promise<void> => {
  try {
    const produits = await prisma.produit.findMany({
      where: { actif: true },
      select: { id: true, nom: true, unite: true, categorie: true },
      orderBy: { nom: 'asc' },
    });
    sendSuccess(res, produits);
  } catch (error) {
    sendError(res, 'Erreur récupération produits', 500);
  }
};

// GET /api/coiffeuses/mes-clientes — clientes ayant eu un RDV avec cette coiffeuse
export const getMesClientes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const coiffeuse = await prisma.coiffeuse.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!coiffeuse) { sendError(res, 'Coiffeuse non trouvée', 404); return; }

    const rdvs = await prisma.rendezVous.findMany({
      where: {
        coiffeuseId: coiffeuse.id,
        clienteId: { not: null },
        statut: { notIn: ['ANNULE_CLIENT', 'ANNULE_SALON'] },
      },
      include: {
        cliente: { select: { id: true, prenom: true, nom: true, telephone: true, typeCheveux: true } },
        services: { include: { service: { select: { nom: true } } } },
      },
      orderBy: { dateHeure: 'desc' },
    });

    // Dédupliquer par clienteId, garder la dernière visite
    const clientesMap = new Map<string, { id: string; prenom: string; nom: string; telephone: string | null; profilCapillaire: string | null; derniereVisite: string; nombreVisites: number; services: string[] }>();
    for (const rdv of rdvs) {
      if (!rdv.cliente) continue;
      const cId = rdv.cliente.id;
      if (!clientesMap.has(cId)) {
        clientesMap.set(cId, {
          id: rdv.cliente.id,
          prenom: rdv.cliente.prenom,
          nom: rdv.cliente.nom,
          telephone: rdv.cliente.telephone,
          profilCapillaire: rdv.cliente.typeCheveux || null,
          derniereVisite: rdv.dateHeure.toISOString(),
          nombreVisites: 1,
          services: rdv.services.map((s: any) => s.service.nom),
        });
      } else {
        const existing = clientesMap.get(cId)!;
        existing.nombreVisites += 1;
      }
    }

    sendSuccess(res, Array.from(clientesMap.values()));
  } catch (error) {
    sendError(res, 'Erreur récupération clientes', 500);
  }
};
