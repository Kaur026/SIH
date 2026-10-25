/**
 * AICTE Cross-Bureau Overlap Engine - Client-Side Engine Service
 * Implements the Python OverlapEngine algorithm in TypeScript for real-time
 * cross-bureau conflict detection, suppression, and coordination scoring.
 */

import type { ComplaintWithRelations } from '../../types/database.types';

export interface OverlapAlert {
  alert_id: string;
  headline: string;
  case_a_id: string;
  case_b_id: string;
  case_a?: ComplaintWithRelations;
  case_b?: ComplaintWithRelations;
  cell_a: string;
  cell_b: string;
  institution_id: string;
  institution_name: string;
  confidence: number;
  confidence_pct: number;
  reason: string;
  signals: {
    institution_confidence: number;
    text_similarity: number;
    category_match: 'same' | 'different';
    days_apart: number;
    shared_terms: string[];
    explicitly_linked: boolean;
  };
}

export interface OverlapStats {
  cases_received: number;
  institutions_count: number;
  alerts_count: number;
  average_confidence_pct: number;
  suppressed_count: number;
  runtime_ms: number;
}

export interface OverlapDetectionResult {
  alerts: OverlapAlert[];
  suppressed: Array<{ case_a_id: string; case_b_id: string; reason: string }>;
  stats: OverlapStats;
}

// Stop words for text tokenization
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will',
  'with', 'this', 'our', 'student', 'complaint', 'institution', 'college', 'aicte',
  'regarding', 'against', 'having', 'please', 'required', 'action', 'dated'
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function computeSharedTerms(tokensA: string[], tokensB: string[]): string[] {
  const setB = new Set(tokensB);
  const shared = new Set<string>();
  for (const t of tokensA) {
    if (setB.has(t)) shared.add(t);
  }
  return Array.from(shared).slice(0, 5);
}

