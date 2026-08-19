import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, ArrowRight, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

import { ZohoDeskLogo } from '../components/common/ZohoDeskLogo';

import { ApiClient, formatUserFriendlyError } from '../api/client';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(searchParams.get('message'));
  const [isLoading, setIsLoading] = useState(false);
  const [isSsoMode, setIsSsoMode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isSsoMode) {
        const res = await ApiClient.post<{ redirectUrl: string }>('/auth/sso/initiate', {
          email,
          redirectUrl: window.location.origin,
        });
        if (res.redirectUrl) {
          window.location.href = res.redirectUrl;
        } else {
          throw new Error('SSO provider returned an empty redirect URL.');
        }
      } else {
        await login(email, password);
        navigate('/inbox');
      }
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

        {/* Crisp Light Login Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
          }}
        >
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

            {!isSsoMode && (
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
                  Password
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
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '6px',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {isLoading ? 'Processing...' : isSsoMode ? 'Sign In with SSO' : 'Sign In to Console'}
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Toggle SSO Login */}
          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px' }}>
            <button
              onClick={() => {
                setIsSsoMode(!isSsoMode);
                setError(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '13px',
              }}
            >
              {isSsoMode ? 'Sign in with Password' : 'Sign in with Enterprise SSO'}
            </button>
          </div>

          {/* Registration Link */}
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
            Need a new helpdesk?{' '}
            <Link
              to="/register"
              style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}
            >
              Register Organization
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
