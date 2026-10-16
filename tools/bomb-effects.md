# 캐릭터별 폭탄 연출

폭탄 X의 기존 판정(재고 1개, 적탄 즉시 제거, 최소 2.6초 무적, 기존 전체 적 피해 22)은 유지한다. 아래 효과는 원작 스킬의 수치를 이식한 것이 아니라 이 슈팅 게임에 맞춘 시각적 재해석이다. C 특수기와는 별개다.

| 캐릭터 | 확인한 원작 특성 | 구현 연출 | 출처 |
|---|---|---|---|
| 히루메 | 야타가라스, 화염 공격 Breath of the Sun, 보호막을 주는 Exorcism Technique | 정화 화염환 확산, 발동 위치의 보호 결계, 적 위치의 불꽃 분출 | https://lastorigin.wiki.gg/wiki/Hirume |
| 콘스탄챠 S2 | Hunter, Winchester 1887 Custom, 원거리 화력 지원 | 다중 표적 조준 후 3회 정밀 사격과 실탄 피격 불꽃 | https://lastorigin.wiki.gg/wiki/Constantia |
| LRL | Cyclops Eternal Beam, 광역 행동력/명중 감소 | 눈 문양 집속 후 광역 빔, 보조 광선과 에너지 링 | https://lastorigin.wiki.gg/wiki/LRL |
| 멀린 | Prydwen Control Baton, Big Gun, 이동 무기고 Caladbolg | 표적 지정 후 상공에서 함포탄 도착, 시차 폭발과 충격파 | https://lastorigin.wiki.gg/wiki/Merlin |
| 파프니르 | Tesla Tail Jupiter, 생체 전기 증폭, 도시 규모 정전 임무 | EMP 확산환과 적들을 연결하는 분기 방전 | https://lastorigin.wiki.gg/wiki/Fafnir |

확인: 2026-10-03. 표의 연출명은 이 게임에서 사용하는 이름이다. 색상, 결계 기하, 공격 횟수, 함포탄 진입 방향은 시인성을 위한 창작이며 공식 연출의 복제라고 주장하지 않는다.

## 구현
- `js/bomb-vfx.js`: 발동 시점/위치/표적 스냅샷을 저장하고 게임 시간으로 진행하는 연출. 최대 동시 3개, 표적 10개. 적 객체를 붙잡거나 추가 피해를 주지 않는다.
- `js/projectile-vfx.js`: 기존 단일 인스턴스 배치에 화염환/조준선/빔/결계/눈/방전 셰이더 추가. 폭탄 인스턴스에 우선 용량 배정.
- WebGL 미지원 또는 컨텍스트 손실 시 동일한 연출 타임라인을 Canvas로 표현한다.
- `tools/bomb-preview.html`: 5종 캐릭터를 선택해 연출을 반복 재생하는 미리보기. 게임 서버에서 연다.
