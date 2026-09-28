'useclient'

import{ useCallback, useEffect, useState} from'react'
import{ AnimatePresence, motion} from'framer-motion'
import{ useGame, api} from'@/lib/store'
import{ HEN_TYPES, ANIMAL_TYPES } from'@/lib/game'
import{ Button} from'@/components/ui/button'
import{ Input} from'@/components/ui/input'
import{ Label} from'@/components/ui/label'
import{ GameCard, SectionTitle, EmptyState, ProgressBar, ErrorState, LoadingSpinner} from'./shared'
import{ cn} from'@/lib/utils'

interfaceFriendRow{
  userId:string; username:string; farmName:string; avatar: string level:number; vip:boolean; online:boolean; canGift: boolean direction:string; rowId: string}
interfaceRequestRow{ rowId:string; userId:string; username:string; farmName:string; avatar: string}
interfaceClanMemberRow{
  userId:string; username:string; farmName:string; avatar: string role:string; contribution:number; joinedAt: string}
interfaceClanView{
  id:string; name:string; tag:string; emblem:string; description: string level:number; xp:number; nextLevelXp: number| null; treasury: numbermemberCap:number; weeklyReward: numbermyRole:string; myContribution:number; lastClaimAt: string| null members:ClanMemberRow[]}
interfaceClanListRow{
  id:string; rank:number; name:string; tag:string; emblem: string level:number; xp:number; treasury:number; memberCount:number; leaderName: string}
interfaceSocialData{
  friends:FriendRow[] requests:RequestRow[]sentPending:{ rowId:string; username:string; farmName: string}[]giftAmount: number clan:ClanView| nullclanList:ClanListRow[]}
interfaceVisitData{
  restricted: boolean user:{ id:string; username:string; farmName:string; avatar:string; levelName:number; xp?:number; coins?:number; gems?:number; lastSeenAt?: string}
  farm?:{ coopLevel:number; landLevel:number; storageLevel:number; shelterLevel:number; health: string}
  hensByType?:Record<string, number>
  animalsByType?:Record<string, number>
  totalHens?:number; totalAnimals?: numberclan?:{ name:string; tag:string; emblem: string} | null}

