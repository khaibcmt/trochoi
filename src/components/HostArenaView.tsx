import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { MatchState, QuizItem, Player, GamePlayType } from '../types';
import { AudioFX } from '../services/audio';
import { CloudNetwork } from '../services/network';
import {
  cleanQuestionTitleText,
  cleanTFStatementText,
  repairQuizItemIfCorrupted,
  calculateFastestPoints,
  getConvertedGradeByRank,
  getTeacherGradebookScore,
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
  onSwitchGameType?: (type: GamePlayType) => void;
  onReturnToSetup: () => void;
  onToggleFullScreen: () => void;
  onExportHTMLSlide: () => void;
  onPrintPDFEvidence: () => void;
  onOpenKeyModal?: () => void;
  onOpenNationalDossier?: () => void;
}

export const HostArenaView: React.FC<Props> = ({
  matchState,
  quizList,
  activeRoomId,
  onUpdateMatchState,
  onUpdateQuizList,
  onSwitchGameType,
  onReturnToSetup,
  onToggleFullScreen,
  onExportHTMLSlide,
  onPrintPDFEvidence,
  onOpenKeyModal,
  onOpenNationalDossier
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
  const [liveRankMode, setLiveRankMode] = useState<'SCORE' | 'CORRECT'>('SCORE');

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

  // National Contest Demo Bots & Vietnamese TTS Voice Read-Aloud State
  const [demoBotsActive, setDemoBotsActive] = useState<boolean>(false);
  const [isSpeakingTTS, setIsSpeakingTTS] = useState<boolean>(false);
  const demoBotIntervalRef = useRef<any>(null);

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

    // Female Chibi 3D Pigtails & Bow if student selected Female ('female')
    if (avatar?.gender === 'female') {
      const hairDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45 });
      const bowMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.3 });
      const pigtailL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), hairDarkMat);
      pigtailL.position.set(0.48, 1.32, -0.05);
      pigtailL.scale.set(0.85, 1.35, 0.85);
      g.add(pigtailL);

      const pigtailR = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), hairDarkMat);
      pigtailR.position.set(-0.48, 1.32, -0.05);
      pigtailR.scale.set(0.85, 1.35, 0.85);
      g.add(pigtailR);

      const bowL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), bowMat);
      bowL.position.set(0.42, 1.48, 0.08);
      g.add(bowL);

      const bowR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), bowMat);
      bowR.position.set(-0.42, 1.48, 0.08);
      g.add(bowR);
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
      dropY: 0,
      isReadyInRope: true,
      currentZ: 0.42,
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

  // Atmosphere Applier (Không dùng sương mù để nhân vật 3D luôn rõ nét 100%, không bị nhòe màu)
  const applyRoundAtmosphere = (roundNum: number) => {
    if (!threeRef.current) return;
    const { scene, ambientLight, sunLight, grassMesh, sandMesh, starsGroup, stadiumLightsGroup } = threeRef.current;
    scene.fog = null;
    if (roundNum === 1) {
      scene.background = new THREE.Color(0x0f172a);
      ambientLight.color.setHex(0xffffff); ambientLight.intensity = 1.15;
      sunLight.color.setHex(0xffffff); sunLight.intensity = 1.35; sunLight.position.set(12, 25, 16);
      (grassMesh.material as THREE.MeshLambertMaterial).color.setHex(0x0f172a);
      (sandMesh.material as THREE.MeshStandardMaterial).color.setHex(0x1e293b);
      if (starsGroup) starsGroup.visible = false;
      if (stadiumLightsGroup) stadiumLightsGroup.visible = true;
    } else if (roundNum === 2) {
      scene.background = new THREE.Color(0x1e1b4b);
      ambientLight.color.setHex(0xffffff); ambientLight.intensity = 1.1;
      sunLight.color.setHex(0xfef08a); sunLight.intensity = 1.35; sunLight.position.set(-20, 15, 12);
      (grassMesh.material as THREE.MeshLambertMaterial).color.setHex(0x1e1b4b);
      (sandMesh.material as THREE.MeshStandardMaterial).color.setHex(0x312e81);
      if (starsGroup) starsGroup.visible = true;
      if (stadiumLightsGroup) stadiumLightsGroup.visible = true;
    } else {
      scene.background = new THREE.Color(0x090d16);
      ambientLight.color.setHex(0xffffff); ambientLight.intensity = 1.05;
      sunLight.color.setHex(0xe0f2fe); sunLight.intensity = 1.3; sunLight.position.set(0, 22, 12);
      (grassMesh.material as THREE.MeshLambertMaterial).color.setHex(0x090d16);
      (sandMesh.material as THREE.MeshStandardMaterial).color.setHex(0x1e293b);
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
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = null;

    const camera = new THREE.PerspectiveCamera(48, vp.clientWidth / vp.clientHeight, 0.1, 100);
    camera.position.set(0, 5.2, 11.2);
    camera.lookAt(0, 1.6, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(vp.clientWidth, vp.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.15);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.35);
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
    stadiumLightsGroup.visible = true;
    scene.add(stadiumLightsGroup);

    // Ground - Sân vận động nền tối tương phản cao giúp nhân vật nổi bật rõ nét
    const stadiumGroundMesh = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: 0x0f172a }));
    stadiumGroundMesh.rotation.x = -Math.PI / 2;
    stadiumGroundMesh.receiveShadow = true;
    scene.add(stadiumGroundMesh);

    // Khung học sinh đứng thi đấu - Nền xanh đen đậm tương phản cao giúp nhân vật Chibi không bị chói hay nhòe màu
    const whitePlatformMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.1
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

          // Khóa cố định vị trí đứng trên mặt sàn (Tuyệt đối không nhảy nhót lên xuống theo trục Y)
          u.dropY = 0;
          g.position.y = curMode === 'BELL' ? (u.baseBellY || 0.22) : 0;
          if (curMode === 'TUG') {
            g.position.z = 0.42;
            const spacing = 1.25;
            const baseX = isRedTeam
              ? -1.6 - idx * spacing
              : 1.6 + idx * spacing;
            g.position.x = baseX + ropeMesh.position.x;
          }

          // Ice block toggle: Chỉ trò Kéo Co (TUG) mới có hiệu ứng đóng băng, và Rung Chuông Vàng (BELL) khi bị loại
          if (u.ice) {
            u.ice.visible = curMode === 'TUG' ? (pData.freeze || 0) > Date.now() : (curMode === 'BELL' ? isElim : false);
          }

          // Chuyển động duy nhất: đứng im tại chỗ, chỉ lắc qua lắc lại nhẹ nhàng (trục Z)
          const swaySideToSide = isElim ? 0 : Math.sin(elapsed * 2.2 + idx * 0.5) * 0.08;

          // Mode-specific character posture (không bao giờ thay đổi g.position.y)
          if (curMode === 'BELL') {
            if (u.matGroup) u.matGroup.visible = true;
            if (u.boardGroup) u.boardGroup.visible = true;
            if (u.weaponOrb) u.weaponOrb.visible = false;

            if (u.body) u.body.position.y = 0.38;
            if (u.head) u.head.position.y = 0.98;
            if (u.shoeL) { u.shoeL.position.set(0.2, 0.08, 0.18); u.shoeL.rotation.z = 0.5; }
            if (u.shoeR) { u.shoeR.position.set(-0.2, 0.08, 0.18); u.shoeR.rotation.z = -0.5; }

            g.rotation.z = swaySideToSide;

            if (!isElim) {
              if (hasDoneQ) {
                if (u.boardGroup) {
                  u.boardGroup.position.set(0, 1.25, 0.2);
                  u.boardGroup.rotation.x = -0.15;
                }
                if (u.head) u.head.rotation.x = -0.1;
                if (u.armL) u.armL.rotation.x = -Math.PI * 0.75;
                if (u.armR) u.armR.rotation.x = -Math.PI * 0.75;
              } else {
                if (u.boardGroup) {
                  u.boardGroup.position.set(0, 0.55, 0.36);
                  u.boardGroup.rotation.x = 0.1;
                }
                if (u.head) u.head.rotation.x = 0;
                if (u.armL) u.armL.rotation.x = -0.65;
                if (u.armR) u.armR.rotation.x = -0.65;
              }
            } else {
              if (u.head) u.head.rotation.x = 0.45;
              if (u.boardGroup) u.boardGroup.position.set(0, 0.22, 0.36);
            }
          } else if (curMode === 'BOSS') {
            if (u.weaponOrb) u.weaponOrb.visible = true;
            if (u.boardGroup) u.boardGroup.visible = false;
            if (u.matGroup) u.matGroup.visible = false;

            if (u.body) u.body.position.y = 0.65;
            if (u.head) u.head.position.y = 1.36;

            g.rotation.z = swaySideToSide;
            g.rotation.x = 0;

            if (u.weaponOrb) {
              u.weaponOrb.rotation.y += 0.04;
              u.weaponOrb.position.y = 0.95;
              u.weaponOrb.scale.setScalar(hasDoneQ ? 1.3 : 1.0);
            }

            if (hasDoneQ) {
              if (u.armR) u.armR.rotation.x = -Math.PI * 0.55;
              if (u.armL) u.armL.rotation.x = -Math.PI / 4;
            } else {
              if (u.armR) u.armR.rotation.x = -Math.PI / 3;
              if (u.armL) u.armL.rotation.x = -Math.PI / 3;
            }
          } else if (curMode === 'TUG') {
            if (u.boardGroup) u.boardGroup.visible = false;
            if (u.matGroup) u.matGroup.visible = false;
            if (u.weaponOrb) u.weaponOrb.visible = false;

            if (u.body) u.body.position.y = 0.65;
            if (u.head) u.head.position.y = 1.36;

            const baseLean = isRedTeam ? 0.14 : -0.14;
            g.rotation.z = baseLean + swaySideToSide;
            g.rotation.x = 0;
            if (u.armL) u.armL.rotation.x = -Math.PI / 3;
            if (u.armR) u.armR.rotation.x = -Math.PI / 3;
          } else {
            // FAST mode: Đứng im tại chỗ, chỉ lắc qua lắc lại
            if (u.boardGroup) u.boardGroup.visible = false;
            if (u.matGroup) u.matGroup.visible = false;
            if (u.weaponOrb) u.weaponOrb.visible = false;

            if (u.body) u.body.position.y = 0.65;
            if (u.head) u.head.position.y = 1.36;

            g.rotation.z = swaySideToSide;
            g.rotation.x = 0;
            if (u.armL) u.armL.rotation.x = -0.4;
            if (u.armR) u.armR.rotation.x = -0.4;
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

  // Current Question (tự động phục hồi nếu câu hỏi Phần II bị dính mệnh đề hoặc rác CSS Word)
  const safeTotalQuestions = Math.max(1, quizList.length);
  const currentQIndex = Math.min(Math.max(0, isReviewMode ? reviewQIdx : matchState.globalQIndex), safeTotalQuestions - 1);
  const rawCurrentQItem: QuizItem = quizList[currentQIndex] || {
    qid: 0,
    q: 'Đang tải câu hỏi...',
    opts: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
    correct: 0,
    format: 'MULTIPLE_CHOICE'
  };
  const currentQItem: QuizItem = useMemo(() => repairQuizItemIfCorrupted(rawCurrentQItem), [rawCurrentQItem]);

  // Keep latest quizList in ref so updating rightCount/wrongCount when students answer NEVER restarts the 30s timer
  const quizListRef = useRef<QuizItem[]>(quizList);
  useEffect(() => {
    quizListRef.current = quizList;
  }, [quizList]);

  const activeTimerQuestionKeyRef = useRef<string>('');

  // 30-Second Countdown Timer Implementation:
  // Bắt đầu tính giờ ngay khi hiện câu hỏi, KHÔNG BAO GIỜ reset khi học sinh trả lời đúng/sai, hết 30s là tự động qua câu khác (không chọn coi như sai)
  useEffect(() => {
    if (matchState.status !== 'PLAYING') {
      activeTimerQuestionKeyRef.current = '';
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    const currentDeck = quizListRef.current;
    const totalCount = Math.max(1, currentDeck.length);

    // Nếu đã vượt quá câu hỏi cuối cùng thì lập tức dừng và thông báo kết quả cuối cùng, tuyệt đối không quay lại câu 1
    if (matchState.globalQIndex >= totalCount) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      AudioFX.winFanfare();
      CloudNetwork.sendMessage({
        type: 'MATCH_ENDED',
        status: 'ENDED',
        globalQIndex: totalCount - 1
      });
      onUpdateMatchState(prev => ({
        ...prev,
        status: 'ENDED',
        globalQIndex: totalCount - 1
      }));
      return;
    }

    const timerKey = `PLAYING_Q_${matchState.globalQIndex}_${durationSec}`;
    if (activeTimerQuestionKeyRef.current === timerKey) {
      // Đang đếm ngược cho chính câu hỏi này -> tuyệt đối không reset lại 30 giây
      return;
    }
    activeTimerQuestionKeyRef.current = timerKey;

    setRemainingSec(durationSec);
    timerStartMsRef.current = Date.now();
    isTransitioningRef.current = false;
    correctOrderCountRef.current = 0;

    const safeIdx = Math.min(Math.max(0, matchState.globalQIndex), totalCount - 1);
    const rawQ = currentDeck[safeIdx] || currentQItem;
    const activeQWithMeta = {
      ...rawQ,
      qIndex: safeIdx,
      totalQuestions: totalCount
    };

    // Broadcast question started ONCE when this question appears
    CloudNetwork.sendMessage({
      type: 'QUESTION_START',
      qIndex: safeIdx,
      durationSec: durationSec,
      serverStartTime: timerStartMsRef.current,
      question: activeQWithMeta,
      quiz: currentDeck
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
      // Chỉ dọn interval khi unmount hoặc khi đổi sang câu hỏi mới / đổi trạng thái trận đấu
    };
  }, [matchState.status, matchState.globalQIndex, durationSec]);

  // Clean up timer interval on component unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Handle Timeout: Hết 30 giây -> Học sinh không chọn đáp án coi như SAI; nếu là câu cuối cùng thì NGỪNG và thông báo kết quả cuối cùng!
  const handleQuestionTimeout = () => {
    onUpdateMatchState(prev => {
      if (prev.status !== 'PLAYING') return prev;
      const answeredIds = [...prev.redAnsweredIds, ...prev.blueAnsweredIds];
      const isBell = prev.gameType === 'BELL';

      const updateUnansweredPlayer = (p: Player): Player => {
        if (answeredIds.includes(p.id)) return p;
        // Học sinh không chọn đáp án khi hết giờ -> Coi như trả lời SAI
        if (isBell) {
          if (p.eliminated) return p;
          const nextL = Math.max(0, (p.lives ?? 3) - 1);
          const nextElim = nextL <= 0;
          CloudNetwork.sendMessage({
            type: 'PLAYER_LIVES_SYNC',
            playerId: p.id,
            lives: nextL,
            streak: 0,
            eliminated: nextElim,
            fastScore: p.fastScore
          });
          return {
            ...p,
            lives: nextL,
            eliminated: nextElim,
            role: nextElim ? 'SPECTATOR' : p.role,
            streak: 0,
            lastDelta: 0,
            wrongTotal: (p.wrongTotal || 0) + 1
          };
        }
        if (prev.gameType === 'FAST' || prev.gameType === 'BOSS') {
          // Trong trò Ai Nhanh Hơn (FAST) và Đánh Boss (BOSS): Không chọn coi như SAI -> Trừ 1000 điểm!
          const nextScore = (p.fastScore || 0) - 1000;
          CloudNetwork.sendMessage({
            type: 'PLAYER_LIVES_SYNC',
            playerId: p.id,
            lives: 3,
            streak: 0,
            eliminated: false,
            fastScore: nextScore
          });
          return {
            ...p,
            streak: 0,
            fastScore: nextScore,
            lastDelta: -1000,
            wrongTotal: (p.wrongTotal || 0) + 1
          };
        }
        // Trò Kéo Co: Ghi nhận 1 câu sai, reset chuỗi thắng, được 0 điểm câu này
        return {
          ...p,
          streak: 0,
          lastDelta: 0,
          wrongTotal: (p.wrongTotal || 0) + 1
        };
      };

      const updatedRed = prev.redPlayers.map(updateUnansweredPlayer);
      const updatedBlue = prev.bluePlayers.map(updateUnansweredPlayer);

      const totalCount = Math.max(1, quizListRef.current.length || quizList.length || 1);
      // Nếu đã làm hết câu hỏi cuối cùng -> NGỪNG NGAY và mở màn hình Kết Quả Cuối Cùng (không chạy lại câu 1)
      if (prev.globalQIndex + 1 >= totalCount) {
        AudioFX.winFanfare();
        CloudNetwork.sendMessage({
          type: 'MATCH_ENDED',
          status: 'ENDED',
          globalQIndex: totalCount - 1
        });
        return {
          ...prev,
          status: 'ENDED',
          globalQIndex: totalCount - 1,
          redAnsweredIds: [],
          blueAnsweredIds: [],
          redPlayers: updatedRed,
          bluePlayers: updatedBlue
        };
      }

      AudioFX.freezeCrack();
      return {
        ...prev,
        globalQIndex: prev.globalQIndex + 1,
        redAnsweredIds: [],
        blueAnsweredIds: [],
        redPlayers: updatedRed,
        bluePlayers: updatedBlue
      };
    });
  };

  // Force advance (Nếu đang ở câu cuối cùng thì kết thúc và công bố kết quả luôn, không quay lại câu 1)
  const handleForceAdvanceQ = () => {
    const totalCount = Math.max(1, quizListRef.current.length || quizList.length || 1);
    onUpdateMatchState(prev => {
      if (prev.globalQIndex + 1 >= totalCount) {
        AudioFX.winFanfare();
        CloudNetwork.sendMessage({
          type: 'MATCH_ENDED',
          status: 'ENDED',
          globalQIndex: totalCount - 1
        });
        return {
          ...prev,
          status: 'ENDED',
          globalQIndex: totalCount - 1,
          redAnsweredIds: [],
          blueAnsweredIds: []
        };
      }
      return {
        ...prev,
        globalQIndex: prev.globalQIndex + 1,
        redAnsweredIds: [],
        blueAnsweredIds: []
      };
    });
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

  // MC Voice Read-Aloud (Vietnamese TTS) for National Contest Classroom Presentation
  const handleReadQuestionAloud = () => {
    if (!('speechSynthesis' in window)) return;
    if (isSpeakingTTS) {
      window.speechSynthesis.cancel();
      setIsSpeakingTTS(false);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanQ = cleanQuestionTitleText(currentQItem.q)
      .replace(/\$+/g, '')
      .replace(/\\[a-zA-Z]+/g, '');
    let script = `Câu hỏi số ${(currentQIndex % (quizList.length || 1)) + 1}. ${cleanQ}. `;
    if (currentQItem.format === 'TRUE_FALSE' && currentQItem.tfItems) {
      script += 'Hãy xét tính Đúng hoặc Sai của 4 mệnh đề: ';
      currentQItem.tfItems.forEach(tf => {
        script += `Ý ${tf.label}: ${tf.text}. `;
      });
    } else if (currentQItem.format === 'SHORT_ANSWER') {
      script += 'Các em hãy tính toán và nhập kết quả trả lời ngắn trên màn hình điện thoại.';
    } else if (currentQItem.opts) {
      currentQItem.opts.forEach((opt, idx) => {
        script += `Phương án ${String.fromCharCode(65 + idx)}: ${opt}. `;
      });
    }

    const utter = new SpeechSynthesisUtterance(script);
    utter.lang = 'vi-VN';
    utter.rate = 1.02;
    utter.onend = () => setIsSpeakingTTS(false);
    utter.onerror = () => setIsSpeakingTTS(false);
    setIsSpeakingTTS(true);
    window.speechSynthesis.speak(utter);
  };

  // Toggle National Jury Classroom Simulation (Spawns realistic 3D students & simulates live answering)
  const handleToggleDemoBots = () => {
    const demoRoster = [
      { id: 'bot_1', label: 'Nguyễn Minh Khôi', team: 'RED' as const, costume: 'superhero' as const, hair: 'crown' as const, color: '#f59e0b' },
      { id: 'bot_2', label: 'Trần Ngọc Bảo Trâm', team: 'BLUE' as const, costume: 'aodai' as const, hair: 'beret' as const, color: '#ec4899' },
      { id: 'bot_3', label: 'Lê Hoàng Gia Huy', team: 'RED' as const, costume: 'sport' as const, hair: 'cap' as const, color: '#10b981' },
      { id: 'bot_4', label: 'Phạm Phương Thảo', team: 'BLUE' as const, costume: 'aodai' as const, hair: 'headband' as const, color: '#0284c7' },
      { id: 'bot_5', label: 'Võ Quốc Anh', team: 'RED' as const, costume: 'uniform' as const, hair: 'cyber' as const, color: '#8b5cf6' },
      { id: 'bot_6', label: 'Đặng Khánh Linh', team: 'BLUE' as const, costume: 'uniform' as const, hair: 'crown' as const, color: '#f59e0b' },
      { id: 'bot_7', label: 'Huỳnh Tuấn Kiệt', team: 'RED' as const, costume: 'sport' as const, hair: 'cap' as const, color: '#ef4444' },
      { id: 'bot_8', label: 'Bùi Thanh Trúc', team: 'BLUE' as const, costume: 'aodai' as const, hair: 'beret' as const, color: '#10b981' },
      { id: 'bot_9', label: 'Đỗ Quang Minh', team: 'RED' as const, costume: 'superhero' as const, hair: 'cyber' as const, color: '#0284c7' },
      { id: 'bot_10', label: 'Ngô Bảo Ngọc', team: 'BLUE' as const, costume: 'uniform' as const, hair: 'headband' as const, color: '#ec4899' },
      { id: 'bot_11', label: 'Lý Hải Đăng', team: 'RED' as const, costume: 'uniform' as const, hair: 'cap' as const, color: '#f59e0b' },
      { id: 'bot_12', label: 'Phan Thảo Vy', team: 'BLUE' as const, costume: 'sport' as const, hair: 'crown' as const, color: '#8b5cf6' }
    ];

    if (!demoBotsActive) {
      AudioFX.spawnPop();
      onUpdateMatchState(prev => {
        const existingIds = new Set([...prev.redPlayers, ...prev.bluePlayers].map(p => p.id));
        const newRed = [...prev.redPlayers];
        const newBlue = [...prev.bluePlayers];

        demoRoster.forEach(b => {
          if (!existingIds.has(b.id)) {
            const pObj: Player = {
              id: b.id,
              label: b.label,
              team: b.team,
              ready: true,
              spawned: true,
              correct: 0,
              freeze: 0,
              role: 'PULLER',
              lives: 3,
              wrongTotal: 0,
              streak: 0,
              eliminated: false,
              fastScore: 0,
              avatar: {
                hairStyle: b.hair,
                costume: b.costume,
                accessoryColor: b.color,
                expression: 'happy'
              }
            };
            if (b.team === 'RED') newRed.push(pObj);
            else newBlue.push(pObj);
          }
        });

        return {
          ...prev,
          redPlayers: newRed,
          bluePlayers: newBlue
        };
      });
      setDemoBotsActive(true);
      triggerRescueBanner('🤖 ĐÃ BẬT LỚP HỌC GIẢ LẬP (12 HS 3D) PHỤC VỤ THUYẾT TRÌNH GIÁM KHẢO!');
    } else {
      setDemoBotsActive(false);
    }
  };

  // Run automated Demo Bot answers when demoBotsActive && matchState.status === 'PLAYING'
  useEffect(() => {
    if (!demoBotsActive || matchState.status !== 'PLAYING') {
      if (demoBotIntervalRef.current) clearInterval(demoBotIntervalRef.current);
      return;
    }

    demoBotIntervalRef.current = setInterval(() => {
      onUpdateMatchState(prev => {
        if (prev.status !== 'PLAYING') return prev;
        const answeredSet = new Set([...prev.redAnsweredIds, ...prev.blueAnsweredIds]);
        const allBots = [...prev.redPlayers, ...prev.bluePlayers].filter(
          p => p.id.startsWith('bot_') && !answeredSet.has(p.id) && !(prev.gameType === 'BELL' && p.eliminated)
        );
        if (allBots.length === 0) return prev;

        const chosen = allBots[Math.floor(Math.random() * allBots.length)];
        const isCorrect = Math.random() < 0.76; // 76% realistic accuracy

        const activeDeck = quizListRef.current;
        const curQ = activeDeck[prev.globalQIndex % (activeDeck.length || 1)];

        const nextRedAns =
          chosen.team === 'RED' && !prev.redAnsweredIds.includes(chosen.id)
            ? [...prev.redAnsweredIds, chosen.id]
            : prev.redAnsweredIds;
        const nextBlueAns =
          chosen.team === 'BLUE' && !prev.blueAnsweredIds.includes(chosen.id)
            ? [...prev.blueAnsweredIds, chosen.id]
            : prev.blueAnsweredIds;

        if (isCorrect) {
          AudioFX.pullHeave();
          if (curQ) curQ.rightCount = (curQ.rightCount || 0) + 1;
          const gained = 1000;

          const updateWinner = (p: Player): Player => {
            if (p.id !== chosen.id) return p;
            return {
              ...p,
              correct: (p.correct || 0) + 1,
              streak: (p.streak || 0) + 1,
              fastScore: (p.fastScore || 0) + gained,
              lastDelta: gained
            };
          };

          const pullStep = chosen.team === 'BLUE' ? 0.75 : -0.75;
          const nextRope = prev.gameType === 'TUG' ? Math.max(-6, Math.min(6, prev.ropeScore + pullStep)) : prev.ropeScore;
          const nextBossHP = prev.gameType === 'BOSS' ? Math.max(0, (prev.bossHP || 1000) - 150) : prev.bossHP;

          return {
            ...prev,
            ropeScore: nextRope,
            bossHP: nextBossHP,
            status: prev.gameType === 'BOSS' && nextBossHP <= 0 ? 'ENDED' : prev.status,
            redRoundWins: prev.gameType === 'TUG' && chosen.team === 'RED' ? prev.redRoundWins + 1 : prev.redRoundWins,
            blueRoundWins: prev.gameType === 'TUG' && chosen.team === 'BLUE' ? prev.blueRoundWins + 1 : prev.blueRoundWins,
            redTotalCorrect: chosen.team === 'RED' ? prev.redTotalCorrect + 1 : prev.redTotalCorrect,
            blueTotalCorrect: chosen.team === 'BLUE' ? prev.blueTotalCorrect + 1 : prev.blueTotalCorrect,
            redAnsweredIds: nextRedAns,
            blueAnsweredIds: nextBlueAns,
            redPlayers: prev.redPlayers.map(updateWinner),
            bluePlayers: prev.bluePlayers.map(updateWinner)
          };
        } else {
          if (curQ) curQ.wrongCount = (curQ.wrongCount || 0) + 1;
          const updateLoser = (p: Player): Player => {
            if (p.id !== chosen.id) return p;
            if (prev.gameType === 'BELL') {
              const nextL = Math.max(0, (p.lives ?? 3) - 1);
              return {
                ...p,
                lives: nextL,
                eliminated: nextL <= 0,
                role: nextL <= 0 ? 'SPECTATOR' : p.role,
                streak: 0,
                wrongTotal: (p.wrongTotal || 0) + 1
              };
            }
            if (prev.gameType === 'FAST' || prev.gameType === 'BOSS') {
              return {
                ...p,
                streak: 0,
                fastScore: (p.fastScore || 0) - 1000,
                lastDelta: -1000,
                wrongTotal: (p.wrongTotal || 0) + 1
              };
            }
            return {
              ...p,
              streak: 0,
              wrongTotal: (p.wrongTotal || 0) + 1,
              freeze: prev.gameType === 'TUG' ? Date.now() + 2500 : 0
            };
          };

          return {
            ...prev,
            redAnsweredIds: nextRedAns,
            blueAnsweredIds: nextBlueAns,
            redPlayers: prev.redPlayers.map(updateLoser),
            bluePlayers: prev.bluePlayers.map(updateLoser)
          };
        }
      });
    }, 1150);

    return () => {
      if (demoBotIntervalRef.current) clearInterval(demoBotIntervalRef.current);
    };
  }, [demoBotsActive, matchState.status, matchState.globalQIndex]);

  // Chuẩn bị sàn đấu để tập hợp đủ học sinh (Giữ nguyên toàn bộ học sinh đã kết nối, đưa học sinh về Phòng chờ xem câu hỏi)
  const handlePrepareArenaGather = () => {
    AudioFX.whistle();
    const firstQ = quizList[0] ? { ...quizList[0], qIndex: 0, totalQuestions: quizList.length } : undefined;
    onUpdateMatchState(prev => ({
      ...prev,
      status: 'LOBBY',
      globalQIndex: 0,
      ropeScore: 0,
      redAnsweredIds: [],
      blueAnsweredIds: [],
      bossHP: prev.settings?.bossMaxHP || 1000,
      maxBossHP: prev.settings?.bossMaxHP || 1000,
      redPlayers: prev.redPlayers.map(p => ({ ...p, lives: 3, eliminated: false, freeze: 0, correct: 0, wrongTotal: 0, streak: 0, fastScore: 0 })),
      bluePlayers: prev.bluePlayers.map(p => ({ ...p, lives: 3, eliminated: false, freeze: 0, correct: 0, wrongTotal: 0, streak: 0, fastScore: 0 }))
    }));
    setQrVisible(true);
    setQrMinimizedLeft(false);
    setQrMinimizedRight(false);
    CloudNetwork.sendMessage({
      type: 'GAME_SWITCH',
      gameType: matchState.gameType,
      status: 'LOBBY',
      qIndex: 0,
      question: firstQ,
      quiz: quizList
    });
  };

  // Start contest - Khi giáo viên bấm Bắt đầu, mở khóa cho học sinh trong phòng chờ bắt đầu trả lời ngay lập tức
  const handleStartContest = () => {
    AudioFX.whistle();
    const firstQ = quizList[0] ? { ...quizList[0], qIndex: 0, totalQuestions: quizList.length } : undefined;
    const startPayload = {
      type: 'QUESTION_START' as const,
      status: 'PLAYING' as const,
      qIndex: 0,
      durationSec: durationSec,
      serverStartTime: Date.now(),
      question: firstQ,
      quiz: quizList
    };
    CloudNetwork.sendMessage(startPayload);
    CloudNetwork.sendMessage({
      type: 'MATCH_START',
      status: 'PLAYING',
      qIndex: 0,
      question: firstQ,
      quiz: quizList
    });
    setTimeout(() => {
      CloudNetwork.sendMessage(startPayload);
    }, 250);
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
    const nextStatus = matchState.status === 'PLAYING' ? 'PAUSED' : 'PLAYING';
    const curQ = quizList[matchState.globalQIndex % (quizList.length || 1)];
    onUpdateMatchState(prev => ({
      ...prev,
      status: nextStatus
    }));
    CloudNetwork.sendMessage({
      type: 'PAUSE_TOGGLE',
      status: nextStatus,
      qIndex: matchState.globalQIndex,
      question: curQ ? ({ ...curQ, qIndex: matchState.globalQIndex } as any) : undefined,
      quiz: quizList
    });
  };

  // End match
  const handleEndMatch = () => {
    if (confirm('Bạn có chắc muốn kết thúc trận đấu và xem bảng tổng kết?')) {
      AudioFX.winFanfare();
      CloudNetwork.sendMessage({
        type: 'MATCH_ENDED',
        status: 'ENDED',
        globalQIndex: matchState.globalQIndex
      });
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

  // Step Question in review or live mode (Không tự động quay vòng lại câu 1 khi đã hết câu cuối)
  const handleStepQ = (delta: number) => {
    const totalCount = Math.max(1, quizList.length);
    if (isReviewMode) {
      setReviewQIdx(prev => Math.min(Math.max(0, prev + delta), totalCount - 1));
    } else {
      onUpdateMatchState(prev => {
        const next = prev.globalQIndex + delta;
        if (delta > 0 && next >= totalCount) {
          AudioFX.winFanfare();
          CloudNetwork.sendMessage({
            type: 'MATCH_ENDED',
            status: 'ENDED',
            globalQIndex: totalCount - 1
          });
          return {
            ...prev,
            status: 'ENDED',
            globalQIndex: totalCount - 1,
            redAnsweredIds: [],
            blueAnsweredIds: []
          };
        }
        return {
          ...prev,
          globalQIndex: Math.min(Math.max(0, next), totalCount - 1),
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

  // Export CSV (Bao gồm cả Thứ hạng theo Điểm Thi Đấu và Thứ hạng theo Số Câu Đúng + Điểm Ghi Sổ Điểm Giáo Viên)
  const handleDownloadCSV = () => {
    let csv = '\uFEFFHạng (Theo Điểm),Hạng (Theo Câu Đúng),Họ và Tên,Đội,Số Câu Đúng,Số Câu Sai,Tổng Điểm Thi Đấu (-1000đ/sai),Điểm Ghi Sổ Điểm GV (Thang 10),Trạng Thái\n';
    const byScore = [...allPlayers].sort((a, b) => {
      if ((b.fastScore || 0) !== (a.fastScore || 0)) return (b.fastScore || 0) - (a.fastScore || 0);
      return (b.correct || 0) - (a.correct || 0);
    });
    const byCorrect = [...allPlayers].sort((a, b) => {
      if ((b.correct || 0) !== (a.correct || 0)) return (b.correct || 0) - (a.correct || 0);
      return (b.fastScore || 0) - (a.fastScore || 0);
    });

    byCorrect.forEach((p, idxCorrect) => {
      const rankByCorrect = idxCorrect + 1;
      const rankByScore = byScore.findIndex(x => x.id === p.id) + 1;
      const gb = getTeacherGradebookScore(p.correct || 0, quizList.length || 12, rankByCorrect);
      csv += `"${rankByScore}","${rankByCorrect}","${p.label}","${p.team}","${p.correct || 0}","${p.wrongTotal || 0}","${p.fastScore || 0}","${gb.grade}","${p.eliminated ? 'Khán giả' : 'Trụ sàn'}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `SoDiem_GiaoVien_Phong${activeRoomId}.csv`;
    link.click();
  };

  // Restart match for a fresh new game round
  const handleRestartMatch = () => {
    const firstQ = quizList[0] ? { ...quizList[0], qIndex: 0, totalQuestions: quizList.length } : undefined;
    CloudNetwork.sendMessage({
      type: 'MATCH_START',
      status: 'PLAYING',
      qIndex: 0,
      question: firstQ,
      quiz: quizList
    });
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

  // 1. Bảng xếp hạng tính theo Tổng Điểm Thi Đấu (fastScore - có trừ 1000đ mỗi câu sai ở Ai Nhanh Hơn & Đánh Boss)
  const top10Leaderboard = useMemo(() => {
    return [...allPlayers].sort((a, b) => {
      if (matchState.gameType === 'BELL') {
        if (!a.eliminated && b.eliminated) return -1;
        if (a.eliminated && !b.eliminated) return 1;
        if ((b.lives || 0) !== (a.lives || 0)) return (b.lives || 0) - (a.lives || 0);
      }
      if ((b.fastScore || 0) !== (a.fastScore || 0)) {
        return (b.fastScore || 0) - (a.fastScore || 0);
      }
      return (b.correct || 0) - (a.correct || 0);
    });
  }, [allPlayers, matchState.gameType]);

  // 2. Bảng xếp hạng tính theo Số Câu Trả Lời Đúng (Để ghi vào Sổ điểm của Giáo viên - Chơi nhưng vẫn có điểm!)
  const top10ByCorrectLeaderboard = useMemo(() => {
    return [...allPlayers].sort((a, b) => {
      if ((b.correct || 0) !== (a.correct || 0)) {
        return (b.correct || 0) - (a.correct || 0);
      }
      return (b.fastScore || 0) - (a.fastScore || 0);
    });
  }, [allPlayers]);

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

  // Dynamic responsive font size for question text based on length (Never cuts text, ensures clear readability for judges and back rows)
  const cleanStemText = cleanQuestionTitleText(currentQItem.q || '');
  const qTitleLength = cleanStemText.length;
  const qTextFontSize =
    qTitleLength > 340
      ? '19px'
      : qTitleLength > 240
      ? '21.5px'
      : qTitleLength > 160
      ? '24.5px'
      : qTitleLength > 95
      ? '28px'
      : '32px';
  const partInfo = getQuestionPartInfo(currentQItem.format);

  return (
    <section id="host-view" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#070b14' }}>

      {/* Floor 1: Thanh Điều Khiển Tinh Gọn 1 Hàng Duy Nhất (46px) */}
      <header id="arena-header" style={{
        height: '46px',
        minHeight: '46px',
        background: 'linear-gradient(90deg, #090d16 0%, #0f172a 50%, #090d16 100%)',
        borderBottom: '1.5px solid rgba(56, 189, 248, 0.35)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
        zIndex: 50,
        flexShrink: 0,
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        overflowX: 'auto'
      }}>
        {/* Cụm Trái: Chọn Trò Chơi + Mã Phòng + Trạng Thái Nhanh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {onSwitchGameType && (
            <select
              aria-label="Chuyển trò chơi nhanh"
              value={matchState.gameType}
              onChange={(e) => onSwitchGameType(e.target.value as GamePlayType)}
              style={{
                background: '#1e293b',
                color: '#fde047',
                border: '1.5px solid #38bdf8',
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '12.5px',
                fontWeight: 900,
                cursor: 'pointer'
              }}
              title="Đổi trò chơi ngay lập tức (Học sinh giữ nguyên kết nối)"
            >
              <option value="TUG">🪢 Kéo Co 3D (Chia Đội)</option>
              <option value="BELL">🔔 Rung Chuông Vàng (3 ❤️)</option>
              <option value="FAST">⚡ Đua Tốc Độ (Cá Nhân)</option>
              <option value="BOSS">🐉 Diệt Boss (Cả Lớp)</option>
            </select>
          )}

          <span style={{ color: '#e2e8f0', fontSize: '12.5px', fontWeight: 800, whiteSpace: 'nowrap' }}>
            Phòng <b style={{ color: '#38bdf8', fontSize: '13.5px' }}>{activeRoomId}</b>
            <span style={{ color: '#64748b', margin: '0 6px' }}>·</span>
            <b style={{ color: '#4ade80' }}>{allPlayers.length} HS</b>
            {matchState.gameType === 'BELL' && (
              <>
                <span style={{ color: '#64748b', margin: '0 6px' }}>·</span>
                <span style={{ color: '#fde047' }}>Còn trụ: {bellAliveCount}/{allPlayers.length}</span>
              </>
            )}
            {matchState.gameType === 'BOSS' && (
              <>
                <span style={{ color: '#64748b', margin: '0 6px' }}>·</span>
                <span style={{ color: '#f87171' }}>🐉 Boss: {matchState.bossHP || 1000}/{matchState.maxBossHP || 1000} HP</span>
              </>
            )}
            {matchState.gameType === 'TUG' && (
              <>
                <span style={{ color: '#64748b', margin: '0 6px' }}>·</span>
                <span style={{ color: '#fca5a5' }}>Đỏ {matchState.redRoundWins}</span>
                <span style={{ color: '#94a3b8', margin: '0 4px' }}>-</span>
                <span style={{ color: '#7dd3fc' }}>{matchState.blueRoundWins} Xanh</span>
              </>
            )}
          </span>
        </div>

        {/* Cụm Phải: Các nút điều khiển tinh gọn */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {matchState.status === 'LOBBY' ? (
            <button
              className="b3d-btn"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: '1px solid #6ee7b7', padding: '5px 12px', fontSize: '12px' }}
              onClick={handleStartContest}
            >
              ▶ BẮT ĐẦU THI ({allPlayers.length} HS)
            </button>
          ) : (
            <>
              <button
                className="b3d-btn"
                style={{ background: '#1e293b', border: '1px solid #475569', padding: '5px 10px', fontSize: '11.5px' }}
                onClick={handlePrepareArenaGather}
                title="Đưa về sảnh chuẩn bị để tập hợp học sinh"
              >
                📣 Sảnh Chờ
              </button>
              <button
                className="b3d-btn"
                style={{ background: matchState.status === 'PLAYING' ? '#d97706' : '#059669', padding: '5px 10px', fontSize: '11.5px' }}
                onClick={handlePauseMatch}
              >
                {matchState.status === 'PLAYING' ? '⏸ Dừng' : '▶ Tiếp'}
              </button>
            </>
          )}

          <button
            className="b3d-btn"
            style={{ background: '#0284c7', padding: '5px 10px', fontSize: '11.5px' }}
            onClick={handleForceAdvanceQ}
            title="Chuyển sang câu hỏi tiếp theo"
          >
            ⏭ Qua Câu
          </button>

          {matchState.gameType === 'BELL' && (
            <button
              className="b3d-btn"
              style={{ background: '#059669', border: '1px solid #6ee7b7', padding: '5px 10px', fontSize: '11.5px' }}
              onClick={() => setShowRescueModal(true)}
              title="Cứu trợ học sinh bị loại trong Rung Chuông Vàng"
            >
              🛟 Cứu Trợ {bellOutCount > 0 ? `(${bellOutCount})` : ''}
            </button>
          )}

          <button
            className="b3d-btn"
            style={{ background: qrVisible ? '#0369a1' : '#334155', padding: '5px 10px', fontSize: '11.5px' }}
            onClick={() => setQrVisible(!qrVisible)}
          >
            {qrVisible ? '🙈 Ẩn QR' : '📱 Mã QR'}
          </button>

          <button
            className="b3d-btn"
            style={{
              background: demoBotsActive ? 'linear-gradient(135deg, #10b981, #047857)' : '#1e293b',
              border: demoBotsActive ? '1.5px solid #fef08a' : '1px solid #38bdf8',
              color: demoBotsActive ? '#fef08a' : '#7dd3fc',
              padding: '5px 10px',
              fontSize: '11.5px'
            }}
            onClick={handleToggleDemoBots}
            title="Bật/Tắt chế độ Giả lập Lớp học 3D thông minh để thuyết trình trước Ban Giám Khảo"
          >
            {demoBotsActive ? '🤖 Đang Demo GK' : '🤖 Demo GK'}
          </button>

          {onOpenNationalDossier && (
            <button
              className="b3d-btn"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0f172a', border: '1px solid #fef08a', padding: '5px 10px', fontSize: '11.5px', fontWeight: 900 }}
              onClick={onOpenNationalDossier}
              title="Mở Hướng Dẫn Sử Dụng Chi Tiết Dành Cho Giáo Viên & Học Sinh"
            >
              📖 Hướng Dẫn Sử Dụng
            </button>
          )}

          <button
            className="b3d-btn"
            style={{ background: '#b45309', border: '1px solid #fde047', padding: '5px 10px', fontSize: '11.5px' }}
            onClick={() => setShowTop10Modal(true)}
            title="Xem 2 Bảng Xếp Hạng: Tổng Điểm Thi Đấu (-1000đ/sai) & Số Câu Đúng Ghi Sổ Điểm Giáo Viên"
          >
            🏆 2 BXH & Sổ Điểm
          </button>

          <button
            className="b3d-btn"
            style={{ background: '#dc2626', padding: '5px 10px', fontSize: '11.5px' }}
            onClick={handleEndMatch}
            title="Kết thúc trận đấu và mở màn hình Vinh Danh"
          >
            ⏹ Kết Thúc
          </button>

          <button
            className="b3d-btn"
            style={{ background: '#334155', padding: '5px 9px', fontSize: '11.5px' }}
            onClick={onToggleFullScreen}
            title="Toàn màn hình"
          >
            🔲
          </button>

          <button
            className="b3d-btn"
            style={{ background: '#334155', padding: '5px 10px', fontSize: '11.5px' }}
            onClick={onReturnToSetup}
            title="Quay về màn hình cài đặt của giáo viên"
          >
            🏠 Cài Đặt
          </button>
        </div>
      </header>

      {/* Floor 2: Sàn Đấu 3D Trực Quan (Chiếm 42% chiều cao, dành tối đa không gian cho Câu Hỏi & Sàn Đấu) */}
      <div id="arena-3d-viewport" ref={viewportRef} style={{ flex: '1 1 42%', minHeight: '200px', position: 'relative', overflow: 'hidden' }}>
        <canvas id="canvas3d" ref={canvasRef} />

        {/* 3D Label tags container */}
        <div id="labels-container">
          {allPlayers.map(p => {
            const coord = labelCoords[p.id];
            if (!coord) return null;
            const hasDoneQ = matchState.redAnsweredIds.includes(p.id) || matchState.blueAnsweredIds.includes(p.id);

            let labelText = '';
            if (matchState.gameType === 'BELL') {
              if (p.eliminated) labelText = `📣 ${p.label} (Khán giả)`;
              else {
                const hearts = '❤️'.repeat(Math.max(0, p.lives));
                labelText = `${hasDoneQ ? '✓ ' : ''}${p.label} ${hearts}`;
              }
            } else if (matchState.gameType === 'TUG') {
              labelText = `${hasDoneQ ? '✓ ' : ''}${p.label} (${p.correct || 0})`;
            } else {
              labelText = `${hasDoneQ ? '✓ ' : ''}${p.label} (${p.fastScore || 0}đ)`;
            }

            return (
              <div
                key={p.id}
                className={`tag-3d ${p.ready ? 'ready' : ''} ${hasDoneQ ? 'done-q' : ''} ${p.eliminated ? 'eliminated' : ''}`}
                style={{
                  left: `${coord.x}px`,
                  top: `${coord.y}px`,
                  borderColor: matchState.gameType === 'TUG'
                    ? (p.team === 'RED' ? 'var(--red)' : 'var(--blue)')
                    : '#38bdf8'
                }}
              >
                {labelText}
              </div>
            );
          })}
        </div>

        {/* Floating QR Badges: Chỉ hiện 2 mã Đỏ/Xanh khi chơi Kéo Co (TUG), các trò khác chỉ hiện 1 mã QR phòng chung */}
        {qrVisible && (
          <>
            {qrMinimizedLeft ? (
              <button
                className="qr-minimized-pill left"
                onClick={() => setQrMinimizedLeft(false)}
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  background: 'rgba(15, 23, 42, 0.92)',
                  border: '1.5px solid #38bdf8',
                  color: '#fef08a',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  zIndex: 30
                }}
              >
                📱 QR {matchState.gameType === 'TUG' ? 'ĐỘI ĐỎ' : `P.${activeRoomId}`} ➕
              </button>
            ) : (
              <div
                className="qr-panel left"
                id="qr-panel-left"
                style={{ position: 'absolute', top: '8px', left: '10px', zIndex: 25 }}
                title="Bấm để phóng to QR"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 900, color: '#64748b' }}>P.{activeRoomId}</span>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setQrMinimizedLeft(true); }}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '11px', cursor: 'pointer', padding: '0 2px' }}
                    >
                      ➖
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setQrVisible(false); }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer', padding: '0 2px', fontWeight: 900 }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div
                  className="qr-box-inner"
                  onClick={() => { setZoomedTeam('RED'); setZoomModalOpen(true); }}
                >
                  {qrRedImg && <img src={qrRedImg} alt="QR Vào Phòng" width={76} height={76} />}
                </div>
                <div
                  className="qr-caption"
                  style={{ color: matchState.gameType === 'TUG' ? 'var(--red)' : '#0284c7', fontSize: '10px', marginTop: '2px' }}
                  onClick={() => { setZoomedTeam('RED'); setZoomModalOpen(true); }}
                >
                  {matchState.gameType === 'TUG' ? 'ĐỘI ĐỎ 🔴' : 'QUÉT VÀO SÀN'}
                </div>
              </div>
            )}

            {/* Chỉ trò Kéo Co (TUG) mới chia đội nên mới có QR Đội Xanh bên phải */}
            {matchState.gameType === 'TUG' && (
              qrMinimizedRight ? (
                <button
                  className="qr-minimized-pill right"
                  onClick={() => setQrMinimizedRight(false)}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(15, 23, 42, 0.92)',
                    border: '1.5px solid #0284c7',
                    color: '#fef08a',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 900,
                    cursor: 'pointer',
                    zIndex: 30
                  }}
                >
                  📱 QR ĐỘI XANH ➕
                </button>
              ) : (
                <div
                  className="qr-panel right"
                  id="qr-panel-right"
                  style={{ position: 'absolute', top: '8px', right: '10px', zIndex: 25 }}
                  title="Bấm để phóng to QR"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#64748b' }}>P.{activeRoomId}</span>
                    <div style={{ display: 'flex', gap: '3px' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setQrMinimizedRight(true); }}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '11px', cursor: 'pointer', padding: '0 2px' }}
                      >
                        ➖
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setQrVisible(false); }}
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer', padding: '0 2px', fontWeight: 900 }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div
                    className="qr-box-inner"
                    onClick={() => { setZoomedTeam('BLUE'); setZoomModalOpen(true); }}
                  >
                    {qrBlueImg && <img src={qrBlueImg} alt="QR Xanh" width={76} height={76} />}
                  </div>
                  <div
                    className="qr-caption"
                    style={{ color: 'var(--blue)', fontSize: '10px', marginTop: '2px' }}
                    onClick={() => { setZoomedTeam('BLUE'); setZoomModalOpen(true); }}
                  >
                    ĐỘI XANH 🔵
                  </div>
                </div>
              )
            )}
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
              padding: '14px 24px',
              borderRadius: '16px',
              border: '2px solid #fef08a',
              boxShadow: '0 15px 35px rgba(0,0,0,0.6)',
              fontSize: '18px',
              fontWeight: 900,
              zIndex: 300,
              textAlign: 'center'
            }}
          >
            {rescueBannerMsg}
          </div>
        )}

        {/* Chỉ hiển thị 2 bảng ĐỘI ĐỎ / ĐỘI XANH khi chơi Kéo Co (TUG) */}
        {matchState.gameType === 'TUG' && (
          <>
            <div style={{
              position: 'absolute',
              top: '10px',
              left: qrVisible && !qrMinimizedLeft ? '106px' : '12px',
              zIndex: 22,
              background: 'rgba(185, 28, 28, 0.92)',
              border: '1.5px solid #fca5a5',
              borderRadius: '12px',
              padding: '5px 12px',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '12px'
            }}>
              🔴 ĐỘI ĐỎ: {matchState.redPlayers.length} HS • {matchState.redTotalCorrect || 0} đúng
            </div>

            <div style={{
              position: 'absolute',
              top: '10px',
              right: qrVisible && !qrMinimizedRight ? '106px' : (showLiveTop10 && allPlayers.length > 0 ? '290px' : '12px'),
              zIndex: 22,
              background: 'rgba(3, 105, 161, 0.92)',
              border: '1.5px solid #7dd3fc',
              borderRadius: '12px',
              padding: '5px 12px',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '12px'
            }}>
              🔵 ĐỘI XANH: {matchState.bluePlayers.length} HS • {matchState.blueTotalCorrect || 0} đúng
            </div>
          </>
        )}

        {/* Live Top 10 Leaderboard (Có 2 chế độ: Xếp hạng theo Tổng Điểm & Xếp hạng theo Số Câu Đúng ghi sổ điểm GV) */}
        {allPlayers.length > 0 && showLiveTop10 && (
          <aside className="fast-live-leaderboard" id="fast-live-leaderboard" style={{ display: 'flex', width: '285px' }} aria-label="Bảng ghi nhận Top 10 trực tiếp">
            <div className="flb-title" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{liveRankMode === 'SCORE' ? '🏆 BXH THEO TỔNG ĐIỂM' : '📒 BXH SỐ CÂU ĐÚNG (SỔ ĐIỂM)'}</span>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setLiveRankMode('SCORE')}
                  style={{
                    padding: '3px 6px',
                    borderRadius: '6px',
                    fontSize: '10.5px',
                    fontWeight: 900,
                    cursor: 'pointer',
                    background: liveRankMode === 'SCORE' ? '#f59e0b' : '#1e293b',
                    color: liveRankMode === 'SCORE' ? '#0f172a' : '#cbd5e1',
                    border: liveRankMode === 'SCORE' ? '1px solid #fef08a' : '1px solid #334155'
                  }}
                >
                  🏆 Theo Điểm Số
                </button>
                <button
                  type="button"
                  onClick={() => setLiveRankMode('CORRECT')}
                  style={{
                    padding: '3px 6px',
                    borderRadius: '6px',
                    fontSize: '10.5px',
                    fontWeight: 900,
                    cursor: 'pointer',
                    background: liveRankMode === 'CORRECT' ? '#10b981' : '#1e293b',
                    color: liveRankMode === 'CORRECT' ? '#ffffff' : '#cbd5e1',
                    border: liveRankMode === 'CORRECT' ? '1px solid #6ee7b7' : '1px solid #334155'
                  }}
                >
                  📒 Số Câu Đúng (GV)
                </button>
              </div>
            </div>
            <div className="flb-list">
              {(liveRankMode === 'SCORE' ? top10Leaderboard : top10ByCorrectLeaderboard).slice(0, 10).map((p, idx) => {
                const rank = idx + 1;
                const medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : `#${rank}`));
                const gbScore = getTeacherGradebookScore(p.correct || 0, quizList.length || 12, rank);
                const scoreDisplay = liveRankMode === 'CORRECT'
                  ? `✅ ${p.correct || 0} đúng • ${gbScore.grade}đ`
                  : matchState.gameType === 'BELL'
                  ? `${p.correct || 0} đúng • ${p.eliminated ? 'Khán giả' : `${p.lives || 0}❤️`}`
                  : `${p.fastScore || 0}đ (${p.correct || 0} đúng)`;
                return (
                  <div key={p.id} className={`flb-row rank-${rank}`}>
                    <div className="flb-rank">{medal}</div>
                    <div className="flb-name" title={p.label}>
                      {matchState.gameType === 'TUG' && (
                        <span style={{ fontSize: '10px', marginRight: '4px' }}>{p.team === 'RED' ? '🔴' : '🔵'}</span>
                      )}
                      {p.label}
                    </div>
                    <div className="flb-pts" style={{ color: liveRankMode === 'CORRECT' ? '#4ade80' : undefined }}>
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
              bottom: '10px',
              right: '10px',
              background: '#b45309',
              color: '#ffffff',
              border: '1.5px solid #fde047',
              borderRadius: '12px',
              padding: '5px 12px',
              fontSize: '11.5px',
              fontWeight: 900,
              cursor: 'pointer',
              zIndex: 30
            }}
          >
            🏆 Top 10 ➕
          </button>
        )}

        {/* Banner Sảnh Chuẩn Bị Tập Hợp Học Sinh (LOBBY) — Hiển thị ngay lập tức tên từng học sinh khi vào phòng */}
        {matchState.status === 'LOBBY' && (
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '2px solid #10b981',
              borderRadius: '16px',
              padding: '10px 18px',
              zIndex: 40,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxWidth: '86%',
              boxShadow: '0 8px 24px rgba(0,0,0,0.65)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13.5px', fontWeight: 900, color: '#e2e8f0' }}>
                📣 Sảnh tập hợp học sinh • Phòng <b style={{ color: '#fde047' }}>{activeRoomId}</b> (<b style={{ color: '#4ade80' }}>{allPlayers.length} HS</b> đã vào sân)
              </div>
              <button
                onClick={handleStartContest}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  border: '1.5px solid #a7f3d0',
                  borderRadius: '10px',
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                🚀 BẮT ĐẦU THI NGAY
              </button>
            </div>

            {allPlayers.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '62px', overflowY: 'auto' }}>
                {allPlayers.map(p => (
                  <span
                    key={p.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 9px',
                      borderRadius: '999px',
                      fontSize: '11.5px',
                      fontWeight: 900,
                      background: matchState.gameType === 'TUG'
                        ? (p.team === 'RED' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.3)')
                        : 'rgba(16, 185, 129, 0.25)',
                      border: `1.5px solid ${matchState.gameType === 'TUG' ? (p.team === 'RED' ? '#f87171' : '#38bdf8') : '#34d399'}`,
                      color: '#ffffff'
                    }}
                  >
                    <span>{p.ready ? '✅' : '🟢'}</span>
                    <span>{p.label}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Round Break Modal (Tug Mode) */}
        {matchState.status === 'ROUND_BREAK' && (
          <div id="round-modal" style={{ display: 'block' }}>
            <h2 id="round-modal-title" style={{ fontSize: '26px', color: 'var(--gold)', margin: 0 }}>
              🎉 KẾT THÚC HIỆP {matchState.currentRound}!
            </h2>
            <p id="round-modal-sub" style={{ fontSize: '16px', color: '#f8fafc', margin: '8px 0 14px 0' }}>
              Tỉ số Hiệp: <b>Đỏ ({matchState.redRoundWins}) - Xanh ({matchState.blueRoundWins})</b>
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

        {/* Nút quay lại màn hình Vinh Danh khi đang ở chế độ Xem Lại Câu Hỏi */}
        {matchState.status === 'ENDED' && isReviewMode && (
          <div style={{ position: 'absolute', bottom: '12px', right: '16px', zIndex: 90 }}>
            <button
              type="button"
              onClick={() => setIsReviewMode(false)}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#0f172a',
                border: '2px solid #fde047',
                borderRadius: '12px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 8px 25px rgba(245, 158, 11, 0.5)'
              }}
            >
              🏆 Quay Lại Màn Hình Vinh Danh
            </button>
          </div>
        )}
      </div>

      {/* Màn hình Kết Thúc Trống Vinh Danh Top 10 & Quán Quân (Rung Chuông Vàng, Diệt Boss, Đội Kéo Co) */}
      {matchState.status === 'ENDED' && !isReviewMode && (
        <GrandFinaleScreen
          matchState={matchState}
          activeRoomId={activeRoomId}
          totalQuestions={quizList.length || 12}
          onReviewMatch={() => {
            setIsReviewMode(true);
            setReviewQIdx(0);
          }}
          onDownloadCSV={handleDownloadCSV}
          onExportHTMLSlide={onExportHTMLSlide}
          onPrintPDFEvidence={onPrintPDFEvidence}
          onRestartMatch={handleRestartMatch}
          onReturnToSetup={onReturnToSetup}
        />
      )}

      {/* Floor 3: Khung Câu Hỏi & Đáp Án Chuẩn THPT 2018 — Chiếm 56% Màn Hình, Đẹp Mắt, Tinh Gọn, Rõ Nét */}
      <section
        id="host-question-board"
        className={isReviewMode ? 'review-active' : ''}
        style={{
          flex: '0 0 56vh',
          height: '56vh',
          minHeight: '56vh',
          maxHeight: '56vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
          padding: '10px 20px 10px 20px',
          background: 'linear-gradient(180deg, #0b1120 0%, #070b14 100%)',
          borderTop: '2px solid #38bdf8',
          boxSizing: 'border-box'
        }}
        aria-label="Khung câu hỏi và đáp án chuẩn THPT 2018"
      >
        {/* Khung Câu Hỏi Nổi Bật (Tích hợp số câu + dạng thức THPT 2018 + đồng hồ đếm ngược gọn đẹp) */}
        <div
          style={{
            background: 'linear-gradient(180deg, #111c35 0%, #0f172a 100%)',
            border: '1.5px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '16px',
            padding: '10px 18px',
            marginBottom: '10px',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.45)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            flexShrink: 0,
            maxHeight: currentQItem.format === 'TRUE_FALSE' ? '23vh' : '22vh',
            overflowY: 'auto'
          }}
        >
          {/* Hàng thông tin câu hỏi tinh gọn (Unboxed metadata theo chuẩn thiết kế) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 800, color: '#94a3b8' }}>
              <span style={{ color: '#fde047', fontWeight: 900, fontSize: '14px' }}>
                CÂU {currentQIndex + 1}/{quizList.length || 1}
              </span>
              <span aria-hidden="true">·</span>
              <span style={{ color: '#38bdf8' }}>
                {currentQItem.format === 'TRUE_FALSE'
                  ? 'Dạng thức II: Trắc nghiệm Đúng / Sai (4 ý a, b, c, d)'
                  : currentQItem.format === 'SHORT_ANSWER'
                  ? 'Dạng thức III: Trắc nghiệm Trả lời ngắn'
                  : 'Dạng thức I: Trắc nghiệm 4 phương án lựa chọn'}
              </span>
              <span aria-hidden="true">·</span>
              <span style={{ color: '#cbd5e1' }}>
                Đã trả lời: <b style={{ color: '#4ade80' }}>{matchState.redAnsweredIds.length + matchState.blueAnsweredIds.length}</b>/{matchState.gameType === 'BELL' ? bellAliveCount : allPlayers.length} HS
              </span>
            </div>

            {/* Điều hướng câu hỏi & Đồng hồ đếm ngược */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '13.5px',
                fontWeight: 900,
                color: remainingSec > 10 ? '#34d399' : remainingSec > 5 ? '#fbbf24' : '#f87171',
                marginRight: '4px'
              }}>
                ⏱️ {remainingSec.toFixed(1)}s
              </span>
              <button className="hq-nav-btn" style={{ padding: '3px 9px', fontSize: '12px' }} onClick={() => handleStepQ(-1)}>
                ◀ Trước
              </button>
              <button className="hq-nav-btn" style={{ padding: '3px 9px', fontSize: '12px' }} onClick={() => handleStepQ(1)}>
                Tiếp ▶
              </button>
              <button
                className="hq-nav-btn"
                style={{
                  padding: '3px 10px',
                  fontSize: '12px',
                  background: isSpeakingTTS ? '#dc2626' : '#0284c7',
                  borderColor: '#7dd3fc',
                  color: '#fff',
                  fontWeight: 800
                }}
                onClick={handleReadQuestionAloud}
                title="Đọc to câu hỏi và phương án bằng giọng MC Tiếng Việt"
              >
                {isSpeakingTTS ? '🔇 Dừng Đọc' : '🔊 Đọc Đề'}
              </button>
              <button
                className="hq-nav-btn"
                id="hq-reveal-btn"
                style={{ padding: '3px 10px', fontSize: '12px', background: isReviewMode ? '#d97706' : '#059669', borderColor: '#6ee7b7', color: '#fff' }}
                onClick={handleToggleReviewMode}
              >
                {isReviewMode ? '🙈 Ẩn Đáp Án' : '👁️ Đáp Án'}
              </button>
              <button
                className="hq-nav-btn"
                style={{ padding: '3px 10px', fontSize: '12px', background: '#4f46e5', borderColor: '#a5b4fc', color: '#fff', fontWeight: 800 }}
                onClick={handleRequestAIExplanation}
              >
                💡 Giải Thích
              </button>
            </div>
          </div>

          {/* Nội dung câu hỏi chữ lớn rõ nét */}
          <div
            id="hq-q-text"
            style={{
              fontSize: qTextFontSize,
              lineHeight: 1.32,
              fontWeight: 900,
              color: '#ffffff',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              whiteSpace: 'normal'
            }}
          >
            <MathRenderer text={cleanStemText} />
          </div>
        </div>

        {/* Khung Đáp Án 3 Dạng Thức Chuẩn Chương Trình THPT 2018 */}
        <div
          id="hq-q-opts"
          className="hq-opts"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            maxHeight: 'none',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: currentQItem.format === 'SHORT_ANSWER' ? '1fr' : 'repeat(2, 1fr)',
            gridTemplateRows: currentQItem.format === 'SHORT_ANSWER' ? '1fr' : 'repeat(2, minmax(0, 1fr))',
            gap: '10px',
            marginBottom: '4px'
          }}
        >
          {currentQItem.format === 'TRUE_FALSE' ? (
            // Dạng thức 2 (Phần II THPT 2018): Trắc nghiệm Đúng/Sai gồm 4 mệnh đề a), b), c), d)
            (currentQItem.tfItems || []).map((tf, idx) => {
              const reveal = isReviewMode;
              const cleanStatement = cleanTFStatementText(tf.text || '');
              const tfFontSize = cleanStatement.length > 160 ? '16.5px' : cleanStatement.length > 110 ? '18px' : '20px';
              const badgeColors = ['#0284c7', '#d97706', '#059669', '#7c3aed'];
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 16px',
                    borderRadius: '14px',
                    background: reveal
                      ? (tf.isCorrect ? 'linear-gradient(135deg, #065f46, #047857)' : 'linear-gradient(135deg, #7f1d1d, #991b1b)')
                      : 'linear-gradient(135deg, #1e293b, #0f172a)',
                    border: reveal
                      ? (tf.isCorrect ? '2px solid #4ade80' : '2px solid #f87171')
                      : '1.5px solid #475569',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    whiteSpace: 'normal',
                    fontSize: tfFontSize,
                    fontWeight: 800,
                    lineHeight: 1.3,
                    color: '#f8fafc',
                    overflowY: 'auto',
                    minHeight: 0
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0 }}>
                    <span style={{
                      minWidth: '34px',
                      height: '34px',
                      borderRadius: '9px',
                      background: badgeColors[idx % 4],
                      border: '1.5px solid rgba(255,255,255,0.45)',
                      color: '#fef08a',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: '19px',
                      flexShrink: 0,
                      marginTop: '1px'
                    }}>
                      {String.fromCharCode(97 + idx)})
                    </span>
                    <span style={{ flex: 1, paddingTop: '2px', minWidth: 0 }}>
                      <MathRenderer text={cleanStatement} />
                    </span>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {reveal ? (
                      <span style={{
                        fontWeight: 900,
                        color: tf.isCorrect ? '#4ade80' : '#fca5a5',
                        fontSize: '16px',
                        padding: '5px 11px',
                        borderRadius: '8px',
                        background: 'rgba(0,0,0,0.4)',
                        border: tf.isCorrect ? '1px solid #4ade80' : '1px solid #f87171'
                      }}>
                        {tf.isCorrect ? '✓ ĐÚNG' : '✗ SAI'}
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '12.5px',
                        fontWeight: 900,
                        color: '#bae6fd',
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid #334155',
                        padding: '4px 9px',
                        borderRadius: '8px',
                        whiteSpace: 'nowrap'
                      }}>
                        Đúng / Sai
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : currentQItem.format === 'SHORT_ANSWER' ? (
            // Dạng thức 3 (Phần III THPT 2018): Trắc nghiệm Trả lời ngắn
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '20px 28px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #172554, #1e1b4b)',
                border: isReviewMode ? '2.5px solid #4ade80' : '2px solid #38bdf8',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                color: '#ffffff',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
              }}
            >
              {isReviewMode ? (
                <div>
                  <div style={{ color: '#94a3b8', fontWeight: 800, fontSize: '15px', marginBottom: '6px' }}>
                    ĐÁP ÁN CHUẨN (DẠNG THỨC III - TRẢ LỜI NGẮN):
                  </div>
                  <div style={{ color: '#4ade80', fontWeight: 900, fontSize: '36px', letterSpacing: '1px' }}>
                    <MathRenderer text={currentQItem.shortAnswer || currentQItem.opts[0] || ''} />
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#fde047', marginBottom: '6px' }}>
                    ✍️ CÂU HỎI TRẢ LỜI NGẮN (CHƯƠNG TRÌNH THPT 2018)
                  </div>
                  <div style={{ fontSize: '17px', color: '#cbd5e1', fontWeight: 700 }}>
                    Học sinh nhập kết quả số hoặc từ khóa trực tiếp trên màn hình điện thoại và bấm Gửi 1 lần duy nhất.
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Dạng thức 1 (Phần I THPT 2018): Trắc nghiệm 4 phương án A, B, C, D bố trí lưới 2x2 đẹp mắt
            currentQItem.opts.map((opt, idx) => {
              const isCorrect = idx === currentQItem.correct;
              const letter = String.fromCharCode(65 + idx);
              const revealClass = isReviewMode && isCorrect ? 'correct-reveal' : '';
              return (
                <div
                  key={idx}
                  className={`hq-opt-item opt-color-${idx % 4} ${revealClass}`}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '14px',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    whiteSpace: 'normal',
                    fontSize: opt.length > 75 ? '21px' : '25px',
                    fontWeight: 900,
                    lineHeight: 1.32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <span style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.45)',
                      border: '1.5px solid rgba(254, 240, 138, 0.65)',
                      color: '#fef08a',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                      fontWeight: 900,
                      flexShrink: 0
                    }}>
                      {letter}
                    </span>
                    <span style={{ flex: 1 }}><MathRenderer text={opt} /></span>
                  </span>
                  {isReviewMode && isCorrect && (
                    <span style={{ color: '#4ade80', fontWeight: 900, fontSize: '16px', flexShrink: 0, background: 'rgba(0,0,0,0.45)', padding: '4px 10px', borderRadius: '8px' }}>
                      ✓ ĐÚNG
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Thanh tiến trình thời gian gọn đẹp sát đáy màn hình */}
        <div
          id="fast-timer-bar-wrap"
          style={{
            height: '8px',
            background: '#1e293b',
            borderRadius: '4px',
            overflow: 'hidden',
            position: 'relative',
            flexShrink: 0
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
        totalQuestions={quizList.length || 12}
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
