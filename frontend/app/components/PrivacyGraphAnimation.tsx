'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PrivacyLevel } from '../lib/types';
import { Shield, Lock, X, Zap, Eye, EyeOff, RefreshCw, CheckCircle, ExternalLink } from 'lucide-react';
import { triggerOffuscation } from './WaveMeshBackground';

interface Node {
  id: string;
  x: number;
  y: number;
  label: string;
  type: 'sender' | 'recipient' | 'pool' | 'zk' | 'observer';
  visible: boolean;
}

interface Edge {
  from: string;
  to: string;
  visible: boolean;
  broken: boolean;
  animated?: boolean;
}

interface PrivacyGraphAnimationProps {
  privacyLevel: PrivacyLevel;
  onClose?: () => void;
  autoPlay?: boolean;
}

// ============================================
// FULL SCREEN TAKEOVER ANIMATION
// ============================================
export function FullScreenPrivacyAnimation({
  privacyLevel,
  txSignature,
  amount,
  campaignTitle,
  onComplete,
}: {
  privacyLevel: PrivacyLevel;
  txSignature: string;
  amount: string;
  campaignTitle?: string;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Handle window resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const { width, height } = dimensions;
  const centerX = width / 2;
  const centerY = height / 2;
  const scale = Math.min(width, height) / 600;

  // Define nodes
  const getNodes = useCallback((): Node[] => {
    const nodeScale = scale * 0.8;
    const spreadX = 200 * nodeScale;
    const spreadY = 120 * nodeScale;

    // Special layout for Privacy Pool - show multiple participants
    if (privacyLevel === 'SEMI') {
      const poolY = centerY + 20;
      const walletSpacing = 70 * nodeScale;

      return [
        // Your wallet (highlighted)
        { id: 'sender', x: centerX - spreadX, y: poolY - walletSpacing, label: 'Your Wallet', type: 'sender', visible: true },
        // Other participants
        { id: 'other1', x: centerX - spreadX, y: poolY, label: 'User 2', type: 'sender', visible: phase >= 1 },
        { id: 'other2', x: centerX - spreadX, y: poolY + walletSpacing, label: 'User 3', type: 'sender', visible: phase >= 1 },
        // The pool in the center
        { id: 'pool', x: centerX, y: poolY, label: 'Privacy Pool', type: 'pool', visible: phase >= 1 },
        // Recipients on the right
        { id: 'recipient', x: centerX + spreadX, y: poolY - walletSpacing, label: 'Recipient', type: 'recipient', visible: true },
        { id: 'dest2', x: centerX + spreadX, y: poolY, label: 'Dest 2', type: 'recipient', visible: phase >= 1 },
        { id: 'dest3', x: centerX + spreadX, y: poolY + walletSpacing, label: 'Dest 3', type: 'recipient', visible: phase >= 1 },
        // Observer at top
        { id: 'observer', x: centerX, y: centerY - spreadY - 30, label: 'Observer', type: 'observer', visible: phase >= 2 },
      ];
    }

    const baseNodes: Node[] = [
      { id: 'sender', x: centerX - spreadX, y: centerY + 40, label: 'Your Wallet', type: 'sender', visible: true },
      { id: 'recipient', x: centerX + spreadX, y: centerY + 40, label: 'Recipient', type: 'recipient', visible: true },
      { id: 'observer', x: centerX, y: centerY - spreadY, label: 'Observer', type: 'observer', visible: phase >= 2 },
    ];

    if (privacyLevel === 'ZK_COMPRESSED') {
      baseNodes.push({
        id: 'zk',
        x: centerX,
        y: centerY + 40,
        label: 'ZK Proof',
        type: 'zk',
        visible: phase >= 1,
      });
    } else if (privacyLevel === 'PRIVATE') {
      baseNodes.push({
        id: 'pool',
        x: centerX,
        y: centerY + 40,
        label: 'Privacy Pool',
        type: 'pool',
        visible: phase >= 1,
      });
    }

    return baseNodes;
  }, [centerX, centerY, scale, phase, privacyLevel]);

  // Define edges
  const getEdges = useCallback((): Edge[] => {
    if (privacyLevel === 'PUBLIC') {
      return [
        { from: 'sender', to: 'recipient', visible: true, broken: false, animated: phase >= 1 },
        { from: 'observer', to: 'sender', visible: phase >= 2, broken: false, animated: phase >= 2 },
        { from: 'observer', to: 'recipient', visible: phase >= 2, broken: false, animated: phase >= 2 },
      ];
    }

    if (privacyLevel === 'ZK_COMPRESSED') {
      return [
        { from: 'sender', to: 'zk', visible: phase >= 1, broken: false, animated: phase >= 1 },
        { from: 'zk', to: 'recipient', visible: phase >= 1, broken: phase >= 3, animated: phase >= 1 && phase < 3 },
        { from: 'observer', to: 'sender', visible: phase >= 2, broken: phase >= 3, animated: false },
        { from: 'observer', to: 'recipient', visible: phase >= 2, broken: phase >= 3, animated: false },
      ];
    }

    // Privacy Pool - show multiple participants mixing
    if (privacyLevel === 'SEMI') {
      return [
        // All wallets deposit to pool
        { from: 'sender', to: 'pool', visible: phase >= 1, broken: false, animated: phase >= 1 },
        { from: 'other1', to: 'pool', visible: phase >= 1, broken: false, animated: phase >= 1 },
        { from: 'other2', to: 'pool', visible: phase >= 1, broken: false, animated: phase >= 1 },
        // Pool withdraws to all recipients (shuffled - can't tell which is which)
        { from: 'pool', to: 'recipient', visible: phase >= 2, broken: false, animated: phase >= 2 && phase < 3 },
        { from: 'pool', to: 'dest2', visible: phase >= 2, broken: false, animated: phase >= 2 && phase < 3 },
        { from: 'pool', to: 'dest3', visible: phase >= 2, broken: false, animated: phase >= 2 && phase < 3 },
        // Observer confusion lines - all broken when privacy kicks in
        { from: 'observer', to: 'sender', visible: phase >= 3, broken: phase >= 3, animated: false },
        { from: 'observer', to: 'recipient', visible: phase >= 3, broken: phase >= 3, animated: false },
        { from: 'observer', to: 'pool', visible: phase >= 3, broken: phase >= 3, animated: false },
      ];
    }

    return [
      { from: 'sender', to: 'pool', visible: phase >= 1, broken: false, animated: phase >= 1 },
      { from: 'pool', to: 'recipient', visible: phase >= 1, broken: phase >= 3, animated: phase >= 1 && phase < 3 },
      { from: 'observer', to: 'sender', visible: phase >= 2, broken: phase >= 3, animated: false },
      { from: 'observer', to: 'recipient', visible: phase >= 2, broken: phase >= 3, animated: false },
    ];
  }, [phase, privacyLevel]);

  // Animation phases
  useEffect(() => {
    // Trigger mesh effect at start
    triggerOffuscation();

    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => {
        setPhase(3);
        // Trigger mesh effect when connection breaks
        if (privacyLevel !== 'PUBLIC') {
          triggerOffuscation();
        }
      }, 2800),
      setTimeout(() => setPhase(4), 4000),
      setTimeout(() => setShowSuccess(true), 5000),
    ];

    return () => timers.forEach(clearTimeout);
  }, [privacyLevel]);

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes = getNodes();
    const edges = getEdges();
    let animationFrame: number;
    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw edges
      edges.forEach((edge) => {
        if (!edge.visible) return;

        const fromNode = nodes.find((n) => n.id === edge.from);
        const toNode = nodes.find((n) => n.id === edge.to);
        if (!fromNode || !toNode) return;

        ctx.beginPath();

        const isProtectedEdge = privacyLevel !== 'PUBLIC' && (edge.from === 'observer' || edge.to === 'observer');

        if (edge.broken) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.setLineDash([8, 16]);
          ctx.globalAlpha = 0.3;
        } else if (edge.animated) {
          ctx.strokeStyle = isProtectedEdge ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.7)';
          ctx.setLineDash([15, 8]);
          ctx.lineDashOffset = -time * 0.8;
          ctx.globalAlpha = 1;
        } else {
          ctx.strokeStyle = isProtectedEdge ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.4)';
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.5;
        }

        ctx.lineWidth = 2 * scale;
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        ctx.stroke();

        // Draw X on broken edges
        if (edge.broken) {
          const midX = (fromNode.x + toNode.x) / 2;
          const midY = (fromNode.y + toNode.y) / 2;

          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 2 * scale;
          ctx.setLineDash([]);

          ctx.beginPath();
          ctx.arc(midX, midY, 16 * scale, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.fill();
          ctx.stroke();

          // X mark
          const xSize = 6 * scale;
          ctx.beginPath();
          ctx.moveTo(midX - xSize, midY - xSize);
          ctx.lineTo(midX + xSize, midY + xSize);
          ctx.moveTo(midX + xSize, midY - xSize);
          ctx.lineTo(midX - xSize, midY + xSize);
          ctx.stroke();
        }

        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      });

      // Draw nodes
      const nodeRadius = 35 * scale;
      const iconSize = 16 * scale;

      nodes.forEach((node) => {
        if (!node.visible) return;

        // Glow
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, nodeRadius * 2);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Node circle
        let bgOpacity = 0.08;
        let borderOpacity = 0.4;

        if (node.type === 'sender') {
          bgOpacity = 0.12;
          borderOpacity = 0.6;
        } else if (node.type === 'recipient') {
          bgOpacity = phase >= 4 && privacyLevel !== 'PUBLIC' ? 0.2 : 0.1;
          borderOpacity = phase >= 4 && privacyLevel !== 'PUBLIC' ? 0.9 : 0.5;
        } else if (node.type === 'observer') {
          bgOpacity = phase >= 3 && privacyLevel !== 'PUBLIC' ? 0.03 : 0.08;
          borderOpacity = phase >= 3 && privacyLevel !== 'PUBLIC' ? 0.15 : 0.4;
        } else if (node.type === 'zk' || node.type === 'pool') {
          bgOpacity = 0.15;
          borderOpacity = 0.7;
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${bgOpacity})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 255, 255, ${borderOpacity})`;
        ctx.lineWidth = 2 * scale;
        ctx.stroke();

        // Draw icon
        ctx.strokeStyle = `rgba(255, 255, 255, ${borderOpacity + 0.3})`;
        ctx.lineWidth = 2 * scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const x = node.x;
        const y = node.y;
        const s = iconSize;

        if (node.type === 'sender') {
          ctx.beginPath();
          ctx.roundRect(x - s, y - s * 0.7, s * 2, s * 1.4, 3);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x + s * 0.5, y, s * 0.25, 0, Math.PI * 2);
          ctx.stroke();
        } else if (node.type === 'recipient') {
          ctx.beginPath();
          ctx.arc(x, y, s, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, s * 0.15, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${borderOpacity + 0.3})`;
          ctx.fill();
        } else if (node.type === 'pool') {
          ctx.beginPath();
          ctx.moveTo(x, y - s);
          ctx.lineTo(x + s, y - s * 0.4);
          ctx.lineTo(x + s, y + s * 0.3);
          ctx.quadraticCurveTo(x + s, y + s, x, y + s);
          ctx.quadraticCurveTo(x - s, y + s, x - s, y + s * 0.3);
          ctx.lineTo(x - s, y - s * 0.4);
          ctx.closePath();
          ctx.stroke();
        } else if (node.type === 'zk') {
          ctx.beginPath();
          ctx.roundRect(x - s * 0.8, y - s * 0.2, s * 1.6, s * 1.2, 3);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y - s * 0.5, s * 0.5, Math.PI, 0);
          ctx.stroke();
        } else if (node.type === 'observer') {
          ctx.beginPath();
          ctx.moveTo(x - s, y);
          ctx.quadraticCurveTo(x, y - s * 0.8, x + s, y);
          ctx.quadraticCurveTo(x, y + s * 0.8, x - s, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, s * 0.35, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = `${14 * scale}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label, node.x, node.y + nodeRadius + 20 * scale);
      });

      time++;
      animationFrame = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationFrame);
  }, [width, height, getNodes, getEdges, phase, privacyLevel, scale]);

  const getStatusMessage = () => {
    if (privacyLevel === 'PUBLIC') {
      if (phase >= 2) return 'Your wallet is EXPOSED';
      return 'Processing transaction...';
    }

    if (privacyLevel === 'SEMI') {
      if (phase >= 4) return 'Your identity is PROTECTED';
      if (phase >= 3) return 'Which deposit matches which withdrawal? IMPOSSIBLE TO TELL';
      if (phase >= 2) return 'Funds mixed with other users...';
      if (phase >= 1) return 'Depositing to Privacy Pool...';
      return 'Initiating...';
    }

    if (privacyLevel === 'ZK_COMPRESSED') {
      if (phase >= 4) return 'Sender UNTRACEABLE';
      if (phase >= 3) return 'ZK Proof verified - link BROKEN';
      if (phase >= 2) return 'Observer attempting to trace...';
      if (phase >= 1) return 'Compressing into Merkle tree...';
      return 'Creating ZK proof...';
    }

    // PRIVATE (ShadowWire)
    if (phase >= 4) return 'Amount AND identity HIDDEN';
    if (phase >= 3) return 'Bulletproof verified - UNTRACEABLE';
    if (phase >= 2) return 'Observer attempting to trace...';
    if (phase >= 1) return 'Generating Bulletproof...';
    return 'Initiating...';
  };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Semi-transparent overlay to let mesh show through */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />

      {/* Canvas - full screen */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute inset-0"
      />

      {/* Status overlay */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${showSuccess ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {/* Phase dots */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {[0, 1, 2, 3, 4].map((p) => (
            <div
              key={p}
              className={`w-2 h-2 rounded-full transition-all duration-500 ${
                phase >= p ? 'bg-white scale-125' : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Status message at bottom */}
        <div className="absolute bottom-12 left-0 right-0 text-center">
          <p className={`text-xl font-medium transition-all duration-300 ${
            phase >= 4 && privacyLevel !== 'PUBLIC' ? 'text-white' :
            phase >= 2 && privacyLevel === 'PUBLIC' ? 'text-white/50' : 'text-white/70'
          }`}>
            {getStatusMessage()}
          </p>
        </div>
      </div>

      {/* Success overlay */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md transition-opacity duration-500 ${showSuccess ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="text-center max-w-md px-6">
          {/* Success icon */}
          <div className="w-20 h-20 mx-auto mb-6 bg-white/[0.08] border border-white/[0.15] rounded-full flex items-center justify-center">
            {privacyLevel !== 'PUBLIC' ? (
              <Shield className="w-10 h-10 text-white" />
            ) : (
              <CheckCircle className="w-10 h-10 text-white/60" />
            )}
          </div>

          <h2 className="text-2xl font-semibold text-white mb-2">
            {privacyLevel === 'SEMI' ? 'ShadowMix Complete' :
             privacyLevel === 'ZK_COMPRESSED' ? 'ZK Private Donation Complete' :
             privacyLevel === 'PRIVATE' ? 'ShadowWire Transfer Complete' :
             'Transfer Complete'}
          </h2>

          <p className="text-white/50 mb-4">
            {amount} SOL {privacyLevel === 'SEMI' ? 'deposited to mixer' : campaignTitle ? `donated to ${campaignTitle}` : 'sent successfully'}
          </p>

          {privacyLevel !== 'PUBLIC' && (
            <div className="mb-8 p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl">
              <p className="text-white/70 text-sm">
                {privacyLevel === 'ZK_COMPRESSED'
                  ? <>Your donation was <strong className="text-white">compressed into a ZK proof</strong>. Your wallet address is not linked to this campaign on-chain.</>
                  : privacyLevel === 'SEMI'
                  ? <>Funds deposited to the mixer. Withdraw to a <strong className="text-white">new stealth wallet</strong> to complete the privacy transfer.</>
                  : <>Bulletproofs ZK hides both your <strong className="text-white">identity AND amount</strong>. Maximum privacy achieved.</>}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <a
              href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-white/[0.05] border border-white/[0.1] text-white font-medium rounded-xl hover:bg-white/[0.08] transition-all flex items-center justify-center gap-2"
            >
              View Transaction
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onComplete}
              className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline embedded version for success screens
export function InlinePrivacyGraph({
  privacyLevel,
  autoPlay = true,
  compact = false
}: {
  privacyLevel: PrivacyLevel;
  autoPlay?: boolean;
  compact?: boolean;
}) {
  const [phase, setPhase] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const width = compact ? 400 : 500;
  const height = compact ? 200 : 280;
  const scale = compact ? 0.65 : 0.8;

  // Define nodes based on privacy level
  const getNodes = (): Node[] => {
    const centerX = width / 2;
    const centerY = height / 2;

    const baseNodes: Node[] = [
      { id: 'sender', x: centerX - 150 * scale, y: centerY + 30, label: 'Your Wallet', type: 'sender', visible: true },
      { id: 'recipient', x: centerX + 150 * scale, y: centerY + 30, label: 'Recipient', type: 'recipient', visible: true },
      { id: 'observer', x: centerX, y: centerY - 80 * scale, label: 'Observer', type: 'observer', visible: phase >= 2 },
    ];

    if (privacyLevel === 'ZK_COMPRESSED') {
      baseNodes.push({
        id: 'zk',
        x: centerX,
        y: centerY + 30,
        label: 'ZK Proof',
        type: 'zk',
        visible: phase >= 1,
      });
    } else if (privacyLevel === 'SEMI' || privacyLevel === 'PRIVATE') {
      baseNodes.push({
        id: 'pool',
        x: centerX,
        y: centerY + 30,
        label: 'Privacy Pool',
        type: 'pool',
        visible: phase >= 1,
      });
    }

    return baseNodes;
  };

  // Define edges based on privacy level
  const getEdges = (): Edge[] => {
    if (privacyLevel === 'PUBLIC') {
      return [
        { from: 'sender', to: 'recipient', visible: true, broken: false, animated: phase >= 1 },
        { from: 'observer', to: 'sender', visible: phase >= 2, broken: false, animated: phase >= 2 },
        { from: 'observer', to: 'recipient', visible: phase >= 2, broken: false, animated: phase >= 2 },
      ];
    }

    if (privacyLevel === 'ZK_COMPRESSED') {
      return [
        { from: 'sender', to: 'zk', visible: phase >= 1, broken: false, animated: phase >= 1 },
        { from: 'zk', to: 'recipient', visible: phase >= 1, broken: phase >= 3, animated: phase >= 1 && phase < 3 },
        { from: 'observer', to: 'sender', visible: phase >= 2, broken: phase >= 3, animated: false },
        { from: 'observer', to: 'recipient', visible: phase >= 2, broken: phase >= 3, animated: false },
      ];
    }

    // SEMI or PRIVATE
    return [
      { from: 'sender', to: 'pool', visible: phase >= 1, broken: false, animated: phase >= 1 },
      { from: 'pool', to: 'recipient', visible: phase >= 1, broken: phase >= 3, animated: phase >= 1 && phase < 3 },
      { from: 'observer', to: 'sender', visible: phase >= 2, broken: phase >= 3, animated: false },
      { from: 'observer', to: 'recipient', visible: phase >= 2, broken: phase >= 3, animated: false },
    ];
  };

  // Animation phases
  useEffect(() => {
    if (!isPlaying) return;

    setPhase(0);
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 3500),
    ];

    return () => timers.forEach(clearTimeout);
  }, [isPlaying]);

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes = getNodes();
    const edges = getEdges();
    let animationFrame: number;
    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw edges
      edges.forEach((edge) => {
        if (!edge.visible) return;

        const fromNode = nodes.find((n) => n.id === edge.from);
        const toNode = nodes.find((n) => n.id === edge.to);
        if (!fromNode || !toNode) return;

        ctx.beginPath();

        const isProtectedEdge = privacyLevel !== 'PUBLIC' && (edge.from === 'observer' || edge.to === 'observer');
        const isMainPath = !isProtectedEdge;

        if (edge.broken) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.setLineDash([5, 10]);
          ctx.globalAlpha = 0.3;
        } else if (edge.animated) {
          ctx.strokeStyle = isMainPath ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.4)';
          ctx.setLineDash([10, 5]);
          ctx.lineDashOffset = -time * 0.5;
          ctx.globalAlpha = 1;
        } else {
          ctx.strokeStyle = isProtectedEdge ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.5)';
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.6;
        }

        ctx.lineWidth = 2;
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        ctx.stroke();

        // Draw shield icon on broken edges
        if (edge.broken) {
          const midX = (fromNode.x + toNode.x) / 2;
          const midY = (fromNode.y + toNode.y) / 2;

          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 2;
          ctx.setLineDash([]);

          ctx.beginPath();
          ctx.arc(midX, midY, 12, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.fill();
          ctx.stroke();

          // X mark
          ctx.beginPath();
          ctx.moveTo(midX - 5, midY - 5);
          ctx.lineTo(midX + 5, midY + 5);
          ctx.moveTo(midX + 5, midY - 5);
          ctx.lineTo(midX - 5, midY + 5);
          ctx.stroke();
        }

        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      });

      // Draw nodes
      nodes.forEach((node) => {
        if (!node.visible) return;

        const nodeRadius = compact ? 20 : 25;
        const glowRadius = compact ? 32 : 40;
        const iconSize = compact ? 10 : 12;

        // Glow effect
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);

        let bgOpacity = 0.1;
        let borderOpacity = 0.4;

        if (node.type === 'sender') {
          bgOpacity = 0.15;
          borderOpacity = 0.6;
        } else if (node.type === 'recipient') {
          bgOpacity = phase >= 4 && privacyLevel !== 'PUBLIC' ? 0.2 : 0.12;
          borderOpacity = phase >= 4 && privacyLevel !== 'PUBLIC' ? 0.8 : 0.5;
        } else if (node.type === 'observer') {
          bgOpacity = phase >= 3 && privacyLevel !== 'PUBLIC' ? 0.05 : 0.1;
          borderOpacity = phase >= 3 && privacyLevel !== 'PUBLIC' ? 0.2 : 0.4;
        } else if (node.type === 'zk' || node.type === 'pool') {
          bgOpacity = 0.2;
          borderOpacity = 0.7;
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${bgOpacity})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 255, 255, ${borderOpacity})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Lucide-style icons
        ctx.strokeStyle = `rgba(255, 255, 255, ${borderOpacity + 0.3})`;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const x = node.x;
        const y = node.y;
        const s = iconSize;

        if (node.type === 'sender') {
          // Wallet icon
          ctx.beginPath();
          ctx.roundRect(x - s, y - s * 0.7, s * 2, s * 1.4, 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x + s * 0.5, y, s * 0.25, 0, Math.PI * 2);
          ctx.stroke();
        } else if (node.type === 'recipient') {
          // Target/circle icon
          ctx.beginPath();
          ctx.arc(x, y, s, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, s * 0.15, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${borderOpacity + 0.3})`;
          ctx.fill();
        } else if (node.type === 'pool') {
          // Shield icon
          ctx.beginPath();
          ctx.moveTo(x, y - s);
          ctx.lineTo(x + s, y - s * 0.4);
          ctx.lineTo(x + s, y + s * 0.3);
          ctx.quadraticCurveTo(x + s, y + s, x, y + s);
          ctx.quadraticCurveTo(x - s, y + s, x - s, y + s * 0.3);
          ctx.lineTo(x - s, y - s * 0.4);
          ctx.closePath();
          ctx.stroke();
        } else if (node.type === 'zk') {
          // Lock icon
          ctx.beginPath();
          ctx.roundRect(x - s * 0.8, y - s * 0.2, s * 1.6, s * 1.2, 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y - s * 0.5, s * 0.5, Math.PI, 0);
          ctx.stroke();
        } else if (node.type === 'observer') {
          // Eye icon
          ctx.beginPath();
          ctx.moveTo(x - s, y);
          ctx.quadraticCurveTo(x, y - s * 0.8, x + s, y);
          ctx.quadraticCurveTo(x, y + s * 0.8, x - s, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, s * 0.35, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = `${compact ? 10 : 12}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label, node.x, node.y + (compact ? 35 : 45));
      });

      time++;
      animationFrame = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationFrame);
  }, [phase, privacyLevel, width, height, scale, compact]);

  const getStatusMessage = () => {
    if (privacyLevel === 'PUBLIC') {
      if (phase >= 2) return { text: 'Your wallet is EXPOSED', protected: false };
      return { text: 'Transaction visible...', protected: false };
    }

    if (phase >= 4) return { text: 'Your identity is PROTECTED', protected: true };
    if (phase >= 3) return { text: 'Connection BROKEN!', protected: true };
    if (phase >= 2) return { text: 'Observer trying to trace...', protected: null };
    if (phase >= 1) {
      return {
        text: privacyLevel === 'ZK_COMPRESSED' ? 'Creating ZK Proof...' : 'Routing through pool...',
        protected: null
      };
    }
    return { text: 'Initiating...', protected: null };
  };

  const status = getStatusMessage();

  const resetAnimation = () => {
    setPhase(0);
    setIsPlaying(true);
  };

  return (
    <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-[#0a0a0a]">
      {/* Canvas */}
      <div className="relative bg-gradient-to-b from-white/[0.02] to-transparent">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full"
        />

        {/* Phase indicator dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {[0, 1, 2, 3, 4].map((p) => (
            <div
              key={p}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                phase >= p ? 'bg-white scale-110' : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div className={`px-4 py-3 border-t border-white/[0.06] flex items-center justify-between ${
        status.protected === true ? 'bg-white/[0.03]' :
        status.protected === false ? 'bg-white/[0.01]' :
        'bg-transparent'
      }`}>
        <div className="flex items-center gap-2">
          {status.protected === true && <Shield className="w-4 h-4 text-white" />}
          {status.protected === false && <Eye className="w-4 h-4 text-white/50" />}
          <span className={`text-sm font-medium ${
            status.protected === true ? 'text-white' :
            status.protected === false ? 'text-white/50' :
            'text-white/60'
          }`}>
            {status.text}
          </span>
        </div>

        <button
          onClick={resetAnimation}
          className="p-1.5 rounded-lg hover:bg-white/[0.05] text-white/40 hover:text-white transition-all"
          title="Replay"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Full modal version
export function PrivacyGraphAnimation({ privacyLevel, onClose, autoPlay = true }: PrivacyGraphAnimationProps) {
  const [phase, setPhase] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Define nodes based on privacy level
  const getNodes = (): Node[] => {
    const baseNodes: Node[] = [
      { id: 'sender', x: 100, y: 200, label: 'Your Wallet', type: 'sender', visible: true },
      { id: 'recipient', x: 500, y: 200, label: 'Recipient', type: 'recipient', visible: true },
      { id: 'observer', x: 300, y: 50, label: 'Observer', type: 'observer', visible: phase >= 2 },
    ];

    if (privacyLevel === 'ZK_COMPRESSED') {
      baseNodes.push({
        id: 'zk',
        x: 300,
        y: 200,
        label: 'ZK Proof',
        type: 'zk',
        visible: phase >= 1,
      });
    } else if (privacyLevel === 'SEMI' || privacyLevel === 'PRIVATE') {
      baseNodes.push({
        id: 'pool',
        x: 300,
        y: 200,
        label: 'Privacy Pool',
        type: 'pool',
        visible: phase >= 1,
      });
    }

    return baseNodes;
  };

  // Define edges based on privacy level
  const getEdges = (): Edge[] => {
    if (privacyLevel === 'PUBLIC') {
      return [
        { from: 'sender', to: 'recipient', visible: true, broken: false, animated: phase >= 1 },
        { from: 'observer', to: 'sender', visible: phase >= 2, broken: false, animated: phase >= 2 },
        { from: 'observer', to: 'recipient', visible: phase >= 2, broken: false, animated: phase >= 2 },
      ];
    }

    if (privacyLevel === 'ZK_COMPRESSED') {
      return [
        { from: 'sender', to: 'zk', visible: phase >= 1, broken: false, animated: phase >= 1 },
        { from: 'zk', to: 'recipient', visible: phase >= 1, broken: phase >= 3, animated: phase >= 1 && phase < 3 },
        { from: 'observer', to: 'sender', visible: phase >= 2, broken: phase >= 3, animated: false },
        { from: 'observer', to: 'recipient', visible: phase >= 2, broken: phase >= 3, animated: false },
      ];
    }

    // SEMI or PRIVATE
    return [
      { from: 'sender', to: 'pool', visible: phase >= 1, broken: false, animated: phase >= 1 },
      { from: 'pool', to: 'recipient', visible: phase >= 1, broken: phase >= 3, animated: phase >= 1 && phase < 3 },
      { from: 'observer', to: 'sender', visible: phase >= 2, broken: phase >= 3, animated: false },
      { from: 'observer', to: 'recipient', visible: phase >= 2, broken: phase >= 3, animated: false },
    ];
  };

  // Animation phases
  useEffect(() => {
    if (!isPlaying) return;

    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 3500),
      setTimeout(() => setPhase(4), 5000),
    ];

    return () => timers.forEach(clearTimeout);
  }, [isPlaying]);

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes = getNodes();
    const edges = getEdges();
    let animationFrame: number;
    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw edges
      edges.forEach((edge) => {
        if (!edge.visible) return;

        const fromNode = nodes.find((n) => n.id === edge.from);
        const toNode = nodes.find((n) => n.id === edge.to);
        if (!fromNode || !toNode) return;

        ctx.beginPath();
        ctx.lineWidth = 2;

        if (edge.broken) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.setLineDash([5, 10]);
          ctx.globalAlpha = 0.3;
        } else if (edge.animated) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.setLineDash([10, 5]);
          ctx.lineDashOffset = -time * 0.5;
          ctx.globalAlpha = 1;
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.6;
        }

        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        ctx.stroke();

        // Draw shield on broken edges
        if (edge.broken) {
          const midX = (fromNode.x + toNode.x) / 2;
          const midY = (fromNode.y + toNode.y) / 2;

          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 2;
          ctx.setLineDash([]);

          ctx.beginPath();
          ctx.arc(midX, midY, 15, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.fill();
          ctx.stroke();
        }

        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      });

      // Draw nodes
      nodes.forEach((node) => {
        if (!node.visible) return;

        const nodeRadius = 25;
        const glowRadius = 40;
        const iconSize = 12;

        // Glow effect
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Lucide-style icons
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const x = node.x;
        const y = node.y;
        const s = iconSize;

        if (node.type === 'sender') {
          // Wallet icon
          ctx.beginPath();
          ctx.roundRect(x - s, y - s * 0.7, s * 2, s * 1.4, 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x + s * 0.5, y, s * 0.25, 0, Math.PI * 2);
          ctx.stroke();
        } else if (node.type === 'recipient') {
          // Target/circle icon
          ctx.beginPath();
          ctx.arc(x, y, s, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, s * 0.15, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.fill();
        } else if (node.type === 'pool') {
          // Shield icon
          ctx.beginPath();
          ctx.moveTo(x, y - s);
          ctx.lineTo(x + s, y - s * 0.4);
          ctx.lineTo(x + s, y + s * 0.3);
          ctx.quadraticCurveTo(x + s, y + s, x, y + s);
          ctx.quadraticCurveTo(x - s, y + s, x - s, y + s * 0.3);
          ctx.lineTo(x - s, y - s * 0.4);
          ctx.closePath();
          ctx.stroke();
        } else if (node.type === 'zk') {
          // Lock icon
          ctx.beginPath();
          ctx.roundRect(x - s * 0.8, y - s * 0.2, s * 1.6, s * 1.2, 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y - s * 0.5, s * 0.5, Math.PI, 0);
          ctx.stroke();
        } else if (node.type === 'observer') {
          // Eye icon
          ctx.beginPath();
          ctx.moveTo(x - s, y);
          ctx.quadraticCurveTo(x, y - s * 0.8, x + s, y);
          ctx.quadraticCurveTo(x, y + s * 0.8, x - s, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, s * 0.35, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label, node.x, node.y + 45);
      });

      time++;
      animationFrame = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationFrame);
  }, [phase, privacyLevel]);

  const getPhaseMessage = () => {
    if (privacyLevel === 'PUBLIC') {
      switch (phase) {
        case 0: return 'Transaction initiated...';
        case 1: return 'Direct transfer on blockchain';
        case 2: return 'Observer can see EVERYTHING';
        case 3:
        case 4: return 'Your wallet is FULLY EXPOSED';
        default: return '';
      }
    }

    switch (phase) {
      case 0: return 'Transaction initiated...';
      case 1: return privacyLevel === 'ZK_COMPRESSED' ? 'Creating ZK Proof...' : 'Routing through privacy pool...';
      case 2: return 'Observer trying to trace...';
      case 3: return 'CONNECTION BROKEN!';
      case 4: return 'Your identity is PROTECTED';
      default: return '';
    }
  };

  const resetAnimation = () => {
    setPhase(0);
    setIsPlaying(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#0f0f0f] to-[#0a0a0a] border border-white/[0.08] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/[0.05]">
              {privacyLevel === 'PUBLIC' ? (
                <Eye className="w-5 h-5 text-white/60" />
              ) : privacyLevel === 'ZK_COMPRESSED' ? (
                <Lock className="w-5 h-5 text-white" />
              ) : (
                <Shield className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-white">Privacy Graph Visualization</h3>
              <p className="text-xs text-white/40">
                {privacyLevel === 'PUBLIC'
                  ? 'PUBLIC - Fully Traceable'
                  : privacyLevel === 'ZK_COMPRESSED'
                  ? 'ZK COMPRESSED - Untraceable'
                  : privacyLevel === 'SEMI'
                  ? 'SEMI PRIVATE - Pool Mixed'
                  : 'PRIVATE - Hidden'}
              </p>
            </div>
          </div>

          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
              <X className="w-5 h-5 text-white/40" />
            </button>
          )}
        </div>

        {/* Canvas */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={600}
            height={350}
            className="w-full"
            style={{ background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.02) 0%, transparent 70%)' }}
          />

          {/* Phase indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {[0, 1, 2, 3, 4].map((p) => (
              <div
                key={p}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  phase >= p ? 'bg-white scale-110' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Status message */}
        <div className={`p-4 text-center border-t border-white/[0.06] ${
          phase >= 3 && privacyLevel !== 'PUBLIC' ? 'bg-white/[0.03]' : 'bg-white/[0.01]'
        }`}>
          <p className={`text-lg font-medium ${
            phase >= 3 && privacyLevel !== 'PUBLIC' ? 'text-white' :
            phase >= 2 && privacyLevel === 'PUBLIC' ? 'text-white/50' : 'text-white/60'
          }`}>
            {getPhaseMessage()}
          </p>

          {phase >= 4 && (
            <p className="text-sm text-white/40 mt-2">
              {privacyLevel === 'PUBLIC'
                ? 'Anyone with your wallet address can see this transaction and its destination.'
                : privacyLevel === 'ZK_COMPRESSED'
                ? 'The ZK proof verifies the transfer without revealing sender, recipient, or amount.'
                : 'The privacy pool breaks the direct link between your wallet and the recipient.'}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-white/[0.06] flex gap-3">
          <button
            onClick={resetAnimation}
            className="flex-1 py-3 bg-white/[0.05] hover:bg-white/[0.08] text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Replay
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// Button trigger
export function PrivacyGraphButton({
  privacyLevel,
  className = '',
}: {
  privacyLevel: PrivacyLevel;
  className?: string;
}) {
  const [showGraph, setShowGraph] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowGraph(true)}
        className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-white/50 hover:text-white/80 transition-all ${className}`}
      >
        <div className="w-3 h-3 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-current" />
          </div>
          <div className="absolute top-0 right-0 w-1 h-1 rounded-full bg-current" />
          <div className="absolute bottom-0 left-0 w-1 h-1 rounded-full bg-current" />
        </div>
        View Graph
      </button>

      {showGraph && (
        <PrivacyGraphAnimation privacyLevel={privacyLevel} onClose={() => setShowGraph(false)} />
      )}
    </>
  );
}
