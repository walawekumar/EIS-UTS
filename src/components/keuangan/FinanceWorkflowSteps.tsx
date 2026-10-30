type Step = {
  id: string
  label: string
  done?: boolean
  current?: boolean
}

export function FinanceWorkflowSteps({ steps }: { steps: Step[] }) {
  return (
    <ol className="mb-3 flex flex-wrap gap-1.5" aria-label="Alur kerja">
      {steps.map((step, i) => {
        const tone = step.current
          ? 'border-brand-400 bg-brand-50 text-brand-900'
          : step.done
            ? 'border-line bg-surface text-ink'
            : 'border-line/70 bg-panel text-muted'
        return (
          <li
            key={step.id}
            className={[
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium',
              tone,
            ].join(' ')}
          >
            <span className="font-mono text-[10px] opacity-70">{i + 1}</span>
            {step.label}
          </li>
        )
      })}
    </ol>
  )
}
