import { Request, Response } from 'express';
import { Prisma } from '../generated/prisma';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/responses';
import { AuthRequest } from '../middleware/auth';

// POST /api/rendez-vous/presentiel — walk-in (coiffeuse/admin saisie rapide)
export const createRdvPresentiel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { walkInNom, walkInTelephone, serviceIds, dateHeure, note, coiffeuseId: targetCoiffeuseId } = req.body;

    if (!walkInNom?.trim()) {
      sendError(res, 'Nom du client requis', 400);
      return;
    }
    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      sendError(res, 'Sélectionnez au moins un service', 400);
      return;
    }

    let coiffeuseId: string;
    if (req.user!.role === 'ADMIN' && targetCoiffeuseId) {
      coiffeuseId = targetCoiffeuseId;
    } else {
      const coiffeuse = await prisma.coiffeuse.findFirst({ where: { userId: req.user!.userId } });
      if (!coiffeuse) { sendError(res, 'Profil coiffeuse non trouvé', 404); return; }
      coiffeuseId = coiffeuse.id;
    }

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, actif: true },
    });
    if (services.length === 0) {
      sendError(res, 'Aucun service valide sélectionné', 400);
      return;
    }

    const dureeTotale = services.reduce((sum, s) => sum + s.dureeMinutes, 0);
    const prixTotal = services.reduce((sum, s) => sum + Number(s.prixBase), 0);
    const dateHeureDebut = new Date(dateHeure);
    const dateHeureFin = new Date(dateHeureDebut.getTime() + dureeTotale * 60 * 1000);

    // Atomic check-and-create with Serializable isolation to prevent double-booking
    let rdv;
    try {
      rdv = await prisma.$transaction(async (tx) => {
        const conflit = await tx.rendezVous.findFirst({
          where: {
            coiffeuseId,
            statut: { notIn: ['ANNULE_CLIENT', 'ANNULE_SALON'] },
            OR: [
              { dateHeure: { lte: dateHeureDebut }, dateHeureFin: { gt: dateHeureDebut } },
              { dateHeure: { lt: dateHeureFin }, dateHeureFin: { gte: dateHeureFin } },
              { dateHeure: { gte: dateHeureDebut }, dateHeureFin: { lte: dateHeureFin } },
            ],
          },
        });
        if (conflit) {
          throw Object.assign(new Error('SLOT_TAKEN'), { code: 'SLOT_TAKEN' });
        }

        return tx.rendezVous.create({
          data: {
            clienteId: null,
            walkInNom: walkInNom.trim(),
            walkInTelephone: walkInTelephone?.trim() || null,
            typeRdv: 'PRESENTIEL',
            coiffeuseId,
            dateHeure: dateHeureDebut,
            dureeEstimee: dureeTotale,
            dateHeureFin,
            prixTotal,
            statut: 'EN_COURS',
            note: note || null,
            services: {
              create: services.map((s) => ({
                serviceId: s.id,
                prixApplique: s.prixBase,
                dureeMinutes: s.dureeMinutes,
              })),
            },
          },
          include: {
            services: { include: { service: true } },
            coiffeuse: { select: { nom: true, prenom: true } },
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (txErr: any) {
      if (txErr?.code === 'SLOT_TAKEN') {
        sendError(res, 'Ce créneau est déjà occupé', 409);
        return;
      }
      throw txErr;
    }

    sendSuccess(res, rdv, 201);
  } catch (error) {
    console.error('Erreur création RDV présentiel:', error);
    sendError(res, 'Erreur lors de la création du RDV', 500);
  }
};

// POST /api/rendez-vous
export const createRendezVous = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { coiffeuseId, dateHeure, serviceIds, note } = req.body;

    // Validate date is in the future
    const dateHeureDebut = new Date(dateHeure);
    if (dateHeureDebut <= new Date()) {
      sendError(res, 'La date du rendez-vous doit être dans le futur', 400);
      return;
    }

    // 1. Récupérer la cliente
    const cliente = await prisma.cliente.findFirst({
      where: { userId: req.user!.userId },
    });

    if (!cliente) {
      sendError(res, 'Profil cliente non trouvé', 404);
      return;
    }

    // 2. Récupérer les services demandés
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, actif: true },
      include: { options: true },
    });

    if (services.length === 0) {
      sendError(res, 'Aucun service valide sélectionné', 400);
      return;
    }

    // 3. Calculer durée et prix
    const dureeTotale = services.reduce((sum: number, s) => sum + s.dureeMinutes, 0);
    const prixTotal = services.reduce((sum: number, s) => sum + Number(s.prixBase), 0);

    const dateHeureFin = new Date(dateHeureDebut.getTime() + dureeTotale * 60 * 1000);

    // 3b. Validate against coiffeuse availability (business hours)
    const jourSemaine = dateHeureDebut.getDay(); // 0=Sunday … 6=Saturday
    const disponibilite = await prisma.disponibilite.findFirst({
      where: { coiffeuseId, jourSemaine },
    });

    if (!disponibilite) {
      sendError(res, 'La coiffeuse n\'est pas disponible ce jour', 400);
      return;
    }

    const [hd, md] = disponibilite.heureDebut.split(':').map(Number);
    const [hf, mf] = disponibilite.heureFin.split(':').map(Number);
    const slotStartMin = dateHeureDebut.getHours() * 60 + dateHeureDebut.getMinutes();
    const slotEndMin = dateHeureFin.getHours() * 60 + dateHeureFin.getMinutes();
    const dispoStartMin = hd * 60 + md;
    const dispoEndMin = hf * 60 + mf;

    if (slotStartMin < dispoStartMin || slotEndMin > dispoEndMin) {
      sendError(res, 'Le créneau est en dehors des horaires de la coiffeuse', 400);
      return;
    }

    // 4 + 5. Atomic check-and-create with serializable isolation → prevents double-booking
    let rdv;
    try {
      rdv = await prisma.$transaction(async (tx) => {
        // Re-check for conflicting appointment inside the transaction
        const conflit = await tx.rendezVous.findFirst({
          where: {
            coiffeuseId,
            statut: { notIn: ['ANNULE_CLIENT', 'ANNULE_SALON'] },
            OR: [
              {
                dateHeure: { lte: dateHeureDebut },
                dateHeureFin: { gt: dateHeureDebut },
              },
              {
                dateHeure: { lt: dateHeureFin },
                dateHeureFin: { gte: dateHeureFin },
              },
              {
                dateHeure: { gte: dateHeureDebut },
                dateHeureFin: { lte: dateHeureFin },
              },
            ],
          },
        });

        if (conflit) {
          throw Object.assign(new Error('SLOT_TAKEN'), { code: 'SLOT_TAKEN' });
        }

        return tx.rendezVous.create({
          data: {
            clienteId: cliente.id,
            coiffeuseId,
            dateHeure: dateHeureDebut,
            dureeEstimee: dureeTotale,
            dateHeureFin,
            prixTotal,
            note,
            services: {
              create: services.map((s) => ({
                serviceId: s.id,
                prixApplique: s.prixBase,
                dureeMinutes: s.dureeMinutes,
              })),
            },
          },
          include: {
            services: { include: { service: true } },
            coiffeuse: { select: { nom: true, prenom: true } },
            cliente: { select: { nom: true, prenom: true, telephone: true } },
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (txErr: any) {
      if (txErr?.code === 'SLOT_TAKEN') {
        sendError(res, 'Ce créneau n\'est plus disponible', 409);
        return;
      }
      throw txErr;
    }

    sendSuccess(res, rdv, 201);
  } catch (error) {
    console.error('Erreur création RDV:', error);
    sendError(res, 'Erreur lors de la réservation', 500);
  }
};

// GET /api/rendez-vous (selon rôle)
export const getRendezVous = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { statut, date, coiffeuseId } = req.query;
    const where: any = {};

    // Filtrage par rôle
    if (req.user!.role === 'CLIENTE') {
      const cliente = await prisma.cliente.findFirst({ where: { userId: req.user!.userId } });
      if (!cliente) { sendError(res, 'Profil non trouvé', 404); return; }
      where.clienteId = cliente.id;
    } else if (req.user!.role === 'COIFFEUSE') {
      const coiffeuse = await prisma.coiffeuse.findFirst({ where: { userId: req.user!.userId } });
      if (!coiffeuse) { sendError(res, 'Profil non trouvé', 404); return; }
      where.coiffeuseId = coiffeuse.id;
    }
    // ADMIN voit tout

    if (statut) where.statut = statut;
    if (coiffeuseId && req.user!.role === 'ADMIN') where.coiffeuseId = coiffeuseId;

    if (date) {
      const d = new Date(date as string);
      const debut = new Date(d); debut.setHours(0, 0, 0, 0);
      const fin = new Date(d); fin.setHours(23, 59, 59, 999);
      where.dateHeure = { gte: debut, lte: fin };
    }

    const rdvs = await prisma.rendezVous.findMany({
      where,
      include: {
        services: { include: { service: true } },
        coiffeuse: { select: { id: true, nom: true, prenom: true, photoUrl: true } },
        cliente: { select: { id: true, nom: true, prenom: true, telephone: true } },
      },
      orderBy: { dateHeure: 'asc' },
    });

    sendSuccess(res, rdvs);
  } catch (error) {
    sendError(res, 'Erreur récupération rendez-vous', 500);
  }
};

// GET /api/rendez-vous/:id
export const getRendezVousById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rdv = await prisma.rendezVous.findUnique({
      where: { id: req.params.id as string },
      include: {
        services: { include: { service: true, option: true } },
        coiffeuse: { select: { id: true, nom: true, prenom: true, photoUrl: true, specialites: true, userId: true } },
        cliente: { select: { id: true, nom: true, prenom: true, telephone: true, typeCheveux: true, userId: true } },
        avis: true,
      },
    });

    if (!rdv) {
      sendError(res, 'Rendez-vous non trouvé', 404);
      return;
    }

    // Ownership check: CLIENTE can only see their own RDVs, COIFFEUSE only hers
    if (req.user!.role === 'CLIENTE' && rdv.cliente?.userId !== req.user!.userId) {
      sendError(res, 'Accès non autorisé', 403);
      return;
    }
    if (req.user!.role === 'COIFFEUSE' && rdv.coiffeuse?.userId !== req.user!.userId) {
      sendError(res, 'Accès non autorisé', 403);
      return;
    }

    sendSuccess(res, rdv);
  } catch (error) {
    sendError(res, 'Erreur serveur', 500);
  }
};

// PATCH /api/rendez-vous/:id/statut
export const updateStatutRDV = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { statut } = req.body;
    const validStatuts = ['EN_ATTENTE', 'CONFIRME', 'EN_COURS', 'TERMINE', 'ANNULE_CLIENT', 'ANNULE_SALON', 'NO_SHOW'];

    if (!validStatuts.includes(statut)) {
      sendError(res, 'Statut invalide', 400);
      return;
    }

    // Fetch existing RDV to check previous status
    const existing = await prisma.rendezVous.findUnique({
      where: { id: req.params.id as string },
      include: {
        services: { include: { service: { include: { consommations: { include: { produit: true } } } } } },
        coiffeuse: { select: { id: true, userId: true } },
      },
    });

    if (!existing) {
      sendError(res, 'Rendez-vous non trouvé', 404);
      return;
    }

    // Ownership check: COIFFEUSE can only update status of her own RDVs
    if (req.user!.role === 'COIFFEUSE' && existing.coiffeuse?.userId !== req.user!.userId) {
      sendError(res, 'Accès non autorisé', 403);
      return;
    }

    // Status transition validation — final states cannot change
    const finalStatuts = ['TERMINE', 'ANNULE_CLIENT', 'ANNULE_SALON', 'NO_SHOW'];
    if (finalStatuts.includes(existing.statut)) {
      sendError(res, 'Ce rendez-vous est dans un état final et ne peut plus être modifié', 400);
      return;
    }

    // Valid transitions from each state
    const validTransitions: Record<string, string[]> = {
      'EN_ATTENTE': ['CONFIRME', 'EN_COURS', 'ANNULE_CLIENT', 'ANNULE_SALON', 'NO_SHOW'],
      'CONFIRME': ['EN_COURS', 'ANNULE_CLIENT', 'ANNULE_SALON', 'NO_SHOW'],
      'EN_COURS': ['TERMINE', 'ANNULE_SALON', 'NO_SHOW'],
    };

    const allowed = validTransitions[existing.statut];
    if (!allowed || !allowed.includes(statut)) {
      sendError(res, `Transition de "${existing.statut}" vers "${statut}" non autorisée`, 400);
      return;
    }

    const rdv = await prisma.rendezVous.update({
      where: { id: req.params.id as string },
      data: {
        statut,
        ...(statut === 'TERMINE' && { paiementRecu: true }),
      },
      include: {
        services: { include: { service: true } },
        coiffeuse: { select: { nom: true, prenom: true } },
        cliente: { select: { nom: true, prenom: true } },
      },
    });

    // ── Déduction automatique du stock à la fin du RDV ──────────────────────
    if (statut === 'TERMINE' && existing.statut !== 'TERMINE') {
      const consommationsTotales: { produitId: string; quantite: number }[] = [];

      for (const rs of existing.services) {
        for (const conso of rs.service.consommations) {
          const existing_ = consommationsTotales.find((c) => c.produitId === conso.produitId);
          if (existing_) {
            existing_.quantite += Number(conso.quantite);
          } else {
            consommationsTotales.push({ produitId: conso.produitId, quantite: Number(conso.quantite) });
          }
        }
      }

      // Atomic stock deduction in a single transaction
      if (consommationsTotales.length > 0) {
        await prisma.$transaction(async (tx) => {
          for (const { produitId, quantite } of consommationsTotales) {
            const produit = await tx.produit.findUnique({ where: { id: produitId } });
            if (!produit) continue;
            const newStock = Math.max(0, Number(produit.quantiteStock) - Math.round(quantite));
            await tx.produit.update({
              where: { id: produitId },
              data: { quantiteStock: newStock },
            });
            await tx.mouvementStock.create({
              data: {
                produitId,
                rendezVousId: existing.id,
                coiffeuseId: existing.coiffeuse.id,
                type: 'CONSOMMATION',
                quantite: quantite,
                quantiteAvant: produit.quantiteStock,
                notes: `RDV terminé — déduction automatique`,
              },
            });
          }
        });
      }
    }

    sendSuccess(res, rdv);
  } catch (error) {
    sendError(res, 'Erreur mise à jour statut', 500);
  }
};

