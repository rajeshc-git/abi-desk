import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Building2,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { ZohoDeskLogo } from '../components/common/ZohoDeskLogo';
import { ApiClient, formatUserFriendlyError } from '../api/client';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [email, setEmail] = useState<string>('');
  const [tenantName, setTenantName] = useState<string | undefined>();
  const [isVerifyingToken, setIsVerifyingToken] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Password complexity rules
  const isMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const isPasswordValid = isMinLength && hasLetter && hasNumber && hasSpecial;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  useEffect(() => {
    if (!token) {
      setTokenError('Missing password reset token. Please check the link from your email.');
      setIsVerifyingToken(false);
      return;
    }

    const verifyToken = async () => {
      try {
        setIsVerifyingToken(true);
        setTokenError(null);
        const data = await ApiClient.get<{ email: string; tenantName?: string }>(
          `/auth/password/reset/${encodeURIComponent(token)}`,
        );
        setEmail(data.email);
        setTenantName(data.tenantName);
      } catch (err: unknown) {
        setTokenError(
          err instanceof Error ? err.message : 'This reset link is invalid, expired, or has already been used.',
        );
      } finally {
        setIsVerifyingToken(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Missing reset token.');
      return;
    }

    if (!isPasswordValid) {
      setError(
        'Password must be at least 8 characters, alphanumeric, and contain a special character.',
      );
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      await ApiClient.post('/auth/password/reset', {
        token,
        password,
      });

      setIsSuccess(true);
    } catch (err: unknown) {
      setError(formatUserFriendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

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
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Branding Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-block', marginBottom: '12px' }}>
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
            ABI Desk Console
          </h1>
          <p style={{ fontSize: '13px', color: '#475569', marginTop: '4px', fontWeight: 500 }}>
            Enterprise Customer Support & Issue Operations
          </p>
        </div>

        {/* Main Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
          }}
        >
          {isVerifyingToken ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  border: '3px solid #e2e8f0',
                  borderTopColor: 'var(--primary)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 16px auto',
                }}
              />
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>
                Verifying reset link...
              </div>
            </div>
          ) : tokenError ? (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                  border: '1px solid #fecaca',
                }}
              >
                <AlertCircle size={28} />
              </div>

              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#0f172a',
                  marginBottom: '8px',
                }}
              >
                Invalid or Expired Link
              </h2>

              <p
                style={{
                  fontSize: '13px',
                  color: '#475569',
                  lineHeight: '1.6',
                  marginBottom: '24px',
                }}
              >
                {tokenError}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Link
                  to="/forgot-password"
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  Request a New Reset Link
                </Link>

                <Link
                  to="/login"
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  Return to Sign In
                </Link>
              </div>
            </div>
          ) : isSuccess ? (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                  border: '1px solid #a7f3d0',
                }}
              >
                <ShieldCheck size={28} />
              </div>

              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#0f172a',
                  marginBottom: '8px',
                }}
              >
                Password Reset Complete
              </h2>

              <p
                style={{
                  fontSize: '13px',
                  color: '#475569',
                  lineHeight: '1.6',
                  marginBottom: '24px',
                }}
              >
                Your password has been successfully updated. All other active sessions have been signed out for security.
              </p>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                Sign In with New Password
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '20px' }}>
                <h2
                  style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    color: '#0f172a',
                    marginBottom: '6px',
                  }}
                >
                  Set New Password
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b' }}>
                  Choose a new strong password to secure your account.
                </p>
              </div>

              {/* Account summary badge */}
              {email && (
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: '#f1f5f9',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '20px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    fontSize: '12px',
                    color: '#334155',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={13} style={{ color: '#64748b' }} />
                    <span>Account: <strong>{email}</strong></span>
                  </div>
                  {tenantName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building2 size={13} style={{ color: '#64748b' }} />
                      <span>Workspace: <strong>{tenantName}</strong></span>
                    </div>
                  )}
                </div>
              )}

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

              <form
                onSubmit={handleSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
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
                    New Password
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
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{
                        width: '100%',
                        padding: '10px 40px 10px 38px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: 'var(--radius-md)',
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
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {renderPasswordStrength()}
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
                    Confirm New Password
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
                        padding: '10px 40px 10px 38px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: 'var(--radius-md)',
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
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
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
                  disabled={isLoading || !isPasswordValid || !passwordsMatch}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '12px',
                    marginTop: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    opacity: !isPasswordValid || !passwordsMatch ? 0.6 : 1,
                    cursor: !isPasswordValid || !passwordsMatch ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isLoading ? 'Updating Password...' : 'Reset Password & Proceed'}
                  <ArrowRight size={16} />
                </button>
              </form>

              <div
                style={{
                  textAlign: 'center',
                  marginTop: '20px',
                  paddingTop: '18px',
                  borderTop: '1px solid #e2e8f0',
                  fontSize: '13px',
                  color: '#64748b',
                }}
              >
                Back to{' '}
                <Link
                  to="/login"
                  style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}
                >
                  Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
