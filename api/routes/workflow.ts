import { Router } from 'express';
import { WorkflowEngineService } from '../services/WorkflowEngineService.js';
import { AuditLogService } from '../services/AuditLogService.js';
import { NotificationService } from '../services/NotificationService.js';

const router = Router();

router.get('/configs', async (req, res, next) => {
  try {
    const configs = await WorkflowEngineService.listConfigs();
    res.json(configs);
  } catch (e) {
    next(e);
  }
});

router.get('/configs/default', async (req, res, next) => {
  try {
    const config = await WorkflowEngineService.ensureDefaultConfig();
    res.json(config);
  } catch (e) {
    next(e);
  }
});

router.get('/roles', async (req, res, next) => {
  try {
    const roles = await WorkflowEngineService.listReviewerRoles();
    res.json(roles);
  } catch (e) {
    next(e);
  }
});

router.post('/instances', async (req, res, next) => {
  try {
    const { docId, initiatorId, initiatorName, configId } = req.body;
    if (!docId || !initiatorId || !initiatorName) {
      res.status(400).json({ error: '缺少必填参数：docId, initiatorId, initiatorName' });
      return;
    }
    const instance = await WorkflowEngineService.createInstance({
      docId,
      initiatorId,
      initiatorName,
      configId,
    });
    res.status(201).json(instance);
  } catch (e) {
    next(e);
  }
});

router.get('/instances', async (req, res, next) => {
  try {
    const instances = await WorkflowEngineService.listInstances();
    res.json(instances);
  } catch (e) {
    next(e);
  }
});

router.get('/instances/:id', async (req, res, next) => {
  try {
    const instance = await WorkflowEngineService.getInstance(req.params.id);
    if (!instance) {
      res.status(404).json({ error: '工作流实例不存在' });
      return;
    }
    res.json(instance);
  } catch (e) {
    next(e);
  }
});

router.get('/instances/by-doc/:docId', async (req, res, next) => {
  try {
    const instance = await WorkflowEngineService.getInstanceByDocId(req.params.docId);
    if (!instance) {
      res.status(404).json({ error: '该文档未启动工作流' });
      return;
    }
    res.json(instance);
  } catch (e) {
    next(e);
  }
});

router.get('/instances/:id/progress', async (req, res, next) => {
  try {
    const progress = await WorkflowEngineService.getProgress(req.params.id);
    if (!progress) {
      res.status(404).json({ error: '工作流实例不存在' });
      return;
    }
    res.json(progress);
  } catch (e) {
    next(e);
  }
});

router.get('/instances/:id/transitions', async (req, res, next) => {
  try {
    const records = await WorkflowEngineService.getTransitionHistory(req.params.id);
    res.json(records);
  } catch (e) {
    next(e);
  }
});

router.get('/instances/:id/approval-status', async (req, res, next) => {
  try {
    const status = await WorkflowEngineService.getApprovalStatus(req.params.id);
    if (!status) {
      res.status(404).json({ error: '工作流实例不存在' });
      return;
    }
    res.json(status);
  } catch (e) {
    next(e);
  }
});

router.get('/instances/:id/audit-log', async (req, res, next) => {
  try {
    const logs = await AuditLogService.listByInstance(req.params.id);
    res.json(logs);
  } catch (e) {
    next(e);
  }
});

router.post('/instances/:id/submit', async (req, res, next) => {
  try {
    const { operatorId, operatorName, comment } = req.body;
    if (!operatorId || !operatorName) {
      res.status(400).json({ error: '缺少必填参数：operatorId, operatorName' });
      return;
    }
    const instance = await WorkflowEngineService.submitForReview({
      instanceId: req.params.id,
      operatorId,
      operatorName,
      comment,
    });
    res.json(instance);
  } catch (e) {
    next(e);
  }
});

router.post('/instances/:id/approve', async (req, res, next) => {
  try {
    const { reviewerId, reviewerName, reviewerEmail, reviewerRole, comment } = req.body;
    if (!reviewerId || !reviewerName || !reviewerRole) {
      res.status(400).json({ error: '缺少必填参数：reviewerId, reviewerName, reviewerRole' });
      return;
    }
    const instance = await WorkflowEngineService.submitApproval({
      instanceId: req.params.id,
      reviewerId,
      reviewerName,
      reviewerEmail,
      reviewerRole,
      decision: 'approved',
      comment,
    });
    res.json(instance);
  } catch (e) {
    next(e);
  }
});

router.post('/instances/:id/reject', async (req, res, next) => {
  try {
    const { reviewerId, reviewerName, reviewerEmail, reviewerRole, comment } = req.body;
    if (!reviewerId || !reviewerName || !reviewerRole) {
      res.status(400).json({ error: '缺少必填参数：reviewerId, reviewerName, reviewerRole' });
      return;
    }
    const instance = await WorkflowEngineService.submitApproval({
      instanceId: req.params.id,
      reviewerId,
      reviewerName,
      reviewerEmail,
      reviewerRole,
      decision: 'rejected',
      comment,
    });
    res.json(instance);
  } catch (e) {
    next(e);
  }
});

router.post('/instances/:id/rollback', async (req, res, next) => {
  try {
    const { operatorId, operatorName, comment } = req.body;
    if (!operatorId || !operatorName) {
      res.status(400).json({ error: '缺少必填参数：operatorId, operatorName' });
      return;
    }
    const instance = await WorkflowEngineService.rollback({
      instanceId: req.params.id,
      operatorId,
      operatorName,
      comment,
    });
    res.json(instance);
  } catch (e) {
    next(e);
  }
});

router.get('/audit-log/verify', async (req, res, next) => {
  try {
    const result = await AuditLogService.verifyIntegrity();
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.get('/audit-log', async (req, res, next) => {
  try {
    const logs = await AuditLogService.listAll();
    res.json(logs);
  } catch (e) {
    next(e);
  }
});

router.get('/notifications', async (req, res, next) => {
  try {
    const recipientId = req.query.recipientId as string | undefined;
    const notifications = recipientId
      ? await NotificationService.listByRecipient(recipientId)
      : await NotificationService.listByRecipient('');
    res.json(notifications);
  } catch (e) {
    next(e);
  }
});

router.post('/notifications/:id/read', async (req, res, next) => {
  try {
    const success = await NotificationService.markRead(req.params.id);
    if (!success) {
      res.status(404).json({ error: '通知不存在' });
      return;
    }
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
