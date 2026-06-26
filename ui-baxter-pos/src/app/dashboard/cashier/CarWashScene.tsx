'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

type VehicleKind = 'car' | 'motorcycle';
type Phase = 'washing' | 'paying';

interface CarWashSceneProps {
  plate: string;
  model?: string;
  brand?: string;
  color?: string;
  isMember: boolean;
  vehicleKind?: VehicleKind;
  phase?: Phase;
  className?: string;
}

const COLOR_MAP: Record<string, string> = {
  black: '#111827', hitam: '#111827',
  white: '#f8fafc', putih: '#f8fafc',
  silver: '#cbd5e1', grey: '#64748b', gray: '#64748b', abu: '#64748b',
  red: '#dc2626', merah: '#dc2626',
  blue: '#2563eb', biru: '#2563eb',
  green: '#16a34a', hijau: '#16a34a',
  yellow: '#facc15', kuning: '#facc15',
  orange: '#f97316', oranye: '#f97316',
  brown: '#92400e', coklat: '#92400e',
  purple: '#7c3aed', ungu: '#7c3aed',
  pink: '#db2777', gold: '#d97706', emas: '#d97706',
};

const resolveColor = (value: string | undefined, isMember: boolean) => {
  if (!isMember) return '#111827';
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return '#2563eb';
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) return normalized;
  const key = Object.keys(COLOR_MAP).find(item => normalized.includes(item));
  return key ? COLOR_MAP[key] : '#2563eb';
};

const plateHash = (plate: string) => {
  let h = 0;
  for (let i = 0; i < plate.length; i++) h = (h * 31 + plate.charCodeAt(i)) >>> 0;
  return h % 3;
};

const rb = (w: number, h: number, d: number, r: number, s = 4) =>
  new RoundedBoxGeometry(w, h, d, s, r);

const createPlateTexture = (plate: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 12;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 70px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((plate || '-').toUpperCase(), canvas.width / 2, 92, 430);
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillText('BAXTER WASH', canvas.width / 2, 154, 320);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const makeCarWheel = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  paint: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rimMat: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tireMat: any,
  radius: number,
  width: number,
) => {
  const mount = new THREE.Group();
  // tilt so cylinder axis aligns with world X (lateral axle)
  mount.rotation.x = Math.PI / 2;

  const spin = new THREE.Group();
  mount.add(spin);

  // tyre
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 36), tireMat);
  tyre.castShadow = true;
  spin.add(tyre);

  // rim disc
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width + 0.01, 28), rimMat);
  spin.add(rim);

  // hub cap
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, width + 0.02, 16), paint);
  spin.add(hub);

  // 5 spokes
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.09, radius * 1.1, width * 0.22),
      rimMat,
    );
    spoke.rotation.z = angle;
    spoke.castShadow = true;
    spin.add(spoke);
  }

  return { mount, spin };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const addCylinderBetween = (parent: any, start: any, end: any, radius: number, material: any) => {
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 16), material);
  cyl.position.copy(start).add(end).multiplyScalar(0.5);
  cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  cyl.castShadow = true;
  parent.add(cyl);
};

