// src/pages/LoginPage.tsx
import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { APPWRITE_CONFIGURED, MISSING_APPWRITE_ENV } from '../lib/env';

type Tab = 'login' | 'register';

export default function LoginPage() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'register' ? 'register' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { login, register, loginWithGoogle, sendMagicLink, user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();

  // Already logged in
  useEffect(() => {
    if (user) nav('/home', { replace: true });
  }, [user, nav]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'Enter a valid email.';
    if (password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (tab === 'register' && name.trim().length < 2) e.name = 'Enter your full name.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(email, password);
        toast('Welcome back!', 'success');
      } else {
        await register(name.trim(), email, password);
        toast('Account created! Welcome to RideX 🎉', 'success');
      }
      nav('/home');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      if (msg.includes('Invalid credentials')) {
        setErrors({ email: 'Incorrect email or password.' });
      } else if (msg.includes('already exists')) {
        setErrors({ email: 'An account with this email already exists.' });
      } else {
        toast(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setErrors({ email: 'Enter a valid email.' });
      return;
    }
    setMagicLoading(true);
    try {
      await sendMagicLink(trimmedEmail);
      toast('Magic link sent. Check your email to sign in.', 'success');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to send magic link.', 'error');
    } finally {
      setMagicLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-surface flex flex-col">

      {/* Back button */}
      <header className="px-5 py-5">
        <button
          onClick={() => nav('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          {!APPWRITE_CONFIGURED && (
            <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Appwrite is not configured. Missing: {MISSING_APPWRITE_ENV.join(', ')}.
            </div>
          )}

          {/* Logo */}
          <div className="text-center mb-8">
            <span className="text-3xl font-black tracking-tight">
              Ride<span className="text-brand">X</span>
            </span>
            <p className="text-slate-400 text-sm mt-1">
              {tab === 'login' ? 'Sign in to continue' : 'Create your account'}
            </p>
          </div>

          {/* Tab selector */}
          <div className="flex bg-surface-card rounded-xl p-1 mb-7 border border-white/8">
            {(['login', 'register'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setErrors({}); }}
                className={[
                  'flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 capitalize',
                  tab === t ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-slate-400 hover:text-white',
                ].join(' ')}
              >
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <AnimatePresence initial={false} mode="popLayout">
              {tab === 'register' && (
                <motion.div
                  key="name-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <Input
                    label="Full name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Rahul Sharma"
                    icon={<User size={15} />}
                    error={errors.name}
                    autoComplete="name"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              icon={<Mail size={15} />}
              error={errors.email}
              autoComplete="email"
            />

            <Input
              label="Password"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              icon={<Lock size={15} />}
              error={errors.password}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              suffix={
                <button type="button" onClick={() => setShowPass(v => !v)} className="text-slate-400 hover:text-white transition-colors">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />

            {tab === 'login' && (
              <div className="text-right -mt-1">
                <button type="button" className="text-xs text-brand hover:text-blue-400 transition-colors">
                  Forgot password?
                </button>
              </div>
            )}

            <Button type="submit" fullWidth size="lg" loading={loading} className="mt-2">
              {tab === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-xs text-slate-500">or continue as</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          <Button
            variant="secondary"
            fullWidth
            size="md"
            onClick={loginWithGoogle}
          >
            Continue with Google
          </Button>

          {tab === 'login' && (
            <Button
              variant="ghost"
              fullWidth
              size="md"
              className="mt-3"
              loading={magicLoading}
              onClick={handleMagicLink}
            >
              Email me a magic link
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
