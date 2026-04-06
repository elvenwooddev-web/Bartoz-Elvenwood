/* ============================================
   ELVENWOOD INTERIORS — Main Script
   GSAP + ScrollTrigger + Lenis Smooth Scroll
   Multi-page support
   ============================================ */

function createNoopTween() {
  return {
    to: () => createNoopTween(),
    fromTo: () => createNoopTween(),
    set: () => createNoopTween(),
    add: () => createNoopTween(),
  };
}

function createGsapFallback() {
  return {
    registerPlugin: () => { },
    timeline: () => createNoopTween(),
    to: () => createNoopTween(),
    fromTo: () => createNoopTween(),
    set: () => createNoopTween(),
    ticker: {
      add: () => { },
      lagSmoothing: () => { },
    },
    globalTimeline: {
      timeScale: () => { },
    },
  };
}

const hasRealGsap = typeof window.gsap !== 'undefined';
const hasRealScrollTrigger = typeof window.ScrollTrigger !== 'undefined';
const hasRealLenis = typeof window.Lenis !== 'undefined';

const gsap = window.gsap || createGsapFallback();
const ScrollTrigger = window.ScrollTrigger || {
  create: () => ({ kill: () => { } }),
  update: () => { },
  refresh: () => { },
};
const Draggable = window.Draggable;
const LenisCtor = window.Lenis;

if (!hasRealGsap || !hasRealScrollTrigger || !hasRealLenis) {
  console.warn('[animations] One or more animation libraries failed to load. Falling back to safe no-op mode.');
}

// Register GSAP plugins when available
if (hasRealGsap && hasRealScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  // Prevent ScrollTrigger from auto-refreshing on every new trigger creation
  // We'll call refresh() once after all triggers are set up (reduces forced reflows)
  ScrollTrigger.config({ autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load,resize' });
  // Apply will-change only during scroll-triggered animations (not permanently)
  ScrollTrigger.defaults({
    onToggle: self => {
      const targets = self.animation?.targets?.() || [];
      targets.forEach(el => {
        if (el instanceof HTMLElement) {
          el.style.willChange = self.isActive ? 'transform, opacity' : '';
        }
      });
    }
  });
  if (typeof Draggable !== 'undefined') {
    gsap.registerPlugin(Draggable);
  }
}

// Detect current page
const isHome = location.pathname.endsWith('index.html') || location.pathname.endsWith('/');
const isServices = location.pathname.endsWith('services.html');
const isWork = location.pathname.endsWith('work.html');
const isAbout = location.pathname.endsWith('about.html');

// Check for reduced motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ============================================
// 1. LENIS SMOOTH SCROLL
// ============================================
let lenis;

// Disable Lenis on small screens (mobile phones) but keep it on touch-capable desktops/hybrids
const isMobilePhone = window.innerWidth < 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

if (!prefersReducedMotion && hasRealLenis && !isMobilePhone) {
  lenis = new LenisCtor({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    wheelMultiplier: 1,
  });

  // If Lenis isn't smooth (e.g. pointer:fine check failed), destroy it
  // entirely — otherwise it still intercepts wheel events with preventDefault()
  // while not providing smooth scrolling, completely blocking native scroll
  if (!lenis.isSmooth) {
    lenis.destroy();
    document.documentElement.classList.remove('lenis', 'lenis-smooth', 'lenis-scrolling');
    lenis = {
      on: () => {},
      scrollTo: (target) => {
        if (typeof target === 'number') window.scrollTo({ top: target, behavior: 'auto' });
        else if (target instanceof Element) target.scrollIntoView({ behavior: 'auto' });
      },
      raf: () => {},
    };
    // ScrollTrigger still needs scroll events — use native scroll listener
    window.addEventListener('scroll', () => ScrollTrigger.update(), { passive: true });
  } else {
    // Connect Lenis to GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);
  }
} else {
  // Create a mock lenis object for reduced motion
  lenis = {
    on: () => { },
    scrollTo: (target, options) => {
      if (typeof target === 'number') {
        window.scrollTo({ top: target, behavior: 'auto' });
      } else if (target instanceof Element) {
        target.scrollIntoView({ behavior: 'auto' });
      }
    },
    raf: () => { },
  };
  // Speed up all GSAP animations for reduced motion users
  if (hasRealGsap) {
    gsap.globalTimeline.timeScale(10);
  }
}

// ============================================
// 2. PRELOADER (only on home page)
// ============================================
function initPreloader() {
  const preloader = document.getElementById('preloader');
  if (!preloader) {
    // Not home page — go straight to animations
    initPageAnimations();
    return;
  }

  // Preloader is now handled by inline CSS animation + inline JS timeout
  // (doesn't wait for GSAP, so it doesn't block LCP)
  // Just hook into when it finishes to start page animations
  if (preloader.style.display === 'none') {
    // Already hidden by inline JS
    initPageAnimations();
    return;
  }

  // Wait for inline JS to hide it, then init animations
  const observer = new MutationObserver(() => {
    if (preloader.style.display === 'none') {
      observer.disconnect();
      initPageAnimations();
    }
  });
  observer.observe(preloader, { attributes: true, attributeFilter: ['style'] });

  // Fallback: if preloader somehow sticks around for >2s, force-remove and init
  setTimeout(() => {
    observer.disconnect();
    if (preloader.style.display !== 'none') {
      preloader.style.display = 'none';
      document.body.classList.remove('is-loading');
    }
    initPageAnimations();
  }, 2000);
}

// ============================================
// 3. CUSTOM CURSOR (Position tracking only)
// ============================================
function initCursor() {
  const cursor = document.getElementById('cursor');
  if (!cursor || window.innerWidth < 768 || prefersReducedMotion || 'ontouchstart' in window) return;

  let mouseX = 0, mouseY = 0;
  let cursorX = 0, cursorY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function animateCursor() {
    const speed = 0.15;
    cursorX += (mouseX - cursorX) * speed;
    cursorY += (mouseY - cursorY) * speed;

    cursor.style.left = cursorX + 'px';
    cursor.style.top = cursorY + 'px';

    requestAnimationFrame(animateCursor);
  }
  animateCursor();
  // Note: Hover effects handled by initEnhancedCursor()
}

// ============================================
// 4. PAGE ANIMATIONS (hub for all pages)
// ============================================
function initPageAnimations() {
  if (isHome) {
    initHeroAnimations();
  } else {
    // For non-home pages, animate the top hero section
    initGenericHeroAnimations();
  }
  // Initialize scroll animations for all pages (called once here to avoid duplication)
  initScrollAnimations();
}

// ============================================
// 5. HERO ANIMATIONS (Home page)
// ============================================
function initHeroAnimations() {
  const header = document.getElementById('header');
  const heroWords = document.querySelectorAll('.section--hero .word');
  const heroImage = document.querySelector('.hero-image-preview');
  const heroMeta = document.querySelector('.hero-meta');
  const scrollBtn = document.getElementById('scrollBtn');

  // Create master timeline for coordinated entrance
  const masterTl = gsap.timeline();

  // 1. Header animation sequence
  if (header) {
    const headerLogo = header.querySelector('.header-logo');
    const headerTitle = header.querySelector('.header-title');
    const headerSocial = header.querySelector('.header-social');

    masterTl.fromTo(header,
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
    );

    if (headerLogo) {
      masterTl.fromTo(headerLogo,
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out' },
        '-=0.3'
      );
    }

    if (headerTitle) {
      masterTl.fromTo(headerTitle,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: 'power2.out' },
        '-=0.3'
      );
    }

    if (headerSocial) {
      masterTl.fromTo(headerSocial,
        { opacity: 0, x: 20 },
        { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out' },
        '-=0.3'
      );
    }
  }

  // 2. Hero words staggered reveal
  masterTl.to(heroWords, {
    opacity: 1,
    y: 0,
    duration: 1,
    stagger: 0.06,
    ease: 'power3.out',
  }, '-=0.2');

  // 3. Hero image with clip-path reveal
  if (heroImage) {
    masterTl.fromTo(heroImage,
      { opacity: 0, y: 60, clipPath: 'inset(100% 0 0 0)' },
      { opacity: 1, y: 0, clipPath: 'inset(0% 0 0 0)', duration: 1.2, ease: 'power3.out' },
      '-=0.8'
    );
  }

  // 4. Hero meta info
  if (heroMeta) {
    masterTl.fromTo(heroMeta,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 1, ease: 'power3.out' },
      '-=0.6'
    );
  }

  // 5. Scroll button with bounce
  if (scrollBtn) {
    masterTl.fromTo(scrollBtn,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'back.out(1.7)' },
      '-=0.4'
    );
  }

  // Hero parallax handled by initScrubbedParallax() to avoid conflicts
  // Note: initScrollAnimations() is called by initPageAnimations() - don't call here to avoid duplicate registration
}

// ============================================
// 5B. GENERIC HERO ANIMATIONS (other pages)
// ============================================
function initGenericHeroAnimations() {
  const header = document.getElementById('header');
  const heroSection = document.querySelector('.section--services-hero, .section--work-hero, .section--about-hero');
  const scrollBtn = document.getElementById('scrollBtn');

  const masterTl = gsap.timeline();

  // 1. Header animation
  if (header) {
    const headerLogo = header.querySelector('.header-logo');
    const headerTitle = header.querySelector('.header-title');
    const headerSocial = header.querySelector('.header-social');

    masterTl.fromTo(header,
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
    );

    if (headerLogo) {
      masterTl.fromTo(headerLogo,
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out' },
        '-=0.3'
      );
    }

    if (headerTitle) {
      masterTl.fromTo(headerTitle,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: 'power2.out' },
        '-=0.3'
      );
    }

    if (headerSocial) {
      masterTl.fromTo(headerSocial,
        { opacity: 0, x: 20 },
        { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out' },
        '-=0.3'
      );
    }
  }

  // 2. Hero content animation - REMOVED
  // Instead of waiting for GSAP, the homepage hero title loads instantly for better UX
  // See styles.css: .hero-headline .word { opacity: 1; transform: none; }

  // 3. Scroll button
  if (scrollBtn) {
    masterTl.fromTo(scrollBtn,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'back.out(1.7)' },
      '-=0.4'
    );
  }
}

