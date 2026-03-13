# CLAUDE.md

## Project: Tesla Custom Wraps Editor
- 순수 HTML/CSS/JS 프로젝트 (프레임워크 없음, 번들러 없음)
- GitHub Pages로 배포 (main 브랜치 push 시 자동 배포)
- 모바일 퍼스트 UI (모바일 Safari/Chrome 기준)

## Workflow
- 코드 수정 후 반드시 검증(문법 오류, 참조 누락 확인)한 뒤 커밋 & `git push origin main`으로 바로 배포할 것
- 캐시 무효화: `index.html`의 CSS/JS `?v=` 파라미터를 변경할 것

## Architecture

### 이벤트 기반 모듈 구조
모듈 간 직접 참조 없이 `CW` 이벤트 버스를 통해 통신. IIFE 패턴으로 전역 네임스페이스 `CW`에 부착.

```
Script 로드 순서 (의존성 순):

  cw-event-bus.js      → CW 네임스페이스 + 이벤트 버스 + 공유 상태
  models.js            → 차량 모델 데이터, 헬퍼 함수 (전역)
  ui-components.js     → UI 컴포넌트 (슬라이더, 드롭존, 토스트, 바텀시트)
  image-editor.js      → 배경 지우기 에디터
  cw-layer-store.js    → CW.LayerStore - 레이어 CRUD, 자동배치 (DOM 의존 없음)
  cw-panel-detector.js → CW.PanelDetector - 패널 자동감지, 마스크, 컬러피커
  cw-renderer.js       → CW.Renderer - 캔버스 렌더링 파이프라인
  cw-canvas-input.js   → CW.CanvasInput - 터치/마우스/휠 입력 처리
  cw-export.js         → CW.Export - PNG 내보내기, 프리뷰 생성
  app.js               → App - UI 오케스트레이션, 라우팅, 탭 전환
```

### 모듈별 책임

| 모듈 | 역할 | 읽는 데이터 | 발행 이벤트 |
|------|------|------------|------------|
| `cw-event-bus.js` | 이벤트 버스 + `CW.state` 공유 상태 | - | - |
| `cw-layer-store.js` | 레이어 추가/삭제/수정/선택/정렬 | `CW.state` | `layer:added`, `layer:removed`, `layer:updated`, `layer:selected`, `layer:moved`, `layer:cleared`, `layer:imageUpdated`, `input:layerMoved` |
| `cw-panel-detector.js` | 연결 컴포넌트 분석으로 패널 자동감지, 마스크 생성, 컬러피커 | `CW.state` | `panels:detected`, `panels:colorChanged`, `render:request` |
| `cw-renderer.js` | 오프스크린 합성 + 디스플레이 렌더링 | `CW.state`, `CW.LayerStore`, `CW.PanelDetector` | - |
| `cw-canvas-input.js` | 포인터/터치/휠 이벤트 → 레이어 변환 | `CW.state`, `CW.LayerStore` | `render:request`, `input:layerMoved` |
| `cw-export.js` | PNG 내보내기, 프리뷰 DataURL | `CW.state`, `CW.Renderer` | - |
| `app.js` | 화면 전환, 탭, 레이어 리스트 UI, 컨트롤 UI | 모든 CW 모듈 | - |

### 이벤트 흐름

```
사용자 입력 (터치/마우스)
  → CW.CanvasInput: 레이어 offset/scale/rotation 수정
  → emit('render:request') + emit('input:layerMoved')
  → CW.Renderer: render() 실행
  → App: syncControlsFromEngine() 슬라이더 동기화

레이어 추가/수정
  → CW.LayerStore: emit('layer:added' / 'layer:updated')
  → CW.Renderer: on('layer:*') → render()
  → App: refreshLayerList() + refreshControls()
```

### 공유 상태 (`CW.state`)
- `templateImage` - 현재 템플릿 이미지
- `internalWidth/Height/Size` - 내부 캔버스 해상도
- `displayCanvas/Ctx` - 화면 표시용 캔버스
- `offscreen/offCtx` - 오프스크린 합성용 캔버스
- `maskCanvas` - 전체 템플릿 마스크
- `userLayerCanvas/Ctx` - 레이어 합성용 캔버스
- `checkerPattern` - 체커보드 패턴
- `currentModel` - 현재 선택된 차량 모델

### 주요 기술
- 연결 컴포넌트 라벨링(BFS)으로 패널 자동감지 (밝기 임계값 245)
- Canvas 2D 합성: `destination-in`으로 마스킹, `source-over`로 마스크 합집합
- `multiply` 블렌드 모드로 템플릿 오버레이
- 포인터 이벤트로 iOS/Android 호환 터치 처리
