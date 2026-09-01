import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { isAddress } from 'ethers';
import { z } from 'zod';
import {
  capabilitySummary,
  config,
  loanIndexingCapability,
  ogWriteCapability,
} from './config';
import { probeChain } from './chain/provider';
import { probeExplorer } from './chain/walletActivity';
import { getUploadAccount, probeStorage } from './og/storage';
import { streamBus } from './events/bus';
import { getCursor } from './store/db';
import {
  countRecords,
  getRecordById,
  getRecordByRootHash,
  listRecordsByWallet,
  getAssessmentCache,
  putAssessmentCache,
  listIndexedBorrowers,
  getAnalyticsSummary,
} from './store/repositories';
import { getLoansForWallet, getRepaymentStats } from './services/loanService';
import { getWallet } from './services/walletService';
import { ingestCreditAssessment } from './services/recordService';
import { verifyByRootHash, verifyStoredRecord } from './services/verifyService';
import { CREDORA_EVENT_TYPES, type CredoraEventType } from './records/schema';
import { assessmentCacheKey, sourceDataHash } from './lib/sourceHash';
import { createLogger } from './logger';

const log = createLogger('server');

function requireSecret(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!config.server.sharedSecret || token !== config.server.sharedSecret) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  next();
}

function requireAddress(req: Request, res: Response, next: NextFunction): void {
  const address = req.params.address;

  if (!address || !isAddress(address)) {
    res.status(400).json({ error: 'invalid_address', message: 'Expected a 0x EVM address' });
    return;
  }

  req.params.address = address.toLowerCase();
  next();
}

