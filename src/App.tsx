import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { PublicGrievancePortal } from './pages/PublicGrievancePortal';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { Dashboard } from './features/dashboard/Dashboard';
import { ComplaintList } from './features/complaints/ComplaintList';
import { ComplaintRegistration } from './features/complaints/ComplaintRegistration';
import { RespondComplaint } from './features/complaints/RespondComplaint';
import { OverlapDashboard } from './features/overlap-engine/OverlapDashboard';
import { ComplaintDetails } from './features/complaints/ComplaintDetails';
import { AssignmentManagement } from './features/assignments/AssignmentManagement';
import { ReportsView } from './features/reports/ReportsView';
import { AuditTrail } from './features/audit/AuditTrail';
import { UserManagement } from './features/admin/UserManagement';
import { Loader2 } from 'lucide-react';

const AuthenticatedPortal: React.FC = () => {
  const { user, isAdmin, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [publicView, setPublicView] = useState<'portal' | 'login'>('portal');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center font-sans">
        <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center p-2 shadow-sm border border-slate-200 mb-4">
          <img src="/aicte-emblem.png" alt="AICTE Emblem" className="w-10 h-10 object-contain animate-pulse" />
        </div>
        <div className="flex items-center space-x-2 text-slate-800 font-semibold text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-[#0b3b60]" />
          <span>Verifying AICTE Officer Session...</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">Connecting to authoritative Supabase database</p>
      </div>
    );
  }

  if (!user) {
    if (publicView === 'portal') {
      return <PublicGrievancePortal onGoToLogin={() => setPublicView('login')} />;
    }
    return <Login onGoToPublicPortal={() => setPublicView('portal')} />;
  }

  const renderActiveView = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <Dashboard
            onNavigateTab={setCurrentTab}
            onSelectComplaint={(id) => {
              setSelectedComplaintId(id);
              setCurrentTab('complaint-detail');
            }}
          />
        );

      case 'complaints':
        return (
          <ComplaintList
            onSelectComplaint={(id) => {
              setSelectedComplaintId(id);
              setCurrentTab('complaint-detail');
            }}
            onNewComplaint={() => setCurrentTab('respond')}
          />
        );

      case 'overlap':
        return (
          <OverlapDashboard
            onSelectComplaint={(id) => {
              setSelectedComplaintId(id);
              setCurrentTab('complaint-detail');
            }}
          />
        );

      case 'respond':
        return (
          <RespondComplaint
            initialComplaintId={selectedComplaintId}
            onViewCaseDossier={(id) => {
              setSelectedComplaintId(id);
              setCurrentTab('complaint-detail');
            }}
          />
        );

      case 'register':
        return (
          <ComplaintRegistration
            onSuccess={(id) => {
              setSelectedComplaintId(id);
              setCurrentTab('complaint-detail');
            }}
            onCancel={() => setCurrentTab('complaints')}
          />
        );

      case 'complaint-detail':
        return selectedComplaintId ? (
          <ComplaintDetails
            complaintId={selectedComplaintId}
            onBack={() => setCurrentTab('complaints')}
            onRespond={(id) => {
              setSelectedComplaintId(id);
              setCurrentTab('respond');
            }}
            onNavigateToOverlap={() => setCurrentTab('overlap')}
          />
        ) : (
          <ComplaintList
            onSelectComplaint={(id) => {
              setSelectedComplaintId(id);
              setCurrentTab('complaint-detail');
            }}
            onNewComplaint={() => setCurrentTab('register')}
          />
        );

      case 'assignments':
        return isAdmin ? (
          <AssignmentManagement
            onSelectComplaint={(id) => {
              setSelectedComplaintId(id);
              setCurrentTab('complaint-detail');
            }}
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded p-8 text-center text-xs text-slate-500">
            Access restricted: Administrator privileges required to reallocate cases between bureaus. Bureau officers can only respond to cases within their own bureau.
          </div>
        );

      case 'reports':
        return <ReportsView />;

      case 'audit':
        return <AuditTrail />;

      case 'users':
        return isAdmin ? (
          <UserManagement />
        ) : (
          <div className="bg-white border border-slate-200 rounded p-8 text-center text-xs text-slate-500">
            Access restricted: Administrator privileges required to manage officers and bureau desks.
          </div>
        );

      default:
        return (
          <Dashboard
            onNavigateTab={setCurrentTab}
            onSelectComplaint={(id) => {
              setSelectedComplaintId(id);
              setCurrentTab('complaint-detail');
            }}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <Header onNavigate={setCurrentTab} />

      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Left Side Navigation */}
        <Sidebar
          currentTab={currentTab === 'complaint-detail' ? 'complaints' : currentTab}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            if (tab !== 'complaint-detail') setSelectedComplaintId(null);
          }}
        />

        {/* Main Workspace Area */}
        <main className="flex-1 min-w-0">
          {renderActiveView()}
        </main>
      </div>

      {/* Official Government Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-4 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left space-y-2 sm:space-y-0">
          <div>
            AICTE Cross-Bureau Complaint Coordination Platform • SIH Problem Statement ID: 26264
          </div>
          <div className="text-slate-500">
            Regulation Bureau (RB), Public Grievance Redressal Cell (PGRC) & Central Vigilance
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedPortal />
    </AuthProvider>
  );
}