// ── Executive Sedan ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildSedan = (paintColor: string, plateTexture: any) => {
  const car = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: paintColor, roughness: 0.22, metalness: 0.14, clearcoat: 1.0, clearcoatRoughness: 0.12 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#0c2340', roughness: 0.1, metalness: 0.0, transparent: true, opacity: 0.78, clearcoat: 0.6 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#080c10', roughness: 0.82 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#dde4ef', roughness: 0.18, metalness: 0.72 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.55 });
  const lightMat = new THREE.MeshBasicMaterial({ color: '#fde68a' });
  const tailMat = new THREE.MeshBasicMaterial({ color: '#ef4444' });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.1, metalness: 0.9 });

  // lower body sill
  const sill = new THREE.Mesh(rb(4.1, 0.28, 1.72, 0.1, 6), darkMat);
  sill.position.y = -0.18;
  sill.castShadow = true;
  car.add(sill);

  // main body
  const body = new THREE.Mesh(rb(3.95, 0.62, 1.64, 0.28, 7), paint);
  body.position.y = 0.16;
  body.castShadow = true;
  car.add(body);

  // long bonnet / hood
  const hood = new THREE.Mesh(rb(1.48, 0.18, 1.46, 0.14, 6), paint);
  hood.position.set(1.46, 0.57, 0);
  hood.rotation.z = -0.04;
  hood.castShadow = true;
  car.add(hood);

  // front nose
  const nose = new THREE.Mesh(rb(0.9, 0.36, 1.36, 0.22, 6), paint);
  nose.position.set(1.9, 0.26, 0);
  nose.rotation.z = -0.1;
  nose.castShadow = true;
  car.add(nose);

  // rear trunk
  const trunk = new THREE.Mesh(rb(0.78, 0.42, 1.5, 0.18, 6), paint);
  trunk.position.set(-1.72, 0.28, 0);
  trunk.rotation.z = 0.04;
  trunk.castShadow = true;
  car.add(trunk);

  // greenhouse / cabin — fastback slope
  const cabin = new THREE.Mesh(rb(1.82, 0.7, 1.18, 0.26, 7), glass);
  cabin.position.set(-0.14, 0.77, 0);
  cabin.castShadow = true;
  car.add(cabin);

  const roof = new THREE.Mesh(rb(1.28, 0.13, 1.06, 0.1, 5), paint);
  roof.position.set(-0.22, 1.18, 0);
  car.add(roof);

  // windshield
  const wshield = new THREE.Mesh(rb(0.07, 0.54, 1.0, 0.05, 4), glass);
  wshield.position.set(0.79, 0.87, 0);
  wshield.rotation.z = -0.44;
  car.add(wshield);

  // rear glass — fastback aggressive
  const rGlass = new THREE.Mesh(rb(0.07, 0.5, 0.96, 0.05, 4), glass);
  rGlass.position.set(-1.12, 0.82, 0);
  rGlass.rotation.z = 0.48;
  car.add(rGlass);

  // grille
  const grille = new THREE.Mesh(rb(0.07, 0.2, 0.9, 0.04, 4), darkMat);
  grille.position.set(2.1, 0.22, 0);
  grille.rotation.y = Math.PI / 2;
  car.add(grille);

  // headlights
  [-0.48, 0.48].forEach(z => {
    const hl = new THREE.Mesh(rb(0.07, 0.13, 0.32, 0.03), lightMat);
    hl.position.set(2.15, 0.31, z);
    car.add(hl);
    const chrome = new THREE.Mesh(rb(0.06, 0.16, 0.36, 0.03), chromeMat);
    chrome.position.set(2.14, 0.29, z);
    car.add(chrome);
  });

  // taillights
  [-0.47, 0.47].forEach(z => {
    const tl = new THREE.Mesh(rb(0.07, 0.12, 0.28, 0.03), tailMat);
    tl.position.set(-2.1, 0.28, z);
    car.add(tl);
  });

  // side mirrors
  [-0.84, 0.84].forEach(z => {
    const m = new THREE.Mesh(rb(0.2, 0.08, 0.07, 0.03), darkMat);
    m.position.set(0.78, 0.76, z);
    car.add(m);
  });

  // number plate
  const plateMat = new THREE.MeshBasicMaterial({ map: plateTexture });
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.28), plateMat);
  fp.position.set(2.18, 0.06, 0);
  fp.rotation.y = Math.PI / 2;
  car.add(fp);

  // wheels — sedan: radius 0.34, width 0.26
  const wheelRadius = 0.34;
  const wheelPositions: [number, number, number][] = [
    [-1.32, -0.36 + wheelRadius, -0.88],
    [1.32, -0.36 + wheelRadius, -0.88],
    [-1.32, -0.36 + wheelRadius, 0.88],
    [1.32, -0.36 + wheelRadius, 0.88],
  ];
  const wheelSpins: ReturnType<typeof THREE.Group>[] = [];
  wheelPositions.forEach(pos => {
    const { mount, spin } = makeCarWheel(paint, rimMat, tireMat, wheelRadius, 0.26);
    mount.position.set(...pos);
    car.add(mount);
    wheelSpins.push(spin);

    // fender arch
    const arch = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius + 0.055, 0.032, 10, 28, Math.PI), darkMat);
    arch.position.set(pos[0], pos[1], pos[2]);
    arch.rotation.set(Math.PI / 2, 0, pos[2] > 0 ? 0 : Math.PI);
    car.add(arch);
  });

  car.userData.wheels = wheelSpins;
  car.userData.wheelRadius = wheelRadius;
  car.rotation.y = -0.62;
  car.scale.setScalar(1.02);
  return car;
};

