import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/context'

function friendlyError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('already registered') || m.includes('already exists')) {
    return 'An account with this email already exists.'
  }
  if (m.includes('password should be at least')) {
    return 'Password must be at least 6 characters.'
  }
  if (m.includes('invalid email')) {
    return 'Please enter a valid email address.'
  }
  if (m.includes('signup is disabled')) {
    return 'New sign-ups are currently disabled. Contact your administrator.'
  }
  return 'Something went wrong. Please try again.'
}

export default function SignupPage() {
  const { session, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (authLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-base)' }}
      />
    )
  }

  if (session) {
    return <Navigate to="/timetable" replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    if (!password) {
      setError('Password is required.')
      return
    }
    if (!confirmPassword) {
      setError('Please confirm your password.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

      if (signUpError) {
        setError(friendlyError(signUpError.message))
        return
      }

      if (data.session) {
        navigate('/timetable', { replace: true })
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: 'var(--bg-base)' }}
      >
        <div className="w-full max-w-sm text-center">
          <h1
            className="text-3xl mb-2"
            style={{ fontFamily: 'var(--font-serif)', color: 'var(--accent-primary)' }}
          >
            Timetable Scheduler
          </h1>
          <div
            className="rounded-xl border p-8 mt-8 space-y-4"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-default)',
            }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Check your email
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              We sent a confirmation link to <strong>{email}</strong>. Open it to activate your account, then sign in.
            </p>
            <Link
              to="/login"
              className="text-sm font-medium"
              style={{ color: 'var(--accent-primary)' }}
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1
            className="text-3xl mb-2"
            style={{
              fontFamily: 'var(--font-serif)',
              color: 'var(--accent-primary)',
            }}
          >
            Timetable Scheduler
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Create an administrator account to access the scheduling workspace.
          </p>
        </div>

        <div
          className="rounded-xl border p-8"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-default)',
          }}
        >
          {error && (
            <Alert
              className="mb-5 flex items-start gap-2 rounded-md border p-3"
              style={{
                backgroundColor: 'var(--state-error-bg)',
                borderColor: 'var(--state-error)',
                color: 'var(--state-error)',
              }}
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-sm"
                style={{ color: 'var(--text-primary)' }}
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="rounded-md"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-sm"
                style={{ color: 'var(--text-primary)' }}
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="rounded-md"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="confirm-password"
                className="text-sm"
                style={{ color: 'var(--text-primary)' }}
              >
                Confirm password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="rounded-md"
              />
            </div>

            <Button
              type="submit"
              className="w-full rounded-md"
              disabled={loading}
              style={{
                backgroundColor: loading
                  ? 'var(--disabled-bg)'
                  : 'var(--accent-primary)',
                color: loading ? 'var(--disabled-text)' : 'var(--text-inverse)',
              }}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium"
            style={{ color: 'var(--accent-primary)' }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
