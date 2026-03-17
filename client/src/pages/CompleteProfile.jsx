import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

export default function CompleteProfile() {
  const { user, profile, fetchProfile } = useAuth();
  const navigate = useNavigate();
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('masculino');
  const [profileType, setProfileType] = useState('normal');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile) return;
    setAge(profile.age || '');
    setGender(profile.gender || 'masculino');
    setProfileType(profile.profile_type || 'normal');
  }, [profile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const parsedAge = parseInt(age);
    if (!parsedAge || parsedAge < 13 || parsedAge > 90) {
      setError('Ingresá una edad válida entre 13 y 90');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        age: parsedAge,
        gender,
        profile_type: profileType,
      };

      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)
        .select('id')
        .maybeSingle();

      if (updateError) throw updateError;

      if (!updated) {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            name: profile?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario',
            age: parsedAge,
            gender,
            profile_type: profileType,
          });
        if (insertError) throw insertError;
      }

      await supabase.auth.updateUser({
        data: {
          age: parsedAge,
          gender,
          profile_type: profileType,
        },
      });

      await fetchProfile(user.id);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h2 style={{ marginBottom: '0.5rem' }}>Completar perfil</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
          Para usar la app necesitamos estos datos.
        </p>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Edad</label>
            <input
              type="number"
              className="form-input"
              min="13"
              max="90"
              value={age}
              onChange={(e) => setAge(e.target.value)}
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

          <div className="form-group">
            <label className="form-label">Tipo de perfil</label>
            <select className="form-select" value={profileType} onChange={(e) => setProfileType(e.target.value)} required>
              <option value="normal">Normal (jugador)</option>
              <option value="venue_member">Miembro de canchas</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar y continuar'}
          </button>
        </form>
      </div>
    </div>
  );
}