// ============================================
// 6. SCROLL-TRIGGERED ANIMATIONS
// ============================================
function initScrollAnimations() {
  // Skip complex animations if reduced motion is preferred
  if (prefersReducedMotion) {
    // Just show everything immediately
    document.querySelectorAll('.word, .project-card, .service-item, .service-card, .about-bio, .footer-top, .footer-bottom, .see-more, .image-reveal img').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return;
  }
  // --- Stagger text reveals (.word) ---
  const staggers = [
    '.see-more-headline', '.about-statement', '.footer-headline',
    '.offer-statement', '.types-statement',
    '.about-hero-headline', '.about-philosophy-headline',
    '.services-hero-headline', '.work-hero-headline',
    '.promises-statement', '.render-reality-statement', '.education-statement',
    '.ec-invitation-headline', '.faq-statement', '.team-journey-statement', '.leadership-statement',
    '.ec-hero-headline', '.ec-visit-headline', '.work-cta-headline'
  ];

  staggers.forEach(selector => {
    const group = document.querySelector(selector);
    if (!group) return;
    const words = group.querySelectorAll('.word');
    if (!words.length) return;

    gsap.to(words, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      stagger: 0.04,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: group,
        start: 'top 80%',
        end: 'bottom 60%',
        toggleActions: 'play none none none',
      }
    });
  });

  // --- Testimonial quotes: GSAP word stagger removed for simplicity ---
  // --- Project cards with stagger (improved) ---
  const projectCards = document.querySelectorAll('.project-card');
  if (projectCards.length) {
    gsap.to(projectCards, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      stagger: {
        amount: 0.4,
        from: 'start'
      },
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '.work-grid',
        start: 'top 80%',
        toggleActions: 'play none none none',
      }
    });
  }

  // --- Project grid cards with stagger ---
  const gridCards = document.querySelectorAll('.project-grid-card');
  if (gridCards.length) {
    gsap.fromTo(gridCards,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger: {
          amount: 0.6,
          from: 'start'
        },
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.project-grid',
          start: 'top 80%',
          toggleActions: 'play none none none',
        }
      }
    );
  }

  // --- Project images: no parallax scrub (removed for performance) ---

  // --- See More section fade in ---
  if (document.querySelector('.see-more')) {
    gsap.to('.see-more', {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.see-more',
        start: 'top 80%',
        toggleActions: 'play none none none',
      }
    });
  }

  // --- About marquee scroll ---
  const marqueeInner = document.querySelector('.about-marquee-inner');
  if (marqueeInner) {
    gsap.to(marqueeInner, {
      xPercent: -50,
      ease: 'none',
      scrollTrigger: {
        trigger: '.about-marquee',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1,
      }
    });
  }

  // --- About bio fade in ---
  if (document.querySelector('.about-bio')) {
    gsap.to('.about-bio', {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.about-bio',
        start: 'top 80%',
        toggleActions: 'play none none none',
      }
    });
  }

  // --- Service items fade in ---
  document.querySelectorAll('.service-item').forEach((item) => {
    gsap.to(item, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: item,
        start: 'top 85%',
        toggleActions: 'play none none none',
      }
    });
  });

  // --- Service cards: Card-on-card stacking animation ---
  const serviceCards = document.querySelectorAll('.service-card');
  if (serviceCards.length) {
    // First, make all cards visible (override the opacity:0 initial state)
    serviceCards.forEach(card => {
      gsap.set(card, { opacity: 1, y: 0 });
    });

    // Animate each card except the last one:
    // As you scroll past it, it scales down and dims slightly,
    // creating the illusion of being pushed back into a stack.
    // Use the NEXT card as the trigger so the animation only begins
    // when the next card starts entering, not while reading this card.
    serviceCards.forEach((card, i) => {
      if (i < serviceCards.length - 1) {
        if (window.innerWidth > 768) {
          const nextCard = serviceCards[i + 1];
          gsap.to(card, {
            scale: 0.95,
            opacity: 0.6,
            ease: 'power1.in',
            scrollTrigger: {
              trigger: nextCard,
              start: 'top bottom',
              end: 'top 120px',
              scrub: 0.3,
            }
          });
        } else {
          // On mobile, simple fade-up reveal
          gsap.fromTo(card,
            { opacity: 0, y: 30 },
            {
              opacity: 1, y: 0, duration: 0.6, ease: 'power2.out',
              scrollTrigger: {
                trigger: card,
                start: 'top 85%',
                toggleActions: 'play none none none'
              }
            }
          );
        }
      } else if (window.innerWidth <= 768) {
        gsap.fromTo(card,
          { opacity: 0, y: 30 },
          {
            opacity: 1, y: 0, duration: 0.6, ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 85%',
              toggleActions: 'play none none none'
            }
          }
        );
      }
    });
  }

  // --- Testimonial animation handled by initScrubbedParallax() for horizontal slide effect ---

  // --- Service extras fade in ---
  document.querySelectorAll('.service-extra-item').forEach((item) => {
    gsap.to(item, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: item,
        start: 'top 85%',
        toggleActions: 'play none none none',
      }
    });
  });

  // Image reveals handled by initClipPathReveals() — no duplicate here

  // --- Footer sections ---
  if (document.querySelector('.footer-bottom')) {
    gsap.to('.footer-bottom', {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.footer-bottom',
        start: 'top 85%',
        toggleActions: 'play none none none',
      }
    });
  }

  // --- Watermark text reveal ---
  if (document.querySelector('.watermark-text')) {
    gsap.fromTo('.watermark-text',
      { yPercent: 30, opacity: 0 },
      {
        yPercent: 15,
        opacity: 1,
        duration: 1.2,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.footer-watermark',
          start: 'top 90%',
          toggleActions: 'play none none none',
        }
      }
    );
  }

  // --- About page: Philosophy body fade in ---
  if (document.querySelector('.about-philosophy-body')) {
    gsap.fromTo('.about-philosophy-body',
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.about-philosophy-body',
          start: 'top 80%',
          toggleActions: 'play none none none',
        }
      }
    );
  }

  // --- About page: Principle cards staggered reveal ---
  const principleCards = document.querySelectorAll('.about-principle-card');
  if (principleCards.length) {
    principleCards.forEach(card => {
      gsap.fromTo(card,
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 85%',
            toggleActions: 'play none none none',
          }
        }
      );
    });
  }

  // --- About page: Team hub nodes staggered reveal ---
  document.querySelectorAll('.about-team-hub').forEach(hub => {
    const nodes = hub.querySelectorAll('.about-hub-node');
    if (!nodes.length) return;

    // Center node first, then others
    const centerNode = hub.querySelector('.about-hub-node--center');
    const outerNodes = hub.querySelectorAll('.about-hub-node:not(.about-hub-node--center)');

    if (centerNode) {
      gsap.fromTo(centerNode,
        { opacity: 0, scale: 0.8 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.8,
          ease: 'back.out(1.4)',
          scrollTrigger: {
            trigger: hub,
            start: 'top 80%',
            toggleActions: 'play none none none',
          }
        }
      );
    }

    if (outerNodes.length) {
      gsap.fromTo(outerNodes,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: hub,
            start: 'top 75%',
            toggleActions: 'play none none none',
          }
        }
      );
    }
  });

  // --- About page: Founder's note fade in ---
  if (document.querySelector('.about-note-content')) {
    gsap.fromTo('.about-note-content',
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.about-note-content',
          start: 'top 80%',
          toggleActions: 'play none none none',
        }
      }
    );
  }

  // --- Background color transitions ---
  initBackgroundTransitions();

  // --- Brand element animations ---
  initBrandElementAnimations();
}

// ============================================
// 6B. BRAND ELEMENT ANIMATIONS
// ============================================
function initBrandElementAnimations() {
  // Footer watermark reveal on scroll
  const watermarkLogo = document.querySelector('.footer-watermark-logo');
  const footer = document.querySelector('.section--footer');

  if (watermarkLogo && footer) {
    ScrollTrigger.create({
      trigger: footer,
      start: 'top 80%',
      onEnter: () => {
        watermarkLogo.classList.add('revealed');
      },
      onLeaveBack: () => {
        watermarkLogo.classList.remove('revealed');
      }
    });
  }

  // Door artifact parallax on scroll
  const doorArtifacts = document.querySelectorAll('.door-artifact--hero');
  doorArtifacts.forEach(artifact => {
    gsap.to(artifact, {
      yPercent: 15,
      ease: 'none',
      scrollTrigger: {
        trigger: artifact.closest('.section'),
        start: 'top top',
        end: 'bottom top',
        scrub: 1,
      }
    });
  });

  // Note: Line artifact animations handled by initLineArtifactAnimations()

  // Section divider logo animation
  const dividerIcons = document.querySelectorAll('.section-divider-icon');
  dividerIcons.forEach(icon => {
    gsap.fromTo(icon,
      { scale: 0.8, opacity: 0, rotation: -10 },
      {
        scale: 1,
        opacity: 0.6,
        rotation: 0,
        duration: 0.8,
        ease: 'back.out(1.7)',
        scrollTrigger: {
          trigger: icon,
          start: 'top 85%',
          toggleActions: 'play none none reverse'
        }
      }
    );
  });
}

// ============================================
// 7. BACKGROUND COLOR TRANSITIONS
// ============================================
function initBackgroundTransitions() {
  const header = document.getElementById('header');
  const floatingNav = document.getElementById('floatingNav');
  const scrollBtn = document.getElementById('scrollBtn');

  function setLightMode() {
    if (!header) return;
    header.classList.add('header--light');
    header.style.color = 'var(--color-text-dark)';
    document.querySelectorAll('.header-inner').forEach(el => {
      el.style.borderBottomColor = 'var(--color-border-light)';
    });
    if (floatingNav) {
      floatingNav.classList.add('nav--light');
      floatingNav.classList.remove('nav--dark');
      floatingNav.style.background = '';
      floatingNav.style.borderColor = '';
      document.querySelectorAll('.floating-nav-link').forEach(link => {
        link.style.color = '';
      });
    }
    if (scrollBtn) {
      scrollBtn.style.borderColor = 'var(--color-border-light)';
      scrollBtn.style.color = 'var(--color-text-dark)';
      scrollBtn.style.background = 'rgba(245, 245, 245, 0.5)';
    }
  }

  function setDarkMode() {
    if (!header) return;
    header.classList.remove('header--light');
    header.style.color = 'var(--color-lime)';
    document.querySelectorAll('.header-inner').forEach(el => {
      el.style.borderBottomColor = 'var(--color-border-dark)';
    });
    if (floatingNav) {
      floatingNav.classList.add('nav--dark');
      floatingNav.classList.remove('nav--light');
      floatingNav.style.background = '';
      floatingNav.style.borderColor = '';
      document.querySelectorAll('.floating-nav-link').forEach(link => {
        link.style.color = '';
      });
    }
    if (scrollBtn) {
      scrollBtn.style.borderColor = 'var(--color-border-dark)';
      scrollBtn.style.color = 'var(--color-lime)';
      scrollBtn.style.background = 'rgba(132, 62, 64, 0.5)';
    }
  }

  // Find all light-bg sections and create ScrollTriggers for them
  const lightSections = document.querySelectorAll('.about-content, .section--offer, .section--about-philosophy, .section--about-principles, .section--about-note');
  lightSections.forEach(section => {
    ScrollTrigger.create({
      trigger: section,
      start: 'top 80px',
      end: 'bottom 80px',
      onEnter: setLightMode,
      onLeave: setDarkMode,
      onEnterBack: setLightMode,
      onLeaveBack: setDarkMode,
    });
  });
}

