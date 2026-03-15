import React, { useState } from 'react';
import { User, Lock, ArrowRight, UserPlus } from 'lucide-react';
import { addRecord, getAllData } from '../utils/db';

export default function Login({ onLogin }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    try {
      const users = await getAllData('users');
      
      const user = users.find(u => u.username === username && u.password === password);
      if (user) {
        onLogin(user);
      } else {
        setError('Usuário ou senha inválidos.');
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao processar autenticação.');
    }
  };

  return (
    <div className={`login-overlay ${isAdminMode ? 'admin' : ''}`}>
      <div className="login-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>
      <div className={`login-card glass ${isAdminMode ? 'admin-card' : ''}`}>
        <div className="login-header">
          <div className="login-logo">
            <User size={32} />
          </div>
          <h2>{isAdminMode ? 'Acesso Master' : 'Acessórios PRO'}</h2>
          <p>{isAdminMode ? 'Interface Administrativa' : 'Entre para continuar'}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label>Usuário</label>
            <div className="input-with-icon">
              <User size={18} />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={isAdminMode ? "Admin ID" : "Seu nome de usuário"}
              />
            </div>
          </div>

          <div className="input-group">
            <label>Senha</label>
            <div className="input-with-icon">
              <Lock size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn-primary login-submit">
            {isAdminMode ? 'Autenticar Master' : 'Acessar Sistema'}
            <ArrowRight size={18} />
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
