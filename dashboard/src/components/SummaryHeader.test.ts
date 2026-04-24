import { describe, test, expect } from 'bun:test'
import { mount } from '@vue/test-utils'
import SummaryHeader from './SummaryHeader.vue'
import type { ProviderSummary } from '../types'

const makeSummary = (overrides: Partial<ProviderSummary>): ProviderSummary => ({
  provider: 'aws',
  totalCost: 100,
  currency: 'USD',
  accountCount: 2,
  errorCount: 0,
  ...overrides,
})

describe('SummaryHeader', () => {
  test('renders a card for each summary', () => {
    const summaries = [
      makeSummary({ provider: 'aws' }),
      makeSummary({ provider: 'gcp', totalCost: 50, accountCount: 1 }),
    ]
    const wrapper = mount(SummaryHeader, { props: { summaries } })
    const cards = wrapper.findAll('[data-testid="provider-card"]')
    expect(cards).toHaveLength(2)
  })

  test('shows provider name uppercased on each card', () => {
    const wrapper = mount(SummaryHeader, {
      props: { summaries: [makeSummary({ provider: 'gcp' })] },
    })
    expect(wrapper.text()).toContain('GCP')
  })

  test('shows cost and currency for successful provider', () => {
    const wrapper = mount(SummaryHeader, {
      props: {
        summaries: [makeSummary({ provider: 'aws', totalCost: 154, currency: 'USD' })],
      },
    })
    expect(wrapper.text()).toContain('154')
    expect(wrapper.text()).toContain('USD')
  })

  test('shows Unavailable when totalCost is null (all accounts errored)', () => {
    const wrapper = mount(SummaryHeader, {
      props: {
        summaries: [
          makeSummary({ provider: 'azure', totalCost: null, currency: null, errorCount: 1 }),
        ],
      },
    })
    expect(wrapper.text()).toContain('Unavailable')
    expect(wrapper.text()).not.toContain('null')
  })

  test('shows warning badge when partial errors exist', () => {
    const wrapper = mount(SummaryHeader, {
      props: {
        summaries: [
          makeSummary({ provider: 'aws', totalCost: 50, errorCount: 1, accountCount: 2 }),
        ],
      },
    })
    expect(wrapper.find('[data-testid="error-badge"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('1 failed')
  })

  test('does not show warning badge when no errors', () => {
    const wrapper = mount(SummaryHeader, {
      props: { summaries: [makeSummary({ errorCount: 0 })] },
    })
    expect(wrapper.find('[data-testid="error-badge"]').exists()).toBe(false)
  })

  test('shows account count on each card', () => {
    const wrapper = mount(SummaryHeader, {
      props: {
        summaries: [makeSummary({ provider: 'aws', accountCount: 3 })],
      },
    })
    expect(wrapper.text()).toMatch(/3\s*acct/)
  })

  test('renders empty grid when summaries is empty', () => {
    const wrapper = mount(SummaryHeader, { props: { summaries: [] } })
    expect(wrapper.findAll('[data-testid="provider-card"]')).toHaveLength(0)
  })
})
