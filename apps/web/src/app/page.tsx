"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Landing } from "@/components/Landing";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/traces");
    }
  }, [user, loading, router]);

  if (loading) return null;
  if (user) return null;

  return <Landing />;
}
