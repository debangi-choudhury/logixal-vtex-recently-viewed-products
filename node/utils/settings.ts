export interface Settings {
  enableSync: boolean
  maxItems: number
  retentionDays: number
}

const DEFAULT_MAX_ITEMS = 30
const DEFAULT_RETENTION_DAYS = 90

// The Master Data schema allows at most 50 items.
const MAX_ITEMS_LIMIT = 50
const MAX_RETENTION_DAYS = 365

function clamp(value: unknown, fallback: number, max: number) {
  const number = Math.floor(Number(value))

  return Number.isFinite(number) && number >= 1
    ? Math.min(number, max)
    : fallback
}

export async function getSettings({
  clients: { apps },
}: Context): Promise<Settings> {
  const raw = await apps.getAppSettings(process.env.VTEX_APP_ID as string)

  return {
    enableSync: raw?.enableSync === true,
    maxItems: clamp(raw?.maxItems, DEFAULT_MAX_ITEMS, MAX_ITEMS_LIMIT),
    retentionDays: clamp(
      raw?.retentionDays,
      DEFAULT_RETENTION_DAYS,
      MAX_RETENTION_DAYS
    ),
  }
}
