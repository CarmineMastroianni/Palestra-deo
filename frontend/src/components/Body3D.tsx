// Visualizzazione 3D: manichino PARAMETRICO costruito dalle misure reali registrate
// (non è una riproduzione fotorealistica), oppure modello GLB/GLTF importato dall'utente.
// Evidenzia i muscoli coinvolti e mostra uno schema semplificato del movimento.
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useAnimations, useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { MovementPattern, MuscleId } from '../db/types';

export interface BodyParams {
  heightCm: number;
  chestCm: number;
  waistCm: number;
  hipsCm: number;
  armCm: number;
  thighCm: number;
  calfCm: number;
  shoulders: number; // fattore larghezza spalle
  skinTone: string;
}

export type ViewName = 'three' | 'front' | 'side' | 'back';

interface Props {
  params: BodyParams;
  primary?: MuscleId[];
  secondary?: MuscleId[];
  movement?: MovementPattern;
  glbUrl?: string;
  height?: number;
  showControls?: boolean;
}

const ELLIPSE_K = 5.439; // circonferenza ellisse con profondità 0.72 ≈ 5.439 * semiasse

export function Body3D({ params, primary = [], secondary = [], movement = 'none', glbUrl, height = 380, showControls = true }: Props) {
  const [view, setView] = useState<ViewName>('three');
  const [playing, setPlaying] = useState(movement !== 'none');
  const [webgl] = useState(() => {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
  });
  useEffect(() => setPlaying(movement !== 'none'), [movement]);
  if (!webgl) return <div className="notice warn">Il dispositivo non supporta WebGL: la vista 3D non è disponibile.</div>;
  const H = params.heightCm / 100;
  return (
    <div className="col">
      <div className="canvas3d" style={{ height }}>
        <Canvas camera={{ position: [0, H * 0.55, H * 2.1], fov: 40 }} dpr={[1, 2]}>
          <color attach="background" args={['#0f1315']} />
          <hemisphereLight args={['#ffffff', '#223', 0.9]} />
          <directionalLight position={[2, 4, 3]} intensity={1.4} />
          <directionalLight position={[-3, 2, -3]} intensity={0.6} />
          <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
            <circleGeometry args={[H * 0.8, 48]} />
            <meshStandardMaterial color="#151b1d" />
          </mesh>
          <Suspense fallback={null}>
            {glbUrl ? <GlbModel url={glbUrl} H={H} primary={primary} secondary={secondary} playing={playing} />
              : <Mannequin p={params} primary={primary} secondary={secondary} movement={playing ? movement : 'none'} />}
          </Suspense>
          <CameraRig view={view} H={H} />
        </Canvas>
      </div>
      {showControls && (
        <div className="row wrap">
          {(['three', 'front', 'side', 'back'] as ViewName[]).map((v) => (
            <button key={v} className={`chip ${view === v ? 'on' : ''}`} onClick={() => setView(v)}>
              {v === 'three' ? '¾' : v === 'front' ? 'Fronte' : v === 'side' ? 'Lato' : 'Retro'}
            </button>
          ))}
          {movement !== 'none' && !glbUrl && (
            <button className="chip" onClick={() => setPlaying((p) => !p)}>{playing ? '⏸ Ferma movimento' : '▶ Mostra movimento'}</button>
          )}
          {glbUrl && <button className="chip" onClick={() => setPlaying((p) => !p)}>{playing ? '⏸ Ferma animazione' : '▶ Animazione del modello'}</button>}
        </div>
      )}
    </div>
  );
}

function CameraRig({ view, H }: { view: ViewName; H: number }) {
  const { camera } = useThree();
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  useEffect(() => {
    const d = H * 2.1;
    const pos = view === 'three' ? [d * 0.62, H * 0.7, d * 0.78] : view === 'front' ? [0, H * 0.55, d] : view === 'side' ? [d, H * 0.55, 0] : [0, H * 0.55, -d];
    camera.position.set(pos[0], pos[1], pos[2]);
    controls.current?.target.set(0, H * 0.5, 0);
    controls.current?.update();
  }, [view, H, camera]);
  return <OrbitControls ref={controls} target={[0, H * 0.5, 0]} enablePan={false} minDistance={H * 0.6} maxDistance={H * 4} />;
}

