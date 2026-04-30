// Demo mode data — fake teacher with 2 classes, 5 days of realistic check-ins

export const DEMO_USER_ID = 'demo-user'

export type DemoClass = { id: string; name: string; subject: string; display_order: number }
export type DemoStudent = { id: string; name: string }
export type DemoStudentClass = { student_id: string; class_id: string }
export type DemoLesson = { id: string; class_id: string; date: string; title: string; objective: string }
export type DemoCheckin = { lesson_id: string; student_id: string; status: 'got-it' | 'almost' | 'needs-help' }

export const DEMO_CLASSES: DemoClass[] = [
  { id: 'demo-class-am', name: 'Period 1', subject: 'Math', display_order: 0 },
  { id: 'demo-class-pm', name: 'Period 2', subject: 'ELA', display_order: 1 },
]

export const DEMO_STUDENTS: DemoStudent[] = [
  { id: 'ds-01', name: 'Ava T.' },
  { id: 'ds-02', name: 'Carter H.' },
  { id: 'ds-03', name: 'Charlotte M.' },
  { id: 'ds-04', name: 'Ella C.' },
  { id: 'ds-05', name: 'Grayson R.' },
  { id: 'ds-06', name: 'Isabella G.' },
  { id: 'ds-07', name: 'Jaron K.' },
  { id: 'ds-08', name: 'Lily S.' },
  { id: 'ds-09', name: 'Logan D.' },
  { id: 'ds-10', name: 'Olivia A.' },
  { id: 'ds-11', name: 'Riley M.' },
  { id: 'ds-12', name: 'Sloan R.' },
  // Period 2 only
  { id: 'ds-13', name: 'Emmett V.' },
  { id: 'ds-14', name: 'Julia N.' },
  { id: 'ds-15', name: 'Luca L.' },
  { id: 'ds-16', name: 'Reagan S.' },
]

export const DEMO_STUDENT_CLASSES: DemoStudentClass[] = [
  // Period 1 — ds-01 through ds-12
  ...['ds-01','ds-02','ds-03','ds-04','ds-05','ds-06','ds-07','ds-08','ds-09','ds-10','ds-11','ds-12']
    .map(sid => ({ student_id: sid, class_id: 'demo-class-am' })),
  // Period 2 — ds-01,ds-04,ds-06,ds-09,ds-10 share with P1 + ds-13-16
  ...['ds-01','ds-04','ds-06','ds-09','ds-10','ds-13','ds-14','ds-15','ds-16']
    .map(sid => ({ student_id: sid, class_id: 'demo-class-pm' })),
]

// 5 past weekdays — Mon–Fri of the most recent completed week
function pastWeekdayISO(daysAgo: number): string {
  const d = new Date()
  // Go back to last Friday first, then offset
  const dow = d.getDay() // 0=Sun
  const toLastFri = dow === 0 ? 2 : dow === 6 ? 1 : dow + 2
  const fri = new Date(d)
  fri.setDate(d.getDate() - toLastFri)
  // daysAgo=0 → Friday, 1 → Thursday, ... 4 → Monday
  fri.setDate(fri.getDate() - daysAgo)
  return `${fri.getFullYear()}-${String(fri.getMonth()+1).padStart(2,'0')}-${String(fri.getDate()).padStart(2,'0')}`
}

const D = [4, 3, 2, 1, 0].map(pastWeekdayISO) // Mon=D[0] … Fri=D[4]

export const DEMO_LESSONS: DemoLesson[] = [
  // Math (Period 1)
  { id: 'dl-m1', class_id: 'demo-class-am', date: D[0], title: 'Adding Fractions — Like Denominators', objective: 'Add fractions with the same denominator.' },
  { id: 'dl-m2', class_id: 'demo-class-am', date: D[1], title: 'Adding Fractions — Unlike Denominators', objective: 'Find common denominators and add.' },
  { id: 'dl-m3', class_id: 'demo-class-am', date: D[2], title: 'Subtracting Fractions', objective: 'Subtract fractions with and without common denominators.' },
  { id: 'dl-m4', class_id: 'demo-class-am', date: D[3], title: 'Mixed Numbers — Addition', objective: 'Add mixed numbers with regrouping.' },
  { id: 'dl-m5', class_id: 'demo-class-am', date: D[4], title: 'Mixed Numbers — Subtraction', objective: 'Subtract mixed numbers with regrouping.' },
  // ELA (Period 2)
  { id: 'dl-e1', class_id: 'demo-class-pm', date: D[0], title: 'Identifying Main Idea', objective: 'Find the main idea in a nonfiction passage.' },
  { id: 'dl-e2', class_id: 'demo-class-pm', date: D[1], title: 'Supporting Details', objective: 'Distinguish main idea from supporting details.' },
  { id: 'dl-e3', class_id: 'demo-class-pm', date: D[2], title: 'Author\'s Purpose', objective: 'Identify PIE — Persuade, Inform, Entertain.' },
  { id: 'dl-e4', class_id: 'demo-class-pm', date: D[3], title: 'Text Structure — Cause & Effect', objective: 'Recognize cause-and-effect text structure.' },
  { id: 'dl-e5', class_id: 'demo-class-pm', date: D[4], title: 'Text Structure — Compare & Contrast', objective: 'Use signal words to identify compare/contrast.' },
]

