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
    <div className="flex flex-col h-[100dvh] w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <header className="h-16 bg-slate-900 border-b border-slate-800/80 text-white flex items-center justify-between px-4 sm:px-6 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center font-bold text-xl border border-emerald-500/30 text-emerald-400 shadow-xs">
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                PharmaTracker <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">3.0</span>
              </h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full hidden sm:inline-flex">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live System
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-3 sm:gap-5 text-xs items-center">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Workspace Role</span>
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wide px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
              {profile.role}
            </span>
          </div>
          <div className="hidden sm:block h-7 w-px bg-slate-800"></div>
          <div className="flex items-center gap-2 text-slate-200 bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center text-[11px] font-bold">
              {profile.name ? profile.name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
            </div>
            <span className="hidden sm:inline font-medium text-xs text-slate-200">{profile.name}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-800/50 border border-slate-700/80 rounded-lg transition-all ml-1 cursor-pointer"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline font-medium">Logout</span>
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