// ── Urban SUV ────────────────────────────────────────────────────────────────
const buildSUV = (paintColor: string, plateTexture: any) => {
  const car = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: paintColor, roughness: 0.28, metalness: 0.18, clearcoat: 0.85, clearcoatRoughness: 0.18 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#0c2035', roughness: 0.12, transparent: true, opacity: 0.75, clearcoat: 0.5 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#060a0e', roughness: 0.88 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#c8d0dc', roughness: 0.22, metalness: 0.62 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.58 });
  const lightMat = new THREE.MeshBasicMaterial({ color: '#fde68a' });
  const tailMat = new THREE.MeshBasicMaterial({ color: '#ef4444' });
  const plastic = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.75 });

  // lower cladding
  const cladding = new THREE.Mesh(rb(4.0, 0.34, 1.88, 0.1, 6), plastic);
  cladding.position.y = -0.22;
  cladding.castShadow = true;
  car.add(cladding);

  // main body — tall
  const body = new THREE.Mesh(rb(3.72, 0.78, 1.78, 0.3, 7), paint);
  body.position.y = 0.22;
  body.castShadow = true;
  car.add(body);

  // hood
  const hood = new THREE.Mesh(rb(1.18, 0.2, 1.62, 0.16, 6), paint);
  hood.position.set(1.42, 0.72, 0);
  hood.castShadow = true;
  car.add(hood);

  // chunky front bumper
  const fbumper = new THREE.Mesh(rb(0.76, 0.48, 1.84, 0.2, 6), plastic);
  fbumper.position.set(2.0, 0.1, 0);
  fbumper.castShadow = true;
  car.add(fbumper);

  // rear bumper
  const rbumper = new THREE.Mesh(rb(0.68, 0.44, 1.82, 0.18, 6), plastic);
  rbumper.position.set(-1.98, 0.08, 0);
  rbumper.castShadow = true;
  car.add(rbumper);

  // greenhouse — tall upright
  const cabin = new THREE.Mesh(rb(1.68, 0.82, 1.38, 0.24, 7), glass);
  cabin.position.set(-0.1, 0.93, 0);
  cabin.castShadow = true;
  car.add(cabin);

  const roof = new THREE.Mesh(rb(1.52, 0.14, 1.3, 0.1, 5), paint);
  roof.position.set(-0.1, 1.41, 0);
  car.add(roof);

  // roof rails
  [-0.58, 0.58].forEach(z => {
    const rail = new THREE.Mesh(rb(1.3, 0.06, 0.05, 0.02, 3), darkMat);
    rail.position.set(-0.1, 1.5, z);
    car.add(rail);
  });

  // windshield
  const wshield = new THREE.Mesh(rb(0.08, 0.62, 1.22, 0.06, 4), glass);
  wshield.position.set(0.72, 1.02, 0);
  wshield.rotation.z = -0.36;
  car.add(wshield);

  const rGlass = new THREE.Mesh(rb(0.08, 0.56, 1.18, 0.06, 4), glass);
  rGlass.position.set(-0.98, 1.0, 0);
  rGlass.rotation.z = 0.3;
  car.add(rGlass);

  // headlights
  [-0.54, 0.54].forEach(z => {
    const hl = new THREE.Mesh(rb(0.09, 0.16, 0.44, 0.04), lightMat);
    hl.position.set(2.16, 0.56, z);
    car.add(hl);
  });

  // taillights
  [-0.52, 0.52].forEach(z => {
    const tl = new THREE.Mesh(rb(0.09, 0.22, 0.48, 0.04), tailMat);
    tl.position.set(-2.06, 0.5, z);
    car.add(tl);
  });

  // mirrors
  [-0.92, 0.92].forEach(z => {
    const m = new THREE.Mesh(rb(0.24, 0.1, 0.08, 0.03), darkMat);
    m.position.set(0.74, 0.88, z);
    car.add(m);
  });

  const plateMat = new THREE.MeshBasicMaterial({ map: plateTexture });
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.3), plateMat);
  fp.position.set(2.22, 0.1, 0);
  fp.rotation.y = Math.PI / 2;
  car.add(fp);

  // wheels — SUV: bigger radius 0.42, width 0.3
  const wheelRadius = 0.42;
  const wheelPositions: [number, number, number][] = [
    [-1.28, -0.44 + wheelRadius, -0.94],
    [1.28, -0.44 + wheelRadius, -0.94],
    [-1.28, -0.44 + wheelRadius, 0.94],
    [1.28, -0.44 + wheelRadius, 0.94],
  ];
  const wheelSpins: ReturnType<typeof THREE.Group>[] = [];
  wheelPositions.forEach(pos => {
    const { mount, spin } = makeCarWheel(paint, rimMat, tireMat, wheelRadius, 0.3);
    mount.position.set(...pos);
    car.add(mount);
    wheelSpins.push(spin);

    const arch = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius + 0.065, 0.038, 10, 30, Math.PI), plastic);
    arch.position.set(pos[0], pos[1], pos[2]);
    arch.rotation.set(Math.PI / 2, 0, pos[2] > 0 ? 0 : Math.PI);
    car.add(arch);
  });

  car.userData.wheels = wheelSpins;
  car.userData.wheelRadius = wheelRadius;
  car.rotation.y = -0.62;
  car.scale.setScalar(0.98);
  return car;
};

