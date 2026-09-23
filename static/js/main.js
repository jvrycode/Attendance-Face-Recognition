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
        m.classList.remove('dropup');
        m.style.top = '';
        m.style.bottom = '';
        const trig = m.closest('.action-popover-dropdown')?.querySelector('.action-popover-trigger');
        if (trig) trig.classList.remove('active');
      }
    });

    if (isOpen) {
      menu.classList.remove('open');
      menu.classList.remove('dropup');
      menu.style.top = '';
      menu.style.bottom = '';
      btn.classList.remove('active');
    } else {
      // SMART POPUP POSITIONING:
      // If the row / button is on the TOP of the table, it MUST open downwards (dropdown)
      // to avoid overlapping table headers or clipping at the top.
      // If the row / button is on the BOTTOM of the table, and there is safe clearance above,
      // it should open upwards (dropup) so it won't expand the table or cause scrollbars.
      const rect = btn.getBoundingClientRect();
      const tr = btn.closest('tr');
      const tableOrContainer = btn.closest('.table-container') || btn.closest('table') || btn.closest('.card');
      
      const spaceViewportAbove = rect.top;
      const spaceViewportBelow = window.innerHeight - rect.bottom;

      let spaceContainerAbove = 9999;
      let spaceContainerBelow = 9999;
      if (tableOrContainer) {
        const cRect = tableOrContainer.getBoundingClientRect();
        spaceContainerAbove = rect.top - cRect.top;
        spaceContainerBelow = cRect.bottom - rect.bottom;
      }

      let rowIndex = -1;
      let rowCount = 0;
      if (tr && tr.parentElement) {
        const rows = Array.from(tr.parentElement.querySelectorAll('tr'));
        rowCount = rows.length;
        rowIndex = rows.indexOf(tr);
      }

      // Can we safely open upwards without clipping the top?
      // 1. Must NOT be the first row of a table (rowIndex > 0)
      // 2. Must have at least 85px clearance above inside container
      // 3. Must have at least 110px clearance from top of viewport
      const canDropupSafely = (rowIndex > 0 || !tr) && spaceContainerAbove >= 85 && spaceViewportAbove >= 110;

      // Do we have a reason to dropup?
      // - It is one of the bottom rows of a multi-row table
      // - Or space below inside container is tight (< 140px) AND there's more space above than below
      // - Or space below in viewport is tight (< 180px) AND there's more space above than below
      const isBottomRow = rowCount >= 2 && rowIndex >= Math.max(1, rowCount - 2);
      const isTightBelow = (spaceContainerBelow < 140 && spaceContainerAbove > spaceContainerBelow) ||
                           (spaceViewportBelow < 180 && spaceViewportAbove > spaceViewportBelow);

      const shouldDropup = canDropupSafely && (isBottomRow || isTightBelow);

      if (shouldDropup) {
        menu.classList.add('dropup');
        menu.style.top = 'auto';
        menu.style.bottom = 'calc(100% + 4px)';
      } else {
        menu.classList.remove('dropup');
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
        m.classList.remove('dropup');
        m.style.top = '';
        m.style.bottom = '';
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

  // 4. Global Button & Form Loading State Handler
  window.setButtonLoading = function(btn, loadingText) {
    if (!btn || btn.classList.contains('is-loading')) return;

    if (!btn.dataset.origHtml) {
      btn.dataset.origHtml = btn.innerHTML;
    }

    let text = loadingText || btn.getAttribute('data-loading-text');
    if (!text) {
      const btnText = btn.textContent.trim().toLowerCase();
      if (btnText.includes('sign in') || btnText.includes('login') || btnText.includes('log in')) {
        text = 'Signing in...';
      } else if (btnText.includes('view attendance')) {
        text = 'Loading Attendance...';
      } else if (btnText.includes('save') || btnText.includes('update')) {
        text = 'Saving...';
      } else if (btnText.includes('create') || btnText.includes('add')) {
        text = 'Creating...';
      } else if (btnText.includes('delete') || btnText.includes('remove')) {
        text = 'Processing...';
      } else if (btnText.includes('enroll')) {
        text = 'Enrolling...';
      } else if (btnText.includes('start')) {
        text = 'Starting...';
      } else {
        text = 'Loading...';
      }
    }

    btn.classList.add('is-loading');
    btn.innerHTML = '<span class="btn-spinner"></span> <span>' + text + '</span>';
  };

  // Attach to all standard form submissions (e.g. login, edit forms)
  document.addEventListener('submit', function(e) {
    const form = e.target;
    if (!form || form.hasAttribute('data-no-loading')) return;
    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (submitBtn && !submitBtn.classList.contains('is-loading')) {
      window.setButtonLoading(submitBtn);
    }
  });

  // Attach to special action buttons and links with .btn-view-attendance or data-loading
  document.addEventListener('click', function(e) {
    const trigger = e.target.closest('.btn-view-attendance, [data-loading]');
    if (trigger && !trigger.classList.contains('is-loading')) {
      window.setButtonLoading(trigger);
    }
  });

  // 5. Accessible Modal Management System
  window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
    // Update select placeholder styles inside opened modal
    modal.querySelectorAll('select.form-select').forEach(syncSelectPlaceholder);
    const autoFocusEl = modal.querySelector('input:not([type="hidden"]):not([disabled]), select, button.modal-close-btn');
    if (autoFocusEl) {
      setTimeout(function() { autoFocusEl.focus(); }, 60);
    }
  };

  window.closeModal = function(modalId) {
    if (modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }
    } else {
      document.querySelectorAll('.modal-backdrop.open').forEach(function(m) {
        m.classList.remove('open');
        m.setAttribute('aria-hidden', 'true');
      });
    }
    if (!document.querySelector('.modal-backdrop.open')) {
      document.body.classList.remove('modal-open');
    }
  };

  // Close modals on backdrop click or close button
  document.addEventListener('click', function(e) {
    const closeBtn = e.target.closest('[data-close-modal], .modal-close-btn');
    if (closeBtn) {
      const modal = closeBtn.closest('.modal-backdrop');
      if (modal) window.closeModal(modal.id);
      return;
    }
    if (e.target.classList.contains('modal-backdrop')) {
      window.closeModal(e.target.id);
    }
  });

  // Close modals on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const openModalEl = document.querySelector('.modal-backdrop.open');
      if (openModalEl) {
        window.closeModal(openModalEl.id);
      }
    }
  });

  // 6. Dynamic Select Placeholder Styling
  function syncSelectPlaceholder(sel) {
    if (!sel || !sel.tagName || sel.tagName.toLowerCase() !== 'select') return;
    if (sel.value === '' || sel.value === null) {
      sel.classList.add('is-placeholder');
    } else {
      sel.classList.remove('is-placeholder');
    }
  }
  window.syncSelectPlaceholder = syncSelectPlaceholder;

  document.querySelectorAll('select.form-select').forEach(syncSelectPlaceholder);
  document.addEventListener('change', function(e) {
    if (e.target && e.target.matches('select.form-select')) {
      syncSelectPlaceholder(e.target);
    }
  });

  // 7. Initialize Lucide icons
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
});

