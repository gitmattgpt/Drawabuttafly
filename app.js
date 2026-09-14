let scene, camera, renderer, wireframeMesh;
const cameraFeed = document.getElementById('camera-feed');
const scanBtn = document.getElementById('scan-btn');
const resetBtn = document.getElementById('reset-btn');
const statusMsg = document.getElementById('status');

let isScanning = false;
let pointCloudPositions = [];
let scanInterval = null;

// Initialize Dual-Camera Feed & 3D Scene
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

  // Wireframe Mesh Geometry setup
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    wireframe: true,
    transparent: true,
    opacity: 0.8
  });

  wireframeMesh = new THREE.Mesh(geometry, material);
  scene.add(wireframeMesh);

  // Device Orientation tracking for camera matrix offset
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', handleMotion);
  }

  animate();
}

// Camera Motion handling via iPhone Gyroscope
function handleMotion(e) {
  if (!e.alpha) return;
  const alpha = THREE.MathUtils.degToRad(e.alpha);
  const beta = THREE.MathUtils.degToRad(e.beta);
  const gamma = THREE.MathUtils.degToRad(e.gamma);

  camera.rotation.set(beta, gamma, alpha, 'YXZ');
}

// Incremental Depth Mesh Reconstruction from Camera Stream
function captureDepthFrame() {
  if (!isScanning) return;

  const canvas = document.createElement('canvas');
  canvas.width = 80; // Low-res depth map resolution for real-time performance
  canvas.height = 60;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // Process frame to derive estimated depth from luminance gradients
  for (let y = 0; y < canvas.height; y += 4) {
    for (let x = 0; x < canvas.width; x += 4) {
      const idx = (y * canvas.width + x) * 4;
      const luma = (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) / 255;

      // Project 2D pixel grid into 3D world space
      const depth = 1.0 + (1.0 - luma) * 2.5; // Estimated z-depth based on visual contrast
      const vx = ((x / canvas.width) - 0.5) * depth * 1.5;
      const vy = -((y / canvas.height) - 0.5) * depth * 1.5;
      const vz = -depth;

      // Transform local coordinates into world space relative to camera orientation
      const vertex = new THREE.Vector3(vx, vy, vz);
      vertex.applyEuler(camera.rotation);

      pointCloudPositions.push(vertex.x, vertex.y, vertex.z);
    }
  }

  // Update Three.js wireframe mesh geometry incrementally
  const positionsTyped = new Float32Array(pointCloudPositions);
  wireframeMesh.geometry.setAttribute('position', new THREE.BufferAttribute(positionsTyped, 3));
  wireframeMesh.geometry.computeVertexNormals();
  wireframeMesh.geometry.attributes.position.needsUpdate = true;

  statusMsg.innerText = `Mesh Vertices Generated: ${pointCloudPositions.length / 3}`;
}

// Controls
scanBtn.addEventListener('click', () => {
  isScanning = !isScanning;
  if (isScanning) {
    scanBtn.innerText = "Pause Scanning ⏸️";
    scanInterval = setInterval(captureDepthFrame, 200); // Process 5 meshes/sec
  } else {
    scanBtn.innerText = "Resume Scanning 🎥";
    clearInterval(scanInterval);
  }
});

resetBtn.addEventListener('click', () => {
  pointCloudPositions = [];
  wireframeMesh.geometry.dispose();
  wireframeMesh.geometry = new THREE.BufferGeometry();
  statusMsg.innerText = "Mesh reset. Move phone slowly around the room to scan...";
});

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

window.onload = initScanner;
