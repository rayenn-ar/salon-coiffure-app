'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Shield, Key } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import api from '../../lib/api';
import LogoBloom from '../../components/LogoBloom';

export default function ConnexionPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaMethod, setMfaMethod] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [pendingToken, setPendingToken] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const router = useRouter();
  const { login, setMfaPending } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      const data = res.data.data;

      // ➤ MFA Required — show verification step
      if (data.mfaRequired) {
        setMfaStep(true);
        setMfaMethod(data.mfaMethod);
        setPendingToken(data.pendingToken);
        setMfaPending(true, data.pendingToken, data.user);
        return;
      }

      // ➤ Direct login (no MFA)
      login(data.token, data.user, data.refreshToken);

      const { role, mustChangePassword } = data.user;
      if (mustChangePassword) {
        router.push('/parametres?forceChange=1');
        return;
      }
      if (role === 'ADMIN') router.push('/admin');
      else if (role === 'COIFFEUSE') router.push('/espace-pro');
      else router.push('/mon-espace');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMfaLoading(true);

    try {
      let endpoint = '/mfa/totp/verify';
      if (mfaMethod === 'webauthn') {
        // WebAuthn requires @simplewebauthn/browser — not yet integrated
        await api.post('/mfa/webauthn/auth-options', { pendingToken });
        setError('WebAuthn non supporté dans cette version. Utilisez un code de secours.');
        setMfaLoading(false);
        return;
      } else if (mfaMethod === 'email') {
        endpoint = '/mfa/email/verify';
      }

      const res = await api.post(endpoint, { code: mfaCode, pendingToken });
      const data = res.data.data;

      login(data.token, data.user, data.refreshToken);

      const { role } = data.user;
      if (role === 'ADMIN') router.push('/admin');
      else if (role === 'COIFFEUSE') router.push('/espace-pro');
      else router.push('/mon-espace');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Code MFA incorrect');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleUseBackupCode = async () => {
    setError('');
    setMfaLoading(true);
    try {
      const res = await api.post('/mfa/backup/verify', { code: mfaCode, pendingToken });
      const data = res.data.data;
      login(data.token, data.user, data.refreshToken);
      const { role } = data.user;
      if (role === 'ADMIN') router.push('/admin');
      else if (role === 'COIFFEUSE') router.push('/espace-pro');
      else router.push('/mon-espace');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Code de secours invalide');
    } finally {
      setMfaLoading(false);
    }
  };

  const requestEmailOtp = async () => {
    try {
      await api.post('/mfa/email/send', { pendingToken });
      setMfaMethod('email');
      setError('');
    } catch {
      setError('Erreur lors de l\'envoi du code par email');
    }
  };

  // ═══ MFA Verification Step ═══
  if (mfaStep) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Vérification MFA</h1>
            <p className="text-gray-500 text-sm mt-1">
              {mfaMethod === 'totp' && 'Entrez le code de votre application d\'authentification'}
              {mfaMethod === 'email' && 'Entrez le code reçu par email'}
              {mfaMethod === 'webauthn' && 'Utilisez votre clé de sécurité'}
            </p>
          </div>

          <form onSubmit={handleMfaVerify} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {mfaMethod === 'totp' ? 'Code TOTP' : mfaMethod === 'email' ? 'Code Email' : 'Code de sécurité'}
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\s/g, ''))}
                autoComplete="one-time-code"
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-center text-2xl tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="000000"
              />
            </div>

            <button
              type="submit"
              disabled={mfaLoading || mfaCode.length < 6}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {mfaLoading ? 'Vérification...' : 'Vérifier'}
            </button>
          </form>

          <div className="mt-6 space-y-2">
            <button
              onClick={handleUseBackupCode}
              disabled={mfaCode.length < 6}
              className="w-full text-sm text-gray-500 hover:text-blue-600 flex items-center justify-center gap-1"
            >
              <Key className="h-4 w-4" /> Utiliser un code de secours
            </button>
            {mfaMethod !== 'email' && (
              <button
                onClick={requestEmailOtp}
                className="w-full text-sm text-gray-500 hover:text-blue-600"
              >
                Recevoir un code par email
              </button>
            )}
            <button
              onClick={() => { setMfaStep(false); setMfaCode(''); setError(''); }}
              className="w-full text-sm text-gray-400 hover:text-gray-600"
            >
              Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ Login Form ═══
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <LogoBloom size="md" color="#000000" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Connexion</h1>
          <p className="text-gray-500 text-sm mt-1">Accédez à votre espace personnel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
              placeholder="votre@email.fr"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/mot-de-passe-oublie" className="text-sm text-pink-600 hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Pas encore de compte ?{' '}
          <Link href="/inscription" className="text-pink-600 font-medium hover:underline">
            S&apos;inscrire
          </Link>
        </p>
      </div>
    </div>
  );
}
