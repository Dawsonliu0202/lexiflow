const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const svgCode = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <!-- Background Gradient: Indigo to Deep Midnight Blue -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4F46E5" />
      <stop offset="45%" stop-color="#3B4CCA" />
      <stop offset="100%" stop-color="#1E1B4B" />
    </linearGradient>

    <!-- Glowing Amber Sparkle Gradient -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FEF08A" />
      <stop offset="50%" stop-color="#FACC15" />
      <stop offset="100%" stop-color="#EAB308" />
    </linearGradient>

    <!-- Page Soft Gradient -->
    <linearGradient id="pageGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#E0E7FF" />
    </linearGradient>

    <!-- Drop Shadow Filter for depth -->
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" flood-color="#0F172A" flood-opacity="0.32" />
    </filter>
  </defs>

  <!-- Rounded Squircle Base -->
  <rect x="4" y="4" width="120" height="120" rx="28" fill="url(#bgGrad)" />
  
  <!-- Subtle Inner Top Highlight -->
  <rect x="4.5" y="4.5" width="119" height="119" rx="27.5" fill="none" stroke="#818CF8" stroke-width="1.2" stroke-opacity="0.45" />

  <!-- Main Visual Group -->
  <g filter="url(#shadow)">
    <!-- Left Page Wing (Gentle open curvature) -->
    <path d="M26 77 C26 57, 43 53, 61 56 L61 88 C45 85, 31 88, 26 92 Z" fill="url(#pageGrad)" />

    <!-- Right Page Wing -->
    <path d="M102 77 C102 57, 85 53, 67 56 L67 88 C83 85, 97 88, 102 92 Z" fill="url(#pageGrad)" />

    <!-- Center Spine Spine Accent -->
    <path d="M61 56 C63 55, 65 55, 67 56 L67 88 C65 87, 63 87, 61 88 Z" fill="#C7D2FE" />

    <!-- Elegant Stylized Text Lines on Left Page -->
    <line x1="35" y1="67" x2="52" y2="67" stroke="#6366F1" stroke-width="2.5" stroke-linecap="round" opacity="0.75" />
    <line x1="35" y1="75" x2="47" y2="75" stroke="#6366F1" stroke-width="2.5" stroke-linecap="round" opacity="0.75" />

    <!-- Elegant Stylized Text Lines on Right Page -->
    <line x1="76" y1="67" x2="93" y2="67" stroke="#6366F1" stroke-width="2.5" stroke-linecap="round" opacity="0.75" />
    <line x1="76" y1="75" x2="88" y2="75" stroke="#6366F1" stroke-width="2.5" stroke-linecap="round" opacity="0.75" />

    <!-- Central AI Comprehension Sparkle Star (✦) -->
    <path d="M64 22 Q64 35 75 37 Q64 39 64 52 Q64 39 53 37 Q64 35 64 22 Z" fill="url(#goldGrad)" />

    <!-- Secondary Accompanying Small Sparkle (✦) -->
    <path d="M84 21 Q84 26 88 27 Q84 28 84 33 Q84 28 80 27 Q84 26 84 21 Z" fill="#FEF08A" opacity="0.95" />
  </g>
</svg>
`;

const outputDir = path.join(__dirname, '..', 'public', 'icon');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write SVG source
fs.writeFileSync(path.join(outputDir, 'icon.svg'), svgCode.trim());

const sizes = [16, 32, 48, 128];
sizes.forEach((size) => {
  const resvg = new Resvg(svgCode, {
    fitTo: { mode: 'width', value: size },
  });
  const pngBuffer = resvg.render().asPng();
  const filePath = path.join(outputDir, `${size}.png`);
  fs.writeFileSync(filePath, pngBuffer);
  console.log(`Generated ${size}x${size} icon -> ${filePath} (${pngBuffer.length} bytes)`);
});
console.log('All icons generated successfully!');
