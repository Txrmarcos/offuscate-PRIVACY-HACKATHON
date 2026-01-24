'use client';

import { useEffect, useRef } from 'react';
import createGlobe from 'cobe';

export interface GlobeProps {
  className?: string;
  size?: number;
}

/**
 * Globe - Interactive 3D globe component using Cobe
 * Adapted for Offuscate's privacy-focused visual identity
 *
 * Features:
 * - Auto-rotating WebGL globe
 * - Privacy theme (green/cyan accents)
 * - Global network markers
 * - Smooth animations
 */
export function Globe({ className = '', size = 600 }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let phi = 0;

    if (!canvasRef.current) return;

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: size * 2,
      height: size * 2,
      phi: 0,
      theta: 0.3,
      dark: 1,
      diffuse: 3,
      mapSamples: 16000,
      mapBrightness: 1.5,
      // Offuscate colors - white/neutral theme
      baseColor: [0.4, 0.4, 0.4],
      markerColor: [1, 1, 1], // White markers
      glowColor: [1, 1, 1], // White glow
      markers: [
        // Privacy nodes around the world
        { location: [37.7595, -122.4367], size: 0.06 }, // San Francisco
        { location: [40.7128, -74.006], size: 0.05 },   // New York
        { location: [51.5074, -0.1278], size: 0.06 },   // London
        { location: [48.8566, 2.3522], size: 0.04 },    // Paris
        { location: [52.52, 13.405], size: 0.05 },      // Berlin
        { location: [35.6762, 139.6503], size: 0.06 },  // Tokyo
        { location: [1.3521, 103.8198], size: 0.05 },   // Singapore
        { location: [22.3193, 114.1694], size: 0.04 },  // Hong Kong
        { location: [-33.8688, 151.2093], size: 0.04 }, // Sydney
        { location: [-23.5505, -46.6333], size: 0.05 }, // São Paulo
        { location: [55.7558, 37.6173], size: 0.04 },   // Moscow
        { location: [19.4326, -99.1332], size: 0.04 },  // Mexico City
        { location: [25.2048, 55.2708], size: 0.04 },   // Dubai
        { location: [-34.6037, -58.3816], size: 0.03 }, // Buenos Aires
      ],
      onRender: (state) => {
        // Slow, mysterious rotation
        state.phi = phi;
        phi += 0.003;

        // Subtle vertical wobble
        state.theta = 0.3 + Math.sin(phi * 0.5) * 0.05;

        state.width = size * 2;
        state.height = size * 2;
      },
    });

    return () => {
      globe.destroy();
    };
  }, [size]);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
          maxWidth: '100%',
          aspectRatio: '1',
        }}
        className="opacity-70"
      />

      {/* White glow effect */}
      <div
        className="absolute inset-0 rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 40%, transparent 70%)',
        }}
      />

      {/* Outer ring */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, transparent 45%, rgba(255,255,255,0.03) 50%, transparent 55%)',
        }}
      />
    </div>
  );
}