// Realistic distribution: most kids got-it, a few struggling
// Carter (ds-02), Grayson (ds-05), Emmett (ds-13) are the "struggling" students
const S = (lessonId: string, studentId: string, status: 'got-it'|'almost'|'needs-help'): DemoCheckin =>
  ({ lesson_id: lessonId, student_id: studentId, status })

export const DEMO_CHECKINS: DemoCheckin[] = [
  // Math — Period 1 lessons
  // dl-m1: everyone mostly got it, Carter almost
  ...['ds-01','ds-03','ds-04','ds-06','ds-07','ds-08','ds-09','ds-10','ds-11','ds-12'].map(id => S('dl-m1', id, 'got-it')),
  S('dl-m1', 'ds-02', 'almost'), S('dl-m1', 'ds-05', 'got-it'),

  // dl-m2: harder — Carter needs-help, Grayson almost, Lily almost
  ...['ds-01','ds-03','ds-04','ds-06','ds-07','ds-09','ds-10','ds-12'].map(id => S('dl-m2', id, 'got-it')),
  S('dl-m2', 'ds-02', 'needs-help'), S('dl-m2', 'ds-05', 'almost'), S('dl-m2', 'ds-08', 'almost'), S('dl-m2', 'ds-11', 'got-it'),

  // dl-m3: Carter needs-help again, Grayson needs-help, Olivia almost
  ...['ds-01','ds-03','ds-04','ds-06','ds-07','ds-08','ds-09','ds-12'].map(id => S('dl-m3', id, 'got-it')),
  S('dl-m3', 'ds-02', 'needs-help'), S('dl-m3', 'ds-05', 'needs-help'), S('dl-m3', 'ds-10', 'almost'), S('dl-m3', 'ds-11', 'got-it'),

  // dl-m4: mixed numbers harder — more almosts
  ...['ds-01','ds-03','ds-06','ds-07','ds-09','ds-12'].map(id => S('dl-m4', id, 'got-it')),
  S('dl-m4', 'ds-02', 'needs-help'), S('dl-m4', 'ds-04', 'almost'), S('dl-m4', 'ds-05', 'needs-help'),
  S('dl-m4', 'ds-08', 'almost'), S('dl-m4', 'ds-10', 'almost'), S('dl-m4', 'ds-11', 'almost'),

  // dl-m5: Friday — Carter and Grayson still struggling
  ...['ds-01','ds-03','ds-06','ds-07','ds-09','ds-12'].map(id => S('dl-m5', id, 'got-it')),
  S('dl-m5', 'ds-02', 'needs-help'), S('dl-m5', 'ds-04', 'almost'), S('dl-m5', 'ds-05', 'needs-help'),
  S('dl-m5', 'ds-08', 'got-it'), S('dl-m5', 'ds-10', 'almost'), S('dl-m5', 'ds-11', 'almost'),

  // ELA — Period 2 (9 students)
  // dl-e1
  ...['ds-01','ds-04','ds-09','ds-10','ds-14','ds-15','ds-16'].map(id => S('dl-e1', id, 'got-it')),
  S('dl-e1', 'ds-06', 'almost'), S('dl-e1', 'ds-13', 'almost'),

  // dl-e2
  ...['ds-01','ds-04','ds-09','ds-10','ds-15','ds-16'].map(id => S('dl-e2', id, 'got-it')),
  S('dl-e2', 'ds-06', 'almost'), S('dl-e2', 'ds-13', 'needs-help'), S('dl-e2', 'ds-14', 'almost'),

  // dl-e3
  ...['ds-01','ds-04','ds-10','ds-15','ds-16'].map(id => S('dl-e3', id, 'got-it')),
  S('dl-e3', 'ds-06', 'almost'), S('dl-e3', 'ds-09', 'almost'), S('dl-e3', 'ds-13', 'needs-help'), S('dl-e3', 'ds-14', 'almost'),

  // dl-e4
  ...['ds-01','ds-04','ds-10','ds-15'].map(id => S('dl-e4', id, 'got-it')),
  S('dl-e4', 'ds-06', 'needs-help'), S('dl-e4', 'ds-09', 'almost'), S('dl-e4', 'ds-13', 'needs-help'),
  S('dl-e4', 'ds-14', 'almost'), S('dl-e4', 'ds-16', 'almost'),

  // dl-e5
  ...['ds-01','ds-04','ds-10','ds-15'].map(id => S('dl-e5', id, 'got-it')),
  S('dl-e5', 'ds-06', 'needs-help'), S('dl-e5', 'ds-09', 'almost'), S('dl-e5', 'ds-13', 'needs-help'),
  S('dl-e5', 'ds-14', 'got-it'), S('dl-e5', 'ds-16', 'almost'),
]
