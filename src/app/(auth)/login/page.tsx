'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './auth.module.css'

type Mode = 'login' | 'signup'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        })
        if (error) throw error
      }
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__inner">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo__icon">🐔</div>
          <div className="auth-logo__name">FlockOps</div>
          <div className="auth-logo__tagline">Broiler farm management, simplified</div>
        </div>

        {/* Tab toggle */}
        <div className={styles.tabToggle}>
          <button
            className={`${styles.tabBtn} ${mode === 'login' ? styles.tabBtnActive : ''}`}
            onClick={() => { setMode('login'); setError('') }}
            type="button"
            id="tab-login"
          >
            Sign In
          </button>
          <button
            className={`${styles.tabBtn} ${mode === 'signup' ? styles.tabBtnActive : ''}`}
            onClick={() => { setMode('signup'); setError('') }}
            type="button"
            id="tab-signup"
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="stack stack--md" noValidate>
          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="name" className="form-label form-label--required">Full Name</label>
              <input
                id="name"
                type="text"
                className="form-input"
                placeholder="Ali Hassan"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email" className="form-label form-label--required">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label form-label--required">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={mode === 'signup' ? 8 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <div className="alert-banner alert-banner--error" role="alert">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            id="btn-auth-submit"
            type="submit"
            className="btn btn--primary"
            disabled={loading}
          >
            {loading
              ? <span className="spinner" />
              : mode === 'login' ? 'Sign In' : 'Create Account'
            }
          </button>
        </form>

        {mode === 'login' && (
          <p className={styles.footnote}>
            Don&apos;t have an account?{' '}
            <button
              className={styles.footLink}
              onClick={() => setMode('signup')}
              type="button"
            >
              Sign up
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
