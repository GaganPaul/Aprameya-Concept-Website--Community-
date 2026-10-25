// Dev-only preview for apramaya_bonfire_v3_minimal.glb  (React Three Fiber + drei).
// Install if needed:  pnpm add three @react-three/fiber @react-three/drei
// Mount it on a dev-only route, e.g. in your router:
//   import.meta.env.DEV && <Route path="/dev/bonfire" element={<BonfirePreview />} />
import { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, ContactShadows, Environment } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const MODEL_URL = "/assets/uploads/apramaya_bonfire_v3_minimal.glb";
const HOME_POS: [number, number, number] = [0, 1.6, 7];
const HOME_TARGET: [number, number, number] = [0, 1.15, 0];

function Bonfire() {
  const { scene } = useGLTF(MODEL_URL);
  // "FireAnchor" is an empty node at the ignition point: attach flames / embers / point light there later.
  return <primitive object={scene} />;
}

export default function BonfirePreview() {
  const controls = useRef<OrbitControlsImpl>(null);
  const reset = () => {
    const c = controls.current;
    if (!c) return;
    c.object.position.set(...HOME_POS);
    c.target.set(...HOME_TARGET);
    c.update();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0b0b0e" }}>
      <button
        onClick={reset}
        style={{ position: "absolute", zIndex: 2, top: 16, left: 16, padding: "6px 12px", background: "#1b1b20", color: "#ddd", border: "1px solid #333", cursor: "pointer" }}
      >
        Reset view
      </button>
      <Canvas camera={{ position: HOME_POS, fov: 30 }} dpr={[1, 2]}>
        <color attach="background" args={["#0b0b0e"]} />
        <hemisphereLight args={["#2a3042", "#120d0a", 0.6]} />
        <directionalLight position={[-3, 5, 4]} intensity={2.2} color="#ffe6c8" />
        <directionalLight position={[4, 2, -4]} intensity={1.6} color="#7d92d9" />
        <pointLight position={[0, 0.4, 0.2]} intensity={1.2} distance={3} color="#ff7a30" />
        <Suspense fallback={null}>
          <Bonfire />
          <Environment preset="night" />
          <ContactShadows position={[0, 0, 0]} opacity={0.6} scale={5} blur={2.5} far={2} />
        </Suspense>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <circleGeometry args={[3.2, 64]} />
          <meshStandardMaterial color="#17171b" roughness={1} />
        </mesh>
        <OrbitControls ref={controls} target={HOME_TARGET} enableDamping minDistance={2.5} maxDistance={12} />
      </Canvas>
    </div>
  );
}
useGLTF.preload(MODEL_URL);
