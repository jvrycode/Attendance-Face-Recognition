/**
 * AttendFR - Main Application JavaScript
 * Global UI behaviors, responsive drawer, and helpers.
 */

document.addEventListener('DOMContentLoaded', function() {
  // 1. Auto-dismiss flash alerts after 5 seconds
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(function(el) {
    setTimeout(function() {
      el.style.opacity = '0';
    }, 4500);
    setTimeout(function() {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 5000);
    el.style.transition = 'opacity 0.5s ease';
  });

  // 2. Responsive Mobile / Tablet Navigation Drawer
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  function openSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
    document.body.classList.add('sidebar-mobile-open');
    if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
    document.body.classList.remove('sidebar-mobile-open');
    if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      if (sidebar && sidebar.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  }

  if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      closeSidebar();
    });
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', function() {
      closeSidebar();
    });
  }

  // Close when pressing Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && sidebar && sidebar.classList.contains('open')) {
      closeSidebar();
    }
  });

  // Close drawer when clicking a navigation link on mobile/tablet screens
  const navLinks = document.querySelectorAll('.sidebar-nav .nav-item, .sidebar-footer .nav-item');
  navLinks.forEach(function(link) {
    link.addEventListener('click', function() {
      if (window.innerWidth <= 1024) {
        closeSidebar();
      }
    });
  });

  // Reset drawer state on window resize above tablet breakpoint
  window.addEventListener('resize', function() {
    if (window.innerWidth > 1024) {
      closeSidebar();
    }
  });

  // 3. Action Popover (3-Dots Actions Menu)
  window.toggleActionPopover = function(btn, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const dropdown = btn.closest('.action-popover-dropdown');
    if (!dropdown) return;
    const menu = dropdown.querySelector('.action-popover-menu');
    if (!menu) return;

    const isOpen = menu.classList.contains('open');

    // Close any other open menus
    document.querySelectorAll('.action-popover-menu.open').forEach(function(m) {
      if (m !== menu) {
        m.classList.remove('open');
        const trig = m.closest('.action-popover-dropdown')?.querySelector('.action-popover-trigger');
        if (trig) trig.classList.remove('active');
      }
    });

    if (isOpen) {
      menu.classList.remove('open');
      btn.classList.remove('active');
    } else {
      // Flip upwards if close to bottom of viewport
      const rect = btn.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 200 && rect.top > 200) {
        menu.style.top = 'auto';
        menu.style.bottom = 'calc(100% + 4px)';
      } else {
        menu.style.top = 'calc(100% + 4px)';
        menu.style.bottom = 'auto';
      }
      menu.classList.add('open');
      btn.classList.add('active');
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
  };

  // Close popovers on click outside or Escape
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.action-popover-dropdown')) {
      document.querySelectorAll('.action-popover-menu.open').forEach(function(m) {
        m.classList.remove('open');
        const trig = m.closest('.action-popover-dropdown')?.querySelector('.action-popover-trigger');
        if (trig) trig.classList.remove('active');
      });
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.action-popover-menu.open').forEach(function(m) {
        m.classList.remove('open');
        const trig = m.closest('.action-popover-dropdown')?.querySelector('.action-popover-trigger');
        if (trig) trig.classList.remove('active');
      });
    }
  });

  // 4. Initialize Lucide icons
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
});
