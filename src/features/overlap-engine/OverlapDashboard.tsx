import React, { useState, useEffect } from 'react';
import { getComplaints, addComplaintUpdate } from '../../services/supabase/complaints';
import { useAuth } from '../../context/AuthContext';
import {
  detectOverlaps,
  type OverlapAlert,
  type OverlapDetectionResult,
} from './overlapDetector';
import {
  CheckCircle2,
  GitCompare,
  Building2,
  RefreshCw,
  Search,
  ExternalLink,
  Link2,
  X,
  Clock,
  Sparkles,
} from 'lucide-react';

const formatTimeApart = (firstDate?: string | null, secondDate?: string | null): string => {
  const firstTime = firstDate ? new Date(firstDate).getTime() : NaN;
  const secondTime = secondDate ? new Date(secondDate).getTime() : NaN;
  if (!Number.isFinite(firstTime) || !Number.isFinite(secondTime)) return 'Time unavailable';

  const totalMinutes = Math.floor(Math.abs(firstTime - secondTime) / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  return `${days} days, ${hours} hrs, ${minutes} mins`;
};

interface OverlapDashboardProps {
  onSelectComplaint?: (id: string) => void;
}

export const OverlapDashboard: React.FC<OverlapDashboardProps> = ({ onSelectComplaint }) => {
  const { user, profile, isAdmin, departmentCode } = useAuth();

  const [detectionResult, setDetectionResult] = useState<OverlapDetectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');

  // Side-by-side comparison modal state
  const [compareAlert, setCompareAlert] = useState<OverlapAlert | null>(null);

  // Link & Dismiss state
  const [linkedPairs, setLinkedPairs] = useState<Array<[string, string]>>([]);
  const [dismissedPairs, setDismissedPairs] = useState<Array<[string, string]>>([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const runDetection = async () => {
    setIsLoading(true);
    try {
      const { data } = await getComplaints({ pageSize: 100 });

      const result = detectOverlaps(data, {
        linkedPairs,
        dismissedPairs,
        minConfidence: 0.3,
      });
      setDetectionResult(result);
    } catch (err) {
      console.error('Error running overlap detection:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runDetection();
  }, [linkedPairs, dismissedPairs]);

  const handleLinkCases = async (alert: OverlapAlert) => {
    try {
      const pair: [string, string] = [alert.case_a_id, alert.case_b_id];
      setLinkedPairs((prev) => [...prev, pair]);

      // Record official coordination note on both cases in Supabase if IDs are available
      const authorId = user?.id || 'b0000000-0000-0000-0000-000000000001';
      const note = `[OVERLAP COORDINATION] Linked with ${alert.case_b_id} (${alert.cell_b}). Overlap Confidence: ${alert.confidence_pct}%. Coordinated by ${profile?.full_name || 'Officer'}.`;

      if (alert.case_a?.id) {
        await addComplaintUpdate(alert.case_a.id, authorId, note);
      }
      if (alert.case_b?.id) {
        await addComplaintUpdate(alert.case_b.id, authorId, `[OVERLAP COORDINATION] Linked with ${alert.case_a_id} (${alert.cell_a}). Overlap Confidence: ${alert.confidence_pct}%.`);
      }

      setActionNotice(`Successfully linked ${alert.case_a_id} and ${alert.case_b_id} for cross-bureau coordination!`);
      setCompareAlert(null);
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err) {
      console.error('Error linking cases:', err);
    }
  };

  const handleDismissAlert = (alert: OverlapAlert) => {
    const pair: [string, string] = [alert.case_a_id, alert.case_b_id];
    setDismissedPairs((prev) => [...prev, pair]);
    setActionNotice(`Alert ${alert.alert_id} dismissed as distinct / non-overlapping.`);
    setCompareAlert(null);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const rawAlerts = detectionResult?.alerts || [];

  // Non-administrators only see overlaps that concern their specific bureau
  const bureauAlerts = isAdmin
    ? rawAlerts
    : rawAlerts.filter(
        (a) =>
          !departmentCode ||
          a.cell_a.toUpperCase() === departmentCode.toUpperCase() ||
          a.cell_b.toUpperCase() === departmentCode.toUpperCase()
      );

  const filteredAlerts = bureauAlerts.filter((a) => {
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return (
        a.institution_name.toLowerCase().includes(term) ||
        a.case_a_id.toLowerCase().includes(term) ||
        a.case_b_id.toLowerCase().includes(term) ||
        a.reason.toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-[#0b3b60] text-white rounded">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </span>
            <h2 className="text-base font-bold text-slate-900">
              AICTE Cross-Bureau Overlap Intelligence Engine
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
              SIH-26264 Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Automated conflict discovery: flags when different Bureaus (RB, PGRC, AB, P&amp;AP) investigate the same institution simultaneously
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={runDetection}
            disabled={isLoading}
            className="px-3.5 py-1.5 bg-[#0b3b60] hover:bg-[#072a45] text-white text-xs font-semibold rounded shadow-sm flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Re-Scan Pipeline</span>
          </button>
        </div>
      </div>

      {/* Action Notice Alert */}
      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Total Overlaps Detected
          </div>
          <div className="text-2xl font-extrabold text-[#0b3b60] mt-1 font-mono">
            {detectionResult?.stats.alerts_count ?? '--'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Across {detectionResult?.stats.institutions_count ?? 0} institutions
          </div>
        </div>

        <div className="bg-white border border-blue-200 bg-blue-50/30 rounded p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-blue-800 uppercase tracking-wide">
            Average Match Score
          </div>
          <div className="text-2xl font-extrabold text-blue-800 mt-1 font-mono">
            {detectionResult?.stats.average_confidence_pct ?? 0}%
          </div>
          <div className="text-[10px] text-blue-700 mt-0.5">Across detected overlaps</div>
        </div>

        <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
            Suppressed / Linked
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1 font-mono">
            {(detectionResult?.stats.suppressed_count ?? 0) + linkedPairs.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Auditable resolution pairs</div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by institution, case ID, reason..."
              className="w-full text-xs border border-slate-300 rounded pl-8 pr-3 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0b3b60]"
            />
          </div>
        </div>

      </div>

      {/* Alerts Feed */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded p-12 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-[#0b3b60] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Evaluating cross-bureau complaint pairs with OverlapEngine...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded p-12 text-center text-xs text-slate-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <div className="font-bold text-slate-800 text-sm">No Uncoordinated Overlaps Detected</div>
            <p className="text-slate-500 mt-1 max-w-md mx-auto">
              All active complaints across Regulation Bureau (RB), PGRC, and Approval Bureau (AB) are currently distinct or already linked for coordination.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.alert_id}
              className="bg-white border border-slate-300 rounded shadow-sm overflow-hidden transition hover:shadow-md"
            >
              {/* Alert Header */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span
                    className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200"
                  >
                    Match Score: {alert.confidence_pct}%
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    ID: {alert.alert_id}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCompareAlert(alert)}
                    className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded flex items-center space-x-1 shadow-xs"
                  >
                    <GitCompare className="w-3.5 h-3.5 text-slate-500" />
                    <span>Compare Side-by-Side</span>
                  </button>
                  <button
                    onClick={() => handleLinkCases(alert)}
                    className="px-3 py-1 bg-[#0b3b60] hover:bg-[#072a45] text-white text-xs font-semibold rounded flex items-center space-x-1 shadow-xs"
                  >
                    <Link2 className="w-3.5 h-3.5 text-amber-300" />
                    <span>Link &amp; Coordinate</span>
                  </button>
                </div>
              </div>

              {/* Alert Body */}
              <div className="p-4 space-y-4">
                {/* Institution banner */}
                <div className="flex items-center space-x-1.5 text-xs text-slate-700 font-bold">
                  <Building2 className="w-4 h-4 text-[#0b3b60]" />
                  <span>Governed Institution:</span>
                  <span className="text-[#0b3b60] underline decoration-slate-300">
                    {alert.institution_name}
                  </span>
                </div>

                {/* Cross-Bureau Visual Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-3 rounded border border-slate-200">
                  {/* Case A */}
                  <div className="space-y-1.5 border-b md:border-b-0 md:border-r border-slate-200 pb-3 md:pb-0 md:pr-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-[#0b3b60] text-white">
                        {alert.cell_a} DESK
                      </span>
                      <span className="font-mono font-bold text-[#0b3b60]">
                        {alert.case_a_id}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900">
                      {alert.case_a?.title || 'Case Title Pending'}
                    </div>
                    <div className="text-[11px] text-slate-600 line-clamp-2">
                      {alert.case_a?.description || 'No description on file.'}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>Status: <strong className="text-slate-700">{alert.case_a?.status}</strong></span>
                      {onSelectComplaint && (
                        <button
                          onClick={() => onSelectComplaint(alert.case_a?.id || '')}
                          className="text-[#0b3b60] font-semibold hover:underline flex items-center space-x-0.5"
                        >
                          <span>Open Dossier</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Case B */}
                  <div className="space-y-1.5 md:pl-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-purple-700 text-white">
                        {alert.cell_b} DESK
                      </span>
                      <span className="font-mono font-bold text-[#0b3b60]">
                        {alert.case_b_id}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900">
                      {alert.case_b?.title || 'Case Title Pending'}
                    </div>
                    <div className="text-[11px] text-slate-600 line-clamp-2">
                      {alert.case_b?.description || 'No description on file.'}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>Status: <strong className="text-slate-700">{alert.case_b?.status}</strong></span>
                      {onSelectComplaint && (
                        <button
                          onClick={() => onSelectComplaint(alert.case_b?.id || '')}
                          className="text-[#0b3b60] font-semibold hover:underline flex items-center space-x-0.5"
                        >
                          <span>Open Dossier</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Engine Rationale Box */}
                <div className="text-xs bg-amber-50 border border-amber-200 rounded p-2.5 text-amber-900">
                  <span className="font-bold block mb-0.5">Why Flagged (Engine Rationale):</span>
                  <p className="leading-relaxed text-[11px]">{alert.reason}</p>
                </div>

                {/* Signals Footnote */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Filed <strong>{formatTimeApart(
                        alert.case_a?.received_at || alert.case_a?.created_at,
                        alert.case_b?.received_at || alert.case_b?.created_at
                      )}</strong> apart
                    </span>
                  </div>
                  {alert.signals.shared_terms.length > 0 && (
                    <>
                      <div>•</div>
                      <div className="flex items-center space-x-1">
                        <span>Shared Terms:</span>
                        <div className="flex space-x-1">
                          {alert.signals.shared_terms.map((term) => (
                            <span key={term} className="bg-slate-100 px-1.5 py-0.2 rounded text-[10px] font-mono text-slate-700">
                              {term}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* SIDE-BY-SIDE COMPARISON MODAL */}
      {compareAlert && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-300">
            {/* Modal Header */}
            <div className="p-4 bg-[#0b3b60] text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <GitCompare className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="text-sm font-bold">
                    Cross-Bureau Case Comparison Dossier
                  </h3>
                  <div className="text-[11px] text-white/80">
                    {compareAlert.institution_name} • Confidence: {compareAlert.confidence_pct}%
                  </div>
                </div>
              </div>
              <button
                onClick={() => setCompareAlert(null)}
                className="p-1 rounded hover:bg-white/10 text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Rationale explanation */}
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-amber-900">
                <span className="font-bold block mb-1">Overlap Engine Findings:</span>
                <p className="leading-relaxed">{compareAlert.reason}</p>
              </div>

              {/* Side by side dossiers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Dossier A */}
                <div className="border border-slate-200 rounded p-4 space-y-3 bg-slate-50">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0b3b60] text-white">
                      {compareAlert.cell_a} DESK
                    </span>
                    <span className="font-mono font-bold text-sm text-[#0b3b60]">
                      {compareAlert.case_a_id}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] block">Title:</span>
                    <h4 className="font-bold text-slate-900 text-xs">
                      {compareAlert.case_a?.title}
                    </h4>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] block">Category:</span>
                    <span className="font-semibold text-slate-800">
                      {compareAlert.case_a?.category}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] block">Current Status:</span>
                    <span className="font-bold text-slate-800">
                      {compareAlert.case_a?.status}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] block">Grievance Particulars:</span>
                    <p className="bg-white p-2.5 rounded border border-slate-200 text-slate-700 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {compareAlert.case_a?.description}
                    </p>
                  </div>
                </div>

                {/* Dossier B */}
                <div className="border border-slate-200 rounded p-4 space-y-3 bg-slate-50">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-700 text-white">
                      {compareAlert.cell_b} DESK
                    </span>
                    <span className="font-mono font-bold text-sm text-[#0b3b60]">
                      {compareAlert.case_b_id}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] block">Title:</span>
                    <h4 className="font-bold text-slate-900 text-xs">
                      {compareAlert.case_b?.title}
                    </h4>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] block">Category:</span>
                    <span className="font-semibold text-slate-800">
                      {compareAlert.case_b?.category}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] block">Current Status:</span>
                    <span className="font-bold text-slate-800">
                      {compareAlert.case_b?.status}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] block">Grievance Particulars:</span>
                    <p className="bg-white p-2.5 rounded border border-slate-200 text-slate-700 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {compareAlert.case_b?.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDismissAlert(compareAlert)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-red-700 font-semibold"
              >
                Dismiss (Not Overlapping)
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setCompareAlert(null)}
                  className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleLinkCases(compareAlert)}
                  className="px-5 py-1.5 bg-[#0b3b60] hover:bg-[#072a45] text-white text-xs font-semibold rounded shadow-sm flex items-center space-x-1.5"
                >
                  <Link2 className="w-3.5 h-3.5 text-amber-300" />
                  <span>Link Cases &amp; Synchronize Inquiries</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