// ============================================
// 8. MAGNETIC BUTTONS (Enhanced)
// ============================================
function initMagneticButtons() {
  const magneticBtns = document.querySelectorAll('.magnetic-btn');
  if (window.innerWidth < 768) return;

  magneticBtns.forEach(btn => {
    // Add magnetic range detection
    const magneticRange = 100; // pixels around button that activates effect

    let cachedRect = null;
    btn.addEventListener('mouseenter', () => {
      cachedRect = btn.getBoundingClientRect(); // Cache rect once on enter
      gsap.to(btn, {
        scale: 1.05,
        duration: 0.3,
        ease: 'power2.out',
      });
    });

    btn.addEventListener('mousemove', (e) => {
      if (!cachedRect) return;
      const x = e.clientX - cachedRect.left - cachedRect.width / 2;
      const y = e.clientY - cachedRect.top - cachedRect.height / 2;

      // Calculate distance from center for scale effect
      const distance = Math.sqrt(x * x + y * y);
      const maxDistance = Math.max(cachedRect.width, cachedRect.height) / 2;
      const scaleBoost = 1.05 + (0.03 * (1 - Math.min(distance / maxDistance, 1)));

      gsap.to(btn, {
        x: x * 0.4,
        y: y * 0.4,
        scale: scaleBoost,
        duration: 0.3,
        ease: 'power2.out',
      });
    });

    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, {
        x: 0,
        y: 0,
        scale: 1,
        duration: 0.6,
        ease: 'elastic.out(1, 0.3)',
      });
    });
  });
}

// ============================================
// 9. FLOATING NAVIGATION (multi-page links)
// ============================================
function initFloatingNav() {
  // Nav links already point to separate pages (index.html, services.html, etc.)
  // No click override needed — they navigate naturally

  // Nav active state is set by the HTML based on current page
  // No scroll-based switching needed — these are page links, not section anchors

  // Header logo goes to home page
  document.querySelector('.header-logo')?.addEventListener('click', (e) => {
    if (isHome) {
      e.preventDefault();
      lenis.scrollTo(0, { duration: 1.5 });
    }
    // else: follows the href naturally
  });
}

function setActiveNav(activeId, navLinks) {
  // Map section IDs to nav data-section values
  // Sections below 'services' should keep SERVICES highlighted
  const sectionToNav = {
    'home': 'home',
    'work': 'work',
    'about': 'about',
    'services': 'services',
    'types': 'services',
    'testimonials': 'services',
    'process': 'services',
    'contact': 'services',
  };

  const navSection = sectionToNav[activeId] || activeId;

  navLinks.forEach(link => {
    link.classList.remove('active');
    link.removeAttribute('aria-current');
    if (link.dataset.section === navSection) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });
}

// ============================================
// 9B. CONTEXT-AWARE HEADER & SCROLL-BASED NAV
// ============================================
function initContextAwareHeader() {
  const header = document.getElementById('header');
  const floatingNav = document.getElementById('floatingNav');
  if (!header) return;

  const shouldLockLightHeader = !isHome;
  if (shouldLockLightHeader) {
    header.classList.add('header--light');
    header.classList.remove('header--dark');
  }

  let lastScrollY = 0;
  let scrollThreshold = 150; // Min scroll before hide/show triggers
  let isNavHidden = false;

  // Combined scroll handler for performance
  ScrollTrigger.create({
    start: 'top top',
    end: 99999,
    onUpdate: (self) => {
      const currentScrollY = window.scrollY;
      const scrollingDown = self.direction === 1;
      const isMobileViewport = window.innerWidth <= 768;

      // Scrolled state for header
      if (scrollingDown && currentScrollY > 80) {
        header.classList.add('header--scrolled');
      } else if (currentScrollY <= 80) {
        header.classList.remove('header--scrolled');
      }

      // Hide/show navigation based on scroll direction
      // Only trigger after scrolling past threshold and with significant movement
      if (isMobileViewport) {
        header.classList.remove('header--hidden');
        if (floatingNav) floatingNav.classList.remove('nav--hidden');
        isNavHidden = false;
        lastScrollY = currentScrollY;
        return;
      }

      if (currentScrollY > scrollThreshold) {
        const scrollDelta = Math.abs(currentScrollY - lastScrollY);

        if (scrollDelta > 10) { // Minimum movement to trigger
          if (scrollingDown && !isNavHidden) {
            // Scrolling down - hide nav
            header.classList.add('header--hidden');
            if (floatingNav) floatingNav.classList.add('nav--hidden');
            isNavHidden = true;
          } else if (!scrollingDown && isNavHidden) {
            // Scrolling up - show nav
            header.classList.remove('header--hidden');
            if (floatingNav) floatingNav.classList.remove('nav--hidden');
            isNavHidden = false;
          }
        }
      } else {
        // At top of page - always show nav
        header.classList.remove('header--hidden');
        if (floatingNav) floatingNav.classList.remove('nav--hidden');
        isNavHidden = false;
      }

      lastScrollY = currentScrollY;
    }
  });

  // Track dark sections for color switching
  if (shouldLockLightHeader) {
    return;
  }

  const darkSections = document.querySelectorAll('.bg-dark, .section--dark, .section--footer, .section--testimonials');
  const firstSection = document.querySelector('section');

  darkSections.forEach(section => {
    const isFirstSection = section === firstSection;

    ScrollTrigger.create({
      trigger: section,
      start: 'top top+=100',
      end: 'bottom top+=100',
      onEnter: () => {
        header.classList.add('header--dark');
        if (floatingNav) { floatingNav.classList.add('nav--dark'); floatingNav.classList.remove('nav--light'); }
      },
      onLeave: () => {
        header.classList.remove('header--dark');
        if (floatingNav) { floatingNav.classList.remove('nav--dark'); floatingNav.classList.add('nav--light'); }
      },
      onEnterBack: () => {
        header.classList.add('header--dark');
        if (floatingNav) { floatingNav.classList.add('nav--dark'); floatingNav.classList.remove('nav--light'); }
      },
      onLeaveBack: () => {
        if (!isFirstSection) {
          header.classList.remove('header--dark');
          if (floatingNav) { floatingNav.classList.remove('nav--dark'); floatingNav.classList.add('nav--light'); }
        }
      }
    });
  });
}

// ============================================
// 10. SCROLL DIRECTION BUTTON
// ============================================
function initScrollButton() {
  const scrollBtn = document.getElementById('scrollBtn');
  if (!scrollBtn) return;

  let isAtTop = true;

  lenis.on('scroll', ({ scroll }) => {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = scroll / docHeight;

    if (scrollPercent > 0.1 && isAtTop) {
      isAtTop = false;
      scrollBtn.classList.add('scrolled');
    } else if (scrollPercent <= 0.1 && !isAtTop) {
      isAtTop = true;
      scrollBtn.classList.remove('scrolled');
    }
  });

  scrollBtn.addEventListener('click', () => {
    if (isAtTop) {
      // Scroll down to next section
      const firstSection = document.querySelector('.section:nth-of-type(2)');
      if (firstSection) {
        lenis.scrollTo(firstSection, { duration: 1.5 });
      }
    } else {
      lenis.scrollTo(0, { duration: 1.5 });
    }
  });
}

// ============================================
// 11. SERVICES STICKY IMAGE SWAP
// ============================================
function initServicesImageSwap() {
  const stickyImg = document.querySelector('.services-sticky-image img');
  if (!stickyImg) return;

  const images = [
    'images/interior_hero.png',
    'images/interior_kitchen.png',
    'images/interior_bedroom.png',
    'images/interior_bathroom.png',
    'images/interior_office.png',
  ];

  document.querySelectorAll('.service-item').forEach((item, i) => {
    ScrollTrigger.create({
      trigger: item,
      start: 'top center',
      onEnter: () => {
        gsap.to(stickyImg, {
          opacity: 0,
          duration: 0.3,
          onComplete: () => {
            stickyImg.src = images[i] || images[0];
            gsap.to(stickyImg, { opacity: 1, duration: 0.3 });
          }
        });
      },
      onEnterBack: () => {
        gsap.to(stickyImg, {
          opacity: 0,
          duration: 0.3,
          onComplete: () => {
            stickyImg.src = images[i] || images[0];
            gsap.to(stickyImg, { opacity: 1, duration: 0.3 });
          }
        });
      },
    });
  });
}

// ============================================
// 12. DRAGGABLE CAROUSELS
// ============================================
function initDraggableCarousels() {
  // Interior types carousel
  initDraggableTrack('#typesTrack', '.types-arrow--prev', '.types-arrow--next', '.types-counter-current');

  // Work gallery carousel
  initDraggableTrack('#workTrack', null, null, null);
}

