import React, { useState } from 'react';
import { User, Lock, ArrowRight, Mail, Eye, EyeOff } from 'lucide-react';
import { getAllData } from '../utils/db';
import { auth } from '../utils/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';

export default function Login({ onLogin }) {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    // Repulsion vector: from mouse toward center (blobs flee the cursor)
    const rx = (centerX - clientX) / window.innerWidth * 60;
    const ry = (centerY - clientY) / window.innerHeight * 60;
    setMousePos({ x: rx, y: ry });

    // Card Tilt (kept for depth)
    const tiltX = (clientY - centerY) / 55;
    const tiltY = (centerX - clientX) / 55;
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
      const fbUser = userCredential.user;

      const users = await getAllData('users');
      const dbUser = users.find(u => u.id === fbUser.uid || (fbUser.email && u.email === fbUser.email));
      
      if (dbUser) {
        if (isAdminMode && dbUser.role !== 'admin') {
          setError('Esta conta não possui privilégios de administrador.');
          await signOut(auth);
        } else if (!isAdminMode && dbUser.role === 'admin') {
          setError('Utilize a aba "Acesso Master" para entrar como administrador.');
          await signOut(auth);
        } else {
          onLogin(dbUser);
        }
      } else {
        setError('Registro de usuário não encontrado no banco de dados.');
        await signOut(auth);
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-mail ou senha inválidos.');
      } else {
        setError('Erro na autenticação: ' + err.code);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className={`login-overlay ${isAdminMode ? 'admin' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: '1000px' }}
    >
      <div className="login-blobs">
        <div style={{ transform: `translate(${mousePos.x * 3}px, ${mousePos.y * 3}px)`, transition: 'transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94)', position: 'absolute', inset: 0 }}>
          <div className="blob blob-1"></div>
        </div>
        <div style={{ transform: `translate(${mousePos.x * -2}px, ${mousePos.y * -2}px)`, transition: 'transform 0.9s cubic-bezier(0.25,0.46,0.45,0.94)', position: 'absolute', inset: 0 }}>
          <div className="blob blob-2"></div>
        </div>
        <div style={{ transform: `translate(${mousePos.x * 1.5}px, ${mousePos.y * 1.5}px)`, transition: 'transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)', position: 'absolute', inset: 0 }}>
          <div className="blob blob-3"></div>
        </div>
        <div style={{ transform: `translate(${mousePos.x * -3.5}px, ${mousePos.y * -3.5}px)`, transition: 'transform 1.1s cubic-bezier(0.25,0.46,0.45,0.94)', position: 'absolute', inset: 0 }}>
          <div className="blob blob-4"></div>
        </div>
      </div>
      <div 
        className={`login-card glass ${isAdminMode ? 'admin-card' : ''}`}
        style={{ 
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: tilt.x === 0 ? 'all 0.5s ease' : 'none'
        }}
      >
        <div className="login-header">
          <div className="login-logo">
            <User size={32} />
          </div>
          <h2>{isAdminMode ? 'Acesso Master' : 'Acessórios PRO'}</h2>
          <p>{isAdminMode ? 'Interface Administrativa' : 'Entre para continuar'}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label>E-mail</label>
            <div className="input-with-icon">
              <Mail size={18} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isAdminMode ? "admin@acessoriospro.com" : "seu@email.com"}
                disabled={loading}
              />
            </div>
          </div>

          <div className="input-group">
            <label>Senha</label>
            <div className="input-with-icon">
              <Lock size={18} />
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
              />
              <button 
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn-primary login-submit" disabled={loading}>
            {loading ? 'Autenticando...' : (isAdminMode ? 'Autenticar Master' : 'Acessar Sistema')}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="login-footer">
          <button 
            type="button" 
            className={`admin-toggle-btn ${isAdminMode ? 'active' : ''}`}
            onClick={() => setIsAdminMode(!isAdminMode)}
            title={isAdminMode ? "Voltar ao Login Comum" : "Modo Administrador"}
          >
            <Lock size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