function computeJaccard(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function makeAlertId(instId: string, idA: string, idB: string): string {
  const sorted = [idA, idB].sort().join('|');
  let hash = 0;
  const str = `${instId}|${sorted}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return 'OV-' + Math.abs(hash).toString(16).toUpperCase().padStart(8, '0').slice(-12);
}

const TERMINAL_STATUSES = new Set(['resolved', 'closed', 'disposed']);

/**
 * Execute Overlap Detection across complaints
 */
export function detectOverlaps(
  complaints: ComplaintWithRelations[],
  options: {
    linkedPairs?: Array<[string, string]>;
    dismissedPairs?: Array<[string, string]>;
    minConfidence?: number;
  } = {}
): OverlapDetectionResult {
  const t0 = performance.now();
  const { linkedPairs = [], dismissedPairs = [], minConfidence = 0.3 } = options;

  const linkedSet = new Set<string>();
  for (const [a, b] of linkedPairs) {
    linkedSet.add([a, b].sort().join('::'));
  }

  const dismissedSet = new Set<string>();
  for (const [a, b] of dismissedPairs) {
    dismissedSet.add([a, b].sort().join('::'));
  }

  // 1. Group active cases by Institution
  const institutionGroups = new Map<string, ComplaintWithRelations[]>();
  for (const c of complaints) {
    const instKey = c.institution_id || c.institution?.id || c.institution?.institution_name?.toLowerCase().trim();
    if (!instKey) continue;
    if (!institutionGroups.has(instKey)) {
      institutionGroups.set(instKey, []);
    }
    institutionGroups.get(instKey)!.push(c);
  }

  const alerts: OverlapAlert[] = [];
  const suppressed: Array<{ case_a_id: string; case_b_id: string; reason: string }> = [];

  // 2. Cross-cell pair evaluation
  for (const [instKey, cases] of institutionGroups.entries()) {
    if (cases.length < 2) continue;

    for (let i = 0; i < cases.length; i++) {
      for (let j = i + 1; j < cases.length; j++) {
        const a = cases[i];
        const b = cases[j];

        const cellA = (a.department?.code || 'PGRC').toUpperCase();
        const cellB = (b.department?.code || 'PGRC').toUpperCase();

        // Must concern different Bureaus/Cells
        if (cellA === cellB) {
          continue;
        }

        const pairKey = [a.complaint_number, b.complaint_number].sort().join('::');

        // Check suppressions
        if (linkedSet.has(pairKey)) {
          suppressed.push({ case_a_id: a.complaint_number, case_b_id: b.complaint_number, reason: 'already_linked' });
          continue;
        }

        if (dismissedSet.has(pairKey)) {
          suppressed.push({ case_a_id: a.complaint_number, case_b_id: b.complaint_number, reason: 'dismissed_by_officer' });
          continue;
        }

        if (
          TERMINAL_STATUSES.has((a.status || '').toLowerCase()) ||
          TERMINAL_STATUSES.has((b.status || '').toLowerCase())
        ) {
          suppressed.push({ case_a_id: a.complaint_number, case_b_id: b.complaint_number, reason: 'closed_case' });
          continue;
        }

        // Calculate signals
        const tokensA = tokenize(`${a.title} ${a.description}`);
        const tokensB = tokenize(`${b.title} ${b.description}`);
        const textSim = computeJaccard(tokensA, tokensB);
        const shared = computeSharedTerms(tokensA, tokensB);

        const isSameCategory = a.category && b.category && a.category.toLowerCase() === b.category.toLowerCase();
        const catScore = isSameCategory ? 1.0 : 0.0;

        // Days apart
        const timeA = new Date(a.received_at || a.created_at).getTime();
        const timeB = new Date(b.received_at || b.created_at).getTime();
        const daysApart = Math.abs(timeA - timeB) / (1000 * 60 * 60 * 24);
        const timeScore = Math.max(0, 1.0 - daysApart / 90.0);

        // Weighted confidence: Base (0.40) + Text (0.30) + Category (0.20) + Recency (0.10)
        const instConfidence = 1.0;
        const confidence = instConfidence * (0.40 + 0.30 * textSim + 0.20 * catScore + 0.10 * timeScore);

        if (confidence < minConfidence) {
          suppressed.push({ case_a_id: a.complaint_number, case_b_id: b.complaint_number, reason: 'below_min_confidence' });
          continue;
        }

        // Order earlier case first
        const [earlier, later] = timeA <= timeB ? [a, b] : [b, a];
        const [earlierCell, laterCell] = timeA <= timeB ? [cellA, cellB] : [cellB, cellA];

        const instName = a.institution?.institution_name || b.institution?.institution_name || 'Technical Institution';

        // Build one-line reason explanation
        let textDesc = 'complaint text differs';
        if (textSim >= 0.4) {
          textDesc = `similar complaint text (shared terms: ${shared.join(', ') || 'regulatory violations'})`;
        } else if (textSim >= 0.15) {
          textDesc = `partly similar complaint text (shared terms: ${shared.join(', ') || 'keywords'})`;
        }

        const catDesc = isSameCategory
          ? `same category (${a.category})`
          : `different categories (${a.category} / ${b.category})`;

        const reason = `${instName}: ${earlierCell} case ${earlier.complaint_number} (${earlier.status}) and ${laterCell} case ${later.complaint_number} (${later.status}) are being handled by different cells; ${textDesc}; ${catDesc}; received ${Math.round(daysApart)} days apart.`;

        const alert: OverlapAlert = {
          alert_id: makeAlertId(instKey, a.complaint_number, b.complaint_number),
          headline: 'Potential Overlapping Cases – Coordination Required',
          case_a_id: earlier.complaint_number,
          case_b_id: later.complaint_number,
          case_a: earlier,
          case_b: later,
          cell_a: earlierCell,
          cell_b: laterCell,
          institution_id: instKey,
          institution_name: instName,
          confidence: Math.round(confidence * 1000) / 1000,
          confidence_pct: Math.round(confidence * 100),
          reason,
          signals: {
            institution_confidence: instConfidence,
            text_similarity: Math.round(textSim * 100) / 100,
            category_match: isSameCategory ? 'same' : 'different',
            days_apart: Math.round(daysApart * 10) / 10,
            shared_terms: shared,
            explicitly_linked: false,
          },
        };

        alerts.push(alert);
      }
    }
  }

  // Sort by confidence score, highest first.
  alerts.sort((x, y) => y.confidence - x.confidence);

  const t1 = performance.now();

  const stats: OverlapStats = {
    cases_received: complaints.length,
    institutions_count: institutionGroups.size,
    alerts_count: alerts.length,
    average_confidence_pct: alerts.length
      ? Math.round(alerts.reduce((total, alert) => total + alert.confidence_pct, 0) / alerts.length)
      : 0,
    suppressed_count: suppressed.length,
    runtime_ms: Math.round((t1 - t0) * 100) / 100,
  };

  return { alerts, suppressed, stats };
}