function initDraggableTrack(trackSelector, prevBtnSelector, nextBtnSelector, counterSelector) {
  const track = document.querySelector(trackSelector);
  if (!track) return;

  const slides = track.children;
  if (!slides.length) return;

  const slideWidth = slides[0].offsetWidth + 24; // width + gap
  const maxScroll = -(track.scrollWidth - track.parentElement.offsetWidth);
  let currentOffset = 0;
  let currentIndex = 0;

  // Momentum/inertia tracking
  let isDragging = false;
  let startX = 0;
  let dragStartOffset = 0;
  let velocity = 0;
  let lastX = 0;
  let lastTime = 0;
  let velocityHistory = [];
  const VELOCITY_SAMPLES = 5;
  const FRICTION = 0.92;
  const MIN_VELOCITY = 0.5;
  let momentumFrame = null;

  function trackVelocity(currentX) {
    const now = Date.now();
    const dt = now - lastTime;
    if (dt > 0) {
      const instantVelocity = (currentX - lastX) / dt * 16; // normalize to ~60fps
      velocityHistory.push(instantVelocity);
      if (velocityHistory.length > VELOCITY_SAMPLES) {
        velocityHistory.shift();
      }
    }
    lastX = currentX;
    lastTime = now;
  }

  function getAverageVelocity() {
    if (velocityHistory.length === 0) return 0;
    const sum = velocityHistory.reduce((a, b) => a + b, 0);
    return sum / velocityHistory.length;
  }

  function applyMomentum() {
    if (Math.abs(velocity) < MIN_VELOCITY) {
      // Snap to nearest slide when momentum ends
      snapToNearestSlide();
      return;
    }

    currentOffset += velocity;
    currentOffset = Math.max(maxScroll, Math.min(0, currentOffset));

    // Apply rubber-band effect at edges
    if (currentOffset >= 0 || currentOffset <= maxScroll) {
      velocity *= 0.5; // Stronger friction at edges
    } else {
      velocity *= FRICTION;
    }

    gsap.set(track, { x: currentOffset });
    momentumFrame = requestAnimationFrame(applyMomentum);
  }

  function snapToNearestSlide() {
    if (momentumFrame) {
      cancelAnimationFrame(momentumFrame);
      momentumFrame = null;
    }
    currentIndex = Math.round(Math.abs(currentOffset) / slideWidth);
    currentOffset = -(currentIndex * slideWidth);
    currentOffset = Math.max(maxScroll, Math.min(0, currentOffset));
    gsap.to(track, {
      x: currentOffset,
      duration: 0.5,
      ease: 'power3.out'
    });
    updateCounter();
  }

  function stopMomentum() {
    if (momentumFrame) {
      cancelAnimationFrame(momentumFrame);
      momentumFrame = null;
    }
    velocity = 0;
    velocityHistory = [];
  }

  // Named handlers for proper cleanup
  function handleMouseMove(e) {
    if (!isDragging) return;
    trackVelocity(e.clientX);
    const delta = e.clientX - startX;
    currentOffset = Math.max(maxScroll, Math.min(0, dragStartOffset + delta));
    gsap.set(track, { x: currentOffset });
  }

  function handleMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    track.parentElement.style.cursor = 'grab';

    velocity = getAverageVelocity();

    // Apply momentum if velocity is significant
    if (Math.abs(velocity) > MIN_VELOCITY * 2) {
      applyMomentum();
    } else {
      snapToNearestSlide();
    }
  }

  // Cleanup function to remove listeners and cancel animations
  function cleanup() {
    stopMomentum();
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }

  // Prevent native image drag from stealing events
  track.querySelectorAll('img').forEach(img => {
    img.setAttribute('draggable', 'false');
  });
  track.parentElement.style.userSelect = 'none';
  track.parentElement.style.cursor = 'grab';

  // Mouse drag
  track.parentElement.addEventListener('mousedown', (e) => {
    e.preventDefault(); // prevent native drag
    stopMomentum();
    isDragging = true;
    startX = e.clientX;
    lastX = e.clientX;
    lastTime = Date.now();
    dragStartOffset = currentOffset;
    velocityHistory = [];
    track.parentElement.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // Cleanup on page unload to prevent memory leaks
  window.addEventListener('pagehide', cleanup);

  // Stop momentum when tab becomes hidden (saves CPU/battery)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopMomentum();
    }
  });

  // Touch support with momentum
  track.parentElement.addEventListener('touchstart', (e) => {
    stopMomentum();
    isDragging = true;
    startX = e.touches[0].clientX;
    lastX = e.touches[0].clientX;
    lastTime = Date.now();
    dragStartOffset = currentOffset;
    velocityHistory = [];
  }, { passive: true });

  let touchMoveRafPending = false;
  track.parentElement.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const touchX = e.touches[0].clientX;
    trackVelocity(touchX);
    const delta = touchX - startX;
    currentOffset = Math.max(maxScroll, Math.min(0, dragStartOffset + delta));
    // Throttle DOM updates to one per animation frame (reduces INP)
    if (!touchMoveRafPending) {
      touchMoveRafPending = true;
      requestAnimationFrame(() => {
        gsap.set(track, { x: currentOffset });
        touchMoveRafPending = false;
      });
    }
  }, { passive: true });

  track.parentElement.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;

    velocity = getAverageVelocity();

    if (Math.abs(velocity) > MIN_VELOCITY * 2) {
      applyMomentum();
    } else {
      snapToNearestSlide();
    }
  });

  // Arrow buttons with smooth animation
  if (prevBtnSelector) {
    const prevBtn = document.querySelector(prevBtnSelector);
    prevBtn?.addEventListener('click', () => {
      stopMomentum();
      currentIndex = Math.max(0, currentIndex - 1);
      currentOffset = -(currentIndex * slideWidth);
      gsap.to(track, {
        x: currentOffset,
        duration: 0.6,
        ease: 'power3.out'
      });
      updateCounter();
    });
  }

  if (nextBtnSelector) {
    const nextBtn = document.querySelector(nextBtnSelector);
    nextBtn?.addEventListener('click', () => {
      stopMomentum();
      currentIndex = Math.min(slides.length - 1, currentIndex + 1);
      currentOffset = -(currentIndex * slideWidth);
      currentOffset = Math.max(maxScroll, currentOffset);
      gsap.to(track, {
        x: currentOffset,
        duration: 0.6,
        ease: 'power3.out'
      });
      updateCounter();
    });
  }

  // Wheel-to-horizontal-scroll: intercept vertical scroll over carousel
  track.parentElement.addEventListener('wheel', (e) => {
    // Only intercept if there's room to scroll in the wheel direction
    const atStart = currentOffset >= 0;
    const atEnd = currentOffset <= maxScroll;
    const scrollingRight = e.deltaY > 0;
    const scrollingLeft = e.deltaY < 0;

    // Let page scroll if we've hit the carousel boundary
    if ((atEnd && scrollingRight) || (atStart && scrollingLeft)) return;

    e.preventDefault();
    stopMomentum();

    const scrollAmount = e.deltaY * 1.5;
    currentOffset -= scrollAmount;
    currentOffset = Math.max(maxScroll, Math.min(0, currentOffset));

    gsap.to(track, {
      x: currentOffset,
      duration: 0.4,
      ease: 'power2.out',
      onComplete: () => {
        currentIndex = Math.round(Math.abs(currentOffset) / slideWidth);
        updateCounter();
      }
    });
  }, { passive: false });

  function updateCounter() {
    if (!counterSelector) return;
    const counter = document.querySelector(counterSelector);
    if (counter) {
      counter.textContent = String(currentIndex + 1).padStart(2, '0');
    }
  }
}

// ============================================
// 13. SCROLL PROGRESS INDICATOR
// ============================================
function initScrollProgress() {
  const progress = document.getElementById('scrollProgress');
  if (!progress || prefersReducedMotion) return;

  // Use native scroll event for more accurate tracking
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const percent = scrollTop / docHeight;
    progress.style.transform = `scaleX(${percent})`;
  }, { passive: true });
}

// ============================================
// 14. COUNTER ANIMATIONS
// ============================================
function initCounterAnimations() {
  if (prefersReducedMotion) return;

  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count, 10);
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';

    gsap.fromTo(el,
      { innerText: 0 },
      {
        innerText: target,
        duration: 2,
        snap: { innerText: 1 },
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
        onUpdate: function () {
          el.innerText = prefix + Math.round(this.targets()[0].innerText) + suffix;
        }
      }
    );
  });
}

// ============================================
// 15. PROMISE CARDS STAGGER
// ============================================
function initPromiseCards() {
  if (prefersReducedMotion) return;

  const cards = document.querySelectorAll('.promise-card');
  if (!cards.length) return;

  gsap.fromTo(cards,
    { opacity: 0, y: 30 },
    {
      opacity: 1,
      y: 0,
      duration: 0.6,
      stagger: {
        amount: 0.4,
        from: 'start'
      },
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '.promises-grid',
        start: 'top 80%',
        toggleActions: 'play none none none',
      }
    }
  );
}

// ============================================
// 16. COMPARISON ITEMS ANIMATION
// ============================================
function initComparisonAnimations() {
  if (prefersReducedMotion) return;

  const items = document.querySelectorAll('.comparison-item');
  if (!items.length) return;

  gsap.fromTo(items,
    { opacity: 0, y: 40 },
    {
      opacity: 1,
      y: 0,
      duration: 0.8,
      stagger: 0.2,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '.render-reality-comparisons',
        start: 'top 80%',
        toggleActions: 'play none none none',
      }
    }
  );
}

// ============================================
// 17. EDUCATION ARTICLES ANIMATION
// ============================================
function initEducationAnimations() {
  if (prefersReducedMotion) return;

  const articles = document.querySelectorAll('.education-article');
  if (!articles.length) return;

  gsap.fromTo(articles,
    { opacity: 0, x: -20 },
    {
      opacity: 1,
      x: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '.education-articles',
        start: 'top 80%',
        toggleActions: 'play none none none',
      }
    }
  );
}

// ============================================
// 18. FAQ ITEMS ANIMATION
// ============================================
function initFAQAnimations() {
  if (prefersReducedMotion) return;

  const items = document.querySelectorAll('.faq-item');
  if (!items.length) return;

  gsap.fromTo(items,
    { opacity: 0, x: -20 },
    {
      opacity: 1,
      x: 0,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '.faq-list',
        start: 'top 80%',
        toggleActions: 'play none none none',
      }
    }
  );
}

// ============================================
// 19. TEAM JOURNEY ANIMATION
// ============================================
function initTeamJourneyAnimations() {
  if (prefersReducedMotion) return;

  const steps = document.querySelectorAll('.journey-step');
  if (!steps.length) return;

  gsap.fromTo(steps,
    { opacity: 0, y: 30 },
    {
      opacity: 1,
      y: 0,
      duration: 0.6,
      stagger: 0.15,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '.team-journey-grid',
        start: 'top 80%',
        toggleActions: 'play none none none',
      }
    }
  );
}

// ============================================
// 20. LEADERSHIP CARDS ANIMATION
// ============================================
function initLeadershipAnimations() {
  if (prefersReducedMotion) return;

  const cards = document.querySelectorAll('.leader-card');
  if (!cards.length) return;

  gsap.fromTo(cards,
    { opacity: 0, scale: 0.9 },
    {
      opacity: 1,
      scale: 1,
      duration: 0.5,
      stagger: 0.08,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '.leadership-grid',
        start: 'top 80%',
        toggleActions: 'play none none none',
      }
    }
  );
}

// ============================================
// 21. TRUST STRIP ANIMATION
// ============================================
function initTrustStripAnimation() {
  if (prefersReducedMotion) return;

  const items = document.querySelectorAll('.trust-item');
  if (!items.length) return;

  gsap.fromTo(items,
    { opacity: 0, x: -20 },
    {
      opacity: 1,
      x: 0,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '.section--trust-strip',
        start: 'top 90%',
        toggleActions: 'play none none none',
      }
    }
  );
}

