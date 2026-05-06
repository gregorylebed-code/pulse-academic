import { useMemo, useState } from 'react'
import type { SkillsScreenProps, AppStudent, MasteryLevel } from '../types'

export default function SkillsScreen(props: SkillsScreenProps) {
  const {
    classes, students, studentClasses, skills, masteryMap, selectedClassId, onSelectClass, onAddSkill, onDeleteSkill, onSetMastery, nameFormat,
  } = props

  const [addingSkill, setAddingSkill] = useState(false)
  const [newSkillName, setNewSkillName] = useState('')
  const [saving, setSaving] = useState(false)

  const classStudents = useMemo(() => {
    const ids = new Set(
      studentClasses.filter(sc => sc.class_id === selectedClassId).map(sc => sc.student_id)
    )
    return students.filter(s => ids.has(s.id))
  }, [studentClasses, students, selectedClassId])

  const classSkills = useMemo(() => (
    skills
      .filter(s => s.class_id === selectedClassId)
      .sort((a, b) => a.display_order - b.display_order)
  ), [skills, selectedClassId])

  return (
    <main className="flex-1 px-4 py-4" style={{ background: '#0d0d0f' }}>
      {classes.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {classes.map(cls => (
            <button
              key={cls.id}
              type="button"
              onClick={() => onSelectClass(cls.id)}
              className={`max-w-[12.5rem] truncate px-3 py-2 rounded-2xl text-xs sm:px-4 sm:text-sm font-semibold transition-all ${
                selectedClassId === cls.id ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20' : 'hover:bg-white/5'
              }`}
              style={selectedClassId !== cls.id ? { background: 'rgba(255,255,255,0.06)', color: '#8b8b9a' } : {}}
            >
              {cls.subject} · {cls.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-end mb-3">
        {!addingSkill ? (
          <button
            type="button"
            onClick={() => setAddingSkill(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border"
            style={{ color: '#8b8b9a', borderColor: 'rgba(255,255,255,0.15)', background: '#161618' }}
          >
            + Add Skill
          </button>
        ) : (
          <div className="w-full max-w-md rounded-2xl p-2 flex items-center gap-2" style={{ background: '#161618', border: '1px solid rgba(255,255,255,0.07)' }}>
            <input
              type="text"
              value={newSkillName}
              onChange={e => setNewSkillName(e.target.value)}
              placeholder="Skill name"
              className="flex-1 rounded-xl px-3 py-2 text-sm outline-none border"
              style={{ background: '#1e1e22', borderColor: 'rgba(255,255,255,0.1)', color: '#f0f0f2' }}
            />
            <button
              type="button"
              disabled={!newSkillName.trim() || saving}
              onClick={async () => {
                if (!newSkillName.trim()) return
                setSaving(true)
                await onAddSkill(newSkillName.trim())
                setSaving(false)
                setNewSkillName('')
                setAddingSkill(false)
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-teal-500 disabled:opacity-40"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setAddingSkill(false); setNewSkillName('') }}
              className="px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ color: '#8b8b9a', background: 'rgba(255,255,255,0.07)' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)', background: '#161618' }}>
        {classSkills.length === 0 ? (
          <div className="py-10 text-center text-sm font-semibold" style={{ color: '#8b8b9a' }}>No skills yet</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-max">
              <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="sticky left-0 z-20 w-[220px] px-3 py-2 text-xs font-semibold" style={{ background: '#161618', color: '#5a5a6a', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                  Skill
                </div>
                {classStudents.map((student: AppStudent) => {
                  const parts = student.name.trim().split(/\s+/)
                  const displayName = nameFormat === 'full'
                    ? student.name
                    : nameFormat === 'initials'
                      ? parts.map(p => p[0].toUpperCase()).join('.') + '.'
                      : parts[0]
                  return (
                    <div key={student.id} className="w-20 shrink-0 px-1 py-2 text-center text-[10px] font-bold leading-tight" style={{ color: '#8b8b9a' }}>
                      {displayName}
                    </div>
                  )
                })}
              </div>

              {classSkills.map(skill => (
                <div key={skill.id} className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="sticky left-0 z-10 w-[220px] px-2 py-2 flex items-center gap-2" style={{ background: '#161618', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm('Delete this skill?')) return
                        setSaving(true)
                        await onDeleteSkill(skill.id)
                        setSaving(false)
                      }}
                      className="w-6 h-6 rounded-lg text-[11px] font-bold"
                      style={{ color: '#f87171', background: 'rgba(248,113,113,0.1)' }}
                    >
                      ×
                    </button>
                    <div className="text-xs font-semibold truncate" style={{ color: '#f0f0f2', maxWidth: '150px' }}>
                      {skill.name}
                    </div>
                  </div>
                  {classStudents.map(student => {
                    const level = masteryMap[skill.id]?.[student.id] ?? 0
                    return (
                      <div key={student.id} className="w-20 shrink-0 px-1 py-2 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={async () => {
                            const next = ((level + 1) % 4) as MasteryLevel
                            setSaving(true)
                            await onSetMastery(skill.id, student.id, next)
                            setSaving(false)
                          }}
                          className="w-8 h-8 rounded-full text-xs font-bold"
                          style={
                            level === 0 ? { background: '#2a2a2f', color: '#8b8b9a' }
                              : level === 1 ? { background: '#7c2d12', color: '#fdba74' }
                                : level === 2 ? { background: '#713f12', color: '#facc15' }
                                  : { background: '#14532d', color: '#34d399' }
                          }
                          title={level === 0 ? 'Not Yet' : level === 1 ? 'Beginning' : level === 2 ? 'Developing' : 'Mastered'}
                        >
                          {level === 0 ? '–' : level === 1 ? 'B' : level === 2 ? 'D' : 'M'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