// ---------- Manichino parametrico ----------

interface Pose {
  rootRotX: number; rootRotZ: number; rootY?: number; // rootY definito per pose a terra/sedute
  torso: number;
  shL: [number, number]; shR: [number, number]; // [x, z]
  elL: [number, number]; elR: [number, number];
  hipL: number; hipR: number; knL: number; knR: number;
  planted: boolean;
}

const base = (): Pose => ({ rootRotX: 0, rootRotZ: 0, torso: 0, shL: [0, -0.12], shR: [0, 0.12], elL: [0, 0], elR: [0, 0], hipL: 0, hipR: 0, knL: 0, knR: 0, planted: true });

function poseFor(m: MovementPattern, t: number, time: number, H: number): Pose {
  const p = base();
  const s = (a: number, b: number) => a + (b - a) * t;
  switch (m) {
    case 'squat': {
      const a = s(0, 1.35); const k = s(0, 2.1);
      p.hipL = p.hipR = -a; p.knL = p.knR = k; p.torso = s(0, 0.55);
      p.shL = [-1.4, -0.1]; p.shR = [-1.4, 0.1]; p.elL = p.elR = [-1.2, 0];
      break;
    }
    case 'hinge': {
      const th = s(0, 1.15);
      p.torso = th; p.hipL = p.hipR = -0.15; p.knL = p.knR = 0.3;
      p.shL = [-th, -0.05]; p.shR = [-th, 0.05];
      break;
    }
    case 'bench': case 'incline': {
      p.planted = false; p.rootRotX = m === 'bench' ? -Math.PI / 2 : -Math.PI / 2 + 0.55; p.rootY = H * 0.28;
      p.hipL = p.hipR = -1.4; p.knL = p.knR = 1.5;
      p.shL = [s(-0.25, -1.57), -0.25]; p.shR = [s(-0.25, -1.57), 0.25];
      p.elL = p.elR = [s(-1.6, 0), 0];
      break;
    }
    case 'pulldown': {
      p.planted = false; p.rootY = H * 0.26; p.hipL = p.hipR = -1.57; p.knL = p.knR = 1.57; p.torso = -0.1;
      const ph = s(2.8, 0.45); const el = s(0, 2.2);
      p.shL = [0, -ph]; p.shR = [0, ph]; p.elL = [0, -el]; p.elR = [0, el];
      break;
    }
    case 'row': case 'face_pull': {
      p.planted = false; p.rootY = H * 0.06; p.hipL = p.hipR = -1.35; p.knL = p.knR = 0.35;
      const sh = s(-1.4, m === 'face_pull' ? -1.2 : 0.35);
      p.shL = [sh, m === 'face_pull' ? s(-0.1, -0.9) : -0.1]; p.shR = [sh, m === 'face_pull' ? s(0.1, 0.9) : 0.1];
      const el = m === 'face_pull' ? s(0, -1.8) : -1.4 - sh;
      p.elL = p.elR = [el, 0];
      break;
    }
    case 'lateral_raise': {
      const ph = s(0.15, 1.45);
      p.shL = [0, -ph]; p.shR = [0, ph]; p.elL = [0, -0.15]; p.elR = [0, 0.15];
      break;
    }
    case 'leg_curl': {
      p.planted = false; p.rootRotX = Math.PI / 2; p.rootY = H * 0.12;
      p.shL = [-2.6, -0.2]; p.shR = [-2.6, 0.2];
      p.knL = p.knR = s(0, 1.9);
      break;
    }
    case 'bridge': {
      p.planted = false; p.rootRotX = -Math.PI / 2 + s(0, 0.6); p.rootY = H * s(0.06, 0.16);
      p.hipL = p.hipR = s(-1.3, -0.65); p.knL = p.knR = 1.9 - s(0, 0.35);
      p.shL = [0, -0.25]; p.shR = [0, 0.25];
      break;
    }
    case 'plank': {
      p.planted = false; p.rootRotX = Math.PI / 2 - 0.1; p.rootY = H * 0.2;
      p.shL = [-1.57, -0.05]; p.shR = [-1.57, 0.05]; p.elL = p.elR = [-1.57, 0];
      break;
    }
    case 'side_plank': {
      p.planted = false; p.rootRotZ = Math.PI / 2 - 0.25; p.rootY = H * 0.2;
      p.shL = [0, -1.57]; p.shR = [0, 0.1]; p.elL = [-1.57, 0];
      break;
    }
    case 'dead_bug': {
      p.planted = false; p.rootRotX = -Math.PI / 2; p.rootY = H * 0.1;
      const alt = Math.sin(time * 1.6);
      const a = Math.max(0, alt); const b = Math.max(0, -alt);
      p.shL = [-1.57 - a * 1.2, -0.05]; p.shR = [-1.57 - b * 1.2, 0.05];
      p.hipL = -1.57 + b * 1.1; p.hipR = -1.57 + a * 1.1; p.knL = 1.57 - b * 1.3; p.knR = 1.57 - a * 1.3;
      break;
    }
    case 'pallof': {
      p.knL = p.knR = 0.25; p.hipL = p.hipR = -0.2;
      p.shL = [s(-0.5, -1.5), -0.05]; p.shR = [s(-0.5, -1.5), 0.05]; p.elL = p.elR = [s(-1.3, 0), 0];
      break;
    }
    case 'cycle': {
      p.planted = false; p.rootY = H * 0.3; p.torso = 0.35;
      const c = time * 4;
      p.hipL = -1.1 + Math.sin(c) * 0.45; p.knL = 1.3 + Math.cos(c) * 0.5;
      p.hipR = -1.1 - Math.sin(c) * 0.45; p.knR = 1.3 - Math.cos(c) * 0.5;
      p.shL = [-1.0, -0.15]; p.shR = [-1.0, 0.15]; p.elL = p.elR = [-0.5, 0];
      break;
    }
    case 'walk': {
      const c = time * 3.5;
      p.hipL = Math.sin(c) * 0.45; p.hipR = -Math.sin(c) * 0.45;
      p.knL = Math.max(0, Math.cos(c)) * 0.7; p.knR = Math.max(0, -Math.cos(c)) * 0.7;
      p.shL = [-Math.sin(c) * 0.4, -0.08]; p.shR = [Math.sin(c) * 0.4, 0.08];
      p.elL = p.elR = [-0.3, 0]; p.torso = 0.05;
      break;
    }
    default: break;
  }
  return p;
}

