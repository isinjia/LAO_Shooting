# 원작 스킬 재현율 감사 (2026-10-07)

대상은 선택 화면 3인(그리폰·슬레이프니르·익스프레스 76)의 C(원작 Skill1)와 X(원작 Skill2)이다. 원본은 `E:\LAO\Google_QA\Assets`이다.

## 방법

- **항목 범위:** 각 원본 클립에서 다음을 셌다.
  - 애니메이션 이벤트 (`EventDynamicBone` 물리 힌트 제외)
  - FX 오브젝트의 `m_IsActive` 활성 트랙
  - 투사체·피격 프리팹과 소품
  - 몸 애니메이션 전체
  - 루트 모션(경로)
  - 카메라·사운드 이벤트
- **채점:** 원본 데이터와 원본 텍스처로 재현하면 1, 일부 레이어만 재현하면 0.5, 누락이면 0이다.
- **제외 항목:** 리소스가 없는 이벤트는 셈에서 빼고 별도로 표기했다. 익스프레스 skill1 2.6초 사운드는 오브젝트 참조가 비어 있다.
- **사용자 지시 반영분:** 사용자가 명시적으로 바꾼 부분은 원작 대비 차이로 표기하되 감점하지 않았다.
  - 그리폰 폭격은 무작위 분산 10/15발이다.
  - 화면 절대 경로를 쓴다.
  - 이동 구간은 1.5배속이다.

| 스킬 | 원본 클립 | 항목 | 점수 | 재현율 |
|---|---|---|---|---|
| 그리폰 C | attack_hand_missile.anim (1.47s) | 10 | 10 | **100%** |
| 그리폰 X | attack_hand_missile_skill.anim (10.85s) | 19 | 19 | **100%** |
| 슬레이프니르 C | Skil_1.anim (7.63s) | 29 | 28 | **96.6%** |
| 슬레이프니르 X | Skil_2.anim (9.5s) | 30 | 28.5 | **95.0%** |
| 익스프레스 C | skill1.anim (4.23s) | 28 | 26 | **92.9%** |
| 익스프레스 X | skill2.anim (5.82s) | 19 | 18.5 | **97.4%** |
| **합계** | | 135 | 130 | **96.3%** |

여섯 스킬 모두 90% 이상이다.

## 항목별

### 그리폰 C — 10/10
- 반영: 몸 전체 36프레임(24fps), 루트 모션 없음, Fire1 0.5초 / Fire2 0.65초 핸드 미사일, 카메라 셰이크 3회(0.5/0.65/1.47초)
- 반영: FX `skill_1_fire`(pani_fire 포구 화염) ×2, `FX_bullet_hand_Missile`(handmissile 몸체·분사·부스터 연기, 1초 이징 곡선), 피격 `fire_Hit`
- 피해: C 예산 6/12/18을 2발에 나눈다.

### 그리폰 X — 19/19
- 반영: 몸 전체 262프레임, 비행 경로(영상 기준 화면 좌표), 카메라 셰이크 4회, `EventCameraControlStop`, 마무리 `EventHit fire_Hit`, SFX `char_05_skill2`
- 반영: FX `up_smoke`·`up_line`·`skill_2_di_fire`·`roket_fire_skill2`·`fly_line`, 투사체, 피격 2종(`fire_Hit`, `PA00EL_skill_2_hit`)
- 사용자 지시 차이: 무작위 분산 폭격(핸드 미사일 10발·화염탄 15발), 화면 절대 경로, 이동 1.5배속

### 슬레이프니르 C — 28/29
- 반영: 몸 전체 184프레임, `rotation_root` 30키 경로(화면 안으로 클램프)
- 반영 이벤트: 카메라 2회(FOV30 기본 구도), MoveMotion 시작·끝, MoveMotionBack 시작·끝, SFX `char 50_skill1_FULL`, 셰이크 0.3/1.5, `noHit_m`
- 반영 투사체: 사격 이벤트 35발(`Sleipnir_bullet`/`_bullet2`, 0.1초 비행), `lastfire_bullet`
- 반영 FX: `fire_L/L2/R/R2` 포구 화염(프레임 단위 창), `start_smoke`, `lastfire_aura`(guess_texture), `lastfire`(PD_skill1_hit + 포구), `back_smoke`
- 반영 아트·피격: `Spn_bullet`, `lastfire_bullet2`, 피격 `Sleipnir_hit`·`hit2`·`last_hit`(emily_skill_hit)
- 부분 반영(0.5 ×2): `sonicboom_L/R` — 4개 레이어 중 Padong 링만 재현

