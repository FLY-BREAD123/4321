// 역할에 자동으로 배분할 색상 팔레트 모음
// 위 -> 아래 순서로 계층에 맞게 자연스럽게 이어지도록 구성됨

const PALETTES = {
  violet: {
    name: '바이올렛 나이트',
    emoji: '🟣',
    desc: '어두운 보라 -> 라벤더로 이어지는 기본 팔레트',
    colors: [
      '#c9a4ff', '#b478ff', '#9d5cff', '#8a3ffb', '#7431e0',
      '#6027c2', '#4d1fa3', '#3d1985', '#2f1467', '#241050',
    ],
  },
  neon: {
    name: '네온 사이버',
    emoji: '💠',
    desc: '형광 청록 · 마젠타 계열의 강한 대비',
    colors: [
      '#ff2e88', '#ff6ec7', '#c04cfd', '#7b5cff', '#3d7bff',
      '#00b3ff', '#00e5d0', '#2bff88', '#a6ff3d', '#ffe14d',
    ],
  },
  pastel: {
    name: '파스텔 소프트',
    emoji: '🍥',
    desc: '눈이 편한 부드러운 저채도 색',
    colors: [
      '#ffb3c1', '#ffc9a9', '#ffe3a3', '#d5f0a8', '#a8ebc8',
      '#a5e4ef', '#a8c8f5', '#c0b6f2', '#e0b3ef', '#f5b8d8',
    ],
  },
  ember: {
    name: '엠버 플레임',
    emoji: '🔥',
    desc: '붉은 계열 - 관리 · 스태프 서버에 어울림',
    colors: [
      '#ffd166', '#ffb03b', '#ff8c26', '#ff6b35', '#f4511e',
      '#e03e2d', '#c62828', '#a31f1f', '#821818', '#5e1010',
    ],
  },
  ocean: {
    name: '오션 딥',
    emoji: '🌊',
    desc: '차분한 청록 -> 남색 그라데이션',
    colors: [
      '#7ee8fa', '#4fd1e0', '#2bb8cf', '#199fbb', '#1487a3',
      '#116f8a', '#0e5a75', '#0c4760', '#09354b', '#072736',
    ],
  },
  mono: {
    name: '모노 그레이',
    emoji: '⚪',
    desc: '색을 거의 안 쓰는 미니멀 세팅',
    colors: [
      '#ffffff', '#e5e5e5', '#cccccc', '#b3b3b3', '#999999',
      '#808080', '#666666', '#4d4d4d', '#3a3a3a', '#2b2b2b',
    ],
  },
  forest: {
    name: '포레스트',
    emoji: '🌿',
    desc: '초록 계열 - 마인크래프트 / 자연 컨셉',
    colors: [
      '#d7f9a8', '#aeea6a', '#86d94a', '#5fc22f', '#3faa20',
      '#2f8c1c', '#237318', '#1a5c14', '#134610', '#0d330c',
    ],
  },
  sunset: {
    name: '선셋 글로우',
    emoji: '🌇',
    desc: '노을빛 핑크 · 오렌지 · 퍼플 믹스',
    colors: [
      '#ffe0a3', '#ffc078', '#ff9f6e', '#ff7b7b', '#f26497',
      '#d95bb0', '#b558c4', '#9155cc', '#6f52c4', '#524bab',
    ],
  },
};

/** '#rrggbb' -> [r, g, b] */
function rgb(hex) {
  const h = String(hex).replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** 두 색 사이를 t(0~1) 비율로 보간 */
function lerp(a, b, t) {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  const mix = (x, y) => {
    // 디스코드는 #000000 을 '색 없음'으로 처리하므로 최소값을 살짝 띄운다
    const v = Math.max(8, Math.min(255, Math.round(x + (y - x) * t)));
    return v.toString(16).padStart(2, '0');
  };
  return `#${mix(ar, br)}${mix(ag, bg)}${mix(ab, bb)}`;
}

/**
 * 팔레트에서 n개의 색을 균등하게 뽑아온다.
 * 팔레트 색상 수보다 역할이 많아도 사이 색을 보간해 만들어내므로
 * 색이 중복되지 않고 위 -> 아래로 자연스러운 그라데이션이 된다.
 */
function pickColors(paletteId, count) {
  const palette = PALETTES[paletteId] || PALETTES.violet;
  const src = palette.colors;
  if (count <= 0) return [];
  if (count === 1) return [src[Math.floor(src.length / 2)]];

  const out = [];
  for (let i = 0; i < count; i++) {
    const pos = (i * (src.length - 1)) / (count - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(src.length - 1, lo + 1);
    out.push(lo === hi ? src[lo] : lerp(src[lo], src[hi], pos - lo));
  }
  return out;
}

/** '#rrggbb' -> 0xrrggbb */
function toInt(hex) {
  return parseInt(String(hex).replace('#', ''), 16);
}

module.exports = { PALETTES, pickColors, toInt };
