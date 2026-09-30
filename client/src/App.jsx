import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>RepoMind - React App</h1>
      <p>Welcome to RepoMind Client (React JS)</p>
      <button onClick={() => setCount((count) => count + 1)}>
        Count is {count}
      </button>
    </div>
  )
}

export default App
