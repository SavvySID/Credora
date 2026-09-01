"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEATURE_WEIGHTS = exports.SCORING_MODEL = void 0;
exports.creditBandFor = creditBandFor;
exports.scoreWallet = scoreWallet;
exports.describeMethodology = describeMethodology;
/**
 * CREDORA ON-CHAIN CREDIT MODEL v1
 * ================================
 *
 * WHAT THIS IS: a deterministic, weighted feature model. Same inputs always
 * produce the same score, and every contribution is reported to the caller.
 *
 * WHAT THIS IS NOT: machine learning. No model was trained, and no inference
 * runs here. Do not describe the score as AI-generated.
 *
 * 0G Compute is used separately for structured risk JSON (see compute.ts /
 * riskEngine.ts). If that call fails, the deterministic score is unaffected.
 *
 * INPUTS - all read from 0G Galileo (chain id 16602), none synthesised:
 *   balance          native 0G balance                    eth_getBalance
 *   transactionCount account nonce                        eth_getTransactionCount
 *   accountAge       days since first observed tx         0G Chain Scan txlist
 *   activityRecency  days since most recent tx            0G Chain Scan txlist
 *   repaymentRate    repaid / settled Credora loans       indexed Loan.sol events
 *
 * OUTPUT: integer 0-1000, plus a rating band and per-factor contributions.
 * Bands match src/lib/credit.ts: 0-399 Building, 400-699 Established,
 * 700-1000 Excellent. `riskLevel` names the rating, so High is the best band.
 */