const PRIMARY_COLOR = new THREE.Color('#39ff88');
const SECONDARY_COLOR = new THREE.Color('#5cc8ff');

function Overlay({ id, primary, secondary, position, scale, rotation = [0, 0, 0] }: {
  id: MuscleId; primary: MuscleId[]; secondary: MuscleId[]; position: [number, number, number]; scale: [number, number, number]; rotation?: [number, number, number];
}) {
  const isP = primary.includes(id); const isS = secondary.includes(id);
  if (!isP && !isS) return null;
  return (
    <mesh position={position} scale={scale} rotation={rotation}>
      <sphereGeometry args={[1, 24, 16]} />
      <meshStandardMaterial color={isP ? PRIMARY_COLOR : SECONDARY_COLOR} emissive={isP ? PRIMARY_COLOR : SECONDARY_COLOR} emissiveIntensity={isP ? 0.55 : 0.3} transparent opacity={isP ? 0.92 : 0.75} />
    </mesh>
  );
}

function Mannequin({ p, primary, secondary, movement }: { p: BodyParams; primary: MuscleId[]; secondary: MuscleId[]; movement: MovementPattern }) {
  const H = p.heightCm / 100;
  const D = 0.72; // rapporto profondità/larghezza del tronco
  const chestA = p.chestCm / 100 / ELLIPSE_K;
  const waistA = p.waistCm / 100 / ELLIPSE_K;
  const hipsA = p.hipsCm / 100 / ELLIPSE_K;
  const armR = p.armCm / 100 / (2 * Math.PI);
  const thighR = p.thighCm / 100 / (2 * Math.PI);
  const calfR = p.calfCm / 100 / (2 * Math.PI);
  const hipY = 0.53 * H; const thighL = 0.245 * H; const shinL = 0.245 * H; const footH = 0.04 * H;
  const torsoL = 0.29 * H; const upperArm = 0.18 * H; const forearm = 0.22 * H;
  const shoulderX = Math.max(chestA * 0.95, 0.105 * H * p.shoulders);
  const hipX = Math.min(hipsA * 0.55, Math.max(thighR * 1.02, 0.045 * H));

  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: p.skinTone, roughness: 0.75 }), [p.skinTone]);
  const torsoGeo = useMemo(() => {
    const pts = [
      [0.001, -0.07 * H], [hipsA * 0.8, -0.065 * H], [hipsA, -0.01 * H], [hipsA * 0.97, 0.03 * H], [waistA, 0.09 * H],
      [(waistA + chestA) / 2, 0.14 * H], [chestA, 0.19 * H], [chestA * 0.97, 0.245 * H], [chestA * 0.75, 0.285 * H],
      [0.03 * H, 0.3 * H], [0.001, 0.3 * H]
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const g = new THREE.LatheGeometry(pts, 40);
    g.scale(1, 1, D);
    return g;
  }, [H, hipsA, waistA, chestA]);

  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const sh = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const el = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const hp = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const kn = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const t = (1 - Math.cos(time * 1.7)) / 2;
    const pose = poseFor(movement, t, time, H);
    if (!root.current || !torso.current) return;
    torso.current.rotation.x = pose.torso;
    const setRot = (g: THREE.Group | null, x: number, z: number) => { if (g) { g.rotation.x = x; g.rotation.z = z; } };
    setRot(sh[0].current, pose.shL[0], pose.shL[1]); setRot(sh[1].current, pose.shR[0], pose.shR[1]);
    setRot(el[0].current, pose.elL[0], pose.elL[1]); setRot(el[1].current, pose.elR[0], pose.elR[1]);
    setRot(hp[0].current, pose.hipL, 0); setRot(hp[1].current, pose.hipR, 0);
    setRot(kn[0].current, pose.knL, 0); setRot(kn[1].current, pose.knR, 0);
    root.current.rotation.set(pose.rootRotX, 0, pose.rootRotZ);
    if (pose.planted) {
      // piedi a terra: calcola l'altezza del bacino dalla geometria della gamba
      const legY = (h: number, k: number) => thighL * Math.cos(h) + shinL * Math.cos(h + k);
      const legZ = (h: number, k: number) => -thighL * Math.sin(h) - shinL * Math.sin(h + k);
      const y = Math.max(legY(pose.hipL, pose.knL), legY(pose.hipR, pose.knR)) + footH;
      const z = (legZ(pose.hipL, pose.knL) + legZ(pose.hipR, pose.knR)) / 2;
      root.current.position.set(0, y, -z);
    } else {
      root.current.position.set(0, pose.rootY ?? hipY, 0);
    }
  });

  const front = chestA * D;
  const P = primary; const S = secondary;
  const arm = (side: 0 | 1) => {
    const sx = side === 0 ? -1 : 1;
    return (
      <group ref={sh[side]} position={[sx * shoulderX, torsoL - 0.02 * H, 0]}>
        <mesh material={skin}><sphereGeometry args={[armR * 1.25, 20, 16]} /></mesh>
        <Overlay id="deltoidi_anteriori" primary={P} secondary={S} position={[sx * armR * 0.2, -armR * 0.3, armR * 0.85]} scale={[armR * 0.75, armR * 1.2, armR * 0.5]} />
        <Overlay id="deltoidi_laterali" primary={P} secondary={S} position={[sx * armR * 0.95, -armR * 0.35, 0]} scale={[armR * 0.5, armR * 1.2, armR * 0.8]} />
        <Overlay id="deltoidi_posteriori" primary={P} secondary={S} position={[sx * armR * 0.2, -armR * 0.3, -armR * 0.85]} scale={[armR * 0.75, armR * 1.2, armR * 0.5]} />
        <mesh material={skin} position={[0, -upperArm / 2, 0]}><capsuleGeometry args={[armR, upperArm - armR, 8, 16]} /></mesh>
        <Overlay id="bicipiti" primary={P} secondary={S} position={[0, -upperArm * 0.55, armR * 0.62]} scale={[armR * 0.6, upperArm * 0.32, armR * 0.5]} />
        <Overlay id="tricipiti" primary={P} secondary={S} position={[0, -upperArm * 0.5, -armR * 0.62]} scale={[armR * 0.65, upperArm * 0.35, armR * 0.5]} />
        <group ref={el[side]} position={[0, -upperArm, 0]}>
          <mesh material={skin} position={[0, -forearm / 2, 0]}><capsuleGeometry args={[armR * 0.78, forearm - armR, 8, 16]} /></mesh>
          <Overlay id="avambracci" primary={P} secondary={S} position={[0, -forearm * 0.3, 0]} scale={[armR * 0.85, forearm * 0.28, armR * 0.85]} />
        </group>
      </group>
    );
  };
  const leg = (side: 0 | 1) => {
    const sx = side === 0 ? -1 : 1;
    return (
      <group ref={hp[side]} position={[sx * hipX, 0, 0]}>
        <mesh material={skin} position={[0, -thighL / 2, 0]}><capsuleGeometry args={[thighR, thighL - thighR, 8, 16]} /></mesh>
        <Overlay id="quadricipiti" primary={P} secondary={S} position={[0, -thighL * 0.5, thighR * 0.6]} scale={[thighR * 0.75, thighL * 0.38, thighR * 0.5]} />
        <Overlay id="femorali" primary={P} secondary={S} position={[0, -thighL * 0.5, -thighR * 0.6]} scale={[thighR * 0.7, thighL * 0.38, thighR * 0.5]} />
        <Overlay id="adduttori" primary={P} secondary={S} position={[-sx * thighR * 0.62, -thighL * 0.35, 0]} scale={[thighR * 0.45, thighL * 0.3, thighR * 0.6]} />
        <group ref={kn[side]} position={[0, -thighL, 0]}>
          <mesh material={skin} position={[0, -shinL / 2, 0]}><capsuleGeometry args={[calfR * 0.85, shinL - calfR, 8, 16]} /></mesh>
          <Overlay id="polpacci" primary={P} secondary={S} position={[0, -shinL * 0.3, -calfR * 0.5]} scale={[calfR * 0.75, shinL * 0.25, calfR * 0.55]} />
          <mesh material={skin} position={[0, -shinL - footH / 2 + 0.01, 0.04 * H * 0.5]}><boxGeometry args={[calfR * 1.4, footH, 0.15 * H]} /></mesh>
        </group>
      </group>
    );
  };

  return (
    <group ref={root} position={[0, hipY, 0]}>
      <group ref={torso}>
        <mesh geometry={torsoGeo} material={skin} />
        {/* collo e testa */}
        <mesh material={skin} position={[0, torsoL + 0.03 * H, 0]}><cylinderGeometry args={[0.032 * H, 0.036 * H, 0.06 * H, 16]} /></mesh>
        <mesh material={skin} position={[0, torsoL + 0.105 * H, 0.005 * H]} scale={[0.9, 1.1, 1]}><sphereGeometry args={[0.058 * H, 24, 20]} /></mesh>
        {/* muscoli del tronco */}
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <Overlay id="pettorali" primary={P} secondary={S} position={[sx * chestA * 0.42, 0.205 * H, front * 0.8]} scale={[chestA * 0.42, 0.05 * H, front * 0.28]} />
            <Overlay id="dorsali" primary={P} secondary={S} position={[sx * chestA * 0.55, 0.16 * H, -front * 0.72]} scale={[chestA * 0.42, 0.08 * H, front * 0.32]} rotation={[0, 0, sx * 0.25]} />
            <Overlay id="obliqui" primary={P} secondary={S} position={[sx * waistA * 0.88, 0.09 * H, front * 0.2]} scale={[waistA * 0.2, 0.06 * H, waistA * 0.55]} />
            <Overlay id="glutei" primary={P} secondary={S} position={[sx * hipsA * 0.45, -0.02 * H, -hipsA * D * 0.82]} scale={[hipsA * 0.42, 0.055 * H, hipsA * 0.35]} />
            <Overlay id="romboidi" primary={P} secondary={S} position={[sx * chestA * 0.2, 0.225 * H, -front * 0.88]} scale={[chestA * 0.18, 0.04 * H, front * 0.18]} />
          </group>
        ))}
        <Overlay id="addominali" primary={P} secondary={S} position={[0, 0.1 * H, waistA * D * 0.92]} scale={[waistA * 0.42, 0.08 * H, waistA * 0.18]} />
        <Overlay id="core_profondo" primary={P} secondary={S} position={[0, 0.06 * H, waistA * D * 0.75]} scale={[waistA * 0.75, 0.055 * H, waistA * 0.3]} />
        <Overlay id="lombari" primary={P} secondary={S} position={[0, 0.06 * H, -waistA * D * 0.9]} scale={[waistA * 0.4, 0.05 * H, waistA * 0.2]} />
        <Overlay id="trapezi" primary={P} secondary={S} position={[0, 0.27 * H, -front * 0.55]} scale={[chestA * 0.6, 0.045 * H, front * 0.35]} />
        {arm(0)}{arm(1)}
      </group>
      {leg(0)}{leg(1)}
    </group>
  );
}

