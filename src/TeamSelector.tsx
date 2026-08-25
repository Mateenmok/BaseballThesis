import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { MLB_TEAMS, type TeamName } from './data'

type TeamSelectorProps = {
  value: TeamName | ''
  onChange: (team: TeamName) => void
}

function TeamSelector({ value, onChange }: TeamSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listboxRef = useRef<HTMLUListElement>(null)
  const selectedTeam = MLB_TEAMS.find((team) => team.name === value)

  const openMenu = (direction: 'first' | 'last' | 'selected' = 'selected') => {
    const selectedIndex = MLB_TEAMS.findIndex((team) => team.name === value)

    if (direction === 'first') setActiveIndex(0)
    else if (direction === 'last') setActiveIndex(MLB_TEAMS.length - 1)
    else setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)

    setIsOpen(true)
  }

  const closeMenu = (restoreFocus = true) => {
    setIsOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const chooseTeam = (index: number) => {
    onChange(MLB_TEAMS[index].name)
    closeMenu()
  }

  useEffect(() => {
    if (isOpen) {
      listboxRef.current?.focus()
      document.getElementById(`team-option-${MLB_TEAMS[activeIndex].id}`)?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex, isOpen])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openMenu(event.key === 'ArrowDown' ? 'first' : 'last')
    }
  }

  const handleListboxKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % MLB_TEAMS.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + MLB_TEAMS.length) % MLB_TEAMS.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(MLB_TEAMS.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      chooseTeam(activeIndex)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
    } else if (event.key === 'Tab') {
      setIsOpen(false)
    }
  }

  return (
    <div className="team-select" ref={rootRef}>
      <button
        id="team"
        ref={triggerRef}
        className="team-select__trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="team-listbox"
        aria-labelledby="team-label team-value"
        onClick={() => (isOpen ? closeMenu(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span id="team-value" className="team-select__value">
          {selectedTeam && <img src={selectedTeam.logo} alt="" aria-hidden="true" />}
          <span>{selectedTeam?.name ?? 'Select team'}</span>
        </span>
        <span className="dropdown-indicator" aria-hidden="true" />
      </button>

      {isOpen && (
        <ul
          id="team-listbox"
          ref={listboxRef}
          className="team-select__listbox"
          role="listbox"
          aria-label="Team Name"
          aria-activedescendant={`team-option-${MLB_TEAMS[activeIndex].id}`}
          tabIndex={-1}
          onKeyDown={handleListboxKeyDown}
        >
          {MLB_TEAMS.map((team, index) => (
            <li
              id={`team-option-${team.id}`}
              key={team.id}
              className={`team-select__option${activeIndex === index ? ' is-active' : ''}`}
              role="option"
              aria-selected={team.name === value}
              onClick={() => chooseTeam(index)}
              onPointerMove={() => setActiveIndex(index)}
            >
              <img src={team.logo} alt="" aria-hidden="true" />
              <span>{team.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default TeamSelector