// DELETE /api/rendez-vous/:id (annulation)
export const annulerRendezVous = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rdv = await prisma.rendezVous.findUnique({
      where: { id: req.params.id as string },
      include: {
        cliente: { select: { userId: true } },
        coiffeuse: { select: { userId: true } },
      },
    });

    if (!rdv) {
      sendError(res, 'Rendez-vous non trouvé', 404);
      return;
    }

    // Ownership check
    if (req.user!.role === 'CLIENTE' && rdv.cliente?.userId !== req.user!.userId) {
      sendError(res, 'Accès non autorisé', 403);
      return;
    }
    if (req.user!.role === 'COIFFEUSE' && rdv.coiffeuse?.userId !== req.user!.userId) {
      sendError(res, 'Accès non autorisé', 403);
      return;
    }

    if (['TERMINE', 'ANNULE_CLIENT', 'ANNULE_SALON'].includes(rdv.statut)) {
      sendError(res, 'Ce rendez-vous ne peut plus être annulé', 400);
      return;
    }

    // Server-side cancellation delay enforcement (CLIENTE only; COIFFEUSE/ADMIN can cancel anytime)
    if (req.user!.role === 'CLIENTE') {
      const params = await prisma.salonParametres.findFirst({ select: { delaiAnnulationH: true } });
      const delaiH = params?.delaiAnnulationH ?? 24;
      const hoursUntilRdv = (new Date(rdv.dateHeure).getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilRdv < delaiH) {
        sendError(res, `Annulation impossible : le rendez-vous commence dans moins de ${delaiH}h`, 400);
        return;
      }
    }

    const statut = req.user!.role === 'CLIENTE' ? 'ANNULE_CLIENT' : 'ANNULE_SALON';

    const updated = await prisma.rendezVous.update({
      where: { id: req.params.id as string },
      data: { statut },
    });

    sendSuccess(res, updated);
  } catch (error) {
    sendError(res, 'Erreur annulation', 500);
  }
};

