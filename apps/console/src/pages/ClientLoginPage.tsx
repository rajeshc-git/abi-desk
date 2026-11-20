import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Mail,
  Lock,
  AlertCircle,
  KeyRound,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ZohoDeskLogo } from '../components/common/ZohoDeskLogo';
import { formatUserFriendlyError } from '../api/client';

interface ClientLoginPageProps {
  initialMode?: 'password' | 'otp' | 'forgot';
}

export const ClientLoginPage: React.FC<ClientLoginPageProps> = ({ initialMode = 'password' }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    clientLogin,
    clientSendOtp,
    clientVerifyOtp,
    clientForgotPassword,
    clientResetPassword,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(searchParams.get('message'));
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Authentication mode: 'password' | 'otp' | 'forgot'
  const [authMode, setAuthMode] = useState<'password' | 'otp' | 'forgot'>(initialMode);

  // Email OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Password reset state
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password complexity rules matching staff portal
  const isMinLength = newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^a-zA-Z0-9]/.test(newPassword);
  const isPasswordValid = isMinLength && hasLetter && hasNumber && hasSpecial;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const renderPasswordStrength = () => {
    if (!newPassword) return null;
    return (
      <div
        style={{
          marginTop: '6px',
          padding: '12px',
          backgroundColor: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#475569',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Password Requirements:
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: isMinLength ? '#059669' : '#dc2626',
            fontWeight: 500,
          }}
        >
          {isMinLength ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>At least 8 characters</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: hasLetter && hasNumber ? '#059669' : '#dc2626',
            fontWeight: 500,
          }}
        >
          {hasLetter && hasNumber ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>Alphanumeric (both letters & numbers)</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: hasSpecial ? '#059669' : '#dc2626',
            fontWeight: 500,
          }}
        >
          {hasSpecial ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>At least one special character</span>
        </div>
      </div>
    );
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid work email address.');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      await clientLogin(email.trim().toLowerCase(), password);
      navigate('/inbox');
    } catch (err: unknown) {
      setError(formatUserFriendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid work email address.');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await clientSendOtp(email.trim().toLowerCase());
      setOtpSent(true);
      setSuccessMsg(res?.message || `Verification code sent to ${email}. Please check your inbox or spam.`);
    } catch (err: unknown) {
      setError(formatUserFriendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 4) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      await clientVerifyOtp(email.trim().toLowerCase(), otpCode.trim());
      navigate('/inbox');
    } catch (err: unknown) {
      setError(formatUserFriendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendResetCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid work email address.');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await clientForgotPassword(email.trim().toLowerCase());
      setResetOtpSent(true);
      setSuccessMsg(res?.message || `Password reset code sent to ${email}. Check your inbox or spam.`);
    } catch (err: unknown) {
      setError(formatUserFriendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetOtpCode || resetOtpCode.trim().length < 4) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    if (!isPasswordValid) {
      setError('Password must be at least 8 characters, alphanumeric, and contain a special character.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      await clientResetPassword(
        email.trim().toLowerCase(),
        resetOtpCode.trim(),
        newPassword,
      );
      navigate('/inbox');
    } catch (err: unknown) {
      setError(formatUserFriendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="client-login-page"
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e0f2fe',
        padding: '32px 16px',
        overflowY: 'auto',
        boxSizing: 'border-box',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <style>{`
        @media (max-height: 800px) {
          .client-login-page {
            padding: 16px !important;
          }
          .client-login-header {
            margin-bottom: 16px !important;
          }
          .client-login-header .logo-box {
            margin-bottom: 8px !important;
          }
          .client-login-header h1 {
            font-size: 22px !important;
          }
          .client-login-card {
            padding: 22px 24px !important;
          }
        }
        @media (max-height: 660px) {
          .client-login-header {
            margin-bottom: 10px !important;
          }
          .client-login-header p {
            display: none !important;
          }
          .client-login-card {
            padding: 18px 20px !important;
          }
          .client-login-card-wrap {
            transform: scale(0.92);
            transform-origin: center center;
          }
        }
        @media (max-height: 540px) {
          .client-login-card-wrap {
            transform: scale(0.82);
            transform-origin: center center;
          }
        }
      `}</style>
      <div className="client-login-card-wrap" style={{ width: '100%', maxWidth: '440px', margin: 'auto 0' }}>
        {/* Logo and Clean Heading */}
        <div className="client-login-header" style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div className="logo-box" style={{ display: 'inline-block', marginBottom: '10px' }}>
            <ZohoDeskLogo size={46} showText={false} />
          </div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#0369a1',
            }}
          >
            Client Desk
          </h1>
          <p style={{ fontSize: '13px', color: '#0c4a6e', marginTop: '3px', fontWeight: 500 }}>
            Dedicated Organization Ticket Tracking & Issue Desk
          </p>
        </div>

        {/* Crisp Light Login Card */}
        <div
          className="client-login-card"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #7dd3fc',
            borderRadius: '12px',
            padding: '28px',
            boxShadow: '0 12px 28px -5px rgba(2, 132, 199, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.02)',
          }}
        >
          {/* Header Switcher: Normal Login Tabs OR Back from Forgot Password */}
          {authMode === 'forgot' ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
                paddingBottom: '12px',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setAuthMode('password');
                  setError(null);
                  setSuccessMsg(null);
                  setResetOtpSent(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0284c7',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                }}
              >
                <ArrowLeft size={14} /> Back to Sign In
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                backgroundColor: '#f1f5f9',
                borderRadius: '8px',
                padding: '3px',
                marginBottom: '20px',
                border: '1px solid #e2e8f0',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setAuthMode('password');
                  setError(null);
                  setSuccessMsg(null);
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '12.5px',
                  fontWeight: authMode === 'password' ? 700 : 500,
                  color: authMode === 'password' ? '#0369a1' : '#64748b',
                  backgroundColor: authMode === 'password' ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: authMode === 'password' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <KeyRound size={14} /> Password Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('otp');
                  setError(null);
                  setSuccessMsg(null);
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '12.5px',
                  fontWeight: authMode === 'otp' ? 700 : 500,
                  color: authMode === 'otp' ? '#0369a1' : '#64748b',
                  backgroundColor: authMode === 'otp' ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: authMode === 'otp' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Sparkles size={14} /> Email OTP Login
              </button>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: '13px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 500,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                fontSize: '13px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 500,
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 1: PASSWORD LOGIN                                        */}
          {/* ============================================================ */}
          {authMode === 'password' && (
            <form
              onSubmit={handlePasswordSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              {/* Email Address */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  Work Email Address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#64748b',
                    }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@organization.com"
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      color: '#0f172a',
                      outline: 'none',
                      fontSize: '13px',
                    }}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}
                >
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#334155',
                    }}
                  >
                    Password <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('forgot');
                      setError(null);
                      setSuccessMsg(null);
                      setResetOtpSent(false);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '12px',
                      color: '#0284c7',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Forgot / Set password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#64748b',
                    }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{
                      width: '100%',
                      padding: '10px 38px 10px 38px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      color: '#0f172a',
                      outline: 'none',
                      fontSize: '13px',
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* First time / No password callout */}
              <div
                style={{
                  backgroundColor: '#f0f9ff',
                  border: '1px dashed #7dd3fc',
                  borderRadius: '6px',
                  padding: '9px 12px',
                  fontSize: '12px',
                  color: '#0369a1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>First time or no password?</span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('otp');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284c7',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  Use Instant Email OTP →
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '11px',
                  marginTop: '4px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  backgroundColor: '#0284c7',
                  borderColor: '#0284c7',
                }}
              >
                {isLoading ? 'Signing in...' : 'Sign In with Password'}
                <ArrowRight size={15} />
              </button>
            </form>
          )}

          {/* ============================================================ */}
          {/* TAB 2: EMAIL OTP LOGIN                                       */}
          {/* ============================================================ */}
          {authMode === 'otp' && (
            <div>
              {!otpSent ? (
                <form
                  onSubmit={handleSendOtp}
                  style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                  {/* Email Address */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#334155',
                        marginBottom: '6px',
                      }}
                    >
                      Work Email Address <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail
                        size={16}
                        style={{
                          position: 'absolute',
                          left: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#64748b',
                        }}
                      />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@organization.com"
                        style={{
                          width: '100%',
                          padding: '10px 12px 10px 38px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          color: '#0f172a',
                          outline: 'none',
                          fontSize: '13px',
                        }}
                        required
                      />
                    </div>
                    <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>
                      We will send a 6-digit one-time code to this email to sign in instantly.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '11px',
                      marginTop: '4px',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      backgroundColor: '#0284c7',
                      borderColor: '#0284c7',
                    }}
                  >
                    {isLoading ? 'Sending Code...' : 'Send Login OTP to Email'}
                    <Sparkles size={15} />
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={handleVerifyOtp}
                  style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                  <div
                    style={{
                      padding: '10px 12px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#334155',
                    }}
                  >
                    <div><strong>Email:</strong> {email}</div>
                  </div>

                  {/* 6-Digit OTP Code Input */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#334155',
                        marginBottom: '6px',
                      }}
                    >
                      Enter 6-Digit Verification Code <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <KeyRound
                        size={16}
                        style={{
                          position: 'absolute',
                          left: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#64748b',
                        }}
                      />
                      <input
                        type="text"
                        maxLength={6}
                        autoFocus
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        style={{
                          width: '100%',
                          padding: '10px 12px 10px 38px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          color: '#0f172a',
                          outline: 'none',
                          fontSize: '18px',
                          letterSpacing: '4px',
                          fontWeight: 700,
                        }}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || otpCode.length < 6}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '11px',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      backgroundColor: '#0284c7',
                      borderColor: '#0284c7',
                    }}
                  >
                    {isLoading ? 'Verifying...' : 'Verify OTP & Sign In'}
                    <ArrowRight size={15} />
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => handleSendOtp()}
                      disabled={isLoading}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0284c7',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Resend Code
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode('');
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Change Email
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: DEDICATED CLIENT FORGOT / SET PASSWORD                */}
          {/* ============================================================ */}
          {authMode === 'forgot' && (
            <div>
              {!resetOtpSent ? (
                <form
                  onSubmit={handleSendResetCode}
                  style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                  <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 4px 0', lineHeight: 1.5 }}>
                    Enter your work email address below. We will send you a 6-digit verification code to set or reset your password.
                  </p>

                  {/* Email Address */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#334155',
                        marginBottom: '6px',
                      }}
                    >
                      Work Email Address <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail
                        size={16}
                        style={{
                          position: 'absolute',
                          left: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#64748b',
                        }}
                      />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@organization.com"
                        style={{
                          width: '100%',
                          padding: '10px 12px 10px 38px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          color: '#0f172a',
                          outline: 'none',
                          fontSize: '13px',
                        }}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '11px',
                      marginTop: '4px',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      backgroundColor: '#0284c7',
                      borderColor: '#0284c7',
                    }}
                  >
                    {isLoading ? 'Sending Code...' : 'Send Password Reset Code'}
                    <ArrowRight size={15} />
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={handleResetPasswordSubmit}
                  style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                  <div
                    style={{
                      padding: '10px 12px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#334155',
                    }}
                  >
                    <div><strong>Email:</strong> {email}</div>
                  </div>

                  {/* 6-Digit Code */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#334155',
                        marginBottom: '6px',
                      }}
                    >
                      Enter 6-Digit Code <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <KeyRound
                        size={16}
                        style={{
                          position: 'absolute',
                          left: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#64748b',
                        }}
                      />
                      <input
                        type="text"
                        maxLength={6}
                        autoFocus
                        value={resetOtpCode}
                        onChange={(e) => setResetOtpCode(e.target.value.replace(/\D/g, ''))}
                        style={{
                          width: '100%',
                          padding: '10px 12px 10px 38px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          color: '#0f172a',
                          outline: 'none',
                          fontSize: '18px',
                          letterSpacing: '4px',
                          fontWeight: 700,
                        }}
                        required
                      />
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#334155',
                        marginBottom: '6px',
                      }}
                    >
                      New Password <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock
                        size={16}
                        style={{
                          position: 'absolute',
                          left: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#64748b',
                        }}
                      />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{
                          width: '100%',
                          padding: '10px 38px 10px 38px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          color: '#0f172a',
                          outline: 'none',
                          fontSize: '13px',
                        }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {renderPasswordStrength()}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#334155',
                        marginBottom: '6px',
                      }}
                    >
                      Confirm Password <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock
                        size={16}
                        style={{
                          position: 'absolute',
                          left: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#64748b',
                        }}
                      />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{
                          width: '100%',
                          padding: '10px 38px 10px 38px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          color: '#0f172a',
                          outline: 'none',
                          fontSize: '13px',
                        }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {confirmPassword && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          marginTop: '6px',
                          color: passwordsMatch ? '#059669' : '#dc2626',
                          fontWeight: 500,
                        }}
                      >
                        {passwordsMatch ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || resetOtpCode.length < 4 || !isPasswordValid || !passwordsMatch}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '11px',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      backgroundColor: '#0284c7',
                      borderColor: '#0284c7',
                      opacity: !isPasswordValid || !passwordsMatch || resetOtpCode.length < 4 ? 0.6 : 1,
                      cursor: !isPasswordValid || !passwordsMatch || resetOtpCode.length < 4 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isLoading ? 'Setting Password...' : 'Save Password & Sign In'}
                    <ArrowRight size={15} />
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => handleSendResetCode()}
                      disabled={isLoading}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0284c7',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Resend Code
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResetOtpSent(false);
                        setResetOtpCode('');
                        setNewPassword('');
                        setConfirmPassword('');
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Change Email
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Switch to Agent Login */}
          <div
            style={{
              textAlign: 'center',
              marginTop: '22px',
              paddingTop: '16px',
              borderTop: '1px solid #e2e8f0',
              fontSize: '12.5px',
              color: '#64748b',
            }}
          >
            Are you a support agent or admin?{' '}
            <Link
              to="/login"
              style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'none' }}
            >
              Sign in to Staff Console →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
