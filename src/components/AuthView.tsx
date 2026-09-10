import React, { useState, useRef } from "react";
import { supabase } from '../supabase';
import { Activity, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { Role } from '../types';

function parseAuthError(err: any): { title: string; message: string; isNetwork: boolean } | null {
  const rawMsg = err?.message || String(err);
  if (rawMsg.includes('Failed to fetch') || rawMsg.includes('network')) {
    return { title: 'Network Connection Issue', message: 'A network request to authentication servers could not be completed.', isNetwork: true };
  }
  if (rawMsg.includes('Invalid login credentials')) {
    return { title: 'Incorrect Password', message: 'The password you entered is incorrect. If you previously signed in with Google, click "Continue with Google" below.', isNetwork: false };
  }
  if (rawMsg.includes('User already registered')) {
    return { title: 'Account Already Exists', message: 'An account with this email address already exists. Please switch to "Sign in" and enter your password, or use Google.', isNetwork: false };
  }
  if (rawMsg.includes('Email not confirmed')) {
    return { title: 'Email Not Confirmed', message: 'Please check your email inbox and click the confirmation link to activate your account.', isNetwork: false };
  }
  return { title: 'Authentication Error', message: rawMsg, isNetwork: false };
}

export default function AuthView({ onLogin }: { onLogin: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorInfo, setErrorInfo] = useState<{ title: string; message: string; isNetwork: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const getAssignedRole = async (userEmail: string): Promise<Role> => {
    let assignedRole: Role = 'pending';
    const isSuperAdmin = userEmail.toLowerCase() === 'oreloretechcustomerservice@gmail.com' || userEmail.toLowerCase() === 'olatokeoluwole@gmail.com';
    try {
      const { data, error } = await supabase.from('staff_roles').select('role').eq('email', userEmail.toLowerCase()).maybeSingle();
      if (data?.role) {
        assignedRole = data.role as Role;
      }
    } catch (e) {
      console.error('Failed to fetch staff role', e);
    }
    if (assignedRole === 'pending' && isSuperAdmin) {
      return 'admin';
    }
    return assignedRole;
  };

  const handleGoogleLogin = async () => {
    if (loading) return;
    setErrorInfo(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
      // Google Auth redirects, so onLogin will be handled by App.tsx session listener
    } catch (err: any) {
      console.warn('Google login issue:', err);
      setErrorInfo(parseAuthError(err));
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorInfo({ title: 'Email Required', message: 'Please enter your email address to reset your password.', isNetwork: false });
      return;
    }
    setErrorInfo(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      setErrorInfo(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorInfo(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim();
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
        
        const userEmail = cleanEmail.toLowerCase();
        const assignedRole = await getAssignedRole(userEmail);
        
        // Sync role just in case
        if (data.user) {
          const { data: userDoc } = await supabase.from('users').select('role').eq('id', data.user.id).maybeSingle();
          if (!userDoc || userDoc.role === 'pending' && assignedRole !== 'pending') {
            await supabase.from('users').upsert({ id: data.user.id, email: userEmail, role: assignedRole, name: data.user.user_metadata?.name || userEmail.split('@')[0] });
          }
        }
        localStorage.removeItem('pharmatracker_manual_logout');
        onLogin();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { name } }
        });
        if (error) throw error;
        
        if (data.user && data.session === null) {
          setErrorInfo({
            title: 'Email Confirmation Required',
            message: 'Your account was created, but Supabase requires you to confirm your email. Please check your inbox for a confirmation link, or disable "Confirm email" in your Supabase Dashboard under Authentication -> Providers -> Email.',
            isNetwork: false
          });
          setLoading(false);
          return;
        }

        // Auto trigger login or wait
        const userEmail = cleanEmail.toLowerCase();
        const assignedRole = await getAssignedRole(userEmail);
        
        if (data.user) {
          await supabase.from('users').upsert({ id: data.user.id, email: userEmail, role: assignedRole, name });
        }
        localStorage.removeItem('pharmatracker_manual_logout');
        onLogin();
      }
    } catch (err: any) {
      console.error("Auth submit error:", err);
      setErrorInfo(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center shadow-sm">
            <Activity className="w-6 h-6 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold text-slate-800 tracking-tight">
          PharmaTracker
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          {isForgotPassword 
            ? 'Enter your email to reset your password' 
            : isLogin ? 'Sign in to access clinical units' : 'Register a new clinical account'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-lg sm:px-10 border border-slate-300">
          <form className="space-y-5" onSubmit={isForgotPassword ? handleResetPassword : handleSubmit}>
            {errorInfo && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-lg text-xs space-y-1.5 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-red-900">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorInfo.title}</span>
                </div>
                <p className="text-red-700 leading-relaxed">{errorInfo.message}</p>
              </div>
            )}
            
            {resetSent && (
              <div className="bg-green-50 border border-green-200 text-green-800 p-3.5 rounded-lg text-xs space-y-1.5 shadow-sm">
                <p className="font-bold">Password Reset Email Sent!</p>
                <p>Check your inbox for the link to reset your password.</p>
              </div>
            )}
            
            {!isLogin && !isForgotPassword && (
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-300 rounded bg-slate-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-3 py-2 border border-slate-300 rounded bg-slate-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>

            {!isForgotPassword && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Password</label>
                  {isLogin && (
                    <button type="button" onClick={() => { setIsForgotPassword(true); setErrorInfo(null); }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-300 rounded bg-slate-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
              </div>
            )}

            <div className="pt-2 flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded text-sm font-bold text-white bg-slate-900 shadow-sm hover:bg-slate-800 focus:outline-none disabled:opacity-50 transition-colors"
              >
                {loading ? 'Processing...' : (isForgotPassword ? 'Send Reset Link' : isLogin ? 'Sign in' : 'Register Account')}
              </button>
              
              {!isForgotPassword && (
                <>
                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-2 bg-white text-slate-500 uppercase font-bold tracking-wider">
                        Or continue with
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex justify-center items-center py-2.5 px-4 border border-slate-300 rounded text-sm font-bold text-slate-700 bg-white shadow-sm hover:bg-slate-50 focus:outline-none disabled:opacity-50 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google
                  </button>
                </>
              )}
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white text-slate-500 uppercase font-bold tracking-wider">
                  {isForgotPassword ? 'Back to login' : isLogin ? 'New to MedTrack?' : 'Already registered?'}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => {
                  if (isForgotPassword) {
                    setIsForgotPassword(false);
                    setIsLogin(true);
                  } else {
                    setIsLogin(!isLogin);
                  }
                  setErrorInfo(null);
                  setResetSent(false);
                }}
                className="w-full flex justify-center py-2 px-4 border border-slate-300 rounded shadow-sm text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none transition-colors"
              >
                {isForgotPassword ? 'Sign in to existing account' : isLogin ? 'Create an account' : 'Sign in to existing account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
