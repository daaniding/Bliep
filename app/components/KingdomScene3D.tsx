'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { getTimeOfDay, type TimeOfDay } from '@/lib/timeOfDay';

// === Color palette — vibrant cartoony Brawl Stars-ish ===
const COLORS = {
  groundDay: '#7ec050',
  groundNight: '#243a1c',
  pathDay: '#c8a060',
  pathNight: '#3a2a18',
  stoneDay: '#c8c0b0',
  stoneNight: '#3e3a32',
  roofDay: '#d04830',
  roofNight: '#5a1a10',
  woodDay: '#9b6838',
  woodNight: '#3a2410',
  flagDay: '#e02828',
  flagNight: '#7a1010',
  waterDay: '#3aa6e0',
  waterNight: '#0e2a4a',
};

function lerpColor(a: string, b: string, t: number): THREE.Color {
  return new THREE.Color(a).lerp(new THREE.Color(b), t);
}

// === Castle (procedural — chunky cartoon style) ===
function CastleDiorama({ tod }: { tod: TimeOfDay }) {
  const stoneColor = useMemo(
    () => lerpColor(COLORS.stoneDay, COLORS.stoneNight, tod.darkness),
    [tod.darkness],
  );
  const roofColor = useMemo(
    () => lerpColor(COLORS.roofDay, COLORS.roofNight, tod.darkness),
    [tod.darkness],
  );
  const woodColor = useMemo(
    () => lerpColor(COLORS.woodDay, COLORS.woodNight, tod.darkness),
    [tod.darkness],
  );
  const flagColor = useMemo(
    () => lerpColor(COLORS.flagDay, COLORS.flagNight, tod.darkness),
    [tod.darkness],
  );

  // Wave the central flag + 2 tower pennants
  const flagRefs = [
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
  ];
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    flagRefs.forEach((r, i) => {
      if (r.current) {
        r.current.rotation.z = Math.sin(t * 2.5 + i * 0.7) * 0.2;
        r.current.scale.x = 1 + Math.sin(t * 2.5 + i * 0.7) * 0.05;
      }
    });
  });

  // Window glow color (warm at night)
  const windowGlowColor = tod.torchesLit ? '#ffaa30' : '#ffd060';
  const windowGlowEmissive = tod.torchesLit ? 1.0 : 0.3;

  return (
    <group position={[0, 0, -2]}>
      {/* === Main keep (central cylinder) === */}
      <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.95, 1.1, 3.2, 16]} />
        <meshStandardMaterial color={stoneColor} roughness={0.85} />
      </mesh>
      {/* Battlements ring on top of main keep */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.95, 3.3, Math.sin(angle) * 0.95]}
            castShadow
          >
            <boxGeometry args={[0.18, 0.22, 0.18]} />
            <meshStandardMaterial color={stoneColor} roughness={0.85} />
          </mesh>
        );
      })}
      {/* Cone roof above battlements */}
      <mesh position={[0, 3.85, 0]} castShadow>
        <coneGeometry args={[1.0, 1.3, 16]} />
        <meshStandardMaterial color={roofColor} roughness={0.55} />
      </mesh>

      {/* Glowing keep windows (4 around the cylinder at mid height) */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
        <mesh
          key={i}
          position={[Math.cos(angle) * 0.96, 2.0, Math.sin(angle) * 0.96]}
          rotation={[0, angle, 0]}
        >
          <planeGeometry args={[0.18, 0.32]} />
          <meshStandardMaterial
            color={windowGlowColor}
            emissive={windowGlowColor}
            emissiveIntensity={windowGlowEmissive}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Flag pole + waving flag */}
      <mesh position={[0, 4.85, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.0, 6]} />
        <meshStandardMaterial color="#1a0f05" />
      </mesh>
      <mesh ref={flagRefs[0]} position={[0.32, 5.1, 0]}>
        <planeGeometry args={[0.55, 0.32]} />
        <meshStandardMaterial color={flagColor} side={THREE.DoubleSide} />
      </mesh>

      {/* === Two side towers === */}
      {[
        { x: -2.2, h: 2.6, idx: 1 },
        { x: 2.2, h: 2.6, idx: 2 },
      ].map((t) => (
        <group key={t.idx} position={[t.x, 0, 0.4]}>
          <mesh position={[0, t.h / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.65, 0.78, t.h, 12]} />
            <meshStandardMaterial color={stoneColor} roughness={0.85} />
          </mesh>
          {/* Battlements on each tower */}
          {Array.from({ length: 8 }).map((_, i) => {
            const ang = (i / 8) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[Math.cos(ang) * 0.65, t.h + 0.05, Math.sin(ang) * 0.65]}
                castShadow
              >
                <boxGeometry args={[0.14, 0.18, 0.14]} />
                <meshStandardMaterial color={stoneColor} roughness={0.85} />
              </mesh>
            );
          })}
          <mesh position={[0, t.h + 0.55, 0]} castShadow>
            <coneGeometry args={[0.78, 1.0, 12]} />
            <meshStandardMaterial color={roofColor} roughness={0.55} />
          </mesh>
          {/* Tower pennant */}
          <mesh position={[0, t.h + 1.15, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.55, 6]} />
            <meshStandardMaterial color="#1a0f05" />
          </mesh>
          <mesh ref={flagRefs[t.idx]} position={[0.18, t.h + 1.35, 0]}>
            <planeGeometry args={[0.32, 0.18]} />
            <meshStandardMaterial color={flagColor} side={THREE.DoubleSide} />
          </mesh>
          {/* Glowing tower window */}
          <mesh position={[0, 1.5, 0.66]}>
            <planeGeometry args={[0.18, 0.28]} />
            <meshStandardMaterial
              color={windowGlowColor}
              emissive={windowGlowColor}
              emissiveIntensity={windowGlowEmissive}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}

      {/* === Connecting walls with battlements === */}
      {[
        { x: -1.1, w: 1.3 },
        { x: 1.1, w: 1.3 },
      ].map((w, i) => (
        <group key={i} position={[w.x, 0, 0.4]}>
          <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
            <boxGeometry args={[w.w, 1.4, 0.5]} />
            <meshStandardMaterial color={stoneColor} roughness={0.9} />
          </mesh>
          {/* Wall battlements */}
          {[-0.5, -0.2, 0.1, 0.4].map((bx, bi) => (
            <mesh key={bi} position={[bx + (i === 0 ? 0 : 0), 1.5, 0]} castShadow>
              <boxGeometry args={[0.18, 0.22, 0.5]} />
              <meshStandardMaterial color={stoneColor} roughness={0.85} />
            </mesh>
          ))}
        </group>
      ))}

      {/* === Wooden gate with iron bands === */}
      <group position={[0, 0.75, 1.1]}>
        <mesh castShadow>
          <boxGeometry args={[1.05, 1.5, 0.15]} />
          <meshStandardMaterial color={woodColor} roughness={0.75} />
        </mesh>
        {/* Iron band horizontal */}
        <mesh position={[0, 0.3, 0.08]}>
          <boxGeometry args={[1.05, 0.06, 0.02]} />
          <meshStandardMaterial color="#2a2a32" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.3, 0.08]}>
          <boxGeometry args={[1.05, 0.06, 0.02]} />
          <meshStandardMaterial color="#2a2a32" metalness={0.7} roughness={0.4} />
        </mesh>
        {/* Door handle */}
        <mesh position={[0.3, 0, 0.085]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#fdd069" metalness={0.85} roughness={0.3} />
        </mesh>
      </group>

      {/* === Village houses on the flanks (3 each side) === */}
      {[
        { x: -4.0, z: 1.0, rot: 0.4, scale: 1.0 },
        { x: -3.4, z: 2.6, rot: 0.1, scale: 0.85 },
        { x: -4.4, z: 3.0, rot: -0.2, scale: 0.9 },
        { x: 4.0, z: 1.0, rot: -0.4, scale: 1.0 },
        { x: 3.4, z: 2.6, rot: -0.1, scale: 0.85 },
        { x: 4.4, z: 3.0, rot: 0.2, scale: 0.9 },
      ].map((h, i) => (
        <group key={i} position={[h.x, 0, h.z]} rotation={[0, h.rot, 0]} scale={h.scale}>
          <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.8, 1.0]} />
            <meshStandardMaterial color={woodColor} roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.0, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[0.92, 0.7, 4]} />
            <meshStandardMaterial color={roofColor} roughness={0.65} />
          </mesh>
          {/* Glowing house window */}
          <mesh position={[0, 0.45, 0.51]}>
            <planeGeometry args={[0.22, 0.2]} />
            <meshStandardMaterial
              color={windowGlowColor}
              emissive={windowGlowColor}
              emissiveIntensity={windowGlowEmissive * 0.8}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Door */}
          <mesh position={[0, 0.25, 0.51]}>
            <planeGeometry args={[0.22, 0.42]} />
            <meshStandardMaterial color="#3a1f08" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* === A few tree props === */}
      {[
        { x: -5.0, z: -1.0 },
        { x: 5.0, z: -1.0 },
        { x: -5.5, z: 0.5 },
        { x: 5.5, z: 0.5 },
      ].map((tree, i) => (
        <group key={i} position={[tree.x, 0, tree.z]}>
          <mesh position={[0, 0.4, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.12, 0.8, 6]} />
            <meshStandardMaterial color="#5a3214" roughness={0.95} />
          </mesh>
          <mesh position={[0, 1.0, 0]} castShadow>
            <coneGeometry args={[0.5, 1.0, 8]} />
            <meshStandardMaterial color={lerpColor('#3d8a3d', '#1a3a1a', tod.darkness)} roughness={0.85} />
          </mesh>
          <mesh position={[0, 1.55, 0]} castShadow>
            <coneGeometry args={[0.38, 0.7, 8]} />
            <meshStandardMaterial color={lerpColor('#4d9a4d', '#234423', tod.darkness)} roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// === Hero knight — fully procedural chunky character built from
// primitives. No GLB, no skinned mesh, no animation mixer headaches.
// Idle animation: gentle vertical bob + slight body sway + sword
// glint highlight. Always works. ===
interface KnightHeroProps {
  position: [number, number, number];
  rotation?: number;
  scale?: number;
}
function KnightHero({ position, rotation = 0, scale = 1 }: KnightHeroProps) {
  const bodyRef = useRef<THREE.Group>(null);
  const swordRef = useRef<THREE.Group>(null);
  const plumeRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (bodyRef.current) {
      bodyRef.current.position.y = Math.sin(t * 1.5) * 0.04;
      bodyRef.current.rotation.z = Math.sin(t * 1.2) * 0.02;
    }
    if (swordRef.current) {
      swordRef.current.rotation.x = Math.sin(t * 0.8) * 0.06;
    }
    if (plumeRef.current) {
      plumeRef.current.rotation.z = Math.sin(t * 2.5) * 0.12;
    }
  });

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <group ref={bodyRef}>
        {/* Legs — chunky armoured */}
        <mesh position={[-0.16, 0.3, 0]} castShadow>
          <boxGeometry args={[0.22, 0.55, 0.22]} />
          <meshStandardMaterial color="#9aa0a8" roughness={0.55} metalness={0.4} />
        </mesh>
        <mesh position={[0.16, 0.3, 0]} castShadow>
          <boxGeometry args={[0.22, 0.55, 0.22]} />
          <meshStandardMaterial color="#9aa0a8" roughness={0.55} metalness={0.4} />
        </mesh>

        {/* Belt with gold buckle */}
        <mesh position={[0, 0.62, 0]} castShadow>
          <boxGeometry args={[0.62, 0.1, 0.5]} />
          <meshStandardMaterial color="#5a3214" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.62, 0.27]} castShadow>
          <boxGeometry args={[0.16, 0.12, 0.05]} />
          <meshStandardMaterial color="#fdd069" metalness={0.85} roughness={0.3} />
        </mesh>

        {/* Torso — silver chest plate with red tabard */}
        <mesh position={[0, 1.0, 0]} castShadow>
          <boxGeometry args={[0.7, 0.7, 0.5]} />
          <meshStandardMaterial color="#c8d0d8" roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[0, 1.0, 0.26]} castShadow>
          <boxGeometry args={[0.4, 0.65, 0.04]} />
          <meshStandardMaterial color="#c0392b" roughness={0.6} />
        </mesh>
        {/* Gold trim across the chest */}
        <mesh position={[0, 1.32, 0.27]} castShadow>
          <boxGeometry args={[0.72, 0.06, 0.04]} />
          <meshStandardMaterial color="#fdd069" metalness={0.85} roughness={0.3} />
        </mesh>

        {/* Shoulders — round caps */}
        <mesh position={[-0.42, 1.25, 0]} castShadow>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial color="#c8d0d8" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0.42, 1.25, 0]} castShadow>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial color="#c8d0d8" metalness={0.6} roughness={0.4} />
        </mesh>

        {/* Arms */}
        <mesh position={[-0.45, 0.92, 0]} castShadow>
          <boxGeometry args={[0.18, 0.55, 0.22]} />
          <meshStandardMaterial color="#9aa0a8" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0.45, 0.92, 0]} castShadow>
          <boxGeometry args={[0.18, 0.55, 0.22]} />
          <meshStandardMaterial color="#9aa0a8" metalness={0.5} roughness={0.5} />
        </mesh>

        {/* Helmet with visor slit */}
        <mesh position={[0, 1.62, 0]} castShadow>
          <boxGeometry args={[0.42, 0.4, 0.4]} />
          <meshStandardMaterial color="#b0b8c0" metalness={0.7} roughness={0.35} />
        </mesh>
        {/* Visor slit (dark line) */}
        <mesh position={[0, 1.6, 0.21]}>
          <boxGeometry args={[0.32, 0.05, 0.005]} />
          <meshStandardMaterial color="#0d0a06" />
        </mesh>
        {/* Helmet trim gold band */}
        <mesh position={[0, 1.45, 0]}>
          <boxGeometry args={[0.44, 0.05, 0.42]} />
          <meshStandardMaterial color="#fdd069" metalness={0.85} roughness={0.3} />
        </mesh>

        {/* Red plume on top */}
        <mesh ref={plumeRef} position={[0, 1.95, -0.05]} castShadow>
          <coneGeometry args={[0.13, 0.5, 8]} />
          <meshStandardMaterial color="#c0392b" roughness={0.6} />
        </mesh>

        {/* Right arm holding the sword */}
        <group ref={swordRef} position={[0.55, 1.0, 0.15]} rotation={[-0.5, 0, 0.1]}>
          {/* Sword grip */}
          <mesh position={[0, -0.05, 0]} castShadow>
            <boxGeometry args={[0.08, 0.18, 0.08]} />
            <meshStandardMaterial color="#3a1f08" roughness={0.85} />
          </mesh>
          {/* Crossguard */}
          <mesh position={[0, 0.06, 0]} castShadow>
            <boxGeometry args={[0.32, 0.05, 0.06]} />
            <meshStandardMaterial color="#fdd069" metalness={0.9} roughness={0.25} />
          </mesh>
          {/* Blade */}
          <mesh position={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[0.07, 1.0, 0.025]} />
            <meshStandardMaterial color="#e0e6ec" metalness={0.95} roughness={0.15} />
          </mesh>
          {/* Pommel gem */}
          <mesh position={[0, -0.16, 0]} castShadow>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color="#c0392b" metalness={0.5} roughness={0.3} />
          </mesh>
        </group>

        {/* Left arm holding shield */}
        <group position={[-0.62, 0.95, 0.15]}>
          {/* Shield body — kite shape approximated by box */}
          <mesh castShadow>
            <boxGeometry args={[0.42, 0.55, 0.06]} />
            <meshStandardMaterial color="#fdd069" metalness={0.7} roughness={0.35} />
          </mesh>
          {/* Shield emblem — red cross */}
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[0.32, 0.08, 0.01]} />
            <meshStandardMaterial color="#c0392b" />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[0.08, 0.42, 0.01]} />
            <meshStandardMaterial color="#c0392b" />
          </mesh>
          {/* Shield border */}
          <mesh position={[0, 0, 0.035]}>
            <boxGeometry args={[0.46, 0.59, 0.005]} />
            <meshStandardMaterial color="#0d0a06" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// === Villager — a simple stylised character built from primitives,
