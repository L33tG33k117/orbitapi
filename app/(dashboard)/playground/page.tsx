import { redirect } from 'next/navigation'

// Playground was renamed to Starlab. Keep this redirect so any old links land.
export default function PlaygroundRedirect() {
  redirect('/starlab')
}
