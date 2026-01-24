'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Shield } from 'lucide-react';

// Global event emitter for triggering offuscation from anywhere
export const triggerOffuscation = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('offuscate'));
  }
};

export function WaveMeshBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isOffuscating, setIsOffuscating] = useState(false);
  const offuscateRef = useRef(0); // 0 = normal, 1 = full offuscation

  const handleOffuscation = useCallback(() => {
    setIsOffuscating(true);
    setTimeout(() => setIsOffuscating(false), 2500); // Slightly longer duration
  }, []);

  // Listen for offuscation events from other components
  useEffect(() => {
    window.addEventListener('offuscate', handleOffuscation);
    return () => window.removeEventListener('offuscate', handleOffuscation);
  }, [handleOffuscation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    // Grid settings
    const nodeSpacing = 70;
    const cols = 50;
    const rows = 35;
    const waveAmplitude = 50;
    const waveSpeed = 0.012;

    // Isometric projection
    const isoAngle = Math.PI / 6;
    const scale = 1.8;

    // Pre-generate random seeds for each connection
    const connectionSeeds: number[][] = [];
    const nodeOffsets: { x: number; y: number }[][] = [];
    for (let row = 0; row < rows; row++) {
      connectionSeeds[row] = [];
      nodeOffsets[row] = [];
      for (let col = 0; col < cols; col++) {
        connectionSeeds[row][col] = Math.random() * 1000;
        nodeOffsets[row][col] = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
        };
      }
    }

    const project = (x: number, y: number, z: number) => {
      const isoX = (x - z) * Math.cos(isoAngle) * scale;
      const isoY = (x + z) * Math.sin(isoAngle) * scale - y * 0.8;
      return {
        x: canvas.width / 2 + isoX,
        y: canvas.height / 2 + isoY + 50,
      };
    };

    const getConnectionStrength = (row: number, col: number, direction: number, offuscateLevel: number) => {
      const seed = connectionSeeds[row][col] + direction * 137;
      const wave1 = Math.sin(seed * 0.1 + time * 0.5) * 0.5 + 0.5;
      const wave2 = Math.sin(seed * 0.23 + time * 0.8) * 0.5 + 0.5;
      let combined = (wave1 + wave2) / 2;

      // During offuscation, dramatically reduce connections
      if (offuscateLevel > 0) {
        const offuscateWave = Math.sin(seed * 0.5 + time * 5) * 0.5 + 0.5;
        // Almost all connections disappear during offuscation
        combined = combined * (1 - offuscateLevel * 0.98) * offuscateWave * (1 - offuscateLevel * 0.8);
      }

      if (combined < 0.15) return 0;
      if (combined < 0.35) return (combined - 0.15) / 0.2;
      return 1;
    };

    const draw = () => {
      // Animate offuscation level
      const targetOffuscate = isOffuscating ? 1 : 0;
      offuscateRef.current += (targetOffuscate - offuscateRef.current) * 0.08;
      const offuscateLevel = offuscateRef.current;

      // Background - stronger flash during offuscation
      const bgAlpha = 0.15 + offuscateLevel * 0.5;
      ctx.fillStyle = `rgba(10, 10, 10, ${bgAlpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add pulsing dark overlay during offuscation
      if (offuscateLevel > 0.1) {
        const pulse = Math.sin(time * 6) * 0.1 + 0.1;
        ctx.fillStyle = `rgba(0, 0, 0, ${pulse * offuscateLevel})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const points: { x: number; y: number; height: number; baseX: number; baseY: number }[][] = [];

      for (let row = 0; row < rows; row++) {
        points[row] = [];
        for (let col = 0; col < cols; col++) {
          const gridX = (col - cols / 2) * nodeSpacing;
          const gridZ = (row - rows / 2) * nodeSpacing;

          const dist = Math.sqrt(gridX * gridX + gridZ * gridZ);
          const wave1 = Math.sin(dist * 0.015 + time) * waveAmplitude;
          const wave2 = Math.sin(gridX * 0.02 + time * 1.3) * waveAmplitude * 0.4;
          const wave3 = Math.cos(gridZ * 0.018 + time * 0.8) * waveAmplitude * 0.3;
          const height = wave1 + wave2 + wave3;

          const projected = project(gridX, height, gridZ);

          // During offuscation, scatter nodes randomly with more dramatic movement
          const scatter = offuscateLevel * (Math.sin(time * 8 + connectionSeeds[row][col]) * 0.5 + 0.5);
          const chaosMultiplier = 1 + offuscateLevel * 2; // Nodes move up to 3x further
          const offsetX = nodeOffsets[row][col].x * scatter * chaosMultiplier;
          const offsetY = nodeOffsets[row][col].y * scatter * chaosMultiplier;

          points[row][col] = {
            x: projected.x + offsetX,
            y: projected.y + offsetY,
            height,
            baseX: projected.x,
            baseY: projected.y,
          };
        }
      }

      // Draw connections
      ctx.lineWidth = 0.5;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const p = points[row][col];
          const heightNorm = (p.height + waveAmplitude * 2) / (waveAmplitude * 4);
          const baseAlpha = 0.02 + heightNorm * 0.04;

          // Right connection
          if (col < cols - 1) {
            const strength = getConnectionStrength(row, col, 0, offuscateLevel);
            if (strength > 0) {
              const pRight = points[row][col + 1];
              ctx.strokeStyle = `rgba(255, 255, 255, ${baseAlpha * strength})`;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(pRight.x, pRight.y);
              ctx.stroke();
            }
          }

          // Bottom connection
          if (row < rows - 1) {
            const strength = getConnectionStrength(row, col, 1, offuscateLevel);
            if (strength > 0) {
              const pBottom = points[row + 1][col];
              ctx.strokeStyle = `rgba(255, 255, 255, ${baseAlpha * strength})`;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(pBottom.x, pBottom.y);
              ctx.stroke();
            }
          }

          // Diagonal
          if (col < cols - 1 && row < rows - 1) {
            const strength = getConnectionStrength(row, col, 2, offuscateLevel);
            if (strength > 0) {
              const pDiag = points[row + 1][col + 1];
              ctx.strokeStyle = `rgba(255, 255, 255, ${baseAlpha * 0.4 * strength})`;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(pDiag.x, pDiag.y);
              ctx.stroke();
            }
          }
        }
      }

      // Draw nodes
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const p = points[row][col];
          const heightNorm = (p.height + waveAmplitude * 2) / (waveAmplitude * 4);

          const connRight = col < cols - 1 ? getConnectionStrength(row, col, 0, offuscateLevel) : 0;
          const connBottom = row < rows - 1 ? getConnectionStrength(row, col, 1, offuscateLevel) : 0;
          const connLeft = col > 0 ? getConnectionStrength(row, col - 1, 0, offuscateLevel) : 0;
          const connTop = row > 0 ? getConnectionStrength(row - 1, col, 1, offuscateLevel) : 0;
          const totalConnections = (connRight + connBottom + connLeft + connTop) / 4;

          // During offuscation, nodes flicker intensely
          const flicker = offuscateLevel > 0.1
            ? Math.sin(time * 15 + connectionSeeds[row][col]) * 0.7 + 0.3
            : 1;

          // Some nodes completely disappear during offuscation
          const disappearChance = Math.sin(time * 4 + connectionSeeds[row][col] * 2) * 0.5 + 0.5;
          const nodeVisible = offuscateLevel > 0.5 && disappearChance < offuscateLevel * 0.6 ? 0 : 1;

          const connectivityBoost = 0.7 + totalConnections * 0.3;
          const brightness = (0.08 + heightNorm * 0.15) * connectivityBoost * flicker * nodeVisible;
          const nodeSize = (0.8 + heightNorm * 1) * (0.8 + totalConnections * 0.2) * (1 - offuscateLevel * 0.3);
          const glowSize = (2 + heightNorm * 4) * (0.7 + totalConnections * 0.3) * (1 + offuscateLevel * 1.5);

          // Glow - more intense during offuscation with color shift
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
          // During offuscation, glow becomes more cyan/blue
          const r = Math.round(255 - offuscateLevel * 100);
          const g = Math.round(255 - offuscateLevel * 30);
          const b = 255;
          gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${brightness * (0.6 + offuscateLevel * 0.8)})`);
          gradient.addColorStop(0.5, `rgba(200, 220, 255, ${brightness * 0.15})`);
          gradient.addColorStop(1, 'rgba(100, 150, 255, 0)');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
          ctx.fill();

          // Core
          ctx.fillStyle = `rgba(255, 255, 255, ${brightness * 0.8})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, nodeSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Overlay flash during offuscation - much more visible
      if (offuscateLevel > 0.1) {
        // Rapid white flashes
        const flashIntensity = Math.max(0, Math.sin(time * 12) * 0.08 * offuscateLevel);
        ctx.fillStyle = `rgba(255, 255, 255, ${flashIntensity})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Subtle cyan tint for privacy feel
        const tintIntensity = Math.sin(time * 4) * 0.03 + 0.03;
        ctx.fillStyle = `rgba(100, 200, 255, ${tintIntensity * offuscateLevel})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      time += waveSpeed + offuscateLevel * 0.03;
      animationId = requestAnimationFrame(draw);
    };

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, [isOffuscating]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 pointer-events-none opacity-70"
      />

      {/* Offuscate Button */}
      <button
        onClick={handleOffuscation}
        disabled={isOffuscating}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl font-medium text-sm transition-all active:scale-95 ${
          isOffuscating
            ? 'bg-white text-black'
            : 'bg-white/[0.05] border border-white/[0.1] text-white hover:bg-white/[0.1]'
        }`}
      >
        <Shield className={`w-4 h-4 ${isOffuscating ? 'animate-pulse' : ''}`} />
        {isOffuscating ? 'Offuscating...' : 'Offuscate'}
      </button>
    </>
  );
}
