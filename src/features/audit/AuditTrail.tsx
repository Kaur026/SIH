import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase/client';
import type { AuditLogWithActor } from '../../types/database.types';
import { Shield, RefreshCw } from 'lucide-react';

// Helper to format JSON metadata into clean, human-readable text
const formatActionParticulars = (details: unknown): string => {
  if (!details) return '—';
  let data: Record<string, unknown> = {};

  if (typeof details === 'string') {
    try {
      data = JSON.parse(details);
    } catch {
      return details;
    }
  } else if (typeof details === 'object' && details !== null) {
    data = details as Record<string, unknown>;
  } else {
    return String(details);
  }

  // Primary friendly fields
  if (data.title && typeof data.title === 'string') {
    return data.title;
  }
  if (data.preview && typeof data.preview === 'string') {
    return data.preview;
  }
  if (data.new_status) {
    return data.old_status
      ? `Status changed from ${data.old_status} to ${data.new_status}`
      : `Status set to ${data.new_status}`;
  }
  if (data.message && typeof data.message === 'string') {
    return data.message;
  }
  if (data.note && typeof data.note === 'string') {
    return data.note;
  }

  // Fallback: format clean key-values without JSON syntax
  const parts = Object.entries(data)
    .filter(([_, val]) => val !== null && val !== undefined && typeof val !== 'object')
    .map(([key, val]) => `${key.replace(/_/g, ' ')}: ${val}`);

  return parts.length > 0 ? parts.join(' | ') : '—';
};

export const AuditTrail: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogWithActor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          actor:profiles(*)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching audit logs:', error.message);
      } else {
        setLogs((data as unknown as AuditLogWithActor[]) || []);
      }
    } catch (err) {
      console.error('Error loading audit log:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Shield className="w-5 h-5 text-[#0b3b60]" />
            <span>Central Tamper-Evident Audit Trail</span>
          </h2>
          <p className="text-xs text-slate-500">
            Immutable chronological record of regulatory actions, status transitions, and case allocations
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="p-2 border border-slate-200 hover:bg-slate-50 rounded text-slate-600"
          title="Refresh audit records"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-[#0b3b60] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading audit events from database...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No audit records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Officer / Actor</th>
                  <th className="py-3 px-4">Action Particulars</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px] font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-bold text-[#0b3b60]">
                      {log.action_type}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 font-sans uppercase">
                      {log.entity_type}
                    </td>
                    <td className="py-2.5 px-4 font-sans text-slate-900">
                      {log.actor?.full_name || 'System Auto-Trigger'}
                    </td>
                    <td 
                      className="py-2.5 px-4 text-slate-700 font-sans max-w-md truncate"
                      title={typeof log.details === 'object' ? JSON.stringify(log.details) : undefined}
                    >
                      {formatActionParticulars(log.details)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-500 whitespace-nowrap font-sans">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
