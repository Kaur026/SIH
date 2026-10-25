import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getComplaints,
  getComplaintById,
  updateComplaintStatus,
  addComplaintUpdate,
  getComplaintUpdates,
} from '../../services/supabase/complaints';
import {
  saveOfficialResponse,
  getOfficialResponses,
  simulate15DayProofTimeout,
  type OfficialBureauResponse,
} from '../../services/grievanceStorage';
import type {
  ComplaintWithRelations,
  ComplaintStatus,
  ComplaintUpdateWithAuthor,
} from '../../types/database.types';
import {
  Send,
  Building2,
  User,
  CheckCircle2,
  AlertCircle,
  Search,
  MessageSquare,
  FileCheck,
  Calendar,
  Clock,
  ArrowRight,
  Shield,
  Smartphone,
  AlertTriangle,
  FileQuestion,
} from 'lucide-react';

interface RespondComplaintProps {
  initialComplaintId?: string | null;
  onViewCaseDossier?: (id: string) => void;
}

const DISPATCH_TYPES = [
  'Official Redressal Decision & Relief Order',
  'Notice for Hearing & Tripartite Meeting',
  'Clarification & Evidentiary Document Request',
  'Interim Bureau Inspection Finding',
  'Final Closure & Compliance Report',
];

const COMPLAINT_STATUS_OPTIONS: ComplaintStatus[] = [
  'Under Review',
  'In Progress',
  'On Hold',
  'Resolved',
  'Closed',
];

