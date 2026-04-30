import { useState } from 'react'
import App from './App.tsx'
import Landing from './Landing.tsx'

export default function Root() {
  const [inApp, setInApp] = useState(window.location.hash === '#app')

  function enter() {
    window.location.hash = '#app'
    setInApp(true)
  }

  return inApp ? <App /> : <Landing onEnter={enter} />
}
