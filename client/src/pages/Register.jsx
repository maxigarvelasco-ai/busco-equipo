import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('masculino');
  const [profileType, setProfileType] = useState('normal');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      const parsedAge = parseInt(age);
      if (!parsedAge || parsedAge < 13 || parsedAge > 90) {
        throw new Error('Ingresá una edad válida entre 13 y 90');
      }
      const data = await register(name, email, password, profileType, parsedAge, gender);
      // Supabase may require email confirmation
      if (data?.user && !data.session) {
        setSuccess(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err.message || 'Error con Google');
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-logo-icon">✉️</div>
          <h2 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>¡Revisá tu email!</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
            Te enviamos un link de confirmación a <strong>{email}</strong>
          </p>
          <Link to="/login" className="btn btn-primary">Ir a Login</Link>
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
          <p>Creá tu cuenta y jugá</p>
        </div>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nombre</label>
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
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              className="form-input"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Edad</label>
              <input
                type="number"
                className="form-input"
                min="13"
                max="90"
                value={age}
                onChange={e => setAge(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Sexo</label>
              <select className="form-select" value={gender} onChange={(e) => setGender(e.target.value)} required>
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Tipo de perfil</label>
            <select className="form-select" value={profileType} onChange={(e) => setProfileType(e.target.value)}>
              <option value="normal">Normal (jugador)</option>
              <option value="venue_member">Miembro de canchas</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="auth-divider">o continuar con</div>

        <button className="btn btn-google btn-lg btn-full" onClick={handleGoogle}>
          🔵 Google
        </button>

        <div className="auth-footer">
          ¿Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link>
        </div>
      </div>
    </div>
  );
}
