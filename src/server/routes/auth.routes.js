const { Router } = require('express');
const AuthController = require('../controllers/auth.controller');

const router = Router();

router.get('/url', AuthController.getAuthUrl);
router.post('/callback', AuthController.exchangeCode);
router.post('/revoke', AuthController.revokeToken);

module.exports = router;
