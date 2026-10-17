import { CircleUserRound, LogOut, ShieldCheck, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RbacRole } from "@/lib/types";

interface AccountMenuProps {
  user: User;
  activeRole: RbacRole;
  onManageAccount: () => void;
  onSignOut: () => void;
}

function initials(user: User) {
  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "R";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part: string) => part[0])
    .join("")
    .toUpperCase();
}

export function AccountMenu({ user, activeRole, onManageAccount, onSignOut }: AccountMenuProps) {
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open account menu"
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-indigo-200 bg-white text-xs font-bold text-indigo-700 shadow-sm transition hover:border-indigo-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Account avatar" className="h-full w-full object-cover" />
          ) : (
            initials(user)
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 border-slate-200 bg-white p-2 text-slate-800 shadow-xl"
      >
        <DropdownMenuLabel className="px-3 py-2">
          <div className="flex items-center gap-2">
            <CircleUserRound className="h-4 w-4 text-indigo-600" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {user.user_metadata?.full_name || user.email}
              </p>
              <p className="truncate text-[11px] font-normal text-slate-500">{user.email}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-100" />
        <div className="px-3 py-2 text-xs text-slate-500">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-600" /> Current role
            </span>
            <span className="font-semibold text-slate-800">{activeRole}</span>
          </div>
        </div>
        <DropdownMenuItem
          onSelect={onManageAccount}
          className="cursor-pointer text-slate-700 focus:bg-indigo-50 focus:text-indigo-700"
        >
          <UserRound className="h-4 w-4" />
          Manage account &amp; role
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={onSignOut}
          className="cursor-pointer text-rose-600 focus:bg-rose-50 focus:text-rose-700"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
