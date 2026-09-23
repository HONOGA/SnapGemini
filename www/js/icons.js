/**
 * SnapGemini - Dynamic Icon & Vector Asset Generator
 */

(function generateAppIcons() {
  function drawIcon(canvas, size) {
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, size, size);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size, size);

    // Glowing Aperture Ring
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.35;

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    const ringGrad = ctx.createLinearGradient(0, 0, size, size);
    ringGrad.addColorStop(0, '#3b82f6');
    ringGrad.addColorStop(0.5, '#8b5cf6');
    ringGrad.addColorStop(1, '#ec4899');
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = size * 0.08;
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = size * 0.12;
    ctx.stroke();
    ctx.restore();

    // Central Sparkle (Star)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#60a5fa';
    ctx.shadowBlur = size * 0.08;

    ctx.beginPath();
    const starSize = size * 0.18;
    for (let i = 0; i < 4; i++) {
      ctx.lineTo(0, -starSize);
      ctx.quadraticCurveTo(0, 0, starSize * 0.3, 0);
      ctx.rotate(Math.PI / 2);
    }
    ctx.fill();
    ctx.restore();
  }

  // Generate Favicon SVG Data URI if needed
  window.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) {
      lucide.createIcons();
    }
  });
})();
