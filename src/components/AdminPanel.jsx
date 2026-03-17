import React, { useState, useEffect } from 'react';
import { Shield, Key, Eye, EyeOff, Save, Trash2, UserPlus } from 'lucide-react';
import { getAllData, addRecord, saveData } from '../utils/db'; // Will be replaced by FB later

export default function AdminPanel({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [newPassword, setNewPassword] = useState({});
  const [message, setMessage] = useState('');

  const loadUsers = async () => {
    try {
      const data = await getAllData('users');
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const togglePasswordVisibility = (userId) => {
    setVisiblePasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handlePasswordChange = (userId, value) => {
    setNewPassword(prev => ({ ...prev, [userId]: value }));
  };

  const saveNewPassword = async (userId) => {
    const password = newPassword[userId];
    if (!password) return;
    
    try {
      const updatedUsers = users.map(u => {
        if (u.id === userId) {
          return { ...u, password };
        }
        return u;
      });
      
      await saveData('users', updatedUsers);
      setUsers(updatedUsers);
      setNewPassword(prev => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });
      setMessage('Senha atualizada com sucesso!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Erro ao atualizar a senha.');
    }
  };

  const deleteUser = async (userId) => {
    if (userId === 'admin-id') {
      alert('Não é possível excluir o administrador padrão.');
      return;
    }
    if (window.confirm('Tem certeza de que deseja excluir este usuário?')) {
      try {
        const updatedUsers = users.filter(u => u.id !== userId);
        await saveData('users', updatedUsers);
        setUsers(updatedUsers);
        setMessage('Usuário excluído com sucesso!');
        setTimeout(() => setMessage(''), 3000);
      } catch (err) {
        console.error(err);
        setMessage('Erro ao excluir usuário.');
      }
    }
  };

  if (currentUser?.role !== 'admin') {
    return <div className="error">Acesso não autorizado.</div>;
  }

  return (
    <div className="tab-content" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="action-bar" style={{ marginBottom: '2rem' }}>
        <h2><Shield size={24} style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--accent)' }} /> Painel do Administrador</h2>
      </div>

      {message && (
        <div style={{ padding: '1rem', background: 'var(--success)', color: '#fff', borderRadius: '8px', marginBottom: '1rem' }}>
          {message}
        </div>
      )}

      <div className="card">
        <h3>Gerenciamento de Perfis e Senhas</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Como administrador, você pode visualizar todos os usuários, ver suas senhas atuais e redefini-las caso necessário.
        </p>

        {loading ? (
          <p>Carregando perfis...</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Permissão</th>
                  <th>Senha Atual</th>
                  <th>Nova Senha</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
                        {u.username}
                        {u.id === 'admin-id' && <Shield size={14} color="var(--accent)" title="Administrador Master" />}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${u.role === 'admin' ? 'completed' : 'pending'}`}>
                        {u.role === 'admin' ? 'Admin' : 'Usuário'}
                      </span>
                    </td>
                    <td>
                      <div className="input-with-icon" style={{ marginTop: 0, width: '150px' }}>
                        <input 
                          type={visiblePasswords[u.id] ? "text" : "password"} 
                          value={u.password} 
                          readOnly 
                          style={{ background: 'transparent', border: 'none', padding: '0', fontSize: '0.9rem' }}
                        />
                        <button 
                          type="button" 
                          className="password-toggle"
                          onClick={() => togglePasswordVisibility(u.id)}
                          title={visiblePasswords[u.id] ? "Ocultar senha" : "Ver senha"}
                          style={{ top: '50%', transform: 'translateY(-50%)', right: '0' }}
                        >
                          {visiblePasswords[u.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </td>
                    <td>
                      <input 
                        type="text" 
                        placeholder="Nova senha..." 
                        value={newPassword[u.id] || ''}
                        onChange={(e) => handlePasswordChange(u.id, e.target.value)}
                        className="form-input"
                        style={{ padding: '0.4rem', fontSize: '0.85rem', width: '120px' }}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className="btn-icon-secondary" 
                          onClick={() => saveNewPassword(u.id)}
                          disabled={!newPassword[u.id]}
                          title="Salvar nova senha"
                        >
                          <Save size={16} />
                        </button>
                        {u.id !== 'admin-id' && (
                          <button 
                            className="btn-icon-secondary btn-delete" 
                            onClick={() => deleteUser(u.id)}
                            title="Excluir usuário"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
