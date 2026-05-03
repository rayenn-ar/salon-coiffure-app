import { Request, Response } from 'express';
import prisma from '../config/database';
import argon2 from 'argon2';
import { sendSuccess, sendError } from '../utils/responses';

// GET /api/admin/dashboard
export const getDashboard = async (_req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Semaine (lundi–dimanche)
    const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const debutSemaine = new Date(today);
    debutSemaine.setDate(today.getDate() - dayOfWeek);
    const finSemaine = new Date(debutSemaine);
    finSemaine.setDate(debutSemaine.getDate() + 7);

    const debutMois = new Date(today.getFullYear(), today.getMonth(), 1);

    const moisActuel = today.getMonth() + 1;
    const anneeActuelle = today.getFullYear();

    const [
      rdvAujourdhui,
      rdvEnAttente,
      rdvSemaine,
      totalClientes,
      totalCoiffeuses,
      caAujourdhui,
      caMois,
      alertesStock,
      depensesMois,
    ] = await Promise.all([
      prisma.rendezVous.count({
        where: { dateHeure: { gte: today, lt: tomorrow }, statut: { notIn: ['ANNULE_CLIENT', 'ANNULE_SALON'] } },
      }),
      prisma.rendezVous.count({
        where: { statut: 'CONFIRME', dateHeure: { gte: today } },
      }),
      prisma.rendezVous.count({
        where: { dateHeure: { gte: debutSemaine, lt: finSemaine }, statut: { notIn: ['ANNULE_CLIENT', 'ANNULE_SALON'] } },
      }),
      prisma.cliente.count(),
      prisma.coiffeuse.count({ where: { actif: true } }),
      prisma.rendezVous.aggregate({
        where: { dateHeure: { gte: today, lt: tomorrow }, statut: 'TERMINE' },
        _sum: { prixTotal: true },
      }),
      prisma.rendezVous.aggregate({
        where: { dateHeure: { gte: debutMois }, statut: 'TERMINE' },
        _sum: { prixTotal: true },
      }),
      prisma.produit.findMany({
        where: { actif: true },
        select: { quantiteStock: true, quantiteAlerte: true },
      }).then((ps) => ps.filter((p) => Number(p.quantiteStock) <= p.quantiteAlerte).length),
      prisma.depense.aggregate({
        where: { mois: moisActuel, annee: anneeActuelle },
        _sum: { montant: true },
      }),
    ]);

    const chiffreAffairesMois = Number(caMois._sum.prixTotal || 0);
    const totalDepensesMois = Number(depensesMois._sum.montant || 0);

    // Dépenses prévues dont la date est arrivée mais pas encore payées
    const depensesDues = await prisma.depense.findMany({
      where: {
        payee: false,
        dateDepense: { lte: tomorrow },
      },
      select: {
        id: true,
        label: true,
        montant: true,
        type: true,
        dateDepense: true,
        coiffeuse: { select: { prenom: true, nom: true } },
      },
      orderBy: { dateDepense: 'asc' },
    });

    sendSuccess(res, {
      rdvAujourdhui,
      rdvEnAttente,
      rdvSemaine,
      totalClientes,
      totalCoiffeuses,
      caAujourdhui: Number(caAujourdhui._sum.prixTotal || 0),
      caMois: chiffreAffairesMois,
      chiffreAffairesMois,
      alertesStock,
      totalDepensesMois,
      revenuNetMois: chiffreAffairesMois - totalDepensesMois,
      depensesDues,
    });
  } catch (error) {
    sendError(res, 'Erreur dashboard', 500);
  }
};

