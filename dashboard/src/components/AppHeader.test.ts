import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppHeader from './AppHeader.vue'

const baseProps = { loading: false, lastUpdated: null, isDark: false }

describe('AppHeader', () => {
  test('renders title', () => {
    const wrapper = mount(AppHeader, { props: baseProps })
    expect(wrapper.text()).toContain('Cloud Bills')
  })

  test('emits refresh when refresh button clicked', async () => {
    const wrapper = mount(AppHeader, { props: baseProps })
    await wrapper.find('[data-testid="refresh-btn"]').trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })

  test('refresh button is disabled while loading', () => {
    const wrapper = mount(AppHeader, { props: { ...baseProps, loading: true } })
    expect(wrapper.find('[data-testid="refresh-btn"]').attributes('disabled')).toBeDefined()
  })

  test('emits toggle-theme with false when sun clicked', async () => {
    const wrapper = mount(AppHeader, { props: { ...baseProps, isDark: true } })
    await wrapper.find('[data-testid="theme-light"]').trigger('click')
    expect(wrapper.emitted('toggle-theme')).toEqual([[false]])
  })

  test('emits toggle-theme with true when moon clicked', async () => {
    const wrapper = mount(AppHeader, { props: baseProps })
    await wrapper.find('[data-testid="theme-dark"]').trigger('click')
    expect(wrapper.emitted('toggle-theme')).toEqual([[true]])
  })

  test('shows last updated text when lastUpdated is set', () => {
    const date = new Date(Date.now() - 2 * 60 * 1000)
    const wrapper = mount(AppHeader, { props: { ...baseProps, lastUpdated: date } })
    expect(wrapper.text()).toContain('min ago')
  })
})
