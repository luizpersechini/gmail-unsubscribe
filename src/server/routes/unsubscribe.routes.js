const { Router } = require('express');
const UnsubscribeController = require('../controllers/unsubscribe.controller');

const router = Router();

router.get('/runs', UnsubscribeController.listRuns);
router.get('/runs/:runId', UnsubscribeController.getRun);
router.get('/runs/:runId/logs', UnsubscribeController.getRunLogs);
router.post('/runs/:runId/cancel', UnsubscribeController.cancelRun);

router.post('/start', UnsubscribeController.startRun);

module.exports = router;
