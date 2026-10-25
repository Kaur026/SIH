import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getInstitutions, createInstitution, type Institution } from '../../services/supabase/institutions';
import { getDepartments, type Department } from '../../services/supabase/departments';
import { getOfficersByDepartment, type UserProfile } from '../../services/supabase/users';
import { createComplaint, type NewComplaintInput } from '../../services/supabase/complaints';
import type { ComplaintPriority } from '../../types/database.types';
import {
  FilePlus,
  Building2,
  AlertCircle,
  CheckCircle2,
  Layers,
  ArrowRight,
  Shield,
  Plus
} from 'lucide-react';

const COMPLAINT_CATEGORIES = [
  'Fee Cap Violation',
  'Non-Refund of Security Deposit',
  'Withholding of Original Certificates',
  'Faculty Deficiency & Non-Payment of Remuneration',
  'Unauthorized Course Operation',
  'Ragging & Student Harassment',
  'Infrastructure & Lab Non-Compliance',
  'Governance & Administrative Malpractice',
  'Admission Irregularity',
];

interface ComplaintRegistrationProps {
  onSuccess: (complaintId: string) => void;
  onCancel: () => void;
}

export const ComplaintRegistration: React.FC<ComplaintRegistrationProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { user, profile } = useAuth();

  // Reference data
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [officers, setOfficers] = useState<UserProfile[]>([]);

  // Form inputs
  const [institutionId, setInstitutionId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(COMPLAINT_CATEGORIES[0]);
  const priority: ComplaintPriority = 'Normal';
  const [assignedDepartmentId, setAssignedDepartmentId] = useState('');
  const [assignedOfficerId, setAssignedOfficerId] = useState('');
  const [dueAt, setDueAt] = useState('');

  // Institution quick-add modal state
  const [showAddInst, setShowAddInst] = useState(false);
  const [newInstName, setNewInstName] = useState('');
  const [newInstAicteId, setNewInstAicteId] = useState('');
  const [newInstState, setNewInstState] = useState('');
  const [newInstAddress, setNewInstAddress] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successComplaintNumber, setSuccessComplaintNumber] = useState<string | null>(null);
  const [newComplaintId, setNewComplaintId] = useState<string | null>(null);

  // Load initial reference data
  useEffect(() => {
    async function loadData() {
      try {
        const [instList, deptList] = await Promise.all([
          getInstitutions(),
          getDepartments(),
        ]);
        setInstitutions(instList);
        setDepartments(deptList);

        // Pre-select user's department or default to first
        if (profile?.department_id) {
          setAssignedDepartmentId(profile.department_id);
        } else if (deptList.length > 0) {
          setAssignedDepartmentId(deptList[0].id);
        }
      } catch (err) {
        console.error('Error loading registration reference data:', err);
      }
    }
    loadData();
  }, [profile]);

  // Load department officers whenever department selection changes
  useEffect(() => {
    if (!assignedDepartmentId) {
      setOfficers([]);
      return;
    }
    getOfficersByDepartment(assignedDepartmentId)
      .then((data) => setOfficers(data))
      .catch((err) => console.error('Error fetching officers:', err));
  }, [assignedDepartmentId]);

  // Handle new institution registration
  const handleCreateInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstName.trim() || !newInstState.trim()) {
      setErrorMessage('Institution Name and State are mandatory.');
      return;
    }

    try {
      const created = await createInstitution({
        institution_name: newInstName.trim(),
        aicte_permanent_id: newInstAicteId.trim() || null,
        state: newInstState.trim(),
        address: newInstAddress.trim() || null,
      });

      setInstitutions((prev) => [...prev, created]);
      setInstitutionId(created.id);
      setShowAddInst(false);
      setNewInstName('');
      setNewInstAicteId('');
      setNewInstState('');
      setNewInstAddress('');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMessage(`Failed to add institution: ${error?.message || 'Database error'}`);
    }
  };

  // Submit Complaint
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!user) {
      setErrorMessage('Session expired. Please sign in again.');
      return;
    }

    if (!institutionId) {
      setErrorMessage('Please select the governed institution.');
      return;
    }

    if (!title.trim() || !description.trim()) {
      setErrorMessage('Complaint Title and detailed Grievance Description are required.');
      return;
    }

    if (!assignedDepartmentId) {
      setErrorMessage('Please select the AICTE Bureau responsible for this case.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: NewComplaintInput = {
        institution_id: institutionId,
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        assigned_department_id: assignedDepartmentId,
        assigned_officer_id: assignedOfficerId || null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        created_by: user.id,
      };

      const result = await createComplaint(payload);
      setSuccessComplaintNumber(result.complaint_number);
      setNewComplaintId(result.id);
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error('Complaint registration error:', err);
      setErrorMessage(error?.message || 'Failed to submit complaint to Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successComplaintNumber && newComplaintId) {
    return (
      <div className="bg-white border border-slate-200 rounded p-8 text-center max-w-xl mx-auto shadow-sm">
        <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
          Registration Complete
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Grievance Successfully Registered
        </h2>
        <p className="text-xs text-slate-600 mb-4">
          The grievance has been committed to the central database, initial assignment recorded, and audit trail established.
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded p-4 font-mono text-sm text-slate-800 font-bold mb-6">
          Case Reference: <span className="text-[#0b3b60]">{successComplaintNumber}</span>
        </div>

        <div className="flex items-center justify-center space-x-3">
          <button
            type="button"
            onClick={() => onSuccess(newComplaintId)}
            className="px-4 py-2 bg-[#0b3b60] hover:bg-[#072a45] text-white text-xs font-semibold rounded flex items-center space-x-1.5 shadow-sm"
          >
            <span>Open Case Dossier</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSuccessComplaintNumber(null);
              setNewComplaintId(null);
              setTitle('');
              setDescription('');
              setDueAt('');
            }}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded"
          >
            Register Another Complaint
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded shadow-sm">
      {/* Official Form Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#0b3b60] text-white rounded">
            <FilePlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Register New Technical Institution Grievance
            </h2>
            <p className="text-xs text-slate-500">
              AICTE Inter-Bureau Complaint Intake Form • Central Vigilance & Redressal Standard
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 border border-slate-200 rounded hover:bg-white"
        >
          Cancel
        </button>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="m-6 mb-0 p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        
        {/* Section 1: Institution Details */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
              <Building2 className="w-4 h-4 text-[#0b3b60]" />
              <span>1. Institution Information</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowAddInst(!showAddInst)}
              className="text-xs text-[#0b3b60] hover:underline flex items-center space-x-1 font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddInst ? 'Select Existing' : 'Add New Institution'}</span>
            </button>
          </div>

          {!showAddInst ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Technical Institution <span className="text-red-500">*</span>
              </label>
              <select
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
                required
                className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]"
              >
                <option value="">-- Choose Institution from AICTE Directory --</option>
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.institution_name} [{inst.aicte_permanent_id || 'ID Pending'}] - {inst.state}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-3">
              <div className="text-xs font-bold text-slate-800">Register Institution in Directory:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1">Institution Name *</label>
                  <input
                    type="text"
                    value={newInstName}
                    onChange={(e) => setNewInstName(e.target.value)}
                    placeholder="e.g. National Institute of Technology"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">AICTE Permanent ID</label>
                  <input
                    type="text"
                    value={newInstAicteId}
                    onChange={(e) => setNewInstAicteId(e.target.value)}
                    placeholder="e.g. 1-4920194812"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">State *</label>
                  <input
                    type="text"
                    value={newInstState}
                    onChange={(e) => setNewInstState(e.target.value)}
                    placeholder="e.g. Karnataka"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Address</label>
                  <input
                    type="text"
                    value={newInstAddress}
                    onChange={(e) => setNewInstAddress(e.target.value)}
                    placeholder="Campus address / city"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-900"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleCreateInstitution}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded"
                >
                  Save & Select Institution
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Grievance Particulars */}
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
              <Layers className="w-4 h-4 text-[#0b3b60]" />
              <span>2. Grievance Particulars & Classification</span>
            </h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Grievance Title / Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Concise official subject line (e.g. Demand of excess capitation fee for B.Tech admission)"
              required
              className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Grievance Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]"
            >
              {COMPLAINT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Detailed Description & Allegation Specifics <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State the facts chronologically: parties involved, academic session, specific regulatory clause violated, and complainant statements..."
              required
              className="w-full text-xs border border-slate-300 rounded p-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]"
            />
          </div>
        </div>

        {/* Section 3: Bureau Assignment & Deadlines */}
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
              <Shield className="w-4 h-4 text-[#0b3b60]" />
              <span>3. Bureau Allocation & Resolution Target</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned Bureau / Cell <span className="text-red-500">*</span>
              </label>
              <select
                value={assignedDepartmentId}
                onChange={(e) => setAssignedDepartmentId(e.target.value)}
                required
                className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]"
              >
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned Nodal Officer (Optional)
              </label>
              <select
                value={assignedOfficerId}
                onChange={(e) => setAssignedOfficerId(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]"
              >
                <option value="">-- Unassigned (Bureau Pool) --</option>
                {officers.map((off) => (
                  <option key={off.id} value={off.id}>
                    {off.full_name} ({off.designation || 'Officer'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Resolution Deadline (Due Date)
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-[#0b3b60] hover:bg-[#072a45] text-white text-xs font-semibold rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0b3b60] disabled:opacity-50 flex items-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Submitting to Supabase...</span>
              </>
            ) : (
              <>
                <span>Commit Grievance Record</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
