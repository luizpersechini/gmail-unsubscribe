const { Router } = require('express');
const StatusController = require('../controllers/status.controller');

const router = Router();

router.get('/app', StatusController.getAppStatus);
router.get('/config', StatusController.getConfig);

module.exports = router;