function asyncRoute(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

export function createServer() {
  const app = express();

  app.use(express.json({ limit: '256kb' }));
  app.use(
    cors({
      origin: config.server.corsOrigins.length > 0 ? config.server.corsOrigins : true,
      credentials: false,
    }),
  );

  /* ------------------------------------------------------------------ health */

  app.get(
    '/health',
    asyncRoute(async (_req, res) => {
      const [chain, storage, explorer, uploadAccount] = await Promise.all([
        probeChain(),
        probeStorage(),
        probeExplorer(),
        getUploadAccount().catch(() => null),
      ]);

      const counts = countRecords();

      // Only report healthy when the pieces we depend on actually respond.
      const healthy = chain.reachable && storage.reachable;

      res.status(healthy ? 200 : 503).json({
        service: 'credora-indexer',
        healthy,
        checkedAt: new Date().toISOString(),
        capabilities: capabilitySummary(),
        chain: {
          ...chain,
          expectedChainId: config.chain.chainId,
          chainIdMatches: chain.chainId === null ? null : chain.chainId === config.chain.chainId,
        },
        storage,
        explorer,
        uploadAccount,
        index: { ...counts, cursorBlock: getCursor() },
      });
    }),
  );

  /* ------------------------------------------------------------------ stream */

  /**
   * Credora's own event stream over indexed chain events.
   * Public because it carries no secret and only echoes public chain data.
   */
  app.get('/stream', (req, res) => {
    const wallet = typeof req.query.wallet === 'string' ? req.query.wallet.toLowerCase() : null;

    if (wallet && !isAddress(wallet)) {
      res.status(400).json({ error: 'invalid_address' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write(`event: open\ndata: ${JSON.stringify({ wallet, at: new Date().toISOString() })}\n\n`);

    const unsubscribe = streamBus.subscribe((event) => {
      if (wallet && event.wallet && event.wallet !== wallet) return;
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  });

  /* ------------------------------------------------------------------ wallet */

  app.get(
    '/wallet/:address',
    requireSecret,
    requireAddress,
    asyncRoute(async (req, res) => {
      const force = req.query.refresh === 'true';
      const { snapshot, cached } = await getWallet(req.params.address, force);
      res.json({ ...snapshot, cached });
    }),
  );

  app.get(
    '/wallet/:address/loans',
    requireSecret,
    requireAddress,
    asyncRoute(async (req, res) => {
      const result = await getLoansForWallet(req.params.address);
      res.json({
        ...result,
        indexing: loanIndexingCapability,
        stats: getRepaymentStats(req.params.address),
      });
    }),
  );

  app.get('/wallet/:address/records', requireSecret, requireAddress, (req, res) => {
    const requested = typeof req.query.eventTypes === 'string' ? req.query.eventTypes.split(',') : [];
    const eventTypes = requested.filter((entry): entry is CredoraEventType =>
      (CREDORA_EVENT_TYPES as readonly string[]).includes(entry),
    );

    const limitRaw = Number.parseInt(String(req.query.limit ?? '100'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;

    res.json({
      records: listRecordsByWallet(req.params.address, {
        ...(eventTypes.length > 0 ? { eventTypes } : {}),
        limit,
      }),
      storageWrites: ogWriteCapability,
    });
  });

  /**
   * Everything the scoring layer needs, assembled from real sources only.
   * The API layer calls this instead of reaching for chain data itself.
   */
  app.get(
    '/wallet/:address/features',
    requireSecret,
    requireAddress,
    asyncRoute(async (req, res) => {
      const address = req.params.address;
      const { snapshot } = await getWallet(address);
      const loanView = await getLoansForWallet(address);
      const repayment = getRepaymentStats(address);

      const txMix = {
        inbound: snapshot.transactions.filter((tx) => tx.direction === 'in').length,
        outbound: snapshot.transactions.filter((tx) => tx.direction === 'out').length,
        self: snapshot.transactions.filter((tx) => tx.direction === 'self').length,
      };

      const outstandingWei = loanView.loans
        .filter((loan) => loan.status === 'active')
        .reduce((sum, loan) => sum + BigInt(loan.amountWei), 0n)
        .toString();

      const overdue = loanView.loans.some((loan) => loan.overdue);
      const hash = sourceDataHash({
        wallet: address,
        chainId: config.chain.chainId,
        balanceWei: snapshot.balanceWei,
        transactionCount: snapshot.transactionCount,
        observedTransactions: snapshot.transactions.length,
        firstSeen: snapshot.firstSeen,
        lastActivity: snapshot.lastActivity,
        repayment,
        outstandingWei,
        overdue,
        activeLoanCount: repayment.active,
        repaidLoanCount: repayment.repaid,
        txMix,
        degraded: snapshot.degraded,
      });

      res.json({
        wallet: address,
        chainId: config.chain.chainId,
        balanceWei: snapshot.balanceWei,
        balanceFormatted: snapshot.balanceFormatted,
        transactionCount: snapshot.transactionCount,
        observedTransactions: snapshot.transactions.length,
        firstSeen: snapshot.firstSeen,
        lastActivity: snapshot.lastActivity,
        repayment,
        outstandingWei,
        overdue,
        activeLoanCount: repayment.active,
        repaidLoanCount: repayment.repaid,
        txMix,
        sourceDataHash: hash,
        degraded: snapshot.degraded,
        degradedReason: snapshot.degradedReason,
        loanIndexing: loanIndexingCapability,
        fetchedAt: snapshot.fetchedAt,
      });
    }),
  );

  /* ----------------------------------------------------------------- records */

  app.get('/records/:recordId', requireSecret, (req, res) => {
    const record = getRecordById(req.params.recordId);
    if (!record) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(record);
  });

  app.post(
    '/records/:recordId/verify',
    requireSecret,
    asyncRoute(async (req, res) => {
      const result = await verifyStoredRecord(req.params.recordId);
      res.json(result);
    }),
  );

  /**
   * Retrieval straight from 0G Storage by root hash, with verification.
   * Works for any root hash, indexed or not.
   */
  app.get(
    '/records/root/:rootHash',
    requireSecret,
    asyncRoute(async (req, res) => {
      const rootHash = req.params.rootHash;

      if (!/^0x[0-9a-fA-F]{64}$/.test(rootHash)) {
        res.status(400).json({ error: 'invalid_root_hash' });
        return;
      }

      const indexed = getRecordByRootHash(rootHash);
      const verification = await verifyByRootHash(rootHash, indexed?.recordId);

      res.status(verification.status === 'verified' ? 200 : 502).json({
        rootHash,
        indexed: indexed !== null,
        verification: {
          status: verification.status,
          detail: verification.detail,
          verifiedAt: verification.verifiedAt,
        },
        record: verification.record,
      });
    }),
  );

  const assessmentSchema = z.object({
    wallet: z.string().refine(isAddress, 'invalid address'),
    eventType: z.enum(['credit_assessment', 'ai_risk_assessment']).default('credit_assessment'),
    creditScore: z.number().int().min(0).max(1000).optional(),
    riskLevel: z.enum(['Low', 'Medium', 'High']).optional(),
    confidence: z.number().min(0).max(1),
    model: z.string().min(1),
    methodology: z.string().min(1),
    sourceDataHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
    deterministicScore: z.number().int().min(0).max(1000).optional(),
    aiRiskScore: z.number().int().min(0).max(1000).optional(),
    aiRiskLevel: z.enum(['Low', 'Medium', 'High']).optional(),
    riskFactors: z.array(z.string().max(240)).max(12).optional(),
    positiveFactors: z.array(z.string().max(240)).max(12).optional(),
    assessmentSummary: z.string().max(800).optional(),
    modelVersion: z.string().max(128).optional(),
    analysisType: z
      .enum([
        'general',
        'borrower-risk',
        'repayment-behavior',
        'liquidity',
        'wallet-activity',
        'risk-outlook',
      ])
      .optional(),
    analysisLabel: z.string().max(64).optional(),
    riskOutlook: z.enum(['Improving', 'Stable', 'Deteriorating', 'Insufficient Data']).optional(),
  });

  app.get(
    '/assessments/cache',
    requireSecret,
    (req, res) => {
      const wallet = typeof req.query.wallet === 'string' ? req.query.wallet : '';
      const sourceDataHash = typeof req.query.sourceDataHash === 'string' ? req.query.sourceDataHash : '';
      const eventType = typeof req.query.eventType === 'string' ? req.query.eventType : 'credit_assessment';
      const model = typeof req.query.model === 'string' ? req.query.model : '';

      if (!isAddress(wallet) || !/^0x[0-9a-fA-F]{64}$/.test(sourceDataHash) || !model) {
        res.status(400).json({ error: 'invalid_query' });
        return;
      }

      const cached = getAssessmentCache(
        assessmentCacheKey(wallet, sourceDataHash, eventType, model),
      );
      const record = cached ? getRecordById(cached.recordId) : null;
      res.json({ hit: record !== null, record });
    },
  );

  app.get(
    '/borrowers',
    requireSecret,
    (req, res) => {
      const limitRaw = Number.parseInt(String(req.query.limit ?? '50'), 10);
      const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
      res.json({
        borrowers: listIndexedBorrowers(limit),
        limitations: {
          loanDefaultedUnsupported: true,
          oneLoanPerBorrower: true,
          notALendingPool: true,
        },
      });
    },
  );

  app.get('/analytics/summary', requireSecret, (_req, res) => {
    res.json(getAnalyticsSummary());
  });

  app.post('/records/assessment', requireSecret, (req, res) => {
    const parsed = assessmentSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues });
      return;
    }

    const body = parsed.data;
    const eventType = body.eventType;
    const source = eventType === 'ai_risk_assessment' ? 'compute' : 'derived';

    if (eventType === 'credit_assessment' && body.creditScore === undefined) {
      res.status(400).json({ error: 'invalid_body', message: 'creditScore is required for credit_assessment' });
      return;
    }
    if (eventType === 'ai_risk_assessment' && (body.aiRiskScore === undefined || body.aiRiskLevel === undefined)) {
      res.status(400).json({
        error: 'invalid_body',
        message: 'aiRiskScore and aiRiskLevel are required for ai_risk_assessment',
      });
      return;
    }

    const modelKey = body.modelVersion ? `${body.model}@${body.modelVersion}` : body.model;

    if (body.sourceDataHash) {
      const cacheKey = assessmentCacheKey(body.wallet, body.sourceDataHash, eventType, modelKey);
      const cached = getAssessmentCache(cacheKey);
      if (cached) {
        const existing = getRecordById(cached.recordId);
        if (existing) {
          res.status(200).json({
            record: existing,
            cached: true,
            storageWrites: ogWriteCapability,
            verification: existing.verification.status,
          });
          return;
        }
      }
    }

    const record = ingestCreditAssessment({
      ...body,
      eventType,
      source,
    });

    if (body.sourceDataHash) {
      putAssessmentCache({
        cacheKey: assessmentCacheKey(body.wallet, body.sourceDataHash, eventType, modelKey),
        wallet: body.wallet,
        sourceDataHash: body.sourceDataHash,
        eventType,
        model: modelKey,
        recordId: record.recordId,
        createdAt: new Date().toISOString(),
      });
    }

    res.status(201).json({
      record,
      cached: false,
      storageWrites: ogWriteCapability,
      verification: ogWriteCapability.available
        ? 'queued'
        : 'blocked: record indexed locally but not written to 0G Storage',
    });
  });

  /* ------------------------------------------------------------------ errors */

  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    log.error('Unhandled request error', error.message);
    res.status(500).json({ error: 'internal_error', message: error.message });
  });

  return app;
}
