import { Bike, Star, Trophy } from "lucide-react";
import React, { useEffect, useState } from "react";
import { fetchRanking } from "../api/client";
import { OzFooter } from "../components/oz-footer";
import type { AuthState, UserRankEntry } from "../types";

function getMyId(): number | null {
  try {
    const raw = localStorage.getItem("auth");
    return raw ? (JSON.parse(raw) as AuthState).user_id : null;
  } catch { return null; }
}

export function RankingPage() {
  const [ranking, setRanking] = useState<UserRankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const myId = getMyId();

  useEffect(() => {
    fetchRanking().then(setRanking).catch(console.error).finally(() => setLoading(false));
  }, []);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="max-w-[480px] mx-auto pb-24 md:pb-6">
      <div className="px-4 pt-6">
        <h1
          className="text-xl font-black mb-4 flex items-center gap-2"
          style={{ fontFamily: "var(--oz-font-heading)" }}
        >
          <Trophy className="w-6 h-6" style={{ color: "var(--oz-brand-green)" }} />
          Rangliste
        </h1>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" />
            ))}
          </div>
        ) : ranking.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Noch keine Einträge</p>
            <p className="text-sm">Fahr los und checke ein!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ranking.map((entry) => {
              const isMe = entry.user_id === myId;
              return (
                <div
                  key={entry.user_id}
                  className="bg-white rounded-2xl p-3.5 flex items-center gap-3"
                  style={{
                    boxShadow: isMe
                      ? "0 0 0 2px var(--oz-brand-green), var(--oz-shadow)"
                      : "var(--oz-shadow)",
                  }}
                >
                  <span className="text-xl w-7 text-center shrink-0">
                    {medals[entry.rank - 1] ?? (
                      <span className="text-sm font-bold text-gray-400">{entry.rank}</span>
                    )}
                  </span>

                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white shrink-0"
                    style={{ background: isMe ? "var(--oz-brand-green)" : "#9ca3af" }}
                  >
                    {entry.display_name[0]?.toUpperCase()}
                  </div>

                  <p className="flex-1 font-semibold text-gray-900 truncate text-sm">
                    {entry.display_name}
                    {isMe && (
                      <span
                        className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: "var(--oz-brand-green-light)", color: "var(--oz-brand-green)" }}
                      >
                        Du
                      </span>
                    )}
                  </p>

                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                      <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                      <span
                        className="font-black text-base"
                        style={{
                          fontFamily: "var(--oz-font-heading)",
                          color: entry.rank === 1 ? "var(--oz-brand-green)" : "var(--oz-text-primary)",
                        }}
                      >
                        {entry.points}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 justify-end text-xs text-gray-400">
                      <Bike className="w-3 h-3" />
                      {entry.checkin_count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6">
        <OzFooter />
      </div>
    </div>
  );
}
