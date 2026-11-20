import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { ZohoDeskLogo } from '../components/common/ZohoDeskLogo';
import { ApiClient, formatUserFriendlyError } from '../api/client';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [expiresInMinutes, setExpiresInMinutes] = useState<number>(30);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await ApiClient.post<{
        status: string;
        message: string;
        expiresInMinutes: number;
      }>('/auth/password/forgot', {
        email: email.trim().toLowerCase(),
      });

      if (res?.expiresInMinutes) {
        setExpiresInMinutes(res.expiresInMinutes);
      }
      setIsSubmitted(true);
    } catch (err: unknown) {
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

        {/* Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
          }}
        >
          {isSubmitted ? (
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
                <CheckCircle2 size={28} />
              </div>

              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#0f172a',
                  marginBottom: '8px',
                }}
              >
                Check your email
              </h2>

              <p
                style={{
                  fontSize: '13px',
                  color: '#475569',
                  lineHeight: '1.6',
                  marginBottom: '20px',
                }}
              >
                We have sent a password reset link to{' '}
                <strong style={{ color: '#0f172a' }}>{email}</strong>. This link will expire in{' '}
                <strong>{expiresInMinutes} minutes</strong>.
              </p>

              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '12px',
                  color: '#64748b',
                  marginBottom: '24px',
                  textAlign: 'left',
                }}
              >
                💡 Didn't receive an email? Please check your spam or junk folder.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsSubmitted(false)}
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  Resend Email
                </button>

                <Link
                  to="/login"
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
                    gap: '6px',
                  }}
                >
                  <ArrowLeft size={16} /> Return to Sign In
                </Link>
              </div>
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
                  Forgot your password?
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                  Enter your registered work email and we'll send you a secure link to reset your
                  password.
                </p>
              </div>

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
                style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
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
                    Work Email Address
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
                      placeholder="name@company.com"
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

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '12px',
                    marginTop: '4px',
                    fontSize: '14px',
                    fontWeight: 600,
                  }}
                >
                  {isLoading ? 'Sending Link...' : 'Send Password Reset Link'}
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
                Remember your password?{' '}
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