constCLAN_EMBLEMS = ['🛡️', '🐔', '👑', '🌾', '🔥', '⭐', '🦅', '💎'] export functionSocialView() {
  const{ state, act, loading, showFlash} = useGame()
  const[data, setData]= useState<SocialData| null>(null)
  const[tab, setTab]= useState<'friends' | 'clan'>('friends')
  const[addName, setAddName]= useState('')
  const[visit, setVisit]= useState<VisitData| null>(null)
  const[clanForm, setClanForm]= useState(false)
  const[clanName, setClanName]= useState('')
  const[clanTag, setClanTag]= useState('')
  const[clanEmblem, setClanEmblem]= useState('🛡️')
  const[donateAmt, setDonateAmt]= useState('200')
  const[reloadKey, setReloadKey]= useState(0)

  const[loadError, setLoadError]= useState<string| null>(null)

  const reload= useCallback(() => setReloadKey(k=> k+ 1), [])

  useEffect(() => {
    let cancelled= falseapi<SocialData>('/api/social')
      .then(d=> { if(!cancelled) { setData(d); setLoadError(null) } })
      .catch((e:unknown) => {
        if(cancelled) returnsetLoadError(e instanceofError? e.message :'Could not load friends andclan')
      })
    return() => { cancelled= true}
  }, [reloadKey, state?.pendingFriendRequests])

  if(!state) return null constmyId= state.user.id async functionhandleAdd() {
    if(!addName.trim()) return const res= awaitact('friend_add', { username:addName.trim() })
    if(res) { setAddName(''); reload() }
  }

  async functionhandleVisit(userId:string) {
    try{
      const v= awaitapi<VisitData>(`/api/social?visit=${userId}`)
      setVisit(v)
    } catch(e) {
      showFlash(e instanceofError? e.message :'Visitfailed', 'error')
    }
  }

  async functionhandleCreateClan() {
    const res= awaitact('clan_create', { name:clanName, tag:clanTag, emblem:clanEmblem})
    if(res) { setClanForm(false); setClanName(''); setClanTag(''); reload() }
  }

  return(
    <div className="space-y-3 px-3 pb-4">
      <div className="rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4shadow-sm">
        <p className="text-lg font-blacktext-stone-800">🤝 FarmerCommunity</p>
        <p className="text-xstext-stone-500">Addfriends, visitfarms, send gifts& build clanstogether.</p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-100  p-1">
        {(['friends', 'clan'] asconst).map(t=> (
          <buttonkey={t}
            onClick={() => setTab(t)}
            className={cn(
              'relative rounded-xl py-2 text-xs font-extrabold transition-all',
              tab=== t? 'bg-white text-emerald-700shadow' :'text-stone-600'
            )}
          >
            {t=== 'friends' ? `🤝 Friends${data?.requests.length? ` (${data.requests.length})` :''}` :'🛡️ Clans'}
            {t=== 'friends' && !!data?.requests.length&& (
              <span className="absolute right-1 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-700 px-1 text-[9px] font-black text-white">
                {data.requests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loadError? (
        <GameCard>
          <ErrorStatetitle="Couldn't load friends& clan" message={loadError} onRetry={reload} />
        </GameCard>
      ) :!data? (
        <GameCard>
          <LoadingSpinnerlabel="Loadingcommunity..." />
        </GameCard>
      ) : tab=== 'friends' ? (
        <>
          {/* add friend*/}
          <GameCard>
            <p className="text-sm font-blacktext-stone-800">➕ Add aFriend</p>
            <p className="text-[11px]text-stone-500">Search by username— e.g. invite<b>demo</b> or a buddy to farmtogether.</p>
            <div className="mt-2 flex gap-2">
              <Inputvalue={addName}
                onChange={e=> setAddName(e.target.value)}
                placeholder="username…"
                className="h-9 rounded-xlbg-stone-50"
                onKeyDown={e=> e.key=== 'Enter' && handleAdd()}
              />
              <Buttonsize="sm" onClick={handleAdd} disabled={loading|| !addName.trim()}
                className="h-9 rounded-xl bg-emerald-700 px-4 text-xs font-extrabold text-white"
              >
                Invite</Button>
            </div>
          </GameCard>

          {/* pending requests*/}
          {data.requests.length> 0&& (
            <>
              <SectionTitle>📨 FriendRequests</SectionTitle>
              <div className="space-y-2">
                {data.requests.map(r=> (
                  <GameCardkey={r.rowId} className="flex items-center gap-2">
                    <span className="text-2xl">{r.avatar}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-blacktext-stone-800">{r.farmName}</p>
                      <p className="text-[10px]text-stone-600">@{r.username}</p>
                    </div>
                    <Buttonsize="sm" onClick={async() => { awaitact('friend_accept', { requestId:r.rowId}); reload() }}
                      className="h-8 rounded-full bg-emerald-700 px-3 text-xs font-extrabold text-white"
                    >
                      Accept</Button>
                    <Buttonsize="sm" variant="outline" onClick={async() => { awaitact('friend_reject', { requestId:r.rowId}); reload() }}
                      className="h-8 rounded-full px-3 text-xs font-bold"
                    >
                      ✕
                    </Button>
                  </GameCard>
                ))}
              </div>
            </>
          )}

          {/* friends list*/}
          <SectionTitle>🌾 MyFriends({data.friends.length})</SectionTitle>
          {data.friends.length=== 0? (
            <GameCard><EmptyStateemoji="🤝" title="No friendsyet" sub="Add a farmer above— try username:demo" /></GameCard>
          ) :(
            <div className="space-y-2">
              {data.friends.map(f=> (
                <GameCardkey={f.userId} className="flex items-center gap-2">
                  <div className="relative">
                    <span className="text-2xl">{f.avatar}</span>
                    {f.online&& <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-whitebg-green-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-blacktext-stone-800">
                      {f.farmName} {f.vip&& <spantitle="VIP">👑</span>}
                    </p>
                    <p className="text-[10px]text-stone-600">@{f.username} · ⭐ Lv{f.level}</p>
                  </div>
                  <div className="flex shrink-0gap-1">
                    <button onClick={() => handleVisit(f.userId)}
                      className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-blacktext-stone-600"
                    >
                      👀 Visit</button>
                    <button onClick={async() => { awaitact('gift_friend', { friendUserId:f.userId}); reload() }}
                      disabled={loading|| !f.canGift}
                      className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-900disabled:opacity-40"
                    >
                      🎁 Gift</button>
                    <button onClick={async() => { awaitact('help_friend', { friendUserId:f.userId}) }}
                      disabled={loading}
                      className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700disabled:opacity-40"
                    >
                      🧑‍🌾 Help</button>
                  </div>
                </GameCard>
              ))}
            </div>
          )}

          {data.sentPending.length> 0&& (
            <p className="rounded-xl bg-stone-100 px-3 py-2 text-[11px] font-boldtext-stone-500">
              ⏳ Pending invites:{data.sentPending.map(s=> `@${s.username}`).join(', ')}
            </p>
          )}
        </>
      ) :(
        <>
          {/* my clan*/}
          {data.clan? (
            <>
              <GameCard className="bg-gradient-to-r from-purple-50to-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-purple-200 bg-white text-3xlshadow">
                    {data.clan.emblem}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-blacktext-stone-800">
                      {data.clan.name} <span className="rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-blacktext-purple-700">[{data.clan.tag}]</span>
                    </p>
                    <p className="text-[11px]text-stone-500">
                      🏅 Lv{data.clan.level} · 👥 {data.clan.members.length}/{data.clan.memberCap} · 💰 {data.clan.treasury.toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-purple-100 px-2 py-1 text-[9px] font-black uppercasetext-purple-700">{data.clan.myRole}</span>
                </div>
                <div className="mt-2">
                  <ProgressBarpct={data.clan.nextLevelXp? Math.min(100, Math.round((data.clan.xp /data.clan.nextLevelXp) * 100)) :100}
                    className="h-1.5"
                  />
                  <p className="mt-1 text-[10px]text-stone-600">
                    ClanXP {data.clan.xp.toLocaleString()}{data.clan.nextLevelXp? ` /${data.clan.nextLevelXp.toLocaleString()}` :' · MAX'} · members get+{2* (data.clan.level -1)}% production</p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-purple-50 p-2text-center">
                    <p className="text-[9px] font-black uppercasetext-purple-400">WeeklyReward</p>
                    <p className="text-xs font-blacktext-purple-700">🪙 {data.clan.weeklyReward.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl bg-purple-50 p-2text-center">
                    <p className="text-[9px] font-black uppercasetext-purple-400">MyContribution</p>
                    <p className="text-xs font-blacktext-purple-700">🪙 {data.clan.myContribution.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl bg-purple-50 p-2text-center">
                    <p className="text-[9px] font-black uppercasetext-purple-400">Treasury</p>
                    <p className="text-xs font-blacktext-purple-700">💰 {data.clan.treasury.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Buttonsize="sm"
                    onClick={async() => { awaitact('clan_claim'); reload() }}
                    disabled={loading}
                    className="h-9 flex-1 rounded-xl bg-purple-700 text-xs font-extrabold text-white"
                  >
                    🎁 ClaimWeekly</Button>
                  <Buttonsize="sm" variant="outline"
                    onClick={async() => { awaitact('clan_leave'); reload() }}
                    disabled={loading}
                    className="h-9 rounded-xl px-3 text-xs font-bold"
                  >
                    Leave</Button>
                </div>
                <div className="mt-2 flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-[10px] font-boldtext-stone-600">Donate to treasury(min50)</Label>
                    <Inputtype="number" value={donateAmt} min={50}
                      onChange={e=> setDonateAmt(e.target.value)}
                      className="mt-1 h-9 rounded-xlbg-stone-50"
                    />
                  </div>
                  <Buttonsize="sm"
                    onClick={async() => { awaitact('clan_donate', { amount:Number(donateAmt) }); reload() }}
                    disabled={loading|| !Number(donateAmt) || Number(donateAmt) < 50}
                    className="h-9 rounded-xl bg-amber-800 px-4 text-xs font-extrabold text-white"
                  >
                    💰 Donate</Button>
                </div>
              </GameCard>

              <SectionTitle>👥 ClanMembers</SectionTitle>
              <div className="space-y-1.5">
                {data.clan.members.map(m=> (
                  <GameCardkey={m.userId} className="flex items-center gap-2 py-2">
                    <span className="text-xl">{m.avatar}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-blacktext-stone-800">
                        {m.farmName} {m.userId=== myId&& <span className="text-[9px]text-purple-600">(YOU)</span>}
                      </p>
                      <p className="text-[10px]text-stone-600">@{m.username} · contributed🪙 {m.contribution.toLocaleString()}</p>
                    </div>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[9px] font-black uppercase',
                      m.role=== 'chief' ? 'bg-amber-100  text-amber-700' : m.role=== 'officer' ? 'bg-purple-100  text-purple-700' :'bg-stone-100  text-stone-500'
                    )}>
                      {m.role=== 'chief' ? '👑 Chief' :m.role}
                    </span>
                    {m.userId!== myId&& (
                      <button onClick={() => handleVisit(m.userId)}
                        className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-blacktext-stone-600"
                      >
                        👀
                      </button>
                    )}
                  </GameCard>
                ))}
              </div>
            </>
          ) :(
            <GameCard className="bg-gradient-to-r from-purple-50to-white">
              <p className="text-sm font-blacktext-stone-800">🛡️ Join orFound aClan</p>
              <p className="mt-1 text-[11px]text-stone-500">
                Clans give every member+2% production per clanlevel, weekly coin rewards and group leaderboards.</p>
              <Button onClick={() => setClanForm(v=> !v)}
                className="mt-3 h-10 w-full rounded-xl bg-purple-600 text-sm font-extrabold text-white"
              >
                {clanForm? 'Close' :`✨ Found aClan(🪙 2,000)`}
              </Button>
              <AnimatePresence>
                {clanForm&& (
                  <motion.divinitial={{ height:0, opacity: 0}} animate={{ height:'auto', opacity: 1}} exit={{ height:0, opacity: 0}}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-2">
                      <div>
                        <Label className="text-[10px] font-boldtext-stone-500">Clan name(3-24chars)</Label>
                        <Inputvalue={clanName} onChange={e=> setClanName(e.target.value)} className="mt-1 h-9 rounded-xlbg-stone-50" placeholder="GoldenFarmers" />
                      </div>
                      <div>
                        <Label className="text-[10px] font-boldtext-stone-500">Tag(2-4chars)</Label>
                        <Inputvalue={clanTag} onChange={e=> setClanTag(e.target.value.toUpperCase())} className="mt-1 h-9 rounded-xlbg-stone-50" placeholder="GFC" maxLength={4} />
                      </div>
                      <div>
                        <Label className="text-[10px] font-boldtext-stone-500">Emblem</Label>
                        <div className="mt-1 flex flex-wrapgap-1">
                          {CLAN_EMBLEMS.map(e=> (
                            <buttonkey={e}
                              onClick={() => setClanEmblem(e)}
                              className={cn(
                                'h-9 w-9 rounded-xl bordertext-lg',
                                clanEmblem=== e? 'border-purple-500bg-purple-50' :'border-stone-200bg-white'
                              )}
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Button onClick={handleCreateClan}
                        disabled={loading|| clanName.length< 3|| clanTag.length< 2}
                        className="h-10 w-full rounded-xl bg-purple-600 font-extrabold text-white"
                      >
                        FoundClan(🪙 2,000)
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </GameCard>
          )}

          {/* clan leaderboard*/}
          <SectionTitle>🏆 ClanLeaderboard</SectionTitle>
          <div className="space-y-1.5">
            {data.clanList.length=== 0? (
              <GameCard><EmptyStateemoji="🛡️" title="No clansyet" sub="Be the first to foundone!" /></GameCard>
            ) :data.clanList.map(c=> (
              <GameCardkey={c.id} className={cn('flex items-center gap-2 py-2.5', data.clan?.id=== c.id&& 'border-purple-400bg-purple-50')}>
                <span className={cn(
                  'w-7 text-center text-sm font-black',
                  c.rank=== 1? 'text-amber-500' : c.rank=== 2? 'text-stone-600' : c.rank=== 3? 'text-orange-700' :'text-stone-600'
                )}>
                  {c.rank<= 3? ['🥇', '🥈', '🥉'][c.rank - 1] :c.rank}
                </span>
                <span className="text-xl">{c.emblem}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-blacktext-stone-800">
                    {c.name} <span className="text-[9px]text-purple-600">[{c.tag}]</span>
                  </p>
                  <p className="truncate text-[10px]text-stone-600">🏅 Lv{c.level} · 👥 {c.memberCount} · chief{c.leaderName}</p>
                </div>
                <div className="shrink-0text-right">
                  <p className="text-xs font-black tabular-numstext-purple-700">⭐ {c.xp.toLocaleString()}</p>
                  {data.clan?.id!== c.id&& (
                    <button onClick={async() => { awaitact('clan_join', { clanId: c.id}); reload() }}
                      disabled={loading|| !!data.clan}
                      className="mt-0.5 rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-black text-purple-700disabled:opacity-40"
                    >
                      Join</button>
                  )}
                </div>
              </GameCard>
            ))}
          </div>
        </>
      )}

      {/* ── farm visit modal── */}
      <AnimatePresence>
        {visit&& (
          <motion.divinitial={{ opacity: 0}} animate={{ opacity: 1}} exit={{ opacity: 0}}
            className="fixed inset-0 z-50 flex items-end justify-centerbg-black/50"
            onClick={() => setVisit(null)}
          >
            <motion.divinitial={{ y: 160}} animate={{ y: 0}} exit={{ y: 160}}
              onClick={e=> e.stopPropagation()}
              className="max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5shadow-2xl"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-fullbg-stone-300" />
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-amber-300 bg-amber-50 text-3xlshadow">
                  {visit.user.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-blacktext-stone-800">
                    {visit.user.farmName} {visit.restricted? '' :'🏠'}
                  </p>
                  <p className="text-[11px]text-stone-500">@{visit.user.username} · ⭐ Lv{visit.user.levelName}{visit.clan? ` · ${visit.clan.emblem} ${visit.clan.name}` :''}</p>
                </div>
              </div>

              {visit.restricted? (
                <EmptyStateemoji="🔒" title="Privatefarm" sub="Become friends first to visit theirfarm!" />
              ) :(
                <>
                  <div className="mt-3 grid grid-cols-4 gap-2text-center">
                    <VisitStaticon="🏠" label="Coop" value={`Lv${visit.farm?.coopLevel?? 1}`} />
                    <VisitStaticon="🐔" label="Hens" value={String(visit.totalHens?? 0)} />
                    <VisitStaticon="🐄" label="Animals" value={String(visit.totalAnimals?? 0)} />
                    <VisitStaticon="❤️" label="Status" value={visit.farm?.health?? '—'} />
                  </div>

                  {visit.hensByType&& Object.keys(visit.hensByType).length> 0&& (
                    <div className="mt-3">
                      <p className="text-[10px] font-black uppercasetext-stone-600">Theirflock</p>
                      <div className="mt-1 flex flex-wrapgap-1.5">
                        {Object.entries(visit.hensByType).map(([t, n]) => (
                          <spankey={t} className="rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-boldtext-stone-600">
                            {HEN_TYPES[t]?.emoji?? '🐔'} {HEN_TYPES[t]?.name?? t} ×{n}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {visit.animalsByType&& Object.keys(visit.animalsByType).length> 0&& (
                    <div className="mt-2">
                      <p className="text-[10px] font-black uppercasetext-stone-600">Theiranimals</p>
                      <div className="mt-1 flex flex-wrapgap-1.5">
                        {Object.entries(visit.animalsByType).map(([t, n]) => (
                          <spankey={t} className="rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-boldtext-stone-600">
                            {ANIMAL_TYPES[t]?.emoji?? '🐄'} {ANIMAL_TYPES[t]?.name?? t} ×{n}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <Button onClick={() => setVisit(null)}
                variant="outline"
                className="mt-4 h-11 w-full rounded-2xl text-sm font-bold"
              >
                Close</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

functionVisitStat({ icon, label, value}:{ icon:string; label:string; value: string}) {
  return(
    <div className="rounded-xl border border-stone-200 bg-stone-50  py-1.5">
      <p className="text-sm">{icon}</p>
      <p className="text-xs font-black tabular-numstext-stone-700">{value}</p>
      <p className="text-[9px] font-bold uppercasetext-stone-600">{label}</p>
    </div>
  )
}
