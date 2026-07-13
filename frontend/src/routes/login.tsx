import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/context'

export default function LoginPage() {
  const { session, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    navigate('/timetable', { replace: true })
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
            Administrator sign-in. Only authorised admins can access the scheduling workspace.
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
              <Label htmlFor="email" className="text-sm" style={{ color: 'var(--text-primary)' }}>
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
              <Label htmlFor="password" className="text-sm" style={{ color: 'var(--text-primary)' }}>
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="rounded-md"
              />
            </div>

            <Button
              type="submit"
              className="w-full rounded-md"
              disabled={loading}
              style={{
                backgroundColor: loading ? 'var(--disabled-bg)' : 'var(--accent-primary)',
                color: loading ? 'var(--disabled-text)' : 'var(--text-inverse)',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
