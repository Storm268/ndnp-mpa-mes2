import CitizenPortalView from '@/components/citizen/CitizenPortalView'

export const metadata = {
  title: "Citizen Portal | Nelson's Dockyard National Park MPA",
  description: "Unlocked Citizen Portal for Nelson's Dockyard National Park Marine Protected Area. Interactive marine and trail map, UNESCO World Heritage guides, Caribbean marine species, and citizen science reporting.",
}

export default function CitizenPage() {
  return <CitizenPortalView isDashboard={false} />
}