// ── Sport Hatch / Coupe ──────────────────────────────────────────────────────
const buildHatch = (paintColor: string, plateTexture: any) => {
  const car = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: paintColor, roughness: 0.18, metalness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.08 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#071820', roughness: 0.08, transparent: true, opacity: 0.8, clearcoat: 0.7 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#040608', roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#e8ecf4', roughness: 0.14, metalness: 0.82 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.5 });
  const lightMat = new THREE.MeshBasicMaterial({ color: '#fef9c3' });
  const tailMat = new THREE.MeshBasicMaterial({ color: '#f87171' });
  const carbonMat = new THREE.MeshStandardMaterial({ color: '#1a1a2e', roughness: 0.42, metalness: 0.08 });

  // sill / skirt — ceper
  const skirt = new THREE.Mesh(rb(3.82, 0.22, 1.7, 0.08, 6), carbonMat);
  skirt.position.y = -0.22;
  skirt.castShadow = true;
  car.add(skirt);

  // main body — low
  const body = new THREE.Mesh(rb(3.68, 0.52, 1.62, 0.26, 7), paint);
  body.position.y = 0.08;
  body.castShadow = true;
  car.add(body);

  // hood — short aggressive slope
  const hood = new THREE.Mesh(rb(1.02, 0.14, 1.44, 0.12, 6), paint);
  hood.position.set(1.52, 0.44, 0);
  hood.rotation.z = -0.06;
  hood.castShadow = true;
  car.add(hood);

  // front splitter
  const splitter = new THREE.Mesh(rb(0.6, 0.07, 1.64, 0.04, 5), carbonMat);
  splitter.position.set(1.98, -0.2, 0);
  car.add(splitter);

  // front nose
  const nose = new THREE.Mesh(rb(0.72, 0.32, 1.46, 0.18, 6), paint);
  nose.position.set(1.88, 0.22, 0);
  nose.rotation.z = -0.12;
  nose.castShadow = true;
  car.add(nose);

  // rear — short hatch
  const rear = new THREE.Mesh(rb(0.58, 0.48, 1.56, 0.16, 6), paint);
  rear.position.set(-1.64, 0.2, 0);
  rear.rotation.z = 0.1;
  rear.castShadow = true;
  car.add(rear);

  // diffuser
  const diff = new THREE.Mesh(rb(0.54, 0.14, 1.42, 0.06, 4), carbonMat);
  diff.position.set(-1.9, -0.18, 0);
  car.add(diff);

  // greenhouse — aggressive rake, drops fast
  const cabin = new THREE.Mesh(rb(1.52, 0.66, 1.14, 0.24, 7), glass);
  cabin.position.set(-0.2, 0.68, 0);
  cabin.castShadow = true;
  car.add(cabin);

  const roof = new THREE.Mesh(rb(1.02, 0.12, 1.02, 0.1, 5), paint);
  roof.position.set(-0.3, 1.08, 0);
  car.add(roof);

  // rear spoiler
  const spoilerBase = new THREE.Mesh(rb(0.16, 0.22, 1.2, 0.04, 4), carbonMat);
  spoilerBase.position.set(-1.42, 0.98, 0);
  car.add(spoilerBase);
  const spoilerWing = new THREE.Mesh(rb(0.82, 0.06, 1.38, 0.03, 3), carbonMat);
  spoilerWing.position.set(-1.42, 1.13, 0);
  car.add(spoilerWing);

  // windshield — steep
  const wshield = new THREE.Mesh(rb(0.07, 0.56, 1.02, 0.05, 4), glass);
  wshield.position.set(0.68, 0.8, 0);
  wshield.rotation.z = -0.54;
  car.add(wshield);

  const rGlass = new THREE.Mesh(rb(0.07, 0.44, 0.96, 0.05, 4), glass);
  rGlass.position.set(-0.98, 0.76, 0);
  rGlass.rotation.z = 0.6;
  car.add(rGlass);

  // headlights — thin strip
  [-0.46, 0.46].forEach(z => {
    const hl = new THREE.Mesh(rb(0.08, 0.08, 0.38, 0.03), lightMat);
    hl.position.set(2.1, 0.26, z);
    car.add(hl);
  });

  // taillights — wide strip
  [-0.44, 0.44].forEach(z => {
    const tl = new THREE.Mesh(rb(0.08, 0.1, 0.52, 0.03), tailMat);
    tl.position.set(-2.02, 0.24, z);
    car.add(tl);
  });
  // centre brake light bar
  const brakebar = new THREE.Mesh(rb(0.07, 0.06, 0.9, 0.03), tailMat);
  brakebar.position.set(-2.02, 0.28, 0);
  car.add(brakebar);

  // mirrors
  [-0.82, 0.82].forEach(z => {
    const m = new THREE.Mesh(rb(0.18, 0.07, 0.06, 0.02), darkMat);
    m.position.set(0.7, 0.68, z);
    car.add(m);
  });

  const plateMat = new THREE.MeshBasicMaterial({ map: plateTexture });
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.26), plateMat);
  fp.position.set(2.14, -0.04, 0);
  fp.rotation.y = Math.PI / 2;
  car.add(fp);

  // wheels — big 0.38, narrow 0.28
  const wheelRadius = 0.38;
  const wheelPositions: [number, number, number][] = [
    [-1.22, -0.38 + wheelRadius, -0.86],
    [1.22, -0.38 + wheelRadius, -0.86],
    [-1.22, -0.38 + wheelRadius, 0.86],
    [1.22, -0.38 + wheelRadius, 0.86],
  ];
  const wheelSpins: ReturnType<typeof THREE.Group>[] = [];
  wheelPositions.forEach(pos => {
    const { mount, spin } = makeCarWheel(paint, rimMat, tireMat, wheelRadius, 0.28);
    mount.position.set(...pos);
    car.add(mount);
    wheelSpins.push(spin);

    const arch = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius + 0.05, 0.03, 10, 28, Math.PI), darkMat);
    arch.position.set(pos[0], pos[1], pos[2]);
    arch.rotation.set(Math.PI / 2, 0, pos[2] > 0 ? 0 : Math.PI);
    car.add(arch);
  });

  car.userData.wheels = wheelSpins;
  car.userData.wheelRadius = wheelRadius;
  car.rotation.y = -0.62;
  car.scale.setScalar(1.04);
  return car;
};