// ============================================
// 22. CLIENT STORY ANIMATION
// ============================================
function initClientStoryAnimation() {
  if (prefersReducedMotion) return;

  const stats = document.querySelectorAll('.stat-item');
  if (stats.length) {
    gsap.fromTo(stats,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.client-story-stats',
          start: 'top 85%',
          toggleActions: 'play none none none',
        }
      }
    );
  }

  const thumbs = document.querySelectorAll('.client-story-thumb');
  if (thumbs.length) {
    gsap.fromTo(thumbs,
      { opacity: 0, scale: 0.9 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.4,
        stagger: 0.08,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.client-story-thumbnails',
          start: 'top 85%',
          toggleActions: 'play none none none',
        }
      }
    );
  }
}

// ============================================
// 23. FEATURED PROJECT ANIMATION
// ============================================
function initFeaturedProjectAnimation() {
  if (prefersReducedMotion) return;

  const stats = document.querySelectorAll('.featured-stat');
  if (stats.length) {
    gsap.fromTo(stats,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.featured-project-stats',
          start: 'top 85%',
          toggleActions: 'play none none none',
        }
      }
    );
  }

  const thumbs = document.querySelectorAll('.featured-thumb');
  if (thumbs.length) {
    gsap.fromTo(thumbs,
      { opacity: 0, scale: 0.9 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.4,
        stagger: 0.08,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.featured-project-thumbs',
          start: 'top 85%',
          toggleActions: 'play none none none',
        }
      }
    );
  }
}

// ============================================
// 24. LINE ARTIFACT DRAW ANIMATIONS
// ============================================
function initLineArtifactAnimations() {
  if (prefersReducedMotion) return;

  const lineArtifacts = document.querySelectorAll('.line-artifact');
  if (!lineArtifacts.length) return;

  lineArtifacts.forEach(artifact => {
    // Get all paths in the SVG (if it's an inline SVG or has paths)
    const paths = artifact.querySelectorAll('path, line, polyline');

    if (paths.length) {
      paths.forEach(path => {
        // Calculate path length for stroke animation
        const length = path.getTotalLength ? path.getTotalLength() : 1000;

        // Set initial state
        gsap.set(path, {
          strokeDasharray: length,
          strokeDashoffset: length,
        });

        // Animate on scroll
        gsap.to(path, {
          strokeDashoffset: 0,
          duration: 1.5,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: artifact,
            start: 'top 85%',
            toggleActions: 'play none none none',
          }
        });
      });
    }

    // Also animate opacity and position for img-based artifacts
    gsap.fromTo(artifact,
      { opacity: 0, x: 20, y: -20 },
      {
        opacity: 0.2,
        x: 0,
        y: 0,
        duration: 1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: artifact,
          start: 'top 85%',
          toggleActions: 'play none none none',
        }
      }
    );
  });
}

// ============================================
// 25. CLIP-PATH IMAGE REVEALS
// ============================================
function initClipPathReveals() {
  if (prefersReducedMotion) return;

  const revealImages = document.querySelectorAll('.image-reveal');

  revealImages.forEach(container => {
    const img = container.querySelector('img');
    if (!img) return;

    // Simple fade — no clip-path or scale to avoid scroll jank
    gsap.fromTo(img,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: container,
          start: 'top 85%',
          toggleActions: 'play none none none',
        }
      }
    );
  });
}

// ============================================
// SCRUBBED SCROLL PARALLAX SYSTEM
// ============================================
/*
 * Creates continuous, scrubbed animations that move WITH scroll
 * This is the KEY difference from triggered animations
 * Reference: bartoszkolenda.com
 */
function initScrubbedParallax() {
  if (prefersReducedMotion) return;

  // ===== HERO PARALLAX - REMOVED FOR PERFORMANCE =====
  // Scrub animations on hero images/artifacts/content removed to eliminate scroll jank

  // ===== FEATURED SECTIONS - SIMPLE FADE IN (no scrub) =====
  document.querySelectorAll('.featured-project-inner, .client-story-images').forEach(el => {
    gsap.fromTo(el,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none',
        }
      }
    );
  });

  // Project-grid card position animation is intentionally handled in initScrollAnimations()
  // to avoid conflicting y transforms from two animation systems.

  // ===== TESTIMONIALS - SIMPLE FADE IN =====
  // Testimonials: no GSAP animation — clean static display

  // ===== STAT COUNTERS & FOOTER - REMOVED SCRUB FOR PERFORMANCE =====
  // Simple triggered fade instead
  document.querySelectorAll('.featured-stat, .stat').forEach(stat => {
    gsap.fromTo(stat,
      { opacity: 0, y: 15 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: stat,
          start: 'top 85%',
          toggleActions: 'play none none none',
        }
      }
    );
  });
}

// ============================================
// DATA-DRIVEN ANIMATION SYSTEM
// ============================================
/*
 * Usage in HTML:
 * <div data-animate="fade-up" data-delay="0.2" data-duration="0.8">Content</div>
 * <div data-animate="fade-in" data-stagger="0.1" data-stagger-children=".item">Children</div>
 * <div data-animate="scale-in" data-trigger=".parent-section">Triggered by parent</div>
 *
 * Available animations:
 * - fade-up, fade-down, fade-left, fade-right
 * - fade-in
 * - scale-in, scale-up
 * - clip-up, clip-down, clip-left, clip-right
 * - blur-in
 * - words (for text with .word spans)
 */
function initDataDrivenAnimations() {
  if (prefersReducedMotion) {
    // Show everything immediately for reduced motion
    document.querySelectorAll('[data-animate]').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.filter = 'none';
      el.style.clipPath = 'none';
    });
    return;
  }

  const animatedElements = document.querySelectorAll('[data-animate]');

  // Animation presets
  const animations = {
    'fade-up': {
      from: { opacity: 0, y: 40 },
      to: { opacity: 1, y: 0 }
    },
    'fade-down': {
      from: { opacity: 0, y: -40 },
      to: { opacity: 1, y: 0 }
    },
    'fade-left': {
      from: { opacity: 0, x: 40 },
      to: { opacity: 1, x: 0 }
    },
    'fade-right': {
      from: { opacity: 0, x: -40 },
      to: { opacity: 1, x: 0 }
    },
    'fade-in': {
      from: { opacity: 0 },
      to: { opacity: 1 }
    },
    'scale-in': {
      from: { opacity: 0, scale: 0.9 },
      to: { opacity: 1, scale: 1 }
    },
    'scale-up': {
      from: { opacity: 0, scale: 0.8, y: 20 },
      to: { opacity: 1, scale: 1, y: 0 }
    },
    'clip-up': {
      from: { clipPath: 'inset(100% 0 0 0)' },
      to: { clipPath: 'inset(0% 0 0 0)' }
    },
    'clip-down': {
      from: { clipPath: 'inset(0 0 100% 0)' },
      to: { clipPath: 'inset(0% 0 0 0)' }
    },
    'clip-left': {
      from: { clipPath: 'inset(0 100% 0 0)' },
      to: { clipPath: 'inset(0 0% 0 0)' }
    },
    'clip-right': {
      from: { clipPath: 'inset(0 0 0 100%)' },
      to: { clipPath: 'inset(0 0 0 0%)' }
    },
    'blur-in': {
      from: { opacity: 0, filter: 'blur(10px)' },
      to: { opacity: 1, filter: 'blur(0px)' }
    },
    'words': {
      from: { opacity: 0, y: 20 },
      to: { opacity: 1, y: 0 },
      isWordAnimation: true
    }
  };

  animatedElements.forEach(element => {
    const animationType = element.dataset.animate;
    const animation = animations[animationType];

    if (!animation) return;

    // Parse options from data attributes
    const delay = parseFloat(element.dataset.delay) || 0;
    const duration = parseFloat(element.dataset.duration) || 0.8;
    const ease = element.dataset.ease || 'power2.out';
    const stagger = parseFloat(element.dataset.stagger) || 0;
    const staggerChildren = element.dataset.staggerChildren;
    const triggerSelector = element.dataset.trigger;
    const start = element.dataset.start || 'top 80%';

    // Determine trigger element
    const trigger = triggerSelector
      ? document.querySelector(triggerSelector) || element
      : element;

    // Handle word animations
    if (animation.isWordAnimation) {
      const words = element.querySelectorAll('.word');
      if (words.length) {
        gsap.fromTo(words,
          animation.from,
          {
            ...animation.to,
            duration,
            delay,
            stagger: stagger || 0.04,
            ease,
            scrollTrigger: {
              trigger,
              start,
              toggleActions: 'play none none none',
            }
          }
        );
      }
      return;
    }

    // Handle staggered children
    if (staggerChildren) {
      const children = element.querySelectorAll(staggerChildren);
      if (children.length) {
        gsap.fromTo(children,
          animation.from,
          {
            ...animation.to,
            duration,
            delay,
            stagger: stagger || 0.1,
            ease,
            scrollTrigger: {
              trigger,
              start,
              toggleActions: 'play none none none',
            }
          }
        );
      }
      return;
    }

    // Standard single element animation
    gsap.fromTo(element,
      animation.from,
      {
        ...animation.to,
        duration,
        delay,
        ease,
        scrollTrigger: {
          trigger,
          start,
          toggleActions: 'play none none none',
        }
      }
    );
  });
}

// ============================================
// BLUR-UP IMAGE LOADING
// ============================================
function initBlurUpImages() {
  const blurUpContainers = document.querySelectorAll('.blur-up');

  if (!blurUpContainers.length) return;

  const scheduleScrollTriggerRefresh = (() => {
    let rafId = null;
    return () => {
      if (typeof ScrollTrigger === 'undefined' || typeof ScrollTrigger.refresh !== 'function') return;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        ScrollTrigger.refresh();
      });
    };
  })();

  const observerOptions = {
    root: null,
    rootMargin: '50px',
    threshold: 0.1
  };

  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const container = entry.target;
        const img = container.querySelector('img');

        if (img) {
          // If image has data-src, swap it
          if (img.dataset.src) {
            img.src = img.dataset.src;
          }

          // Handle load event
          if (img.complete) {
            container.classList.add('loaded');
            scheduleScrollTriggerRefresh();
          } else {
            img.addEventListener('load', () => {
              container.classList.add('loaded');
              scheduleScrollTriggerRefresh();
            }, { once: true });
          }
        }

        observer.unobserve(container);
      }
    });
  }, observerOptions);

  blurUpContainers.forEach(container => {
    imageObserver.observe(container);
  });

  // Also handle regular lazy images
  const lazyImages = document.querySelectorAll('.lazy-image');

  const lazyObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;

        if (img.dataset.src) {
          img.src = img.dataset.src;
        }

        img.addEventListener('load', () => {
          img.classList.add('loaded');
          scheduleScrollTriggerRefresh();
        }, { once: true });

        observer.unobserve(img);
      }
    });
  }, observerOptions);

  lazyImages.forEach(img => {
    lazyObserver.observe(img);
  });
}

