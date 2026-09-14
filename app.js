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
    
    // Anything brighter than threshold turns transparent
    if (luma > threshold) {
      data[i + 3] = 0; // Set Alpha to 0
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Draw Centerline Indicator
  const splitX = (thresholdCanvas.width * splitSlider.value) / 100;
  ctx.strokeStyle = '#ff0055';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(splitX, 0);
  ctx.lineTo(splitX, thresholdCanvas.height);
  ctx.stroke();
}

thresholdSlider.addEventListener('input', processAlphaMap);
splitSlider.addEventListener('input', processAlphaMap);

// Step 3: 3D Scene Setup (Three.js)
let scene, camera, renderer, leftWing, rightWing;

generateBtn.addEventListener('click', () => {
  adjustStep.classList.remove('active');
  previewStep.classList.add('active');
  init3DButterfly();
});

function init3DButterfly() {
  const container = document.getElementById('webgl-container');
  container.innerHTML = '';

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 5);

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const texture = new THREE.CanvasTexture(thresholdCanvas);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide
  });

  const wingGeo = new THREE.PlaneGeometry(1.5, 2);

  // Left Wing Anchor
  leftWing = new THREE.Mesh(wingGeo, material);
  leftWing.geometry.translate(-0.75, 0, 0);
  
  // Right Wing Anchor
  rightWing = new THREE.Mesh(wingGeo, material);
  rightWing.geometry.translate(0.75, 0, 0);
  rightWing.rotation.y = Math.PI;

  const butterflyGroup = new THREE.Group();
  butterflyGroup.add(leftWing);
  butterflyGroup.add(rightWing);
  scene.add(butterflyGroup);

  // Flapping Animation Loop
  let clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime() * 5; // Flapping speed
    const angle = Math.sin(t) * 0.6;      // Flapping amplitude
    
    leftWing.rotation.y = angle;
    rightWing.rotation.y = -angle;
    
    renderer.render(scene, camera);
  }
  animate();
}

document.getElementById('re-adjust-btn').addEventListener('click', () => {
  previewStep.classList.remove('active');
  adjustStep.classList.add('active');
});
