import React from 'react';
import { X, AlertTriangle, CheckCircle, Edit3 } from 'lucide-react';

export default function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = 'Confirmar', 
  cancelText = 'Cancelar', 
  type = 'warning',
  showInput = false,
  inputValue = '',
  onInputChange = null,
  inputPlaceholder = '',
  hideCancel = false,
  // Select dropdown props
  showSelect = false,
  selectOptions = [],     // [{ value, label }]
  selectValue = '',
  onSelectChange = null,
  selectPlaceholder = 'Selecione...',
  selectLabel = '',
  maxWidth = '420px'
}) {
  if (!isOpen) return null;

  const isDanger = type === 'danger';
  const isSuccess = type === 'success';
  const isEdit = type === 'edit';

  return (
    <div className="modal-backdrop">
      <div 
        className="modal-card" 
        style={{ 
          maxWidth: maxWidth, 
          width: '100%',
          padding: '2.5rem 2rem 2rem', 
          borderRadius: '28px',
          background: 'rgba(10, 15, 29, 0.45)', // Mais translúcido
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 40px 80px -15px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          position: 'relative',
          textAlign: 'center'
        }}
      >
        {/* Botão de Fechar Circular */}
        <button 
          className="modal-close-btn" 
          onClick={onCancel}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            transition: 'all 0.2s ease',
            padding: 0
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
        >
          <X size={18} />
        </button>

        <div className="modal-header" style={{ marginBottom: '1.5rem' }}>
          {/* Ícone no topo */}
          <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'center' }}>
            {isDanger && (
              <div style={{ padding: '14px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '18px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <AlertTriangle size={32} color="#ef4444" />
              </div>
            )}
            {isSuccess && (
              <div style={{ padding: '14px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '18px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <CheckCircle size={32} color="#10b981" />
              </div>
            )}
            {isEdit && (
              <div style={{ padding: '14px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '18px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                <Edit3 size={32} color="var(--accent)" />
              </div>
            )}
            {!isDanger && !isSuccess && !isEdit && (
              <div style={{ padding: '14px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '18px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                <AlertTriangle size={32} color="var(--accent)" />
              </div>
            )}
          </div>

          <h3 style={{ 
            fontSize: '1.5rem', 
            fontWeight: 800, 
            color: '#fff', 
            marginBottom: '0.75rem',
            letterSpacing: '-0.02em'
          }}>
            {title}
          </h3>
          
          <div style={{ 
            color: 'rgba(255, 255, 255, 0.6)', 
            fontSize: '0.95rem', 
            lineHeight: '1.5',
            maxWidth: '90%',
            margin: '0 auto'
          }}>
            {message}
          </div>

          {/* ... (ShowSelect e ShowInput permanecem com design compatível) ... */}
          {showSelect && (
            <div style={{ marginTop: '1.5rem' }}>
               {/* Lógica de seleção mantida, apenas ajustando containers se necessário */}
               <div style={{
                maxHeight: '220px', overflowY: 'auto',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px',
                background: 'rgba(0,0,0,0.2)', scrollbarWidth: 'thin'
              }}>
                {selectOptions.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                    Nenhum responsável cadastrado
                  </div>
                ) : selectOptions.map((opt, i) => {
                  const isSelected = selectValue === opt.value;
                  const initials = opt.label.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
                  const hue = (opt.label.charCodeAt(0) * 53) % 360;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onSelectChange && onSelectChange(opt.value)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.85rem',
                        width: '100%', padding: '0.75rem 1rem',
                        background: isSelected ? 'rgba(56,189,248,0.08)' : 'transparent',
                        border: 'none',
                        borderBottom: i < selectOptions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'
                      }}
                    >
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                        background: isSelected ? 'var(--accent)' : `hsl(${hue}, 50%, 35%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 800, color: '#fff'
                      }}>
                        {initials}
                      </div>
                      <span style={{
                        flex: 1, fontSize: '0.9rem',
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? '#fff' : 'rgba(255,255,255,0.7)'
                      }}>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {showInput && (
            <input 
              type="text" 
              autoFocus={!showSelect}
              value={inputValue}
              onChange={(e) => onInputChange && onInputChange(e.target.value)}
              placeholder={inputPlaceholder}
              style={{
                width: '100%',
                marginTop: '1.25rem',
                padding: '0.85rem 1.1rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '14px',
                color: '#fff',
                outline: 'none',
              }}
            />
          )}
        </div>

        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: '0.75rem', 
          marginTop: '2rem' 
        }}>
          <button 
            className="btn-primary" 
            style={{ 
              width: '100%',
              background: isDanger ? 'rgba(239, 68, 68, 0.9)' : isSuccess ? 'rgba(16, 185, 129, 0.9)' : 'var(--accent)', 
              color: isDanger || isSuccess ? '#fff' : '#020617',
              padding: '1rem',
              borderRadius: '16px',
              fontSize: '1rem',
              fontWeight: 700,
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: isDanger ? '0 8px 25px rgba(239, 68, 68, 0.4)' : '0 8px 25px rgba(56, 189, 248, 0.2)',
              backdropFilter: 'blur(4px)'
            }}
            onClick={onConfirm || onCancel}
          >
            {confirmText}
          </button>
          
          {!hideCancel && (
            <button 
              className="btn-cancel" 
              style={{ width: '100%' }}
              onClick={onCancel}
            >
              {cancelText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
