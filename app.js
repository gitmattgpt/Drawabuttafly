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
const compilerStatus = document.getElementById('compiler-status');

let mindThree = null;
let animationFrameId = null;

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

// Step 2: Luminance Thresholding
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
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    if (luma > threshold) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Axis Split Indicator
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

// Step 3: MindAR Image Target Compiler & 3D Tracking Setup
generateBtn.addEventListener('click', async () => {
  compilerStatus.innerText = "Compiling target image for AR tracking...";
  generateBtn.disabled = true;

  try {
    // Compile photo into target tracker using MindAR Offline Compiler
    const compiler = new window.MINDAR.IMAGE.Compiler();
    const targetBuffer = await compiler.compileImageTargets([rawImage], (progress) => {
      compilerStatus.innerText = `Compiling Target: ${Math.round(progress * 100)}%`;
    });

    const targetBlob = new Blob([targetBuffer], { type: 'application/octet-stream' });
    const mindTargetUrl = URL.createObjectURL(targetBlob);

    compilerStatus.innerText = "";
    generateBtn.disabled = false;
    adjustStep.classList.remove('active');
    previewStep.classList.add('active');

    initMindARScene(mindTargetUrl);
  } catch (err) {
    console.error(err);
    compilerStatus.innerText = "Error compiling AR target image. Try another photo.";
    generateBtn.disabled = false;
  }
});

async function initMindARScene(mindTargetUrl) {
  const container = document.getElementById('ar-container');
  container.innerHTML = '';

  // Initialize MindAR Three.js instance
  mindThree = new window.MINDAR.IMAGE.MindARThree({
    container: container,
    imageTargetSrc: mindTargetUrl,
    uiLoading: "no",
    uiScanning: "yes"
  });

  const { renderer, scene, camera } = mindThree;

  // Clean alpha canvas for wing textures
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

  // Split left and right wing canvases
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

  const leftTex = new THREE.CanvasTexture(leftCanvas);
  const rightTex = new THREE.CanvasTexture(rightCanvas);
  const matConfig = { transparent: true, side: THREE.DoubleSide, depthWrite: false };

  const wingWidth = 0.6;
  const wingHeight = 1.0;

  // Pivot-aligned wing geometries
  const leftGeo = new THREE.PlaneGeometry(wingWidth, wingHeight);
  leftGeo.translate(-wingWidth / 2, 0, 0);
  const leftWing = new THREE.Mesh(leftGeo, new THREE.MeshBasicMaterial({ map: leftTex, ...matConfig }));

  const rightGeo = new THREE.PlaneGeometry(wingWidth, wingHeight);
  rightGeo.translate(wingWidth / 2, 0, 0);
  const rightWing = new THREE.Mesh(rightGeo, new THREE.MeshBasicMaterial({ map: rightTex, ...matConfig }));

  const butterflyGroup = new THREE.Group();
  butterflyGroup.add(leftWing);
  butterflyGroup.add(rightWing);

  // Attach butterfly to the tracked anchor target
  const anchor = mindThree.addAnchor(0);
  anchor.group.add(butterflyGroup);

  const clock = new THREE.Clock();

  // MindAR Start & Render Loop
  await mindThree.start();

  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();

    // Wing Flapping Animation
    const flapAngle = Math.sin(t * 7) * 0.7;
    leftWing.rotation.y = flapAngle;
    rightWing.rotation.y = -flapAngle;

    // Gentle hovering over paper target anchor
    butterflyGroup.position.z = 0.2 + Math.sin(t * 2) * 0.1;

    renderer.render(scene, camera);
  });
}

document.getElementById('re-adjust-btn').addEventListener('click', async () => {
  if (mindThree) {
    await mindThree.stop();
    mindThree = null;
  }
  previewStep.classList.remove('active');
  adjustStep.classList.add('active');
});
