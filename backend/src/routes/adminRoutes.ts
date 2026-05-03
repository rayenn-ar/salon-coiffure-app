import { Router } from 'express';
import { body } from 'express-validator';
import {
  getDashboard,
  createCoiffeuse,
  deleteCoiffeuse,
  getCoiffeusesAdmin,
  getStats,
  getProduits,
  createProduit,
  updateProduit,
  updateStock,
  getClientes,
  getServiceIngredients,
  upsertServiceIngredient,
  deleteServiceIngredient,
  getStatsGraphique,
  getMouvementsStock,
  getSalonParametres,
  updateSalonParametres,
  getDepenses,
  createDepense,
  updateDepense,
  deleteDepense,
  payerDepense,
  updateCoiffeureSalaire,
  toggleBloquerCoiffeuse,
  deleteCoiffeusePermanent,
  getPublicParametres,
} from '../controllers/adminController';
import { authenticate, authorize, requireMfa } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// Public route (no auth needed) – salon info for footer/public pages
router.get('/parametres/public', getPublicParametres);

// All other admin routes require auth + MFA verification
router.use(authenticate, authorize('ADMIN'), requireMfa);

router.get('/dashboard', getDashboard);
router.get('/stats', getStats);
router.get('/stats/graphique', getStatsGraphique);
router.get('/clients', getClientes);

// Gestion coiffeuses
router.get('/coiffeuses', getCoiffeusesAdmin);
router.post(
  '/coiffeuses',
  [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').isLength({ min: 12 }).withMessage('12 caractères min'),
    body('nom').trim().notEmpty().withMessage('Nom requis'),
    body('prenom').trim().notEmpty().withMessage('Prénom requis'),
  ],
  validate,
  createCoiffeuse
);
router.delete('/coiffeuses/:id', deleteCoiffeuse);
router.patch('/coiffeuses/:id/salaire', updateCoiffeureSalaire);
router.patch('/coiffeuses/:id/bloquer', toggleBloquerCoiffeuse);
router.delete('/coiffeuses/:id/permanent', deleteCoiffeusePermanent);

// Gestion stock produits
router.get('/produits', getProduits);
router.patch('/produits/:id', updateProduit);

router.post(
  '/produits',
  [
    body('nom').trim().notEmpty().withMessage('Nom requis'),
    body('categorie').trim().notEmpty().withMessage('Catégorie requise'),
    body('unite').trim().notEmpty().withMessage('Unité requise'),
  ],
  validate,
  createProduit
);

router.patch('/produits/:id/stock', updateStock);

// Traçabilité stock
router.get('/stock/mouvements', getMouvementsStock);

// Gestion ingrédients par service
router.get('/services/:serviceId/ingredients', getServiceIngredients);
router.put(
  '/services/:serviceId/ingredients',
  [
    body('produitId').notEmpty().withMessage('Produit requis'),
    body('quantite').isFloat({ min: 0.001 }).withMessage('Quantité invalide'),
  ],
  validate,
  upsertServiceIngredient
);
router.delete('/services/:serviceId/ingredients/:produitId', deleteServiceIngredient);

// Paramètres du salon
router.get('/parametres', getSalonParametres);
router.put('/parametres', updateSalonParametres);

// Dépenses
router.get('/depenses', getDepenses);
router.post(
  '/depenses',
  [
    body('label').trim().notEmpty().withMessage('Libellé requis'),
    body('montant').isFloat({ min: 0 }).withMessage('Montant invalide'),
  ],
  validate,
  createDepense
);
router.put('/depenses/:id', updateDepense);
router.patch('/depenses/:id/payer', payerDepense);
router.delete('/depenses/:id', deleteDepense);

export default router;
