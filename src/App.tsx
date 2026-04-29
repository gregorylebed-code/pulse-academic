import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

type ClassName = 'AM' | 'PM'
type Status = 'got-it' | 'almost' | 'needs-help'
type Screen = 'tracker' | 'history'
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

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

type HistoryRow = { class: string; student: string; lesson: string; date: string; status: string }

function App() {
  const classNames = useMemo(() => Object.keys(classes) as ClassName[], [])
  const [screen, setScreen] = useState<Screen>('tracker')
  const [selectedClass, setSelectedClass] = useState<ClassName>('AM')
  const [lessonInput, setLessonInput] = useState('')
  const [activeLesson, setActiveLesson] = useState('')
  const [studentStatuses, setStudentStatuses] = useState<Record<string, Status>>({})
  const [loading, setLoading] = useState(false)
  const [todaysLessons, setTodaysLessons] = useState<string[]>([])

  // History state
  const [historyTab, setHistoryTab] = useState<HistoryTab>('student')
  const [historyData, setHistoryData] = useState<HistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<{ lesson: string; date: string } | null>(null)

  const today = todayISO()

  // On mount: check if there are lessons saved today and auto-restore
  useEffect(() => {
    setLoading(true)
    supabase
      .from('student_statuses')
      .select('lesson')
      .eq('date', today)
      .then(({ data }: { data: { lesson: string }[] | null }) => {
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
  }, [today])

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

  function startLesson() {
    const lesson = lessonInput.trim()
    if (!lesson) return
    setActiveLesson(lesson)
    setStudentStatuses({})
  }

  function tap(key: string, className: ClassName, student: string) {
    setStudentStatuses(current => {
      const cur = current[key] ?? 'got-it'
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length]
      supabase
        .from('student_statuses')
        .upsert(
          { class: className, student, lesson: activeLesson, date: today, status: next },
          { onConflict: 'class,student,lesson,date' }
        )
        .then()
      return { ...current, [key]: next }
    })
  }

  const students = classes[selectedClass]

  // History derived data
  const studentHistory = selectedStudent
    ? historyData.filter(r => r.student === selectedStudent).sort((a, b) => a.date.localeCompare(b.date))
    : []

  const lessonGroups = useMemo(() => {
    const map = new Map<string, HistoryRow[]>()
    for (const row of historyData) {
      const key = `${row.date}||${row.lesson}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(row)
    }
    return [...map.entries()].map(([key, rows]) => {
      const [date, lesson] = key.split('||')
      return { date, lesson, rows }
    }).sort((a, b) => b.date.localeCompare(a.date))
  }, [historyData])

  const lessonDetail = selectedLesson
    ? historyData.filter(r => r.lesson === selectedLesson.lesson && r.date === selectedLesson.date)
    : []

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
          <button
            type="button"
            onClick={() => {
              setScreen(screen === 'tracker' ? 'history' : 'tracker')
              setSelectedStudent(null)
              setSelectedLesson(null)
            }}
            className="text-sm font-semibold text-teal-600 hover:text-teal-800"
          >
            {screen === 'tracker' ? 'History' : 'Done'}
          </button>
        </div>
      </header>

      {screen === 'tracker' ? (
        <>
          {/* Lesson bar */}
          <div className="bg-white border-t border-slate-100 px-4 py-3 flex gap-2 items-center shadow-sm">
            {todaysLessons.length > 1 && !activeLesson ? (
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
                  onClick={() => { setActiveLesson(''); setLessonInput('') }}
                  className="text-xs text-slate-400 hover:text-slate-600 shrink-0"
                >
                  Change
                </button>
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
            )}
          </div>

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
                  const firstName = student.split(' ')[0]
                  const initial = firstName[0].toUpperCase()
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
                        {firstName}
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
          {/* Tabs */}
          <div className="bg-white border-t border-slate-100 px-4 pt-3 pb-0 shadow-sm">
            <div className="flex gap-0">
              {(['student', 'lesson'] as HistoryTab[]).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setHistoryTab(tab); setSelectedStudent(null); setSelectedLesson(null) }}
                  className={`px-5 py-2 text-sm font-semibold border-b-2 transition-colors capitalize ${
                    historyTab === tab
                      ? 'border-teal-500 text-teal-600'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  By {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 px-4 py-4 overflow-auto">
            {historyLoading ? (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading...</div>
            ) : historyTab === 'student' ? (
              selectedStudent ? (
                /* Student detail */
                <div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(null)}
                    className="text-sm text-teal-600 mb-3 flex items-center gap-1"
                  >
                    ← All students
                  </button>
                  <h2 className="text-base font-bold text-slate-800 mb-3">{selectedStudent}</h2>
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
                /* Student list */
                <div className="flex flex-col gap-2">
                  {allStudents.map(s => {
                    const rows = historyData.filter(r => r.student === s.name)
                    const needsHelp = rows.filter(r => r.status === 'needs-help').length
                    const almost = rows.filter(r => r.status === 'almost').length
                    return (
                      <button
                        key={`${s.class}-${s.name}`}
                        type="button"
                        onClick={() => setSelectedStudent(s.name)}
                        className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between text-left"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-700">{s.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{s.class} · {rows.length} lesson{rows.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="flex gap-1.5">
                          {needsHelp > 0 && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">{needsHelp} needs help</span>
                          )}
                          {almost > 0 && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{almost} almost</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            ) : (
              /* By Lesson tab */
              selectedLesson ? (
                /* Lesson detail */
                <div>
                  <button
                    type="button"
                    onClick={() => setSelectedLesson(null)}
                    className="text-sm text-teal-600 mb-3 flex items-center gap-1"
                  >
                    ← All lessons
                  </button>
                  <h2 className="text-base font-bold text-slate-800">{selectedLesson.lesson}</h2>
                  <p className="text-xs text-slate-400 mb-3">{formatDate(selectedLesson.date)}</p>
                  {lessonDetail.length === 0 ? (
                    <p className="text-slate-400 text-sm">No data.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {lessonDetail.sort((a, b) => a.student.localeCompare(b.student)).map((row, i) => (
                        <div key={i} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{row.student}</p>
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
                /* Lesson list */
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
