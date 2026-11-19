import { EASE_GLSL } from "@/lib/particle-kit";

/**
 * Shaders for the site's particle cloud (components/fx/ParticleMorph).
 *
 * Every dot knows where it sits in two shapes (`aFrom`, `aTo`) and the vertex shader places it
 * somewhere between them. Positions are worked out directly in CSS pixels, y down, so a shape
 * can be pinned to an element on the page; nothing here uses a camera matrix.
 */
export const cloudVertex = /* glsl */ `
  // A frame says where a shape is on screen: centre x, centre y, size in px, and its kind
  // (0 = the portrait, 1 = any other shape).
  uniform vec4 uFrom;
  uniform vec4 uTo;
  uniform vec2 uFromTurn;   // lean back, turn: radians
  uniform vec2 uToTurn;
  uniform float uFromAlpha;
  uniform float uToAlpha;
  uniform float uMix;       // how far from one shape to the other, 0..1
  uniform float uTime;
  uniform float uIntro;     // the first gathering, 0..1
  uniform float uSpacing;   // px between portrait dots
  uniform float uDot;       // px size of a dot in any other shape
  uniform vec2 uViewport;
  uniform vec2 uPointer;    // px, y down
  uniform float uHover;     // 0..1: the pointer is over the page
  uniform vec3 uLens;       // the open hover lens: centre x, y and radius, px
  uniform float uLensMax;
  uniform float uLensDot;
  uniform vec3 uReveal;     // the hero's photo reveal: centre x, y and radius, px
  uniform float uSwing;     // how far dots swing out mid-flight, in viewport heights
  uniform float uMist;      // 1 while the footer name is being written

  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute float aLum;
  attribute vec3 aSeed;

  varying float vLum;
  varying float vSeed;
  varying float vAlpha;

  const float EYE = 2.2;    // distance of the viewer from a shape's centre, in shape sizes
  const float PI = 3.14159265;

  ${EASE_GLSL}

  vec3 turn(vec3 p, vec2 angles) {
    float c = cos(angles.y), s = sin(angles.y);
    p = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
    c = cos(angles.x); s = sin(angles.x);
    return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
  }

  // The portrait thins out towards the hips, so the name line passing behind it shows through.
  // y is in portrait heights: -0.5 is the bottom edge.
  float thinLowerBody(float y) {
    return mix(0.12, 1.0, smoothstep(-0.5, -0.12, y));
  }

  // One dot of one shape: where it lands (xy, px), how big it is (z, px) and how solid (w).
  vec4 land(vec3 point, vec4 frame, vec2 angles, float alpha) {
    vec3 p = turn(point, angles);
    p.z = min(p.z, EYE - 0.3);
    float perspective = EYE / (EYE - p.z);
    vec2 at = frame.xy + vec2(p.x, -p.y) * perspective * frame.z;
    if (frame.w < 0.5) {
      // Portrait: brighter parts of the photo are bigger dots.
      return vec4(at, uSpacing * (0.3 + aLum * 0.95) * perspective, alpha * thinLowerBody(point.y));
    }
    // Any other shape: the near side is larger and brighter than the far side.
    float shade = clamp(0.55 + p.z * 1.4, 0.2, 1.0);
    return vec4(at, uDot * (0.6 + aSeed.y * 0.8) * perspective, alpha * shade);
  }

  // A portrait at rest is never quite still: it sways (more at the head than the hips), a slow
  // shimmer rises through it, and its brighter dots lean towards the pointer a little more
  // than its darker ones, which reads as depth.
  vec2 breathe() {
    float height = aFrom.y + 0.5;
    vec2 offset = vec2(sin(uTime * 0.45) * 4.0, -sin(uTime * 1.1) * 3.0) * height;
    offset.x += sin(aFrom.y * 16.0 - uTime * 1.8 + aSeed.z * 2.0) * 1.4 * smoothstep(0.1, 0.9, height);
    offset += (uPointer - uFrom.xy) / uViewport * (aLum - 0.4) * 28.0;
    return offset;
  }

  void main() {
    vec3 away = normalize(aSeed * 2.0 - 1.0 + 0.0001);
    bool fromPortrait = uFrom.w < 0.5;

    // Leaving the portrait, and writing the footer name, the dots go together, as a mist that
    // condenses. Between other shapes they leave one after another.
    bool mist = fromPortrait || uMist > 0.5;
    float lead = aSeed.x * (mist ? 0.3 : 0.45);
    float t = easeInOut(clamp((uMix - lead) / (mist ? 0.7 : 0.55), 0.0, 1.0));
    float flight = sin(t * PI);

    vec4 a = land(aFrom, uFrom, uFromTurn, uFromAlpha);
    if (fromPortrait) a.xy += breathe();
    vec4 b = land(aTo, uTo, uToTurn, uToAlpha);

    vec2 at = mix(a.xy, b.xy, t) + away.xy * flight * uViewport.y * uSwing;
    float size = mix(a.z, b.z, t);
    float alpha = mix(a.w, b.w, t);
    if (mist) {
      size *= 1.0 + flight * 0.6;
      alpha *= 1.0 - flight * 0.45;
    }
    // At the footer the mist lifts before it settles into the letters.
    if (uMist > 0.5) at.y -= flight * uViewport.y * 0.2;

    // The first gathering: from scattered across the screen to the shape.
    float gather = clamp((uIntro - aSeed.x * 0.6) / 0.4, 0.0, 1.0);
    gather = 1.0 - pow(1.0 - gather, 3.0);
    vec2 scattered = uViewport * 0.5 + away.xy * uViewport.y * (0.4 + aSeed.y * 0.6);
    at = mix(scattered, at, gather);
    alpha *= 0.4 + 0.6 * gather;

    // Every dot drifts a pixel or so, always.
    at += vec2(sin(uTime * 0.8 + aSeed.y * 2.0 * PI), cos(uTime * 0.7 + aSeed.z * 2.0 * PI)) * 1.2;

    // The hover lens: dots peel away from the shape and pack the circle evenly, turning
    // slowly, with a few loose ones just outside the edge.
    float packed = clamp(clamp(uLens.z / uLensMax, 0.0, 1.0) * 1.4 - aSeed.x * 0.4, 0.0, 1.0);
    packed = packed * packed * (3.0 - 2.0 * packed);
    float angle = aSeed.z * 2.0 * PI + uTime * 0.25 * (aSeed.y - 0.5);
    float reach = uLens.z * (sqrt(aSeed.y) * 0.97 + 0.08 * step(0.93, aSeed.x) * aSeed.z);
    at = mix(at, uLens.xy + vec2(cos(angle), sin(angle)) * reach, packed);
    size = mix(size, uLensDot, packed);
    // Above 1 on purpose: the disc is what the lens's copy is read against, so it has to stay
    // solid even where the fragment shader dims dots on the light theme.
    alpha = mix(alpha, 1.7, packed);

    // Dots step aside for the pointer.
    vec2 fromPointer = at - uPointer;
    float push = smoothstep(130.0, 0.0, length(fromPointer)) * uHover * (1.0 - packed);
    at += normalize(fromPointer + 0.0001) * push * 40.0;

    // Over the hero's portrait the dots inside a circle scatter and fade, and the photograph
    // behind them shows through (only while the cloud is still the portrait).
    float clear = step(uFrom.w, 0.5) * (1.0 - t) * smoothstep(uReveal.z, uReveal.z * 0.4, length(at - uReveal.xy));
    at += normalize(at - uReveal.xy + 0.0001) * clear * 24.0;
    alpha *= 1.0 - clear * 0.95;

    gl_Position = vec4(at.x / uViewport.x * 2.0 - 1.0, 1.0 - at.y / uViewport.y * 2.0, 0.0, 1.0);
    gl_PointSize = size * (1.0 + push * 0.6);

    float fromLum = uFrom.w < 0.5 ? aLum : 0.85;
    float toLum = uTo.w < 0.5 ? aLum : 0.85;
    vLum = mix(mix(fromLum, toLum, t), 1.0, packed);
    vSeed = aSeed.x;
    vAlpha = alpha;
  }
`;