### 슬레이프니르 X — 28.5/30
- 반영: 몸 전체 228프레임(`bone_plane` 전투기 변신 포함), 경로
- 반영 이벤트: 카메라 3회(FOV13 근접 → 해제 → FOV35), SFX 3종, 셰이크 1.5, MoveMotion·Back 4회, `EventHit Sleipnir_skill2_attack`(지나가는 적마다), TimeScale 2회(히트스톱)
- 반영 FX: `down_smoke` ×2, `Up_smoke`, `eyes_lighiting`, `gogle_lighting`, `line_boost`, `after_smoke`/`3`/`2`/`4`, `boost`, 공격 피격(PD_skill1_hit + round_trans)
- 부분 반영(0.5 ×3):
  - `UP_fly_smoke`: boom_sqns + backsmoke만
  - `skill2_sonic_boom`: Padong 링만
  - `speed_line`: trail_fire 대신 라인 시트와 광대

### 익스프레스 C — 26/28
- 반영: 몸 전체 102프레임, `ch_root` 경로(1.12–2.12초 화면 밖)
- 반영 이벤트: SFX 3종, 카메라 3회(해제 → FOV20 타격 근접 → 해제), MoveMotion 2회, EvadeCheck(무적), GrabMove 2회(ATM 투척), `EventHit Express_skill1_attack`, 셰이크 0.8, TimeScale 2회, MoveMotionBack 2회
- 반영 FX·소품: `down_smoke`, `sonicboom`, `fire_particle`(DrM_skill2_last_hit), ATM·파손 ATM·지폐(원본 아틀라스)
- 피해: 대상 1명에게 6/12/18, 밀어내기, 송장 표식
- 누락(0 ×2): GrabMoveBack 시작·끝 — 마지막 0.02초의 로프 회수

### 익스프레스 X — 18.5/19
- 반영: 몸 전체 140프레임(EX_star 별 포함), 경로
- 반영 이벤트: 카메라(FOV15), SFX 2종, MoveMotion·Back 4회, `EventBuffeffect` 3.17초
- 반영 FX: `down_smoke`, `skill2_lighting`, `box_lighting`, `simple_skill_hit` ×4(폭탄이라 적에게 적용), `ande_bling`, `eye_bling`, `buff_lighting_event`
- 부분 반영(0.5): `box_in_particle` — fire_texture 입자 대신 빛 입자

## 이후 사용자 지시 변경 (재현율 산정 제외)

- 슬레이프니르 C: 고정 구역 왕복 대시 4회로 바꿨다. 원작 Skil_1 몸 클립의 블링크 구간 타이밍은 유지하고, 쌍권총·라스트파이어는 쓰지 않는다.
- 슬레이프니르 X: 맵 중앙선 고정 돌격으로 바꾸고 이펙트를 확대했다.
- 익스프레스: C 이탈 구간 3배속, X 전진 이동 제거.

## 게임 규칙상 적용

- 원작은 턴제이므로 피해 수치를 다음처럼 옮겼다.
  - C: 6/12/18
  - X: 일반 적 40, 보스 22
  - 즉시 적탄 소거와 무적 판정은 그대로다.
- C 출격 중에는 원작 EvadeCheck처럼 무적이다. 일반 사격과 차지는 멈추고, 이동 입력은 돌아올 자리를 정한다.
  - 예외: 그리폰 C는 이동할 수 있고 무적이 없다.
- 폭탄은 모든 캐릭터가 애니메이션이 끝날 때까지 이동할 수 없다. 끝난 뒤 2초 동안 무적이다(사용자 지정).
- 익스프레스 X의 원작은 아군 버프다. 1인 게임이므로 다음처럼 바꿨다.
  - 원작에서 받는 쪽에 들어가는 타격광 4회를 적에게 적용했다.
  - 버프는 자신에게 준다. 공격력 +20%를 6초, AP+3은 C 게이지 1칸이다.

## 검증 (2026-10-07)

- **피해량:** 레벨·캐릭터 전 조합을 측정했다. C는 Lv1/2/3에서 6/12/18, X는 적마다 40이다.
- **오류:** 60초 실전 소크(C·X 반복 사용), 카메라 복귀(z=1), SFX 발동 시점, 스페셜 밸런스 검사 모두 콘솔 오류가 없었다.
