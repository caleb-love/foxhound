import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirect to demo mode by default
  // Change to '/login' if you want auth-first experience
  redirect('/demo');
}