/** A round, soft-edged dot in the page's foreground colour; a few are the accent. */
export const dotFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  varying float vLum;
  varying float vSeed;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    vec3 color = uColor * (0.25 + 0.75 * vLum);
    color = mix(color, uAccent, step(0.985, vSeed));
    // On the light theme (dark dots on sand) the cloud is quieter than on the dark one.
    float paper = 1.0 - dot(uColor, vec3(0.3333));
    gl_FragColor = vec4(color, smoothstep(0.5, 0.3, d) * vAlpha * mix(1.0, 0.6, paper));
  }
`;

/**
 * Shaders for the dot stage (components/fx/DotStage): a flat swarm that redraws pictures.
 * Each dot flies from where it is (`aFrom`, px) to its place in the next picture (`aTo`, 0..1
 * across `uRect`), taking that picture's colour as it goes.
 */
export const stageVertex = /* glsl */ `
  attribute vec2 aFrom;
  attribute vec2 aTo;
  attribute vec3 aFromColor;
  attribute vec3 aToColor;
  attribute vec3 aSeed;
  uniform vec4 uRect;       // the picture's box on screen: x, y, width, height (px)
  uniform vec2 uViewport;
  uniform vec2 uPointer;
  uniform float uMix;
  uniform float uTime;
  uniform float uSize;
  uniform float uRatio;
  varying vec3 vColor;

  void main() {
    // Dots leave one after another, each easing in and out.
    float t = clamp(uMix * 1.5 - aSeed.z * 0.5, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    vec2 at = mix(aFrom, uRect.xy + aTo * uRect.zw, t);
    at += sin(t * 3.14159265) * (aSeed.xy - 0.5) * 420.0;   // an arc on the way
    at += vec2(sin(uTime * 0.8 + aSeed.x * 6.2832), cos(uTime * 0.7 + aSeed.y * 6.2832)) * 0.35;

    vec2 fromPointer = at - uPointer;
    float gap = length(fromPointer);
    if (gap > 0.001) at += fromPointer / gap * pow(max(0.0, 1.0 - gap / 130.0), 2.0) * 60.0;

    gl_Position = vec4(at.x / uViewport.x * 2.0 - 1.0, 1.0 - at.y / uViewport.y * 2.0, 0.0, 1.0);
    gl_PointSize = uSize * uRatio;
    vColor = mix(aFromColor, aToColor, t);
  }
`;

export const stageFragment = /* glsl */ `
  varying vec3 vColor;
  uniform float uAlpha;

  void main() {
    if (length(gl_PointCoord - 0.5) > 0.5) discard;
    gl_FragColor = vec4(vColor, uAlpha);
  }
`;
