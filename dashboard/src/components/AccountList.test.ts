import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AccountList from './AccountList.vue'
import type { BalanceItem } from '../types'

const successItem = (overrides = {}): BalanceItem => ({
  provider: 'aws',
  account: 'production',
  totalCost: 120,
  currency: 'USD',
  lastUpdated: '2026-04-25T00:00:00Z',
  ...overrides,
})

const errorItem = (overrides = {}): BalanceItem => ({
  provider: 'azure',
  account: 'main',
  error: 'auth failed',
  ...overrides,
})

describe('AccountList', () => {
  test('renders a row for each item', () => {
    const items = [successItem(), errorItem()]
    const wrapper = mount(AccountList, { props: { items } })
    expect(wrapper.findAll('[data-testid="account-row"]')).toHaveLength(2)
  })

  test('shows provider name and account for success row', () => {
    const wrapper = mount(AccountList, { props: { items: [successItem()] } })
    expect(wrapper.text()).toContain('AWS')
    expect(wrapper.text()).toContain('production')
  })

  test('shows cost for success row', () => {
    const wrapper = mount(AccountList, { props: { items: [successItem({ totalCost: 154, currency: 'USD' })] } })
    expect(wrapper.text()).toContain('154')
    expect(wrapper.text()).toContain('USD')
  })

  test('shows Unavailable for error row', () => {
    const wrapper = mount(AccountList, { props: { items: [errorItem()] } })
    expect(wrapper.text()).toContain('Unavailable')
  })

  test('error row has reduced opacity class', () => {
    const wrapper = mount(AccountList, { props: { items: [errorItem()] } })
    const row = wrapper.find('[data-testid="account-row"]')
    expect(row.classes()).toContain('opacity-50')
  })

  test('success row does not have reduced opacity', () => {
    const wrapper = mount(AccountList, { props: { items: [successItem()] } })
    const row = wrapper.find('[data-testid="account-row"]')
    expect(row.classes()).not.toContain('opacity-50')
  })

  test('renders section label', () => {
    const wrapper = mount(AccountList, { props: { items: [] } })
    expect(wrapper.text()).toContain('All accounts')
  })

  test('renders empty list without errors', () => {
    const wrapper = mount(AccountList, { props: { items: [] } })
    expect(wrapper.findAll('[data-testid="account-row"]')).toHaveLength(0)
  })
})
