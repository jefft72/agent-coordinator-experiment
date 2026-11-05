import { useEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Material, Mesh, Object3D } from 'three';

const DIM_OPACITY = 0.62;
const DIM_MS = 260;

interface DimBase {
  opacity: number;
  transparent: boolean;
}

/** Materials are cloned once per mesh so dimming never leaks into materials shared across objects. */
function collectMaterials(root: Object3D): Material[] {
  const out: Material[] = [];
  root.traverse((node) => {
    if (!(node as Mesh).isMesh) return;
    const mesh = node as Mesh;
    if (!mesh.userData.dimCloned) {
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => m.clone())
        : mesh.material.clone();
      mesh.userData.dimCloned = true;
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material.userData.dimBase) {
        material.userData.dimBase = {
          opacity: material.opacity,
          transparent: material.transparent,
        } satisfies DimBase;
      }
      out.push(material);
    }
  });
  return out;
}

function applyOpacity(material: Material, factor: number) {
  const base = material.userData.dimBase as DimBase;
  material.opacity = base.opacity * factor;
  material.transparent = factor < 1 ? true : base.transparent;
}

/**
 * Lowers every material under `ref` to ~62% opacity while `dimmed` is true and restores it on undim.
 * Opacity eases over DIM_MS unless reducedMotion is set, in which case it snaps.
 */
export function useDimMaterials(ref: RefObject<Object3D | null>, dimmed: boolean, reducedMotion: boolean) {
  const invalidate = useThree((s) => s.invalidate);
  const anim = useRef({ from: 1, to: 1, start: -1, current: 1 });

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const target = dimmed ? DIM_OPACITY : 1;
    const state = anim.current;
    if (reducedMotion) {
      state.from = state.to = state.current = target;
      state.start = -1;
      for (const material of collectMaterials(root)) applyOpacity(material, target);
    } else {
      state.from = state.current;
      state.to = target;
      state.start = performance.now();
    }
    invalidate();
  }, [ref, dimmed, reducedMotion, invalidate]);

  useFrame(() => {
    const state = anim.current;
    if (state.start < 0) return;
    const root = ref.current;
    if (!root) return;
    const t = Math.min(1, (performance.now() - state.start) / DIM_MS);
    state.current = state.from + (state.to - state.from) * t;
    for (const material of collectMaterials(root)) applyOpacity(material, state.current);
    if (t >= 1) state.start = -1;
    else invalidate();
  });
}
