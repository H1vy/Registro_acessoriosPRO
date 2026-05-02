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
      <div className="modal-card confirm-modal-card" style={{ maxWidth, width: '100%' }}>

        {/* Botão de Fechar Circular */}
        <button className="modal-close-btn" onClick={onCancel} />

        <div className="modal-header" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          {/* Ícone no topo */}
          <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'center' }}>
            {isDanger && (
              <div className="confirm-modal-icon danger">
                <AlertTriangle size={32} color="#ef4444" />
              </div>
            )}
            {isSuccess && (
              <div className="confirm-modal-icon success">
                <CheckCircle size={32} color="#10b981" />
              </div>
            )}
            {isEdit && (
              <div className="confirm-modal-icon edit">
                <Edit3 size={32} color="#38bdf8" />
              </div>
            )}
            {!isDanger && !isSuccess && !isEdit && (
              <div className="confirm-modal-icon warning">
                <AlertTriangle size={32} color="#38bdf8" />
              </div>
            )}
          </div>

          <h3 className="confirm-modal-title">{title}</h3>

          <div className="confirm-modal-message">{message}</div>

          {showSelect && (
            <div style={{ marginTop: '1.5rem' }}>
              <div className="confirm-modal-select-list">
                {selectOptions.length === 0 ? (
                  <div className="confirm-modal-empty">
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
                      className={`confirm-modal-select-option ${isSelected ? 'selected' : ''}`}
                      style={{
                        borderBottom: i < selectOptions.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <div
                        className="confirm-modal-avatar"
                        style={{
                          background: isSelected ? 'var(--accent)' : `hsl(${hue}, 50%, 35%)`,
                        }}
                      >
                        {initials}
                      </div>
                      <span className={`confirm-modal-option-label ${isSelected ? 'selected' : ''}`}>
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
              className="confirm-modal-input"
            />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '2rem' }}>
          <button
            className={`btn-primary confirm-modal-confirm ${isDanger ? 'is-danger' : ''} ${isSuccess ? 'is-success' : ''}`}
            style={{ width: '100%', padding: '1rem', borderRadius: '16px', fontSize: '1rem', fontWeight: 700 }}
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
