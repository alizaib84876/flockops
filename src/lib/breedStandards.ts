// Breed standard growth curves — day-by-day target live weight (grams/bird)
// Sources: Ross 308 Broiler Performance Objectives 2022,
//          Cobb 500 Broiler Performance & Nutrition Supplement 2022
// Used to plot actual vs. expected growth on the batch growth chart.

export const BREEDS_WITH_STANDARDS = ['Ross 308', 'Cobb 500'] as const
export type BreedWithStandard = (typeof BREEDS_WITH_STANDARDS)[number]

// Key milestone weights (g/bird) — interpolated into full daily series below
const ROSS_308_MILESTONES: [number, number][] = [
  [0, 42], [1, 52], [3, 84], [7, 190], [10, 335],
  [14, 510], [18, 750], [21, 950], [24, 1175],
  [28, 1510], [31, 1740], [35, 2050], [38, 2310], [42, 2610],
]

const COBB_500_MILESTONES: [number, number][] = [
  [0, 42], [1, 50], [3, 82], [7, 185], [10, 325],
  [14, 490], [18, 730], [21, 920], [24, 1155],
  [28, 1480], [31, 1720], [35, 2040], [38, 2300], [42, 2620],
]

/** Linear interpolation between two points */
function lerp(x0: number, y0: number, x1: number, y1: number, x: number): number {
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
}

/** Build a complete day 0..42 array from milestone points */
function buildDailySeries(milestones: [number, number][]): number[] {
  const result: number[] = []
  for (let day = 0; day <= 42; day++) {
    // Find surrounding milestones
    let lo = milestones[0]
    let hi = milestones[milestones.length - 1]
    for (let i = 0; i < milestones.length - 1; i++) {
      if (milestones[i][0] <= day && milestones[i + 1][0] >= day) {
        lo = milestones[i]
        hi = milestones[i + 1]
        break
      }
    }
    const w = lo[0] === hi[0] ? lo[1] : lerp(lo[0], lo[1], hi[0], hi[1], day)
    result.push(Math.round(w))
  }
  return result
}

export const BREED_STANDARDS: Record<BreedWithStandard, number[]> = {
  'Ross 308': buildDailySeries(ROSS_308_MILESTONES),
  'Cobb 500': buildDailySeries(COBB_500_MILESTONES),
}

/** Get the standard target weight (g) for a breed on a given day of cycle.
 *  Returns null if the breed has no standard data or day > 42. */
export function getStandardWeight(breed: string, day: number): number | null {
  if (!BREEDS_WITH_STANDARDS.includes(breed as BreedWithStandard)) return null
  const series = BREED_STANDARDS[breed as BreedWithStandard]
  if (day < 0 || day > series.length - 1) return null
  return series[Math.min(day, series.length - 1)]
}

/** Build chart data array merging actual weight samples with breed standard.
 *  actual: array of { day, avgWeightG } sorted by day ascending */
export function buildChartData(
  breed: string,
  dayOfCycle: number,
  actual: { day: number; avgWeightG: number }[]
) {
  const maxDay = Math.min(dayOfCycle, 42)
  const rows = []
  for (let d = 0; d <= maxDay; d++) {
    const std = getStandardWeight(breed, d)
    const sample = actual.find(a => a.day === d)
    rows.push({
      day: d,
      standard: std ?? undefined,
      actual: sample?.avgWeightG ?? undefined,
    })
  }
  return rows
}
