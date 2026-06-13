import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SolverStatusPanel } from './SolverStatusPanel'
import { makeSolverStatus } from '@/test/fixtures'

// The solver run banner is the visible surface for the async solver lifecycle.
// These tests assert the running / success / partial / failure display states.

describe('SolverStatusPanel — solver run display states', () => {
  const noop = () => {}

  it('renders nothing when idle (no run, no errors)', () => {
    const { container } = render(
      <SolverStatusPanel
        runStatus={null}
        isStarting={false}
        startError={null}
        statusError={null}
        onDismiss={noop}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a starting state while the start request is in flight', () => {
    render(
      <SolverStatusPanel
        runStatus={null}
        isStarting={true}
        startError={null}
        statusError={null}
        onDismiss={noop}
      />
    )
    expect(screen.getByText('Starting solver run…')).toBeInTheDocument()
  })

  it('shows a running state for a pending/running run', () => {
    render(
      <SolverStatusPanel
        runStatus={makeSolverStatus({ status: 'running' })}
        isStarting={false}
        startError={null}
        statusError={null}
        onDismiss={noop}
      />
    )
    expect(screen.getByText('Solver is running…')).toBeInTheDocument()
  })

  it('shows a success state with the scheduled count', () => {
    render(
      <SolverStatusPanel
        runStatus={makeSolverStatus({
          status: 'succeeded',
          scheduled_count: 5,
          unscheduled_count: 0,
          partial_success: false,
        })}
        isStarting={false}
        startError={null}
        statusError={null}
        onDismiss={noop}
      />
    )
    expect(screen.getByText('Solver finished successfully')).toBeInTheDocument()
    expect(screen.getByText(/Scheduled 5 sessions/)).toBeInTheDocument()
  })

  it('shows a partial-result state when sessions remain unscheduled', () => {
    render(
      <SolverStatusPanel
        runStatus={makeSolverStatus({
          status: 'succeeded',
          scheduled_count: 3,
          unscheduled_count: 2,
          partial_success: true,
        })}
        isStarting={false}
        startError={null}
        statusError={null}
        onDismiss={noop}
      />
    )
    expect(screen.getByText('Solver finished with a partial result')).toBeInTheDocument()
    expect(screen.getByText(/2 sessions could not be placed/)).toBeInTheDocument()
  })

  it('shows a failure state with the backend failure message', () => {
    render(
      <SolverStatusPanel
        runStatus={makeSolverStatus({
          status: 'failed',
          failure_message: 'Solver could not produce a feasible timetable.',
        })}
        isStarting={false}
        startError={null}
        statusError={null}
        onDismiss={noop}
      />
    )
    expect(screen.getByText('Solver run failed')).toBeInTheDocument()
    expect(
      screen.getByText('Solver could not produce a feasible timetable.')
    ).toBeInTheDocument()
  })

  it('shows a start-error state and allows dismissing it', async () => {
    const onDismiss = vi.fn()
    render(
      <SolverStatusPanel
        runStatus={null}
        isStarting={false}
        startError="A solver run is already in progress."
        statusError={null}
        onDismiss={onDismiss}
      />
    )
    expect(screen.getByText('Could not start the solver')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Dismiss solver status'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('shows a status-refresh warning while a poll fails but the run continues', () => {
    render(
      <SolverStatusPanel
        runStatus={null}
        isStarting={false}
        startError={null}
        statusError="Network error."
        onDismiss={noop}
      />
    )
    expect(
      screen.getByText('Solver status could not be refreshed')
    ).toBeInTheDocument()
  })
})
