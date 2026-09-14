import { useEffect, useState, Dispatch, SetStateAction } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { setTenantId } from './db';
import { RefreshCw, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { UserProfile, Role } from './types';
import AuthView from './components/AuthView';
import Layout from './components/Layout';
import DoctorView from './components/DoctorView';
import BranchView from './components/BranchView';
import StoreView from './components/StoreView';
import AdminView from './components/AdminView';
import HMOView from './components/HMOView';
import SuperAdminView from './components/SuperAdminView';

interface PendingApprovalProps {
  user: User;
  profile: UserProfile;
  setProfile: Dispatch<SetStateAction<UserProfile | null>>;
  onLogout: () => void;
}

function PendingApprovalView({ user, profile, setProfile, onLogout }: PendingApprovalProps) {
  const [checkingRole, setCheckingRole] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const userEmail = (user.email || '').trim().toLowerCase();

    const applyDataIfFound = (data: any) => {
      const assignedRole = data?.role as Role;
      if (assignedRole && assignedRole !== 'pending') {
        const payload: any = { role: assignedRole };
        if (data.location_id) payload.locationId = data.location_id;
        
        // Update local state
        setProfile(prev => prev ? { ...prev, ...payload } : null);
        
        // Update user record in db if needed
        supabase.from('users').upsert({ id: user.id, ...payload }).then(() => {});
      }
    };

    // 1. Check immediately
    const checkNow = async () => {
      try {
        const { data: staffData } = await supabase.from('staff_roles').select('*').eq('email', userEmail).maybeSingle();
        if (staffData?.role && staffData.role !== 'pending') {
          applyDataIfFound(staffData);
          return;
        }
        const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
        if (userData?.role && userData.role !== 'pending') {
          applyDataIfFound(userData);
        }
      } catch (e) {
        // silent check
      }
    };
    checkNow();

    // 2. Realtime listener via Supabase
    const staffChannel = supabase.channel('public:staff_roles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_roles', filter: `email=eq.${userEmail}` }, (payload) => {
        applyDataIfFound(payload.new);
      }).subscribe();

    const usersChannel = supabase.channel('public:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${user.id}` }, (payload) => {
        applyDataIfFound(payload.new);
      }).subscribe();

    // 3. Fallback active polling every 5 seconds
    const interval = setInterval(checkNow, 5000);

    return () => {
      supabase.removeChannel(staffChannel);
      supabase.removeChannel(usersChannel);
      clearInterval(interval);
    };
  }, [user, setProfile]);

  const handleManualRoleCheck = async () => {
    if (!user) return;
    setCheckingRole(true);
    setCheckResult(null);
    try {
      const userEmail = (user.email || '').trim().toLowerCase();
      
      const { data: staffData } = await supabase.from('staff_roles').select('*').eq('email', userEmail).maybeSingle();
      const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
      
      let assignedRole: Role = 'pending';
      if (staffData?.role && staffData.role !== 'pending') {
        assignedRole = staffData.role as Role;
      } else if (userData?.role && userData.role !== 'pending') {
        assignedRole = userData.role as Role;
      }

      if (assignedRole !== 'pending') {
        await supabase.from('users').upsert({ id: user.id, role: assignedRole });
        setProfile(prev => prev ? { ...prev, role: assignedRole } : null);
        setCheckResult(`Role confirmed: ${assignedRole.toUpperCase()}! Opening workspace...`);
      } else {
        setCheckResult('Awaiting role assignment by administrator in User Management.');
        setTimeout(() => setCheckResult(null), 4000);
      }
    } catch (e: any) {
      setCheckResult('Unable to check role: ' + (e?.message || 'Permission check'));
    } finally {
      setCheckingRole(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-lg mx-auto text-center p-8 bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mb-4 text-amber-600 border border-amber-200">
        <ShieldAlert className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Awaiting Role Assignment</h2>
      <p className="text-xs text-slate-500 font-medium mb-3">Logged in as <span className="font-semibold text-slate-800">{profile.email}</span></p>
      <p className="text-sm text-slate-600 leading-relaxed mb-6">
        An administrator just needs to assign your role (HMO, Doctor, Branch, Store, or Admin) in the admin panel. As soon as your role is set, your workspace activates immediately with no further approval needed.
      </p>

      {checkResult && (
        <div className={`mb-4 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 ${
          checkResult.includes('confirmed') || checkResult.includes('upgraded') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700'
        }`}>
          <CheckCircle2 className="w-4 h-4" />
          {checkResult}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
        <button
          onClick={handleManualRoleCheck}
          disabled={checkingRole}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checkingRole ? 'animate-spin' : ''}`} />
          {checkingRole ? 'Refreshing...' : 'Refresh Access'}
        </button>
        <button
          onClick={onLogout}
          className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
        >
          Sign Out / Switch Account
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const isManualLogout = localStorage.getItem('pharmatracker_manual_logout') === 'true';
      if (isManualLogout) return null;
      const saved = localStorage.getItem('pharmatracker_active_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.profile || null;
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setLoading(false);
      } else {
        fetchProfile(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user;
        if (currentUser) {
          localStorage.removeItem('pharmatracker_manual_logout');
          setUser(currentUser);
          await fetchProfile(currentUser);
        } else {
          setUser(null);
          setProfile(null);
          localStorage.removeItem('pharmatracker_active_session');
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (currentUser: User) => {
    try {
      const userEmail = (currentUser.email || '').toLowerCase();
      const isSuperAdmin = userEmail === 'olatokeoluwole@gmail.com' || userEmail === 'oreloretechcustomerservice@gmail.com';
      
      let effectiveRole: Role = 'pending';
      let displayName = currentUser.user_metadata?.name || userEmail.split('@')[0];
      let locationId = undefined;
      let organizationId = undefined;

      // Check staff_roles first
      const { data: staffData } = await supabase.from('staff_roles').select('*').eq('email', userEmail).maybeSingle();
      if (staffData?.role && staffData.role !== 'pending') {
        effectiveRole = staffData.role;
        displayName = staffData.name || displayName;
        locationId = staffData.location_id;
        organizationId = staffData.organization_id;
      } else {
        // Fallback to users table
        const { data: userData } = await supabase.from('users').select('*').eq('id', currentUser.id).maybeSingle();
        if (userData?.role) {
          effectiveRole = userData.role;
        }
        if (userData?.name) {
          displayName = userData.name;
        }
        locationId = userData?.location_id;
        organizationId = userData?.organization_id;
      }

      if (isSuperAdmin) {
        effectiveRole = 'super_admin';
        organizationId = undefined; // Super admin doesn't belong to a single organization
      }

      setTenantId(organizationId || null);

      const freshProfile: UserProfile = {
        id: currentUser.id,
        name: displayName,
        email: userEmail,
        role: effectiveRole,
        locationId,
        organizationId
      };

      // Ensure the user is synced to the users table (important for OAuth logins)
      supabase.from('users').upsert({ 
        id: currentUser.id, 
        email: userEmail, 
        role: effectiveRole, 
        name: displayName,
        location_id: locationId || null,
        organization_id: organizationId || null
      }).then(() => {});

      setProfile(freshProfile);
      localStorage.setItem('pharmatracker_active_session', JSON.stringify({
        uid: currentUser.id,
        email: userEmail,
        profile: freshProfile,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error("Error fetching profile", e);
    } finally {
      setLoading(false);
    }
  };

  const handleManualLogout = async (reason?: string) => {
    localStorage.setItem('pharmatracker_manual_logout', 'true');
    localStorage.removeItem('pharmatracker_active_session');
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    if (reason) {
      alert(reason);
    }
  };

  useEffect(() => {
    if (!user || !profile) return;

    let inactivityTimer: any;
    const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

    const resetTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        handleManualLogout("You have been automatically logged out due to 5 minutes of inactivity for security purposes.");
      }, TIMEOUT_MS);
    };

    // Initialize timer
    resetTimer();

    // Listeners for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const handleActivity = () => {
      resetTimer();
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [user, profile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return <AuthView onLogin={() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) fetchProfile(session.user);
      });
    }}/>;
  }

  return (
    <BrowserRouter>
      <Layout profile={profile} onLogout={handleManualLogout}>
        <Routes>
          <Route path="/" element={
            profile.role === 'super_admin' ? <SuperAdminView profile={profile} /> :
            profile.role === 'admin' ? <AdminView profile={profile} /> :
            profile.role === 'store' ? <StoreView profile={profile} /> :
            profile.role === 'doctor' ? <DoctorView profile={profile} /> :
            profile.role === 'hmo' ? <HMOView profile={profile} /> :
            profile.role === 'branch' ? <BranchView profile={profile} /> :
            <PendingApprovalView
              user={user}
              profile={profile}
              setProfile={setProfile}
              onLogout={handleManualLogout}
            />
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
