import React, { useState } from 'react';
import {
  Shield, Key, Eye, EyeOff, Save, Trash2, UserPlus,
  User, Check, Loader2, Briefcase, Download
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { saveData } from '../utils/db';
import * as XLSX from 'xlsx';

export default function AdminPanel({ currentUser, users, setUsers, setMovements, showAlert }) {
  const [loading] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [newPassword, setNewPassword] = useState({});
  const [savingRow, setSavingRow] = useState(null);
  const [successRow, setSuccessRow] = useState(null);
  const [message, setMessage] = useState('');
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user', sector: 'estoque' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });

  // Apenas Admin pode acessar este painel
  if (currentUser?.role !== 'admin') {
    return <div className="error">Acesso não autorizado.</div>;
  }

  // ── Limpar histórico de movimentações ──────────────────────────────────────
  const handleClearHistory = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Limpar Histórico',
      message: 'ATENÇÃO: Isso irá apagar TODO o histórico de movimentações permanentemente. Deseja continuar?',
      type: 'danger',
      confirmText: 'Limpar Tudo',
      onConfirm: async () => {
        try {
          await saveData('movements', []);
          if (setMovements) setMovements([]);
          setConfirmModal({ isOpen: false });
          setMessage('Histórico limpo com sucesso!');
          setTimeout(() => setMessage(''), 3000);
        } catch (err) {
          console.error(err);
          setConfirmModal({ isOpen: false });
          setMessage('Erro ao limpar histórico.');
        }
      },
      onCancel: () => setConfirmModal({ isOpen: false })
    });
  };

  // ── Visibilidade de senha ──────────────────────────────────────────────────
  const togglePasswordVisibility = (userId) => {
    setVisiblePasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handlePasswordChange = (userId, value) => {
    setNewPassword(prev => ({ ...prev, [userId]: value }));
  };

  // ── Salvar modificações de usuário existente ───────────────────────────────
  const saveModifications = async (userId) => {
    const passwordToSet = newPassword[userId];
    const usernameToSet = document.getElementById(`username-${userId}`)?.value;
    const roleToSet     = document.getElementById(`role-${userId}`)?.value;
    const sectorToSet   = document.getElementById(`sector-${userId}`)?.value;

    // Proteção: admin não pode se rebaixar
    if (userId === currentUser.id && roleToSet === 'user') {
      showAlert(
        'Ação Bloqueada',
        'Você não pode remover seu próprio acesso de administrador para garantir que o sistema não fique sem um gestor ativo.',
        'danger'
      );
      return;
    }

    setSavingRow(userId);
    const dbUser = users.find(u => u.id === userId);
    if (!dbUser) { setSavingRow(null); return; }

    try {
      const updatedUsers = users.map(u => {
        if (u.id === userId) {
          return {
            ...u,
            password: passwordToSet || u.password,
            username: usernameToSet || u.username,
            role:     roleToSet     || u.role,
            sector:   sectorToSet   || u.sector || 'estoque'
          };
        }
        return u;
      });

      setUsers(updatedUsers);

      setNewPassword(prev => {
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
      setMessage('Erro ao aplicar as modificações.');
      setSavingRow(null);
    }
  };

  // ── Excluir usuário ────────────────────────────────────────────────────────
  const deleteUser = async (userId) => {
    if (userId === 'admin-id' || userId === currentUser.id) {
      showAlert(
        'Segurança Ativa',
        'Por motivos de segurança, não é permitido excluir a própria conta ou o administrador padrão do sistema.',
        'warning'
      );
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Excluir Usuário',
      message: 'Tem certeza de que deseja excluir este usuário definitivamente? Ele perderá o acesso.',
      type: 'danger',
      confirmText: 'Excluir',
      onConfirm: async () => {
        try {
          const updatedUsers = users.filter(u => u.id !== userId);
          setUsers(updatedUsers);
          setConfirmModal({ isOpen: false });
          setMessage('Usuário excluído com sucesso do sistema.');
          setTimeout(() => setMessage(''), 3000);
        } catch (err) {
          console.error(err);
          setConfirmModal({ isOpen: false });
          setMessage('Erro ao excluir usuário no Banco de Dados.');
        }
      },
      onCancel: () => setConfirmModal({ isOpen: false })
    });
  };

  // ── Criar novo usuário ─────────────────────────────────────────────────────
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.username.trim() || !newUser.password.trim()) {
      setMessage('Preencha os dados primários do usuário.');
      return;
    }
    const usernameExists = users.some(
      u => u.username.toLowerCase() === newUser.username.trim().toLowerCase()
    );
    if (usernameExists) {
      setMessage('Já existe um usuário com este nome. Escolha outro.');
      return;
    }

    try {
      const uid = Date.now().toString(36) + Math.random().toString(36).substring(2);
      const recordToAdd = {
        id: uid,
        username: newUser.username.trim(),
        password: newUser.password.trim(),
        role: newUser.role,
        sector: newUser.sector,
        createdAt: new Date().toISOString()
      };

      const updatedUsers = [...users, recordToAdd];
      setUsers(updatedUsers);

      setNewUser({ username: '', password: '', role: 'user', sector: 'estoque' });
      setMessage('Conta criada com sucesso!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Erro ao criar conta: ' + err.message);
    }
  };

  // ── Exportar usuários para Excel ───────────────────────────────────────────
  const exportUsersToExcel = () => {
    const data = users.map(u => ({
      'Usuário':   u.username,
      'Permissão': u.role === 'admin' ? 'Admin' : 'Usuário',
      'Setor':     u.sector === 'atendimento' ? 'Atendimento' : 'Estoque',
      'Criado em': u.createdAt ? new Date(u.createdAt).toLocaleString('pt-BR') : '-'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Usuários');
    XLSX.writeFile(wb, `usuarios_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ── Rótulo de setor para exibição ─────────────────────────────────────────
  const getSectorLabel = (sector) =>
    sector === 'atendimento' ? 'Atendimento' : 'Estoque';

  return (
    <div className="tab-content" style={{ maxWidth: '100%', padding: '0 2rem', margin: '0 auto' }}>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        onCancel={confirmModal.onCancel}
      />

      <style>{`
        @keyframes spin-anim { 100% { transform: rotate(360deg); } }
        .spin-icon { animation: spin-anim 1s linear infinite; }
        .btn-success { border-color: var(--success) !important; color: var(--success) !important; background: rgba(34, 197, 94, 0.1) !important; }
      `}</style>

      {/* ── Cabeçalho ── */}
      <div className="action-bar" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2>
          <Shield size={24} style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--accent)' }} />
          Painel do Administrador
        </h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn-icon-secondary"
            onClick={exportUsersToExcel}
            style={{ padding: '0.6rem 1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}
            title="Exportar lista de usuários para Excel"
          >
            <Download size={18} />
            <span>Exportar Usuários</span>
          </button>
          <button
            className="btn-icon-secondary btn-delete"
            onClick={handleClearHistory}
            style={{ padding: '0.6rem 1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}
          >
            <Trash2 size={18} />
            <span>Limpar Histórico</span>
          </button>
        </div>
      </div>

      {/* ── Mensagem de feedback ── */}
      {message && (
        <div style={{
          padding: '1rem',
          background: message.startsWith('Erro') ? 'var(--danger)' : 'var(--success)',
          color: '#fff', borderRadius: '8px', marginBottom: '1rem'
        }}>
          {message}
        </div>
      )}

      {/* ── Formulário de novo usuário ── */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3>
          <UserPlus size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Novo Usuário
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Como administrador, você pode criar contas e definir o setor de cada colaborador.
        </p>

        <form onSubmit={handleCreateUser}>
          <div className="grid-2">
            {/* Usuário */}
            <div className="input-group">
              <label>Usuário</label>
              <div className="input-with-icon">
                <User size={18} />
                <input
                  type="text"
                  value={newUser.username}
                  onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="Ex: joao.silva"
                />
              </div>
            </div>

            {/* Senha */}
            <div className="input-group">
              <label>Senha</label>
              <div className="input-with-icon">
                <Key size={18} />
                <input
                  type="text"
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Senha forte"
                />
              </div>
            </div>

            {/* Nível */}
            <div className="input-group">
              <label>Nível de Acesso</label>
              <div className="input-with-icon">
                <Shield size={18} />
                <select
                  style={{ appearance: 'none' }}
                  value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="user">Usuário</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            {/* Setor */}
            <div className="input-group">
              <label>Setor</label>
              <div className="input-with-icon">
                <Briefcase size={18} />
                <select
                  style={{ appearance: 'none' }}
                  value={newUser.sector}
                  onChange={e => setNewUser({ ...newUser, sector: e.target.value })}
                >
                  <option value="estoque">Estoque</option>
                  <option value="atendimento">Atendimento</option>
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

      {/* ── Tabela de usuários ── */}
      <div className="card">
        <h3>Gerenciamento de Perfis, Senhas e Setores</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Visualize e edite as informações de todos os usuários. A coluna <strong>Setor</strong> determina o nível de acesso do colaborador no sistema.
        </p>

        {loading ? (
          <p>Carregando perfis...</p>
        ) : (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table className="responsive-table user-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Permissão</th>
                  <th>Setor</th>
                  <th>Senha Atual</th>
                  <th>Nova Senha</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    {/* Usuário */}
                    <td>
                      <div className="input-with-icon" style={{ marginTop: 0, width: '200px' }}>
                        <User size={16} />
                        <input
                          type="text"
                          id={`username-${u.id}`}
                          defaultValue={u.username}
                          style={{ padding: '0.6rem 1rem 0.6rem 2.8rem', borderRadius: '10px' }}
                        />
                      </div>
                    </td>

                    {/* Permissão */}
                    <td>
                      <div className="input-with-icon" style={{ marginTop: 0, width: '130px' }}>
                        <Shield size={16} />
                        <select
                          id={`role-${u.id}`}
                          defaultValue={u.role}
                          style={{
                            padding: '0.6rem 1rem 0.6rem 2.8rem', borderRadius: '10px',
                            color: u.role === 'admin' ? '#c084fc' : 'var(--text-primary)',
                            appearance: 'none', cursor: 'pointer', fontWeight: 600
                          }}
                          onChange={(e) => {
                            e.target.style.color = e.target.value === 'admin' ? '#c084fc' : 'var(--text-primary)';
                          }}
                        >
                          <option value="user">Usuário</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </td>

                    {/* Setor */}
                    <td>
                      <div className="input-with-icon" style={{ marginTop: 0, width: '155px' }}>
                        <Briefcase size={16} />
                        <select
                          id={`sector-${u.id}`}
                          defaultValue={u.sector || 'estoque'}
                          style={{
                            padding: '0.6rem 1rem 0.6rem 2.8rem', borderRadius: '10px',
                            color: (u.sector || 'estoque') === 'atendimento' ? '#38bdf8' : 'var(--text-primary)',
                            appearance: 'none', cursor: 'pointer', fontWeight: 600
                          }}
                          onChange={(e) => {
                            e.target.style.color = e.target.value === 'atendimento' ? '#38bdf8' : 'var(--text-primary)';
                          }}
                        >
                          <option value="estoque">Estoque</option>
                          <option value="atendimento">Atendimento</option>
                        </select>
                      </div>
                    </td>

                    {/* Senha atual */}
                    <td style={{ minWidth: '200px' }}>
                      <div className="input-with-icon" style={{ marginTop: 0, width: '100%', position: 'relative' }}>
                        <LockIndicator size={16} />
                        <input
                          type={visiblePasswords[u.id] ? 'text' : 'password'}
                          value={u.password}
                          readOnly
                          style={{ padding: '0.6rem 2.5rem 0.6rem 2.2rem', borderRadius: '10px', minWidth: '0', width: '100%' }}
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => togglePasswordVisibility(u.id)}
                          title={visiblePasswords[u.id] ? 'Ocultar senha' : 'Ver senha'}
                          style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: '20px' }}
                        >
                          {visiblePasswords[u.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </td>

                    {/* Nova senha */}
                    <td style={{ minWidth: '200px' }}>
                      <div className="input-with-icon" style={{ marginTop: 0, width: '100%', position: 'relative' }}>
                        <Key size={16} />
                        <input
                          type="text"
                          placeholder="Nova senha..."
                          value={newPassword[u.id] || ''}
                          onChange={(e) => handlePasswordChange(u.id, e.target.value)}
                          style={{ padding: '0.6rem 1rem 0.6rem 2.2rem', borderRadius: '10px', minWidth: '0', width: '100%' }}
                        />
                      </div>
                    </td>

                    {/* Ações */}
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className={`btn-icon-secondary ${successRow === u.id ? 'btn-success' : ''}`}
                          onClick={() => saveModifications(u.id)}
                          disabled={savingRow === u.id}
                          title="Salvar alterações"
                        >
                          {savingRow === u.id ? (
                            <Loader2 size={16} className="spin-icon" />
                          ) : successRow === u.id ? (
                            <Check size={16} />
                          ) : (
                            <Save size={16} />
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

// Ícone de cadeado inline
const LockIndicator = ({ size }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size} height={size}
    viewBox="0 0 24 24"
    fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);
