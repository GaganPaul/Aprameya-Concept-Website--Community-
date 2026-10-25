import {
  Component,
  Suspense,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
  type RefObject,
} from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Box3,
  Color,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  type Material,
} from "three"
import BonfireFallback from "./BonfireFallback"

const MODEL_URL = `${import.meta.env.BASE_URL}assets/uploads/apramaya_bonfire_v3_minimal.glb`
const FALLBACK_ANCHOR = new Vector3(0, 0.34, 0.04)
const VIEW_TARGET = new Vector3(0, 1.15, 0)
const DESKTOP_PARTICLES = 80
const MOBILE_PARTICLES = 35
const REDUCED_PARTICLES = 10

export type BonfirePhase = "dormant" | "igniting" | "lit"

type BonfireSceneProps = {
  phase: BonfirePhase
  ignitionStartedAt: number
  reducedMotion: boolean
  sectionRef: RefObject<HTMLElement | null>
  onModelReady: (anchorFound: boolean) => void
}

type FlameLayer = {
  x: number
  y: number
  z: number
  width: number
  height: number
  ignitionStart: number
  ignitionEnd: number
  phase: number
  yaw: number
  opacity?: number
}

type MaterialResponse = {
  cloned: Material[]
  charredWood: MeshStandardMaterial[]
  emberCore: MeshStandardMaterial[]
  swordSteel: MeshStandardMaterial[]
  swordIron: MeshStandardMaterial[]
  swordGrip: MeshStandardMaterial[]
}

type ModelErrorBoundaryProps = {
  children: ReactNode
  fallback: ReactNode
}

type ModelErrorBoundaryState = {
  hasError: boolean
}