// bobbing as it walks along a circular path. Doesn't need a skinned
// mesh which avoids the cloning/skeleton headache for animated GLBs. ===
function PatrollingVillager({
  radius,
  speed,
  startAngle,
  y = 0,
  scale = 1,
  bodyColor,
  hatColor,
}: {
  radius: number;
  speed: number;
  startAngle: number;
  y?: number;
  scale?: number;
  bodyColor: string;
  hatColor: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bobRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current || !bobRef.current) return;
    const t = state.clock.getElapsedTime() * speed + startAngle;
    groupRef.current.position.x = Math.cos(t) * radius;
    groupRef.current.position.z = Math.sin(t) * radius;
    groupRef.current.position.y = y;
    // Face direction of motion (tangent to the circle)
    groupRef.current.rotation.y = -t + Math.PI / 2 + Math.PI;
    // Walk bob — vertical sine + slight tilt
    const bob = state.clock.getElapsedTime() * speed * 6;
    bobRef.current.position.y = Math.abs(Math.sin(bob)) * 0.06;
    bobRef.current.rotation.z = Math.sin(bob) * 0.08;
  });

  return (
    <group ref={groupRef} scale={scale}>
      <group ref={bobRef}>
        {/* Legs (two boxes) */}
        <mesh position={[-0.08, 0.15, 0]} castShadow>
          <boxGeometry args={[0.13, 0.3, 0.13]} />
          <meshStandardMaterial color="#3a2410" />
        </mesh>
        <mesh position={[0.08, 0.15, 0]} castShadow>
          <boxGeometry args={[0.13, 0.3, 0.13]} />
          <meshStandardMaterial color="#3a2410" />
        </mesh>
        {/* Body (capsule-ish box) */}
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.36, 0.42, 0.28]} />
          <meshStandardMaterial color={bodyColor} roughness={0.85} />
        </mesh>
        {/* Arms */}
        <mesh position={[-0.21, 0.5, 0]} castShadow>
          <boxGeometry args={[0.08, 0.3, 0.12]} />
          <meshStandardMaterial color={bodyColor} roughness={0.85} />
        </mesh>
        <mesh position={[0.21, 0.5, 0]} castShadow>
          <boxGeometry args={[0.08, 0.3, 0.12]} />
          <meshStandardMaterial color={bodyColor} roughness={0.85} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 0.85, 0]} castShadow>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial color="#f4c896" roughness={0.7} />
        </mesh>
        {/* Hat */}
        <mesh position={[0, 1.0, 0]} castShadow>
          <coneGeometry args={[0.18, 0.22, 8]} />
          <meshStandardMaterial color={hatColor} roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

