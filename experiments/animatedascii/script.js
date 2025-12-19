/**
 * Animated ASCII Background Lab
 * Core Logic & Customization Engine
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    const state = {
        noiseAlgorithm: 'perlin',
        noiseLevel: 0.03,
        speed: 1.0,
        fontSize: 14,
        bgColor: '#ffffff',
        colors: ["#0081A7", "#00AFB9", "#7FD6CB", "#BEE9D4", "#f07167"],
        cursorEffect: true,
        charSet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@%&{}[]()<>*+-=/",
        frame: 0,
        mouse: { x: -1000, y: -1000 },
        columns: 0,
        rows: 0,
        charGrid: []
    };

    // --- DOM Elements ---
    const canvas = document.getElementById('ascii-canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    const noiseLevelInput = document.getElementById('noise-level');
    const noiseLevelVal = document.getElementById('noise-level-val');
    const speedInput = document.getElementById('speed');
    const speedVal = document.getElementById('speed-val');
    const fontSizeInput = document.getElementById('font-size');
    const fontSizeVal = document.getElementById('font-size-val');
    const bgColorPicker = document.getElementById('bg-color-picker');
    const bgColorContainer = document.getElementById('bg-color-container');
    const cursorCheckbox = document.getElementById('cursor-effect');
    const colorPalette = document.getElementById('color-palette');
    const randomizeBtn = document.getElementById('randomize-btn');
    const exportBtn = document.getElementById('export-btn');
    const noiseButtons = document.querySelectorAll('.toggle-btn[data-noise]');

    // --- Noise Engine ---
    const Noise = (function () {
        // Perlin Implementation
        const p = new Uint8Array(512);
        const permutation = [151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 121, 123, 82, 58, 183, 128, 157, 235, 192, 207, 215, 66, 129, 50, 210, 138, 242, 126, 253, 34, 70, 223, 61, 93, 222, 176, 189, 206, 81, 107, 31, 43, 153, 5, 67, 112, 180, 98, 243, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 121, 123, 82, 58, 183, 128, 157, 235, 192, 207, 215, 66, 129, 50, 210, 138, 242, 126, 253, 34, 70, 223, 61, 93, 222, 176, 189, 206, 81, 107, 31, 43, 153, 5, 67, 112, 180, 98, 243];
        for (let i = 0; i < 256; i++) p[256 + i] = p[i] = permutation[i];

        function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
        function lerp(t, a, b) { return a + t * (b - a); }
        function grad(hash, x, y, z) {
            const h = hash & 15;
            const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z;
            return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
        }

        return {
            perlin: (x, y, z) => {
                const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
                x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
                const u = fade(x), v = fade(y), w = fade(z);
                const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
                return lerp(w, lerp(v, lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
                    lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))),
                    lerp(v, lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
                        lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))));
            },
            voronoi: (x, y, z) => {
                // Worley Noise Implementation
                const xi = Math.floor(x), yi = Math.floor(y);
                let minDist = 1.0;

                for (let j = -1; j <= 1; j++) {
                    for (let i = -1; i <= 1; i++) {
                        const cx = xi + i, cy = yi + j;
                        // Use a static hash per cell to keep feature points consistent
                        const h = ((Math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453123) % 1 + 1) % 1;
                        // Use z only for smooth orbital motion of the feature point
                        const px = cx + Math.cos(z + h * 6.28) * 0.5 + 0.5;
                        const py = cy + Math.sin(z + h * 6.28) * 0.5 + 0.5;
                        const dx = px - x, dy = py - y;
                        const d = Math.sqrt(dx * dx + dy * dy);
                        if (d < minDist) minDist = d;
                    }
                }
                return minDist * 2 - 1; // Map to roughly [-1, 1]
            },
            random: () => Math.random() * 2 - 1
        };
    })();

    // --- Helpers ---
    function lerpColor(a, b, amount) {
        const ah = parseInt(a.replace(/#/g, ''), 16),
            ar = ah >> 16, ag = ah >> 8 & 0xff, ab = ah & 0xff,
            bh = parseInt(b.replace(/#/g, ''), 16),
            br = bh >> 16, bg = bh >> 8 & 0xff, bb = bh & 0xff,
            rr = ar + amount * (br - ar),
            rg = ag + amount * (bg - ag),
            rb = ab + amount * (bb - ab);

        return '#' + ((1 << 24) + (Math.round(rr) << 16) + (Math.round(rg) << 8) + Math.round(rb)).toString(16).slice(1);
    }

    // --- Core Logic ---
    function initCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        state.columns = Math.ceil(canvas.width / (state.fontSize * 0.6)); // Approx char width
        state.rows = Math.ceil(canvas.height / state.fontSize);

        // Initialize/Resize character grid
        state.charGrid = [];
        for (let r = 0; r < state.rows; r++) {
            let row = [];
            for (let c = 0; c < state.columns; c++) {
                row.push(state.charSet[Math.floor(Math.random() * state.charSet.length)]);
            }
            state.charGrid.push(row);
        }
    }

    function render() {
        ctx.fillStyle = state.bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = `${state.fontSize}px "JetBrains Mono"`;
        const charWidth = state.fontSize * 0.6;
        const zOff = state.frame * 0.005 * state.speed;

        for (let r = 0; r < state.rows; r++) {
            for (let c = 0; c < state.columns; c++) {
                const x = c * charWidth;
                const y = r * state.fontSize;

                let noiseVal = 0;
                if (state.noiseAlgorithm === 'perlin') {
                    noiseVal = Noise.perlin(c * state.noiseLevel, r * state.noiseLevel, zOff);
                } else if (state.noiseAlgorithm === 'voronoi') {
                    // Boosting speed multiplier to hit the sweet spot
                    noiseVal = Noise.voronoi(c * state.noiseLevel * 5, r * state.noiseLevel * 5, zOff * 2.0);
                } else {
                    // True random but update frequency is controlled by speed to prevent seizure-inducing flickering
                    // We use one random value per cell, stored/updated occasionally
                    if (Math.random() < 0.1 * state.speed) {
                        noiseVal = Noise.random();
                    } else {
                        // We need to keep a value. Let's use a trick with the character grid or a cheap hash
                        const hash = (Math.sin(c * 12.9898 + r * 78.233) * 43758.5453123) % 1;
                        noiseVal = (hash * 2 - 1);
                    }
                }

                // Cursor Ripple Disruption
                if (state.cursorEffect) {
                    const dx = x - state.mouse.x;
                    const dy = y - (state.mouse.y - state.fontSize / 2);
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 150) {
                        noiseVal += (1 - dist / 150) * 0.8;
                    }
                }

                const norm = (noiseVal + 1) / 2;
                let colorIndex = Math.floor(norm * state.colors.length);
                colorIndex = Math.max(0, Math.min(colorIndex, state.colors.length - 1));

                ctx.fillStyle = state.colors[colorIndex];

                // Active character glitch - now respects speed
                if (Math.random() < 0.05 * state.speed) {
                    state.charGrid[r][c] = state.charSet[Math.floor(Math.random() * state.charSet.length)];
                }

                ctx.fillText(state.charGrid[r][c], x, y);
            }
        }

        state.frame++;
        requestAnimationFrame(render);
    }

    // --- UI Controls ---
    function updatePalette(animateIndex = -1) {
        colorPalette.innerHTML = '';
        state.colors.forEach((color, index) => {
            const item = document.createElement('div');
            item.className = 'color-item' + (index === animateIndex ? ' pop-in' : '');
            item.style.backgroundColor = color;
            item.innerHTML = `
                <input type="color" value="${color}" style="opacity:0; width:100%; height:100%; cursor:pointer;">
                <div class="remove-color" data-index="${index}"><i class="fas fa-times"></i></div>
            `;

            // Picker change
            item.querySelector('input').addEventListener('input', (e) => {
                state.colors[index] = e.target.value;
                item.style.backgroundColor = e.target.value;
            });

            // Remove logic
            item.querySelector('.remove-color').addEventListener('click', (e) => {
                e.stopPropagation();
                if (state.colors.length > 1) {
                    item.classList.add('pop-out');
                    setTimeout(() => {
                        state.colors.splice(index, 1);
                        updatePalette();
                    }, 300); // Match CSS duration
                }
            });

            colorPalette.appendChild(item);

            // Add "+" button between items (except after the last one)
            if (index < state.colors.length - 1) {
                const addBetween = document.createElement('div');
                addBetween.className = 'add-between';
                addBetween.title = 'Add mixed color';
                addBetween.addEventListener('click', () => {
                    if (state.colors.length < 15) { // Reasonable limit
                        const mixed = lerpColor(state.colors[index], state.colors[index + 1], 0.5);
                        state.colors.splice(index + 1, 0, mixed);
                        updatePalette(index + 1);
                    }
                });
                colorPalette.appendChild(addBetween);
            }
        });

        // Add "+" button at the very end
        if (state.colors.length < 15) {
            const addEnd = document.createElement('div');
            addEnd.className = 'add-between last'; // Reuse class with tweak if needed
            addEnd.title = 'Add color at the end';
            addEnd.addEventListener('click', () => {
                state.colors.push(state.colors[state.colors.length - 1] || '#ffffff');
                updatePalette(state.colors.length - 1);
            });
            colorPalette.appendChild(addEnd);
        }
    }

    // Event Listeners
    window.addEventListener('resize', initCanvas);
    window.addEventListener('mousemove', (e) => {
        state.mouse.x = e.clientX;
        state.mouse.y = e.clientY;
    });

    noiseLevelInput.addEventListener('input', (e) => {
        state.noiseLevel = parseFloat(e.target.value);
        noiseLevelVal.innerText = state.noiseLevel.toFixed(3);
    });

    speedInput.addEventListener('input', (e) => {
        state.speed = parseFloat(e.target.value);
        speedVal.innerText = state.speed.toFixed(1) + 'x';
    });

    fontSizeInput.addEventListener('input', (e) => {
        state.fontSize = parseInt(e.target.value);
        fontSizeVal.innerText = state.fontSize + 'px';
        initCanvas();
    });

    bgColorPicker.addEventListener('input', (e) => {
        state.bgColor = e.target.value;
        bgColorContainer.style.backgroundColor = state.bgColor;
    });

    cursorCheckbox.addEventListener('change', (e) => {
        state.cursorEffect = e.target.checked;
    });

    noiseButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            noiseButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.noiseAlgorithm = btn.dataset.noise;
        });
    });

    randomizeBtn.addEventListener('click', () => {
        state.noiseLevel = 0.01 + Math.random() * 0.05;
        noiseLevelInput.value = state.noiseLevel;
        noiseLevelVal.innerText = state.noiseLevel.toFixed(3);

        state.speed = 0.5 + Math.random() * 2.5;
        speedInput.value = state.speed;
        speedVal.innerText = state.speed.toFixed(1) + 'x';

        bgColorPicker.value = state.bgColor;
        bgColorContainer.style.backgroundColor = state.bgColor;

        // Harmonic Color Randomization
        const count = 5 + Math.floor(Math.random() * 4); // 5 to 8 colors
        const mother1 = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
        const mother2 = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
        const mother3 = Math.random() > 0.5 ? `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}` : null;

        state.colors = [];
        for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            if (mother3 && t > 0.5) {
                // Lerp between mother2 and mother3
                state.colors.push(lerpColor(mother2, mother3, (t - 0.5) * 2));
            } else if (mother3) {
                // Lerp between mother1 and mother2
                state.colors.push(lerpColor(mother1, mother2, t * 2));
            } else {
                // Simple lerp 1 to 2
                state.colors.push(lerpColor(mother1, mother2, t));
            }
        }
        updatePalette();
    });

    // --- Export Logic ---
    exportBtn.addEventListener('click', () => {
        const timestamp = new Date().getTime();
        const exportHtml = `<!DOCTYPE html>
<html>
<head>
    <title>ASCII Background Export</title>
    <style>
        body { margin: 0; background: ${state.bgColor}; overflow: hidden; }
        canvas { display: block; }
    </style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        const canvas = document.getElementById('c');
        const ctx = canvas.getContext('2d', { alpha: false });
        let w, h, cols, rows, frame = 0;
        const settings = ${JSON.stringify({
            noiseAlgorithm: state.noiseAlgorithm,
            noiseLevel: state.noiseLevel,
            speed: state.speed,
            fontSize: state.fontSize,
            colors: state.colors,
            bgColor: state.bgColor,
            cursorEffect: state.cursorEffect,
            charSet: state.charSet
        })};

        let charGrid = [];

        function init() {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
            cols = Math.ceil(w / (settings.fontSize * 0.6));
            rows = Math.ceil(h / settings.fontSize);

            charGrid = [];
            for (let r = 0; r < rows; r++) {
                let row = [];
                for (let c = 0; c < cols; c++) {
                    row.push(settings.charSet[Math.floor(Math.random() * settings.charSet.length)]);
                }
                charGrid.push(row);
            }
        }

        const p = new Uint8Array(512);
        const perm = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,121,123,82,58,183,128,157,235,192,207,215,66,129,50,210,138,242,126,253,34,70,223,61,93,222,176,189,206,81,107,31,43,153,5,67,112,180,98,243,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,121,123,82,58,183,128,157,235,192,207,215,66,129,50,210,138,242,126,253,34,70,223,61,93,222,176,189,206,81,107,31,43,153,5,67,112,180,98,243];
        for(let i=0; i<256; i++) p[256+i] = p[i] = perm[i];
        function f(t){return t*t*t*(t*(t*6-15)+10);}
        function l(t,a,b){return a+t*(b-a);}
        function g(h,x,y,z){const i=h&15,u=i<8?x:y,v=i<4?y:i==12||i==14?x:z;return((i&1)==0?u:-u)+((i&2)==0?v:-v);}
        function perlin(x,y,z){const X=Math.floor(x)&255,Y=Math.floor(y)&255,Z=Math.floor(z)&255;x-=Math.floor(x);y-=Math.floor(y);z-=Math.floor(z);const u=f(x),v=f(y),w=f(z),A=p[X]+Y,AA=p[A]+Z,AB=p[A+1]+Z,B=p[X+1]+Y,BA=p[B]+Z,BB=p[B+1]+Z;return l(w,l(v,l(u,g(p[AA],x,y,z),g(p[BA],x-1,y,z)),l(u,g(p[AB],x,y-1,z),g(p[BB],x-1,y-1,z))),l(v,l(u,g(p[AA+1],x,y,z-1),g(p[BA+1],x-1,y,z-1)),l(u,g(p[AB+1],x,y-1,z-1),g(p[BB+1],x-1,y-1,z-1))));}
        function voronoi(x,y,z){const xi=Math.floor(x),yi=Math.floor(y);let m=1.0;for(let j=-1;j<=1;j++){for(let i=-1;i<=1;i++){const cx=xi+i,cy=yi+j;const h=((Math.sin(cx*12.9898+cy*78.233)%1+1)*43758.5453123)%1;const px=cx+Math.cos(z+h*6.28)*0.5+0.5,py=cy+Math.sin(z+h*6.28)*0.5+0.5;const d=Math.sqrt((px-x)**2+(py-y)**2);if(d<m)m=d;}}return m*2-1;}
        
        const mouse = {x:-1000, y:-1000};
        window.onmousemove = e => {mouse.x=e.clientX; mouse.y=e.clientY;};

        function draw() {
            ctx.fillStyle = settings.bgColor;
            ctx.fillRect(0,0,w,h);
            ctx.font = settings.fontSize + 'px monospace';
            const cw = settings.fontSize * 0.6;
            const zOff = frame * 0.005 * settings.speed;

            for(let r=0; r<rows; r++) {
                for(let c=0; c<cols; c++) {
                    const x = c*cw, y = r*settings.fontSize;
                    let n = 0;
                    if(settings.noiseAlgorithm === 'perlin') n = perlin(c*settings.noiseLevel, r*settings.noiseLevel, zOff);
                    else if(settings.noiseAlgorithm === 'voronoi') n = voronoi(c*settings.noiseLevel*5, r*settings.noiseLevel*5, zOff * 2.0);
                    else if(settings.noiseAlgorithm === 'random') {
                        if (Math.random() < 0.1 * settings.speed) n = Math.random() * 2 - 1;
                        else n = ((Math.sin(c * 12.9898 + r * 78.233) * 43758.5453123) % 1) * 2 - 1;
                    }
                    
                    if(settings.cursorEffect) {
                        const d = Math.sqrt((x-mouse.x)**2 + (y-(mouse.y-settings.fontSize/2))**2);
                        if(d<150) n += (1-d/150)*0.8;
                    }

                    const norm = (n+1)/2;
                    let ci = Math.floor(norm * settings.colors.length);
                    ci = Math.max(0, Math.min(ci, settings.colors.length-1));
                    ctx.fillStyle = settings.colors[ci];

                    if (Math.random() < 0.05 * settings.speed) {
                        charGrid[r][c] = settings.charSet[Math.floor(Math.random() * settings.charSet.length)];
                    }

                    ctx.fillText(charGrid[r][c], x, y);
                }
            }
            frame++;
            requestAnimationFrame(draw);
        }
        window.onresize = init;
        init();
        draw();
    <\/script>
</body>
</html>`;

        const blob = new Blob([exportHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ascii-background-${timestamp}.html`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // --- Init ---
    initCanvas();
    updatePalette();
    render();
});
