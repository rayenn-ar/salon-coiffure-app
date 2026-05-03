import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError, sendPaginated } from '../utils/responses';

const VALID_CATEGORIES = new Set([
  'COUPE',
  'COLORATION',
  'SOIN',
  'COIFFAGE_EVENEMENT',
  'EXTENSION',
  'FORFAIT',
]);

// GET /api/services
export const getAllServices = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categorie, actif } = req.query;

    const where: any = {};
    if (categorie) {
      const category = String(categorie).trim();
      if (!VALID_CATEGORIES.has(category)) {
        sendError(res, 'Catégorie invalide', 400);
        return;
      }
      where.categorie = category;
    }
    if (actif === 'all') {
      // Pas de filtre actif — admin voit tout
    } else if (actif !== undefined) {
      where.actif = actif === 'true';
    } else {
      where.actif = true;
    }

    const services = await prisma.service.findMany({
      where,
      include: { options: true },
      orderBy: { categorie: 'asc' },
    });

    sendSuccess(res, services);
  } catch (error) {
    sendError(res, 'Erreur récupération services', 500);
  }
};

// GET /api/services/:id
export const getService = async (req: Request, res: Response): Promise<void> => {
  try {
    const service = await prisma.service.findUnique({
      where: { id: req.params.id as string },
      include: { options: true },
    });

    if (!service) {
      sendError(res, 'Service non trouvé', 404);
      return;
    }

    sendSuccess(res, service);
  } catch (error) {
    sendError(res, 'Erreur serveur', 500);
  }
};

// POST /api/services (Admin)
export const createService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nom, categorie, description, prixBase, dureeMinutes, specialitesRequises, options } = req.body;

    const service = await prisma.service.create({
      data: {
        nom,
        categorie,
        description,
        prixBase,
        dureeMinutes,
        specialitesRequises: specialitesRequises || [],
        options: options ? { create: options } : undefined,
      },
      include: { options: true },
    });

    sendSuccess(res, service, 201);
  } catch (error) {
    console.error('Erreur création service:', error);
    sendError(res, 'Erreur création service', 500);
  }
};

// PUT /api/services/:id (Admin)
export const updateService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nom, categorie, description, prixBase, dureeMinutes, specialitesRequises, actif } = req.body;

    const service = await prisma.service.update({
      where: { id: req.params.id as string },
      data: {
        ...(nom && { nom }),
        ...(categorie && { categorie }),
        ...(description !== undefined && { description }),
        ...(prixBase !== undefined && { prixBase }),
        ...(dureeMinutes !== undefined && { dureeMinutes }),
        ...(specialitesRequises && { specialitesRequises }),
        ...(actif !== undefined && { actif }),
      },
      include: { options: true },
    });

    sendSuccess(res, service);
  } catch (error) {
    sendError(res, 'Erreur mise à jour service', 500);
  }
};

// DELETE /api/services/:id (Admin)
export const deleteService = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.service.update({
      where: { id: req.params.id as string },
      data: { actif: false },
    });

    sendSuccess(res, { message: 'Service désactivé' });
  } catch (error) {
    sendError(res, 'Erreur suppression service', 500);
  }
};
