import { formatSchoolScheduleParts } from './time';

const DAY_MAP = { M: 'Mon', Mon: 'Mon', Monday: 'Mon', T: 'Tue', Tue: 'Tue', Tuesday: 'Tue', W: 'Wed', Wed: 'Wed', Wednesday: 'Wed', TH: 'Thu', Th: 'Thu', Thu: 'Thu', Thursday: 'Thu', F: 'Fri', Fri: 'Fri', Friday: 'Fri', S: 'Sat', Sa: 'Sat', Sat: 'Sat', Saturday: 'Sat', SU: 'Sun', Su: 'Sun', Sun: 'Sun', Sunday: 'Sun' };
const DAY_NAMES = { Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function scheduleMeetingDays(schedule) {
  const values = Array.isArray(schedule?.meeting_days) ? schedule.meeting_days : [schedule?.day_of_week, schedule?.day_2].filter(Boolean);
  return values.map((day) => DAY_MAP[String(day).trim()] || String(day).trim()).filter(Boolean);
}

export function scheduleTimeMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function formatScheduleClock(value) {
  const [hours = '0', minutes = '00'] = String(value || '').split(':');
  const hour = Number(hours);
  return `${String(hour % 12 || 12).padStart(2, '0')}:${minutes} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export function findTodayScheduleSession(sessions, schedule, now = new Date()) {
  const today = localDateKey(now);
  return (sessions || []).find((session) => String(session.schedule) === String(schedule.id) && session.date === today);
}

export function getScheduleStatus(schedule, sessions = [], now = new Date()) {
  const session = findTodayScheduleSession(sessions, schedule, now);
  const days = scheduleMeetingDays(schedule);
  const today = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const start = scheduleTimeMinutes(schedule.start_time);
  const end = scheduleTimeMinutes(schedule.end_time);
  const scheduleLabel = formatSchoolScheduleParts(schedule).fullTime || 'this class';

  if (session?.status === 'open') return { key: 'live', label: 'Attendance open', detail: end !== null ? `Ends ${formatScheduleClock(schedule.end_time)}` : 'Scanning in progress', canStart: true, session };
  if (session?.status === 'closed') return { key: 'finalized', label: 'Finalized today', detail: 'Attendance is complete', canStart: false, session };
  if (!days.includes(today)) return { key: 'not-today', label: 'Not scheduled today', detail: days.map((day) => DAY_NAMES[day] || day).join(' / '), canStart: false, reason: `Attendance is available only on ${days.join(' / ')}.` };
  if (start !== null && nowMinutes < start) {
    const minutes = start - nowMinutes;
    return { key: 'upcoming', label: `Starts in ${minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`}`, detail: `Attendance opens at ${formatScheduleClock(schedule.start_time)}`, canStart: false, reason: `This class has not started yet. Attendance opens at ${formatScheduleClock(schedule.start_time)}.` };
  }
  if (end !== null && nowMinutes > end) return { key: 'ended', label: 'Class time ended', detail: `${scheduleLabel} has ended`, canStart: false, reason: `Attendance for ${scheduleLabel} has already ended.` };
  return { key: 'ready', label: 'Ready for attendance', detail: `Open until ${formatScheduleClock(schedule.end_time)}`, canStart: true };
}

export function getUpcomingSchedules(schedules = [], sessions = [], now = new Date(), limit = 3) {
  const today = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return schedules.filter((schedule) => scheduleMeetingDays(schedule).includes(today)).map((schedule) => ({ schedule, status: getScheduleStatus(schedule, sessions, now), start: scheduleTimeMinutes(schedule.start_time) ?? 1440 })).filter(({ status, start }) => status.key === 'live' || (status.key === 'upcoming' && start >= nowMinutes)).sort((a, b) => a.status.key === 'live' ? -1 : b.status.key === 'live' ? 1 : a.start - b.start).slice(0, limit);
}