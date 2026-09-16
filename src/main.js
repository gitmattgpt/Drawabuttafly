    let scene, camera, renderer, testCube, swarmGroup;
    let isScanning = false, swarmModeActive = true;
    let boids = [], savedButterflies = [];
    let deleteTargetId = null;
    let monarchTexture = null;
    let mindarThree = null;
    let mindarAnchor = null;
    let mindarTargetUrl = null;
    let imageTrackingActive = false;

    let hasManipulatorBeenUsed = false;
    let isManipulating = false;
    let touchState = {
      panX: 0, panY: 0,
      rotation: 0,
      scaleRadius: 120,
      startDist: 0, startAngle: 0,
      startPanX: 0, startPanY: 0, startRadius: 120
    };

    const rawCaptureCanvas = document.createElement('canvas');
    const rawCaptureCtx = rawCaptureCanvas.getContext('2d');
    
    const editorCanvas = document.getElementById('editor-canvas');
    const editorCtx = editorCanvas.getContext('2d');

    const TARGET_CENTER_POS = new THREE.Vector3(0, -0.2, -1.2);

    const video = document.getElementById('camera-feed');
    const gestureCanvas = document.getElementById('gesture-canvas');
    const gCtx = gestureCanvas.getContext('2d');
    
    const startBtn = document.getElementById('start-btn');
    const statusEl = document.getElementById('status');
    const swarmToggle = document.getElementById('swarm-toggle');
    const swarmSlider = document.getElementById('swarm-slider');
    const maxSliderInput = document.getElementById('max-slider-input');
    const camBtn = document.getElementById('top-center-cam-btn');
    const mindarContainer = document.getElementById('mindar-container');
    const targetFile = document.getElementById('target-file');
    const trackTargetBtn = document.getElementById('track-target-btn');
    const stopTrackingBtn = document.getElementById('stop-tracking-btn');
    
    const libToggleBtn = document.getElementById('lib-toggle-btn');
    const libraryDrawer = document.getElementById('library-drawer');
    const libraryGrid = document.getElementById('library-grid');
    
    const editorModal = document.getElementById('editor-modal');
    const centerSlider = document.getElementById('center-slider');
    const transSlider = document.getElementById('trans-slider');
    const targetQuality = document.getElementById('target-quality');
    const targetQualityTitle = document.getElementById('target-quality-title');
    const targetQualityScore = document.getElementById('target-quality-score');
    const targetQualityDetails = document.getElementById('target-quality-details');
    const targetCompile = document.getElementById('target-compile');
    const targetProgress = document.getElementById('target-progress');
    const editorSave = document.getElementById('editor-save');
    const editorCancel = document.getElementById('editor-cancel');

    const confirmModal = document.getElementById('confirm-modal');
    const modalConfirm = document.getElementById('modal-confirm');
    const modalCancel = document.getElementById('modal-cancel');

    const euler = new THREE.Euler();
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

    function generateMonarchData() {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, 512, 512);

      // Left Wing
      ctx.fillStyle = '#ff6d00';
      ctx.beginPath();
      ctx.moveTo(250, 256);
      ctx.bezierCurveTo(160, 80, 40, 100, 30, 220);
      ctx.bezierCurveTo(20, 340, 140, 420, 250, 256);
      ctx.fill();

      // Right Wing
      ctx.beginPath();
      ctx.moveTo(262, 256);
      ctx.bezierCurveTo(352, 80, 472, 100, 482, 220);
      ctx.bezierCurveTo(492, 340, 372, 420, 262, 256);
      ctx.fill();

      ctx.strokeStyle = '#000';
      ctx.lineWidth = 14;
      ctx.stroke();

      // Veins
      ctx.beginPath();
      ctx.moveTo(250, 256); ctx.lineTo(100, 160);
      ctx.moveTo(250, 256); ctx.lineTo(80, 250);
      ctx.moveTo(250, 256); ctx.lineTo(130, 340);
      ctx.moveTo(262, 256); ctx.lineTo(412, 160);
      ctx.moveTo(262, 256); ctx.lineTo(432, 250);
      ctx.moveTo(262, 256); ctx.lineTo(382, 340);
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.strokeStyle = '#000';
      ctx.lineWidth = 18;
      ctx.stroke();

      // White Spots
      ctx.fillStyle = '#fff';
      const spots = [
        [50, 200], [60, 150], [90, 120], [140, 100],
        [462, 200], [452, 150], [422, 120], [372, 100]
      ];
      spots.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      const dataUrl = canvas.toDataURL('image/png');
      const threeTex = new THREE.CanvasTexture(canvas);
      threeTex.needsUpdate = true;

      return { dataUrl, threeTex };
    }

    function init3D() {
      const width = window.innerWidth;
      const height = window.innerHeight;

      gestureCanvas.width = width;
      gestureCanvas.height = height;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(60, width / height, 0.05, 100);
      camera.position.set(0, 0, 0);

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      document.getElementById('webgl-canvas').appendChild(renderer.domElement);

      const monarchData = generateMonarchData();
      monarchTexture = monarchData.threeTex;

      const cubeGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
      const cubeMat = new THREE.MeshBasicMaterial({ color: 0xff0055, wireframe: true });
      testCube = new THREE.Mesh(cubeGeo, cubeMat);
      testCube.position.copy(TARGET_CENTER_POS);
      scene.add(testCube);

      swarmGroup = new THREE.Group();
      scene.add(swarmGroup);

      addDefaultMonarch(monarchData.dataUrl);
      setupGestureListeners();
      setModeState(swarmToggle.checked);

      window.addEventListener('resize', handleResize);

      render();
    }

    function handleResize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      gestureCanvas.width = width;
      gestureCanvas.height = height;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);

      clampManipulatorPosition();
      drawGestureOverlay();
    }

    function createHingedButterflyMesh(texture) {
      const group = new THREE.Group();
      const wingWidth = 0.16, wingHeight = 0.16;

      const wingMat = new THREE.MeshBasicMaterial({
        map: texture || monarchTexture,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.1,
        depthWrite: false
      });

      const leftGeo = new THREE.PlaneGeometry(wingWidth, wingHeight);
      leftGeo.translate(-wingWidth / 2, 0, 0);
      const leftUv = leftGeo.attributes.uv;
      for (let i = 0; i < leftUv.count; i++) leftUv.setX(i, leftUv.getX(i) * 0.5);

      const leftWing = new THREE.Mesh(leftGeo, wingMat);
      leftWing.name = "leftWing";

      const rightGeo = new THREE.PlaneGeometry(wingWidth, wingHeight);
      rightGeo.translate(wingWidth / 2, 0, 0);
      const rightUv = rightGeo.attributes.uv;
      for (let i = 0; i < rightUv.count; i++) rightUv.setX(i, 0.5 + rightUv.getX(i) * 0.5);

      const rightWing = new THREE.Mesh(rightGeo, wingMat);
      rightWing.name = "rightWing";

      group.add(leftWing);
      group.add(rightWing);
      return group;
    }

    function addDefaultMonarch(thumbUrl) {
      savedButterflies.push({
        id: 'monarch-default',
        name: 'Monarch Butterfly',
        activeInSwarm: true,
        thumb: thumbUrl,
        texture: monarchTexture
      });
      renderLibrary();
      updateSwarmCount(parseInt(swarmSlider.value));
    }

    function openEditorWithCapture() {
      if (!video.videoWidth) return;

      rawCaptureCanvas.width = 512;
      rawCaptureCanvas.height = 512;

      rawCaptureCtx.save();
      rawCaptureCtx.fillStyle = '#ffffff';
      rawCaptureCtx.fillRect(0, 0, 512, 512);

      rawCaptureCtx.translate(256, 256);
      rawCaptureCtx.rotate(-touchState.rotation);

      const scale = 256 / Math.max(30, touchState.scaleRadius);
      rawCaptureCtx.scale(scale, scale);

      const offsetX = -touchState.panX;
      const offsetY = -touchState.panY;

      const vW = video.videoWidth;
      const vH = video.videoHeight;
      const aspect = vW / vH;
      let drawW = 512;
      let drawH = 512 / aspect;

      rawCaptureCtx.drawImage(
        video,
        offsetX - drawW / 2,
        offsetY - drawH / 2,
        drawW,
        drawH
      );

      rawCaptureCtx.globalCompositeOperation = 'destination-in';
      rawCaptureCtx.beginPath();
      rawCaptureCtx.arc(0, 0, touchState.scaleRadius, 0, Math.PI * 2);
      rawCaptureCtx.fill();
      rawCaptureCtx.restore();

      editorModal.style.display = 'flex';
      updateEditorPreview();
    }

    function updateEditorPreview() {
      editorCtx.clearRect(0, 0, 512, 512);

      const centerShift = (parseInt(centerSlider.value) - 50) * 2;
      const thresholdVal = parseInt(transSlider.value) / 100;

      editorCtx.save();
      editorCtx.drawImage(rawCaptureCanvas, centerShift, 0);

      const imgData = editorCtx.getImageData(0, 0, 512, 512);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        const brightness = (r + g + b) / (3 * 255);
        if (brightness > (1 - thresholdVal)) {
          data[i + 3] = 0;
        }
      }

      editorCtx.putImageData(imgData, 0, 0);

      editorCtx.strokeStyle = 'rgba(255, 23, 68, 0.6)';
      editorCtx.lineWidth = 3;
      editorCtx.beginPath();
      editorCtx.moveTo(256, 0);
      editorCtx.lineTo(256, 512);
      editorCtx.stroke();

      editorCtx.restore();
      updateTargetQuality();
    }

    function analyzeTargetQuality() {
      const sampleSize = 96;
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = sampleSize;
      sampleCanvas.height = sampleSize;
      const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
      sampleCtx.drawImage(editorCanvas, 0, 0, sampleSize, sampleSize);
      const pixels = sampleCtx.getImageData(0, 0, sampleSize, sampleSize).data;
      const luminance = new Float32Array(sampleSize * sampleSize);
      let sum = 0;
      let opaque = 0;

      for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
        const alpha = pixels[i + 3] / 255;
        const value = (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]) / 255;
        luminance[p] = value;
        sum += value;
        if (alpha > 0.2) opaque++;
      }

      const mean = sum / luminance.length;
      let variance = 0;
      let edgeSum = 0;
      let edgeCount = 0;
      for (let y = 0; y < sampleSize; y++) {
        for (let x = 0; x < sampleSize; x++) {
          const index = y * sampleSize + x;
          const delta = luminance[index] - mean;
          variance += delta * delta;
          if (x > 0) {
            edgeSum += Math.abs(luminance[index] - luminance[index - 1]);
            edgeCount++;
          }
          if (y > 0) {
            edgeSum += Math.abs(luminance[index] - luminance[index - sampleSize]);
            edgeCount++;
          }
        }
      }

      const contrast = Math.sqrt(variance / luminance.length);
      const edgeDensity = edgeSum / edgeCount;
      const coverage = opaque / luminance.length;
      const score = Math.round(Math.min(100, Math.max(0,
        contrast * 180 + edgeDensity * 300 + Math.min(coverage, 0.85) * 12
      )));
      const reasons = [];
      if (contrast < 0.12) reasons.push('low contrast');
      if (edgeDensity < 0.045) reasons.push('few distinctive edges');
      if (coverage < 0.35) reasons.push('mostly empty or transparent');

      return { score, reasons };
    }

    function updateTargetQuality() {
      const result = analyzeTargetQuality();
      targetQuality.className = 'target-quality ' + (result.score >= 55 ? 'good' : result.score >= 35 ? 'warn' : 'poor');
      targetQualityTitle.textContent = result.score >= 55 ? 'Good image-target candidate' : result.score >= 35 ? 'Borderline image-target candidate' : 'Low-detail image target';
      targetQualityScore.textContent = `Quality score: ${result.score}/100`;
      targetQualityDetails.textContent = result.reasons.length
        ? `${result.reasons.join(', ')}. Add texture, contrast, and keep the full crop visible.`
        : 'Distinctive contrast and edges detected. Keep the full crop visible when tracking.';
      return result;
    }

    function canvasToImage(canvas) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = canvas.toDataURL('image/png');
      });
    }

    async function compileMindARTarget() {
      const quality = updateTargetQuality();
      if (quality.score < 25) {
        targetProgress.textContent = 'Improve the crop before compiling this target.';
        return;
      }

      targetCompile.disabled = true;
      targetProgress.textContent = 'Preparing target image…';
      try {
        const { Compiler: MindARCompiler } = await import('mind-ar-compiler');
        const compiler = new MindARCompiler();
        const image = await canvasToImage(editorCanvas);
        const dataList = await compiler.compileImageTargets([image], (progress) => {
          targetProgress.textContent = `Compiling image target… ${progress.toFixed(0)}%`;
        });
        const buffer = await compiler.exportData();
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `butterfly-target-${Date.now()}.mind`;
        link.click();
        URL.revokeObjectURL(url);
        const pointCount = dataList?.[0]?.trackingData?.[0]?.points?.length || 0;
        targetProgress.textContent = `Target ready and downloaded${pointCount ? ` (${pointCount} tracking points)` : ''}.`;
      } catch (error) {
        console.error('MindAR target compilation failed:', error);
        targetProgress.textContent = 'Target compilation failed. Try a larger, sharper, more detailed crop.';
      } finally {
        targetCompile.disabled = false;
      }
    }

    function stopLocalCamera() {
      if (video.srcObject) {
        video.srcObject.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
      isScanning = false;
    }

    function getTrackingButterfly() {
      return savedButterflies.find((item) => item.activeInSwarm) || savedButterflies[0];
    }

    async function startImageTracking() {
      const file = targetFile.files[0];
      if (!file) {
        statusEl.innerText = 'Choose a .mind target file first.';
        return;
      }
      if (!window.MINDAR?.IMAGE?.MindARThree) {
        statusEl.innerText = 'MindAR runtime could not be loaded.';
        return;
      }

      await stopImageTracking();
      stopLocalCamera();
      mindarTargetUrl = URL.createObjectURL(file);
      imageTrackingActive = true;
      mindarContainer.classList.add('active');
      mindarContainer.setAttribute('aria-hidden', 'false');
      document.getElementById('viewport').style.visibility = 'hidden';
      trackTargetBtn.hidden = true;
      stopTrackingBtn.hidden = false;
      startBtn.style.display = 'none';
      statusEl.innerText = 'Starting image tracking…';

      try {
        mindarThree = new MINDAR.IMAGE.MindARThree({
          container: mindarContainer,
          imageTargetSrc: mindarTargetUrl,
          uiLoading: 'no', uiScanning: 'no', uiError: 'no',
          filterMinCF: 0.0001, filterBeta: 0.001,
          warmupTolerance: 5, missTolerance: 5
        });
        mindarAnchor = mindarThree.addAnchor(0);
        const butterfly = getTrackingButterfly();
        if (butterfly) {
          const mesh = createHingedButterflyMesh(butterfly.texture);
          mesh.scale.setScalar(2.2);
          mesh.position.set(0, 0.08, 0.02);
          mindarAnchor.group.add(mesh);
        }
        mindarAnchor.onTargetFound = () => { statusEl.innerText = 'Image target found — butterfly anchored.'; };
        mindarAnchor.onTargetLost = () => { statusEl.innerText = 'Searching for image target…'; };
        await mindarThree.start();
        const { renderer, scene: trackingScene, camera: trackingCamera } = mindarThree;
        renderer.setAnimationLoop(() => renderer.render(trackingScene, trackingCamera));
        statusEl.innerText = 'Searching for image target…';
      } catch (error) {
        console.error('MindAR tracking failed:', error);
        statusEl.innerText = 'Could not start image tracking. Check the .mind file and camera permission.';
        await stopImageTracking();
      }
    }

    async function stopImageTracking() {
      if (mindarThree) {
        mindarThree.renderer?.setAnimationLoop(null);
        try {
          if (mindarThree.controller && mindarThree.video) mindarThree.stop();
        } catch (error) {
          console.warn('MindAR shutdown warning:', error);
        }
        mindarThree.renderer?.domElement.remove();
        mindarThree.cssRenderer?.domElement.remove();
        mindarThree.video?.remove();
      }
      mindarThree = null;
      mindarAnchor = null;
      imageTrackingActive = false;
      mindarContainer.classList.remove('active');
      mindarContainer.setAttribute('aria-hidden', 'true');
      document.getElementById('viewport').style.visibility = 'visible';
      trackTargetBtn.hidden = false;
      stopTrackingBtn.hidden = true;
      startBtn.style.display = 'block';
      if (mindarTargetUrl) {
        URL.revokeObjectURL(mindarTargetUrl);
        mindarTargetUrl = null;
      }
      statusEl.innerText = 'Image tracking stopped.';
    }

    function renderLibrary() {
      libraryGrid.innerHTML = '';
      savedButterflies.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'lib-item';
        div.innerHTML = `
          <div class="lib-item-info">
            <input type="checkbox" ${item.activeInSwarm ? 'checked' : ''} data-id="${item.id}" class="lib-toggle">
            <img src="${item.thumb}" class="lib-thumb">
            <input type="text" value="${item.name}" data-id="${item.id}" class="lib-name-input">
          </div>
          <button class="btn-del" data-id="${item.id}">Delete</button>
        `;
        libraryGrid.appendChild(div);
      });

      document.querySelectorAll('.lib-toggle').forEach(chk => {
        chk.addEventListener('change', (e) => {
          const id = e.target.getAttribute('data-id');
          const bfly = savedButterflies.find(b => b.id === id);
          if (bfly) bfly.activeInSwarm = e.target.checked;
          updateSwarmCount(parseInt(swarmSlider.value));
        });
      });

      document.querySelectorAll('.lib-name-input').forEach(inp => {
        inp.addEventListener('change', (e) => {
          const id = e.target.getAttribute('data-id');
          const bfly = savedButterflies.find(b => b.id === id);
          if (bfly) bfly.name = e.target.value;
        });
      });

      document.querySelectorAll('.btn-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
          deleteTargetId = e.target.getAttribute('data-id');
          confirmModal.style.display = 'flex';
        });
      });
    }

    function updateSwarmCount(count) {
      while(swarmGroup.children.length > 0) {
        swarmGroup.remove(swarmGroup.children[0]);
      }
      boids = [];

      const activeList = savedButterflies.filter(b => b.activeInSwarm);
      if (activeList.length === 0) return;

      for(let i = 0; i < count; i++) {
        const sourcePattern = activeList[i % activeList.length];
        const bfly = createHingedButterflyMesh(sourcePattern.texture);
        
        const boid = {
          mesh: bfly,
          pos: TARGET_CENTER_POS.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.8,
            (Math.random() - 0.5) * 0.8,
            (Math.random() - 0.5) * 0.8
          )),
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.02
          ),
          flapSpeed: 0.18 + Math.random() * 0.08,
          flapPhase: Math.random() * Math.PI * 2
        };

        bfly.position.copy(boid.pos);
        swarmGroup.add(bfly);
        boids.push(boid);
      }
    }

    function clampManipulatorPosition() {
      const margin = 20;
      const screenHalfW = gestureCanvas.width / 2;
      const screenHalfH = gestureCanvas.height / 2;

      touchState.panX = Math.max(-screenHalfW + margin, Math.min(screenHalfW - margin, touchState.panX));
      touchState.panY = Math.max(-screenHalfH + margin, Math.min(screenHalfH - margin, touchState.panY));
    }

    function setupGestureListeners() {
      gestureCanvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          hasManipulatorBeenUsed = true;
          isManipulating = true;
          const t1 = e.touches[0], t2 = e.touches[1];
          touchState.startDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          touchState.startAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
          touchState.startPanX = touchState.panX - (t1.clientX + t2.clientX) / 2;
          touchState.startPanY = touchState.panY - (t1.clientY + t2.clientY) / 2;
          touchState.startRadius = touchState.scaleRadius;
          drawGestureOverlay();
        }
      });

      gestureCanvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && isManipulating) {
          e.preventDefault();
          const t1 = e.touches[0], t2 = e.touches[1];
          const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          touchState.scaleRadius = Math.max(30, touchState.startRadius * (dist / touchState.startDist));

          const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
          touchState.rotation += (angle - touchState.startAngle);
          touchState.startAngle = angle;

          const midX = (t1.clientX + t2.clientX) / 2;
          const midY = (t1.clientY + t2.clientY) / 2;
          
          touchState.panX = midX + touchState.startPanX;
          touchState.panY = midY + touchState.startPanY;

          clampManipulatorPosition();
          drawGestureOverlay();
        }
      });

      gestureCanvas.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
          isManipulating = false;
        }
      });
    }

    function drawGestureOverlay() {
      gCtx.clearRect(0, 0, gestureCanvas.width, gestureCanvas.height);
      
      if (!hasManipulatorBeenUsed) return;

      const cx = gestureCanvas.width / 2 + touchState.panX;
      const cy = gestureCanvas.height / 2 + touchState.panY;

      gCtx.save();
      gCtx.translate(cx, cy);
      gCtx.rotate(touchState.rotation);

      // Crop Exclusion Boundary Circle
      gCtx.beginPath();
      gCtx.arc(0, 0, touchState.scaleRadius, 0, Math.PI * 2);
      gCtx.strokeStyle = '#ff9800';
      gCtx.setLineDash([6, 6]);
      gCtx.lineWidth = 2;
      gCtx.stroke();

      // Centerline Reference Alignment Guide
      gCtx.beginPath();
      gCtx.moveTo(0, -touchState.scaleRadius * 1.25);
      gCtx.lineTo(0, touchState.scaleRadius * 1.25);
      gCtx.strokeStyle = '#ff1744';
      gCtx.setLineDash([]);
      gCtx.lineWidth = 2.5;
      gCtx.stroke();

      gCtx.restore();
    }

    function setModeState(isSwarmActive) {
      swarmModeActive = isSwarmActive;
      if (swarmModeActive) {
        testCube.visible = false;
        swarmGroup.visible = true;
        statusEl.style.display = "none";
      } else {
        testCube.visible = true;
        swarmGroup.visible = false;
        statusEl.style.display = "block";
      }
    }

    async function startAR() {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const res = await DeviceOrientationEvent.requestPermission();
          if (res === 'granted') {
            window.addEventListener('deviceorientation', handleiOSOrientation);
          }
        } catch (e) { console.warn(e); }
      } else {
        window.addEventListener('deviceorientation', handleiOSOrientation);
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        video.srcObject = stream;
        await video.play();

        isScanning = true;
        startBtn.style.display = "none";
      } catch (err) {
        statusEl.innerText = "Camera permission denied.";
      }
    }

    function handleiOSOrientation(e) {
      if (e.beta === null) return;
      const alpha = e.alpha ? THREE.MathUtils.degToRad(e.alpha) : 0;
      const beta = e.beta ? THREE.MathUtils.degToRad(e.beta) : 0;
      const gamma = e.gamma ? THREE.MathUtils.degToRad(e.gamma) : 0;

      euler.set(beta, gamma, -alpha, 'YXZ');
      camera.quaternion.setFromEuler(euler);
      camera.quaternion.multiply(q1);

      if (!swarmModeActive) {
        statusEl.innerText = `Pitch: ${(beta * 57.29).toFixed(1)}° | Roll: ${(gamma * 57.29).toFixed(1)}° | Yaw: ${(alpha * 57.29).toFixed(1)}°`;
      }
    }

    function updateBoids() {
      if (!swarmModeActive) return;

      boids.forEach((boid) => {
        const pullCenter = TARGET_CENTER_POS.clone().sub(boid.pos).multiplyScalar(0.015);
        boid.vel.add(pullCenter);
        boid.vel.clampLength(0.005, 0.025);
        boid.pos.add(boid.vel);
        boid.mesh.position.copy(boid.pos);

        boid.flapPhase += boid.flapSpeed;
        const flapAngle = Math.sin(boid.flapPhase) * 0.75;
        
        const left = boid.mesh.getObjectByName("leftWing");
        const right = boid.mesh.getObjectByName("rightWing");
        if(left && right) {
          left.rotation.y = flapAngle;
          right.rotation.y = -flapAngle;
        }

        boid.mesh.lookAt(boid.pos.clone().add(boid.vel));
      });
    }

    function render() {
      requestAnimationFrame(render);
      if (testCube && testCube.visible) {
        testCube.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), 0.025);
      }
      updateBoids();
      renderer.render(scene, camera);
    }

    libToggleBtn.addEventListener('click', () => {
      const isOpen = libraryDrawer.classList.toggle('open');
      if (isOpen) {
        const drawerHeight = libraryDrawer.offsetHeight;
        libToggleBtn.style.bottom = `${drawerHeight + 8}px`;
        libToggleBtn.innerText = 'Hide Library ▼';
      } else {
        libToggleBtn.style.bottom = 'calc(env(safe-area-inset-bottom, 0px) + 12px)';
        libToggleBtn.innerText = 'Show Library ▲';
      }
    });

    camBtn.addEventListener('click', openEditorWithCapture);

    centerSlider.addEventListener('input', (e) => {
      document.getElementById('center-val').innerText = `${e.target.value}%`;
      updateEditorPreview();
    });

    transSlider.addEventListener('input', (e) => {
      document.getElementById('trans-val').innerText = `${e.target.value}%`;
      updateEditorPreview();
    });

    targetCompile.addEventListener('click', compileMindARTarget);

    editorSave.addEventListener('click', () => {
      const dataUrl = editorCanvas.toDataURL('image/png');
      const newTex = new THREE.CanvasTexture(editorCanvas);
      newTex.needsUpdate = true;

      savedButterflies.push({
        id: 'cap-' + Date.now(),
        name: `Custom Pattern #${savedButterflies.length + 1}`,
        activeInSwarm: true,
        thumb: dataUrl,
        texture: newTex
      });

      renderLibrary();
      updateSwarmCount(parseInt(swarmSlider.value));
      editorModal.style.display = 'none';
    });

    editorCancel.addEventListener('click', () => {
      editorModal.style.display = 'none';
    });

    modalConfirm.addEventListener('click', () => {
      if (deleteTargetId) {
        savedButterflies = savedButterflies.filter(b => b.id !== deleteTargetId);
        renderLibrary();
        updateSwarmCount(parseInt(swarmSlider.value));
        deleteTargetId = null;
      }
      confirmModal.style.display = 'none';
    });

    modalCancel.addEventListener('click', () => {
      deleteTargetId = null;
      confirmModal.style.display = 'none';
    });

    swarmToggle.addEventListener('change', (e) => setModeState(e.target.checked));
    swarmSlider.addEventListener('input', (e) => updateSwarmCount(parseInt(e.target.value)));
    
    maxSliderInput.addEventListener('change', (e) => {
      let val = parseInt(e.target.value) || 20;
      if (val < 1) val = 1;
      swarmSlider.max = val;
      maxSliderInput.value = val;
    });

    targetFile.addEventListener('change', () => {
      trackTargetBtn.disabled = !targetFile.files.length;
      if (targetFile.files.length) statusEl.innerText = 'Target loaded. Start image tracking when ready.';
    });
    trackTargetBtn.addEventListener('click', startImageTracking);
    stopTrackingBtn.addEventListener('click', stopImageTracking);
    startBtn.addEventListener('click', startAR);
    window.onload = init3D;
