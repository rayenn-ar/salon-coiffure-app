'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, UserPlus, Mail, KeyRound, User } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import api from '../../lib/api';

type Step = 'email' | 'otp' | 'details';

const STEP_LABELS: Record<Step, string> = {
  email: 'Votre email',
  otp: 'Code de vérification',
  details: 'Vos informations',
};

const STEP_ICONS: Record<Step, React.ReactNode> = {
  email: <Mail className="h-8 w-8 text-white" />,
  otp: <KeyRound className="h-8 w-8 text-white" />,
  details: <User className="h-8 w-8 text-white" />,
};

const OTP_EXPIRY_SECONDS = 600; // 10 min

export default function InscriptionPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpToken, setOtpToken] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [form, setForm] = useState({ nom: '', prenom: '', telephone: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const loginStore = useAuthStore((s) => s.login);

  // OTP digit refs for auto-focus
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ==================== Step 1: email ====================

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/request-otp', { email });
      setCountdown(OTP_EXPIRY_SECONDS);
      setStep('otp');
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erreur lors de l\'envoi du code');
    } finally {
      setLoading(false);
    }
  };

  // ==================== Step 2: OTP ====================

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length !== 6) { setError('Entrez le code à 6 chiffres'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { email, code });
      setOtpToken(res.data.data.otpToken as string);
      setStep('details');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Code invalide ou expiré');
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/request-otp', { email });
      setOtpDigits(['', '', '', '', '', '']);
      setCountdown(OTP_EXPIRY_SECONDS);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      setError('Impossible de renvoyer le code. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  // ==================== Step 3: details ====================

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (form.password.length < 12) {
      setError('Le mot de passe doit faire au moins 12 caractères');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post(
        '/auth/complete-registration',
        {
          nom: form.nom,
          prenom: form.prenom,
          telephone: form.telephone || undefined,
          password: form.password,
        },
        { headers: { Authorization: `Bearer ${otpToken}` } },
      );
      loginStore(res.data.data.token, res.data.data.user, res.data.data.refreshToken);
      router.push('/mon-espace');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (msg?.includes('expiré') || msg?.includes('invalide')) {
        setError('Session expirée. Recommencez depuis le début.');
        setStep('email');
        setOtpDigits(['', '', '', '', '', '']);
        setOtpToken('');
      } else {
        setError(msg || 'Erreur lors de l\'inscription');
      }
    } finally {
      setLoading(false);
    }
  };

  // ==================== Progress Indicator ====================

  const stepOrder: Step[] = ['email', 'otp', 'details'];
  const stepIndex = stepOrder.indexOf(step);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            {STEP_ICONS[step]}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Créer un compte</h1>
          <p className="text-gray-500 text-sm mt-1">{STEP_LABELS[step]}</p>
        </div>

        {/* Step progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {stepOrder.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < stepIndex
                    ? 'bg-green-500 text-white'
                    : i === stepIndex
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i < stepIndex ? '✓' : i + 1}
              </div>
              {i < stepOrder.length - 1 && (
                <div className={`w-8 h-0.5 ${i < stepIndex ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
        )}

        {/* ==================== STEP 1: EMAIL ==================== */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
                placeholder="vous@email.fr"
              />
              <p className="text-xs text-gray-400 mt-1">
                Un code de vérification à 6 chiffres vous sera envoyé par email.
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Envoi en cours…' : 'Recevoir le code'}
            </button>
          </form>
        )}

        {/* ==================== STEP 2: OTP ==================== */}
        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Code envoyé à <strong>{email}</strong>.{' '}
              <button
                type="button"
                onClick={() => setStep('email')}
                className="text-pink-500 hover:underline text-sm"
              >
                Modifier
              </button>
            </p>

            {/* 6-digit input */}
            <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
              {otpDigits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-11 h-14 text-center text-2xl font-bold border-2 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none border-gray-300"
                />
              ))}
            </div>

            {/* Countdown */}
            {countdown > 0 && (
              <p className="text-center text-sm text-gray-400">
                Code valide pendant <span className="font-mono font-semibold text-gray-600">{formatCountdown(countdown)}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={loading || otpDigits.join('').length !== 6}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Vérification…' : 'Vérifier le code'}
            </button>

            {/* Resend */}
            <p className="text-center text-sm text-gray-500">
              Code non reçu ?{' '}
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={countdown > 0 || loading}
                className="text-pink-600 font-medium hover:underline disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {countdown > 0 ? `Renvoyer dans ${formatCountdown(countdown)}` : 'Renvoyer'}
              </button>
            </p>
          </form>
        )}

        {/* ==================== STEP 3: DETAILS ==================== */}
        {step === 'details' && (
          <form onSubmit={handleDetailsSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                <input
                  type="text"
                  name="prenom"
                  value={form.prenom}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
                  placeholder="Sophie"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input
                  type="text"
                  name="nom"
                  value={form.nom}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
                  placeholder="Martin"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone (optionnel)</label>
              <input
                type="tel"
                name="telephone"
                value={form.telephone}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
                placeholder="06 12 34 56 78"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
                  placeholder="12 caractères minimum"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className="mt-1 flex gap-1">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      form.password.length > i * 4
                        ? form.password.length >= 16
                          ? 'bg-green-500'
                          : form.password.length >= 12
                          ? 'bg-yellow-400'
                          : 'bg-red-400'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Création du compte…' : 'Créer mon compte'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          Déjà un compte ?{' '}
          <Link href="/connexion" className="text-pink-600 font-medium hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}

