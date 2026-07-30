(function () {
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('nav');

  if (toggle && nav) {
    function setNav(open) {
      nav.dataset.open = String(open);
      toggle.setAttribute('aria-expanded', String(open));
    }

    toggle.addEventListener('click', function () {
      setNav(nav.dataset.open !== 'true');
    });

    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setNav(false);
    });

    // Escape closes the panel and hands focus back to the button that opened it,
    // otherwise focus is left inside a menu the user can no longer see.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.dataset.open === 'true') {
        setNav(false);
        toggle.focus();
      }
    });
  }

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  var catnav = document.getElementById('catnav');
  if (catnav) {
    var links = Array.prototype.slice.call(catnav.querySelectorAll('a'));
    var pairs = links
      .map(function (a) {
        return { link: a, section: document.querySelector(a.getAttribute('href')) };
      })
      .filter(function (p) { return p.section; });

    var activeLink = null;

    function updateActive() {
      var line = catnav.getBoundingClientRect().bottom + 8;
      var current = pairs[0];

      pairs.forEach(function (p) {
        if (p.section.getBoundingClientRect().top <= line) current = p;
      });

      if (!current || current.link === activeLink) return;

      if (activeLink) {
        activeLink.classList.remove('is-active');
        activeLink.removeAttribute('aria-current');
      }
      current.link.classList.add('is-active');
      current.link.setAttribute('aria-current', 'true');
      activeLink = current.link;
      current.link.scrollIntoView({ block: 'nearest', inline: 'center' });
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        updateActive();
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    updateActive();
  }

  // Review carousel: auto-advances, pauses on hover/focus and when off-screen.
  Array.prototype.forEach.call(document.querySelectorAll('.rv-carousel'), function (root) {
    var track = root.querySelector('.rv-track');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.rv-slide'));
    var dotsBox = root.querySelector('.rv-dots');
    if (!track || slides.length < 2) return;

    var index = 0;
    var timer = null;
    var hovered = false;
    var offscreen = false;
    var interval = parseInt(root.dataset.interval, 10) || 7000;
    var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Plain buttons, not role="tab": a tablist without tabpanels is a broken
    // pattern for screen readers. aria-current marks the one in view.
    var dots = slides.map(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Show review ' + (i + 1) + ' of ' + slides.length);
      b.addEventListener('click', function () { go(i); restart(); });
      dotsBox.appendChild(b);
      return b;
    });

    function go(i) {
      index = (i + slides.length) % slides.length;
      track.style.transform = 'translateX(' + (-index * 100) + '%)';
      dots.forEach(function (d, n) {
        if (n === index) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
      // keep off-screen slides out of the tab order and the a11y tree
      slides.forEach(function (s, n) {
        s.setAttribute('aria-hidden', String(n !== index));
        Array.prototype.forEach.call(s.querySelectorAll('a,button'), function (el) {
          if (n === index) el.removeAttribute('tabindex');
          else el.setAttribute('tabindex', '-1');
        });
      });
    }

    function tick() { if (!hovered && !offscreen) go(index + 1); }
    function restart() {
      if (timer) clearInterval(timer);
      if (!still) timer = setInterval(tick, interval);
    }

    Array.prototype.forEach.call(root.querySelectorAll('.rv-arrow'), function (btn) {
      btn.addEventListener('click', function () {
        go(index + (parseInt(btn.dataset.dir, 10) || 1));
        restart();
      });
    });

    root.addEventListener('mouseenter', function () { hovered = true; });
    root.addEventListener('mouseleave', function () { hovered = false; });
    root.addEventListener('focusin', function () { hovered = true; });
    root.addEventListener('focusout', function () { hovered = false; });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { go(index - 1); restart(); }
      if (e.key === 'ArrowRight') { go(index + 1); restart(); }
    });

    // don't burn cycles animating a carousel nobody can see. Tracked separately
    // from hover so that leaving the pointer does not resume an off-screen one.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { offscreen = !en.isIntersecting; });
      }, { threshold: 0.2 }).observe(root);
    }

    go(0);
    restart();
  });
})();
