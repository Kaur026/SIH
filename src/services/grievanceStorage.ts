// Grievance persistence and regulatory policy helper
// Handles citizen registration, 7-day rate-limiting, SMS dispatch records, and 15-day proof timeout

export interface RegisteredCitizen {
  fullName: string;
  category: string;
  email: string;
  phone: string;
  rollNo: string;
  institutionId: string;
  institutionName: string;
  password?: string;
  registeredAt: string;
}

export interface OfficialBureauResponse {
  id: string;
  complaintId: string;
  complaintNumber: string;
  dispatchType: string;
  refNo: string;
  responseBody: string;
  officerName: string;
  officerBureau: string;
  hearingDate?: string | null;
  smsDispatchedTo: string;
  smsText: string;
  smsStatus: 'Delivered' | 'Transmitted';
  requiresProof: boolean;
  proofDeadline?: string | null;
  isAutoClosedTimeout?: boolean;
  closureReason?: string | null;
  createdAt: string;
}

const CITIZENS_STORAGE_KEY = 'aicte_registered_citizens';
const RESPONSES_STORAGE_KEY = 'aicte_official_responses';
const SUBMISSIONS_STORAGE_KEY = 'aicte_submission_history';

// Default pre-seeded registered citizens for testing
const DEFAULT_CITIZENS: RegisteredCitizen[] = [
  {
    fullName: 'Aarav Sharma',
    category: 'Student',
    email: 'aarav.sharma@coep.ac.in',
    phone: '+91 98230 11223',
    rollNo: '2023-BTECH-CS-042',
    institutionId: 'inst-004',
    institutionName: 'College of Engineering Pune (COEP)',
    password: 'Password@123',
    registeredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    fullName: 'Dr. Meenakshi Sundaram',
    category: 'Faculty',
    email: 'm.sundaram@coep.ac.in',
    phone: '+91 94440 55667',
    rollNo: 'EMP-COEP-8842',
    institutionId: 'inst-004',
    institutionName: 'College of Engineering Pune (COEP)',
    password: 'Password@123',
    registeredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// --- 1. CITIZEN REGISTRATION & LOGIN ---

export function getRegisteredCitizens(): RegisteredCitizen[] {
  try {
    const raw = localStorage.getItem(CITIZENS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CITIZENS_STORAGE_KEY, JSON.stringify(DEFAULT_CITIZENS));
      return DEFAULT_CITIZENS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CITIZENS;
  } catch {
    return DEFAULT_CITIZENS;
  }
}

export function registerCitizen(citizen: Omit<RegisteredCitizen, 'registeredAt'>): RegisteredCitizen {
  const citizens = getRegisteredCitizens();
  const normalizedEmail = citizen.email.trim().toLowerCase();

  const existingIndex = citizens.findIndex((c) => c.email.toLowerCase() === normalizedEmail);
  if (existingIndex >= 0) {
    throw new Error('This email ID has already been registered. Registered emails are permanent.');
  }

  const newEntry: RegisteredCitizen = {
    ...citizen,
    email: normalizedEmail,
    registeredAt: new Date().toISOString(),
  };

  citizens.push(newEntry);
  localStorage.setItem(CITIZENS_STORAGE_KEY, JSON.stringify(citizens));
  return newEntry;
}

export function authenticateCitizen(email: string): RegisteredCitizen | null {
  const citizens = getRegisteredCitizens();
  const normalized = email.trim().toLowerCase();
  return citizens.find((c) => c.email.toLowerCase() === normalized) || null;
}

// --- 2. 7-DAY GRIEVANCE RATE LIMITING ---

export interface SubmissionRecord {
  email: string;
  complaintNumber: string;
  submittedAt: string;
}

export function check7DaySubmissionRestriction(email: string): { allowed: boolean; daysRemaining?: number; nextEligibleDate?: string; lastSubmittedAt?: string } {
  const normalized = email.trim().toLowerCase();
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    const submissions: SubmissionRecord[] = raw ? JSON.parse(raw) : [];

    const userSubmissions = submissions
      .filter((s) => s.email.toLowerCase() === normalized)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    if (userSubmissions.length === 0) {
      return { allowed: true };
    }

    const last = userSubmissions[0];
    const lastDate = new Date(last.submittedAt).getTime();
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const diff = now - lastDate;

    if (diff < sevenDaysMs) {
      const remainingMs = sevenDaysMs - diff;
      const daysRemaining = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
      const nextDate = new Date(lastDate + sevenDaysMs);
      return {
        allowed: false,
        daysRemaining,
        nextEligibleDate: nextDate.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        lastSubmittedAt: new Date(lastDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
      };
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export function recordGrievanceSubmission(email: string, complaintNumber: string) {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    const submissions: SubmissionRecord[] = raw ? JSON.parse(raw) : [];
    submissions.push({
      email: email.trim().toLowerCase(),
      complaintNumber,
      submittedAt: new Date().toISOString(),
    });
    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(submissions));
  } catch {
    // ignore
  }
}

// --- 3. OFFICIAL RESPONSES, SMS DISPATCH & 15-DAY PROOF TIMEOUT ---

export function getOfficialResponses(complaintIdOrNumber: string): OfficialBureauResponse[] {
  try {
    const raw = localStorage.getItem(RESPONSES_STORAGE_KEY);
    const all: OfficialBureauResponse[] = raw ? JSON.parse(raw) : [];
    const clean = complaintIdOrNumber.trim().toUpperCase();
    return all.filter((r) => r.complaintId === complaintIdOrNumber || r.complaintNumber.toUpperCase() === clean);
  } catch {
    return [];
  }
}

export function saveOfficialResponse(response: Omit<OfficialBureauResponse, 'id' | 'createdAt'>): OfficialBureauResponse {
  try {
    const raw = localStorage.getItem(RESPONSES_STORAGE_KEY);
    const all: OfficialBureauResponse[] = raw ? JSON.parse(raw) : [];

    const newResponse: OfficialBureauResponse = {
      ...response,
      id: `resp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };

    all.push(newResponse);
    localStorage.setItem(RESPONSES_STORAGE_KEY, JSON.stringify(all));
    return newResponse;
  } catch (err) {
    console.error('Error saving response to local storage:', err);
    throw err;
  }
}

// 15-day timeout check: if proof requested and 15 days have elapsed, auto-close the grievance
export function checkAndApply15DayProofTimeout(complaintIdOrNumber: string): { isAutoClosed: boolean; reason: string | null } {
  try {
    const responses = getOfficialResponses(complaintIdOrNumber);
    const proofRequest = responses.find((r) => r.requiresProof && r.proofDeadline);

    if (!proofRequest) {
      return { isAutoClosed: false, reason: null };
    }

    if (proofRequest.isAutoClosedTimeout) {
      return {
        isAutoClosed: true,
        reason: proofRequest.closureReason || 'Complainant failed to submit necessary proofs within the stipulated 15-day regulatory timeframe.',
      };
    }

    const deadline = new Date(proofRequest.proofDeadline!).getTime();
    const now = Date.now();

    if (now > deadline) {
      // Mark as auto-closed in local storage
      const raw = localStorage.getItem(RESPONSES_STORAGE_KEY);
      if (raw) {
        const all: OfficialBureauResponse[] = JSON.parse(raw);
        for (const item of all) {
          if (item.id === proofRequest.id) {
            item.isAutoClosedTimeout = true;
            item.closureReason = 'Case closed automatically: Complainant failed to submit necessary proofs / supporting documents within the stipulated 15-day regulatory timeframe.';
          }
        }
        localStorage.setItem(RESPONSES_STORAGE_KEY, JSON.stringify(all));
      }

      return {
        isAutoClosed: true,
        reason: 'Case closed automatically: Complainant failed to submit necessary proofs / supporting documents within the stipulated 15-day regulatory timeframe.',
      };
    }

    return { isAutoClosed: false, reason: null };
  } catch {
    return { isAutoClosed: false, reason: null };
  }
}

// Manually trigger 15-day timeout for demo / evaluation testing
export function simulate15DayProofTimeout(complaintIdOrNumber: string): OfficialBureauResponse | null {
  try {
    const raw = localStorage.getItem(RESPONSES_STORAGE_KEY);
    if (!raw) return null;
    const all: OfficialBureauResponse[] = JSON.parse(raw);
    const clean = complaintIdOrNumber.trim().toUpperCase();

    const target = all.find((r) => (r.complaintId === complaintIdOrNumber || r.complaintNumber.toUpperCase() === clean) && r.requiresProof);
    if (target) {
      target.isAutoClosedTimeout = true;
      target.closureReason = 'Case closed automatically: Complainant failed to submit necessary proofs / supporting documents within the stipulated 15-day regulatory timeframe.';
      target.proofDeadline = new Date(Date.now() - 1000).toISOString();
      localStorage.setItem(RESPONSES_STORAGE_KEY, JSON.stringify(all));
      return target;
    }
    return null;
  } catch {
    return null;
  }
}
