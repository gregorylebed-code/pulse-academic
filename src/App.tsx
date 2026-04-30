import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { parseLessonPlan, suggestExitTickets, type DayLesson, type WeekSchedule } from './lib/groq'
import {
  DEMO_CLASSES, DEMO_STUDENTS, DEMO_STUDENT_CLASSES, DEMO_LESSONS, DEMO_CHECKINS,
  type DemoClass, type DemoStudent,
} from './lib/demo'

// ── Types ──────────────────────────────────────────────────────────────────

type Status = 'got-it' | 'almost' | 'needs-help'
type Screen = 'tracker' | 'history' | 'plan' | 'roster' | 'reports'
type HistoryTab = 'student' | 'lesson'
type NameFormat = 'full' | 'first' | 'initials'

type AppClass = { id: string; name: string; subject: string; display_order: number }
type AppStudent = { id: string; name: string }
type AppLesson = { id: string; class_id: string; date: string; title: string; objective?: string }
type HistoryRow = { class_id: string; class_name: string; student_id: string; student_name: string; lesson_id: string; lesson_title: string; date: string; status: string }

// ── Constants ─────────────────────────────────────────────────────────────

const STATUS_CYCLE: Status[] = ['got-it', 'almost', 'needs-help']

const STATUS_RING: Record<Status, string> = {
  'got-it':     'ring-4 ring-emerald-400',
  'almost':     'ring-4 ring-yellow-400',
  'needs-help': 'ring-4 ring-red-400',
}

const STATUS_INITIAL_BG: Record<Status, string> = {
  'got-it':     'bg-emerald-100 text-emerald-700',
  'almost':     'bg-yellow-100 text-yellow-700',
  'needs-help': 'bg-red-100 text-red-600',
}

const STATUS_DOT: Record<Status, string> = {
  'got-it':     'bg-emerald-400',
  'almost':     'bg-yellow-400',
  'needs-help': 'bg-red-400',
}

const STATUS_LABEL: Record<Status, string> = {
  'got-it':     'Got It',
  'almost':     'Almost',
  'needs-help': 'Needs Help',
}

const STATUS_PILL: Record<Status, string> = {
  'got-it':     'bg-emerald-100 text-emerald-700',
  'almost':     'bg-yellow-100 text-yellow-700',
  'needs-help': 'bg-red-100 text-red-600',
}

