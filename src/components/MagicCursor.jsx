import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../theme.jsx';

export default function MagicCursor() {
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [isLocked, setIsLocked] = useState(false); // detects password inputs or secure buttons
  const [trail, setTrail] = useState([]);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Detect touch / mobile devices (where fine mouse pointers aren't available)
  useEffect(() => {
    const checkIfTouch = () => {
      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
      const isMobileWidth = window.innerWidth <= 1024;
      const hasTouchSupport = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

      if (hasCoarsePointer || !hasFinePointer || (hasTouchSupport && isMobileWidth)) {
        setIsTouchDevice(true);
      } else {
        setIsTouchDevice(false);
      }
    };

    checkIfTouch();

    const mediaCoarse = window.matchMedia('(pointer: coarse)');
    const mediaFine = window.matchMedia('(pointer: fine)');

    const handleMediaChange = () => checkIfTouch();

    if (mediaCoarse.addEventListener) {
      mediaCoarse.addEventListener('change', handleMediaChange);
      mediaFine.addEventListener('change', handleMediaChange);
    }

    const handleTouchStart = () => {
      if (window.innerWidth <= 1024) {
        setIsTouchDevice(true);
      }
    };

    window.addEventListener('resize', checkIfTouch);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });

    return () => {
      window.removeEventListener('resize', checkIfTouch);
      window.removeEventListener('touchstart', handleTouchStart);
      if (mediaCoarse.removeEventListener) {
        mediaCoarse.removeEventListener('change', handleMediaChange);
        mediaFine.removeEventListener('change', handleMediaChange);
      }
    };
  }, []);
  
  // Magical Cursor Styles:
  // 1: Classical Feather Quill Pen
  // 2: Dark, Weathered Wand
  // 3: Golden Phoenix Wing Wand
  // 4: Minimalist Golden Pearl (Professional Default)
  const [cursorStyle, setCursorStyle] = useState(4); 
  const [showMenu, setShowMenu] = useState(false);

  const lastPos = useRef({ x: 0, y: 0 });
  const footprintCount = useRef(0);
  const primaryCursorRef = useRef(null);

  // Clear trail on style change to prevent cross-contamination
  useEffect(() => {
    setTrail([]);
  }, [cursorStyle]);

  useEffect(() => {
    if (isTouchDevice || !theme || theme.id !== 'potter') return;

    let lastTime = 0;
    
    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      if (primaryCursorRef.current) {
        primaryCursorRef.current.style.left = `${clientX}px`;
        primaryCursorRef.current.style.top = `${clientY}px`;
      }

      const now = Date.now();
      const dx = clientX - lastPos.current.x;
      const dy = clientY - lastPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // --- Particle Spawn Logic based on Cursor Style ---
      if (cursorStyle === 4) {
        // Style 4 (Golden Pearl): High-density golden micro-sparkles
        if (distance > 1 && now - lastTime > 8) {
          setTrail((prev) => {
            const newTrail = [
              ...prev,
              {
                x: clientX,
                y: clientY,
                id: Math.random(),
                size: Math.random() * 5 + 2.5,
                driftX: (Math.random() - 0.5) * 18,
                driftY: -6 - Math.random() * 10,
                styleType: 4,
              }
            ];
            if (newTrail.length > 75) {
              newTrail.shift();
            }
            return newTrail;
          });
          lastPos.current = { x: clientX, y: clientY };
          lastTime = now;
        }
      }
      else if (cursorStyle === 3) {
        // Style 3 (Phoenix Wand): Dense yellow & red sparkle glitters
        if (distance > 1 && now - lastTime > 10) {
          setTrail((prev) => {
            const newTrail = [
              ...prev,
              {
                x: clientX,
                y: clientY,
                id: Math.random(),
                size: Math.random() * 8 + 4,
                driftX: (Math.random() - 0.5) * 30, // drift width
                type: Math.random() > 0.5 ? 'red' : 'yellow',
                rotation: Math.random() * 360,
                styleType: 3,
              }
            ];
            // Keep a larger buffer to support high density movement
            if (newTrail.length > 55) {
              newTrail.shift();
            }
            return newTrail;
          });
          lastPos.current = { x: clientX, y: clientY };
          lastTime = now;
        }
      }
      else if (cursorStyle === 2) {
        // Style 2 (Weathered Wand): Elegant stardust sparks
        if (distance > 8 && now - lastTime > 40) {
          setTrail((prev) => {
            const newTrail = [
              ...prev,
              {
                x: clientX,
                y: clientY,
                id: Math.random(),
                size: Math.random() * 6 + 2,
                driftX: (Math.random() - 0.5) * 15,
                type: 'gold-star',
                rotation: Math.random() * 360,
                styleType: 2,
              }
            ];
            if (newTrail.length > 20) {
              newTrail.shift();
            }
            return newTrail;
          });
          lastPos.current = { x: clientX, y: clientY };
          lastTime = now;
        }
      }
      else if (cursorStyle === 1) {
        // Style 1 (Quill Pen): Marauder's Map footsteps
        if (distance > 24 && now - lastTime > 150) {
          let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
          footprintCount.current += 1;
          const isLeft = footprintCount.current % 2 === 0;

          const offsetDist = 8;
          const rad = (angle - 90) * (Math.PI / 180);
          const offsetX = Math.cos(rad + (isLeft ? -Math.PI/2 : Math.PI/2)) * offsetDist;
          const offsetY = Math.sin(rad + (isLeft ? -Math.PI/2 : Math.PI/2)) * offsetDist;

          setTrail((prev) => {
            const newTrail = [
              ...prev,
              {
                x: clientX + offsetX,
                y: clientY + offsetY,
                id: Math.random(),
                angle: angle,
                isLeft: isLeft,
                styleType: 1,
              }
            ];
            if (newTrail.length > 12) {
              newTrail.shift();
            }
            return newTrail;
          });
          lastPos.current = { x: clientX, y: clientY };
          lastTime = now;
        }
      }
    };

    const handleMouseOver = (e) => {
      const target = e.target;
      if (!target) return;
      
      if (primaryCursorRef.current) {
        primaryCursorRef.current.style.left = `${e.clientX}px`;
        primaryCursorRef.current.style.top = `${e.clientY}px`;
      }
      
      const isClickable = target.closest('button, a, input, select, [role="button"], .cursor-pointer, option, [onclick]');
      setIsHovered(!!isClickable);

      // Detect password input or delete triggers to turn into secure lock indicator
      const inputType = target.getAttribute('type');
      const isSecure = inputType === 'password' || target.classList.contains('delete') || target.innerText?.toLowerCase().includes('delete') || target.innerText?.toLowerCase().includes('remove');
      setIsLocked(!!isSecure);
    };

    const handleMouseDown = (e) => {
      if (cursorStyle === 4) {
        const { clientX, clientY } = e;
        // Spawn a rich burst of golden micro-sparkles on click
        setTrail((prev) => {
          const burst = [];
          for (let i = 0; i < 18; i++) {
            burst.push({
              x: clientX,
              y: clientY,
              id: Math.random() + i,
              size: Math.random() * 5 + 2, // 2px to 7px size
              driftX: (Math.random() - 0.5) * 55, // wider drift for clicking burst
              driftY: (Math.random() - 0.5) * 55, // multi-directional drift
              styleType: 4,
            });
          }
          const newTrail = [...prev, ...burst];
          // Keep a bigger buffer for active clicks
          if (newTrail.length > 90) {
            return newTrail.slice(newTrail.length - 90);
          }
          return newTrail;
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseover', handleMouseOver);
    window.addEventListener('mousedown', handleMouseDown);

    // Inject styles for high quality animations
    const style = document.createElement('style');
    style.id = 'potter-cursor-hide-styles';

    style.innerHTML = `
      @keyframes spin-slow {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes ink-pulse {
        0%, 100% { transform: scale(1); opacity: 0.4; }
        50% { transform: scale(1.4); opacity: 0.75; }
      }
      @keyframes phoenix-star-rise {
        0% {
          transform: translate(-50%, -50%) translateY(0) scale(0.2) rotate(0deg);
          opacity: 0;
        }
        12% {
          transform: translate(-50%, -50%) translateY(-2px) scale(1.1) rotate(45deg);
          opacity: 1;
        }
        50% {
          transform: translate(-50%, -50%) translateY(-15px) translateX(calc(var(--drift-x, 15px) * 0.4)) scale(0.9) rotate(180deg);
          opacity: 0.9;
        }
        100% {
          transform: translate(-50%, -50%) translateY(-30px) translateX(var(--drift-x, 15px)) scale(0) rotate(270deg);
          opacity: 0;
        }
      }
      @keyframes glitter-micro-rise {
        0% {
          transform: translate(-50%, -50%) scale(0.2) rotate(0deg);
          opacity: 0;
        }
        15% {
          transform: translate(-50%, -50%) scale(1.1) rotate(45deg);
          opacity: 1;
        }
        50% {
          transform: translate(-50%, -50%) translateY(var(--drift-y, -12px)) translateX(calc(var(--drift-x, 18px) * 0.4)) scale(0.8) rotate(180deg);
          opacity: 0.95;
        }
        100% {
          transform: translate(-50%, -50%) translateY(var(--drift-y-end, -24px)) translateX(var(--drift-x, 18px)) scale(0) rotate(270deg);
          opacity: 0;
        }
      }
      @keyframes glitter-shimmer {
        0%, 100% {
          opacity: 1;
          filter: brightness(1.3) drop-shadow(0 0 5px currentColor);
        }
        50% {
          opacity: 0.35;
          filter: brightness(0.6) drop-shadow(0 0 1px currentColor);
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('mousedown', handleMouseDown);
      const el = document.getElementById('potter-cursor-hide-styles');
      if (el) el.remove();
    };
  }, [theme, cursorStyle, isTouchDevice]);

  // Only render custom cursor on desktop pointer devices in potter theme
  if (isTouchDevice || !theme || theme.id !== 'potter') return null;

  return (
    <>
      {/* Dynamic Cursor Stage */}
      <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden select-none">
        
        {/* 1. Marauder's Map Footprint Trails & Phoenix Sparks */}
        {trail.map((pt, idx) => {
          if (pt.styleType === 1) {
            // Style 1 Footprints
            const ageRatio = (idx + 1) / trail.length;
            const currentOpacity = ageRatio * 0.75;
            return (
              <div
                key={pt.id}
                className="absolute select-none pointer-events-none transition-opacity duration-500"
                style={{
                  left: pt.x,
                  top: pt.y,
                  transform: `translate(-50%, -50%) rotate(${pt.angle}deg) scale(${pt.isLeft ? '1, 1' : '-1, 1'})`,
                  opacity: currentOpacity,
                }}
              >
                <svg 
                  width="14" 
                  height="22" 
                  viewBox="0 0 14 22" 
                  fill="none" 
                  className="text-[#2d2219]/90 drop-shadow-[0.5px_0.5px_1px_rgba(45,34,25,0.15)]"
                >
                  <path 
                    d="M 6.5 6 C 4.5 6, 2.5 8, 2.5 11.5 C 2.5 15, 4 16, 4.5 16.5 C 5 17, 3 18.5, 3 19.5 C 3 21, 5 22, 6.5 22 C 8 22, 10 21, 10 19.5 C 10 18.5, 8 17, 8.5 16.5 C 9 16, 10.5 15, 10.5 11.5 C 10.5 8, 8.5 6, 6.5 6 Z" 
                    fill="currentColor"
                    opacity="0.85"
                  />
                  <ellipse cx="6.5" cy="2" rx="1.5" ry="2" fill="currentColor" />
                  <circle cx="9.2" cy="2.5" r="0.9" fill="currentColor" />
                  <circle cx="11.2" cy="3.8" r="0.8" fill="currentColor" />
                  <circle cx="3.8" cy="2.8" r="0.9" fill="currentColor" />
                  <circle cx="2" cy="4.5" r="0.7" fill="currentColor" />
                </svg>
              </div>
            );
          } else if (pt.styleType === 3) {
            // Style 3 Phoenix Spark glitters / glitter stars - yellow and red
            return (
              <div
                key={pt.id}
                className="absolute select-none pointer-events-none"
                style={{
                  left: pt.x,
                  top: pt.y,
                  animation: 'phoenix-star-rise 0.65s cubic-bezier(0.1, 0.8, 0.25, 1) forwards',
                  '--drift-x': `${pt.driftX}px`,
                }}
              >
                {pt.type === 'red' ? (
                  // Red Sparkly Star
                  <div 
                    className="bg-gradient-to-tr from-red-600 via-rose-500 to-orange-400"
                    style={{
                      clipPath: 'polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)',
                      width: pt.size,
                      height: pt.size,
                      animation: 'glitter-shimmer 0.15s infinite alternate ease-in-out',
                      color: '#ef4444',
                    }}
                  />
                ) : (
                  // Yellow Glitter Star
                  <div 
                    className="bg-gradient-to-tr from-yellow-400 via-amber-300 to-white"
                    style={{
                      clipPath: 'polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)',
                      width: pt.size,
                      height: pt.size,
                      animation: 'glitter-shimmer 0.12s infinite alternate ease-in-out',
                      color: '#fbbf24',
                    }}
                  />
                )}
              </div>
            );
          } else if (pt.styleType === 2) {
            // Style 2 Weathered Wand stardust
            return (
              <div
                key={pt.id}
                className="absolute select-none pointer-events-none"
                style={{
                  left: pt.x,
                  top: pt.y,
                  animation: 'phoenix-star-rise 1.2s ease-out forwards',
                  '--drift-x': `${pt.driftX}px`,
                }}
              >
                <div 
                  className="bg-gradient-to-r from-cyan-400 via-teal-200 to-white"
                  style={{
                    clipPath: 'polygon(50% 0%, 63% 37%, 100% 50%, 63% 63%, 50% 100%, 37% 63%, 0% 50%, 37% 37%)',
                    width: pt.size,
                    height: pt.size,
                    animation: 'glitter-shimmer 0.35s infinite alternate ease-in-out',
                    color: '#22d3ee',
                  }}
                />
              </div>
            );
          } else if (pt.styleType === 4) {
            // Style 4 Minimalist Golden Pearl fast micro-sparkle
            return (
              <div
                key={pt.id}
                className="absolute select-none pointer-events-none"
                style={{
                  left: pt.x,
                  top: pt.y,
                  animation: 'glitter-micro-rise 0.42s cubic-bezier(0.1, 0.8, 0.25, 1) forwards',
                  '--drift-x': `${pt.driftX}px`,
                  '--drift-y': `${pt.driftY}px`,
                  '--drift-y-end': `${pt.driftY * 1.8}px`,
                }}
              >
                <div 
                  className="bg-gradient-to-tr from-amber-400 via-yellow-200 to-white"
                  style={{
                    clipPath: 'polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)',
                    width: `${pt.size}px`,
                    height: `${pt.size}px`,
                    animation: 'glitter-shimmer 0.1s infinite alternate ease-in-out',
                    color: '#fbbf24',
                  }}
                />
              </div>
            );
          }
          return null;
        })}

        {/* 2. Primary Cursor Graphic */}
        <div
          ref={primaryCursorRef}
          className="absolute select-none pointer-events-none"
          style={{
            left: '-100px',
            top: '-100px',
            // Align the hot-spot of Quill, Wand, and Pearl with the precise tip
            transform: cursorStyle === 1 ? 'translate(-3px, -33px)' : (cursorStyle === 2 ? 'translate(-2px, -2px)' : 'none'),
            transition: 'none',
          }}
        >
          
          {/* A. Dynamic Spell Light Glow (Tip Anchor) */}
          <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2">
            {/* Ambient glows removed to meet user request */}

            {/* Ancient Magical Ink Pulse Ring (For Quill) */}
            {isHovered && cursorStyle === 1 && (
              <div 
                className="absolute rounded-full border border-[#2d2219]/40 -translate-x-1/2 -translate-y-1/2"
                style={{
                  animation: 'ink-pulse 1.2s infinite ease-in-out',
                  width: '32px',
                  height: '32px',
                }}
              />
            )}

            {/* Hover Indicator Icon: Compass or Key */}
            {isHovered && (
              <div className="absolute -top-7 left-3 bg-[#22060c] border border-[#d4af37] px-1.5 py-0.5 rounded shadow-[0_2px_8px_rgba(0,0,0,0.5)] flex items-center justify-center animate-fade-in text-[#f5ebd6]">
                {isLocked ? (
                  // Lock & Key Icon
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-400">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                ) : (
                  // Miniature Compass
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-400 animate-[spin-slow_4s_linear_infinite]">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" fill="currentColor" />
                  </svg>
                )}
                <span className="text-[7px] tracking-wider ml-1 uppercase font-serif">
                  {isLocked ? 'Alohomora' : 'Reveal'}
                </span>
              </div>
            )}
          </div>

          {/* B4. STYLE 4: MINIMALIST GOLDEN PEARL (Double-layered interactive golden ring & core pearl) */}
          {cursorStyle === 4 && (
            <div className="absolute top-0 left-0 pointer-events-none select-none">
              {/* Outer Golden Halo Ring */}
              <div 
                className="absolute rounded-full border border-amber-400/70 transition-all duration-250 ease-out -translate-x-1/2 -translate-y-1/2"
                style={{
                  width: isHovered ? '20px' : '10px',
                  height: isHovered ? '20px' : '10px',
                  borderColor: isHovered ? 'rgba(245, 158, 11, 0.95)' : 'rgba(212, 175, 55, 0.65)',
                  backgroundColor: isHovered ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                  boxShadow: isHovered ? '0 0 8px rgba(245, 158, 11, 0.45)' : 'none',
                  left: '0px',
                  top: '0px',
                }}
              />
              {/* Core Golden Pearl */}
              <div 
                className="absolute rounded-full bg-gradient-to-tr from-amber-400 via-yellow-200 to-white -translate-x-1/2 -translate-y-1/2"
                style={{
                  width: '4px',
                  height: '4px',
                  boxShadow: '0 0 5px rgba(245, 158, 11, 1), 0 0 1px rgba(255, 255, 255, 1)',
                  left: '0px',
                  top: '0px',
                }}
              />
            </div>
          )}

          {/* B3. STYLE 3: GOLDEN PHOENIX WING WAND (Tip is at x=21, y=0 of SVG, so we shift it left 21px to align with cursor) */}
          {cursorStyle === 3 && (
            <div className="absolute top-0 left-0">
              <svg 
                width="42" 
                height="75" 
                viewBox="0 0 42 75" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  transform: 'rotate(-38deg) translate(-21px, -1px)',
                  transformOrigin: '21px 0px',
                  filter: 'drop-shadow(2px 3px 5px rgba(0,0,0,0.65))',
                }}
              >
                <defs>
                  {/* Rich Wood Gradient for the Wand Shaft */}
                  <linearGradient id="phoenix-wood" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2c1a04" />
                    <stop offset="40%" stopColor="#4a2711" />
                    <stop offset="70%" stopColor="#1a0f02" />
                    <stop offset="100%" stopColor="#0d0701" />
                  </linearGradient>

                  {/* Radiant Phoenix Gold and Bronze Gradient */}
                  <linearGradient id="phoenix-gold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#fffbeb" />
                    <stop offset="25%" stopColor="#f59e0b" />
                    <stop offset="60%" stopColor="#d4af37" />
                    <stop offset="90%" stopColor="#b45309" />
                    <stop offset="100%" stopColor="#78350f" />
                  </linearGradient>

                  {/* Secondary highlight for phoenix gold */}
                  <linearGradient id="phoenix-gold-bright" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="50%" stopColor="#fef08a" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>

                {/* 1. Wand Shaft: beautifully tapered from tip (21, 0) down to handle (21, 48) */}
                <path 
                  d="M 20.2 0 L 21.8 0 L 23 48 L 19 48 Z" 
                  fill="url(#phoenix-wood)" 
                />
                
                {/* Elegant wrapping golden filigree along the shaft */}
                <path 
                  d="M 21,12 C 22,12 22.5,15 21,18 C 19.5,21 21.5,23 21,26 C 20.5,29 22,31 21,34" 
                  stroke="url(#phoenix-gold)" 
                  strokeWidth="0.8" 
                  fill="none" 
                  opacity="0.8"
                />

                {/* 2. Golden Phoenix Wing Handle: Wrapped around the base from y=48 to y=72 */}
                {/* Handle Wood Core extension under the wing */}
                <path 
                  d="M 19 48 L 23 48 L 22.5 70 L 19.5 70 Z" 
                  fill="#1a0f02" 
                />

                {/* Main Wing Body */}
                <path 
                  d="M 19 48 
                     C 24 47, 34 50, 36 56 
                     C 37 60, 34 66, 29 71 
                     C 25 74, 21 73, 21 73 
                     C 21 73, 23 68, 23 64 
                     C 23 58, 17 55, 17 55 
                     Z" 
                  fill="url(#phoenix-gold)" 
                />

                {/* Feather Layers & Engravings to give it an authentic, premium wing texture */}
                <path 
                  d="M 23 49 C 28 50, 34 53, 35 57 C 36 60, 33 64, 28 68" 
                  stroke="url(#phoenix-gold-bright)" 
                  strokeWidth="0.7" 
                  fill="none" 
                />
                <path 
                  d="M 22 53 C 26 54, 31 57, 32 60 C 33 63, 30 66, 26 69" 
                  stroke="url(#phoenix-gold-bright)" 
                  strokeWidth="0.6" 
                  fill="none" 
                />
                <path 
                  d="M 21 57 C 24 58, 28 60, 29 63 C 29 65, 27 67, 24 69" 
                  stroke="url(#phoenix-gold-bright)" 
                  strokeWidth="0.5" 
                  fill="none" 
                />

                {/* Crown pommel at the bottom of the wand handle */}
                <path 
                  d="M 19.5 70 Q 21 74 22.5 70 Z" 
                  fill="url(#phoenix-gold)" 
                />
                <circle cx="21" cy="71.5" r="1.5" fill="url(#phoenix-gold-bright)" />
              </svg>
            </div>
          )}

          {/* B1. STYLE 1: CLASSICAL FEATHER QUILL PEN */}
          {cursorStyle === 1 && (
            <div className="relative pointer-events-none select-none">
              {/* Quill feather angling up and to the right */}
              <div className="absolute origin-bottom-left" style={{ transform: 'rotate(25deg) translate(2px, 2px)' }}>
                {/* Feathery quill body with fine details */}
                <div 
                  className="w-8 h-28 bg-gradient-to-tr from-[#ede4cb] via-[#c4b182] to-[#806835] shadow-sm relative"
                  style={{
                    clipPath: 'polygon(0% 100%, 20% 90%, 40% 75%, 65% 55%, 85% 30%, 100% 0%, 80% 25%, 55% 50%, 30% 72%, 10% 88%)',
                    borderRadius: '100% 10% 40% 10%',
                  }}
                >
                  {/* Fine feather barbs styling */}
                  <div className="absolute inset-y-0 left-1/2 w-0.5 bg-[#4a3915]/20 -translate-x-1/2" />
                </div>
                {/* Solid Pen Shaft/Tip */}
                <div 
                  className="w-1.5 h-12 bg-gradient-to-b from-[#e5cf92] via-[#856b33] to-[#d4af37]"
                  style={{
                    clipPath: 'polygon(20% 0%, 80% 0%, 100% 70%, 50% 100%, 0% 70%)',
                    transform: 'translate(4px, -1px)',
                  }}
                />
                {/* Gold Nib Point */}
                <div 
                  className="w-[3px] h-[5px] bg-[#d4af37]"
                  style={{
                    clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
                    transform: 'translate(5.5px, -1px)',
                  }}
                />
              </div>
            </div>
          )}

          {/* B2. STYLE 2: DARK, WEATHERED WAND */}
          {cursorStyle === 2 && (
            <div className="relative pointer-events-none select-none">
              {/* Ornate custom-textured weathered wand angled at -40 degrees */}
              <div 
                className="absolute origin-bottom-left w-[4.5px] h-14 rounded-sm shadow-md"
                style={{
                  background: 'linear-gradient(to bottom, #d4af37, #5c451a 15%, #2b1d0a 50%, #171107)',
                  transform: 'rotate(-40deg) translate(-2px, -52px)',
                  border: '0.5px solid rgba(212,175,55,0.25)',
                  boxShadow: '1px 1px 4px rgba(0,0,0,0.6)',
                }}
              >
                {/* Gnarled/weathered wood knots details */}
                <div className="absolute top-2 left-0.5 w-1 h-1 rounded-full bg-black/40" />
                <div className="absolute top-6 left-0 w-1 h-1.5 rounded-full bg-black/50" />
                <div className="absolute top-10 left-0.5 w-1 h-1 rounded-full bg-black/30" />
                {/* Ancient gold band on the handle bottom */}
                <div className="absolute bottom-0 inset-x-0 h-4 bg-gradient-to-t from-amber-400 to-[#d4af37] rounded-b-sm border-t border-amber-300/40 shadow-sm" />
                <div className="absolute bottom-1.5 inset-x-0 h-1 bg-black/40" />
                <div className="absolute bottom-6 inset-x-[0.5px] h-0.5 bg-amber-300/70" />
              </div>
            </div>
          )}

        </div>
      </div>

    </>
  );
}