// GET /api/admin/clients
export const getClientes = async (_req: Request, res: Response): Promise<void> => {
  try {
    const clientes = await prisma.cliente.findMany({
      select: {
        id: true,
        nom: true,
        prenom: true,
        telephone: true,
        typeCheveux: true,
        createdAt: true,
        user: { select: { email: true, createdAt: true } },
        _count: { select: { rendezVous: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, clientes);
  } catch (error) {
    sendError(res, 'Erreur récupération clientes', 500);
  }
};

// GET /api/admin/coiffeuses/list
export const getCoiffeusesAdmin = async (_req: Request, res: Response): Promise<void> => {
  try {
    const coiffeuses = await prisma.coiffeuse.findMany({
      select: {
        id: true,
        nom: true,
        prenom: true,
        niveau: true,
        actif: true,
        specialites: true,
        salaire: true,
        user: { select: { email: true, actif: true } },
      },
      orderBy: { nom: 'asc' },
    });
    sendSuccess(res, coiffeuses);
  } catch (error) {
    sendError(res, 'Erreur récupération coiffeuses', 500);
  }
};

// POST /api/admin/coiffeuses
export const createCoiffeuse = async (_req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, nom, prenom, bio, specialites, niveau } = _req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      sendError(res, 'Cet email est déjà utilisé', 409);
      return;
    }

    const hashedPassword = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
      hashLength: 32,
    });
    const { salaire } = _req.body;

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'COIFFEUSE',
        mustChangePassword: true,
        coiffeuse: {
          create: {
            nom,
            prenom,
            bio,
            specialites: specialites || [],
            niveau: niveau || 'CONFIRMEE',
            salaire: salaire ? parseFloat(salaire) : null,
          },
        },
      },
      include: { coiffeuse: true },
    });

    sendSuccess(res, {
      id: user.coiffeuse!.id,
      email: user.email,
      nom: user.coiffeuse!.nom,
      prenom: user.coiffeuse!.prenom,
      specialites: user.coiffeuse!.specialites,
    }, 201);
  } catch (error) {
    console.error('Erreur création coiffeuse:', error);
    sendError(res, 'Erreur création coiffeuse', 500);
  }
};

// GET /api/admin/stats
export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { debut, fin } = req.query;
    const dateDebut = debut ? new Date(debut as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dateFin = fin ? new Date(fin as string) : new Date();

    // Stats par coiffeuse
    const statsCoiffeuses = await prisma.coiffeuse.findMany({
      where: { actif: true },
      select: {
        id: true,
        nom: true,
        prenom: true,
        rendezVous: {
          where: {
            dateHeure: { gte: dateDebut, lte: dateFin },
            statut: 'TERMINE',
          },
          select: { prixTotal: true },
        },
        avisRecus: { select: { note: true } },
      },
    });

    const result = statsCoiffeuses.map((c) => ({
      id: c.id,
      prenom: c.prenom,
      nom: c.nom,
      nbRdv: c.rendezVous.length,
      ca: c.rendezVous.reduce((sum: number, r) => sum + Number(r.prixTotal), 0),
      noteMoyenne: c.avisRecus.length > 0
        ? (c.avisRecus.reduce((sum: number, a) => sum + a.note, 0) / c.avisRecus.length).toFixed(1)
        : null,
    }));

    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 'Erreur statistiques', 500);
  }
};

// GET /api/admin/produits
export const getProduits = async (_req: Request, res: Response): Promise<void> => {
  try {
    const produits = await prisma.produit.findMany({
      where: { actif: true },
      orderBy: { categorie: 'asc' },
      include: {
        consommations: {
          select: {
            quantite: true,
            service: { select: { id: true, nom: true } },
          },
        },
      },
    });

    const alertes = produits.filter((p) => Number(p.quantiteStock) <= p.quantiteAlerte);

    sendSuccess(res, { produits, alertes });
  } catch (error) {
    sendError(res, 'Erreur récupération produits', 500);
  }
};

// POST /api/admin/produits
export const createProduit = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nom, marque, categorie, description, unite, quantiteAlerte, quantiteStock, prixAchatUnite } = req.body;
    const produit = await prisma.produit.create({
      data: {
        nom,
        marque: marque || null,
        categorie,
        description: description || null,
        unite,
        quantiteAlerte: quantiteAlerte ? Number(quantiteAlerte) : 5,
        quantiteStock: quantiteStock ? Number(quantiteStock) : 0,
        prixAchatUnite: prixAchatUnite ? Number(prixAchatUnite) : null,
      },
    });
    sendSuccess(res, produit, 201);
  } catch (error) {
    sendError(res, 'Erreur création produit', 500);
  }
};