// ============================================
// ENHANCED CURSOR SYSTEM (like reference)
// ============================================
function initEnhancedCursor() {
  const cursor = document.getElementById('cursor');
  if (!cursor || window.innerWidth < 768 || prefersReducedMotion || 'ontouchstart' in window) return;

  const cursorLabel = cursor.querySelector('.cursor-label');
  let rotation = 0;
  let lastX = 0;
  let lastY = 0;

  // Track mouse velocity for rotation (throttled via rAF)
  let cursorRafPending = false;
  let pendingDeltaX = 0;
  document.addEventListener('mousemove', (e) => {
    pendingDeltaX = e.clientX - lastX;
    lastX = e.clientX;
    lastY = e.clientY;
    if (cursorRafPending) return;
    cursorRafPending = true;
    requestAnimationFrame(() => {
      const targetRotation = pendingDeltaX * 0.3;
      rotation += (targetRotation - rotation) * 0.1;
      cursor.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
      cursorRafPending = false;
    });
  });

  // Different cursor states based on element type
  const cursorStates = {
    view: { text: 'VIEW', scale: 1.8 },
    drag: { text: 'DRAG', scale: 1.5 },
    link: { text: '', scale: 0.6 },
    explore: { text: 'EXPLORE', scale: 2 },
    play: { text: 'PLAY', scale: 2 },
  };

  // Apply cursor state
  function setCursorState(state) {
    if (cursorStates[state]) {
      cursorLabel.textContent = cursorStates[state].text;
      cursor.style.setProperty('--cursor-scale', cursorStates[state].scale);
      cursor.classList.add('cursor--active');
      cursor.classList.add(`cursor--${state}`);
    }
  }

  function resetCursorState() {
    cursorLabel.textContent = 'VIEW';
    cursor.style.setProperty('--cursor-scale', 1);
    cursor.classList.remove('cursor--active', 'cursor--view', 'cursor--drag', 'cursor--link', 'cursor--explore', 'cursor--play');
  }

  // Project cards - VIEW
  document.querySelectorAll('.project-card, .project-grid-card, .featured-project-main, [data-cursor="view"]').forEach(el => {
    el.addEventListener('mouseenter', () => setCursorState('view'));
    el.addEventListener('mouseleave', resetCursorState);
  });

  // Carousels - DRAG
  document.querySelectorAll('.types-carousel, .work-track, [data-cursor="drag"]').forEach(el => {
    el.addEventListener('mouseenter', () => setCursorState('drag'));
    el.addEventListener('mouseleave', resetCursorState);
  });

  // Videos - PLAY
  document.querySelectorAll('video, [data-cursor="play"]').forEach(el => {
    el.addEventListener('mouseenter', () => setCursorState('play'));
    el.addEventListener('mouseleave', resetCursorState);
  });

  // Links and buttons - smaller cursor
  document.querySelectorAll('a:not([data-cursor]), button:not([data-cursor])').forEach(el => {
    el.addEventListener('mouseenter', () => {
      if (!cursor.classList.contains('cursor--active')) {
        cursor.classList.add('cursor--link');
      }
    });
    el.addEventListener('mouseleave', () => {
      cursor.classList.remove('cursor--link');
    });
  });

  // Hide cursor on scroll (optional, for polish)
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    cursor.classList.add('cursor--scrolling');
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      cursor.classList.remove('cursor--scrolling');
    }, 150);
  }, { passive: true });

  // Dark section detection - use light cursor on dark backgrounds
  const darkSections = document.querySelectorAll('.bg-dark, .section--testimonials, .section--brand-cta, .terracotta-block, .section--featured-project, [data-theme="dark"]');
  darkSections.forEach(section => {
    section.addEventListener('mouseenter', () => {
      cursor.classList.add('cursor--light');
    });
    section.addEventListener('mouseleave', () => {
      cursor.classList.remove('cursor--light');
    });
  });
}

// ============================================
// FACTORY VIDEO LOGIC
// ============================================
function initFactoryVideo() {
  const wrap = document.getElementById('factoryVideo');
  const video = document.getElementById('factoryVideoPlayer');
  const playBtn = document.getElementById('factoryPlayBtn');

  if (!wrap || !video || !playBtn) return;

  playBtn.addEventListener('click', () => {
    wrap.classList.add('is-playing');
    video.controls = true;
    video.play();
  });

  video.addEventListener('pause', () => {
    if (video.ended) {
      wrap.classList.remove('is-playing');
    }
  });

  video.addEventListener('ended', () => {
    wrap.classList.remove('is-playing');
    video.controls = false;
  });
}

// ============================================
// FACTORY SLIDER LOGIC (legacy)
// ============================================
function initFactorySlider() {
  const track = document.getElementById('factorySliderTrack');
  const prevBtn = document.getElementById('factoryPrevBtn');
  const nextBtn = document.getElementById('factoryNextBtn');
  const dots = document.querySelectorAll('.slider-dot');

  if (!track || !prevBtn || !nextBtn || dots.length === 0) return;

  let currentSlide = 0;
  const totalSlides = dots.length;

  function goToSlide(index) {
    currentSlide = index;
    track.style.transform = `translateX(-${currentSlide * 100}%)`;

    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentSlide);
    });
  }

  prevBtn.addEventListener('click', () => {
    let newIndex = currentSlide - 1;
    if (newIndex < 0) newIndex = totalSlides - 1;
    goToSlide(newIndex);
  });

  nextBtn.addEventListener('click', () => {
    let newIndex = currentSlide + 1;
    if (newIndex >= totalSlides) newIndex = 0;
    goToSlide(newIndex);
  });

  dots.forEach(dot => {
    dot.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      goToSlide(index);
    });
  });
}

// ============================================
// LIGHTBOX GALLERY
// ============================================
function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;

  const img = lightbox.querySelector('.lightbox-img');
  const counter = lightbox.querySelector('.lightbox-counter');
  const closeBtn = lightbox.querySelector('.lightbox-close');
  const prevBtn = lightbox.querySelector('.lightbox-prev');
  const nextBtn = lightbox.querySelector('.lightbox-next');
  const backdrop = lightbox.querySelector('.lightbox-backdrop');

  let images = [];
  let currentIndex = 0;

  function open(galleryId, startIndex) {
    const dataEl = document.getElementById(galleryId);
    if (!dataEl) return;

    images = Array.from(dataEl.querySelectorAll('img')).map(i => ({
      src: i.dataset.src,
      alt: i.alt
    }));

    currentIndex = startIndex || 0;
    show();
    lightbox.hidden = false;
    requestAnimationFrame(() => lightbox.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
  }

  function close() {
    lightbox.classList.remove('is-open');
    setTimeout(() => {
      lightbox.hidden = true;
      document.body.style.overflow = '';
    }, 300);
  }

  function show() {
    if (!images[currentIndex]) return;
    img.style.opacity = '0';
    img.src = images[currentIndex].src;
    img.alt = images[currentIndex].alt;
    img.onload = () => { img.style.opacity = '1'; };
    counter.textContent = `${currentIndex + 1} / ${images.length}`;
  }

  function next() {
    currentIndex = (currentIndex + 1) % images.length;
    show();
  }

  function prev() {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    show();
  }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  nextBtn.addEventListener('click', next);
  prevBtn.addEventListener('click', prev);

  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  });

  // Click handlers on gallery items
  document.querySelectorAll('[data-gallery]').forEach(el => {
    el.addEventListener('click', (e) => {
      const galleryName = el.dataset.gallery;
      const index = parseInt(el.dataset.galleryIndex || '0');
      // Map gallery name to element ID
      const idMap = { 'varun-home': 'galleryVarunHome' };
      const galleryId = idMap[galleryName];
      if (galleryId) open(galleryId, index);
    });
  });

  // Click handlers for data-lightbox cards (JSON array of image URLs)
  document.querySelectorAll('[data-lightbox]').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      try {
        const srcs = JSON.parse(card.dataset.lightbox);
        images = srcs.map(src => ({ src, alt: card.querySelector('h3')?.textContent || '' }));
        currentIndex = 0;
        show();
        lightbox.hidden = false;
        requestAnimationFrame(() => lightbox.classList.add('is-open'));
        document.body.style.overflow = 'hidden';
      } catch (e) { /* invalid JSON */ }
    });
  });
}

// ============================================
// INITIALIZE EVERYTHING
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Critical: above-fold + navigation (run immediately)
  initPreloader();
  initFloatingNav();
  initContextAwareHeader();
  initScrollButton();
  initScrollProgress();
  initBlurUpImages();
  initResponsiveImages();

  // Deferred: below-fold animations + interactions (yield to main thread first)
  const deferInit = typeof requestIdleCallback === 'function' ? requestIdleCallback : (fn) => setTimeout(fn, 1);
  deferInit(() => {
    initCursor();
    initMagneticButtons();
    initFactorySlider();
    initFactoryVideo();
    initLightbox();
    initDraggableCarousels();
    initCounterAnimations();
    initPromiseCards();
    initComparisonAnimations();
    initEducationAnimations();
    initFAQAnimations();
    initTeamJourneyAnimations();
    initLeadershipAnimations();
    initTrustStripAnimation();
    initClientStoryAnimation();
    initFeaturedProjectAnimation();
    initLineArtifactAnimations();
    initClipPathReveals();
    initDataDrivenAnimations();
    initScrubbedParallax();
    initEnhancedCursor();

    // Single ScrollTrigger refresh after all triggers are created (prevents forced reflows)
    if (hasRealScrollTrigger) {
      requestAnimationFrame(() => ScrollTrigger.refresh());
    }
  });
});

// ============================================
// RESPONSIVE IMAGE UTILITIES
// ============================================
/*
 * Utility for responsive images with srcset support.
 *
 * Usage in HTML:
 * <img
 *   data-srcset-base="images/photo"
 *   data-srcset-ext="jpg"
 *   data-srcset-sizes="400,800,1200,1600"
 *   data-sizes="(max-width: 768px) 100vw, 50vw"
 *   alt="Description"
 *   loading="lazy"
 * >
 *
 * This will generate:
 * srcset="images/photo-400.jpg 400w, images/photo-800.jpg 800w, ..."
 * sizes="(max-width: 768px) 100vw, 50vw"
 */
