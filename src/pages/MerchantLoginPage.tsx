import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMerchantAuthStore } from '../stores/merchantAuthStore';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Building2,
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';

export const MerchantLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isMerchantLoggedIn } = useMerchantAuthStore();

  // If already logged in, redirect to /merchant
  React.useEffect(() => {
    if (isMerchantLoggedIn) {
      navigate('/merchant', { replace: true });
    }
  }, [isMerchantLoggedIn, navigate]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = 'Merchant email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validate()) return;

    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        const destination = (location.state as any)?.from?.pathname || '/merchant';
        navigate(destination, { replace: true });
      } else {
        setErrorMessage(result.message || 'Invalid merchant credentials.');
      }
    } catch {
      setErrorMessage('Unable to connect to the authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#1A1E1A] text-[#2A2A2A] dark:text-[#F6F7F2] flex flex-col justify-between selection:bg-[#8AA48A]/30 selection:text-[#2A2A2A]">
      {/* Top Bar Navigation */}
      <header className="px-6 py-5 sm:px-12 flex items-center justify-between border-b border-[#E6E2DA] dark:border-[#3E443D] bg-[#FDFBF7]/90 dark:bg-[#1A1E1A]/90 backdrop-blur-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#6D856D] hover:text-[#5E6854] dark:text-[#8AA48A] dark:hover:text-[#A0B092] transition-colors font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Storefront</span>
        </Link>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#CFD8CF]/40 dark:bg-[#3E443D] border border-[#8AA48A]/25">
          <span className="w-2 h-2 rounded-full bg-[#8AA48A] animate-pulse" />
          <span className="text-[11px] uppercase tracking-widest text-[#2A2A2A] dark:text-[#F6F7F2] font-semibold">
            Merchant Gateway
          </span>
        </div>
      </header>

      {/* Main Login Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-md bg-[#FCFCF9] dark:bg-[#252924] rounded-3xl border border-[#E6E2DA] dark:border-[#3E443D] p-7 sm:p-10 shadow-subtle space-y-7"
        >
          {/* Header Brand */}
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#8AA48A]/15 dark:bg-[#3E443D] border border-[#8AA48A]/40 text-[#5E6854] dark:text-[#8AA48A] text-[10px] font-bold tracking-widest uppercase">
              <Building2 className="w-3 h-3 text-[#6D856D] dark:text-[#8AA48A]" />
              <span>Merchant Portal</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-serif font-medium text-[#2A2A2A] dark:text-[#F6F7F2] tracking-tight">
              Welcome back, Merchant.
            </h1>

            <p className="text-xs sm:text-sm text-text-secondary dark:text-[#C8CDC5] font-light leading-relaxed">
              Manage your commerce, AI shopping performance and customer orders.
            </p>
          </div>

          {/* Inline Error Alert */}
          <AnimatePresence>
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest font-semibold text-text-secondary dark:text-[#C8CDC5] block">
                Merchant Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondary">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (formErrors.email) setFormErrors({ ...formErrors, email: undefined });
                  }}
                  placeholder="merchant@vastra.ai"
                  className={`w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-[#FDFBF7] dark:bg-[#1A1E1A] text-[#2A2A2A] dark:text-[#F6F7F2] border transition-colors focus:outline-none ${
                    formErrors.email
                      ? 'border-red-500'
                      : 'border-[#E6E2DA] dark:border-[#3E443D] focus:border-[#8AA48A]'
                  }`}
                />
              </div>
              {formErrors.email && (
                <p className="text-[11px] text-red-500 pl-2">{formErrors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest font-semibold text-text-secondary dark:text-[#C8CDC5] block">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondary">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formErrors.password) setFormErrors({ ...formErrors, password: undefined });
                  }}
                  placeholder="••••••••••••"
                  className={`w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-2xl bg-[#FDFBF7] dark:bg-[#1A1E1A] text-[#2A2A2A] dark:text-[#F6F7F2] border transition-colors focus:outline-none ${
                    formErrors.password
                      ? 'border-red-500'
                      : 'border-[#E6E2DA] dark:border-[#3E443D] focus:border-[#8AA48A]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-text-secondary hover:text-[#2A2A2A] dark:hover:text-[#F6F7F2] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {formErrors.password && (
                <p className="text-[11px] text-red-500 pl-2">{formErrors.password}</p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-[#6D856D] dark:text-[#8AA48A] focus:ring-0 border-[#E6E2DA] dark:border-[#3E443D] accent-[#8AA48A]"
                />
                <span className="text-xs text-text-secondary dark:text-[#C8CDC5]">Remember me</span>
              </label>

              <span className="text-[11px] text-text-secondary dark:text-[#C8CDC5] font-mono">
                Secure Session
              </span>
            </div>

            {/* Quick Demo Credentials Autofill Banner */}
            <div className="p-3.5 rounded-2xl bg-[#CFD8CF]/35 dark:bg-[#343833] border border-[#8AA48A]/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#5E6854] dark:text-[#A0B092] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#6D856D] dark:text-[#8AA48A]" />
                  Demo Merchant Access
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('merchant@vastra.ai');
                    setPassword('VastraMerchant2026!');
                    setFormErrors({});
                  }}
                  className="text-[11px] font-bold text-[#6D856D] dark:text-[#8AA48A] hover:underline cursor-pointer transition-colors"
                >
                  Autofill Credentials
                </button>
              </div>
              <div className="text-[11px] font-mono text-text-secondary dark:text-[#C8CDC5] space-y-0.5">
                <p>Email: <span className="text-[#2A2A2A] dark:text-[#F6F7F2] font-semibold">merchant@vastra.ai</span></p>
                <p>Password: <span className="text-[#2A2A2A] dark:text-[#F6F7F2] font-semibold">VastraMerchant2026!</span></p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-5 rounded-2xl bg-[#8AA48A] hover:bg-[#758E75] disabled:opacity-50 text-[#2A2A2A] text-xs sm:text-sm font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-subtle active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-[#2A2A2A] border-t-transparent rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in to Merchant Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security Notice */}
          <div className="pt-4 border-t border-[#E6E2DA]/60 dark:border-[#3E443D] flex items-center gap-2 text-[11px] text-text-secondary dark:text-[#C8CDC5]">
            <ShieldCheck className="w-4 h-4 text-[#8AA48A] shrink-0" />
            <span>Encrypted merchant session. Protected with role-based API security.</span>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-text-secondary dark:text-[#C8CDC5]">
        <span>&copy; {new Date().getFullYear()} Vastra.AI • Private Commerce Atelier Portal</span>
      </footer>
    </div>
  );
};

export default MerchantLoginPage;