// === Trotting horse on its own oval path ===
// === Procedural horse — chunky 4-leg block animal that trots
// along an oval. Legs alternate up/down for a walk cycle. ===
function TrottingHorse() {
  const groupRef = useRef<THREE.Group>(null);
  const legRefs = [
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
  ];
  const bodyRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * 0.6;
    const a = 5.0;
    const b = 3.0;
    groupRef.current.position.x = Math.cos(t) * a;
    groupRef.current.position.z = Math.sin(t) * b + 1.0;
    groupRef.current.rotation.y = -t + Math.PI / 2;
    // Walk cycle — diagonal legs alternate
    const stride = state.clock.getElapsedTime() * 5;
    legRefs[0].current && (legRefs[0].current.position.y = 0.16 + Math.max(0, Math.sin(stride)) * 0.08);
    legRefs[3].current && (legRefs[3].current.position.y = 0.16 + Math.max(0, Math.sin(stride)) * 0.08);
    legRefs[1].current && (legRefs[1].current.position.y = 0.16 + Math.max(0, Math.sin(stride + Math.PI)) * 0.08);
    legRefs[2].current && (legRefs[2].current.position.y = 0.16 + Math.max(0, Math.sin(stride + Math.PI)) * 0.08);
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.42 + Math.abs(Math.sin(stride * 2)) * 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={bodyRef}>
        {/* Body */}
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.85, 0.28, 0.32]} />
          <meshStandardMaterial color="#7a3814" roughness={0.85} />
        </mesh>
        {/* Neck (tilted up) */}
        <mesh position={[0.4, 0.18, 0]} rotation={[0, 0, -0.5]} castShadow>
          <boxGeometry args={[0.32, 0.18, 0.22]} />
          <meshStandardMaterial color="#7a3814" roughness={0.85} />
        </mesh>
        {/* Head */}
        <mesh position={[0.62, 0.32, 0]} castShadow>
          <boxGeometry args={[0.24, 0.18, 0.18]} />
          <meshStandardMaterial color="#7a3814" roughness={0.85} />
        </mesh>
        {/* Mane */}
        <mesh position={[0.32, 0.28, 0]} castShadow>
          <boxGeometry args={[0.18, 0.12, 0.24]} />
          <meshStandardMaterial color="#3a1f08" roughness={0.95} />
        </mesh>
        {/* Tail */}
        <mesh position={[-0.46, 0.05, 0]} rotation={[0, 0, 0.7]} castShadow>
          <boxGeometry args={[0.22, 0.08, 0.1]} />
          <meshStandardMaterial color="#3a1f08" roughness={0.95} />
        </mesh>
      </group>
      {/* Four legs */}
      {[
        { x: 0.28, z: 0.12, idx: 0 },
        { x: 0.28, z: -0.12, idx: 1 },
        { x: -0.28, z: 0.12, idx: 2 },
        { x: -0.28, z: -0.12, idx: 3 },
      ].map(leg => (
        <mesh
          key={leg.idx}
          ref={legRefs[leg.idx]}
          position={[leg.x, 0.16, leg.z]}
          castShadow
        >
          <boxGeometry args={[0.1, 0.32, 0.1]} />
          <meshStandardMaterial color="#5a2810" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// === Lighting + sky tied to time of day ===
function DayNightLighting({ tod }: { tod: TimeOfDay }) {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambientIntensity = 0.25 + tod.daylight * 0.55;
  const sunIntensity = 0.4 + tod.daylight * 1.5;
  const sunColor = useMemo(() => {
    if (tod.phase === 'dawn' || tod.phase === 'dusk') return new THREE.Color('#ffaa66');
    if (tod.phase === 'night') return new THREE.Color('#6080ff');
    return new THREE.Color('#fff5d0');
  }, [tod.phase]);

  // Sun arcs across the sky based on the hour
  const sunAngle = ((tod.hour - 6) / 12) * Math.PI; // 6h=0, 18h=π
  const sunX = Math.cos(sunAngle) * 8;
  const sunY = Math.max(2, Math.sin(sunAngle) * 8);

  return (
    <>
      <ambientLight intensity={ambientIntensity} color="#fff2d0" />
      <directionalLight
        ref={sunRef}
        position={[sunX, sunY, 4]}
        intensity={sunIntensity}
        color={sunColor}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.1}
        shadow-camera-far={30}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      {/* Warm fill from the front so the knight is always lit */}
      <pointLight position={[0, 2, 5]} intensity={0.5} color="#ffd060" />
      {/* Torch glow at night */}
      {tod.torchesLit && (
        <>
          <pointLight position={[-1, 1.5, 1.4]} intensity={1.2} color="#ff8030" distance={5} />
          <pointLight position={[1, 1.5, 1.4]} intensity={1.2} color="#ff8030" distance={5} />
        </>
      )}
    </>
  );
}

// === Sky plane (vertical gradient quad behind everything) ===
function SkyDome({ tod }: { tod: TimeOfDay }) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, tod.skyTop);
    grad.addColorStop(0.45, tod.skyMid);
    grad.addColorStop(0.78, tod.skyLow);
    grad.addColorStop(1, tod.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [tod.skyTop, tod.skyMid, tod.skyLow, tod.skyBottom]);

  return (
    <mesh position={[0, 4, -14]} scale={[40, 20, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} depthWrite={false} />
    </mesh>
  );
}

// === Ground ===
function Ground({ tod }: { tod: TimeOfDay }) {
  const groundColor = useMemo(
    () => lerpColor(COLORS.groundDay, COLORS.groundNight, tod.darkness),
    [tod.darkness],
  );
  const pathColor = useMemo(
    () => lerpColor(COLORS.pathDay, COLORS.pathNight, tod.darkness),
    [tod.darkness],
  );
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[15, 36]} />
        <meshStandardMaterial color={groundColor} roughness={1} />
      </mesh>
      {/* Dirt path leading to the gate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 2.5]} receiveShadow>
        <planeGeometry args={[1.4, 6]} />
        <meshStandardMaterial color={pathColor} roughness={0.95} />
      </mesh>
    </>
  );
}

// === Camera Ken Burns — locked to a flattering 3/4 angle, only
// gentle bobbing to feel alive without losing framing ===
function CameraRig() {
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const cam = state.camera;
    cam.position.x = -1.5 + Math.sin(t * 0.08) * 0.3;
    cam.position.y = 5.5 + Math.sin(t * 0.05) * 0.15;
    cam.position.z = 11 + Math.cos(t * 0.06) * 0.25;
    cam.lookAt(0.5, 1.7, 0);
  });
  return null;
}

// === Main scene component ===
export default function KingdomScene3D() {
  const [tod, setTod] = useState<TimeOfDay>(() => getTimeOfDay());
  useEffect(() => {
    const id = window.setInterval(() => setTod(getTimeOfDay()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', background: tod.skyBottom }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 6, 12], fov: 36, near: 0.1, far: 100 }}
      >
        <Suspense fallback={null}>
          <SkyDome tod={tod} />
          <DayNightLighting tod={tod} />
          {tod.darkness > 0.4 && <Stars radius={50} depth={50} count={800} factor={3} fade />}

          <Ground tod={tod} />
          <CastleDiorama tod={tod} />

          {/* Hero knight — bigger and on the path, facing 3/4 toward camera */}
          <KnightHero position={[1.5, 0, 3.0]} rotation={-0.6} scale={1.3} />

          {/* Villagers patrolling on different rings around the courtyard */}
          <PatrollingVillager radius={3.4} speed={0.42} startAngle={0}    bodyColor="#9b6838" hatColor="#5a3214" />
          <PatrollingVillager radius={4.0} speed={0.32} startAngle={2.1}  bodyColor="#5ea05c" hatColor="#2e5c32" />
          <PatrollingVillager radius={2.8} speed={0.5}  startAngle={4.2}  bodyColor="#c0392b" hatColor="#7a1f12" />
          <PatrollingVillager radius={4.4} speed={0.36} startAngle={1.0}  bodyColor="#2a4a6a" hatColor="#0d2238" />
          <PatrollingVillager radius={3.0} speed={0.55} startAngle={3.5}  bodyColor="#8a4bbf" hatColor="#3d1c5e" />

          {/* Horse trotting on its own oval */}
          <TrottingHorse />

          <ContactShadows position={[0, 0, 0]} opacity={0.55} scale={18} blur={2.4} far={4} />
          <CameraRig />
        </Suspense>
      </Canvas>
    </div>
  );
}