// PATCH /api/admin/produits/:id (full update)
export const updateProduit = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nom, marque, categorie, description, unite, quantiteAlerte, quantiteStock, prixAchatUnite } = req.body;
    const updated = await prisma.produit.update({
      where: { id: req.params.id as string },
      data: {
        ...(nom !== undefined && { nom }),
        ...(marque !== undefined && { marque }),
        ...(categorie !== undefined && { categorie }),
        ...(description !== undefined && { description }),
        ...(unite !== undefined && { unite }),
        ...(quantiteAlerte !== undefined && { quantiteAlerte: Number(quantiteAlerte) }),
        ...(quantiteStock !== undefined && { quantiteStock: Number(quantiteStock) }),
        ...(prixAchatUnite !== undefined && { prixAchatUnite }),
      },
    });
    sendSuccess(res, updated);
  } catch (error) {
    sendError(res, 'Erreur modification produit', 500);
  }
};

// GET /api/admin/stats/graphique
export const getStatsGraphique = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Derniers 7 jours
    const days: { label: string; rdv: number; ca: number }[] = [];
    const joursFr = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const nextD = new Date(d); nextD.setDate(d.getDate() + 1);
      const [rdv, ca] = await Promise.all([
        prisma.rendezVous.count({ where: { dateHeure: { gte: d, lt: nextD }, statut: { notIn: ['ANNULE_CLIENT', 'ANNULE_SALON'] } } }),
        prisma.rendezVous.aggregate({ where: { dateHeure: { gte: d, lt: nextD }, statut: 'TERMINE' }, _sum: { prixTotal: true } }),
      ]);
      days.push({ label: joursFr[d.getDay()], rdv, ca: Number(ca._sum.prixTotal || 0) });
    }

    // 6 derniers mois CA
    const moisFr = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const caParMois: { mois: string; ca: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      const debut = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const fin = new Date(d.getFullYear(), d.getMonth() - i + 1, 0, 23, 59, 59);
      const ca = await prisma.rendezVous.aggregate({
        where: { dateHeure: { gte: debut, lte: fin }, statut: 'TERMINE' },
        _sum: { prixTotal: true },
      });
      caParMois.push({ mois: moisFr[debut.getMonth()], ca: Number(ca._sum.prixTotal || 0) });
    }

    // RDV par statut
    const statutsAll = ['EN_ATTENTE', 'CONFIRME', 'EN_COURS', 'TERMINE', 'ANNULE_CLIENT', 'ANNULE_SALON', 'NO_SHOW'];
    const rdvParStatutRaw = await prisma.rendezVous.groupBy({
      by: ['statut'],
      _count: { id: true },
    });
    const countMap: Record<string, number> = {};
    rdvParStatutRaw.forEach((r) => { countMap[r.statut] = r._count.id; });
    const rdvParStatut = statutsAll.map((s) => ({ statut: s.replace(/_/g, ' '), count: countMap[s] || 0 }));

    sendSuccess(res, { rdvParJour: days, caParMois, rdvParStatut });
  } catch (error) {
    sendError(res, 'Erreur stats graphique', 500);
  }
};

// PATCH /api/admin/produits/:id/stock
export const updateStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const { quantite, operation } = req.body; // operation: "add" | "set"

    const produit = await prisma.produit.findUnique({ where: { id: req.params.id as string } });
    if (!produit) { sendError(res, 'Produit non trouvé', 404); return; }

    const newQte = operation === 'add' ? produit.quantiteStock + quantite : quantite;

    const updated = await prisma.produit.update({
      where: { id: req.params.id as string },
      data: { quantiteStock: Math.max(0, newQte) },
    });

    sendSuccess(res, updated);
  } catch (error) {
    sendError(res, 'Erreur mise à jour stock', 500);
  }
};

