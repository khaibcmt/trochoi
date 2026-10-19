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
  FASTEST_Q_DURATION_SEC,
  getQuestionPartInfo,
  shuffleQuestionOrder
} from '../data/defaultSubjects';
import { QRZoomModal } from './QRZoomModal';
import { MathRenderer } from '../utils/katexHelper';
import { explainQuestionClientSide, getStoredGeminiKey } from '../services/geminiClient';
import { Top10LeaderboardModal } from './Top10LeaderboardModal';
import { GrandFinaleScreen } from './GrandFinaleScreen';

interface Props {
  matchState: MatchState;
  quizList: QuizItem[];
  activeRoomId: string;
  onUpdateMatchState: (updater: (prev: MatchState) => MatchState) => void;
  onUpdateQuizList?: (list: QuizItem[]) => void;
  onReturnToSetup: () => void;
  onToggleFullScreen: () => void;
  onExportHTMLSlide: () => void;
  onPrintPDFEvidence: () => void;
  onOpenKeyModal?: () => void;
}

export const HostArenaView: React.FC<Props> = ({
  matchState,
  quizList,
  activeRoomId,
  onUpdateMatchState,
  onUpdateQuizList,
  onReturnToSetup,
  onToggleFullScreen,
  onExportHTMLSlide,
  onPrintPDFEvidence,
  onOpenKeyModal
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // QR URLs & Zoom State
  const [qrRedUrl, setQrRedUrl] = useState('');
  const [qrBlueUrl, setQrBlueUrl] = useState('');
  const [qrRedImg, setQrRedImg] = useState('');
  const [qrBlueImg, setQrBlueImg] = useState('');
  const [qrVisible, setQrVisible] = useState(true);
  const [qrMinimizedLeft, setQrMinimizedLeft] = useState(false);
  const [qrMinimizedRight, setQrMinimizedRight] = useState(false);
  const [zoomModalOpen, setZoomModalOpen] = useState(false);
  const [zoomedTeam, setZoomedTeam] = useState<'RED' | 'BLUE'>('RED');

  // Top 10 Leaderboard Modal & Live Display State
  const [showTop10Modal, setShowTop10Modal] = useState<boolean>(false);
  const [showLiveTop10, setShowLiveTop10] = useState<boolean>(true);

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

  // Keep latest matchState accessible in 60fps render loop
  const matchStateRef = useRef<MatchState>(matchState);
  useEffect(() => {
    matchStateRef.current = matchState;
  }, [matchState]);

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

  // Helper to create customized 3D Chibi Cartoon Character (Hiện rõ nét, to đẹp)
  const createCartoonCharacter = (team: 'RED' | 'BLUE', player?: Player) => {
    const g = new THREE.Group();
    g.scale.set(1.25, 1.25, 1.25); // Nhân vật chibi to rõ, nổi bật 100% trên sàn trắng
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

    // Seated Floor Mat for Golden Bell
    const matGroup = new THREE.Group();
    const matMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.08, 1.25),
      new THREE.MeshStandardMaterial({ color: isRed ? 0x991b1b : 0x0369a1, roughness: 0.5 })
    );
    const matBorder = new THREE.Mesh(
      new THREE.BoxGeometry(1.32, 0.05, 1.32),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.3 })
    );
    matGroup.add(matBorder);
    matGroup.add(matMesh);
    matGroup.position.y = 0.04;
    matGroup.visible = false;
    g.add(matGroup);

    // Answer Board for Golden Bell (Contestant raises board when answered)
    const boardGroup = new THREE.Group();
    const boardFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.52, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 })
    );
    const boardFace = new THREE.Mesh(
      new THREE.PlaneGeometry(0.64, 0.44),
      new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.4 })
    );
    boardFace.position.z = 0.025;
    boardGroup.add(boardFrame);
    boardGroup.add(boardFace);
    boardGroup.position.set(0, 0.82, 0.38);
    boardGroup.visible = false;
    g.add(boardGroup);

    // Hero Magic Weapon / Energy Orb for Boss Raid
    const weaponOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 16),
      new THREE.MeshStandardMaterial({
        color: isRed ? 0xf59e0b : 0x38bdf8,
        emissive: isRed ? 0xd97706 : 0x0284c7,
        emissiveIntensity: 0.85,
        roughness: 0.2
      })
    );
    weaponOrb.position.set(0.48, 0.95, 0.35);
    weaponOrb.visible = false;
    g.add(weaponOrb);

    g.userData = {
      ice,
      armL,
      armR,
      gloveL,
      gloveR,
      body,
      head,
      shoeL,
      shoeR,
      boardGroup,
      weaponOrb,
      matGroup,
      dropY: 8.0,
      isReadyInRope: false,
      currentZ: -1.8,
      baseBellX: 0,
      baseBellZ: 0,
      isRedTeam: isRed
    };
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

    // Ground - Sân vận động nền xám xanh hiện đại
    const stadiumGroundMesh = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: 0x1e293b }));
    stadiumGroundMesh.rotation.x = -Math.PI / 2;
    stadiumGroundMesh.receiveShadow = true;
    scene.add(stadiumGroundMesh);

    // Khung học sinh đứng thi đấu - Nền màu trắng tinh khôi (#ffffff) làm sáng và nổi bật toàn bộ nhân vật học sinh
    const whitePlatformMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.05
    });
    const whitePlatformMesh = new THREE.Mesh(new THREE.PlaneGeometry(32, 9), whitePlatformMat);
    whitePlatformMesh.rotation.x = -Math.PI / 2;
    whitePlatformMesh.position.set(0, 0.02, 0);
    whitePlatformMesh.receiveShadow = true;
    scene.add(whitePlatformMesh);

    // Viền khung sàn đấu màu trắng (Red bên trái, Blue bên phải, Gold đường biên)
    const borderLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 9.1), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 }));
    borderLeft.position.set(-16, 0.05, 0);
    scene.add(borderLeft);

    const borderRight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 9.1), new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 }));
    borderRight.position.set(16, 0.05, 0);
    scene.add(borderRight);

    const borderTop = new THREE.Mesh(new THREE.BoxGeometry(32.2, 0.1, 0.2), new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 }));
    borderTop.position.set(0, 0.05, -4.5);
    scene.add(borderTop);

    const borderBottom = new THREE.Mesh(new THREE.BoxGeometry(32.2, 0.1, 0.2), new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 }));
    borderBottom.position.set(0, 0.05, 4.5);
    scene.add(borderBottom);

    // Tug lines
    const tugLinesGroup = new THREE.Group();
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xd97706 });
    const centerLine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 8.8), lineMat);
    centerLine.rotation.x = -Math.PI / 2; centerLine.position.y = 0.04;
    tugLinesGroup.add(centerLine);

    const redWinLine = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 8.8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    redWinLine.rotation.x = -Math.PI / 2; redWinLine.position.set(-2.8, 0.04, 0);
    tugLinesGroup.add(redWinLine);

    const blueWinLine = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 8.8), new THREE.MeshBasicMaterial({ color: 0x0284c7 }));
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
      grassMesh: stadiumGroundMesh,
      sandMesh: whitePlatformMesh,
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
        const curMode = matchStateRef.current?.gameType || 'TUG';
        const curStatus = matchStateRef.current?.status || 'LOBBY';
        const answeredIds = [
          ...(matchStateRef.current?.redAnsweredIds || []),
          ...(matchStateRef.current?.blueAnsweredIds || [])
        ];

        pullers.forEach((g, idx) => {
          const u = g.userData;
          const pData: Player | undefined = u.playerData;
          if (!pData) return;

          const isElim = pData.eliminated || (pData.lives !== undefined && pData.lives <= 0);
          const hasDoneQ = answeredIds.includes(pData.id);

          // Drop-in spawn animation
          if (u.dropY > 0) {
            u.dropY = Math.max(0, u.dropY - 0.32);
            g.position.y = (u.baseBellY || 0) + u.dropY;
          }

          // Step in/ready animation for tug
          if (pData.ready && !u.isReadyInRope) {
            u.currentZ += (0.42 - u.currentZ) * 0.14;
            if (curMode === 'TUG') g.position.z = u.currentZ;
            if (Math.abs(u.currentZ - 0.42) < 0.05) u.isReadyInRope = true;
          }

          // Ice block toggle
          if (u.ice) {
            u.ice.visible = (pData.freeze || 0) > 0 || isElim;
          }

          // Mode-specific character animations
          if (curMode === 'BELL') {
            // Golden Bell: Contestants SIT on arena mats
            if (u.matGroup) u.matGroup.visible = true;
            if (u.boardGroup) u.boardGroup.visible = true;
            if (u.weaponOrb) u.weaponOrb.visible = false;

            if (u.body) u.body.position.y = 0.38;
            if (u.head) u.head.position.y = 0.98;
            if (u.shoeL) { u.shoeL.position.set(0.2, 0.08, 0.18); u.shoeL.rotation.z = 0.5; }
            if (u.shoeR) { u.shoeR.position.set(-0.2, 0.08, 0.18); u.shoeR.rotation.z = -0.5; }

            if (!isElim) {
              if (hasDoneQ) {
                // Raise answer board high in the air
                if (u.boardGroup) {
                  u.boardGroup.position.set(0, 1.25 + Math.sin(elapsed * 4.5 + idx) * 0.06, 0.2);
                  u.boardGroup.rotation.x = -0.15;
                }
                if (u.head) u.head.rotation.x = -0.15;
                if (u.armL) u.armL.rotation.x = -Math.PI * 0.75;
                if (u.armR) u.armR.rotation.x = -Math.PI * 0.75;
              } else {
                // Seated thinking posture with board resting on lap
                if (u.boardGroup) {
                  u.boardGroup.position.set(0, 0.55, 0.36);
                  u.boardGroup.rotation.x = 0.1;
                }
                if (u.head) u.head.rotation.x = Math.sin(elapsed * 2.5 + idx) * 0.04;
                if (u.armL) u.armL.rotation.x = -0.65;
                if (u.armR) u.armR.rotation.x = -0.65;
              }
            } else {
              // Eliminated: bowed head
              if (u.head) u.head.rotation.x = 0.45;
              if (u.boardGroup) u.boardGroup.position.set(0, 0.22, 0.36);
            }
          } else if (curMode === 'BOSS') {
            // Boss Raid: Nhân vật đứng im, lắc qua lắc lại nhẹ nhàng chống giật lag mạng
            if (u.weaponOrb) u.weaponOrb.visible = true;
            if (u.boardGroup) u.boardGroup.visible = false;
            if (u.matGroup) u.matGroup.visible = false;

            if (u.body) u.body.position.y = 0.65;
            if (u.head) u.head.position.y = 1.36;

            // Đứng im tại chỗ, lắc lư nhẹ nhàng mượt mà
            const combatSway = Math.sin(elapsed * 1.8 + idx * 0.4) * 0.05;
            g.rotation.z = combatSway;
            g.position.y = Math.sin(elapsed * 2.2 + idx * 0.3) * 0.02;

            // Quả cầu năng lượng ma thuật xoay nhẹ
            if (u.weaponOrb) {
              u.weaponOrb.rotation.y += 0.04;
              u.weaponOrb.position.y = 0.95 + Math.sin(elapsed * 3.0 + idx) * 0.05;
              u.weaponOrb.scale.setScalar(hasDoneQ ? 1.35 + Math.sin(elapsed * 6) * 0.15 : 1.0 + Math.sin(elapsed * 4 + idx) * 0.1);
            }

            if (hasDoneQ) {
              g.rotation.x = -0.15;
              if (u.armR) u.armR.rotation.x = -Math.PI * 0.55;
              if (u.armL) u.armL.rotation.x = -Math.PI / 4;
            } else {
              g.rotation.x = 0;
              if (u.armR) u.armR.rotation.x = -Math.PI / 3;
              if (u.armL) u.armL.rotation.x = -Math.PI / 3;
            }
          } else if (curMode === 'TUG') {
            // Kéo co: Nhân vật chibi đứng im trên sàn trắng, lắc qua lắc lại nhẹ nhàng
            if (u.boardGroup) u.boardGroup.visible = false;
            if (u.matGroup) u.matGroup.visible = false;
            if (u.weaponOrb) u.weaponOrb.visible = false;

            if (u.body) u.body.position.y = 0.65;
            if (u.head) u.head.position.y = 1.36;

            if (curStatus === 'PLAYING' && !isElim && u.dropY <= 0) {
              // Đứng im tại chỗ, lắc qua lắc lại nhẹ nhàng, nhịp nhàng êm ái chống giật lag
              const gentleSway = Math.sin(elapsed * 1.8 + idx * 0.4) * 0.06;
              const leanFactor = isRedTeam ? 0.2 : -0.2;
              g.rotation.z = leanFactor + gentleSway;
              g.position.y = Math.sin(elapsed * 2.0 + idx * 0.3) * 0.02;
              const armStrain = gentleSway * 0.6;
              if (u.armL) u.armL.rotation.x = -Math.PI / 3 + armStrain;
              if (u.armR) u.armR.rotation.x = -Math.PI / 3 + armStrain;
            } else if ((curStatus === 'ROUND_BREAK' || curStatus === 'ENDED') && !isElim) {
              const ropeVal = matchStateRef.current?.ropeScore || 0;
              const isWinTeam = (isRedTeam && ropeVal < 0) || (!isRedTeam && ropeVal > 0);
              if (isWinTeam) {
                // Nhảy mừng chiến thắng nhịp nhàng
                g.position.y = Math.abs(Math.sin(elapsed * 3.6 + idx)) * 0.16;
                g.rotation.z = Math.sin(elapsed * 2.0) * 0.06;
                if (u.armL) u.armL.rotation.x = -Math.PI * 0.75;
                if (u.armR) u.armR.rotation.x = -Math.PI * 0.75;
              } else {
                g.rotation.x = 0.1;
                g.position.y = 0;
              }
            } else {
              // LOBBY / IDLE: Đứng im tại chỗ, lắc qua lắc lại nhẹ nhàng đáng yêu
              const idleSway = Math.sin(elapsed * 1.6 + idx * 0.5) * 0.045;
              g.rotation.z = idleSway;
              g.position.y = (u.baseBellY || 0) + Math.sin(elapsed * 2.0 + idx * 0.3) * 0.015;
              if (u.armL) u.armL.rotation.x = -Math.PI / 3;
              if (u.armR) u.armR.rotation.x = -Math.PI / 3;
            }
          } else {
            // Speed race mode: Đứng im tại ô xuất phát, lắc qua lắc lại nhẹ nhàng mượt mà
            const fastSway = Math.sin(elapsed * 1.8 + idx * 0.4) * 0.05;
            g.rotation.z = fastSway;
            g.position.y = Math.sin(elapsed * 2.2 + idx * 0.3) * 0.02;
            if (u.armL) u.armL.rotation.x = -0.4 + Math.sin(elapsed * 1.8 + idx) * 0.1;
            if (u.armR) u.armR.rotation.x = -0.4 - Math.sin(elapsed * 1.8 + idx) * 0.1;
          }

          // Project head position to 2D screen (Đặt tên thí sinh ngay trên đỉnh mũ chibi)
          const headPos = new THREE.Vector3();
          g.getWorldPosition(headPos);
          headPos.y += 2.45;
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

    const isBell = matchState.gameType === 'BELL';
    const isFast = matchState.gameType === 'FAST';
    const isBoss = matchState.gameType === 'BOSS';

    let redToRender: Player[] = [];
    let blueToRender: Player[] = [];

    if (isBell || isFast || isBoss) {
      // Individual Modes: Sort all players by score / survival and strictly pick TOP 20
      const allP = [...matchState.redPlayers, ...matchState.bluePlayers];
      const sortedOverall = [...allP].sort((a, b) => {
        if (isBell) {
          if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
          if ((b.lives || 0) !== (a.lives || 0)) return (b.lives || 0) - (a.lives || 0);
          return (b.correct || 0) - (a.correct || 0);
        }
        const sA = (a.fastScore || 0) + (a.correct || 0) * 100;
        const sB = (b.fastScore || 0) + (b.correct || 0) * 100;
        return sB - sA;
      });

      const top20 = sortedOverall.slice(0, 20);
      redToRender = top20.filter(p => p.team === 'RED');
      blueToRender = top20.filter(p => p.team === 'BLUE');

      // Clear old 3D groups
      redPullers3D.forEach(g => scene.remove(g));
      bluePullers3D.forEach(g => scene.remove(g));
      redPullers3D.length = 0;
      bluePullers3D.length = 0;

      // Position all Top 20 players systematically
      top20.forEach((p, idx) => {
        const isRed = p.team === 'RED';
        const g = createCartoonCharacter(isRed ? 'RED' : 'BLUE', p);
        g.userData.playerData = p;

        if (isBoss) {
          // Semi-circle combat battle formation facing the Boss
          const totalHeroes = top20.length;
          const angle = -Math.PI * 0.72 + (idx / Math.max(1, totalHeroes - 1)) * Math.PI * 1.44;
          const rad = 6.4;
          g.position.set(Math.sin(angle) * rad, 0, Math.cos(angle) * rad - 1.2);
          g.lookAt(0, 2.5, -2.5);
        } else if (isBell) {
          // Golden Bell: Seated on arena mats in 2 concentric rings
          let rad = 4.4;
          let tierY = 0.22;
          let angle = 0;
          if (idx < 8) {
            rad = 2.6;
            tierY = 0.55;
            angle = (idx / 8) * Math.PI * 2;
          } else {
            rad = 4.5;
            tierY = 0.22;
            angle = ((idx - 8) / 12) * Math.PI * 2;
          }
          g.position.set(Math.cos(angle) * rad, tierY, Math.sin(angle) * rad - 1.5);
          g.userData.baseBellY = tierY;
          g.lookAt(g.position.x * 2, tierY, (g.position.z + 1.5) * 2 - 1.5);
        } else {
          // Speed racing: 4 rows of 5 racers
          const row = Math.floor(idx / 5);
          const col = idx % 5;
          g.position.set(-4.0 + col * 2.0, 0, 1.8 - row * 2.0);
          g.lookAt(0, 1.5, -6);
        }

        scene.add(g);
        if (isRed) redPullers3D.push(g);
        else bluePullers3D.push(g);
      });
    } else {
      // Tug of war: Top 10 Red + Top 10 Blue by score
      const sortedRed = [...matchState.redPlayers].sort((a, b) => {
        const sA = (a.fastScore || 0) + (a.correct || 0) * 100;
        const sB = (b.fastScore || 0) + (b.correct || 0) * 100;
        return sB - sA;
      });
      const sortedBlue = [...matchState.bluePlayers].sort((a, b) => {
        const sA = (a.fastScore || 0) + (a.correct || 0) * 100;
        const sB = (b.fastScore || 0) + (b.correct || 0) * 100;
        return sB - sA;
      });
      redToRender = sortedRed.slice(0, 10);
      blueToRender = sortedBlue.slice(0, 10);

      // Clear old 3D groups
      redPullers3D.forEach(g => scene.remove(g));
      bluePullers3D.forEach(g => scene.remove(g));
      redPullers3D.length = 0;
      bluePullers3D.length = 0;

      // Position Red pullers firmly alongside the rope at z = 0.42
      redToRender.forEach((p, idx) => {
        const g = createCartoonCharacter('RED', p);
        g.userData.playerData = p;
        const spacing = 1.25;
        const startX = -1.6 - idx * spacing;
        g.position.set(startX, 0, 0.42);
        g.rotation.y = Math.PI / 2;
        scene.add(g);
        redPullers3D.push(g);
      });

      // Position Blue pullers firmly alongside the rope at z = 0.42
      blueToRender.forEach((p, idx) => {
        const g = createCartoonCharacter('BLUE', p);
        g.userData.playerData = p;
        const spacing = 1.25;
        const startX = 1.6 + idx * spacing;
        g.position.set(startX, 0, 0.42);
        g.rotation.y = -Math.PI / 2;
        scene.add(g);
        bluePullers3D.push(g);
      });
    }
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

    const activeQWithMeta = {
      ...currentQItem,
      qIndex: matchState.globalQIndex,
      totalQuestions: quizList.length
    };

    // Broadcast question started with duration, exact question, and quiz deck
    CloudNetwork.sendMessage({
      type: 'QUESTION_START',
      qIndex: matchState.globalQIndex,
      durationSec: durationSec,
      serverStartTime: timerStartMsRef.current,
      question: activeQWithMeta,
      quiz: quizList
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

  // AI Tutor Explanation (Direct Client-Side Gemini & Offline Intelligent Fallback)
  const handleRequestAIExplanation = async () => {
    setShowAIExplainModal(true);
    setAiExplainLoading(true);
    try {
      const explanation = await explainQuestionClientSide({
        question: currentQItem.q,
        format: currentQItem.format,
        opts: currentQItem.opts,
        correct: currentQItem.correct,
        tfItems: currentQItem.tfItems,
        shortAnswer: currentQItem.shortAnswer,
        rightCount: currentQItem.rightCount || 0,
        wrongCount: currentQItem.wrongCount || 0
      });
      setAiExplainText(explanation || 'Đang cập nhật phân tích kiến thức chi tiết.');
    } catch (err: any) {
      setAiExplainText('Lỗi kết nối AI Tutor: ' + (err.message || 'Không thể tải giải thích'));
    } finally {
      setAiExplainLoading(false);
    }
  };

  // Start contest - Giữ nguyên bộ đề đã chuẩn hóa, đồng bộ tức thì xuống máy học sinh
  const handleStartContest = () => {
    AudioFX.whistle();
    onUpdateMatchState(prev => ({
      ...prev,
      status: 'PLAYING',
      globalQIndex: 0,
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

  // Restart match for a fresh new game round
  const handleRestartMatch = () => {
    onUpdateMatchState(prev => ({
      ...prev,
      status: 'PLAYING',
      currentRound: 1,
      redRoundWins: 0,
      blueRoundWins: 0,
      ropeScore: 0,
      globalQIndex: 0,
      redAnsweredIds: [],
      blueAnsweredIds: [],
      bossHP: prev.settings?.bossMaxHP || 1000,
      maxBossHP: prev.settings?.bossMaxHP || 1000,
      redPlayers: prev.redPlayers.map(p => ({ ...p, lives: 3, eliminated: false, freeze: 0, correct: 0, wrongTotal: 0, streak: 0, fastScore: 0 })),
      bluePlayers: prev.bluePlayers.map(p => ({ ...p, lives: 3, eliminated: false, freeze: 0, correct: 0, wrongTotal: 0, streak: 0, fastScore: 0 }))
    }));
    setIsReviewMode(false);
  };

  // Leaderboard for Fast Mode
  const sortedFastLeaderboard = useMemo(() => {
    return [...allPlayers]
      .filter(p => (p.fastScore || 0) > 0)
      .sort((a, b) => (b.fastScore || 0) - (a.fastScore || 0));
  }, [allPlayers]);

  // Overall Top 10 Leaderboard across all modes
  const top10Leaderboard = useMemo(() => {
    return [...allPlayers].sort((a, b) => {
      const scoreA = (a.fastScore || 0) * 100 + (a.correct || 0) * 50 + (a.streak || 0) * 10 + (a.lives || 0);
      const scoreB = (b.fastScore || 0) * 100 + (b.correct || 0) * 50 + (b.streak || 0) * 10 + (b.lives || 0);
      return scoreB - scoreA;
    });
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

  // Dynamic responsive font size for question text based on length (Never cuts text, ensures 24pt+ readability for judges and back rows)
  const qTitleLength = (currentQItem.q || '').length;
  const qTextFontSize = qTitleLength > 200 ? '25px' : qTitleLength > 100 ? '29px' : '34px';
  const partInfo = getQuestionPartInfo(currentQItem.format);

  return (
    <section id="host-view" style={{ position: 'absolute', top: '50px', left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {/* Floor 1: Host Control & HUD Header */}
      <header id="arena-header" style={{
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        borderBottom: '2.5px solid #38bdf8',
        boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
        zIndex: 50,
        flexShrink: 0,
        padding: '4px 8px'
      }}>
        {/* 4 Khối 3D Màu Sắc Nằm Trên Cùng 1 Hàng */}
        <div className="toolbar-3d-row">
          {/* Khối 1: 🎮 ĐIỀU KHIỂN THI ĐẤU (Emerald 3D) */}
          <div className="block-3d b3d-emerald">
            <div className="block-3d-label">
              <span>🎮 ĐIỀU KHIỂN TRẬN ĐẤU</span>
              <span style={{ fontSize: '9.5px', color: '#a7f3d0' }}>
                {matchState.status === 'LOBBY' ? 'CHỜ BẮT ĐẦU' : matchState.status === 'PLAYING' ? 'ĐANG ĐẤU' : 'TẠM DỪNG'}
              </span>
            </div>
            <div className="block-3d-btns">
              {matchState.status === 'LOBBY' && (
                <button
                  className="b3d-btn"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: '1.5px solid #a7f3d0' }}
                  onClick={handleStartContest}
                  title="Bắt đầu trận đấu"
                >
                  ▶ BẮT ĐẦU
                </button>
              )}

              {matchState.status !== 'LOBBY' && matchState.status !== 'ENDED' && (
                <button
                  className="b3d-btn"
                  style={{ background: matchState.status === 'PLAYING' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #10b981, #059669)' }}
                  onClick={handlePauseMatch}
                  title={matchState.status === 'PLAYING' ? 'Tạm dừng trận đấu' : 'Tiếp tục trận đấu'}
                >
                  {matchState.status === 'PLAYING' ? '⏸ DỪNG' : '▶ TIẾP'}
                </button>
              )}

              <button
                className="b3d-btn"
                style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}
                onClick={handleForceAdvanceQ}
                title="Bỏ qua và chuyển sang câu hỏi tiếp theo"
              >
                ⏭️ QUA CÂU
              </button>

              {(matchState.gameType === 'BELL' || matchState.gameType === 'BOSS') && (
                <button
                  className="b3d-btn"
                  style={{ background: 'linear-gradient(135deg, #059669, #047857)', border: '1px solid #6ee7b7' }}
                  onClick={() => setShowRescueModal(true)}
                  title="Mở bảng cứu trợ học sinh"
                >
                  🛟 CỨU TRỢ {bellOutCount > 0 ? `(${bellOutCount})` : ''}
                </button>
              )}

              <button
                className="b3d-btn"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: '1px solid #fca5a5' }}
                onClick={handleEndMatch}
                title="Kết thúc trận đấu và xem bảng tổng kết chung cuộc"
              >
                ⏹ KẾT THÚC
              </button>
            </div>
          </div>

          {/* Khối 2: 📱 PHÒNG & KẾT NỐI QR (Sapphire 3D) */}
          <div className="block-3d b3d-sapphire">
            <div className="block-3d-label">
              <span>📱 PHÒNG & MÃ QR</span>
              <span style={{ fontSize: '9.5px', color: '#bae6fd' }}>
                🟢 P.{activeRoomId} ({allPlayers.length} HS)
              </span>
            </div>
            <div className="block-3d-btns">
              <button
                className="b3d-btn"
                style={{
                  background: qrVisible ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'linear-gradient(135deg, #475569, #334155)',
                  border: qrVisible ? '1.5px solid #7dd3fc' : '1px solid #94a3b8'
                }}
                onClick={() => setQrVisible(!qrVisible)}
                title={qrVisible ? "Ẩn 2 mã QR trên màn hình" : "Hiện lại 2 mã QR trên màn hình"}
              >
                {qrVisible ? '🙈 ẨN QR' : '📱 HIỆN QR'}
              </button>

              <button
                className="b3d-btn"
                style={{ background: isReviewMode ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #0284c7, #075985)' }}
                onClick={handleToggleReviewMode}
                title="Bật/Tắt chế độ chữa bài cho học sinh"
              >
                {isReviewMode ? '⚔️ THI TIẾP' : '✅ CHỮA BÀI'}
              </button>
            </div>
          </div>

          {/* Khối 3: 🏆 VINH DANH & DỮ LIỆU (Amber 3D) */}
          <div className="block-3d b3d-amber">
            <div className="block-3d-label">
              <span>🏆 VINH DANH & DỮ LIỆU</span>
              <span style={{ fontSize: '9.5px', color: '#fef08a' }}>GDPT 2018</span>
            </div>
            <div className="block-3d-btns">
              <button
                className="b3d-btn"
                style={{
                  background: 'linear-gradient(135deg, #d97706, #b45309)',
                  border: '1.5px solid #fde047',
                  boxShadow: '0 2px 6px rgba(245, 158, 11, 0.4)'
                }}
                onClick={() => setShowTop10Modal(true)}
                title="Mở Bảng vinh danh Top 10 cá nhân xuất sắc nhất"
              >
                🏆 TOP 10
              </button>

              <button
                className="b3d-btn"
                style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)', border: '1px solid #5eead4' }}
                onClick={handleDownloadCSV}
                title="Tải bảng điểm học sinh dạng file Excel (.csv)"
              >
                📊 XUẤT CSV
              </button>

              <button
                className="b3d-btn"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #4338ca)', border: '1px solid #a5b4fc' }}
                onClick={onExportHTMLSlide}
                title="Tải Slide trình chiếu (.html)"
              >
                📥 SLIDE
              </button>
            </div>
          </div>

          {/* Khối 4: ⚙️ HỆ THỐNG & GIAO DIỆN (Violet 3D) */}
          <div className="block-3d b3d-violet">
            <div className="block-3d-label">
              <span>⚙️ HỆ THỐNG & HIỂN THỊ</span>
              <span style={{ fontSize: '9.5px', color: '#e9d5ff' }}>3D ENGINE</span>
            </div>
            <div className="block-3d-btns">
              <button
                className="b3d-btn"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
                onClick={handleCycleSky}
                title="Đổi bối cảnh bầu trời 3D"
              >
                🌤️ ĐỔI TRỜI
              </button>

              {onOpenKeyModal && (
                <button
                  className="b3d-btn"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: '1px solid #c7d2fe' }}
                  onClick={onOpenKeyModal}
                  title="Cài đặt Google Gemini API Key"
                >
                  ⚙️ AI KEY
                </button>
              )}

              <button
                className="b3d-btn"
                style={{ background: 'linear-gradient(135deg, #0f766e, #115e59)' }}
                onClick={onToggleFullScreen}
                title="Bật/Tắt chế độ toàn màn hình"
              >
                🔲 TOÀN MÀN
              </button>

              <button
                className="b3d-btn"
                style={{ background: 'linear-gradient(135deg, #475569, #334155)', border: '1px solid #94a3b8' }}
                onClick={onReturnToSetup}
                title="Quay lại màn hình cài đặt của giáo viên"
              >
                🏠 CÀI ĐẶT
              </button>
            </div>
          </div>
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

        {/* Floating QR Badges (Compact, Responsive, and Minimizable) */}
        {qrVisible && (
          <>
            {/* Left QR Panel */}
            {qrMinimizedLeft ? (
              <button
                className="qr-minimized-pill left"
                onClick={() => setQrMinimizedLeft(false)}
                title="Mở lại mã QR Đỏ / Phòng thi"
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  background: 'rgba(15, 23, 42, 0.92)',
                  border: '1.5px solid #ef4444',
                  color: '#fef08a',
                  padding: '4px 10px',
                  borderRadius: '16px',
                  fontSize: '11px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  zIndex: 30,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}
              >
                📱 QR {matchState.gameType === 'TUG' ? 'ĐỎ' : 'PHÒNG'} ➕
              </button>
            ) : (
              <div
                className="qr-panel left"
                id="qr-panel-left"
                style={{ position: 'absolute', top: '8px', left: '10px', zIndex: 25 }}
                title="Bấm để phóng to QR"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 900, color: '#64748b' }}>QUÉT MÃ</span>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setQrMinimizedLeft(true); }}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '11px', cursor: 'pointer', padding: '0 2px' }}
                      title="Thu nhỏ QR"
                    >
                      ➖
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setQrVisible(false); }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer', padding: '0 2px', fontWeight: 900 }}
                      title="Ẩn mã QR"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div
                  className="qr-box-inner"
                  onClick={() => { setZoomedTeam('RED'); setZoomModalOpen(true); }}
                >
                  {qrRedImg && <img src={qrRedImg} alt="QR Đỏ" width={80} height={80} />}
                </div>
                <div
                  className="qr-caption"
                  style={{ color: matchState.gameType === 'FAST' ? '#9333ea' : 'var(--red)', fontSize: '10px', marginTop: '2px' }}
                  onClick={() => { setZoomedTeam('RED'); setZoomModalOpen(true); }}
                >
                  {matchState.gameType === 'BOSS' ? '🐉 VÀO DIỆT BOSS' : matchState.gameType === 'FAST' ? '⚡ AI NHANH NHẤT' : matchState.gameType === 'BELL' ? '🔔 RUNG CHUÔNG VÀNG' : 'ĐỘI ĐỎ 🔴'}
                </div>
                <div
                  className="qr-zoom-hint"
                  style={{ fontSize: '9px' }}
                  onClick={() => { setZoomedTeam('RED'); setZoomModalOpen(true); }}
                >
                  🔍 Bấm phóng to
                </div>
              </div>
            )}

            {/* Right QR Panel */}
            {qrMinimizedRight ? (
              <button
                className="qr-minimized-pill right"
                onClick={() => setQrMinimizedRight(false)}
                title="Mở lại mã QR Xanh / Phòng thi"
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  background: 'rgba(15, 23, 42, 0.92)',
                  border: '1.5px solid #0284c7',
                  color: '#fef08a',
                  padding: '4px 10px',
                  borderRadius: '16px',
                  fontSize: '11px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  zIndex: 30,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}
              >
                📱 QR {matchState.gameType === 'TUG' ? 'XANH' : 'PHÒNG'} ➕
              </button>
            ) : (
              <div
                className="qr-panel right"
                id="qr-panel-right"
                style={{ position: 'absolute', top: '8px', right: '10px', zIndex: 25 }}
                title="Bấm để phóng to QR"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 900, color: '#64748b' }}>QUÉT MÃ</span>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setQrMinimizedRight(true); }}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '11px', cursor: 'pointer', padding: '0 2px' }}
                      title="Thu nhỏ QR"
                    >
                      ➖
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setQrVisible(false); }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer', padding: '0 2px', fontWeight: 900 }}
                      title="Ẩn mã QR"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div
                  className="qr-box-inner"
                  onClick={() => { setZoomedTeam('BLUE'); setZoomModalOpen(true); }}
                >
                  {qrBlueImg && <img src={qrBlueImg} alt="QR Xanh" width={80} height={80} />}
                </div>
                <div
                  className="qr-caption"
                  style={{ color: matchState.gameType === 'FAST' ? '#9333ea' : 'var(--blue)', fontSize: '10px', marginTop: '2px' }}
                  onClick={() => { setZoomedTeam('BLUE'); setZoomModalOpen(true); }}
                >
                  {matchState.gameType === 'BOSS' ? '🐉 VÀO DIỆT BOSS' : matchState.gameType === 'FAST' ? '⚡ AI NHANH NHẤT' : matchState.gameType === 'BELL' ? '🔔 RUNG CHUÔNG VÀNG' : 'ĐỘI XANH 🔵'}
                </div>
                <div
                  className="qr-zoom-hint"
                  style={{ fontSize: '9px' }}
                  onClick={() => { setZoomedTeam('BLUE'); setZoomModalOpen(true); }}
                >
                  🔍 Bấm phóng to
                </div>
              </div>
            )}
          </>
        )}

        {/* Floating Quick Restore Button When QR Is Hidden */}
        {!qrVisible && (
          <button
            onClick={() => setQrVisible(true)}
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              color: '#ffffff',
              border: '2px solid #38bdf8',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 900,
              boxShadow: '0 4px 15px rgba(2, 132, 199, 0.55)',
              cursor: 'pointer',
              zIndex: 35,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Bấm để hiện lại mã QR quét tham gia sàn đấu"
          >
            📱 HIỆN MÃ QR
          </button>
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

        {/* 2 Khung Thi Đấu Rộng 2 Bên: Tên Đội Đỏ & Tên Đội Xanh */}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: qrVisible && !qrMinimizedLeft ? '110px' : '14px',
          zIndex: 22,
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(185, 28, 28, 0.95))',
          border: '2px solid #fecaca',
          borderBottom: '4.5px solid #7f1d1d',
          borderRadius: '16px',
          padding: '6px 14px',
          color: '#ffffff',
          fontWeight: 900,
          boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s ease'
        }}>
          <span style={{ fontSize: '18px' }}>🔴</span>
          <div>
            <div style={{ fontSize: '13.5px', letterSpacing: '0.5px' }}>ĐỘI ĐỎ</div>
            <div style={{ fontSize: '11px', color: '#fef08a' }}>
              {matchState.redPlayers.length} Thí sinh • {matchState.redTotalCorrect || 0} câu đúng
            </div>
          </div>
        </div>

        <div style={{
          position: 'absolute',
          top: '12px',
          right: qrVisible && !qrMinimizedRight ? '110px' : (showLiveTop10 && allPlayers.length > 0 ? '340px' : '14px'),
          zIndex: 22,
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.95), rgba(3, 105, 161, 0.95))',
          border: '2px solid #bae6fd',
          borderBottom: '4.5px solid #082f49',
          borderRadius: '16px',
          padding: '6px 14px',
          color: '#ffffff',
          fontWeight: 900,
          boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s ease'
        }}>
          <div>
            <div style={{ fontSize: '13.5px', letterSpacing: '0.5px', textAlign: 'right' }}>ĐỘI XANH</div>
            <div style={{ fontSize: '11px', color: '#fef08a', textAlign: 'right' }}>
              {matchState.bluePlayers.length} Thí sinh • {matchState.blueTotalCorrect || 0} câu đúng
            </div>
          </div>
          <span style={{ fontSize: '18px' }}>🔵</span>
        </div>

        {/* Live Top 10 Leaderboard (Bảng Ghi Nhận Top 10) */}
        {allPlayers.length > 0 && showLiveTop10 && (
          <aside className="fast-live-leaderboard" id="fast-live-leaderboard" style={{ display: 'flex' }} aria-label="Bảng ghi nhận Top 10 trực tiếp">
            <div className="flb-title">
              <span>🏆 BẢNG GHI NHẬN TOP 10</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#38bdf8' }}>{allPlayers.length} HS</span>
                <button
                  onClick={() => setShowLiveTop10(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', padding: '0 4px', fontWeight: 900 }}
                  title="Thu nhỏ Bảng Top 10"
                >
                  ➖
                </button>
              </div>
            </div>
            <div className="flb-list">
              {top10Leaderboard.slice(0, 10).map((p, idx) => {
                const rank = idx + 1;
                const medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : `#${rank}`));
                const isRedTeam = p.team === 'RED';
                const scoreDisplay = matchState.gameType === 'FAST'
                  ? `${p.fastScore || 0}đ`
                  : matchState.gameType === 'BELL'
                  ? `${p.correct || 0}đ [${p.lives || 0}❤️]`
                  : `${p.correct || 0} câu đúng`;
                return (
                  <div key={p.id} className={`flb-row rank-${rank}`}>
                    <div className="flb-rank">{medal}</div>
                    <div className="flb-name" title={p.label}>
                      <span style={{ fontSize: '10px', marginRight: '4px' }}>{isRedTeam ? '🔴' : '🔵'}</span>
                      {p.label} {p.lastDelta && p.lastDelta > 0 ? <span style={{ color: '#4ade80', fontSize: '10.5px' }}>(+{p.lastDelta})</span> : null}
                    </div>
                    <div className="flb-pts">
                      {scoreDisplay}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* Restore Top 10 Button If Minimized */}
        {allPlayers.length > 0 && !showLiveTop10 && (
          <button
            onClick={() => setShowLiveTop10(true)}
            style={{
              position: 'absolute',
              bottom: '12px',
              right: '12px',
              background: 'linear-gradient(135deg, #d97706, #b45309)',
              color: '#ffffff',
              border: '2px solid #fde047',
              borderRadius: '16px',
              padding: '6px 12px',
              fontSize: '11.5px',
              fontWeight: 900,
              cursor: 'pointer',
              zIndex: 30,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}
            title="Mở lại Bảng ghi nhận Top 10"
          >
            🏆 BẢNG TOP 10 ➕
          </button>
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

        {/* Dedicated Grand Finale Celebration Screen */}
        {matchState.status === 'ENDED' && (
          <GrandFinaleScreen
            matchState={matchState}
            activeRoomId={activeRoomId}
            onReviewMatch={() => {
              setIsReviewMode(true);
              setReviewQIdx(0);
              onUpdateMatchState(prev => ({ ...prev, status: 'PAUSED' }));
            }}
            onDownloadCSV={handleDownloadCSV}
            onExportHTMLSlide={onExportHTMLSlide}
            onPrintPDFEvidence={onPrintPDFEvidence}
            onRestartMatch={handleRestartMatch}
            onReturnToSetup={onReturnToSetup}
          />
        )}
      </div>

      {/* Floor 3: Khung Câu Hỏi & Đáp Án Chiếm 50% Chiều Cao Màn Hình - Bố Trí Lưới Đối Xứng 2x2 (4 Ô) - Chữ To Từ 24pt Trở Lên */}
      <section
        id="host-question-board"
        className={isReviewMode ? 'review-active' : ''}
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '50vh',
          minHeight: '50vh',
          maxHeight: '50vh',
          overflow: 'hidden',
          padding: '8px 18px 6px 18px',
          boxSizing: 'border-box'
        }}
        aria-label="Khung câu hỏi và đáp án chiếm 50% màn hình"
      >
        {/* Section Part Badge according to GDPT 2018 format */}
        <div style={{ order: 0, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexShrink: 0 }}>
          <span style={{
            background: partInfo.badgeColor,
            color: '#0f172a',
            padding: '3px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 900,
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            textTransform: 'uppercase'
          }}>
            {partInfo.partBadge}
          </span>
          <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 800 }}>
            {partInfo.partTitle}
          </span>
        </div>

        {/* Order 1: Khung Câu Hỏi Chữ To Từ 24pt Trở Lên, Tự Động Xuống Dòng Vừa Khung, Không Bị Mất Chữ */}
        <div
          id="hq-q-text"
          className="hq-title"
          style={{
            fontSize: qTextFontSize,
            lineHeight: 1.34,
            fontWeight: 900,
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            whiteSpace: 'normal',
            maxHeight: '17vh',
            overflowY: 'auto'
          }}
        >
          Câu {((currentQIndex % quizList.length) + 1)}: <MathRenderer text={cleanQuestionTitleText(currentQItem.q)} />
        </div>

        {/* Order 2: Khung Đáp Án Bố Trí Lưới Đối Xứng 2x2 (4 Ô) */}
        <div
          id="hq-q-opts"
          className="hq-opts"
          style={{
            order: 2,
            flex: '1 1 auto',
            maxHeight: '23vh',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: currentQItem.format === 'SHORT_ANSWER' ? '1fr' : 'repeat(2, 1fr)',
            gridTemplateRows: currentQItem.format === 'SHORT_ANSWER' ? 'auto' : 'repeat(2, 1fr)',
            gap: '10px',
            marginBottom: '4px'
          }}
        >
          {currentQItem.format === 'TRUE_FALSE' ? (
            // Dạng Phần II: Đúng/Sai 4 ý (a, b, c, d) bố trí lưới 2x2
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
                    padding: '8px 16px',
                    borderRadius: '14px',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    whiteSpace: 'normal',
                    fontSize: '20px',
                    fontWeight: 800,
                    lineHeight: 1.32,
                    background: reveal ? (tf.isCorrect ? 'linear-gradient(135deg, #065f46, #047857)' : 'linear-gradient(135deg, #7f1d1d, #991b1b)') : undefined,
                    border: reveal ? (tf.isCorrect ? '2px solid #4ade80' : '2px solid #f87171') : undefined
                  }}
                >
                  <span style={{ fontSize: '20px', flex: 1 }}>
                    <b style={{ color: '#fef08a', fontSize: '24px' }}>{tf.label})</b> <MathRenderer text={tf.text} />
                  </span>
                  {reveal && (
                    <span style={{ fontWeight: 900, color: tf.isCorrect ? '#4ade80' : '#fca5a5', fontSize: '15px', flexShrink: 0, marginLeft: '10px' }}>
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
                padding: '16px 20px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
                border: '2.5px dashed #818cf8',
                textAlign: 'center',
                color: '#ffffff',
                fontSize: '22px',
                fontWeight: 800,
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                whiteSpace: 'normal'
              }}
            >
              {isReviewMode ? (
                <div>
                  <span style={{ color: '#fef08a', fontWeight: 900, fontSize: '24px' }}>🎯 ĐÁP ÁN ĐÚNG: </span>
                  <span style={{ color: '#4ade80', fontWeight: 900, fontSize: '28px' }}>
                    <MathRenderer text={currentQItem.shortAnswer || currentQItem.opts[0] || ''} />
                  </span>
                </div>
              ) : (
                <div style={{ color: '#cbd5e1' }}>
                  ❓ <b>Dạng Trả Lời Ngắn:</b> Học sinh đang nhập số hoặc từ khóa trên điện thoại...
                </div>
              )}
            </div>
          ) : (
            // Dạng Phần I: 4 lựa chọn truyền thống (A, B, C, D) bố trí lưới 2x2 đối xứng, chữ to 24pt+
            currentQItem.opts.map((opt, idx) => {
              const isCorrect = idx === currentQItem.correct;
              const letter = String.fromCharCode(65 + idx);
              const revealClass = isReviewMode && isCorrect ? 'correct-reveal' : '';
              return (
                <div
                  key={idx}
                  className={`hq-opt-item opt-color-${idx % 4} ${revealClass}`}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '14px',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    whiteSpace: 'normal',
                    fontSize: opt.length > 70 ? '22px' : '26px',
                    fontWeight: 900,
                    lineHeight: 1.3
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1 }}>
                    <b style={{ color: '#fef08a', flexShrink: 0, fontSize: '28px' }}>{letter}.</b>
                    <span style={{ flex: 1 }}><MathRenderer text={opt} /></span>
                  </span>
                  {isReviewMode && isCorrect && (
                    <span style={{ color: '#4ade80', fontWeight: 900, fontSize: '15px', flexShrink: 0, marginLeft: '8px' }}>
                      ✓ ĐÚNG
                    </span>
                  )}
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
              <div>
                <button
                  type="button"
                  onClick={() => onOpenKeyModal && onOpenKeyModal()}
                  style={{
                    background: getStoredGeminiKey() ? '#064e3b' : '#334155',
                    border: `1px solid ${getStoredGeminiKey() ? '#10b981' : '#64748b'}`,
                    color: getStoredGeminiKey() ? '#a7f3d0' : '#e2e8f0',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Cài đặt Google Gemini API Key"
                >
                  ⚙️ {getStoredGeminiKey() ? 'Key AI Đã Kích Hoạt' : 'Cài Đặt Gemini Key'}
                </button>
              </div>
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

      {/* Top 10 Leaderboard Modal */}
      <Top10LeaderboardModal
        isOpen={showTop10Modal}
        onClose={() => setShowTop10Modal(false)}
        gameType={matchState.gameType}
        allPlayers={allPlayers}
        activeRoomId={activeRoomId}
        onDownloadCSV={handleDownloadCSV}
        onPrintPDFEvidence={onPrintPDFEvidence}
      />

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