const FLAME_LAYERS: FlameLayer[] = [
  {
    x: -0.24,
    y: 0.02,
    z: -0.48,
    width: 0.9,
    height: 1.48,
    ignitionStart: 0.28,
    ignitionEnd: 0.84,
    phase: 0.2,
    yaw: -0.08,
  },
  {
    x: -0.68,
    y: 0.03,
    z: -0.22,
    width: 0.76,
    height: 1.16,
    ignitionStart: 0.2,
    ignitionEnd: 0.72,
    phase: 1.8,
    yaw: 0.5,
  },
  {
    x: 0.56,
    y: 0.025,
    z: -0.34,
    width: 0.78,
    height: 1.38,
    ignitionStart: 0.38,
    ignitionEnd: 0.9,
    phase: 3.1,
    yaw: -0.42,
  },
  {
    x: 0.08,
    y: 0.03,
    z: -0.14,
    width: 0.66,
    height: 1.5,
    ignitionStart: 0.45,
    ignitionEnd: 0.98,
    phase: 2.6,
    yaw: 0.12,
  },
  {
    x: -0.82,
    y: 0.025,
    z: 0.12,
    width: 0.68,
    height: 0.96,
    ignitionStart: 0.22,
    ignitionEnd: 0.72,
    phase: 4.3,
    yaw: 0.62,
  },
  {
    x: 0.82,
    y: 0.02,
    z: 0.08,
    width: 0.68,
    height: 1.02,
    ignitionStart: 0.28,
    ignitionEnd: 0.78,
    phase: 5.2,
    yaw: -0.58,
  },
  {
    x: -0.52,
    y: 0.025,
    z: 0.52,
    width: 0.68,
    height: 0.82,
    ignitionStart: 0.5,
    ignitionEnd: 0.95,
    phase: 6.1,
    yaw: -0.18,
  },
  {
    x: 0.02,
    y: 0.02,
    z: 0.62,
    width: 0.62,
    height: 0.9,
    ignitionStart: 0.52,
    ignitionEnd: 0.98,
    phase: 7.2,
    yaw: 0.08,
  },
  {
    x: 0.55,
    y: 0.025,
    z: 0.5,
    width: 0.7,
    height: 0.84,
    ignitionStart: 0.55,
    ignitionEnd: 1,
    phase: 8.4,
    yaw: 0.18,
  },
  {
    x: -0.28,
    y: 0.025,
    z: -0.02,
    width: 0.52,
    height: 1.18,
    ignitionStart: 0.34,
    ignitionEnd: 0.85,
    phase: 9.6,
    yaw: -0.34,
  },
  {
    x: 0.4,
    y: 0.025,
    z: 0.25,
    width: 0.54,
    height: 1.08,
    ignitionStart: 0.42,
    ignitionEnd: 0.92,
    phase: 10.7,
    yaw: 0.38,
  },
  {
    x: -0.62,
    y: -0.22,
    z: -0.14,
    width: 0.72,
    height: 0.82,
    ignitionStart: 0,
    ignitionEnd: 0.4,
    phase: 11.8,
    yaw: 0.48,
    opacity: 0.42,
  },
  {
    x: 0.5,
    y: -0.22,
    z: -0.16,
    width: 0.72,
    height: 0.84,
    ignitionStart: 0.04,
    ignitionEnd: 0.44,
    phase: 12.9,
    yaw: -0.46,
    opacity: 0.42,
  },
  {
    x: -0.58,
    y: -0.23,
    z: 0.56,
    width: 0.68,
    height: 0.68,
    ignitionStart: 0.08,
    ignitionEnd: 0.48,
    phase: 14.1,
    yaw: -0.3,
    opacity: 0.4,
  },
  {
    x: -0.04,
    y: -0.23,
    z: 0.62,
    width: 0.72,
    height: 0.74,
    ignitionStart: 0.1,
    ignitionEnd: 0.5,
    phase: 15.2,
    yaw: 0.04,
    opacity: 0.42,
  },
  {
    x: 0.58,
    y: -0.23,
    z: 0.56,
    width: 0.68,
    height: 0.68,
    ignitionStart: 0.12,
    ignitionEnd: 0.52,
    phase: 16.3,
    yaw: 0.32,
    opacity: 0.4,
  },
  {
    x: -0.36,
    y: -0.16,
    z: 0.42,
    width: 0.82,
    height: 0.92,
    ignitionStart: 0.08,
    ignitionEnd: 0.48,
    phase: 17.4,
    yaw: 0.24,
    opacity: 0.4,
  },
  {
    x: 0.34,
    y: -0.17,
    z: 0.4,
    width: 0.78,
    height: 0.88,
    ignitionStart: 0.1,
    ignitionEnd: 0.5,
    phase: 18.5,
    yaw: -0.2,
    opacity: 0.4,
  },
  {
    x: -0.74,
    y: -0.12,
    z: 0.38,
    width: 0.66,
    height: 0.78,
    ignitionStart: 0.14,
    ignitionEnd: 0.54,
    phase: 19.6,
    yaw: 0.48,
    opacity: 0.38,
  },
  {
    x: 0.72,
    y: -0.12,
    z: 0.38,
    width: 0.66,
    height: 0.8,
    ignitionStart: 0.16,
    ignitionEnd: 0.56,
    phase: 20.7,
    yaw: -0.46,
    opacity: 0.38,
  },
  {
    x: -0.08,
    y: -0.18,
    z: 0.72,
    width: 0.7,
    height: 0.82,
    ignitionStart: 0.2,
    ignitionEnd: 0.6,
    phase: 21.8,
    yaw: 0.08,
    opacity: 0.4,
  },
  {
    x: 0.08,
    y: -0.08,
    z: -0.08,
    width: 0.68,
    height: 0.94,
    ignitionStart: 0.24,
    ignitionEnd: 0.64,
    phase: 22.9,
    yaw: -0.06,
    opacity: 0.42,
  },
]

const flameVertexShader = `
  uniform float uTime;
  uniform float uPhase;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 displaced = position;
    float topWeight = pow(uv.y, 2.0);
    displaced.x += sin(uTime * 1.25 + uPhase + uv.y * 4.2) * 0.12 * topWeight;
    displaced.x += sin(uTime * 0.62 + uPhase * 1.7 + uv.y * 7.0) * 0.04 * topWeight;
    displaced.z += cos(uTime * 0.86 + uPhase + uv.y * 3.0) * 0.025 * topWeight;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`

