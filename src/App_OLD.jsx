import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const getTimezone = () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const offset = -currentTime.getTimezoneOffset() / 60
    const offsetSign = offset >= 0 ? '+' : '-'
    const offsetHours = Math.abs(offset)
    return `${timezone} (UTC${offsetSign}${offsetHours})`
  }

  return (
    <div className="app-container">
      <div className="datetime-frame">
        <div className="datetime-content">
          <div className="datetime-field">
            <div className="datetime-value">{formatDate(currentTime)}</div>
          </div>
          <div className="datetime-field">
            <div className="datetime-value time">{formatTime(currentTime)}</div>
          </div>
          <div className="datetime-field">
            <div className="datetime-value">{getTimezone()}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