function initResponsiveImages() {
  const responsiveImages = document.querySelectorAll('[data-srcset-base]');

  responsiveImages.forEach(img => {
    const base = img.dataset.srcsetBase;
    const ext = img.dataset.srcsetExt || 'jpg';
    const sizesAttr = img.dataset.sizes || '100vw';
    const widths = (img.dataset.srcsetSizes || '400,800,1200').split(',').map(s => s.trim());

    // Generate srcset
    const srcset = widths
      .map(w => `${base}-${w}.${ext} ${w}w`)
      .join(', ');

    // Set default src to middle size
    const defaultWidth = widths[Math.floor(widths.length / 2)];
    const defaultSrc = `${base}-${defaultWidth}.${ext}`;

    // Apply attributes
    img.setAttribute('srcset', srcset);
    img.setAttribute('sizes', sizesAttr);

    // Only set src if not already set
    if (!img.src || img.src.includes('data:')) {
      img.src = defaultSrc;
    }
  });
}

// ============================================
// IMAGE PLACEHOLDER GENERATOR (for development)
// ============================================
/*
 * Generates inline SVG placeholders for images during development.
 * Useful before actual images are ready.
 *
 * Usage:
 * <img data-placeholder="800x600" data-placeholder-text="Hero Image" alt="...">
 */
function generatePlaceholders() {
  const placeholders = document.querySelectorAll('[data-placeholder]');

  placeholders.forEach(img => {
    const dims = img.dataset.placeholder.split('x');
    const width = dims[0] || 800;
    const height = dims[1] || 600;
    const text = img.dataset.placeholderText || `${width}×${height}`;
    const bgColor = img.dataset.placeholderBg || '#f5f0eb';
    const textColor = img.dataset.placeholderColor || '#93083233';

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect fill="${bgColor}" width="${width}" height="${height}"/>
        <text fill="${textColor}" font-family="Inter, sans-serif" font-size="${Math.min(width, height) / 10}"
              text-anchor="middle" dominant-baseline="middle" x="${width / 2}" y="${height / 2}">${text}</text>
      </svg>
    `.trim();

    const encoded = 'data:image/svg+xml,' + encodeURIComponent(svg);

    if (!img.src || img.src === window.location.href) {
      img.src = encoded;
    }
  });
}

// Run placeholder generator if in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  document.addEventListener('DOMContentLoaded', generatePlaceholders);
}

// ============================================
// Mobile Nav Toggle (Hamburger)
// ============================================
(function () {
  const navToggle = document.getElementById('navToggle');
  const floatingNav = document.getElementById('floatingNav');
  if (!navToggle || !floatingNav) return;

  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'nav-backdrop';
  document.body.appendChild(backdrop);

  // SVG line references (keep in DOM, morph with GSAP)
  const svgLines = navToggle.querySelectorAll('svg line');
  const links = floatingNav.querySelectorAll('.floating-nav-link');

  // Hamburger line positions (original)
  const HAMBURGER_ATTRS = [
    { x1: 4, y1: 7, x2: 20, y2: 7 },   // top
    { x1: 4, y1: 12, x2: 20, y2: 12 },  // middle
    { x1: 4, y1: 17, x2: 20, y2: 17 },  // bottom
  ];
  // X (close) line positions
  const CLOSE_ATTRS = [
    { x1: 6, y1: 6, x2: 18, y2: 18 },   // top → diagonal
    { x1: 12, y1: 12, x2: 12, y2: 12 },  // middle → collapsed (invisible)
    { x1: 6, y1: 18, x2: 18, y2: 6 },    // bottom → diagonal
  ];

  let isAnimating = false;
  let isOpen = false;

  // Scroll lock — class-based to avoid conflicts with lightbox/video overlays
  function lockScroll() {
    document.body.classList.add('nav-open');
    if (lenis && typeof lenis.stop === 'function') lenis.stop();
  }

  function unlockScroll() {
    document.body.classList.remove('nav-open');
    if (lenis && typeof lenis.start === 'function') lenis.start();
  }

  function openNav() {
    if (isAnimating || isOpen) return;
    isAnimating = true;
    isOpen = true;

    // Apply visual state immediately (allows browser to paint the overlay fast)
    floatingNav.classList.add('nav--open');
    backdrop.classList.add('nav-backdrop--visible');
    navToggle.setAttribute('aria-label', 'Close navigation menu');
    lockScroll();

    if (prefersReducedMotion || !hasRealGsap) {
      svgLines.forEach(function (line, i) { gsap.set(line, { attr: CLOSE_ATTRS[i] }); });
      gsap.set(links, { opacity: 1, y: 0 });
      isAnimating = false;
      return;
    }

    // Defer heavy GSAP timeline to next frame so the browser can paint first (reduces INP)
    requestAnimationFrame(function () {
      var tl = gsap.timeline({ onComplete: function () { isAnimating = false; } });

      // Morph hamburger → X
      svgLines.forEach(function (line, i) {
        tl.to(line, { attr: CLOSE_ATTRS[i], duration: 0.3, ease: 'power2.inOut' }, 0);
      });

      // Stagger links in
      tl.fromTo(links,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: 'power2.out' },
        0.1
      );
    });
  }

  function closeNav() {
    if (isAnimating || !isOpen) return;
    isAnimating = true;

    if (prefersReducedMotion || !hasRealGsap) {
      svgLines.forEach(function (line, i) { gsap.set(line, { attr: HAMBURGER_ATTRS[i] }); });
      gsap.set(links, { clearProps: 'all' });
      floatingNav.classList.remove('nav--open');
      backdrop.classList.remove('nav-backdrop--visible');
      navToggle.setAttribute('aria-label', 'Open navigation menu');
      unlockScroll();
      isOpen = false;
      isAnimating = false;
      return;
    }

    // Defer heavy GSAP timeline to next frame (reduces INP)
    requestAnimationFrame(function () {
      var tl = gsap.timeline({
        onComplete: function () {
          floatingNav.classList.remove('nav--open');
          backdrop.classList.remove('nav-backdrop--visible');
          navToggle.setAttribute('aria-label', 'Open navigation menu');
          unlockScroll();
          gsap.set(links, { clearProps: 'all' });
          isOpen = false;
          isAnimating = false;
        }
      });

      tl.to(links, {
        opacity: 0, y: -15, duration: 0.25, stagger: 0.03, ease: 'power2.in'
      }, 0);

      svgLines.forEach(function (line, i) {
        tl.to(line, { attr: HAMBURGER_ATTRS[i], duration: 0.3, ease: 'power2.inOut' }, 0.1);
      });
    });
  }

  // Toggle on click
  navToggle.addEventListener('click', function (e) {
    e.stopPropagation();
    isOpen ? closeNav() : openNav();
  });

  // Close on link click
  links.forEach(function (link) {
    link.addEventListener('click', closeNav);
  });

  // Close on backdrop tap
  backdrop.addEventListener('click', closeNav);

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closeNav();
  });

  // Swipe-down to close
  var touchStartY = 0;
  var touchStartX = 0;

  floatingNav.addEventListener('touchstart', function (e) {
    if (!isOpen) return;
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  floatingNav.addEventListener('touchend', function (e) {
    if (!isOpen) return;
    var deltaY = e.changedTouches[0].clientY - touchStartY;
    var deltaX = Math.abs(e.changedTouches[0].clientX - touchStartX);
    // Swipe down >80px and more vertical than horizontal
    if (deltaY > 80 && deltaY > deltaX) closeNav();
  }, { passive: true });
})();

// ============================================
// Experience Centre — Callback Form → WhatsApp + Supabase
// ============================================
(function () {
  const form = document.getElementById('ecVisitForm');
  if (!form) return;

  const EDGE_FN_URL = 'https://rtymxwthwwmbxkzgqqrc.supabase.co/functions/v1/send-callback-email';

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const name = document.getElementById('ec-name').value.trim();
    const email = document.getElementById('ec-email').value.trim();
    const phone = document.getElementById('ec-phone').value.trim();
    const looking = document.getElementById('ec-looking').value.trim();
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalHTML = submitBtn.innerHTML;

    // 1. Send to Supabase edge function (fire & forget — don't block WhatsApp)
    fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone: phone || null, looking_for: looking || null })
    }).catch(() => {}); // silent fail — WhatsApp is primary channel

    // 2. Open WhatsApp with pre-filled message
    let msg = `Hi Elvenwood! 👋\n\nI'd like a callback.\n\nName: ${name}\nEmail: ${email}`;
    if (phone) msg += `\nPhone: ${phone}`;
    if (looking) msg += `\nLooking for: ${looking}`;

    window.open(`https://wa.me/917483226449?text=${encodeURIComponent(msg)}`, '_blank');

    // 3. Show success feedback
    submitBtn.innerHTML = '<span>✓ WE\'LL CALL YOU BACK</span>';
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    form.reset();

    // Reset button after 5 seconds
    setTimeout(() => {
      submitBtn.innerHTML = originalHTML;
      submitBtn.disabled = false;
      submitBtn.style.opacity = '';
    }, 5000);
  });
})();

// ============================================
// Website Lead Form → Supabase + WhatsApp Redirect
// ============================================
(function () {
  const form = document.getElementById('leadForm');
  if (!form) return;

  const EDGE_FN_URL = 'https://rtymxwthwwmbxkzgqqrc.supabase.co/functions/v1/send-callback-email';

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var name = form.querySelector('[name="lead-name"]').value.trim();
    var phone = form.querySelector('[name="lead-phone"]').value.trim();
    var requirement = form.querySelector('[name="lead-requirement"]').value.trim();
    var submitBtn = form.querySelector('button[type="submit"]');
    var originalHTML = submitBtn.innerHTML;

    if (!name || !phone) return;

    // 1. Send to edge function → saves to DB + sends email to info@elvenwood.in
    fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        phone: phone,
        requirement: requirement || null,
        page_source: document.title
      })
    }).catch(function () {}); // silent fail — WhatsApp is primary

    // 2. Open WhatsApp with pre-filled message
    var msg = 'Hi Elvenwood! 👋\n\nI\'d like a free estimate.\n\nName: ' + name + '\nPhone: ' + phone;
    if (requirement) msg += '\nLooking for: ' + requirement;

    window.open('https://wa.me/917483226449?text=' + encodeURIComponent(msg), '_blank');

    // 3. Show success feedback
    submitBtn.innerHTML = '<span>✓ SENT — CHECK WHATSAPP</span>';
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    form.reset();

    setTimeout(function () {
      submitBtn.innerHTML = originalHTML;
      submitBtn.disabled = false;
      submitBtn.style.opacity = '';
    }, 5000);
  });
})();

