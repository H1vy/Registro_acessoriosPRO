import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, Lock, ArrowRight, UserPlus, Eye, EyeOff } from 'lucide-react';
import { addRecord, getAllData } from '../utils/db';

export default function Login({ onLogin }) {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // --- Canvas Smoke Trail ---
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animFrameRef = useRef(null);

  const spawnParticles = useCallback((x, y) => {
    const count = 4;
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        radius: Math.random() * 18 + 10,
        opacity: Math.random() * 0.35 + 0.15,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -(Math.random() * 1.5 + 0.5),
        life: 1,
        decay: Math.random() * 0.018 + 0.01,
        hue: isAdminMode ? 260 : 200,
      });
    }
  }, [isAdminMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.radius += 0.4;
        p.life -= p.decay;
        p.opacity = p.life * 0.35;

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        grad.addColorStop(0, `hsla(${p.hue}, 80%, 70%, ${p.opacity})`);
        grad.addColorStop(1, `hsla(${p.hue}, 80%, 70%, 0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    // Blobs parallax
    const x = (clientX / window.innerWidth - 0.5) * 30;
    const y = (clientY / window.innerHeight - 0.5) * 30;
    setMousePos({ x, y });

    // Card Tilt
    const tiltX = (clientY - centerY) / 50;
    const tiltY = (centerX - clientX) / 50;
    setTilt({ x: tiltX, y: tiltY });

    // Smoke particles — only spawn when cursor is over a blob
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      const W = rect.width;
      const H = rect.height;

      // Approximate blob centers (CSS positions + parallax offset)
      const parallaxX = x * 2.5; // matches wrapper multiplier
      const parallaxY = y * 2.5;
      const blobs = [
        { cx: W - 90  + parallaxX,      cy: 90         + parallaxY,      r: 210 }, // blob-1 top-right
        { cx: 110     + (-x * 2),        cy: H - 110    + (-y * 2),       r: 190 }, // blob-2 bottom-left
        { cx: W / 2   + x * 1.2,         cy: H / 2      + y * 1.2,        r: 160 }, // blob-3 center
      ];

      const insideBlob = blobs.some(b => {
        const dx = cx - b.cx;
        const dy = cy - b.cy;
        return Math.sqrt(dx * dx + dy * dy) < b.r;
      });

      if (insideBlob) {
        spawnParticles(cx, cy);
      }
    }
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    try {
      const users = await getAllData('users');
      
      const user = users.find(u => u.username.trim() === username.trim() && u.password.trim() === password.trim());
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
    <div 
      className={`login-overlay ${isAdminMode ? 'admin' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: '1000px' }}
    >
      <div className="login-blobs">
        <div style={{ transform: `translate(${mousePos.x * 2.5}px, ${mousePos.y * 2.5}px)`, transition: 'transform 0.15s ease-out', position: 'absolute', inset: 0 }}>
          <div className="blob blob-1"></div>
        </div>
        <div style={{ transform: `translate(${mousePos.x * -2}px, ${mousePos.y * -2}px)`, transition: 'transform 0.2s ease-out', position: 'absolute', inset: 0 }}>
          <div className="blob blob-2"></div>
        </div>
        <div style={{ transform: `translate(${mousePos.x * 1.2}px, ${mousePos.y * 1.2}px)`, transition: 'transform 0.25s ease-out', position: 'absolute', inset: 0 }}>
          <div className="blob blob-3"></div>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
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
            <label>Usuário</label>
            <div className="input-with-icon">
              <User size={18} />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={isAdminMode ? "Admin" : "Seu nome de usuário"}
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
