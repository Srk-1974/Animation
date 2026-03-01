const imageUpload = document.getElementById('imageUpload');
const startBtn = document.getElementById('startBtn');
const speedInput = document.getElementById('speedInput');
const charInput = document.getElementById('charInput');
const canvas = document.getElementById('outputCanvas');
const loading = document.getElementById('loading');
const ctx = canvas.getContext('2d');

let customPoints = [];
let img = new Image();
let animId = null;
let currentIndex = 0;

// Read the uploaded image
imageUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

// Setup the canvas once the image is loaded
img.onload = () => {
    const maxWidth = 800;
    const maxHeight = 800;
    let width = img.width;
    let height = img.height;
    
    // Scale Down if needed
    if(width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
    }
    
    canvas.width = width;
    canvas.height = height;
    
    // Draw Preview
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = 0.2; // Dim preview
    ctx.drawImage(img, 0, 0, width, height);
    ctx.globalAlpha = 1.0;
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "20px Inter, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText("Ready to animate!", width/2, height/2);
};

startBtn.addEventListener('click', () => {
  if (!img.src) {
    alert("Please upload an image first.");
    return;
  }
  if(animId) cancelAnimationFrame(animId);
  
  loading.style.display = 'block';

  // Allow UI to render loading message by deferring work
  setTimeout(() => {
    processImage();
    loading.style.display = 'none';
  }, 50);
});

function processImage() {
  const width = canvas.width;
  const height = canvas.height;
  
  // Use a hidden canvas to extract pixel data
  const hiddenCanvas = document.createElement('canvas');
  hiddenCanvas.width = width;
  hiddenCanvas.height = height;
  const hctx = hiddenCanvas.getContext('2d');
  hctx.drawImage(img, 0, 0, width, height);
  
  const imgData = hctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  
  let tempPoints = [];

  // Edge detection / Dark pixel extraction
  // Assuming white background with dark outline
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx+1];
      const b = data[idx+2];
      const a = data[idx+3];
      
      if (a > 128) {
        // Calculate Luma (brightness)
        const luma = 0.299*r + 0.587*g + 0.114*b;
        if (luma < 150) { // Threshold for dark edges
          tempPoints.push({x, y});
        }
      }
    }
  }

  // Handle transparent PNGs with edges (where content is non-transparent)
  if(tempPoints.length === 0) {
    // maybe it's a white outline on transparent background? 
    // Fallback: extract all non-transparent pixels
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const a = data[idx+3];
          if (a > 50) {
             tempPoints.push({x, y});
          }
        }
    }
  }

  // Subsample space: restrict points so characters don't overlap too much
  const grid = {};
  const cellSize = 6; // roughly font size/2 spread
  const filtered = [];
  tempPoints.forEach(p => {
    const gx = Math.floor(p.x / cellSize);
    const gy = Math.floor(p.y / cellSize);
    const key = `${gx},${gy}`;
    if(!grid[key]) {
      grid[key] = true;
      filtered.push(p);
    }
  });

  // Nearest-Neighbor Sort for the "drawing" effect
  customPoints = [];
  if (filtered.length > 0) {
    let current = filtered.shift();
    customPoints.push(current);
    
    while (filtered.length > 0) {
        let nearestIdx = 0;
        let minDist = Infinity;
        
        // limit search bounds to avoid freezing browser on huge images
        const searchLen = Math.min(filtered.length, 1200); 
        for(let i=0; i<searchLen; i++) {
            let p = filtered[i];
            let dist = Math.pow(p.x - current.x, 2) + Math.pow(p.y - current.y, 2);
            if(dist < minDist) {
                minDist = dist;
                nearestIdx = i;
            }
        }
        current = filtered.splice(nearestIdx, 1)[0];
        customPoints.push(current);
    }
  }

  ctx.clearRect(0, 0, width, height); // Clear visible canvas for drawing
  startAnimation();
}

function startAnimation() {
    currentIndex = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw extremely dim background image as guide
    ctx.globalAlpha = 0.05;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1.0;
    
    // Set text style
    const ch = charInput.value || '*';
    ctx.fillStyle = '#00ff88'; // Vibrant Neon Green
    ctx.font = '10px monospace';
    // Add cool glowing effect
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#00ff88';
    
    function loop() {
        let speed = parseInt(speedInput.value);
        // speed scale mapped to number of points drawn per frame
        let pointsPerFrame = Math.max(1, Math.floor(speed / 2));
        
        for(let i=0; i<pointsPerFrame; i++) {
            if(currentIndex >= customPoints.length) break;
            const p = customPoints[currentIndex];
            ctx.fillText(ch, p.x, p.y);
            currentIndex++;
        }
        if (currentIndex < customPoints.length) {
            animId = requestAnimationFrame(loop);
        } else {
            // Finished
            ctx.shadowBlur = 0; // Turn off glow when done
        }
    }
    loop();
}
