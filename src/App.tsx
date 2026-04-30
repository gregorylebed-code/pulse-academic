import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { parseLessonPlan, suggestExitTickets, type DayLesson, type WeekSchedule } from './lib/groq'

type ClassName = 'AM' | 'PM'
type Status = 'got-it' | 'almost' | 'needs-help'
type Screen = 'tracker' | 'history' | 'plan'
type HistoryTab = 'student' | 'lesson'

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

const classes: Record<ClassName, string[]> = {
  'AM': [
    'Rian B.', 'Ryleigh C.', 'Luciano D.', 'Carter H.', 'Jaron K.',
    'Gemma K.', 'Sammie L.', 'Charlotte M.', 'Graci P.', 'Sloan R.',
    'Grayson R.', 'Julianna S.', 'Lily S.', 'Ava T.', 'Eloise T.', 'Alexa W.',
  ],
  'PM': [
    'Ire A.', 'Olivia A.', 'Carter A.', 'Ella C.', 'Legacy C.', 'Jovie D.',
    'Logan D.', 'Charles F.', 'Olivia G.', 'Grayson G.', 'Isabella G.',
    'AdaBella H.', 'Trey H.', 'Ezra K.', 'Giada L.', 'Luca L.', 'Riley M.',
    'Julia N.', 'Michael R.', 'Reagan S.', 'William S.', 'Chase S.', 'Emmett V.', 'Chase W.',
  ],
}

const allStudents = [
  ...classes.AM.map(s => ({ name: s, class: 'AM' as ClassName })),
  ...classes.PM.map(s => ({ name: s, class: 'PM' as ClassName })),
]

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

type NameFormat = 'full' | 'first' | 'initials'