const buildCar = (paintColor: string, plateTexture: any, variant: number) => {
  if (variant === 1) return buildSUV(paintColor, plateTexture);
  if (variant === 2) return buildHatch(paintColor, plateTexture);
  return buildSedan(paintColor, plateTexture);
};

// ── Motorcycle ───────────────────────────────────────────────────────────────
const buildMotorcycle = (paintColor: string, plateTexture: any) => {
  const bike = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: paintColor, roughness: 0.28, metalness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.18 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#020617', roughness: 0.72 });
  const metal = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.24, metalness: 0.72 });
  const dark = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.48, metalness: 0.18 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.7 });

  const wheelRadius = 0.55;

  const makeWheel = (x: number) => {
    const mount = new THREE.Group();
    mount.position.set(x, -0.25, 0);
    mount.rotation.z = Math.PI / 2; // lateral axle = world X

    const spin = new THREE.Group();
    mount.add(spin);

    const tyre = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius, 0.12, 18, 54), tireMat);
    tyre.castShadow = true;
    spin.add(tyre);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 12, 36), metal);
    spin.add(rim);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.26, 24), metal);
    spin.add(hub);

    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, wheelRadius * 1.9), metal);
      spoke.rotation.z = angle;
      spin.add(spoke);
    }

    bike.add(mount);
    return spin;
  };

  const spinFront = makeWheel(-1.45);
  const spinRear = makeWheel(1.45);

  addCylinderBetween(bike, new THREE.Vector3(-1.45, -0.2, 0), new THREE.Vector3(-0.1, 0.65, 0), 0.045, dark);
  addCylinderBetween(bike, new THREE.Vector3(1.45, -0.2, 0), new THREE.Vector3(-0.1, 0.65, 0), 0.045, dark);
  addCylinderBetween(bike, new THREE.Vector3(-0.95, -0.05, 0), new THREE.Vector3(0.95, -0.05, 0), 0.045, dark);
  addCylinderBetween(bike, new THREE.Vector3(1.22, 0.12, 0), new THREE.Vector3(1.62, 0.82, 0), 0.04, metal);
  addCylinderBetween(bike, new THREE.Vector3(1.35, -0.08, 0), new THREE.Vector3(1.76, 0.65, 0), 0.035, metal);

  const tank = new THREE.Mesh(rb(1.1, 0.42, 0.62, 0.18), paint);
  tank.position.set(0.05, 0.72, 0);
  tank.rotation.z = -0.08;
  tank.castShadow = true;
  bike.add(tank);

  const seat = new THREE.Mesh(rb(1.18, 0.18, 0.48, 0.12), rubber);
  seat.position.set(-0.72, 0.88, 0);
  seat.rotation.z = 0.08;
  bike.add(seat);

  const engine = new THREE.Mesh(rb(0.66, 0.52, 0.56, 0.08), metal);
  engine.position.set(-0.1, 0.18, 0);
  engine.castShadow = true;
  bike.add(engine);

  const frontFairing = new THREE.Mesh(rb(0.44, 0.5, 0.58, 0.14), paint);
  frontFairing.position.set(1.45, 0.82, 0);
  frontFairing.rotation.z = -0.35;
  frontFairing.castShadow = true;
  bike.add(frontFairing);

  const rearFender = new THREE.Mesh(rb(0.9, 0.13, 0.54, 0.1), paint);
  rearFender.position.set(-1.45, 0.26, 0);
  rearFender.rotation.z = 0.12;
  bike.add(rearFender);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.06, 0.06), dark);
  handle.position.set(1.78, 1.05, 0);
  handle.rotation.z = -0.32;
  bike.add(handle);

  const plateMat = new THREE.MeshBasicMaterial({ map: plateTexture });
  const plateMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.25), plateMat);
  plateMesh.position.set(-1.9, 0.36, 0);
  plateMesh.rotation.y = -Math.PI / 2;
  bike.add(plateMesh);

  bike.userData.wheels = [spinFront, spinRear];
  bike.userData.wheelRadius = wheelRadius;
  bike.rotation.y = -0.45;
  bike.scale.setScalar(1.08);
  return bike;
};

