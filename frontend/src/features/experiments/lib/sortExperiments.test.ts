import { describe, expect, it } from 'vitest'

import type { ExperimentSummary } from '@/api/types'

import { DEFAULT_SORT, nextSort, sortExperiments } from './sortExperiments'

function experiment(name: string, createdBy: string | null, modified: number | null, location = '/Shared'): ExperimentSummary {
  return {
    experiment_id: name,
    name,
    path: `${location}/${name}`,
    location,
    created_by: createdBy,
    last_update_time_ms: modified,
  }
}

const experiments = [
  experiment('exp-10', 'bob@x.com', 1),
  experiment('Alpha', 'carol@x.com', 3),
  experiment('exp-2', null, 2),
  experiment('beta', 'alice@x.com', null),
]

const names = (list: ExperimentSummary[]) => list.map((e) => e.name)

describe('sortExperiments', () => {
  it('sorts newest first by default, with unknown dates last', () => {
    expect(names(sortExperiments(experiments, DEFAULT_SORT))).toEqual(['Alpha', 'exp-2', 'exp-10', 'beta'])
  })

  it('sorts names ignoring case and with numbers in order', () => {
    expect(names(sortExperiments(experiments, { key: 'name', direction: 'asc' }))).toEqual([
      'Alpha',
      'beta',
      'exp-2',
      'exp-10',
    ])
    expect(names(sortExperiments(experiments, { key: 'name', direction: 'desc' }))).toEqual([
      'exp-10',
      'exp-2',
      'beta',
      'Alpha',
    ])
  })

  it('keeps empty values last in both directions', () => {
    expect(names(sortExperiments(experiments, { key: 'created_by', direction: 'asc' }))).toEqual([
      'beta',
      'exp-10',
      'Alpha',
      'exp-2',
    ])
    expect(names(sortExperiments(experiments, { key: 'created_by', direction: 'desc' }))).toEqual([
      'Alpha',
      'exp-10',
      'beta',
      'exp-2',
    ])
  })

  it('breaks ties by name', () => {
    const tied = [experiment('b', 'x', 1, '/B'), experiment('a', 'x', 1, '/B'), experiment('c', 'x', 1, '/A')]
    expect(names(sortExperiments(tied, { key: 'location', direction: 'asc' }))).toEqual(['c', 'a', 'b'])
  })

  it('does not change the original list', () => {
    const before = names(experiments)
    sortExperiments(experiments, { key: 'name', direction: 'asc' })
    expect(names(experiments)).toEqual(before)
  })
})

describe('nextSort', () => {
  it('flips direction when the same column is clicked again', () => {
    expect(nextSort({ key: 'name', direction: 'asc' }, 'name')).toEqual({ key: 'name', direction: 'desc' })
    expect(nextSort({ key: 'name', direction: 'desc' }, 'name')).toEqual({ key: 'name', direction: 'asc' })
  })

  it('starts text columns A to Z and dates newest first', () => {
    expect(nextSort(DEFAULT_SORT, 'created_by')).toEqual({ key: 'created_by', direction: 'asc' })
    expect(nextSort({ key: 'name', direction: 'asc' }, 'last_modified')).toEqual({
      key: 'last_modified',
      direction: 'desc',
    })
  })
})
