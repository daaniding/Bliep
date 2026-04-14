'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Stars, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { getTimeOfDay, type TimeOfDay } from '@/lib/timeOfDay';

// === Asset URLs ===
const SOLDIER_URL = '/assets/3d/soldier.glb';
const HORSE_URL = '/assets/3d/horse.glb';

useGLTF.preload(SOLDIER_URL);
useGLTF.preload(HORSE_URL);

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

// === Castle (procedural) ===
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

  // Wave the central flag
  const flagRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (flagRef.current) {
      const t = state.clock.getElapsedTime();
      flagRef.current.rotation.z = Math.sin(t * 2.5) * 0.18;
      flagRef.current.scale.x = 1 + Math.sin(t * 2.5) * 0.04;
    }
  });

  return (
    <group position={[0, 0, -2]}>
      {/* Main keep — large central cylinder + cone roof */}
      <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.95, 1.1, 3.2, 12]} />
        <meshStandardMaterial color={stoneColor} roughness={0.85} />
      </mesh>
      <mesh position={[0, 3.55, 0]} castShadow>
        <coneGeometry args={[1.15, 1.4, 12]} />
        <meshStandardMaterial color={roofColor} roughness={0.6} />
      </mesh>
      {/* Flag pole + flag */}
      <mesh position={[0, 4.6, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.9, 6]} />
        <meshStandardMaterial color="#1a0f05" />
      </mesh>
      <mesh ref={flagRef} position={[0.32, 4.85, 0]}>
        <planeGeometry args={[0.55, 0.32]} />
        <meshStandardMaterial color={flagColor} side={THREE.DoubleSide} />
      </mesh>

      {/* Two side towers */}
      {[
        { x: -2.2, h: 2.4 },
        { x: 2.2, h: 2.4 },
      ].map((t, i) => (
        <group key={i} position={[t.x, 0, 0.4]}>
          <mesh position={[0, t.h / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.65, 0.78, t.h, 10]} />
            <meshStandardMaterial color={stoneColor} roughness={0.85} />
          </mesh>
          <mesh position={[0, t.h + 0.45, 0]} castShadow>
            <coneGeometry args={[0.82, 0.9, 10]} />
            <meshStandardMaterial color={roofColor} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Connecting walls between center and side towers */}
      {[
        { x: -1.1, w: 1.3 },
        { x: 1.1, w: 1.3 },
      ].map((w, i) => (
        <mesh key={i} position={[w.x, 0.7, 0.4]} castShadow receiveShadow>
          <boxGeometry args={[w.w, 1.4, 0.5]} />
          <meshStandardMaterial color={stoneColor} roughness={0.9} />
        </mesh>
      ))}

      {/* Wooden gate in front of the keep */}
      <mesh position={[0, 0.7, 1.05]} castShadow>
        <boxGeometry args={[1.0, 1.4, 0.15]} />
        <meshStandardMaterial color={woodColor} roughness={0.7} />
      </mesh>

      {/* Two small village houses on the flanks */}
      {[
        { x: -3.6, z: 1.5, rot: 0.3 },
        { x: 3.6, z: 1.5, rot: -0.3 },
      ].map((h, i) => (
        <group key={i} position={[h.x, 0, h.z]} rotation={[0, h.rot, 0]}>
          <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.8, 1.0]} />
            <meshStandardMaterial color={woodColor} roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.0, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[0.92, 0.7, 4]} />
            <meshStandardMaterial color={roofColor} roughness={0.65} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// === Hero knight — single instance soldier, no clone needed so the
// idle animation just works. ===
interface KnightHeroProps {
  position: [number, number, number];
  rotation?: number;
  scale?: number;
}
function KnightHero({ position, rotation = 0, scale = 1 }: KnightHeroProps) {
  const { scene, animations } = useGLTF(SOLDIER_URL) as unknown as {
    scene: THREE.Group;
    animations: THREE.AnimationClip[];
  };

  // Cast shadows on all meshes (one-time)
  useEffect(() => {
    scene.traverse(obj => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [scene]);

  // Bind the AnimationMixer directly to the scene root so it doesn't
  // depend on a primitive ref being populated. Three.js example
  // Soldier clips are named "Idle", "Walk", "Run".
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  useEffect(() => {
    const idleClip = animations.find(c => c.name === 'Idle') ?? animations[0];
    if (!idleClip) return;
    const action = mixer.clipAction(idleClip);
    action.reset().fadeIn(0.3).play();
    return () => {
      action.fadeOut(0.3);
      action.stop();
    };
  }, [mixer, animations]);
  useFrame((_, delta) => mixer.update(delta));

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <primitive object={scene} />
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
function TrottingHorse() {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(HORSE_URL) as unknown as {
    scene: THREE.Group;
    animations: THREE.AnimationClip[];
  };

  useEffect(() => {
    scene.traverse(obj => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [scene]);

  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  useEffect(() => {
    const clip = animations[0];
    if (!clip) return;
    const action = mixer.clipAction(clip);
    action.timeScale = 1.5;
    action.reset().play();
    return () => {
      action.stop();
    };
  }, [mixer, animations]);

  useFrame((state, delta) => {
    mixer.update(delta);
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * 0.4;
    const a = 5.5;
    const b = 3.2;
    groupRef.current.position.x = Math.cos(t) * a;
    groupRef.current.position.z = Math.sin(t) * b + 1.5;
    groupRef.current.rotation.y = -t + Math.PI / 2;
  });

  return (
    <group ref={groupRef} scale={0.014}>
      <primitive object={scene} />
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
