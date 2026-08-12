import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, KeyRound, User, Lock, ArrowRight, Wallet, CheckCircle2, AlertCircle, Laptop, Mail, ShieldCheck, ArrowLeft, RefreshCw } from 'lucide-react';
import { useTheme } from '../theme.jsx';

export default function Auth({ onLoginSuccess }) {
  const { theme } = useTheme();
  // modes: 'signin' | 'register' | 'forgot-request' | 'forgot-verify' | 'forgot-reset'
  const [mode, setMode] = useState('signin');
  
  // Form fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Forgot password flow state
  const [forgotInput, setForgotInput] = useState('');
  const [resetUsername, setResetUsername] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Status feedback
  const [error, setError] = useState('');
  const [errorAction, setErrorAction] = useState(null);
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resetMessages = () => {
    setError('');
    setErrorAction(null);
    setSuccess('');
  };

  // 1. Submit Sign In or Register
  const handleSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    const isRegister = mode === 'register';
    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    if (!cleanUsername) {
      setError('Please enter your username or registered email.');
      return;
    }
    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    if (isRegister) {
      if (!cleanEmail || !cleanEmail.includes('@')) {
        setError('Please enter a valid email address.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setIsLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: cleanUsername, 
          email: cleanEmail,
          password 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Authentication failed. Please try again.');
        if (data.accountExists) {
          setErrorAction('switch-login');
        } else if (data.accountNotFound) {
          setErrorAction('switch-register');
        }
        setIsLoading(false);
        return;
      }

      if (isRegister) {
        setSuccess('Account created successfully! Signing you in...');
        setTimeout(async () => {
          try {
            const loginRes = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: cleanUsername, password }),
            });
            const loginData = await loginRes.json();
            if (loginRes.ok) {
              onLoginSuccess(loginData.username);
            } else {
              setError('Auto-login failed. Please sign in manually.');
              setMode('signin');
            }
          } catch (err) {
            setError('Auto-login failed. Please sign in.');
            setMode('signin');
          } finally {
            setIsLoading(false);
          }
        }, 1200);
      } else {
        onLoginSuccess(data.username);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Auth request error:', err);
      setError('Connection failed. Please check if server is running.');
      setIsLoading(false);
    }
  };

  // 2. Request Forgot Password Verification Code
  const handleRequestCode = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!forgotInput.trim()) {
      setError('Please enter your username or registered email address.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername: forgotInput.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to request verification code.');
        setIsLoading(false);
        return;
      }

      setResetUsername(data.username);
      setMaskedEmail(data.maskedEmail);
      setSuccess(data.message || `Verification code sent to ${data.maskedEmail}!`);
      setMode('forgot-verify');
    } catch (err) {
      console.error('Forgot password error:', err);
      setError('Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Verify Code
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!verificationCode || verificationCode.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/verify-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: resetUsername,
          code: verificationCode.trim()
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid verification code.');
        setIsLoading(false);
        return;
      }

      setResetToken(data.resetToken);
      setSuccess('Verification code accepted! Choose your new password.');
      setMode('forgot-reset');
    } catch (err) {
      console.error('Verify code error:', err);
      setError('Failed to verify code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Submit New Password Reset
  const handleResetPassword = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!newPassword || newPassword.length < 4) {
      setError('New password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: resetUsername,
          resetToken,
          newPassword
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update password.');
        setIsLoading(false);
        return;
      }

      setUsername(resetUsername);
      setPassword('');
      setConfirmPassword('');
      setSuccess('Password updated successfully! Please sign in with your new password.');
      setMode('signin');
    } catch (err) {
      console.error('Reset password submit error:', err);
      setError('Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans`}>
      {/* Hogwarts magic particles background */}
      {theme.id === 'potter' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
          <div className="absolute top-[10%] left-[20%] w-[350px] h-[350px] bg-amber-500/10 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-[25%] right-[15%] w-[400px] h-[400px] bg-[#9f1239]/5 rounded-full blur-[120px] animate-pulse [animation-delay:2.5s]" />
          <div className="absolute top-20 right-24 text-amber-300/40 animate-ping text-xs">✦</div>
          <div className="absolute top-1/2 left-12 text-amber-400/30 animate-pulse text-sm">★</div>
          <div className="absolute bottom-36 left-[30%] text-amber-200/20 animate-bounce text-xs">✦</div>
        </div>
      )}

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`w-full max-w-md ${theme.panel} border ${theme.border} rounded-2xl shadow-2xl p-6 sm:p-8 relative overflow-hidden`}
        id="auth-panel-card"
      >
        {/* Magic border accent */}
        {theme.id === 'potter' && (
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#d4af37] to-transparent shadow-[0_0_10px_#d4af37]" />
        )}

        {/* Tab Navigation Switcher (for Sign In & Register) */}
        {(mode === 'signin' || mode === 'register') && (
          <div className={`grid grid-cols-2 p-1 border ${theme.border} bg-neutral-900/40 rounded-xl mb-6`} id="auth-tab-bar">
            <button
              id="auth-tab-login"
              type="button"
              onClick={() => {
                setMode('signin');
                resetMessages();
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'signin'
                  ? `${theme.id === 'potter' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm' : 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'}`
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Sign In
            </button>
            <button
              id="auth-tab-register"
              type="button"
              onClick={() => {
                setMode('register');
                resetMessages();
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'register'
                  ? `${theme.id === 'potter' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm' : 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'}`
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Register / New User
            </button>
          </div>
        )}

        <div className="flex flex-col items-center mb-6">
          {/* Logo Icon */}
          <div className={`p-3.5 border ${theme.border} ${theme.cardBg || theme.panel} rounded-2xl mb-3 shadow-lg ${theme.id === 'potter' ? 'text-amber-400 border-amber-500/40 shadow-[0_0_15px_rgba(212,175,55,0.25)]' : 'text-neutral-300'}`}>
            {mode.startsWith('forgot') ? (
              <ShieldCheck className="w-7 h-7 text-amber-400 animate-pulse" />
            ) : theme.id === 'potter' ? (
              <Sparkles className="w-7 h-7 animate-pulse" />
            ) : (
              <Wallet className="w-7 h-7" />
            )}
          </div>

          <p className={`text-[11px] uppercase tracking-widest ${theme.id === 'potter' ? 'text-amber-400/90 font-bold' : 'text-neutral-500'} mb-1`}>
            {theme.id === 'potter' ? '✦ LedgerFlow Financial Treasury' : 'Secure Multi-User Budget Ledger'}
          </p>
          <h2 className={`text-xl font-bold tracking-tight text-center ${theme.id === 'potter' ? 'text-amber-100' : 'text-white'}`}>
            {mode === 'register' && 'Create New Vault Account'}
            {mode === 'signin' && 'Sign In to Your Vault'}
            {mode === 'forgot-request' && 'Reset Password'}
            {mode === 'forgot-verify' && 'Verify 6-Digit Code'}
            {mode === 'forgot-reset' && 'Set New Password'}
          </h2>
          <p className={`text-xs text-center mt-1.5 leading-relaxed ${theme.textMuted}`}>
            {mode === 'register' && 'Enter your username, email, and password to start a fresh budget vault.'}
            {mode === 'signin' && 'Enter your username and password created on any device.'}
            {mode === 'forgot-request' && 'Enter your registered username or email to receive a verification code.'}
            {mode === 'forgot-verify' && `We sent a 6-digit code to ${maskedEmail || 'your email'}. Enter it below.`}
            {mode === 'forgot-reset' && 'Create a new secure password for your LedgerFlow vault account.'}
          </p>
        </div>

        {/* Helpful Banners */}
        {mode === 'signin' && (
          <div className={`mb-5 p-3 rounded-xl text-[11px] leading-relaxed border ${theme.border} bg-amber-500/10 text-amber-200/90 flex items-start gap-2.5 shadow-xs`}>
            <Laptop className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-300 block mb-0.5">Using another device?</strong>
              Enter your exact username &amp; password created on any device to access all your saved expenses.
            </div>
          </div>
        )}

        {mode === 'register' && (
          <div className={`mb-5 p-3 rounded-xl text-[11px] leading-relaxed border ${theme.border} bg-blue-500/10 text-blue-200/90 flex items-start gap-2.5 shadow-xs`}>
            <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-blue-300 block mb-0.5">Already registered on another device?</strong>
              Click the <button type="button" onClick={() => { setMode('signin'); resetMessages(); }} className="underline font-semibold text-blue-200 hover:text-white cursor-pointer">Sign In</button> tab above instead of registering a new account.
            </div>
          </div>
        )}

        {/* Message Notifications */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 overflow-hidden"
              id="auth-error-alert"
            >
              <div className="p-3.5 rounded-lg border border-red-500/30 bg-red-950/20 text-red-300 flex flex-col gap-2 text-xs">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                {errorAction === 'switch-login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      resetMessages();
                    }}
                    className="mt-1 self-start px-3 py-1 text-xs font-semibold bg-amber-500/25 hover:bg-amber-500/40 text-amber-200 border border-amber-500/50 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Switch to Sign In Tab</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
                {errorAction === 'switch-register' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      resetMessages();
                    }}
                    className="mt-1 self-start px-3 py-1 text-xs font-semibold bg-blue-500/25 hover:bg-blue-500/40 text-blue-200 border border-blue-500/50 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Switch to Register Tab</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 overflow-hidden"
              id="auth-success-alert"
            >
              <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-950/20 text-emerald-300 flex items-start gap-2.5 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FORMS */}
        {/* 1. SIGN IN & REGISTER FORM */}
        {(mode === 'signin' || mode === 'register') && (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className={`block text-[11px] uppercase tracking-wider font-semibold mb-1 ${theme.id === 'potter' ? 'text-amber-400/80' : 'text-neutral-400'}`}>
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 inset-y-0 flex items-center text-neutral-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  id="auth-username-input"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  autoComplete="username"
                  className={`w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border ${theme.border} ${theme.inputBg} text-white font-sans transition-all focus:outline-none focus:border-amber-500/50 ${theme.id === 'potter' ? 'placeholder-amber-900/40 text-amber-100' : 'placeholder-neutral-600'}`}
                />
              </div>
            </div>

            {mode === 'register' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="overflow-hidden"
              >
                <label className={`block text-[11px] uppercase tracking-wider font-semibold mb-1 ${theme.id === 'potter' ? 'text-amber-400/80' : 'text-neutral-400'}`}>
                  Email Address <span className="text-amber-400 text-xs">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 inset-y-0 flex items-center text-neutral-500">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    id="auth-email-input"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    autoComplete="email"
                    className={`w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border ${theme.border} ${theme.inputBg} text-white font-sans transition-all focus:outline-none focus:border-amber-500/50 ${theme.id === 'potter' ? 'placeholder-amber-900/40 text-amber-100' : 'placeholder-neutral-600'}`}
                  />
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">Used to receive verification codes if you ever forget your password.</p>
              </motion.div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={`block text-[11px] uppercase tracking-wider font-semibold ${theme.id === 'potter' ? 'text-amber-400/80' : 'text-neutral-400'}`}>
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    id="auth-forgot-password-link"
                    type="button"
                    onClick={() => {
                      setForgotInput(username);
                      setMode('forgot-request');
                      resetMessages();
                    }}
                    className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline transition-colors cursor-pointer font-medium"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 inset-y-0 flex items-center text-neutral-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="auth-password-input"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  className={`w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border ${theme.border} ${theme.inputBg} text-white font-sans transition-all focus:outline-none focus:border-amber-500/50 ${theme.id === 'potter' ? 'placeholder-amber-900/40 text-amber-100' : 'placeholder-neutral-600'}`}
                />
              </div>
            </div>

            {mode === 'register' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="overflow-hidden"
              >
                <label className={`block text-[11px] uppercase tracking-wider font-semibold mb-1 ${theme.id === 'potter' ? 'text-amber-400/80' : 'text-neutral-400'}`}>
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 inset-y-0 flex items-center text-neutral-500">
                    <KeyRound className="w-4 h-4" />
                  </span>
                  <input
                    id="auth-confirm-password-input"
                    type="password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="new-password"
                    className={`w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border ${theme.border} ${theme.inputBg} text-white font-sans transition-all focus:outline-none focus:border-amber-500/50 ${theme.id === 'potter' ? 'placeholder-amber-900/40 text-amber-100' : 'placeholder-neutral-600'}`}
                  />
                </div>
              </motion.div>
            )}

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={isLoading}
              className={`w-full mt-2 py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-md ${theme.buttonPrimary} text-xs font-semibold uppercase tracking-wider transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoading ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {mode === 'register' ? 'Creating Account...' : 'Signing In...'}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  {mode === 'register' ? 'Create Account' : 'Sign In'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              )}
            </button>
          </form>
        )}

        {/* 2. FORGOT PASSWORD STEP 1: REQUEST CODE */}
        {mode === 'forgot-request' && (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div>
              <label className={`block text-[11px] uppercase tracking-wider font-semibold mb-1.5 ${theme.id === 'potter' ? 'text-amber-400/80' : 'text-neutral-400'}`}>
                Username or Registered Email
              </label>
              <div className="relative">
                <span className="absolute left-3 inset-y-0 flex items-center text-neutral-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  id="forgot-input"
                  type="text"
                  placeholder="Enter username or email address"
                  value={forgotInput}
                  onChange={(e) => setForgotInput(e.target.value)}
                  disabled={isLoading}
                  className={`w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border ${theme.border} ${theme.inputBg} text-white font-sans transition-all focus:outline-none focus:border-amber-500/50 ${theme.id === 'potter' ? 'placeholder-amber-900/40 text-amber-100' : 'placeholder-neutral-600'}`}
                />
              </div>
            </div>

            <button
              id="forgot-request-btn"
              type="submit"
              disabled={isLoading}
              className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-md ${theme.buttonPrimary} text-xs font-semibold uppercase tracking-wider transition-all duration-300 disabled:opacity-50`}
            >
              {isLoading ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Sending Verification Code...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  Send Verification Code
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('signin');
                resetMessages();
              }}
              className="w-full py-2 text-xs text-neutral-400 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Sign In
            </button>
          </form>
        )}

        {/* 3. FORGOT PASSWORD STEP 2: VERIFY CODE */}
        {mode === 'forgot-verify' && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label className={`block text-[11px] uppercase tracking-wider font-semibold mb-1.5 ${theme.id === 'potter' ? 'text-amber-400/80' : 'text-neutral-400'}`}>
                6-Digit Verification Code
              </label>
              <div className="relative">
                <span className="absolute left-3 inset-y-0 flex items-center text-neutral-500">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <input
                  id="verification-code-input"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                  disabled={isLoading}
                  className={`w-full pl-9 pr-4 py-2.5 text-center text-lg font-mono tracking-widest font-bold rounded-lg border ${theme.border} ${theme.inputBg} text-white font-sans transition-all focus:outline-none focus:border-amber-500/50 ${theme.id === 'potter' ? 'placeholder-amber-900/40 text-amber-100' : 'placeholder-neutral-600'}`}
                />
              </div>
            </div>

            <button
              id="verify-code-btn"
              type="submit"
              disabled={isLoading}
              className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-md ${theme.buttonPrimary} text-xs font-semibold uppercase tracking-wider transition-all duration-300 disabled:opacity-50`}
            >
              {isLoading ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Verifying Code...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  Verify &amp; Continue
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  setMode('forgot-request');
                  resetMessages();
                }}
                className="text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Change Username/Email
              </button>
              <button
                type="button"
                onClick={handleRequestCode}
                className="text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Resend Code
              </button>
            </div>
          </form>
        )}

        {/* 4. FORGOT PASSWORD STEP 3: RESET PASSWORD */}
        {mode === 'forgot-reset' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className={`block text-[11px] uppercase tracking-wider font-semibold mb-1.5 ${theme.id === 'potter' ? 'text-amber-400/80' : 'text-neutral-400'}`}>
                New Password
              </label>
              <div className="relative">
                <span className="absolute left-3 inset-y-0 flex items-center text-neutral-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="new-password-input"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="new-password"
                  className={`w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border ${theme.border} ${theme.inputBg} text-white font-sans transition-all focus:outline-none focus:border-amber-500/50 ${theme.id === 'potter' ? 'placeholder-amber-900/40 text-amber-100' : 'placeholder-neutral-600'}`}
                />
              </div>
            </div>

            <div>
              <label className={`block text-[11px] uppercase tracking-wider font-semibold mb-1.5 ${theme.id === 'potter' ? 'text-amber-400/80' : 'text-neutral-400'}`}>
                Confirm New Password
              </label>
              <div className="relative">
                <span className="absolute left-3 inset-y-0 flex items-center text-neutral-500">
                  <KeyRound className="w-4 h-4" />
                </span>
                <input
                  id="confirm-new-password-input"
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="new-password"
                  className={`w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border ${theme.border} ${theme.inputBg} text-white font-sans transition-all focus:outline-none focus:border-amber-500/50 ${theme.id === 'potter' ? 'placeholder-amber-900/40 text-amber-100' : 'placeholder-neutral-600'}`}
                />
              </div>
            </div>

            <button
              id="reset-password-submit-btn"
              type="submit"
              disabled={isLoading}
              className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-md ${theme.buttonPrimary} text-xs font-semibold uppercase tracking-wider transition-all duration-300 disabled:opacity-50`}
            >
              {isLoading ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Updating Password...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  Reset Password &amp; Sign In
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              )}
            </button>
          </form>
        )}

        {/* Bottom Toggle Footer for Sign In & Register */}
        {(mode === 'signin' || mode === 'register') && (
          <div className={`mt-6 pt-5 border-t ${theme.border} text-center`}>
            <button
              id="auth-toggle-btn"
              type="button"
              disabled={isLoading}
              onClick={() => {
                setMode(mode === 'signin' ? 'register' : 'signin');
                resetMessages();
              }}
              className="text-xs text-neutral-400 hover:text-white transition-all underline cursor-pointer disabled:opacity-50"
            >
              {mode === 'register'
                ? 'Already registered on another device? Click to Sign In'
                : 'New user? Click to Register a new account'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

