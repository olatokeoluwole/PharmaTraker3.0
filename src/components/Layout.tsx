import { ReactNode } from 'react';
import { UserProfile } from '../types';
import { supabase } from '../supabase';
import { Activity, LogOut, User } from 'lucide-react';

export default function Layout({ 
  profile, 
  children, 
  onLogout
}: { 
  profile: UserProfile; 
  children: ReactNode; 
  onLogout?: () => void;
}) {
  const handleLogout = async () => {
    try {
      localStorage.setItem('pharmatracker_manual_logout', 'true');
      localStorage.removeItem('pharmatracker_active_session');
      if (onLogout) onLogout();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Logout notice:", err);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#FAFAFA] text-slate-900 font-sans overflow-hidden">
      <header className="h-16 bg-indigo-950 border-b border-indigo-900/50 text-white flex items-center justify-between px-4 sm:px-6 shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600/20 rounded flex items-center justify-center font-bold text-xl border border-indigo-500/30">
            <Activity className="w-5 h-5 text-indigo-400" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">
            PharmaTracker 3.0 <span className="text-indigo-300/70 font-light text-sm hidden sm:inline">| System Status</span>
          </h1>
        </div>
        <div className="flex gap-4 sm:gap-6 text-xs uppercase tracking-widest font-bold items-center">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-indigo-400">User Role</span>
            <span className="text-indigo-100 font-normal">{profile.role}</span>
          </div>
          <div className="hidden sm:block h-8 w-px bg-indigo-800/50"></div>
          <div className="flex items-center gap-2 text-slate-200">
            <User className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline font-medium">{profile.name}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center text-indigo-300 hover:text-white transition-colors ml-2"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>
      <main className="flex-1 flex p-2 sm:p-4 overflow-hidden">
        <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden pb-8">
          {children}
        </div>
      </main>
    </div>
  );
}