// GET /api/admin/services/:serviceId/ingredients
export const getServiceIngredients = async (req: Request, res: Response): Promise<void> => {
  try {
    const serviceId = req.params.serviceId as string;
    const items = await prisma.consommationProduit.findMany({
      where: { serviceId },
      include: {
        produit: {
          select: { id: true, nom: true, unite: true, quantiteStock: true, quantiteAlerte: true, categorie: true },
        },
      },
    });
    sendSuccess(res, items);
  } catch (error) {
    sendError(res, 'Erreur ingrédients du service', 500);
  }
};

// PUT /api/admin/services/:serviceId/ingredients  (upsert)
export const upsertServiceIngredient = async (req: Request, res: Response): Promise<void> => {
  try {
    const serviceId = req.params.serviceId as string;
    const { produitId, quantite } = req.body;

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) { sendError(res, 'Service non trouvé', 404); return; }

    const produit = await prisma.produit.findUnique({ where: { id: produitId } });
    if (!produit) { sendError(res, 'Produit non trouvé', 404); return; }

    const result = await prisma.consommationProduit.upsert({
      where: { serviceId_produitId: { serviceId, produitId } },
      create: { serviceId, produitId, quantite },
      update: { quantite },
      include: {
        produit: {
          select: { id: true, nom: true, unite: true, quantiteStock: true, quantiteAlerte: true, categorie: true },
        },
      },
    });
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 'Erreur ajout ingrédient', 500);
  }
};

// DELETE /api/admin/services/:serviceId/ingredients/:produitId
export const deleteServiceIngredient = async (req: Request, res: Response): Promise<void> => {
  try {
    const serviceId = req.params.serviceId as string;
    const produitId = req.params.produitId as string;
    await prisma.consommationProduit.delete({
      where: { serviceId_produitId: { serviceId, produitId } },
    });
    sendSuccess(res, { deleted: true });
  } catch (error) {
    sendError(res, 'Erreur suppression ingrédient', 500);
  }
};

// DELETE /api/admin/coiffeuses/:id — retire la coiffeuse de l'équipe (soft-delete)
export const deleteCoiffeuse = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const coiffeuse = await prisma.coiffeuse.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!coiffeuse) { sendError(res, 'Coiffeuse non trouvée', 404); return; }

    // Soft-delete: désactive la coiffeuse ET son compte utilisateur
    // + annule tous ses futurs RDVs en attente / confirmés
    await prisma.$transaction([
      prisma.rendezVous.updateMany({
        where: {
          coiffeuseId: id,
          dateHeure: { gt: new Date() },
          statut: { in: ['EN_ATTENTE', 'CONFIRME'] },
        },
        data: { statut: 'ANNULE_SALON' },
      }),
      prisma.coiffeuse.update({ where: { id }, data: { actif: false } }),
      prisma.user.update({ where: { id: coiffeuse.userId }, data: { actif: false } }),
    ]);

    sendSuccess(res, { deleted: true });
  } catch (error) {
    sendError(res, 'Erreur suppression coiffeuse', 500);
  }
};

// GET /api/admin/stock/mouvements — historique des mouvements de stock
export const getMouvementsStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const { produitId, coiffeuseId, limit } = req.query;

    const mouvements = await prisma.mouvementStock.findMany({
      where: {
        ...(produitId ? { produitId: produitId as string } : {}),
        ...(coiffeuseId ? { coiffeuseId: coiffeuseId as string } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? Math.min(Number(limit), 500) : 100,
      include: {
        produit: { select: { nom: true, unite: true, marque: true } },
        coiffeuse: { select: { prenom: true, nom: true } },
        rendezVous: { select: { id: true, dateHeure: true, cliente: { select: { prenom: true, nom: true } } } },
      },
    });

    sendSuccess(res, mouvements);
  } catch (error) {
    sendError(res, 'Erreur mouvements stock', 500);
  }
};

