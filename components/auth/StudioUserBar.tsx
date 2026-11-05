"use client";
import { useCurrentUser } from "./AuthSession";
import { UserMenu } from "./UserMenu";

export function StudioUserBar() {
  const user = useCurrentUser();
  return <div className="studio-user-bar"><span>{user?.name} · Professor</span><UserMenu /></div>;
}