// ── Helpers ───────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getWeekStart(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(y, m - 1, d + diff)
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`
}

function formatStudentName(fullName: string, format: NameFormat, classmates: string[]): string {
  const parts = fullName.trim().split(/\s+/)
  const first = parts[0]
  const rest = parts.slice(1)
  const lastInitial = rest.length > 0 ? rest[rest.length - 1][0].toUpperCase() + '.' : ''
  if (format === 'full') return fullName
  if (format === 'initials') return parts.map(p => p[0].toUpperCase()).join('.') + '.'
  const dupFirst = classmates.filter(n => n.trim().split(/\s+/)[0] === first && n !== fullName)
  if (dupFirst.length === 0 || !lastInitial) return first
  const dupFirstAndLast = dupFirst.filter(n => {
    const p = n.trim().split(/\s+/)
    return p.length > 1 && p[p.length - 1][0].toUpperCase() + '.' === lastInitial
  })
  return dupFirstAndLast.length === 0 ? `${first} ${lastInitial}` : `${first} ${lastInitial} (2)`
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatWeek(weekStart: string) {
  const [y, m, d] = weekStart.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const end = new Date(y, m - 1, d + 4)
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function nextISOWeekday(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const next = new Date(y, m - 1, d + 1)
  if (next.getDay() === 6) next.setDate(next.getDate() + 2)
  if (next.getDay() === 0) next.setDate(next.getDate() + 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
}

async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') {
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
    GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await getDocument({ data: arrayBuffer }).promise
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + '\n'
    }
    return text
  }
  if (ext === 'docx' || ext === 'doc') {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  }
  return await file.text()
}

// ── Demo data adapters ────────────────────────────────────────────────────

function buildDemoHistory(): HistoryRow[] {
  const rows: HistoryRow[] = []
  const studentMap = Object.fromEntries(DEMO_STUDENTS.map((s: DemoStudent) => [s.id, s.name]))
  const classMap = Object.fromEntries(DEMO_CLASSES.map((c: DemoClass) => [c.id, c.name]))
  for (const checkin of DEMO_CHECKINS) {
    const lesson = DEMO_LESSONS.find(l => l.id === checkin.lesson_id)
    if (!lesson) continue
    rows.push({
      class_id: lesson.class_id,
      class_name: classMap[lesson.class_id] ?? '',
      student_id: checkin.student_id,
      student_name: studentMap[checkin.student_id] ?? '',
      lesson_id: lesson.id,
      lesson_title: lesson.title,
      date: lesson.date,
      status: checkin.status,
    })
  }
  return rows
}

// ── Props ─────────────────────────────────────────────────────────────────

type Props = {
  userId: string
  isDemo?: boolean
  onSignOut: () => void
}

// ── App ───────────────────────────────────────────────────────────────────

export default function App({ userId, isDemo = false, onSignOut }: Props) {
  const today = todayISO()
  const weekStart = getWeekStart(today)

  // ── Data ──
  const [classes, setClasses] = useState<AppClass[]>([])
  const [studentsByClass, setStudentsByClass] = useState<Record<string, AppStudent[]>>({})
  const [dataLoading, setDataLoading] = useState(true)

  // ── UI state ──
  const [screen, setScreen] = useState<Screen>('tracker')
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [lessonInput, setLessonInput] = useState('')
  const [activeLesson, setActiveLesson] = useState<AppLesson | null>(null)
  const [studentStatuses, setStudentStatuses] = useState<Record<string, Status>>({})
  const [loading, setLoading] = useState(false)

  // Exit ticket
  const [exitTickets, setExitTickets] = useState<string[]>([])
  const [exitTicketLoading, setExitTicketLoading] = useState(false)
  const [activeExitTicket, setActiveExitTicket] = useState<string | null>(null)
  const [showExitTickets, setShowExitTickets] = useState(false)

  // Week plan
  const [planText, setPlanText] = useState('')
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState('')
  const [savedPlan, setSavedPlan] = useState<{ weekStart: string; schedule: WeekSchedule; trackedSubjects: string[]; planId?: string } | null>(null)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [editingDay, setEditingDay] = useState<string | null>(null)
  const [editSubject, setEditSubject] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<DayLesson | null>(null)
  const [swapSource, setSwapSource] = useState<string | null>(null)
  const [skipConfirmDay, setSkipConfirmDay] = useState<string | null>(null)
  const [planSaving, setPlanSaving] = useState(false)
  const [undoSnapshot, setUndoSnapshot] = useState<WeekSchedule | null>(null)
  const [planSaved, setPlanSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingSchedule, setPendingSchedule] = useState<WeekSchedule | null>(null)
  const [subjectChoices, setSubjectChoices] = useState<string[]>([])
  const [activeSubject, setActiveSubject] = useState<string | null>(null)

  // History
  const [historyTab, setHistoryTab] = useState<HistoryTab>('student')
  const [historyClassId, setHistoryClassId] = useState<string>('')
  const [historyData, setHistoryData] = useState<HistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<{ lesson_id: string; lesson_title: string; date: string } | null>(null)

  // Roster management
  const [rosterNewStudentName, setRosterNewStudentName] = useState<Record<string, string>>({})
  const [rosterRenaming, setRosterRenaming] = useState<string | null>(null)
  const [rosterRenameValue, setRosterRenameValue] = useState('')
  const [rosterConfirmRemove, setRosterConfirmRemove] = useState<{ studentId: string; classId: string } | null>(null)
  const [rosterAddingClass, setRosterAddingClass] = useState(false)
  const [rosterNewClassName, setRosterNewClassName] = useState('')
  const [rosterNewClassSubject, setRosterNewClassSubject] = useState('Math')
  const [rosterSaving, setRosterSaving] = useState(false)

  const SUBJECTS = ['Math', 'ELA', 'Science', 'Social Studies', 'Specials', 'Other']

  async function rosterAddStudent(classId: string) {
    const name = (rosterNewStudentName[classId] ?? '').trim()
    if (!name || rosterSaving) return
    setRosterSaving(true)
    // Insert student scoped to this teacher
    const { data: student } = await supabase
      .from('students')
      .insert({ user_id: userId, name })
      .select('id, name')
      .single()
    if (student) {
      await supabase.from('student_classes').insert({ student_id: student.id, class_id: classId })
      setStudentsByClass(cur => ({ ...cur, [classId]: [...(cur[classId] ?? []), student] }))
      setRosterNewStudentName(cur => ({ ...cur, [classId]: '' }))
    }
    setRosterSaving(false)
  }

  async function rosterRemoveStudent(studentId: string, classId: string) {
    setRosterSaving(true)
    await supabase.from('student_classes').delete().eq('student_id', studentId).eq('class_id', classId)
    setStudentsByClass(cur => ({ ...cur, [classId]: (cur[classId] ?? []).filter(s => s.id !== studentId) }))
    setRosterConfirmRemove(null)
    setRosterSaving(false)
  }

  async function rosterRenameClass(classId: string) {
    const name = rosterRenameValue.trim()
    if (!name) return
    setRosterSaving(true)
    await supabase.from('classes').update({ name }).eq('id', classId)
    setClasses(cur => cur.map(c => c.id === classId ? { ...c, name } : c))
    setRosterRenaming(null)
    setRosterRenameValue('')
    setRosterSaving(false)
  }

  async function rosterAddClass() {
    const name = rosterNewClassName.trim()
    if (!name || classes.length >= 6) return
    setRosterSaving(true)
    const display_order = classes.length
    const { data: cls } = await supabase
      .from('classes')
      .insert({ user_id: userId, name, subject: rosterNewClassSubject, display_order })
      .select('id, name, subject, display_order')
      .single()
    if (cls) {
      setClasses(cur => [...cur, cls])
      setStudentsByClass(cur => ({ ...cur, [cls.id]: [] }))
    }
    setRosterNewClassName('')
    setRosterNewClassSubject('Math')
    setRosterAddingClass(false)
    setRosterSaving(false)
  }

  // Reports
  type ReportRange = 'today' | 'week' | 'month' | 'custom' | 'all'
  const [reportClassId, setReportClassId] = useState<string>('all')
  const [reportRange, setReportRange] = useState<ReportRange>('today')
  const [reportCustomStart, setReportCustomStart] = useState('')
  const [reportCustomEnd, setReportCustomEnd] = useState('')
  const [reportCopied, setReportCopied] = useState(false)

  function reportDateBounds(): { start: string; end: string } | null {
    const [y, m] = today.split('-').map(Number)
    if (reportRange === 'today') return { start: today, end: today }
    if (reportRange === 'week') return { start: weekStart, end: today }
    if (reportRange === 'month') {
      const start = `${y}-${String(m).padStart(2, '0')}-01`
      return { start, end: today }
    }
    if (reportRange === 'custom') {
      if (!reportCustomStart || !reportCustomEnd) return null
      return { start: reportCustomStart, end: reportCustomEnd }
    }
    return null // 'all'
  }

  type ReportStudent = { id: string; name: string; lessons: { title: string; date: string; status: 'needs-help' | 'almost' }[] }
  type ReportClass = { classId: string; className: string; needsSupport: ReportStudent[]; checkIn: ReportStudent[] }

  const reportData: ReportClass[] = useMemo(() => {
    const bounds = reportDateBounds()
    const targetClasses = reportClassId === 'all' ? classes : classes.filter(c => c.id === reportClassId)

    return targetClasses.map(cls => {
      const students = studentsByClass[cls.id] ?? []
      const classRows = historyData.filter(r => {
        if (r.class_id !== cls.id) return false
        if (r.status === 'got-it') return false
        if (bounds && (r.date < bounds.start || r.date > bounds.end)) return false
        return true
      })

      const studentMap = new Map<string, ReportStudent>()
      for (const row of classRows) {
        if (!studentMap.has(row.student_id)) {
          const s = students.find(s => s.id === row.student_id)
          if (!s) continue
          studentMap.set(row.student_id, { id: row.student_id, name: row.student_name, lessons: [] })
        }
        studentMap.get(row.student_id)!.lessons.push({ title: row.lesson_title, date: row.date, status: row.status as 'needs-help' | 'almost' })
      }

      const all = [...studentMap.values()].map(s => ({
        ...s,
        lessons: s.lessons.sort((a, b) => b.date.localeCompare(a.date)),
      }))

      const needsSupport = all.filter(s => s.lessons.some(l => l.status === 'needs-help')).sort((a, b) => a.name.localeCompare(b.name))
      const checkIn = all.filter(s => !s.lessons.some(l => l.status === 'needs-help')).sort((a, b) => a.name.localeCompare(b.name))

      return { classId: cls.id, className: cls.name, needsSupport, checkIn }
    }).filter(c => c.needsSupport.length > 0 || c.checkIn.length > 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyData, classes, studentsByClass, reportClassId, reportRange, reportCustomStart, reportCustomEnd, today])

  function buildReportText(): string {
    const bounds = reportDateBounds()
    const rangeLabel = reportRange === 'today' ? `Today (${formatDate(today)})`
      : reportRange === 'week' ? `This week (${formatWeek(weekStart)})`
      : reportRange === 'month' ? `This month`
      : reportRange === 'custom' && bounds ? `${formatDate(bounds.start)} – ${formatDate(bounds.end)}`
      : 'All time'

    const lines: string[] = [`Student Support Report — ${rangeLabel}`, '']
    for (const cls of reportData) {
      lines.push(`── ${cls.className} ──`)
      if (cls.needsSupport.length > 0) {
        lines.push('Needs Support:')
        for (const s of cls.needsSupport) {
          const topics = [...new Set(s.lessons.filter(l => l.status === 'needs-help').map(l => l.title))].join(', ')
          lines.push(`  • ${s.name} — ${topics}`)
        }
      }
      if (cls.checkIn.length > 0) {
        lines.push('Worth a Check-In:')
        for (const s of cls.checkIn) {
          const topics = [...new Set(s.lessons.map(l => l.title))].join(', ')
          lines.push(`  • ${s.name} — ${topics}`)
        }
      }
      lines.push('')
    }
    return lines.join('\n').trim()
  }

  async function copyReport() {
    await navigator.clipboard.writeText(buildReportText())
    setReportCopied(true)
    setTimeout(() => setReportCopied(false), 2500)
  }

  // Name format
  const [nameFormat, setNameFormat] = useState<NameFormat>(() =>
    (localStorage.getItem('nameFormat') as NameFormat) ?? 'first'
  )
  function cycleNameFormat() {
    const next: NameFormat = nameFormat === 'full' ? 'first' : nameFormat === 'first' ? 'initials' : 'full'
    setNameFormat(next)
    localStorage.setItem('nameFormat', next)
  }

  // ── Load classes + students ──────────────────────────────────────────────

  useEffect(() => {
    if (isDemo) {
      const demoClasses = DEMO_CLASSES.map(c => ({ ...c }))
      const byClass: Record<string, AppStudent[]> = {}
      for (const cls of demoClasses) {
        const ids = DEMO_STUDENT_CLASSES.filter(sc => sc.class_id === cls.id).map(sc => sc.student_id)
        byClass[cls.id] = DEMO_STUDENTS.filter(s => ids.includes(s.id))
      }
      setTimeout(() => {
        setClasses(demoClasses)
        setSelectedClassId(demoClasses[0]?.id ?? '')
        setHistoryClassId(demoClasses[0]?.id ?? '')
        setStudentsByClass(byClass)
        setHistoryData(buildDemoHistory())
        setDataLoading(false)
      }, 0)
      return
    }

    async function load() {
      setDataLoading(true)
      const { data: cls } = await supabase
        .from('classes')
        .select('id, name, subject, display_order')
        .eq('user_id', userId)
        .order('display_order')

      const loaded = cls ?? []
      setClasses(loaded)
      setSelectedClassId(loaded[0]?.id ?? '')
      setHistoryClassId(loaded[0]?.id ?? '')

      if (loaded.length === 0) { setDataLoading(false); return }

      // Load all students for this teacher via student_classes join
      const { data: scRows } = await supabase
        .from('student_classes')
        .select('class_id, students(id, name)')
        .in('class_id', loaded.map(c => c.id))

      const byClass: Record<string, AppStudent[]> = {}
      for (const cls of loaded) byClass[cls.id] = []
      for (const row of scRows ?? []) {
        const s = row.students as unknown as AppStudent
        if (s && byClass[row.class_id]) byClass[row.class_id].push(s)
      }
      setStudentsByClass(byClass)
      setDataLoading(false)
    }
    load()
  }, [userId, isDemo])

  // ── Load week plan on mount ──────────────────────────────────────────────

  useEffect(() => {
    if (isDemo || classes.length === 0) return
    supabase
      .from('week_plans')
      .select('id, week_start, plan_json, tracked_subjects')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const tracked = data.tracked_subjects ?? []
          setSavedPlan({ weekStart: data.week_start, schedule: data.plan_json, trackedSubjects: tracked, planId: data.id })
          if (tracked.length > 0) setActiveSubject(tracked[0])
        }
      })
  }, [userId, isDemo, weekStart, classes.length])

  // ── Load history when switching to history screen ────────────────────────

  useEffect(() => {
    if (screen !== 'history' && screen !== 'reports') return
    if (isDemo) {
      setTimeout(() => setHistoryData(buildDemoHistory()), 0)
      return
    }
    async function loadHistory() {
      setHistoryLoading(true)
      const { data } = await supabase
        .from('checkins')
        .select(`
          id, status,
          lessons(id, title, date, class_id, classes(id, name)),
          students(id, name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      type RawCheckin = { status: string; lessons: { id: string; title: string; date: string; class_id: string; classes: { name: string } } | null; students: { id: string; name: string } | null }
      const rows: HistoryRow[] = ((data ?? []) as unknown as RawCheckin[]).map(r => ({
        class_id: r.lessons?.class_id ?? '',
        class_name: r.lessons?.classes?.name ?? '',
        student_id: r.students?.id ?? '',
        student_name: r.students?.name ?? '',
        lesson_id: r.lessons?.id ?? '',
        lesson_title: r.lessons?.title ?? '',
        date: r.lessons?.date ?? '',
        status: r.status,
      }))
      setHistoryData(rows)
      setHistoryLoading(false)
    }
    loadHistory()
  }, [screen, userId, isDemo])

  // ── Load plan when navigating to plan screen ─────────────────────────────

  useEffect(() => {
    if (screen !== 'plan' || isDemo) return
    supabase
      .from('week_plans')
      .select('id, week_start, plan_json, tracked_subjects')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSavedPlan({ weekStart: data.week_start, schedule: data.plan_json, trackedSubjects: data.tracked_subjects ?? [], planId: data.id })
      })
  }, [screen, userId, isDemo, weekStart])

  // ── Lesson actions ────────────────────────────────────────────────────────

  async function startLessonByTitle(title: string, date?: string) {
    const lessonDate = date ?? today
    if (isDemo) {
      const found = DEMO_LESSONS.find(l => l.title === title && l.class_id === selectedClassId && l.date === lessonDate)
      setActiveLesson(found ?? { id: 'demo-new', class_id: selectedClassId, date: lessonDate, title })
      // Load demo checkins
      const map: Record<string, Status> = {}
      if (found) {
        for (const c of DEMO_CHECKINS.filter(c => c.lesson_id === found.id)) {
          map[c.student_id] = c.status
        }
      }
      setStudentStatuses(map)
      return
    }

    setLoading(true)
    // Upsert the lesson row
    const { data: existing } = await supabase
      .from('lessons')
      .select('id')
      .eq('class_id', selectedClassId)
      .eq('date', lessonDate)
      .eq('title', title)
      .maybeSingle()

    let lessonId: string
    if (existing) {
      lessonId = existing.id
    } else {
      const { data: inserted } = await supabase
        .from('lessons')
        .insert({ user_id: userId, class_id: selectedClassId, date: lessonDate, title })
        .select('id')
        .single()
      lessonId = inserted?.id ?? ''
    }

    const lesson: AppLesson = { id: lessonId, class_id: selectedClassId, date: lessonDate, title }
    setActiveLesson(lesson)

    // Load existing checkins
    const { data: checkins } = await supabase
      .from('checkins')
      .select('student_id, status')
      .eq('lesson_id', lessonId)
    const map: Record<string, Status> = {}
    for (const c of checkins ?? []) map[c.student_id] = c.status as Status
    setStudentStatuses(map)
    setLoading(false)
  }

  function startLesson() {
    const title = lessonInput.trim()
    if (!title) return
    setExitTickets([])
    setActiveExitTicket(null)
    setShowExitTickets(false)
    startLessonByTitle(title)
  }

  function tap(studentId: string) {
    if (!activeLesson) return
    if (isDemo) {
      setStudentStatuses(cur => {
        const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur[studentId] ?? 'got-it') + 1) % STATUS_CYCLE.length]
        return { ...cur, [studentId]: next }
      })
      return
    }
    setStudentStatuses(cur => {
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur[studentId] ?? 'got-it') + 1) % STATUS_CYCLE.length]
      supabase
        .from('checkins')
        .upsert(
          { user_id: userId, lesson_id: activeLesson.id, student_id: studentId, status: next },
          { onConflict: 'lesson_id,student_id' }
        )
        .then()
      return { ...cur, [studentId]: next }
    })
  }

  // ── Exit tickets ──────────────────────────────────────────────────────────

  async function handleSuggestExitTicket() {
    if (!activeLesson) return
    setExitTicketLoading(true)
    setShowExitTickets(true)
    setActiveExitTicket(null)
    try {
      const todayPlan = activeSubject ? savedPlan?.schedule[today]?.[activeSubject] : undefined
      const tickets = await suggestExitTickets(todayPlan ?? activeLesson.title)
      setExitTickets(tickets)
    } catch {
      setExitTickets(['Could not load suggestions. Check your API key.'])
    } finally {
      setExitTicketLoading(false)
    }
  }

  // ── Week plan ─────────────────────────────────────────────────────────────

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPlanError('')
    try {
      setPlanText(await extractTextFromFile(file))
    } catch {
      setPlanError('Could not read file. Try copy/pasting the text instead.')
    }
    e.target.value = ''
  }

  async function handleSavePlan() {
    if (!planText.trim() || isDemo) return
    setPlanLoading(true)
    setPlanError('')
    setPlanSaved(false)
    try {
      const schedule = await parseLessonPlan(planText, weekStart)
      const found = new Set<string>()
      for (const day of Object.values(schedule)) for (const subj of Object.keys(day)) found.add(subj)
      setPendingSchedule(schedule)
      setSubjectChoices([...found].sort())
      setPlanText('')
    } catch (err) {
      setPlanError(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setPlanLoading(false)
    }
  }

  async function confirmSubjects() {
    if (!pendingSchedule || subjectChoices.length === 0 || isDemo) return
    setPlanSaving(true)
    const filtered: WeekSchedule = {}
    for (const [date, day] of Object.entries(pendingSchedule)) {
      const kept: Record<string, DayLesson> = {}
      for (const subj of subjectChoices) if (day[subj]) kept[subj] = day[subj]
      if (Object.keys(kept).length > 0) filtered[date] = kept
    }
    const { data } = await supabase
      .from('week_plans')
      .upsert({ user_id: userId, week_start: weekStart, plan_json: filtered, tracked_subjects: subjectChoices }, { onConflict: 'user_id,week_start' })
      .select('id')
      .single()
    setSavedPlan({ weekStart, schedule: filtered, trackedSubjects: subjectChoices, planId: data?.id })
    setActiveSubject(subjectChoices[0])
    const todayDay = filtered[today]
    if (todayDay?.[subjectChoices[0]]) setLessonInput(todayDay[subjectChoices[0]].title)
    setPendingSchedule(null)
    setPlanSaving(false)
    setPlanSaved(true)
    setTimeout(() => setPlanSaved(false), 3000)
  }

  async function persistSchedule(schedule: WeekSchedule, snapshot?: WeekSchedule) {
    if (!savedPlan || isDemo) return
    if (snapshot !== undefined) setUndoSnapshot(snapshot)
    setPlanSaving(true)
    await supabase
      .from('week_plans')
      .upsert({ user_id: userId, week_start: weekStart, plan_json: schedule, tracked_subjects: savedPlan.trackedSubjects }, { onConflict: 'user_id,week_start' })
    setSavedPlan({ ...savedPlan, schedule })
    const todayDay = schedule[today]
    const subj = activeSubject ?? savedPlan.trackedSubjects[0]
    if (todayDay?.[subj]) setLessonInput(todayDay[subj].title)
    setPlanSaving(false)
  }

  async function handleUndo() {
    if (!undoSnapshot) return
    await persistSchedule(undoSnapshot)
    setUndoSnapshot(null)
  }

  function startEdit(dateISO: string, subject: string) {
    const lesson = savedPlan?.schedule[dateISO]?.[subject]
    setEditingDay(dateISO)
    setEditSubject(subject)
    setEditDraft(lesson ? { ...lesson } : { title: '', subject, objective: '', activities: '', assessment: '' })
    setExpandedDay(null)
    setSwapSource(null)
  }

  async function saveEdit() {
    if (!savedPlan || !editingDay || !editSubject || !editDraft) return
    const snapshot: WeekSchedule = JSON.parse(JSON.stringify(savedPlan.schedule))
    const schedule: WeekSchedule = JSON.parse(JSON.stringify(savedPlan.schedule))
    if (editDraft.title.trim()) {
      if (!schedule[editingDay]) schedule[editingDay] = {}
      schedule[editingDay][editSubject] = editDraft
    } else {
      if (schedule[editingDay]) {
        delete schedule[editingDay][editSubject]
        if (Object.keys(schedule[editingDay]).length === 0) delete schedule[editingDay]
      }
    }
    setEditingDay(null); setEditSubject(null); setEditDraft(null)
    await persistSchedule(schedule, snapshot)
  }

  async function skipDay(dateISO: string, pushBack: boolean) {
    if (!savedPlan) return
    const snapshot: WeekSchedule = JSON.parse(JSON.stringify(savedPlan.schedule))
    const schedule: WeekSchedule = JSON.parse(JSON.stringify(savedPlan.schedule))
    if (!pushBack) {
      delete schedule[dateISO]
    } else {
      const [y, m, d] = dateISO.split('-').map(Number)
      const skippedDate = new Date(y, m - 1, d)
      const datesToShift = Object.keys(schedule)
        .filter(k => { const [ky, km, kd] = k.split('-').map(Number); return new Date(ky, km - 1, kd) >= skippedDate })
        .sort()
      const shifted: WeekSchedule = {}
      for (const k of datesToShift) {
        shifted[nextISOWeekday(k)] = schedule[k]
      }
      for (const k of datesToShift) delete schedule[k]
      Object.assign(schedule, shifted)
    }
    setExpandedDay(null); setSkipConfirmDay(null)
    await persistSchedule(schedule, snapshot)
  }

  async function handleSwap(dateISO: string) {
    if (!savedPlan) return
    if (!swapSource) { setSwapSource(dateISO); setExpandedDay(null); return }
    if (swapSource === dateISO) { setSwapSource(null); return }
    const snapshot: WeekSchedule = JSON.parse(JSON.stringify(savedPlan.schedule))
    const schedule: WeekSchedule = JSON.parse(JSON.stringify(savedPlan.schedule))
    const a = schedule[swapSource]; const b = schedule[dateISO]
    if (a) schedule[dateISO] = a; else delete schedule[dateISO]
    if (b) schedule[swapSource] = b; else delete schedule[swapSource]
    setSwapSource(null)
    await persistSchedule(schedule, snapshot)
  }

  async function copyToNext(dateISO: string) {
    if (!savedPlan) return
    const day = savedPlan.schedule[dateISO]
    if (!day) return
    const nextISO = nextISOWeekday(dateISO)
    const snapshot: WeekSchedule = JSON.parse(JSON.stringify(savedPlan.schedule))
    const schedule: WeekSchedule = JSON.parse(JSON.stringify(savedPlan.schedule))
    schedule[nextISO] = JSON.parse(JSON.stringify(day))
    setExpandedDay(null)
    await persistSchedule(schedule, snapshot)
  }

  function switchSubject(subject: string) {
    setActiveSubject(subject)
    setExitTickets([]); setActiveExitTicket(null); setShowExitTickets(false)
    const planTitle = savedPlan?.schedule[today]?.[subject]?.title
    if (planTitle) {
      setLessonInput(planTitle)
      startLessonByTitle(planTitle)
    } else {
      setActiveLesson(null); setLessonInput(''); setStudentStatuses({})
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const currentStudents = studentsByClass[selectedClassId] ?? []
  const historyStudents = studentsByClass[historyClassId] ?? []

  const filteredHistory = historyData.filter(r => r.class_id === historyClassId)

  const studentHistoryRows = selectedStudentId
    ? historyData.filter(r => r.student_id === selectedStudentId).sort((a, b) => a.date.localeCompare(b.date))
    : []

  const lessonGroups = useMemo(() => {
    const map = new Map<string, HistoryRow[]>()
    for (const row of filteredHistory) {
      const key = `${row.date}||${row.lesson_id}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(row)
    }
    return [...map.entries()].map(([key, rows]) => {
      const [date] = key.split('||')
      return { date, lesson_id: rows[0].lesson_id, lesson_title: rows[0].lesson_title, rows }
    }).sort((a, b) => b.date.localeCompare(a.date))
  }, [filteredHistory])

  const lessonDetail = selectedLesson
    ? historyData.filter(r => r.lesson_id === selectedLesson.lesson_id)
    : []

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

  function getDateForDayOffset(offset: number) {
    const [y, m, d] = weekStart.split('-').map(Number)
    const dt = new Date(y, m - 1, d + offset)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f0e8' }}>
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f5f0e8' }}>
      {/* Header */}
      <header className="bg-white px-5 py-4 flex items-center justify-between shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800 leading-none">Pulse</h1>
            {isDemo && <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Demo</span>}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Academic Tracker</p>
        </div>
        <div className="flex items-center gap-3">
          {screen === 'tracker' && classes.length > 1 && (
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {classes.map(cls => (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => { setSelectedClassId(cls.id); setActiveLesson(null); setStudentStatuses({}) }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    selectedClassId === cls.id ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {cls.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-3 items-center">
            <button
              type="button"
              onClick={cycleNameFormat}
              title={`Name format: ${nameFormat}`}
              className="text-xs font-semibold text-slate-400 hover:text-teal-600 bg-slate-100 hover:bg-teal-50 px-2.5 py-1 rounded-lg transition-colors"
            >
              {nameFormat === 'full' ? 'Full' : nameFormat === 'first' ? 'First' : 'Init'}
            </button>
            {!isDemo && (
              <button
                type="button"
                onClick={() => { setScreen('plan'); setSelectedStudentId(null); setSelectedLesson(null) }}
                className={`text-sm font-semibold ${screen === 'plan' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Week Plan
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setScreen(screen === 'history' ? 'tracker' : 'history')
                setSelectedStudentId(null)
                setSelectedLesson(null)
              }}
              className={`text-sm font-semibold ${screen === 'history' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {screen === 'history' ? 'Done' : 'History'}
            </button>
            {!isDemo && (
              <button
                type="button"
                onClick={() => setScreen(screen === 'roster' ? 'tracker' : 'roster')}
                className={`text-sm font-semibold ${screen === 'roster' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {screen === 'roster' ? 'Done' : 'Roster'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setScreen(screen === 'reports' ? 'tracker' : 'reports')}
              className={`text-sm font-semibold ${screen === 'reports' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {screen === 'reports' ? 'Done' : 'Reports'}
            </button>
            {(screen === 'plan') && (
              <button type="button" onClick={() => setScreen('tracker')} className="text-sm font-semibold text-slate-400 hover:text-slate-600">Done</button>
            )}
            <button
              type="button"
              onClick={onSignOut}
              className="text-xs text-slate-300 hover:text-slate-500"
            >
              {isDemo ? 'Exit' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      {/* Subject tabs */}
      {screen === 'tracker' && savedPlan && savedPlan.trackedSubjects.length > 1 && (
        <div className="bg-white border-b border-slate-100 px-4 flex gap-0">
          {savedPlan.trackedSubjects.map(subj => (
            <button
              key={subj}
              type="button"
              onClick={() => switchSubject(subj)}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeSubject === subj ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {subj}
            </button>
          ))}
        </div>
      )}

      {/* ── PLAN SCREEN ── */}
      {screen === 'plan' ? (
        <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
          <h2 className="text-base font-bold text-slate-800 mb-1">Weekly Lesson Plan</h2>
          <p className="text-xs text-slate-400 mb-4">{formatWeek(weekStart)}</p>

          {pendingSchedule && (
            <div className="bg-white rounded-2xl shadow-sm px-4 py-4 mb-4">
              <p className="text-sm font-semibold text-slate-700 mb-1">Which subjects do you want to track?</p>
              <p className="text-xs text-slate-400 mb-4">Uncheck any subjects you don't grade (e.g. Health, PE).</p>
              <div className="flex flex-col gap-2 mb-4">
                {(() => {
                  const found = new Set<string>()
                  for (const day of Object.values(pendingSchedule)) for (const subj of Object.keys(day)) found.add(subj)
                  return [...found].sort().map(subj => (
                    <label key={subj} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={subjectChoices.includes(subj)}
                        onChange={e => setSubjectChoices(e.target.checked ? [...subjectChoices, subj] : subjectChoices.filter(s => s !== subj))}
                        className="w-4 h-4 accent-teal-500"
                      />
                      <span className="text-sm font-semibold text-slate-700">{subj}</span>
                    </label>
                  ))
                })()}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={confirmSubjects} disabled={subjectChoices.length === 0 || planSaving} className="flex-1 py-2.5 bg-teal-500 text-white text-sm font-semibold rounded-2xl disabled:opacity-40">
                  {planSaving ? 'Saving…' : `Save with ${subjectChoices.length} subject${subjectChoices.length !== 1 ? 's' : ''}`}
                </button>
                <button type="button" onClick={() => { setPendingSchedule(null); setSubjectChoices([]) }} className="px-4 py-2.5 bg-slate-100 text-slate-500 text-sm font-semibold rounded-2xl">Cancel</button>
              </div>
            </div>
          )}

          {savedPlan && !pendingSchedule ? (
            <div className="bg-white rounded-2xl shadow-sm px-4 py-3 mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide">This week's schedule</p>
                <div className="flex items-center gap-3">
                  {undoSnapshot && !planSaving && (
                    <button type="button" onClick={handleUndo} className="text-xs font-semibold text-slate-500 hover:text-teal-600 underline">↩ Undo</button>
                  )}
                  {swapSource && <p className="text-xs text-amber-600 font-semibold">Tap another day to swap — <button type="button" onClick={() => setSwapSource(null)} className="underline">cancel</button></p>}
                  {planSaving && <p className="text-xs text-slate-400">Saving…</p>}
                </div>
              </div>
              {DAYS.map((dayName, i) => {
                const dateISO = getDateForDayOffset(i)
                const dayLessons = savedPlan.schedule[dateISO] ?? {}
                const isToday = dateISO === today
                const isExpanded = expandedDay === dateISO
                const isEditing = editingDay === dateISO
                const isSwapSource = swapSource === dateISO
                const subjects = savedPlan.trackedSubjects.filter(s => dayLessons[s])

                if (isEditing && editDraft && editSubject) {
                  return (
                    <div key={dayName} className="border-b border-slate-50 last:border-0 py-3">
                      <p className="text-xs font-semibold text-teal-600 mb-0.5">{dayName}</p>
                      <p className="text-xs text-slate-400 mb-2">{editSubject}</p>
                      <div className="flex flex-col gap-2">
                        {(['title', 'objective', 'activities', 'assessment'] as (keyof DayLesson)[]).filter(f => f !== 'subject').map(field => (
                          <div key={field}>
                            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">{field}</p>
                            {field !== 'title' ? (
                              <textarea value={editDraft[field]} onChange={e => setEditDraft({ ...editDraft, [field]: e.target.value })} rows={2} className="w-full text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300 resize-none" />
                            ) : (
                              <input type="text" value={editDraft[field]} onChange={e => setEditDraft({ ...editDraft, [field]: e.target.value })} className="w-full text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300" />
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button type="button" onClick={saveEdit} className="px-4 py-1.5 bg-teal-500 text-white text-xs font-semibold rounded-xl">Save</button>
                        <button type="button" onClick={() => { setEditingDay(null); setEditSubject(null); setEditDraft(null) }} className="px-4 py-1.5 bg-slate-100 text-slate-500 text-xs font-semibold rounded-xl">Cancel</button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={dayName} className={`border-b border-slate-50 last:border-0 ${isToday ? 'bg-teal-50 -mx-4 px-4' : ''} ${isSwapSource ? 'bg-amber-50 -mx-4 px-4' : ''}`}>
                    <button type="button" onClick={() => { if (swapSource) { handleSwap(dateISO); return } setExpandedDay(isExpanded ? null : dateISO) }} className="flex items-start gap-3 py-2.5 w-full text-left">
                      <span className={`text-xs font-semibold w-10 shrink-0 mt-0.5 ${isToday ? 'text-teal-600' : isSwapSource ? 'text-amber-500' : 'text-slate-400'}`}>{dayName.slice(0, 3)}</span>
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        {subjects.length > 0 ? subjects.map(subj => (
                          <div key={subj} className="flex items-baseline gap-2">
                            <span className="text-xs font-semibold text-slate-400 w-14 shrink-0">{subj}</span>
                            <span className="text-sm font-semibold text-slate-700 truncate">{dayLessons[subj].title}</span>
                          </div>
                        )) : <span className="text-slate-300 italic text-sm">No lesson</span>}
                      </div>
                      {!swapSource && <span className="text-slate-300 text-xs mt-0.5">{isExpanded ? '▲' : '▼'}</span>}
                    </button>
                    {isExpanded && !swapSource && (
                      <div className="pb-3 flex flex-col gap-4" style={{ paddingLeft: '3.25rem' }}>
                        {subjects.map(subj => {
                          const lesson = dayLessons[subj]
                          return (
                            <div key={subj}>
                              <p className="text-xs font-bold text-teal-600 mb-1.5">{subj}</p>
                              <div className="flex flex-col gap-1.5">
                                {(['objective', 'activities', 'assessment'] as const).map(f => (
                                  <div key={f}>
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{f}</p>
                                    <p className="text-sm text-slate-700">{lesson[f]}</p>
                                  </div>
                                ))}
                              </div>
                              <button type="button" onClick={() => startEdit(dateISO, subj)} className="mt-2 text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-teal-50 hover:text-teal-700">✏️ Edit {subj}</button>
                            </div>
                          )
                        })}
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => handleSwap(dateISO)} className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-amber-50 hover:text-amber-700">⇄ Swap day</button>
                          {subjects.length > 0 && <button type="button" onClick={() => copyToNext(dateISO)} className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-700">→ Copy to next day</button>}
                          {subjects.length > 0 && skipConfirmDay !== dateISO && (
                            <button type="button" onClick={() => setSkipConfirmDay(dateISO)} className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-red-400 rounded-xl hover:bg-red-50">✕ Skip day</button>
                          )}
                          {subjects.length > 0 && skipConfirmDay === dateISO && (
                            <div className="flex flex-col gap-1.5 w-full mt-1">
                              <p className="text-xs text-slate-500 font-semibold">Skip how?</p>
                              <button type="button" onClick={() => skipDay(dateISO, false)} className="text-xs font-semibold px-3 py-1.5 bg-red-50 text-red-500 rounded-xl text-left">✕ Just remove this day</button>
                              <button type="button" onClick={() => skipDay(dateISO, true)} className="text-xs font-semibold px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-left">⇩ Remove and push remaining days back</button>
                              <button type="button" onClick={() => setSkipConfirmDay(null)} className="text-xs text-slate-400 px-1">cancel</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              <button type="button" onClick={() => { setSavedPlan(null); setExpandedDay(null); setEditingDay(null); setEditSubject(null); setSwapSource(null) }} className="text-xs text-slate-400 hover:text-slate-600 mt-3">Upload new plan</button>
            </div>
          ) : !pendingSchedule ? (
            <>
              <div className="bg-white rounded-2xl shadow-sm px-4 py-4 mb-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">Upload or paste your lesson plan</p>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-slate-200 rounded-xl py-3 text-sm text-slate-500 hover:border-teal-300 hover:text-teal-600 transition-colors mb-3">
                  📎 Upload PDF, Word, or text file
                </button>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileUpload} />
                <textarea value={planText} onChange={e => setPlanText(e.target.value)} placeholder={"Or paste your lesson plan here…\n\nMonday: Fractions — Adding Unlike Denominators\nTuesday: Fractions — Subtracting\n…"} rows={8} className="w-full text-sm bg-slate-50 rounded-xl px-4 py-3 outline-none text-slate-700 placeholder-slate-300 resize-none border border-slate-100 focus:border-teal-300" />
                {planError && <p className="text-xs text-red-500 mt-2">{planError}</p>}
              </div>
              <button type="button" onClick={handleSavePlan} disabled={!planText.trim() || planLoading} className="w-full py-3 bg-teal-500 text-white text-sm font-semibold rounded-2xl disabled:opacity-40">
                {planLoading ? 'Analyzing with AI…' : "Save this week's plan"}
              </button>
              {planSaved && <p className="text-xs text-emerald-600 text-center mt-3 font-semibold">✓ Plan saved! Today's lesson was auto-filled.</p>}
            </>
          ) : null}
        </main>

      ) : screen === 'tracker' ? (
        <>
          {/* Lesson bar */}
          <div className="bg-white border-t border-slate-100 px-4 py-3 flex gap-2 items-center shadow-sm">
            {activeLesson ? (
              <div className="flex items-center gap-3 w-full">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 leading-none mb-0.5">Today's lesson</p>
                  <p className="text-sm font-semibold text-slate-700 truncate">{activeLesson.title}</p>
                </div>
                {!isDemo && (
                  <button type="button" onClick={handleSuggestExitTicket} disabled={exitTicketLoading} className="text-xs font-semibold text-amber-600 hover:text-amber-700 shrink-0 bg-amber-50 px-3 py-1.5 rounded-xl">
                    {exitTicketLoading ? '…' : '💡 Exit Ticket'}
                  </button>
                )}
                <button type="button" onClick={() => { setActiveLesson(null); setLessonInput(''); setExitTickets([]); setActiveExitTicket(null); setShowExitTickets(false) }} className="text-xs text-slate-400 hover:text-slate-600 shrink-0">
                  Change
                </button>
              </div>
            ) : (() => {
              const planLessons = activeSubject && savedPlan
                ? Object.entries(savedPlan.schedule)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .flatMap(([date, day]) => day[activeSubject] ? [{ date, title: day[activeSubject].title }] : [])
                : []
              return planLessons.length > 0 ? (
                <div className="w-full">
                  <p className="text-xs text-slate-400 mb-2">Pick a lesson:</p>
                  <div className="flex flex-col gap-1.5">
                    {planLessons.map(({ date, title }) => (
                      <button key={date} type="button"
                        onClick={() => { setLessonInput(title); startLessonByTitle(title, date) }}
                        className="text-left px-4 py-2 bg-slate-100 rounded-xl text-sm font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-700 flex items-center justify-between"
                      >
                        <span>{title}</span>
                        <span className="text-xs text-slate-400 font-normal ml-2 shrink-0">{formatDate(date)}</span>
                      </button>
                    ))}
                    <div className="flex gap-2 mt-1">
                      <input type="text" value={lessonInput} onChange={e => setLessonInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && startLesson()} placeholder="Or type a custom lesson…" className="flex-1 text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none text-slate-700 placeholder-slate-300 border border-slate-100 focus:border-teal-300" />
                      <button type="button" onClick={startLesson} disabled={!lessonInput.trim()} className="px-4 py-2 bg-teal-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40 shrink-0">Start</button>
                    </div>
                  </div>
                </div>
              ) : isDemo ? (
                <div className="w-full">
                  <p className="text-xs text-slate-400 mb-2">Pick a demo lesson:</p>
                  <div className="flex flex-col gap-1.5">
                    {DEMO_LESSONS.filter(l => l.class_id === selectedClassId).map(l => (
                      <button key={l.id} type="button"
                        onClick={() => { setLessonInput(l.title); startLessonByTitle(l.title, l.date) }}
                        className="text-left px-4 py-2 bg-slate-100 rounded-xl text-sm font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-700 flex items-center justify-between"
                      >
                        <span>{l.title}</span>
                        <span className="text-xs text-slate-400 font-normal ml-2 shrink-0">{formatDate(l.date)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <input type="text" value={lessonInput} onChange={e => setLessonInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && startLesson()} placeholder="What are you teaching today?" className="flex-1 text-sm bg-slate-100 rounded-xl px-4 py-2 outline-none text-slate-700 placeholder-slate-400" />
                  <button type="button" onClick={startLesson} disabled={!lessonInput.trim()} className="px-4 py-2 bg-teal-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40 shrink-0">Start</button>
                </>
              )
            })()}
          </div>

          {/* Exit ticket panel */}
          {showExitTickets && activeLesson && !isDemo && (
            <div className="bg-amber-50 border-b border-amber-100 px-4 py-3">
              {exitTicketLoading ? (
                <p className="text-xs text-amber-500 text-center">Generating exit tickets…</p>
              ) : activeExitTicket ? (
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Active Exit Ticket</p>
                    <p className="text-sm font-semibold text-slate-800">{activeExitTicket}</p>
                  </div>
                  <button type="button" onClick={() => { setActiveExitTicket(null); setShowExitTickets(false) }} className="text-xs text-slate-400 hover:text-slate-600 shrink-0 mt-0.5">✕</button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-amber-700">Pick an exit ticket:</p>
                    <button type="button" onClick={() => setShowExitTickets(false)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {exitTickets.map((t, i) => (
                      <button key={i} type="button" onClick={() => setActiveExitTicket(t)} className="text-left text-sm text-slate-700 bg-white rounded-xl px-3 py-2 shadow-sm hover:bg-amber-50 hover:text-amber-700">{t}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Student grid */}
          <main className="flex-1 px-4 py-5">
            {!activeLesson ? (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
                {currentStudents.length === 0 ? 'No students in this class yet.' : 'Select a lesson to begin.'}
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading…</div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {currentStudents.map(student => {
                  const status = studentStatuses[student.id] ?? 'got-it'
                  const initial = student.name.trim()[0].toUpperCase()
                  const displayName = formatStudentName(student.name, nameFormat, currentStudents.map(s => s.name))
                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => tap(student.id)}
                      className="flex flex-col items-center gap-2 bg-white rounded-2xl py-3 px-1 shadow-sm active:scale-95 transition-transform relative"
                    >
                      <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${STATUS_INITIAL_BG[status]} ${STATUS_RING[status]}`}>
                        {initial}
                      </div>
                      <span className="text-xs font-semibold text-slate-700 leading-tight text-center px-1">{displayName}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </main>
        </>

      ) : (
        /* ── HISTORY SCREEN ── */
        <main className="flex-1 flex flex-col">
          <div className="bg-white border-t border-slate-100 px-4 pt-3 pb-0 shadow-sm flex items-end justify-between">
            <div className="flex gap-0">
              {(['student', 'lesson'] as HistoryTab[]).map(tab => (
                <button key={tab} type="button"
                  onClick={() => { setHistoryTab(tab); setSelectedStudentId(null); setSelectedLesson(null) }}
                  className={`px-5 py-2 text-sm font-semibold border-b-2 transition-colors capitalize ${historyTab === tab ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  By {tab}
                </button>
              ))}
            </div>
            {classes.length > 1 && (
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-2">
                {classes.map(cls => (
                  <button key={cls.id} type="button"
                    onClick={() => { setHistoryClassId(cls.id); setSelectedStudentId(null); setSelectedLesson(null) }}
                    className={`px-4 py-1 rounded-lg text-xs font-semibold transition-all ${historyClassId === cls.id ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {cls.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 px-4 py-4 overflow-auto">
            {historyLoading ? (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading…</div>
            ) : historyTab === 'student' ? (
              selectedStudentId ? (
                <div>
                  <button type="button" onClick={() => setSelectedStudentId(null)} className="text-sm text-teal-600 mb-3 flex items-center gap-1">← All students</button>
                  <h2 className="text-base font-bold text-slate-800 mb-3">
                    {formatStudentName(historyStudents.find(s => s.id === selectedStudentId)?.name ?? '', nameFormat, historyStudents.map(s => s.name))}
                  </h2>
                  {studentHistoryRows.length === 0 ? (
                    <p className="text-slate-400 text-sm">No data yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {studentHistoryRows.map((row, i) => (
                        <div key={i} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{row.lesson_title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{formatDate(row.date)} · {row.class_name}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_PILL[row.status as Status]}`}>{STATUS_LABEL[row.status as Status]}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {historyStudents.map(s => {
                    const rows = filteredHistory.filter(r => r.student_id === s.id)
                    const needsHelp = rows.filter(r => r.status === 'needs-help').length
                    const almost = rows.filter(r => r.status === 'almost').length
                    return (
                      <button key={s.id} type="button" onClick={() => setSelectedStudentId(s.id)} className="bg-white rounded-2xl px-3 py-3 shadow-sm flex flex-col items-center text-center gap-1">
                        <p className="text-sm font-semibold text-slate-700 leading-tight">{formatStudentName(s.name, nameFormat, historyStudents.map(x => x.name))}</p>
                        <p className="text-xs text-slate-400">{rows.length} lesson{rows.length !== 1 ? 's' : ''}</p>
                        <div className="flex flex-wrap justify-center gap-1 mt-0.5">
                          {needsHelp > 0 && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">{needsHelp} ⚠</span>}
                          {almost > 0 && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{almost} ~</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            ) : (
              selectedLesson ? (
                <div>
                  <button type="button" onClick={() => setSelectedLesson(null)} className="text-sm text-teal-600 mb-3 flex items-center gap-1">← All lessons</button>
                  <div className="mb-3">
                    <h2 className="text-base font-bold text-slate-800">{selectedLesson.lesson_title}</h2>
                    <p className="text-xs text-slate-400">{formatDate(selectedLesson.date)}</p>
                  </div>
                  {lessonDetail.length === 0 ? (
                    <p className="text-slate-400 text-sm">No data.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {lessonDetail.sort((a, b) => a.student_name.localeCompare(b.student_name)).map((row, i) => (
                        <div key={i} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">{formatStudentName(row.student_name, nameFormat, historyStudents.map(s => s.name))}</p>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_PILL[row.status as Status]}`}>{STATUS_LABEL[row.status as Status]}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {lessonGroups.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center mt-10">No history yet.</p>
                  ) : lessonGroups.map((g, i) => {
                    const needsHelp = g.rows.filter(r => r.status === 'needs-help').length
                    const almost = g.rows.filter(r => r.status === 'almost').length
                    const gotIt = g.rows.filter(r => r.status === 'got-it').length
                    return (
                      <button key={i} type="button" onClick={() => setSelectedLesson({ lesson_id: g.lesson_id, lesson_title: g.lesson_title, date: g.date })} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between text-left">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">{g.lesson_title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{formatDate(g.date)} · {g.rows.length} student{g.rows.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end max-w-32">
                          {gotIt > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{gotIt} ✓</span>}
                          {almost > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{almost} ~</span>}
                          {needsHelp > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">{needsHelp} ✗</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            )}
          </div>
        </main>
      )}

      {/* ── REPORTS SCREEN ── */}
      {screen === 'reports' && (
        <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
          <h2 className="text-base font-bold text-slate-800 mb-4">Student Support Report</h2>

          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-sm px-4 py-4 mb-4 flex flex-col gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Class</p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setReportClassId('all')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${reportClassId === 'all' ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>All classes</button>
                {classes.map(cls => (
                  <button key={cls.id} type="button" onClick={() => setReportClassId(cls.id)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${reportClassId === cls.id ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>{cls.name}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Time period</p>
              <div className="flex flex-wrap gap-1.5">
                {([['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['custom', 'Custom range'], ['all', 'All time']] as [ReportRange, string][]).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setReportRange(val)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${reportRange === val ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>{label}</button>
                ))}
              </div>
              {reportRange === 'custom' && (
                <div className="flex gap-2 mt-2">
                  <div className="flex-1">
                    <p className="text-xs text-slate-400 mb-0.5">From</p>
                    <input type="date" value={reportCustomStart} onChange={e => setReportCustomStart(e.target.value)} className="w-full text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-400 mb-0.5">To</p>
                    <input type="date" value={reportCustomEnd} onChange={e => setReportCustomEnd(e.target.value)} className="w-full text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          {reportData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm">No students flagged for this period.</p>
              <p className="text-slate-300 text-xs mt-1">Everyone got it, or no data yet.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 mb-5">
                {reportData.map(cls => (
                  <div key={cls.classId} className="bg-white rounded-2xl shadow-sm px-4 py-4">
                    <p className="text-sm font-bold text-slate-800 mb-3">{cls.className}</p>

                    {cls.needsSupport.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                          <p className="text-xs font-bold text-red-600 uppercase tracking-wide">Needs Support</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          {cls.needsSupport.map(s => {
                            const topics = [...new Set(s.lessons.filter(l => l.status === 'needs-help').map(l => l.title))]
                            return (
                              <div key={s.id} className="pl-4">
                                <p className="text-sm font-semibold text-slate-700">{s.name}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{topics.join(' · ')}</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {cls.checkIn.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                          <p className="text-xs font-bold text-yellow-600 uppercase tracking-wide">Worth a Check-In</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          {cls.checkIn.map(s => {
                            const topics = [...new Set(s.lessons.map(l => l.title))]
                            return (
                              <div key={s.id} className="pl-4">
                                <p className="text-sm font-semibold text-slate-700">{s.name}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{topics.join(' · ')}</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button type="button" onClick={copyReport} className="w-full py-3 bg-teal-500 text-white text-sm font-semibold rounded-2xl active:scale-95 transition-transform">
                {reportCopied ? '✓ Copied to clipboard' : 'Copy report'}
              </button>
            </>
          )}
        </main>
      )}

      {/* ── ROSTER SCREEN ── */}
      {screen === 'roster' && (
        <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-800">Roster</h2>
            {classes.length < 6 && !rosterAddingClass && (
              <button type="button" onClick={() => setRosterAddingClass(true)} className="text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 px-3 py-1.5 rounded-xl">
                + Add class
              </button>
            )}
          </div>

          {rosterAddingClass && (
            <div className="bg-white rounded-2xl shadow-sm px-4 py-4 mb-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">New class</p>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={rosterNewClassName}
                  onChange={e => setRosterNewClassName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && rosterAddClass()}
                  placeholder="Class name (e.g. Period 1)"
                  className="text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300"
                />
                <select
                  value={rosterNewClassSubject}
                  onChange={e => setRosterNewClassSubject(e.target.value)}
                  className="text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300"
                >
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={rosterAddClass} disabled={!rosterNewClassName.trim() || rosterSaving} className="px-4 py-2 bg-teal-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40">
                  {rosterSaving ? 'Saving…' : 'Add'}
                </button>
                <button type="button" onClick={() => { setRosterAddingClass(false); setRosterNewClassName('') }} className="px-4 py-2 bg-slate-100 text-slate-500 text-sm font-semibold rounded-xl">Cancel</button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {classes.map(cls => {
              const students = studentsByClass[cls.id] ?? []
              const isRenaming = rosterRenaming === cls.id
              return (
                <div key={cls.id} className="bg-white rounded-2xl shadow-sm px-4 py-4">
                  {isRenaming ? (
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={rosterRenameValue}
                        onChange={e => setRosterRenameValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && rosterRenameClass(cls.id)}
                        autoFocus
                        className="flex-1 text-sm bg-slate-50 rounded-xl px-3 py-1.5 outline-none border border-slate-100 focus:border-teal-300 font-semibold"
                      />
                      <button type="button" onClick={() => rosterRenameClass(cls.id)} disabled={rosterSaving} className="px-3 py-1.5 bg-teal-500 text-white text-xs font-semibold rounded-xl disabled:opacity-40">Save</button>
                      <button type="button" onClick={() => setRosterRenaming(null)} className="px-3 py-1.5 bg-slate-100 text-slate-500 text-xs font-semibold rounded-xl">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{cls.name}</p>
                        <p className="text-xs text-slate-400">{cls.subject} · {students.length} student{students.length !== 1 ? 's' : ''}</p>
                      </div>
                      <button type="button" onClick={() => { setRosterRenaming(cls.id); setRosterRenameValue(cls.name) }} className="text-xs text-slate-400 hover:text-teal-600">Rename</button>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 mb-3">
                    {students.length === 0 && <p className="text-xs text-slate-300 italic">No students yet.</p>}
                    {students.map(s => (
                      <div key={s.id} className="flex items-center justify-between py-1">
                        <span className="text-sm text-slate-700">{s.name}</span>
                        {rosterConfirmRemove?.studentId === s.id && rosterConfirmRemove?.classId === cls.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Remove?</span>
                            <button type="button" onClick={() => rosterRemoveStudent(s.id, cls.id)} disabled={rosterSaving} className="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-40">Yes</button>
                            <button type="button" onClick={() => setRosterConfirmRemove(null)} className="text-xs text-slate-400 hover:text-slate-600">No</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setRosterConfirmRemove({ studentId: s.id, classId: cls.id })} className="text-xs text-slate-300 hover:text-red-400">✕</button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={rosterNewStudentName[cls.id] ?? ''}
                      onChange={e => setRosterNewStudentName(cur => ({ ...cur, [cls.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && rosterAddStudent(cls.id)}
                      placeholder="Add student…"
                      className="flex-1 text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300"
                    />
                    <button type="button" onClick={() => rosterAddStudent(cls.id)} disabled={!(rosterNewStudentName[cls.id] ?? '').trim() || rosterSaving} className="px-3 py-2 bg-teal-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40">
                      Add
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </main>
      )}
    </div>
  )
}