exports.SCORING_MODEL = {
    id: 'credora-onchain-v1',
    version: '1.0.0',
    method: 'deterministic-weighted-features',
    deterministic: true,
    trained: false,
    description: 'Weighted sum of five normalised on-chain features. Reproducible from the inputs; no learned parameters.',
};
/** Weights sum to 1. Changing these requires bumping SCORING_MODEL.version. */
exports.FEATURE_WEIGHTS = {
    balance: 0.25,
    transaction_count: 0.2,
    account_age: 0.15,
    activity_recency: 0.15,
    repayment_rate: 0.25,
};
/** Saturation points at which a feature contributes its full weight. */
const SATURATION = {
    /** 0G held for a full-strength balance signal. */
    balanceUnits: 100,
    /** Outbound transactions for a full-strength volume signal. */
    transactions: 500,
    /** Days of history for a full-strength age signal. */
    ageDays: 365,
    /** Days of silence after which recency contributes nothing. */
    inactivityDays: 90,
};
function creditBandFor(score) {
    if (score >= 700)
        return 'Excellent';
    if (score >= 400)
        return 'Established';
    return 'Building';
}
const clamp01 = (value) => Math.min(1, Math.max(0, value));
/** Log scaling so early activity moves the needle more than late activity. */
function logScale(value, saturation) {
    if (value <= 0)
        return 0;
    return clamp01(Math.log10(1 + value) / Math.log10(1 + saturation));
}
function daysBetween(from, to) {
    return (to - new Date(from).getTime()) / 86_400_000;
}
function impactFor(normalized) {
    if (normalized >= 0.6)
        return 'positive';
    if (normalized <= 0.35)
        return 'negative';
    return 'neutral';
}
function scoreWallet(features, now = Date.now()) {
    const balance = Number(features.balanceFormatted);
    const balanceUnits = Number.isFinite(balance) ? balance : 0;
    const hasTransactionHistory = !features.degraded && features.observedTransactions > 0;
    const hasAccountAge = features.firstSeen !== null;
    const hasRepaymentHistory = features.repayment.repaid + features.repayment.defaulted > 0;
    const factors = [];
    // 1. Balance
    const balanceNorm = logScale(balanceUnits, SATURATION.balanceUnits);
    factors.push({
        factor: 'balance',
        impact: impactFor(balanceNorm),
        weight: exports.FEATURE_WEIGHTS.balance,
        observed: `${features.balanceFormatted} 0G`,
        normalized: balanceNorm,
        description: `Holds ${features.balanceFormatted} 0G. Full weight at ${SATURATION.balanceUnits} 0G, log-scaled.`,
    });
    // 2. Transaction volume - the nonce is authoritative even when the explorer
    //    is down, so this factor is never degraded.
    const txNorm = logScale(features.transactionCount, SATURATION.transactions);
    factors.push({
        factor: 'transaction_count',
        impact: impactFor(txNorm),
        weight: exports.FEATURE_WEIGHTS.transaction_count,
        observed: `${features.transactionCount} outbound transactions`,
        normalized: txNorm,
        description: `Account nonce is ${features.transactionCount}. Full weight at ${SATURATION.transactions}, log-scaled.`,
    });
    // 3. Account age
    const ageDays = hasAccountAge ? Math.max(0, daysBetween(features.firstSeen, now)) : 0;
    const ageNorm = hasAccountAge ? clamp01(ageDays / SATURATION.ageDays) : 0;
    factors.push({
        factor: 'account_age',
        impact: hasAccountAge ? impactFor(ageNorm) : 'neutral',
        weight: exports.FEATURE_WEIGHTS.account_age,
        observed: hasAccountAge ? `${Math.floor(ageDays)} days since first transaction` : 'unknown',
        normalized: ageNorm,
        description: hasAccountAge
            ? `First activity ${Math.floor(ageDays)} days ago. Full weight at ${SATURATION.ageDays} days.`
            : 'No transaction history available, so account age contributes nothing.',
    });
    // 4. Activity recency
    const idleDays = features.lastActivity
        ? Math.max(0, daysBetween(features.lastActivity, now))
        : null;
    const recencyNorm = idleDays === null ? 0 : clamp01(1 - idleDays / SATURATION.inactivityDays);
    factors.push({
        factor: 'activity_recency',
        impact: idleDays === null ? 'neutral' : impactFor(recencyNorm),
        weight: exports.FEATURE_WEIGHTS.activity_recency,
        observed: idleDays === null ? 'unknown' : `${Math.floor(idleDays)} days since last transaction`,
        normalized: recencyNorm,
        description: idleDays === null
            ? 'No transaction history available, so recency contributes nothing.'
            : `Last active ${Math.floor(idleDays)} days ago. Decays to zero at ${SATURATION.inactivityDays} days.`,
    });
    // 5. Repayment behaviour. With no settled loans this is genuinely unknown,
    //    so it sits at the band midpoint rather than being scored as a failure.
    const repaymentNorm = hasRepaymentHistory ? clamp01(features.repayment.repaymentRate ?? 0) : 0.5;
    factors.push({
        factor: 'repayment_rate',
        impact: hasRepaymentHistory ? impactFor(repaymentNorm) : 'neutral',
        weight: exports.FEATURE_WEIGHTS.repayment_rate,
        observed: hasRepaymentHistory
            ? `${features.repayment.repaid} repaid of ${features.repayment.repaid + features.repayment.defaulted} settled`
            : 'no settled loans',
        normalized: repaymentNorm,
        description: hasRepaymentHistory
            ? `Repaid ${features.repayment.repaid} of ${features.repayment.repaid + features.repayment.defaulted} settled loans.`
            : 'No settled Credora loans yet, so this factor is held neutral rather than counted against you.',
    });
    const weighted = factors.reduce((sum, factor) => sum + factor.weight * factor.normalized, 0);
    const creditScore = Math.round(clamp01(weighted) * 1000);
    const creditBand = creditBandFor(creditScore);
    const riskLevel = creditScore >= 700 ? 'High' : creditScore >= 400 ? 'Medium' : 'Low';
    // Confidence reflects how much of the input set was actually observable.
    const missing = [];
    let confidence = 1;
    if (!hasTransactionHistory) {
        confidence -= 0.25;
        missing.push('transaction history');
    }
    if (!hasRepaymentHistory) {
        confidence -= 0.15;
        missing.push('repayment history');
    }
    if (!hasAccountAge) {
        confidence -= 0.1;
        missing.push('account age');
    }
    if (!features.loanIndexing.available) {
        confidence -= 0.1;
        missing.push('loan event indexing');
    }
    return {
        creditScore,
        creditBand,
        riskLevel,
        confidence: Math.max(0.3, Number(confidence.toFixed(2))),
        factors,
        inputs: {
            chainId: features.chainId,
            balanceWei: features.balanceWei,
            balanceFormatted: features.balanceFormatted,
            transactionCount: features.transactionCount,
            observedTransactions: features.observedTransactions,
            firstSeen: features.firstSeen,
            lastActivity: features.lastActivity,
            loansSettled: features.repayment.repaid + features.repayment.defaulted,
            repaymentRate: features.repayment.repaymentRate,
        },
        completeness: {
            hasTransactionHistory,
            hasRepaymentHistory,
            hasAccountAge,
            missing,
        },
    };
}
/** Machine-readable description of how the score was produced. */
function describeMethodology(result) {
    const parts = result.factors.map((factor) => `${factor.factor}=${factor.normalized.toFixed(3)}x${factor.weight}`);
    return `${exports.SCORING_MODEL.id}@${exports.SCORING_MODEL.version} deterministic weighted sum: ${parts.join(' + ')} => ${result.creditScore}/1000`;
}
