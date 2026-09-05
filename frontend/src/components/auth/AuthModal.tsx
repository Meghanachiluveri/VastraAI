import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuthStore } from '../../stores/authStore';
import { Lock, Mail, User, CheckCircle2, ArrowRight } from 'lucide-react';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'login',
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(initialTab);
  const { login, signup } = useAuthStore();

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup Form State
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  // Validation & Animation State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [shake, setShake] = useState(false);

  const triggerShake = (msg: string) => {
    setErrorMsg(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const validateEmail = (email: string) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!loginEmail.trim()) {
      triggerShake('Please enter your email address.');
      return;
    }
    if (!validateEmail(loginEmail)) {
      triggerShake('Please enter a valid email address.');
      return;
    }
    if (!loginPassword) {
      triggerShake('Please enter your account password.');
      return;
    }
    if (loginPassword.length < 6) {
      triggerShake('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(loginEmail, loginPassword);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1000);
    } catch {
      triggerShake('Unable to authenticate. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!signupName.trim()) {
      triggerShake('Please provide your full name.');
      return;
    }
    if (!signupEmail.trim() || !validateEmail(signupEmail)) {
      triggerShake('Please provide a valid email address.');
      return;
    }
    if (!signupPassword || signupPassword.length < 6) {
      triggerShake('Password must be at least 6 characters.');
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      triggerShake('Passwords do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(signupName, signupEmail, signupPassword);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1000);
    } catch {
      triggerShake('Unable to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = () => {
    // Visual only
    setIsSubmitting(true);
    setTimeout(() => {
      login('client.atelier@gmail.com');
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 900);
    }, 600);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm">
      <motion.div
        animate={shake ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="p-6 sm:p-8 space-y-6"
      >
        {/* Header with Vastra Brand & Tabs */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center">
            <span className="text-2xl font-serif tracking-tight text-text-primary font-medium">
              Vastra
            </span>
            <span className="text-xs font-sans tracking-widest font-bold text-[#8AA48A] uppercase ml-0.5 relative top-[-1px]">
              .AI
            </span>
          </div>

          <p className="text-xs text-text-secondary font-light">
            Access your curated wishlist, past atelier orders, and AI styling notes.
          </p>

          {/* Tab Switcher */}
          <div className="flex border-b border-[#E6E2DA] dark:border-[#3E443D] pt-2">
            <button
              onClick={() => {
                setActiveTab('login');
                setErrorMsg(null);
              }}
              className={`flex-1 pb-2.5 text-xs uppercase tracking-widest font-semibold transition-colors relative ${
                activeTab === 'login'
                  ? 'text-[#2A2A2A] dark:text-[#F6F7F2]'
                  : 'text-text-secondary hover:text-[#2A2A2A] dark:hover:text-[#F6F7F2]'
              }`}
            >
              Log in
              {activeTab === 'login' && (
                <motion.div
                  layoutId="authTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#8AA48A]"
                />
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('signup');
                setErrorMsg(null);
              }}
              className={`flex-1 pb-2.5 text-xs uppercase tracking-widest font-semibold transition-colors relative ${
                activeTab === 'signup'
                  ? 'text-[#2A2A2A] dark:text-[#F6F7F2]'
                  : 'text-text-secondary hover:text-[#2A2A2A] dark:hover:text-[#F6F7F2]'
              }`}
            >
              Create account
              {activeTab === 'signup' && (
                <motion.div
                  layoutId="authTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#8AA48A]"
                />
              )}
            </button>
          </div>
        </div>

        {/* Error Message Alert */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs text-center font-medium"
            >
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Checkmark State */}
        {isSuccess ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="py-10 text-center space-y-3"
          >
            <div className="w-14 h-14 rounded-full bg-[#7B876F]/20 text-[#7B876F] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-serif text-text-primary font-normal">
              {activeTab === 'login' ? 'Welcome back to Vastra' : 'Account Created Successfully'}
            </h3>
            <p className="text-xs text-text-secondary font-light">
              Synchronizing your atelier preferences...
            </p>
          </motion.div>
        ) : (
          <div>
            {/* 1. LOGIN FORM */}
            {activeTab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="client@vastra.ai"
                      className="w-full bg-surface border border-[#E6E2DA] dark:border-[#3E443D] rounded-full pl-10 pr-4 py-2.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-[#8AA48A]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <label className="uppercase tracking-widest text-text-secondary font-medium">
                      Password
                    </label>
                    <span
                      onClick={() => triggerShake('Password recovery link sent to your registered email.')}
                      className="text-[#8AA48A] hover:underline cursor-pointer font-medium"
                    >
                      Forgot password?
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-surface border border-[#E6E2DA] dark:border-[#3E443D] rounded-full pl-10 pr-4 py-2.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-[#8AA48A]"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    className="w-full"
                    isLoading={isSubmitting}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Log in
                  </Button>

                  {/* Google Button */}
                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    className="w-full py-2.5 px-4 rounded-full border border-[#E6E2DA] dark:border-[#3E443D] bg-surface hover:bg-surface-elevated text-xs text-text-primary font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </div>
              </form>
            )}

            {/* 2. SIGNUP FORM */}
            {activeTab === 'signup' && (
              <form onSubmit={handleSignupSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      placeholder="Aarav Mehta"
                      className="w-full bg-surface border border-[#E6E2DA] dark:border-[#3E443D] rounded-full pl-10 pr-4 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-[#8AA48A]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="client@vastra.ai"
                      className="w-full bg-surface border border-[#E6E2DA] dark:border-[#3E443D] rounded-full pl-10 pr-4 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-[#8AA48A]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-surface border border-[#E6E2DA] dark:border-[#3E443D] rounded-full pl-10 pr-4 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-[#8AA48A]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-surface border border-[#E6E2DA] dark:border-[#3E443D] rounded-full pl-10 pr-4 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-[#8AA48A]"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-2.5">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    className="w-full"
                    isLoading={isSubmitting}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Create account
                  </Button>

                  {/* Google Button */}
                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    className="w-full py-2.5 px-4 rounded-full border border-[#E6E2DA] dark:border-[#3E443D] bg-surface hover:bg-surface-elevated text-xs text-text-primary font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Merchant Gateway Direct Access */}
        <div className="pt-2 border-t border-[#E6E2DA]/80 dark:border-[#3E443D]/80 text-center">
          <Link
            to="/merchant/login"
            onClick={onClose}
            className="text-[11px] text-text-secondary hover:text-[#7B876F] dark:hover:text-[#8AA48A] transition-colors inline-flex items-center gap-1 font-medium"
          >
            <span>Atelier Partner or Merchant?</span>
            <span className="underline decoration-1 underline-offset-2">Access Merchant Portal →</span>
          </Link>
        </div>
      </motion.div>
    </Modal>
  );
};