function formatStudentName(fullName: string, format: NameFormat, classmates: string[]): string {
  const parts = fullName.trim().split(/\s+/)
  const first = parts[0]
  const rest = parts.slice(1)
  const lastInitial = rest.length > 0 ? rest[rest.length - 1][0].toUpperCase() + '.' : ''

  if (format === 'full') return fullName

  if (format === 'initials') {
    const initials = parts.map(p => p[0].toUpperCase()).join('.')
    return initials + '.'
  }

  // format === 'first' — show first name, add last initial only if another classmate shares the first name
  const dupFirst = classmates.filter(n => n.trim().split(/\s+/)[0] === first && n !== fullName)
  if (dupFirst.length === 0 || !lastInitial) return first
  // Check if disambiguation by last initial is sufficient
  const dupFirstAndLast = dupFirst.filter(n => {
    const p = n.trim().split(/\s+/)
    return p.length > 1 && p[p.length - 1][0].toUpperCase() + '.' === lastInitial
  })
  if (dupFirstAndLast.length === 0) return `${first} ${lastInitial}`
  // Same first + last initial — add (2)
  return `${first} ${lastInitial} (2)`
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

type HistoryRow = { class: string; student: string; lesson: string; date: string; status: string }

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

function App() {
  const classNames = useMemo(() => Object.keys(classes) as ClassName[], [])
  const [screen, setScreen] = useState<Screen>('tracker')
  const [selectedClass, setSelectedClass] = useState<ClassName>('AM')
  const [lessonInput, setLessonInput] = useState('')
  const [activeLesson, setActiveLesson] = useState('')
  const [studentStatuses, setStudentStatuses] = useState<Record<string, Status>>({})
  const [loading, setLoading] = useState(false)
  const [todaysLessons, setTodaysLessons] = useState<string[]>([])

  // Exit ticket state
  const [exitTickets, setExitTickets] = useState<string[]>([])
  const [exitTicketLoading, setExitTicketLoading] = useState(false)
  const [activeExitTicket, setActiveExitTicket] = useState<string | null>(null)
  const [showExitTickets, setShowExitTickets] = useState(false)

  // Lesson plan state
  const [planText, setPlanText] = useState('')
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState('')
  const [savedPlan, setSavedPlan] = useState<{ weekStart: string; schedule: WeekSchedule; trackedSubjects: string[] } | null>(null)
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
  // Subject picker after upload
  const [pendingSchedule, setPendingSchedule] = useState<WeekSchedule | null>(null)
  const [subjectChoices, setSubjectChoices] = useState<string[]>([])
  // Active subject tab on tracker
  const [activeSubject, setActiveSubject] = useState<string | null>(null)
  // Editing a past (or future) lesson — overrides today
  const [editingHistory, setEditingHistory] = useState<{ lesson: string; date: string; className: ClassName } | null>(null)

  const [nameFormat, setNameFormat] = useState<NameFormat>(() =>
    (localStorage.getItem('nameFormat') as NameFormat) ?? 'first'
  )
  function cycleNameFormat() {
    const next: NameFormat = nameFormat === 'full' ? 'first' : nameFormat === 'first' ? 'initials' : 'full'
    setNameFormat(next)
    localStorage.setItem('nameFormat', next)
  }

  // History state
  const [historyTab, setHistoryTab] = useState<HistoryTab>('student')
  const [historyClass, setHistoryClass] = useState<ClassName>('AM')
  const [historyData, setHistoryData] = useState<HistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<{ lesson: string; date: string } | null>(null)

  const today = todayISO()
  const weekStart = getWeekStart(today)

  // On mount: load this week's lesson plan and restore today's active lesson
  useEffect(() => {
    supabase
      .from('lesson_plans')
      .select('week_start, schedule, tracked_subjects')
      .eq('week_start', weekStart)
      .maybeSingle()
      .then(({ data }: { data: { week_start: string; schedule: WeekSchedule; tracked_subjects: string[] } | null }) => {
        if (data) {
          const tracked = data.tracked_subjects ?? []
          setSavedPlan({ weekStart: data.week_start, schedule: data.schedule, trackedSubjects: tracked })
          if (tracked.length > 0) setActiveSubject(tracked[0])
          const todayDay = data.schedule[today]
          const firstSubject = tracked[0]
          if (todayDay && firstSubject && todayDay[firstSubject]) setLessonInput(todayDay[firstSubject].title)
        }
      })

    setLoading(true)
    supabase
      .from('student_statuses')
      .select('lesson, subject')
      .eq('date', today)
      .then(({ data }: { data: { lesson: string; subject: string | null }[] | null }) => {
        if (!data || data.length === 0) { setLoading(false); return }
        const lessons = [...new Set(data.map(r => r.lesson))]
        if (lessons.length === 1) {
          setActiveLesson(lessons[0])
          setLessonInput(lessons[0])
        } else {
          setTodaysLessons(lessons)
          setLoading(false)
        }
      })
  }, [today, weekStart])

  // Load statuses whenever active lesson changes
  useEffect(() => {
    if (!activeLesson) return
    setLoading(true)
    supabase
      .from('student_statuses')
      .select('class, student, status')
      .eq('lesson', activeLesson)
      .eq('date', today)
      .then(({ data }: { data: { class: string; student: string; status: string }[] | null }) => {
        const map: Record<string, Status> = {}
        if (data) {
          for (const row of data) {
            map[`${row.class}-${row.student}`] = row.status as Status
          }
        }
        setStudentStatuses(map)
        setLoading(false)
      })
  }, [activeLesson, today])

  // Load history when switching to history screen
  useEffect(() => {
    if (screen !== 'history') return
    setHistoryLoading(true)
    supabase
      .from('student_statuses')
      .select('class, student, lesson, date, status')
      .order('date', { ascending: false })
      .then(({ data }: { data: HistoryRow[] | null }) => {
        setHistoryData(data ?? [])
        setHistoryLoading(false)
      })
  }, [screen])

  // Load plan when navigating to plan screen
  useEffect(() => {
    if (screen !== 'plan') return
    supabase
      .from('lesson_plans')
      .select('week_start, schedule, tracked_subjects')
      .eq('week_start', weekStart)
      .maybeSingle()
      .then(({ data }: { data: { week_start: string; schedule: WeekSchedule; tracked_subjects: string[] } | null }) => {
        if (data) setSavedPlan({ weekStart: data.week_start, schedule: data.schedule, trackedSubjects: data.tracked_subjects ?? [] })
      })
  }, [screen, weekStart])

  function startLesson() {
    const lesson = lessonInput.trim()
    if (!lesson) return
    setActiveLesson(lesson)
    setStudentStatuses({})
    setExitTickets([])
    setActiveExitTicket(null)
    setShowExitTickets(false)
  }

  function switchSubject(subject: string) {
    setActiveSubject(subject)
    setExitTickets([])
    setActiveExitTicket(null)
    setShowExitTickets(false)
    setTodaysLessons([])
    // Auto-start from plan if available, otherwise clear for manual entry
    const planTitle = savedPlan?.schedule[today]?.[subject]?.title
    if (planTitle) {
      setLessonInput(planTitle)
      setActiveLesson(planTitle)
      setStudentStatuses({})
      // Load any statuses already recorded for this lesson today
      setLoading(true)
      supabase
        .from('student_statuses')
        .select('class, student, status')
        .eq('lesson', planTitle)
        .eq('date', today)
        .then(({ data }: { data: { class: string; student: string; status: string }[] | null }) => {
          const map: Record<string, Status> = {}
          if (data) for (const row of data) map[`${row.class}-${row.student}`] = row.status as Status
          setStudentStatuses(map)
          setLoading(false)
        })
    } else {
      setActiveLesson('')
      setLessonInput('')
      setStudentStatuses({})
    }
  }

  function tap(key: string, className: ClassName, student: string) {
    const lessonDate = editingHistory?.date ?? today
    const lessonName = editingHistory?.lesson ?? activeLesson
    setStudentStatuses(current => {
      const cur = current[key] ?? 'got-it'
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length]
      supabase
        .from('student_statuses')
        .upsert(
          { class: className, student, lesson: lessonName, date: lessonDate, status: next, subject: activeSubject },
          { onConflict: 'class,student,lesson,date' }
        )
        .then()
      return { ...current, [key]: next }
    })
  }

  function openHistoryEdit(lesson: string, date: string, className: ClassName) {
    setEditingHistory({ lesson, date, className })
    setSelectedClass(className)
    setScreen('tracker')
    setActiveLesson(lesson)
    setLessonInput(lesson)
    setStudentStatuses({})
    setLoading(true)
    supabase
      .from('student_statuses')
      .select('class, student, status')
      .eq('lesson', lesson)
      .eq('date', date)
      .then(({ data }: { data: { class: string; student: string; status: string }[] | null }) => {
        const map: Record<string, Status> = {}
        if (data) for (const row of data) map[`${row.class}-${row.student}`] = row.status as Status
        setStudentStatuses(map)
        setLoading(false)
      })
  }

  function closeHistoryEdit() {
    setEditingHistory(null)
    setActiveLesson('')
    setLessonInput('')
    setStudentStatuses({})
    setScreen('history')
  }

  async function handleSuggestExitTicket() {
    if (!activeLesson) return
    setExitTicketLoading(true)
    setShowExitTickets(true)
    setActiveExitTicket(null)
    try {
      const todayPlan = activeSubject ? savedPlan?.schedule[today]?.[activeSubject] : undefined
      const tickets = await suggestExitTickets(todayPlan ?? activeLesson)
      setExitTickets(tickets)
    } catch {
      setExitTickets(['Could not load suggestions. Check your API key.'])
    } finally {
      setExitTicketLoading(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPlanError('')
    try {
      const text = await extractTextFromFile(file)
      setPlanText(text)
    } catch {
      setPlanError('Could not read file. Try copy/pasting the text instead.')
    }
    e.target.value = ''
  }

  async function handleSavePlan() {
    if (!planText.trim()) return
    setPlanLoading(true)
    setPlanError('')
    setPlanSaved(false)
    try {
      const schedule = await parseLessonPlan(planText, weekStart)
      // Collect all unique subjects found across the week
      const found = new Set<string>()
      for (const day of Object.values(schedule)) {
        for (const subject of Object.keys(day)) found.add(subject)
      }
      const allSubjects = [...found].sort()
      setPendingSchedule(schedule)
      // Pre-select all subjects so teacher just unchecks what they don't want
      setSubjectChoices(allSubjects)
      setPlanText('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setPlanError(`Error: ${msg}`)
      console.error(err)
    } finally {
      setPlanLoading(false)
    }
  }

  async function confirmSubjects() {
    if (!pendingSchedule || subjectChoices.length === 0) return
    setPlanSaving(true)
    // Filter schedule to only tracked subjects
    const filtered: WeekSchedule = {}
    for (const [date, day] of Object.entries(pendingSchedule)) {
      const kept: Record<string, DayLesson> = {}
      for (const subj of subjectChoices) {
        if (day[subj]) kept[subj] = day[subj]
      }
      if (Object.keys(kept).length > 0) filtered[date] = kept
    }
    await supabase
      .from('lesson_plans')
      .upsert({ week_start: weekStart, schedule: filtered, tracked_subjects: subjectChoices }, { onConflict: 'week_start' })
    setSavedPlan({ weekStart, schedule: filtered, trackedSubjects: subjectChoices })
    setActiveSubject(subjectChoices[0])
    const todayDay = filtered[today]
    if (todayDay?.[subjectChoices[0]]) setLessonInput(todayDay[subjectChoices[0]].title)
    setPendingSchedule(null)
    setPlanSaving(false)
    setPlanSaved(true)
    setTimeout(() => setPlanSaved(false), 3000)
  }

  async function persistSchedule(schedule: WeekSchedule, snapshot?: WeekSchedule) {
    if (!savedPlan) return
    if (snapshot !== undefined) setUndoSnapshot(snapshot)
    setPlanSaving(true)
    await supabase
      .from('lesson_plans')
      .upsert({ week_start: weekStart, schedule, tracked_subjects: savedPlan.trackedSubjects }, { onConflict: 'week_start' })
    setSavedPlan({ weekStart, schedule, trackedSubjects: savedPlan.trackedSubjects })
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
    setEditingDay(null)
    setEditSubject(null)
    setEditDraft(null)
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
        const [ky, km, kd] = k.split('-').map(Number)
        const next = new Date(ky, km - 1, kd + 1)
        if (next.getDay() === 6) next.setDate(next.getDate() + 2)
        if (next.getDay() === 0) next.setDate(next.getDate() + 1)
        const nextISO = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
        shifted[nextISO] = schedule[k]
      }
      for (const k of datesToShift) delete schedule[k]
      Object.assign(schedule, shifted)
    }
    setExpandedDay(null)
    setSkipConfirmDay(null)
    await persistSchedule(schedule, snapshot)
  }

  async function handleSwap(dateISO: string) {
    if (!savedPlan) return
    if (!swapSource) { setSwapSource(dateISO); setExpandedDay(null); return }
    if (swapSource === dateISO) { setSwapSource(null); return }
    const snapshot: WeekSchedule = JSON.parse(JSON.stringify(savedPlan.schedule))
    const schedule: WeekSchedule = JSON.parse(JSON.stringify(savedPlan.schedule))
    const a = schedule[swapSource]
    const b = schedule[dateISO]
    if (a) schedule[dateISO] = a; else delete schedule[dateISO]
    if (b) schedule[swapSource] = b; else delete schedule[swapSource]
    setSwapSource(null)
    await persistSchedule(schedule, snapshot)
  }

  async function copyToNext(dateISO: string) {
    if (!savedPlan) return
    const day = savedPlan.schedule[dateISO]
    if (!day) return
    const [y, m, d] = dateISO.split('-').map(Number)
    const next = new Date(y, m - 1, d + 1)
    if (next.getDay() === 6) next.setDate(next.getDate() + 2)
    if (next.getDay() === 0) next.setDate(next.getDate() + 1)
    const nextISO = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
    const snapshot: WeekSchedule = JSON.parse(JSON.stringify(savedPlan.schedule))
    const schedule: WeekSchedule = JSON.parse(JSON.stringify(savedPlan.schedule))
    schedule[nextISO] = JSON.parse(JSON.stringify(day))
    setExpandedDay(null)
    await persistSchedule(schedule, snapshot)
  }

  const students = classes[selectedClass]
  const filteredHistoryData = historyData.filter(r => r.class === historyClass)
  const studentHistory = selectedStudent
    ? historyData.filter(r => r.student === selectedStudent).sort((a, b) => a.date.localeCompare(b.date))
    : []

  const lessonGroups = useMemo(() => {
    const map = new Map<string, HistoryRow[]>()
    for (const row of filteredHistoryData) {
      const key = `${row.date}||${row.lesson}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(row)
    }
    return [...map.entries()].map(([key, rows]) => {
      const [date, lesson] = key.split('||')
      return { date, lesson, rows }
    }).sort((a, b) => b.date.localeCompare(a.date))
  }, [filteredHistoryData])

  const lessonDetail = selectedLesson
    ? historyData.filter(r => r.lesson === selectedLesson.lesson && r.date === selectedLesson.date)
    : []

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

  function getDateForDayOffset(offset: number) {
    const [y, m, d] = weekStart.split('-').map(Number)
    const dt = new Date(y, m - 1, d + offset)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f5f0e8' }}>
      {/* Header */}
      <header className="bg-white px-5 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 leading-none">Pulse</h1>
          <p className="text-xs text-slate-400 mt-0.5">Academic Tracker</p>
        </div>
        <div className="flex items-center gap-3">
          {screen === 'tracker' && (
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {classNames.map(cn => (
                <button
                  key={cn}
                  type="button"
                  onClick={() => setSelectedClass(cn)}
                  className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    selectedClass === cn
                      ? 'bg-teal-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {cn}
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
            <button
              type="button"
              onClick={() => { setScreen('plan'); setSelectedStudent(null); setSelectedLesson(null) }}
              className={`text-sm font-semibold ${screen === 'plan' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Week Plan
            </button>
            <button
              type="button"
              onClick={() => {
                setScreen(screen === 'history' ? 'tracker' : 'history')
                setSelectedStudent(null)
                setSelectedLesson(null)
              }}
              className={`text-sm font-semibold ${screen === 'history' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {screen === 'history' ? 'Done' : 'History'}
            </button>
            {screen === 'plan' && (
              <button
                type="button"
                onClick={() => setScreen('tracker')}
                className="text-sm font-semibold text-slate-400 hover:text-slate-600"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Subject tabs — shown on tracker screen when plan has multiple subjects */}
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

      {screen === 'plan' ? (
        <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
          <h2 className="text-base font-bold text-slate-800 mb-1">Weekly Lesson Plan</h2>
          <p className="text-xs text-slate-400 mb-4">{formatWeek(weekStart)}</p>

          {/* Subject picker — shown after AI parses the plan */}
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
                <button
                  type="button"
                  onClick={confirmSubjects}
                  disabled={subjectChoices.length === 0 || planSaving}
                  className="flex-1 py-2.5 bg-teal-500 text-white text-sm font-semibold rounded-2xl disabled:opacity-40"
                >
                  {planSaving ? 'Saving…' : `Save with ${subjectChoices.length} subject${subjectChoices.length !== 1 ? 's' : ''}`}
                </button>
                <button
                  type="button"
                  onClick={() => { setPendingSchedule(null); setSubjectChoices([]) }}
                  className="px-4 py-2.5 bg-slate-100 text-slate-500 text-sm font-semibold rounded-2xl"
                >
                  Cancel
                </button>
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
                            {field === 'objective' || field === 'activities' || field === 'assessment' ? (
                              <textarea
                                value={editDraft[field]}
                                onChange={e => setEditDraft({ ...editDraft, [field]: e.target.value })}
                                rows={2}
                                className="w-full text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300 resize-none"
                              />
                            ) : (
                              <input
                                type="text"
                                value={editDraft[field]}
                                onChange={e => setEditDraft({ ...editDraft, [field]: e.target.value })}
                                className="w-full text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300"
                              />
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
                    <button
                      type="button"
                      onClick={() => {
                        if (swapSource) { handleSwap(dateISO); return }
                        setExpandedDay(isExpanded ? null : dateISO)
                      }}
                      className="flex items-start gap-3 py-2.5 w-full text-left"
                    >
                      <span className={`text-xs font-semibold w-10 shrink-0 mt-0.5 ${isToday ? 'text-teal-600' : isSwapSource ? 'text-amber-500' : 'text-slate-400'}`}>{dayName.slice(0, 3)}</span>
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        {subjects.length > 0 ? subjects.map(subj => (
                          <div key={subj} className="flex items-baseline gap-2">
                            <span className="text-xs font-semibold text-slate-400 w-14 shrink-0">{subj}</span>
                            <span className="text-sm font-semibold text-slate-700 truncate">{dayLessons[subj].title}</span>
                          </div>
                        )) : (
                          <span className="text-slate-300 italic text-sm">No lesson</span>
                        )}
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
                                <div>
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Objective</p>
                                  <p className="text-sm text-slate-700">{lesson.objective}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Activities</p>
                                  <p className="text-sm text-slate-700">{lesson.activities}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Assessment</p>
                                  <p className="text-sm text-slate-700">{lesson.assessment}</p>
                                </div>
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
              <button
                type="button"
                onClick={() => { setSavedPlan(null); setExpandedDay(null); setEditingDay(null); setEditSubject(null); setSwapSource(null) }}
                className="text-xs text-slate-400 hover:text-slate-600 mt-3"
              >
                Upload new plan
              </button>
            </div>
          ) : !pendingSchedule ? (
            <>
              <div className="bg-white rounded-2xl shadow-sm px-4 py-4 mb-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">Upload or paste your lesson plan</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-200 rounded-xl py-3 text-sm text-slate-500 hover:border-teal-300 hover:text-teal-600 transition-colors mb-3"
                >
                  📎 Upload PDF, Word, or text file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <textarea
                  value={planText}
                  onChange={e => setPlanText(e.target.value)}
                  placeholder={"Or paste your lesson plan here…\n\nMonday: Fractions — Adding Unlike Denominators\nTuesday: Fractions — Subtracting\nWednesday: Decimals intro\n..."}
                  rows={8}
                  className="w-full text-sm bg-slate-50 rounded-xl px-4 py-3 outline-none text-slate-700 placeholder-slate-300 resize-none border border-slate-100 focus:border-teal-300"
                />
                {planError && <p className="text-xs text-red-500 mt-2">{planError}</p>}
              </div>

              <button
                type="button"
                onClick={handleSavePlan}
                disabled={!planText.trim() || planLoading}
                className="w-full py-3 bg-teal-500 text-white text-sm font-semibold rounded-2xl disabled:opacity-40"
              >
                {planLoading ? 'Analyzing with AI…' : "Save this week's plan"}
              </button>

              {planSaved && (
                <p className="text-xs text-emerald-600 text-center mt-3 font-semibold">✓ Plan saved! Today's lesson was auto-filled.</p>
              )}
            </>
          ) : null}
        </main>
      ) : screen === 'tracker' ? (
        <>
          {/* Editing past lesson banner */}
          {editingHistory && (
            <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-700">Editing past lesson</p>
                <p className="text-xs text-amber-600">{editingHistory.lesson} · {formatDate(editingHistory.date)}</p>
              </div>
              <button type="button" onClick={closeHistoryEdit} className="text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-xl">Done</button>
            </div>
          )}
          {/* Lesson bar */}
          <div className="bg-white border-t border-slate-100 px-4 py-3 flex gap-2 items-center shadow-sm">
            {editingHistory ? (
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 leading-none mb-0.5">Editing</p>
                <p className="text-sm font-semibold text-slate-700 truncate">{editingHistory.lesson}</p>
              </div>
            ) : todaysLessons.length > 1 && !activeLesson ? (
              <div className="w-full">
                <p className="text-xs text-slate-400 mb-2">Pick today's lesson:</p>
                <div className="flex flex-col gap-1.5">
                  {todaysLessons.map(l => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => { setActiveLesson(l); setLessonInput(l); setTodaysLessons([]) }}
                      className="text-left px-4 py-2 bg-slate-100 rounded-xl text-sm font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-700"
                    >
                      {l}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTodaysLessons([])}
                    className="text-xs text-slate-400 hover:text-slate-600 text-left px-1 pt-1"
                  >
                    + Start a new lesson
                  </button>
                </div>
              </div>
            ) : activeLesson ? (
              <div className="flex items-center gap-3 w-full">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 leading-none mb-0.5">Today's lesson</p>
                  <p className="text-sm font-semibold text-slate-700 truncate">{activeLesson}</p>
                </div>
                <button
                  type="button"
                  onClick={handleSuggestExitTicket}
                  disabled={exitTicketLoading}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-700 shrink-0 bg-amber-50 px-3 py-1.5 rounded-xl"
                >
                  {exitTicketLoading ? '…' : '💡 Exit Ticket'}
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveLesson(''); setLessonInput(''); setExitTickets([]); setActiveExitTicket(null); setShowExitTickets(false) }}
                  className="text-xs text-slate-400 hover:text-slate-600 shrink-0"
                >
                  Change
                </button>
              </div>
            ) : (() => {
              // Collect lessons from the plan for the active subject, sorted by date
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
                      <button
                        key={date}
                        type="button"
                        onClick={() => {
                          setLessonInput(title)
                          setActiveLesson(title)
                          setStudentStatuses({})
                          setLoading(true)
                          supabase
                            .from('student_statuses')
                            .select('class, student, status')
                            .eq('lesson', title)
                            .eq('date', date)
                            .then(({ data }: { data: { class: string; student: string; status: string }[] | null }) => {
                              const map: Record<string, Status> = {}
                              if (data) for (const row of data) map[`${row.class}-${row.student}`] = row.status as Status
                              setStudentStatuses(map)
                              setLoading(false)
                            })
                        }}
                        className="text-left px-4 py-2 bg-slate-100 rounded-xl text-sm font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-700 flex items-center justify-between"
                      >
                        <span>{title}</span>
                        <span className="text-xs text-slate-400 font-normal ml-2 shrink-0">{formatDate(date)}</span>
                      </button>
                    ))}
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        value={lessonInput}
                        onChange={e => setLessonInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && startLesson()}
                        placeholder="Or type a custom lesson…"
                        className="flex-1 text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none text-slate-700 placeholder-slate-300 border border-slate-100 focus:border-teal-300"
                      />
                      <button
                        type="button"
                        onClick={startLesson}
                        disabled={!lessonInput.trim()}
                        className="px-4 py-2 bg-teal-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40 shrink-0"
                      >
                        Start
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={lessonInput}
                    onChange={e => setLessonInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && startLesson()}
                    placeholder="What are you teaching today?"
                    className="flex-1 text-sm bg-slate-100 rounded-xl px-4 py-2 outline-none text-slate-700 placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={startLesson}
                    disabled={!lessonInput.trim()}
                    className="px-4 py-2 bg-teal-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40 shrink-0"
                  >
                    Start
                  </button>
                </>
              )
            })()}
          </div>

          {/* Exit ticket panel */}
          {showExitTickets && activeLesson && (
            <div className="bg-amber-50 border-b border-amber-100 px-4 py-3">
              {exitTicketLoading ? (
                <p className="text-xs text-amber-500 text-center">Generating exit tickets…</p>
              ) : activeExitTicket ? (
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Active Exit Ticket</p>
                    <p className="text-sm font-semibold text-slate-800">{activeExitTicket}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setActiveExitTicket(null); setShowExitTickets(false) }}
                    className="text-xs text-slate-400 hover:text-slate-600 shrink-0 mt-0.5"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-amber-700">Pick an exit ticket:</p>
                    <button type="button" onClick={() => setShowExitTickets(false)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {exitTickets.map((t, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveExitTicket(t)}
                        className="text-left text-sm text-slate-700 bg-white rounded-xl px-3 py-2 shadow-sm hover:bg-amber-50 hover:text-amber-700"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grid */}
          <main className="flex-1 px-4 py-5">
            {!activeLesson ? (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
                Enter today's lesson to begin
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading...</div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {students.map((student) => {
                  const key = `${selectedClass}-${student}`
                  const status = studentStatuses[key] ?? 'got-it'
                  const initial = student.trim()[0].toUpperCase()
                  const displayName = formatStudentName(student, nameFormat, students)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => tap(key, selectedClass, student)}
                      className="flex flex-col items-center gap-2 bg-white rounded-2xl py-3 px-1 shadow-sm active:scale-95 transition-transform relative"
                    >
                      <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${STATUS_INITIAL_BG[status]} ${STATUS_RING[status]}`}>
                        {initial}
                      </div>
                      <span className="text-xs font-semibold text-slate-700 leading-tight text-center px-1">
                        {displayName}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </main>
        </>
      ) : (
        /* History screen */
        <main className="flex-1 flex flex-col">
          <div className="bg-white border-t border-slate-100 px-4 pt-3 pb-0 shadow-sm flex items-end justify-between">
            <div className="flex gap-0">
              {(['student', 'lesson'] as HistoryTab[]).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setHistoryTab(tab); setSelectedStudent(null); setSelectedLesson(null) }}
                  className={`px-5 py-2 text-sm font-semibold border-b-2 transition-colors capitalize ${
                    historyTab === tab ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  By {tab}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-2">
              {classNames.map(cn => (
                <button
                  key={cn}
                  type="button"
                  onClick={() => { setHistoryClass(cn); setSelectedStudent(null); setSelectedLesson(null) }}
                  className={`px-4 py-1 rounded-lg text-xs font-semibold transition-all ${
                    historyClass === cn ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {cn}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 px-4 py-4 overflow-auto">
            {historyLoading ? (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading...</div>
            ) : historyTab === 'student' ? (
              selectedStudent ? (
                <div>
                  <button type="button" onClick={() => setSelectedStudent(null)} className="text-sm text-teal-600 mb-3 flex items-center gap-1">← All students</button>
                  <h2 className="text-base font-bold text-slate-800 mb-3">{formatStudentName(selectedStudent, nameFormat, allStudents.filter(s => s.class === historyClass).map(s => s.name))}</h2>
                  {studentHistory.length === 0 ? (
                    <p className="text-slate-400 text-sm">No data yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {studentHistory.map((row, i) => (
                        <div key={i} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{row.lesson}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{formatDate(row.date)} · {row.class}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_PILL[row.status as Status]}`}>
                            {STATUS_LABEL[row.status as Status]}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {allStudents.filter(s => s.class === historyClass).map(s => {
                    const rows = filteredHistoryData.filter(r => r.student === s.name)
                    const needsHelp = rows.filter(r => r.status === 'needs-help').length
                    const almost = rows.filter(r => r.status === 'almost').length
                    const classmates = allStudents.filter(x => x.class === historyClass).map(x => x.name)
                    return (
                      <button
                        key={`${s.class}-${s.name}`}
                        type="button"
                        onClick={() => setSelectedStudent(s.name)}
                        className="bg-white rounded-2xl px-3 py-3 shadow-sm flex flex-col items-center text-center gap-1"
                      >
                        <p className="text-sm font-semibold text-slate-700 leading-tight">{formatStudentName(s.name, nameFormat, classmates)}</p>
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
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h2 className="text-base font-bold text-slate-800">{selectedLesson.lesson}</h2>
                      <p className="text-xs text-slate-400">{formatDate(selectedLesson.date)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openHistoryEdit(selectedLesson.lesson, selectedLesson.date, historyClass)}
                      className="text-xs font-semibold text-teal-600 bg-teal-50 px-3 py-1.5 rounded-xl shrink-0 ml-3"
                    >
                      ✏️ Edit responses
                    </button>
                  </div>
                  {lessonDetail.length === 0 ? (
                    <p className="text-slate-400 text-sm">No data.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {lessonDetail.sort((a, b) => a.student.localeCompare(b.student)).map((row, i) => (
                        <div key={i} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{formatStudentName(row.student, nameFormat, allStudents.filter(s => s.class === row.class as ClassName).map(s => s.name))}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{row.class}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_PILL[row.status as Status]}`}>
                            {STATUS_LABEL[row.status as Status]}
                          </span>
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
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedLesson({ lesson: g.lesson, date: g.date })}
                        className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between text-left"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-700">{g.lesson}</p>
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
    </div>
  )
}

export default App
