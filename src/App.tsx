import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

type ClassName = 'AM' | 'PM'
type Status = 'got-it' | 'almost' | 'needs-help'

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

function App() {
  const classNames = useMemo(() => Object.keys(classes) as ClassName[], [])
  const [selectedClass, setSelectedClass] = useState<ClassName>('AM')
  const [studentStatuses, setStudentStatuses] = useState<Record<string, Status>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase
      .from('student_statuses')
      .select('class, student, status')
      .then(({ data }) => {
        if (data) {
          const map: Record<string, Status> = {}
          for (const row of data) {
            map[`${row.class}-${row.student}`] = row.status as Status
          }
          setStudentStatuses(map)
        }
        setLoaded(true)
      })
  }, [])

  function tap(key: string, className: ClassName, student: string) {
    setStudentStatuses(current => {
      const cur = current[key] ?? 'got-it'
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length]
      supabase
        .from('student_statuses')
        .upsert({ class: className, student, status: next }, { onConflict: 'class,student' })
        .then()
      return { ...current, [key]: next }
    })
  }

  const students = classes[selectedClass]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f5f0e8' }}>
      {/* Header */}
      <header className="bg-white px-5 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 leading-none">Pulse</h1>
          <p className="text-xs text-slate-400 mt-0.5">Academic Tracker</p>
        </div>
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
      </header>

      {/* Grid */}
      <main className="flex-1 px-4 py-5">
        {!loaded ? (
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
    </div>
  )
}

export default App
