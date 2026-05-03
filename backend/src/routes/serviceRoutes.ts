import { Router } from 'express';
import { body } from 'express-validator';
import { getAllServices, getService, createService, updateService, deleteService } from '../controllers/serviceController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// Routes publiques
router.get('/', getAllServices);
router.get('/:id', getService);

// Routes admin
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  [
    body('nom').trim().notEmpty().withMessage('Nom requis'),
    body('categorie').isIn(['COUPE', 'COLORATION', 'SOIN', 'COIFFAGE_EVENEMENT', 'EXTENSION', 'FORFAIT']).withMessage('Catégorie invalide'),
    body('prixBase').isDecimal().withMessage('Prix invalide'),
    body('dureeMinutes').isInt({ min: 15 }).withMessage('Durée minimum 15 minutes'),
  ],
  validate,
  createService
);

router.put('/:id', authenticate, authorize('ADMIN'), updateService);
router.delete('/:id', authenticate, authorize('ADMIN'), deleteService);

export default router;
