import React from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';

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
  hideCancel = false
}) {
  if (!isOpen) return null;

  const isDanger = type === 'danger';
  const isSuccess = type === 'success';

  return (
    <div className="modal-backdrop" style={{ zIndex: 10000 }}>
      <div className="modal-card" style={{ maxWidth: '400px', padding: '2rem' }}>
        <button className="modal-close-btn" onClick={onCancel}>
          <X size={20} />
        </button>
        <div className="modal-header" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
            {isDanger && <AlertTriangle size={24} color="var(--danger)" />}
            {isSuccess && <CheckCircle size={24} color="var(--success)" />}
            {title}
          </h3>
          <p style={{ marginTop: '0.8rem', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
            {message}
          </p>
          
          {showInput && (
            <input 
              type="text" 
              autoFocus
              value={inputValue}
              onChange={(e) => onInputChange && onInputChange(e.target.value)}
              placeholder={inputPlaceholder}
              style={{
                width: '100%',
                marginTop: '1.5rem',
                padding: '0.85rem 1.1rem',
                background: 'var(--bg-input)',
                border: '1px solid var(--accent)',
                borderRadius: '12px',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          )}
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: hideCancel ? 'center' : 'stretch' }}>
          {!hideCancel && (
            <button 
              className="btn-primary" 
              style={{ 
                flex: 1, 
                background: 'var(--bg-input)', 
                color: 'var(--text-primary)', 
                boxShadow: 'none',
                padding: '0.75rem' 
              }}
              onClick={onCancel}
            >
              {cancelText}
            </button>
          )}
          <button 
            className="btn-primary" 
            style={{ 
              flex: hideCancel ? '0 1 200px' : 1, 
              background: isDanger ? 'var(--danger)' : isSuccess ? 'var(--success)' : 'var(--accent)', 
              color: isDanger || isSuccess ? '#fff' : '#020617',
              padding: '0.75rem' 
            }}
            onClick={onConfirm || onCancel}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
