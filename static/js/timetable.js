/**
 * AttendFR - Timetable Grid (URIOS / FSUU Exact Style)
 * 30-minute grid slots with rowspan=2 for time headers
 * and exact rowspan for class duration aligning with start/end times.
 */

window.URIOS_TIMETABLE = {
  HOURS: [
    { hour: 7,  label: "07:00 AM", mid: "07:30 AM", end: "07:59 AM" },
    { hour: 8,  label: "08:00 AM", mid: "08:30 AM", end: "08:59 AM" },
    { hour: 9,  label: "09:00 AM", mid: "09:30 AM", end: "09:59 AM" },
    { hour: 10, label: "10:00 AM", mid: "10:30 AM", end: "10:59 AM" },
    { hour: 11, label: "11:00 AM", mid: "11:30 AM", end: "11:59 AM" },
    { hour: 12, label: "12:00 PM", mid: "12:30 PM", end: "12:59 PM" },
    { hour: 13, label: "01:00 PM", mid: "01:30 PM", end: "01:59 PM" },
    { hour: 14, label: "02:00 PM", mid: "02:30 PM", end: "02:59 PM" },
    { hour: 15, label: "03:00 PM", mid: "03:30 PM", end: "03:59 PM" },
    { hour: 16, label: "04:00 PM", mid: "04:30 PM", end: "04:59 PM" },
    { hour: 17, label: "05:00 PM", mid: "05:30 PM", end: "05:59 PM" },
    { hour: 18, label: "06:00 PM", mid: "06:30 PM", end: "06:59 PM" },
    { hour: 19, label: "07:00 PM", mid: "07:30 PM", end: "07:59 PM" },
    { hour: 20, label: "08:00 PM", mid: "08:30 PM", end: "08:59 PM" },
    { hour: 21, label: "09:00 PM", mid: "09:30 PM", end: "09:59 PM" }
  ],

  DAYS: [
    { key: "Mon", name: "Monday" },
    { key: "Tue", name: "Tuesday" },
    { key: "Wed", name: "Wednesday" },
    { key: "Thu", name: "Thursday" },
    { key: "Fri", name: "Friday" },
    { key: "Sat", name: "Saturday" },
    { key: "Sun", name: "Sunday" }
  ],

  parseMinutes: function(str) {
    if (!str) return 0;
    const parts = str.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  },

  render: function(tbodyId, schedules) {
    const tbody = (typeof tbodyId === 'string') ? document.getElementById(tbodyId) : tbodyId;
    if (!tbody) {
      console.warn('Timetable tbody not found:', tbodyId);
      return;
    }

    // Parse minutes on all schedules once
    const parsedSchedules = (schedules || []).map(function(s) {
      return {
        section_id: s.section_id,
        section_name: s.section_name,
        subject_code: s.subject_code,
        subject_name: s.subject_name,
        room: s.room,
        days: s.days || [],
        startMin: URIOS_TIMETABLE.parseMinutes(s.start_time),
        endMin: URIOS_TIMETABLE.parseMinutes(s.end_time),
        time_display: s.time_display,
        days_display: s.days_display
      };
    });

    // Build 30-minute slot list
    const slots = [];
    this.HOURS.forEach(function(h) {
      const min0 = h.hour * 60;
      slots.push({
        startMin: min0,
        endMin: min0 + 30,
        isHourStart: true,
        labelTop: h.label,
        labelMid: h.mid,
        labelBottom: h.end
      });
      slots.push({
        startMin: min0 + 30,
        endMin: min0 + 60,
        isHourStart: false
      });
    });

    const skipMap = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    let html = '';

    slots.forEach(function(slot, slotIdx) {
      const borderBottom = slot.isHourStart ? '1px solid #e2e8f0' : '2px solid #7a9cb8';
      html += '<tr style="border-bottom:' + borderBottom + '; height:28px;">';

      // 1. Time Column (spans 2 rows = 1 full hour)
      if (slot.isHourStart) {
        html += '<td rowspan="2" style="background:#d9e6f2; border:1px solid #7a9cb8; text-align:center; padding:4px 2px; width:95px; vertical-align:middle; user-select:none;">';
        html += '  <div style="font-size:10px; color:#475569; line-height:1.2;">' + slot.labelTop + '</div>';
        html += '  <div style="font-size:13px; font-weight:800; color:#0f172a; line-height:1.2; margin:3px 0;">' + slot.labelMid + '</div>';
        html += '  <div style="font-size:10px; color:#475569; line-height:1.2;">' + slot.labelBottom + '</div>';
        html += '</td>';
      }

      // 2. Day Columns (Monday -> Sunday)
      URIOS_TIMETABLE.DAYS.forEach(function(day) {
        if (skipMap[day.key] > 0) {
          skipMap[day.key]--;
          return;
        }

        // Match if class starts in this 30-min slot
        const match = parsedSchedules.find(function(s) {
          if (!s.days.includes(day.key)) return false;
          return s.startMin >= slot.startMin && s.startMin < slot.endMin;
        });

        if (match) {
          const duration = Math.max(match.endMin - match.startMin, 30);
          let spanCount = Math.round(duration / 30);
          if (spanCount < 1) spanCount = 1;

          skipMap[day.key] = spanCount - 1;

          // Authentic URIOS Green Card (matching Reference Screenshot 2)
          html += '<td rowspan="' + spanCount + '" style="background:#a2d969; border:1px solid #559628; text-align:center; padding:8px 4px; vertical-align:middle; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.08);" onclick="window.location.href=\'/sections/' + match.section_id + '/\';" title="' + match.subject_code + ' - ' + match.subject_name + ' (' + match.time_display + ') Click to view Class List">';
          html += '  <div style="font-weight:800; font-size:12px; color:#183c0c; line-height:1.2;">' + match.subject_code + '</div>';
          html += '  <div style="font-size:11px; font-weight:600; color:#1f4810; margin-top:2px;">' + match.section_name + '</div>';
          html += '  <div style="font-size:11px; color:#275a15; margin-top:2px;">' + match.room + '</div>';
          html += '  <div style="font-size:10px; font-weight:600; color:#183c0c; margin-top:4px; display:inline-block; padding:1px 6px; background:rgba(255,255,255,0.7); border-radius:3px;">' + match.time_display + '</div>';
          html += '</td>';
        } else {
          const cellBorder = slot.isHourStart ? '1px solid #f8fafc' : '1px solid #e2e8f0';
          html += '<td style="background:#ffffff; border:' + cellBorder + '; border-right:1px solid #cbd5e1; height:28px;"></td>';
        }
      });

      html += '</tr>';
    });

    tbody.innerHTML = html;
  },

  // Auto render all data sources on page
  initAll: function() {
    const sources = document.querySelectorAll('.timetable-data-source');
    sources.forEach(function(src) {
      const targetId = src.getAttribute('data-target-id');
      if (targetId) {
        try {
          const data = JSON.parse(src.textContent || '[]');
          URIOS_TIMETABLE.render(targetId, data);
        } catch(e) {
          console.error('Error parsing timetable JSON for ' + targetId, e);
        }
      }
    });
  }
};

