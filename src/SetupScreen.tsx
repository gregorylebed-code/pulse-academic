import { useState } from 'react'
import { supabase } from './lib/supabase'

const SUBJECTS = ['Math', 'ELA', 'Science', 'Social Studies', 'Specials', 'Other']
const MAX_CLASSES = 6
const MAX_STUDENTS = 30

type ClassDraft = { name: string; subject: string }

type Props = {
  userId: string
  onDone: () => void
}

export default function SetupScreen({ userId, onDone }: Props) {
  const [step, setStep] = useState<'classes' | 'students'>('classes')
  const [classDrafts, setClassDrafts] = useState<ClassDraft[]>([{ name: '', subject: 'Math' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // After saving classes, we'll store their IDs for the student step
  const [savedClassIds, setSavedClassIds] = useState<{ id: string; name: string; subject: string }[]>([])
  const [studentInputs, setStudentInputs] = useState<Record<string, string>>({}) // classId → textarea value
  const [savingStudents, setSavingStudents] = useState(false)

  function addClass() {
    if (classDrafts.length >= MAX_CLASSES) return
    setClassDrafts([...classDrafts, { name: '', subject: 'Math' }])
  }

  function removeClass(i: number) {
    setClassDrafts(classDrafts.filter((_, idx) => idx !== i))
  }

  function updateClass(i: number, field: keyof ClassDraft, value: string) {
    setClassDrafts(classDrafts.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  async function saveClasses() {
    const valid = classDrafts.filter(c => c.name.trim())
    if (valid.length === 0) { setError('Add at least one class.'); return }
    setError('')
    setSaving(true)
    try {
      const { data, error: err } = await supabase
        .from('classes')
        .insert(valid.map((c, i) => ({ user_id: userId, name: c.name.trim(), subject: c.subject, display_order: i })))
        .select('id, name, subject')
      if (err) throw err
      setSavedClassIds(data ?? [])
      // Init student inputs for each class
      const inputs: Record<string, string> = {}
      for (const cls of data ?? []) inputs[cls.id] = ''
      setStudentInputs(inputs)
      setStep('students')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save classes.')
    } finally {
      setSaving(false)
    }
  }

  async function saveStudents() {
    setSavingStudents(true)
    setError('')
    try {
      // Parse each class's student textarea (one name per line)
      for (const cls of savedClassIds) {
        const names = (studentInputs[cls.id] ?? '')
          .split('\n')
          .map(n => n.trim())
          .filter(Boolean)
          .slice(0, MAX_STUDENTS)

        if (names.length === 0) continue

        // Insert students (dedupe by name per user)
        const { data: inserted, error: err1 } = await supabase
          .from('students')
          .insert(names.map(name => ({ user_id: userId, name })))
          .select('id')
        if (err1) throw err1

        // Link to class via student_classes
        if (inserted && inserted.length > 0) {
          const { error: err2 } = await supabase
            .from('student_classes')
            .insert(inserted.map((s: { id: string }) => ({ student_id: s.id, class_id: cls.id })))
          if (err2) throw err2
        }
      }
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save students.')
    } finally {
      setSavingStudents(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f5f0e8' }}>
      <header className="bg-white px-5 py-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800 leading-none">Pulse</h1>
        <p className="text-xs text-slate-400 mt-0.5">Set up your classroom</p>
      </header>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
        {step === 'classes' ? (
          <>
            <h2 className="text-base font-bold text-slate-800 mb-1">Your classes</h2>
            <p className="text-xs text-slate-400 mb-4">Add up to {MAX_CLASSES} classes. You can edit these later in Settings.</p>

            <div className="flex flex-col gap-3 mb-4">
              {classDrafts.map((cls, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm px-4 py-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400">Class {i + 1}</p>
                    {classDrafts.length > 1 && (
                      <button type="button" onClick={() => removeClass(i)} className="text-xs text-slate-300 hover:text-red-400">Remove</button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={cls.name}
                    onChange={e => updateClass(i, 'name', e.target.value)}
                    placeholder="e.g. Period 1, AM, Blue Group"
                    className="w-full text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300 text-slate-700 placeholder-slate-300"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {SUBJECTS.map(subj => (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => updateClass(i, 'subject', subj)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                          cls.subject === subj
                            ? 'bg-teal-500 text-white'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {subj}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {classDrafts.length < MAX_CLASSES && (
              <button
                type="button"
                onClick={addClass}
                className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-2xl text-sm text-slate-400 hover:border-teal-300 hover:text-teal-600 transition-colors mb-4"
              >
                + Add another class
              </button>
            )}

            {error && <p className="text-xs text-red-500 font-semibold mb-3">{error}</p>}

            <button
              type="button"
              onClick={saveClasses}
              disabled={saving}
              className="w-full py-3 bg-teal-500 text-white text-sm font-semibold rounded-2xl disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Next: Add students →'}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-base font-bold text-slate-800 mb-1">Add your students</h2>
            <p className="text-xs text-slate-400 mb-4">Type one name per line. Up to {MAX_STUDENTS} students per class. You can add more later.</p>

            <div className="flex flex-col gap-4 mb-4">
              {savedClassIds.map(cls => (
                <div key={cls.id} className="bg-white rounded-2xl shadow-sm px-4 py-3">
                  <p className="text-sm font-bold text-slate-700 mb-0.5">{cls.name}</p>
                  <p className="text-xs text-teal-600 font-semibold mb-2">{cls.subject}</p>
                  <textarea
                    value={studentInputs[cls.id] ?? ''}
                    onChange={e => setStudentInputs({ ...studentInputs, [cls.id]: e.target.value })}
                    placeholder={'Ava T.\nCarter H.\nCharlotte M.\n…'}
                    rows={6}
                    className="w-full text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300 text-slate-700 placeholder-slate-300 resize-none"
                  />
                  <p className="text-xs text-slate-300 mt-1 text-right">
                    {(studentInputs[cls.id] ?? '').split('\n').filter(n => n.trim()).length} / {MAX_STUDENTS}
                  </p>
                </div>
              ))}
            </div>

            {error && <p className="text-xs text-red-500 font-semibold mb-3">{error}</p>}

            <button
              type="button"
              onClick={saveStudents}
              disabled={savingStudents}
              className="w-full py-3 bg-teal-500 text-white text-sm font-semibold rounded-2xl disabled:opacity-50"
            >
              {savingStudents ? 'Saving…' : "I'm done — take me to the app →"}
            </button>
            <button
              type="button"
              onClick={onDone}
              className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 mt-2"
            >
              Skip for now — I'll add students later
            </button>
          </>
        )}
      </main>
    </div>
  )
}
