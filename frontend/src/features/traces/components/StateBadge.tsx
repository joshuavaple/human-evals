import { Badge } from '@/components/ui/Badge'

export function StateBadge({ state }: { state: string }) {
  const tone = state === 'OK' ? 'green' : state === 'ERROR' ? 'red' : 'gray'
  return <Badge tone={tone}>{state}</Badge>
}