// ============================================
// EC Video Hover-Play
// ============================================
// ============================================
// Project Video Card: hover-play + click lightbox
// ============================================
document.querySelectorAll('.project-video-card').forEach(card => {
  const hoverVideo = card.querySelector('.project-hover-video');
  const videoSrc = card.dataset.videoLightbox;
  if (!hoverVideo) return;

  // Hover play
  card.addEventListener('mouseenter', () => { hoverVideo.play().catch(() => {}); });
  card.addEventListener('mouseleave', () => { hoverVideo.pause(); hoverVideo.currentTime = 0; });

  // Touch toggle
  let touchPlaying = false;
  card.addEventListener('touchstart', () => {
    if (!touchPlaying) { hoverVideo.play().catch(() => {}); touchPlaying = true; }
    else { hoverVideo.pause(); hoverVideo.currentTime = 0; touchPlaying = false; }
  }, { passive: true });

  // Click: open video lightbox
  if (videoSrc) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return; // don't intercept links
      const vl = document.getElementById('videoLightbox');
      if (!vl) return;

      // Show lightbox shell immediately (fast paint), defer heavy video setup
      vl.hidden = false;
      document.body.style.overflow = 'hidden';

      requestAnimationFrame(() => {
        vl.classList.add('is-open');
        const player = vl.querySelector('.video-lightbox-player');
        player.src = videoSrc;
        player.play().catch(() => {});

        // Close handlers
        const closeBtn = vl.querySelector('.lightbox-close');
        const backdrop = vl.querySelector('.lightbox-backdrop');
        function closeVL() {
          vl.classList.remove('is-open');
          player.pause();
          setTimeout(() => { vl.hidden = true; player.src = ''; document.body.style.overflow = ''; }, 300);
        }
        closeBtn.onclick = closeVL;
        backdrop.onclick = closeVL;
        const escHandler = (ev) => { if (ev.key === 'Escape') { closeVL(); document.removeEventListener('keydown', escHandler); } };
        document.addEventListener('keydown', escHandler);
      });
    });
  }
});

// ============================================
// EC Video Hover-Play
// ============================================
document.querySelectorAll('.ec-video-item video').forEach(video => {
  const item = video.closest('.ec-video-item, .project-video-card');
  item.addEventListener('mouseenter', () => {
    video.play().catch(() => {});
  });
  item.addEventListener('mouseleave', () => {
    video.pause();
    video.currentTime = 0;
  });
  // Touch: tap to toggle
  item.addEventListener('touchstart', () => {
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, { passive: true });
});

// ============================================
// STICKY CTA BAR (Area + Pricing Pages)
// Shows after scrolling past hero section
// ============================================
(function() {
  var stickyBar = document.getElementById('stickyCta');
  if (!stickyBar) return;

  var showThreshold = 600; // pixels scrolled before showing
  var isVisible = false;
  var footer = document.querySelector('.section--footer');

  window.addEventListener('scroll', function() {
    var scrollY = window.scrollY;
    var shouldShow = scrollY > showThreshold;

    // Hide when near footer to avoid overlap
    if (footer) {
      var footerTop = footer.getBoundingClientRect().top;
      if (footerTop < window.innerHeight + 100) shouldShow = false;
    }

    if (shouldShow && !isVisible) {
      stickyBar.classList.add('is-visible');
      isVisible = true;
    } else if (!shouldShow && isVisible) {
      stickyBar.classList.remove('is-visible');
      isVisible = false;
    }
  }, { passive: true });
})();

// ============================================
// ANALYTICS EVENT TRACKING
// Pushes events to dataLayer for GTM → GA4
// ============================================
(function() {
  'use strict';

  // Helper: push event to dataLayer
  function trackEvent(eventName, params) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: eventName,
      ...params
    });
  }

  // Helper: get current page name from URL
  function getPageName() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    const names = {
      '/': 'homepage',
      '/services': 'services',
      '/work': 'portfolio',
      '/about': 'about',
      '/experience-centre': 'experience_centre',
      '/our-story': 'our_story',
      '/interior-designers-electronic-city': 'area_electronic_city',
      '/interior-designers-chandapura': 'area_chandapura',
      '/interior-designers-bommasandra': 'area_bommasandra',
      '/interior-designers-sarjapur-road': 'area_sarjapur_road',
      '/interior-designers-hsr-layout': 'area_hsr_layout',
      '/modular-kitchen-cost-bangalore': 'pricing_kitchen',
      '/interior-design-cost-bangalore': 'pricing_interior'
    };
    return names[path] || path;
  }

  // ---- UNIFIED CLICK TRACKING (single listener for all analytics) ----
  // Consolidates 8 separate click listeners into one to reduce INP
  document.addEventListener('click', function(e) {
    // Defer all analytics to a microtask so the click handler returns fast
    // This prevents analytics work from blocking INP measurement
    Promise.resolve().then(function() {
      var target = e.target;
      var pageName = getPageName();

      // 1. WhatsApp click
      var waLink = target.closest && target.closest('a[href*="wa.me"]');
      if (waLink) {
        var location = 'page_body';
        if (waLink.classList.contains('floating-inquiry')) location = 'floating_button';
        else if (waLink.closest('.hero-ctas')) location = 'hero_cta';
        else if (waLink.closest('.see-more-text')) location = 'talk_to_designer';
        else if (waLink.closest('.ec-invitation-buttons')) location = 'experience_centre_section';
        else if (waLink.closest('.service-detail-content')) location = 'service_detail';
        else if (waLink.closest('.service-card-center')) location = 'service_card';
        else if (waLink.closest('.brand-cta-content')) location = 'brand_cta';
        else if (waLink.closest('.ec-visit-form')) location = 'callback_form_redirect';
        else if (waLink.closest('.section--footer')) location = 'footer';
        trackEvent('whatsapp_click', { event_category: 'lead_generation', event_label: location, page_name: pageName, link_url: waLink.href });
        return;
      }

      // 2. Phone call
      var telLink = target.closest && target.closest('a[href^="tel:"]');
      if (telLink) {
        trackEvent('phone_call_click', { event_category: 'lead_generation', event_label: telLink.href.replace('tel:', ''), page_name: pageName });
        return;
      }

      // 3. Email
      var mailLink = target.closest && target.closest('a[href^="mailto:"]');
      if (mailLink) {
        trackEvent('email_click', { event_category: 'lead_generation', event_label: mailLink.href.replace('mailto:', ''), page_name: pageName });
        return;
      }

      // 6. Google Maps / Directions (before .btn-pill so map buttons get directions_click)
      var mapsLink = target.closest && target.closest('a[href*="maps.app.goo.gl"], a[href*="google.com/maps"]');
      if (mapsLink) {
        trackEvent('directions_click', { event_category: 'lead_generation', event_label: 'google_maps', page_name: pageName });
        return;
      }

      // 5. CTA button
      var btn = target.closest && target.closest('.btn-pill');
      if (btn) {
        var href = btn.getAttribute('href') || '';
        if (href.indexOf('wa.me') === -1 && href.indexOf('tel:') !== 0 && href.indexOf('mailto:') !== 0) {
          var btnText = (btn.querySelector('span') || btn).textContent.trim();
          trackEvent('cta_click', { event_category: 'engagement', event_label: btnText, page_name: pageName, link_url: href });
        }
        return;
      }

      // 10. Area page / pricing page (before FAQ so area links inside FAQ answers still track)
      var areaLink = target.closest && target.closest('a[href*="interior-designers-"], a[href*="-cost-bangalore"]');
      if (areaLink) {
        var areaHref = areaLink.getAttribute('href') || '';
        trackEvent('area_page_click', { event_category: 'navigation', event_label: areaHref.replace('.html', '').replace('interior-designers-', '').replace('-cost-bangalore', '_cost'), page_name: pageName, link_url: areaHref });
        return;
      }

      // 9. FAQ interaction
      var faqItem = target.closest && target.closest('.faq-item');
      if (faqItem) {
        var question = faqItem.querySelector('.faq-question');
        if (question) trackEvent('faq_click', { event_category: 'engagement', event_label: question.textContent.trim().substring(0, 80), page_name: pageName });
        return;
      }

      // 11. Instagram
      var igLink = target.closest && target.closest('a[href*="instagram.com"]');
      if (igLink) {
        trackEvent('social_click', { event_category: 'engagement', event_label: 'instagram', page_name: pageName });
        return;
      }

      // 12. Project/portfolio card
      var card = target.closest && target.closest('.project-card, .project-grid-card');
      if (card) {
        var name = card.querySelector('.project-grid-name');
        trackEvent('project_view', { event_category: 'engagement', event_label: name ? name.textContent.trim() : 'project_image', page_name: pageName });
      }
    });
  });

  // ---- 4. CALLBACK FORM SUBMISSION TRACKING ----
  var ecForm = document.getElementById('ecVisitForm');
  if (ecForm) {
    ecForm.addEventListener('submit', function() {
      var looking = document.getElementById('ec-looking');
      trackEvent('callback_form_submit', {
        event_category: 'lead_generation',
        event_label: looking ? looking.value : 'not_specified',
        page_name: getPageName()
      });
    });
  }

  // ---- 7. SCROLL DEPTH TRACKING ----
  var scrollMilestones = { 25: false, 50: false, 75: false, 100: false };
  var scrollThrottled = false;
  window.addEventListener('scroll', function() {
    if (scrollThrottled) return;
    scrollThrottled = true;
    setTimeout(function() { scrollThrottled = false; }, 500);

    var scrollPct = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
    for (var milestone in scrollMilestones) {
      if (!scrollMilestones[milestone] && scrollPct >= parseInt(milestone)) {
        scrollMilestones[milestone] = true;
        trackEvent('scroll_depth', {
          event_category: 'engagement',
          event_label: milestone + '_percent',
          page_name: getPageName(),
          scroll_percentage: parseInt(milestone)
        });
      }
    }
  }, { passive: true });

  // ---- 8. TIME ON PAGE TRACKING ----
  var timeIntervals = [30, 60, 120, 300]; // seconds
  timeIntervals.forEach(function(seconds) {
    setTimeout(function() {
      trackEvent('time_on_page', {
        event_category: 'engagement',
        event_label: seconds + '_seconds',
        page_name: getPageName(),
        time_seconds: seconds
      });
    }, seconds * 1000);
  });

  // ---- 13. PAGE VIEW ENHANCED (with page type) ----
  trackEvent('enhanced_page_view', {
    event_category: 'pageview',
    page_name: getPageName(),
    page_type: getPageName().startsWith('area_') ? 'area_landing' :
               getPageName().startsWith('pricing_') ? 'pricing_guide' :
               'core_page',
    page_url: window.location.href,
    referrer: document.referrer || 'direct'
  });

})();
