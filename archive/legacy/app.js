let scene, camera, renderer, pointCloudMesh;
const cameraFeed = document.getElementById('camera-feed');
const scanBtn = document.getElementById('scan-btn');
const resetBtn = document.getElementById('reset-btn');
const statusMsg = document.getElementById('status');

let isScanning = false;
let pointCloudPositions = [];
let scanInterval = null;

// Dedicated canvas for Safari image data extraction
const procCanvas = document.createElement('canvas');
procCanvas.width = 64;
procCanvas.height = 48;
const procCtx = procCanvas.getContext('2d', { willReadFrequently: true });

// Step 1: Initialize Camera Feed & 3D Environment
async function initScanner() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    cameraFeed.srcObject = stream;
    await new Promise((resolve) => { cameraFeed.onloadedmetadata = resolve; });
  } catch (err) {
    statusMsg.innerText = "Camera permission denied or unavailable.";
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.set(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);
  document.getElementById('webgl-container').appendChild(renderer.domElement);

  // 3D Point-Cloud Mesh Geometry Setup
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.PointsMaterial({
    color: 0x00ffcc,
    size: 0.03,
    transparent: true,
    opacity: 0.85
  });

  pointCloudMesh = new THREE.Points(geometry, material);
  scene.add(pointCloudMesh);

  animate();
}

// Request Motion Sensor Access (Required for iOS Safari)
async function requestiOSMotionPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const response = await DeviceOrientationEvent.requestPermission();
      if (response === 'granted') {
        window.addEventListener('deviceorientation', handleMotion);
      }
    } catch (e) {
      console.warn("Motion permission rejected:", e);
    }
  } else if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', handleMotion);
  }
}

// Gyroscope Camera Transformation
function handleMotion(e) {
  if (e.beta === null) return;
  const alpha = THREE.MathUtils.degToRad(e.alpha || 0);
  const beta = THREE.MathUtils.degToRad(e.beta || 0);
  const gamma = THREE.MathUtils.degToRad(e.gamma || 0);

  camera.rotation.set(beta, gamma, alpha, 'YXZ');
}

// Step 2: Live Mesh Generation Engine
function captureDepthFrame() {
  if (!isScanning) return;

  // Draw current frame into low-res processing canvas
  procCtx.drawImage(cameraFeed, 0, 0, procCanvas.width, procCanvas.height);
  const imgData = procCtx.getImageData(0, 0, procCanvas.width, procCanvas.height);
  const data = imgData.data;

  // Extract luminance features and project to 3D mesh points
  for (let y = 0; y < procCanvas.height; y += 3) {
    for (let x = 0; x < procCanvas.width; x += 3) {
      const idx = (y * procCanvas.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Calculate depth offset based on pixel luminance
      const depth = 0.8 + (1.0 - luma) * 2.0; 
      const vx = ((x / procCanvas.width) - 0.5) * depth * 1.4;
      const vy = -((y / procCanvas.height) - 0.5) * depth * 1.4;
      const vz = -depth;

      // Transform point into global 3D space
      const vertex = new THREE.Vector3(vx, vy, vz);
      vertex.applyEuler(camera.rotation);

      pointCloudPositions.push(vertex.x, vertex.y, vertex.z);
    }
  }

  // Cap vertex array size to keep frame rate silky smooth on iPhone
  if (pointCloudPositions.length > 15000) {
    pointCloudPositions.splice(0, 3000);
  }

  // Update Three.js Buffer Geometry
  const positionsTyped = new Float32Array(pointCloudPositions);
  pointCloudMesh.geometry.setAttribute('position', new THREE.BufferAttribute(positionsTyped, 3));
  pointCloudMesh.geometry.attributes.position.needsUpdate = true;

  statusMsg.innerText = `Scanning Room... Active Mesh Points: ${pointCloudPositions.length / 3}`;
}

// Step 3: Controls & State Listeners
scanBtn.addEventListener('click', async () => {
  await requestiOSMotionPermission();

  isScanning = !isScanning;
  if (isScanning) {
    scanBtn.innerText = "Pause Scanning ⏸️";
    scanInterval = setInterval(captureDepthFrame, 150); // Scan 6.5 times per second
  } else {
    scanBtn.innerText = "Resume Scanning 🎥";
    clearInterval(scanInterval);
  }
});

resetBtn.addEventListener('click', () => {
  pointCloudPositions = [];
  pointCloudMesh.geometry.dispose();
  pointCloudMesh.geometry = new THREE.BufferGeometry();
  statusMsg.innerText = "Mesh cleared. Tap 'Start Scanning' and slowly move your phone.";
});

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

window.onload = initScanner;
