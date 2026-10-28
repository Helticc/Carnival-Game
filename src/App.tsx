import { useState } from 'react'
import MenuScreen from './components/MenuScreen'
import GameScreen from './components/GameScreen'

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'game'>('menu')
  const [runKey, setRunKey] = useState(0)

  return (
    <div className="h-full w-full font-game">
      {screen === 'menu' ? (
        <MenuScreen onPlay={() => { setRunKey(k => k + 1); setScreen('game') }} />
      ) : (
        <GameScreen key={runKey} onExit={() => setScreen('menu')} />
      )}
    </div>
  )
}
