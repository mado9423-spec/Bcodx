const COLORS = ['#6d4aff', '#00b8a9', '#f5b50a', '#ff6b5b', '#3b82f6', '#ec4899', '#12b76a'];

/** احتفال خفيف عند إنجاز عملية (طلب/تحصيل). يُحترم تفضيل تقليل الحركة. */
export function fireConfetti(count = 46) {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const host = document.createElement('div');
  host.className = 'confetti';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);
  const w = window.innerWidth;
  const h = window.innerHeight;
  let done = 0;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('i');
    el.style.background = COLORS[i % COLORS.length]!;
    el.style.insetInlineStart = '50%';
    el.style.top = `${h * 0.55}px`;
    host.appendChild(el);
    const angle = (Math.random() - 0.5) * Math.PI * 0.95;
    const speed = 260 + Math.random() * 380;
    const dx = Math.sin(angle) * speed * (w < 700 ? 0.6 : 1);
    const dy = -Math.cos(angle) * speed;
    const rot = (Math.random() - 0.5) * 900;
    const anim = el.animate(
      [
        { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${rot / 2}deg) scale(1)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx * 1.25}px, ${dy + h * 0.7}px) rotate(${rot}deg) scale(0.8)`, opacity: 0 },
      ],
      { duration: 1300 + Math.random() * 700, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' },
    );
    anim.onfinish = () => {
      if (++done === count) host.remove();
    };
  }
  setTimeout(() => host.remove(), 2800);
}
