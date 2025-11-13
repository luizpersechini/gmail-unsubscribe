const { Router } = require('express');
const authRoutes = require('./auth.routes');
const unsubscribeRoutes = require('./unsubscribe.routes');
const statusRoutes = require('./status.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/unsubscribe', unsubscribeRoutes);
router.use('/status', statusRoutes);

module.exports = router;
