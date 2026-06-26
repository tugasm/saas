'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/api';
import Cookies from 'js-cookie';
import Image from "next/image";
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react'; // Menggunakan icon agar lebih pro

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await auth.login(email, password);
      Cookies.set('token', response.data.token);
      Cookies.set('user', JSON.stringify(response.data.user));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login gagal, periksa kredensial Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center items-center bg-surface px-6">
      {/* Container Utama */}
      <div className="w-full max-w-md space-y-8">

        {/* Header Section: Logo & Welcome Text */}
        <div className="flex flex-col items-center">
          <div className="relative w-28 h-28 mb-4">
             <Image
                src="/bexter_logo.png"
                alt="Bexter Logo"
                fill
                className="object-contain"
                priority
              />
          </div>
          <h2 className="mt-2 text-center text-3xl font-bold tracking-tight text-gray-800">
            Welcome Back
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Sign in to access your dashboard
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white py-8 px-6 md:px-10 shadow-soft-lg rounded-3xl">
          <form className="space-y-6" onSubmit={handleSubmit}>

            {/* Error Alert */}
            {error && (
              <div className="rounded-xl bg-red-50 p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-600 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-300" aria-hidden="true" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 border-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white transition-all text-gray-800 placeholder:text-gray-400"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-300" aria-hidden="true" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 border-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white transition-all text-gray-800 placeholder:text-gray-400"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-base font-bold rounded-2xl text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-soft-md"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="animate-spin h-4 w-4" />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>

          {/* Footer Info */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-400">Credential Info</span>
              </div>
            </div>
            <div className="mt-4 text-center text-xs text-gray-400 bg-gray-50 p-2.5 rounded-xl">
              admin@baxter.com / admin123
            </div>
          </div>
        </div>

        {/* Footer Copyright */}
        <p className="text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Baxter POS System. All rights reserved.
        </p>
      </div>
    </div>
  );
}