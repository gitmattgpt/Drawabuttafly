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

let videoElement = null;

// Step 1: Load Image
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

// Step 2: Apply Threshold (Luminance to Alpha)
function processAlphaMap() {
  if (!rawImage) return;
  
  ctx.drawImage(rawImage, 0, 0);
  const imgData = ctx.getImageData(0, 0, thresholdCanvas.width, thresholdCanvas.height);
  const data = imgData.data;
  const threshold = parseInt(thresholdSlider.value, 10);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Luminance formula
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Transparent if brighter than threshold
    if (luma > threshold) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Draw Centerline Indicator
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

// Step 3: 3D AR Scene Setup (Three.js)
let scene, camera, renderer, leftWing, rightWing, butterflyGroup;

generateBtn.addEventListener('click', () => {
  adjustStep.classList.remove('active');
  previewStep.classList.add('active');
  startARCamera();
  init3DButterfly();
});

// Initialize Camera Feed Background
async function startARCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    if (!videoElement) {
      videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.style.position = 'fixed';
      videoElement.style.top = '0';
      videoElement.style.left = '0';
      videoElement.style.width = '100vw';
      videoElement.style.height = '100vh';
      videoElement.style.objectFit = 'cover';
      videoElement.style.zIndex = '-1';
      document.body.appendChild(videoElement);
    }
    videoElement.srcObject = stream;
  } catch (err) {
    console.warn("Camera stream restricted or unhandled:", err);
  }
}

function init3DButterfly() {
  const container = document.getElementById('webgl-container');
  container.innerHTML = '';

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 4);

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  // Re-process image without the red split line overlay
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

  // Crop Left & Right Wing Textures strictly along the split axis
  const splitRatio = splitSlider.value / 100;
  const splitX = cleanCanvas.width * splitRatio;

  // Left Canvas
  const leftCanvas = document.createElement('canvas');
  leftCanvas.width = splitX;
  leftCanvas.height = cleanCanvas.height;
  leftCanvas.getContext('2d').drawImage(cleanCanvas, 0, 0, splitX, cleanCanvas.height, 0, 0, splitX, cleanCanvas.height);

  // Right Canvas
  const rightCanvas = document.createElement('canvas');
  rightCanvas.width = cleanCanvas.width - splitX;
  rightCanvas.height = cleanCanvas.height;
  rightCanvas.getContext('2d').drawImage(cleanCanvas, splitX, 0, rightCanvas.width, cleanCanvas.height, 0, 0, rightCanvas.width, cleanCanvas.height);

  // Create Textures & Materials
  const leftTex = new THREE.CanvasTexture(leftCanvas);
  const rightTex = new THREE.CanvasTexture(rightCanvas);

  const matConfig = { transparent: true, side: THREE.DoubleSide, depthWrite: false };
  const leftMat = new THREE.MeshBasicMaterial({ map: leftTex, ...matConfig });
  const rightMat = new THREE.MeshBasicMaterial({ map: rightTex, ...matConfig });

  // Geometry Wing Dimensions
  const wingWidth = 1.2;
  const wingHeight = 2.0;

  // Left Wing: Pivot anchored on right edge
  const leftGeo = new THREE.PlaneGeometry(wingWidth, wingHeight);
  leftGeo.translate(-wingWidth / 2, 0, 0);
  leftWing = new THREE.Mesh(leftGeo, leftMat);

  // Right Wing: Pivot anchored on left edge
  const rightGeo = new THREE.PlaneGeometry(wingWidth, wingHeight);
  rightGeo.translate(wingWidth / 2, 0, 0);
  rightWing = new THREE.Mesh(rightGeo, rightMat);

  butterflyGroup = new THREE.Group();
  butterflyGroup.add(leftWing);
  butterflyGroup.add(rightWing);
  butterflyGroup.position.set(0, 0, 0);
  scene.add(butterflyGroup);

  let clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();
    
    // Wing Flapping Motion (Hinge along center)
    const flapAngle = Math.sin(elapsedTime * 6) * 0.7;
    leftWing.rotation.y = flapAngle;
    rightWing.rotation.y = -flapAngle;

    // Gentle AR Hovering & Swaying effect
    butterflyGroup.position.y = Math.sin(elapsedTime * 2) * 0.15;
    butterflyGroup.position.x = Math.cos(elapsedTime * 1.2) * 0.1;

    renderer.render(scene, camera);
  }
  
  animate();
}

document.getElementById('re-adjust-btn').addEventListener('click', () => {
  if (videoElement && videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach(track => track.stop());
  }
  previewStep.classList.remove('active');
  adjustStep.classList.add('active');
});
