# 레시피북 인수인계 (recipebook)

2026-11-17 기준.

## 한눈에

| 항목 | 내용 |
|---|---|
| 무엇 | 레시피, 식단, 장바구니, 식사 일기를 기기 안에 저장하는 개인용 PWA. 빌드 없는 HTML·JS |
| 주소 | https://coding-coconut.com/recipebook/ |
| 저장소 | `tazarem/recipebook` (GitHub Pages로 배포, push하면 반영) |
| 버전 | 0.87 (`config.js`의 `app_version`) |
| 서버 | 없음. 글은 사용자 기기의 IndexedDB에만 있음 |

## 로컬에서 보기

```bash
python3 -m http.server 8000
```

`http://localhost:8000`으로 엽니다. 서비스 워커가 옛 파일을 붙잡고 있으면 개발자 도구에서 해제하고 캐시를 지우세요.

## 파일 구조

| 파일 | 역할 |
|---|---|
| `index.html` | 화면 뼈대, 메뉴(테마·레이아웃·설치·백업·후원·전체 삭제), CSP |
| `config.js` | 버전, 스티커 개수(`sticker_count`) |
| `store/idb.js` | IndexedDB `recipebook` 버전 4: `recipe`, `shopping`(장바구니), `meal`(식단) |
| `js/recipe.js` | 레시피 목록·편집·검색, 추첨 룰렛 |
| `js/meal.js` | 식단, 식사 일기(맛 평가·스티커·사진) |
| `js/shopping.js` | 장바구니 |
| `js/tag-input.js` | 재료·태그 입력 칸 |
| `js/ui.js`, `js/install.js`, `js/init.js` | 공용 화면 부품, 설치 안내, 시작 |
| `img/stickers/` | 식사 일기 스티커 `sticker_1.png`~`sticker_29.png`, `draw.py` |

## 규칙

- **버전**: 고칠 때마다 0.01 올립니다 (0.86 → 0.87). `config.js`의 `app_version`과 `service-worker.js`의 캐시 이름을 같이 바꿉니다. 한 커밋에 한 번만.
- **동작 줄이기 설정으로 애니메이션을 끄지 않습니다.** `prefers-reduced-motion` 분기 때문에 사용자 폰에서 메뉴·룰렛·폭죽이 사라져 보였던 적이 있습니다.
- **스티커 늘리기**: 원본은 PNG입니다(직접 다듬은 그림). 새 PNG를 `sticker_N.png`로 넣고 `config.js`의 `sticker_count`와 `service-worker.js`의 캐시 목록을 같이 고칩니다. `draw.py`는 없는 번호만 새로 그리고 기존 PNG는 덮어쓰지 않습니다.
- 원작자가 불분명한 그림은 공개 사이트라 넣지 않습니다.

## 미뤄 둔 아이디어

사용자가 꺼낼 때만 이어 갑니다.
- 식비 기입장: 장바구니에서 식비 추산
- 장바구니 알람: 앱이 꺼져 있어도 울리려면 푸시 서버가 필요해서 보류
- 서버 붙이기: 로그인 같은 게 생길 때 고려
- 냉장고 소비기한 알림 (비슷한 앱 "식단서랍"에서 본 기능)
