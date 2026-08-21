import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { TowerStage } from '../components/TowerStage'
import { useAuth } from '../context/AuthContext'
import { checkpointFloor } from '../game/tower/combat'
import { HERO_COUNT } from '../game/tower/config'
import { formatExcelNumber } from '../game/tower/excelNumber'
import {
  HERO_KIND_CATALOG,
  heroHpFor,
  heroAtkFor,
  heroMoveSpeed,
  heroSpawnSeconds,
  heroUpgradeBatchCost,
} from '../game/tower/heroes'
import { useTowerGame } from '../game/tower/useTowerGame'
import type { SpeedRate } from '../game/tower/types'

function soldierIconName(name: string) {
  return name.trim().slice(0, 1) || '士'
}

const SPEEDS: SpeedRate[] = [1, 2, 3]
const UPGRADE_BATCHES = [1, 10, 100] as const
type UpgradeBatch = (typeof UPGRADE_BATCHES)[number]
type DrawerTab = 'power' | 'soldiers' | 'gear' | 'shop' | null

export function TowerPage() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <TowerBoard key={user.id} userId={user.id} />
}

function TowerBoard({ userId }: { userId: string }) {
  const game = useTowerGame(userId)
  const [tab, setTab] = useState<DrawerTab>(null)
  const [batch, setBatch] = useState<UpgradeBatch>(1)
  const checkpoint = checkpointFloor(game.floor)
  const soldierCap = Math.max(1, Math.min(4, HERO_COUNT))
  const hpRatio = game.maxHp === 0 ? 0 : game.hp / game.maxHp
  const drawerOpen = tab !== null
  const showSoldierPanel = tab === 'power' || tab === 'soldiers'

  const toggleTab = (next: DrawerTab) => {
    setTab((cur) => (cur === next ? null : next))
  }

  const cycleBatch = () => {
    const idx = UPGRADE_BATCHES.indexOf(batch)
    setBatch(UPGRADE_BATCHES[(idx + 1) % UPGRADE_BATCHES.length]!)
  }

  return (
    <div className={`page tower-page${drawerOpen ? ' drawer-open' : ''}`}>
      <div className="tower-shell">
        <header className="tower-topbar">
          <div className="tower-topbar-row">
            <div className="tower-gold-chip" aria-label="金幣">
              <span className="tower-gold-dot" aria-hidden="true" />
              <strong>{formatExcelNumber(game.gold)}</strong>
            </div>
            <div className="tower-top-slots" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="tower-top-actions">
              <button
                type="button"
                className="tower-icon-btn"
                disabled={game.defeated}
                onClick={() => game.engine.togglePause()}
                aria-label={game.paused ? '繼續' : '暫停'}
              >
                {game.paused ? '▶' : 'Ⅱ'}
              </button>
            </div>
          </div>

          <div className="tower-status-bar" role="status">
            <div className="tower-status-cell">
              <em>氣血</em>
              <strong>
                {formatExcelNumber(game.hp)}
                <small>/{formatExcelNumber(game.maxHp)}</small>
              </strong>
              <div className="tower-meter slim">
                <span style={{ width: `${Math.round(Math.max(0, Math.min(1, hpRatio)) * 100)}%` }} />
              </div>
            </div>
            <div className="tower-status-cell">
              <em>士兵數</em>
              <strong>
                {game.liveSoldiers}
                <small>/{soldierCap}</small>
              </strong>
            </div>
            <div className="tower-status-cell">
              <em>最上層</em>
              <strong>{game.bestFloor}</strong>
            </div>
            <div className="tower-status-cell">
              <em>檢查點</em>
              <strong>{checkpoint}</strong>
            </div>
            <div className="tower-status-cell muted">
              <em>目前</em>
              <strong>{game.floor} 層</strong>
            </div>
          </div>
        </header>

        <div className="tower-stage-wrap">
          <TowerStage engine={game.engine} />
        </div>

        <nav className="tower-bottombar" aria-label="升級選單">
          <button
            type="button"
            className={`tower-dock-btn${tab === 'power' ? ' active' : ''}`}
            aria-pressed={tab === 'power'}
            onClick={() => toggleTab('power')}
          >
            <span className="tower-dock-ico hero" aria-hidden="true">
              勇
            </span>
            <strong>力量上升</strong>
          </button>
          <button
            type="button"
            className={`tower-dock-btn${tab === 'soldiers' ? ' active' : ''}`}
            aria-pressed={tab === 'soldiers'}
            onClick={() => toggleTab('soldiers')}
          >
            <span className="tower-dock-ico soldier" aria-hidden="true">
              兵
            </span>
            <strong>士兵</strong>
          </button>
          <button
            type="button"
            className={`tower-dock-btn${tab === 'gear' ? ' active' : ''}`}
            aria-pressed={tab === 'gear'}
            onClick={() => toggleTab('gear')}
          >
            <span className="tower-dock-ico gear" aria-hidden="true">
              裝
            </span>
            <strong>裝備物品</strong>
          </button>
          <button
            type="button"
            className={`tower-dock-btn${tab === 'shop' ? ' active' : ''}`}
            aria-pressed={tab === 'shop'}
            onClick={() => toggleTab('shop')}
          >
            <span className="tower-dock-ico shop" aria-hidden="true">
              店
            </span>
            <strong>商店</strong>
          </button>
        </nav>

        <div
          className="tower-sheet"
          data-open={drawerOpen ? 'true' : 'false'}
          id="tower-upgrade-drawer"
        >
          <div className="tower-sheet-inner">
            {showSoldierPanel ? (
              <section className="tower-soldier-panel">
                <div className="tower-sheet-toolbar">
                  <button
                    type="button"
                    className="tower-batch-btn"
                    onClick={cycleBatch}
                    aria-label={`升級倍率 x${batch}，點擊切換`}
                  >
                    x{batch}
                  </button>
                  <button
                    type="button"
                    className="tower-sheet-close"
                    onClick={() => setTab(null)}
                    aria-label="關閉"
                  >
                    ×
                  </button>
                </div>

                <div className="tower-soldier-cards">
                  {game.unlockedSoldiers.map((soldierId) => {
                    const soldier = HERO_KIND_CATALOG[soldierId]
                    const level = game.heroLevels[soldier.id] ?? 0
                    const cost = heroUpgradeBatchCost(soldier.id, level, batch)
                    const spawnProgress = game.spawnProgressByKind?.[soldier.id] ?? 0
                    const spawnSec = heroSpawnSeconds(soldier.id, level)
                    const moveSpd = heroMoveSpeed(soldier.id, level)
                    const canUpgrade = !game.defeated && game.gold >= cost && cost > 0

                    return (
                      <article key={soldier.id} className="tower-soldier-card">
                        <div className="tower-soldier-icon" aria-hidden="true">
                          {soldierIconName(soldier.name)}
                        </div>

                        <div className="tower-soldier-main">
                          <div className="tower-soldier-topline">
                            <strong className="tower-soldier-name">
                              {soldier.name}
                              <span>{` LV ${level}`}</span>
                            </strong>
                            <div className="tower-soldier-combat">
                              <span>
                                <em>HP</em>
                                {formatExcelNumber(heroHpFor(soldier.id, level))}
                              </span>
                              <span>
                                <em>攻擊力</em>
                                {formatExcelNumber(heroAtkFor(soldier.id, level))}
                              </span>
                            </div>
                          </div>

                          <div
                            className={`tower-spawn-bar${spawnProgress > 0 ? ' active' : ''}${spawnProgress >= 0.85 ? ' nearing' : ''}`}
                            aria-label="生成進度"
                          >
                            <span style={{ width: `${Math.round(spawnProgress * 100)}%` }} />
                          </div>

                          <div className="tower-soldier-subs">
                            <div className="tower-substat">
                              <em>出現速度</em>
                              <strong>
                                {Number.isFinite(spawnSec) ? `${spawnSec.toFixed(1)}秒` : '—'}
                              </strong>
                            </div>
                            <div className="tower-substat">
                              <em>移動速度</em>
                              <strong>{moveSpd.toFixed(2)}</strong>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="tower-levelup-btn"
                          disabled={!canUpgrade}
                          onClick={() => game.engine.upgradeHeroKind(soldier.id, batch)}
                        >
                          <strong>{formatExcelNumber(cost)}</strong>
                          <span>等級上升</span>
                        </button>
                      </article>
                    )
                  })}
                </div>
              </section>
            ) : null}

            {tab === 'gear' ? (
              <section className="tower-sheet-section">
                <div className="tower-sheet-toolbar">
                  <h3>裝備物品</h3>
                  <button
                    type="button"
                    className="tower-sheet-close"
                    onClick={() => setTab(null)}
                    aria-label="關閉"
                  >
                    ×
                  </button>
                </div>
                <p className="tower-shop-note">目前可調整遊戲速度；裝備系統稍後加入。</p>
                <div className="tower-speed" role="group" aria-label="速度">
                  {SPEEDS.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      className={`tower-btn${game.speed === rate ? ' active' : ''}`}
                      aria-pressed={game.speed === rate}
                      onClick={() => game.engine.setSpeed(rate)}
                    >
                      {rate}×
                    </button>
                  ))}
                  <button
                    type="button"
                    className="tower-btn"
                    disabled={game.defeated}
                    onClick={() => game.engine.togglePause()}
                  >
                    {game.paused ? '繼續' : '暫停'}
                  </button>
                </div>
              </section>
            ) : null}

            {tab === 'shop' ? (
              <section className="tower-sheet-section">
                <div className="tower-sheet-toolbar">
                  <h3>商店</h3>
                  <button
                    type="button"
                    className="tower-sheet-close"
                    onClick={() => setTab(null)}
                    aria-label="關閉"
                  >
                    ×
                  </button>
                </div>
                {game.defeated ? (
                  <div className="tower-defeat">
                    <p>
                      可花 {formatExcelNumber(game.reviveCost)} 金幣原地續戰，或退回第{' '}
                      {checkpoint} 層檢查點。
                    </p>
                    <button
                      type="button"
                      className="tower-btn primary"
                      disabled={!game.canRevive}
                      onClick={() => game.engine.revive()}
                    >
                      復活（{formatExcelNumber(game.reviveCost)} 金）
                    </button>
                    <button
                      type="button"
                      className="tower-btn"
                      onClick={() => game.engine.retreat()}
                    >
                      回檢查點
                    </button>
                  </div>
                ) : (
                  <p className="tower-shop-note">戰鬥中可在此復活／重置。目前無需消費。</p>
                )}
                <button
                  type="button"
                  className="tower-btn ghost"
                  onClick={() => {
                    if (window.confirm('確定放棄並重開？進度會重置到最高紀錄。')) {
                      game.engine.abandon()
                      setTab(null)
                    }
                  }}
                >
                  放棄重開
                </button>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
