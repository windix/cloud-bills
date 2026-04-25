import { describe, test, expect } from 'vitest'
import { computeProviderSummaries, sortItems } from './computations'
import type { BalanceItem } from '../types'

const aws1: BalanceItem = { provider: 'aws', account: 'prod', totalCost: 120, currency: 'USD', lastUpdated: '' }
const aws2: BalanceItem = { provider: 'aws', account: 'staging', totalCost: 34, currency: 'USD', lastUpdated: '' }
const gcp1: BalanceItem = { provider: 'gcp', account: 'main', totalCost: 55, currency: 'USD', lastUpdated: '' }
const azureErr: BalanceItem = { provider: 'azure', account: 'main', error: 'credentials missing' }

describe('computeProviderSummaries', () => {
  test('sums costs for the same provider', () => {
    const summaries = computeProviderSummaries([aws1, aws2])
    const aws = summaries.find(s => s.provider === 'aws')!
    expect(aws.totalCost).toBe(154)
    expect(aws.accountCount).toBe(2)
    expect(aws.errorCount).toBe(0)
  })

  test('returns null totalCost when all accounts errored', () => {
    const summaries = computeProviderSummaries([azureErr])
    const azure = summaries.find(s => s.provider === 'azure')!
    expect(azure.totalCost).toBeNull()
    expect(azure.currency).toBeNull()
    expect(azure.errorCount).toBe(1)
  })

  test('counts errors separately when provider has mixed results', () => {
    const partialErr: BalanceItem = { provider: 'aws', account: 'broken', error: 'timeout' }
    const summaries = computeProviderSummaries([aws1, partialErr])
    const aws = summaries.find(s => s.provider === 'aws')!
    expect(aws.totalCost).toBe(120)
    expect(aws.errorCount).toBe(1)
    expect(aws.accountCount).toBe(2)
  })

  test('produces one entry per provider', () => {
    const summaries = computeProviderSummaries([aws1, aws2, gcp1])
    expect(summaries).toHaveLength(2)
  })
})

describe('sortItems', () => {
  test('sorts by totalCost descending', () => {
    const sorted = sortItems([gcp1, aws1, aws2])
    expect(sorted.map(i => (i as any).account)).toEqual(['prod', 'main', 'staging'])
  })

  test('error rows go to the bottom', () => {
    const sorted = sortItems([aws2, azureErr, aws1])
    expect((sorted[sorted.length - 1] as any).account).toBe('main') // azure error
  })

  test('does not mutate the input array', () => {
    const input = [gcp1, aws1]
    sortItems(input)
    expect(input[0]).toBe(gcp1)
  })
})
