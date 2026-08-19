import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  Building2,
  User,
  Mail,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Key,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

import { ZohoDeskLogo } from '../components/common/ZohoDeskLogo';

import { formatUserFriendlyError, ApiClient } from '../api/client';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { requestRegisterOtp, verifyRegisterOtp, acceptInvitation } = useAuth();
  const toast = useToast();

  const tokenParam = searchParams.get('token');

  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [step, setStep] = useState<'DETAILS' | 'OTP' | 'JOIN'>('DETAILS');
  const [invitationDetails, setInvitationDetails] = useState<{
    email: string;
    tenantName: string;
    roleName: string;
    brandName: string | null;
  } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const isMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const isPasswordValid = isMinLength && hasLetter && hasNumber && hasSpecial;

  const renderPasswordStrength = () => {
    if (!password) return null;
    return (
      <div
        style={{
          marginTop: '4px',
          padding: '12px',
          backgroundColor: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: 'var(--radius-md)',
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
          <span>Alphanumeric (contain both letters & numbers)</span>
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

  useEffect(() => {
    if (tokenParam) {
      loadInvitation(tokenParam);
    }
  }, [tokenParam]);

  const loadInvitation = async (tokenVal: string) => {
    setIsLoading(true);
    setInviteError(null);
    try {
      const details = await ApiClient.get(`/auth/invitations/${tokenVal}`);
      setInvitationDetails(details);
      setEmail(details.email);
      setStep('JOIN');
    } catch (err: any) {
      setInviteError(err.message || 'The invitation code is invalid or has expired.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError(
        'Password does not meet all requirements: at least 8 characters, alphanumeric, and containing a special character.',
      );
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      await requestRegisterOtp(companyName, fullName, email, password);
      setStep('OTP');
    } catch (err: any) {
      setError(formatUserFriendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const otpValue = otpDigits.join('');

    if (otpValue.length !== 6) {
      setError('OTP must be exactly 6 digits.');
      return;
    }

    setIsLoading(true);

    try {
      await verifyRegisterOtp(email, otpValue);
      setIsSuccess(true);
      setTimeout(() => {
        navigate('/inbox');
      }, 1500);
    } catch (err: any) {
      setError(formatUserFriendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!tokenParam) return;

    if (!isPasswordValid) {
      setError(
        'Password does not meet all requirements: at least 8 characters, alphanumeric, and containing a special character.',
      );
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      await acceptInvitation(tokenParam, fullName, password);
      setIsSuccess(true);
      setTimeout(() => {
        navigate('/inbox');
      }, 1500);
    } catch (err: any) {
      setError(formatUserFriendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    const digit = numericValue[numericValue.length - 1];
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    if (index < 5 && digit) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        const newDigits = [...otpDigits];
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...otpDigits];
        newDigits[index] = '';
        setOtpDigits(newDigits);
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const numericDigits = pastedData.replace(/\D/g, '').slice(0, 6);

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = numericDigits[i] || '';
    }
    setOtpDigits(newDigits);

    const nextFocusIndex = Math.min(numericDigits.length, 5);
    inputRefs.current[nextFocusIndex]?.focus();
  };

  const handleResendOtp = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await requestRegisterOtp(companyName, fullName, email, password);
      toast.success('A new OTP has been sent to your email.');
    } catch (err: any) {
      setError(formatUserFriendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '480px' }}>
        {/* Branding Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'inline-block', marginBottom: '10px' }}>
            <ZohoDeskLogo size={48} showText={false} />
          </div>
          <h1
            style={{
              fontSize: '26px',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#0f172a',
            }}
          >
            {step === 'DETAILS' ? 'Register Your Organization' : 'Email Verification'}
          </h1>
          <p style={{ fontSize: '13px', color: '#475569', marginTop: '4px', fontWeight: 500 }}>
            {step === 'DETAILS'
              ? 'Set up your enterprise customer support helpdesk in seconds'
              : `Enter the 6-digit verification code sent to ${email}`}
          </p>
        </div>

        {/* Crisp Light Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
          }}
        >
          {isSuccess ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircle2 size={48} color="#059669" style={{ margin: '0 auto 16px' }} />
              <h3
                style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}
              >
                Organization Registered!
              </h3>
              <p style={{ fontSize: '13px', color: '#475569' }}>
                Your organization has been successfully registered. Redirecting you to your
                console...
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    fontSize: '13px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 500,
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {inviteError && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    fontSize: '13px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 500,
                  }}
                >
                  <ShieldAlert size={16} />
                  <span>{inviteError}</span>
                </div>
              )}

              {step === 'DETAILS' && !inviteError && (
                <form
                  onSubmit={handleSubmitDetails}
                  style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
                >
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
                      Company / Organization Name *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Building2
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
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. Acme Healthcare"
                        style={{
                          width: '100%',
                          padding: '10px 12px 10px 38px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: 'var(--radius-md)',
                          color: '#0f172a',
                          outline: 'none',
                          fontSize: '13px',
                        }}
                        required
                      />
                    </div>
                  </div>

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
                      Administrator Full Name *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User
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
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Sarah Connor"
                        style={{
                          width: '100%',
                          padding: '10px 12px 10px 38px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: 'var(--radius-md)',
                          color: '#0f172a',
                          outline: 'none',
                          fontSize: '13px',
                        }}
                        required
                      />
                    </div>
                  </div>

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
                      Work Email Address *
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
                        placeholder="sarah@acme.com"
                        style={{
                          width: '100%',
                          padding: '10px 12px 10px 38px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: 'var(--radius-md)',
                          color: '#0f172a',
                          outline: 'none',
                          fontSize: '13px',
                        }}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                        Password *
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
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          style={{
                            width: '100%',
                            padding: '10px 12px 10px 38px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: 'var(--radius-md)',
                            color: '#0f172a',
                            outline: 'none',
                            fontSize: '13px',
                          }}
                          required
                        />
                      </div>
                    </div>

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
                        Confirm Password *
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
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          style={{
                            width: '100%',
                            padding: '10px 12px 10px 38px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: 'var(--radius-md)',
                            color: '#0f172a',
                            outline: 'none',
                            fontSize: '13px',
                          }}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {renderPasswordStrength()}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '12px',
                      marginTop: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    {isLoading ? 'Sending verification OTP...' : 'Register & Create Organization'}
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}

              {step === 'OTP' && !inviteError && (
                <form
                  onSubmit={handleVerifyOtp}
                  style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#334155',
                        marginBottom: '8px',
                        textAlign: 'center',
                      }}
                    >
                      Verification Code *
                    </label>
                    <div
                      style={{
                        display: 'flex',
                        gap: '10px',
                        justifyContent: 'center',
                        margin: '8px 0',
                      }}
                    >
                      {Array(6)
                        .fill(null)
                        .map((_, i) => (
                          <input
                            key={i}
                            ref={(el) => {
                              inputRefs.current[i] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={otpDigits[i]}
                            onChange={(e) => handleOtpChange(i, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(i, e)}
                            onPaste={handleOtpPaste}
                            maxLength={1}
                            style={{
                              width: '42px',
                              height: '48px',
                              fontSize: '20px',
                              fontWeight: 700,
                              textAlign: 'center',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: 'var(--radius-md)',
                              color: '#0f172a',
                              outline: 'none',
                              transition: 'all 0.15s ease',
                              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = 'var(--primary)';
                              e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = '#cbd5e1';
                              e.target.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.05)';
                            }}
                            required
                          />
                        ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 600 }}
                  >
                    {isLoading ? 'Verifying OTP...' : 'Verify OTP & Complete Setup'}
                    <ArrowRight size={16} />
                  </button>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: '8px',
                      fontSize: '13px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setStep('DETAILS')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        fontWeight: 600,
                        padding: 0,
                      }}
                    >
                      &larr; Go Back
                    </button>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isLoading}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        padding: 0,
                      }}
                    >
                      Resend OTP Code
                    </button>
                  </div>
                </form>
              )}

              {step === 'JOIN' && invitationDetails && !inviteError && (
                <form
                  onSubmit={handleJoinSubmit}
                  style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
                >
                  <div
                    style={{
                      padding: '14px',
                      backgroundColor: 'rgba(37,99,235,0.07)',
                      border: '1px solid rgba(37,99,235,0.2)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '8px',
                    }}
                  >
                    <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 600 }}>
                      You have been invited to join 🏢{' '}
                      <strong>{invitationDetails.tenantName}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      Role: 🔑 <strong>{invitationDetails.roleName}</strong>{' '}
                      {invitationDetails.brandName && `| Brand: 🏷️ ${invitationDetails.brandName}`}
                    </div>
                  </div>

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
                      Your Email Address
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail
                        size={16}
                        style={{
                          position: 'absolute',
                          left: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#94a3b8',
                        }}
                      />
                      <input
                        type="email"
                        value={email}
                        disabled
                        style={{
                          width: '100%',
                          padding: '10px 12px 10px 38px',
                          backgroundColor: '#e2e8f0',
                          border: '1px solid #cbd5e1',
                          borderRadius: 'var(--radius-md)',
                          color: '#64748b',
                          fontSize: '13px',
                          cursor: 'not-allowed',
                        }}
                      />
                    </div>
                  </div>

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
                      Your Full Name *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User
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
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. John Doe"
                        style={{
                          width: '100%',
                          padding: '10px 12px 10px 38px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: 'var(--radius-md)',
                          color: '#0f172a',
                          outline: 'none',
                          fontSize: '13px',
                        }}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                        Password *
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
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          style={{
                            width: '100%',
                            padding: '10px 12px 10px 38px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: 'var(--radius-md)',
                            color: '#0f172a',
                            outline: 'none',
                            fontSize: '13px',
                          }}
                          required
                        />
                      </div>
                    </div>

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
                        Confirm Password *
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
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          style={{
                            width: '100%',
                            padding: '10px 12px 10px 38px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: 'var(--radius-md)',
                            color: '#0f172a',
                            outline: 'none',
                            fontSize: '13px',
                          }}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {renderPasswordStrength()}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '12px',
                      marginTop: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    {isLoading ? 'Accepting Invitation...' : 'Accept Invitation & Join'}
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}

              {step === 'DETAILS' && !inviteError && (
                <div
                  style={{
                    textAlign: 'center',
                    marginTop: '20px',
                    fontSize: '13px',
                    color: '#64748b',
                  }}
                >
                  Already have an organization?{' '}
                  <Link
                    to="/login"
                    style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}
                  >
                    Sign in here
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