export default function CarWashScene({
  plate,
  model,
  brand,
  color,
  isMember,
  vehicleKind = 'car',
  phase = 'washing',
  className = '',
}: CarWashSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const vehicleColor = useMemo(() => resolveColor(color, isMember), [color, isMember]);
  const isMotorcycle = vehicleKind === 'motorcycle';
  const carVariant = useMemo(() => plateHash(plate), [plate]);

  const phaseRef = useRef<Phase>(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f1f5f9');

    // ── Environment map (PMREM) ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    mount.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(4.9, 3.25, 6.4);
    camera.lookAt(0, 0.45, 0);

    const hemi = new THREE.HemisphereLight('#ffffff', '#cbd5e1', 1.8);
    scene.add(hemi);

    const key = new THREE.DirectionalLight('#ffffff', 2.6);
    key.position.set(3.2, 6, 4.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);

    const fill = new THREE.PointLight('#38bdf8', 1.0, 14);
    fill.position.set(-4, 2, 3);
    scene.add(fill);

    // floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 10),
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.8, metalness: 0.02 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.58;
    floor.receiveShadow = true;
    scene.add(floor);

    const group = new THREE.Group();
    scene.add(group);

    // wash bay arch
    const bayMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.5, metalness: 0.12 });
    const leftPost = new THREE.Mesh(rb(0.18, 2.7, 0.18, 0.04), bayMat);
    leftPost.position.set(0, 0.8, -1.75);
    const rightPost = leftPost.clone();
    rightPost.position.z = 1.75;
    const topBar = new THREE.Mesh(rb(0.22, 0.18, 3.68, 0.04), bayMat);
    topBar.position.set(0, 2.18, 0);
    group.add(leftPost, rightPost, topBar);

    const brushMat = new THREE.MeshStandardMaterial({ color: isMotorcycle ? '#22c55e' : '#0ea5e9', roughness: 0.42 });
    const brushes: ReturnType<typeof THREE.Group>[] = [];
    ([-2.45, 2.45] as number[]).forEach(x => {
      const brush = new THREE.Group();
      brush.position.set(x, 0.42, 0);
      group.add(brush);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.55, 16), bayMat);
      stem.position.y = 0.48;
      stem.castShadow = true;
      brush.add(stem);
      for (let i = 0; i < 20; i++) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.95, 0.035), brushMat);
        strip.position.y = 0.45;
        strip.rotation.y = (i / 20) * Math.PI * 2;
        strip.position.x = Math.cos(strip.rotation.y) * 0.22;
        strip.position.z = Math.sin(strip.rotation.y) * 0.22;
        brush.add(strip);
      }
      brushes.push(brush);
    });

    const plateTexture = createPlateTexture(plate);
    const vehicle = isMotorcycle
      ? buildMotorcycle(vehicleColor, plateTexture)
      : buildCar(vehicleColor, plateTexture, carVariant);
    vehicle.position.set(0, 0.05, 0);
    group.add(vehicle);

    // ── contact shadow blob ──
    const blobCanvas = document.createElement('canvas');
    blobCanvas.width = 256; blobCanvas.height = 128;
    const bctx = blobCanvas.getContext('2d')!;
    const grad = bctx.createRadialGradient(128, 64, 0, 128, 64, 110);
    grad.addColorStop(0, 'rgba(0,0,0,0.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    bctx.fillStyle = grad;
    bctx.ellipse(128, 64, 118, 60, 0, 0, Math.PI * 2);
    bctx.fill();
    const blobTex = new THREE.CanvasTexture(blobCanvas);
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(isMotorcycle ? 3.2 : 4.4, isMotorcycle ? 1.2 : 1.8),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = -0.575;
    group.add(blob);

    // water droplets
    const droplets = new THREE.Group();
    group.add(droplets);
    const dropMat = new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.7 });
    const dropGeo = new THREE.SphereGeometry(0.035, 10, 10);
    const dropData: { mesh: any; speed: number; offset: number }[] = [];
    for (let i = 0; i < 72; i++) {
      const mesh = new THREE.Mesh(dropGeo, dropMat);
      mesh.position.set((Math.random() - 0.5) * 3.2, 1.3 + Math.random() * 1.45, (Math.random() - 0.5) * 3.1);
      droplets.add(mesh);
      dropData.push({ mesh, speed: 0.006 + Math.random() * 0.011, offset: Math.random() * Math.PI * 2 });
    }

    const foamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.58 });
    const foam = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), foamMat);
    foam.scale.set(isMotorcycle ? 1.9 : 2.7, 0.18, isMotorcycle ? 0.9 : 1.25);
    foam.position.set(0.08, isMotorcycle ? 0.56 : 0.36, 0);
    group.add(foam);

    // ── pointer tracking ──
    let pointerX = 0;
    let pointerY = 0;
    const handlePointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      const w = Math.max(1, width);
      const h = Math.max(1, height);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    // ── animation state ──
    const clock = new THREE.Clock();
    let payingStartTime = -1;
    const PAY_ACCEL = 1.4;  // seconds of ease-in
    const PAY_DECEL = 1.8;  // seconds of ease-out
    const PAY_TOTAL = PAY_ACCEL + PAY_DECEL;
    const MAX_SPEED = 3.2;  // units/s
    const PARK_X = 5.8;
    let animationId = 0;

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const delta = Math.min(clock.getDelta(), 0.05); // capped for tab-hidden recovery

      const currentPhase = phaseRef.current;

      if (currentPhase === 'paying') {
        if (payingStartTime < 0) payingStartTime = elapsed;
        const t = elapsed - payingStartTime;
        const progress = Math.min(t / PAY_TOTAL, 1.0);

        // ease-in-out: accelerate then decelerate
        let speed = 0;
        if (t < PAY_ACCEL) {
          // ease-in quadratic
          const u = t / PAY_ACCEL;
          speed = MAX_SPEED * u * u;
        } else {
          // ease-out quadratic
          const u = 1 - (t - PAY_ACCEL) / PAY_DECEL;
          speed = MAX_SPEED * (u * u);
        }

        vehicle.position.x = Math.min(vehicle.position.x + speed * delta, PARK_X);

        // slight yaw into parking slot
        if (progress > 0.7) {
          vehicle.rotation.y = THREE.MathUtils.lerp(vehicle.rotation.y, -0.62 + 0.22, (progress - 0.7) / 0.3);
        }

        // spin wheels proportionally
        const wheelRadius: number = vehicle.userData.wheelRadius ?? 0.36;
        const wheelSpins: ReturnType<typeof THREE.Group>[] = vehicle.userData.wheels ?? [];
        const rollSpeed = speed / wheelRadius;
        wheelSpins.forEach(w => { w.rotation.y -= rollSpeed * delta; });

        // fade out wash elements
        const fadeOut = Math.max(0, 1 - progress * 3);
        foamMat.opacity = fadeOut * 0.58;
        dropMat.opacity = fadeOut * 0.7;
        brushes[0].visible = fadeOut > 0.05;
        brushes[1].visible = fadeOut > 0.05;

        blob.material.opacity = THREE.MathUtils.lerp(0.0, 0.9, Math.max(0, 1 - progress));

      } else {
        payingStartTime = -1;

        if (!prefersReduced) {
          // idle washing animation — delta-time based
          group.rotation.y += (pointerX * 0.18 - group.rotation.y) * (1 - Math.pow(0.92, delta * 60));
          group.rotation.x += (-pointerY * 0.06 - group.rotation.x) * (1 - Math.pow(0.92, delta * 60));

          vehicle.position.y = 0.05 + Math.sin(elapsed * 1.1) * 0.025;
          vehicle.rotation.z = Math.sin(elapsed * 0.9) * 0.012;
          vehicle.rotation.x = Math.sin(elapsed * 0.72) * 0.01;

          foamMat.opacity = 0.44 + Math.sin(elapsed * 2.8) * 0.14;
          brushes[0].rotation.y += (isMotorcycle ? 0.14 : 0.1) * delta * 60;
          brushes[1].rotation.y -= (isMotorcycle ? 0.14 : 0.1) * delta * 60;
        }

        // idle wheel spin — very slow roll for visual interest
        const idleRollRate = isMotorcycle ? 1.2 : 0.8; // rad/s
        const wheelSpins: ReturnType<typeof THREE.Group>[] = vehicle.userData.wheels ?? [];
        wheelSpins.forEach(w => { w.rotation.y -= idleRollRate * delta; });

        // droplets
        dropData.forEach(({ mesh, speed, offset }) => {
          mesh.position.y -= speed * 18 * delta * 60;
          mesh.position.x += Math.sin(elapsed * 1.1 + offset) * 0.003;
          if (mesh.position.y < -0.34) {
            mesh.position.y = 2.55;
            mesh.position.x = (Math.random() - 0.5) * 3.2;
            mesh.position.z = (Math.random() - 0.5) * 3.1;
          }
        });

        blob.material.opacity = 0.9;
      }

      renderer.render(scene, camera);
      animationId = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      plateTexture.dispose();
      blobTex.dispose();
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
      scene.traverse((object: any) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const mats: any[] = Array.isArray(object.material) ? object.material : [object.material];
          mats.forEach((m: any) => m.dispose());
        }
      });
    };
  }, [isMotorcycle, plate, vehicleColor, carVariant]);

  return (
    <div className={`relative min-h-[220px] overflow-hidden rounded-2xl bg-slate-100 ${className}`}>
      <div ref={mountRef} className="absolute inset-0" aria-label={`Visual ${isMotorcycle ? 'bikewash' : 'carwash'} ${plate}`} />

      <div className="pointer-events-none absolute left-3 top-3 z-30 max-w-[calc(100%-1.5rem)] rounded-xl bg-white/85 px-2.5 py-1.5 shadow-soft backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{isMotorcycle ? 'Bikewash' : 'Sedang Dicuci'}</p>
        <p className="truncate font-mono text-sm font-black leading-none text-slate-900">{plate || '-'}</p>
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 z-30 max-w-[65%] rounded-xl bg-slate-900/80 px-2.5 py-1.5 text-right text-white backdrop-blur">
        <p className="truncate text-[10px] font-bold">{[brand, model].filter(Boolean).join(' ') || (isMotorcycle ? 'Guest Bike' : 'Guest Car')}</p>
        <p className="text-[10px] text-sky-200">{isMember ? 'Member vehicle' : 'Non member'}</p>
      </div>

      {phase === 'paying' && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-40 flex items-center justify-center">
          <span className="rounded-full bg-emerald-500/90 px-3 py-1 text-[10px] font-bold text-white backdrop-blur">
            ✓ Selesai — Parkir
          </span>
        </div>
      )}
    </div>
  );
}
