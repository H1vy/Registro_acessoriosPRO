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
  const timeRef = useRef(0);

  // Each blob: {hue, sat, lit} matching CSS blob colors and their opacities
  const BLOB_COLORS = [
    { hue: 198, sat: 93, lit: 60, opacity: 0.4 }, // blob-1: accent cyan
    { hue: 160, sat: 84, lit: 39, opacity: 0.4 }, // blob-2: success green
    { hue: 262, sat: 83, lit: 58, opacity: 0.4 }, // blob-3: purple
  ];

  const spawnSmokeAt = useCallback((cx, cy, blobIdx) => {
    const color = BLOB_COLORS[blobIdx];
    const count = 3;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 0.8 + 0.3;
      particlesRef.current.push({
        x: cx + (Math.random() - 0.5) * 30,
        y: cy + (Math.random() - 0.5) * 30,
        radius: Math.random() * 22 + 14,
        vx: Math.cos(angle) * speed * 0.6,
        vy: -(Math.random() * 1.0 + 0.4),   // mostly upward
        angularV: (Math.random() - 0.5) * 0.04, // curl/twist
        waveAmp: Math.random() * 0.6 + 0.2,     // sinusoidal side-drift
        waveFreq: Math.random() * 0.04 + 0.02,
        age: 0,
        life: 1,
        decay: Math.random() * 0.008 + 0.005, // slower for wispy persistence
        hue: color.hue + (Math.random() - 0.5) * 15,
        sat: color.sat,
        lit: color.lit + Math.random() * 15,
        maxOpacity: color.opacity * (Math.random() * 0.5 + 0.3),
      });
    }
  }, []);

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
      timeRef.current++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);

      for (const p of particlesRef.current) {
        p.age++;
        // Sinusoidal side-drift for wisps
        p.x += p.vx + Math.sin(p.age * p.waveFreq) * p.waveAmp;
        p.y += p.vy;
        // Smoke expands and slows
        p.radius += 0.55;
        p.vy *= 0.99;
        p.vx *= 0.98;
        p.life -= p.decay;

        // Opacity: ramp up briefly then fade out gracefully
        const progress = 1 - p.life;
        const opacity = progress < 0.15
          ? p.maxOpacity * (progress / 0.15)
          : p.maxOpacity * p.life;

        // Multi-stop gradient for wispy tendrils
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        grad.addColorStop(0,   `hsla(${p.hue}, ${p.sat}%, ${p.lit}%, ${opacity * 0.9})`);
        grad.addColorStop(0.4, `hsla(${p.hue}, ${p.sat}%, ${p.lit}%, ${opacity * 0.5})`);
        grad.addColorStop(0.8, `hsla(${p.hue}, ${p.sat}%, ${p.lit}%, ${opacity * 0.1})`);
        grad.addColorStop(1,   `hsla(${p.hue}, ${p.sat}%, ${p.lit}%, 0)`);

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

    // Smoke spawns at blob OUTER EDGE only
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      const W = rect.width;
      const H = rect.height;

      const blobDefs = [
        { cx: W - 90  + x * 2.5,  cy: 90        + y * 2.5,  r: 210, idx: 0 },
        { cx: 110     + (-x * 2), cy: H - 110   + (-y * 2), r: 190, idx: 1 },
        { cx: W / 2   + x * 1.2,  cy: H / 2     + y * 1.2,  r: 160, idx: 2 },
      ];

      // "Outer ring" = distance is between 0.75*r and 1.2*r from blob center
      for (const b of blobDefs) {
        const dx = cx - b.cx;
        const dy = cy - b.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const inner = b.r * 0.75;
        const outer = b.r * 1.20;
        if (dist >= inner && dist <= outer) {
          spawnSmokeAt(cx, cy, b.idx);
          break; // one blob at a time
        }
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
