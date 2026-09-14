let rawImage = null;
const cameraInput = document.getElementById('camera-input');
const thresholdCanvas = document.getElementById('threshold-canvas');
const ctx = thresholdCanvas.getContext('2d');
const thresholdSlider = document.getElementById('threshold-slider');
const splitSlider = document.getElementById('split-slider');

const captureStep = document.getElementById('capture-step');
const adjustStep = document.getElementById('adjust-step');
const previewStep = document.getElementById('preview-step');
const generateBtn = document.getElementById('generate-3d-btn');
const landBtn = document.getElementById('land-btn');
const cameraFeed = document.getElementById('camera-feed');

let scene, camera, renderer, leftWing, rightWing, butterflyGroup;
let alvaEngine = null;
let animFrameId = null;
let isLanded = false;

// Step 1: Capture Photo
cameraInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    rawImage = new Image();
    rawImage.onload = () => {
      thresholdCanvas.width = rawImage.width;
      thresholdCanvas.height = rawImage.height;
      processAlphaMap();
      captureStep.classList.remove('active');
      adjustStep.classList.add('active');
    };
    rawImage.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

// Step 2: Threshold Alpha Processing
function processAlphaMap() {
  if (!rawImage) return;
  
  ctx.drawImage(rawImage, 0, 0);
  const imgData = ctx.getImageData(0, 0, thresholdCanvas.width, thresholdCanvas.height);
  const data = imgData.data;
  const threshold = parseInt(thresholdSlider.value, 10);

  for (let i = 0; i < data.length; i += 4) {
    const luma = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    if (luma > threshold) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const splitX = (thresholdCanvas.width * splitSlider.value) / 100;
  ctx.strokeStyle = '#ff0055';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(splitX, 0);
  ctx.lineTo(splitX, thresholdCanvas.height);
  ctx.stroke();
}

thresholdSlider.addEventListener('input', processAlphaMap);
splitSlider.addEventListener('input', processAlphaMap);

// Step 3: Initialize WebAssembly SLAM Engine & 3D Environment
generateBtn.addEventListener('click', async () => {
  adjustStep.classList.remove('active');
  previewStep.classList.add('active');
  await initSLAMAndCamera();
  init3DScene();
});

async function initSLAMAndCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    cameraFeed.srcObject = stream;
    await new Promise((resolve) => { cameraFeed.onloadedmetadata = resolve; });

    // Initialize AlvaAR WebAssembly SLAM
    if (window.AlvaAR) {
      alvaEngine = await window.AlvaAR.create(cameraFeed.videoWidth, cameraFeed.videoHeight);
    }
  } catch (err) {
    console.warn("Camera or SLAM initialization error:", err);
  }
}