export const RespondComplaint: React.FC<RespondComplaintProps> = ({
  initialComplaintId,
  onViewCaseDossier,
}) => {
  const { user, profile, isAdmin } = useAuth();

  // Complaints list & selection
  const [complaints, setComplaints] = useState<ComplaintWithRelations[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintWithRelations | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);

  // Response inputs
  const [dispatchType, setDispatchType] = useState(DISPATCH_TYPES[0]);
  const [responseRemarks, setResponseRemarks] = useState('');
  const [targetStatus, setTargetStatus] = useState<ComplaintStatus>('In Progress');
  const [officialRefNo, setOfficialRefNo] = useState('');
  const [hearingDate, setHearingDate] = useState('');
  const [requiresProof, setRequiresProof] = useState(false);

  // Updates history
  const [caseUpdates, setCaseUpdates] = useState<ComplaintUpdateWithAuthor[]>([]);
  const [officialResponses, setOfficialResponses] = useState<OfficialBureauResponse[]>([]);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dispatchSuccess, setDispatchSuccess] = useState<{
    recipientName: string;
    recipientEmail: string;
    recipientPhone: string;
    complaintNumber: string;
    status: string;
    responseBody: string;
    smsText: string;
    requiresProof: boolean;
    proofDeadline?: string | null;
    timestamp: string;
  } | null>(null);

  // Load complaints list
  useEffect(() => {
    async function loadData() {
      setIsLoadingList(true);
      try {
        const bureauDeptId = !isAdmin ? (profile?.department_id || undefined) : undefined;
        const { data } = await getComplaints({ departmentId: bureauDeptId, pageSize: 50 });
        
        // Ensure non-admins only receive their bureau's cases
        const allowedCases = isAdmin
          ? data
          : data.filter((c) => !bureauDeptId || c.assigned_department_id === bureauDeptId);

        setComplaints(allowedCases);

        // Pre-select if initial ID passed
        if (initialComplaintId) {
          const match = allowedCases.find((c) => c.id === initialComplaintId);
          if (match) {
            handleSelectComplaint(match);
          } else {
            const single = await getComplaintById(initialComplaintId);
            if (single) {
              if (isAdmin || single.assigned_department_id === bureauDeptId) {
                handleSelectComplaint(single);
              } else {
                setErrorMessage('Access Restricted: This case is assigned to another Bureau. You can only respond to cases within your bureau.');
              }
            }
          }
        } else if (allowedCases.length > 0) {
          handleSelectComplaint(allowedCases[0]);
        }
      } catch (err) {
        console.error('Error fetching complaints for response desk:', err);
      } finally {
        setIsLoadingList(false);
      }
    }
    loadData();
  }, [initialComplaintId, isAdmin, profile?.department_id]);

  const handleSelectComplaint = async (complaint: ComplaintWithRelations) => {
    setSelectedComplaint(complaint);
    setTargetStatus(complaint.status === 'Received' ? 'Under Review' : complaint.status);
    setDispatchSuccess(null);
    setErrorMessage(null);
    setRequiresProof(false);
    setOfficialRefNo(
      `AICTE/${complaint.department?.code || 'PGRC'}/ORD/${new Date().getFullYear()}/${complaint.complaint_number.slice(-5)}`
    );

    // Load past updates from DB and local storage
    try {
      const updates = await getComplaintUpdates(complaint.id);
      setCaseUpdates(updates);
    } catch {
      setCaseUpdates([]);
    }

    const storedResponses = getOfficialResponses(complaint.id || complaint.complaint_number);
    setOfficialResponses(storedResponses);
  };

  const handleDispatchResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    if (!responseRemarks.trim()) {
      setErrorMessage('Please type the official action remarks or redressal response.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const recipientName =
      selectedComplaint.complainant_name ||
      `${selectedComplaint.institution?.institution_name || 'Institution'} Authority`;
    const recipientEmail =
      selectedComplaint.complainant_email ||
      `nodal.officer@${(selectedComplaint.institution?.institution_name || 'institution')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')}.edu.in`;
    const recipientPhone = selectedComplaint.complainant_phone || '+91 98765 43210';

    try {
      const authorId = user?.id || 'b0000000-0000-0000-0000-000000000001';
      const proofDeadlineDate = requiresProof ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) : null;
      const formattedProofDeadline = proofDeadlineDate ? proofDeadlineDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }) : null;

      const formattedUpdate = `[${dispatchType.toUpperCase()}] Ref: ${officialRefNo}
${responseRemarks.trim()}
${hearingDate ? `Scheduled Date: ${hearingDate}\n` : ''}${requiresProof ? `\n[MANDATORY NOTICE]: Complainant is directed to submit required evidentiary proofs within 15 calendar days (Deadline: ${formattedProofDeadline}). Failure to submit proofs within 15 days will result in automatic case closure.\n` : ''}
Dispatched by: ${profile?.full_name || 'Bureau Officer'} (${profile?.designation || 'AICTE Desk'})
Recipient: ${recipientName} <${recipientEmail}> | Mobile SMS Dispatched: ${recipientPhone}`;

      // 1. Record update in case dossier
      try {
        await addComplaintUpdate(selectedComplaint.id, authorId, formattedUpdate);
      } catch (e) {
        console.warn('addComplaintUpdate db sync fallback:', e);
      }

      // 2. Format SMS Notification text
      const smsText = `AICTE Notification: Official directive issued for Grievance ${selectedComplaint.complaint_number} (Ref: ${officialRefNo}). Order Type: ${dispatchType}. Directives: ${responseRemarks.trim().substring(0, 110)}... ${requiresProof ? `IMPORTANT: Submit necessary proofs within 15 days (by ${formattedProofDeadline}) or this grievance will automatically close.` : 'Track real-time status on AICTE Public Portal.'}`;

      // 3. Save to official response storage (for citizen tracking and 15-day timeout tracking)
      const savedResp = saveOfficialResponse({
        complaintId: selectedComplaint.id,
        complaintNumber: selectedComplaint.complaint_number,
        dispatchType,
        refNo: officialRefNo,
        responseBody: responseRemarks.trim(),
        officerName: profile?.full_name || 'Bureau Officer',
        officerBureau: profile?.departments?.name || 'AICTE Bureau Desk',
        hearingDate: hearingDate || null,
        smsDispatchedTo: recipientPhone,
        smsText,
        smsStatus: 'Delivered',
        requiresProof,
        proofDeadline: proofDeadlineDate ? proofDeadlineDate.toISOString() : null,
        isAutoClosedTimeout: false,
        closureReason: null,
      });

      // 4. Update status if changed
      if (targetStatus !== selectedComplaint.status) {
        try {
          await updateComplaintStatus(selectedComplaint.id, targetStatus);
        } catch (e) {
          console.warn('updateComplaintStatus fallback:', e);
        }
        setSelectedComplaint((prev) => (prev ? { ...prev, status: targetStatus } : null));
      }

      // 5. Refresh updates & responses
      try {
        const updatedList = await getComplaintUpdates(selectedComplaint.id);
        setCaseUpdates(updatedList);
      } catch {
        // ignore
      }
      setOfficialResponses((prev) => [savedResp, ...prev]);

      // 6. Show simulated email and SMS dispatch confirmation
      setDispatchSuccess({
        recipientName,
        recipientEmail,
        recipientPhone,
        complaintNumber: selectedComplaint.complaint_number,
        status: targetStatus,
        responseBody: responseRemarks.trim(),
        smsText,
        requiresProof,
        proofDeadline: formattedProofDeadline,
        timestamp: new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
      });

      setResponseRemarks('');
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error('Error dispatching official response:', err);
      setErrorMessage(error?.message || 'Failed to submit response.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger 15-Day Proof Timeout Auto-Closure
  const handleTriggerTimeout = async () => {
    if (!selectedComplaint) return;
    try {
      simulate15DayProofTimeout(selectedComplaint.id);
      simulate15DayProofTimeout(selectedComplaint.complaint_number);

      // Set complaint status to Closed
      try {
        await updateComplaintStatus(selectedComplaint.id, 'Closed');
      } catch {
        // ignore
      }

      const closureNotice = `[AUTOMATIC SYSTEM CLOSURE]: Case closed automatically. Complainant failed to submit necessary proofs / supporting documents within the stipulated 15-day regulatory timeframe under AICTE Regulations.`;
      try {
        await addComplaintUpdate(selectedComplaint.id, user?.id || 'b0000000-0000-0000-0000-000000000001', closureNotice);
      } catch {
        // ignore
      }

      setSelectedComplaint((prev) => (prev ? { ...prev, status: 'Closed' } : null));
      setOfficialResponses(getOfficialResponses(selectedComplaint.id));
      alert(`Case ${selectedComplaint.complaint_number} has been automatically closed: Complainant failed to submit necessary proofs within 15 days.`);
    } catch (err) {
      console.error('Error triggering 15-day timeout:', err);
    }
  };

  const filteredComplaints = complaints.filter((c) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.complaint_number.toLowerCase().includes(term) ||
      c.title.toLowerCase().includes(term) ||
      (c.institution?.institution_name || '').toLowerCase().includes(term) ||
      (c.complainant_name || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-[#0b3b60]" />
            <span>Respond to Complaint &amp; Redressal Dispatch Desk</span>
          </h2>
          <p className="text-xs text-slate-500">
            Transmit official AICTE directives, examination findings, and formal notices directly to complainants and institutions with SMS alerts
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="px-2.5 py-1 bg-blue-50 text-[#0b3b60] border border-blue-200 rounded font-semibold font-mono">
            {profile?.departments?.code || 'PGRC'} Desk
          </span>
        </div>
      </div>

      {/* Main Grid: Selector on left, Composer on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Complaint Picker (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Select Grievance to Answer
            </h3>
            <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
              {filteredComplaints.length} Cases
            </span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search case #, institution, complainant..."
              className="w-full text-xs border border-slate-300 rounded pl-8 pr-2.5 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0b3b60]"
            />
          </div>

          {/* List */}
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {isLoadingList ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading cases...</div>
            ) : filteredComplaints.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No matching grievances.</div>
            ) : (
              filteredComplaints.map((c) => {
                const isSelected = selectedComplaint?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectComplaint(c)}
                    className={`w-full text-left p-3 rounded border transition ${
                      isSelected
                        ? 'border-[#0b3b60] bg-blue-50/50 shadow-xs ring-1 ring-[#0b3b60]'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-mono font-bold text-[#0b3b60]">
                        {c.complaint_number}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          c.status === 'Resolved' || c.status === 'Closed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.status === 'In Progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {c.title}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {c.institution?.institution_name || 'Institution'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                      <span>{c.complainant_name || 'Public Complainant'}</span>
                      <span className="font-mono text-slate-400">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Case Response Workbench (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedComplaint ? (
            <>
              {/* Case Summary Header Box */}
              <div className="bg-white border border-slate-200 rounded shadow-sm p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-sm text-[#0b3b60]">
                        {selectedComplaint.complaint_number}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 uppercase">
                        {selectedComplaint.category}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                        selectedComplaint.status === 'Closed' ? 'bg-slate-200 text-slate-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        Status: {selectedComplaint.status}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">
                      {selectedComplaint.title}
                    </h3>
                  </div>
                  {onViewCaseDossier && (
                    <button
                      type="button"
                      onClick={() => onViewCaseDossier(selectedComplaint.id)}
                      className="text-xs text-[#0b3b60] hover:underline font-semibold flex items-center space-x-1 shrink-0"
                    >
                      <span>Full Case Dossier</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Recipient & Filing Meta */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded border border-slate-200">
                  <div>
                    <span className="text-slate-500 text-[11px] flex items-center space-x-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Complainant</span>
                    </span>
                    <span className="font-semibold text-slate-800 block mt-0.5">
                      {selectedComplaint.complainant_name || 'Anonymous Student / Citizen'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Type: {selectedComplaint.complainant_type || 'Student'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] flex items-center space-x-1">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>User Mobile (SMS Alerts)</span>
                    </span>
                    <span className="font-semibold text-emerald-800 font-mono block mt-0.5">
                      {selectedComplaint.complainant_phone || '+91 98765 43210'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono truncate block mt-0.5">
                      {selectedComplaint.complainant_email || 'citizen@email.com'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] flex items-center space-x-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Governed Institution</span>
                    </span>
                    <span className="font-semibold text-slate-800 block mt-0.5 truncate">
                      {selectedComplaint.institution?.institution_name}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      State: {selectedComplaint.institution?.state}
                    </span>
                  </div>
                </div>

                {/* Grievance Statement Preview */}
                <div className="text-xs text-slate-600 bg-white p-3 rounded border border-slate-200">
                  <span className="font-semibold text-slate-800 block mb-1">
                    Grievance Allegation on Record:
                  </span>
                  <p className="text-slate-700 whitespace-pre-wrap max-h-24 overflow-y-auto leading-relaxed">
                    {selectedComplaint.description}
                  </p>
                </div>
              </div>

              {/* SUCCESS NOTICE / SIMULATED DISPATCH RECEIPT */}
              {dispatchSuccess && (
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded p-4 shadow-sm animate-fadeIn">
                  <div className="flex items-start space-x-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1 text-xs">
                      <div className="font-bold text-emerald-900 text-sm">
                        Official Response &amp; User SMS Dispatched Successfully
                      </div>
                      <p className="text-emerald-800 mt-1">
                        The regulatory action notice has been recorded in the central case dossier, committed to public tracking status, and dispatched via SMS notification directly to the user's mobile number.
                      </p>
                      
                      <div className="mt-3 bg-white p-3 rounded border border-emerald-200 font-mono text-[11px] space-y-1.5 text-slate-800">
                        <div>
                          <span className="text-slate-500">Recipient Name:</span>{' '}
                          <strong>{dispatchSuccess.recipientName}</strong> &lt;{dispatchSuccess.recipientEmail}&gt;
                        </div>
                        <div>
                          <span className="text-slate-500">User Mobile Number:</span>{' '}
                          <strong className="text-emerald-700">{dispatchSuccess.recipientPhone}</strong>
                        </div>
                        <div className="p-2 bg-white border border-emerald-200 rounded text-slate-800 font-sans">
                          <span className="font-bold text-emerald-800 text-[11px] block mb-1">
                            Official Response Sent:
                          </span>
                          <p className="text-[11px] leading-relaxed whitespace-pre-wrap">
                            {dispatchSuccess.responseBody}
                          </p>
                        </div>
                        <div className="p-2 bg-emerald-50/70 border border-emerald-200 rounded text-emerald-950 font-sans">
                          <span className="font-bold flex items-center space-x-1 text-emerald-800 text-[11px] mb-0.5">
                            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                            <span>SMS Gateway Payload (Delivered to User Mobile):</span>
                          </span>
                          <span className="text-[11px] text-slate-700 leading-snug block">
                            "{dispatchSuccess.smsText}"
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Case ID:</span>{' '}
                          <strong className="text-[#0b3b60]">{dispatchSuccess.complaintNumber}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Updated Status:</span>{' '}
                          <span className="px-1.5 py-0.5 rounded font-bold uppercase text-[10px] bg-emerald-100 text-emerald-800">
                            {dispatchSuccess.status}
                          </span>
                        </div>
                        {dispatchSuccess.requiresProof && (
                          <div className="text-amber-800 font-bold bg-amber-50 p-1.5 rounded border border-amber-200 font-sans">
                            ⚠️ 15-Day Proof Submission Requirement Active: Complainant must provide proofs by {dispatchSuccess.proofDeadline} or grievance will auto-close.
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500">Transmission Timestamp:</span>{' '}
                          <span>{dispatchSuccess.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ERROR BANNER */}
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Response Composer Form */}
              <form
                onSubmit={handleDispatchResponse}
                className="bg-white border border-slate-200 rounded shadow-sm p-5 space-y-4"
              >
                <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-1.5">
                    <FileCheck className="w-4 h-4 text-[#0b3b60]" />
                    <span>Compose Official Response / Regulatory Order</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">SIH-26264 Adjudication Desk</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Dispatch Order / Communication Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={dispatchType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDispatchType(val);
                        if (val.includes('Evidentiary') || val.includes('Clarification')) {
                          setRequiresProof(true);
                        }
                      }}
                      className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0b3b60]"
                    >
                      {DISPATCH_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Dispatch File Reference Number
                    </label>
                    <input
                      type="text"
                      value={officialRefNo}
                      onChange={(e) => setOfficialRefNo(e.target.value)}
                      placeholder="e.g. AICTE/PGRC/ORD/2026/0491"
                      className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-[#0b3b60]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Update Case Status Upon Dispatch <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={targetStatus}
                      onChange={(e) => setTargetStatus(e.target.value as ComplaintStatus)}
                      className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-[#0b3b60]"
                    >
                      {COMPLAINT_STATUS_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Hearing / Inspection Date (Optional)
                    </label>
                    <div className="relative">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="date"
                        value={hearingDate}
                        onChange={(e) => setHearingDate(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded pl-8 pr-3 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0b3b60]"
                      />
                    </div>
                  </div>
                </div>

                {/* 15-Day Proof Submission Checkbox / Requirement */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <label className="flex items-start space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiresProof}
                      onChange={(e) => setRequiresProof(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-400 text-[#0b3b60] focus:ring-[#0b3b60]"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-amber-900 flex items-center space-x-1">
                        <FileQuestion className="w-3.5 h-3.5 text-amber-700" />
                        <span>Require Complainant to Submit Necessary Proofs (15-Day Statutory Deadline)</span>
                      </span>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        If enabled, the complainant is notified via SMS to submit certified proof within 15 days. If the user fails to submit required proofs within 15 days, the grievance will close automatically with an official explanation.
                      </p>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official Response Body &amp; Directives to Complainant / College{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={6}
                    value={responseRemarks}
                    onChange={(e) => setResponseRemarks(e.target.value)}
                    placeholder="Enter the official response text: include regulatory findings, directives given to the institution, refund or certificate release deadline, and instructions for the student..."
                    required
                    className="w-full text-xs border border-slate-300 rounded p-3 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0b3b60]"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    This response will be committed to the case audit dossier, dispatched to the complainant's email address, sent to their phone via SMS, and displayed on the public tracking portal.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 gap-3">
                  <div className="text-[11px] text-slate-500 flex items-center space-x-1">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <span>Transmitted under authority of {profile?.full_name || 'Officer'}</span>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-5 py-2.5 bg-[#0b3b60] hover:bg-[#072a45] text-white text-xs font-semibold rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0b3b60] disabled:opacity-50 flex items-center justify-center space-x-2 transition"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Transmitting Order &amp; SMS...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Dispatch Response &amp; Notify Recipient</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Case Updates / Prior Responses History */}
              <div className="bg-white border border-slate-200 rounded shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#0b3b60]" />
                    <span>Dispatched Bureau Directives &amp; Public Tracking Log ({officialResponses.length})</span>
                  </h4>

                  {/* 15-day timeout simulation button for testing */}
                  {officialResponses.some((r) => r.requiresProof && !r.isAutoClosedTimeout) && (
                    <button
                      type="button"
                      onClick={handleTriggerTimeout}
                      className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 rounded text-[11px] font-bold flex items-center space-x-1 shadow-xs transition"
                      title="Test automatic case closure after 15 days of no proof submission"
                    >
                      <AlertTriangle className="w-3 h-3 text-red-600" />
                      <span>Simulate 15-Day Proof Timeout (Auto-Close)</span>
                    </button>
                  )}
                </div>

                {officialResponses.length === 0 && caseUpdates.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No prior responses dispatched for this case yet.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {officialResponses.map((r) => (
                      <div
                        key={r.id}
                        className={`p-3.5 rounded border text-xs space-y-2 ${
                          r.isAutoClosedTimeout ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-[#0b3b60]">{r.dispatchType}</span>
                            <span className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              Ref: {r.refNo}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-400">
                            {new Date(r.createdAt).toLocaleString()}
                          </span>
                        </div>

                        <p className="text-slate-800 whitespace-pre-wrap text-[11px] leading-relaxed bg-white p-2.5 rounded border border-slate-200">
                          {r.responseBody}
                        </p>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-600 pt-1 gap-1 border-t border-slate-200/60">
                          <span className="flex items-center space-x-1 text-emerald-700">
                            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                            <span>SMS delivered to {r.smsDispatchedTo}</span>
                          </span>
                          <span className="text-slate-500">
                            Dispatched by: <strong className="text-slate-700">{r.officerName}</strong> ({r.officerBureau})
                          </span>
                        </div>

                        {r.requiresProof && (
                          <div className={`p-2 rounded text-[11px] flex items-center justify-between ${
                            r.isAutoClosedTimeout ? 'bg-red-100 text-red-900 border border-red-300 font-bold' : 'bg-amber-100 text-amber-900'
                          }`}>
                            <span>
                              {r.isAutoClosedTimeout
                                ? '❌ Auto-Closed: Complainant failed to submit necessary proofs within 15 calendar days.'
                                : `⚠️ Proof Submission Deadline: ${r.proofDeadline ? new Date(r.proofDeadline).toLocaleDateString() : '15 days'}`}
                            </span>
                            {!r.isAutoClosedTimeout && (
                              <button
                                type="button"
                                onClick={handleTriggerTimeout}
                                className="underline hover:text-red-700 text-[10px] ml-2 font-bold cursor-pointer"
                              >
                                Trigger 15-day timeout
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded shadow-sm p-12 text-center text-xs text-slate-500">
              Please choose a complaint from the left registry to compose a response.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
