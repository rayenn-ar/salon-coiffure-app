'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Smartphone, Mail, ArrowLeft, Check, Copy, AlertTriangle, LogOut } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import api from '../../lib/api';

type MfaStatus = {
  enabled: boolean;
  method: string | null;
};

export default function MfaSetupPage() {
  const router = useRouter();
  const { user, token, _hasHydrated, logout } = useAuthStore();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'choose' | 'totp-qr' | 'totp-verify' | 'email-verify' | 'backup-codes' | 'done'>('choose');
  const [qrCode, setQrCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!token) { router.push('/connexion'); return; }
    fetchStatus();
  }, [_hasHydrated, token]);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/mfa/status');
      setStatus(res.data.data);
    } catch {
      setError('Impossible de charger le statut MFA');
    } finally {
      setLoading(false);
    }
  };

  const logoutAndRedirect = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    logout();
    router.push('/connexion');
  };

  // ─── TOTP Setup ───
  const startTotpSetup = async () => {
    setError('');
    setActionLoading(true);
    try {
      const res = await api.post('/mfa/totp/setup');
      setQrCode(res.data.data.qrCode);
      setTotpSecret(res.data.data.secret);
      setStep('totp-qr');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const verifyTotpSetup = async () => {
    setError('');
    setActionLoading(true);
    try {
      const res = await api.post('/mfa/totp/verify-setup', { code: verifyCode });
      setBackupCodes(res.data.data.backupCodes);
      setStep('backup-codes');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Code invalide');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Email OTP Setup ───
  const startEmailSetup = async () => {
    setError('');
    setActionLoading(true);
    try {
      await api.post('/mfa/email/send');
      setStep('email-verify');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const verifyEmailSetup = async () => {
    setError('');
    setActionLoading(true);
    try {
      // For email MFA setup, we verify then enable
      await api.post('/mfa/email/verify', { code: verifyCode });
      setStep('done');
      fetchStatus();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Code invalide');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Disable MFA ───
  const disableMfa = async () => {
    if (!confirm('Êtes-vous sûr de vouloir désactiver le MFA ?')) return;
    setActionLoading(true);
    try {
      await api.post('/mfa/disable');
      setStatus({ enabled: false, method: null });
      setStep('choose');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} aria-label="Retour" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Authentification MFA</h1>
            <p className="text-sm text-gray-500">Sécurisez votre compte</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
        )}

        {/* ═══ Already enabled ═══ */}
        {status?.enabled && step === 'choose' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-800">MFA activé</p>
                <p className="text-sm text-green-600">
                  Méthode : {status.method === 'totp' ? 'Application TOTP' : status.method === 'email' ? 'Email' : status.method}
                </p>
              </div>
            </div>
            {user?.role === 'ADMIN' ? (
              <div className="space-y-3">
                <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  Pour accéder à l&apos;espace admin, reconnectez-vous afin de vérifier votre identité MFA.
                </p>
                <button
                  onClick={logoutAndRedirect}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  <LogOut className="h-4 w-4" />
                  Se déconnecter et vérifier le MFA
                </button>
              </div>
            ) : (
              <button
                onClick={disableMfa}
                disabled={actionLoading}
                className="w-full border border-red-300 text-red-600 py-2.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Désactivation...' : 'Désactiver le MFA'}
              </button>
            )}
          </div>
        )}

        {/* ═══ Choose method ═══ */}
        {!status?.enabled && step === 'choose' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-4">
              Choisissez une méthode d&apos;authentification à deux facteurs pour renforcer la sécurité de votre compte.
            </p>

            <button
              onClick={startTotpSetup}
              disabled={actionLoading}
              className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-all text-left"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Smartphone className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Application TOTP</p>
                <p className="text-xs text-gray-500">Google Auth, Authy, etc.</p>
              </div>
            </button>

            <button
              onClick={startEmailSetup}
              disabled={actionLoading}
              className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Code par email</p>
                <p className="text-xs text-gray-500">Recevez un code à chaque connexion</p>
              </div>
            </button>
          </div>
        )}

        {/* ═══ TOTP QR Code ═══ */}
        {step === 'totp-qr' && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-600">
              Scannez ce QR code avec votre application d&apos;authentification
            </p>
            {qrCode && (
              <div className="flex justify-center">
                <img src={qrCode} alt="QR Code TOTP" className="w-48 h-48" />
              </div>
            )}
            <div className="text-xs text-gray-400 break-all bg-gray-50 rounded p-2">
              Clé manuelle : {totpSecret}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                Entrez le code affiché dans l&apos;app
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-center text-2xl tracking-widest focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                placeholder="000000"
                autoComplete="one-time-code"
              />
            </div>
            <button
              onClick={verifyTotpSetup}
              disabled={actionLoading || verifyCode.length !== 6}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {actionLoading ? 'Vérification...' : 'Activer le TOTP'}
            </button>
          </div>
        )}

        {/* ═══ Email OTP verify ═══ */}
        {step === 'email-verify' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Un code a été envoyé à votre adresse email. Entrez-le ci-dessous pour activer le MFA par email.
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-center text-2xl tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="000000"
              autoComplete="one-time-code"
            />
            <button
              onClick={verifyEmailSetup}
              disabled={actionLoading || verifyCode.length !== 6}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {actionLoading ? 'Vérification...' : 'Activer MFA Email'}
            </button>
          </div>
        )}

        {/* ═══ Backup Codes ═══ */}
        {step === 'backup-codes' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Codes de secours</p>
                <p className="text-xs text-amber-600">
                  Sauvegardez ces codes en lieu sûr. Ils ne seront plus affichés.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-2 font-mono text-sm">
              {backupCodes.map((code, i) => (
                <div key={i} className="text-center py-1">{code}</div>
              ))}
            </div>

            <button
              onClick={copyBackupCodes}
              className="w-full flex items-center justify-center gap-2 border border-gray-300 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Copy className="h-4 w-4" />
              {copied ? 'Copié !' : 'Copier les codes'}
            </button>

            <button
              onClick={() => { setStep('done'); fetchStatus(); }}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
            >
              J&apos;ai sauvegardé mes codes
            </button>
          </div>
        )}

        {/* ═══ Done ═══ */}
        {step === 'done' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">MFA activé avec succès !</h2>
            {user?.role === 'ADMIN' ? (
              <>
                <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  Reconnectez-vous pour vérifier votre MFA et accéder à l&apos;espace administrateur.
                </p>
                <button
                  onClick={logoutAndRedirect}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  <LogOut className="h-4 w-4" />
                  Se déconnecter et se reconnecter
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  Votre compte est désormais protégé par l&apos;authentification à deux facteurs.
                </p>
                <button
                  onClick={() => router.push('/parametres')}
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  Retour aux paramètres
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
