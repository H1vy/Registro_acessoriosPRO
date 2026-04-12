import React, { useState, useEffect } from 'react';
import { Shield, Key, Eye, EyeOff, Save, Trash2, UserPlus, User, Mail, Check, Loader2 } from 'lucide-react';
import { getAllData, addRecord, saveData } from '../utils/db';
import { secondaryAuth } from '../utils/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, updateEmail, signOut } from 'firebase/auth';

export default function AdminPanel({ currentUser, setMovements }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [newPassword, setNewPassword] = useState({});
  const [newEmail, setNewEmail] = useState({});
  const [savingRow, setSavingRow] = useState(null);
  const [successRow, setSuccessRow] = useState(null);
  const [message, setMessage] = useState('');
  
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'user' });

  const handleClearHistory = async () => {
    if (window.confirm('ATENÇÃO: Isso irá apagar TODO o histórico de movimentações permanentemente. Deseja continuar?')) {
      try {
        await saveData('movements', []);
        if (setMovements) setMovements([]);
        setMessage('Histórico limpo com sucesso!');
        setTimeout(() => setMessage(''), 3000);
      } catch (err) {
        console.error(err);
        setMessage('Erro ao limpar histórico.');
      }
    }
  };

  const loadUsers = async () => {
    try {
      let data = await getAllData('users');
      
      // Auto-heal: Remover duplicações indesejadas do admin padrão (se existirem)
      const admins = data.filter(u => u.email === 'admin@acessoriospro.com');
      if (admins.length > 1 && currentUser?.id) {
         const validAdminId = currentUser.id;
         // Filtra para remover qualquer admin@... que não seja o da sessão auth validada
         const filteredData = data.filter(u => !(u.email === 'admin@acessoriospro.com' && u.id !== validAdminId));
         
         if (filteredData.length < data.length) {
            await saveData('users', filteredData);
            data = filteredData;
            console.log('Duplicidade de admin resolvida automaticamente.');
         }
      }
      
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

  const handleEmailChange = (userId, value) => {
    setNewEmail(prev => ({ ...prev, [userId]: value }));
  };

  const saveModifications = async (userId) => {
    const passwordToSet = newPassword[userId];
    const emailToSet = newEmail[userId];
    if (!passwordToSet && (!emailToSet || emailToSet === users.find(u => u.id === userId)?.email)) return;
    
    setSavingRow(userId);
    const dbUser = users.find(u => u.id === userId);
    if (!dbUser) {
        setSavingRow(null);
        return;
    }

    try {
      if (dbUser.email) {
        const userCred = await signInWithEmailAndPassword(secondaryAuth, dbUser.email, dbUser.password);
        
        if (emailToSet && emailToSet !== dbUser.email) {
           await updateEmail(userCred.user, emailToSet);
        }
        if (passwordToSet) {
           await updatePassword(userCred.user, passwordToSet);
        }
        await signOut(secondaryAuth);
      } else if (emailToSet) {
        const pass = passwordToSet || dbUser.password;
        if (!pass) {
           setMessage('Usuário não possui senha preexistente. Crie uma senha junto.');
           return;
        }
        await createUserWithEmailAndPassword(secondaryAuth, emailToSet, pass);
        await signOut(secondaryAuth);
      }

      const updatedUsers = users.map(u => {
        if (u.id === userId) {
          return { 
            ...u, 
            password: passwordToSet || u.password,
            email: emailToSet || u.email
          };
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
      setNewEmail(prev => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });
      
      setSavingRow(null);
      setSuccessRow(userId);
      setTimeout(() => setSuccessRow(null), 2000);
      
      setMessage('Modificações aplicadas com sucesso!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Erro crítico ao aplicar as modificações no Auth.');
      setSavingRow(null);
      await signOut(secondaryAuth);
    }
  };

  const deleteUser = async (userId) => {
    if (userId === 'admin-id' || userId === currentUser.id) {
      alert('Não é possível excluir a própria conta ou o admin padrão por segurança.');
      return;
    }
    
    if (window.confirm('Tem certeza de que deseja excluir este usuário definitivamente?')) {
      const dbUser = users.find(u => u.id === userId);
      try {
        if (dbUser.email) {
          const userCred = await signInWithEmailAndPassword(secondaryAuth, dbUser.email, dbUser.password);
          await userCred.user.delete();
          await signOut(secondaryAuth);
        }

        const updatedUsers = users.filter(u => u.id !== userId);
        await saveData('users', updatedUsers);
        setUsers(updatedUsers);
        setMessage('Usuário excluído com sucesso do sistema.');
        setTimeout(() => setMessage(''), 3000);
      } catch (err) {
        console.error(err);
        setMessage('Erro ao excluir usuário no Firebase Auth.');
        await signOut(secondaryAuth);
      }
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.email || !newUser.password) {
      setMessage('Preencha os dados primários do usuário.');
      return;
    }

    try {
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
      await signOut(secondaryAuth);

      const recordToAdd = {
        id: userCred.user.uid,
        username: newUser.username,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role
      };

      const updatedUsers = [...users, recordToAdd];
      await saveData('users', updatedUsers);
      setUsers(updatedUsers);
      
      setNewUser({ username: '', email: '', password: '', role: 'user' });
      setMessage('Conta criada com sucesso!');
      setTimeout(() => setMessage(''), 3000);
    } catch(err) {
      console.error(err);
      setMessage('Erro ao criar conta Auth: ' + err.message);
      await signOut(secondaryAuth);
    }
  };

  if (currentUser?.role !== 'admin') {
    return <div className="error">Acesso não autorizado.</div>;
  }

  return (
    <div className="tab-content" style={{ maxWidth: '100%', padding: '0 2rem', margin: '0 auto' }}>
      <style>
        {`
          @keyframes spin-anim { 100% { transform: rotate(360deg); } }
          .spin-icon { animation: spin-anim 1s linear infinite; }
          .btn-success { border-color: var(--success) !important; color: var(--success) !important; background: rgba(34, 197, 94, 0.1) !important; }
        `}
      </style>
      <div className="action-bar" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2><Shield size={24} style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--accent)' }} /> Painel do Administrador</h2>
        <button 
          className="btn-icon-secondary btn-delete" 
          onClick={handleClearHistory}
          style={{ padding: '0.6rem 1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}
        >
          <Trash2 size={18} />
          <span>Limpar Histórico</span>
        </button>
      </div>

      {message && (
        <div style={{ padding: '1rem', background: 'var(--success)', color: '#fff', borderRadius: '8px', marginBottom: '1rem' }}>
          {message}
        </div>
      )}

      {/* NOVO: Formulário de Criação Integrado */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3><UserPlus size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }}/> Novo Usuário</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Crie contas para permitir o acesso de outros funcionários à plataforma.
        </p>

        <form onSubmit={handleCreateUser}>
          <div className="grid-2">
            <div className="input-group">
              <label>Nome</label>
              <div className="input-with-icon">
                <User size={18} />
                <input 
                  type="text" 
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                  placeholder="Ex: João"
                />
              </div>
            </div>
            <div className="input-group">
              <label>E-mail (Para Login Auth)</label>
              <div className="input-with-icon">
                <Mail size={18} />
                <input 
                  type="email" 
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                  placeholder="joao@acessoriospro.com"
                />
              </div>
            </div>
            <div className="input-group">
              <label>Senha</label>
              <div className="input-with-icon">
                <Key size={18} />
                <input 
                  type="text" 
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                  placeholder="Senha Forte"
                />
              </div>
            </div>
            <div className="input-group">
              <label>Nível</label>
              <div className="input-with-icon">
                <Shield size={18} />
                <select 
                  style={{ width: '100%', padding: '1rem 3.5rem 1rem 3rem', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: '16px', color: '#f8fafc', fontSize: '0.95rem', appearance: 'none' }}
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value})}
                >
                  <option value="user" style={{ background: '#1e293b' }}>Usuário</option>
                  <option value="admin" style={{ background: '#1e293b' }}>Admin</option>
                </select>
              </div>
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.8rem', padding: '1rem' }}>
            <UserPlus size={18} />
            CRIAR NOVO USUÁRIO
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Gerenciamento de Perfis e Senhas</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Como administrador, você pode visualizar todos os usuários, ver suas senhas atuais e redefini-las caso necessário.
        </p>

        {loading ? (
          <p>Carregando perfis...</p>
        ) : (
          <div style={{ width: '100%', overflow: 'visible' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>E-mail</th>
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
                        {u.role === 'admin' && <Shield size={14} color="var(--accent)" title="Administrador Master" />}
                      </div>
                    </td>
                    <td>
                      <div className="input-with-icon" style={{ marginTop: 0, width: '220px' }}>
                        <Mail size={16} />
                        <input 
                          type="email" 
                          placeholder={u.email || 'Sem e-mail'} 
                          value={newEmail[u.id] !== undefined ? newEmail[u.id] : (u.email || '')}
                          onChange={(e) => handleEmailChange(u.id, e.target.value)}
                          style={{ padding: '0.6rem 1rem 0.6rem 2.8rem', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '10px', width: '100%', color: 'var(--text-primary)' }}
                        />
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${u.role === 'admin' ? 'completed' : 'pending'}`}>
                        {u.role === 'admin' ? 'Admin' : 'Usuário'}
                      </span>
                    </td>
                    <td>
                      <div className="input-with-icon" style={{ marginTop: 0, width: '150px' }}>
                        <LockIndicator size={16} />
                        <input 
                          type={visiblePasswords[u.id] ? "text" : "password"} 
                          value={u.password} 
                          readOnly 
                          style={{ padding: '0.6rem 2.8rem 0.6rem 2.5rem', background: 'rgba(15, 23, 42, 0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', width: '100%', color: 'var(--text-secondary)' }}
                        />
                        <button 
                          type="button" 
                          className="password-toggle"
                          onClick={() => togglePasswordVisibility(u.id)}
                          title={visiblePasswords[u.id] ? "Ocultar senha" : "Ver senha"}
                          style={{ top: '50%', transform: 'translateY(-50%)', right: '0.5rem' }}
                        >
                          {visiblePasswords[u.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="input-with-icon" style={{ marginTop: 0, width: '160px' }}>
                        <Key size={16} />
                        <input 
                          type="text" 
                          placeholder="Nova senha..." 
                          value={newPassword[u.id] || ''}
                          onChange={(e) => handlePasswordChange(u.id, e.target.value)}
                          style={{ padding: '0.6rem 1rem 0.6rem 2.8rem', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '10px', width: '100%' }}
                        />
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className={`btn-icon-secondary ${successRow === u.id ? 'btn-success' : ''}`}
                          onClick={() => saveModifications(u.id)}
                          disabled={savingRow === u.id || (!newPassword[u.id] && (!newEmail[u.id] || newEmail[u.id] === u.email))}
                          title="Salvar alterações no Auth e DB"
                        >
                          {savingRow === u.id ? (
                             <Loader2 size={16} className="spin-icon" />
                          ) : successRow === u.id ? (
                             <Check size={16} />
                          ) : (
                             <Save size={16} color={newPassword[u.id] || newEmail[u.id] ? 'var(--accent)' : 'currentColor'} />
                          )}
                        </button>
                        {u.id !== currentUser?.id && (
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

const LockIndicator = ({ size }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);
