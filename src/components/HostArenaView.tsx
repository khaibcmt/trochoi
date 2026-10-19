import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { MatchState, QuizItem, Player, GamePlayType } from '../types';
import { AudioFX } from '../services/audio';
import { CloudNetwork } from '../services/network';
import {
  cleanQuestionTitleText,
  calculateFastestPoints,
  getConvertedGradeByRank,
  FASTEST_Q_DURATION_SEC
} from '../data/defaultSubjects';
import { QRZoomModal } from './QRZoomModal';
import { MathRenderer } from '../utils/katexHelper';

interface Props {
  matchState: MatchState;
  quizList: QuizItem[];
  activeRoomId: string;
  onUpdateMatchState: (updater: (prev: MatchState) => MatchState) => void;
  onReturnToSetup: () => void;
  onToggleFullScreen: () => void;
  onExportHTMLSlide: () => void;
  onPrintPDFEvidence: () => void;
}

export const HostArenaView: React.FC<Props> = ({
  matchState,
  quizList,
  activeRoomId,
  onUpdateMatchState,
  onReturnToSetup,
  onToggleFullScreen,
  onExportHTMLSlide,
  onPrintPDFEvidence
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // QR URLs & Zoom State
  const [qrRedUrl, setQrRedUrl] = useState('');
  const [qrBlueUrl, setQrBlueUrl] = useState('');
  const [qrRedImg, setQrRedImg] = useState('');
  const [qrBlueImg, setQrBlueImg] = useState('');
  const [qrVisible, setQrVisible] = useState(true);
  const [zoomModalOpen, setZoomModalOpen] = useState(false);
  const [zoomedTeam, setZoomedTeam] = useState<'RED' | 'BLUE'>('RED');

  // Review Answers Mode & sky theme
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewQIdx, setReviewQIdx] = useState(0);
  const [skyTheme, setSkyTheme] = useState(1);

  // 30-Second Question Timer (Applies to ALL 4 MODES)
  const durationSec = matchState.settings?.questionDurationSec || 30;
  const [remainingSec, setRemainingSec] = useState<number>(durationSec);
  const timerIntervalRef = useRef<any>(null);
  const timerStartMsRef = useRef<number>(0);
  const isTransitioningRef = useRef<boolean>(false);
  const correctOrderCountRef = useRef<number>(0);

  // Rescue banner message & rescue modal
  const [rescueBannerMsg, setRescueBannerMsg] = useState<string | null>(null);
  const [showRescueModal, setShowRescueModal] = useState<boolean>(false);
  const [wheelSpinning, setWheelSpinning] = useState<boolean>(false);
  const [wheelResult, setWheelResult] = useState<string | null>(null);

  // AI Explanation Modal
  const [showAIExplainModal, setShowAIExplainModal] = useState<boolean>(false);
  const [aiExplainText, setAiExplainText] = useState<string>('');
  const [aiExplainLoading, setAiExplainLoading] = useState<boolean>(false);

  // Floating cheers
  const [floatingCheers, setFloatingCheers] = useState<{ id: string; emoji: string; left: number }[]>([]);

  // Three.js references
  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    ropeMesh: THREE.Mesh;
    ribbonMesh: THREE.Mesh;
    tugLinesGroup: THREE.Group;
    goldenBellStageGroup: THREE.Group;
    giantTrophy3D: THREE.Group;
    bossGroup: THREE.Group;
    bossMesh: THREE.Mesh;
    bossHalo: THREE.Mesh;
    bossWings: THREE.Group;
    bossHitFlash: number;
    starsGroup: THREE.Group;
    stadiumLightsGroup: THREE.Group;
    ambientLight: THREE.AmbientLight;
    sunLight: THREE.DirectionalLight;
    grassMesh: THREE.Mesh;
    sandMesh: THREE.Mesh;
    redPullers3D: THREE.Group[];
    bluePullers3D: THREE.Group[];
    clock: THREE.Clock;
    targetRopeX: number;
    animFrameId?: number;
  } | null>(null);

  // 3D Tag coordinates projected onto 2D screen
  const [labelCoords, setLabelCoords] = useState<Record<string, { x: number; y: number }>>({});

  // Generate QR URLs
  useEffect(() => {
    let base = window.location.href.split('?')[0].split('#')[0];
    if (base.startsWith('file:')) {
      base = 'https://khaibcmt.github.io/edu/';
    }
    const gmFlag = matchState.gameType === 'FAST' ? '&gm=F' : (matchState.gameType === 'BELL' ? '&gm=B' : (matchState.gameType === 'BOSS' ? '&gm=BOSS' : ''));
    const rUrl = `${base}?r=${activeRoomId}&t=R${gmFlag}`;
    const bUrl = `${base}?r=${activeRoomId}&t=B${gmFlag}`;
    setQrRedUrl(rUrl);
    setQrBlueUrl(bUrl);

    QRCode.toDataURL(rUrl, { width: 112, margin: 1, errorCorrectionLevel: 'L' }).then(setQrRedImg).catch(() => {});
    QRCode.toDataURL(bUrl, { width: 112, margin: 1, errorCorrectionLevel: 'L' }).then(setQrBlueImg).catch(() => {});
  }, [activeRoomId, matchState.gameType]);

  // Trigger rescue announcement
  const triggerRescueBanner = (msg: string) => {
    setRescueBannerMsg(msg);
    confetti({ particleCount: 160, spread: 90, origin: { y: 0.45 } });
    AudioFX.bonusLifeChime();
    setTimeout(() => {
      setRescueBannerMsg(null);
    }, 4200);
  };

  // Helper to create customized 3D Chibi Cartoon Character
  const createCartoonCharacter = (team: 'RED' | 'BLUE', player?: Player) => {
    const g = new THREE.Group();
    const isRed = team === 'RED';
    let clothColor = isRed ? 0xef4444 : 0x0284c7;
    let accentColor = isRed ? 0xfbbf24 : 0x38bdf8;
    const shoeColor = isRed ? 0x7f1d1d : 0x0c4a6e;

    // Apply avatar customization if provided
    const avatar = player?.avatar;
    if (avatar?.accessoryColor) {
      accentColor = parseInt(avatar.accessoryColor.replace('#', '0x'), 16) || accentColor;
    }
    if (avatar?.costume === 'aodai') {
      clothColor = isRed ? 0xf43f5e : 0x06b6d4;
    } else if (avatar?.costume === 'superhero') {
      clothColor = 0x8b5cf6;
    } else if (avatar?.costume === 'sport') {
      clothColor = isRed ? 0xb91c1c : 0x0369a1;
    }

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffe4c4, roughness: 0.4 });
    const clothMat = new THREE.MeshStandardMaterial({ color: clothColor, roughness: 0.35 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.3 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: shoeColor, roughness: 0.5 });
    const darkMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });

    // Shoes
    const shoeGeo = new THREE.SphereGeometry(0.16, 16, 16);
    const shoeL = new THREE.Mesh(shoeGeo, shoeMat); shoeL.position.set(0.16, 0.14, 0.05);
    const shoeR = new THREE.Mesh(shoeGeo, shoeMat); shoeR.position.set(-0.16, 0.14, 0.05);
    g.add(shoeL); g.add(shoeR);

    // Body
    const bodyGeo = avatar?.costume === 'aodai'
      ? new THREE.CylinderGeometry(0.28, 0.45, 0.95, 32)
      : new THREE.CylinderGeometry(0.34, 0.42, 0.78, 32);
    const body = new THREE.Mesh(bodyGeo, clothMat);
    body.position.y = avatar?.costume === 'aodai' ? 0.72 : 0.65;
    body.castShadow = true;
    g.add(body);

    // Belt / sash
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.4, 0.12, 32), accentMat);
    belt.position.y = 0.45;
    g.add(belt);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 32, 32), skinMat);
    head.position.y = 1.36;
    head.castShadow = true;
    g.add(head);

    // Eyes
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 16), whiteMat); eyeL.position.set(0.15, 1.4, 0.38);
    const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), darkMat); pupilL.position.set(0.16, 1.4, 0.45);
    g.add(eyeL); g.add(pupilL);

    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 16), whiteMat); eyeR.position.set(-0.15, 1.4, 0.38);
    const pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), darkMat); pupilR.position.set(-0.16, 1.4, 0.45);
    g.add(eyeR); g.add(pupilR);

    // Cheeks
    const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), blushMat); cheekL.position.set(0.26, 1.28, 0.35);
    const cheekR = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), blushMat); cheekR.position.set(-0.26, 1.28, 0.35);
    g.add(cheekL); g.add(cheekR);

    // Hat / Hair styling based on avatar
    const hairStyle = avatar?.hairStyle || 'cap';
    if (hairStyle === 'crown') {
      const crownMesh = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.35, 6), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 }));
      crownMesh.position.set(0, 1.82, 0);
      g.add(crownMesh);
    } else if (hairStyle === 'beret') {
      const beretMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.35, 0.16, 32), accentMat);
      beretMesh.position.set(0.08, 1.76, 0);
      beretMesh.rotation.z = -0.2;
      g.add(beretMesh);
    } else if (hairStyle === 'cyber') {
      const cyberHeadphones = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.08, 16, 32, Math.PI), accentMat);
      cyberHeadphones.position.set(0, 1.42, 0);
      cyberHeadphones.rotation.x = Math.PI / 2;
      g.add(cyberHeadphones);
    } else {
      // Default Cap + Headband
      const capCrown = new THREE.Mesh(new THREE.SphereGeometry(0.45, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), clothMat);
      capCrown.position.y = 1.42;
      g.add(capCrown);

      const headband = new THREE.Mesh(new THREE.CylinderGeometry(0.455, 0.455, 0.08, 32), accentMat);
      headband.position.y = 1.45;
      g.add(headband);
    }

    // Arms
    const armGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.46, 16);
    const armL = new THREE.Mesh(armGeo, clothMat); armL.position.set(0.34, 0.98, 0.25); armL.rotation.x = -Math.PI / 3; g.add(armL);
    const armR = new THREE.Mesh(armGeo, clothMat); armR.position.set(-0.34, 0.98, 0.25); armR.rotation.x = -Math.PI / 3; g.add(armR);

    // Gloves
    const gloveGeo = new THREE.SphereGeometry(0.11, 12, 12);
    const gloveL = new THREE.Mesh(gloveGeo, whiteMat); gloveL.position.set(0.34, 0.85, 0.44);
    const gloveR = new THREE.Mesh(gloveGeo, whiteMat); gloveR.position.set(-0.34, 0.85, 0.44);
    g.add(gloveL); g.add(gloveR);

    // Freeze block
    const ice = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 2.15, 1.25),
      new THREE.MeshStandardMaterial({ color: 0xa5f3fc, transparent: true, opacity: 0.75, roughness: 0.1 })
    );
    ice.position.y = 1.05;
    ice.visible = false;
    g.add(ice);

    g.userData = { ice: ice, dropY: 8.0, isReadyInRope: false, currentZ: -1.8, baseBellX: 0, baseBellZ: 0 };
    return g;
  };

  // Helper to create 3D Knowledge Monster / Dragon Boss
  const createBossMonster3D = () => {
    const bossGroup = new THREE.Group();

    // Body
    const bossBodyMat = new THREE.MeshStandardMaterial({ color: 0x4c0519, roughness: 0.3, metalness: 0.4 });
    const bossCoreMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.8 });
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.2 });

    const bodyGeo = new THREE.DodecahedronGeometry(2.1, 1);
    const bodyMesh = new THREE.Mesh(bodyGeo, bossBodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.position.y = 2.8;
    bossGroup.add(bodyMesh);

    // Glowing Core
    const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 24), bossCoreMat);
    coreMesh.position.y = 2.8;
    bossGroup.add(coreMesh);

    // Horns
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 16), hornMat);
    hornL.position.set(1.2, 4.4, 0.2);
    hornL.rotation.z = -0.4;
    bossGroup.add(hornL);

    const hornR = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 16), hornMat);
    hornR.position.set(-1.2, 4.4, 0.2);
    hornR.rotation.z = 0.4;
    bossGroup.add(hornR);

    // Glowing Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), eyeMat);
    eyeL.position.set(0.65, 3.4, 1.6);
    bossGroup.add(eyeL);

    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), eyeMat);
    eyeR.position.set(-0.65, 3.4, 1.6);
    bossGroup.add(eyeR);

    // Dragon Wings Group
    const wingsGroup = new THREE.Group();
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x881337, side: THREE.DoubleSide });
    const wingGeo = new THREE.PlaneGeometry(2.8, 1.8);

    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(2.4, 3.2, -0.6);
    wingL.rotation.y = 0.5;
    wingsGroup.add(wingL);

    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingR.position.set(-2.4, 3.2, -0.6);
    wingR.rotation.y = -0.5;
    wingsGroup.add(wingR);

    bossGroup.add(wingsGroup);

    // Magical Rune Ring below Boss
    const haloGeo = new THREE.RingGeometry(2.8, 3.2, 32);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.rotation.x = Math.PI / 2;
    haloMesh.position.y = 0.15;
    bossGroup.add(haloMesh);

    bossGroup.position.set(0, 0, -2.5);
    return { bossGroup, bodyMesh, haloMesh, wingsGroup };
  };

  // Atmosphere Applier
  const applyRoundAtmosphere = (roundNum: number) => {
    if (!threeRef.current) return;
    const { scene, ambientLight, sunLight, grassMesh, sandMesh, starsGroup, stadiumLightsGroup } = threeRef.current;
    if (roundNum === 1) {
      scene.background = new THREE.Color(0x38bdf8);
      scene.fog = new THREE.FogExp2(0x38bdf8, 0.011);
      ambientLight.color.setHex(0xffffff); ambientLight.intensity = 0.82;
      sunLight.color.setHex(0xfffbeb); sunLight.intensity = 0.92; sunLight.position.set(12, 25, 16);
      (grassMesh.material as THREE.MeshLambertMaterial).color.setHex(0x22c55e);
      (sandMesh.material as THREE.MeshLambertMaterial).color.setHex(0xfde047);
      if (starsGroup) starsGroup.visible = false;
      if (stadiumLightsGroup) stadiumLightsGroup.visible = false;
    } else if (roundNum === 2) {
      scene.background = new THREE.Color(0xf97316);
      scene.fog = new THREE.FogExp2(0xfb923c, 0.015);
      ambientLight.color.setHex(0xfed7aa); ambientLight.intensity = 0.72;
      sunLight.color.setHex(0xffedd5); sunLight.intensity = 1.15; sunLight.position.set(-20, 9, 10);
      (grassMesh.material as THREE.MeshLambertMaterial).color.setHex(0x16a34a);
      (sandMesh.material as THREE.MeshLambertMaterial).color.setHex(0xfdba74);
      if (starsGroup) starsGroup.visible = false;
      if (stadiumLightsGroup) stadiumLightsGroup.visible = false;
    } else {
      scene.background = new THREE.Color(0x090d16);
      scene.fog = new THREE.FogExp2(0x090d16, 0.014);
      ambientLight.color.setHex(0x93c5fd); ambientLight.intensity = 0.55;
      sunLight.color.setHex(0xe0f2fe); sunLight.intensity = 0.85; sunLight.position.set(0, 22, 12);
      (grassMesh.material as THREE.MeshLambertMaterial).color.setHex(0x15803d);
      (sandMesh.material as THREE.MeshLambertMaterial).color.setHex(0xeab308);
      if (starsGroup) starsGroup.visible = true;
      if (stadiumLightsGroup) stadiumLightsGroup.visible = true;
    }
  };

  // Build Giant Trophy
  const buildGiantTrophy3D = () => {
    const trophy = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.15, metalness: 0.95 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.5, 32), woodMat);
    base.position.y = 0.25; trophy.add(base);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 1.2, 32), goldMat);
    stem.position.y = 1.1; trophy.add(stem);

    const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.45, 1.8, 32, 1, true), goldMat);
    cup.position.y = 2.4; trophy.add(cup);

    const handleL = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.12, 16, 32, Math.PI), goldMat);
    handleL.position.set(1.4, 2.5, 0); handleL.rotation.z = Math.PI / 2; trophy.add(handleL);

    const handleR = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.12, 16, 32, Math.PI), goldMat);
    handleR.position.set(-1.4, 2.5, 0); handleR.rotation.z = -Math.PI / 2; trophy.add(handleR);

    trophy.position.set(0, 0, -2);
    trophy.visible = false;
    return trophy;
  };

  // Build Golden Bell 3-Tier Stage
  const buildGoldenBellStage = () => {
    const stage = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.2, metalness: 0.9 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.4 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

    const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 9.0, 0.35, 48), redMat);
    tier1.position.y = 0.18; tier1.receiveShadow = true; stage.add(tier1);

    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.6, 0.35, 48), whiteMat);
    tier2.position.y = 0.53; tier2.receiveShadow = true; stage.add(tier2);

    const tier3 = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.2, 0.35, 48), redMat);
    tier3.position.y = 0.88; tier3.receiveShadow = true; stage.add(tier3);

    const archL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5.0, 24), goldMat);
    archL.position.set(1.6, 3.4, -1.0); stage.add(archL);

    const archR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5.0, 24), goldMat);
    archR.position.set(-1.6, 3.4, -1.0); stage.add(archR);

    const archTop = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.6, 24), goldMat);
    archTop.position.set(0, 5.8, -1.0); archTop.rotation.z = Math.PI / 2; stage.add(archTop);

    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.95, 1.4, 32), goldMat);
    bell.position.set(0, 4.8, -1.0); stage.add(bell);

    const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), goldMat);
    clapper.position.set(0, 4.0, -1.0); stage.add(clapper);

    stage.position.set(0, 0, -2);
    stage.visible = false;
    return stage;
  };

  // Initialize Three.js
  useEffect(() => {
    if (!canvasRef.current || !viewportRef.current) return;
    const canvas = canvasRef.current;
    const vp = viewportRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x38bdf8);
    scene.fog = new THREE.FogExp2(0x38bdf8, 0.011);

    const camera = new THREE.PerspectiveCamera(48, vp.clientWidth / vp.clientHeight, 0.1, 100);
    camera.position.set(0, 5.2, 11.2);
    camera.lookAt(0, 1.6, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(vp.clientWidth, vp.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 0.95);
    sunLight.position.set(12, 25, 16);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    // Stars & stadium lights
    const starsGroup = new THREE.Group();
    const starGeo = new THREE.BufferGeometry();
    const starCount = 300;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 80;
      starPositions[i + 1] = 8 + Math.random() * 25;
      starPositions[i + 2] = (Math.random() - 0.5) * 80;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.45, transparent: true, opacity: 0.85 });
    starsGroup.add(new THREE.Points(starGeo, starMat));
    starsGroup.visible = false;
    scene.add(starsGroup);

    const stadiumLightsGroup = new THREE.Group();
    stadiumLightsGroup.visible = false;
    scene.add(stadiumLightsGroup);

    // Ground
    const grassMesh = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: 0x22c55e }));
    grassMesh.rotation.x = -Math.PI / 2;
    grassMesh.receiveShadow = true;
    scene.add(grassMesh);

    const sandMesh = new THREE.Mesh(new THREE.PlaneGeometry(28, 7.5), new THREE.MeshLambertMaterial({ color: 0xfde047 }));
    sandMesh.rotation.x = -Math.PI / 2;
    sandMesh.position.set(0, 0.02, 0);
    sandMesh.receiveShadow = true;
    scene.add(sandMesh);

    // Tug lines
    const tugLinesGroup = new THREE.Group();
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const centerLine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 6.8), lineMat);
    centerLine.rotation.x = -Math.PI / 2; centerLine.position.y = 0.04;
    tugLinesGroup.add(centerLine);

    const redWinLine = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 6.8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    redWinLine.rotation.x = -Math.PI / 2; redWinLine.position.set(-2.8, 0.04, 0);
    tugLinesGroup.add(redWinLine);

    const blueWinLine = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 6.8), new THREE.MeshBasicMaterial({ color: 0x0284c7 }));
    blueWinLine.rotation.x = -Math.PI / 2; blueWinLine.position.set(2.8, 0.04, 0);
    tugLinesGroup.add(blueWinLine);
    scene.add(tugLinesGroup);

    // Rope & Center Ribbon
    const ropeMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 19, 16),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9 })
    );
    ropeMesh.rotation.z = Math.PI / 2;
    ropeMesh.position.set(0, 0.85, 0);
    ropeMesh.castShadow = true;
    scene.add(ropeMesh);

    const ribbonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
    );
    ribbonMesh.position.set(0, 0.85, 0);
    scene.add(ribbonMesh);

    // Stages
    const goldenBellStageGroup = buildGoldenBellStage();
    scene.add(goldenBellStageGroup);

    const giantTrophy3D = buildGiantTrophy3D();
    scene.add(giantTrophy3D);

    const { bossGroup, bodyMesh: bossMesh, haloMesh: bossHalo, wingsGroup: bossWings } = createBossMonster3D();
    bossGroup.visible = matchState.gameType === 'BOSS';
    scene.add(bossGroup);

    threeRef.current = {
      scene,
      camera,
      renderer,
      ropeMesh,
      ribbonMesh,
      tugLinesGroup,
      goldenBellStageGroup,
      giantTrophy3D,
      bossGroup,
      bossMesh,
      bossHalo,
      bossWings,
      bossHitFlash: 0,
      starsGroup,
      stadiumLightsGroup,
      ambientLight,
      sunLight,
      grassMesh,
      sandMesh,
      redPullers3D: [],
      bluePullers3D: [],
      clock: new THREE.Clock(),
      targetRopeX: 0
    };

    // Resize listener
    const handleResize = () => {
      if (!threeRef.current || !viewportRef.current) return;
      const w = viewportRef.current.clientWidth;
      const h = viewportRef.current.clientHeight;
      threeRef.current.camera.aspect = w / h;
      threeRef.current.camera.updateProjectionMatrix();
      threeRef.current.renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Render loop
    const animate = () => {
      if (!threeRef.current) return;
      const {
        scene,
        camera,
        renderer,
        ropeMesh,
        ribbonMesh,
        targetRopeX,
        clock,
        redPullers3D,
        bluePullers3D,
        goldenBellStageGroup,
        giantTrophy3D,
        bossGroup,
        bossHalo,
        bossWings
      } = threeRef.current;

      const elapsed = clock.getElapsedTime();

      // Smooth rope movement
      ropeMesh.position.x += (targetRopeX - ropeMesh.position.x) * 0.12;
      ribbonMesh.position.x = ropeMesh.position.x;

      // Animate Boss
      if (bossGroup.visible) {
        bossGroup.position.y = Math.sin(elapsed * 2.2) * 0.22;
        bossHalo.rotation.z += 0.015;
        if (bossWings) {
          bossWings.children.forEach((w: any, idx) => {
            w.rotation.y = (idx === 0 ? 0.5 : -0.5) + Math.sin(elapsed * 4.5) * 0.28;
          });
        }
      }

      // Bell swinging animation
      if (goldenBellStageGroup.visible) {
        const bellMesh = goldenBellStageGroup.children[6];
        if (bellMesh) {
          bellMesh.rotation.z = Math.sin(elapsed * 3.5) * 0.15;
        }
      }

      // Trophy floating animation
      if (giantTrophy3D.visible) {
        giantTrophy3D.position.y = 0.5 + Math.sin(elapsed * 2) * 0.2;
        giantTrophy3D.rotation.y += 0.012;
      }

      // Puller animations & Project 2D tag labels
      const newCoords: Record<string, { x: number; y: number }> = {};
      const vpW = viewportRef.current?.clientWidth || window.innerWidth;
      const vpH = viewportRef.current?.clientHeight || window.innerHeight;

      const updatePullerAnim = (pullers: THREE.Group[], isRedTeam: boolean) => {
        pullers.forEach(g => {
          const u = g.userData;
          const pData: Player | undefined = u.playerData;
          if (!pData) return;

          // Drop-in spawn animation
          if (u.dropY > 0) {
            u.dropY = Math.max(0, u.dropY - 0.32);
            g.position.y = (g.userData.baseBellY || 0) + u.dropY;
          }

          // Step in/ready animation
          if (pData.ready && !u.isReadyInRope) {
            u.currentZ += (0 - u.currentZ) * 0.14;
            g.position.z = u.currentZ;
            if (Math.abs(u.currentZ) < 0.05) u.isReadyInRope = true;
          }

          // Pulling / walking motion
          if (pData.ready && !pData.eliminated && u.dropY <= 0) {
            const pullFreq = 6;
            const leanFactor = isRedTeam ? 0.22 : -0.22;
            g.rotation.z = leanFactor + Math.sin(elapsed * pullFreq) * 0.08;
            g.position.y = Math.abs(Math.sin(elapsed * pullFreq)) * 0.06;
          }

          // Ice block toggle
          if (u.ice) {
            u.ice.visible = (pData.freeze || 0) > 0 || pData.eliminated;
          }

          // Project head position to 2D screen
          const headPos = new THREE.Vector3();
          g.getWorldPosition(headPos);
          headPos.y += 2.0;
          headPos.project(camera);

          const x = (headPos.x * 0.5 + 0.5) * vpW;
          const y = (-(headPos.y * 0.5) + 0.5) * vpH;

          if (headPos.z < 1) {
            newCoords[pData.id] = { x, y };
          }
        });
      };

      updatePullerAnim(redPullers3D, true);
      updatePullerAnim(bluePullers3D, false);

      setLabelCoords(newCoords);
      renderer.render(scene, camera);
      threeRef.current.animFrameId = requestAnimationFrame(animate);
    };

    threeRef.current.animFrameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (threeRef.current?.animFrameId) {
        cancelAnimationFrame(threeRef.current.animFrameId);
      }
      renderer.dispose();
    };
  }, []);

  // Update Atmosphere and Modes in 3D Scene
  useEffect(() => {
    if (!threeRef.current) return;
    const {
      tugLinesGroup,
      ropeMesh,
      ribbonMesh,
      goldenBellStageGroup,
      giantTrophy3D,
      bossGroup,
      camera
    } = threeRef.current;

    const isBell = matchState.gameType === 'BELL';
    const isFast = matchState.gameType === 'FAST';
    const isBoss = matchState.gameType === 'BOSS';

    tugLinesGroup.visible = !isBell && !isFast && !isBoss;
    ropeMesh.visible = !isBell && !isFast && !isBoss;
    ribbonMesh.visible = !isBell && !isFast && !isBoss;
    goldenBellStageGroup.visible = isBell;
    giantTrophy3D.visible = matchState.status === 'ENDED';
    bossGroup.visible = isBoss;

    if (isBoss) {
      camera.position.set(0, 5.8, 12.5);
      camera.lookAt(0, 2.5, -2.5);
    } else if (isBell) {
      camera.position.set(0, 6.0, 12.0);
      camera.lookAt(0, 1.8, -1.5);
    } else {
      camera.position.set(0, 5.2, 11.2);
      camera.lookAt(0, 1.6, 0);
    }

    applyRoundAtmosphere(matchState.currentRound || 1);
  }, [matchState.gameType, matchState.currentRound, matchState.status]);

  // Sync 3D Players on Arena (Max 20 rendered in 3D)
  useEffect(() => {
    if (!threeRef.current) return;
    const { scene, redPullers3D, bluePullers3D } = threeRef.current;
    const max3D = matchState.settings?.max3DRenderCount || 20;

    // Filter up to max3D players to render
    const allP = [...matchState.redPlayers, ...matchState.bluePlayers];
    const redToRender = matchState.redPlayers.slice(0, Math.ceil(max3D / 2));
    const blueToRender = matchState.bluePlayers.slice(0, Math.floor(max3D / 2));

    // Clear old 3D groups
    redPullers3D.forEach(g => scene.remove(g));
    bluePullers3D.forEach(g => scene.remove(g));
    redPullers3D.length = 0;
    bluePullers3D.length = 0;

    const isBell = matchState.gameType === 'BELL';
    const isFast = matchState.gameType === 'FAST';
    const isBoss = matchState.gameType === 'BOSS';

    // Position Red Players
    redToRender.forEach((p, idx) => {
      const g = createCartoonCharacter('RED', p);
      g.userData.playerData = p;

      if (isBoss) {
        // Semi-circle facing the boss
        const angle = Math.PI * 0.15 + (idx / Math.max(1, redToRender.length)) * Math.PI * 0.7;
        const rad = 6.2;
        g.position.set(Math.cos(angle) * rad, 0, Math.sin(angle) * rad - 1);
        g.lookAt(0, 2.5, -2.5);
      } else if (isBell) {
        const angle = (idx / Math.max(1, allP.length)) * Math.PI * 2;
        const rad = 4.2;
        g.position.set(Math.cos(angle) * rad, 0.35, Math.sin(angle) * rad - 1.5);
        g.lookAt(0, 1.5, -1.5);
        g.userData.baseBellY = 0.35;
      } else if (isFast) {
        const row = Math.floor(idx / 5);
        const col = idx % 5;
        g.position.set(-4.5 + col * 1.8, 0, 1.5 - row * 2.2);
        g.lookAt(0, 1.5, -5);
      } else {
        // Tug of war: Left side pulling right
        const spacing = 1.35;
        const startX = -1.8 - idx * spacing;
        g.position.set(startX, 0, p.ready ? 0 : -1.8);
        g.rotation.y = Math.PI / 2;
      }

      scene.add(g);
      redPullers3D.push(g);
    });

    // Position Blue Players
    blueToRender.forEach((p, idx) => {
      const g = createCartoonCharacter('BLUE', p);
      g.userData.playerData = p;

      if (isBoss) {
        const angle = Math.PI * 0.85 + (idx / Math.max(1, blueToRender.length)) * Math.PI * 0.7;
        const rad = 6.2;
        g.position.set(Math.cos(angle) * rad, 0, Math.sin(angle) * rad - 1);
        g.lookAt(0, 2.5, -2.5);
      } else if (isBell) {
        const offset = redToRender.length;
        const angle = ((offset + idx) / Math.max(1, allP.length)) * Math.PI * 2;
        const rad = 4.2;
        g.position.set(Math.cos(angle) * rad, 0.35, Math.sin(angle) * rad - 1.5);
        g.lookAt(0, 1.5, -1.5);
        g.userData.baseBellY = 0.35;
      } else if (isFast) {
        const row = Math.floor((idx + redToRender.length) / 5);
        const col = (idx + redToRender.length) % 5;
        g.position.set(-4.5 + col * 1.8, 0, 1.5 - row * 2.2);
        g.lookAt(0, 1.5, -5);
      } else {
        // Tug of war: Right side pulling left
        const spacing = 1.35;
        const startX = 1.8 + idx * spacing;
        g.position.set(startX, 0, p.ready ? 0 : -1.8);
        g.rotation.y = -Math.PI / 2;
      }

      scene.add(g);
      bluePullers3D.push(g);
    });
  }, [matchState.redPlayers, matchState.bluePlayers, matchState.gameType, matchState.settings?.max3DRenderCount]);

  // Sync Rope Target Position
  useEffect(() => {
    if (!threeRef.current) return;
    const ropeTarget = (matchState.ropeScore || 0) * 0.85;
    threeRef.current.targetRopeX = ropeTarget;
  }, [matchState.ropeScore]);

  // All players array
  const allPlayers = useMemo(() => {
    return [...matchState.redPlayers, ...matchState.bluePlayers];
  }, [matchState.redPlayers, matchState.bluePlayers]);

  const bellAliveCount = useMemo(() => {
    return allPlayers.filter(x => !x.eliminated).length;
  }, [allPlayers]);

  const bellOutCount = useMemo(() => {
    return allPlayers.filter(x => x.eliminated).length;
  }, [allPlayers]);

  // Current Question
  const currentQIndex = isReviewMode ? reviewQIdx : matchState.globalQIndex;
  const currentQItem: QuizItem = quizList[currentQIndex % (quizList.length || 1)] || {
    qid: 0,
    q: 'Đang tải câu hỏi...',
    opts: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
    correct: 0,
    format: 'MULTIPLE_CHOICE'
  };

  // 30-Second Countdown Timer Implementation (Tự động chuyển câu khi về 0.0s)
  useEffect(() => {
    if (matchState.status !== 'PLAYING') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    setRemainingSec(durationSec);
    timerStartMsRef.current = Date.now();
    isTransitioningRef.current = false;
    correctOrderCountRef.current = 0;

    // Broadcast question started with duration
    CloudNetwork.sendMessage({
      type: 'QUESTION_START',
      qIndex: matchState.globalQIndex,
      durationSec: durationSec,
      serverStartTime: timerStartMsRef.current
    });

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    timerIntervalRef.current = setInterval(() => {
      const elapsedMs = Date.now() - timerStartMsRef.current;
      const rem = Math.max(0, durationSec - elapsedMs / 1000);
      setRemainingSec(rem);

      if (rem <= 0 && !isTransitioningRef.current) {
        isTransitioningRef.current = true;
        clearInterval(timerIntervalRef.current);
        handleQuestionTimeout();
      }
    }, 100);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [matchState.status, matchState.globalQIndex, durationSec]);

  // Handle Timeout (Không chọn = Coi như SAI)
  const handleQuestionTimeout = () => {
    AudioFX.freezeCrack();

    // In Boss mode: Boss retaliates, heals 50 HP
    if (matchState.gameType === 'BOSS') {
      onUpdateMatchState(prev => {
        const nextBossHP = Math.min(prev.settings?.bossMaxHP || 1000, (prev.bossHP || 1000) + 50);
        return {
          ...prev,
          bossHP: nextBossHP,
          bossLastAttack: 'Quái vật gầm thét, hồi 50 HP do hết giờ!'
        };
      });
    }

    // In Bell mode: Unanswered students lose 1 heart
    if (matchState.gameType === 'BELL') {
      onUpdateMatchState(prev => {
        const answeredIds = [...prev.redAnsweredIds, ...prev.blueAnsweredIds];
        const updatedRed = prev.redPlayers.map(p => {
          if (!p.eliminated && !answeredIds.includes(p.id)) {
            const nextL = Math.max(0, p.lives - 1);
            return { ...p, lives: nextL, eliminated: nextL <= 0, streak: 0 };
          }
          return p;
        });
        const updatedBlue = prev.bluePlayers.map(p => {
          if (!p.eliminated && !answeredIds.includes(p.id)) {
            const nextL = Math.max(0, p.lives - 1);
            return { ...p, lives: nextL, eliminated: nextL <= 0, streak: 0 };
          }
          return p;
        });
        return { ...prev, redPlayers: updatedRed, bluePlayers: updatedBlue };
      });
    }

    // Auto advance after 1.8s
    setTimeout(() => {
      onUpdateMatchState(prev => ({
        ...prev,
        globalQIndex: prev.globalQIndex + 1,
        redAnsweredIds: [],
        blueAnsweredIds: []
      }));
    }, 1800);
  };

  // Force advance
  const handleForceAdvanceQ = () => {
    onUpdateMatchState(prev => ({
      ...prev,
      globalQIndex: prev.globalQIndex + 1,
      redAnsweredIds: [],
      blueAnsweredIds: []
    }));
  };

  // Rescue All Eliminated Students
  const handleRescueAllEliminated = () => {
    onUpdateMatchState(prev => {
      const nextRed = prev.redPlayers.map(p => ({
        ...p,
        eliminated: false,
        lives: Math.max(p.lives, 1)
      }));
      const nextBlue = prev.bluePlayers.map(p => ({
        ...p,
        eliminated: false,
        lives: Math.max(p.lives, 1)
      }));
      return { ...prev, redPlayers: nextRed, bluePlayers: nextBlue };
    });

    CloudNetwork.sendMessage({
      type: 'RESCUE_ALL_PLAYERS'
    });

    triggerRescueBanner(`🛟 ĐÃ HỒI SINH TOÀN BỘ ${bellOutCount} THÍ SINH TRỞ LẠI SÀN ĐẤU! (❤️)`);
    setShowRescueModal(false);
  };

  // Lucky wheel spin mini-game
  const handleSpinRescueWheel = () => {
    if (wheelSpinning) return;
    setWheelSpinning(true);
    setWheelResult(null);

    const outcomes = [
      'Hồi sinh TOÀN BỘ học sinh bị loại! (❤️)',
      'Hồi sinh 50% học sinh bị loại ngẫu nhiên!',
      'Hồi sinh 5 bạn có điểm số cao nhất!',
      'Cộng thêm +1 ❤️ cho tất cả các bạn trên sàn!'
    ];

    setTimeout(() => {
      const selected = outcomes[Math.floor(Math.random() * outcomes.length)];
      setWheelResult(selected);
      setWheelSpinning(false);
      handleRescueAllEliminated();
    }, 2500);
  };

  // AI Tutor Explanation API
  const handleRequestAIExplanation = async () => {
    setShowAIExplainModal(true);
    setAiExplainLoading(true);
    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQItem.q,
          format: currentQItem.format,
          opts: currentQItem.opts,
          correct: currentQItem.correct,
          tfItems: currentQItem.tfItems,
          shortAnswer: currentQItem.shortAnswer,
          rightCount: currentQItem.rightCount || 0,
          wrongCount: currentQItem.wrongCount || 0
        })
      });
      const data = await res.json();
      setAiExplainText(data.explanation || 'Không thể tải giải thích lúc này.');
    } catch (err: any) {
      setAiExplainText('Lỗi kết nối AI Tutor: ' + err.message);
    } finally {
      setAiExplainLoading(false);
    }
  };

  // Start contest
  const handleStartContest = () => {
    AudioFX.whistle();
    onUpdateMatchState(prev => ({
      ...prev,
      status: 'PLAYING',
      bossHP: prev.settings?.bossMaxHP || 1000,
      maxBossHP: prev.settings?.bossMaxHP || 1000
    }));
    setQrVisible(false);
  };

  // Pause / Resume
  const handlePauseMatch = () => {
    onUpdateMatchState(prev => ({
      ...prev,
      status: prev.status === 'PLAYING' ? 'PAUSED' : 'PLAYING'
    }));
  };

  // End match
  const handleEndMatch = () => {
    if (confirm('Bạn có chắc muốn kết thúc trận đấu và xem bảng tổng kết?')) {
      onUpdateMatchState(prev => ({ ...prev, status: 'ENDED' }));
    }
  };

  // Cycle sky
  const handleCycleSky = () => {
    const next = (skyTheme % 3) + 1;
    setSkyTheme(next);
    applyRoundAtmosphere(next);
  };

  // Review mode toggle
  const handleToggleReviewMode = () => {
    setIsReviewMode(prev => !prev);
    setReviewQIdx(matchState.globalQIndex);
  };

  // Step Question in review
  const handleStepQ = (delta: number) => {
    if (isReviewMode) {
      setReviewQIdx(prev => {
        const next = prev + delta;
        return next < 0 ? quizList.length - 1 : next % quizList.length;
      });
    } else {
      onUpdateMatchState(prev => {
        const next = prev.globalQIndex + delta;
        return {
          ...prev,
          globalQIndex: next < 0 ? quizList.length - 1 : next % quizList.length,
          redAnsweredIds: [],
          blueAnsweredIds: []
        };
      });
    }
  };

  // Start next round in Tug
  const handleStartNextRound = () => {
    onUpdateMatchState(prev => ({
      ...prev,
      currentRound: prev.currentRound + 1,
      status: 'PLAYING',
      ropeScore: 0,
      redAnsweredIds: [],
      blueAnsweredIds: []
    }));
  };

  // Export CSV
  const handleDownloadCSV = () => {
    let csv = '\uFEFFHọ và Tên,Đội,Đúng,Sai,Điểm Tốc Độ,Điểm Quy Đổi,Trạng Thái\n';
    const sorted = [...allPlayers].sort((a, b) => (b.fastScore || 0) - (a.fastScore || 0));
    sorted.forEach((p, idx) => {
      const rank = idx + 1;
      const g = getConvertedGradeByRank(rank, p.fastScore || 0);
      csv += `"${p.label}","${p.team}","${p.correct}","${p.wrongTotal || 0}","${p.fastScore || 0}","${g.grade}","${p.eliminated ? 'Bị loại' : 'Còn trụ'}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `BangDiem_DauTruong3D_Phong${activeRoomId}.csv`;
    link.click();
  };

  // Leaderboard for Fast Mode
  const sortedFastLeaderboard = useMemo(() => {
    return [...allPlayers]
      .filter(p => (p.fastScore || 0) > 0)
      .sort((a, b) => (b.fastScore || 0) - (a.fastScore || 0));
  }, [allPlayers]);

  const top1Fast = sortedFastLeaderboard[0];

  const getRoundTitleText = () => {
    if (matchState.gameType === 'BOSS') {
      const hp = matchState.bossHP || 1000;
      const maxHp = matchState.maxBossHP || 1000;
      const pct = Math.round((hp / maxHp) * 100);
      return `🐉 QUÁI VẬT KIẾN THỨC: ${hp}/${maxHp} HP (${pct}%) ${pct <= 30 ? '🔥 RAGE MODE' : ''}`;
    }
    if (matchState.gameType === 'FAST') {
      return `⚡ ĐUA TỐC ĐỘ 3D • 20 GIÂY • CÂU ${matchState.globalQIndex + 1}/${quizList.length || 1}`;
    }
    if (matchState.gameType === 'BELL') {
      return `🔔 RUNG CHUÔNG VÀNG 3D • CÒN ${bellAliveCount}/${allPlayers.length} HS TRÊN SÀN`;
    }
    return `⚔️ HIỆP ${matchState.currentRound || 1}/3: ${matchState.currentRound === 1 ? 'SÁNG' : matchState.currentRound === 2 ? 'HOÀNG HÔN' : 'ĐÊM'}`;
  };

  // Dynamic font size for question text based on length (Never cuts text)
  const qTitleLength = (currentQItem.q || '').length;
  const qTextFontSize = qTitleLength > 240 ? '15px' : qTitleLength > 150 ? '18px' : qTitleLength > 80 ? '22px' : '26px';

  return (
    <section id="host-view" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Floor 1: Host Control & HUD Header */}
      <header id="arena-header">
        <div className="host-controls-row">
          {matchState.status === 'LOBBY' ? (
            <button className="c-btn c-start" onClick={handleStartContest}>
              ▶ BẮT ĐẦU THI ĐẤU
            </button>
          ) : (
            <button className="c-btn" style={{ background: '#3b82f6', color: '#fff' }} onClick={() => setQrVisible(!qrVisible)}>
              {qrVisible ? '🙈 ẨN QR' : '📱 HIỆN QR'}
            </button>
          )}

          {matchState.status !== 'LOBBY' && matchState.status !== 'ENDED' && (
            <button className="c-btn c-pause" onClick={handlePauseMatch}>
              {matchState.status === 'PLAYING' ? '⏸ TẠM DỪNG' : '▶ TIẾP TỤC'}
            </button>
          )}

          <button className="c-btn" style={{ background: '#0284c7', color: '#fff' }} onClick={handleForceAdvanceQ}>
            ⏭️ QUA CÂU MỚI
          </button>

          {(matchState.gameType === 'BELL' || matchState.gameType === 'BOSS') && (
            <button
              className="c-btn"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: '1.5px solid #a7f3d0' }}
              onClick={() => setShowRescueModal(true)}
              title="Mở bảng tung phao cứu trợ hồi sinh học sinh"
            >
              🛟 TUNG PHAO CỨU TRỢ {bellOutCount > 0 ? `(${bellOutCount} HS bị loại)` : ''}
            </button>
          )}

          <button className="c-btn" style={{ background: '#d97706', color: '#fff' }} onClick={handleCycleSky}>
            🌤️ ĐỔI BẦU TRỜI
          </button>

          <button className="c-btn" style={{ background: '#059669', color: '#fff' }} onClick={handleToggleReviewMode}>
            ✅ {isReviewMode ? 'THI TIẾP' : 'CHỮA BÀI'}
          </button>

          <button className="c-btn" style={{ background: '#6366f1', color: '#fff' }} onClick={onExportHTMLSlide}>
            📥 TẢI SLIDE
          </button>

          <button className="c-btn" style={{ background: '#0f766e', color: '#fff' }} onClick={onToggleFullScreen}>
            🔲 TOÀN MÀN HÌNH
          </button>

          <button className="c-btn c-end" onClick={handleEndMatch}>
            ⏹ KẾT THÚC
          </button>

          <button className="c-btn c-home" onClick={onReturnToSetup}>
            🏠 CÀI ĐẶT
          </button>

          <span id="net-status" style={{ fontSize: '11.5px', color: '#a7f3d0', fontWeight: 900 }}>
            🟢 Phòng: {activeRoomId} ({allPlayers.length}/{matchState.settings?.roomCapacity || 50} HS)
          </span>
        </div>

        {/* HUD Teams Row with Surplus +N Display */}
        <div className="hud-teams-row">
          {matchState.gameType === 'BOSS' ? (
            <>
              <div className="team-box red" style={{ borderColor: '#ef4444' }}>
                <span>🔴 CHIẾN BINH LỚP: {matchState.redPlayers.length} HS</span>
                {matchState.redPlayers.length > 10 && (
                  <span style={{ fontSize: '11px', color: '#fef08a' }}>+{matchState.redPlayers.length - 10} tiếp sức</span>
                )}
              </div>
              <div className="center-round-hud">
                <div className="round-badge-top" id="hud-round-title" style={{ color: (matchState.bossHP || 1000) <= 300 ? '#f87171' : '#fde047' }}>
                  {getRoundTitleText()}
                </div>
                <div className="tug-score-live" id="hud-rope-score">
                  Mã Phòng: {activeRoomId} • Câu {matchState.globalQIndex + 1}/{quizList.length || 1} • {matchState.bossLastAttack || 'Cả lớp cùng dồn sát thương tiêu diệt Boss!'}
                </div>
              </div>
              <div className="team-box blue" style={{ borderColor: '#38bdf8' }}>
                <span>🔵 CHIẾN BINH LỚP: {matchState.bluePlayers.length} HS</span>
                {matchState.bluePlayers.length > 10 && (
                  <span style={{ fontSize: '11px', color: '#fef08a' }}>+{matchState.bluePlayers.length - 10} tiếp sức</span>
                )}
              </div>
            </>
          ) : matchState.gameType === 'FAST' ? (
            <>
              <div className="team-box purple-fast">
                <span>⚡ THÍ SINH: {allPlayers.length} HS</span>
                {allPlayers.length > 20 && (
                  <span style={{ fontSize: '11px', color: '#38bdf8' }}>+{allPlayers.length - 20} tiếp sức</span>
                )}
              </div>
              <div className="center-round-hud">
                <div className="round-badge-top" id="hud-round-title">
                  {getRoundTitleText()}
                </div>
                <div className="tug-score-live" id="hud-rope-score">
                  Mã Phòng: {activeRoomId} | Câu {matchState.globalQIndex + 1}/{quizList.length || 1} • Đã nộp: {matchState.redAnsweredIds.length + matchState.blueAnsweredIds.length}/{allPlayers.length} HS
                </div>
              </div>
              <div className="team-box purple-fast">
                <span>👑 DẪN ĐẦU: {top1Fast && top1Fast.fastScore > 0 ? `${top1Fast.label} (${top1Fast.fastScore}đ)` : 'Chưa có điểm'}</span>
                <span className="round-stars">🎯 Hạng 1-3: 10đ | 4-6: 9đ | 7-10: 8đ</span>
              </div>
            </>
          ) : matchState.gameType === 'BELL' ? (
            <>
              <div className="team-box gold-bell">
                <span>🔔 ĐANG TRỤ TRÊN SÀN: {bellAliveCount} HS</span>
                {allPlayers.length > 20 && (
                  <span style={{ fontSize: '11px', color: '#fef08a' }}>+{allPlayers.length - 20} tiếp viện</span>
                )}
              </div>
              <div className="center-round-hud">
                <div className="round-badge-top" id="hud-round-title">
                  {getRoundTitleText()}
                </div>
                <div className="tug-score-live" id="hud-rope-score">
                  Mã Phòng: {activeRoomId} | Còn lại: {bellAliveCount}/{allPlayers.length} thí sinh trên sàn
                </div>
              </div>
              <div className="team-box gold-bell">
                <span className="round-stars">🔥 Đúng 3 câu: +1 ❤️</span>
                <span>🧊 ĐÃ BỊ LOẠI: {bellOutCount} HS</span>
              </div>
            </>
          ) : (
            <>
              <div className="team-box red">
                <span>🔴 ĐỘI ĐỎ: {matchState.redPlayers.length} HS</span>
                {matchState.redPlayers.length > 10 && (
                  <span style={{ fontSize: '11px', color: '#fef08a' }}>+{matchState.redPlayers.length - 10} tiếp sức</span>
                )}
                <span className="round-stars">🏆 Hiệp thắng: {matchState.redRoundWins}/2</span>
              </div>
              <div className="center-round-hud">
                <div className="round-badge-top" id="hud-round-title">
                  {getRoundTitleText()}
                </div>
                <div className="tug-score-live" id="hud-rope-score">
                  Mã Phòng: {activeRoomId} | {matchState.ropeScore === 0 ? 'Điểm kéo: HÒA (0)' : matchState.ropeScore > 0 ? `XANH DẪN +${matchState.ropeScore}/3 CÂU` : `ĐỎ DẪN +${Math.abs(matchState.ropeScore)}/3 CÂU`}
                </div>
              </div>
              <div className="team-box blue">
                <span className="round-stars">🏆 Hiệp thắng: {matchState.blueRoundWins}/2</span>
                <span>🔵 ĐỘI XANH: {matchState.bluePlayers.length} HS</span>
                {matchState.bluePlayers.length > 10 && (
                  <span style={{ fontSize: '11px', color: '#fef08a' }}>+{matchState.bluePlayers.length - 10} tiếp sức</span>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Floor 2: 3D Stage Viewport */}
      <div id="arena-3d-viewport" ref={viewportRef}>
        <canvas id="canvas3d" ref={canvasRef} />

        {/* 3D Label tags container */}
        <div id="labels-container">
          {allPlayers.map(p => {
            const coord = labelCoords[p.id];
            if (!coord) return null;
            const hasDoneQ = matchState.redAnsweredIds.includes(p.id) || matchState.blueAnsweredIds.includes(p.id);

            let labelText = '';
            if (matchState.gameType === 'FAST') {
              labelText = `${hasDoneQ ? '⚡ ' : '⏳ '}${p.label} (${p.fastScore || 0}đ)`;
            } else if (matchState.gameType === 'BELL' || matchState.gameType === 'BOSS') {
              if (p.eliminated) labelText = `💀 ${p.label} (Bị loại)`;
              else {
                const hearts = '❤️'.repeat(Math.max(0, p.lives));
                const streakFire = p.streak > 0 ? ` 🔥${p.streak}` : '';
                labelText = `${hasDoneQ ? '☑️ ' : ''}${p.label} [${hearts}${streakFire}]`;
              }
            } else {
              labelText = hasDoneQ ? `☑️ ${p.label}` : (p.ready ? `✅ ${p.label}` : `⏳ ${p.label}`);
            }

            return (
              <div
                key={p.id}
                className={`tag-3d ${p.ready ? 'ready' : ''} ${hasDoneQ ? 'done-q' : ''} ${p.eliminated ? 'eliminated' : ''}`}
                style={{
                  left: `${coord.x}px`,
                  top: `${coord.y}px`,
                  borderColor: p.team === 'RED' ? 'var(--red)' : 'var(--blue)'
                }}
              >
                {labelText}
              </div>
            );
          })}
        </div>

        {/* Floating QR Badges */}
        {qrVisible && (
          <>
            <div
              className="qr-panel left"
              id="qr-panel-left"
              onClick={() => { setZoomedTeam('RED'); setZoomModalOpen(true); }}
              title="Bấm để phóng to QR"
            >
              <div className="qr-box-inner">
                {qrRedImg && <img src={qrRedImg} alt="QR Đỏ" width={112} height={112} />}
              </div>
              <div className="qr-caption" style={{ color: matchState.gameType === 'FAST' ? '#9333ea' : 'var(--red)' }}>
                {matchState.gameType === 'BOSS' ? '🐉 VÀO DIỆT BOSS 🔴' : matchState.gameType === 'FAST' ? '⚡ VÀO AI NHANH NHẤT' : matchState.gameType === 'BELL' ? '🔔 VÀO RUNG CHUÔNG VÀNG' : 'QUÉT VÀO ĐỘI ĐỎ 🔴'}
              </div>
              <div className="qr-zoom-hint">🔍 Bấm phóng to</div>
            </div>

            <div
              className="qr-panel right"
              id="qr-panel-right"
              onClick={() => { setZoomedTeam('BLUE'); setZoomModalOpen(true); }}
              title="Bấm để phóng to QR"
            >
              <div className="qr-box-inner">
                {qrBlueImg && <img src={qrBlueImg} alt="QR Xanh" width={112} height={112} />}
              </div>
              <div className="qr-caption" style={{ color: matchState.gameType === 'FAST' ? '#9333ea' : 'var(--blue)' }}>
                {matchState.gameType === 'BOSS' ? '🐉 VÀO DIỆT BOSS 🔵' : matchState.gameType === 'FAST' ? '⚡ VÀO AI NHANH NHẤT' : matchState.gameType === 'BELL' ? '🔔 VÀO RUNG CHUÔNG VÀNG' : 'QUÉT VÀO ĐỘI XANH 🔵'}
              </div>
              <div className="qr-zoom-hint">🔍 Bấm phóng to</div>
            </div>
          </>
        )}

        {/* Rescue Banner Notification */}
        {rescueBannerMsg && (
          <div
            style={{
              position: 'absolute',
              top: '18%',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'linear-gradient(135deg, #10b981, #047857)',
              color: '#ffffff',
              padding: '16px 28px',
              borderRadius: '20px',
              border: '3px solid #fef08a',
              boxShadow: '0 15px 35px rgba(0,0,0,0.6)',
              fontSize: '20px',
              fontWeight: 900,
              zIndex: 300,
              textAlign: 'center',
              animation: 'bounceIn 0.5s ease-out'
            }}
          >
            {rescueBannerMsg}
          </div>
        )}

        {/* Live Top 10 Leaderboard (Fast Mode) */}
        {matchState.gameType === 'FAST' && (
          <aside className="fast-live-leaderboard" id="fast-live-leaderboard" style={{ display: 'flex' }} aria-label="Bảng vinh danh Top 10 trực tiếp">
            <div className="flb-title">
              <span>⚡ VINH DANH TOP 10 REALTIME</span>
              <span style={{ fontSize: '11px', color: '#38bdf8' }}>{allPlayers.length} HS</span>
            </div>
            <div className="flb-list">
              {sortedFastLeaderboard.slice(0, 10).map((p, idx) => {
                const rank = idx + 1;
                const medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : `#${rank}`));
                const gradeInfo = getConvertedGradeByRank(rank, p.fastScore || 0);
                return (
                  <div key={p.id} className={`flb-row rank-${rank}`}>
                    <div className="flb-rank">{medal}</div>
                    <div className="flb-name" title={p.label}>
                      {p.label} {p.lastDelta && p.lastDelta > 0 ? <span style={{ color: '#4ade80', fontSize: '10.5px' }}>(+{p.lastDelta})</span> : null}
                    </div>
                    <div className="flb-pts">
                      {p.fastScore}đ <span style={{ color: '#fde047', fontSize: '10.5px' }}>[{gradeInfo.grade}đ]</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* Round Break Modal (Tug Mode) */}
        {matchState.status === 'ROUND_BREAK' && (
          <div id="round-modal" style={{ display: 'block' }}>
            <h2 id="round-modal-title" style={{ fontSize: '28px', color: 'var(--gold)', margin: 0 }}>
              🎉 KẾT THÚC HIỆP {matchState.currentRound}!
            </h2>
            <p id="round-modal-sub" style={{ fontSize: '16.5px', color: '#f8fafc', margin: '8px 0 14px 0' }}>
              Tỉ số Hiệp: <b>Đỏ ({matchState.redRoundWins}) - Xanh ({matchState.blueRoundWins})</b><br />
              <span style={{ fontSize: '14px', color: '#fde047' }}>
                Bối cảnh Hiệp {matchState.currentRound + 1} tiếp theo:{' '}
                <b>{matchState.currentRound + 1 === 2 ? '🌅 Hoàng Hôn Cam' : '🌌 Đêm Chung Kết'}</b>
              </span>
            </p>
            <button
              className="btn-launch"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              onClick={handleStartNextRound}
            >
              ▶️ BẮT ĐẦU HIỆP TIẾP THEO!
            </button>
          </div>
        )}

        {/* Victory Modal */}
        {matchState.status === 'ENDED' && (
          <div id="victory-modal" style={{ display: 'block' }}>
            <h1 id="win-banner-txt" style={{ fontSize: '28px', color: 'var(--gold)', margin: 0 }}>
              🏆 NHÀ VÔ ĐỊCH CHUNG CUỘC!
            </h1>
            <p id="win-sub-txt" style={{ fontSize: '15px', color: '#e2e8f0', marginTop: '6px' }}>
              {matchState.gameType === 'BOSS' ? (
                `🎉 TOÀN THỂ LỚP HỌC ĐÃ HỢP LỰC ĐÁNH BẠI QUÁI VẬT KIẾN THỨC! CHÚC MỪNG CÁC EM CHIẾN BINH!`
              ) : matchState.gameType === 'FAST' ? (
                `🌟 BẢNG VINH DANH CHUNG CUỘC & QUY ĐỔI ĐIỂM SỐ (Hạng 1–3: 10đ • Hạng 4–6: 9đ • Hạng 7–10: 8đ • Hạng 11–15: 7đ)`
              ) : matchState.gameType === 'BELL' ? (
                `Đã xuất sắc vượt qua thử thách Rung Chuông Vàng 3D và trụ lại trên sàn đấu! (Trụ lại: ${bellAliveCount}/${allPlayers.length} HS)`
              ) : (
                `Thắng chung cuộc với tỉ số: Đỏ (${matchState.redRoundWins}) - Xanh (${matchState.blueRoundWins})`
              )}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
              <button
                className="c-btn"
                style={{ background: '#0284c7', color: '#fff', padding: '9px 14px', fontSize: '13px' }}
                onClick={() => { handleToggleReviewMode(); }}
              >
                📖 CHỮA BÀI TRÊN LỚP
              </button>
              <button
                className="c-btn"
                style={{ background: '#d97706', color: '#fff', padding: '9px 14px', fontSize: '13px' }}
                onClick={onExportHTMLSlide}
              >
                🎨 TẢI SLIDE MÀU (.HTML)
              </button>
              <button
                className="c-btn"
                style={{ background: '#6366f1', color: '#fff', padding: '9px 14px', fontSize: '13px' }}
                onClick={onPrintPDFEvidence}
              >
                🖨️ IN / LƯU PDF MINH CHỨNG
              </button>
              <button
                className="c-btn c-start"
                style={{ padding: '9px 14px', fontSize: '13px' }}
                onClick={handleDownloadCSV}
              >
                📊 XUẤT BẢNG ĐIỂM (.CSV)
              </button>
              <button
                className="c-btn c-home"
                style={{ padding: '9px 14px', fontSize: '13px' }}
                onClick={onReturnToSetup}
              >
                🔄 TRẬN MỚI
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floor 3: Big Question Board (Never cuts question text, order: 4 header, order: 5 30s timer) */}
      <section
        id="host-question-board"
        className={isReviewMode ? 'review-active' : ''}
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          maxHeight: '44vh',
          overflow: 'hidden',
          padding: '10px 14px 6px 14px',
          boxSizing: 'border-box'
        }}
        aria-label="Khung câu hỏi và đáp án"
      >
        {/* Order 1: Question Title (No vertical center crop, auto-scaled, scrollable if long) */}
        <div
          id="hq-q-text"
          className={`hq-title ${qTitleLength > 180 ? 'q-very-long' : qTitleLength > 100 ? 'q-long' : ''}`}
          style={{
            fontSize: qTextFontSize
          }}
        >
          Câu {((currentQIndex % quizList.length) + 1)}: <MathRenderer text={cleanQuestionTitleText(currentQItem.q)} />
        </div>

        {/* Order 2: Options / Propositions based on GDPT 2018 format */}
        <div
          id="hq-q-opts"
          style={{
            order: 2,
            flex: 1,
            maxHeight: '18vh',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: currentQItem.format === 'TRUE_FALSE' ? '1fr 1fr' : currentQItem.format === 'SHORT_ANSWER' ? '1fr' : '1fr 1fr',
            gap: '8px',
            marginBottom: '6px'
          }}
        >
          {currentQItem.format === 'TRUE_FALSE' ? (
            // Dạng Phần II: Đúng/Sai 4 ý (a, b, c, d)
            (currentQItem.tfItems || []).map((tf, idx) => {
              const reveal = isReviewMode;
              return (
                <div
                  key={idx}
                  className={`hq-opt-item opt-color-${idx % 4}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: reveal ? (tf.isCorrect ? 'linear-gradient(135deg, #065f46, #047857)' : 'linear-gradient(135deg, #7f1d1d, #991b1b)') : undefined,
                    border: reveal ? (tf.isCorrect ? '2px solid #4ade80' : '2px solid #f87171') : undefined
                  }}
                >
                  <span style={{ fontSize: '13.5px' }}>
                    <b>{tf.label})</b> <MathRenderer text={tf.text} />
                  </span>
                  {reveal && (
                    <span style={{ fontWeight: 900, color: tf.isCorrect ? '#4ade80' : '#fca5a5', fontSize: '13px' }}>
                      {tf.isCorrect ? '✓ ĐÚNG' : '✗ SAI'}
                    </span>
                  )}
                </div>
              );
            })
          ) : currentQItem.format === 'SHORT_ANSWER' ? (
            // Dạng Phần III: Trả lời ngắn / Điền số
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '12px 18px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
                border: '2px dashed #818cf8',
                textAlign: 'center',
                color: '#ffffff',
                fontSize: '15px'
              }}
            >
              {isReviewMode ? (
                <div>
                  <span style={{ color: '#fef08a', fontWeight: 900, fontSize: '16px' }}>🎯 ĐÁP ÁN ĐÚNG: </span>
                  <span style={{ color: '#4ade80', fontWeight: 900, fontSize: '18px' }}>
                    <MathRenderer text={currentQItem.shortAnswer || currentQItem.opts[0] || ''} />
                  </span>
                </div>
              ) : (
                <div style={{ color: '#94a3b8' }}>
                  ❓ <b>Dạng Trả Lời Ngắn:</b> Học sinh đang nhập số hoặc từ khóa trên điện thoại...
                </div>
              )}
            </div>
          ) : (
            // Dạng Phần I: 4 lựa chọn truyền thống (A, B, C, D)
            currentQItem.opts.map((opt, idx) => {
              const isCorrect = idx === currentQItem.correct;
              const letter = String.fromCharCode(65 + idx);
              const revealClass = isReviewMode && isCorrect ? 'correct-reveal' : '';
              return (
                <div key={idx} className={`hq-opt-item opt-color-${idx % 4} ${revealClass}`} style={{ padding: '8px 12px', borderRadius: '10px' }}>
                  <span><b>{letter}.</b> <MathRenderer text={opt} /></span>
                  {isReviewMode && isCorrect && <span style={{ color: '#4ade80', fontWeight: 900 }}>✓ ĐÚNG</span>}
                </div>
              );
            })
          )}
        </div>

        {/* Order 4: Header Controls Bar (Sát dưới cùng ngay trên Timer Bar) */}
        <div
          className="hq-header"
          style={{
            order: 4,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '6px',
            padding: '4px 0',
            borderTop: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <span id="hq-mode-badge" style={{ color: isReviewMode ? '#fef08a' : '#38bdf8', fontSize: '12.5px', fontWeight: 900 }}>
            {isReviewMode ? '✨ CHỮA BÀI' : `${matchState.gameType === 'BOSS' ? '🐉 DIỆT BOSS' : matchState.gameType === 'FAST' ? '⚡ AI NHANH' : matchState.gameType === 'BELL' ? '🔔 RUNG CHUÔNG' : '🔥 KÉO CO'} #${matchState.globalQIndex + 1}`}
          </span>

          <span id="hq-team-progress" style={{ color: '#cbd5e1', fontSize: '12px' }}>
            {matchState.gameType === 'BELL'
              ? `Đã nộp: ${matchState.redAnsweredIds.length + matchState.blueAnsweredIds.length}/${bellAliveCount} HS còn trên sàn`
              : `Đã nộp: ${matchState.redAnsweredIds.length + matchState.blueAnsweredIds.length}/${allPlayers.length} HS`}
          </span>

          <span id="hq-answer-stats" style={{ color: '#fef08a', fontSize: '12px' }}>
            ✅ {currentQItem.rightCount || 0} Đúng • 🧊 {currentQItem.wrongCount || 0} Sai
          </span>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              className="hq-nav-btn"
              style={{ background: '#7c3aed', borderColor: '#c084fc', color: '#fff', fontWeight: 900 }}
              onClick={handleRequestAIExplanation}
              title="Xem giải thích chi tiết và phân tích lỗi sai từ AI Tutor"
            >
              💡 AI Giải Thích
            </button>

            <button className="hq-nav-btn" onClick={() => handleStepQ(-1)}>
              ◀ Trước
            </button>
            <span id="hq-counter" style={{ color: '#fef08a', fontSize: '12.5px' }}>
              {(currentQIndex % quizList.length) + 1}/{quizList.length}
            </span>
            <button className="hq-nav-btn" onClick={() => handleStepQ(1)}>
              Tiếp ▶
            </button>
            <button
              className="hq-nav-btn"
              id="hq-reveal-btn"
              style={{ background: '#059669', borderColor: '#a7f3d0' }}
              onClick={handleToggleReviewMode}
            >
              {isReviewMode ? '🙈 Ẩn Đáp Án' : '👁️ Hiện Đáp Án'}
            </button>
          </div>
        </div>

        {/* Order 5: 30-Second Countdown Timer Bar (Sát dưới cùng màn hình) */}
        <div
          id="fast-timer-bar-wrap"
          style={{
            order: 5,
            display: 'block',
            height: '18px',
            background: 'rgba(0,0,0,0.5)',
            borderRadius: '9px',
            overflow: 'hidden',
            position: 'relative',
            marginTop: '4px'
          }}
        >
          <div
            id="fast-timer-fill"
            style={{
              height: '100%',
              width: `${(remainingSec / durationSec) * 100}%`,
              background: remainingSec > 12
                ? 'linear-gradient(90deg, #10b981, #34d399)'
                : remainingSec > 6
                ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                : 'linear-gradient(90deg, #ef4444, #f87171)',
              transition: 'width 0.1s linear'
            }}
          />
          <div
            id="fast-timer-text"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 900,
              color: '#ffffff',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)'
            }}
          >
            ⏱️ THỜI GIAN CÒN LẠI: {remainingSec.toFixed(1)}s / {durationSec}s • (Không chọn = coi như SAI, tự động qua câu)
          </div>
        </div>
      </section>

      {/* AI Tutor Explanation Modal */}
      {showAIExplainModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#090d16', border: '2px solid #818cf8', borderRadius: '18px', padding: '22px', maxWidth: '640px', width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.6)', color: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '10px', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                💡 AI Tutor: Phân Tích & Hướng Dẫn Giải Chi Tiết
              </h3>
              <button
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                onClick={() => setShowAIExplainModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '13.5px', lineHeight: 1.6, color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
              {aiExplainLoading ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#818cf8', fontSize: '15px' }}>
                  ⏳ AI đang phân tích dữ liệu câu hỏi và thống kê lớp...
                </div>
              ) : (
                aiExplainText
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                className="btn-launch"
                style={{ padding: '7px 18px', fontSize: '13.5px', background: 'linear-gradient(135deg, #4f46e5, #4338ca)' }}
                onClick={() => setShowAIExplainModal(false)}
              >
                Đã Hiểu & Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rescue Phao Cứu Trợ Modal */}
      {showRescueModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#0f172a', border: '2px solid #10b981', borderRadius: '20px', padding: '24px', maxWidth: '520px', width: '100%', textAlign: 'center', color: '#ffffff', boxShadow: '0 25px 50px rgba(0,0,0,0.6)' }}>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '22px', color: '#6ee7b7' }}>
              🛟 PHAO CỨU TRỢ HỒI SINH HỌC SINH
            </h2>
            <p style={{ fontSize: '13.5px', color: '#cbd5e1', margin: '0 0 18px 0' }}>
              Hiện có <b>{bellOutCount}</b> học sinh đang bị loại. Giáo viên có thể tung phao cứu trợ để đưa các em quay lại sàn đấu!
            </p>

            {wheelResult && (
              <div style={{ padding: '12px', background: '#064e3b', border: '1.5px solid #34d399', borderRadius: '12px', marginBottom: '14px', fontSize: '15px', fontWeight: 900, color: '#fef08a' }}>
                🎉 KẾT QUẢ: {wheelResult}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className="btn-launch"
                style={{ padding: '12px 20px', fontSize: '15px', background: 'linear-gradient(135deg, #10b981, #047857)' }}
                onClick={handleRescueAllEliminated}
              >
                ⚡ HỒI SINH TẤT CẢ ({bellOutCount} HS) VỀ 1 ❤️
              </button>

              <button
                className="btn-action-sm"
                style={{ padding: '10px 16px', fontSize: '14px', background: '#3b82f6', color: '#fff', borderColor: '#60a5fa' }}
                onClick={handleSpinRescueWheel}
                disabled={wheelSpinning}
              >
                {wheelSpinning ? '🎡 Vòng quay đang quay...' : '🎡 Vòng Quay Cứu Trợ May Mắn'}
              </button>

              <button
                className="btn-action-sm"
                style={{ background: '#475569', color: '#cbd5e1', borderColor: '#64748b', marginTop: '6px' }}
                onClick={() => setShowRescueModal(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Zoom Modal */}
      <QRZoomModal
        isOpen={zoomModalOpen}
        title={matchState.gameType === 'BOSS' ? '🐉 QUÉT MÃ THAM GIA DIỆT BOSS' : matchState.gameType === 'FAST' ? '⚡ QUÉT MÃ THAM GIA AI NHANH NHẤT' : matchState.gameType === 'BELL' ? '🔔 QUÉT MÃ THAM GIA RUNG CHUÔNG VÀNG' : (zoomedTeam === 'RED' ? '🔴 QUÉT MÃ VÀO ĐỘI ĐỎ' : '🔵 QUÉT MÃ VÀO ĐỘI XANH')}
        roomId={activeRoomId}
        targetUrl={zoomedTeam === 'RED' ? qrRedUrl : qrBlueUrl}
        themeColor={matchState.gameType === 'BOSS' ? '#ef4444' : matchState.gameType === 'FAST' ? '#9333ea' : zoomedTeam === 'RED' ? '#ef4444' : '#0284c7'}
        onClose={() => setZoomModalOpen(false)}
      />
    </section>
  );
};
