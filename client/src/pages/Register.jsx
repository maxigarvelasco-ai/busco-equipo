import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

export default function Register() {
  const { register, loginWithGoogle } = useAuth();
  const { language } = useUI();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('masculino');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const i18n = {
    es: {
      username_rule: 'El nombre de usuario debe tener 3-24 caracteres: letras, numeros o guion bajo',
      password_rule: 'La contrasena debe tener al menos 6 caracteres',
      birth_invalid: 'Ingresa una fecha de nacimiento valida',
      birth_range: 'La fecha de nacimiento debe dar una edad entre 13 y 90 anos',
      register_error: 'Error al registrar',
      google_error: 'Error con Google',
      check_email: 'Revisa tu email',
      confirm_link: 'Te enviamos un link de confirmacion a',
      go_login: 'Ir a login',
      subtitle: 'Crea tu cuenta y juga',
      name: 'Nombre',
      username: 'Nombre de usuario',
      password: 'Contrasena',
      min_6: 'Minimo 6 caracteres',
      birth_date: 'Fecha de nacimiento',
      sex: 'Sexo',
      male: 'Masculino',
      female: 'Femenino',
      creating: 'Creando cuenta...',
      create_account: 'Crear cuenta',
      continue_google: 'o continuar con',
      have_account: 'Ya tenes cuenta?',
      login: 'Inicia sesion',
    },
    en: {
      username_rule: 'Username must be 3-24 characters: letters, numbers, or underscore',
      password_rule: 'Password must have at least 6 characters',
      birth_invalid: 'Enter a valid birth date',
      birth_range: 'Birth date must result in an age between 13 and 90',
      register_error: 'Registration failed',
      google_error: 'Google sign-in failed',
      check_email: 'Check your email',
      confirm_link: 'We sent a confirmation link to',
      go_login: 'Go to login',
      subtitle: 'Create your account and play',
      name: 'Name',
      username: 'Username',
      password: 'Password',
      min_6: 'At least 6 characters',
      birth_date: 'Birth date',
      sex: 'Sex',
      male: 'Male',
      female: 'Female',
      creating: 'Creating account...',
      create_account: 'Create account',
      continue_google: 'or continue with',
      have_account: 'Already have an account?',
      login: 'Sign in',
    },
    pt: {
      username_rule: 'O nome de usuario deve ter 3-24 caracteres: letras, numeros ou underscore',
      password_rule: 'A senha deve ter ao menos 6 caracteres',
      birth_invalid: 'Informe uma data de nascimento valida',
      birth_range: 'A data de nascimento deve resultar em idade entre 13 e 90 anos',
      register_error: 'Erro ao registrar',
      google_error: 'Erro com Google',
      check_email: 'Confira seu email',
      confirm_link: 'Enviamos um link de confirmacao para',
      go_login: 'Ir para login',
      subtitle: 'Crie sua conta e jogue',
      name: 'Nome',
      username: 'Nome de usuario',
      password: 'Senha',
      min_6: 'Minimo 6 caracteres',
      birth_date: 'Data de nascimento',
      sex: 'Sexo',
      male: 'Masculino',
      female: 'Feminino',
      creating: 'Criando conta...',
      create_account: 'Criar conta',
      continue_google: 'ou continuar com',
      have_account: 'Ja tem conta?',
      login: 'Entrar',
    },
  }[language];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const normalizedUsername = String(username || '').trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
      setError(i18n.username_rule);
      return;
    }
    if (password.length < 6) {
      setError(i18n.password_rule);
      return;
    }
    setLoading(true);
    try {
      const birth = new Date(birthDate);
      if (Number.isNaN(birth.getTime())) {
        throw new Error(i18n.birth_invalid);
      }
      const years = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (years < 13 || years > 90) {
        throw new Error(i18n.birth_range);
      }
      const data = await register(
        name,
        normalizedUsername,
        email,
        password,
        'normal',
        birthDate,
        gender
      );
      // Supabase may require email confirmation
      if (data?.user && !data.session) {
        setSuccess(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || i18n.register_error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err.message || i18n.google_error);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-logo-icon">✉️</div>
          <h2 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>{i18n.check_email}</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
            {i18n.confirm_link} <strong>{email}</strong>
          </p>
          <Link to="/login" className="btn btn-primary">{i18n.go_login}</Link>
        </div>
      </div>
    );
  }

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
            <label className="form-label">{i18n.name}</label>
            <input
              type="text"
              className="form-input"
              placeholder="Tu nombre"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">{i18n.username}</label>
            <input
              type="text"
              className="form-input"
              placeholder="ej: maxig10"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase())}
              required
            />
          </div>
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
              placeholder={i18n.min_6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fecha de nacimiento</label>
              <input
                type="date"
                className="form-input"
                value={birthDate}
                onChange={e => setBirthDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">{i18n.sex}</label>
              <select className="form-select" value={gender} onChange={(e) => setGender(e.target.value)} required>
                <option value="masculino">{i18n.male}</option>
                <option value="femenino">{i18n.female}</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
            {loading ? i18n.creating : i18n.create_account}
          </button>
        </form>

        <div className="auth-divider">{i18n.continue_google}</div>

        <button className="btn btn-google btn-lg btn-full" onClick={handleGoogle}>
          🔵 Google
        </button>

        <div className="auth-footer">
          {i18n.have_account} <Link to="/login">{i18n.login}</Link>
        </div>
      </div>
    </div>
  );
}