// GET /api/admin/parametres
export const getSalonParametres = async (_req: Request, res: Response): Promise<void> => {
  try {
    let params = await prisma.salonParametres.findFirst();
    if (!params) {
      params = await prisma.salonParametres.create({ data: {} });
    }
    sendSuccess(res, params);
  } catch (error) {
    sendError(res, 'Erreur paramètres salon', 500);
  }
};

// PUT /api/admin/parametres
export const updateSalonParametres = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nomSalon, slogan, adresse, ville, telephone, emailContact, description,
            googleMapsUrl, horaireOuverture, dureeSlotMin, avanceMaxJours, delaiAnnulationH } = req.body;
    const data: Record<string, unknown> = {};
    if (nomSalon !== undefined) data.nomSalon = nomSalon;
    if (slogan !== undefined) data.slogan = slogan;
    if (adresse !== undefined) data.adresse = adresse;
    if (ville !== undefined) data.ville = ville;
    if (telephone !== undefined) data.telephone = telephone;
    if (emailContact !== undefined) data.emailContact = emailContact;
    if (description !== undefined) data.description = description;
    if (googleMapsUrl !== undefined) data.googleMapsUrl = googleMapsUrl;
    if (horaireOuverture !== undefined) data.horaireOuverture = horaireOuverture;
    if (dureeSlotMin !== undefined) data.dureeSlotMin = Number(dureeSlotMin);
    if (avanceMaxJours !== undefined) data.avanceMaxJours = Number(avanceMaxJours);
    if (delaiAnnulationH !== undefined) data.delaiAnnulationH = Number(delaiAnnulationH);

    const existing = await prisma.salonParametres.findFirst();
    const updated = existing
      ? await prisma.salonParametres.update({ where: { id: existing.id }, data })
      : await prisma.salonParametres.create({ data });
    sendSuccess(res, updated);
  } catch (error) {
    sendError(res, 'Erreur mise à jour paramètres', 500);
  }
};

// ==================== DÉPENSES ====================

