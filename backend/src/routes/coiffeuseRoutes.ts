import { Router } from 'express';
import { getAllCoiffeuses, getCoiffeuse, getDisponibilites, updateCoiffeuse, getMonProfil, updateDisponibilites, getProduitsCoiffeuse, getMesClientes } from '../controllers/coiffeuseController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Routes protégées /me — avant /:id pour éviter conflit de route
router.get('/me', authenticate, authorize('COIFFEUSE'), getMonProfil);
router.put('/me/disponibilites', authenticate, authorize('COIFFEUSE'), updateDisponibilites);

// Routes protégées pour coiffeuses (avant /:id)
router.get('/produits', authenticate, authorize('COIFFEUSE', 'ADMIN'), getProduitsCoiffeuse);
router.get('/mes-clientes', authenticate, authorize('COIFFEUSE'), getMesClientes);

// Routes publiques
router.get('/', getAllCoiffeuses);
router.get('/:id', getCoiffeuse);
router.get('/:id/disponibilites', getDisponibilites);

// Routes protégées
router.put('/:id', authenticate, authorize('ADMIN', 'COIFFEUSE'), updateCoiffeuse);

export default router;
