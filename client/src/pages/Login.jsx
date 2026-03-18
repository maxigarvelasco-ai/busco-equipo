import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const { language } = useUI();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const i18n = {
    es: {
      login_error: 'Error al iniciar sesion',
      google_error: 'Error con Google',
      subtitle: 'Encontra tu equipo',
      password: 'Contrasena',
      loading: 'Ingresando...',
      login: 'Iniciar sesion',
      continue_google: 'o continuar con',
      no_account: 'No tenes cuenta?',
      register: 'Registrate',
    },
    en: {
      login_error: 'Login failed',
      google_error: 'Google sign-in failed',
      subtitle: 'Find your team',
      password: 'Password',
      loading: 'Signing in...',
      login: 'Sign in',
      continue_google: 'or continue with',
      no_account: "Don\'t have an account?",
      register: 'Sign up',
    },
    pt: {
      login_error: 'Erro ao iniciar sessao',
      google_error: 'Erro com Google',
      subtitle: 'Encontre seu time',
      password: 'Senha',
      loading: 'Entrando...',
      login: 'Entrar',
      continue_google: 'ou continuar com',
      no_account: 'Nao tem conta?',
      register: 'Cadastre-se',
    },
  }[language] || {
    login_error: 'Error al iniciar sesion',
    google_error: 'Error con Google',
    subtitle: 'Encontra tu equipo',
    password: 'Contrasena',
    loading: 'Ingresando...',
    login: 'Iniciar sesion',
    continue_google: 'o continuar con',
    no_account: 'No tenes cuenta?',
    register: 'Registrate',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || i18n.login_error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await loginWithGoogle();
      // Supabase redirects to Google, so no navigation needed here
    } catch (err) {
      setError(err.message || i18n.google_error);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">⚽</div>
          <h1>Busco<span>Equipo</span></h1>
          <p>{i18n.subtitle}</p>
        </div>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">{i18n.password}</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
            {loading ? i18n.loading : i18n.login}
          </button>
        </form>

        <div className="auth-divider">{i18n.continue_google}</div>

        <button className="btn btn-google btn-lg btn-full" onClick={handleGoogle}>
          🔵 Google
        </button>

        <div className="auth-footer">
          {i18n.no_account} <Link to="/register">{i18n.register}</Link>
        </div>
      </div>
    </div>
  );
}