function init3DScene() {
  const container = document.getElementById('webgl-container');
  container.innerHTML = '';

  const width = window.innerWidth;
  const height = window.innerHeight;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 1000);
  camera.position.set(0, 0, 2);

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  // Clean Wing Canvas Crop (Without red center indicator)
  const cleanCanvas = document.createElement('canvas');
  cleanCanvas.width = thresholdCanvas.width;
  cleanCanvas.height = thresholdCanvas.height;
  const cleanCtx = cleanCanvas.getContext('2d');
  cleanCtx.drawImage(rawImage, 0, 0);
  const imgData = cleanCtx.getImageData(0, 0, cleanCanvas.width, cleanCanvas.height);
  const data = imgData.data;
  const threshold = parseInt(thresholdSlider.value, 10);
  for (let i = 0; i < data.length; i += 4) {
    const luma = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    if (luma > threshold) data[i + 3] = 0;
  }
  cleanCtx.putImageData(imgData, 0, 0);

  const splitRatio = splitSlider.value / 100;
  const splitX = cleanCanvas.width * splitRatio;

  const leftCanvas = document.createElement('canvas');
  leftCanvas.width = splitX;
  leftCanvas.height = cleanCanvas.height;
  leftCanvas.getContext('2d').drawImage(cleanCanvas, 0, 0, splitX, cleanCanvas.height, 0, 0, splitX, cleanCanvas.height);

  const rightCanvas = document.createElement('canvas');
  rightCanvas.width = cleanCanvas.width - splitX;
  rightCanvas.height = cleanCanvas.height;
  rightCanvas.getContext('2d').drawImage(cleanCanvas, splitX, 0, rightCanvas.width, cleanCanvas.height, 0, 0, rightCanvas.width, cleanCanvas.height);

  const matConfig = { transparent: true, side: THREE.DoubleSide, depthWrite: false };
  const leftMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(leftCanvas), ...matConfig });
  const rightMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(rightCanvas), ...matConfig });

  const wingWidth = 0.5;
  const wingHeight = 0.8;

  const leftGeo = new THREE.PlaneGeometry(wingWidth, wingHeight);
  leftGeo.translate(-wingWidth / 2, 0, 0);
  leftWing = new THREE.Mesh(leftGeo, leftMat);

  const rightGeo = new THREE.PlaneGeometry(wingWidth, wingHeight);
  rightGeo.translate(wingWidth / 2, 0, 0);
  rightWing = new THREE.Mesh(rightGeo, rightMat);

  butterflyGroup = new THREE.Group();
  butterflyGroup.add(leftWing);
  butterflyGroup.add(rightWing);
  butterflyGroup.position.set(0, 0, -1.5); // Initial position 1.5m in front of camera
  scene.add(butterflyGroup);

  const clock = new THREE.Clock();

  // SLAM & Render Loop
  function renderLoop() {
    animFrameId = requestAnimationFrame(renderLoop);
    const elapsedTime = clock.getElapsedTime();

    // 1. Run SLAM Camera Tracking
    if (alvaEngine) {
      const pokeCtx = document.createElement('canvas').getContext('2d');
      const pose = alvaEngine.findCameraPose(cameraFeed);
      if (pose) {
        camera.matrix.fromArray(pose);
        camera.matrixAutoUpdate = false;
      }
    }

    // 2. Animation State Machine (Flying vs Perched)
    if (!isLanded) {
      // Rapid Wing Flapping
      const flapAngle = Math.sin(elapsedTime * 8) * 0.7;
      leftWing.rotation.y = flapAngle;
      rightWing.rotation.y = -flapAngle;

      // 3D Flying Path Trajectory
      butterflyGroup.position.y = Math.sin(elapsedTime * 1.5) * 0.2 - 0.2;
      butterflyGroup.position.x = Math.cos(elapsedTime * 1.0) * 0.4;
      butterflyGroup.position.z = -1.5 + Math.sin(elapsedTime * 0.8) * 0.3;
    } else {
      // Slow Idle Wing Flapping when landed
      const idleFlap = Math.sin(elapsedTime * 2) * 0.2;
      leftWing.rotation.y = idleFlap;
      rightWing.rotation.y = -idleFlap;
    }

    renderer.render(scene, camera);
  }

  renderLoop();
}

// Toggle Landing Mode on Nearest Estimated Plane
landBtn.addEventListener('click', () => {
  isLanded = !isLanded;
  if (isLanded) {
    landBtn.innerText = "Take Off 🦋";
    // Snap butterfly down to an estimated horizontal surface plane
    butterflyGroup.position.set(0, -0.6, -1.2);
    butterflyGroup.rotation.x = -Math.PI / 4;
  } else {
    landBtn.innerText = "Land Butterfly 🌸";
    butterflyGroup.rotation.x = 0;
  }
});

document.getElementById('re-adjust-btn').addEventListener('click', () => {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (cameraFeed.srcObject) {
    cameraFeed.srcObject.getTracks().forEach(track => track.stop());
  }
  isLanded = false;
  landBtn.innerText = "Land Butterfly 🌸";
  previewStep.classList.remove('active');
  adjustStep.classList.add('active');
});
