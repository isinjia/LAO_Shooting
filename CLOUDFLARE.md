# Cloudflare 배포

Workers의 앱 만들기 → 애플리케이션 설정에 다음 값을 입력합니다.

| 항목 | 값 |
| --- | --- |
| 프로젝트 이름 | `lao-shooting` |
| 빌드 명령 | `npm run build` |
| 배포 명령 | `npx wrangler deploy` |
| 미리보기 명령 | `npx wrangler versions upload` |
| 루트 디렉터리 | 저장소 루트 |

`wrangler.jsonc`가 `dist` 폴더만 업로드하도록 지정합니다.
프로젝트 이름을 바꾸면 설정 파일의 `name`도 맞춰주세요.

## 배포 파일 생성

`npm run build`는 `tools/build-cloudflare.mjs`를 실행합니다.

- `index.html`, `play.html`, JS, CSS와 게임용 미디어를 복사합니다.
- 캐릭터 스프라이트 시트와 저해상도 시트를 포함합니다.
- 시트가 없는 캐릭터는 개별 애니메이션 프레임을 유지합니다.
- 시트로 대체되는 원본 프레임, Unity 소스, GLB 미리보기, 작업 도구, 로그, 의존성은 제외합니다.
- 필요한 에셋 누락, 시트의 프레임 수 불일치, 파일당 25MiB 초과, 총 20,000개 초과 시 실패합니다.
- 기본 보안 헤더를 생성합니다. 모바일 게임 화면의 같은 출처 iframe은 유지합니다.

원본 파일은 변경하지 않으며, 생성된 `dist`만 매번 교체합니다.
`dist`는 Git에 올리지 않고 Cloudflare 빌드에서 생성합니다.

이 설정은 공개 게임 배포용입니다. 배포 인증 토큰은 Cloudflare에서 관리하며 게임 파일에 넣지 않습니다.
