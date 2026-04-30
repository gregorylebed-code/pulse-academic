const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string
const MODEL = 'llama-3.3-70b-versatile'

async function groqChat(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.3 }),
  })
  if (!res.ok) throw new Error(`Groq error: ${res.status}`)
  const json = await res.json()
  return json.choices[0].message.content as string
}

export async function parseLessonPlan(text: string, weekStart: string): Promise<Record<string, string>> {
  const prompt = `You are a helpful assistant for teachers. Given this lesson plan text, extract which lesson/topic is taught on each school day (Monday–Friday) of the week starting ${weekStart}.

Return ONLY valid JSON in this format (use ISO dates YYYY-MM-DD for the week of ${weekStart}):
{
  "2025-01-06": "Lesson name for Monday",
  "2025-01-07": "Lesson name for Tuesday",
  ...
}

Only include days that have a clear lesson. Keep lesson names short (under 60 chars). Do not include any explanation, just the JSON.

Lesson plan text:
${text.slice(0, 4000)}`

  const raw = await groqChat([{ role: 'user', content: prompt }])
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not parse lesson plan')
  return JSON.parse(match[0])
}

export async function suggestExitTickets(lessonName: string): Promise<string[]> {
  const prompt = `You are a helpful assistant for elementary/middle school teachers. Suggest 3 short exit ticket prompts for a lesson on: "${lessonName}".

Return ONLY a JSON array of 3 strings, each under 100 characters. No explanation, just the array.
Example: ["Solve: 3/4 + 1/2", "Explain in one sentence why...", "Thumbs up if you can..."]`

  const raw = await groqChat([{ role: 'user', content: prompt }])
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Could not parse exit tickets')
  return JSON.parse(match[0])
}