const flameFragmentShader = `
  uniform float uTime;
  uniform float uIgnition;
  uniform float uPhase;
  uniform float uOpacity;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 3; i++) {
      value += noise(p) * amplitude;
      p *= 2.03;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    float y = clamp(vUv.y, 0.0, 1.0);
    float flow = fbm(vec2(vUv.x * 4.6 + uPhase, y * 3.7 - uTime * 1.15));
    float center = 0.5 + sin(y * 4.8 + uTime * 1.1 + uPhase) * 0.07;
    center += (flow - 0.5) * 0.13;
    float width = mix(0.48, 0.012, pow(y, 1.12)) * (0.78 + flow * 0.4);
    float distanceFromCenter = abs(vUv.x - center);
    float edge = 1.0 - smoothstep(width * 0.46, width, distanceFromCenter);
    float baseFade = smoothstep(0.0, 0.06, y);
    float tipFade = 1.0 - smoothstep(0.82, 1.0, y);
    float erosion = 0.72 + smoothstep(0.08, 0.72, flow) * 0.28;
    float alpha = edge * baseFade * tipFade * erosion * uIgnition * uOpacity;

    float core = 1.0 - smoothstep(0.0, width * 0.38, distanceFromCenter);
    vec3 deepRed = vec3(0.48, 0.018, 0.003);
    vec3 emberOrange = vec3(0.95, 0.085, 0.006);
    vec3 orange = vec3(1.0, 0.27, 0.018);
    vec3 gold = vec3(1.0, 0.56, 0.12);
    vec3 hotCore = vec3(1.0, 0.83, 0.48);
    vec3 color = mix(deepRed, emberOrange, smoothstep(0.02, 0.3, y));
    color = mix(color, orange, smoothstep(0.18, 0.72, flow));
    color = mix(color, gold, core * 0.62);
    color = mix(color, hotCore, smoothstep(0.9, 0.998, core) * (1.0 - smoothstep(0.22, 0.62, y)));
    gl_FragColor = vec4(color, alpha * (0.86 + flow * 0.32));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const emberVertexShader = `
  attribute float aSeed;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aDormant;
  attribute float aBurst;
  uniform float uTime;
  uniform float uIgnition;
  uniform float uBurstAmount;
  varying float vLife;
  varying float vAlpha;
  varying float vHeat;

  void main() {
    float life = fract(aSeed + uTime * aSpeed);
    vLife = life;
    float activeAlpha = mix(aDormant * 0.12, 0.68, uIgnition);
    float burst = uBurstAmount * aBurst;
    vAlpha = activeAlpha + burst * 0.28;
    vHeat = clamp(uIgnition + burst * 0.4, 0.0, 1.0);

    vec3 drift = position;
    drift.y += life * 1.25 - 0.1 + burst * life * 0.22;
    drift.x += sin(uTime * 1.1 + aSeed * 29.0) * 0.05 * (0.4 + uIgnition);
    drift.z += cos(uTime * 0.9 + aSeed * 19.0) * 0.035;

    vec4 viewPosition = modelViewMatrix * vec4(drift, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(aSize * (2.5 / max(-viewPosition.z, 1.0)) * (1.0 + burst * 0.3), 1.0, 6.0);
  }
`

const emberFragmentShader = `
  varying float vLife;
  varying float vAlpha;
  varying float vHeat;

  void main() {
    float radius = length(gl_PointCoord - vec2(0.5));
    float softDot = 1.0 - smoothstep(0.12, 0.5, radius);
    float fade = smoothstep(0.0, 0.1, vLife) * (1.0 - smoothstep(0.72, 1.0, vLife));
    float alpha = softDot * fade * vAlpha;
    vec3 ash = vec3(0.3, 0.22, 0.15);
    vec3 ember = vec3(1.0, 0.28, 0.035);
    vec3 color = mix(ash, ember, vHeat);
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const groundGlowVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const groundGlowFragmentShader = `
  uniform float uIgnition;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float radius = length((vUv - 0.5) * vec2(1.0, 0.68));
    float glow = (1.0 - smoothstep(0.08, 0.5, radius)) * uIgnition;
    float pulse = 0.96 + 0.04 * sin(uTime * 2.1);
    vec3 color = vec3(1.0, 0.25, 0.04);
    float alpha = glow * pulse * 0.5;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

class ModelErrorBoundary extends Component<ModelErrorBoundaryProps, ModelErrorBoundaryState> {
  state: ModelErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.warn(
      "Bonfire scene failed to render; showing the CSS fallback.",
      error,
    )
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

function cloneMaterials(model: Group): MaterialResponse {
  const materialCache = new Map<Material, Material>()
  const cloned: Material[] = []
  const charredWood: MeshStandardMaterial[] = []
  const emberCore: MeshStandardMaterial[] = []
  const swordSteel: MeshStandardMaterial[] = []
  const swordIron: MeshStandardMaterial[] = []
  const swordGrip: MeshStandardMaterial[] = []

  model.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.castShadow = true
    object.receiveShadow = true

    const clone = (material: Material) => {
      const cached = materialCache.get(material)
      if (cached) return cached
      const copy = material.clone()
      materialCache.set(material, copy)
      cloned.push(copy)
      if (copy instanceof MeshStandardMaterial) {
        if (copy.name === "CharredWood") {
          copy.emissive.set("#6b2108")
          copy.emissiveIntensity = 0.006
          charredWood.push(copy)
        } else if (copy.name === "EmberCore") {
          copy.emissive.set("#ff4b12")
          copy.emissiveIntensity = 0.035
          emberCore.push(copy)
        } else if (copy.name === "AgedSteel") {
          copy.metalness = Math.min(copy.metalness, 0.58)
          copy.roughness = Math.min(copy.roughness, 0.34)
          copy.emissive.set("#74777a")
          copy.emissiveIntensity = 0.15
          swordSteel.push(copy)
        } else if (copy.name === "DarkIron") {
          copy.color.set("#5c5650")
          copy.metalness = Math.min(copy.metalness, 0.48)
          copy.roughness = Math.min(copy.roughness, 0.4)
          copy.emissive.set("#51483e")
          copy.emissiveIntensity = 0.13
          swordIron.push(copy)
        } else if (copy.name === "WornLeather") {
          copy.emissive.set("#54250f")
          copy.emissiveIntensity = 0.14
          swordGrip.push(copy)
        }
      }
      return copy
    }

    object.material = Array.isArray(object.material)
      ? object.material.map(clone)
      : clone(object.material)
  })

  return { cloned, charredWood, emberCore, swordSteel, swordIron, swordGrip }
}

function makeEmberGeometry(count: number) {
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  const speeds = new Float32Array(count)
  const sizes = new Float32Array(count)
  const dormant = new Float32Array(count)
  const burst = new Float32Array(count)

  for (let index = 0; index < count; index += 1) {
    const seed = (index * 0.61803398875) % 1
    const angle = index * 2.39996322973
    const radius = 0.08 + (((index * 17) % 23) / 23) * 0.34
    positions[index * 3] = Math.cos(angle) * radius
    positions[index * 3 + 1] = 0
    positions[index * 3 + 2] = Math.sin(angle) * radius * 0.68
    seeds[index] = seed
    speeds[index] = 0.12 + ((index * 7) % 11) * 0.01
    sizes[index] = 4 + ((index * 13) % 7)
    dormant[index] = index < Math.ceil(count * 0.18) ? 1 : 0
    burst[index] = index < Math.ceil(count * 0.25) ? 1 : 0
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new BufferAttribute(positions, 3))
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1))
  geometry.setAttribute("aSpeed", new BufferAttribute(speeds, 1))
  geometry.setAttribute("aSize", new BufferAttribute(sizes, 1))
  geometry.setAttribute("aDormant", new BufferAttribute(dormant, 1))
  geometry.setAttribute("aBurst", new BufferAttribute(burst, 1))
  return geometry
}

type BonfireModelProps = {
  scene: Group
  response: MaterialResponse
  anchor: Vector3
  bounds: Box3
  phase: BonfirePhase
  ignitionStartedAt: number
  reducedMotion: boolean
  sectionRef: RefObject<HTMLElement | null>
  isMobile: boolean
  isFinePointer: boolean
}

function BonfireModel({
  scene,
  response,
  anchor,
  bounds,
  phase,
  ignitionStartedAt,
  reducedMotion,
  sectionRef,
  isMobile,
  isFinePointer,
}: BonfireModelProps) {
  const motionGroup = useRef<Group>(null)
  const fireLight = useRef<PointLight>(null)
  const fillLight = useRef<PointLight>(null)
  const swordLight = useRef<PointLight>(null)
  const ignition = useRef(0)
  const { camera, size } = useThree()
  const warmColor = useMemo(() => new Color("#ff9a45"), [])
  const peakColor = useMemo(() => new Color("#ffb870"), [])
  const center = useMemo(() => bounds.getCenter(new Vector3()), [bounds])
  const dimensions = useMemo(() => bounds.getSize(new Vector3()), [bounds])

  useEffect(() => {
    const perspectiveCamera = camera as PerspectiveCamera
    const verticalFov = MathUtils.degToRad(perspectiveCamera.fov)
    const aspect = size.width / Math.max(1, size.height)
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect)
    const verticalDistance = dimensions.y / (2 * Math.tan(verticalFov / 2))
    const horizontalDistance = dimensions.x / (2 * Math.tan(horizontalFov / 2))
    const distance =
      Math.max(verticalDistance, horizontalDistance, dimensions.z / 2) / 0.84
    const targetY = Math.max(VIEW_TARGET.y, center.y)
    perspectiveCamera.position.set(center.x, targetY + 0.24, distance + 0.2)
    perspectiveCamera.lookAt(center.x, targetY, center.z)
    perspectiveCamera.updateProjectionMatrix()
  }, [camera, center, dimensions, size.height, size.width])

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime
    const secondsSinceStart = ignitionStartedAt
      ? Math.max(0, (performance.now() - ignitionStartedAt) / 1000)
      : 0
    let desired = 0
    if (phase === "lit") {
      desired = 1
    } else if (phase === "igniting") {
      if (reducedMotion) {
        desired = MathUtils.clamp(secondsSinceStart / 0.6, 0, 1)
      } else {
        desired = MathUtils.smoothstep(secondsSinceStart, 0, 5.7)
      }
    }
    ignition.current = MathUtils.damp(
      ignition.current,
      desired,
      5.5,
      Math.min(delta, 0.05),
    )

    if (motionGroup.current) {
      motionGroup.current.rotation.y = reducedMotion
        ? 0
        : Math.sin(elapsed * 0.12) * 0.026 +
          (isFinePointer ? state.pointer.x * 0.045 : 0)
    }

    const flicker = reducedMotion
      ? 0.015 * Math.sin(elapsed * 0.9)
      : 0.07 * Math.sin(elapsed * 3.3) +
        0.035 * Math.sin(elapsed * 5.7 + 1.4) +
        0.02 * Math.sin(elapsed * 1.7 + 0.6)
    if (fireLight.current) {
      fireLight.current.intensity = ignition.current * 2.15 * (1 + flicker)
      fireLight.current.color
        .copy(warmColor)
        .lerp(peakColor, Math.max(0, flicker) * 2.5)
    }
    if (fillLight.current) {
      fillLight.current.intensity = ignition.current * 0.42
    }
    if (swordLight.current) {
      swordLight.current.intensity = 0.55 + ignition.current * 0.55
    }
    for (const material of response.charredWood) {
      material.emissiveIntensity = ignition.current * 0.34
    }
    for (const material of response.swordSteel) {
      material.emissiveIntensity = 0.15 + ignition.current * 0.1
    }
    for (const material of response.swordIron) {
      material.emissiveIntensity = 0.13 + ignition.current * 0.1
    }
    for (const material of response.swordGrip) {
      material.emissiveIntensity = 0.14 + ignition.current * 0.08
    }
    for (const material of response.emberCore) {
      const breath = reducedMotion
        ? 0.008
        : 0.018 * (0.5 + 0.5 * Math.sin(elapsed * 1.047))
      material.emissiveIntensity = 0.035 + breath + ignition.current * 0.24
    }

    const glow = ignition.current
    sectionRef.current?.style.setProperty(
      "--bonfire-glow-alpha",
      String(0.08 + glow * 0.2),
    )
    sectionRef.current?.style.setProperty(
      "--bonfire-glow-size",
      `${28 + glow * 10}%`,
    )
  })

  useEffect(
    () => () => {
      sectionRef.current?.style.setProperty("--bonfire-glow-alpha", "0.08")
      sectionRef.current?.style.setProperty("--bonfire-glow-size", "28%")
    },
    [sectionRef],
  )

  return (
    <group ref={motionGroup}>
      <primitive object={scene} dispose={null} />
      <pointLight
        ref={fireLight}
        position={[anchor.x, anchor.y, anchor.z + 0.12]}
        color="#ff9a45"
        intensity={0}
        distance={4.8}
        decay={2}
      />
      <pointLight
        ref={fillLight}
        position={[anchor.x, anchor.y - 0.18, anchor.z + 0.25]}
        color="#ff8740"
        intensity={0}
        distance={2.6}
        decay={2}
      />
      <pointLight
        ref={swordLight}
        position={[0.28, 1.22, 0.2]}
        color="#d8d2c8"
        intensity={0.55}
        distance={2.4}
        decay={2}
      />
      <BonfireEffects
        anchor={anchor}
        ignition={ignition}
        ignitionStartedAt={ignitionStartedAt}
        phase={phase}
        reducedMotion={reducedMotion}
        isMobile={isMobile}
      />
    </group>
  )
}

function BonfireEffects({
  anchor,
  ignition,
  ignitionStartedAt,
  phase,
  reducedMotion,
  isMobile,
}: {
  anchor: Vector3
  ignition: { current: number }
  ignitionStartedAt: number
  phase: BonfirePhase
  reducedMotion: boolean
  isMobile: boolean
}) {
  const flameGeometry = useMemo(() => new PlaneGeometry(1, 1, 1, 18), [])
  const flameMaterials = useMemo(
    () =>
      FLAME_LAYERS.map(
        (layer) =>
          new ShaderMaterial({
            uniforms: {
              uTime: { value: 0 },
              uIgnition: { value: 0 },
              uPhase: { value: layer.phase },
              uOpacity: { value: layer.opacity ?? 0.72 },
            },
            vertexShader: flameVertexShader,
            fragmentShader: flameFragmentShader,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            side: DoubleSide,
            blending: AdditiveBlending,
            toneMapped: false,
          }),
      ),
    [],
  )
  const flameMeshes = useRef<(Mesh | null)[]>([])
  const particleGeometry = useMemo(
    () =>
      makeEmberGeometry(
        reducedMotion
          ? REDUCED_PARTICLES
          : isMobile
            ? MOBILE_PARTICLES
            : DESKTOP_PARTICLES,
      ),
    [isMobile, reducedMotion],
  )
  const emberMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uIgnition: { value: 0 },
          uBurstAmount: { value: 0 },
        },
        vertexShader: emberVertexShader,
        fragmentShader: emberFragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  const glowGeometry = useMemo(() => new PlaneGeometry(2.5, 1.65), [])
  const glowMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uIgnition: { value: 0 },
          uTime: { value: 0 },
        },
        vertexShader: groundGlowVertexShader,
        fragmentShader: groundGlowFragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )

  useEffect(
    () => () => {
      flameGeometry.dispose()
      flameMaterials.forEach((material) => material.dispose())
      particleGeometry.dispose()
      emberMaterial.dispose()
      glowGeometry.dispose()
      glowMaterial.dispose()
    },
    [
      emberMaterial,
      flameGeometry,
      flameMaterials,
      glowGeometry,
      glowMaterial,
      particleGeometry,
    ],
  )

  useFrame((state) => {
    const elapsed = reducedMotion
      ? state.clock.elapsedTime * 0.12
      : state.clock.elapsedTime
    const value = ignition.current
    const timeSinceStart = ignitionStartedAt
      ? Math.max(0, (performance.now() - ignitionStartedAt) / 1000)
      : 0
    const burst =
      !reducedMotion && phase === "igniting"
        ? 1 - MathUtils.smoothstep(timeSinceStart, 0.12, 0.82)
        : 0

    for (let index = 0; index < flameMaterials.length; index += 1) {
      const layer = FLAME_LAYERS[index]
      const amount = MathUtils.smoothstep(
        value,
        layer.ignitionStart,
        layer.ignitionEnd,
      )
      const material = flameMaterials[index]
      material.uniforms.uTime.value = elapsed
      material.uniforms.uIgnition.value = amount
      const mesh = flameMeshes.current[index]
      if (!mesh) continue

      const heightFlicker = reducedMotion
        ? 1
        : 1 + Math.sin(elapsed * (1.8 + index * 0.11) + layer.phase) * 0.035
      const widthFlicker = reducedMotion
        ? 1
        : 1 +
          Math.sin(elapsed * (1.5 + index * 0.13) + layer.phase * 1.3) * 0.045
      const growth = MathUtils.smoothstep(amount, 0, 1)
      const height = layer.height * growth * heightFlicker
      const width = layer.width * (0.32 + growth * 0.68) * widthFlicker
      mesh.visible = amount > 0.008
      mesh.scale.set(width, height, 1)
      mesh.position.set(layer.x, layer.y + height / 2, layer.z)
      if (!reducedMotion) {
        mesh.rotation.z =
          Math.sin(elapsed * (0.7 + index * 0.08) + layer.phase) * 0.025
      }
    }

    emberMaterial.uniforms.uTime.value = elapsed
    emberMaterial.uniforms.uIgnition.value = value
    emberMaterial.uniforms.uBurstAmount.value = burst
    glowMaterial.uniforms.uTime.value = elapsed
    glowMaterial.uniforms.uIgnition.value = value
  })

  return (
    <group position={anchor}>
      {FLAME_LAYERS.map((layer, index) => (
        <mesh
          key={layer.phase}
          ref={(mesh) => {
            flameMeshes.current[index] = mesh
          }}
          geometry={flameGeometry}
          material={flameMaterials[index]}
          position={[layer.x, layer.y, layer.z]}
          rotation={[0, layer.yaw, 0]}
          scale={[layer.width, 0.01, 1]}
          visible={false}
          dispose={null}
        />
      ))}
      <points
        geometry={particleGeometry}
        material={emberMaterial}
        frustumCulled={false}
        dispose={null}
      />
      <mesh
        geometry={glowGeometry}
        material={glowMaterial}
        position={[0.2, -0.31, 0.25]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1}
        dispose={null}
      />
    </group>
  )
}

type LoadedModelProps = Omit<BonfireSceneProps, "onModelReady"> & {
  onReady: (anchorFound: boolean) => void
  isMobile: boolean
  isFinePointer: boolean
}

function LoadedModel({ onReady, ...props }: LoadedModelProps) {
  const { scene } = useGLTF(MODEL_URL)
  const prepared = useMemo(() => {
    const clonedScene = scene.clone(true)
    const response = cloneMaterials(clonedScene)
    clonedScene.updateMatrixWorld(true)
    const anchorObject = clonedScene.getObjectByName("FireAnchor")
    const anchor = anchorObject
      ? anchorObject.getWorldPosition(new Vector3())
      : FALLBACK_ANCHOR.clone()
    const bounds = new Box3().setFromObject(clonedScene)
    return {
      scene: clonedScene,
      response,
      anchor,
      anchorFound: Boolean(anchorObject),
      bounds,
    }
  }, [scene])

  useEffect(() => {
    onReady(prepared.anchorFound)
    return () =>
      prepared.response.cloned.forEach((material) => material.dispose())
  }, [onReady, prepared])

  return <BonfireModel {...props} {...prepared} />
}

function BonfireCanvas({
  phase,
  ignitionStartedAt,
  reducedMotion,
  sectionRef,
  onModelReady,
  isMobile,
  isFinePointer,
  isActive,
}: BonfireSceneProps & {
  isMobile: boolean
  isFinePointer: boolean
  isActive: boolean
}) {
  const handleReady = (anchorFound: boolean) => onModelReady(anchorFound)
  return (
    <Canvas
      className="bonfire-canvas"
      camera={{ position: [0, 1.45, 5.2], fov: 30, near: 0.1, far: 60 }}
      dpr={reducedMotion ? [1, 1.1] : isMobile ? [1, 1.25] : [1, 1.75]}
      frameloop={isActive ? "always" : "never"}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
        outputColorSpace: SRGBColorSpace,
      }}
      fallback={null}
    >
      <hemisphereLight args={["#7f8ba4", "#16120f", 0.74]} />
      <directionalLight
        color="#b5c1d7"
        position={[-3.5, 3, 4.5]}
        intensity={1.35}
      />
      <directionalLight
        color="#697da2"
        position={[3.2, 2.8, -3.4]}
        intensity={1.05}
      />
      <Suspense fallback={null}>
        <LoadedModel
          phase={phase}
          ignitionStartedAt={ignitionStartedAt}
          reducedMotion={reducedMotion}
          sectionRef={sectionRef}
          onReady={handleReady}
          isMobile={isMobile}
          isFinePointer={isFinePointer}
        />
      </Suspense>
    </Canvas>
  )
}

export default function BonfireScene(props: BonfireSceneProps) {
  const [supportChecked, setSupportChecked] = useState(false)
  const [webglAvailable, setWebglAvailable] = useState(false)
  const [reducedData, setReducedData] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isFinePointer, setIsFinePointer] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const handleModelReady = useCallback(
    (anchorFound: boolean) => {
      setModelReady(true)
      props.onModelReady(anchorFound)
    },
    [props.onModelReady],
  )

  useEffect(() => {
    const canvas = document.createElement("canvas")
    const context =
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ??
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true })
    setWebglAvailable(Boolean(context))
    setReducedData(window.matchMedia("(prefers-reduced-data: reduce)").matches)
    setIsMobile(window.matchMedia("(max-width: 800px)").matches)
    setIsFinePointer(window.matchMedia("(pointer: fine)").matches)
    setSupportChecked(true)
  }, [])

  useEffect(() => {
    const target = props.sectionRef.current
    if (!target) return
    let visible = false
    const updateActive = () => setIsActive(visible && !document.hidden)
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        updateActive()
      },
      { threshold: 0.01 },
    )
    observer.observe(target)
    document.addEventListener("visibilitychange", updateActive)
    return () => {
      observer.disconnect()
      document.removeEventListener("visibilitychange", updateActive)
    }
  }, [props.sectionRef])

  const fallback = <BonfireFallback kindled={props.phase !== "dormant"} />

  if (!supportChecked || !webglAvailable || reducedData) {
    return <div className="bonfire-viewer">{fallback}</div>
  }

  return (
    <div className="bonfire-viewer">
      {!modelReady && fallback}
      <ModelErrorBoundary fallback={fallback}>
        <BonfireCanvas
          {...props}
          onModelReady={handleModelReady}
          isMobile={isMobile}
          isFinePointer={isFinePointer}
          isActive={isActive}
        />
      </ModelErrorBoundary>
    </div>
  )
}
