import { Router } from 'express';
import { body } from 'express-validator';
import {
  createRendezVous,
  createRdvPresentiel,
  getRendezVous,
  getRendezVousById,
  updateStatutRDV,
  annulerRendezVous,
  logMatieres,
} from '../controllers/rendezVousController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

router.post(
  '/',
  authorize('CLIENTE'),
  [
    body('coiffeuseId').isUUID().withMessage('ID coiffeuse invalide'),
    body('dateHeure').isISO8601().withMessage('Date/heure invalide'),
    body('serviceIds').isArray({ min: 1 }).withMessage('Sélectionnez au moins un service'),
  ],
  validate,
  createRendezVous
);

router.get('/', getRendezVous);
router.get('/:id', getRendezVousById);

router.patch(
  '/:id/statut',
  authorize('ADMIN', 'COIFFEUSE'),
  [body('statut').notEmpty().withMessage('Statut requis')],
  validate,
  updateStatutRDV
);

router.delete('/:id', annulerRendezVous);

router.post(
  '/presentiel',
  authorize('COIFFEUSE', 'ADMIN'),
  [
    body('walkInNom').trim().notEmpty().withMessage('Nom du client requis'),
    body('dateHeure').isISO8601().withMessage('Date/heure invalide'),
    body('serviceIds').isArray({ min: 1 }).withMessage('Sélectionnez au moins un service'),
  ],
  validate,
  createRdvPresentiel
);

router.post(
  '/:id/matieres',
  authorize('COIFFEUSE', 'ADMIN'),
  [body('matieres').isArray({ min: 1 }).withMessage('Matières requises')],
  validate,
  logMatieres
);

export default router;