// ---------- Modello GLB importato ----------

function GlbModel({ url, H, primary, secondary, playing }: { url: string; H: number; primary: MuscleId[]; secondary: MuscleId[]; playing: boolean }) {
  const gltf = useGLTF(url);
  const group = useRef<THREE.Group>(null);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const { actions, names } = useAnimations(gltf.animations, group);

  useEffect(() => {
    // normalizza l'altezza del modello all'altezza dell'utente e lo appoggia a terra
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const s = size.y > 0 ? H / size.y : 1;
    scene.scale.setScalar(s);
    const box2 = new THREE.Box3().setFromObject(scene);
    const c = box2.getCenter(new THREE.Vector3());
    scene.position.set(-c.x, -box2.min.y, -c.z);
  }, [scene, H]);

  useEffect(() => {
    // evidenziazione: se le mesh del modello sono nominate con l'id del muscolo (es. "pettorali")
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const n = mesh.name.toLowerCase();
      const isP = primary.some((m) => n.includes(m));
      const isS = !isP && secondary.some((m) => n.includes(m));
      if (!mesh.userData.origMat) mesh.userData.origMat = mesh.material;
      if (isP || isS) {
        const mat = new THREE.MeshStandardMaterial({ color: isP ? PRIMARY_COLOR : SECONDARY_COLOR, emissive: isP ? PRIMARY_COLOR : SECONDARY_COLOR, emissiveIntensity: 0.4 });
        mesh.material = mat;
      } else mesh.material = mesh.userData.origMat;
    });
  }, [scene, primary, secondary]);

  useEffect(() => {
    const first = names[0] ? actions[names[0]] : undefined;
    if (!first) return;
    if (playing) first.reset().fadeIn(0.2).play(); else first.fadeOut(0.2);
    return () => { first.stop(); };
  }, [playing, actions, names]);

  return <group ref={group}><primitive object={scene} /></group>;
}

export function ThreeFallback({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="canvas3d" style={{ display: 'grid', placeItems: 'center' }}><span className="muted">Caricamento 3D…</span></div>}>{children}</Suspense>;
}