// GET /api/admin/depenses?mois=&annee=&coiffeuseId=
export const getDepenses = async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date();
    const mois = req.query.mois ? Number(req.query.mois) : today.getMonth() + 1;
    const annee = req.query.annee ? Number(req.query.annee) : today.getFullYear();
    const coiffeuseId = req.query.coiffeuseId as string | undefined;

    const depenses = await prisma.depense.findMany({
      where: {
        mois,
        annee,
        ...(coiffeuseId ? { coiffeuseId } : {}),
      },
      include: {
        coiffeuse: { select: { id: true, nom: true, prenom: true, salaire: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Résumé par type
    const totalParType: Record<string, number> = {};
    depenses.forEach((d) => {
      totalParType[d.type] = (totalParType[d.type] || 0) + Number(d.montant);
    });
    const total = depenses.reduce((s, d) => s + Number(d.montant), 0);

    // Résumé par coiffeuse (pour voir avances vs salaire)
    const resumeCoiffeuses: Record<string, { prenom: string; nom: string; salaire: number | null; totalDepenses: number; avances: number; net: number }> = {};
    depenses.forEach((d) => {
      if (d.coiffeuseId && d.coiffeuse) {
        if (!resumeCoiffeuses[d.coiffeuseId]) {
          resumeCoiffeuses[d.coiffeuseId] = {
            prenom: d.coiffeuse.prenom,
            nom: d.coiffeuse.nom,
            salaire: d.coiffeuse.salaire ? Number(d.coiffeuse.salaire) : null,
            totalDepenses: 0,
            avances: 0,
            net: 0,
          };
        }
        resumeCoiffeuses[d.coiffeuseId].totalDepenses += Number(d.montant);
        if (d.type === 'AVANCE') resumeCoiffeuses[d.coiffeuseId].avances += Number(d.montant);
      }
    });
    Object.values(resumeCoiffeuses).forEach((r) => {
      r.net = r.salaire !== null ? r.salaire - r.totalDepenses : -r.totalDepenses;
    });

    sendSuccess(res, { depenses, total, totalParType, resumeCoiffeuses: Object.values(resumeCoiffeuses) });
  } catch (error) {
    sendError(res, 'Erreur récupération dépenses', 500);
  }
};

// POST /api/admin/depenses
export const createDepense = async (req: Request, res: Response): Promise<void> => {
  try {
    const { label, montant, type, coiffeuseId, mois, annee, notes, dateDepense } = req.body;
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const effectiveDate = dateDepense ? new Date(dateDepense) : new Date();
    // Si la date prévue est aujourd'hui ou passée → payée immédiatement
    const payee = effectiveDate <= today;

    const depense = await prisma.depense.create({
      data: {
        label,
        montant: parseFloat(montant),
        type: type || 'AUTRE',
        coiffeuseId: coiffeuseId || null,
        mois: mois ? Number(mois) : new Date().getMonth() + 1,
        annee: annee ? Number(annee) : new Date().getFullYear(),
        dateDepense: effectiveDate,
        payee,
        notes: notes || null,
      },
      include: { coiffeuse: { select: { id: true, nom: true, prenom: true } } },
    });
    sendSuccess(res, depense, 201);
  } catch (error) {
    sendError(res, 'Erreur création dépense', 500);
  }
};

// PUT /api/admin/depenses/:id
export const updateDepense = async (req: Request, res: Response): Promise<void> => {
  try {
    const { label, montant, type, coiffeuseId, mois, annee, notes } = req.body;
    const updated = await prisma.depense.update({
      where: { id: req.params.id as string },
      data: {
        ...(label !== undefined && { label }),
        ...(montant !== undefined && { montant: parseFloat(montant) }),
        ...(type !== undefined && { type }),
        ...(coiffeuseId !== undefined && { coiffeuseId: coiffeuseId || null }),
        ...(mois !== undefined && { mois: Number(mois) }),
        ...(annee !== undefined && { annee: Number(annee) }),
        ...(notes !== undefined && { notes }),
      },
      include: { coiffeuse: { select: { id: true, nom: true, prenom: true } } },
    });
    sendSuccess(res, updated);
  } catch (error) {
    sendError(res, 'Erreur modification dépense', 500);
  }
};

// DELETE /api/admin/depenses/:id
export const deleteDepense = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.depense.delete({ where: { id: req.params.id as string } });
    sendSuccess(res, { deleted: true });
  } catch (error) {
    sendError(res, 'Erreur suppression dépense', 500);
  }
};

// PATCH /api/admin/depenses/:id/payer — Marquer une dépense comme payée
export const payerDepense = async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await prisma.depense.update({
      where: { id: req.params.id as string },
      data: { payee: true },
      include: { coiffeuse: { select: { id: true, nom: true, prenom: true } } },
    });
    sendSuccess(res, updated);
  } catch (error) {
    sendError(res, 'Erreur paiement dépense', 500);
  }
};

// PATCH /api/admin/coiffeuses/:id/salaire
export const updateCoiffeureSalaire = async (req: Request, res: Response): Promise<void> => {
  try {
    const { salaire } = req.body;
    const updated = await prisma.coiffeuse.update({
      where: { id: req.params.id as string },
      data: { salaire: salaire !== null && salaire !== undefined ? parseFloat(salaire) : null },
      select: { id: true, nom: true, prenom: true, salaire: true },
    });
    sendSuccess(res, updated);
  } catch (error) {
    sendError(res, 'Erreur mise à jour salaire', 500);
  }
};

// ==================== GESTION COMPTE COIFFEUSE ====================