/**
 * 1-Click View Switcher
 */
window.switchScheduleView = function(viewType, tableId, gridId, btnTableId, btnGridId, storageKey) {
  const tableEl = document.getElementById(tableId || 'schedule-table-card');
  const gridEl = document.getElementById(gridId || 'schedule-grid-card');
  const btnTable = document.getElementById(btnTableId || 'btn-show-table');
  const btnGrid = document.getElementById(btnGridId || 'btn-show-grid');

  if (!tableEl || !gridEl) return;

  const key = storageKey || 'fsuu_schedule_view_pref';

  if (viewType === 'grid') {
    tableEl.style.display = 'none';
    gridEl.style.display = 'block';
    if (btnGrid) btnGrid.className = 'btn btn-primary';
    if (btnTable) btnTable.className = 'btn btn-outline';
    // Ensure all timetables are rendered
    URIOS_TIMETABLE.initAll();
    try { localStorage.setItem(key, 'grid'); } catch(e){}
  } else {
    tableEl.style.display = 'block';
    gridEl.style.display = 'none';
    if (btnTable) btnTable.className = 'btn btn-primary';
    if (btnGrid) btnGrid.className = 'btn btn-outline';
    try { localStorage.setItem(key, 'table'); } catch(e){}
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
};

// Automatic execution on DOM load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    URIOS_TIMETABLE.initAll();
  });
} else {
  URIOS_TIMETABLE.initAll();
}