// POST /api/rendez-vous/:id/matieres — saisie manuelle des produits utilisés par la coiffeuse
export const logMatieres = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rdvId = req.params.id as string;
    const { matieres } = req.body as { matieres: { produitId: string; quantite: number }[] };

    if (!Array.isArray(matieres) || matieres.length === 0) {
      sendError(res, 'Aucune matière fournie', 400);
      return;
    }

    const rdv = await prisma.rendezVous.findUnique({
      where: { id: rdvId },
      select: { id: true, coiffeuseId: true, statut: true },
    });
    if (!rdv) { sendError(res, 'Rendez-vous non trouvé', 404); return; }
    if (!['EN_COURS', 'TERMINE'].includes(rdv.statut)) {
      sendError(res, 'Le rendez-vous doit être en cours ou terminé', 400);
      return;
    }

    // Vérifier que l'utilisateur est la coiffeuse du RDV ou un admin
    if (req.user!.role === 'COIFFEUSE') {
      const coiffeuse = await prisma.coiffeuse.findUnique({
        where: { userId: req.user!.userId },
        select: { id: true },
      });
      if (!coiffeuse || coiffeuse.id !== rdv.coiffeuseId) {
        sendError(res, 'Non autorisé', 403);
        return;
      }
    }

    // Créer les mouvements et déduire le stock
    await prisma.$transaction(async (tx) => {
      for (const { produitId, quantite } of matieres) {
        if (!produitId || quantite <= 0) continue;
        const produit = await tx.produit.findUnique({ where: { id: produitId }, select: { quantiteStock: true } });
        if (!produit) continue;
        const quantiteAvant = Number(produit.quantiteStock);
        await tx.produit.update({
          where: { id: produitId },
          data: { quantiteStock: Math.max(0, quantiteAvant - quantite) },
        });
        await tx.mouvementStock.create({
          data: {
            produitId,
            rendezVousId: rdvId,
            coiffeuseId: rdv.coiffeuseId,
            type: 'CONSOMMATION',
            quantite,
            quantiteAvant,
            notes: 'Saisie manuelle coiffeuse',
          },
        });
      }
    });

    sendSuccess(res, { logged: true });
  } catch (error) {
    sendError(res, 'Erreur enregistrement matières', 500);
  }
};