// PATCH /api/admin/coiffeuses/:id/bloquer
export const toggleBloquerCoiffeuse = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const coiffeuse = await prisma.coiffeuse.findUnique({
      where: { id },
      select: { id: true, userId: true, actif: true, user: { select: { actif: true } } },
    });
    if (!coiffeuse) { sendError(res, 'Coiffeuse non trouvée', 404); return; }

    const newActif = !coiffeuse.user.actif;

    await prisma.$transaction([
      prisma.user.update({ where: { id: coiffeuse.userId }, data: { actif: newActif } }),
      prisma.coiffeuse.update({ where: { id }, data: { actif: newActif } }),
      // Cancel future appointments if blocking
      ...(newActif ? [] : [
        prisma.rendezVous.updateMany({
          where: {
            coiffeuseId: id,
            dateHeure: { gt: new Date() },
            statut: { in: ['EN_ATTENTE', 'CONFIRME'] },
          },
          data: { statut: 'ANNULE_SALON' },
        }),
      ]),
    ]);

    sendSuccess(res, { blocked: !newActif });
  } catch (error) {
    sendError(res, 'Erreur blocage coiffeuse', 500);
  }
};

// DELETE /api/admin/coiffeuses/:id/permanent
export const deleteCoiffeusePermanent = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const coiffeuse = await prisma.coiffeuse.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!coiffeuse) { sendError(res, 'Coiffeuse non trouvée', 404); return; }

    // Cancel all future RDV, then delete user (cascade deletes coiffeuse)
    await prisma.$transaction([
      prisma.rendezVous.updateMany({
        where: {
          coiffeuseId: id,
          dateHeure: { gt: new Date() },
          statut: { in: ['EN_ATTENTE', 'CONFIRME'] },
        },
        data: { statut: 'ANNULE_SALON' },
      }),
      prisma.user.delete({ where: { id: coiffeuse.userId } }),
    ]);

    sendSuccess(res, { deleted: true, permanent: true });
  } catch (error) {
    sendError(res, 'Erreur suppression permanente', 500);
  }
};

// ==================== PARAMÈTRES PUBLICS ====================

// GET /api/parametres/public - Pour afficher les infos dans le footer (pas besoin d'auth)
export const getPublicParametres = async (_req: Request, res: Response): Promise<void> => {
  try {
    let params = await prisma.salonParametres.findFirst();
    if (!params) {
      params = await prisma.salonParametres.create({ data: {} });
    }

    // Formater horaireOuverture JSON → texte lisible pour le footer
    let horairesTexte: string | null = null;
    if (params.horaireOuverture && typeof params.horaireOuverture === 'object') {
      const h = params.horaireOuverture as Record<string, { ouvert: boolean; debut: string; fin: string }>;
      const joursOrdre = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
      const joursLabels: Record<string, string> = { lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim' };

      // Regrouper les jours consécutifs ayant les mêmes horaires
      const groupes: { jours: string[]; debut: string; fin: string; ouvert: boolean }[] = [];
      for (const jour of joursOrdre) {
        const info = h[jour];
        if (!info) continue;
        const last = groupes[groupes.length - 1];
        if (last && last.ouvert === info.ouvert && last.debut === info.debut && last.fin === info.fin) {
          last.jours.push(jour);
        } else {
          groupes.push({ jours: [jour], debut: info.debut || '09:00', fin: info.fin || '19:00', ouvert: info.ouvert });
        }
      }

      const lignes: string[] = [];
      for (const g of groupes) {
        const label = g.jours.length === 1
          ? joursLabels[g.jours[0]]
          : `${joursLabels[g.jours[0]]}-${joursLabels[g.jours[g.jours.length - 1]]}`;
        if (!g.ouvert) {
          lignes.push(`${label} : Fermé`);
        } else {
          const d = g.debut.replace(':', 'h');
          const f = g.fin.replace(':', 'h');
          lignes.push(`${label} : ${d}-${f}`);
        }
      }
      horairesTexte = lignes.join('\n');
    }

    sendSuccess(res, {
      nomSalon: params.nomSalon,
      slogan: params.slogan,
      adresse: params.adresse,
      ville: params.ville,
      telephone: params.telephone,
      emailContact: params.emailContact,
      description: params.description,
      googleMapsUrl: params.googleMapsUrl,
      horaireOuverture: horairesTexte,
    });
  } catch (error) {
    sendError(res, 'Erreur paramètres salon', 500);
  }
};
