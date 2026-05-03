import { Router } from 'express';
import { body } from 'express-validator';
import { getMonProfil, updateProfil, getHistorique, creerAvis } from '../controllers/clienteController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate, authorize('CLIENTE'));

router.get('/profil', getMonProfil);
router.put('/profil', updateProfil);
router.get('/historique', getHistorique);

router.post(
  '/avis',
  [
    body('rendezVousId').isUUID().withMessage('ID rendez-vous invalide'),
    body('note').isInt({ min: 1, max: 5 }).withMessage('Note entre 1 et 5'),
  ],
  validate,
  creerAvis
);

export default router;
