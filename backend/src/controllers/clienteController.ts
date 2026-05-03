import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/responses';
import { AuthRequest } from '../middleware/auth';

// GET /api/clientes/profil
export const getMonProfil = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cliente = await prisma.cliente.findFirst({
      where: { userId: req.user!.userId },
      include: {
        photos: { orderBy: { datePhoto: 'desc' }, take: 10 },
        rendezVous: {
          include: {
            services: { include: { service: true } },
            coiffeuse: { select: { nom: true, prenom: true, photoUrl: true } },
          },
          orderBy: { dateHeure: 'desc' },
          take: 5,
        },
      },
    });

    if (!cliente) {
      sendError(res, 'Profil non trouvé', 404);
      return;
    }

    sendSuccess(res, cliente);
  } catch (error) {
    sendError(res, 'Erreur serveur', 500);
  }
};

// PUT /api/clientes/profil
export const updateProfil = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { typeCheveux, textureCheveux, allergies, preferences, telephone, dateNaissance } = req.body;

    const cliente = await prisma.cliente.findFirst({ where: { userId: req.user!.userId } });
    if (!cliente) {
      sendError(res, 'Profil non trouvé', 404);
      return;
    }

    const updated = await prisma.cliente.update({
      where: { id: cliente.id },
      data: {
        ...(typeCheveux !== undefined && { typeCheveux }),
        ...(textureCheveux !== undefined && { textureCheveux }),
        ...(allergies !== undefined && { allergies }),
        ...(preferences !== undefined && { preferences }),
        ...(telephone !== undefined && { telephone }),
        ...(dateNaissance !== undefined && { dateNaissance: new Date(dateNaissance) }),
      },
    });

    sendSuccess(res, updated);
  } catch (error) {
    sendError(res, 'Erreur mise à jour profil', 500);
  }
};

// GET /api/clientes/historique
export const getHistorique = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cliente = await prisma.cliente.findFirst({ where: { userId: req.user!.userId } });
    if (!cliente) { sendError(res, 'Profil non trouvé', 404); return; }

    // Pagination: max 50 per page
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [rdvs, total] = await Promise.all([
      prisma.rendezVous.findMany({
        where: { clienteId: cliente.id },
        include: {
          services: { include: { service: true } },
          coiffeuse: { select: { nom: true, prenom: true, photoUrl: true } },
          avis: true,
        },
        orderBy: { dateHeure: 'desc' },
        skip,
        take: limit,
      }),
      prisma.rendezVous.count({ where: { clienteId: cliente.id } }),
    ]);

    sendSuccess(res, { rdvs, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    sendError(res, 'Erreur récupération historique', 500);
  }
};

// POST /api/clientes/avis
export const creerAvis = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rendezVousId, note, commentaire } = req.body;

    const cliente = await prisma.cliente.findFirst({ where: { userId: req.user!.userId } });
    if (!cliente) { sendError(res, 'Profil non trouvé', 404); return; }

    // Vérifier que le RDV est terminé et appartient à la cliente
    const rdv = await prisma.rendezVous.findFirst({
      where: { id: rendezVousId, clienteId: cliente.id, statut: 'TERMINE' },
    });

    if (!rdv) {
      sendError(res, 'Rendez-vous non trouvé ou non terminé', 404);
      return;
    }

    // Vérifier qu'un avis n'existe pas déjà
    const existingAvis = await prisma.avis.findUnique({ where: { rendezVousId } });
    if (existingAvis) {
      sendError(res, 'Un avis existe déjà pour ce rendez-vous', 409);
      return;
    }

    if (note < 1 || note > 5) {
      sendError(res, 'La note doit être entre 1 et 5', 400);
      return;
    }

    const avis = await prisma.avis.create({
      data: {
        rendezVousId,
        clienteId: cliente.id,
        coiffeuseId: rdv.coiffeuseId,
        note,
        commentaire,
      },
    });

    sendSuccess(res, avis, 201);
  } catch (error) {
    sendError(res, 'Erreur création avis', 500);
  }
};
